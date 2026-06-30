'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '../../lib/api';
import DataTable from '../../components/DataTable';
import StatusBadge from '../../components/StatusBadge';
import Modal from '../../components/Modal';
import ConfirmDialog from '../../components/ConfirmDialog';
import Pagination from '../../components/Pagination';
import ExportModal from '../../components/ExportModal';
import Skeleton from '../../components/Skeleton';
import { useToast } from '../../components/Toast';

export default function OrdersPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [orders, setOrders] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [editForm, setEditForm] = useState({ amount: 0, notes: '', payment_method: '' });
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<any>(null);
  const [deleting, setDeleting] = useState(false);
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

  const openDetail = (order: any) => {
    setSelectedOrder(order);
    setEditForm({ amount: order.amount, notes: order.notes || '', payment_method: order.payment_method || '' });
    setEditing(false);
  };

  const saveEdit = async () => {
    try {
      await api(`/api/admin/orders/${selectedOrder.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          amount: Number(editForm.amount),
          notes: editForm.notes,
          payment_method: editForm.payment_method,
        }),
      });
      toast('تم تحديث الطلب بنجاح', 'success');
      setSelectedOrder(null);
      load();
    } catch {
      toast('فشل تحديث الطلب', 'error');
    }
  };

  const updateStatus = async (orderId: number, newStatus: string) => {
    try {
      await api(`/api/admin/orders/${orderId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: newStatus }),
      });
      toast(newStatus === 'paid' ? 'تمت الموافقة على الطلب' : newStatus === 'review' ? 'تمت الإحالة للمراجعة' : 'تم إلغاء الطلب', 'success');
      setSelectedOrder(null);
      load();
    } catch {
      toast('فشل تحديث الحالة', 'error');
    }
  };

  const deleteOrder = async () => {
    if (!confirmDelete) return;
    setDeleting(true);
    try {
      await api(`/api/admin/orders/${confirmDelete.id}`, { method: 'DELETE' });
      toast('تم حذف الطلب', 'success');
      setConfirmDelete(null);
      load();
    } catch {
      toast('فشل حذف الطلب', 'error');
    }
    setDeleting(false);
  };

  const statusFilters = [
    { value: 'all', label: 'الكل' },
    { value: 'pending', label: 'معلق' },
    { value: 'review', label: 'قيد المراجعة' },
    { value: 'paid', label: 'مدفوع' },
    { value: 'cancelled', label: 'ملغي' },
  ];

  if (loading && orders.length === 0) return <div className="space-y-4"><div className="flex items-center justify-between"><h1 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>الطلبات</h1></div><div className="rounded-2xl p-4 border" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}><Skeleton rows={8} cols={6} /></div></div>;
  if (error) return <div className="flex flex-col items-center justify-center h-64 gap-4"><p style={{ color: '#dc2626' }}>{error}</p><button onClick={load} className="px-4 py-2 bg-[var(--primary)] text-white rounded-xl text-sm">إعادة المحاولة</button></div>;

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
          onRowClick={openDetail}
        />
        <Pagination page={page} total={total} limit={limit} onChange={setPage} />
      </div>

      <Modal open={!!selectedOrder} onClose={() => setSelectedOrder(null)} title="تفاصيل الطلب" size="lg">
        {selectedOrder && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="p-3 rounded-xl" style={{ backgroundColor: 'var(--bg)' }}>
                <span className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>الطالب</span>
                <span style={{ color: 'var(--text)' }}>{selectedOrder.student_name}</span>
                <span className="block text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{selectedOrder.student_email}</span>
              </div>
              <div className="p-3 rounded-xl" style={{ backgroundColor: 'var(--bg)' }}>
                <span className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>الكورس</span>
                <span style={{ color: 'var(--text)' }}>{selectedOrder.title_ar}</span>
              </div>
              {editing ? (
                <>
                  <div className="p-3 rounded-xl" style={{ backgroundColor: 'var(--bg)' }}>
                    <span className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>المبلغ</span>
                    <input type="number" value={editForm.amount}
                      onChange={e => setEditForm({ ...editForm, amount: Number(e.target.value) })}
                      className="w-full px-3 py-1.5 rounded-lg border text-sm"
                      style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)', color: 'var(--text)' }} />
                  </div>
                  <div className="p-3 rounded-xl" style={{ backgroundColor: 'var(--bg)' }}>
                    <span className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>طريقة الدفع</span>
                    <select value={editForm.payment_method} onChange={e => setEditForm({ ...editForm, payment_method: e.target.value })}
                      className="w-full px-3 py-1.5 rounded-lg border text-sm"
                      style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)', color: 'var(--text)' }}>
                      <option value="">اختر</option>
                      <option value="cash">كاش</option>
                      <option value="wallet">محفظة إلكترونية</option>
                      <option value="instapay">إنستاباي</option>
                    </select>
                  </div>
                  <div className="p-3 rounded-xl col-span-2" style={{ backgroundColor: 'var(--bg)' }}>
                    <span className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>ملاحظات</span>
                    <textarea value={editForm.notes} onChange={e => setEditForm({ ...editForm, notes: e.target.value })}
                      className="w-full px-3 py-1.5 rounded-lg border text-sm h-16"
                      style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)', color: 'var(--text)' }} />
                  </div>
                </>
              ) : (
                <>
                  <div className="p-3 rounded-xl" style={{ backgroundColor: 'var(--bg)' }}>
                    <span className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>المبلغ</span>
                    <span style={{ color: 'var(--text)' }}>{selectedOrder.amount} ج.م</span>
                  </div>
                  <div className="p-3 rounded-xl" style={{ backgroundColor: 'var(--bg)' }}>
                    <span className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>طريقة الدفع</span>
                    <span style={{ color: 'var(--text)' }}>{selectedOrder.payment_method === 'wallet' ? 'محفظة إلكترونية' : selectedOrder.payment_method === 'instapay' ? 'إنستاباي' : selectedOrder.payment_method === 'cash' ? 'كاش' : '-'}</span>
                  </div>
                  {selectedOrder.notes && (
                    <div className="p-3 rounded-xl col-span-2" style={{ backgroundColor: 'var(--bg)' }}>
                      <span className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>ملاحظات</span>
                      <span style={{ color: 'var(--text)' }}>{selectedOrder.notes}</span>
                    </div>
                  )}
                </>
              )}
              <div className="p-3 rounded-xl" style={{ backgroundColor: 'var(--bg)' }}>
                <span className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>الحالة</span>
                <StatusBadge status={selectedOrder.status} />
              </div>
              <div className="p-3 rounded-xl" style={{ backgroundColor: 'var(--bg)' }}>
                <span className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>التاريخ</span>
                <span style={{ color: 'var(--text)' }}>{new Date(selectedOrder.created_at).toLocaleDateString('ar-EG')}</span>
              </div>
              {selectedOrder.receipt_url && (
                <div className="p-3 rounded-xl col-span-2" style={{ backgroundColor: 'var(--bg)' }}>
                  <span className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>الإيصال</span>
                  <a href={selectedOrder.receipt_url} target="_blank" style={{ color: 'var(--primary)' }}>عرض الإيصال</a>
                </div>
              )}
            </div>

            <div className="flex gap-2 pt-2 border-t" style={{ borderColor: 'var(--border)' }}>
              {editing ? (
                <>
                  <button onClick={saveEdit} className="flex-1 py-2.5 rounded-xl text-sm font-medium text-white" style={{ backgroundColor: '#16a34a' }}>💾 حفظ التعديلات</button>
                  <button onClick={() => setEditing(false)} className="flex-1 py-2.5 rounded-xl text-sm font-medium border" style={{ borderColor: 'var(--border)', color: 'var(--text)' }}>إلغاء</button>
                </>
              ) : (
                <>
                  <button onClick={() => setEditing(true)} className="flex-1 py-2.5 rounded-xl text-sm font-medium text-white" style={{ backgroundColor: 'var(--primary)' }}>✏️ تعديل</button>
                  {selectedOrder.status !== 'paid' && selectedOrder.status !== 'cancelled' && (
                    <>
                      <button onClick={() => updateStatus(selectedOrder.id, 'paid')} className="flex-1 py-2.5 rounded-xl text-sm font-medium text-white" style={{ backgroundColor: '#16a34a' }}>✅ موافقة</button>
                      <button onClick={() => updateStatus(selectedOrder.id, 'review')} className="flex-1 py-2.5 rounded-xl text-sm font-medium text-white" style={{ backgroundColor: '#f59e0b' }}>🔍 للمراجعة</button>
                      <button onClick={() => updateStatus(selectedOrder.id, 'cancelled')} className="flex-1 py-2.5 rounded-xl text-sm font-medium text-white" style={{ backgroundColor: '#dc2626' }}>✕ رفض</button>
                    </>
                  )}
                  <button onClick={() => setConfirmDelete(selectedOrder)} className="px-3 py-2.5 rounded-xl text-sm font-medium text-white" style={{ backgroundColor: '#dc2626' }}>🗑️</button>
                </>
              )}
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={!!confirmDelete}
        title="حذف الطلب"
        message={`هل أنت متأكد من حذف الطلب رقم #${confirmDelete?.id}؟ هذا الإجراء لا يمكن التراجع عنه.`}
        confirmLabel="حذف"
        variant="danger"
        onConfirm={deleteOrder}
        onCancel={() => setConfirmDelete(null)}
        loading={deleting}
      />

      <ExportModal open={exportOpen} onClose={() => setExportOpen(false)}
        title="تصدير الطلبات" endpoint="/api/exports/orders" filename="orders" />
    </div>
  );
}
