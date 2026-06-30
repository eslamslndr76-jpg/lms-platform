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
  const [editForm, setEditForm] = useState({ amount: 0, notes_team: '', notes_student: '', payment_method: '' });
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<any>(null);
  const [deleting, setDeleting] = useState(false);

  const [addModal, setAddModal] = useState(false);
  const [addForm, setAddForm] = useState({ user_id: '', course_id: '', amount: 0, payment_method: 'cash', notes_team: '', notes_student: '' });
  const [students, setStudents] = useState<any[]>([]);
  const [courses, setCourses] = useState<any[]>([]);
  const [adding, setAdding] = useState(false);
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
    setEditForm({ amount: order.amount, notes_team: order.notes_team || order.notes || '', notes_student: order.notes_student || '', payment_method: order.payment_method || '' });
    setEditing(false);
  };

  const saveEdit = async () => {
    try {
      await api(`/api/admin/orders/${selectedOrder.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          amount: Number(editForm.amount),
          notes_team: editForm.notes_team,
          notes_student: editForm.notes_student,
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

  const openAddOrder = async () => {
    setAddForm({ user_id: '', course_id: '', amount: 0, payment_method: 'cash', notes_team: '', notes_student: '' });
    setAddModal(true);
    try {
      const [studs, crs] = await Promise.all([
        api('/api/admin/users?role=student&limit=500'),
        api('/api/courses'),
      ]);
      setStudents(studs.users || []);
      setCourses(crs);
    } catch {
      toast('فشل تحميل البيانات', 'error');
    }
  };

  const addOrder = async () => {
    if (!addForm.user_id || !addForm.course_id || !addForm.amount) {
      toast('يرجى إكمال البيانات المطلوبة', 'error');
      return;
    }
    setAdding(true);
    try {
      await api('/api/admin/orders', {
        method: 'POST',
        body: JSON.stringify({
          user_id: Number(addForm.user_id),
          course_id: Number(addForm.course_id),
          amount: Number(addForm.amount),
          payment_method: addForm.payment_method,
          notes_team: addForm.notes_team,
          notes_student: addForm.notes_student,
        }),
      });
      toast('تم إنشاء الحجز بنجاح', 'success');
      setAddModal(false);
      load();
    } catch {
      toast('فشل إنشاء الحجز', 'error');
    }
    setAdding(false);
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
        <div className="flex gap-2">
          <button onClick={openAddOrder} className="px-4 py-2 rounded-xl text-white text-sm font-medium" style={{ backgroundColor: 'var(--primary)' }}>
            + إضافة حجز
          </button>
          <button onClick={() => setExportOpen(true)} className="px-4 py-2 rounded-xl text-white text-sm font-medium" style={{ backgroundColor: 'var(--primary)' }}>
            📥 تصدير
          </button>
        </div>
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
            { key: 'status', label: 'الحالة', render: (v: string, row: any) => (
              <select value={v} onChange={e => { e.stopPropagation(); updateStatus(row.id, e.target.value); }}
                onClick={e => e.stopPropagation()}
                className="px-2 py-1 rounded-lg text-xs border font-medium cursor-pointer"
                style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }}>
                <option value="pending">معلق</option>
                <option value="review">قيد المراجعة</option>
                <option value="paid">مدفوع</option>
                <option value="cancelled">ملغي</option>
              </select>
            )},
            { key: 'created_at', label: 'التاريخ', render: (v: string) => new Date(v).toLocaleDateString('ar-EG') },
            { key: 'actions', label: 'الإجراءات', render: (_: any, row: any) => (
              <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                <button onClick={() => { setSelectedOrder(row); setEditForm({ amount: row.amount, notes_team: row.notes_team || row.notes || '', notes_student: row.notes_student || '', payment_method: row.payment_method || '' }); setEditing(true); }}
                  className="px-2 py-1 rounded-lg text-xs font-medium bg-blue-50 text-blue-600 hover:bg-blue-100">تعديل</button>
                <button onClick={() => setConfirmDelete(row)}
                  className="px-2 py-1 rounded-lg text-xs font-medium bg-red-50 text-red-600 hover:bg-red-100">حذف</button>
              </div>
            )},
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
                    <span className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>ملاحظات فريق العمل</span>
                    <textarea value={editForm.notes_team} onChange={e => setEditForm({ ...editForm, notes_team: e.target.value })}
                      className="w-full px-3 py-1.5 rounded-lg border text-sm h-16"
                      style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)', color: 'var(--text)' }} />
                  </div>
                  <div className="p-3 rounded-xl col-span-2" style={{ backgroundColor: 'var(--bg)' }}>
                    <span className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>ملاحظات الطالب (تظهر له)</span>
                    <textarea value={editForm.notes_student} onChange={e => setEditForm({ ...editForm, notes_student: e.target.value })}
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
                  {(selectedOrder.notes || selectedOrder.notes_team) && (
                    <div className="p-3 rounded-xl col-span-2" style={{ backgroundColor: 'var(--bg)' }}>
                      <span className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>ملاحظات فريق العمل</span>
                      <span style={{ color: 'var(--text)' }}>{selectedOrder.notes_team || selectedOrder.notes}</span>
                    </div>
                  )}
                  {selectedOrder.notes_student && (
                    <div className="p-3 rounded-xl col-span-2" style={{ backgroundColor: 'var(--bg)' }}>
                      <span className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>ملاحظات الطالب</span>
                      <span style={{ color: 'var(--text)' }}>{selectedOrder.notes_student}</span>
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

      <Modal open={addModal} onClose={() => setAddModal(false)} title="إضافة حجز جديد" size="lg">
        <div className="space-y-3">
          <div>
            <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>الطالب *</label>
            <select value={addForm.user_id} onChange={e => setAddForm({ ...addForm, user_id: e.target.value })}
              className="w-full px-4 py-2.5 rounded-xl border text-sm"
              style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }}>
              <option value="">اختر الطالب</option>
              {students.map((s: any) => <option key={s.id} value={s.id}>{s.name} ({s.email})</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>الكورس *</label>
            <select value={addForm.course_id} onChange={e => setAddForm({ ...addForm, course_id: e.target.value })}
              className="w-full px-4 py-2.5 rounded-xl border text-sm"
              style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }}>
              <option value="">اختر الكورس</option>
              {courses.map((c: any) => <option key={c.id} value={c.id}>{c.title_ar} - {c.price} ج.م</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>المبلغ *</label>
            <input type="number" value={addForm.amount} onChange={e => setAddForm({ ...addForm, amount: Number(e.target.value) })}
              className="w-full px-4 py-2.5 rounded-xl border text-sm"
              style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }} />
          </div>
          <div>
            <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>طريقة الدفع</label>
            <select value={addForm.payment_method} onChange={e => setAddForm({ ...addForm, payment_method: e.target.value })}
              className="w-full px-4 py-2.5 rounded-xl border text-sm"
              style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }}>
              <option value="cash">كاش</option>
              <option value="wallet">محفظة إلكترونية</option>
              <option value="instapay">إنستاباي</option>
            </select>
          </div>
          <div>
            <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>ملاحظات فريق العمل (داخلي)</label>
            <textarea value={addForm.notes_team} onChange={e => setAddForm({ ...addForm, notes_team: e.target.value })}
              className="w-full px-4 py-2.5 rounded-xl border text-sm h-16"
              style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }} />
          </div>
          <div>
            <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>ملاحظات الطالب (تظهر له)</label>
            <textarea value={addForm.notes_student} onChange={e => setAddForm({ ...addForm, notes_student: e.target.value })}
              className="w-full px-4 py-2.5 rounded-xl border text-sm h-16"
              style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }} />
          </div>
          <button onClick={addOrder} disabled={adding}
            className="w-full py-3 rounded-xl text-white font-medium disabled:opacity-50"
            style={{ backgroundColor: 'var(--primary)' }}>
            {adding ? 'جاري الحفظ...' : 'حفظ الحجز'}
          </button>
        </div>
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