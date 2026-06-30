'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '../../lib/api';
import DataTable from '../../components/DataTable';
import ExportModal from '../../components/ExportModal';

export default function StudentsPage() {
  const router = useRouter();
  const [students, setStudents] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [exportOpen, setExportOpen] = useState(false);
  const [courses, setCourses] = useState<any[]>([]);
  const limit = 20;

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api(`/api/admin/users?role=student&page=${page}&limit=${limit}`);
      setStudents(data.users);
      setTotal(data.total);
    } catch {
      setError('فشل تحميل الطلاب');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); api('/api/courses').then(setCourses).catch(() => {}); }, [page]);

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin h-8 w-8 border-4 rounded-full" style={{ borderColor: 'var(--primary)', borderTopColor: 'transparent' }} /></div>;
  if (error) return <div className="flex flex-col items-center justify-center h-64 gap-4"><p style={{ color: '#dc2626' }}>{error}</p><button onClick={load} className="px-4 py-2 bg-blue-600 text-white rounded-xl text-sm">إعادة المحاولة</button></div>;

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>الطلاب</h1>
        <button onClick={() => setExportOpen(true)} className="px-4 py-2 rounded-xl text-white text-sm font-medium" style={{ backgroundColor: 'var(--primary)' }}>
          📥 تصدير
        </button>
      </div>

      <div className="rounded-2xl p-4 border" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}>
        <DataTable
          columns={[
            { key: 'name', label: 'الاسم' },
            { key: 'email', label: 'البريد' },
            { key: 'phone', label: 'الهاتف', render: (v: string) => v || '-' },
            { key: 'created_at', label: 'تاريخ التسجيل', render: (v: string) => new Date(v).toLocaleDateString('ar-EG') },
          ]}
          data={students}
          onRowClick={(row) => router.push(`/students/${row.id}`)}
        />
        <div className="flex items-center justify-between mt-4">
          <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}
            className="px-4 py-2 text-sm rounded-xl disabled:opacity-30 border"
            style={{ borderColor: 'var(--border)', color: 'var(--text)' }}>← السابق</button>
          <span className="text-sm" style={{ color: 'var(--text-muted)' }}>صفحة {page} من {Math.ceil(total / limit)}</span>
          <button disabled={page >= Math.ceil(total / limit)} onClick={() => setPage(p => p + 1)}
            className="px-4 py-2 text-sm rounded-xl disabled:opacity-30 border"
            style={{ borderColor: 'var(--border)', color: 'var(--text)' }}>التالي →</button>
        </div>
      </div>

      <ExportModal open={exportOpen} onClose={() => setExportOpen(false)}
        title="تصدير الطلاب بكورس" endpoint="/api/exports/students/:courseId" filename="students"
        showCoursePicker courses={courses.map((c: any) => ({ id: c.id, name_ar: c.title_ar }))} />
    </div>
  );
}
