import { sql } from '../db/helpers';

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

interface ToolParam {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

interface Message {
  role: 'user' | 'model';
  parts: { text: string }[];
}

export async function callGemini(
  systemPrompt: string,
  messages: Message[],
  tools?: ToolParam[],
  keys?: string[],
) {
  const allKeys = keys || [];
  const apiKey = allKeys[0] || process.env.GEMINI_API_KEY || '';

  const contents = messages.map(m => ({
    role: m.role,
    parts: m.parts,
  }));

  const body: Record<string, unknown> = {
    system_instruction: { parts: [{ text: systemPrompt }] },
    contents,
    generationConfig: { temperature: 0.7, maxOutputTokens: 1024 },
  };

  if (tools && tools.length > 0) {
    body.tools = [{ function_declarations: tools }];
  }

  let lastError: Error | null = null;
  const keyPool = allKeys.length > 0 ? allKeys : [apiKey];

  for (const key of keyPool) {
    if (!key) continue;
    try {
      const url = `${GEMINI_API_BASE}?key=${key}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.status === 429) { lastError = new Error('Rate limited'); continue; }
      if (!res.ok) { lastError = new Error(`API error: ${res.status}`); continue; }
      const data = await res.json();
      return data;
    } catch (err: any) {
      lastError = err;
    }
  }
  throw lastError || new Error('All API keys exhausted');
}

export async function getAiKeys(): Promise<string[]> {
  try {
    const result = await sql("SELECT value FROM system_settings WHERE key='aiKeys'");
    if (result.rows.length > 0) return JSON.parse(result.rows[0].value as string);
  } catch { /* ignore */ }
  return [];
}
