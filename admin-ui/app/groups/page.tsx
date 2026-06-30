'use client';

import { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import DataTable from '../../components/DataTable';
import Modal from '../../components/Modal';
import ConfirmDialog from '../../components/ConfirmDialog';
import Skeleton from '../../components/Skeleton';
import { useToast } from '../../components/Toast';

export default function GroupsPage() {
  const { toast } = useToast();
  const [groups, setGroups] = useState<any[]>([]);
  const [courses, setCourses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [addModal, setAddModal] = useState(false);
  const [form, setForm] = useState({ name: '', course_id: '', schedule: '' });

  const [editModal, setEditModal] = useState(false);
  const [editForm, setEditForm] = useState<any>({});
  const [editingId, setEditingId] = useState<number | null>(null);

  const [detailModal, setDetailModal] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<any>(null);
  const [groupStudents, setGroupStudents] = useState<any[]>([]);
  const [studentsLoading, setStudentsLoading] = useState(false);

  const [addStudentModal, setAddStudentModal] = useState(false);
  const [allStudents, setAllStudents] = useState<any[]>([]);
  const [selectedStudentIds, setSelectedStudentIds] = useState<number[]>([]);
  const [studentSearch, setStudentSearch] = useState('');

  const [confirmDelete, setConfirmDelete] = useState<any>(null);
  const [confirmToggle, setConfirmToggle] = useState<any>(null);
  const [confirmRemoveStudent, setConfirmRemoveStudent] = useState<any>(null);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [g, c] = await Promise.all([api('/api/groups'), api('/api/courses')]);
      setGroups(g);
      setCourses(c);
    } catch {
      setError('فشل تحميل البيانات');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const save = async () => {
    try {
      await api('/api/groups', {
        method: 'POST',
        body: JSON.stringify({ ...form, course_id: Number(form.course_id) }),
      });
      setAddModal(false);
      setForm({ name: '', course_id: '', schedule: '' });
      toast('تم إضافة المجموعة', 'success');
      load();
    } catch {
      toast('فشل إضافة المجموعة', 'error');
    }
  };

  const startEdit = (row: any) => {
    setEditingId(row.id);
    setEditForm({ name: row.name, course_id: row.course_id?.toString() || '', schedule: row.schedule || '', is_active: Number(row.is_active) });
    setEditModal(true);
  };

  const saveEdit = async () => {
    try {
      await api(`/api/groups/${editingId}`, {
        method: 'PUT',
        body: JSON.stringify({ ...editForm, course_id: Number(editForm.course_id) }),
      });
      setEditModal(false);
      setEditingId(null);
      toast('تم تحديث المجموعة', 'success');
      load();
    } catch {
      toast('فشل تحديث المجموعة', 'error');
    }
  };

  const openDetail = async (group: any) => {
    setSelectedGroup(group);
    setDetailModal(true);
    setStudentsLoading(true);
    try {
      const students = await api(`/api/groups/${group.id}/students`);
      setGroupStudents(students);
    } catch {
      toast('فشل تحميل الطلاب', 'error');
      setGroupStudents([]);
    }
    setStudentsLoading(false);
  };

  const openAddStudent = async () => {
    setAddStudentModal(true);
    setSelectedStudentIds([]);
    setStudentSearch('');
    try {
      const data = await api('/api/admin/users?role=student&limit=500');
      setAllStudents(data.users || []);
    } catch {
      toast('فشل تحميل قائمة الطلاب', 'error');
      setAllStudents([]);
    }
  };

  const addStudentsToGroup = async () => {
    if (selectedStudentIds.length === 0) return;
    try {
      await api(`/api/groups/${selectedGroup.id}/students`, {
        method: 'POST',
        body: JSON.stringify({ user_ids: selectedStudentIds }),
      });
      toast(`تم إضافة ${selectedStudentIds.length} طالب`, 'success');
      setAddStudentModal(false);
      const students = await api(`/api/groups/${selectedGroup.id}/students`);
      setGroupStudents(students);
      load();
    } catch {
      toast('فشل إضافة الطلاب', 'error');
    }
  };

  const removeStudent = async () => {
    if (!confirmRemoveStudent) return;
    try {
      await api(`/api/groups/${selectedGroup.id}/students/${confirmRemoveStudent.id}`, { method: 'DELETE' });
      toast('تم حذف الطالب من المجموعة', 'success');
      setConfirmRemoveStudent(null);
      const students = await api(`/api/groups/${selectedGroup.id}/students`);
      setGroupStudents(students);
      load();
    } catch {
      toast('فشل حذف الطالب', 'error');
    }
  };

  const toggleActive = async () => {
    if (!confirmToggle) return;
    try {
      await api(`/api/groups/${confirmToggle.id}`, {
        method: 'PUT',
        body: JSON.stringify({ is_active: Number(confirmToggle.is_active) ? 0 : 1 }),
      });
      toast(Number(confirmToggle.is_active) ? 'تم تعطيل المجموعة' : 'تم تفعيل المجموعة', 'success');
      setConfirmToggle(null);
      load();
    } catch {
      toast('فشل تغيير الحالة', 'error');
    }
  };

  const deleteGroup = async () => {
    if (!confirmDelete) return;
    try {
      await api(`/api/groups/${confirmDelete.id}`, { method: 'DELETE' });
      toast('تم حذف المجموعة', 'success');
      setConfirmDelete(null);
      setDetailModal(false);
      load();
    } catch {
      toast('فشل حذف المجموعة', 'error');
    }
  };

  const toggleStudentSelect = (id: number) => {
    setSelectedStudentIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const filteredStudents = allStudents.filter((s: any) =>
    !studentSearch || s.name.includes(studentSearch) || s.email.includes(studentSearch) || s.phone?.includes(studentSearch)
  );

  if (loading) return <div className="space-y-4"><div className="flex items-center justify-between"><h1 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>المجموعات</h1></div><div className="rounded-2xl p-4 border" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}><Skeleton rows={6} cols={5} /></div></div>;
  if (error) return <div className="flex flex-col items-center justify-center h-64 gap-4"><p style={{ color: '#dc2626' }}>{error}</p><button onClick={load} className="px-4 py-2 bg-[var(--primary)] text-white rounded-xl text-sm">إعادة المحاولة</button></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>المجموعات</h1>
        <button onClick={() => setAddModal(true)}
          className="px-4 py-2 bg-[var(--primary)] text-white rounded-xl text-sm font-medium">+ إضافة مجموعة</button>
      </div>

      <div className="rounded-2xl p-4" style={{ backgroundColor: 'var(--card)' }}>
        <DataTable
          columns={[
            { key: 'name', label: 'اسم المجموعة' },
            { key: 'course_name', label: 'الكورس' },
            { key: 'student_count', label: 'عدد الطلاب', render: (v: number) => `${v || 0} طالب` },
            { key: 'is_active', label: 'الحالة', render: (v: any) => Number(v) ? '🟢 نشط' : '🔴 غير نشط' },
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
          data={groups}
          onRowClick={openDetail}
        />
      </div>

      <Modal open={addModal} onClose={() => setAddModal(false)} title="إضافة مجموعة جديدة">
        <div className="space-y-3">
          <input placeholder="اسم المجموعة" value={form.name}
            onChange={e => setForm({ ...form, name: e.target.value })}
            className="w-full px-4 py-2.5 rounded-xl border text-sm" style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }} />
          <select value={form.course_id} onChange={e => setForm({ ...form, course_id: e.target.value })}
            className="w-full px-4 py-2.5 rounded-xl border text-sm" style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }}>
            <option value="">اختر الكورس</option>
            {courses.map((c: any) => <option key={c.id} value={c.id}>{c.title_ar}</option>)}
          </select>
          <input placeholder="الموعد (مثال: السبت 7-9 م)" value={form.schedule}
            onChange={e => setForm({ ...form, schedule: e.target.value })}
            className="w-full px-4 py-2.5 rounded-xl border text-sm" style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }} />
          <button onClick={save} className="w-full py-3 bg-[var(--primary)] text-white rounded-xl font-medium">حفظ</button>
        </div>
      </Modal>

      <Modal open={editModal} onClose={() => setEditModal(false)} title="تعديل المجموعة">
        <div className="space-y-3">
          <input placeholder="اسم المجموعة" value={editForm.name}
            onChange={e => setEditForm({ ...editForm, name: e.target.value })}
            className="w-full px-4 py-2.5 rounded-xl border text-sm" style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }} />
          <select value={editForm.course_id} onChange={e => setEditForm({ ...editForm, course_id: e.target.value })}
            className="w-full px-4 py-2.5 rounded-xl border text-sm" style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }}>
            <option value="">اختر الكورس</option>
            {courses.map((c: any) => <option key={c.id} value={c.id}>{c.title_ar}</option>)}
          </select>
          <input placeholder="الموعد" value={editForm.schedule}
            onChange={e => setEditForm({ ...editForm, schedule: e.target.value })}
            className="w-full px-4 py-2.5 rounded-xl border text-sm" style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }} />
          <button onClick={saveEdit} className="w-full py-3 bg-[var(--primary)] text-white rounded-xl font-medium">حفظ التعديلات</button>
        </div>
      </Modal>

      <Modal open={detailModal} onClose={() => setDetailModal(false)} title={selectedGroup?.name || 'المجموعة'} size="lg">
        {selectedGroup && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="p-3 rounded-xl" style={{ backgroundColor: 'var(--bg)' }}>
                <span className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>الكورس</span>
                <span style={{ color: 'var(--text)' }}>{selectedGroup.course_name}</span>
              </div>
              <div className="p-3 rounded-xl" style={{ backgroundColor: 'var(--bg)' }}>
                <span className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>عدد الطلاب</span>
                <span style={{ color: 'var(--text)' }}>{groupStudents.length} طالب</span>
              </div>
              {selectedGroup.schedule && (
                <div className="p-3 rounded-xl col-span-2" style={{ backgroundColor: 'var(--bg)' }}>
                  <span className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>الموعد</span>
                  <span style={{ color: 'var(--text)' }}>{selectedGroup.schedule}</span>
                </div>
              )}
            </div>

            <div className="rounded-xl p-3" style={{ backgroundColor: 'var(--bg)' }}>
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-bold text-sm" style={{ color: 'var(--text)' }}>الطلاب المسجلين</h4>
                <button onClick={openAddStudent} className="px-3 py-1.5 rounded-lg text-xs font-medium text-white" style={{ backgroundColor: 'var(--primary)' }}>+ إضافة طالب</button>
              </div>
              {studentsLoading ? (
                <div className="animate-spin h-5 w-5 border-2 rounded-full mx-auto" style={{ borderColor: 'var(--primary)', borderTopColor: 'transparent' }} />
              ) : groupStudents.length === 0 ? (
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>لا يوجد طلاب في هذه المجموعة</p>
              ) : (
                <div className="space-y-1 max-h-60 overflow-y-auto">
                  {groupStudents.map((s: any) => (
                    <div key={s.id} className="flex items-center justify-between p-2 rounded-lg text-xs" style={{ backgroundColor: 'var(--card)' }}>
                      <div>
                        <span style={{ color: 'var(--text)' }}>{s.name}</span>
                        <span className="mr-2" style={{ color: 'var(--text-muted)' }}>{s.email}</span>
                      </div>
                      <button onClick={() => setConfirmRemoveStudent(s)}
                        className="px-2 py-1 rounded text-red-600 hover:bg-red-50">✕</button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex gap-2 pt-2 border-t" style={{ borderColor: 'var(--border)' }}>
              <button onClick={() => { setDetailModal(false); startEdit(selectedGroup); }} className="flex-1 py-2.5 rounded-xl text-sm font-medium text-white" style={{ backgroundColor: 'var(--primary)' }}>✏️ تعديل</button>
              <button onClick={() => { setDetailModal(false); setConfirmDelete(selectedGroup); }} className="px-3 py-2.5 rounded-xl text-sm font-medium text-white" style={{ backgroundColor: '#dc2626' }}>🗑️ حذف</button>
            </div>
          </div>
        )}
      </Modal>

      <Modal open={addStudentModal} onClose={() => setAddStudentModal(false)} title="إضافة طلاب للمجموعة" size="lg">
        <div className="space-y-3">
          <input type="text" placeholder="بحث عن طالب..." value={studentSearch}
            onChange={e => setStudentSearch(e.target.value)}
            className="w-full px-4 py-2.5 rounded-xl border text-sm" style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }} />
          <div className="max-h-60 overflow-y-auto space-y-1">
            {filteredStudents.length === 0 ? (
              <p className="text-xs text-center py-4" style={{ color: 'var(--text-muted)' }}>لا توجد نتائج</p>
            ) : filteredStudents.map((s: any) => (
              <label key={s.id}
                className="flex items-center gap-3 p-2 rounded-lg text-sm cursor-pointer"
                style={{ backgroundColor: selectedStudentIds.includes(s.id) ? 'var(--primary)' : 'var(--bg)', color: selectedStudentIds.includes(s.id) ? '#fff' : 'var(--text)' }}>
                <input type="checkbox" checked={selectedStudentIds.includes(s.id)}
                  onChange={() => toggleStudentSelect(s.id)} className="accent-white" />
                <span>{s.name}</span>
                <span className="text-xs" style={{ opacity: 0.7 }}>{s.email}</span>
              </label>
            ))}
          </div>
          <button onClick={addStudentsToGroup} disabled={selectedStudentIds.length === 0}
            className="w-full py-3 rounded-xl text-white font-medium disabled:opacity-50"
            style={{ backgroundColor: 'var(--primary)' }}>
            إضافة {selectedStudentIds.length > 0 ? `(${selectedStudentIds.length})` : ''}
          </button>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!confirmToggle}
        title={Number(confirmToggle?.is_active) ? 'تعطيل المجموعة' : 'تفعيل المجموعة'}
        message={Number(confirmToggle?.is_active) ? `تعطيل "${confirmToggle?.name}"؟` : `تفعيل "${confirmToggle?.name}"؟`}
        confirmLabel={Number(confirmToggle?.is_active) ? 'تعطيل' : 'تفعيل'}
        variant={Number(confirmToggle?.is_active) ? 'warning' : 'info'}
        onConfirm={toggleActive}
        onCancel={() => setConfirmToggle(null)}
      />

      <ConfirmDialog
        open={!!confirmDelete}
        title="حذف المجموعة"
        message={`حذف "${confirmDelete?.name}" نهائياً؟ سيتم إزالة جميع الطلاب منها.`}
        confirmLabel="حذف"
        variant="danger"
        onConfirm={deleteGroup}
        onCancel={() => setConfirmDelete(null)}
      />

      <ConfirmDialog
        open={!!confirmRemoveStudent}
        title="حذف طالب من المجموعة"
        message={`إزالة "${confirmRemoveStudent?.name}" من المجموعة؟`}
        confirmLabel="إزالة"
        variant="danger"
        onConfirm={removeStudent}
        onCancel={() => setConfirmRemoveStudent(null)}
      />
    </div>
  );
}
