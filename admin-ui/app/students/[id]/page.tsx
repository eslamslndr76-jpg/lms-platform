'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '../../../lib/api';
import StatusBadge from '../../../components/StatusBadge';

export default function StudentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [student, setStudent] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api(`/api/admin/users/${id}`)
      .then(setStudent)
      .catch(() => router.push('/students'))
      .finally(() => setLoading(false));
  }, [id, router]);

  if (loading) return <div className="flex items-center justify-center h-64">          <div className="animate-spin h-8 w-8 border-4 rounded-full" style={{ borderColor: 'var(--primary)', borderTopColor: 'transparent' }} /></div>;
  if (!student) return null;

  return (
    <div className="space-y-6">
      <Link href="/students" className="text-sm text-blue-600">← رجوع</Link>

      <div className="rounded-2xl p-6" style={{ backgroundColor: 'var(--card)' }}>
        <h1 className="text-2xl font-bold">{student.name}</h1>
        <div className="mt-2 space-y-1 text-sm" style={{ color: 'var(--text-muted)' }}>
          <p>📧 {student.email}</p>
          <p>📞 {student.phone || '-'}</p>
          <p>🎭 {student.role_name}</p>
        </div>
      </div>

      <div className="rounded-2xl p-4" style={{ backgroundColor: 'var(--card)' }}>
        <h2 className="font-bold mb-4" style={{ color: 'var(--text)' }}>الطلبات ({student.orders?.length || 0})</h2>
        <div className="space-y-2">
          {student.orders?.length === 0 && <p className="text-sm" style={{ color: 'var(--text-muted)' }}>لا توجد طلبات</p>}
          {student.orders?.map((o: any) => (
            <div key={o.id} className="flex items-center justify-between p-3 rounded-xl text-sm" style={{ backgroundColor: 'var(--bg)' }}>
              <div>
                <span className="font-medium">{o.title_ar}</span>
                <span className="mr-2" style={{ color: 'var(--text-muted)' }}>{o.amount} ج.م</span>
              </div>
              <StatusBadge status={o.status} />
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-2xl p-4" style={{ backgroundColor: 'var(--card)' }}>
        <h2 className="font-bold mb-4" style={{ color: 'var(--text)' }}>المجموعات ({student.groups?.length || 0})</h2>
        <div className="space-y-2">
          {student.groups?.length === 0 && <p className="text-sm" style={{ color: 'var(--text-muted)' }}>لا توجد مجموعات</p>}
          {student.groups?.map((g: any) => (
            <div key={g.id} className="p-3 rounded-xl text-sm" style={{ backgroundColor: 'var(--bg)' }}>
              <span className="font-medium">{g.name}</span>
              <span className="mr-2" style={{ color: 'var(--text-muted)' }}>({g.course_name})</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
