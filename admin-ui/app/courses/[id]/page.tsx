'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '../../../lib/api';
import DataTable from '../../../components/DataTable';
import Modal from '../../../components/Modal';
import ConfirmDialog from '../../../components/ConfirmDialog';
import Skeleton from '../../../components/Skeleton';
import StatusBadge from '../../../components/StatusBadge';
import { compressAndEncode } from '../../../lib/imageUtils';
import { useToast } from '../../../components/Toast';

const daysOfWeek = ['السبت', 'الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة'];

export default function CourseDetailPage({ params }: { params: { id: string } }) {
  const courseId = Number(params.id);
  const router = useRouter();
  const { toast } = useToast();

  const [tab, setTab] = useState('info');

  const [course, setCourse] = useState<any>(null);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [editModal, setEditModal] = useState(false);
  const [editForm, setEditForm] = useState<any>({});
  const [saving, setSaving] = useState(false);

  const [groups, setGroups] = useState<any[]>([]);
  const [groupsLoading, setGroupsLoading] = useState(false);

  const [addGroupModal, setAddGroupModal] = useState(false);
  const [groupForm, setGroupForm] = useState({ name: '', location: '', max_students: '', end_date: '', status: 'pending' });
  const [groupSaving, setGroupSaving] = useState(false);

  const [editGroupModal, setEditGroupModal] = useState(false);
  const [editGroupForm, setEditGroupForm] = useState<any>({});
  const [editingGroupId, setEditingGroupId] = useState<number | null>(null);
  const [editGroupSaving, setEditGroupSaving] = useState(false);

  const [detailGroup, setDetailGroup] = useState<any>(null);
  const [detailGroupTab, setDetailGroupTab] = useState<'info' | 'lectures' | 'students'>('info');

  const [lectures, setLectures] = useState<any[]>([]);
  const [lecturesLoading, setLecturesLoading] = useState(false);
  const [lectureForm, setLectureForm] = useState({ day_of_week: '', time_from: '', time_to: '', topic: '', date: '' });
  const [addLectureModal, setAddLectureModal] = useState(false);
  const [lectureSaving, setLectureSaving] = useState(false);
  const [editLectureModal, setEditLectureModal] = useState(false);
  const [editLectureForm, setEditLectureForm] = useState<any>({});
  const [editingLectureId, setEditingLectureId] = useState<number | null>(null);
  const [editLectureSaving, setEditLectureSaving] = useState(false);

  const [groupStudents, setGroupStudents] = useState<any[]>([]);
  const [groupStudentsLoading, setGroupStudentsLoading] = useState(false);
  const [addStudentModal, setAddStudentModal] = useState(false);
  const [addStudentSaving, setAddStudentSaving] = useState(false);
  const [allStudents, setAllStudents] = useState<any[]>([]);
  const [selectedStudentIds, setSelectedStudentIds] = useState<number[]>([]);
  const [studentSearch, setStudentSearch] = useState('');

  const [courseStudents, setCourseStudents] = useState<any[]>([]);
  const [courseStudentsLoading, setCourseStudentsLoading] = useState(false);

  // Unassigned students
  const [unassignedStudents, setUnassignedStudents] = useState<any[]>([]);
  const [unassignedLoading, setUnassignedLoading] = useState(false);

  // Move student between groups
  const [otherGroups, setOtherGroups] = useState<any[]>([]);
  const [moveStudentTarget, setMoveStudentTarget] = useState<any>(null);
  const [moveTargetGroupId, setMoveTargetGroupId] = useState<number | null>(null);
  const [movingStudent, setMovingStudent] = useState(false);

  const [confirmToggleCourse, setConfirmToggleCourse] = useState<any>(null);
  const [confirmDeleteCourse, setConfirmDeleteCourse] = useState<any>(null);
  const [confirmToggleGroup, setConfirmToggleGroup] = useState<any>(null);
  const [confirmDeleteGroup, setConfirmDeleteGroup] = useState<any>(null);
  const [confirmRemoveStudent, setConfirmRemoveStudent] = useState<any>(null);
  const [confirmDeleteLecture, setConfirmDeleteLecture] = useState<any>(null);

  const loadCourse = async () => {
    setLoading(true);
    setError('');
    try {
      const c = await api(`/api/courses/${courseId}`);
      setCourse(c);
      const cats = await api('/api/categories').catch(() => []);
      setCategories(cats);
    } catch {
      setError('فشل تحميل بيانات الكورس');
    }
    setLoading(false);
  };

  useEffect(() => { loadCourse(); }, [courseId]);

  const loadGroups = async () => {
    setGroupsLoading(true);
    try {
      const data = await api(`/api/groups?courseId=${courseId}`);
      setGroups(data);
    } catch {
      toast('فشل تحميل المجموعات', 'error');
    }
    setGroupsLoading(false);
    loadUnassigned();
  };

  const loadCourseStudents = async () => {
    setCourseStudentsLoading(true);
    try {
      const data = await api(`/api/admin/orders?courseId=${courseId}`);
      setCourseStudents(data.orders || []);
    } catch {
      setCourseStudents([]);
    }
    setCourseStudentsLoading(false);
  };

  useEffect(() => {
    if (tab === 'groups' && groups.length === 0 && !groupsLoading) loadGroups();
    if (tab === 'students' && courseStudents.length === 0 && !courseStudentsLoading) loadCourseStudents();
  }, [tab]);

  const startEdit = () => {
    if (!course) return;
    setEditForm({
      title_ar: course.title_ar, title_en: course.title_en, description: course.description || '',
      price: course.price, category_id: course.category_id?.toString() || '',
      image_url: course.image_url || '', max_students: course.max_students,
      lecture_count: course.lecture_count || 0, lecture_duration: course.lecture_duration || 0,
      instructor: course.instructor || '', materials_url: course.materials_url || '',
      course_mode: course.course_mode || 'online',
      featured: Boolean(Number(course.featured)), enable_direct_purchase: course.enable_direct_purchase !== 0,
      auto_assign: Boolean(Number(course.auto_assign)),
    });
    setEditModal(true);
  };

  const saveEdit = async () => {
    setSaving(true);
    try {
      await api(`/api/courses/${courseId}`, {
        method: 'PUT',
        body: JSON.stringify({ ...editForm, category_id: editForm.category_id ? Number(editForm.category_id) : null }),
      });
      setEditModal(false);
      toast('تم حفظ التعديلات', 'success');
      loadCourse();
    } catch {
      toast('فشل حفظ التعديلات', 'error');
    }
    setSaving(false);
  };

  const toggleCourseActive = async () => {
    if (!confirmToggleCourse) return;
    try {
      await api(`/api/courses/${confirmToggleCourse.id}`, {
        method: 'PUT',
        body: JSON.stringify({ is_active: Number(confirmToggleCourse.is_active) ? 0 : 1 }),
      });
      toast(Number(confirmToggleCourse.is_active) ? 'تم تعطيل الكورس' : 'تم تفعيل الكورس', 'success');
      setConfirmToggleCourse(null);
      loadCourse();
    } catch {
      toast('فشل تحديث حالة الكورس', 'error');
    }
  };

  const deleteCourse = async () => {
    if (!confirmDeleteCourse) return;
    try {
      await api(`/api/courses/${confirmDeleteCourse.id}`, { method: 'DELETE' });
      toast('تم حذف الكورس نهائياً', 'success');
      router.push('/courses');
    } catch {
      toast('فشل حذف الكورس', 'error');
    }
  };

  const saveGroup = async () => {
    if (groupSaving) return;
    setGroupSaving(true);
    try {
      await api('/api/groups', {
        method: 'POST',
        body: JSON.stringify({ ...groupForm, course_id: courseId, max_students: groupForm.max_students ? Number(groupForm.max_students) : null }),
      });
      setAddGroupModal(false);
      setGroupForm({ name: '', location: '', max_students: '', end_date: '', status: 'pending' });
      toast('تم إضافة المجموعة', 'success');
      loadGroups();
    } catch {
      toast('فشل إضافة المجموعة', 'error');
    } finally {
      setGroupSaving(false);
    }
  };

  const startEditGroup = (row: any) => {
    setEditingGroupId(row.id);
    setEditGroupForm({
      name: row.name, course_id: row.course_id?.toString() || '',
      is_active: Number(row.is_active),
      status: row.status || 'pending',
      location: row.location || '', max_students: row.max_students?.toString() || '',
      end_date: row.end_date || '',
    });
    setEditGroupModal(true);
  };

  const saveEditGroup = async () => {
    if (editGroupSaving) return;
    setEditGroupSaving(true);
    try {
      await api(`/api/groups/${editingGroupId}`, {
        method: 'PUT',
        body: JSON.stringify({
          name: editGroupForm.name,
          location: editGroupForm.location,
          max_students: editGroupForm.max_students ? Number(editGroupForm.max_students) : null,
          status: editGroupForm.status,
        }),
      });
      setEditGroupModal(false);
      setEditingGroupId(null);
      toast('تم تحديث المجموعة', 'success');
      loadGroups();
    } catch {
      toast('فشل تحديث المجموعة', 'error');
    } finally {
      setEditGroupSaving(false);
    }
  };

  const openDetailGroup = async (group: any) => {
    setDetailGroup(group);
    setDetailGroupTab('info');
    setGroupStudentsLoading(true);
    loadLectures(group.id);
    try {
      const students = await api(`/api/groups/${group.id}/students`);
      setGroupStudents(students);
    } catch {
      toast('فشل تحميل الطلاب', 'error');
      setGroupStudents([]);
    }
    setGroupStudentsLoading(false);
  };

  const toggleGroupActive = async () => {
    if (!confirmToggleGroup) return;
    const currentlyActive = Number(confirmToggleGroup.is_active);
    try {
      await api(`/api/groups/${confirmToggleGroup.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          is_active: currentlyActive ? 0 : 1,
          status: currentlyActive ? 'cancelled' : 'active',
        }),
      });
      toast(currentlyActive ? 'تم تعطيل المجموعة' : 'تم تفعيل المجموعة', 'success');
      setConfirmToggleGroup(null);
      loadGroups();
    } catch {
      toast('فشل تغيير حالة المجموعة', 'error');
    }
  };

  const deleteGroup = async () => {
    if (!confirmDeleteGroup) return;
    try {
      await api(`/api/groups/${confirmDeleteGroup.id}`, { method: 'DELETE' });
      toast('تم حذف المجموعة', 'success');
      setConfirmDeleteGroup(null);
      setDetailGroup(null);
      loadGroups();
    } catch {
      toast('فشل حذف المجموعة', 'error');
    }
  };

  const loadLectures = async (groupId: number) => {
    setLecturesLoading(true);
    try {
      const data = await api(`/api/lectures/${groupId}`);
      setLectures(data);
    } catch { setLectures([]); }
    setLecturesLoading(false);
  };

  const saveLecture = async () => {
    if (lectureSaving) return;
    setLectureSaving(true);
    try {
      await api(`/api/lectures/${detailGroup.id}`, {
        method: 'POST',
        body: JSON.stringify(lectureForm),
      });
      setAddLectureModal(false);
      setLectureForm({ day_of_week: '', time_from: '', time_to: '', topic: '', date: '' });
      toast('تم إضافة المحاضرة', 'success');
      loadLectures(detailGroup.id);
      loadGroups();
    } catch {
      toast('فشل إضافة المحاضرة', 'error');
    } finally {
      setLectureSaving(false);
    }
  };

  const startEditLecture = (lec: any) => {
    setEditingLectureId(lec.id);
    setEditLectureForm({
      day_of_week: lec.day_of_week || '', time_from: lec.time_from || '', time_to: lec.time_to || '',
      topic: lec.topic || '', date: lec.date || '',
    });
    setEditLectureModal(true);
  };

  const saveEditLecture = async () => {
    if (editLectureSaving) return;
    setEditLectureSaving(true);
    try {
      await api(`/api/lectures/${detailGroup.id}/${editingLectureId}`, {
        method: 'PUT',
        body: JSON.stringify(editLectureForm),
      });
      setEditLectureModal(false);
      setEditingLectureId(null);
      toast('تم تحديث المحاضرة', 'success');
      loadLectures(detailGroup.id);
      loadGroups();
    } catch {
      toast('فشل تحديث المحاضرة', 'error');
    } finally {
      setEditLectureSaving(false);
    }
  };

  const toggleLecture = async (lec: any) => {
    try {
      const res = await api(`/api/lectures/${detailGroup.id}/${lec.id}/toggle`, { method: 'PATCH' });
      toast(res.is_completed ? 'تم إتمام المحاضرة' : 'تم إلغاء الإتمام', 'success');
      loadLectures(detailGroup.id);
      loadGroups();
    } catch {
      toast('فشل تغيير حالة المحاضرة', 'error');
    }
  };

  const deleteLecture = async () => {
    if (!confirmDeleteLecture) return;
    try {
      await api(`/api/lectures/${detailGroup.id}/${confirmDeleteLecture.id}`, { method: 'DELETE' });
      toast('تم حذف المحاضرة', 'success');
      setConfirmDeleteLecture(null);
      loadLectures(detailGroup.id);
      loadGroups();
    } catch {
      toast('فشل حذف المحاضرة', 'error');
    }
  };

  const openAddStudent = async () => {
    setAddStudentModal(true);
    setSelectedStudentIds([]);
    setStudentSearch('');
    try {
      const data = await api('/api/admin/users?role=student&limit=500');
      setAllStudents(data.users || []);
    } catch { setAllStudents([]); }
  };

  const addStudentsToGroup = async () => {
    if (selectedStudentIds.length === 0 || addStudentSaving) return;
    setAddStudentSaving(true);
    try {
      await api(`/api/groups/${detailGroup.id}/students`, {
        method: 'POST',
        body: JSON.stringify({ user_ids: selectedStudentIds }),
      });
      toast(`تم إضافة ${selectedStudentIds.length} طالب`, 'success');
      setAddStudentModal(false);
      const students = await api(`/api/groups/${detailGroup.id}/students`);
      setGroupStudents(students);
      loadGroups();
    } catch {
      toast('فشل إضافة الطلاب', 'error');
    } finally {
      setAddStudentSaving(false);
    }
  };

  const removeStudent = async () => {
    if (!confirmRemoveStudent) return;
    try {
      await api(`/api/groups/${detailGroup.id}/students/${confirmRemoveStudent.id}`, { method: 'DELETE' });
      toast('تم حذف الطالب من المجموعة', 'success');
      setConfirmRemoveStudent(null);
      const students = await api(`/api/groups/${detailGroup.id}/students`);
      setGroupStudents(students);
      loadGroups();
    } catch {
      toast('فشل حذف الطالب', 'error');
    }
  };

  const toggleStudentSelect = (id: number) => {
    setSelectedStudentIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const loadUnassigned = async () => {
    setUnassignedLoading(true);
    try {
      const data = await api(`/api/admin/unassigned/course/${courseId}`);
      setUnassignedStudents(data);
    } catch {
      setUnassignedStudents([]);
    }
    setUnassignedLoading(false);
  };

  const assignStudent = async (userId: number, groupId: number) => {
    try {
      await api('/api/admin/unassigned/assign', {
        method: 'POST',
        body: JSON.stringify({ user_id: userId, group_id: groupId }),
      });
      toast('تم تسكين الطالب', 'success');
      loadUnassigned();
      if (detailGroup) {
        const students = await api(`/api/groups/${detailGroup.id}/students`);
        setGroupStudents(students);
      }
      loadGroups();
    } catch {
      toast('فشل تسكين الطالب', 'error');
    }
  };

  const openMoveStudent = async (student: any) => {
    setMoveStudentTarget(student);
    setMoveTargetGroupId(null);
    try {
      const groups = await api(`/api/groups?courseId=${courseId}`);
      setOtherGroups(groups.filter((g: any) => g.id !== detailGroup?.id));
    } catch {
      setOtherGroups([]);
    }
  };

  const moveStudent = async () => {
    if (!moveStudentTarget || !moveTargetGroupId || !detailGroup) return;
    setMovingStudent(true);
    try {
      await api(`/api/groups/${detailGroup.id}/students/${moveStudentTarget.id}/move`, {
        method: 'PUT',
        body: JSON.stringify({ target_group_id: moveTargetGroupId }),
      });
      toast('تم نقل الطالب', 'success');
      setMoveStudentTarget(null);
      setMoveTargetGroupId(null);
      const students = await api(`/api/groups/${detailGroup.id}/students`);
      setGroupStudents(students);
      loadGroups();
    } catch {
      toast('فشل نقل الطالب', 'error');
    }
    setMovingStudent(false);
  };

  const filteredStudents = allStudents.filter((s: any) =>
    !studentSearch || s.name.includes(studentSearch) || s.email.includes(studentSearch) || s.phone?.includes(studentSearch)
  );

  const tabs = [
    { key: 'info', label: 'معلومات الكورس' },
    { key: 'groups', label: 'المجموعات' },
    { key: 'students', label: 'الطلاب المسجلين' },
    { key: 'unassigned', label: `غير مسكنين (${unassignedStudents.length})` },
  ];

  if (loading) return (
    <div className="space-y-4">
      <Link href="/courses" className="inline-flex items-center gap-1 text-sm" style={{ color: 'var(--primary)' }}>→ العودة إلى الكورسات</Link>
      <Skeleton rows={6} cols={3} />
    </div>
  );
  if (error) return (
    <div className="flex flex-col items-center justify-center h-64 gap-4">
      <p style={{ color: '#dc2626' }}>{error}</p>
      <button onClick={loadCourse} className="px-4 py-2 bg-[var(--primary)] text-white rounded-xl text-sm">إعادة المحاولة</button>
    </div>
  );
  if (!course) return null;

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Link href="/courses" className="inline-flex items-center gap-1 text-sm mb-1" style={{ color: 'var(--primary)' }}>→ العودة إلى الكورسات</Link>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>{course.title_ar}</h1>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setConfirmToggleCourse(course)}
            className="px-4 py-2 rounded-xl text-sm font-medium border"
            style={{ borderColor: 'var(--border)', color: Number(course.is_active) ? '#dc2626' : '#16a34a' }}>
            {Number(course.is_active) ? '🔴 تعطيل' : '🟢 تفعيل'}
          </button>
          <button onClick={() => setConfirmDeleteCourse(course)}
            className="px-4 py-2 rounded-xl text-sm font-medium text-white" style={{ backgroundColor: '#dc2626' }}>
            🗑️ حذف
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b pb-2" style={{ borderColor: 'var(--border)' }}>
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className="px-5 py-2.5 rounded-lg text-sm font-medium transition-all"
            style={{
              backgroundColor: tab === t.key ? 'var(--primary)' : 'transparent',
              color: tab === t.key ? '#fff' : 'var(--text)',
            }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ============================== TAB: Info ============================== */}
      {tab === 'info' && (
        <div className="rounded-2xl p-6 shadow-sm border space-y-4" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}>
          <div className="flex items-center justify-between">
            <h2 className="font-bold" style={{ color: 'var(--text)' }}>تفاصيل الكورس</h2>
            <button onClick={startEdit} className="px-4 py-2 rounded-xl text-sm font-medium text-white" style={{ backgroundColor: 'var(--primary)' }}>✏️ تعديل</button>
          </div>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="p-3 rounded-xl" style={{ backgroundColor: 'var(--bg)' }}>
              <span className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>الاسم بالعربية</span>
              <span style={{ color: 'var(--text)' }}>{course.title_ar}</span>
            </div>
            <div className="p-3 rounded-xl" style={{ backgroundColor: 'var(--bg)' }}>
              <span className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>English</span>
              <span style={{ color: 'var(--text)' }}>{course.title_en}</span>
            </div>
            <div className="p-3 rounded-xl" style={{ backgroundColor: 'var(--bg)' }}>
              <span className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>السعر</span>
              <span style={{ color: 'var(--text)' }}>{course.price > 0 ? `${course.price} ج.م` : 'مجاني'}</span>
            </div>
            <div className="p-3 rounded-xl" style={{ backgroundColor: 'var(--bg)' }}>
              <span className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>التصنيف</span>
              <span style={{ color: 'var(--text)' }}>{course.category_name_ar || '-'}</span>
            </div>
            <div className="p-3 rounded-xl" style={{ backgroundColor: 'var(--bg)' }}>
              <span className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>النوع</span>
              <span style={{ color: 'var(--text)' }}>{course.course_mode === 'offline' ? '🏫 حضوري' : '💻 أونلاين'}</span>
            </div>
            <div className="p-3 rounded-xl" style={{ backgroundColor: 'var(--bg)' }}>
              <span className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>الحالة</span>
              <span>{Number(course.is_active) ? '🟢 نشط' : '🔴 غير نشط'}</span>
            </div>
            {course.lecture_count > 0 && (
              <div className="p-3 rounded-xl" style={{ backgroundColor: 'var(--bg)' }}>
                <span className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>عدد المحاضرات</span>
                <span style={{ color: 'var(--text)' }}>{course.lecture_count}</span>
              </div>
            )}
            {course.lecture_duration > 0 && (
              <div className="p-3 rounded-xl" style={{ backgroundColor: 'var(--bg)' }}>
                <span className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>مدة المحاضرة</span>
                <span style={{ color: 'var(--text)' }}>{course.lecture_duration} ساعة</span>
              </div>
            )}
            {course.auto_assign !== undefined && (
              <div className="p-3 rounded-xl" style={{ backgroundColor: 'var(--bg)' }}>
                <span className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>نوع التسكين</span>
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium"
                  style={{
                    backgroundColor: Number(course.auto_assign) ? 'rgba(34,197,94,0.15)' : 'rgba(251,191,36,0.15)',
                    color: Number(course.auto_assign) ? '#16a34a' : '#d97706',
                  }}>
                  {Number(course.auto_assign) ? '🤖 تسكين تلقائي' : '👤 تسكين يدوي'}
                </span>
              </div>
            )}
          {course.max_students && (
              <div className="p-3 rounded-xl" style={{ backgroundColor: 'var(--bg)' }}>
                <span className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>الحد الأقصى</span>
                <span style={{ color: 'var(--text)' }}>{course.max_students} طالب</span>
              </div>
            )}
            {course.instructor && (
              <div className="p-3 rounded-xl" style={{ backgroundColor: 'var(--bg)' }}>
                <span className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>المدرب</span>
                <span style={{ color: 'var(--text)' }}>{course.instructor}</span>
              </div>
            )}
            {course.image_url && (
              <div className="p-3 rounded-xl col-span-2">
                <img src={course.image_url} alt={course.title_ar} className="h-32 rounded-xl object-cover" />
              </div>
            )}
          </div>
          {course.description && (
            <div className="p-3 rounded-xl" style={{ backgroundColor: 'var(--bg)' }}>
              <span className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>الوصف</span>
              <p className="text-sm leading-relaxed" style={{ color: 'var(--text)' }}>{course.description}</p>
            </div>
          )}
        </div>
      )}

      {/* ============================== TAB: Groups ============================== */}
      {tab === 'groups' && (
        <div className="rounded-2xl p-6 shadow-sm border space-y-4" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}>
          <div className="flex items-center justify-between">
            <h2 className="font-bold" style={{ color: 'var(--text)' }}>المجموعات ({groups.length})</h2>
            <button onClick={() => setAddGroupModal(true)}
              className="px-4 py-2 rounded-xl text-sm font-medium text-white" style={{ backgroundColor: 'var(--primary)' }}>
              + إضافة مجموعة
            </button>
          </div>
          {groupsLoading ? (
            <Skeleton rows={4} cols={6} />
          ) : (
            <DataTable
              columns={[
                { key: 'name', label: 'اسم المجموعة' },
                { key: 'instructor_name', label: 'المدرب' },
                { key: 'student_count', label: 'عدد الطلاب', render: (v: number) => `${v || 0} طالب` },
                { key: 'schedule_display', label: 'الموعد', render: (v: string) => v || 'لم يتم تحديد الميعاد بعد' },
                { key: 'status', label: 'الحالة', render: (v: any, row: any) => (
                  <div className="flex items-center gap-2">
                    <StatusBadge status={row.status || (Number(row.is_active) ? 'active' : 'cancelled')} />
                    {!row.status && !Number(row.is_active) && <span className="text-xs" style={{ color: 'var(--text-muted)' }}>(قديم)</span>}
                  </div>
                )},
                { key: 'actions', label: 'الإجراءات', render: (_: any, row: any) => (
                  <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                    <button onClick={() => startEditGroup(row)}
                      className="px-2 py-1 rounded-lg text-xs font-medium bg-blue-50 text-blue-600 hover:bg-blue-100">تعديل</button>
                    <button onClick={() => setConfirmToggleGroup(row)}
                      className="px-2 py-1 rounded-lg text-xs font-medium"
                      style={{ backgroundColor: Number(row.is_active) ? '#fef2f2' : '#f0fdf4', color: Number(row.is_active) ? '#dc2626' : '#16a34a' }}>
                      {Number(row.is_active) ? 'تعطيل' : 'تفعيل'}
                    </button>
                    <button onClick={() => setConfirmDeleteGroup(row)}
                      className="px-2 py-1 rounded-lg text-xs font-medium bg-red-50 text-red-600 hover:bg-red-100">حذف</button>
                  </div>
                )},
              ]}
              data={groups}
              onRowClick={openDetailGroup}
            />
          )}
        </div>
      )}

      {/* ============================== TAB: Students ============================== */}
      {tab === 'students' && (
        <div className="rounded-2xl p-6 shadow-sm border space-y-4" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}>
          <h2 className="font-bold" style={{ color: 'var(--text)' }}>الطلاب المسجلين ({courseStudents.length})</h2>
          {courseStudentsLoading ? (
            <Skeleton rows={5} cols={4} />
          ) : courseStudents.length === 0 ? (
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>لا يوجد طلاب مسجلين في هذا الكورس</p>
          ) : (
            <div className="space-y-1">
              {courseStudents.map((o: any) => (
                <div key={o.id} className="flex items-center justify-between p-3 rounded-xl text-sm" style={{ backgroundColor: 'var(--bg)' }}>
                  <div className="flex items-center gap-3">
                    <span style={{ color: 'var(--text)' }}>{o.student_name}</span>
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{o.student_email}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span style={{ color: 'var(--text-muted)' }}>{o.amount} ج.م</span>
                    <StatusBadge status={o.status} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ============================== TAB: Unassigned Students ============================== */}
      {tab === 'unassigned' && (
        <div className="rounded-2xl p-6 shadow-sm border space-y-4" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}>
          <div className="flex items-center justify-between">
            <h2 className="font-bold" style={{ color: 'var(--text)' }}>الطلاب الغير مسكنين</h2>
          </div>
          {unassignedLoading ? (
            <Skeleton rows={3} cols={3} />
          ) : unassignedStudents.length === 0 ? (
            <div className="flex items-center gap-3 p-4 rounded-xl" style={{ backgroundColor: '#f0fdf4' }}>
              <span className="text-2xl">✅</span>
              <p className="text-sm font-medium" style={{ color: '#16a34a' }}>جميع الطلاب مسكنين في مجموعات</p>
            </div>
          ) : (
            <div className="space-y-2">
              {unassignedStudents.map((u: any) => (
                <div key={u.order_id} className="flex items-center justify-between p-3 rounded-xl text-sm border-2" style={{ backgroundColor: '#fef2f2', borderColor: '#fecaca' }}>
                  <div className="flex items-center gap-3">
                    <span className="text-lg">🔴</span>
                    <div>
                      <span className="font-medium" style={{ color: 'var(--text)' }}>{u.name}</span>
                      <span className="mr-2 text-xs" style={{ color: 'var(--text-muted)' }}>{u.email}</span>
                      {u.phone && <span className="mr-2 text-xs" style={{ color: 'var(--text-muted)' }}>{u.phone}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <select
                      onChange={e => {
                        const gid = Number(e.target.value);
                        if (gid) assignStudent(u.user_id, gid);
                      }}
                      className="px-3 py-1.5 rounded-lg text-xs border" style={{ backgroundColor: 'white', borderColor: 'var(--border)' }}>
                      <option value="">تسكين في...</option>
                      {groups.filter((g: any) => Number(g.is_active)).map((g: any) => (
                        <option key={g.id} value={g.id}>{g.name} ({g.student_count || 0}/{g.max_students || '∞'})</option>
                      ))}
                    </select>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ===================== EDIT COURSE MODAL ===================== */}
      <Modal open={editModal} onClose={() => setEditModal(false)} title={`تعديل: ${editForm.title_ar || ''}`} size="lg">
        <div className="space-y-3 max-h-[70vh] overflow-y-auto">
          <div>
            <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>اسم الكورس بالعربية</label>
            <input value={editForm.title_ar} onChange={e => setEditForm({ ...editForm, title_ar: e.target.value })}
              className="w-full px-4 py-2.5 rounded-xl border text-sm" style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }} />
          </div>
          <div>
            <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Course name in English</label>
            <input value={editForm.title_en} onChange={e => setEditForm({ ...editForm, title_en: e.target.value })}
              className="w-full px-4 py-2.5 rounded-xl border text-sm" style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }} />
          </div>
          <div>
            <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>وصف الكورس</label>
            <textarea value={editForm.description} onChange={e => setEditForm({ ...editForm, description: e.target.value })}
              className="w-full px-4 py-2.5 rounded-xl border text-sm h-20" style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }} />
          </div>
          <div>
            <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>سعر الكورس (0 = مجاني)</label>
            <input type="number" value={editForm.price} onChange={e => setEditForm({ ...editForm, price: Number(e.target.value) })}
              className="w-full px-4 py-2.5 rounded-xl border text-sm" style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }} />
          </div>
          <div>
            <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>التصنيف</label>
            <select value={editForm.category_id} onChange={e => setEditForm({ ...editForm, category_id: e.target.value })}
              className="w-full px-4 py-2.5 rounded-xl border text-sm" style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }}>
              <option value="">اختر تصنيف (اختياري)</option>
              {categories.map((c: any) => <option key={c.id} value={c.id}>{c.name_ar}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>عدد المحاضرات</label>
            <input type="number" value={editForm.lecture_count} onChange={e => setEditForm({ ...editForm, lecture_count: Number(e.target.value) })}
              className="w-full px-4 py-2.5 rounded-xl border text-sm" style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }} />
          </div>
          <div>
            <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>مدة المحاضرة (ساعة)</label>
            <input type="number" step="0.5" value={editForm.lecture_duration} onChange={e => setEditForm({ ...editForm, lecture_duration: Number(e.target.value) })}
              className="w-full px-4 py-2.5 rounded-xl border text-sm" style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }} />
          </div>
          <div>
            <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>اسم المدرب</label>
            <input value={editForm.instructor} onChange={e => setEditForm({ ...editForm, instructor: e.target.value })}
              className="w-full px-4 py-2.5 rounded-xl border text-sm" style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }} />
          </div>
          <div>
            <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>الحد الأقصى للطلاب</label>
            <input type="number" value={editForm.max_students} onChange={e => setEditForm({ ...editForm, max_students: Number(e.target.value) })}
              className="w-full px-4 py-2.5 rounded-xl border text-sm" style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }} />
          </div>
          <div>
            <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>نوع الكورس</label>
            <select value={editForm.course_mode} onChange={e => setEditForm({ ...editForm, course_mode: e.target.value })}
              className="w-full px-4 py-2.5 rounded-xl border text-sm" style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }}>
              <option value="online">أونلاين</option>
              <option value="offline">أوفلاين (حضوري)</option>
            </select>
          </div>
          <div className="flex items-center gap-3 py-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={editForm.featured} onChange={e => setEditForm({ ...editForm, featured: e.target.checked })} className="accent-blue-600 w-4 h-4" />
              <span className="text-sm" style={{ color: 'var(--text)' }}>⭐ كورس مميز (يظهر في الصفحة الرئيسية)</span>
            </label>
          </div>
          <div className="flex items-center gap-3 py-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={editForm.enable_direct_purchase} onChange={e => setEditForm({ ...editForm, enable_direct_purchase: e.target.checked })} className="accent-blue-600 w-4 h-4" />
              <span className="text-sm" style={{ color: 'var(--text)' }}>💳 تفعيل الشراء المباشر</span>
            </label>
          </div>
          <div>
            <label className="block text-xs mb-2" style={{ color: 'var(--text-muted)' }}>نوع التسكين</label>
            <div className="flex rounded-xl overflow-hidden border" style={{ borderColor: 'var(--border)' }}>
              <button type="button" onClick={() => setEditForm({ ...editForm, auto_assign: false })}
                className={`flex-1 py-2.5 text-sm font-medium transition-all ${
                  !editForm.auto_assign
                    ? 'text-white shadow-sm'
                    : 'hover:bg-black/5'
                }`}
                style={{
                  backgroundColor: !editForm.auto_assign ? 'var(--primary)' : 'transparent',
                  color: !editForm.auto_assign ? '#fff' : 'var(--text)',
                }}>
                👤 تسكين يدوي
              </button>
              <button type="button" onClick={() => setEditForm({ ...editForm, auto_assign: true })}
                className={`flex-1 py-2.5 text-sm font-medium transition-all ${
                  editForm.auto_assign
                    ? 'text-white shadow-sm'
                    : 'hover:bg-black/5'
                }`}
                style={{
                  backgroundColor: editForm.auto_assign ? 'var(--primary)' : 'transparent',
                  color: editForm.auto_assign ? '#fff' : 'var(--text)',
                }}>
                🤖 تسكين تلقائي
              </button>
            </div>
            <p className="text-xs mt-1.5" style={{ color: 'var(--text-muted)' }}>
              {editForm.auto_assign
                ? 'عند تأكيد دفع الطالب، يُسكن تلقائياً في أول مجموعة متاحة'
                : 'الطلاب يظهرون في "غير مسكنين" ويحتاجون تسكين يدوي من المشرف'}
            </p>
          </div>
          <div>
            <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>صورة الكورس</label>
            <input type="file" accept="image/*"
              onChange={async e => {
                const file = e.target.files?.[0];
                if (file) { const dataUrl = await compressAndEncode(file); setEditForm({ ...editForm, image_url: dataUrl }); }
              }}
              className="w-full text-sm" style={{ color: 'var(--text)' }} />
            {editForm.image_url && (
              <div className="relative mt-2 inline-block">
                <img src={editForm.image_url} alt="Preview" className="h-20 rounded-xl object-cover" />
                <button onClick={() => setEditForm({ ...editForm, image_url: '' })} className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full text-xs">✕</button>
              </div>
            )}
          </div>
          <button onClick={saveEdit} disabled={saving}
            className="w-full py-3 rounded-xl text-white font-medium disabled:opacity-50" style={{ backgroundColor: 'var(--primary)' }}>
            {saving ? 'جاري الحفظ...' : 'حفظ التعديلات'}
          </button>
        </div>
      </Modal>

      {/* ===================== ADD GROUP MODAL ===================== */}
      <Modal open={addGroupModal} onClose={() => setAddGroupModal(false)} title="إضافة مجموعة جديدة" size="lg">
        <div className="grid grid-cols-2 gap-3">
          <input placeholder="اسم المجموعة" value={groupForm.name}
            onChange={e => setGroupForm({ ...groupForm, name: e.target.value })}
            className="col-span-2 w-full px-4 py-2.5 rounded-xl border text-sm" style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }} />
          <div className="p-3 rounded-xl text-sm" style={{ backgroundColor: 'var(--bg)' }}>
            <span className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>الكورس</span>
            <span style={{ color: 'var(--primary)' }}>{course?.title_ar}</span>
          </div>
          <div className="p-3 rounded-xl text-sm" style={{ backgroundColor: 'var(--bg)' }}>
            <span className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>المدرب</span>
            <span style={{ color: 'var(--text)' }}>{course?.instructor || 'غير محدد'}</span>
          </div>
          <input placeholder="المكان" value={groupForm.location}
            onChange={e => setGroupForm({ ...groupForm, location: e.target.value })}
            className="w-full px-4 py-2.5 rounded-xl border text-sm" style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }} />
          <input placeholder="الحد الأقصى للطلاب" type="number" value={groupForm.max_students}
            onChange={e => setGroupForm({ ...groupForm, max_students: e.target.value })}
            className="w-full px-4 py-2.5 rounded-xl border text-sm" style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }} />
          <div className="p-3 rounded-xl text-sm" style={{ backgroundColor: 'var(--bg)' }}>
            <span className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>الموعد</span>
            <span style={{ color: 'var(--text-muted)' }}>يُحدد من أول محاضرة</span>
          </div>
          <input placeholder="تاريخ النهاية" type="date" value={groupForm.end_date}
            onChange={e => setGroupForm({ ...groupForm, end_date: e.target.value })}
            className="w-full px-4 py-2.5 rounded-xl border text-sm" style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }} />
          <select value={groupForm.status || 'pending'}
            onChange={e => setGroupForm({ ...groupForm, status: e.target.value })}
            className="col-span-2 w-full px-4 py-2.5 rounded-xl border text-sm"
            style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }}>
            <option value="pending">قيد الانتظار</option>
            <option value="active">نشطة</option>
            <option value="completed">مكتملة</option>
            <option value="cancelled">ملغية</option>
          </select>
          <button onClick={saveGroup} disabled={groupSaving}
            className="col-span-2 w-full py-3 rounded-xl font-medium disabled:opacity-50"
            style={{ backgroundColor: 'var(--primary)', color: '#fff' }}>
            {groupSaving ? 'جاري الحفظ...' : 'حفظ'}
          </button>
        </div>
      </Modal>

      {/* ===================== EDIT GROUP MODAL ===================== */}
      <Modal open={editGroupModal} onClose={() => setEditGroupModal(false)} title="تعديل المجموعة" size="lg">
        <div className="grid grid-cols-2 gap-3">
          <input placeholder="اسم المجموعة" value={editGroupForm.name}
            onChange={e => setEditGroupForm({ ...editGroupForm, name: e.target.value })}
            className="col-span-2 w-full px-4 py-2.5 rounded-xl border text-sm" style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }} />
          <div className="p-3 rounded-xl text-sm" style={{ backgroundColor: 'var(--bg)' }}>
            <span className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>الكورس</span>
            <span style={{ color: 'var(--primary)' }}>{course?.title_ar}</span>
          </div>
          <div className="p-3 rounded-xl text-sm" style={{ backgroundColor: 'var(--bg)' }}>
            <span className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>المدرب</span>
            <span style={{ color: 'var(--text)' }}>{course?.instructor || 'غير محدد'}</span>
          </div>
          <input placeholder="المكان" value={editGroupForm.location}
            onChange={e => setEditGroupForm({ ...editGroupForm, location: e.target.value })}
            className="w-full px-4 py-2.5 rounded-xl border text-sm" style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }} />
          <input placeholder="الحد الأقصى للطلاب" type="number" value={editGroupForm.max_students}
            onChange={e => setEditGroupForm({ ...editGroupForm, max_students: e.target.value })}
            className="w-full px-4 py-2.5 rounded-xl border text-sm" style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }} />
          <div className="p-3 rounded-xl text-sm" style={{ backgroundColor: 'var(--bg)' }}>
            <span className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>الموعد</span>
            <span style={{ color: 'var(--text-muted)' }}>يُحدد من أول محاضرة</span>
          </div>
          <input placeholder="تاريخ النهاية" type="date" value={editGroupForm.end_date}
            onChange={e => setEditGroupForm({ ...editGroupForm, end_date: e.target.value })}
            className="w-full px-4 py-2.5 rounded-xl border text-sm" style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }} />
          <select value={editGroupForm.status || 'pending'}
            onChange={e => setEditGroupForm({ ...editGroupForm, status: e.target.value })}
            className="col-span-2 w-full px-4 py-2.5 rounded-xl border text-sm"
            style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }}>
            <option value="pending">قيد الانتظار</option>
            <option value="active">نشطة</option>
            <option value="completed">مكتملة</option>
            <option value="cancelled">ملغية</option>
          </select>
          <button onClick={saveEditGroup} disabled={editGroupSaving}
            className="col-span-2 w-full py-3 rounded-xl font-medium disabled:opacity-50"
            style={{ backgroundColor: 'var(--primary)', color: '#fff' }}>
            {editGroupSaving ? 'جاري الحفظ...' : 'حفظ التعديلات'}
          </button>
        </div>
      </Modal>

      {/* ===================== GROUP DETAIL MODAL ===================== */}
      <Modal open={!!detailGroup} onClose={() => setDetailGroup(null)} title={detailGroup?.name || 'المجموعة'} size="xl">
        {detailGroup && (
          <div className="space-y-4">
            <div className="flex gap-1 border-b pb-2" style={{ borderColor: 'var(--border)' }}>
              {(['info', 'lectures', 'students'] as const).map(t => (
                <button key={t} onClick={() => setDetailGroupTab(t)}
                  className="px-4 py-2 rounded-lg text-sm font-medium transition-all"
                  style={{
                    backgroundColor: detailGroupTab === t ? 'var(--primary)' : 'transparent',
                    color: detailGroupTab === t ? '#fff' : 'var(--text)',
                  }}>
                  {t === 'info' ? 'معلومات' : t === 'lectures' ? 'جدول المحاضرات' : 'الطلاب'}
                </button>
              ))}
            </div>

            {detailGroupTab === 'info' && (
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="p-3 rounded-xl" style={{ backgroundColor: 'var(--bg)' }}>
                  <span className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>اسم المجموعة</span>
                  <span style={{ color: 'var(--text)' }}>{detailGroup.name}</span>
                </div>
                <div className="p-3 rounded-xl" style={{ backgroundColor: 'var(--bg)' }}>
                  <span className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>عدد الطلاب</span>
                  <span style={{ color: 'var(--text)' }}>{groupStudents.length} طالب</span>
                </div>
                {detailGroup.instructor_name && (
                  <div className="p-3 rounded-xl" style={{ backgroundColor: 'var(--bg)' }}>
                    <span className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>المدرب</span>
                    <span style={{ color: 'var(--text)' }}>{detailGroup.instructor_name}</span>
                  </div>
                )}
                {detailGroup.location && (
                  <div className="p-3 rounded-xl" style={{ backgroundColor: 'var(--bg)' }}>
                    <span className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>المكان</span>
                    <span style={{ color: 'var(--text)' }}>{detailGroup.location}</span>
                  </div>
                )}
                {detailGroup.schedule_display && (
                  <div className="p-3 rounded-xl col-span-2" style={{
                    backgroundColor: detailGroup.schedule_display === 'لم يتم تحديد الميعاد بعد' ? '#fef3c7' : 'var(--bg)',
                    border: detailGroup.schedule_display === 'لم يتم تحديد الميعاد بعد' ? '1px solid #f59e0b' : 'none',
                  }}>
                    <span className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>الموعد</span>
                    <span style={{
                      color: detailGroup.schedule_display === 'لم يتم تحديد الميعاد بعد' ? '#92400e' : 'var(--text)',
                      fontWeight: detailGroup.schedule_display === 'لم يتم تحديد الميعاد بعد' ? '600' : '400',
                    }}>
                      {detailGroup.schedule_display === 'لم يتم تحديد الميعاد بعد' ? '⚠️ ' : ''}{detailGroup.schedule_display}
                    </span>
                  </div>
                )}
                {detailGroup.end_date && (
                  <div className="p-3 rounded-xl" style={{ backgroundColor: 'var(--bg)' }}>
                    <span className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>تاريخ النهاية</span>
                    <span style={{ color: 'var(--text)' }}>{detailGroup.end_date}</span>
                  </div>
                )}
                <div className="p-3 rounded-xl" style={{ backgroundColor: 'var(--bg)' }}>
                  <span className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>الحالة</span>
                  <span style={{ color: 'var(--text)' }}>
                    {detailGroup.status === 'completed' ? '✅ مكتملة' :
                     detailGroup.status === 'cancelled' ? '❌ ملغية' :
                     detailGroup.status === 'active' ? '🟢 نشطة' : '⏳ قيد الانتظار'}
                  </span>
                </div>
                <div className="p-3 rounded-xl" style={{ backgroundColor: 'var(--bg)' }}>
                  <span className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>تقدم المحاضرات</span>
                  <span style={{ color: 'var(--text)' }}>
                    {detailGroup.lecture_done || 0} / {detailGroup.lecture_count || 0}
                  </span>
                </div>
              </div>
            )}

            {detailGroupTab === 'lectures' && (
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

            {detailGroupTab === 'students' && (
              <div className="rounded-xl p-3" style={{ backgroundColor: 'var(--bg)' }}>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-bold text-sm" style={{ color: 'var(--text)' }}>الطلاب المسجلين</h4>
                  <button onClick={openAddStudent} className="px-3 py-1.5 rounded-lg text-xs font-medium text-white" style={{ backgroundColor: 'var(--primary)' }}>+ إضافة طالب</button>
                </div>
                {groupStudentsLoading ? (
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
                        <div className="flex gap-1">
                          <button onClick={() => openMoveStudent(s)}
                            className="px-2 py-1 rounded text-blue-600 hover:bg-blue-50">🔄 نقل</button>
                          <button onClick={() => setConfirmRemoveStudent(s)}
                            className="px-2 py-1 rounded text-red-600 hover:bg-red-50">✕</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ===== Move Student Dialog ===== */}
            {moveStudentTarget && (
              <div className="rounded-xl p-3 border" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}>
                <p className="text-xs mb-2" style={{ color: 'var(--text-muted)' }}>
                  نقل <strong style={{ color: 'var(--text)' }}>{moveStudentTarget.name}</strong> إلى:
                </p>
                <div className="flex gap-2">
                  <select value={moveTargetGroupId || ''} onChange={e => setMoveTargetGroupId(Number(e.target.value))}
                    className="flex-1 px-3 py-1.5 rounded-lg text-xs border" style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)' }}>
                    <option value="">اختر مجموعة...</option>
                    {otherGroups.map((g: any) => (
                      <option key={g.id} value={g.id}>{g.name} ({g.student_count || 0}/{g.max_students || '∞'})</option>
                    ))}
                  </select>
                  <button onClick={moveStudent} disabled={!moveTargetGroupId || movingStudent}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium text-white disabled:opacity-50" style={{ backgroundColor: 'var(--primary)' }}>
                    {movingStudent ? 'جاري...' : 'نقل'}
                  </button>
                  <button onClick={() => { setMoveStudentTarget(null); setMoveTargetGroupId(null); }}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium" style={{ backgroundColor: '#f3f4f6', color: 'var(--text)' }}>إلغاء</button>
                </div>
              </div>
            )}

            <div className="flex gap-2 pt-2 border-t" style={{ borderColor: 'var(--border)' }}>
              <button onClick={() => { setDetailGroup(null); startEditGroup(detailGroup); }}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium text-white" style={{ backgroundColor: 'var(--primary)' }}>تعديل المجموعة</button>
              <button onClick={() => { setDetailGroup(null); setConfirmDeleteGroup(detailGroup); }}
                className="px-3 py-2.5 rounded-xl text-sm font-medium text-white" style={{ backgroundColor: '#dc2626' }}>🗑️ حذف</button>
            </div>
          </div>
        )}
      </Modal>

      {/* ===================== LECTURE MODALS ===================== */}
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
          <button onClick={saveLecture} disabled={lectureSaving}
            className="w-full py-3 rounded-xl font-medium disabled:opacity-50"
            style={{ backgroundColor: 'var(--primary)', color: '#fff' }}>
            {lectureSaving ? 'جاري الحفظ...' : 'حفظ'}
          </button>
        </div>
      </Modal>

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
          <button onClick={saveEditLecture} disabled={editLectureSaving}
            className="w-full py-3 rounded-xl font-medium disabled:opacity-50"
            style={{ backgroundColor: 'var(--primary)', color: '#fff' }}>
            {editLectureSaving ? 'جاري الحفظ...' : 'حفظ التعديلات'}
          </button>
        </div>
      </Modal>

      {/* ===================== ADD STUDENT MODAL ===================== */}
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
          <button onClick={addStudentsToGroup} disabled={selectedStudentIds.length === 0 || addStudentSaving}
            className="w-full py-3 rounded-xl text-white font-medium disabled:opacity-50"
            style={{ backgroundColor: 'var(--primary)' }}>
            {addStudentSaving ? 'جاري الإضافة...' : `إضافة ${selectedStudentIds.length > 0 ? `(${selectedStudentIds.length})` : ''}`}
          </button>
        </div>
      </Modal>

      {/* ===================== CONFIRM DIALOGS ===================== */}
      <ConfirmDialog open={!!confirmToggleCourse}
        title={Number(confirmToggleCourse?.is_active) ? 'تعطيل الكورس' : 'تفعيل الكورس'}
        message={Number(confirmToggleCourse?.is_active) ? `تعطيل "${confirmToggleCourse?.title_ar}"؟ سيختفي من واجهة المستخدمين.` : `تفعيل "${confirmToggleCourse?.title_ar}"؟`}
        confirmLabel={Number(confirmToggleCourse?.is_active) ? 'تعطيل' : 'تفعيل'}
        variant={Number(confirmToggleCourse?.is_active) ? 'warning' : 'info'}
        onConfirm={toggleCourseActive} onCancel={() => setConfirmToggleCourse(null)} />

      <ConfirmDialog open={!!confirmDeleteCourse}
        title="حذف الكورس"
        message={`حذف "${confirmDeleteCourse?.title_ar}" نهائياً؟ سيتم حذف جميع المجموعات والطلبات والشهادات المرتبطة به.`}
        confirmLabel="حذف" variant="danger"
        onConfirm={deleteCourse} onCancel={() => setConfirmDeleteCourse(null)} />

      <ConfirmDialog open={!!confirmToggleGroup}
        title={Number(confirmToggleGroup?.is_active) ? 'تعطيل المجموعة' : 'تفعيل المجموعة'}
        message={Number(confirmToggleGroup?.is_active) ? `تعطيل "${confirmToggleGroup?.name}"؟` : `تفعيل "${confirmToggleGroup?.name}"؟`}
        confirmLabel={Number(confirmToggleGroup?.is_active) ? 'تعطيل' : 'تفعيل'}
        variant={Number(confirmToggleGroup?.is_active) ? 'warning' : 'info'}
        onConfirm={toggleGroupActive} onCancel={() => setConfirmToggleGroup(null)} />

      <ConfirmDialog open={!!confirmDeleteGroup}
        title="حذف المجموعة"
        message={`حذف "${confirmDeleteGroup?.name}" نهائياً؟ سيتم إزالة جميع الطلاب والمحاضرات منها.`}
        confirmLabel="حذف" variant="danger"
        onConfirm={deleteGroup} onCancel={() => setConfirmDeleteGroup(null)} />

      <ConfirmDialog open={!!confirmRemoveStudent}
        title="حذف طالب من المجموعة"
        message={`إزالة "${confirmRemoveStudent?.name}" من المجموعة؟`}
        confirmLabel="إزالة" variant="danger"
        onConfirm={removeStudent} onCancel={() => setConfirmRemoveStudent(null)} />

      <ConfirmDialog open={!!confirmDeleteLecture}
        title="حذف المحاضرة"
        message="حذف هذه المحاضرة نهائياً؟"
        confirmLabel="حذف" variant="danger"
        onConfirm={deleteLecture} onCancel={() => setConfirmDeleteLecture(null)} />
    </div>
  );
}
