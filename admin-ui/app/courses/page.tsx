'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '../../lib/api';
import DataTable from '../../components/DataTable';
import Modal from '../../components/Modal';
import StatusBadge from '../../components/StatusBadge';

export default function CoursesPage() {
  const router = useRouter();
  const [courses, setCourses] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ title_ar: '', title_en: '', description: '', price: 0, category_id: '', max_students: 30 });

  const load = async () => {
    setLoading(true);
    const [c, cats] = await Promise.all([
      api('/api/courses'), api('/api/categories'),
    ]);
    setCourses(c);
    setCategories(cats);
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

  const toggleActive = async (id: number, active: boolean) => {
    if (active) {
      await api(`/api/courses/${id}`, { method: 'DELETE' });
    } else {
      await api(`/api/courses/${id}`, {
        method: 'PUT', body: JSON.stringify({ is_active: 1 }),
      });
    }
    load();
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">الكورسات</h1>
        <button onClick={() => setModal(true)} className="px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium">
          + إضافة كورس
        </button>
      </div>

      <div className="bg-white rounded-2xl p-4 shadow-sm">
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
          <input placeholder="الاسم (عربي)" value={form.title_ar}
            onChange={e => setForm({ ...form, title_ar: e.target.value })}
            className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm" />
          <input placeholder="English name" value={form.title_en}
            onChange={e => setForm({ ...form, title_en: e.target.value })}
            className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm" />
          <textarea placeholder="الوصف" value={form.description}
            onChange={e => setForm({ ...form, description: e.target.value })}
            className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm h-20" />
          <input type="number" placeholder="السعر" value={form.price}
            onChange={e => setForm({ ...form, price: Number(e.target.value) })}
            className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm" />
          <select value={form.category_id} onChange={e => setForm({ ...form, category_id: e.target.value })}
            className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm">
            <option value="">بدون تصنيف</option>
            {categories.map((c: any) => <option key={c.id} value={c.id}>{c.name_ar}</option>)}
          </select>
          <input type="number" placeholder="الحد الأقصى للطلاب" value={form.max_students}
            onChange={e => setForm({ ...form, max_students: Number(e.target.value) })}
            className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm" />
          <button onClick={save} className="w-full py-3 bg-blue-600 text-white rounded-xl font-medium">حفظ</button>
        </div>
      </Modal>
    </div>
  );
}
