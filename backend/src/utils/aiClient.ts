import { sql } from '../db/helpers';
import { getToolDeclarations, handleToolCall } from './aiTools';
import { getAdapter, ProviderConfig, ChatMessage, ToolDef } from './aiAdapters';

const SYSTEM_INSTRUCTION = `أنت مساعد ذكي متخصص لنظام إدارة مراكز التدريب (LMS).
النظام بالتعاون مع المعهد العالي للعلوم الإدارية بالقطامية (HIMS).

ملخص قاعدة البيانات:
- users: المستخدمون (id, name, email, phone, role_id, is_active)
  الأدوار: 1=admin (مدير), 2=employee (موظف), 3=student (طالب)
- courses: الكورسات (id, title_ar, title_en, description, price, category_id, max_students, instructor, is_active, featured)
- categories: التصنيفات (id, name_ar, name_en)
- orders: الطلبات (id, user_id, course_id, amount, status, payment_method, notes, created_at)
  حالات الطلب: pending (معلق) ← review (قيد المراجعة) ← paid (مدفوع) أو cancelled (ملغي)
- groups: المجموعات الدراسية (id, course_id, name, schedule, zoom_link, start_date, end_date, is_active)
- group_students: طلاب المجموعات (group_id, user_id)
- lectures: المحاضرات (id, group_id, day_of_week, time_from, time_to, topic, date, is_completed)
- certificates: الشهادات (id, user_id, course_id, serial_id, issued_at)
- cart_items: سلة التسوق (user_id, course_id) — كل كورس يضاف مرة واحدة فقط

لديك أدوات متعددة متاحة. استخدمها حسب الحاجة.
أجب باللغة العربية الفصحى بوضوح واحترافية.`;

async function getProviders(): Promise<ProviderConfig[]> {
  try {
    const result = await sql("SELECT value FROM system_settings WHERE key='aiProviders'");
    if (result.rows.length > 0) {
      const parsed = JSON.parse(result.rows[0].value as string);
      if (parsed && Array.isArray(parsed.providers)) return parsed.providers;
    }
  } catch {}

  return [];
}

interface ChatRequest {
  messages: { role: string; text?: string; image?: string }[];
  userId: number;
  roleId: number;
}

interface ChatResponse {
  content: string;
  refreshRequired: boolean;
}

export async function chatCompletion(req: ChatRequest): Promise<ChatResponse> {
  const allProviders = await getProviders();
  const enabledProviders = allProviders
    .filter(p => p.enabled && p.apiKey)
    .sort((a, b) => a.priority - b.priority);

  if (enabledProviders.length === 0) {
    throw new Error('لا توجد مزوّدات ذكاء اصطناعي مفعّلة. أضف مفتاح API في الإعدادات.');
  }

  const tools: ToolDef[] = getToolDeclarations();
  const MAX_TOOL_ITERATIONS = 5;

  let messages: ChatMessage[] = req.messages.map(m => ({
    role: (m.role === 'assistant' || m.role === 'model' ? 'assistant' : 'user') as 'user' | 'assistant',
    content: m.text || m.content || '',
  }));

  let stickyProvider: string | null = null;

  for (let iter = 0; iter < MAX_TOOL_ITERATIONS; iter++) {
    const candidates = stickyProvider
      ? enabledProviders.filter(p => p.id === stickyProvider)
      : enabledProviders;

    if (candidates.length === 0) {
      throw new Error('لا توجد مزوّدات متاحة بعد فشل المزوّد الأساسي');
    }

    let lastError: Error | null = null;

    for (const provider of candidates) {
      try {
        const adapter = getAdapter(provider.type);
        const body = adapter.buildRequest(provider, SYSTEM_INSTRUCTION, messages, tools);
        const headers = adapter.buildHeaders(provider);
        const url = adapter.buildUrl(provider);

        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...headers },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(15000),
        });

        if (res.status === 429) {
          lastError = new Error(`${provider.name}: Rate limited`);
          continue;
        }
        if (!res.ok) {
          const errText = await res.text().catch(() => '');
          lastError = new Error(`${provider.name}: HTTP ${res.status} - ${errText.substring(0, 200)}`);
          console.warn(`${provider.name} failed (${res.status}), trying next`);
          continue;
        }

        const data = await res.json();
        const response = adapter.parseResponse(data);

        stickyProvider = provider.id;

        if (response.toolCalls && response.toolCalls.length > 0) {
          for (const tc of response.toolCalls) {
            const result = await handleToolCall(tc.name, tc.args, req.userId, req.roleId);
            messages.push({
              role: 'assistant',
              content: '',
              toolCalls: [{ id: tc.id, name: tc.name, args: tc.args }],
            });
            messages.push({
              role: 'tool',
              content: result,
              toolCallId: tc.id,
            });
          }
          break;
        }

        return { content: response.content || 'عذراً، لم أتمكن من معالجة طلبك', refreshRequired: false };
      } catch (err: any) {
        lastError = err;
        console.warn(`Provider ${provider.name} error: ${err?.message?.substring(0, 100)}`);
      }
    }

    if (lastError) {
      const msg = lastError.message || '';
      const isKey = msg.includes('leaked') || msg.includes('PERMISSION_DENIED') || msg.includes('401') || msg.includes('403');
      const isQuota = msg.includes('Rate limited') || msg.includes('429') || msg.includes('quota') || msg.includes('exhausted');
      if (isKey) throw new Error('المفتاح الحالي غير صالح أو تم تعطيله. أضف مفتاحاً جديداً في الإعدادات.');
      if (isQuota) throw new Error('انتهت حصة API لجميع المزوّدات');
      if (msg.includes('No candidates') || msg.includes('SAFETY')) throw new Error('تم رفض الطلب بسبب سياسات السلامة');
      throw new Error(`فشل جميع المزوّدات: ${msg.substring(0, 150)}`);
    }
  }

  throw new Error('تجاوز المساعد الذكي الحد الأقصى لاستدعاءات الأدوات');
}
