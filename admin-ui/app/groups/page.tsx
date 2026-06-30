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
  const [form, setForm] = useState({ name: '', course_id: '', schedule: '', instructor_name: '', location: '', max_students: '', start_date: '', end_date: '' });

  const [editModal, setEditModal] = useState(false);
  const [editForm, setEditForm] = useState<any>({});
  const [editingId, setEditingId] = useState<number | null>(null);

  const [detailModal, setDetailModal] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<any>(null);
  const [detailTab, setDetailTab] = useState<'info' | 'lectures' | 'students'>('info');

  const [groupStudents, setGroupStudents] = useState<any[]>([]);
  const [studentsLoading, setStudentsLoading] = useState(false);

  // Lectures
  const [lectures, setLectures] = useState<any[]>([]);
  const [lecturesLoading, setLecturesLoading] = useState(false);
  const [lectureForm, setLectureForm] = useState({ day_of_week: '', time_from: '', time_to: '', topic: '', date: '' });
  const [addLectureModal, setAddLectureModal] = useState(false);
  const [editLectureModal, setEditLectureModal] = useState(false);
  const [editLectureForm, setEditLectureForm] = useState<any>({});
  const [editingLectureId, setEditingLectureId] = useState<number | null>(null);

  const [addStudentModal, setAddStudentModal] = useState(false);
  const [allStudents, setAllStudents] = useState<any[]>([]);
  const [selectedStudentIds, setSelectedStudentIds] = useState<number[]>([]);
  const [studentSearch, setStudentSearch] = useState('');

  const [confirmDelete, setConfirmDelete] = useState<any>(null);
  const [confirmToggle, setConfirmToggle] = useState<any>(null);
  const [confirmRemoveStudent, setConfirmRemoveStudent] = useState<any>(null);
  const [confirmDeleteLecture, setConfirmDeleteLecture] = useState<any>(null);

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

  const loadLectures = async (groupId: number) => {
    setLecturesLoading(true);
    try {
      const data = await api(`/api/lectures/${groupId}`);
      setLectures(data);
    } catch {
      toast('فشل تحميل المحاضرات', 'error');
      setLectures([]);
    }
    setLecturesLoading(false);
  };

  const save = async () => {
    try {
      await api('/api/groups', {
        method: 'POST',
        body: JSON.stringify({ ...form, course_id: Number(form.course_id), max_students: form.max_students ? Number(form.max_students) : null }),
      });
      setAddModal(false);
      setForm({ name: '', course_id: '', schedule: '', instructor_name: '', location: '', max_students: '', start_date: '', end_date: '' });
      toast('تم إضافة المجموعة', 'success');
      load();
    } catch {
      toast('فشل إضافة المجموعة', 'error');
    }
  };

  const startEdit = (row: any) => {
    setEditingId(row.id);
    setEditForm({
      name: row.name,
      course_id: row.course_id?.toString() || '',
      schedule: row.schedule || '',
      is_active: Number(row.is_active),
      instructor_name: row.instructor_name || '',
      location: row.location || '',
      max_students: row.max_students?.toString() || '',
      start_date: row.start_date || '',
      end_date: row.end_date || '',
    });
    setEditModal(true);
  };

  const saveEdit = async () => {
    try {
      await api(`/api/groups/${editingId}`, {
        method: 'PUT',
        body: JSON.stringify({ ...editForm, course_id: Number(editForm.course_id), max_students: editForm.max_students ? Number(editForm.max_students) : null }),
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
    setDetailTab('info');
    setStudentsLoading(true);
    loadLectures(group.id);
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

  // Lecture handlers
  const saveLecture = async () => {
    try {
      await api(`/api/lectures/${selectedGroup.id}`, {
        method: 'POST',
        body: JSON.stringify(lectureForm),
      });
      setAddLectureModal(false);
      setLectureForm({ day_of_week: '', time_from: '', time_to: '', topic: '', date: '' });
      toast('تم إضافة المحاضرة', 'success');
      loadLectures(selectedGroup.id);
      load();
    } catch {
      toast('فشل إضافة المحاضرة', 'error');
    }
  };

  const startEditLecture = (lec: any) => {
    setEditingLectureId(lec.id);
    setEditLectureForm({
      day_of_week: lec.day_of_week || '',
      time_from: lec.time_from || '',
      time_to: lec.time_to || '',
      topic: lec.topic || '',
      date: lec.date || '',
    });
    setEditLectureModal(true);
  };

  const saveEditLecture = async () => {
    try {
      await api(`/api/lectures/${selectedGroup.id}/${editingLectureId}`, {
        method: 'PUT',
        body: JSON.stringify(editLectureForm),
      });
      setEditLectureModal(false);
      setEditingLectureId(null);
      toast('تم تحديث المحاضرة', 'success');
      loadLectures(selectedGroup.id);
      load();
    } catch {
      toast('فشل تحديث المحاضرة', 'error');
    }
  };

  const toggleLecture = async (lec: any) => {
    try {
      const res = await api(`/api/lectures/${selectedGroup.id}/${lec.id}/toggle`, { method: 'PATCH' });
      toast(res.is_completed ? 'تم إتمام المحاضرة' : 'تم إلغاء الإتمام', 'success');
      loadLectures(selectedGroup.id);
      load();
    } catch {
      toast('فشل تغيير حالة المحاضرة', 'error');
    }
  };

  const deleteLecture = async () => {
    if (!confirmDeleteLecture) return;
    try {
      await api(`/api/lectures/${selectedGroup.id}/${confirmDeleteLecture.id}`, { method: 'DELETE' });
      toast('تم حذف المحاضرة', 'success');
      setConfirmDeleteLecture(null);
      loadLectures(selectedGroup.id);
      load();
    } catch {
      toast('فشل حذف المحاضرة', 'error');
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

  const daysOfWeek = ['السبت', 'الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة'];

  if (loading) return <div className="space-y-4"><div className="flex items-center justify-between"><h1 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>المجموعات</h1></div><div className="rounded-2xl p-4 border" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}><Skeleton rows={6} cols={6} /></div></div>;
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
            { key: 'instructor_name', label: 'المدرب' },
            { key: 'student_count', label: 'عدد الطلاب', render: (v: number) => `${v || 0} طالب` },
            { key: 'is_active', label: 'نشط؟', render: (v: any) => Number(v) ? '🟢' : '🔴' },
            { key: 'is_complete', label: 'مكتملة؟', render: (v: any) => Number(v) ? '✅ مكتملة' : '⏳ غير مكتملة' },
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

      {/* Add Group Modal */}
      <Modal open={addModal} onClose={() => setAddModal(false)} title="إضافة مجموعة جديدة" size="lg">
        <div className="grid grid-cols-2 gap-3">
          <input placeholder="اسم المجموعة" value={form.name}
            onChange={e => setForm({ ...form, name: e.target.value })}
            className="col-span-2 w-full px-4 py-2.5 rounded-xl border text-sm" style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }} />
          <select value={form.course_id} onChange={e => setForm({ ...form, course_id: e.target.value })}
            className="w-full px-4 py-2.5 rounded-xl border text-sm" style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }}>
            <option value="">اختر الكورس</option>
            {courses.map((c: any) => <option key={c.id} value={c.id}>{c.title_ar}</option>)}
          </select>
          <input placeholder="اسم المدرب" value={form.instructor_name}
            onChange={e => setForm({ ...form, instructor_name: e.target.value })}
            className="w-full px-4 py-2.5 rounded-xl border text-sm" style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }} />
          <input placeholder="المكان" value={form.location}
            onChange={e => setForm({ ...form, location: e.target.value })}
            className="w-full px-4 py-2.5 rounded-xl border text-sm" style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }} />
          <input placeholder="الحد الأقصى للطلاب" type="number" value={form.max_students}
            onChange={e => setForm({ ...form, max_students: e.target.value })}
            className="w-full px-4 py-2.5 rounded-xl border text-sm" style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }} />
          <input placeholder="الموعد (مثال: السبت 7-9 م)" value={form.schedule}
            onChange={e => setForm({ ...form, schedule: e.target.value })}
            className="w-full px-4 py-2.5 rounded-xl border text-sm" style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }} />
          <input placeholder="تاريخ البداية" type="date" value={form.start_date}
            onChange={e => setForm({ ...form, start_date: e.target.value })}
            className="w-full px-4 py-2.5 rounded-xl border text-sm" style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }} />
          <input placeholder="تاريخ النهاية" type="date" value={form.end_date}
            onChange={e => setForm({ ...form, end_date: e.target.value })}
            className="w-full px-4 py-2.5 rounded-xl border text-sm" style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }} />
          <button onClick={save} className="col-span-2 w-full py-3 bg-[var(--primary)] text-white rounded-xl font-medium">حفظ</button>
        </div>
      </Modal>

      {/* Edit Group Modal */}
      <Modal open={editModal} onClose={() => setEditModal(false)} title="تعديل المجموعة" size="lg">
        <div className="grid grid-cols-2 gap-3">
          <input placeholder="اسم المجموعة" value={editForm.name}
            onChange={e => setEditForm({ ...editForm, name: e.target.value })}
            className="col-span-2 w-full px-4 py-2.5 rounded-xl border text-sm" style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }} />
          <select value={editForm.course_id} onChange={e => setEditForm({ ...editForm, course_id: e.target.value })}
            className="w-full px-4 py-2.5 rounded-xl border text-sm" style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }}>
            <option value="">اختر الكورس</option>
            {courses.map((c: any) => <option key={c.id} value={c.id}>{c.title_ar}</option>)}
          </select>
          <input placeholder="اسم المدرب" value={editForm.instructor_name}
            onChange={e => setEditForm({ ...editForm, instructor_name: e.target.value })}
            className="w-full px-4 py-2.5 rounded-xl border text-sm" style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }} />
          <input placeholder="المكان" value={editForm.location}
            onChange={e => setEditForm({ ...editForm, location: e.target.value })}
            className="w-full px-4 py-2.5 rounded-xl border text-sm" style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }} />
          <input placeholder="الحد الأقصى للطلاب" type="number" value={editForm.max_students}
            onChange={e => setEditForm({ ...editForm, max_students: e.target.value })}
            className="w-full px-4 py-2.5 rounded-xl border text-sm" style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }} />
          <input placeholder="الموعد" value={editForm.schedule}
            onChange={e => setEditForm({ ...editForm, schedule: e.target.value })}
            className="w-full px-4 py-2.5 rounded-xl border text-sm" style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }} />
          <input placeholder="تاريخ البداية" type="date" value={editForm.start_date}
            onChange={e => setEditForm({ ...editForm, start_date: e.target.value })}
            className="w-full px-4 py-2.5 rounded-xl border text-sm" style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }} />
          <input placeholder="تاريخ النهاية" type="date" value={editForm.end_date}
            onChange={e => setEditForm({ ...editForm, end_date: e.target.value })}
            className="w-full px-4 py-2.5 rounded-xl border text-sm" style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }} />
          <button onClick={saveEdit} className="col-span-2 w-full py-3 bg-[var(--primary)] text-white rounded-xl font-medium">حفظ التعديلات</button>
        </div>
      </Modal>

      {/* Detail Modal with Tabs */}
      <Modal open={detailModal} onClose={() => setDetailModal(false)} title={selectedGroup?.name || 'المجموعة'} size="xl">
        {selectedGroup && (
          <div className="space-y-4">
            {/* Tabs */}
            <div className="flex gap-1 border-b pb-2" style={{ borderColor: 'var(--border)' }}>
              {(['info', 'lectures', 'students'] as const).map(tab => (
                <button key={tab} onClick={() => setDetailTab(tab)}
                  className="px-4 py-2 rounded-lg text-sm font-medium transition-all"
                  style={{
                    backgroundColor: detailTab === tab ? 'var(--primary)' : 'transparent',
                    color: detailTab === tab ? '#fff' : 'var(--text)',
                  }}>
                  {tab === 'info' ? 'معلومات' : tab === 'lectures' ? 'جدول المحاضرات' : 'الطلاب'}
                </button>
              ))}
            </div>

            {/* Tab content */}
            {detailTab === 'info' && (
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="p-3 rounded-xl" style={{ backgroundColor: 'var(--bg)' }}>
                  <span className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>الكورس</span>
                  <span style={{ color: 'var(--text)' }}>{selectedGroup.course_name}</span>
                </div>
                <div className="p-3 rounded-xl" style={{ backgroundColor: 'var(--bg)' }}>
                  <span className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>عدد الطلاب</span>
                  <span style={{ color: 'var(--text)' }}>{groupStudents.length} طالب</span>
                </div>
                {selectedGroup.instructor_name && (
                  <div className="p-3 rounded-xl" style={{ backgroundColor: 'var(--bg)' }}>
                    <span className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>المدرب</span>
                    <span style={{ color: 'var(--text)' }}>{selectedGroup.instructor_name}</span>
                  </div>
                )}
                {selectedGroup.location && (
                  <div className="p-3 rounded-xl" style={{ backgroundColor: 'var(--bg)' }}>
                    <span className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>المكان</span>
                    <span style={{ color: 'var(--text)' }}>{selectedGroup.location}</span>
                  </div>
                )}
                {selectedGroup.schedule && (
                  <div className="p-3 rounded-xl col-span-2" style={{ backgroundColor: 'var(--bg)' }}>
                    <span className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>الموعد</span>
                    <span style={{ color: 'var(--text)' }}>{typeof selectedGroup.schedule === 'object' ? JSON.stringify(selectedGroup.schedule) : selectedGroup.schedule}</span>
                  </div>
                )}
                {selectedGroup.start_date && (
                  <div className="p-3 rounded-xl" style={{ backgroundColor: 'var(--bg)' }}>
                    <span className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>تاريخ البداية</span>
                    <span style={{ color: 'var(--text)' }}>{selectedGroup.start_date}</span>
                  </div>
                )}
                {selectedGroup.end_date && (
                  <div className="p-3 rounded-xl" style={{ backgroundColor: 'var(--bg)' }}>
                    <span className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>تاريخ النهاية</span>
                    <span style={{ color: 'var(--text)' }}>{selectedGroup.end_date}</span>
                  </div>
                )}
                <div className="p-3 rounded-xl" style={{ backgroundColor: 'var(--bg)' }}>
                  <span className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>الحالة</span>
                  <span style={{ color: 'var(--text)' }}>
                    {Number(selectedGroup.is_complete) ? '✅ مكتملة' : '⏳ غير مكتملة'}
                    {Number(selectedGroup.is_active) ? '' : ' (غير نشطة)'}
                  </span>
                </div>
                <div className="p-3 rounded-xl" style={{ backgroundColor: 'var(--bg)' }}>
                  <span className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>تقدم المحاضرات</span>
                  <span style={{ color: 'var(--text)' }}>
                    {selectedGroup.lecture_done || 0} / {selectedGroup.lecture_count || 0}
                  </span>
                </div>
              </div>
            )}

            {detailTab === 'lectures' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-sm" style={{ color: 'var(--text)' }}>جدول المحاضرات</h4>
                  <button onClick={() => { setAddLectureModal(true); setLectureForm({ day_of_week: '', time_from: '', time_to: '', topic: '', date: '' }); }}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium text-white" style={{ backgroundColor: 'var(--primary)' }}>+ إضافة محاضرة</button>
                </div>
                {lecturesLoading ? (
                  <div className="animate-spin h-5 w-5 border-2 rounded-full mx-auto" style={{ borderColor: 'var(--primary)', borderTopColor: 'transparent' }} />
                ) : lectures.length === 0 ? (
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>لا توجد محاضرات مضافة بعد</p>
                ) : (
                  <div className="space-y-2 max-h-80 overflow-y-auto">
                    {lectures.map((lec: any) => (
                      <div key={lec.id} className="flex items-center justify-between p-3 rounded-xl text-sm" style={{ backgroundColor: 'var(--bg)' }}>
                        <div className="flex items-center gap-3 flex-1">
                          <div className="flex items-center gap-1 min-w-[90px]">
                            <span style={{ color: Number(lec.is_completed) ? '#16a34a' : '#dc2626' }}>
                              {Number(lec.is_completed) ? '✅' : '⬜'}
                            </span>
                            <span style={{ color: 'var(--text)' }}>{daysOfWeek[Number(lec.day_of_week)] || lec.day_of_week}</span>
                          </div>
                          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{lec.time_from} - {lec.time_to}</span>
                          {lec.topic && <span className="text-xs font-medium" style={{ color: 'var(--text)' }}>{lec.topic}</span>}
                          {lec.date && <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{lec.date}</span>}
                        </div>
                        <div className="flex gap-1 items-center">
                          <button onClick={() => toggleLecture(lec)}
                            className="px-2 py-1 rounded text-xs font-medium"
                            style={{ backgroundColor: Number(lec.is_completed) ? '#fef2f2' : '#f0fdf4', color: Number(lec.is_completed) ? '#dc2626' : '#16a34a' }}>
                            {Number(lec.is_completed) ? 'إلغاء' : 'إتمام'}
                          </button>
                          <button onClick={() => { startEditLecture(lec); }}
                            className="px-2 py-1 rounded text-xs font-medium bg-blue-50 text-blue-600 hover:bg-blue-100">تعديل</button>
                          <button onClick={() => setConfirmDeleteLecture(lec)}
                            className="px-2 py-1 rounded text-xs font-medium bg-red-50 text-red-600 hover:bg-red-100">✕</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {detailTab === 'students' && (
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
            )}

            <div className="flex gap-2 pt-2 border-t" style={{ borderColor: 'var(--border)' }}>
              <button onClick={() => { setDetailModal(false); startEdit(selectedGroup); }} className="flex-1 py-2.5 rounded-xl text-sm font-medium text-white" style={{ backgroundColor: 'var(--primary)' }}>تعديل المجموعة</button>
              <button onClick={() => { setDetailModal(false); setConfirmDelete(selectedGroup); }} className="px-3 py-2.5 rounded-xl text-sm font-medium text-white" style={{ backgroundColor: '#dc2626' }}>حذف</button>
            </div>
          </div>
        )}
      </Modal>

      {/* Add Lecture Modal */}
      <Modal open={addLectureModal} onClose={() => setAddLectureModal(false)} title="إضافة محاضرة">
        <div className="space-y-3">
          <select value={lectureForm.day_of_week} onChange={e => setLectureForm({ ...lectureForm, day_of_week: e.target.value })}
            className="w-full px-4 py-2.5 rounded-xl border text-sm" style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }}>
            <option value="">اختر اليوم</option>
            {daysOfWeek.map((d, i) => <option key={i} value={i}>{d}</option>)}
          </select>
          <div className="grid grid-cols-2 gap-3">
            <input type="time" placeholder="من" value={lectureForm.time_from}
              onChange={e => setLectureForm({ ...lectureForm, time_from: e.target.value })}
              className="w-full px-4 py-2.5 rounded-xl border text-sm" style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }} />
            <input type="time" placeholder="إلى" value={lectureForm.time_to}
              onChange={e => setLectureForm({ ...lectureForm, time_to: e.target.value })}
              className="w-full px-4 py-2.5 rounded-xl border text-sm" style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }} />
          </div>
          <input placeholder="الموضوع" value={lectureForm.topic}
            onChange={e => setLectureForm({ ...lectureForm, topic: e.target.value })}
            className="w-full px-4 py-2.5 rounded-xl border text-sm" style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }} />
          <input placeholder="التاريخ" type="date" value={lectureForm.date}
            onChange={e => setLectureForm({ ...lectureForm, date: e.target.value })}
            className="w-full px-4 py-2.5 rounded-xl border text-sm" style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }} />
          <button onClick={saveLecture} className="w-full py-3 bg-[var(--primary)] text-white rounded-xl font-medium">حفظ</button>
        </div>
      </Modal>

      {/* Edit Lecture Modal */}
      <Modal open={editLectureModal} onClose={() => setEditLectureModal(false)} title="تعديل المحاضرة">
        <div className="space-y-3">
          <select value={editLectureForm.day_of_week} onChange={e => setEditLectureForm({ ...editLectureForm, day_of_week: e.target.value })}
            className="w-full px-4 py-2.5 rounded-xl border text-sm" style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }}>
            <option value="">اختر اليوم</option>
            {daysOfWeek.map((d, i) => <option key={i} value={i}>{d}</option>)}
          </select>
          <div className="grid grid-cols-2 gap-3">
            <input type="time" placeholder="من" value={editLectureForm.time_from}
              onChange={e => setEditLectureForm({ ...editLectureForm, time_from: e.target.value })}
              className="w-full px-4 py-2.5 rounded-xl border text-sm" style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }} />
            <input type="time" placeholder="إلى" value={editLectureForm.time_to}
              onChange={e => setEditLectureForm({ ...editLectureForm, time_to: e.target.value })}
              className="w-full px-4 py-2.5 rounded-xl border text-sm" style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }} />
          </div>
          <input placeholder="الموضوع" value={editLectureForm.topic}
            onChange={e => setEditLectureForm({ ...editLectureForm, topic: e.target.value })}
            className="w-full px-4 py-2.5 rounded-xl border text-sm" style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }} />
          <input placeholder="التاريخ" type="date" value={editLectureForm.date}
            onChange={e => setEditLectureForm({ ...editLectureForm, date: e.target.value })}
            className="w-full px-4 py-2.5 rounded-xl border text-sm" style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }} />
          <button onClick={saveEditLecture} className="w-full py-3 bg-[var(--primary)] text-white rounded-xl font-medium">حفظ التعديلات</button>
        </div>
      </Modal>

      {/* Add Students Modal */}
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

      {/* Confirm dialogs */}
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
        message={`حذف "${confirmDelete?.name}" نهائياً؟ سيتم إزالة جميع الطلاب والمحاضرات منها.`}
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
      <ConfirmDialog
        open={!!confirmDeleteLecture}
        title="حذف المحاضرة"
        message={`حذف هذه المحاضرة نهائياً؟`}
        confirmLabel="حذف"
        variant="danger"
        onConfirm={deleteLecture}
        onCancel={() => setConfirmDeleteLecture(null)}
      />
    </div>
  );
}
