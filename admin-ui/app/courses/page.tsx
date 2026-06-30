'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '../../lib/api';
import DataTable from '../../components/DataTable';
import Modal from '../../components/Modal';
import ConfirmDialog from '../../components/ConfirmDialog';
import Skeleton from '../../components/Skeleton';
import { compressAndEncode } from '../../lib/imageUtils';
import { useToast } from '../../components/Toast';

export default function CoursesPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [courses, setCourses] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ title_ar: '', title_en: '', description: '', price: 0, category_id: '', image_url: '', max_students: 30, lecture_count: 0, lecture_duration: 0, instructor: '', course_mode: 'online' });
  const [confirmToggle, setConfirmToggle] = useState<any>(null);
  const [confirmDelete, setConfirmDelete] = useState<any>(null);

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
    try {
      await api('/api/courses', {
        method: 'POST',
        body: JSON.stringify({ ...form, category_id: form.category_id ? Number(form.category_id) : null }),
      });
      setModal(false);
      toast('تم إضافة الكورس', 'success');
      load();
    } catch {
      toast('فشل إضافة الكورس', 'error');
    }
  };

  const toggleActive = async () => {
    if (!confirmToggle) return;
    try {
      await api(`/api/courses/${confirmToggle.id}`, {
        method: 'PUT',
        body: JSON.stringify({ is_active: Number(confirmToggle.is_active) ? 0 : 1 }),
      });
      toast(Number(confirmToggle.is_active) ? 'تم تعطيل الكورس' : 'تم تفعيل الكورس', 'success');
      setConfirmToggle(null);
      load();
    } catch {
      toast('فشل تحديث حالة الكورس', 'error');
    }
  };

  const deleteCourse = async () => {
    if (!confirmDelete) return;
    try {
      await api(`/api/courses/${confirmDelete.id}`, { method: 'DELETE' });
      toast('تم حذف الكورس نهائياً', 'success');
      setConfirmDelete(null);
      load();
    } catch {
      toast('فشل حذف الكورس', 'error');
    }
  };

  if (loading) return <div className="space-y-4"><div className="flex items-center justify-between"><h1 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>الكورسات</h1></div><div className="rounded-2xl p-4 border" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}><Skeleton rows={6} cols={7} /></div></div>;
  if (error) return <div className="flex flex-col items-center justify-center h-64 gap-4"><p style={{ color: '#dc2626' }}>{error}</p><button onClick={load} className="px-4 py-2 bg-[var(--primary)] text-white rounded-xl text-sm">إعادة المحاولة</button></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>الكورسات</h1>
        <button onClick={() => setModal(true)} className="px-4 py-2 bg-[var(--primary)] text-white rounded-xl text-sm font-medium">
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
            { key: 'course_mode', label: 'النوع', render: (v: string) => v === 'offline' ? '🏫 حضوري' : '💻 أونلاين' },
            { key: 'is_active', label: 'الحالة', render: (v: any) => Number(v) ? '🟢 نشط' : '🔴 غير نشط' },
            { key: 'id', label: 'الإجراءات',
              render: (v: number, row: any) => (
                <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                  <button onClick={() => router.push(`/courses/${row.id}`)}
                    className="px-2 py-1 rounded-lg text-xs font-medium bg-blue-50 text-blue-600 hover:bg-blue-100">تعديل</button>
                  <button onClick={() => setConfirmToggle(row)}
                    className="px-2 py-1 rounded-lg text-xs font-medium"
                    style={{ backgroundColor: Number(row.is_active) ? '#fef2f2' : '#f0fdf4', color: Number(row.is_active) ? '#dc2626' : '#16a34a' }}>
                    {Number(row.is_active) ? 'تعطيل' : 'تفعيل'}
                  </button>
                  <button onClick={() => setConfirmDelete(row)}
                    className="px-2 py-1 rounded-lg text-xs font-medium bg-red-50 text-red-600 hover:bg-red-100">حذف</button>
                </div>
              )
            },
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
            <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>مدة المحاضرة (ساعة)</label>
            <input type="number" step="0.5" placeholder="مثال: 1.5" value={form.lecture_duration}
              onChange={e => setForm({ ...form, lecture_duration: Number(e.target.value) })}
              className="w-full px-4 py-2.5 rounded-xl border text-sm" style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }} />
          </div>
          <div>
            <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>اسم المدرب</label>
            <input placeholder="مثال: أ. محمد أحمد" value={form.instructor}
              onChange={e => setForm({ ...form, instructor: e.target.value })}
              className="w-full px-4 py-2.5 rounded-xl border text-sm" style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }} />
          </div>
          <div>
            <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>نوع الكورس</label>
            <select value={form.course_mode} onChange={e => setForm({ ...form, course_mode: e.target.value })}
              className="w-full px-4 py-2.5 rounded-xl border text-sm" style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }}>
              <option value="online">أونلاين</option>
              <option value="offline">أوفلاين (حضوري)</option>
            </select>
          </div>
          <div>
            <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>صورة الكورس</label>
            <input type="file" accept="image/*"
              onChange={async e => {
                const file = e.target.files?.[0];
                if (file) {
                  const dataUrl = await compressAndEncode(file);
                  setForm({ ...form, image_url: dataUrl });
                }
              }}
              className="w-full text-sm" style={{ color: 'var(--text)' }} />
            {form.image_url && (
              <div className="relative mt-2 inline-block">
                <img src={form.image_url} alt="Preview" className="h-20 rounded-xl object-cover" />
                <button onClick={() => setForm({ ...form, image_url: '' })} className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full text-xs">✕</button>
              </div>
            )}
          </div>
          <button onClick={save} className="w-full py-3 bg-[var(--primary)] text-white rounded-xl font-medium">حفظ</button>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!confirmToggle}
        title={Number(confirmToggle?.is_active) ? 'تعطيل الكورس' : 'تفعيل الكورس'}
        message={Number(confirmToggle?.is_active) ? `تعطيل "${confirmToggle?.title_ar}"؟ سيختفي من واجهة المستخدمين.` : `تفعيل "${confirmToggle?.title_ar}"؟`}
        confirmLabel={Number(confirmToggle?.is_active) ? 'تعطيل' : 'تفعيل'}
        variant={Number(confirmToggle?.is_active) ? 'warning' : 'info'}
        onConfirm={toggleActive}
        onCancel={() => setConfirmToggle(null)}
      />

      <ConfirmDialog
        open={!!confirmDelete}
        title="حذف الكورس"
        message={`حذف "${confirmDelete?.title_ar}" نهائياً؟ سيتم حذف جميع المجموعات والطلبات والشهادات المرتبطة به.`}
        confirmLabel="حذف"
        variant="danger"
        onConfirm={deleteCourse}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  );
}
