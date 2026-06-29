'use client';

import { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import DataTable from '../../components/DataTable';
import StatusBadge from '../../components/StatusBadge';

export default function ReceiptsPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const data = await api('/api/admin/orders?status=pending&limit=100');
    setOrders(data.orders);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const updateStatus = async (id: number, status: string) => {
    await api(`/api/admin/orders/${id}/status`, {
      method: 'PATCH', body: JSON.stringify({ status }),
    });
    load();
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full" /></div>;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-gray-900">الإيصالات المعلقة</h1>

      <div className="bg-white rounded-2xl p-4 shadow-sm">
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
