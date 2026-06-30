'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '../../../lib/api';
import DataTable from '../../../components/DataTable';
import Modal from '../../../components/Modal';
import StatusBadge from '../../../components/StatusBadge';
import Skeleton from '../../../components/Skeleton';
import { compressAndEncode } from '../../../lib/imageUtils';
import { useToast } from '../../../components/Toast';

export default function CourseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { toast } = useToast();
  const [course, setCourse] = useState<any>(null);
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editModal, setEditModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<any>({});

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const c = await api(`/api/courses/${id}`);
      setCourse(c);
      setForm({
        title_ar: c.title_ar, title_en: c.title_en, description: c.description || '',
        price: c.price, category_id: c.category_id?.toString() || '',
        image_url: c.image_url || '', max_students: c.max_students,
        lecture_count: c.lecture_count || 0, lecture_duration: c.lecture_duration || 0,
        instructor: c.instructor || '', materials_url: c.materials_url || '',
        course_mode: c.course_mode || 'online',
      });
    } catch {
      setError('فشل تحميل بيانات الكورس');
      setLoading(false);
      return;
    }
    try {
      const o = await api(`/api/admin/orders?courseId=${id}`);
      setStudents(o.orders || []);
    } catch {
      // orders optional
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, [id, router]);

  const save = async () => {
    setSaving(true);
    try {
      await api(`/api/courses/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ ...form, category_id: form.category_id ? Number(form.category_id) : null }),
      });
      setEditModal(false);
      toast('تم حفظ التعديلات', 'success');
      load();
    } catch {
      toast('فشل حفظ التعديلات', 'error');
    }
    setSaving(false);
  };

  if (loading) return <div className="space-y-6"><Link href="/courses" className="text-sm" style={{ color: 'var(--primary)' }}>← رجوع للكورسات</Link><Skeleton rows={6} cols={3} /></div>;
  if (error) return <div className="flex flex-col items-center justify-center h-64 gap-4"><p style={{ color: '#dc2626' }}>{error}</p><Link href="/courses" className="px-4 py-2 bg-[var(--primary)] text-white rounded-xl text-sm">رجوع للكورسات</Link></div>;
  if (!course) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Link href="/courses" className="text-sm" style={{ color: 'var(--primary)' }}>← رجوع للكورسات</Link>
        <button onClick={() => setEditModal(true)} className="px-4 py-2 bg-[var(--primary)] text-white rounded-xl text-sm font-medium">تعديل الكورس</button>
      </div>

      <div className="rounded-2xl p-6" style={{ backgroundColor: 'var(--card)' }}>
        <h1 className="text-2xl font-bold mb-1" style={{ color: 'var(--text)' }}>{course.title_ar}</h1>
        <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>{course.title_en}</p>
          <div className="flex flex-wrap gap-4 text-sm mb-4" style={{ color: 'var(--text-muted)' }}>
            <span>{course.price > 0 ? `${course.price} ج.م` : 'مجاني'}</span>
            <span>{course.max_students} طالب كحد أقصى</span>
            {course.category_name_ar && <span>{course.category_name_ar}</span>}
            {course.course_mode && <span>{course.course_mode === 'offline' ? '🏫 حضوري' : '💻 أونلاين'}</span>}
            {course.lecture_count > 0 && <span>📚 {course.lecture_count} محاضرة</span>}
            {course.lecture_duration > 0 && <span>⏱ مدة المحاضرة: {course.lecture_duration} ساعة</span>}
            {course.instructor && <span>👨‍🏫 {course.instructor}</span>}
        </div>
        {course.description && (
          <p className="text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>{course.description}</p>
        )}
      </div>

      <div className="rounded-2xl p-4" style={{ backgroundColor: 'var(--card)' }}>
        <h2 className="font-bold mb-4" style={{ color: 'var(--text)' }}>الطلاب المسجلين</h2>
        <DataTable
          columns={[
            { key: 'student_name', label: 'الاسم' },
            { key: 'student_email', label: 'البريد' },
            { key: 'amount', label: 'المبلغ', render: (v: number) => `${v} ج.م` },
            { key: 'status', label: 'الحالة', render: (v: string) => <StatusBadge status={v} /> },
            { key: 'created_at', label: 'التاريخ', render: (v: string) => new Date(v).toLocaleDateString('ar-EG') },
          ]}
          data={students}
            onRowClick={() => router.push(`/orders`)}
        />
      </div>

      <Modal open={editModal} onClose={() => setEditModal(false)} title="تعديل الكورس" size="lg">
        <div className="space-y-3">
          {[
            { key: 'title_ar', label: 'اسم الكورس بالعربية', type: 'text', placeholder: 'مثال: أساسيات البرمجة' },
            { key: 'title_en', label: 'Course name in English', type: 'text', placeholder: 'e.g. Programming Basics' },
            { key: 'description', label: 'وصف الكورس', type: 'textarea', placeholder: 'ماذا سيتعلم الطالب؟' },
            { key: 'price', label: 'سعر الكورس (0 = مجاني)', type: 'number' },
            { key: 'lecture_count', label: 'عدد المحاضرات', type: 'number' },
            { key: 'lecture_duration', label: 'مدة المحاضرة (ساعة)', type: 'number', step: '0.5' },
            { key: 'instructor', label: 'اسم المدرب', type: 'text', placeholder: 'مثال: أ. محمد أحمد' },
            { key: 'max_students', label: 'الحد الأقصى للطلاب', type: 'number' },
          ].map(({ key, label, type, placeholder, step }) => (
            <div key={key}>
              <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>{label}</label>
              {type === 'textarea' ? (
                <textarea value={form[key]} onChange={e => setForm({ ...form, [key]: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl border text-sm h-20"
                  style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }} />
              ) : (
                <input type={type} step={step} placeholder={placeholder} value={form[key]}
                  onChange={e => setForm({ ...form, [key]: type === 'number' ? Number(e.target.value) : e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl border text-sm"
                  style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }} />
              )}
            </div>
          ))}
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
          <button onClick={save} disabled={saving}
            className="w-full py-3 rounded-xl text-white font-medium disabled:opacity-50"
            style={{ backgroundColor: 'var(--primary)' }}>
            {saving ? 'جاري الحفظ...' : 'حفظ التعديلات'}
          </button>
        </div>
      </Modal>
    </div>
  );
}
