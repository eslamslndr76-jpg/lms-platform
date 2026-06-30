'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '../../lib/api';
import DataTable from '../../components/DataTable';
import StatusBadge from '../../components/StatusBadge';
import Modal from '../../components/Modal';
import ExportModal from '../../components/ExportModal';

export default function OrdersPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const limit = 15;

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api(`/api/admin/orders?page=${page}&limit=${limit}&status=${status}`);
      setOrders(data.orders);
      setTotal(data.total);
    } catch {
      setError('فشل تحميل الطلبات');
    } finally {
      setLoading(false);
    }
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

  const statusFilters = [
    { value: 'all', label: 'الكل' },
    { value: 'pending', label: 'معلق' },
    { value: 'review', label: 'قيد المراجعة' },
    { value: 'paid', label: 'مدفوع' },
    { value: 'cancelled', label: 'ملغي' },
  ];

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin h-8 w-8 border-4 rounded-full" style={{ borderColor: 'var(--primary)', borderTopColor: 'transparent' }} /></div>;
  if (error) return <div className="flex flex-col items-center justify-center h-64 gap-4"><p style={{ color: '#dc2626' }}>{error}</p><button onClick={load} className="px-4 py-2 bg-blue-600 text-white rounded-xl text-sm">إعادة المحاولة</button></div>;

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>الطلبات</h1>
        <button onClick={() => setExportOpen(true)} className="px-4 py-2 rounded-xl text-white text-sm font-medium" style={{ backgroundColor: 'var(--primary)' }}>
          📥 تصدير
        </button>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-2">
        {statusFilters.map(s => (
          <button key={s.value} onClick={() => { setStatus(s.value); setPage(1); }}
            className={`px-4 py-2 rounded-xl text-sm whitespace-nowrap transition-all ${status === s.value ? 'text-white shadow-sm' : 'border'}`}
            style={status === s.value ? { backgroundColor: 'var(--primary)' } : { borderColor: 'var(--border)', color: 'var(--text)' }}>
            {s.label}
          </button>
        ))}
      </div>

      <div className="rounded-2xl p-4 border" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}>
        <DataTable
          columns={[
            { key: 'id', label: '#' },
            { key: 'student_name', label: 'الطالب', render: (v: string, r: any) =>
              <span className="cursor-pointer" style={{ color: 'var(--primary)' }} onClick={() => router.push(`/students/${r.user_id}`)}>{v}</span> },
            { key: 'title_ar', label: 'الكورس', render: (v: string, r: any) =>
              <span className="cursor-pointer" style={{ color: 'var(--primary)' }} onClick={() => router.push(`/courses/${r.course_id}`)}>{v}</span> },
            { key: 'amount', label: 'المبلغ', render: (v: number) => `${v} ج.م` },
            { key: 'status', label: 'الحالة', render: (v: string) => <StatusBadge status={v} /> },
            { key: 'created_at', label: 'التاريخ', render: (v: string) => new Date(v).toLocaleDateString('ar-EG') },
          ]}
          data={orders}
          onRowClick={setSelectedOrder}
        />
        <div className="flex items-center justify-between mt-4">
          <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}
            className="px-4 py-2 text-sm rounded-xl disabled:opacity-30 border"
            style={{ borderColor: 'var(--border)', color: 'var(--text)' }}>← السابق</button>
          <span className="text-sm" style={{ color: 'var(--text-muted)' }}>صفحة {page} من {Math.ceil(total / limit)}</span>
          <button disabled={page >= Math.ceil(total / limit)} onClick={() => setPage(p => p + 1)}
            className="px-4 py-2 text-sm rounded-xl disabled:opacity-30 border"
            style={{ borderColor: 'var(--border)', color: 'var(--text)' }}>التالي →</button>
        </div>
      </div>

      <Modal open={!!selectedOrder} onClose={() => setSelectedOrder(null)} title="تفاصيل الطلب">
        {selectedOrder && (
          <div className="space-y-4">
            <div className="space-y-2 text-sm">
              <p><span style={{ color: 'var(--text-muted)' }}>الطالب:</span> <span style={{ color: 'var(--text)' }}>{selectedOrder.student_name}</span></p>
              <p><span style={{ color: 'var(--text-muted)' }}>البريد:</span> <span style={{ color: 'var(--text)' }}>{selectedOrder.student_email}</span></p>
              <p><span style={{ color: 'var(--text-muted)' }}>الكورس:</span> <span style={{ color: 'var(--text)' }}>{selectedOrder.title_ar}</span></p>
              <p><span style={{ color: 'var(--text-muted)' }}>المبلغ:</span> <span style={{ color: 'var(--text)' }}>{selectedOrder.amount} ج.م</span></p>
              <p><span style={{ color: 'var(--text-muted)' }}>الحالة:</span> <StatusBadge status={selectedOrder.status} /></p>
              {selectedOrder.receipt_url && (
                <p><span style={{ color: 'var(--text-muted)' }}>الإيصال:</span>
                  <a href={selectedOrder.receipt_url} target="_blank" className="mr-1" style={{ color: 'var(--primary)' }}>عرض الإيصال</a>
                </p>
              )}
            </div>
            {selectedOrder.status !== 'paid' && selectedOrder.status !== 'cancelled' && (
              <div className="flex gap-2">
                <button onClick={() => updateStatus(selectedOrder.id, 'paid')}
                  className="flex-1 py-2.5 rounded-xl text-sm font-medium text-white" style={{ backgroundColor: '#16a34a' }}>✅ موافقة</button>
                <button onClick={() => updateStatus(selectedOrder.id, 'review')}
                  className="flex-1 py-2.5 rounded-xl text-sm font-medium text-white" style={{ backgroundColor: 'var(--primary)' }}>🔍 للمراجعة</button>
                <button onClick={() => updateStatus(selectedOrder.id, 'cancelled')}
                  className="flex-1 py-2.5 rounded-xl text-sm font-medium text-white" style={{ backgroundColor: '#dc2626' }}>✕ رفض</button>
              </div>
            )}
          </div>
        )}
      </Modal>

      <ExportModal open={exportOpen} onClose={() => setExportOpen(false)}
        title="تصدير الطلبات" endpoint="/api/exports/orders" filename="orders" />
    </div>
  );
}
