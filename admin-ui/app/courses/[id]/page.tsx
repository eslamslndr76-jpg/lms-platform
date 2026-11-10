'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api, downloadFile } from '../../../lib/api';
import DataTable from '../../../components/DataTable';
import Modal from '../../../components/Modal';
import ConfirmDialog from '../../../components/ConfirmDialog';
import Skeleton from '../../../components/Skeleton';
import StatusBadge from '../../../components/StatusBadge';
import { compressAndEncode } from '../../../lib/imageUtils';
import { useToast } from '../../../components/Toast';
import { useAdminAuth } from '../../../lib/auth';
import ExportButton from '../../../components/ExportButton';
import { QRCodeSVG } from 'qrcode.react';

const daysOfWeek = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

function formatTime(dt: string): string {
  if (!dt) return '';
  const d = new Date(dt);
  if (isNaN(d.getTime())) return dt;
  const hours = d.getHours();
  const mins = String(d.getMinutes()).padStart(2, '0');
  const ampm = hours >= 12 ? 'م' : 'ص';
  const h12 = hours % 12 || 12;
  return `${h12}:${mins} ${ampm}`;
}

export default function CourseDetailPage({ params }: { params: { id: string } }) {
  const courseId = Number(params.id);
  const router = useRouter();
  const { toast } = useToast();
  const { isAdmin } = useAdminAuth();

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
  const [groupForm, setGroupForm] = useState({ name: '', location: '', place_id: '', max_students: '', status: 'pending', instructor_user_id: '' });
  const [groupSaving, setGroupSaving] = useState(false);
  const [places, setPlaces] = useState<any[]>([]);
  const [instructorAccounts, setInstructorAccounts] = useState<any[]>([]);
  const [groupPlaceCap, setGroupPlaceCap] = useState<number | null>(null);
  const [groupPlaceInfo, setGroupPlaceInfo] = useState<{ conflicts: any[]; groups: any[] }>({ conflicts: [], groups: [] });

  const [editGroupModal, setEditGroupModal] = useState(false);
  const [editGroupForm, setEditGroupForm] = useState<any>({});
  const [editingGroupId, setEditingGroupId] = useState<number | null>(null);
  const [editGroupSaving, setEditGroupSaving] = useState(false);
  const [editGroupPlaceCap, setEditGroupPlaceCap] = useState<number | null>(null);
  const [editGroupPlaceInfo, setEditGroupPlaceInfo] = useState<{ conflicts: any[]; groups: any[] }>({ conflicts: [], groups: [] });

  const [detailGroup, setDetailGroup] = useState<any>(null);
  const [detailGroupTab, setDetailGroupTab] = useState<'info' | 'lectures' | 'students' | 'survey' | 'report'>('info');

  // Group report (edit-plan.md §8)
  const [reportData, setReportData] = useState<any>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportError, setReportError] = useState('');
  const [reportForm, setReportForm] = useState({ activity_type: '', report_notes: '', report_recommendations: '' });
  const [reportSaving, setReportSaving] = useState(false);
  const [reportImages, setReportImages] = useState<File[]>([]);
  const [reportImagesOpen, setReportImagesOpen] = useState(false);
  const [reportExtracting, setReportExtracting] = useState(false);
  const [exportingKey, setExportingKey] = useState('');

  // Group survey (edit-plan.md §4.4)
  const [surveyStats, setSurveyStats] = useState<any>(null);
  const [surveyLoading, setSurveyLoading] = useState(false);
  const [surveyError, setSurveyError] = useState('');
  const [surveyReminding, setSurveyReminding] = useState(false);
  const [surveyExtendOpen, setSurveyExtendOpen] = useState(false);
  const [surveyExtendDate, setSurveyExtendDate] = useState('');
  const [surveyExtendSaving, setSurveyExtendSaving] = useState(false);

  // Instructor evaluation of the group's students (edit-plan.md §5)
  const [instructorEval, setInstructorEval] = useState<any>(null);
  const [instructorEvalLoading, setInstructorEvalLoading] = useState(false);
  const [reopeningInstructorEval, setReopeningInstructorEval] = useState(false);

  // Course announcement (edit-plan.md §7)
  const [announceOpen, setAnnounceOpen] = useState(false);
  const [announceLoading, setAnnounceLoading] = useState(false);
  const [announceForm, setAnnounceForm] = useState({ title: '', body: '' });
  const [announceMeta, setAnnounceMeta] = useState<{ sent_at: string | null; recipients: number } | null>(null);
  const [announceSending, setAnnounceSending] = useState(false);
  const [announceForce, setAnnounceForce] = useState(false);

  const [lectures, setLectures] = useState<any[]>([]);
  const [lecturesLoading, setLecturesLoading] = useState(false);
  const [lectureForm, setLectureForm] = useState({ date: '', time_from: '', time_to: '', topic: '', location: '' });
  const [addLectureModal, setAddLectureModal] = useState(false);
  const [lectureSaving, setLectureSaving] = useState(false);
  const [editLectureModal, setEditLectureModal] = useState(false);
  const [editLectureForm, setEditLectureForm] = useState<any>({});
  const [editingLectureId, setEditingLectureId] = useState<number | null>(null);
  const [editLectureSaving, setEditLectureSaving] = useState(false);

  // Attendance
  const [attendanceModal, setAttendanceModal] = useState<{ lectureId: number; topic: string } | null>(null);
  const [attendanceCode, setAttendanceCode] = useState('');
  const [attendanceQR, setAttendanceQR] = useState('');
  const [attendanceExpiresIn, setAttendanceExpiresIn] = useState(15);
  const [attendanceActive, setAttendanceActive] = useState(false);
  const [attendanceSeed, setAttendanceSeed] = useState('');
  const [attendanceStudents, setAttendanceStudents] = useState<any[]>([]);
  const [attendanceSummary, setAttendanceSummary] = useState<{ present: number; total: number; percentage: number } | null>(null);
  const [attendanceLoading, setAttendanceLoading] = useState(false);
  const [attendanceCountdown, setAttendanceCountdown] = useState(15);
  const attendanceTimerRef = useRef<any>(null);
  const attendanceRefreshRef = useRef<any>(null);

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

  // Filter & sort
  const [statusFilter, setStatusFilter] = useState('');
  const [instructorFilter, setInstructorFilter] = useState('');

  // Batch selection
  const [selectedGroupIds, setSelectedGroupIds] = useState<Set<number>>(new Set());
  const [batchLoading, setBatchLoading] = useState(false);
  const [confirmBatchDelete, setConfirmBatchDelete] = useState(false);
  const [batchStatusModal, setBatchStatusModal] = useState(false);
  const [batchStatusValue, setBatchStatusValue] = useState('active');
  const [batchInstructorModal, setBatchInstructorModal] = useState(false);
  const [batchInstructorValue, setBatchInstructorValue] = useState('');

  // Unassigned batch selection
  const [selectedUnassignedIds, setSelectedUnassignedIds] = useState<Set<number>>(new Set());
  const [batchAssignGroupId, setBatchAssignGroupId] = useState<number | null>(null);

  const [confirmToggleCourse, setConfirmToggleCourse] = useState<any>(null);
  const [confirmDeleteCourse, setConfirmDeleteCourse] = useState<any>(null);
  const [confirmDeleteGroup, setConfirmDeleteGroup] = useState<any>(null);
  const [confirmRemoveStudent, setConfirmRemoveStudent] = useState<any>(null);
  const [confirmDeleteLecture, setConfirmDeleteLecture] = useState<any>(null);
  const [confirmCompleteGroup, setConfirmCompleteGroup] = useState<any>(null);
  const [confirmReopenGroup, setConfirmReopenGroup] = useState<any>(null);
  const [groupActionLoading, setGroupActionLoading] = useState(false);

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

  // ── Places (rooms) ─────────────────────────────
  useEffect(() => {
    api('/api/places')
      .then(data => { if (Array.isArray(data)) setPlaces(data); })
      .catch(() => { /* places may be unavailable for this role */ });
    api('/api/groups/instructor-accounts')
      .then(data => { if (Array.isArray(data)) setInstructorAccounts(data); })
      .catch(() => { /* instructor accounts are optional */ });
  }, []);

  const loadPlaceInfo = async (placeId: any, groupId?: number) => {
    if (!placeId) return { conflicts: [], groups: [] };
    try {
      const qs = `placeId=${placeId}${groupId ? `&groupId=${groupId}` : ''}`;
      const res = await api(`/api/places/conflicts?${qs}`);
      return {
        conflicts: Array.isArray(res.conflicts) ? res.conflicts : [],
        groups: Array.isArray(res.groups) ? res.groups : [],
      };
    } catch {
      return { conflicts: [], groups: [] };
    }
  };

  const handleSelectGroupPlace = async (value: string) => {
    const place = places.find(p => String(p.id) === value);
    setGroupForm(prev => ({
      ...prev,
      place_id: value,
      location: place ? place.name : '',
      max_students: place ? String(place.capacity) : prev.max_students,
    }));
    setGroupPlaceCap(place ? Number(place.capacity) : null);
    setGroupPlaceInfo(await loadPlaceInfo(value));
  };

  const handleSelectEditGroupPlace = async (value: string) => {
    const place = places.find(p => String(p.id) === value);
    setEditGroupForm((prev: any) => ({
      ...prev,
      place_id: value,
      location: place ? place.name : '',
      max_students: place ? String(place.capacity) : prev.max_students,
    }));
    setEditGroupPlaceCap(place ? Number(place.capacity) : null);
    setEditGroupPlaceInfo(await loadPlaceInfo(value, editingGroupId || undefined));
  };

  const warnPlaceConflict = async (group: any) => {
    if (!group?.place_id) return;
    const info = await loadPlaceInfo(group.place_id, group.id);
    if (info.conflicts.length > 0) {
      const list = info.conflicts
        .map((c: any) => `${c.name} (${(c.days || []).join('، ')} ${c.time_from || ''}-${c.time_to || ''})`)
        .join(' | ');
      toast(`⚠️ تعارض في المكان: ${list}`, 'warning');
    }
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
      enable_mobile_sticky_cta: course.enable_mobile_sticky_cta !== 0,
      auto_assign: Boolean(Number(course.auto_assign)),
      prevent_overlap: course.prevent_overlap !== undefined ? Boolean(Number(course.prevent_overlap)) : true,
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
        body: JSON.stringify({
          ...groupForm,
          course_id: courseId,
          place_id: groupForm.place_id ? Number(groupForm.place_id) : null,
          max_students: groupForm.max_students ? Number(groupForm.max_students) : null,
          instructor_user_id: groupForm.instructor_user_id ? Number(groupForm.instructor_user_id) : null,
        }),
      });
      setAddGroupModal(false);
      setGroupForm({ name: '', location: '', place_id: '', max_students: '', status: 'pending', instructor_user_id: '' });
      setGroupPlaceCap(null);
      setGroupPlaceInfo({ conflicts: [], groups: [] });
      toast('تم إضافة المجموعة', 'success');
      loadGroups();
    } catch (err: any) {
      toast(err?.message || 'فشل إضافة المجموعة', 'error');
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
      location: row.location || '',
      place_id: row.place_id != null ? String(row.place_id) : '',
      max_students: row.max_students?.toString() || '',
      instructor_user_id: row.instructor_user_id != null ? String(row.instructor_user_id) : '',
    });
    setEditGroupPlaceCap(row.place_capacity != null ? Number(row.place_capacity) : null);
    setEditGroupPlaceInfo({ conflicts: [], groups: [] });
    setEditGroupModal(true);
    if (row.place_id) {
      loadPlaceInfo(row.place_id, row.id).then(setEditGroupPlaceInfo);
    }
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
          place_id: editGroupForm.place_id ? Number(editGroupForm.place_id) : null,
          max_students: editGroupForm.max_students ? Number(editGroupForm.max_students) : null,
          status: editGroupForm.status,
          instructor_user_id: editGroupForm.instructor_user_id ? Number(editGroupForm.instructor_user_id) : null,
        }),
      });
      setEditGroupModal(false);
      setEditingGroupId(null);
      setEditGroupPlaceCap(null);
      setEditGroupPlaceInfo({ conflicts: [], groups: [] });
      toast('تم تحديث المجموعة', 'success');
      loadGroups();
    } catch (err: any) {
      toast(err?.message || 'فشل تحديث المجموعة', 'error');
    } finally {
      setEditGroupSaving(false);
    }
  };

  const openDetailGroup = async (group: any) => {
    setDetailGroup(group);
    setDetailGroupTab('info');
    setGroupStudentsLoading(true);
    setSurveyStats(null);
    setSurveyError('');
    loadLectures(group.id);
    try {
      const students = await api(`/api/groups/${group.id}/students`);
      setGroupStudents(students);
    } catch {
      toast('فشل تحميل الطلاب', 'error');
      setGroupStudents([]);
    }
    setGroupStudentsLoading(false);
    loadSurvey(group.id);
    loadInstructorEval(group.id);
  };

  // ── Group survey (edit-plan.md §4.4) ──────────────────────────
  const loadSurvey = async (groupId: number) => {
    setSurveyLoading(true);
    setSurveyError('');
    try {
      const stats = await api(`/api/surveys/group/${groupId}/stats`);
      setSurveyStats(stats);
    } catch (err: any) {
      setSurveyError(err?.message || 'فشل تحميل بيانات الاستبيان');
      setSurveyStats(null);
    } finally {
      setSurveyLoading(false);
    }
  };

  const remindSurveyPending = async () => {
    if (!detailGroup || surveyReminding) return;
    setSurveyReminding(true);
    try {
      const res: any = await api(`/api/surveys/group/${detailGroup.id}/remind`, { method: 'POST' });
      if (res?.sent > 0) toast(`تم إرسال التذكير إلى ${res.sent} طالب`, 'success');
      else toast('لا يوجد طلاب بانتظار الإجابة', 'info');
      await loadSurvey(detailGroup.id);
    } catch (err: any) {
      toast(err?.message || 'فشل إرسال التذكير', 'error');
    } finally {
      setSurveyReminding(false);
    }
  };

  const openSurveyExtend = () => {
    const current = surveyStats?.group?.closes_at ? new Date(surveyStats.group.closes_at) : null;
    const base = current && !Number.isNaN(current.getTime()) ? current : new Date();
    base.setDate(base.getDate() + 7);
    const iso = `${base.getFullYear()}-${String(base.getMonth() + 1).padStart(2, '0')}-${String(base.getDate()).padStart(2, '0')}`;
    setSurveyExtendDate(iso);
    setSurveyExtendOpen(true);
  };

  const saveSurveyExtend = async () => {
    if (!detailGroup || !surveyExtendDate || surveyExtendSaving) return;
    setSurveyExtendSaving(true);
    try {
      const closesAt = new Date(`${surveyExtendDate}T23:59:59`).toISOString();
      await api(`/api/surveys/group/${detailGroup.id}/window`, {
        method: 'PUT',
        body: JSON.stringify({ closes_at: closesAt }),
      });
      setSurveyExtendOpen(false);
      toast('تم تمديد مدة الاستبيان', 'success');
      await loadSurvey(detailGroup.id);
    } catch (err: any) {
      toast(err?.message || 'فشل تمديد المدة', 'error');
    } finally {
      setSurveyExtendSaving(false);
    }
  };

  // ── Instructor evaluation (edit-plan.md §5) ───────────────────
  const loadInstructorEval = async (groupId: number) => {
    setInstructorEvalLoading(true);
    try {
      const status = await api(`/api/groups/${groupId}/instructor-eval`);
      setInstructorEval(status);
    } catch {
      setInstructorEval(null);
    } finally {
      setInstructorEvalLoading(false);
    }
  };

  const reopenInstructorEval = async () => {
    if (!detailGroup || reopeningInstructorEval) return;
    setReopeningInstructorEval(true);
    try {
      await api(`/api/groups/${detailGroup.id}/instructor-eval/reopen`, { method: 'POST' });
      toast('تم إعادة فتح تقييم المحاضر', 'success');
      await loadInstructorEval(detailGroup.id);
    } catch (err: any) {
      toast(err?.message || 'فشل إعادة فتح التقييم', 'error');
    } finally {
      setReopeningInstructorEval(false);
    }
  };


  // ── Group report (edit-plan.md §8) ────────────────────────────
  const loadReport = async (groupId: number) => {
    setReportLoading(true);
    setReportError('');
    try {
      const data: any = await api(`/api/groups/${groupId}/report`);
      setReportData(data);
      setReportForm({
        activity_type: data?.group?.activity_type || '',
        report_notes: data?.group?.notes || '',
        report_recommendations: data?.group?.recommendations || '',
      });
    } catch (err: any) {
      setReportError(err?.message || 'فشل تحميل بيانات التقرير');
      setReportData(null);
    } finally {
      setReportLoading(false);
    }
  };

  const saveReportData = async () => {
    if (!detailGroup || reportSaving) return;
    setReportSaving(true);
    try {
      await api(`/api/groups/${detailGroup.id}`, {
        method: 'PUT',
        body: JSON.stringify(reportForm),
      });
      toast('تم حفظ بيانات التقرير', 'success');
      await loadReport(detailGroup.id);
      await refreshDetailGroup(detailGroup.id);
    } catch (err: any) {
      toast(err?.message || 'فشل حفظ بيانات التقرير', 'error');
    } finally {
      setReportSaving(false);
    }
  };

  const pickReportImages = (files: FileList | null) => {
    if (!files) return;
    const picked: File[] = [];
    for (const file of Array.from(files)) {
      if (!/^image\/(jpe?g|png)$/i.test(file.type)) {
        toast('الصور يجب أن تكون JPG أو PNG فقط', 'error');
        continue;
      }
      if (file.size > 5 * 1024 * 1024) {
        toast('حجم كل صورة يجب ألا يتجاوز 5 ميجابايت', 'error');
        continue;
      }
      picked.push(file);
    }
    const next = [...reportImages, ...picked].slice(0, 8);
    if (reportImages.length + picked.length > 8) {
      toast('الحد الأقصى 8 صور — تم الاحتفاظ بأول 8', 'info');
    }
    setReportImages(next);
  };

  const extractReport = async () => {
    if (!detailGroup || reportExtracting) return;
    setReportExtracting(true);
    try {
      const formData = new FormData();
      reportImages.slice(0, 8).forEach((file) => formData.append('images', file));
      await downloadFile(
        `/api/groups/${detailGroup.id}/report/word`,
        `report-${detailGroup.id}.docx`,
        { method: 'POST', body: formData },
      );
      toast('تم استخراج التقرير', 'success');
      setReportImagesOpen(false);
      setReportImages([]);
    } catch (err: any) {
      toast(err?.message || 'فشل استخراج التقرير', 'error');
    } finally {
      setReportExtracting(false);
    }
  };

  const exportGroupDataset = async (dataset: string, label: string) => {
    if (!detailGroup || exportingKey) return;
    setExportingKey(dataset);
    try {
      await downloadFile(
        `/api/exports/${dataset}?groupId=${detailGroup.id}`,
        `${dataset}-${detailGroup.id}.xlsx`,
      );
      toast(`تم تصدير ${label}`, 'success');
    } catch (err: any) {
      toast(err?.message || `فشل تصدير ${label}`, 'error');
    } finally {
      setExportingKey('');
    }
  };


  // ── Course announcement (edit-plan.md §7) ─────────────────────
  const openAnnouncement = async () => {
    if (!course) return;
    setAnnounceOpen(true);
    setAnnounceLoading(true);
    setAnnounceForce(false);
    try {
      const data: any = await api(`/api/courses/${course.id}/announcement`);
      setAnnounceForm({ title: data?.title || '', body: data?.body || '' });
      setAnnounceMeta({ sent_at: data?.sent_at || null, recipients: Number(data?.recipients || 0) });
    } catch (err: any) {
      toast(err?.message || 'فشل تحضير الإعلان', 'error');
      setAnnounceOpen(false);
    } finally {
      setAnnounceLoading(false);
    }
  };

  const sendAnnouncement = async () => {
    if (!course || announceSending) return;
    if (!announceForm.title.trim() || !announceForm.body.trim()) {
      toast('عنوان الإعلان ونصه مطلوبان', 'error');
      return;
    }
    setAnnounceSending(true);
    try {
      const res: any = await api(`/api/courses/${course.id}/announce`, {
        method: 'POST',
        body: JSON.stringify({ ...announceForm, force: announceForce }),
      });
      toast(`تم إرسال الإعلان إلى ${res?.recipients ?? 0} حساب`, 'success');
      setAnnounceOpen(false);
    } catch (err: any) {
      toast(err?.message || 'فشل إرسال الإعلان', 'error');
    } finally {
      setAnnounceSending(false);
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

  // ── Official group completion (edit-plan.md §4.2) ──────────────
  const isGroupCompleted = (g: any) =>
    !!g && (g.status === 'completed' || Number(g.is_complete) === 1 || !!g.completed_at);

  const refreshDetailGroup = async (groupId: number) => {
    try {
      const fresh = await api(`/api/groups/${groupId}`);
      setDetailGroup((prev: any) => (prev && Number(prev.id) === Number(groupId) ? fresh : prev));
    } catch { /* keep current view */ }
  };

  const completeGroup = async () => {
    if (!confirmCompleteGroup || groupActionLoading) return;
    const target = confirmCompleteGroup;
    setGroupActionLoading(true);
    try {
      const res: any = await api(`/api/groups/${target.id}/complete`, { method: 'POST' });
      setConfirmCompleteGroup(null);
      toast(
        `تم إنهاء المجموعة — ${res?.students ?? 0} طالب تم إشعارهم` +
          (res?.certificates ? ` وإصدار ${res.certificates} شهادة` : ''),
        'success',
      );
      await loadGroups();
      await refreshDetailGroup(target.id);
    } catch (err: any) {
      toast(err?.message || 'فشل إنهاء المجموعة', 'error');
    } finally {
      setGroupActionLoading(false);
    }
  };

  const reopenGroup = async () => {
    if (!confirmReopenGroup || groupActionLoading) return;
    const target = confirmReopenGroup;
    setGroupActionLoading(true);
    try {
      await api(`/api/groups/${target.id}/reopen`, { method: 'POST' });
      setConfirmReopenGroup(null);
      toast('تم إعادة فتح المجموعة', 'success');
      await loadGroups();
      await refreshDetailGroup(target.id);
    } catch (err: any) {
      toast(err?.message || 'فشل إعادة فتح المجموعة', 'error');
    } finally {
      setGroupActionLoading(false);
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
        body: JSON.stringify({ date: lectureForm.date, time_from: lectureForm.time_from, time_to: lectureForm.time_to, topic: lectureForm.topic, location: lectureForm.location }),
      });
      setAddLectureModal(false);
      setLectureForm({ date: '', time_from: '', time_to: '', topic: '', location: '' });
      toast('تم إضافة المحاضرة', 'success');
      loadLectures(detailGroup.id);
      loadGroups();
      warnPlaceConflict(detailGroup);
    } catch (err: any) {
      toast(err?.message || 'فشل إضافة المحاضرة', 'error');
    } finally {
      setLectureSaving(false);
    }
  };

  const startEditLecture = (lec: any) => {
    setEditingLectureId(lec.id);
      setEditLectureForm({
        topic: lec.topic || '', date: lec.date || '', time_from: lec.time_from || '', time_to: lec.time_to || '', location: lec.location || '',
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
      warnPlaceConflict(detailGroup);
    } catch (err: any) {
      toast(err?.message || 'فشل تحديث المحاضرة', 'error');
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
    } catch (err: any) {
      toast(err?.message || 'فشل تبديل حالة المحاضرة', 'error');
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

  // ── Attendance ──

  const startAttendance = async (lectureId: number) => {
    setAttendanceLoading(true);
    try {
      const res = await api(`/api/attendance/${lectureId}/start`, { method: 'POST' });
      setAttendanceSeed(res.seed);
      setAttendanceCode(res.code);
      setAttendanceQR(res.qrData);
      setAttendanceExpiresIn(res.expiresIn);
      setAttendanceActive(true);
      setAttendanceCountdown(res.expiresIn);
      startAttendanceRefresh(lectureId);
      loadAttendanceReport(lectureId);
      if (typeof res.studentsNotified === 'number' && res.studentsNotified === 0) {
        toast('تم فتح الحضور، لكن لا يوجد متدربون في هذه المجموعة — لن يصل أي إشعار', 'error');
      } else if (typeof res.studentsNotified === 'number') {
        toast(`تم فتح الحضور وإشعار ${res.studentsNotified} متدرباً`, 'success');
      }
    } catch (err: any) {
      toast(err?.message || 'فشل بدء تسجيل الحضور', 'error');
    } finally {
      setAttendanceLoading(false);
    }
  };

  const stopAttendance = async (lectureId: number) => {
    try {
      await api(`/api/attendance/stop/${lectureId}`, { method: 'POST' });
    } catch { /* ignore */ }
    setAttendanceActive(false);
    clearAttendanceTimers();
    setAttendanceModal(null);
    toast('تم إيقاف تسجيل الحضور', 'success');
  };

  const fetchCurrentCode = async (lectureId: number) => {
    try {
      const res = await api(`/api/attendance/${lectureId}/current`);
      if (res.code) {
        setAttendanceCode(res.code);
        setAttendanceQR(res.qrData);
        setAttendanceExpiresIn(res.expiresIn);
        setAttendanceCountdown(res.expiresIn);
        setAttendanceActive(true);
        loadAttendanceReport(lectureId);
      } else {
        setAttendanceActive(false);
        clearAttendanceTimers();
        toast('انتهت جلسة تسجيل الحضور', 'info');
        setAttendanceModal(null);
      }
    } catch {
      setAttendanceActive(false);
      clearAttendanceTimers();
    }
  };

  const startAttendanceRefresh = (lectureId: number) => {
    clearAttendanceTimers();
    attendanceTimerRef.current = setInterval(() => {
      setAttendanceCountdown(prev => {
        if (prev <= 1) return attendanceExpiresIn;
        return prev - 1;
      });
    }, 1000);
    attendanceRefreshRef.current = setInterval(() => {
      fetchCurrentCode(lectureId);
    }, attendanceExpiresIn * 1000);
  };

  const clearAttendanceTimers = () => {
    if (attendanceTimerRef.current) { clearInterval(attendanceTimerRef.current); attendanceTimerRef.current = null; }
    if (attendanceRefreshRef.current) { clearInterval(attendanceRefreshRef.current); attendanceRefreshRef.current = null; }
  };

  // Cleanup attendance timers on unmount to prevent memory leaks
  useEffect(() => () => clearAttendanceTimers(), []);

  const loadAttendanceReport = async (lectureId: number) => {
    try {
      const res = await api(`/api/attendance/${lectureId}`);
      setAttendanceStudents(res.students || []);
      setAttendanceSummary(res.summary || null);
    } catch { /* ignore */ }
  };

  const openAttendanceModal = (lec: any) => {
    setAttendanceModal({ lectureId: lec.id, topic: lec.topic || 'محاضرة' });
    setAttendanceCode('');
    setAttendanceQR('');
    setAttendanceActive(false);
    setAttendanceStudents([]);
    setAttendanceSummary(null);
    startAttendance(lec.id);
  };

  const closeAttendanceModal = () => {
    if (attendanceModal && attendanceActive) {
      stopAttendance(attendanceModal.lectureId);
    } else {
      clearAttendanceTimers();
      setAttendanceModal(null);
    }
  };

  const openAddStudent = async () => {
    setAddStudentModal(true);
    setSelectedStudentIds([]);
    setStudentSearch('');
    try {
      const data = await api(`/api/admin/unassigned/course/${courseId}`);
      setAllStudents(data.map((u: any) => ({ ...u, id: u.user_id })));
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
    } catch (err: any) {
      toast(err?.message || 'فشل إضافة الطلاب', 'error');
      // A capacity error may still have added some students before it stopped.
      try {
        const students = await api(`/api/groups/${detailGroup.id}/students`);
        setGroupStudents(students);
        loadGroups();
      } catch { /* ignore */ }
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
    } catch (err: any) {
      toast(err?.message || 'فشل تسكين الطالب', 'error');
    }
  };

  const openMoveStudent = async (student: any) => {
    setMoveStudentTarget(student);
    setMoveTargetGroupId(null);
    try {
      const groups = await api(`/api/groups?courseId=${courseId}`);
      setOtherGroups(groups.filter((g: any) => g.id !== detailGroup?.id && Number(g.is_active) === 1));
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
    } catch (err: any) {
      toast(err?.message || 'فشل نقل الطالب', 'error');
    }
    setMovingStudent(false);
  };

  // ── Batch actions ──
  const batchDelete = async () => {
    setBatchLoading(true);
    try {
      const ids = Array.from(selectedGroupIds);
      await api('/api/groups/batch/delete', { method: 'POST', body: JSON.stringify({ ids }) });
      toast(`تم حذف ${ids.length} مجموعة`, 'success');
      setConfirmBatchDelete(false);
      setSelectedGroupIds(new Set());
      loadGroups();
    } catch {
      toast('فشل الحذف الجماعي', 'error');
    }
    setBatchLoading(false);
  };


  const batchUpdateStatus = async () => {
    setBatchLoading(true);
    try {
      const ids = Array.from(selectedGroupIds);
      await api('/api/groups/batch/status', { method: 'POST', body: JSON.stringify({ ids, status: batchStatusValue }) });
      toast(`تم تغيير حالة ${ids.length} مجموعة`, 'success');
      setBatchStatusModal(false);
      setSelectedGroupIds(new Set());
      loadGroups();
    } catch {
      toast('فشل تغيير الحالة الجماعي', 'error');
    }
    setBatchLoading(false);
  };

  const batchUpdateInstructor = async () => {
    if (!batchInstructorValue.trim()) return;
    setBatchLoading(true);
    try {
      const ids = Array.from(selectedGroupIds);
      await api('/api/groups/batch/instructor', { method: 'PATCH', body: JSON.stringify({ ids, instructor_name: batchInstructorValue }) });
      toast(`تم تغيير مدرب ${ids.length} مجموعة`, 'success');
      setBatchInstructorModal(false);
      setBatchInstructorValue('');
      setSelectedGroupIds(new Set());
      loadGroups();
    } catch {
      toast('فشل تغيير المدرب الجماعي', 'error');
    }
    setBatchLoading(false);
  };

  const batchAssignStudents = async () => {
    if (!batchAssignGroupId || selectedUnassignedIds.size === 0) return;
    setBatchLoading(true);
    try {
      const userIds = Array.from(selectedUnassignedIds);
      await api('/api/groups/batch/assign-students', {
        method: 'POST',
        body: JSON.stringify({ user_ids: userIds, group_id: batchAssignGroupId }),
      });
      toast(`تم تسكين ${userIds.length} طالب`, 'success');
      setSelectedUnassignedIds(new Set());
      setBatchAssignGroupId(null);
      loadUnassigned();
      if (detailGroup) {
        const students = await api(`/api/groups/${detailGroup.id}/students`);
        setGroupStudents(students);
      }
      loadGroups();
    } catch (err: any) {
      toast(err?.message || 'فشل التسكين الجماعي', 'error');
      loadUnassigned();
      loadGroups();
    }
    setBatchLoading(false);
  };

  const filteredStudents = allStudents.filter((s: any) =>
    !studentSearch || s.name.includes(studentSearch) || s.email.includes(studentSearch) || s.phone?.includes(studentSearch)
  );

  const uniqueInstructors = Array.from(new Set(groups.map((g: any) => g.instructor_name).filter(Boolean)));

  const filteredGroups = groups.filter((g: any) => {
    if (statusFilter) {
      const gStatus = g.status || (Number(g.is_active) ? 'active' : 'cancelled');
      if (gStatus !== statusFilter) return false;
    }
    if (instructorFilter && g.instructor_name !== instructorFilter) return false;
    return true;
  });


  const tabs = [
    { key: 'info', label: 'معلومات الكورس' },
    { key: 'groups', label: `المجموعات (${groups.length})` },
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
          <button onClick={() => void openAnnouncement()}
            className="px-4 py-2 rounded-xl text-sm font-medium border"
            style={{ borderColor: 'var(--border)', color: 'var(--text)' }}>
            📣 إرسال الإعلان
          </button>
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
            {course.prevent_overlap !== undefined && (
              <div className="p-3 rounded-xl" style={{ backgroundColor: 'var(--bg)' }}>
                <span className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>منع تداخل المجموعات</span>
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium"
                  style={{
                    backgroundColor: Number(course.prevent_overlap) ? 'rgba(251,191,36,0.15)' : 'rgba(239,68,68,0.1)',
                    color: Number(course.prevent_overlap) ? '#92400e' : '#dc2626',
                  }}>
                  {Number(course.prevent_overlap) ? '🔒 مفعل' : '🔓 غير مفعل'}
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
            <h2 className="font-bold" style={{ color: 'var(--text)' }}>المجموعات ({filteredGroups.length})</h2>
            <div className="flex items-center gap-2">
              <ExportButton
                dataset="groups"
                title="تصدير مجموعات الكورس"
                query={{ courseId: course.id, status: statusFilter || undefined }}
                variant="soft"
              />
              <button onClick={() => {
                setGroupForm({ name: '', location: '', place_id: '', max_students: '', status: 'pending', instructor_user_id: '' });
                setGroupPlaceCap(null);
                setGroupPlaceInfo({ conflicts: [], groups: [] });
                setAddGroupModal(true);
              }}
                className="px-4 py-2 rounded-xl text-sm font-medium text-white" style={{ backgroundColor: 'var(--primary)' }}>
                + إضافة مجموعة
              </button>
            </div>
          </div>

          {/* Filters */}
          <div className="flex gap-2 flex-wrap">
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
              className="px-3 py-2 rounded-xl border text-xs" style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }}>
              <option value="">كل الحالات</option>
              <option value="pending">⏳ قيد الانتظار</option>
              <option value="active">🟢 نشط</option>
              <option value="completed">✅ مكتمل</option>
              <option value="cancelled">❌ ملغي</option>
            </select>
            {uniqueInstructors.length > 0 && (
              <select value={instructorFilter} onChange={e => setInstructorFilter(e.target.value)}
                className="px-3 py-2 rounded-xl border text-xs" style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }}>
                <option value="">كل المدربين</option>
                {uniqueInstructors.map((name: string) => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
            )}
            {selectedGroupIds.size > 0 && (
              <span className="px-3 py-2 rounded-xl text-xs font-medium" style={{ backgroundColor: 'var(--primary)', color: '#fff' }}>
                ✓ {selectedGroupIds.size} مختارة
              </span>
            )}
          </div>

          {/* Batch action bar */}
          {selectedGroupIds.size > 0 && (
            <div className="flex items-center gap-2 p-3 rounded-xl border animate-fade-in"
              style={{ backgroundColor: 'rgba(59,130,246,0.06)', borderColor: 'rgba(59,130,246,0.2)' }}>
              <span className="text-sm font-medium ml-2" style={{ color: 'var(--text)' }}>إجراء جماعي:</span>
              <button onClick={() => { setBatchStatusValue('active'); setBatchStatusModal(true); }} disabled={batchLoading}
                className="px-3 py-1.5 rounded-lg text-xs font-medium disabled:opacity-50"
                style={{ backgroundColor: '#eff6ff', color: '#2563eb' }}>📋 تغيير الحالة</button>
              <button onClick={() => { setBatchInstructorValue(''); setBatchInstructorModal(true); }} disabled={batchLoading}
                className="px-3 py-1.5 rounded-lg text-xs font-medium disabled:opacity-50"
                style={{ backgroundColor: '#f5f3ff', color: '#7c3aed' }}>🔄 تغيير المدرب</button>
              <button onClick={() => setConfirmBatchDelete(true)} disabled={batchLoading}
                className="px-3 py-1.5 rounded-lg text-xs font-medium disabled:opacity-50"
                style={{ backgroundColor: '#fef2f2', color: '#dc2626' }}>🗑️ حذف</button>
              {batchLoading && <div className="animate-spin h-4 w-4 border-2 rounded-full" style={{ borderColor: 'var(--primary)', borderTopColor: 'transparent' }} />}
            </div>
          )}

          {groupsLoading ? (
            <Skeleton rows={4} cols={6} />
          ) : (
            <DataTable
              selectable
              rowKey="id"
              selectedIds={selectedGroupIds}
              onSelectionChange={setSelectedGroupIds}
              columns={[
                { key: 'name', label: 'اسم المجموعة', render: (v: string, row: any) => (
                  <span className="flex items-center gap-1.5">
                    {v}
                    {row.has_started && <span title="بدأت — لا يمكن التسكين" className="text-xs" style={{ color: '#1d4ed8' }}>🚀</span>}
                  </span>
                )},
                { key: 'instructor_name', label: 'المدرب' },
                { key: 'place_name', label: 'المكان', render: (_: any, row: any) => (
                  row.place_name
                    ? <span>📍 {row.place_name}</span>
                    : <span style={{ color: 'var(--text-muted)' }}>{course?.course_mode === 'offline' ? (row.location || 'غير محدد') : '💻 أونلاين'}</span>
                )},
                { key: 'student_count', label: 'عدد الطلاب', render: (v: number, row: any) => {
                  const cap = row.place_capacity != null
                    ? Math.min(Number(row.place_capacity), Number(row.max_students ?? row.place_capacity))
                    : row.max_students;
                  return `${v || 0}${cap ? ` / ${cap}` : ''} طالب`;
                } },
                { key: 'schedule_display', label: 'الموعد', render: (v: string) => v || 'لم يتم تحديد الميعاد بعد' },
                { key: 'status', label: 'الحالة', render: (v: any, row: any) => (
                  <div className="flex items-center gap-2">
                    <StatusBadge status={row.status || (Number(row.is_active) ? 'active' : 'cancelled')} />
                    {!row.status && !Number(row.is_active) && <span className="text-xs" style={{ color: 'var(--text-muted)' }}>(قديم)</span>}
                  </div>
                )},
                { key: 'actions', label: 'الإجراءات', render: (_: any, row: any) => (
                  <div className="flex gap-1 flex-wrap" onClick={e => e.stopPropagation()}>
                    {isGroupCompleted(row) ? (
                      <button onClick={() => setConfirmReopenGroup(row)}
                        data-testid={`group-reopen-${row.id}`}
                        className="px-2 py-1 rounded-lg text-xs font-medium bg-amber-50 text-amber-700 hover:bg-amber-100">↩️ إعادة فتح</button>
                    ) : row.status !== 'cancelled' ? (
                      <button onClick={() => setConfirmCompleteGroup(row)}
                        data-testid={`group-complete-${row.id}`}
                        disabled={(row.lecture_progress?.total || 0) === 0}
                        title={(row.lecture_progress?.total || 0) === 0 ? 'أضف محاضرة واحدة على الأقل أولاً' : ''}
                        className="px-2 py-1 rounded-lg text-xs font-medium bg-emerald-50 text-emerald-700 hover:bg-emerald-100 disabled:opacity-40">🏁 إنهاء</button>
                    ) : null}
                    <button onClick={() => startEditGroup(row)}
                      className="px-2 py-1 rounded-lg text-xs font-medium bg-blue-50 text-blue-600 hover:bg-blue-100">تعديل</button>
                    <button onClick={() => setConfirmDeleteGroup(row)}
                      className="px-2 py-1 rounded-lg text-xs font-medium bg-red-50 text-red-600 hover:bg-red-100">حذف</button>
                  </div>
                )},
              ]}
              data={filteredGroups}
              onRowClick={openDetailGroup}
            />
          )}
        </div>
      )}

      {/* ============================== TAB: Students ============================== */}
      {tab === 'students' && (
        <div className="rounded-2xl p-6 shadow-sm border space-y-4" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}>
          <div className="flex items-center justify-between">
            <h2 className="font-bold" style={{ color: 'var(--text)' }}>الطلاب المسجلين ({courseStudents.length})</h2>
            <ExportButton dataset="orders" title="تصدير طلاب الكورس" query={{ courseId: course.id }} variant="soft" />
          </div>
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
                    <span style={{ color: 'var(--text-muted)' }}>{(o.items?.find((i: any) => Number(i.course_id) === Number(course.id))?.price ?? o.amount)} ج.م</span>
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
            <ExportButton dataset="unassigned" title="تصدير الطلاب غير المسكنين" query={{ courseId: course.id }} variant="soft" />
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
              {/* Batch assign bar */}
              {selectedUnassignedIds.size > 0 && (
                <div className="flex items-center gap-2 p-3 rounded-xl border animate-fade-in"
                  style={{ backgroundColor: 'rgba(59,130,246,0.06)', borderColor: 'rgba(59,130,246,0.2)' }}>
                  <span className="text-sm font-medium" style={{ color: 'var(--text)' }}>✓ {selectedUnassignedIds.size} طالب — تسكين في:</span>
                  <select value={batchAssignGroupId || ''} onChange={e => setBatchAssignGroupId(Number(e.target.value))}
                    className="px-3 py-1.5 rounded-lg text-xs border flex-1" style={{ backgroundColor: 'white', borderColor: 'var(--border)' }}>
                    <option value="">اختر مجموعة...</option>
                    {groups.filter((g: any) => Number(g.is_active) && !g.has_started).map((g: any) => (
                      <option key={g.id} value={g.id}>{g.name} ({g.student_count || 0}/{g.max_students || '∞'}){g.has_started ? ' 🚀' : ''}</option>
                    ))}
                    {groups.filter((g: any) => Number(g.is_active) && g.has_started).length > 0 && (
                      <optgroup label="🚀 مجموعات بدأت (غير متاح)">
                        {groups.filter((g: any) => Number(g.is_active) && g.has_started).map((g: any) => (
                          <option key={g.id} value={g.id} disabled>{g.name} — بدأت</option>
                        ))}
                      </optgroup>
                    )}
                  </select>
                  <button onClick={batchAssignStudents} disabled={!batchAssignGroupId || batchLoading}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium text-white disabled:opacity-50"
                    style={{ backgroundColor: 'var(--primary)' }}>
                    {batchLoading ? 'جاري...' : 'تسكين'}
                  </button>
                  <button onClick={() => { setSelectedUnassignedIds(new Set()); setBatchAssignGroupId(null); }}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium" style={{ backgroundColor: '#f3f4f6', color: 'var(--text)' }}>إلغاء</button>
                </div>
              )}
              {/* Check all toggle */}
              <label className="flex items-center gap-2 px-1 py-1 cursor-pointer">
                <input type="checkbox"
                  checked={unassignedStudents.length > 0 && unassignedStudents.every((u: any) => selectedUnassignedIds.has(u.user_id))}
                  onChange={() => {
                    if (unassignedStudents.every((u: any) => selectedUnassignedIds.has(u.user_id))) {
                      setSelectedUnassignedIds(new Set());
                    } else {
                      setSelectedUnassignedIds(new Set(unassignedStudents.map((u: any) => u.user_id)));
                    }
                  }}
                  className="accent-blue-600 w-4 h-4 cursor-pointer" />
                <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>تحديد الكل</span>
              </label>
              {unassignedStudents.map((u: any) => {
                const isSelected = selectedUnassignedIds.has(u.user_id);
                return (
                  <div key={u.order_id} className="flex items-center justify-between p-3 rounded-xl text-sm border-2"
                    style={{
                      backgroundColor: isSelected ? 'rgba(59,130,246,0.08)' : '#fef2f2',
                      borderColor: isSelected ? 'rgba(59,130,246,0.3)' : '#fecaca',
                    }}>
                    <div className="flex items-center gap-3" onClick={() => {
                      const next = new Set(selectedUnassignedIds);
                      if (next.has(u.user_id)) next.delete(u.user_id); else next.add(u.user_id);
                      setSelectedUnassignedIds(next);
                    }}>
                      <input type="checkbox" checked={isSelected} readOnly
                        className="accent-blue-600 w-4 h-4 cursor-pointer" />
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
                        {groups.filter((g: any) => Number(g.is_active) && !g.has_started).map((g: any) => (
                          <option key={g.id} value={g.id}>{g.name} ({g.student_count || 0}/{g.max_students || '∞'})</option>
                        ))}
                        {groups.filter((g: any) => Number(g.is_active) && g.has_started).length > 0 && (
                          <optgroup label="🚀 غير متاح (بدأت)">
                            {groups.filter((g: any) => Number(g.is_active) && g.has_started).map((g: any) => (
                              <option key={g.id} value={g.id} disabled>{g.name} — بدأت</option>
                            ))}
                          </optgroup>
                        )}
                      </select>
                    </div>
                  </div>
                );
              })}
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
            <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>رابط المادة العلمية (Google Drive / PDF)</label>
            <input type="url" dir="ltr" placeholder="https://drive.google.com/file/d/..." value={editForm.materials_url || ''}
              onChange={e => setEditForm({ ...editForm, materials_url: e.target.value })}
              maxLength={500}
              className="w-full px-4 py-2.5 rounded-xl border text-sm text-left" style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }} />
            <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
              للملفات الأكبر من 20 ميجا ارفعها على درايف وضع رابط المشاركة هنا. يظهر الرابط للطلاب المسجلين فقط.
            </p>
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
          <div className="flex items-center gap-3 py-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={editForm.enable_mobile_sticky_cta} onChange={e => setEditForm({ ...editForm, enable_mobile_sticky_cta: e.target.checked })} className="accent-blue-600 w-4 h-4" />
              <span className="text-sm" style={{ color: 'var(--text)' }}>📱 إظهار شريط الشراء السفلي في الموبايل</span>
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
          <div className="flex items-center gap-3 py-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={editForm.prevent_overlap} onChange={e => setEditForm({ ...editForm, prevent_overlap: e.target.checked })} className="accent-amber-600 w-4 h-4" />
              <span className="text-sm font-medium" style={{ color: '#92400e' }}>🔒 منع تداخل المجموعات النشطة</span>
            </label>
          </div>
          <div className="col-span-2 -mt-1 mb-2 p-2.5 rounded-xl text-xs" style={{ backgroundColor: '#fffbeb', border: '1px solid #fde68a' }}>
            <span style={{ color: '#92400e' }}>عند التفعيل: لا يُسمح بوجود أكثر من مجموعة نشطة (is_active=1) لنفس الكورس في نفس الوقت. أي مجموعة جديدة تُنشأ كـ "غير نشطة" تلقائياً.</span>
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
          <div>
            <label className="text-xs block mb-1" style={{ color: 'var(--text-muted)' }}>حساب المحاضر</label>
            <select value={groupForm.instructor_user_id} onChange={e => setGroupForm({ ...groupForm, instructor_user_id: e.target.value })}
              className="w-full px-4 py-2.5 rounded-xl border text-sm"
              style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }}>
              <option value="">بدون حساب{course?.instructor ? ` — ${course.instructor}` : ''}</option>
              {instructorAccounts.map((account: any) => (
                <option key={account.id} value={account.id}>{account.name}</option>
              ))}
            </select>
            <p className="text-[11px] mt-1" style={{ color: 'var(--text-muted)' }}>يربط المجموعة بحساب المحاضر لتقييم الطلاب وإشعاره.</p>
          </div>
          {course?.course_mode === 'offline' ? (
            <select value={groupForm.place_id} onChange={e => handleSelectGroupPlace(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border text-sm"
              style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }}>
              <option value="">اختر المكان</option>
              {places.filter(p => Number(p.is_active)).map((p: any) => (
                <option key={p.id} value={p.id}>{p.name} — سعة {p.capacity}</option>
              ))}
            </select>
          ) : (
            <div className="p-3 rounded-xl text-sm" style={{ backgroundColor: 'var(--bg)' }}>
              <span className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>نوع الانعقاد</span>
              <span style={{ color: 'var(--text)' }}>💻 أونلاين — بدون مكان</span>
            </div>
          )}
          <div>
            <input placeholder="الحد الأقصى للطلاب" type="number" min="1" max={groupPlaceCap ?? undefined}
              value={groupForm.max_students}
              onChange={e => {
                const v = e.target.value;
                setGroupForm({
                  ...groupForm,
                  max_students: groupPlaceCap != null && v !== '' && Number(v) > groupPlaceCap ? String(groupPlaceCap) : v,
                });
              }}
              className="w-full px-4 py-2.5 rounded-xl border text-sm" style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }} />
            {groupPlaceCap != null && (
              <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>سعة المكان {groupPlaceCap} طالب — يمكنك تقليلها فقط</p>
            )}
          </div>
          {groupForm.place_id && groupPlaceInfo.groups.length > 0 && (
            <div className="col-span-2 p-3 rounded-xl text-xs" style={{
              backgroundColor: groupPlaceInfo.conflicts.length ? '#fef2f2' : 'var(--bg)',
              border: `1px solid ${groupPlaceInfo.conflicts.length ? '#fca5a5' : 'var(--border)'}`,
              color: groupPlaceInfo.conflicts.length ? '#991b1b' : 'var(--text-muted)',
            }}>
              <p className="font-bold mb-1">
                {groupPlaceInfo.conflicts.length
                  ? '⚠️ تعارض في حجز المكان (تحذير فقط — يمكنك المتابعة)'
                  : 'ℹ️ هذا المكان مستخدم في مجموعات أخرى'}
              </p>
              <ul className="space-y-0.5">
                {(groupPlaceInfo.conflicts.length ? groupPlaceInfo.conflicts : groupPlaceInfo.groups).map((c: any) => (
                  <li key={c.id}>
                    • {c.name} — {(c.days || []).join('، ') || 'بدون أيام'}{c.time_from ? ` ${c.time_from}` : ''}{c.time_to ? ` - ${c.time_to}` : ''}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="col-span-2 p-3 rounded-xl text-sm flex items-center gap-2" style={{ backgroundColor: '#fef3c7', border: '1px solid #f59e0b' }}>
            <span style={{ color: '#92400e' }}>📅</span>
            <span style={{ color: '#92400e', fontWeight: 500 }}>الموعد يُحدد من تاريخ أول محاضرة</span>
          </div>
          <select value={groupForm.status || 'pending'}
            onChange={e => setGroupForm({ ...groupForm, status: e.target.value })}
            className="col-span-2 w-full px-4 py-2.5 rounded-xl border text-sm"
            style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }}>
            <option value="pending">قيد الانتظار</option>
            <option value="active">نشطة</option>
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
          <div>
            <label className="text-xs block mb-1" style={{ color: 'var(--text-muted)' }}>حساب المحاضر</label>
            <select value={editGroupForm.instructor_user_id || ''} onChange={e => setEditGroupForm({ ...editGroupForm, instructor_user_id: e.target.value })}
              className="w-full px-4 py-2.5 rounded-xl border text-sm"
              style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }}>
              <option value="">بدون حساب{course?.instructor ? ` — ${course.instructor}` : ''}</option>
              {instructorAccounts.map((account: any) => (
                <option key={account.id} value={account.id}>{account.name}</option>
              ))}
            </select>
            <p className="text-[11px] mt-1" style={{ color: 'var(--text-muted)' }}>حساب المحاضر يستقبل إشعار فتح التقييم.</p>
          </div>
          {course?.course_mode === 'offline' ? (
            <select value={editGroupForm.place_id || ''} onChange={e => handleSelectEditGroupPlace(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border text-sm"
              style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }}>
              <option value="">اختر المكان</option>
              {places
                .filter(p => Number(p.is_active) || String(p.id) === String(editGroupForm.place_id))
                .map((p: any) => (
                  <option key={p.id} value={p.id}>{p.name} — سعة {p.capacity}{Number(p.is_active) ? '' : ' (معطّل)'}</option>
                ))}
            </select>
          ) : (
            <div className="p-3 rounded-xl text-sm" style={{ backgroundColor: 'var(--bg)' }}>
              <span className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>نوع الانعقاد</span>
              <span style={{ color: 'var(--text)' }}>💻 أونلاين — بدون مكان</span>
            </div>
          )}
          <div>
            <input placeholder="الحد الأقصى للطلاب" type="number" min="1" max={editGroupPlaceCap ?? undefined}
              value={editGroupForm.max_students}
              onChange={e => {
                const v = e.target.value;
                setEditGroupForm({
                  ...editGroupForm,
                  max_students: editGroupPlaceCap != null && v !== '' && Number(v) > editGroupPlaceCap ? String(editGroupPlaceCap) : v,
                });
              }}
              className="w-full px-4 py-2.5 rounded-xl border text-sm" style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }} />
            {editGroupPlaceCap != null && (
              <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>سعة المكان {editGroupPlaceCap} طالب — يمكنك تقليلها فقط</p>
            )}
          </div>
          {editGroupForm.place_id && editGroupPlaceInfo.groups.length > 0 && (
            <div className="col-span-2 p-3 rounded-xl text-xs" style={{
              backgroundColor: editGroupPlaceInfo.conflicts.length ? '#fef2f2' : 'var(--bg)',
              border: `1px solid ${editGroupPlaceInfo.conflicts.length ? '#fca5a5' : 'var(--border)'}`,
              color: editGroupPlaceInfo.conflicts.length ? '#991b1b' : 'var(--text-muted)',
            }}>
              <p className="font-bold mb-1">
                {editGroupPlaceInfo.conflicts.length
                  ? '⚠️ تعارض في حجز المكان (تحذير فقط — يمكنك المتابعة)'
                  : 'ℹ️ هذا المكان مستخدم في مجموعات أخرى'}
              </p>
              <ul className="space-y-0.5">
                {(editGroupPlaceInfo.conflicts.length ? editGroupPlaceInfo.conflicts : editGroupPlaceInfo.groups).map((c: any) => (
                  <li key={c.id}>
                    • {c.name} — {(c.days || []).join('، ') || 'بدون أيام'}{c.time_from ? ` ${c.time_from}` : ''}{c.time_to ? ` - ${c.time_to}` : ''}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="col-span-2 p-3 rounded-xl text-sm flex items-center gap-2" style={{ backgroundColor: '#fef3c7', border: '1px solid #f59e0b' }}>
            <span style={{ color: '#92400e' }}>📅</span>
            <span style={{ color: '#92400e', fontWeight: 500 }}>الموعد يُحدد من تاريخ أول محاضرة</span>
          </div>
          <select value={editGroupForm.status || 'pending'}
            onChange={e => setEditGroupForm({ ...editGroupForm, status: e.target.value })}
            className="col-span-2 w-full px-4 py-2.5 rounded-xl border text-sm"
            style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }}>
            <option value="pending">قيد الانتظار</option>
            <option value="active">نشطة</option>
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
              {(['info', 'lectures', 'students', 'survey', 'report'] as const).map(t => (
                <button key={t} onClick={() => {
                  setDetailGroupTab(t);
                  if (t === 'survey') loadSurvey(detailGroup.id);
                  if (t === 'report') loadReport(detailGroup.id);
                }}
                  className="px-4 py-2 rounded-lg text-sm font-medium transition-all"
                  style={{
                    backgroundColor: detailGroupTab === t ? 'var(--primary)' : 'transparent',
                    color: detailGroupTab === t ? '#fff' : 'var(--text)',
                  }}>
                  {t === 'info' ? 'معلومات' : t === 'lectures' ? 'جدول المحاضرات' : t === 'students' ? 'الطلاب' : t === 'survey' ? 'الاستبيان' : '📄 التقرير'}
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
                    <span style={{ color: 'var(--text)' }}>
                      {detailGroup.place_name || detailGroup.location}
                      {detailGroup.place_capacity ? ` — سعة ${detailGroup.place_capacity}` : ''}
                    </span>
                  </div>
                )}
                {detailGroup.schedule_display && (
                  <div className="p-3 rounded-xl col-span-2" style={{
                    backgroundColor: detailGroup.schedule_display === 'لم يتم تحديد الميعاد بعد' ? '#fef3c7' : 'var(--bg)',
                    border: detailGroup.schedule_display === 'لم يتم تحديد الميعاد بعد' ? '1px solid #f59e0b' : 'none',
                  }}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>الموعد</span>
                      {detailGroup.has_started && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: '#dbeafe', color: '#1d4ed8' }}>
                          🚀 بدأت
                        </span>
                      )}
                    </div>
                    <span style={{
                      color: detailGroup.schedule_display === 'لم يتم تحديد الميعاد بعد' ? '#92400e' : 'var(--text)',
                      fontWeight: detailGroup.schedule_display === 'لم يتم تحديد الميعاد بعد' ? '600' : '400',
                    }}>
                      {detailGroup.schedule_display === 'لم يتم تحديد الميعاد بعد' ? '⚠️ ' : ''}{detailGroup.schedule_display}
                    </span>
                    {detailGroup.has_started && (
                      <div className="mt-2 text-xs" style={{ color: '#dc2626' }}>لا يمكن تسكين طلاب جدد في هذه المجموعة لأنها بدأت بالفعل</div>
                    )}
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
                    {detailGroup.lecture_progress?.done ?? detailGroup.lecture_done ?? 0} / {detailGroup.lecture_progress?.total ?? detailGroup.lecture_count ?? 0}
                  </span>
                </div>
                {isGroupCompleted(detailGroup) && (
                  <>
                    <div className="p-3 rounded-xl" style={{ backgroundColor: '#ecfdf5' }}>
                      <span className="block text-xs mb-1" style={{ color: '#047857' }}>تاريخ الإنهاء</span>
                      <span style={{ color: '#065f46' }}>
                        {detailGroup.completed_at
                          ? new Date(detailGroup.completed_at).toLocaleString('ar-EG')
                          : '—'}
                      </span>
                    </div>
                    <div className="p-3 rounded-xl" style={{ backgroundColor: '#ecfdf5' }}>
                      <span className="block text-xs mb-1" style={{ color: '#047857' }}>أنهى المجموعة</span>
                      <span style={{ color: '#065f46' }}>{detailGroup.completed_by_name || '—'}</span>
                    </div>
                  </>
                )}
                <div className="col-span-2 p-3 rounded-xl" style={{ backgroundColor: 'var(--bg)' }}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <span className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>تقييم المحاضر للطلاب</span>
                      {instructorEvalLoading ? (
                        <span className="text-sm" style={{ color: 'var(--text-muted)' }}>جارٍ التحميل…</span>
                      ) : instructorEval?.instructor_user_id == null ? (
                        <span className="text-sm" style={{ color: 'var(--text-muted)' }}>
                          لم يُربط حساب محاضر بهذه المجموعة — اربطه من «تعديل» ليتمكن من التقييم.
                        </span>
                      ) : instructorEval?.status === 'submitted' ? (
                        <span className="text-sm" style={{ color: '#047857' }}>
                          ✅ تم الإرسال{instructorEval.submitted_at ? ` في ${new Date(instructorEval.submitted_at).toLocaleDateString('ar-EG')}` : ''}
                          {` — ${instructorEval.completed_count} / ${instructorEval.students_count} طالب`}
                        </span>
                      ) : instructorEval?.status === 'draft' ? (
                        <span className="text-sm" style={{ color: 'var(--text)' }}>
                          ⏳ قيد الإدخال — {instructorEval.completed_count} / {instructorEval.students_count} طالب مكتمل
                        </span>
                      ) : (
                        <span className="text-sm" style={{ color: 'var(--text-muted)' }}>
                          {isGroupCompleted(detailGroup) ? 'لم يبدأ المحاضر التقييم بعد.' : 'يُفتح بعد إنهاء المجموعة.'}
                        </span>
                      )}
                    </div>
                    {isAdmin && instructorEval?.can_reopen && (
                      <button onClick={reopenInstructorEval} disabled={reopeningInstructorEval}
                        className="px-3 py-1.5 rounded-lg text-xs font-medium disabled:opacity-50"
                        style={{ backgroundColor: '#fef3c7', color: '#92400e' }}>
                        {reopeningInstructorEval ? 'جارٍ الفتح…' : '🔓 إعادة فتح التقييم'}
                      </button>
                    )}
                  </div>
                </div>
                <div className="col-span-2 flex flex-col sm:flex-row gap-2">
                  {isGroupCompleted(detailGroup) ? (
                    <button onClick={() => setConfirmReopenGroup(detailGroup)}
                      className="flex-1 py-2.5 rounded-xl text-sm font-medium text-white"
                      style={{ backgroundColor: '#f59e0b' }}>
                      ↩️ إعادة فتح المجموعة
                    </button>
                  ) : detailGroup.status !== 'cancelled' ? (
                    <button onClick={() => setConfirmCompleteGroup(detailGroup)}
                      disabled={(detailGroup.lecture_progress?.total ?? detailGroup.lecture_count ?? 0) === 0}
                      title={(detailGroup.lecture_progress?.total ?? detailGroup.lecture_count ?? 0) === 0 ? 'أضف محاضرة واحدة على الأقل أولاً' : ''}
                      className="flex-1 py-2.5 rounded-xl text-sm font-medium text-white disabled:opacity-50"
                      style={{ backgroundColor: '#059669' }}>
                      🏁 إنهاء المجموعة
                    </button>
                  ) : null}
                </div>
              </div>
            )}

            {detailGroupTab === 'survey' && (
              <div className="space-y-4">
                {!isGroupCompleted(detailGroup) ? (
                  <div className="p-4 rounded-xl text-sm" style={{ backgroundColor: '#fef3c7', color: '#92400e' }}>
                    ⏳ يُفتح استبيان الطالب تلقائياً بعد إنهاء المجموعة. أنهِ المجموعة من تبويب «معلومات» أولاً.
                  </div>
                ) : surveyLoading ? (
                  <div className="flex items-center justify-center py-10">
                    <div className="animate-spin h-8 w-8 border-4 rounded-full" style={{ borderColor: 'var(--primary)', borderTopColor: 'transparent' }} />
                  </div>
                ) : surveyError ? (
                  <div className="flex flex-col items-center gap-3 py-8">
                    <p className="text-sm" style={{ color: '#dc2626' }}>{surveyError}</p>
                    <button onClick={() => loadSurvey(detailGroup.id)} className="px-4 py-2 rounded-xl text-sm text-white" style={{ backgroundColor: 'var(--primary)' }}>
                      إعادة المحاولة
                    </button>
                  </div>
                ) : surveyStats && (
                  <>
                    {/* نسبة الإجابة */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="p-4 rounded-xl sm:col-span-2" style={{ backgroundColor: 'var(--bg)' }}>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-bold" style={{ color: 'var(--text)' }}>نسبة الإجابة</span>
                          <span className="text-sm font-bold" style={{ color: 'var(--primary)' }}>
                            {surveyStats.answered} من {surveyStats.total_students} ({surveyStats.response_rate}%)
                          </span>
                        </div>
                        <div className="w-full h-2.5 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--border)' }}>
                          <div className="h-full rounded-full transition-all duration-500"
                            style={{ width: `${surveyStats.response_rate}%`, backgroundColor: 'var(--primary)' }} />
                        </div>
                        <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>
                          {surveyStats.pending > 0 ? `${surveyStats.pending} طالب لم يجب بعد` : 'أجاب جميع الطلاب 🎉'}
                        </p>
                      </div>
                      <div className="p-4 rounded-xl text-center" style={{ backgroundColor: 'var(--bg)' }}>
                        <span className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>متوسط الرضا العام</span>
                        <span className="text-2xl font-bold" style={{ color: 'var(--primary)' }}>
                          {surveyStats.overall_avg != null ? `${surveyStats.overall_avg} / 5` : '—'}
                        </span>
                      </div>
                    </div>

                    {/* النافذة والتذكيرات */}
                    <div className="p-4 rounded-xl space-y-2" style={{ backgroundColor: 'var(--bg)' }}>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="text-sm" style={{ color: 'var(--text)' }}>
                          <span className="font-bold">نافذة الاستبيان:</span>{' '}
                          {surveyStats.group.closes_at
                            ? `تُغلق في ${new Date(surveyStats.group.closes_at).toLocaleString('ar-EG')}`
                            : 'غير محددة'}
                        </div>
                        <div className="flex gap-2">
                          <button onClick={remindSurveyPending} disabled={surveyReminding || surveyStats.pending === 0}
                            className="px-4 py-2 rounded-xl text-sm font-medium text-white disabled:opacity-50"
                            style={{ backgroundColor: '#f59e0b' }}>
                            {surveyReminding ? 'جاري الإرسال...' : '🔔 تذكير الباقين'}
                          </button>
                          <button onClick={openSurveyExtend}
                            className="px-4 py-2 rounded-xl text-sm font-medium text-white"
                            style={{ backgroundColor: 'var(--primary)' }}>
                            📅 تمديد المدة
                          </button>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                        <span>التذكير الأول: {surveyStats.group.reminder1_at ? new Date(surveyStats.group.reminder1_at).toLocaleDateString('ar-EG') : 'لم يُرسل'}</span>
                        <span>التذكير الثاني: {surveyStats.group.reminder2_at ? new Date(surveyStats.group.reminder2_at).toLocaleDateString('ar-EG') : 'لم يُرسل'}</span>
                        <span>المجموعة: {surveyStats.group.course_mode === 'offline' ? 'أوفلاين — يشمل بند المكان' : 'أونلاين — بلا بند مكان'}</span>
                      </div>
                    </div>

                    {/* البنود حسب المجال */}
                    {surveyStats.sections.map((section: any) => {
                      const items = surveyStats.items.filter((i: any) => i.section === section.key);
                      if (items.length === 0) return null;
                      return (
                        <div key={section.key} className="rounded-xl overflow-hidden border" style={{ borderColor: 'var(--border)' }}>
                          <div className="px-4 py-2.5 flex items-center justify-between" style={{ backgroundColor: 'var(--bg)' }}>
                            <span className="text-sm font-bold" style={{ color: 'var(--text)' }}>{section.title}</span>
                            <span className="text-xs font-bold" style={{ color: 'var(--primary)' }}>
                              {section.avg != null ? `${section.avg} / 5` : 'لا توجد إجابات'}
                            </span>
                          </div>
                          <table className="w-full text-sm">
                            <tbody>
                              {items.map((item: any) => (
                                <tr key={item.key} className="border-t" style={{ borderColor: 'var(--border)' }}>
                                  <td className="px-4 py-2.5" style={{ color: 'var(--text)' }}>{item.label}</td>
                                  <td className="px-4 py-2.5 text-left whitespace-nowrap font-medium" style={{ color: item.avg != null ? 'var(--primary)' : 'var(--text-muted)' }}>
                                    {item.avg != null ? `${item.avg} / 5` : '—'}
                                  </td>
                                  <td className="px-4 py-2.5 text-left whitespace-nowrap text-xs" style={{ color: 'var(--text-muted)' }}>
                                    {item.count} إجابة
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      );
                    })}

                    {/* هل ساعدك */}
                    <div className="p-4 rounded-xl" style={{ backgroundColor: 'var(--bg)' }}>
                      <p className="text-sm font-bold mb-2" style={{ color: 'var(--text)' }}>هل البرنامج ساعدك على تطوير مهاراتك؟</p>
                      {surveyStats.helped.yes_percent == null ? (
                        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>لا توجد إجابات بعد</p>
                      ) : (
                        <div className="space-y-1.5">
                          <div className="flex justify-between text-xs" style={{ color: 'var(--text)' }}>
                            <span>نعم — {surveyStats.helped.yes}</span>
                            <span>لا — {surveyStats.helped.no}</span>
                          </div>
                          <div className="w-full h-2.5 rounded-full overflow-hidden flex" style={{ backgroundColor: '#fca5a5' }}>
                            <div className="h-full" style={{ width: `${surveyStats.helped.yes_percent}%`, backgroundColor: '#059669' }} />
                          </div>
                          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{surveyStats.helped.yes_percent}% أجابوا بنعم</p>
                        </div>
                      )}
                    </div>

                    {/* الردود */}
                    <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--border)' }}>
                      <div className="px-4 py-2.5 flex items-center justify-between" style={{ backgroundColor: 'var(--bg)' }}>
                        <span className="text-sm font-bold" style={{ color: 'var(--text)' }}>الردود والملاحظات</span>
                        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{surveyStats.responses.length} رد</span>
                      </div>
                      {surveyStats.responses.length === 0 ? (
                        <p className="px-4 py-6 text-center text-sm" style={{ color: 'var(--text-muted)' }}>لم يجب أي طالب بعد.</p>
                      ) : (
                        <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
                          {surveyStats.responses.map((response: any, idx: number) => (
                            <div key={idx} className="px-4 py-3">
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-sm font-medium flex items-center gap-1.5" style={{ color: 'var(--text)' }}>
                                  {response.is_anonymous ? (
                                    <><span className="material-symbols-outlined text-[16px]" style={{ color: 'var(--text-muted)' }}>visibility_off</span> بدون اسم</>
                                  ) : (
                                    <><span className="material-symbols-outlined text-[16px]" style={{ color: 'var(--primary)' }}>person</span> {response.student_name || '—'}</>
                                  )}
                                </span>
                                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                                  {response.submitted_at ? new Date(response.submitted_at).toLocaleDateString('ar-EG') : ''}
                                </span>
                              </div>
                              {response.answers?.notes ? (
                                <p className="text-xs mt-1.5 p-2 rounded-lg whitespace-pre-wrap" style={{ backgroundColor: 'var(--bg)', color: 'var(--text)' }}>
                                  {response.answers.notes}
                                </p>
                              ) : (
                                <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>بدون ملاحظات</p>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      🔒 نتائج الاستبيان متاحة للإدارة فقط — المحاضر لا يرى الأسماء ولا النتائج.
                    </p>
                  </>
                )}
              </div>
            )}

            {detailGroupTab === 'report' && (
              <div className="space-y-4">
                {!isGroupCompleted(detailGroup) && (
                  <div className="p-4 rounded-xl text-sm" style={{ backgroundColor: '#fef3c7', color: '#92400e' }}>
                    ⏳ التقرير متاح بعد إنهاء المجموعة. يمكنك تجهيز بياناته الآن وسيُفتح الاستخراج بعد الإنهاء.
                  </div>
                )}

                {reportLoading ? (
                  <div className="flex items-center justify-center py-10">
                    <div className="animate-spin h-8 w-8 border-4 rounded-full" style={{ borderColor: 'var(--primary)', borderTopColor: 'transparent' }} />
                  </div>
                ) : reportError ? (
                  <div className="flex flex-col items-center gap-3 py-8">
                    <p className="text-sm" style={{ color: '#dc2626' }}>{reportError}</p>
                    <button onClick={() => loadReport(detailGroup.id)} className="px-4 py-2 rounded-xl text-sm text-white" style={{ backgroundColor: 'var(--primary)' }}>
                      إعادة المحاولة
                    </button>
                  </div>
                ) : reportData && (
                  <>
                    {/* ملخص */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                      <div className="p-3 rounded-xl" style={{ backgroundColor: 'var(--bg)' }}>
                        <span className="block mb-1" style={{ color: 'var(--text-muted)' }}>الدورة</span>
                        <span style={{ color: 'var(--text)' }}>{reportData.course?.title_ar}</span>
                      </div>
                      <div className="p-3 rounded-xl" style={{ backgroundColor: 'var(--bg)' }}>
                        <span className="block mb-1" style={{ color: 'var(--text-muted)' }}>المحاضر</span>
                        <span style={{ color: 'var(--text)' }}>{reportData.group?.instructor_name || '—'}</span>
                      </div>
                      <div className="p-3 rounded-xl" style={{ backgroundColor: 'var(--bg)' }}>
                        <span className="block mb-1" style={{ color: 'var(--text-muted)' }}>المشاركون</span>
                        <span style={{ color: 'var(--text)' }}>{reportData.students?.length ?? 0} مشارك</span>
                      </div>
                      <div className="p-3 rounded-xl" style={{ backgroundColor: 'var(--bg)' }}>
                        <span className="block mb-1" style={{ color: 'var(--text-muted)' }}>الاستبيان</span>
                        <span style={{ color: 'var(--text)' }}>
                          {reportData.survey ? `${reportData.survey.answered} من ${reportData.survey.total_students}` : 'لا توجد إجابات'}
                        </span>
                      </div>
                    </div>

                    {/* بيانات التقرير */}
                    <div className="p-4 rounded-xl space-y-3" style={{ backgroundColor: 'var(--bg)' }}>
                      <h4 className="font-bold text-sm" style={{ color: 'var(--text)' }}>📝 بيانات التقرير</h4>
                      <div>
                        <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>نوع النشاط</label>
                        <input
                          value={reportForm.activity_type}
                          onChange={e => setReportForm({ ...reportForm, activity_type: e.target.value })}
                          maxLength={300}
                          className="w-full px-4 py-2.5 rounded-xl border text-sm"
                          style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)', color: 'var(--text)' }}
                        />
                      </div>
                      <div>
                        <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>ملاحظات عامة (القسم الثامن)</label>
                        <textarea
                          value={reportForm.report_notes}
                          onChange={e => setReportForm({ ...reportForm, report_notes: e.target.value })}
                          rows={3}
                          maxLength={4000}
                          className="w-full px-4 py-2.5 rounded-xl border text-sm resize-y"
                          style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)', color: 'var(--text)' }}
                        />
                      </div>
                      <div>
                        <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>التوصيات (القسم التاسع)</label>
                        <textarea
                          value={reportForm.report_recommendations}
                          onChange={e => setReportForm({ ...reportForm, report_recommendations: e.target.value })}
                          rows={3}
                          maxLength={4000}
                          className="w-full px-4 py-2.5 rounded-xl border text-sm resize-y"
                          style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)', color: 'var(--text)' }}
                        />
                      </div>
                      <button onClick={saveReportData} disabled={reportSaving}
                        className="px-5 py-2.5 rounded-xl text-sm font-medium text-white disabled:opacity-50"
                        style={{ backgroundColor: 'var(--primary)' }}>
                        {reportSaving ? 'جاري الحفظ...' : '💾 حفظ بيانات التقرير'}
                      </button>
                    </div>

                    {/* الاستخراج */}
                    <div className="p-4 rounded-xl flex flex-col sm:flex-row sm:items-center gap-3" style={{ backgroundColor: 'var(--bg)' }}>
                      <div className="flex-1">
                        <h4 className="font-bold text-sm" style={{ color: 'var(--text)' }}>📄 تقرير المجموعة (Word)</h4>
                        <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                          يُولَّد من أحدث البيانات وقت الضغط، مع إمكانية إرفاق حتى 8 صور وثائقية لا تُخزَّن في النظام.
                        </p>
                      </div>
                      <button
                        onClick={() => { setReportImages([]); setReportImagesOpen(true); }}
                        disabled={!isGroupCompleted(detailGroup)}
                        title={!isGroupCompleted(detailGroup) ? 'التقرير متاح بعد إنهاء المجموعة' : ''}
                        className="px-5 py-2.5 rounded-xl text-sm font-medium text-white disabled:opacity-50"
                        style={{ backgroundColor: '#059669' }}>
                        {isGroupCompleted(detailGroup) ? '📥 استخراج التقرير' : 'التقرير بعد الإنهاء'}
                      </button>
                    </div>

                    {/* التصدير */}
                    <div className="p-4 rounded-xl space-y-2" style={{ backgroundColor: 'var(--bg)' }}>
                      <h4 className="font-bold text-sm" style={{ color: 'var(--text)' }}>📊 تصدير Excel</h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {[
                          { key: 'attendance', label: 'كشف الحضور' },
                          { key: 'group_roster', label: 'المجموعة وطلابها' },
                          { key: 'survey_results', label: 'نتائج الاستبيان' },
                          { key: 'instructor_eval', label: 'تقييم المحاضر للطلاب' },
                        ].map(item => (
                          <button
                            key={item.key}
                            onClick={() => exportGroupDataset(item.key, item.label)}
                            disabled={exportingKey !== ''}
                            className="px-4 py-2.5 rounded-xl text-sm font-medium border disabled:opacity-50 text-right"
                            style={{ borderColor: 'var(--border)', color: 'var(--text)', backgroundColor: 'var(--card)' }}>
                            {exportingKey === item.key ? '⏳ جاري التصدير…' : `📊 ${item.label}`}
                          </button>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

            {detailGroupTab === 'lectures' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-sm" style={{ color: 'var(--text)' }}>جدول المحاضرات</h4>
                  <div className="flex items-center gap-2">
                    <ExportButton
                      dataset="lectures"
                      title="تصدير محاضرات الكورس"
                      query={{ courseId: course.id, groupId: detailGroup?.id }}
                      variant="icon"
                      label="تصدير المحاضرات"
                    />
                    <button onClick={() => { setAddLectureModal(true); setLectureForm({ date: '', time_from: '', time_to: '', topic: '', location: '' }); }}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium text-white" style={{ backgroundColor: 'var(--primary)' }}>+ إضافة محاضرة</button>
                  </div>
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
                            <span style={{ color: 'var(--text)' }}>{lec.day_of_week_name || daysOfWeek[Number(lec.day_of_week)] || ''}</span>
                          </div>
                          {lec.location && <span className="text-xs" style={{ color: 'var(--text-muted)' }}>📍 {lec.location}</span>}
                          {lec.topic && <span className="text-xs font-medium" style={{ color: 'var(--text)' }}>{lec.topic}</span>}
                          {lec.date && <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{lec.date}</span>}
                        </div>
                        <div className="flex gap-1 items-center">
                          <button onClick={() => toggleLecture(lec)}
                            className="px-2 py-1 rounded text-xs font-medium"
                            style={{ backgroundColor: Number(lec.is_completed) ? '#fef2f2' : '#f0fdf4', color: Number(lec.is_completed) ? '#dc2626' : '#16a34a' }}>
                            {Number(lec.is_completed) ? 'إلغاء' : 'إتمام'}
                          </button>
                          <button onClick={(e) => { e.stopPropagation(); openAttendanceModal(lec); }}
                            className="px-2 py-1 rounded text-xs font-medium"
                            style={{ backgroundColor: '#fefce8', color: '#a16207' }}>
                            🎯 حضور
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
                  <button onClick={openAddStudent} disabled={detailGroup?.has_started}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium text-white disabled:opacity-40"
                    style={{ backgroundColor: detailGroup?.has_started ? '#9ca3af' : 'var(--primary)' }}
                    title={detailGroup?.has_started ? 'المجموعة بدأت ولا يمكن إضافة طلاب جدد' : ''}>
                    {detailGroup?.has_started ? '🚀 بدأت' : '+ إضافة طالب'}
                  </button>
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
                    {otherGroups.filter((g: any) => !g.has_started).map((g: any) => (
                      <option key={g.id} value={g.id}>{g.name} ({g.student_count || 0}/{g.max_students || '∞'})</option>
                    ))}
                    {otherGroups.filter((g: any) => g.has_started).length > 0 && (
                      <optgroup label="🚀 غير متاح (بدأت)">
                        {otherGroups.filter((g: any) => g.has_started).map((g: any) => (
                          <option key={g.id} value={g.id} disabled>{g.name} — بدأت</option>
                        ))}
                      </optgroup>
                    )}
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

      {/* ===================== SURVEY WINDOW MODAL ===================== */}
      <Modal open={surveyExtendOpen} onClose={() => setSurveyExtendOpen(false)} title="تمديد مدة الاستبيان">
        <div className="space-y-3">
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            اختر التاريخ الذي يُغلق فيه الاستبيان. الطلاب الذين لم يجيبوا يستطيعون الإجابة حتى نهاية ذلك اليوم.
          </p>
          <div>
            <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>تاريخ الإغلاق</label>
            <input type="date" value={surveyExtendDate}
              onChange={e => setSurveyExtendDate(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border text-sm" style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }} />
          </div>
          <button onClick={saveSurveyExtend} disabled={surveyExtendSaving || !surveyExtendDate}
            className="w-full py-3 rounded-xl font-medium text-white disabled:opacity-50"
            style={{ backgroundColor: 'var(--primary)' }}>
            {surveyExtendSaving ? 'جاري الحفظ...' : 'حفظ التاريخ'}
          </button>
        </div>
      </Modal>

      {/* ===================== LECTURE MODALS ===================== */}
      <Modal open={addLectureModal} onClose={() => setAddLectureModal(false)} title="إضافة محاضرة">
        <div className="space-y-3">
          <div>
            <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>تاريخ بداية المحاضرة *</label>
            <input type="date" value={lectureForm.date}
              onChange={e => setLectureForm({ ...lectureForm, date: e.target.value })}
              className="w-full px-4 py-2.5 rounded-xl border text-sm" style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }} />
            {lectureForm.date && (
              <p className="text-xs mt-1" style={{ color: 'var(--primary)' }}>
                📅 {(() => { const d = new Date(lectureForm.date + 'T12:00:00'); return daysOfWeek[d.getDay()]; })()}
              </p>
            )}
          </div>
          <div>
            <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>وقت البداية</label>
            <input type="time" value={lectureForm.time_from}
              onChange={e => setLectureForm({ ...lectureForm, time_from: e.target.value })}
              className="w-full px-4 py-2.5 rounded-xl border text-sm" style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }} />
          </div>
          <input placeholder="الموضوع (اختياري)" value={lectureForm.topic}
            onChange={e => setLectureForm({ ...lectureForm, topic: e.target.value })}
            className="w-full px-4 py-2.5 rounded-xl border text-sm" style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }} />
          <input placeholder="المكان (اختياري)" value={lectureForm.location}
            onChange={e => setLectureForm({ ...lectureForm, location: e.target.value })}
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
          <div>
            <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>تاريخ بداية المحاضرة *</label>
            <input type="date" value={editLectureForm.date}
              onChange={e => setEditLectureForm({ ...editLectureForm, date: e.target.value })}
              className="w-full px-4 py-2.5 rounded-xl border text-sm" style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }} />
            {editLectureForm.date && (
              <p className="text-xs mt-1" style={{ color: 'var(--primary)' }}>
                📅 {(() => { const d = new Date(editLectureForm.date + 'T12:00:00'); return daysOfWeek[d.getDay()]; })()}
              </p>
            )}
          </div>
          <div>
            <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>وقت البداية</label>
            <input type="time" value={editLectureForm.time_from || ''}
              onChange={e => setEditLectureForm({ ...editLectureForm, time_from: e.target.value })}
              className="w-full px-4 py-2.5 rounded-xl border text-sm" style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }} />
          </div>
          <input placeholder="الموضوع (اختياري)" value={editLectureForm.topic}
            onChange={e => setEditLectureForm({ ...editLectureForm, topic: e.target.value })}
            className="w-full px-4 py-2.5 rounded-xl border text-sm" style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }} />
          <input placeholder="المكان (اختياري)" value={editLectureForm.location || ''}
            onChange={e => setEditLectureForm({ ...editLectureForm, location: e.target.value })}
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

      {/* ===================== ANNOUNCEMENT MODAL (edit-plan.md §7) ===================== */}
      <Modal open={announceOpen} onClose={() => setAnnounceOpen(false)} title="إرسال إعلان الكورس" size="lg">
        {announceLoading ? (
          <p className="text-sm text-center py-6" style={{ color: 'var(--text-muted)' }}>جارٍ تحضير الإعلان…</p>
        ) : (
          <div className="space-y-3">
            {announceMeta?.sent_at && (
              <div className="rounded-xl p-3 text-sm" style={{ backgroundColor: '#fef3c7', color: '#92400e' }}>
                ⚠️ أُرسل الإعلان بتاريخ {new Date(announceMeta.sent_at).toLocaleDateString('ar-EG')}.
                <label className="flex items-center gap-2 mt-2 text-xs font-medium">
                  <input
                    type="checkbox"
                    checked={announceForce}
                    onChange={e => setAnnounceForce(e.target.checked)}
                  />
                  أريد إرساله مرة أخرى لكل الحسابات
                </label>
              </div>
            )}

            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              سيصل الإعلان إلى {announceMeta?.recipients ?? 0} حساب: إشعار داخل المنصة + بريد إلكتروني،
              وتليجرام لمن ربطه. راجع النص قبل الإرسال.
            </p>

            <div>
              <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>عنوان الإعلان</label>
              <input
                value={announceForm.title}
                onChange={e => setAnnounceForm({ ...announceForm, title: e.target.value })}
                maxLength={200}
                className="w-full px-4 py-2.5 rounded-xl border text-sm"
                style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }}
              />
            </div>

            <div>
              <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>نص الإعلان</label>
              <textarea
                value={announceForm.body}
                onChange={e => setAnnounceForm({ ...announceForm, body: e.target.value })}
                rows={9}
                maxLength={8000}
                className="w-full px-4 py-2.5 rounded-xl border text-sm resize-y"
                style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }}
              />
            </div>

            <button
              onClick={() => void sendAnnouncement()}
              disabled={announceSending || (Boolean(announceMeta?.sent_at) && !announceForce)}
              className="w-full py-3 rounded-xl text-white font-medium disabled:opacity-50"
              style={{ backgroundColor: 'var(--primary)' }}
            >
              {announceSending ? 'جارٍ الإرسال…' : 'إرسال الإعلان'}
            </button>
          </div>
        )}
      </Modal>

      {/* ===================== REPORT IMAGES MODAL (edit-plan.md §8) ===================== */}
      <Modal open={reportImagesOpen} onClose={() => setReportImagesOpen(false)} title="صور التقرير الوثائقية" size="lg">
        <div className="space-y-3">
          <p className="text-xs p-3 rounded-xl" style={{ backgroundColor: 'var(--bg)', color: 'var(--text-muted)' }}>
            اختيارية — حتى 8 صور بصيغة JPG أو PNG. تُستخدم لإدراجها في القسم العاشر من التقرير فقط،
            ولا تُحفظ في النظام أو قاعدة البيانات. إعادة الاستخراج تتطلب اختيارها من جديد.
          </p>

          <label className="block border-2 border-dashed rounded-xl p-6 text-center cursor-pointer"
            style={{ borderColor: 'var(--border)' }}>
            <span className="block text-sm font-medium" style={{ color: 'var(--primary)' }}>📷 اختر الصور</span>
            <span className="block text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
              {reportImages.length > 0 ? `${reportImages.length} من 8 صور محددة` : 'لم تُحدد صور — التقرير سيُولد بدونها'}
            </span>
            <input
              type="file"
              accept="image/png,image/jpeg"
              multiple
              className="hidden"
              onChange={e => { pickReportImages(e.target.files); e.target.value = ''; }}
            />
          </label>

          {reportImages.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {reportImages.map((file, index) => (
                <div key={`${file.name}-${index}`} className="relative rounded-xl overflow-hidden border" style={{ borderColor: 'var(--border)' }}>
                  <img src={URL.createObjectURL(file)} alt={file.name} className="w-full h-24 object-cover" />
                  <button
                    onClick={() => setReportImages(prev => prev.filter((_, i) => i !== index))}
                    className="absolute top-1 left-1 h-6 w-6 rounded-full text-white text-xs"
                    style={{ backgroundColor: '#dc2626' }}>
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}

          <button onClick={extractReport} disabled={reportExtracting}
            className="w-full py-3 rounded-xl text-white font-medium disabled:opacity-50"
            style={{ backgroundColor: '#059669' }}>
            {reportExtracting ? 'جارٍ توليد التقرير…' : '📄 استخراج التقرير'}
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

      <ConfirmDialog open={!!confirmDeleteGroup}
        title="حذف المجموعة"
        message={`حذف "${confirmDeleteGroup?.name}" نهائياً؟ سيتم إزالة جميع الطلاب والمحاضرات منها.`}
        confirmLabel="حذف" variant="danger"
        onConfirm={deleteGroup} onCancel={() => setConfirmDeleteGroup(null)} />

      <ConfirmDialog open={!!confirmCompleteGroup}
        title="إنهاء المجموعة"
        message={
          <span>
            إنهاء مجموعة <strong>{confirmCompleteGroup?.name}</strong>؟
            <br />
            سيتم إشعار الطلاب، وإصدار الشهادات للمستحقين، ومنع التسكين وإضافة المحاضرات.
            <br />
            يمكنك التراجع لاحقاً بزر «إعادة فتح المجموعة».
          </span>
        }
        confirmLabel="إنهاء المجموعة" variant="warning"
        loading={groupActionLoading}
        onConfirm={completeGroup} onCancel={() => setConfirmCompleteGroup(null)} />

      <ConfirmDialog open={!!confirmReopenGroup}
        title="إعادة فتح المجموعة"
        message={
          <span>
            إعادة فتح مجموعة <strong>{confirmReopenGroup?.name}</strong>؟
            <br />
            ستعود المجموعة قابلة للتسكين وإضافة المحاضرات. الشهادات الصادرة تبقى كما هي.
          </span>
        }
        confirmLabel="إعادة الفتح" variant="info"
        loading={groupActionLoading}
        onConfirm={reopenGroup} onCancel={() => setConfirmReopenGroup(null)} />

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

      <ConfirmDialog open={confirmBatchDelete}
        title={`حذف ${selectedGroupIds.size} مجموعة`}
        message={`حذف ${selectedGroupIds.size} مجموعة نهائياً؟ سيتم إزالة جميع الطلاب والمحاضرات منها.`}
        confirmLabel="حذف الكل" variant="danger"
        loading={batchLoading}
        onConfirm={batchDelete} onCancel={() => setConfirmBatchDelete(false)} />

      <Modal open={batchStatusModal} onClose={() => setBatchStatusModal(false)} title={`تغيير حالة ${selectedGroupIds.size} مجموعة`}>
        <div className="space-y-3">
          <select value={batchStatusValue} onChange={e => setBatchStatusValue(e.target.value)}
            className="w-full px-4 py-2.5 rounded-xl border text-sm"
            style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }}>
            <option value="pending">قيد الانتظار</option>
            <option value="active">نشطة</option>
            <option value="cancelled">ملغية</option>
          </select>
          <button onClick={batchUpdateStatus} disabled={batchLoading}
            className="w-full py-3 rounded-xl text-white font-medium disabled:opacity-50"
            style={{ backgroundColor: 'var(--primary)' }}>
            {batchLoading ? 'جاري...' : 'تغيير الحالة'}
          </button>
        </div>
      </Modal>

      <Modal open={batchInstructorModal} onClose={() => setBatchInstructorModal(false)} title={`تغيير مدرب ${selectedGroupIds.size} مجموعة`}>
        <div className="space-y-3">
          <input placeholder="اسم المدرب الجديد" value={batchInstructorValue}
            onChange={e => setBatchInstructorValue(e.target.value)}
            className="w-full px-4 py-2.5 rounded-xl border text-sm"
            style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }} />
          <button onClick={batchUpdateInstructor} disabled={!batchInstructorValue.trim() || batchLoading}
            className="w-full py-3 rounded-xl text-white font-medium disabled:opacity-50"
            style={{ backgroundColor: 'var(--primary)' }}>
            {batchLoading ? 'جاري...' : 'تغيير المدرب'}
          </button>
        </div>
      </Modal>

      {/* ===================== ATTENDANCE QR MODAL ===================== */}
      <Modal open={!!attendanceModal} onClose={closeAttendanceModal} title={attendanceModal ? `🎯 حضور: ${attendanceModal.topic}` : 'تسجيل الحضور'} size="lg">
        {attendanceModal && (
          <div className="flex flex-col items-center gap-4 py-4">
            {attendanceActive ? (
              <>
                <div className="w-full flex items-center justify-between px-2 mb-2">
                  <span className="text-sm font-medium" style={{ color: '#16a34a' }}>🟢 تسجيل الحضور نشط</span>
                  <span className="text-sm font-bold" style={{ color: attendanceCountdown <= 3 ? '#dc2626' : 'var(--text)' }}>
                    {attendanceCountdown} ثانية
                  </span>
                </div>

                <div className="bg-white p-4 rounded-2xl shadow-sm">
                    {attendanceQR && (
                    <QRCodeSVG value={attendanceQR} size={240} level="M" />
                  )}
                </div>

                <div className="text-center">
                  <p className="text-3xl font-mono font-bold tracking-[0.5em] text-center px-6 py-3 rounded-xl select-all"
                    style={{ backgroundColor: 'var(--bg)', color: 'var(--text)', letterSpacing: '0.5em' }}>
                    {attendanceCode || '------'}
                  </p>
                  <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>
                    امسح QR بالكاميرا أو أدخل الكود يدوياً
                  </p>
                </div>

                {/* Attendance summary */}
                {attendanceSummary && (
                  <div className="w-full grid grid-cols-3 gap-3 mt-2">
                    <div className="text-center p-3 rounded-xl" style={{ backgroundColor: '#f0fdf4' }}>
                      <p className="text-lg font-bold" style={{ color: '#16a34a' }}>{attendanceSummary.present}</p>
                      <p className="text-xs" style={{ color: '#16a34a' }}>حاضر</p>
                    </div>
                    <div className="text-center p-3 rounded-xl" style={{ backgroundColor: '#fef2f2' }}>
                      <p className="text-lg font-bold" style={{ color: '#dc2626' }}>{attendanceSummary.total - attendanceSummary.present}</p>
                      <p className="text-xs" style={{ color: '#dc2626' }}>غائب</p>
                    </div>
                    <div className="text-center p-3 rounded-xl" style={{ backgroundColor: '#eff6ff' }}>
                      <p className="text-lg font-bold" style={{ color: '#2563eb' }}>{attendanceSummary.percentage}%</p>
                      <p className="text-xs" style={{ color: '#2563eb' }}>نسبة الحضور</p>
                    </div>
                  </div>
                )}

                {/* Student list */}
                <div className="w-full mt-2 flex items-center justify-between">
                  <p className="text-xs font-bold" style={{ color: 'var(--text-muted)' }}>قائمة الحضور:</p>
                  <ExportButton
                    dataset="attendance"
                    title={`تصدير حضور: ${attendanceModal.topic}`}
                    query={{ lectureId: attendanceModal.lectureId }}
                    variant="soft"
                    label="تصدير الحضور"
                  />
                </div>
                {attendanceStudents.length > 0 && (
                  <div className="w-full mt-2">
                    <div className="max-h-48 overflow-y-auto space-y-1">
                      {attendanceStudents.map((s: any) => (
                        <div key={s.userId} className="flex items-center justify-between px-3 py-2 rounded-xl text-xs"
                          style={{ backgroundColor: 'var(--bg)' }}>
                          <span style={{ color: 'var(--text)' }}>{s.name}</span>
                          <span style={{ color: Number(s.attended) ? '#16a34a' : '#dc2626' }} className="flex items-center gap-1">
                            {Number(s.attended) ? (
                              <>
                                ✅ {s.method === 'manual' ? 'يدوي' : 'QR'}
                                {s.attendedAt && <span className="text-[10px] opacity-70">{formatTime(s.attendedAt)}</span>}
                              </>
                            ) : '⬜'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex gap-2 w-full mt-3">
                  <button onClick={() => fetchCurrentCode(attendanceModal.lectureId)} disabled={attendanceLoading}
                    className="flex-1 py-2.5 rounded-xl text-sm font-medium border"
                    style={{ borderColor: 'var(--border)', color: 'var(--text)' }}>
                    🔄 تحديث
                  </button>
                  <button onClick={() => stopAttendance(attendanceModal.lectureId)}
                    className="flex-1 py-2.5 rounded-xl text-sm font-medium text-white"
                    style={{ backgroundColor: '#dc2626' }}>
                    ⏹ إيقاف التسجيل
                  </button>
                </div>
              </>
            ) : (
              <div className="text-center py-8">
                {attendanceLoading ? (
                  <>
                    <div className="animate-spin h-8 w-8 border-2 rounded-full mx-auto mb-3" style={{ borderColor: 'var(--primary)', borderTopColor: 'transparent' }} />
                    <p style={{ color: 'var(--text-muted)' }}>جاري بدء تسجيل الحضور...</p>
                  </>
                ) : (
                  <>
                    <p className="text-4xl mb-3">🎯</p>
                    <p className="font-bold mb-1" style={{ color: 'var(--text)' }}>انتهت جلسة تسجيل الحضور</p>
                    <button onClick={() => startAttendance(attendanceModal!.lectureId)}
                      className="mt-3 px-6 py-2.5 rounded-xl text-sm font-medium text-white"
                      style={{ backgroundColor: 'var(--primary)' }}>
                      🔄 إعادة البدء
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
