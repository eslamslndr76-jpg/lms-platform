'use client';

import { useState, useEffect, useRef } from 'react';
import { api } from '../../lib/api';
import Modal from '../../components/Modal';
import ErrorBoundary from '../../components/ErrorBoundary';
import { compressAndEncode } from '../../lib/imageUtils';

export default function SettingsPage() {
  const [tab, setTab] = useState<'branding' | 'categories' | 'ai' | 'autogroup' | 'whatsapp'>('branding');
  const [branding, setBranding] = useState({
    systemName: '', sloganAr: '', sloganEn: '', primaryColor: '#2563eb',
    secondaryColor: '#059669', logoHeader: '', logoFooter: '', favicon: '', messageFooter: '',
  });
  const [categories, setCategories] = useState<any[]>([]);
  const [providers, setProviders] = useState<any[]>([]);
  const [isDirty, setIsDirty] = useState(false);
  const [catModal, setCatModal] = useState(false);
  const [catForm, setCatForm] = useState({ name_ar: '', name_en: '' });
  const [editCatModal, setEditCatModal] = useState(false);
  const [editCatId, setEditCatId] = useState<number | null>(null);
  const [editCatForm, setEditCatForm] = useState({ name_ar: '', name_en: '' });
  const [threshold, setThreshold] = useState(30);
  const [thresholdSaving, setThresholdSaving] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savingAi, setSavingAi] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [addModal, setAddModal] = useState(false);
  const [addFetching, setAddFetching] = useState(false);
  const [addForm, setAddForm] = useState({
    type: 'gemini', name: 'Google Gemini',
    apiKey: '', apiUrl: 'https://generativelanguage.googleapis.com/v1beta',
    models: ['gemini-2.5-flash', 'gemini-flash-latest', 'gemini-2.0-flash'], selectedModel: 'gemini-2.5-flash',
    curlInput: '',
  });

  const [waStatus, setWaStatus] = useState<{ connected: boolean; ready: boolean; phone: string | null; uptime: number; messagesSent: number; messagesFailed: number } | null>(null);
  const [waQR, setWaQR] = useState<string | null>(null);
  const [waQRAvailable, setWaQRAvailable] = useState(false);
  const [waQRAge, setWaQRAge] = useState<number>(0);
  const [waLoading, setWaLoading] = useState(false);
  const [waAction, setWaAction] = useState('');

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError('');
      try {
        const [b, c] = await Promise.all([
          api('/api/settings/branding'),
          api('/api/categories'),
        ]);
        if (b && typeof b === 'object') setBranding(prev => ({ ...prev, ...b }));
        if (c && Array.isArray(c)) setCategories(c);
      } catch {
        setError('فشل تحميل الإعدادات الأساسية');
      }
      try {
        const aiCfg = await api('/api/ai-settings');
        if (aiCfg && Array.isArray(aiCfg.providers)) setProviders(aiCfg.providers);
      } catch {
        // ai-settings may be 403 for employees — ignore silently
      }
      try {
        const ag = await api('/api/settings/auto-group');
        if (ag && ag.threshold) setThreshold(ag.threshold);
      } catch {
        // ignore
      }
      setLoading(false);
    })();
  }, []);

  const fetchWAStatus = async () => {
    try {
      const status = await api('/api/whatsapp/status');
      setWaStatus(status);
    } catch {
      setWaStatus(null);
    }
  };

  const fetchWAQR = async () => {
    try {
      const data = await api('/api/whatsapp/bot/qr');
      setWaQRAvailable(data.available);
      setWaQR(data.qr || null);
      setWaQRAge(data.age || 0);
    } catch {
      setWaQRAvailable(false);
      setWaQR(null);
      setWaQRAge(0);
    }
  };

  const loadWhatsApp = async () => {
    setWaLoading(true);
    await Promise.all([fetchWAStatus(), fetchWAQR()]);
    setWaLoading(false);
  };

  useEffect(() => {
    if (tab !== 'whatsapp') return;
    const interval = setInterval(async () => {
      if (waStatus?.connected) return;
      await fetchWAStatus();
      await fetchWAQR();
    }, 8000);
    return () => clearInterval(interval);
  }, [tab, waStatus?.connected]);

  const handleWALogout = async () => {
    if (!confirm('هل أنت متأكد من فصل الاتصال؟ سيظهر QR جديد لإعادة الاتصال.')) return;
    setWaAction('جاري فصل الاتصال...');
    try {
      await api('/api/whatsapp/bot/logout', { method: 'POST', body: JSON.stringify({}) });
      setWaAction('تم الفصل. جاري إعادة الاتصال...');
      setTimeout(async () => {
        await loadWhatsApp();
        setWaAction('');
      }, 5000);
    } catch {
      setWaAction('فشل فصل الاتصال');
      setTimeout(() => setWaAction(''), 3000);
    }
  };

  const retry = () => {
    setError('');
    setTab(tab);
    window.location.reload();
  };

  const saveBranding = async () => {
    setSaving(true);
    try {
      await api('/api/settings/branding', { method: 'PUT', body: JSON.stringify(branding) });
      setMsg('تم حفظ الإعدادات');
    } catch {
      setMsg('فشل حفظ الإعدادات');
    }
    setSaving(false);
    setTimeout(() => setMsg(''), 3000);
  };

  const saveCategory = async () => {
    try {
      await api('/api/categories', {
        method: 'POST', body: JSON.stringify(catForm),
      });
      setCatModal(false);
      setCatForm({ name_ar: '', name_en: '' });
      api('/api/categories').then(setCategories);
      setMsg('تم حفظ التصنيف');
    } catch {
      setMsg('فشل حفظ التصنيف');
    }
    setTimeout(() => setMsg(''), 3000);
  };

  const startEditCategory = (c: any) => {
    setEditCatId(c.id);
    setEditCatForm({ name_ar: c.name_ar, name_en: c.name_en });
    setEditCatModal(true);
  };

  const saveEditCategory = async () => {
    try {
      await api(`/api/categories/${editCatId}`, {
        method: 'PUT', body: JSON.stringify(editCatForm),
      });
      setEditCatModal(false);
      setEditCatId(null);
      api('/api/categories').then(setCategories);
      setMsg('تم تحديث التصنيف');
    } catch {
      setMsg('فشل تحديث التصنيف');
    }
    setTimeout(() => setMsg(''), 3000);
  };

  const deleteCategory = async (id: number) => {
    if (!confirm('تأكيد الحذف؟')) return;
    try {
      await api(`/api/categories/${id}`, { method: 'DELETE' });
      api('/api/categories').then(setCategories);
      setMsg('تم الحذف');
    } catch {
      setMsg('فشل الحذف');
    }
    setTimeout(() => setMsg(''), 3000);
  };

  const saveThreshold = async () => {
    setThresholdSaving(true);
    try {
      await api('/api/settings/auto-group', { method: 'PUT', body: JSON.stringify({ threshold }) });
      setMsg('تم حفظ الحد الأدنى');
    } catch {
      setMsg('فشل حفظ الحد الأدنى');
    }
    setThresholdSaving(false);
    setTimeout(() => setMsg(''), 3000);
  };

  const PROVIDER_DEFAULTS: Record<string, { name: string; apiUrl: string; models: string[]; placeholder: string }> = {
    gemini: { name: 'Google Gemini', apiUrl: 'https://generativelanguage.googleapis.com/v1beta', models: ['gemini-2.5-flash', 'gemini-flash-latest', 'gemini-2.0-flash'], placeholder: 'AIzaSy...' },
    openai: { name: 'OpenAI', apiUrl: 'https://api.openai.com/v1', models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo'], placeholder: 'sk-...' },
    anthropic: { name: 'Anthropic Claude', apiUrl: 'https://api.anthropic.com/v1', models: ['claude-3-5-sonnet-20241022', 'claude-3-opus-20240229'], placeholder: 'sk-ant-...' },
    'openai-compat': { name: 'OpenAI-Compatible', apiUrl: 'http://localhost:11434/v1', models: ['llama3', 'mistral', 'phi3'], placeholder: '...' },
  };

  function detectTypeFrom(url: string, key: string): string {
    const u = (url || '').toLowerCase(); const k = (key || '').toLowerCase();
    if (u.includes('generativelanguage') || k.startsWith('aizasy') || k.startsWith('aq.')) return 'gemini';
    if (u.includes('api.openai') || k.startsWith('sk-') || k.startsWith('sk-proj-')) return 'openai';
    if (u.includes('api.anthropic') || k.startsWith('sk-ant-')) return 'anthropic';
    return 'openai-compat';
  }

  function parseCurl(text: string): { apiKey: string; apiUrl: string; model: string } {
    let apiKey = '', apiUrl = '', model = '';
    const h = text.match(/X-goog-api-key:\s*(\S+)/i);
    if (h) apiKey = h[1];
    const a = text.match(/Authorization:\s*Bearer\s+(\S+)/i);
    if (a && !apiKey) apiKey = a[1];
    const q = text.match(/[?&]key=([^&\s"'$`\\]+)/);
    if (q && !apiKey) apiKey = q[1];
    const url = text.match(/curl\s+["']([^"']+)["']/i);
    if (url) {
      const u = url[1];
      apiUrl = u.replace(/\/models\/[^/]+:\w+.*$/, '');
      const m = u.match(/\/models\/([^/:?]+(?::\w+)?)/i);
      if (m) model = m[1];
    }
    return { apiKey, apiUrl, model };
  }

  const saveAll = async () => {
    setSavingAi(true);
    try {
      await api('/api/ai-settings', { method: 'PUT', body: JSON.stringify({ providers }) });
      setIsDirty(false);
      setMsg('✅ تم حفظ إعدادات الذكاء الاصطناعي');
    } catch { setMsg('❌ فشل حفظ الإعدادات'); }
    setSavingAi(false);
    setTimeout(() => setMsg(''), 3000);
  };

  const updateDraft = (id: string, field: string, value: any) => {
    setProviders(prev => prev.map(p => p.id === id ? { ...p, [field]: value } : p));
    setIsDirty(true);
  };

  const toggleDraft = (id: string) => {
    setProviders(prev => prev.map(p => p.id === id ? { ...p, enabled: !p.enabled } : p));
    setIsDirty(true);
  };

  const moveDraft = (idx: number, dir: -1 | 1) => {
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= providers.length) return;
    const arr = [...providers];
    [arr[idx], arr[newIdx]] = [arr[newIdx], arr[idx]];
    arr.forEach((p, i) => (p.priority = i + 1));
    setProviders(arr);
    setIsDirty(true);
  };

  const removeDraft = (id: string) => {
    if (!confirm('هل أنت متأكد من إزالة هذا المزوّد؟')) return;
    setProviders(prev => prev.filter(p => p.id !== id));
    setIsDirty(true);
  };

  const testProvider = async (p: any) => {
    try {
      const res = await api('/api/ai-settings/test', {
        method: 'POST', body: JSON.stringify({ type: p.type, apiKey: p.apiKey, apiUrl: p.apiUrl, model: p.selectedModel }),
      });
      setMsg(res.success ? `✅ ${res.response}` : `❌ ${res.error}`);
    } catch { setMsg('❌ فشل اختبار الاتصال'); }
    setTimeout(() => setMsg(''), 4000);
  };

  const fetchModelsFor = async (p: any) => {
    try {
      const res = await api('/api/ai-settings/fetch-models', {
        method: 'POST', body: JSON.stringify({ type: p.type, apiKey: p.apiKey, apiUrl: p.apiUrl }),
      });
      if (Array.isArray(res.models) && res.models.length > 0) {
        updateDraft(p.id, 'models', res.models);
        if (!res.models.includes(p.selectedModel)) updateDraft(p.id, 'selectedModel', res.models[0]);
        setMsg(`✅ تم جلب ${res.models.length} موديل`);
      } else {
        setMsg('⚠ لم يتم العثور على موديلات');
      }
    } catch { setMsg('❌ فشل جلب الموديلات'); }
    setTimeout(() => setMsg(''), 4000);
  };

  const openAddModal = () => {
    setAddForm({
      type: 'gemini', name: 'Google Gemini',
      apiKey: '', apiUrl: 'https://generativelanguage.googleapis.com/v1beta',
      models: ['gemini-2.5-flash', 'gemini-flash-latest', 'gemini-2.0-flash'], selectedModel: 'gemini-2.5-flash',
      curlInput: '',
    });
    setAddModal(true);
  };

  const updateAddForm = (field: string, value: any) => {
    setAddForm(prev => ({ ...prev, [field]: value }));
    if (field === 'type') {
      const def = PROVIDER_DEFAULTS[value as keyof typeof PROVIDER_DEFAULTS] || PROVIDER_DEFAULTS['openai-compat'];
      setAddForm(prev => ({ ...prev, type: value, name: def.name, apiUrl: def.apiUrl, models: def.models, selectedModel: def.models[0] }));
    }
  };

  const applyCurlToForm = () => {
    const parsed = parseCurl(addForm.curlInput);
    if (!parsed.apiKey) { setMsg('⚠ لم يتم العثور على مفتاح API في الأمر'); setTimeout(() => setMsg(''), 3000); return; }
    const detectedType = detectTypeFrom(parsed.apiUrl, parsed.apiKey);
    const def = PROVIDER_DEFAULTS[detectedType as keyof typeof PROVIDER_DEFAULTS] || PROVIDER_DEFAULTS['openai-compat'];
    setAddForm({
      type: detectedType, name: def.name,
      apiKey: parsed.apiKey,
      apiUrl: parsed.apiUrl || def.apiUrl,
      models: def.models, selectedModel: parsed.model || def.models[0],
      curlInput: addForm.curlInput,
    });
    autoFetchAddForm(detectedType, parsed.apiKey, parsed.apiUrl || def.apiUrl);
  };

  const autoFetchAddForm = async (type: string, apiKey: string, apiUrl: string) => {
    if (!apiKey) return;
    setAddFetching(true);
    try {
      const res = await api('/api/ai-settings/fetch-models', {
        method: 'POST', body: JSON.stringify({ type, apiKey, apiUrl }),
      });
      if (Array.isArray(res.models) && res.models.length > 0) {
        setAddForm(prev => ({ ...prev, models: res.models, selectedModel: res.models[0] }));
      }
    } catch { /* ignore */ }
    setAddFetching(false);
  };

  const confirmAddProvider = () => {
    if (!addForm.apiKey) { setMsg('⚠ API Key مطلوب'); setTimeout(() => setMsg(''), 3000); return; }
    const newProvider = {
      id: `p_${Date.now()}`,
      name: addForm.name,
      type: addForm.type,
      enabled: false,
      priority: providers.length + 1,
      apiKey: addForm.apiKey,
      apiUrl: addForm.apiUrl,
      models: addForm.models,
      selectedModel: addForm.selectedModel,
    };
    setProviders(prev => [...prev, newProvider]);
    setIsDirty(true);
    setAddModal(false);
  };

  const resetAll = () => {
    if (!isDirty) return;
    (async () => {
      try {
        const aiCfg = await api('/api/ai-settings');
        if (aiCfg && Array.isArray(aiCfg.providers)) setProviders(aiCfg.providers);
        setIsDirty(false);
      } catch { /* ignore */ }
    })();
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin h-8 w-8 border-4 rounded-full" style={{ borderColor: 'var(--primary)', borderTopColor: 'transparent' }} /></div>;
  if (error) return <div className="flex flex-col items-center justify-center h-64 gap-4"><p style={{ color: '#dc2626' }}>{error}</p><button onClick={retry} className="px-4 py-2 bg-[var(--primary)] text-white rounded-xl text-sm">إعادة المحاولة</button></div>;

  return <ErrorBoundary>
    <div className="space-y-6">
      <h1 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>الإعدادات</h1>

      {msg && <div className="px-4 py-3 rounded-xl text-sm animate-slide-up bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400">{msg}</div>}

      <div className="flex gap-2 overflow-x-auto">
        {(['branding', 'categories', 'ai', 'autogroup', 'whatsapp'] as const).map(t => (
          <button key={t} onClick={() => { setTab(t); if (t === 'whatsapp') loadWhatsApp(); }}
            className={`px-5 py-2.5 rounded-xl text-sm whitespace-nowrap ${tab === t ? 'bg-[var(--primary)] text-white' : 'border'}`}
            style={tab === t ? {} : { backgroundColor: 'var(--card)', color: 'var(--text-muted)', borderColor: 'var(--border)' }}>
            {t === 'branding' ? 'العلامة التجارية' : t === 'categories' ? 'التصنيفات' : t === 'ai' ? 'الذكاء الاصطناعي' : t === 'autogroup' ? 'التجميع التلقائي' : 'الواتساب'}
          </button>
        ))}
      </div>

      {/* Branding */}
      {tab === 'branding' && (
        <div className="rounded-2xl p-6 shadow-sm space-y-4" style={{ backgroundColor: 'var(--card)' }}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm mb-1" style={{ color: 'var(--text-muted)' }}>اسم النظام</label>
              <input value={branding.systemName}
                onChange={e => setBranding({ ...branding, systemName: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl border text-sm" style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }} />
            </div>
            <div>
              <label className="block text-sm mb-1" style={{ color: 'var(--text-muted)' }}>شعار (عربي)</label>
              <input value={branding.sloganAr}
                onChange={e => setBranding({ ...branding, sloganAr: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl border text-sm" style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }} />
            </div>
            <div>
              <label className="block text-sm mb-1" style={{ color: 'var(--text-muted)' }}>Slogan (EN)</label>
              <input value={branding.sloganEn}
                onChange={e => setBranding({ ...branding, sloganEn: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl border text-sm" style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }} />
            </div>
            <div>
              <label className="block text-sm mb-1" style={{ color: 'var(--text-muted)' }}>اللون الأساسي</label>
              <input type="color" value={branding.primaryColor}
                onChange={e => setBranding({ ...branding, primaryColor: e.target.value })}
                className="w-full h-10 rounded-xl border cursor-pointer" style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)' }} />
            </div>
            <div>
              <label className="block text-sm mb-1" style={{ color: 'var(--text-muted)' }}>اللون الثانوي</label>
              <input type="color" value={branding.secondaryColor}
                onChange={e => setBranding({ ...branding, secondaryColor: e.target.value })}
                className="w-full h-10 rounded-xl border cursor-pointer" style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)' }} />
            </div>
            <ImageUploadField label="شعار Header" value={branding.logoHeader}
              onChange={v => setBranding(prev => ({ ...prev, logoHeader: v }))} />
            <ImageUploadField label="شعار Footer" value={branding.logoFooter}
              onChange={v => setBranding(prev => ({ ...prev, logoFooter: v }))} />
            <ImageUploadField label="Favicon" value={branding.favicon}
              onChange={v => setBranding(prev => ({ ...prev, favicon: v }))} />
          </div>
          <div>
            <label className="block text-sm mb-1" style={{ color: 'var(--text-muted)' }}>نص التذييل التلقائي (للرسائل)</label>
            <textarea value={branding.messageFooter}
              onChange={e => setBranding({ ...branding, messageFooter: e.target.value })}
              className="w-full px-4 py-2.5 rounded-xl border text-sm h-20" style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }} />
          </div>
          <button onClick={saveBranding} disabled={saving}
            className="px-6 py-2.5 bg-[var(--primary)] text-white rounded-xl text-sm font-medium disabled:opacity-50">
            {saving ? 'جاري الحفظ...' : 'حفظ الإعدادات'}
          </button>

          <div className="mt-6 p-4 border rounded-2xl">
            <h3 className="font-bold text-sm mb-3">معاينة حية</h3>
            <div className="space-y-2">
              <div className="flex items-center gap-3 p-3 rounded-xl" style={{ backgroundColor: branding.primaryColor }}>
                {branding.logoHeader && <img src={branding.logoHeader} className="h-8 w-8 rounded-lg object-cover" alt="" />}
                <span className="text-white font-bold">{branding.systemName || 'اسم النظام'}</span>
              </div>
              <p className="text-sm" style={{ color: branding.secondaryColor }}>{branding.sloganAr}</p>
            </div>
          </div>
        </div>
      )}

      {/* Categories */}
      {tab === 'categories' && (
        <div className="rounded-2xl p-6 shadow-sm space-y-4" style={{ backgroundColor: 'var(--card)' }}>
          <div className="flex items-center justify-between">
            <h2 className="font-bold" style={{ color: 'var(--text)' }}>التصنيفات</h2>
            <button onClick={() => setCatModal(true)}
              className="px-4 py-2 bg-[var(--primary)] text-white rounded-xl text-sm">+ إضافة</button>
          </div>
          <div className="space-y-2">
            {categories.length === 0 && <p className="text-sm" style={{ color: 'var(--text-muted)' }}>لا توجد تصنيفات</p>}
            {categories.map((c: any) => (
              <div key={c.id} className="flex items-center justify-between p-3 rounded-xl" style={{ backgroundColor: 'var(--bg)' }}>
                <div>
                  <span className="font-medium" style={{ color: 'var(--text)' }}>{c.name_ar}</span>
                  <span className="text-sm mr-2" style={{ color: 'var(--text-muted)' }}>{c.name_en}</span>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => startEditCategory(c)}
                    className="text-xs px-2 py-1 rounded-lg bg-blue-50 text-blue-600">تعديل</button>
                  <button onClick={() => deleteCategory(c.id)}
                    className="text-red-500 text-xs">حذف</button>
                </div>
              </div>
            ))}
          </div>

          <Modal open={catModal} onClose={() => setCatModal(false)} title="إضافة تصنيف">
            <div className="space-y-3">
              <input placeholder="الاسم (عربي)" value={catForm.name_ar}
                onChange={e => setCatForm({ ...catForm, name_ar: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl border text-sm" style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }} />
              <input placeholder="English name" value={catForm.name_en}
                onChange={e => setCatForm({ ...catForm, name_en: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl border text-sm" style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }} />
              <button onClick={saveCategory}
                className="w-full py-3 bg-[var(--primary)] text-white rounded-xl font-medium">حفظ</button>
            </div>
          </Modal>

          <Modal open={editCatModal} onClose={() => setEditCatModal(false)} title="تعديل تصنيف">
            <div className="space-y-3">
              <input placeholder="الاسم (عربي)" value={editCatForm.name_ar}
                onChange={e => setEditCatForm({ ...editCatForm, name_ar: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl border text-sm" style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }} />
              <input placeholder="English name" value={editCatForm.name_en}
                onChange={e => setEditCatForm({ ...editCatForm, name_en: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl border text-sm" style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }} />
              <button onClick={saveEditCategory}
                className="w-full py-3 bg-[var(--primary)] text-white rounded-xl font-medium">حفظ التعديلات</button>
            </div>
          </Modal>
        </div>
      )}

      {/* Auto-Group Threshold */}
      {tab === 'autogroup' && (
        <div className="rounded-2xl p-6 shadow-sm space-y-4" style={{ backgroundColor: 'var(--card)' }}>
          <h2 className="font-bold" style={{ color: 'var(--text)' }}>التجميع التلقائي</h2>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>عند تأكيد دفع الطالب، يتم وضعه تلقائياً في مجموعة. هنا يمكنك تحديد الحد الأدنى لعدد الطلاب لكل مجموعة قبل إنشاء مجموعة جديدة.</p>
          <div>
            <label className="block text-sm mb-1" style={{ color: 'var(--text-muted)' }}>الحد الأقصى للطلاب في كل مجموعة</label>
            <input type="number" min="1" value={threshold}
              onChange={e => setThreshold(Number(e.target.value))}
              className="w-full px-4 py-2.5 rounded-xl border text-sm" style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }} />
          </div>
          <button onClick={saveThreshold} disabled={thresholdSaving}
            className="px-6 py-2.5 bg-[var(--primary)] text-white rounded-xl text-sm font-medium disabled:opacity-50">
            {thresholdSaving ? 'جاري الحفظ...' : 'حفظ الإعدادات'}
          </button>
        </div>
      )}

      {/* WhatsApp Bot */}
      {tab === 'whatsapp' && (
        <div className="rounded-2xl p-6 shadow-sm space-y-4" style={{ backgroundColor: 'var(--card)' }}>
          <h2 className="font-bold" style={{ color: 'var(--text)' }}>إدارة الـ WhatsApp Bot</h2>

          {/* Status Card */}
          <div className="rounded-xl p-4" style={{ backgroundColor: 'var(--bg)' }}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-sm" style={{ color: 'var(--text)' }}>حالة الاتصال</h3>
              <button onClick={loadWhatsApp} disabled={waLoading}
                className="px-3 py-1.5 rounded-lg text-xs border"
                style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
                {waLoading ? 'جاري...' : '🔄 تحديث'}
              </button>
            </div>

            {waStatus ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${waStatus.connected ? 'bg-green-500' : 'bg-red-500'}`} />
                  <span className="text-sm font-medium" style={{ color: 'var(--text)' }}>
                    {waStatus.connected ? 'متصل' : 'غير متصل'}
                  </span>
                  {waStatus.ready && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700">جاهز</span>
                  )}
                </div>
                {waStatus.phone && (
                  <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                    📱 رقم الاتصال: <span className="font-mono font-bold" style={{ color: 'var(--text)' }}>{waStatus.phone}</span>
                  </p>
                )}
                <div className="flex gap-4 text-xs" style={{ color: 'var(--text-muted)' }}>
                  <span>⏱ التشغيل: {Math.floor(waStatus.uptime / 3600)}h {Math.floor((waStatus.uptime % 3600) / 60)}m</span>
                  <span>📤 مرسل: {waStatus.messagesSent}</span>
                  <span>❌ فاشل: {waStatus.messagesFailed}</span>
                </div>
              </div>
            ) : (
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>جاري التحقق من الحالة...</p>
            )}
          </div>

          {/* QR Code Section */}
          <div className="rounded-xl p-4" style={{ backgroundColor: 'var(--bg)' }}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-sm" style={{ color: 'var(--text)' }}>كود الاتصال (QR)</h3>
              <button onClick={fetchWAQR} disabled={waLoading}
                className="px-3 py-1.5 rounded-lg text-xs border"
                style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
                🔄 تحديث QR
              </button>
            </div>

            {waQRAvailable && waQR ? (
              <div className="flex flex-col items-center gap-3">
                <p className="text-xs text-center" style={{ color: 'var(--text-muted)' }}>
                  افتح واتساب → الأجهزة المرتبطة → ربط برقم الهاتف → امسح الكود
                </p>
                <div className="p-3 bg-white rounded-xl" style={{ border: '4px solid #25D366' }}>
                  <img src={waQR} alt="WhatsApp QR" className="w-64 h-64" />
                </div>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>🔄 يتحدث تلقائياً كل 8 ثوانٍ{waQRAge > 0 ? ` • عمر الكود: ${waQRAge}ث` : ''}</p>
              </div>
            ) : (
              <div className="text-center py-6">
                {waStatus?.connected ? (
                  <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                    ✅ البوت متصل — لا حاجة لـ QR<br />
                    <span className="text-xs">لفصل الاتصال والاتصال برقم جديد، اضغط "فصل الاتصال"</span>
                  </p>
                ) : (
                  <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                    لا يوجد QR متاح<br />
                    <span className="text-xs">جاري محاولة إنشاء كود جديد...</span>
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex gap-3">
            {waStatus?.connected && (
              <button onClick={handleWALogout}
                className="px-4 py-2.5 rounded-xl text-sm font-medium text-white bg-red-500 hover:bg-red-600 transition-colors">
                ⏏ فصل الاتصال
              </button>
            )}
          </div>

          {waAction && (
            <div className="px-4 py-3 rounded-xl text-sm animate-slide-up" style={{ backgroundColor: '#dbeafe', color: '#1e40af' }}>
              {waAction}
            </div>
          )}

          <div className="p-3 rounded-xl text-xs" style={{ backgroundColor: 'var(--bg)', color: 'var(--text-muted)' }}>
            <p><strong>ملاحظات:</strong></p>
            <ul className="mt-1 space-y-1 list-disc list-inside">
              <li>الـ QR يظهر فقط عند عدم وجود اتصال أو بعد فصل الاتصال</li>
              <li>لحماية الاتصال، لا تشارك صورة الـ QR مع أي شخص</li>
              <li>يمكن تجديد الاتصال بالضغط على "فصل الاتصال" ثم مسح الـ QR الجديد</li>
            </ul>
          </div>
        </div>
      )}

      {/* AI Providers */}
      {tab === 'ai' && (
        <div className="space-y-4">
          <div className="rounded-2xl p-6 shadow-sm" style={{ backgroundColor: 'var(--card)' }}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="font-bold" style={{ color: 'var(--text)' }}>مزوّدات الذكاء الاصطناعي</h2>
                <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
                  أضف مزوّداً واملأ البيانات. التغيير محلي (Draft) — اضغط "💾 حفظ" لإرسال التعديلات.
                </p>
              </div>
              <div className="flex gap-2">
                <button onClick={resetAll} disabled={!isDirty}
                  className="px-3 py-2 rounded-xl text-sm border disabled:opacity-30"
                  style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
                  ↩ تراجع
                </button>
                <button onClick={saveAll} disabled={!isDirty || savingAi}
                  className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap ${isDirty ? 'bg-[var(--primary)] text-white' : 'border opacity-40'}`}>
                  {savingAi ? 'جاري...' : '💾 حفظ'}
                </button>
                <button onClick={openAddModal}
                  className="px-4 py-2 bg-[var(--primary)] text-white rounded-xl text-sm whitespace-nowrap">+ إضافة مزوّد</button>
              </div>
            </div>

            {isDirty && (
              <div className="px-3 py-2 mb-3 rounded-xl text-xs" style={{ backgroundColor: '#fef3c7', color: '#92400e' }}>
                ⚠ توجد تغييرات غير محفوظة. اضغط "💾 حفظ" لتطبيقها.
              </div>
            )}

            {providers.length === 0 && (
              <p className="text-sm py-6 text-center" style={{ color: 'var(--text-muted)' }}>لا توجد مزوّدات — اضغط "+ إضافة مزوّد"</p>
            )}

            <div className="space-y-3">
              {providers.map((p, i) => (
                <div key={p.id} className="rounded-xl p-4 transition-colors"
                  style={{
                    backgroundColor: 'var(--bg)',
                    border: p.enabled ? '1px solid var(--primary)' : '1px solid var(--border)',
                    opacity: p.enabled ? 1 : 0.6,
                  }}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <button onClick={() => toggleDraft(p.id)}
                        className={`w-10 h-6 rounded-full relative transition-colors ${p.enabled ? 'bg-[var(--primary)]' : 'bg-gray-300'}`}>
                        <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${p.enabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
                      </button>
                      <div>
                        <span className="font-bold text-sm" style={{ color: 'var(--text)' }}>
                          {p.type === 'gemini' ? '🧠' : p.type === 'openai' ? '🔵' : p.type === 'anthropic' ? '🟢' : '⚙'} {p.name}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => moveDraft(i, -1)} disabled={i === 0}
                        className="w-6 h-6 flex items-center justify-center rounded text-xs disabled:opacity-30 hover:opacity-70">↑</button>
                      <button onClick={() => moveDraft(i, 1)} disabled={i === providers.length - 1}
                        className="w-6 h-6 flex items-center justify-center rounded text-xs disabled:opacity-30 hover:opacity-70">↓</button>
                      <button onClick={() => removeDraft(p.id)}
                        className="w-6 h-6 flex items-center justify-center rounded text-xs hover:opacity-70" style={{ color: '#dc2626' }}>🗑</button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>API Key</label>
                      <input type="password" value={p.apiKey}
                        onChange={e => updateDraft(p.id, 'apiKey', e.target.value)}
                        placeholder={PROVIDER_DEFAULTS[p.type as keyof typeof PROVIDER_DEFAULTS]?.placeholder || '...'}
                        className="w-full px-3 py-2 rounded-lg border text-sm font-mono ltr"
                        style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)', color: 'var(--text)' }}
                        onFocus={e => e.target.type = 'text'}
                        onBlur={e => { e.target.type = 'password'; if (e.target.value) fetchModelsFor({ ...providers.find(x => x.id === p.id), apiKey: e.target.value }); }} />
                    </div>
                    <div>
                      <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>API URL</label>
                      <div className="flex gap-1">
                        <input value={p.apiUrl}
                          onChange={e => {
                            updateDraft(p.id, 'apiUrl', e.target.value);
                            const t = detectTypeFrom(e.target.value, p.apiKey);
                            if (t !== p.type) {
                              const def = PROVIDER_DEFAULTS[t as keyof typeof PROVIDER_DEFAULTS] || PROVIDER_DEFAULTS['openai-compat'];
                              updateDraft(p.id, 'type', t);
                              updateDraft(p.id, 'name', def.name);
                            }
                          }}
                          className="flex-1 px-3 py-2 rounded-lg border text-sm font-mono ltr"
                          style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)', color: 'var(--text)' }} />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>الموديل</label>
                      <div className="flex gap-1">
                        <select value={p.selectedModel}
                          onChange={e => updateDraft(p.id, 'selectedModel', e.target.value)}
                          className="flex-1 px-3 py-2 rounded-lg border text-sm"
                          style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)', color: 'var(--text)' }}>
                          {p.models?.map((m: string) => (
                            <option key={m} value={m}>{m}</option>
                          ))}
                          {(!p.models || p.models.length === 0) && (
                            <option value="">-- لا توجد موديلات --</option>
                          )}
                        </select>
                        <button onClick={() => fetchModelsFor(p)}
                          className="px-2 py-2 rounded-lg text-xs border"
                          style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>🔍</button>
                      </div>
                    </div>
                    <div className="flex items-end gap-2">
                      <button onClick={() => testProvider(p)}
                        className="flex-1 px-3 py-2 rounded-lg text-sm border transition-colors hover:opacity-80"
                        style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
                        🧪 اختبار الاتصال
                      </button>
                    </div>
                  </div>
                  {p.type === 'openai-compat' && (
                    <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>
                      💡 للمزوّدات المحلية (Ollama, LM Studio) أو Azure OpenAI
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Add Provider Modal */}
      <Modal open={addModal} onClose={() => setAddModal(false)} title="إضافة مزوّد جديد">
        <div className="space-y-3">
          <div>
            <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>📋 لصق أمر CURL (اختياري — يكشف النوع تلقائياً)</label>
            <textarea value={addForm.curlInput}
              onChange={e => setAddForm(prev => ({ ...prev, curlInput: e.target.value }))}
              placeholder="curl 'https://generativelanguage.googleapis.com/...' -H 'X-goog-api-key: AIzaSy...'"
              className="w-full h-20 px-3 py-2 rounded-xl border text-xs font-mono ltr leading-relaxed"
              style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }} />
            <button onClick={applyCurlToForm}
              className="w-full mt-1 py-1.5 rounded-lg text-xs border"
              style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
              🔄 تحليل CURL وتعبئة الحقول
            </button>
          </div>

          <div className="border-t" style={{ borderColor: 'var(--border)' }} />

          <div>
            <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>نوع المزوّد</label>
            <select value={addForm.type}
              onChange={e => updateAddForm('type', e.target.value)}
              className="w-full px-3 py-2 rounded-lg border text-sm"
              style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }}>
              {Object.entries(PROVIDER_DEFAULTS).map(([k, v]) => (
                <option key={k} value={k}>{v.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>API Key</label>
            <input type="password" value={addForm.apiKey}
              onChange={e => {
                setAddForm(prev => ({ ...prev, apiKey: e.target.value }));
                const t = detectTypeFrom(addForm.apiUrl, e.target.value);
                if (t !== addForm.type) updateAddForm('type', t);
              }}
              placeholder={PROVIDER_DEFAULTS[addForm.type as keyof typeof PROVIDER_DEFAULTS]?.placeholder || '...'}
              className="w-full px-3 py-2 rounded-lg border text-sm font-mono ltr"
              style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }}
              onFocus={e => e.target.type = 'text'}
              onBlur={e => { e.target.type = 'password'; if (e.target.value) autoFetchAddForm(addForm.type, e.target.value, addForm.apiUrl); }} />
          </div>

          <div>
            <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>API URL</label>
            <input value={addForm.apiUrl}
              onChange={e => setAddForm(prev => ({ ...prev, apiUrl: e.target.value }))}
              className="w-full px-3 py-2 rounded-lg border text-sm font-mono ltr"
              style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }} />
          </div>

          <div>
            <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>
              الموديل {addFetching && <span className="inline-block mr-1 text-[10px]">جاري الجلب...</span>}
            </label>
            <select value={addForm.selectedModel}
              onChange={e => setAddForm(prev => ({ ...prev, selectedModel: e.target.value }))}
              className="w-full px-3 py-2 rounded-lg border text-sm"
              style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }}>
              {addForm.models.map((m: string) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>

          <div className="flex gap-2 pt-2">
            <button onClick={confirmAddProvider}
              className="flex-1 py-2.5 bg-[var(--primary)] text-white rounded-xl text-sm font-medium">إضافة</button>
            <button onClick={() => setAddModal(false)}
              className="px-4 py-2.5 rounded-xl text-sm border"
              style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>إلغاء</button>
          </div>
        </div>
      </Modal>
    </div></ErrorBoundary>;
}

function ImageUploadField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const dataUrl = await compressAndEncode(file, 800, 0.7, 'image/png');
      onChange(dataUrl);
    } catch { alert('فشل تحميل الصورة'); }
    setUploading(false);
    if (fileRef.current) fileRef.current.value = '';
  };

  return (
    <div>
      <label className="block text-sm mb-1" style={{ color: 'var(--text-muted)' }}>{label}</label>
      <div className="flex items-center gap-3">
        <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} className="hidden" />
        {value ? (
          <div className="relative w-14 h-14 rounded-xl overflow-hidden border flex-shrink-0" style={{ borderColor: 'var(--border)' }}>
            <img src={value} alt={label} className="w-full h-full object-cover" />
          </div>
        ) : (
          <div className="w-14 h-14 rounded-xl border flex items-center justify-center text-xs flex-shrink-0" style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
            لا توجد
          </div>
        )}
        <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading}
          className="px-3 py-2 rounded-xl text-xs text-white disabled:opacity-50" style={{ backgroundColor: 'var(--primary)' }}>
          {uploading ? 'جاري...' : 'اختيار صورة'}
        </button>
        {value && (
          <button type="button" onClick={() => onChange('')}
            className="px-3 py-2 rounded-xl text-xs border" style={{ borderColor: 'var(--border)', color: '#dc2626' }}>
            حذف
          </button>
        )}
      </div>
    </div>
  );
}
