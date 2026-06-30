'use client';

import { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import DataTable from '../../components/DataTable';
import Modal from '../../components/Modal';
import ConfirmDialog from '../../components/ConfirmDialog';
import Pagination from '../../components/Pagination';
import ExportModal from '../../components/ExportModal';
import StatusBadge from '../../components/StatusBadge';
import Skeleton from '../../components/Skeleton';
import { useToast } from '../../components/Toast';

export default function StudentsPage() {
  const { toast } = useToast();
  const [students, setStudents] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [exportOpen, setExportOpen] = useState(false);
  const [courses, setCourses] = useState<any[]>([]);

  const [detailModal, setDetailModal] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<any>(null);
  const [editStudent, setEditStudent] = useState<any>(null);
  const [editModal, setEditModal] = useState(false);
  const [editForm, setEditForm] = useState({ name: '', email: '', phone: '', password: '' });

  const [addModal, setAddModal] = useState(false);
  const [addForm, setAddForm] = useState({ name: '', email: '', password: '', phone: '' });

  const [confirmDelete, setConfirmDelete] = useState<any>(null);
  const [confirmToggle, setConfirmToggle] = useState<any>(null);
  const [deleting, setDeleting] = useState(false);

  const limit = 20;

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api(`/api/admin/users?role=student&page=${page}&limit=${limit}`);
      setStudents(data.users);
      setTotal(data.total);
    } catch {
      setError('فشل تحميل الطلاب');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); api('/api/courses').then(setCourses).catch(() => {}); }, [page]);

  const openDetail = (student: any) => {
    api(`/api/admin/users/${student.id}`).then((data: any) => {
      setSelectedStudent(data);
      setDetailModal(true);
    }).catch(() => toast('فشل تحميل بيانات الطالب', 'error'));
  };

  const startEdit = (student: any) => {
    setEditForm({ name: student.name, email: student.email, phone: student.phone || '', password: '' });
    setEditStudent(student);
    setEditModal(true);
  };

  const saveEdit = async () => {
    try {
      const body: any = { name: editForm.name, email: editForm.email, phone: editForm.phone };
      if (editForm.password) body.password = editForm.password;
      await api(`/api/admin/users/${editStudent.id}`, { method: 'PUT', body: JSON.stringify(body) });
      toast('تم تحديث بيانات الطالب', 'success');
      setEditModal(false);
      if (detailModal) {
        const updated = await api(`/api/admin/users/${editStudent.id}`);
        setSelectedStudent(updated);
      }
      load();
    } catch {
      toast('فشل تحديث البيانات', 'error');
    }
  };

  const addStudent = async () => {
    try {
      await api('/api/admin/users', {
        method: 'POST',
        body: JSON.stringify({ ...addForm, role_id: 3 }),
      });
      toast('تم إضافة الطالب بنجاح', 'success');
      setAddModal(false);
      setAddForm({ name: '', email: '', password: '', phone: '' });
      load();
    } catch {
      toast('فشل إضافة الطالب', 'error');
    }
  };

  const toggleActive = async () => {
    if (!confirmToggle) return;
    try {
      if (Number(confirmToggle.is_active)) {
        await api(`/api/admin/users/${confirmToggle.id}`, { method: 'DELETE' });
        toast('تم تعطيل الطالب', 'success');
      } else {
        await api(`/api/admin/users/${confirmToggle.id}/reactivate`, { method: 'PUT' });
        toast('تم تفعيل الطالب', 'success');
      }
      setConfirmToggle(null);
      load();
    } catch {
      toast('فشل تغيير حالة الطالب', 'error');
    }
  };

  const deleteStudent = async () => {
    if (!confirmDelete) return;
    setDeleting(true);
    try {
      await api(`/api/admin/users/${confirmDelete.id}/hard`, { method: 'DELETE' });
      toast('تم حذف الطالب نهائياً', 'success');
      setConfirmDelete(null);
      setDetailModal(false);
      load();
    } catch {
      toast('فشل حذف الطالب', 'error');
    }
    setDeleting(false);
  };

  if (loading && students.length === 0) return <div className="space-y-4"><div className="flex items-center justify-between"><h1 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>الطلاب</h1></div><div className="rounded-2xl p-4 border" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}><Skeleton rows={8} cols={5} /></div></div>;
  if (error) return <div className="flex flex-col items-center justify-center h-64 gap-4"><p style={{ color: '#dc2626' }}>{error}</p><button onClick={load} className="px-4 py-2 bg-[var(--primary)] text-white rounded-xl text-sm">إعادة المحاولة</button></div>;

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>الطلاب</h1>
        <div className="flex gap-2">
          <button onClick={() => setAddModal(true)} className="px-4 py-2 rounded-xl text-white text-sm font-medium" style={{ backgroundColor: 'var(--primary)' }}>
            + إضافة طالب
          </button>
          <button onClick={() => setExportOpen(true)} className="px-4 py-2 rounded-xl text-white text-sm font-medium" style={{ backgroundColor: 'var(--primary)' }}>
            📥 تصدير
          </button>
        </div>
      </div>

      <div className="rounded-2xl p-4 border" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}>
        <DataTable
          columns={[
            { key: 'name', label: 'الاسم' },
            { key: 'email', label: 'البريد' },
            { key: 'phone', label: 'الهاتف', render: (v: string) => v || '-' },
            { key: 'is_active', label: 'الحالة', render: (v: any) => Number(v) ? '🟢 نشط' : '🔴 غير نشط' },
            { key: 'created_at', label: 'تاريخ التسجيل', render: (v: string) => new Date(v).toLocaleDateString('ar-EG') },
            { key: 'actions', label: 'الإجراءات', render: (_: any, row: any) => (
              <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                <button onClick={() => startEdit(row)}
                  className="px-2 py-1 rounded-lg text-xs font-medium bg-blue-50 text-blue-600 hover:bg-blue-100">تعديل</button>
                <button onClick={() => setConfirmToggle(row)}
                  className="px-2 py-1 rounded-lg text-xs font-medium"
                  style={{ backgroundColor: Number(row.is_active) ? '#fef2f2' : '#f0fdf4', color: Number(row.is_active) ? '#dc2626' : '#16a34a' }}>
                  {Number(row.is_active) ? 'تعطيل' : 'تفعيل'}
                </button>
                <button onClick={() => setConfirmDelete(row)}
                  className="px-2 py-1 rounded-lg text-xs font-medium bg-red-50 text-red-600 hover:bg-red-100">حذف</button>
              </div>
            )},
          ]}
          data={students}
          onRowClick={openDetail}
        />
        <Pagination page={page} total={total} limit={limit} onChange={setPage} />
      </div>

      <Modal open={detailModal} onClose={() => { setDetailModal(false); setSelectedStudent(null); }} title={selectedStudent?.name || 'بيانات الطالب'} size="lg">
        {selectedStudent && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="p-3 rounded-xl" style={{ backgroundColor: 'var(--bg)' }}>
                <span className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>البريد</span>
                <span style={{ color: 'var(--text)' }}>{selectedStudent.email}</span>
              </div>
              <div className="p-3 rounded-xl" style={{ backgroundColor: 'var(--bg)' }}>
                <span className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>الهاتف</span>
                <span style={{ color: 'var(--text)' }}>{selectedStudent.phone || '-'}</span>
              </div>
              <div className="p-3 rounded-xl" style={{ backgroundColor: 'var(--bg)' }}>
                <span className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>الحالة</span>
                <span>{Number(selectedStudent.is_active) ? '🟢 نشط' : '🔴 غير نشط'}</span>
              </div>
              <div className="p-3 rounded-xl" style={{ backgroundColor: 'var(--bg)' }}>
                <span className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>تاريخ التسجيل</span>
                <span style={{ color: 'var(--text)' }}>{new Date(selectedStudent.created_at).toLocaleDateString('ar-EG')}</span>
              </div>
            </div>

            <div className="rounded-xl p-3" style={{ backgroundColor: 'var(--bg)' }}>
              <h4 className="font-bold text-sm mb-2" style={{ color: 'var(--text)' }}>الطلبات ({selectedStudent.orders?.length || 0})</h4>
              {selectedStudent.orders?.length === 0 ? (
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>لا توجد طلبات</p>
              ) : (
                <div className="space-y-1 max-h-40 overflow-y-auto">
                  {selectedStudent.orders?.map((o: any) => (
                    <div key={o.id} className="flex items-center justify-between p-2 rounded-lg text-xs" style={{ backgroundColor: 'var(--card)' }}>
                      <span style={{ color: 'var(--text)' }}>{o.title_ar}</span>
                      <div className="flex items-center gap-2">
                        <span style={{ color: 'var(--text-muted)' }}>{o.amount} ج.م</span>
                        <StatusBadge status={o.status} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-xl p-3" style={{ backgroundColor: 'var(--bg)' }}>
              <h4 className="font-bold text-sm mb-2" style={{ color: 'var(--text)' }}>المجموعات ({selectedStudent.groups?.length || 0})</h4>
              {selectedStudent.groups?.length === 0 ? (
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>لا توجد مجموعات</p>
              ) : (
                <div className="flex flex-wrap gap-1">
                  {selectedStudent.groups?.map((g: any) => (
                    <span key={g.id} className="px-2 py-1 rounded-lg text-xs" style={{ backgroundColor: 'var(--card)', color: 'var(--text)' }}>
                      {g.name} ({g.course_name})
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="flex gap-2 pt-2 border-t" style={{ borderColor: 'var(--border)' }}>
              <button onClick={() => { setDetailModal(false); startEdit(selectedStudent); }} className="flex-1 py-2.5 rounded-xl text-sm font-medium text-white" style={{ backgroundColor: 'var(--primary)' }}>✏️ تعديل البيانات</button>
              <button onClick={() => { setDetailModal(false); setConfirmDelete(selectedStudent); }} className="px-3 py-2.5 rounded-xl text-sm font-medium text-white" style={{ backgroundColor: '#dc2626' }}>🗑️ حذف</button>
            </div>
          </div>
        )}
      </Modal>

      <Modal open={editModal} onClose={() => setEditModal(false)} title={`تعديل: ${editStudent?.name || ''}`}>
        <div className="space-y-3">
          <input placeholder="الاسم" value={editForm.name}
            onChange={e => setEditForm({ ...editForm, name: e.target.value })}
            className="w-full px-4 py-2.5 rounded-xl border text-sm" style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }} />
          <input placeholder="البريد الإلكتروني" type="email" value={editForm.email}
            onChange={e => setEditForm({ ...editForm, email: e.target.value })}
            className="w-full px-4 py-2.5 rounded-xl border text-sm" style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }} />
          <input placeholder="رقم الهاتف" value={editForm.phone}
            onChange={e => setEditForm({ ...editForm, phone: e.target.value })}
            className="w-full px-4 py-2.5 rounded-xl border text-sm" style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }} />
          <input placeholder="كلمة المرور (اترك فارغاً إن لم ترد التغيير)" type="password" value={editForm.password}
            onChange={e => setEditForm({ ...editForm, password: e.target.value })}
            className="w-full px-4 py-2.5 rounded-xl border text-sm" style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }} />
          <button onClick={saveEdit} className="w-full py-3 bg-[var(--primary)] text-white rounded-xl font-medium">حفظ التعديلات</button>
        </div>
      </Modal>

      <Modal open={addModal} onClose={() => setAddModal(false)} title="إضافة طالب جديد">
        <div className="space-y-3">
          <input placeholder="الاسم" value={addForm.name}
            onChange={e => setAddForm({ ...addForm, name: e.target.value })}
            className="w-full px-4 py-2.5 rounded-xl border text-sm" style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }} />
          <input placeholder="البريد الإلكتروني" type="email" value={addForm.email}
            onChange={e => setAddForm({ ...addForm, email: e.target.value })}
            className="w-full px-4 py-2.5 rounded-xl border text-sm" style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }} />
          <input placeholder="كلمة المرور" type="password" value={addForm.password}
            onChange={e => setAddForm({ ...addForm, password: e.target.value })}
            className="w-full px-4 py-2.5 rounded-xl border text-sm" style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }} />
          <input placeholder="رقم الهاتف" value={addForm.phone}
            onChange={e => setAddForm({ ...addForm, phone: e.target.value })}
            className="w-full px-4 py-2.5 rounded-xl border text-sm" style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }} />
          <button onClick={addStudent} className="w-full py-3 bg-[var(--primary)] text-white rounded-xl font-medium">إضافة</button>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!confirmToggle}
        title={Number(confirmToggle?.is_active) ? 'تعطيل الطالب' : 'تفعيل الطالب'}
        message={Number(confirmToggle?.is_active) ? `تعطيل "${confirmToggle?.name}"؟ لن يتمكن من تسجيل الدخول.` : `تفعيل "${confirmToggle?.name}"؟`}
        confirmLabel={Number(confirmToggle?.is_active) ? 'تعطيل' : 'تفعيل'}
        variant={Number(confirmToggle?.is_active) ? 'danger' : 'info'}
        onConfirm={toggleActive}
        onCancel={() => setConfirmToggle(null)}
      />

      <ConfirmDialog
        open={!!confirmDelete}
        title="حذف الطالب"
        message={`حذف "${confirmDelete?.name}" نهائياً؟ سيتم حذف جميع طلباته وشهاداته.`}
        confirmLabel="حذف"
        variant="danger"
        onConfirm={deleteStudent}
        onCancel={() => setConfirmDelete(null)}
        loading={deleting}
      />

      <ExportModal open={exportOpen} onClose={() => setExportOpen(false)}
        title="تصدير الطلاب بكورس" endpoint="/api/exports/students/:courseId" filename="students"
        showCoursePicker courses={courses.map((c: any) => ({ id: c.id, name_ar: c.title_ar }))} />
    </div>
  );
}
