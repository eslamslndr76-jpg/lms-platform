'use client';

import { useState, useEffect, useRef } from 'react';
import { api } from '../../lib/api';
import Modal from '../../components/Modal';
import ErrorBoundary from '../../components/ErrorBoundary';
import { compressAndEncode } from '../../lib/imageUtils';

export default function SettingsPage() {
  const [tab, setTab] = useState<'branding' | 'categories' | 'aikeys' | 'autogroup'>('branding');
  const [branding, setBranding] = useState({
    systemName: '', sloganAr: '', sloganEn: '', primaryColor: '#2563eb',
    secondaryColor: '#059669', logoHeader: '', logoFooter: '', favicon: '', messageFooter: '',
  });
  const [categories, setCategories] = useState<any[]>([]);
  const [aiKeys, setAiKeys] = useState<string[]>([]);
  const [catModal, setCatModal] = useState(false);
  const [catForm, setCatForm] = useState({ name_ar: '', name_en: '' });
  const [editCatModal, setEditCatModal] = useState(false);
  const [editCatId, setEditCatId] = useState<number | null>(null);
  const [editCatForm, setEditCatForm] = useState({ name_ar: '', name_en: '' });
  const [keyInput, setKeyInput] = useState('');
  const [threshold, setThreshold] = useState(30);
  const [thresholdSaving, setThresholdSaving] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');

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
        const k = await api('/api/settings/ai-keys');
        if (k && typeof k === 'object' && Array.isArray(k.keys)) setAiKeys(k.keys);
      } catch {
        // ai-keys may be 403 for employees — ignore silently
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

  const addKey = () => {
    if (!keyInput.trim()) return;
    setAiKeys(prev => [...prev, keyInput.trim()]);
    setKeyInput('');
  };

  const removeKey = (idx: number) => {
    setAiKeys(prev => prev.filter((_, i) => i !== idx));
  };

  const saveKeys = async () => {
    setSaving(true);
    try {
      await api('/api/settings/ai-keys', {
        method: 'PUT', body: JSON.stringify({ keys: aiKeys }),
      });
      setMsg('تم حفظ المفاتيح');
    } catch {
      setMsg('فشل حفظ المفاتيح');
    }
    setSaving(false);
    setTimeout(() => setMsg(''), 3000);
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin h-8 w-8 border-4 rounded-full" style={{ borderColor: 'var(--primary)', borderTopColor: 'transparent' }} /></div>;
  if (error) return <div className="flex flex-col items-center justify-center h-64 gap-4"><p style={{ color: '#dc2626' }}>{error}</p><button onClick={retry} className="px-4 py-2 bg-[var(--primary)] text-white rounded-xl text-sm">إعادة المحاولة</button></div>;

  return <ErrorBoundary>
    <div className="space-y-6">
      <h1 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>الإعدادات</h1>

      {msg && <div className="px-4 py-3 rounded-xl text-sm animate-slide-up bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400">{msg}</div>}

      <div className="flex gap-2 overflow-x-auto">
        {(['branding', 'categories', 'aikeys', 'autogroup'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-5 py-2.5 rounded-xl text-sm whitespace-nowrap ${tab === t ? 'bg-[var(--primary)] text-white' : 'border'}`}
            style={tab === t ? {} : { backgroundColor: 'var(--card)', color: 'var(--text-muted)', borderColor: 'var(--border)' }}>
            {t === 'branding' ? 'العلامة التجارية' : t === 'categories' ? 'التصنيفات' : t === 'aikeys' ? 'مفاتيح AI' : 'التجميع التلقائي'}
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

      {/* AI Keys */}
      {tab === 'aikeys' && (
        <div className="rounded-2xl p-6 shadow-sm space-y-4" style={{ backgroundColor: 'var(--card)' }}>
          <h2 className="font-bold" style={{ color: 'var(--text)' }}>مفاتيح Gemini AI</h2>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>أضف عدة مفاتيح للتبديل التلقائي عند استنفاذ الحصة</p>

          <div className="flex gap-2">
            <input value={keyInput}
              onChange={e => setKeyInput(e.target.value)}
              placeholder="أدخل مفتاح Gemini API"
              className="flex-1 px-4 py-2.5 rounded-xl border text-sm" style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }} />
            <button onClick={addKey}
              className="px-4 py-2.5 bg-[var(--primary)] text-white rounded-xl text-sm">إضافة</button>
          </div>

          <div className="space-y-2">
            {aiKeys.length === 0 && <p className="text-sm" style={{ color: 'var(--text-muted)' }}>لا توجد مفاتيح</p>}
            {aiKeys.map((key, i) => (
              <div key={i} className="flex items-center justify-between p-3 rounded-xl" style={{ backgroundColor: 'var(--bg)' }}>
                <code className="text-xs truncate ltr" style={{ color: 'var(--text)' }}>{key.substring(0, 20)}...</code>
                <button onClick={() => removeKey(i)}
                  className="text-red-500 text-xs">حذف</button>
              </div>
            ))}
          </div>

          <button onClick={saveKeys} disabled={saving}
            className="px-6 py-2.5 bg-[var(--primary)] text-white rounded-xl text-sm font-medium disabled:opacity-50">
            {saving ? 'جاري الحفظ...' : 'حفظ المفاتيح'}
          </button>
        </div>
      )}
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
      const dataUrl = await compressAndEncode(file);
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
