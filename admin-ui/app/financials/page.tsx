'use client';

import { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import DataTable from '../../components/DataTable';
import StatsCard from '../../components/StatsCard';
import StatusBadge from '../../components/StatusBadge';
import ExportButton from '../../components/ExportButton';
import Skeleton from '../../components/Skeleton';

export default function FinancialsPage() {
  const [financials, setFinancials] = useState<any[]>([]);
  const [summary, setSummary] = useState({ total: 0, paid: 0, pending: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const data: any = await api('/api/admin/orders/financials');
      if (data && typeof data === 'object') {
        setFinancials(Array.isArray(data.recent) ? data.recent : []);
        setSummary({
          total: Number(data.totalPaid?.sum || 0) + Number(data.totalPending?.sum || 0),
          paid: Number(data.totalPaid?.sum || 0),
          pending: Number(data.totalPending?.sum || 0),
        });
      }
    } catch (err: any) {
      setError(err?.message || 'فشل تحميل بيانات المالية');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--md-sys-color-on-surface)' }}>المالية</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>
            ملخص الإيرادات وآخر الحركات المالية
          </p>
        </div>
        <ExportButton dataset="financials" title="تصدير التقرير المالي" />
      </div>

      {loading ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Skeleton rows={1} cols={2} />
            <Skeleton rows={1} cols={2} />
            <Skeleton rows={1} cols={2} />
          </div>
          <Skeleton rows={6} cols={5} />
        </div>
      ) : error ? (
        <div
          className="p-6 rounded-[var(--md-sys-shape-corner-medium)] flex flex-col items-center gap-3 text-center"
          style={{ backgroundColor: 'var(--md-sys-color-error-container)', color: 'var(--md-sys-color-on-error-container)' }}
        >
          <span className="material-symbols-outlined text-[28px]" aria-hidden>error</span>
          <p className="text-sm">{error}</p>
          <button onClick={load} className="md3-btn md3-btn--filled text-sm">إعادة المحاولة</button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatsCard
              title="إجمالي المبيعات"
              value={`${summary.total.toLocaleString()} ج.م`}
              icon="account_balance_wallet"
              color="var(--md-sys-color-primary)"
            />
            <StatsCard
              title="المدفوع"
              value={`${summary.paid.toLocaleString()} ج.م`}
              icon="paid"
              color="var(--md-sys-color-success)"
            />
            <StatsCard
              title="المعلّق"
              value={`${summary.pending.toLocaleString()} ج.م`}
              icon="schedule"
              color="var(--md-sys-color-warning)"
            />
          </div>

          <section
            className="p-4"
            style={{
              backgroundColor: 'var(--md-sys-color-surface-container-low)',
              borderRadius: 'var(--md-sys-shape-corner-medium)',
            }}
          >
            <DataTable
              columns={[
                { key: 'date', label: 'التاريخ', align: 'center', nowrap: true, render: (v: string) => v ? new Date(v).toLocaleDateString('ar-EG') : '—' },
                { key: 'student_name', label: 'الطالب' },
                { key: 'title_ar', label: 'الكورس' },
                { key: 'amount', label: 'المبلغ', align: 'center', nowrap: true, render: (v: number) => `${v} ج.م` },
                { key: 'status', label: 'الحالة', align: 'center', nowrap: true, render: (v: string) => <StatusBadge status={v} /> },
              ]}
              data={financials}
            />
            {financials.length === 0 && (
              <p className="text-sm text-center py-2" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>
                لا توجد حركات مالية مسجّلة بعد.
              </p>
            )}
          </section>
        </>
      )}
    </div>
  );
}