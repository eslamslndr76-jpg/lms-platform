'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '../../lib/api';
import DataTable from '../../components/DataTable';
import StatusBadge from '../../components/StatusBadge';
import Modal from '../../components/Modal';

export default function OrdersPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('all');
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const limit = 15;

  const load = async () => {
    setLoading(true);
    const data = await api(`/api/admin/orders?page=${page}&limit=${limit}&status=${status}`);
    setOrders(data.orders);
    setTotal(data.total);
    setLoading(false);
  };

  useEffect(() => { load(); }, [page, status]);

  const updateStatus = async (orderId: number, newStatus: string) => {
    await api(`/api/admin/orders/${orderId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status: newStatus }),
    });
    setSelectedOrder(null);
    load();
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-gray-900">الطلبات</h1>

      <div className="flex gap-2 overflow-x-auto pb-2">
        {['all', 'pending', 'review', 'paid', 'cancelled'].map(s => (
          <button key={s} onClick={() => { setStatus(s); setPage(1); }}
            className={`px-4 py-2 rounded-xl text-sm whitespace-nowrap ${status === s ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 border'}`}>
            {s === 'all' ? 'الكل' : s === 'pending' ? 'معلق' : s === 'review' ? 'قيد المراجعة' : s === 'paid' ? 'مدفوع' : 'ملغي'}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-2xl p-4 shadow-sm">
        <DataTable
          columns={[
            { key: 'id', label: '#' },
            { key: 'student_name', label: 'الطالب', render: (v: string, r: any) =>
              <span className="text-blue-600 cursor-pointer" onClick={() => router.push(`/students/${r.user_id}`)}>{v}</span> },
            { key: 'title_ar', label: 'الكورس', render: (v: string, r: any) =>
              <span className="text-blue-600 cursor-pointer" onClick={() => router.push(`/courses/${r.course_id}`)}>{v}</span> },
            { key: 'amount', label: 'المبلغ', render: (v: number) => `${v} ج.م` },
            { key: 'status', label: 'الحالة', render: (v: string) => <StatusBadge status={v} /> },
            { key: 'created_at', label: 'التاريخ', render: (v: string) => new Date(v).toLocaleDateString('ar-EG') },
          ]}
          data={orders}
          onRowClick={setSelectedOrder}
        />
        <div className="flex items-center justify-between mt-4">
          <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}
            className="px-4 py-2 text-sm bg-gray-100 rounded-xl disabled:opacity-30">← السابق</button>
          <span className="text-sm text-gray-500">صفحة {page} من {Math.ceil(total / limit)}</span>
          <button disabled={page >= Math.ceil(total / limit)} onClick={() => setPage(p => p + 1)}
            className="px-4 py-2 text-sm bg-gray-100 rounded-xl disabled:opacity-30">التالي →</button>
        </div>
      </div>

      <Modal open={!!selectedOrder} onClose={() => setSelectedOrder(null)} title="تفاصيل الطلب">
        {selectedOrder && (
          <div className="space-y-4">
            <div className="space-y-2 text-sm">
              <p><span className="text-gray-500">الطالب:</span> {selectedOrder.student_name}</p>
              <p><span className="text-gray-500">البريد:</span> {selectedOrder.student_email}</p>
              <p><span className="text-gray-500">الكورس:</span> {selectedOrder.title_ar}</p>
              <p><span className="text-gray-500">المبلغ:</span> {selectedOrder.amount} ج.م</p>
              <p><span className="text-gray-500">الحالة:</span> <StatusBadge status={selectedOrder.status} /></p>
              {selectedOrder.receipt_url && (
                <p><span className="text-gray-500">الإيصال:</span>
                  <a href={selectedOrder.receipt_url} target="_blank" className="text-blue-600 mr-1">عرض الإيصال</a>
                </p>
              )}
            </div>
            {selectedOrder.status !== 'paid' && selectedOrder.status !== 'cancelled' && (
              <div className="flex gap-2">
                <button onClick={() => updateStatus(selectedOrder.id, 'paid')}
                  className="flex-1 py-2.5 bg-green-600 text-white rounded-xl text-sm font-medium">✅ موافقة</button>
                <button onClick={() => updateStatus(selectedOrder.id, 'review')}
                  className="flex-1 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-medium">🔍 للمراجعة</button>
                <button onClick={() => updateStatus(selectedOrder.id, 'cancelled')}
                  className="flex-1 py-2.5 bg-red-600 text-white rounded-xl text-sm font-medium">✕ رفض</button>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
