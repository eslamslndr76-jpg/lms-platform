import { Router, Request, Response } from 'express';
import { sql } from '../db/helpers';
import { authMiddleware } from '../middleware/auth';
import { requireRole, ADMIN } from '../middleware/rbac';
import { getAdapter, getProviderTypes, ProviderConfig, ProviderType } from '../utils/aiAdapters';

const router = Router();

async function getProviderConfig(): Promise<{ providers: ProviderConfig[] }> {
  try {
    const result = await sql("SELECT value FROM system_settings WHERE key='aiProviders'");
    if (result.rows.length > 0) {
      const parsed = JSON.parse(result.rows[0].value as string);
      if (parsed && Array.isArray(parsed.providers)) return parsed;
      if (Array.isArray(parsed)) return { providers: parsed };
    }
  } catch {}

  return { providers: [] };
}

async function saveProviderConfig(data: { providers: ProviderConfig[] }) {
  await sql(
    "INSERT INTO system_settings (key, value) VALUES ('aiProviders', ?) ON CONFLICT(key) DO UPDATE SET value=?, updated_at=CURRENT_TIMESTAMP",
    JSON.stringify(data), JSON.stringify(data),
  );
}

// GET /api/ai-settings — جلب إعدادات جميع المزوّدين
router.get('/', authMiddleware, requireRole(ADMIN), async (_req: Request, res: Response) => {
  try {
    const config = await getProviderConfig();
    res.json(config);
  } catch {
    res.status(500).json({ error: 'Failed to fetch AI settings' });
  }
});

// PUT /api/ai-settings — حفظ إعدادات المزوّدين
router.put('/', authMiddleware, requireRole(ADMIN), async (req: Request, res: Response) => {
  try {
    const { providers } = req.body;
    if (!Array.isArray(providers)) return res.status(400).json({ error: 'providers must be an array' });
    await saveProviderConfig({ providers });
    res.json({ message: 'تم حفظ إعدادات الذكاء الاصطناعي' });
  } catch {
    res.status(500).json({ error: 'Failed to save AI settings' });
  }
});

// POST /api/ai-settings/test — اختبار اتصال بمزوّد معيّن
router.post('/test', authMiddleware, requireRole(ADMIN), async (req: Request, res: Response) => {
  try {
    const { type, apiKey, apiUrl, model } = req.body;
    if (!type || !apiKey) return res.status(400).json({ error: 'type and apiKey required' });

    const adapter = getAdapter(type as ProviderType);
    const config: ProviderConfig = {
      id: 'test', name: 'Test', type: type as ProviderType,
      enabled: true, priority: 1, apiKey, apiUrl: apiUrl || adapter.defaultApiUrl,
      models: [], selectedModel: model || adapter.defaultModels[0],
    };

    const body = adapter.buildRequest(config, 'رد بكلمة واحدة: ok', [], []);
    const headers = adapter.buildHeaders(config);
    const url = adapter.buildUrl(config);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);

    const res2 = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!res2.ok) {
      const errText = await res2.text().catch(() => '');
      return res.json({ success: false, error: `HTTP ${res2.status}: ${errText.substring(0, 200)}` });
    }

    const data = await res2.json();
    const parsed = adapter.parseResponse(data);
    res.json({ success: true, response: parsed.content || 'اتصال ناجح' });
  } catch (err: any) {
    res.json({ success: false, error: err?.message || 'فشل الاتصال' });
  }
});

// POST /api/ai-settings/fetch-models — جلب الموديلات المتاحة
router.post('/fetch-models', authMiddleware, requireRole(ADMIN), async (req: Request, res: Response) => {
  try {
    const { type, apiKey, apiUrl } = req.body;
    if (!type) return res.status(400).json({ error: 'type required' });

    const adapter = getAdapter(type as ProviderType);
    const config: ProviderConfig = {
      id: 'fetch', name: 'Fetch', type: type as ProviderType,
      enabled: true, priority: 1, apiKey: apiKey || '', apiUrl: apiUrl || adapter.defaultApiUrl,
      models: [], selectedModel: '',
    };

    const models = await adapter.fetchModels(config);
    res.json({ models });
  } catch (err: any) {
    res.json({ error: err?.message || 'فشل جلب الموديلات' });
  }
});

// GET /api/ai-settings/types — قائمة أنواع المزوّدين المدعومين
router.get('/types', authMiddleware, async (_req: Request, res: Response) => {
  res.json(getProviderTypes());
});

export default router;
