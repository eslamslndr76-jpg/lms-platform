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

  useEffect(() => {
    Promise.all([
      api(`/api/courses/${id}`),
      api(`/api/admin/orders?courseId=${id}`),
    ]).then(([c, o]) => {
      setCourse(c);
      setStudents(o.orders || []);
    }).catch(() => router.push('/courses')).finally(() => setLoading(false));
  }, [id, router]);

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full" /></div>;
  if (!course) return null;

  return (
    <div className="space-y-6">
      <Link href="/courses" className="text-sm text-blue-600">← رجوع للكورسات</Link>

      <div className="bg-white rounded-2xl p-6 shadow-sm">
        <h1 className="text-2xl font-bold mb-1">{course.title_ar}</h1>
        <p className="text-gray-500 text-sm mb-4">{course.title_en}</p>
        <div className="flex gap-4 text-sm">
          <span className="text-gray-500">{course.price > 0 ? `${course.price} ج.م` : 'مجاني'}</span>
          <span className="text-gray-500">{course.max_students} طالب كحد أقصى</span>
          {course.category_name_ar && <span className="text-gray-500">{course.category_name_ar}</span>}
        </div>
      </div>

      <div className="bg-white rounded-2xl p-4 shadow-sm">
        <h2 className="font-bold text-gray-900 mb-4">الطلاب المسجلين</h2>
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
