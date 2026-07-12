export type ProviderType = 'gemini' | 'openai' | 'anthropic' | 'openai-compat';

export interface ProviderConfig {
  id: string;
  name: string;
  type: ProviderType;
  enabled: boolean;
  priority: number;
  apiKey: string;
  apiUrl: string;
  models: string[];
  selectedModel: string;
}

export interface ToolDef {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'tool';
  content: string;
  toolCalls?: Array<{ id: string; name: string; args: any }>;
  toolCallId?: string;
}

export interface ChatResponse {
  content?: string;
  toolCalls?: Array<{ id: string; name: string; args: any }>;
}

export interface AIAdapter {
  type: ProviderType;
  defaultApiUrl: string;
  defaultModels: string[];
  buildRequest(config: ProviderConfig, systemPrompt: string, messages: ChatMessage[], tools: ToolDef[]): any;
  buildHeaders(config: ProviderConfig): Record<string, string>;
  buildUrl(config: ProviderConfig): string;
  parseResponse(data: any): ChatResponse;
  fetchModels(config: ProviderConfig): Promise<string[]>;
}

// ─── Gemini Adapter ─────────────────────────────────────

function convertToGemini(messages: ChatMessage[]) {
  const contents: any[] = [];
  for (const m of messages) {
    if (m.role === 'tool') {
      contents.push({
        role: 'function',
        parts: [{
          functionResponse: {
            name: m.toolCallId || 'unknown',
            response: { name: m.toolCallId || 'unknown', content: { text: m.content } },
          },
        }],
      });
    } else if (m.toolCalls && m.toolCalls.length > 0) {
      contents.push({
        role: 'model',
        parts: m.toolCalls.map((tc: any) => ({
          functionCall: { name: tc.name, args: typeof tc.args === 'string' ? JSON.parse(tc.args) : tc.args },
        })),
      });
    } else {
      contents.push({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] });
    }
  }
  return contents;
}

const geminiAdapter: AIAdapter = {
  type: 'gemini',
  defaultApiUrl: 'https://generativelanguage.googleapis.com/v1beta',
  defaultModels: ['gemini-2.5-flash', 'gemini-flash-latest', 'gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-1.5-pro'],

  buildRequest(config, systemPrompt, messages, tools) {
    const body: any = {
      system_instruction: { parts: [{ text: systemPrompt }] },
      contents: convertToGemini(messages),
      generationConfig: { temperature: 0.7, maxOutputTokens: 2048 },
    };
    if (tools.length > 0) {
      body.tools = [{
        function_declarations: tools.map(t => ({ name: t.name, description: t.description, parameters: t.parameters })),
      }];
    }
    return body;
  },

  buildHeaders() {
    return {};
  },

  buildUrl(config) {
    const base = config.apiUrl.replace(/\/+$/, '');
    return `${base}/models/${config.selectedModel}:generateContent?key=${config.apiKey}`;
  },

  parseResponse(data: any): ChatResponse {
    const candidate = data?.candidates?.[0];
    if (!candidate) throw new Error('No candidates in Gemini response');
    if (candidate.finishReason === 'SAFETY') throw new Error('تم رفض الطلب بسبب سياسات السلامة');
    const parts: any[] = candidate?.content?.parts || [];
    const fnCalls = parts.filter((p: any) => p.functionCall);
    const texts = parts.filter((p: any) => p.text);
    if (fnCalls.length > 0) {
      return {
        toolCalls: fnCalls.map((fc: any) => ({
          id: fc.functionCall.name,
          name: fc.functionCall.name,
          args: fc.functionCall.args || {},
        })),
      };
    }
    return { content: texts.map((p: any) => p.text).join('\n') || '' };
  },

  async fetchModels(config) {
    try {
      const base = config.apiUrl.replace(/\/+$/, '');
      const res = await fetch(`${base}/models?key=${config.apiKey}`, { signal: AbortSignal.timeout(5000) });
      const data: any = await res.json();
      const models: string[] = (data.models || []).map((m: any) => m.name.replace(/^models\//, ''));
      return models.filter((n: string) => n.includes('gemini'));
    } catch { return this.defaultModels; }
  },
};

// ─── OpenAI Adapter ─────────────────────────────────────

function convertToOpenAI(messages: ChatMessage[]) {
  return messages.map(m => {
    if (m.role === 'tool') {
      return { role: 'tool', tool_call_id: m.toolCallId || 'call_1', content: m.content };
    }
    if (m.toolCalls && m.toolCalls.length > 0) {
      return {
        role: 'assistant',
        content: m.content || null,
        tool_calls: m.toolCalls.map(tc => ({
          id: tc.id || `call_${Date.now()}`,
          type: 'function',
          function: { name: tc.name, arguments: typeof tc.args === 'string' ? tc.args : JSON.stringify(tc.args) },
        })),
      };
    }
    return { role: m.role, content: m.content };
  });
}

const openaiAdapter: AIAdapter = {
  type: 'openai',
  defaultApiUrl: 'https://api.openai.com/v1',
  defaultModels: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo'],

  buildRequest(config, systemPrompt, messages, tools) {
    const msgArray: any[] = [{ role: 'system', content: systemPrompt }, ...convertToOpenAI(messages)];
    const body: any = { model: config.selectedModel, messages: msgArray };
    if (tools.length > 0) {
      body.tools = tools.map(t => ({
        type: 'function',
        function: { name: t.name, description: t.description, parameters: t.parameters },
      }));
    }
    return body;
  },

  buildHeaders(config) {
    return { 'Authorization': `Bearer ${config.apiKey}` };
  },

  buildUrl(config) {
    const base = config.apiUrl.replace(/\/+$/, '');
    return `${base}/chat/completions`;
  },

  parseResponse(data: any): ChatResponse {
    const choice = data?.choices?.[0];
    if (!choice) throw new Error('No choices in OpenAI response');
    const msg = choice.message || {};
    if (msg.tool_calls && msg.tool_calls.length > 0) {
      return {
        toolCalls: msg.tool_calls.map((tc: any) => ({
          id: tc.id,
          name: tc.function.name,
          args: (() => { try { return JSON.parse(tc.function.arguments); } catch { return tc.function.arguments; } })(),
        })),
      };
    }
    return { content: msg.content || '' };
  },

  async fetchModels(config) {
    try {
      const base = config.apiUrl.replace(/\/+$/, '');
      const res = await fetch(`${base}/models`, {
        headers: { 'Authorization': `Bearer ${config.apiKey}` },
        signal: AbortSignal.timeout(5000),
      });
      const data: any = await res.json();
      return (data.data || []).map((m: any) => m.id);
    } catch { return this.defaultModels; }
  },
};

// ─── Anthropic Claude Adapter ───────────────────────────

function convertToClaude(messages: ChatMessage[]) {
  const result: any[] = [];
  for (const m of messages) {
    if (m.role === 'tool') {
      result.push({
        role: 'user',
        content: [{ type: 'tool_result', tool_use_id: m.toolCallId || 'tu_1', content: m.content }],
      });
    } else if (m.toolCalls && m.toolCalls.length > 0) {
      result.push({
        role: 'assistant',
        content: m.toolCalls.map(tc => ({
          type: 'tool_use',
          id: tc.id || `tu_${Date.now()}`,
          name: tc.name,
          input: typeof tc.args === 'string' ? JSON.parse(tc.args) : tc.args,
        })),
      });
    } else {
      result.push({ role: m.role, content: m.content });
    }
  }
  return result;
}

const claudeAdapter: AIAdapter = {
  type: 'anthropic',
  defaultApiUrl: 'https://api.anthropic.com/v1',
  defaultModels: ['claude-3-5-sonnet-20241022', 'claude-3-opus-20240229', 'claude-3-haiku-20240307'],

  buildRequest(config, systemPrompt, messages, tools) {
    const body: any = {
      model: config.selectedModel,
      system: systemPrompt,
      messages: convertToClaude(messages),
      max_tokens: 2048,
    };
    if (tools.length > 0) {
      body.tools = tools.map(t => ({
        name: t.name,
        description: t.description,
        input_schema: t.parameters,
      }));
    }
    return body;
  },

  buildHeaders(config) {
    return {
      'x-api-key': config.apiKey,
      'anthropic-version': '2023-06-01',
    };
  },

  buildUrl(config) {
    const base = config.apiUrl.replace(/\/+$/, '');
    return `${base}/messages`;
  },

  parseResponse(data: any): ChatResponse {
    const content: any[] = data?.content || [];
    const toolUses = content.filter((c: any) => c.type === 'tool_use');
    const texts = content.filter((c: any) => c.type === 'text');
    if (toolUses.length > 0) {
      return {
        toolCalls: toolUses.map((tu: any) => ({
          id: tu.id,
          name: tu.name,
          args: tu.input || {},
        })),
      };
    }
    return { content: texts.map((t: any) => t.text).join('\n') || '' };
  },

  async fetchModels(config) {
    try {
      const base = config.apiUrl.replace(/\/+$/, '');
      const res = await fetch(`${base}/models`, {
        headers: { 'x-api-key': config.apiKey, 'anthropic-version': '2023-06-01' },
        signal: AbortSignal.timeout(5000),
      });
      const data: any = await res.json();
      return (data.data || []).map((m: any) => m.id);
    } catch { return this.defaultModels; }
  },
};

// ─── OpenAI-Compatible Adapter ──────────────────────────

const openaiCompatAdapter: AIAdapter = {
  type: 'openai-compat',
  defaultApiUrl: 'http://localhost:11434/v1',
  defaultModels: ['llama3', 'mistral', 'phi3', 'qwen2'],

  buildRequest(config, systemPrompt, messages, tools) {
    return openaiAdapter.buildRequest(config, systemPrompt, messages, tools);
  },

  buildHeaders(config) {
    if (config.apiKey) return { 'Authorization': `Bearer ${config.apiKey}` } as Record<string, string>;
    return {} as Record<string, string>;
  },

  buildUrl(config) {
    return openaiAdapter.buildUrl(config);
  },

  parseResponse(data: any): ChatResponse {
    return openaiAdapter.parseResponse(data);
  },

  async fetchModels(config) {
    try {
      const base = config.apiUrl.replace(/\/+$/, '');
      const headers: Record<string, string> = {};
      if (config.apiKey) headers['Authorization'] = `Bearer ${config.apiKey}`;
      const res = await fetch(`${base}/models`, { headers, signal: AbortSignal.timeout(5000) });
      const data: any = await res.json();
      return (data.data || []).map((m: any) => m.id);
    } catch { return this.defaultModels; }
  },
};

// ─── Registry ───────────────────────────────────────────

const adapters: Record<ProviderType, AIAdapter> = {
  gemini: geminiAdapter,
  openai: openaiAdapter,
  anthropic: claudeAdapter,
  'openai-compat': openaiCompatAdapter,
};

export function getAdapter(type: ProviderType): AIAdapter {
  const a = adapters[type];
  if (!a) throw new Error(`Unknown provider type: ${type}`);
  return a;
}

export function getProviderTypes(): { type: ProviderType; name: string; description: string }[] {
  return [
    { type: 'gemini', name: 'Google Gemini', description: 'Gemini API من Google' },
    { type: 'openai', name: 'OpenAI', description: 'ChatGPT API من OpenAI' },
    { type: 'anthropic', name: 'Anthropic Claude', description: 'Claude API من Anthropic' },
    { type: 'openai-compat', name: 'OpenAI-Compatible', description: 'أي API متوافق مع OpenAI (Ollama, Azure, LM Studio)' },
  ];
}

export function getDefaultProviders(): ProviderConfig[] {
  return [
    {
      id: 'gemini', name: 'Google Gemini', type: 'gemini', enabled: false, priority: 1,
      apiKey: '', apiUrl: geminiAdapter.defaultApiUrl,
      models: [...geminiAdapter.defaultModels], selectedModel: geminiAdapter.defaultModels[0],
    },
    {
      id: 'openai', name: 'OpenAI', type: 'openai', enabled: false, priority: 2,
      apiKey: '', apiUrl: openaiAdapter.defaultApiUrl,
      models: [...openaiAdapter.defaultModels], selectedModel: openaiAdapter.defaultModels[0],
    },
    {
      id: 'anthropic', name: 'Anthropic Claude', type: 'anthropic', enabled: false, priority: 3,
      apiKey: '', apiUrl: claudeAdapter.defaultApiUrl,
      models: [...claudeAdapter.defaultModels], selectedModel: claudeAdapter.defaultModels[0],
    },
  ];
}
