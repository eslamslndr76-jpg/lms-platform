'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '../../../lib/api';
import DataTable from '../../../components/DataTable';
import StatusBadge from '../../../components/StatusBadge';

export default function CourseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [course, setCourse] = useState<any>(null);
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError('');
      try {
        const c = await api(`/api/courses/${id}`);
        setCourse(c);
      } catch {
        setError('فشل تحميل بيانات الكورس');
        setLoading(false);
        return;
      }
      try {
        const o = await api(`/api/admin/orders?courseId=${id}`);
        setStudents(o.orders || []);
      } catch {
        // orders for this course optional
      }
      setLoading(false);
    })();
  }, [id, router]);

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin h-8 w-8 border-4 rounded-full" style={{ borderColor: 'var(--primary)', borderTopColor: 'transparent' }} /></div>;
  if (error) return <div className="flex flex-col items-center justify-center h-64 gap-4"><p style={{ color: '#dc2626' }}>{error}</p><Link href="/courses" className="px-4 py-2 bg-blue-600 text-white rounded-xl text-sm">رجوع للكورسات</Link></div>;
  if (!course) return null;

  return (
    <div className="space-y-6">
      <Link href="/courses" className="text-sm text-blue-600">← رجوع للكورسات</Link>

      <div className="rounded-2xl p-6" style={{ backgroundColor: 'var(--card)' }}>
        <h1 className="text-2xl font-bold mb-1">{course.title_ar}</h1>
        <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>{course.title_en}</p>
        <div className="flex gap-4 text-sm">
          <span style={{ color: 'var(--text-muted)' }}>{course.price > 0 ? `${course.price} ج.م` : 'مجاني'}</span>
          <span style={{ color: 'var(--text-muted)' }}>{course.max_students} طالب كحد أقصى</span>
          {course.category_name_ar && <span style={{ color: 'var(--text-muted)' }}>{course.category_name_ar}</span>}
        </div>
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
          onRowClick={(row) => router.push(`/orders?search=${row.id}`)}
        />
      </div>
    </div>
  );
}
