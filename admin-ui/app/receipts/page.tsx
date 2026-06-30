'use client';

import { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import DataTable from '../../components/DataTable';
import StatusBadge from '../../components/StatusBadge';

export default function ReceiptsPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api('/api/admin/orders?status=pending&limit=100');
      setOrders(data.orders);
    } catch {
      setError('فشل تحميل الإيصالات');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const updateStatus = async (id: number, status: string) => {
    await api(`/api/admin/orders/${id}/status`, {
      method: 'PATCH', body: JSON.stringify({ status }),
    });
    load();
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin h-8 w-8 border-4 rounded-full" style={{ borderColor: 'var(--primary)', borderTopColor: 'transparent' }} /></div>;
  if (error) return <div className="flex flex-col items-center justify-center h-64 gap-4"><p style={{ color: '#dc2626' }}>{error}</p><button onClick={load} className="px-4 py-2 bg-blue-600 text-white rounded-xl text-sm">إعادة المحاولة</button></div>;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>الإيصالات المعلقة</h1>

      <div className="rounded-2xl p-4" style={{ backgroundColor: 'var(--card)' }}>
        <DataTable
          columns={[
            { key: 'student_name', label: 'الطالب' },
            { key: 'title_ar', label: 'الكورس' },
            { key: 'amount', label: 'المبلغ', render: (v: number) => `${v} ج.م` },
            { key: 'created_at', label: 'التاريخ', render: (v: string) => new Date(v).toLocaleDateString('ar-EG') },
            { key: 'actions', label: 'الإجراءات', render: (_: any, row: any) => (
              <div className="flex gap-1">
                <button onClick={() => updateStatus(row.id, 'paid')}
                  className="px-3 py-1 bg-green-600 text-white rounded-lg text-xs">موافقة</button>
                <button onClick={() => updateStatus(row.id, 'cancelled')}
                  className="px-3 py-1 bg-red-600 text-white rounded-lg text-xs">رفض</button>
              </div>
            )},
          ]}
          data={orders}
        />
      </div>
    </div>
  );
}
