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

  useEffect(() => {
    api('/api/admin/orders/financials').then(setStats).catch(() => {}).finally(() => setLoading(false));
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
