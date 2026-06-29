'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '../../lib/api';
import DataTable from '../../components/DataTable';

export default function StudentsPage() {
  const router = useRouter();
  const [students, setStudents] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const limit = 20;

  const load = async () => {
    setLoading(true);
    const data = await api(`/api/admin/users?role=student&page=${page}&limit=${limit}`);
    setStudents(data.users);
    setTotal(data.total);
    setLoading(false);
  };

  useEffect(() => { load(); }, [page]);

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full" /></div>;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-gray-900">الطلاب</h1>

      <div className="bg-white rounded-2xl p-4 shadow-sm">
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
            className="px-4 py-2 text-sm bg-gray-100 rounded-xl disabled:opacity-30">← السابق</button>
          <span className="text-sm text-gray-500">صفحة {page} من {Math.ceil(total / limit)}</span>
          <button disabled={page >= Math.ceil(total / limit)} onClick={() => setPage(p => p + 1)}
            className="px-4 py-2 text-sm bg-gray-100 rounded-xl disabled:opacity-30">التالي →</button>
        </div>
      </div>
    </div>
  );
}
