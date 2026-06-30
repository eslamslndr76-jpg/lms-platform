'use client';

import { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import DataTable from '../../components/DataTable';
import StatsCard from '../../components/StatsCard';
import ExportModal from '../../components/ExportModal';

export default function FinancialsPage() {
  const [financials, setFinancials] = useState<any[]>([]);
  const [summary, setSummary] = useState({ total: 0, paid: 0, pending: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [exportOpen, setExportOpen] = useState(false);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const data: any = await api('/api/admin/orders/financials');
      if (data && typeof data === 'object') {
        setFinancials(Array.isArray(data.recent) ? data.recent : []);
        setSummary({
          total: (data.totalPaid?.sum || 0) + (data.totalPending?.sum || 0),
          paid: data.totalPaid?.sum || 0,
          pending: data.totalPending?.sum || 0,
        });
      }
    } catch {
      setError('فشل تحميل البيانات');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin h-8 w-8 border-4 rounded-full" style={{ borderColor: 'var(--primary)', borderTopColor: 'transparent' }} /></div>;
  if (error) return <div className="flex flex-col items-center justify-center h-64 gap-4"><p style={{ color: '#dc2626' }}>{error}</p><button onClick={load} className="px-4 py-2 bg-blue-600 text-white rounded-xl text-sm">إعادة المحاولة</button></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>المالية</h1>
        <button onClick={() => setExportOpen(true)} className="px-4 py-2 rounded-xl text-white text-sm font-medium" style={{ backgroundColor: 'var(--primary)' }}>
          📥 تصدير
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatsCard title="إجمالي المبيعات" value={`${summary.total.toLocaleString()} ج.م`} color="blue" />
        <StatsCard title="المدفوع" value={`${summary.paid.toLocaleString()} ج.م`} color="green" />
        <StatsCard title="المعلق" value={`${summary.pending.toLocaleString()} ج.م`} color="amber" />
      </div>

      <div className="rounded-2xl p-4" style={{ backgroundColor: 'var(--card)' }}>
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

      <ExportModal open={exportOpen} onClose={() => setExportOpen(false)}
        title="تصدير التقارير المالية" endpoint="/api/exports/financials" filename="financials" />
    </div>
  );
}
