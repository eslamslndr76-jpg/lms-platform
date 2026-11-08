'use client';

import { useState, useEffect, useRef } from 'react';
import { api } from '../../lib/api';
import Modal from '../../components/Modal';
import ErrorBoundary from '../../components/ErrorBoundary';
import { compressAndEncode } from '../../lib/imageUtils';

export default function SettingsPage() {
  const [tab, setTab] = useState<'branding' | 'categories' | 'places' | 'ai' | 'autogroup' | 'notification' | 'certificates' | 'survey' | 'announcement' | 'reports'>('branding');
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

  // Notification Settings
  const [notifForm, setNotifForm] = useState({
    smtpUser: '', smtpPass: '', smtpFrom: '',
    telegramBotToken: '', telegramBotUsername: '',
  });
  const [notifSaving, setNotifSaving] = useState(false);
  const [notifTesting, setNotifTesting] = useState('');
  const [notifTestEmail, setNotifTestEmail] = useState('');

  // Certificate Settings
  const [certSettings, setCertSettings] = useState({
    autoIssue: true,
    requireAttendance: true,
    minAttendancePercent: 80,
    certificateTitle: 'شهادة إتمام',
    certificateTitleEn: 'Certificate of Completion',
    directorName: '',
    directorTitle: 'مدير وحدة التدريب و التطوير',
    footerText: 'هذه الشهادة صادرة من وحدة التدريب و التطوير بالتعاون مع المعهد العالي للعلوم الإدارية بالقطامية (HIMS)',
  });
  const [certSaving, setCertSaving] = useState(false);

  // Survey Settings (edit-plan.md §4.4)
  const [surveySettings, setSurveySettings] = useState({ openDays: 30, reminder1Days: 2, reminder2Days: 5 });
  const [surveySaving, setSurveySaving] = useState(false);
  const [surveyLoading, setSurveyLoading] = useState(false);

  // Announcement Settings (edit-plan.md §7)
  const [announcementSettings, setAnnouncementSettings] = useState({ autoEnabled: false });
  const [announcementSaving, setAnnouncementSaving] = useState(false);
  const [announcementLoading, setAnnouncementLoading] = useState(false);

  // Report Settings (edit-plan.md §8)
  const [reportSettings, setReportSettings] = useState({
    coordinatorName: '', organizerText: '', certificateText: '',
    defaultNotes: '', defaultRecommendations: '', defaultActivityType: '',
  });
  const [reportSaving, setReportSaving] = useState(false);
  const [reportLoading, setReportLoading] = useState(false);

  // Places (training rooms)
  const [places, setPlaces] = useState<any[]>([]);
  const [placesLoading, setPlacesLoading] = useState(false);
  const [placeModal, setPlaceModal] = useState(false);
  const [placeId, setPlaceId] = useState<number | null>(null);
  const [placeForm, setPlaceForm] = useState({ name: '', capacity: '' });
  const [placeSaving, setPlaceSaving] = useState(false);

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
        const p = await api('/api/places');
        if (Array.isArray(p)) setPlaces(p);
      } catch {
        // places may be unavailable for restricted roles — ignore silently
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

  // ─── Notification Settings Functions ────────────
  const loadNotification = async () => {
    try {
      const data = await api('/api/settings/notification');
      if (data && typeof data === 'object') {
        setNotifForm({
          smtpUser: data.smtpUser || '',
          smtpPass: '',
          smtpFrom: data.smtpFrom || '',
          telegramBotToken: '',
          telegramBotUsername: data.telegramBotUsername || '',
        });
      }
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    if (tab === 'notification') loadNotification();
  }, [tab]);

  const saveNotification = async () => {
    setNotifSaving(true);
    try {
      await api('/api/settings/notification', { method: 'PUT', body: JSON.stringify(notifForm) });
      setMsg('تم حفظ إعدادات الإشعارات');
    } catch {
      setMsg('فشل حفظ إعدادات الإشعارات');
    }
    setNotifSaving(false);
    setTimeout(() => setMsg(''), 3000);
  };

  const testEmail = async () => {
    const email = notifTestEmail || notifForm.smtpUser;
    if (!email) { setMsg('أدخل بريد إلكتروني للاختبار'); setTimeout(() => setMsg(''), 3000); return; }
    setNotifTesting('email');
    try {
      await api('/api/settings/notification/test-email', { method: 'POST', body: JSON.stringify({ testEmail: email }) });
      setMsg('تم إرسال إيميل الاختبار — تحقق من صندوق الوارد');
    } catch (err: any) {
      setMsg(err.message || 'فشل إرسال إيميل الاختبار');
    }
    setNotifTesting('');
    setTimeout(() => setMsg(''), 5000);
  };

  const testTelegram = async () => {
    setNotifTesting('telegram');
    try {
      const res = await api('/api/settings/notification/test-telegram', { method: 'POST' });
      setMsg(res.message || 'تم اختبار تيليجرام');
    } catch (err: any) {
      setMsg(err.message || 'فشل اختبار تيليجرام');
    }
    setNotifTesting('');
    setTimeout(() => setMsg(''), 5000);
  };

  // ─── Certificate Settings Functions ────────────
  const loadCertificateSettings = async () => {
    try {
      const data = await api('/api/settings/certificate');
      if (data && typeof data === 'object') {
        setCertSettings(prev => ({ ...prev, ...data }));
      }
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    if (tab === 'certificates') loadCertificateSettings();
  }, [tab]);

  const saveCertificateSettings = async () => {
    setCertSaving(true);
    try {
      await api('/api/settings/certificate', { method: 'PUT', body: JSON.stringify(certSettings) });
      setMsg('تم حفظ إعدادات الشهادة');
    } catch {
      setMsg('فشل حفظ إعدادات الشهادة');
    }
    setCertSaving(false);
    setTimeout(() => setMsg(''), 3000);
  };

  // ── Survey settings (edit-plan.md §4.4) ──────────────────────
  const loadSurveySettings = async () => {
    setSurveyLoading(true);
    try {
      const data = await api('/api/settings/survey');
      if (data && typeof data === 'object') {
        setSurveySettings(prev => ({ ...prev, ...data }));
      }
    } catch {
      // keep defaults
    } finally {
      setSurveyLoading(false);
    }
  };

  useEffect(() => {
    if (tab === 'survey') loadSurveySettings();
    if (tab === 'announcement') loadAnnouncementSettings();
    if (tab === 'reports') loadReportSettings();
  }, [tab]);

  const saveSurveySettings = async () => {
    if (surveySaving) return;
    setSurveySaving(true);
    try {
      const res: any = await api('/api/settings/survey', {
        method: 'PUT',
        body: JSON.stringify(surveySettings),
      });
      if (res?.settings) setSurveySettings(prev => ({ ...prev, ...res.settings }));
      setMsg('تم حفظ إعدادات الاستبيان');
    } catch (err: any) {
      setMsg(err?.message || 'فشل حفظ إعدادات الاستبيان');
    } finally {
      setSurveySaving(false);
      setTimeout(() => setMsg(''), 3000);
    }
  };

  // ── Announcement settings (edit-plan.md §7) ──────────────────
  const loadAnnouncementSettings = async () => {
    setAnnouncementLoading(true);
    try {
      const data = await api('/api/settings/announcement');
      if (data && typeof data === 'object') {
        setAnnouncementSettings(prev => ({ ...prev, ...data }));
      }
    } catch {
      // keep defaults
    } finally {
      setAnnouncementLoading(false);
    }
  };

  const saveAnnouncementSettings = async () => {
    if (announcementSaving) return;
    setAnnouncementSaving(true);
    try {
      const res: any = await api('/api/settings/announcement', {
        method: 'PUT',
        body: JSON.stringify(announcementSettings),
      });
      if (res?.settings) setAnnouncementSettings(prev => ({ ...prev, ...res.settings }));
      setMsg('تم حفظ إعدادات الإعلانات');
    } catch (err: any) {
      setMsg(err?.message || 'فشل حفظ إعدادات الإعلانات');
    } finally {
      setAnnouncementSaving(false);
      setTimeout(() => setMsg(''), 3000);
    }
  };

  // ── Report settings (edit-plan.md §8) ────────────────────────
  const loadReportSettings = async () => {
    setReportLoading(true);
    try {
      const data = await api('/api/settings/report');
      if (data && typeof data === 'object') {
        setReportSettings(prev => ({ ...prev, ...data }));
      }
    } catch {
      // keep defaults
    } finally {
      setReportLoading(false);
    }
  };

  const saveReportSettings = async () => {
    if (reportSaving) return;
    setReportSaving(true);
    try {
      const res: any = await api('/api/settings/report', {
        method: 'PUT',
        body: JSON.stringify(reportSettings),
      });
      if (res?.settings) setReportSettings(prev => ({ ...prev, ...res.settings }));
      setMsg('تم حفظ إعدادات التقارير');
    } catch (err: any) {
      setMsg(err?.message || 'فشل حفظ إعدادات التقارير');
    } finally {
      setReportSaving(false);
      setTimeout(() => setMsg(''), 3000);
    }
  };

  const PROVIDER_DEFAULTS: Record<string, { name: string; apiUrl: string; models: string[]; placeholder: string }> = {    gemini: { name: 'Google Gemini', apiUrl: 'https://generativelanguage.googleapis.com/v1beta', models: ['gemini-2.5-flash', 'gemini-flash-latest', 'gemini-2.0-flash'], placeholder: 'AIzaSy...' },
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

  // ─── Places (rooms) ────────────
  const loadPlaces = async () => {
    setPlacesLoading(true);
    try {
      const data = await api('/api/places');
      if (Array.isArray(data)) setPlaces(data);
    } catch {
      setMsg('فشل تحميل الأماكن');
      setTimeout(() => setMsg(''), 3000);
    }
    setPlacesLoading(false);
  };

  const openAddPlace = () => {
    setPlaceId(null);
    setPlaceForm({ name: '', capacity: '' });
    setPlaceModal(true);
  };

  const startEditPlace = (place: any) => {
    setPlaceId(place.id);
    setPlaceForm({ name: place.name, capacity: String(place.capacity) });
    setPlaceModal(true);
  };

  const savePlace = async () => {
    if (placeSaving) return;
    const name = placeForm.name.trim();
    const capacity = Number(placeForm.capacity || 0);
    if (!name) { setMsg('اسم المكان مطلوب'); setTimeout(() => setMsg(''), 3000); return; }
    if (!Number.isInteger(capacity) || capacity <= 0) {
      setMsg('السعة يجب أن تكون رقماً أكبر من صفر');
      setTimeout(() => setMsg(''), 3000);
      return;
    }
    setPlaceSaving(true);
    try {
      if (placeId) {
        await api(`/api/places/${placeId}`, {
          method: 'PUT', body: JSON.stringify({ name, capacity }),
        });
        setMsg('تم تحديث المكان');
      } else {
        await api('/api/places', {
          method: 'POST', body: JSON.stringify({ name, capacity }),
        });
        setMsg('تم إضافة المكان');
      }
      setPlaceModal(false);
      setPlaceId(null);
      setPlaceForm({ name: '', capacity: '' });
      await loadPlaces();
    } catch (err: any) {
      setMsg(err.message || 'فشل حفظ المكان');
    }
    setPlaceSaving(false);
    setTimeout(() => setMsg(''), 4000);
  };

  const togglePlaceActive = async (place: any) => {
    try {
      await api(`/api/places/${place.id}`, {
        method: 'PUT', body: JSON.stringify({ is_active: place.is_active ? 0 : 1 }),
      });
      setMsg(place.is_active ? 'تم تعطيل المكان' : 'تم تفعيل المكان');
      await loadPlaces();
    } catch (err: any) {
      setMsg(err.message || 'فشل تغيير حالة المكان');
    }
    setTimeout(() => setMsg(''), 4000);
  };

  const deletePlace = async (place: any) => {
    if (!confirm(`تأكيد حذف المكان "${place.name}"؟ سيُعطَّل فقط إذا كان مستخدماً في مجموعات.`)) return;
    try {
      const res = await api(`/api/places/${place.id}`, { method: 'DELETE' });
      setMsg(res.message || 'تم حذف المكان');
      await loadPlaces();
    } catch (err: any) {
      setMsg(err.message || 'فشل حذف المكان');
    }
    setTimeout(() => setMsg(''), 4000);
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin h-8 w-8 border-4 rounded-full" style={{ borderColor: 'var(--primary)', borderTopColor: 'transparent' }} /></div>;
  if (error) return <div className="flex flex-col items-center justify-center h-64 gap-4"><p style={{ color: '#dc2626' }}>{error}</p><button onClick={retry} className="px-4 py-2 bg-[var(--primary)] text-white rounded-xl text-sm">إعادة المحاولة</button></div>;

  return <ErrorBoundary>
    <div className="space-y-6">
      <h1 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>الإعدادات</h1>

      {msg && <div className="px-4 py-3 rounded-xl text-sm animate-slide-up bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400">{msg}</div>}

      <div className="flex gap-2 overflow-x-auto">
        {(['branding', 'categories', 'places', 'ai', 'autogroup', 'notification', 'certificates', 'survey', 'announcement', 'reports'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-5 py-2.5 rounded-xl text-sm whitespace-nowrap ${tab === t ? 'bg-[var(--primary)] text-white' : 'border'}`}
            style={tab === t ? {} : { backgroundColor: 'var(--card)', color: 'var(--text-muted)', borderColor: 'var(--border)' }}>
            {t === 'branding' ? 'العلامة التجارية' : t === 'categories' ? 'التصنيفات' : t === 'places' ? '📍 الأماكن' : t === 'ai' ? 'الذكاء الاصطناعي' : t === 'autogroup' ? 'التجميع التلقائي' : t === 'notification' ? '🔔 الإشعارات' : t === 'certificates' ? '🎓 الشهادات' : t === 'survey' ? '⭐ الاستبيان' : t === 'announcement' ? '📣 الإعلانات' : '📄 التقارير'}
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

      {/* Places (rooms) */}
      {tab === 'places' && (
        <div className="rounded-2xl p-6 shadow-sm space-y-4" style={{ backgroundColor: 'var(--card)' }}>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <h2 className="font-bold" style={{ color: 'var(--text)' }}>📍 الأماكن (القاعات)</h2>
              <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>أضف أماكن التدريب وحدد سعتها. تُستخدم الأماكن في المجموعات الأوفلاين فقط، والسعة حد أقصى صارم للتسكين.</p>
            </div>
            <div className="flex gap-2">
              <button onClick={loadPlaces} disabled={placesLoading}
                className="px-4 py-2 rounded-xl text-sm border disabled:opacity-50"
                style={{ borderColor: 'var(--border)', color: 'var(--text)' }}>
                {placesLoading ? 'جاري التحديث...' : '🔄 تحديث'}
              </button>
              <button onClick={openAddPlace}
                className="px-4 py-2 bg-[var(--primary)] text-white rounded-xl text-sm">+ إضافة مكان</button>
            </div>
          </div>

          {places.length === 0 && !placesLoading && (
            <div className="text-center py-10 rounded-xl" style={{ backgroundColor: 'var(--bg)' }}>
              <p className="text-3xl mb-2">🏫</p>
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>لا توجد أماكن بعد. أضف أول مكان لتبدأ ربط المجموعات الأوفلاين به.</p>
            </div>
          )}

          <div className="space-y-2">
            {places.map((place: any) => (
              <div key={place.id} className="flex items-center justify-between gap-3 p-3 rounded-xl flex-wrap" style={{ backgroundColor: 'var(--bg)' }}>
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-xl">📍</span>
                  <div className="min-w-0">
                    <p className="font-medium truncate" style={{ color: 'var(--text)' }}>{place.name}</p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                      السعة: {place.capacity} طالب
                      {place.groups_count > 0 ? ` • مستخدم في ${place.groups_count} مجموعة` : ' • غير مستخدم'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-[11px] px-2 py-1 rounded-lg ${place.is_active ? 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'}`}>
                    {place.is_active ? 'مفعّل' : 'معطّل'}
                  </span>
                  <button onClick={() => startEditPlace(place)}
                    className="text-xs px-2 py-1 rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-300">تعديل</button>
                  <button onClick={() => togglePlaceActive(place)}
                    className="text-xs px-2 py-1 rounded-lg border"
                    style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
                    {place.is_active ? 'تعطيل' : 'تفعيل'}
                  </button>
                  <button onClick={() => deletePlace(place)}
                    className="text-red-500 text-xs px-1">حذف</button>
                </div>
              </div>
            ))}
          </div>

          <p className="text-xs p-3 rounded-xl" style={{ backgroundColor: 'var(--bg)', color: 'var(--text-muted)' }}>
            ℹ️ المكان المستخدم في مجموعات سابقة لا يُحذف نهائياً — يُعطَّل فقط ليختفي من قائمة المجموعات الجديدة ويبقى في المجموعات القديمة.
          </p>

          <Modal open={placeModal} onClose={() => { setPlaceModal(false); setPlaceId(null); }} title={placeId ? 'تعديل المكان' : 'إضافة مكان جديد'}>
            <div className="space-y-3">
              <div>
                <label className="block text-sm mb-1" style={{ color: 'var(--text-muted)' }}>اسم المكان</label>
                <input placeholder="مثال: قاعة التدريب الكبرى" value={placeForm.name}
                  onChange={e => setPlaceForm({ ...placeForm, name: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl border text-sm" style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }} />
              </div>
              <div>
                <label className="block text-sm mb-1" style={{ color: 'var(--text-muted)' }}>الحد الأقصى للعدد (السعة)</label>
                <input type="number" min="1" inputMode="numeric" placeholder="مثال: 30" value={placeForm.capacity}
                  onChange={e => setPlaceForm({ ...placeForm, capacity: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl border text-sm" style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }} />
              </div>
              <button onClick={savePlace} disabled={placeSaving}
                className="w-full py-3 bg-[var(--primary)] text-white rounded-xl font-medium disabled:opacity-50">
                {placeSaving ? 'جاري الحفظ...' : 'حفظ'}
              </button>
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

      {/* Notification Settings */}
      {tab === 'notification' && (
        <div className="space-y-4">
          {/* SMTP Settings */}
          <div className="rounded-2xl p-6 shadow-sm space-y-4" style={{ backgroundColor: 'var(--card)' }}>
            <div>
              <h2 className="font-bold" style={{ color: 'var(--text)' }}>📧 إعدادات البريد الإلكتروني (SMTP)</h2>
              <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>إعدادات الخادم لإرسال الإشعارات والرموز عبر البريد الإلكتروني.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>اسم المستخدم (البريد)</label>
                <input value={notifForm.smtpUser} onChange={e => setNotifForm(p => ({ ...p, smtpUser: e.target.value }))}
                  placeholder="your-email@gmail.com"
                  className="w-full px-4 py-2.5 rounded-xl border text-sm" style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }} />
              </div>
              <div>
                <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>كلمة المرور (App Password)</label>
                <input type="password" value={notifForm.smtpPass} onChange={e => setNotifForm(p => ({ ...p, smtpPass: e.target.value }))}
                  placeholder="••••••••••"
                  className="w-full px-4 py-2.5 rounded-xl border text-sm" style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }} />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>الاسم المعروض (From)</label>
                <input value={notifForm.smtpFrom} onChange={e => setNotifForm(p => ({ ...p, smtpFrom: e.target.value }))}
                  placeholder="&quot;وحدة التدريب و التطوير&quot; &lt;your-email@gmail.com&gt;"
                  className="w-full px-4 py-2.5 rounded-xl border text-sm" style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }} />
              </div>
            </div>
            <div className="flex items-center gap-3 pt-2">
              <button onClick={saveNotification} disabled={notifSaving}
                className="px-6 py-2.5 bg-[var(--primary)] text-white rounded-xl text-sm font-medium disabled:opacity-50">
                {notifSaving ? 'جاري الحفظ...' : '💾 حفظ الإعدادات'}
              </button>
              <button onClick={testEmail} disabled={notifTesting === 'email'}
                className="px-4 py-2.5 rounded-xl text-sm border font-medium disabled:opacity-50"
                style={{ borderColor: 'var(--border)', color: 'var(--text)' }}>
                {notifTesting === 'email' ? 'جاري الإرسال...' : '📧 اختبار الإيميل'}
              </button>
            </div>
            <div className="p-3 rounded-xl text-xs" style={{ backgroundColor: 'var(--bg)', color: 'var(--text-muted)' }}>
              <p><strong>للحصول على App Password (Gmail):</strong></p>
              <ul className="mt-1 space-y-1 list-disc list-inside">
                <li>افتح حساب Google → Security → 2-Step Verification (فعّلها)</li>
                <li>ثم Security → App passwords → أنشئ كلمة مرور جديدة</li>
                <li>انسخ الكود (16 حرف) وضعه في حقل كلمة المرور</li>
              </ul>
            </div>
          </div>

          {/* Telegram Settings */}
          <div className="rounded-2xl p-6 shadow-sm space-y-4" style={{ backgroundColor: 'var(--card)' }}>
            <div>
              <h2 className="font-bold" style={{ color: 'var(--text)' }}>📱 إعدادات تيليجرام (Telegram Bot)</h2>
              <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>إعدادات بوت تيليجرام لإرسال الإشعارات والرموز. أنشئ بوت عبر @BotFather على تيليجرام.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Bot Token</label>
                <input type="password" value={notifForm.telegramBotToken} onChange={e => setNotifForm(p => ({ ...p, telegramBotToken: e.target.value }))}
                  placeholder="1234567890:ABCdefGHIjklMNOpqrSTUvwxYZ"
                  className="w-full px-4 py-2.5 rounded-xl border text-sm" style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }} />
              </div>
              <div>
                <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Bot Username</label>
                <input value={notifForm.telegramBotUsername} onChange={e => setNotifForm(p => ({ ...p, telegramBotUsername: e.target.value }))}
                  placeholder="MyBot_username"
                  className="w-full px-4 py-2.5 rounded-xl border text-sm" style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }} />
              </div>
            </div>
            <div className="flex items-center gap-3 pt-2">
              <button onClick={saveNotification} disabled={notifSaving}
                className="px-6 py-2.5 bg-[var(--primary)] text-white rounded-xl text-sm font-medium disabled:opacity-50">
                {notifSaving ? 'جاري الحفظ...' : '💾 حفظ الإعدادات'}
              </button>
              <button onClick={testTelegram} disabled={notifTesting === 'telegram'}
                className="px-4 py-2.5 rounded-xl text-sm border font-medium disabled:opacity-50"
                style={{ borderColor: 'var(--border)', color: 'var(--text)' }}>
                {notifTesting === 'telegram' ? 'جاري الفحص...' : '📱 اختبار تيليجرام'}
              </button>
            </div>
            <div className="p-3 rounded-xl text-xs" style={{ backgroundColor: 'var(--bg)', color: 'var(--text-muted)' }}>
              <p><strong>لإنشاء بوت تيليجرام:</strong></p>
              <ul className="mt-1 space-y-1 list-disc list-inside">
                <li>افتح تيليجرام → ابحث عن @BotFather → /newbot</li>
                <li>أدخل اسم البوت ثم username فريد</li>
                <li>انسخ الـ Token وضعه في الحقل أعلاه</li>
                <li>لربط حساب مستخدم: المستخدم يفتح https://t.me/&lt;username&gt;?start=&lt;userId&gt;</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Certificate Settings */}
      {tab === 'certificates' && (
        <div className="space-y-4">
          {/* Auto-Issue Settings */}
          <div className="rounded-2xl p-6 shadow-sm space-y-4" style={{ backgroundColor: 'var(--card)' }}>
            <div>
              <h2 className="font-bold" style={{ color: 'var(--text)' }}>🎓 إعدادات الإصدار التلقائي</h2>
              <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>تحكم في شروط إصدار الشهادات التلقائية عند اكتمال المجموعة.</p>
            </div>

            <div className="space-y-4">
              {/* Auto Issue Toggle */}
              <div className="flex items-center justify-between p-4 rounded-xl" style={{ backgroundColor: 'var(--bg)' }}>
                <div>
                  <p className="font-medium text-sm" style={{ color: 'var(--text)' }}>الإصدار التلقائي</p>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>إصدار شهادة تلقائياً عند اكتمال جميع المحاضرات في المجموعة</p>
                </div>
                <button onClick={() => setCertSettings(p => ({ ...p, autoIssue: !p.autoIssue }))}
                  className={`w-12 h-6 rounded-full relative transition-colors ${certSettings.autoIssue ? 'bg-[var(--primary)]' : 'bg-gray-300'}`}>
                  <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${certSettings.autoIssue ? 'translate-x-6' : 'translate-x-0.5'}`} />
                </button>
              </div>

              {/* Require Attendance Toggle */}
              <div className="flex items-center justify-between p-4 rounded-xl" style={{ backgroundColor: 'var(--bg)' }}>
                <div>
                  <p className="font-medium text-sm" style={{ color: 'var(--text)' }}>الحضور个人ي مطلوب</p>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>اشتراط حضور الطالب个人ياً (بالـ QR) للحصول على الشهادة</p>
                </div>
                <button onClick={() => setCertSettings(p => ({ ...p, requireAttendance: !p.requireAttendance }))}
                  className={`w-12 h-6 rounded-full relative transition-colors ${certSettings.requireAttendance ? 'bg-[var(--primary)]' : 'bg-gray-300'}`}>
                  <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${certSettings.requireAttendance ? 'translate-x-6' : 'translate-x-0.5'}`} />
                </button>
              </div>

              {/* Min Attendance Percentage */}
              {certSettings.requireAttendance && (
                <div className="p-4 rounded-xl" style={{ backgroundColor: 'var(--bg)' }}>
                  <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text)' }}>
                    الحد الأدنى لنسبة الحضور个人ي
                  </label>
                  <div className="flex items-center gap-3">
                    <input type="range" min="0" max="100" step="5"
                      value={certSettings.minAttendancePercent}
                      onChange={e => setCertSettings(p => ({ ...p, minAttendancePercent: Number(e.target.value) }))}
                      className="flex-1 h-2 rounded-full appearance-none cursor-pointer"
                      style={{ backgroundColor: 'var(--border)' }} />
                    <span className="text-lg font-bold min-w-[50px] text-center" style={{ color: 'var(--primary)' }}>
                      {certSettings.minAttendancePercent}%
                    </span>
                  </div>
                  <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                    الطالب لازم يكون حضر على الأقل {certSettings.minAttendancePercent}% من المحاضرات个人ياً
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Certificate Design Settings */}
          <div className="rounded-2xl p-6 shadow-sm space-y-4" style={{ backgroundColor: 'var(--card)' }}>
            <div>
              <h2 className="font-bold" style={{ color: 'var(--text)' }}>🎨 تصميم الشهادة</h2>
              <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>تخصيص النصوص والتوقيعات التي تظهر في الشهادة.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm mb-1" style={{ color: 'var(--text-muted)' }}>عنوان الشهادة (عربي)</label>
                <input value={certSettings.certificateTitle}
                  onChange={e => setCertSettings(p => ({ ...p, certificateTitle: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-xl border text-sm"
                  style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }} />
              </div>
              <div>
                <label className="block text-sm mb-1" style={{ color: 'var(--text-muted)' }}>عنوان الشهادة (إنجليزي)</label>
                <input value={certSettings.certificateTitleEn}
                  onChange={e => setCertSettings(p => ({ ...p, certificateTitleEn: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-xl border text-sm"
                  style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }} />
              </div>
              <div>
                <label className="block text-sm mb-1" style={{ color: 'var(--text-muted)' }}>اسم المدير (للتوقيع)</label>
                <input value={certSettings.directorName}
                  onChange={e => setCertSettings(p => ({ ...p, directorName: e.target.value }))}
                  placeholder="أحمد حسن"
                  className="w-full px-4 py-2.5 rounded-xl border text-sm"
                  style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }} />
              </div>
              <div>
                <label className="block text-sm mb-1" style={{ color: 'var(--text-muted)' }}>منصب المدير</label>
                <input value={certSettings.directorTitle}
                  onChange={e => setCertSettings(p => ({ ...p, directorTitle: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-xl border text-sm"
                  style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }} />
              </div>
            </div>

            <div>
              <label className="block text-sm mb-1" style={{ color: 'var(--text-muted)' }}>نص التذييل القانوني</label>
              <textarea value={certSettings.footerText}
                onChange={e => setCertSettings(p => ({ ...p, footerText: e.target.value }))}
                className="w-full px-4 py-2.5 rounded-xl border text-sm h-20"
                style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }} />
            </div>

            <button onClick={saveCertificateSettings} disabled={certSaving}
              className="px-6 py-2.5 bg-[var(--primary)] text-white rounded-xl text-sm font-medium disabled:opacity-50">
              {certSaving ? 'جاري الحفظ...' : '💾 حفظ الإعدادات'}
            </button>
          </div>

          {/* Info Box */}
          <div className="rounded-2xl p-4 shadow-sm" style={{ backgroundColor: 'var(--card)' }}>
            <div className="p-4 rounded-xl text-sm" style={{ backgroundColor: 'var(--bg)', color: 'var(--text-muted)' }}>
              <p><strong>📋 ملاحظات مهمة:</strong></p>
              <ul className="mt-2 space-y-1 list-disc list-inside">
                <li>الإصدار التلقائي يعمل عند اكتمال جميع المحاضرات في المجموعة (.Admin يضغط "إتمام" على كل محاضرة)</li>
                <li>الإصدار اليدوي من صفحة "الشهادات" يعمل بدون شروط حضور أو إكمال</li>
                <li>الإشعارات تُرسل تلقائياً عند إصدار الشهادة (بريد + تيليجرام)</li>
                <li>الطالب يقدر يحمّل الشهادة كـ PDF من لوحة التحكم</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Survey Settings */}
      {tab === 'survey' && (
        <div className="space-y-4">
          <div className="rounded-2xl p-6 shadow-sm space-y-4" style={{ backgroundColor: 'var(--card)' }}>
            <div>
              <h2 className="font-bold" style={{ color: 'var(--text)' }}>⭐ إعدادات استبيان الطالب</h2>
              <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
                يُفتح الاستبيان تلقائياً بعد إنهاء المجموعة، ويُرسل تذكيران فقط للطلاب الذين لم يجيبوا.
              </p>
            </div>

            {surveyLoading ? (
              <div className="flex justify-center py-6">
                <div className="animate-spin h-6 w-6 border-4 rounded-full" style={{ borderColor: 'var(--primary)', borderTopColor: 'transparent' }} />
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm mb-1" style={{ color: 'var(--text-muted)' }}>مدة فتح الاستبيان (أيام)</label>
                  <input type="number" min={1} max={365} value={surveySettings.openDays}
                    onChange={e => setSurveySettings(p => ({ ...p, openDays: Number(e.target.value) }))}
                    className="w-full px-4 py-2.5 rounded-xl border text-sm"
                    style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }} />
                  <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>يُغلق تلقائياً بعدها — يمكن للأدمن تمديدها لكل مجموعة.</p>
                </div>
                <div>
                  <label className="block text-sm mb-1" style={{ color: 'var(--text-muted)' }}>التذكير الأول بعد (أيام)</label>
                  <input type="number" min={0} max={60} value={surveySettings.reminder1Days}
                    onChange={e => setSurveySettings(p => ({ ...p, reminder1Days: Number(e.target.value) }))}
                    className="w-full px-4 py-2.5 rounded-xl border text-sm"
                    style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }} />
                  <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>يُرسل لغير المجيبين فقط.</p>
                </div>
                <div>
                  <label className="block text-sm mb-1" style={{ color: 'var(--text-muted)' }}>التذكير الثاني بعد (أيام)</label>
                  <input type="number" min={1} max={120} value={surveySettings.reminder2Days}
                    onChange={e => setSurveySettings(p => ({ ...p, reminder2Days: Number(e.target.value) }))}
                    className="w-full px-4 py-2.5 rounded-xl border text-sm"
                    style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }} />
                  <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>لا يُرسل أي تذكير بعد التذكير الثاني.</p>
                </div>
              </div>
            )}

            <button onClick={saveSurveySettings} disabled={surveySaving || surveyLoading}
              className="px-6 py-2.5 bg-[var(--primary)] text-white rounded-xl text-sm font-medium disabled:opacity-50">
              {surveySaving ? 'جاري الحفظ...' : '💾 حفظ الإعدادات'}
            </button>
          </div>

          <div className="rounded-2xl p-4 shadow-sm" style={{ backgroundColor: 'var(--card)' }}>
            <div className="p-4 rounded-xl text-sm space-y-1" style={{ backgroundColor: 'var(--bg)', color: 'var(--text-muted)' }}>
              <p><strong>📋 كيف يعمل الاستبيان؟</strong></p>
              <ul className="mt-2 space-y-1 list-disc list-inside">
                <li>يُفتح بعد إنهاء المجموعة، ويُرسل إشعار فوري «قيّم دورتك» لكل الطلاب.</li>
                <li>إجابة واحدة لكل طالب ولا يمكن تعديلها بعد الإرسال، والحفظ التلقائي أثناء الملء.</li>
                <li>المشاركة اختيارية ولا تؤثر على الشهادة.</li>
                <li>بند «مكان البرنامج» يظهر في المجموعات الأوفلاين فقط.</li>
                <li>مفتاح «إظهار اسمي وبياناتي للإدارة» مفعّل افتراضياً ويستطيع الطالب إطفاءه.</li>
                <li>المحاضر لا يرى أسماء الطلاب ولا نتائج الاستبيان في كل الأحوال.</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Announcement Settings (edit-plan.md §7) */}
      {tab === 'announcement' && (
        <div className="space-y-4">
          <div className="rounded-2xl p-6 shadow-sm space-y-4" style={{ backgroundColor: 'var(--card)' }}>
            <div>
              <h2 className="font-bold" style={{ color: 'var(--text)' }}>📣 إعلانات الكورسات الجديدة</h2>
              <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
                الإعلان يُبنى تلقائياً من بيانات الكورس، ويمكن إرساله يدوياً من صفحة أي كورس بعد مراجعته.
              </p>
            </div>

            {announcementLoading ? (
              <div className="flex justify-center py-6">
                <div className="animate-spin h-6 w-6 border-4 rounded-full" style={{ borderColor: 'var(--primary)', borderTopColor: 'transparent' }} />
              </div>
            ) : (
              <label className="flex items-start gap-3 p-4 rounded-xl cursor-pointer" style={{ backgroundColor: 'var(--bg)' }}>
                <input
                  type="checkbox"
                  checked={announcementSettings.autoEnabled}
                  onChange={e => setAnnouncementSettings(prev => ({ ...prev, autoEnabled: e.target.checked }))}
                  className="mt-1"
                />
                <span>
                  <span className="block text-sm font-medium" style={{ color: 'var(--text)' }}>
                    إرسال تلقائي عند نشر الكورس
                  </span>
                  <span className="block text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                    يُرسل مرة واحدة فقط لكل كورس عند تفعيله وفتحه للتسجيل — لا عند حفظه كمسودة. الزر اليدوي يبقى متاحاً دائماً.
                  </span>
                </span>
              </label>
            )}

            <button onClick={saveAnnouncementSettings} disabled={announcementSaving || announcementLoading}
              className="px-6 py-2.5 bg-[var(--primary)] text-white rounded-xl text-sm font-medium disabled:opacity-50">
              {announcementSaving ? 'جاري الحفظ...' : '💾 حفظ الإعدادات'}
            </button>
          </div>

          <div className="rounded-2xl p-4 shadow-sm" style={{ backgroundColor: 'var(--card)' }}>
            <div className="p-4 rounded-xl text-sm space-y-1" style={{ backgroundColor: 'var(--bg)', color: 'var(--text-muted)' }}>
              <p><strong>📬 كيف يصل الإعلان؟</strong></p>
              <ul className="mt-2 space-y-1 list-disc list-inside">
                <li>إشعار داخل المنصة + بريد إلكتروني لكل حساب نشط — دائماً.</li>
                <li>رسالة تليجرام لمن ربط حسابه بالبوت.</li>
                <li>قبل الإرسال تظهر معاينة كاملة للنص وعدد المستلمين للمراجعة.</li>
                <li>إن سبق إرسال إعلان الكورس يظهر تحذير بتاريخ الإرسال قبل السماح بالتكرار.</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Report Settings (edit-plan.md §8) */}
      {tab === 'reports' && (
        <div className="space-y-4">
          <div className="rounded-2xl p-6 shadow-sm space-y-4" style={{ backgroundColor: 'var(--card)' }}>
            <div>
              <h2 className="font-bold" style={{ color: 'var(--text)' }}>📄 إعدادات تقرير المجموعة</h2>
              <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
                النصوص الثابتة التي تظهر في تقرير Word، والقيم الافتراضية لبيانات التقرير في كل مجموعة.
              </p>
            </div>

            {reportLoading ? (
              <div className="flex justify-center py-6">
                <div className="animate-spin h-6 w-6 border-4 rounded-full" style={{ borderColor: 'var(--primary)', borderTopColor: 'transparent' }} />
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm mb-1" style={{ color: 'var(--text-muted)' }}>اسم منسق الدورة</label>
                    <input value={reportSettings.coordinatorName}
                      onChange={e => setReportSettings({ ...reportSettings, coordinatorName: e.target.value })}
                      maxLength={200}
                      className="w-full px-4 py-2.5 rounded-xl border text-sm"
                      style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }} />
                  </div>
                  <div>
                    <label className="block text-sm mb-1" style={{ color: 'var(--text-muted)' }}>منسق/منظم/رعاة الدورة</label>
                    <input value={reportSettings.organizerText}
                      onChange={e => setReportSettings({ ...reportSettings, organizerText: e.target.value })}
                      maxLength={300}
                      className="w-full px-4 py-2.5 rounded-xl border text-sm"
                      style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }} />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm mb-1" style={{ color: 'var(--text-muted)' }}>نوع النشاط الافتراضي</label>
                    <input value={reportSettings.defaultActivityType}
                      onChange={e => setReportSettings({ ...reportSettings, defaultActivityType: e.target.value })}
                      maxLength={300}
                      className="w-full px-4 py-2.5 rounded-xl border text-sm"
                      style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }} />
                  </div>
                </div>

                <div>
                  <label className="block text-sm mb-1" style={{ color: 'var(--text-muted)' }}>نص الشهادات (القسم السابع)</label>
                  <textarea value={reportSettings.certificateText}
                    onChange={e => setReportSettings({ ...reportSettings, certificateText: e.target.value })}
                    rows={3} maxLength={2000}
                    className="w-full px-4 py-2.5 rounded-xl border text-sm resize-y"
                    style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }} />
                </div>

                <div>
                  <label className="block text-sm mb-1" style={{ color: 'var(--text-muted)' }}>نص الملاحظات العامة الافتراضي (القسم الثامن)</label>
                  <textarea value={reportSettings.defaultNotes}
                    onChange={e => setReportSettings({ ...reportSettings, defaultNotes: e.target.value })}
                    rows={3} maxLength={4000}
                    className="w-full px-4 py-2.5 rounded-xl border text-sm resize-y"
                    style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }} />
                </div>

                <div>
                  <label className="block text-sm mb-1" style={{ color: 'var(--text-muted)' }}>نص التوصيات الافتراضي (القسم التاسع)</label>
                  <textarea value={reportSettings.defaultRecommendations}
                    onChange={e => setReportSettings({ ...reportSettings, defaultRecommendations: e.target.value })}
                    rows={3} maxLength={4000}
                    className="w-full px-4 py-2.5 rounded-xl border text-sm resize-y"
                    style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }} />
                </div>

                <button onClick={saveReportSettings} disabled={reportSaving}
                  className="px-6 py-2.5 bg-[var(--primary)] text-white rounded-xl text-sm font-medium disabled:opacity-50">
                  {reportSaving ? 'جاري الحفظ...' : '💾 حفظ الإعدادات'}
                </button>
              </>
            )}
          </div>

          <div className="rounded-2xl p-4 shadow-sm" style={{ backgroundColor: 'var(--card)' }}>
            <div className="p-4 rounded-xl text-sm space-y-1" style={{ backgroundColor: 'var(--bg)', color: 'var(--text-muted)' }}>
              <p><strong>📋 كيف يُبنى تقرير المجموعة؟</strong></p>
              <ul className="mt-2 space-y-1 list-disc list-inside">
                <li>يُولَّد من أحدث بيانات الكورس والمجموعة والمحاضرات والطلاب وقت الضغط — لا يُحفظ ملف قديم.</li>
                <li>الاستخراج متاح بعد إنهاء المجموعة فقط، ويعود معطلاً إذا أُعيد فتحها.</li>
                <li>الصور الوثائقية تُرفع وقت الاستخراج (حتى 8 صور) ولا تُخزَّن في النظام.</li>
                <li>قسم نتائج التقييم يُبنى من استبيان الطالب، ويختفي مجال المكان في الأونلاين.</li>
                <li>التصدير إلى Excel متاح للحضور والمجموعات وطلابها ونتائج الاستبيان وتقييم المحاضر.</li>
              </ul>
            </div>
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
