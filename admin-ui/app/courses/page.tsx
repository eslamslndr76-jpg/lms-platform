'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '../../lib/api';
import DataTable from '../../components/DataTable';
import Modal from '../../components/Modal';

export default function CoursesPage() {
  const router = useRouter();
  const [courses, setCourses] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ title_ar: '', title_en: '', description: '', price: 0, category_id: '', max_students: 30, lecture_count: 0, total_hours: 0, instructor: '' });

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const c = await api('/api/courses');
      setCourses(c);
    } catch {
      setError('فشل تحميل الكورسات');
      setLoading(false);
      return;
    }
    try {
      const cats = await api('/api/categories');
      setCategories(cats);
    } catch {
      // categories optional
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const save = async () => {
    await api('/api/courses', {
      method: 'POST',
      body: JSON.stringify({ ...form, category_id: form.category_id ? Number(form.category_id) : null }),
    });
    setModal(false);
    load();
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin h-8 w-8 border-4 rounded-full" style={{ borderColor: 'var(--primary)', borderTopColor: 'transparent' }} /></div>;
  if (error) return <div className="flex flex-col items-center justify-center h-64 gap-4"><p style={{ color: '#dc2626' }}>{error}</p><button onClick={load} className="px-4 py-2 bg-blue-600 text-white rounded-xl text-sm">إعادة المحاولة</button></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>الكورسات</h1>
        <button onClick={() => setModal(true)} className="px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium">
          + إضافة كورس
        </button>
      </div>

      <div className="rounded-2xl p-4" style={{ backgroundColor: 'var(--card)' }}>
        <DataTable
          columns={[
            { key: 'id', label: '#' },
            { key: 'title_ar', label: 'الاسم (عربي)' },
            { key: 'title_en', label: 'English' },
            { key: 'category_name_ar', label: 'التصنيف', render: (v: string) => v || '-' },
            { key: 'price', label: 'السعر', render: (v: number) => `${v} ج.م` },
            { key: 'is_active', label: 'الحالة', render: (v: number) => v ? '🟢 نشط' : '🔴 غير نشط' },
          ]}
          data={courses}
          onRowClick={(row) => router.push(`/courses/${row.id}`)}
        />
      </div>

      <Modal open={modal} onClose={() => setModal(false)} title="إضافة كورس جديد">
        <div className="space-y-3">
          <div>
            <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>اسم الكورس بالعربية</label>
            <input placeholder="مثال: أساسيات البرمجة" value={form.title_ar}
              onChange={e => setForm({ ...form, title_ar: e.target.value })}
              className="w-full px-4 py-2.5 rounded-xl border text-sm" style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }} />
          </div>
          <div>
            <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Course name in English</label>
            <input placeholder="e.g. Programming Basics" value={form.title_en}
              onChange={e => setForm({ ...form, title_en: e.target.value })}
              className="w-full px-4 py-2.5 rounded-xl border text-sm" style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }} />
          </div>
          <div>
            <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>وصف الكورس</label>
            <textarea placeholder="ماذا سيتعلم الطالب في هذا الكورس؟ المحتوى الرئيسي والأهداف" value={form.description}
              onChange={e => setForm({ ...form, description: e.target.value })}
              className="w-full px-4 py-2.5 rounded-xl border text-sm h-20" style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }} />
          </div>
          <div>
            <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>سعر الكورس (0 = مجاني)</label>
            <input type="number" placeholder="مثال: 500" value={form.price}
              onChange={e => setForm({ ...form, price: Number(e.target.value) })}
              className="w-full px-4 py-2.5 rounded-xl border text-sm" style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }} />
          </div>
          <div>
            <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>التصنيف</label>
            <select value={form.category_id} onChange={e => setForm({ ...form, category_id: e.target.value })}
              className="w-full px-4 py-2.5 rounded-xl border text-sm" style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }}>
              <option value="">اختر تصنيف (اختياري)</option>
              {categories.map((c: any) => <option key={c.id} value={c.id}>{c.name_ar}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>عدد المحاضرات</label>
            <input type="number" placeholder="مثال: 24" value={form.lecture_count}
              onChange={e => setForm({ ...form, lecture_count: Number(e.target.value) })}
              className="w-full px-4 py-2.5 rounded-xl border text-sm" style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }} />
          </div>
          <div>
            <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>إجمالي الساعات</label>
            <input type="number" step="0.5" placeholder="مثال: 48" value={form.total_hours}
              onChange={e => setForm({ ...form, total_hours: Number(e.target.value) })}
              className="w-full px-4 py-2.5 rounded-xl border text-sm" style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }} />
          </div>
          <div>
            <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>اسم المدرب</label>
            <input placeholder="مثال: أ. محمد أحمد" value={form.instructor}
              onChange={e => setForm({ ...form, instructor: e.target.value })}
              className="w-full px-4 py-2.5 rounded-xl border text-sm" style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }} />
          </div>
          <button onClick={save} className="w-full py-3 bg-blue-600 text-white rounded-xl font-medium">حفظ</button>
        </div>
      </Modal>
    </div>
  );
}
