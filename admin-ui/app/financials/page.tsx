'use client';

import { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import DataTable from '../../components/DataTable';
import StatsCard from '../../components/StatsCard';

export default function FinancialsPage() {
  const [financials, setFinancials] = useState<any[]>([]);
  const [summary, setSummary] = useState({ total: 0, paid: 0, pending: 0 });
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const data = await api('/api/admin/orders/financials');
    setFinancials(data);
    const paid = data.filter((o: any) => o.status === 'paid').reduce((s: number, o: any) => s + o.amount, 0);
    const pending = data.filter((o: any) => o.status === 'pending' || o.status === 'review').reduce((s: number, o: any) => s + o.amount, 0);
    setSummary({ total: paid + pending, paid, pending });
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full" /></div>;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">المالية</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatsCard title="إجمالي المبيعات" value={`${summary.total.toLocaleString()} ج.م`} color="blue" />
        <StatsCard title="المدفوع" value={`${summary.paid.toLocaleString()} ج.م`} color="green" />
        <StatsCard title="المعلق" value={`${summary.pending.toLocaleString()} ج.م`} color="amber" />
      </div>

      <div className="bg-white rounded-2xl p-4 shadow-sm">
        <DataTable
          columns={[
            { key: 'date', label: 'التاريخ', render: (v: string) => v ? new Date(v).toLocaleDateString('ar-EG') : '-' },
            { key: 'student_name', label: 'الطالب' },
            { key: 'title_ar', label: 'الكورس' },
            { key: 'amount', label: 'المبلغ', render: (v: number) => `${v} ج.م` },
            { key: 'status', label: 'الحالة' },
          ]}
          data={financials}
        />
      </div>
    </div>
  );
}
