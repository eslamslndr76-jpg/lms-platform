'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { api } from '../lib/api';
import StatsCard from '../components/StatsCard';
import DataTable from '../components/DataTable';
import StatusBadge from '../components/StatusBadge';
import { useAdminAuth } from '../lib/auth';

export default function AdminDashboard() {
  const { user } = useAdminAuth();
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [incompleteGroups, setIncompleteGroups] = useState<any[]>([]);

  useEffect(() => {
    Promise.all([
      api('/api/admin/orders/financials'),
      api('/api/groups/incomplete').catch(() => []),
    ]).then(([s, g]) => {
      setStats(s);
      setIncompleteGroups(g);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="animate-spin h-8 w-8 border-4 rounded-full" style={{ borderColor: 'var(--primary)', borderTopColor: 'transparent' }} /></div>;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>مرحباً، {user?.name}</h1>
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>لوحة التحكم</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 animate-stagger">
        <StatsCard title="إجمالي المبيعات" value={`${stats?.totalPaid?.sum || 0} ج.م`}
          subtitle={`${stats?.totalPaid?.count || 0} طلب مدفوع`} icon="💰" color="#059669" />
        <StatsCard title="طلبات معلقة" value={stats?.totalPending?.count || 0}
          subtitle={`بقيمة ${stats?.totalPending?.sum || 0} ج.م`} icon="⏳" color="#d97706" />
        <StatsCard title="الطلبات المدفوعة" value={stats?.totalPaid?.count || 0} icon="✅" color="#2563eb" />
        <StatsCard title="آخر 6 أشهر" value={stats?.monthly?.[0]?.sum || 0}
          subtitle="الشهر الحالي" icon="📈" color="#7c3aed" />
      </div>

      {incompleteGroups.length > 0 && (
        <div className="rounded-2xl p-4 border-2 animate-pulse" style={{ backgroundColor: '#fef3c7', borderColor: '#f59e0b' }}>
          <div className="flex items-center gap-3">
            <span className="text-2xl">⚠️</span>
            <div>
              <h3 className="font-bold text-sm" style={{ color: '#92400e' }}>مجموعات غير مكتملة</h3>
              <p className="text-xs mt-1" style={{ color: '#b45309' }}>
                يوجد {incompleteGroups.length} مجموعة غير مكتملة البيانات
              </p>
              <div className="flex flex-wrap gap-2 mt-2">
                {incompleteGroups.map((g: any) => (
                  <Link key={g.id} href="/groups"
                    className="text-xs px-2 py-1 rounded-lg font-medium"
                    style={{ backgroundColor: '#fffbeb', color: '#92400e' }}>
                    {g.name} ({g.course_name})
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="rounded-2xl p-4 border" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold" style={{ color: 'var(--text)' }}>آخر الطلبات</h2>
          <Link href="/orders" className="text-sm" style={{ color: 'var(--primary)' }}>عرض الكل ←</Link>
        </div>
        <DataTable
          columns={[
            { key: 'id', label: '#' },
            { key: 'student_name', label: 'الطالب' },
            { key: 'title_ar', label: 'الكورس' },
            { key: 'amount', label: 'المبلغ', render: (v: number) => `${v} ج.م` },
            { key: 'status', label: 'الحالة', render: (v: string) => <StatusBadge status={v} /> },
          ]}
          data={stats?.recent || []}
        />
      </div>
    </div>
  );
}
