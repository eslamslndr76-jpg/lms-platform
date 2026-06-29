'use client';

import { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import Modal from '../../components/Modal';

export default function SettingsPage() {
  const [tab, setTab] = useState<'branding' | 'categories' | 'aikeys'>('branding');
  const [branding, setBranding] = useState({
    system_name: '', slogan_ar: '', slogan_en: '', primary_color: '#2563eb',
    secondary_color: '#059669', logo_header: '', logo_footer: '', favicon: '', footer_text: '',
  });
  const [categories, setCategories] = useState<any[]>([]);
  const [aiKeys, setAiKeys] = useState<string[]>([]);
  const [catModal, setCatModal] = useState(false);
  const [catForm, setCatForm] = useState({ name_ar: '', name_en: '' });
  const [keyInput, setKeyInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    Promise.all([
      api('/api/settings/branding'),
      api('/api/categories'),
      api('/api/settings/ai-keys'),
    ]).then(([b, c, k]) => {
      setBranding(b);
      setCategories(c);
      setAiKeys(k.keys || []);
    });
  }, []);

  const saveBranding = async () => {
    setSaving(true);
    await api('/api/settings/branding', { method: 'PUT', body: JSON.stringify(branding) });
    setMsg('تم حفظ الإعدادات');
    setSaving(false);
    setTimeout(() => setMsg(''), 3000);
  };

  const saveCategory = async () => {
    await api('/api/categories', {
      method: 'POST', body: JSON.stringify(catForm),
    });
    setCatModal(false);
    setCatForm({ name_ar: '', name_en: '' });
    api('/api/categories').then(setCategories);
  };

  const deleteCategory = async (id: number) => {
    if (!confirm('تأكيد الحذف؟')) return;
    await api(`/api/categories/${id}`, { method: 'DELETE' });
    api('/api/categories').then(setCategories);
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
    await api('/api/settings/ai-keys', {
      method: 'PUT', body: JSON.stringify({ keys: aiKeys }),
    });
    setMsg('تم حفظ المفاتيح');
    setSaving(false);
    setTimeout(() => setMsg(''), 3000);
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">الإعدادات</h1>

      {msg && <div className="px-4 py-3 bg-green-50 text-green-700 rounded-xl text-sm">{msg}</div>}

      <div className="flex gap-2 overflow-x-auto">
        {(['branding', 'categories', 'aikeys'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-5 py-2.5 rounded-xl text-sm whitespace-nowrap ${tab === t ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 border'}`}>
            {t === 'branding' ? 'العلامة التجارية' : t === 'categories' ? 'التصنيفات' : 'مفاتيح AI'}
          </button>
        ))}
      </div>

      {/* Branding */}
      {tab === 'branding' && (
        <div className="bg-white rounded-2xl p-6 shadow-sm space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-500 mb-1">اسم النظام</label>
              <input value={branding.system_name}
                onChange={e => setBranding({ ...branding, system_name: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm" />
            </div>
            <div>
              <label className="block text-sm text-gray-500 mb-1">شعار (عربي)</label>
              <input value={branding.slogan_ar}
                onChange={e => setBranding({ ...branding, slogan_ar: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm" />
            </div>
            <div>
              <label className="block text-sm text-gray-500 mb-1">Slogan (EN)</label>
              <input value={branding.slogan_en}
                onChange={e => setBranding({ ...branding, slogan_en: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm" />
            </div>
            <div>
              <label className="block text-sm text-gray-500 mb-1">اللون الأساسي</label>
              <input type="color" value={branding.primary_color}
                onChange={e => setBranding({ ...branding, primary_color: e.target.value })}
                className="w-full h-10 rounded-xl border border-gray-200 cursor-pointer" />
            </div>
            <div>
              <label className="block text-sm text-gray-500 mb-1">اللون الثانوي</label>
              <input type="color" value={branding.secondary_color}
                onChange={e => setBranding({ ...branding, secondary_color: e.target.value })}
                className="w-full h-10 rounded-xl border border-gray-200 cursor-pointer" />
            </div>
            <div>
              <label className="block text-sm text-gray-500 mb-1">رابط شعار Header</label>
              <input value={branding.logo_header}
                onChange={e => setBranding({ ...branding, logo_header: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm" />
            </div>
            <div>
              <label className="block text-sm text-gray-500 mb-1">رابط شعار Footer</label>
              <input value={branding.logo_footer}
                onChange={e => setBranding({ ...branding, logo_footer: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm" />
            </div>
            <div>
              <label className="block text-sm text-gray-500 mb-1">رابط Favicon</label>
              <input value={branding.favicon}
                onChange={e => setBranding({ ...branding, favicon: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm" />
            </div>
          </div>
          <div>
            <label className="block text-sm text-gray-500 mb-1">نص التذييل التلقائي (للرسائل)</label>
            <textarea value={branding.footer_text}
              onChange={e => setBranding({ ...branding, footer_text: e.target.value })}
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm h-20" />
          </div>
          <button onClick={saveBranding} disabled={saving}
            className="px-6 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-medium disabled:opacity-50">
            {saving ? 'جاري الحفظ...' : 'حفظ الإعدادات'}
          </button>

          <div className="mt-6 p-4 border rounded-2xl">
            <h3 className="font-bold text-sm mb-3">معاينة حية</h3>
            <div className="space-y-2" style={{ '--preview-primary': branding.primary_color, '--preview-secondary': branding.secondary_color } as any}>
              <div className="flex items-center gap-3 p-3" style={{ backgroundColor: branding.primary_color, borderRadius: 12 }}>
                {branding.logo_header && <img src={branding.logo_header} className="h-8 w-8 rounded-lg" alt="" />}
                <span className="text-white font-bold">{branding.system_name || 'اسم النظام'}</span>
              </div>
              <p className="text-sm">{branding.slogan_ar}</p>
            </div>
          </div>
        </div>
      )}

      {/* Categories */}
      {tab === 'categories' && (
        <div className="bg-white rounded-2xl p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-bold">التصنيفات</h2>
            <button onClick={() => setCatModal(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-xl text-sm">+ إضافة</button>
          </div>
          <div className="space-y-2">
            {categories.length === 0 && <p className="text-gray-400 text-sm">لا توجد تصنيفات</p>}
            {categories.map((c: any) => (
              <div key={c.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                <div>
                  <span className="font-medium">{c.name_ar}</span>
                  <span className="text-gray-500 text-sm mr-2">{c.name_en}</span>
                </div>
                <button onClick={() => deleteCategory(c.id)}
                  className="text-red-500 text-xs">حذف</button>
              </div>
            ))}
          </div>

          <Modal open={catModal} onClose={() => setCatModal(false)} title="إضافة تصنيف">
            <div className="space-y-3">
              <input placeholder="الاسم (عربي)" value={catForm.name_ar}
                onChange={e => setCatForm({ ...catForm, name_ar: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm" />
              <input placeholder="English name" value={catForm.name_en}
                onChange={e => setCatForm({ ...catForm, name_en: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm" />
              <button onClick={saveCategory}
                className="w-full py-3 bg-blue-600 text-white rounded-xl font-medium">حفظ</button>
            </div>
          </Modal>
        </div>
      )}

      {/* AI Keys */}
      {tab === 'aikeys' && (
        <div className="bg-white rounded-2xl p-6 shadow-sm space-y-4">
          <h2 className="font-bold">مفاتيح Gemini AI</h2>
          <p className="text-sm text-gray-500">أضف عدة مفاتيح للتبديل التلقائي عند استنفاذ الحصة</p>

          <div className="flex gap-2">
            <input value={keyInput}
              onChange={e => setKeyInput(e.target.value)}
              placeholder="أدخل مفتاح Gemini API"
              className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-sm" />
            <button onClick={addKey}
              className="px-4 py-2.5 bg-blue-600 text-white rounded-xl text-sm">إضافة</button>
          </div>

          <div className="space-y-2">
            {aiKeys.length === 0 && <p className="text-gray-400 text-sm">لا توجد مفاتيح</p>}
            {aiKeys.map((key, i) => (
              <div key={i} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                <code className="text-xs truncate ltr">{key.substring(0, 20)}...</code>
                <button onClick={() => removeKey(i)}
                  className="text-red-500 text-xs">حذف</button>
              </div>
            ))}
          </div>

          <button onClick={saveKeys} disabled={saving}
            className="px-6 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-medium disabled:opacity-50">
            {saving ? 'جاري الحفظ...' : 'حفظ المفاتيح'}
          </button>
        </div>
      )}
    </div>
  );
}
