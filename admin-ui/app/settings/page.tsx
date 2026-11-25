'use client';

import { useState, useEffect, useRef } from 'react';
import { api } from '../../lib/api';
import Modal from '../../components/Modal';
import ErrorBoundary from '../../components/ErrorBoundary';
import { compressAndEncode } from '../../lib/imageUtils';

type SettingsTab = 'branding' | 'categories' | 'places' | 'ai' | 'autogroup' | 'notification' | 'certificates' | 'survey' | 'announcement' | 'reports' | 'payments' | 'appversion';

// Material 3 section navigation: tab strip on desktop, dropdown on mobile.
const TABS: { key: SettingsTab; label: string; icon: string }[] = [
  { key: 'branding', label: 'العلامة التجارية', icon: 'palette' },
  { key: 'payments', label: 'طرق الدفع', icon: 'credit_card' },
  { key: 'categories', label: 'التصنيفات', icon: 'category' },
  { key: 'places', label: 'الأماكن', icon: 'location_on' },
  { key: 'ai', label: 'الذكاء الاصطناعي', icon: 'smart_toy' },
  { key: 'autogroup', label: 'التجميع التلقائي', icon: 'groups' },
  { key: 'notification', label: 'الإشعارات', icon: 'notifications' },
  { key: 'certificates', label: 'الشهادات', icon: 'workspace_premium' },
  { key: 'survey', label: 'الاستبيان', icon: 'star' },
  { key: 'announcement', label: 'الإعلانات', icon: 'campaign' },
  { key: 'reports', label: 'التقارير', icon: 'description' },
  { key: 'appversion', label: 'إصدار التطبيق', icon: 'phone_android' },
];

export default function SettingsPage() {
  const [tab, setTab] = useState<SettingsTab>('branding');
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

  // Payment methods (phase 1)
  const [paymentMethods, setPaymentMethods] = useState<any[]>([]);
  const [paymentsLoading, setPaymentsLoading] = useState(false);
  const [paymentModal, setPaymentModal] = useState(false);
  const [paymentId, setPaymentId] = useState<number | null>(null);
  const [paymentSaving, setPaymentSaving] = useState(false);
  const [paymentForm, setPaymentForm] = useState({
    key: '', label: '', kind: 'digital', account_number: '', account_name: '',
    instructions: '', is_active: 1, sort_order: 0,
  });

  // Booking window — unpaid bookings auto-cancel after this many hours
  const [bookingHours, setBookingHours] = useState<number>(168);
  const [bookingSaving, setBookingSaving] = useState(false);

  // Mobile app version + update broadcast
  const [versionForm, setVersionForm] = useState({
    latestVersion: '1.0.8',
    buildNumber: 9,
    forceUpdate: false,
    title: 'تحديث جديد متوفر',
    message: 'يتوفر إصدار جديد من تطبيق الهاتف، اضغط للتحديث الآن.',
    downloadUrl: 'https://lms-user.vercel.app/download',
    apkDirectUrl: '',
  });
  const [versionSaving, setVersionSaving] = useState(false);
  const [versionBroadcasting, setVersionBroadcasting] = useState(false);

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

  useEffect(() => {
    if (tab === 'payments') {
      loadPaymentMethods();
      // Booking window is shown in the payments tab.
      api('/api/settings/booking').then((b: any) => { if (b && b.hours) setBookingHours(Number(b.hours)); }).catch(() => { /* ignore */ });
    }
  }, [tab]);

  useEffect(() => {
    if (tab === 'appversion') {
      api('/api/settings/app-version').then((v: any) => {
        if (v && typeof v === 'object') setVersionForm(prev => ({ ...prev, ...v }));
      }).catch(() => { /* ignore */ });
    }
  }, [tab]);

  const saveBookingWindow = async () => {
    const hours = Number(bookingHours);
    if (!Number.isInteger(hours) || hours < 1 || hours > 720) {
      setMsg('المدة يجب أن تكون بين ساعة و720 ساعة');
      setTimeout(() => setMsg(''), 3000);
      return;
    }
    setBookingSaving(true);
    try {
      await api('/api/settings/booking', { method: 'PUT', body: JSON.stringify({ hours }) });
      setBookingHours(hours);
      setMsg('تم تحديث مدة الحجز');
    } catch {
      setMsg('فشل تحديث مدة الحجز');
    }
    setBookingSaving(false);
    setTimeout(() => setMsg(''), 3000);
  };

  const saveAppVersion = async () => {
    setVersionSaving(true);
    try {
      const res: any = await api('/api/settings/app-version', {
        method: 'PUT',
        body: JSON.stringify({ ...versionForm, buildNumber: Number(versionForm.buildNumber) || 0 }),
      });
      setMsg(res?.broadcastCount != null && res.broadcastCount > 0
        ? `تم حفظ الإصدار وإرسال إشعار التحديث إلى ${res.broadcastCount} مستخدم`
        : 'تم حفظ إعدادات الإصدار');
    } catch {
      setMsg('فشل حفظ إعدادات الإصدار');
    }
    setVersionSaving(false);
    setTimeout(() => setMsg(''), 4000);
  };

  const broadcastAppVersionNow = async () => {
    if (!window.confirm('إرسال إشعار التحديث لكل مستخدمي التطبيق الآن؟')) return;
    setVersionBroadcasting(true);
    try {
      const res: any = await api('/api/settings/app-version/broadcast', { method: 'POST' });
      setMsg(res?.count != null ? `تم إرسال إشعار التحديث إلى ${res.count} مستخدم` : 'تم إرسال الإشعار');
    } catch {
      setMsg('فشل إرسال إشعار التحديث');
    }
    setVersionBroadcasting(false);
    setTimeout(() => setMsg(''), 4000);
  };

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

  // ─── Payment Methods Functions ──────────────────
  const loadPaymentMethods = async () => {
    setPaymentsLoading(true);
    try {
      const data = await api('/api/admin/payment-methods');
      setPaymentMethods(Array.isArray(data) ? data : []);
    } catch (err: any) {
      setMsg(err.message || 'فشل تحميل طرق الدفع');
      setTimeout(() => setMsg(''), 4000);
    } finally {
      setPaymentsLoading(false);
    }
  };

  const openAddPayment = () => {
    setPaymentId(null);
    setPaymentForm({
      key: '', label: '', kind: 'digital', account_number: '', account_name: '',
      instructions: '', is_active: 1, sort_order: paymentMethods.length + 1,
    });
    setPaymentModal(true);
  };

  const startEditPayment = (method: any) => {
    setPaymentId(method.id);
    setPaymentForm({
      key: method.key || '',
      label: method.label || '',
      kind: method.kind || 'digital',
      account_number: method.account_number || '',
      account_name: method.account_name || '',
      instructions: method.instructions || '',
      is_active: Number(method.is_active) ? 1 : 0,
      sort_order: Number(method.sort_order) || 0,
    });
    setPaymentModal(true);
  };

  const savePayment = async () => {
    if (!paymentForm.label.trim()) { setMsg('اسم طريقة الدفع مطلوب'); setTimeout(() => setMsg(''), 4000); return; }
    if (!paymentId && !/^[a-z0-9_]{2,40}$/.test(paymentForm.key.trim())) {
      setMsg('المفتاح يجب أن يكون حروفاً إنجليزية صغيرة وأرقاماً وشرطة سفلية (2-40 حرفاً)');
      setTimeout(() => setMsg(''), 4000);
      return;
    }
    setPaymentSaving(true);
    try {
      const body = {
        key: paymentForm.key.trim(),
        label: paymentForm.label.trim(),
        kind: paymentForm.kind,
        account_number: paymentForm.account_number.trim(),
        account_name: paymentForm.account_name.trim(),
        instructions: paymentForm.instructions.trim(),
        is_active: paymentForm.is_active,
        sort_order: Number(paymentForm.sort_order) || 0,
      };
      const res = paymentId
        ? await api(`/api/admin/payment-methods/${paymentId}`, { method: 'PUT', body: JSON.stringify(body) })
        : await api('/api/admin/payment-methods', { method: 'POST', body: JSON.stringify(body) });
      setMsg(res.message || 'تم الحفظ');
      setPaymentModal(false);
      setPaymentId(null);
      await loadPaymentMethods();
    } catch (err: any) {
      setMsg(err.message || 'فشل حفظ طريقة الدفع');
    }
    setPaymentSaving(false);
    setTimeout(() => setMsg(''), 4000);
  };

  const togglePaymentActive = async (method: any) => {
    try {
      await api(`/api/admin/payment-methods/${method.id}`, {
        method: 'PUT',
        body: JSON.stringify({ is_active: Number(method.is_active) ? 0 : 1 }),
      });
      setMsg(Number(method.is_active) ? 'تم تعطيل طريقة الدفع' : 'تم تفعيل طريقة الدفع');
      await loadPaymentMethods();
    } catch (err: any) {
      setMsg(err.message || 'فشل تغيير حالة طريقة الدفع');
    }
    setTimeout(() => setMsg(''), 4000);
  };

  const deletePayment = async (method: any) => {
    if (!confirm(`حذف طريقة الدفع "${method.label}"؟ إذا كانت مستخدمة في طلبات سابقة فستُعطَّل فقط.`)) return;
    try {
      const res = await api(`/api/admin/payment-methods/${method.id}`, { method: 'DELETE' });
      setMsg(res.message || 'تم الحذف');
      await loadPaymentMethods();
    } catch (err: any) {
      setMsg(err.message || 'فشل حذف طريقة الدفع');
    }
    setTimeout(() => setMsg(''), 4000);
  };

  const movePayment = async (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= paymentMethods.length) return;
    const current = paymentMethods[index];
    const other = paymentMethods[target];
    try {
      await api(`/api/admin/payment-methods/${current.id}`, {
        method: 'PUT', body: JSON.stringify({ sort_order: target + 1 }),
      });
      await api(`/api/admin/payment-methods/${other.id}`, {
        method: 'PUT', body: JSON.stringify({ sort_order: index + 1 }),
      });
      await loadPaymentMethods();
    } catch (err: any) {
      setMsg(err.message || 'فشل تغيير الترتيب');
      setTimeout(() => setMsg(''), 4000);
    }
  };

  const copyAccountNumber = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setMsg('تم نسخ الرقم');
    } catch {
      setMsg('تعذر النسخ، انسخ الرقم يدوياً');
    }
    setTimeout(() => setMsg(''), 3000);
  };

  if (loading) return <div className="flex items-center justify-center h-64" role="status" aria-label="جاري التحميل"><div className="animate-spin h-8 w-8 border-4 rounded-full" style={{ borderColor: 'var(--md-sys-color-primary)', borderTopColor: 'transparent' }} /></div>;
  if (error) return <div className="flex flex-col items-center justify-center h-64 gap-4"><p className="msg-err px-4 py-3 rounded-md3-sm text-sm">{error}</p><button onClick={retry} className="md3-btn md3-btn--filled">إعادة المحاولة</button></div>;

  return <ErrorBoundary>
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-on-surface">الإعدادات</h1>
        <p className="text-sm mt-1 text-on-surface-variant">كل إعدادات المنصة في مكان واحد: الهوية، الدفع، الشهادات، الإشعارات، الاستبيان والتقارير.</p>
      </div>

      {msg && <div className="px-4 py-3 rounded-md3-md text-sm animate-slide-up msg-ok">{msg}</div>}

      <div className="hidden lg:block">
        <div className="md3-tabs" role="tablist" aria-label="أقسام الإعدادات">
          {TABS.map(t => (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={tab === t.key}
              onClick={() => setTab(t.key)}
              className={`md3-tab ${tab === t.key ? 'md3-tab--active' : ''}`}
            >
              <span className="material-symbols-outlined text-[18px]" aria-hidden>{t.icon}</span>
              {t.label}
            </button>
          ))}
        </div>
      </div>
      <div className="lg:hidden">
        <label htmlFor="settings-section" className="block text-sm font-medium mb-1 text-on-surface-variant">القسم</label>
        <select
          id="settings-section"
          value={tab}
          onChange={e => setTab(e.target.value as SettingsTab)}
          className="md3-field"
        >
          {TABS.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
        </select>
      </div>

      {/* Branding */}
      {tab === 'branding' && (
        <div className="md3-card md3-card--outlined p-5 space-y-4">
          <div>
            <h2 className="text-base font-semibold text-on-surface">🎨 العلامة التجارية</h2>
            <p className="text-sm mt-1 text-on-surface-variant">اسم النظام والشعارات والألوان التي تظهر في المنصة والرسائل والتطبيق.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm mb-1 text-on-surface-variant">اسم النظام</label>
              <input value={branding.systemName}
                onChange={e => setBranding({ ...branding, systemName: e.target.value })}
                className="md3-field" />
            </div>
            <div>
              <label className="block text-sm mb-1 text-on-surface-variant">شعار (عربي)</label>
              <input value={branding.sloganAr}
                onChange={e => setBranding({ ...branding, sloganAr: e.target.value })}
                className="md3-field" />
            </div>
            <div>
              <label className="block text-sm mb-1 text-on-surface-variant">Slogan (EN)</label>
              <input value={branding.sloganEn}
                onChange={e => setBranding({ ...branding, sloganEn: e.target.value })}
                className="md3-field" />
            </div>
            <div>
              <label className="block text-sm mb-1 text-on-surface-variant">اللون الأساسي</label>
              <input type="color" value={branding.primaryColor}
                onChange={e => setBranding({ ...branding, primaryColor: e.target.value })}
                className="md3-field h-10 p-1 cursor-pointer" />
            </div>
            <div>
              <label className="block text-sm mb-1 text-on-surface-variant">اللون الثانوي</label>
              <input type="color" value={branding.secondaryColor}
                onChange={e => setBranding({ ...branding, secondaryColor: e.target.value })}
                className="md3-field h-10 p-1 cursor-pointer" />
            </div>
            <ImageUploadField label="شعار Header" value={branding.logoHeader}
              onChange={v => setBranding(prev => ({ ...prev, logoHeader: v }))} />
            <ImageUploadField label="شعار Footer" value={branding.logoFooter}
              onChange={v => setBranding(prev => ({ ...prev, logoFooter: v }))} />
            <ImageUploadField label="Favicon" value={branding.favicon}
              onChange={v => setBranding(prev => ({ ...prev, favicon: v }))} />
          </div>
          <div>
            <label className="block text-sm mb-1 text-on-surface-variant">نص التذييل التلقائي (للرسائل)</label>
            <textarea value={branding.messageFooter}
              onChange={e => setBranding({ ...branding, messageFooter: e.target.value })}
              className="md3-field" />
          </div>
          <button onClick={saveBranding} disabled={saving}
            className="md3-btn md3-btn--filled">
            {saving ? 'جاري الحفظ...' : 'حفظ الإعدادات'}
          </button>

          <div className="mt-6 p-4 rounded-md3-md border border-outline-variant">
            <h3 className="font-bold text-sm mb-3">معاينة حية</h3>
            <div className="space-y-2">
              <div className="flex items-center gap-3 p-3 rounded-md3-md" style={{ backgroundColor: branding.primaryColor }}>
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
        <div className="md3-card md3-card--outlined p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-on-surface">التصنيفات</h2>
            <button onClick={() => setCatModal(true)}
              className="md3-btn md3-btn--filled">+ إضافة</button>
          </div>
          <div className="space-y-2">
            {categories.length === 0 && <p className="text-sm text-on-surface-variant">لا توجد تصنيفات</p>}
            {categories.map((c: any) => (
              <div key={c.id} className="flex items-center justify-between p-3 rounded-md3-md bg-surface-container-low">
                <div>
                  <span className="font-medium text-on-surface">{c.name_ar}</span>
                  <span className="text-sm mr-2 text-on-surface-variant">{c.name_en}</span>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => startEditCategory(c)}
                    className="md3-btn md3-btn--text text-xs">تعديل</button>
                  <button onClick={() => deleteCategory(c.id)}
                    className="md3-btn md3-btn--text text-error">حذف</button>
                </div>
              </div>
            ))}
          </div>

          <Modal open={catModal} onClose={() => setCatModal(false)} title="إضافة تصنيف">
            <div className="space-y-3">
              <input placeholder="الاسم (عربي)" value={catForm.name_ar}
                onChange={e => setCatForm({ ...catForm, name_ar: e.target.value })}
                className="md3-field" />
              <input placeholder="English name" value={catForm.name_en}
                onChange={e => setCatForm({ ...catForm, name_en: e.target.value })}
                className="md3-field" />
              <button onClick={saveCategory}
                className="w-full md3-btn md3-btn--filled">حفظ</button>
            </div>
          </Modal>

          <Modal open={editCatModal} onClose={() => setEditCatModal(false)} title="تعديل تصنيف">
            <div className="space-y-3">
              <input placeholder="الاسم (عربي)" value={editCatForm.name_ar}
                onChange={e => setEditCatForm({ ...editCatForm, name_ar: e.target.value })}
                className="md3-field" />
              <input placeholder="English name" value={editCatForm.name_en}
                onChange={e => setEditCatForm({ ...editCatForm, name_en: e.target.value })}
                className="md3-field" />
              <button onClick={saveEditCategory}
                className="w-full md3-btn md3-btn--filled">حفظ التعديلات</button>
            </div>
          </Modal>
        </div>
      )}

      {/* Payment methods */}
      {tab === 'payments' && (
        <div className="md3-card md3-card--outlined p-5 space-y-4">
          <div className="p-3 rounded-md3-md bg-surface-container-low">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <p className="font-medium text-sm text-on-surface">⏳ مدة الحجز قبل الدفع</p>
                <p className="text-xs mt-1 text-on-surface-variant">
                  الحجز غير المدفوع (بانتظار الدفع) يُلغى تلقائياً بعد هذه المدة، ويصبح بإمكان الطالب الحجز من جديد. الطلبات قيد المراجعة لا تُلغى تلقائياً.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <input type="number" min={1} max={720} value={bookingHours}
                  onChange={e => setBookingHours(Number(e.target.value))}
                  className="md3-field !w-24 text-center tabular-nums" />
                <span className="text-xs text-on-surface-variant">ساعة</span>
                <button onClick={saveBookingWindow} disabled={bookingSaving}
                  className="md3-btn md3-btn--filled">
                  {bookingSaving ? 'جارٍ الحفظ...' : 'حفظ'}
                </button>
              </div>
            </div>
          </div>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <h2 className="text-base font-semibold text-on-surface">💳 طرق الدفع</h2>
              <p className="text-sm mt-1 text-on-surface-variant">
                الطرق التي يراها الطالب عند الدفع مع رقم التحويل والتعليمات. الطريقة الرقمية بلا رقم لا تظهر للطلاب.
              </p>
            </div>
            <div className="flex gap-2">
              <button onClick={loadPaymentMethods} disabled={paymentsLoading}
                className="md3-btn md3-btn--outlined">
                {paymentsLoading ? 'جاري التحديث...' : '🔄 تحديث'}
              </button>
              <button onClick={openAddPayment}
                className="md3-btn md3-btn--filled">+ إضافة طريقة</button>
            </div>
          </div>

          {paymentMethods.length === 0 && !paymentsLoading && (
            <div className="text-center py-10 rounded-md3-md bg-surface-container-low">
              <p className="text-3xl mb-2">💳</p>
              <p className="text-sm text-on-surface-variant">لا توجد طرق دفع بعد. أضف أول طريقة ليستخدمها الطلاب.</p>
            </div>
          )}

          <div className="space-y-2">
            {paymentMethods.map((method: any, index: number) => (
              <div key={method.id} className="p-3 rounded-md3-md space-y-2 bg-surface-container-low">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-xl">{method.kind === 'cash' ? '🏦' : '💳'}</span>
                    <div className="min-w-0">
                      <p className="font-medium truncate text-on-surface">
                        {method.label}
                        <span className="text-xs mx-2 px-2 py-0.5 rounded-lg bg-surface-container-highest text-on-surface-variant">
                          {method.kind === 'cash' ? 'كاش' : 'تحويل'} · {method.key}
                        </span>
                      </p>
                      <p className="text-xs mt-0.5 text-on-surface-variant">
                        {method.account_number
                          ? `رقم التحويل: ${method.account_number}${method.account_name ? ` — ${method.account_name}` : ''}`
                          : method.kind === 'cash'
                            ? 'الدفع في خزنة المعهد — لا يحتاج رقم تحويل'
                            : '⚠️ بلا رقم تحويل — لا تظهر للطلاب حتى يُضاف الرقم'}
                        {method.orders_count > 0 ? ` • مستخدمة في ${method.orders_count} طلب` : ''}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-xs px-2 py-1 rounded-lg ${method.is_active ? 'bg-success-container text-on-success-container' : 'bg-surface-container-highest text-on-surface-variant'}`}>
                      {method.is_active ? 'مفعّلة' : 'معطّلة'}
                    </span>
                    <button onClick={() => movePayment(index, -1)} disabled={index === 0}
                      className="md3-btn md3-btn--icon text-xs" title="تحريك لأعلى">▲</button>
                    <button onClick={() => movePayment(index, 1)} disabled={index === paymentMethods.length - 1}
                      className="md3-btn md3-btn--icon text-xs" title="تحريك لأسفل">▼</button>
                    <button onClick={() => startEditPayment(method)}
                      className="md3-btn md3-btn--text text-xs">تعديل</button>
                    <button onClick={() => togglePaymentActive(method)}
                      className="md3-btn md3-btn--outlined text-xs">
                      {method.is_active ? 'تعطيل' : 'تفعيل'}
                    </button>
                    <button onClick={() => deletePayment(method)} className="md3-btn md3-btn--text text-error">حذف</button>
                  </div>
                </div>
                {method.account_number && (
                  <div className="flex items-center gap-2">
                    <code dir="ltr" className="text-xs px-2 py-1 rounded-md3-sm bg-surface-container-highest text-on-surface tabular-nums">
                      {method.account_number}
                    </code>
                    <button onClick={() => copyAccountNumber(method.account_number)}
                      className="md3-btn md3-btn--text text-xs">نسخ</button>
                  </div>
                )}
                {method.instructions && (
                  <p className="text-xs whitespace-pre-line text-on-surface-variant">{method.instructions}</p>
                )}
              </div>
            ))}
          </div>

          <p className="text-xs p-3 rounded-md3-md bg-surface-container-low text-on-surface-variant">
            ℹ️ الطريقة المستخدمة في طلبات سابقة لا تُحذف نهائياً — تُعطَّل فقط ويبقى سجل الطلبات سليماً.
          </p>

          <Modal open={paymentModal} onClose={() => { setPaymentModal(false); setPaymentId(null); }} title={paymentId ? 'تعديل طريقة الدفع' : 'إضافة طريقة دفع'}>
            <div className="space-y-3">
              <div>
                <label className="block text-sm mb-1 text-on-surface-variant">الاسم المعروض *</label>
                <input placeholder="مثال: محفظة إلكترونية" value={paymentForm.label}
                  onChange={e => setPaymentForm({ ...paymentForm, label: e.target.value })}
                  className="md3-field" />
              </div>
              <div>
                <label className="block text-sm mb-1 text-on-surface-variant">المفتاح (إنجليزي) *</label>
                <input dir="ltr" placeholder="wallet" value={paymentForm.key}
                  onChange={e => setPaymentForm({ ...paymentForm, key: e.target.value.toLowerCase() })}
                  disabled={paymentId !== null && Number(paymentMethods.find((m: any) => m.id === paymentId)?.orders_count) > 0}
                  className="md3-field" />
                <p className="text-xs mt-1 text-on-surface-variant">
                  يُخزَّن في الطلبات، ولا يُغيَّر بعد استخدامه في أي طلب.
                </p>
              </div>
              <div>
                <label className="block text-sm mb-1 text-on-surface-variant">النوع</label>
                <select value={paymentForm.kind} onChange={e => setPaymentForm({ ...paymentForm, kind: e.target.value })}
                  className="md3-field">
                  <option value="digital">تحويل رقمي (يحتاج إيصال)</option>
                  <option value="cash">كاش في الخزنة</option>
                </select>
              </div>
              <div>
                <label className="block text-sm mb-1 text-on-surface-variant">رقم التحويل / الحساب</label>
                <input dir="ltr" placeholder="010xxxxxxxx" value={paymentForm.account_number}
                  onChange={e => setPaymentForm({ ...paymentForm, account_number: e.target.value })}
                  className="md3-field" />
                <p className="text-xs mt-1 text-on-surface-variant">
                  الطريقة الرقمية بلا رقم لا تظهر للطلاب حتى تضيفه.
                </p>
              </div>
              <div>
                <label className="block text-sm mb-1 text-on-surface-variant">اسم الحساب (اختياري)</label>
                <input placeholder="مثال: وحدة التدريب والتطوير" value={paymentForm.account_name}
                  onChange={e => setPaymentForm({ ...paymentForm, account_name: e.target.value })}
                  className="md3-field" />
              </div>
              <div>
                <label className="block text-sm mb-1 text-on-surface-variant">تعليمات تظهر للطالب</label>
                <textarea placeholder="حوّل المبلغ ثم ارفع صورة الإيصال..." value={paymentForm.instructions}
                  onChange={e => setPaymentForm({ ...paymentForm, instructions: e.target.value })}
                  className="md3-field" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm mb-1 text-on-surface-variant">الترتيب</label>
                  <input type="number" min="0" value={paymentForm.sort_order}
                    onChange={e => setPaymentForm({ ...paymentForm, sort_order: Number(e.target.value) })}
                    className="md3-field" />
                </div>
                <div>
                  <label className="block text-sm mb-1 text-on-surface-variant">الحالة</label>
                  <select value={paymentForm.is_active} onChange={e => setPaymentForm({ ...paymentForm, is_active: Number(e.target.value) })}
                    className="md3-field">
                    <option value={1}>مفعّلة</option>
                    <option value={0}>معطّلة</option>
                  </select>
                </div>
              </div>
              <button onClick={savePayment} disabled={paymentSaving}
                className="w-full md3-btn md3-btn--filled">
                {paymentSaving ? 'جاري الحفظ...' : 'حفظ'}
              </button>
            </div>
          </Modal>
        </div>
      )}

      {/* Places (rooms) */}
      {tab === 'places' && (
        <div className="md3-card md3-card--outlined p-5 space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <h2 className="text-base font-semibold text-on-surface">📍 الأماكن (القاعات)</h2>
              <p className="text-sm mt-1 text-on-surface-variant">أضف أماكن التدريب وحدد سعتها. تُستخدم الأماكن في المجموعات الأوفلاين فقط، والسعة حد أقصى صارم للتسكين.</p>
            </div>
            <div className="flex gap-2">
              <button onClick={loadPlaces} disabled={placesLoading}
                className="md3-btn md3-btn--outlined">
                {placesLoading ? 'جاري التحديث...' : '🔄 تحديث'}
              </button>
              <button onClick={openAddPlace}
                className="md3-btn md3-btn--filled">+ إضافة مكان</button>
            </div>
          </div>

          {places.length === 0 && !placesLoading && (
            <div className="text-center py-10 rounded-md3-md bg-surface-container-low">
              <p className="text-3xl mb-2">🏫</p>
              <p className="text-sm text-on-surface-variant">لا توجد أماكن بعد. أضف أول مكان لتبدأ ربط المجموعات الأوفلاين به.</p>
            </div>
          )}

          <div className="space-y-2">
            {places.map((place: any) => (
              <div key={place.id} className="flex items-center justify-between gap-3 p-3 rounded-md3-md flex-wrap bg-surface-container-low">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-xl">📍</span>
                  <div className="min-w-0">
                    <p className="font-medium truncate text-on-surface">{place.name}</p>
                    <p className="text-xs mt-0.5 text-on-surface-variant">
                      السعة: {place.capacity} طالب
                      {place.groups_count > 0 ? ` • مستخدم في ${place.groups_count} مجموعة` : ' • غير مستخدم'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-2 py-1 rounded-lg ${place.is_active ? 'bg-success-container text-on-success-container' : 'bg-surface-container-highest text-on-surface-variant'}`}>
                    {place.is_active ? 'مفعّل' : 'معطّل'}
                  </span>
                  <button onClick={() => startEditPlace(place)}
                    className="md3-btn md3-btn--text text-xs">تعديل</button>
                  <button onClick={() => togglePlaceActive(place)}
                    className="md3-btn md3-btn--outlined text-xs">
                    {place.is_active ? 'تعطيل' : 'تفعيل'}
                  </button>
                  <button onClick={() => deletePlace(place)}
                    className="md3-btn md3-btn--text text-error">حذف</button>
                </div>
              </div>
            ))}
          </div>

          <p className="text-xs p-3 rounded-md3-md bg-surface-container-low text-on-surface-variant">
            ℹ️ المكان المستخدم في مجموعات سابقة لا يُحذف نهائياً — يُعطَّل فقط ليختفي من قائمة المجموعات الجديدة ويبقى في المجموعات القديمة.
          </p>

          <Modal open={placeModal} onClose={() => { setPlaceModal(false); setPlaceId(null); }} title={placeId ? 'تعديل المكان' : 'إضافة مكان جديد'}>
            <div className="space-y-3">
              <div>
                <label className="block text-sm mb-1 text-on-surface-variant">اسم المكان</label>
                <input placeholder="مثال: قاعة التدريب الكبرى" value={placeForm.name}
                  onChange={e => setPlaceForm({ ...placeForm, name: e.target.value })}
                  className="md3-field" />
              </div>
              <div>
                <label className="block text-sm mb-1 text-on-surface-variant">الحد الأقصى للعدد (السعة)</label>
                <input type="number" min="1" inputMode="numeric" placeholder="مثال: 30" value={placeForm.capacity}
                  onChange={e => setPlaceForm({ ...placeForm, capacity: e.target.value })}
                  className="md3-field" />
              </div>
              <button onClick={savePlace} disabled={placeSaving}
                className="w-full md3-btn md3-btn--filled">
                {placeSaving ? 'جاري الحفظ...' : 'حفظ'}
              </button>
            </div>
          </Modal>
        </div>
      )}

      {/* Auto-Group Threshold */}
      {tab === 'autogroup' && (
        <div className="md3-card md3-card--outlined p-5 space-y-4">
          <h2 className="text-base font-semibold text-on-surface">التجميع التلقائي</h2>
          <p className="text-sm text-on-surface-variant">عند تأكيد دفع الطالب، يتم وضعه تلقائياً في مجموعة. هنا يمكنك تحديد الحد الأدنى لعدد الطلاب لكل مجموعة قبل إنشاء مجموعة جديدة.</p>
          <div>
            <label className="block text-sm mb-1 text-on-surface-variant">الحد الأقصى للطلاب في كل مجموعة</label>
            <input type="number" min="1" value={threshold}
              onChange={e => setThreshold(Number(e.target.value))}
              className="md3-field" />
          </div>
          <button onClick={saveThreshold} disabled={thresholdSaving}
            className="md3-btn md3-btn--filled">
            {thresholdSaving ? 'جاري الحفظ...' : 'حفظ الإعدادات'}
          </button>
        </div>
      )}

      {/* Notification Settings */}
      {tab === 'notification' && (
        <div className="space-y-4">
          {/* SMTP Settings */}
          <div className="md3-card md3-card--outlined p-5 space-y-4">
            <div>
              <h2 className="text-base font-semibold text-on-surface">📧 إعدادات البريد الإلكتروني (SMTP)</h2>
              <p className="text-sm mt-1 text-on-surface-variant">إعدادات الخادم لإرسال الإشعارات والرموز عبر البريد الإلكتروني.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm mb-1 text-on-surface-variant">اسم المستخدم (البريد)</label>
                <input value={notifForm.smtpUser} onChange={e => setNotifForm(p => ({ ...p, smtpUser: e.target.value }))}
                  placeholder="your-email@gmail.com"
                  className="md3-field" />
              </div>
              <div>
                <label className="block text-sm mb-1 text-on-surface-variant">كلمة المرور (App Password)</label>
                <input type="password" value={notifForm.smtpPass} onChange={e => setNotifForm(p => ({ ...p, smtpPass: e.target.value }))}
                  placeholder="••••••••••"
                  className="md3-field" />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm mb-1 text-on-surface-variant">الاسم المعروض (From)</label>
                <input value={notifForm.smtpFrom} onChange={e => setNotifForm(p => ({ ...p, smtpFrom: e.target.value }))}
                  placeholder="&quot;وحدة التدريب و التطوير&quot; &lt;your-email@gmail.com&gt;"
                  className="md3-field" />
              </div>
            </div>
            <div className="flex items-center gap-3 pt-2">
              <button onClick={saveNotification} disabled={notifSaving}
                className="md3-btn md3-btn--filled">
                {notifSaving ? 'جاري الحفظ...' : '💾 حفظ الإعدادات'}
              </button>
              <button onClick={testEmail} disabled={notifTesting === 'email'}
                className="md3-btn md3-btn--outlined">
                {notifTesting === 'email' ? 'جاري الإرسال...' : '📧 اختبار الإيميل'}
              </button>
            </div>
            <div className="p-3 rounded-md3-md text-xs bg-surface-container-low text-on-surface-variant">
              <p><strong>للحصول على App Password (Gmail):</strong></p>
              <ul className="mt-1 space-y-1 list-disc list-inside">
                <li>افتح حساب Google → Security → 2-Step Verification (فعّلها)</li>
                <li>ثم Security → App passwords → أنشئ كلمة مرور جديدة</li>
                <li>انسخ الكود (16 حرف) وضعه في حقل كلمة المرور</li>
              </ul>
            </div>
          </div>

          {/* Telegram Settings */}
          <div className="md3-card md3-card--outlined p-5 space-y-4">
            <div>
              <h2 className="text-base font-semibold text-on-surface">📱 إعدادات تيليجرام (Telegram Bot)</h2>
              <p className="text-sm mt-1 text-on-surface-variant">إعدادات بوت تيليجرام لإرسال الإشعارات والرموز. أنشئ بوت عبر @BotFather على تيليجرام.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm mb-1 text-on-surface-variant">Bot Token</label>
                <input type="password" value={notifForm.telegramBotToken} onChange={e => setNotifForm(p => ({ ...p, telegramBotToken: e.target.value }))}
                  placeholder="1234567890:ABCdefGHIjklMNOpqrSTUvwxYZ"
                  className="md3-field" />
              </div>
              <div>
                <label className="block text-sm mb-1 text-on-surface-variant">Bot Username</label>
                <input value={notifForm.telegramBotUsername} onChange={e => setNotifForm(p => ({ ...p, telegramBotUsername: e.target.value }))}
                  placeholder="MyBot_username"
                  className="md3-field" />
              </div>
            </div>
            <div className="flex items-center gap-3 pt-2">
              <button onClick={saveNotification} disabled={notifSaving}
                className="md3-btn md3-btn--filled">
                {notifSaving ? 'جاري الحفظ...' : '💾 حفظ الإعدادات'}
              </button>
              <button onClick={testTelegram} disabled={notifTesting === 'telegram'}
                className="md3-btn md3-btn--outlined">
                {notifTesting === 'telegram' ? 'جاري الفحص...' : '📱 اختبار تيليجرام'}
              </button>
            </div>
            <div className="p-3 rounded-md3-md text-xs bg-surface-container-low text-on-surface-variant">
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
          <div className="md3-card md3-card--outlined p-5 space-y-4">
            <div>
              <h2 className="text-base font-semibold text-on-surface">🎓 إعدادات الإصدار التلقائي</h2>
              <p className="text-sm mt-1 text-on-surface-variant">تحكم في شروط إصدار الشهادات التلقائية عند اكتمال المجموعة.</p>
            </div>

            <div className="space-y-4">
              {/* Auto Issue Toggle */}
              <div className="flex items-center justify-between p-4 rounded-md3-md bg-surface-container-low">
                <div>
                  <p className="font-medium text-sm text-on-surface">الإصدار التلقائي</p>
                  <p className="text-xs text-on-surface-variant">إصدار شهادة تلقائياً عند اكتمال جميع المحاضرات في المجموعة</p>
                </div>
                <button onClick={() => setCertSettings(p => ({ ...p, autoIssue: !p.autoIssue }))}
                  type="button" role="switch" aria-checked={certSettings.autoIssue} aria-label="الإصدار التلقائي"
                  className="inline-flex items-center justify-center min-h-[40px] min-w-[56px] shrink-0">
                  <span className={`relative inline-block w-12 h-6 rounded-full transition-colors ${certSettings.autoIssue ? 'bg-primary' : 'bg-outline-variant'}`}>
                    <span
                      className="absolute top-0.5 w-5 h-5 bg-surface-container-lowest rounded-full shadow transition-all"
                      style={{ insetInlineStart: certSettings.autoIssue ? '26px' : '2px' }}
                    />
                  </span>
                </button>
              </div>

              {/* Require Attendance Toggle */}
              <div className="flex items-center justify-between p-4 rounded-md3-md bg-surface-container-low">
                <div>
                  <p className="font-medium text-sm text-on-surface">الحضور الشخصي مطلوب</p>
                  <p className="text-xs text-on-surface-variant">اشتراط حضور الطالب شخصياً (بالـ QR) للحصول على الشهادة</p>
                </div>
                <button onClick={() => setCertSettings(p => ({ ...p, requireAttendance: !p.requireAttendance }))}
                  type="button" role="switch" aria-checked={certSettings.requireAttendance} aria-label="الحضور الشخصي مطلوب"
                  className="inline-flex items-center justify-center min-h-[40px] min-w-[56px] shrink-0">
                  <span className={`relative inline-block w-12 h-6 rounded-full transition-colors ${certSettings.requireAttendance ? 'bg-primary' : 'bg-outline-variant'}`}>
                    <span
                      className="absolute top-0.5 w-5 h-5 bg-surface-container-lowest rounded-full shadow transition-all"
                      style={{ insetInlineStart: certSettings.requireAttendance ? '26px' : '2px' }}
                    />
                  </span>
                </button>
              </div>

              {/* Min Attendance Percentage */}
              {certSettings.requireAttendance && (
                <div className="p-4 rounded-md3-md bg-surface-container-low">
                  <label className="block text-sm font-medium mb-2 text-on-surface">
                    الحد الأدنى لنسبة الحضور الشخصي
                  </label>
                  <div className="flex items-center gap-3">
                    <input type="range" min="0" max="100" step="5"
                      value={certSettings.minAttendancePercent}
                      onChange={e => setCertSettings(p => ({ ...p, minAttendancePercent: Number(e.target.value) }))}
                      className="flex-1 h-2 rounded-full appearance-none cursor-pointer"
                      style={{ backgroundColor: 'var(--md-sys-color-outline-variant)', accentColor: 'var(--md-sys-color-primary)' }} />
                    <span className="text-lg font-bold min-w-[50px] text-center text-primary">
                      {certSettings.minAttendancePercent}%
                    </span>
                  </div>
                  <p className="text-xs mt-1 text-on-surface-variant">
                    الطالب لازم يكون حضر على الأقل {certSettings.minAttendancePercent}% من المحاضرات شخصياً
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Certificate Design Settings */}
          <div className="md3-card md3-card--outlined p-5 space-y-4">
            <div>
              <h2 className="text-base font-semibold text-on-surface">🎨 تصميم الشهادة</h2>
              <p className="text-sm mt-1 text-on-surface-variant">تخصيص النصوص والتوقيعات التي تظهر في الشهادة.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm mb-1 text-on-surface-variant">عنوان الشهادة (عربي)</label>
                <input value={certSettings.certificateTitle}
                  onChange={e => setCertSettings(p => ({ ...p, certificateTitle: e.target.value }))}
                  className="md3-field" />
              </div>
              <div>
                <label className="block text-sm mb-1 text-on-surface-variant">عنوان الشهادة (إنجليزي)</label>
                <input value={certSettings.certificateTitleEn}
                  onChange={e => setCertSettings(p => ({ ...p, certificateTitleEn: e.target.value }))}
                  className="md3-field" />
              </div>
              <div>
                <label className="block text-sm mb-1 text-on-surface-variant">اسم المدير (للتوقيع)</label>
                <input value={certSettings.directorName}
                  onChange={e => setCertSettings(p => ({ ...p, directorName: e.target.value }))}
                  placeholder="أحمد حسن"
                  className="md3-field" />
              </div>
              <div>
                <label className="block text-sm mb-1 text-on-surface-variant">منصب المدير</label>
                <input value={certSettings.directorTitle}
                  onChange={e => setCertSettings(p => ({ ...p, directorTitle: e.target.value }))}
                  className="md3-field" />
              </div>
            </div>

            <div>
              <label className="block text-sm mb-1 text-on-surface-variant">نص التذييل القانوني</label>
              <textarea value={certSettings.footerText}
                onChange={e => setCertSettings(p => ({ ...p, footerText: e.target.value }))}
                className="md3-field" />
            </div>

            <button onClick={saveCertificateSettings} disabled={certSaving}
              className="md3-btn md3-btn--filled">
              {certSaving ? 'جاري الحفظ...' : '💾 حفظ الإعدادات'}
            </button>
          </div>

          {/* Info Box */}
          <div className="md3-card md3-card--outlined p-4">
            <div className="p-4 rounded-md3-md text-sm bg-surface-container-low text-on-surface-variant">
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
          <div className="md3-card md3-card--outlined p-5 space-y-4">
            <div>
              <h2 className="text-base font-semibold text-on-surface">⭐ إعدادات استبيان الطالب</h2>
              <p className="text-sm mt-1 text-on-surface-variant">
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
                  <label className="block text-sm mb-1 text-on-surface-variant">مدة فتح الاستبيان (أيام)</label>
                  <input type="number" min={1} max={365} value={surveySettings.openDays}
                    onChange={e => setSurveySettings(p => ({ ...p, openDays: Number(e.target.value) }))}
                    className="md3-field" />
                  <p className="text-xs mt-1 text-on-surface-variant">يُغلق تلقائياً بعدها — يمكن للأدمن تمديدها لكل مجموعة.</p>
                </div>
                <div>
                  <label className="block text-sm mb-1 text-on-surface-variant">التذكير الأول بعد (أيام)</label>
                  <input type="number" min={0} max={60} value={surveySettings.reminder1Days}
                    onChange={e => setSurveySettings(p => ({ ...p, reminder1Days: Number(e.target.value) }))}
                    className="md3-field" />
                  <p className="text-xs mt-1 text-on-surface-variant">يُرسل لغير المجيبين فقط.</p>
                </div>
                <div>
                  <label className="block text-sm mb-1 text-on-surface-variant">التذكير الثاني بعد (أيام)</label>
                  <input type="number" min={1} max={120} value={surveySettings.reminder2Days}
                    onChange={e => setSurveySettings(p => ({ ...p, reminder2Days: Number(e.target.value) }))}
                    className="md3-field" />
                  <p className="text-xs mt-1 text-on-surface-variant">لا يُرسل أي تذكير بعد التذكير الثاني.</p>
                </div>
              </div>
            )}

            <button onClick={saveSurveySettings} disabled={surveySaving || surveyLoading}
              className="md3-btn md3-btn--filled">
              {surveySaving ? 'جاري الحفظ...' : '💾 حفظ الإعدادات'}
            </button>
          </div>

          <div className="md3-card md3-card--outlined p-4">
            <div className="p-4 rounded-md3-md text-sm space-y-1 bg-surface-container-low text-on-surface-variant">
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
          <div className="md3-card md3-card--outlined p-5 space-y-4">
            <div>
              <h2 className="text-base font-semibold text-on-surface">📣 إعلانات الكورسات الجديدة</h2>
              <p className="text-sm mt-1 text-on-surface-variant">
                الإعلان يُبنى تلقائياً من بيانات الكورس، ويمكن إرساله يدوياً من صفحة أي كورس بعد مراجعته.
              </p>
            </div>

            {announcementLoading ? (
              <div className="flex justify-center py-6">
                <div className="animate-spin h-6 w-6 border-4 rounded-full" style={{ borderColor: 'var(--primary)', borderTopColor: 'transparent' }} />
              </div>
            ) : (
              <label className="flex items-start gap-3 p-4 rounded-md3-md cursor-pointer bg-surface-container-low">
                <input
                  type="checkbox"
                  checked={announcementSettings.autoEnabled}
                  onChange={e => setAnnouncementSettings(prev => ({ ...prev, autoEnabled: e.target.checked }))}
                  className="mt-1"
                />
                <span>
                  <span className="block text-sm font-medium text-on-surface">
                    إرسال تلقائي عند نشر الكورس
                  </span>
                  <span className="block text-xs mt-1 text-on-surface-variant">
                    يُرسل مرة واحدة فقط لكل كورس عند تفعيله وفتحه للتسجيل — لا عند حفظه كمسودة. الزر اليدوي يبقى متاحاً دائماً.
                  </span>
                </span>
              </label>
            )}

            <button onClick={saveAnnouncementSettings} disabled={announcementSaving || announcementLoading}
              className="md3-btn md3-btn--filled">
              {announcementSaving ? 'جاري الحفظ...' : '💾 حفظ الإعدادات'}
            </button>
          </div>

          <div className="md3-card md3-card--outlined p-4">
            <div className="p-4 rounded-md3-md text-sm space-y-1 bg-surface-container-low text-on-surface-variant">
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
          <div className="md3-card md3-card--outlined p-5 space-y-4">
            <div>
              <h2 className="text-base font-semibold text-on-surface">📄 إعدادات تقرير المجموعة</h2>
              <p className="text-sm mt-1 text-on-surface-variant">
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
                    <label className="block text-sm mb-1 text-on-surface-variant">اسم منسق الدورة</label>
                    <input value={reportSettings.coordinatorName}
                      onChange={e => setReportSettings({ ...reportSettings, coordinatorName: e.target.value })}
                      maxLength={200}
                      className="md3-field" />
                  </div>
                  <div>
                    <label className="block text-sm mb-1 text-on-surface-variant">منسق/منظم/رعاة الدورة</label>
                    <input value={reportSettings.organizerText}
                      onChange={e => setReportSettings({ ...reportSettings, organizerText: e.target.value })}
                      maxLength={300}
                      className="md3-field" />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm mb-1 text-on-surface-variant">نوع النشاط الافتراضي</label>
                    <input value={reportSettings.defaultActivityType}
                      onChange={e => setReportSettings({ ...reportSettings, defaultActivityType: e.target.value })}
                      maxLength={300}
                      className="md3-field" />
                  </div>
                </div>

                <div>
                  <label className="block text-sm mb-1 text-on-surface-variant">نص الشهادات (القسم السابع)</label>
                  <textarea value={reportSettings.certificateText}
                    onChange={e => setReportSettings({ ...reportSettings, certificateText: e.target.value })}
                    rows={3} maxLength={2000}
                    className="md3-field" />
                </div>

                <div>
                  <label className="block text-sm mb-1 text-on-surface-variant">نص الملاحظات العامة الافتراضي (القسم الثامن)</label>
                  <textarea value={reportSettings.defaultNotes}
                    onChange={e => setReportSettings({ ...reportSettings, defaultNotes: e.target.value })}
                    rows={3} maxLength={4000}
                    className="md3-field" />
                </div>

                <div>
                  <label className="block text-sm mb-1 text-on-surface-variant">نص التوصيات الافتراضي (القسم التاسع)</label>
                  <textarea value={reportSettings.defaultRecommendations}
                    onChange={e => setReportSettings({ ...reportSettings, defaultRecommendations: e.target.value })}
                    rows={3} maxLength={4000}
                    className="md3-field" />
                </div>

                <button onClick={saveReportSettings} disabled={reportSaving}
                  className="md3-btn md3-btn--filled">
                  {reportSaving ? 'جاري الحفظ...' : '💾 حفظ الإعدادات'}
                </button>
              </>
            )}
          </div>

          <div className="md3-card md3-card--outlined p-4">
            <div className="p-4 rounded-md3-md text-sm space-y-1 bg-surface-container-low text-on-surface-variant">
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
      {/* Mobile app version + update broadcast */}
      {tab === 'appversion' && (
        <div className="md3-card md3-card--outlined p-5 space-y-4">
          <div>
            <h2 className="text-base font-semibold text-on-surface">📱 إصدار تطبيق الهاتف</h2>
            <p className="text-sm mt-1 text-on-surface-variant">
              عند حفظ رقم إصدار (build) أحدث يُرسَل إشعار التحديث تلقائياً لكل مستخدمي التطبيق (طلبة ومحاضرين)، ويمكنك أيضاً إرساله يدوياً في أي وقت.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm mb-1 text-on-surface-variant">رقم الإصدار (مثل 1.0.3)</label>
              <input value={versionForm.latestVersion}
                onChange={e => setVersionForm({ ...versionForm, latestVersion: e.target.value })}
                className="md3-field" />
            </div>
            <div>
              <label className="block text-sm mb-1 text-on-surface-variant">رقم البناء (Build Number)</label>
              <input type="number" min={1} value={versionForm.buildNumber}
                onChange={e => setVersionForm({ ...versionForm, buildNumber: Number(e.target.value) })}
                className="md3-field" />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm mb-1 text-on-surface-variant">عنوان إشعار التحديث</label>
              <input value={versionForm.title}
                onChange={e => setVersionForm({ ...versionForm, title: e.target.value })}
                className="md3-field" />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm mb-1 text-on-surface-variant">نص إشعار التحديث</label>
              <textarea value={versionForm.message}
                onChange={e => setVersionForm({ ...versionForm, message: e.target.value })}
                rows={3} maxLength={500}
                className="md3-field" />
            </div>
            <div>
              <label className="block text-sm mb-1 text-on-surface-variant">رابط صفحة التنزيل</label>
              <input value={versionForm.downloadUrl}
                onChange={e => setVersionForm({ ...versionForm, downloadUrl: e.target.value })}
                className="md3-field" />
            </div>
            <div>
              <label className="block text-sm mb-1 text-on-surface-variant">رابط APK مباشر (اختياري)</label>
              <input value={versionForm.apkDirectUrl}
                onChange={e => setVersionForm({ ...versionForm, apkDirectUrl: e.target.value })}
                placeholder="اتركه فارغاً لاستخدام رابط صفحة التنزيل"
                className="md3-field" />
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm cursor-pointer text-on-surface">
            <input type="checkbox" checked={versionForm.forceUpdate}
              onChange={e => setVersionForm({ ...versionForm, forceUpdate: e.target.checked })}
              className="w-4 h-4 accent-[var(--primary)]" />
            تحديث إجباري (يمنع استخدام الإصدار الأقدم)
          </label>

          <div className="flex items-center gap-3 flex-wrap">
            <button onClick={saveAppVersion} disabled={versionSaving}
              className="md3-btn md3-btn--filled">
              {versionSaving ? 'جارٍ الحفظ...' : '💾 حفظ الإصدار'}
            </button>
            <button onClick={broadcastAppVersionNow} disabled={versionBroadcasting}
              className="md3-btn md3-btn--outlined">
              {versionBroadcasting ? 'جارٍ الإرسال...' : '📣 إشعار المستخدمين بالتحديث'}
            </button>
          </div>
        </div>
      )}

      {tab === 'ai' && (
        <div className="space-y-4">
          <div className="md3-card md3-card--outlined p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-base font-semibold text-on-surface">مزوّدات الذكاء الاصطناعي</h2>
                <p className="text-sm mt-1 text-on-surface-variant">
                  أضف مزوّداً واملأ البيانات. التغيير محلي (Draft) — اضغط "💾 حفظ" لإرسال التعديلات.
                </p>
              </div>
              <div className="flex gap-2">
                <button onClick={resetAll} disabled={!isDirty}
                  className="md3-btn md3-btn--outlined">
                  ↩ تراجع
                </button>
                <button onClick={saveAll} disabled={!isDirty || savingAi}
                  className={`md3-btn ${isDirty ? 'md3-btn--filled' : 'md3-btn--outlined'}`}>
                  {savingAi ? 'جاري...' : '💾 حفظ'}
                </button>
                <button onClick={openAddModal}
                  className="md3-btn md3-btn--filled whitespace-nowrap">+ إضافة مزوّد</button>
              </div>
            </div>

            {isDirty && (
              <div className="px-3 py-2 mb-3 rounded-md3-sm text-sm" style={{ backgroundColor: 'var(--md-sys-color-warning-container)', color: 'var(--md-sys-color-on-warning-container)' }}>
                ⚠ توجد تغييرات غير محفوظة. اضغط "💾 حفظ" لتطبيقها.
              </div>
            )}

            {providers.length === 0 && (
              <p className="text-sm py-6 text-center text-on-surface-variant">لا توجد مزوّدات — اضغط "+ إضافة مزوّد"</p>
            )}

            <div className="space-y-3">
              {providers.map((p, i) => (
                <div key={p.id} className="rounded-md3-md p-4 transition-colors border"
                  style={{
                    backgroundColor: p.enabled ? 'var(--md-sys-color-surface-container-low)' : 'var(--md-sys-color-surface-container)',
                    borderColor: p.enabled ? 'var(--md-sys-color-primary)' : 'var(--md-sys-color-outline-variant)',
                  }}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <button onClick={() => toggleDraft(p.id)}
                        type="button" role="switch" aria-checked={p.enabled} aria-label={`تفعيل ${p.name}`}
                        className="inline-flex items-center justify-center min-h-[40px] min-w-[48px] shrink-0">
                        <span className={`relative inline-block w-10 h-6 rounded-full transition-colors ${p.enabled ? 'bg-primary' : 'bg-outline-variant'}`}>
                          <span
                            className="absolute top-0.5 w-5 h-5 bg-surface-container-lowest rounded-full shadow transition-all"
                            style={{ insetInlineStart: p.enabled ? '18px' : '2px' }}
                          />
                        </span>
                      </button>
                      <div>
                        <span className="text-sm font-semibold text-on-surface">
                          {p.type === 'gemini' ? '🧠' : p.type === 'openai' ? '🔵' : p.type === 'anthropic' ? '🟢' : '⚙'} {p.name}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => moveDraft(i, -1)} disabled={i === 0}
                        type="button" aria-label="تحريك لأعلى"
                        className="md3-btn md3-btn--icon text-xs">↑</button>
                      <button onClick={() => moveDraft(i, 1)} disabled={i === providers.length - 1}
                        type="button" aria-label="تحريك لأسفل"
                        className="md3-btn md3-btn--icon text-xs">↓</button>
                      <button onClick={() => removeDraft(p.id)}
                        type="button" aria-label={`حذف ${p.name}`}
                        className="md3-btn md3-btn--icon text-xs text-error">🗑</button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm mb-1 text-on-surface-variant">API Key</label>
                      <input type="password" value={p.apiKey}
                        onChange={e => updateDraft(p.id, 'apiKey', e.target.value)}
                        placeholder={PROVIDER_DEFAULTS[p.type as keyof typeof PROVIDER_DEFAULTS]?.placeholder || '...'}
                        className="md3-field w-full font-mono ltr"
                        onFocus={e => e.target.type = 'text'}
                        onBlur={e => { e.target.type = 'password'; if (e.target.value) fetchModelsFor({ ...providers.find(x => x.id === p.id), apiKey: e.target.value }); }} />
                    </div>
                    <div>
                      <label className="block text-sm mb-1 text-on-surface-variant">API URL</label>
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
                          className="md3-field flex-1 font-mono ltr" />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm mb-1 text-on-surface-variant">الموديل</label>
                      <div className="flex gap-1">
                        <select value={p.selectedModel}
                          onChange={e => updateDraft(p.id, 'selectedModel', e.target.value)}
                          className="md3-field flex-1">
                          {p.models?.map((m: string) => (
                            <option key={m} value={m}>{m}</option>
                          ))}
                          {(!p.models || p.models.length === 0) && (
                            <option value="">-- لا توجد موديلات --</option>
                          )}
                        </select>
                        <button onClick={() => fetchModelsFor(p)}
                          className="md3-btn md3-btn--icon"
                          aria-label="جلب الموديلات" title="جلب الموديلات">🔍</button>
                      </div>
                    </div>
                    <div className="flex items-end gap-2">
                      <button onClick={() => testProvider(p)}
                        className="md3-btn md3-btn--outlined flex-1">
                        🧪 اختبار الاتصال
                      </button>
                    </div>
                  </div>
                  {p.type === 'openai-compat' && (
                    <p className="text-xs mt-2 text-on-surface-variant">
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
            <label className="block text-sm mb-1 text-on-surface-variant">📋 لصق أمر CURL (اختياري — يكشف النوع تلقائياً)</label>
            <textarea value={addForm.curlInput}
              onChange={e => setAddForm(prev => ({ ...prev, curlInput: e.target.value }))}
              placeholder="curl 'https://generativelanguage.googleapis.com/...' -H 'X-goog-api-key: AIzaSy...'"
              className="md3-field h-20 font-mono ltr leading-relaxed resize-y" />
            <button onClick={applyCurlToForm}
              className="w-full mt-2 md3-btn md3-btn--outlined">
              🔄 تحليل CURL وتعبئة الحقول
            </button>
          </div>

          <div className="border-t border-outline-variant" />

          <div>
            <label className="block text-sm mb-1 text-on-surface-variant">نوع المزوّد</label>
            <select value={addForm.type}
              onChange={e => updateAddForm('type', e.target.value)}
              className="md3-field w-full">
              {Object.entries(PROVIDER_DEFAULTS).map(([k, v]) => (
                <option key={k} value={k}>{v.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm mb-1 text-on-surface-variant">API Key</label>
            <input type="password" value={addForm.apiKey}
              onChange={e => {
                setAddForm(prev => ({ ...prev, apiKey: e.target.value }));
                const t = detectTypeFrom(addForm.apiUrl, e.target.value);
                if (t !== addForm.type) updateAddForm('type', t);
              }}
              placeholder={PROVIDER_DEFAULTS[addForm.type as keyof typeof PROVIDER_DEFAULTS]?.placeholder || '...'}
              className="md3-field font-mono ltr"
              onFocus={e => e.target.type = 'text'}
              onBlur={e => { e.target.type = 'password'; if (e.target.value) autoFetchAddForm(addForm.type, e.target.value, addForm.apiUrl); }} />
          </div>

          <div>
            <label className="block text-sm mb-1 text-on-surface-variant">API URL</label>
            <input value={addForm.apiUrl}
              onChange={e => setAddForm(prev => ({ ...prev, apiUrl: e.target.value }))}
              className="md3-field font-mono ltr" />
          </div>

          <div>
            <label className="block text-sm mb-1 text-on-surface-variant">
              الموديل {addFetching && <span className="inline-block mr-1 text-xs">جاري الجلب...</span>}
            </label>
            <select value={addForm.selectedModel}
              onChange={e => setAddForm(prev => ({ ...prev, selectedModel: e.target.value }))}
              className="md3-field w-full">
              {addForm.models.map((m: string) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>

          <div className="flex gap-2 pt-2">
            <button onClick={confirmAddProvider}
              className="flex-1 md3-btn md3-btn--filled">إضافة</button>
            <button onClick={() => setAddModal(false)}
              className="md3-btn md3-btn--outlined">إلغاء</button>
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
      <label className="block text-sm mb-1 text-on-surface-variant">{label}</label>
      <div className="flex items-center gap-3">
        <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} className="hidden" />
        {value ? (
          <div className="relative w-14 h-14 rounded-md3-sm overflow-hidden border border-outline-variant flex-shrink-0">
            <img src={value} alt={label} className="w-full h-full object-cover" />
          </div>
        ) : (
          <div className="w-14 h-14 rounded-md3-sm border border-outline-variant flex items-center justify-center text-xs text-on-surface-variant flex-shrink-0">
            لا توجد
          </div>
        )}
        <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading}
          className="md3-btn md3-btn--tonal text-xs">
          {uploading ? 'جاري...' : 'اختيار صورة'}
        </button>
        {value && (
          <button type="button" onClick={() => onChange('')}
            className="md3-btn md3-btn--text text-error">
            حذف
          </button>
        )}
      </div>
    </div>
  );
}
