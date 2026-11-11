'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '../../../lib/api';
import { useAuth } from '../../../lib/auth';
import { useBranding } from '../../../components/BrandingProvider';
import { Skeleton } from '../../../components/Skeleton';
import M3BottomSheet from '../../../components/M3BottomSheet';
import { loginUrl } from '../../../lib/redirect';

interface MyGroup {
  id: number;
  course_id: number;
  name: string;
  title_ar: string;
  title_en: string;
  image_url?: string;
  status: string;
  is_complete: number;
  instructor_name?: string;
  location?: string;
  zoom_link?: string;
  start_date?: string;
  end_date?: string;
  next_lecture?: any;
  lecture_progress?: { total: number; done: number };
  schedule_display?: string;
  student_count?: number;
  has_started?: boolean;
}

interface Lecture {
  id: number;
  date: string;
  day_of_week_name: string;
  time_from: string;
  time_to: string;
  topic?: string;
  location?: string;
  zoom_link?: string;
  is_completed: number;
  sort_order: number;
  attended?: number;
  attended_at_time?: string;
  attendance_active?: number;
}

const statusColorMap: Record<string, { bg: string; fg: string }> = {
  pending: { bg: '#fef3c7', fg: '#92400e' },
  active: { bg: '#d1fae5', fg: '#065f46' },
  completed: { bg: '#dbeafe', fg: '#1e40af' },
  cancelled: { bg: '#fee2e2', fg: '#991b1b' },
};

const statusLabels: Record<string, string> = {
  pending: 'قيد الانتظار',
  active: 'نشط',
  completed: 'مكتمل',
  cancelled: 'ملغي',
};

const progressColors = [
  { threshold: 80, color: '#dc2626', label: 'أوشكت على الانتهاء!' },
  { threshold: 50, color: '#d97706', label: 'استمر!' },
  { threshold: 0, color: '#16a34a', label: 'بداية قوية!' },
];

function getProgressColor(pct: number): string {
  if (pct >= 80) return '#dc2626';
  if (pct >= 50) return '#d97706';
  return '#16a34a';
}

function formatTime(dt: string): string {
  if (!dt) return '';
  try {
    const d = new Date(dt);
    const hours = d.getHours();
    const mins = String(d.getMinutes()).padStart(2, '0');
    const ampm = hours >= 12 ? 'م' : 'ص';
    const h12 = hours % 12 || 12;
    return `${h12}:${mins} ${ampm}`;
  } catch { return dt; }
}

function getProgressLabel(pct: number, isComplete: boolean): string {
  if (isComplete) return 'مبروك! اكتمل الكورس';
  if (pct === 0) return 'لم تبدأ بعد';
  if (pct >= 100) return 'اكتملت كل المحاضرات';
  if (pct >= 80) return 'أوشكت على الانتهاء!';
  if (pct >= 50) return 'استمر! أنت في منتصف الطريق!';
  return 'بداية قوية! واصل التقدم!';
}

function getProgressIcon(pct: number, isComplete: boolean): string {
  if (isComplete) return 'emoji_events';
  if (pct >= 100) return 'emoji_events';
  if (pct >= 80) return 'local_fire_department';
  if (pct >= 50) return 'fitness_center';
  return 'rocket_launch';
}

export default function MyCoursesPage() {
  const { user, loading: authLoading } = useAuth();
  const { primaryColor, secondaryColor } = useBranding();
  const router = useRouter();
  const [groups, setGroups] = useState<MyGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'active' | 'completed'>('all');
  const [expandedLectures, setExpandedLectures] = useState<Record<number, Lecture[]>>({});
  const [loadingLectures, setLoadingLectures] = useState<Record<number, boolean>>({});

  // Attendance
  const [attModal, setAttModal] = useState<{ lectureId: number; groupId: number } | null>(null);
  const [attCode, setAttCode] = useState('');
  const [attStatus, setAttStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [attMessage, setAttMessage] = useState('');
  const [attMethod, setAttMethod] = useState<'qr' | 'manual'>('qr');
  const qrVideoRef = useRef<HTMLDivElement>(null);
  const qrScannerRef = useRef<any>(null);

  // Polling + toast
  const [toastVisible, setToastVisible] = useState(false);
  const [toastData, setToastData] = useState<{ topic: string; groupName: string; lectureId: number; groupId: number } | null>(null);
  const toastTimerRef = useRef<any>(null);
  const prevPollRef = useRef<string>('');
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 1024);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    setError('');
    try {
      const grps = await api('/api/groups/my/all');
      setGroups(grps || []);
    } catch {
      setError('فشل تحميل البيانات');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading && !user) router.push(loginUrl());
    if (user) load();
  }, [user, authLoading, router]);

  // Poll for active attendance
  useEffect(() => {
    if (!user) return;
    const poll = async () => {
      try {
        const data = await api('/api/attendance/poll');
        const key = JSON.stringify(data.active);
        if (key === prevPollRef.current) return;
        prevPollRef.current = key;
        if (data.hasActive && data.active?.length > 0) {
          const first = data.active[0];
          setToastData({ topic: first.topic || 'بدون عنوان', groupName: first.groupName || '', lectureId: first.lectureId, groupId: first.groupId });
          setToastVisible(true);
          // Auto-expand the relevant group's lectures
          setExpandedLectures(prev => {
            if (prev[first.groupId]) return prev;
            // Trigger loading lectures for the group
            api(`/api/groups/my/${first.groupId}/lectures`).then(lecs => {
              setExpandedLectures(p => ({ ...p, [first.groupId]: lecs || [] }));
            }).catch(() => {});
            return prev;
          });
          // Browser notification
          if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted' && document.hidden) {
            new Notification('تم فتح باب الحضور!', {
              body: `${first.topic || 'محاضرة'} - ${first.groupName} — افتح الصفحة للتسجيل`,
              icon: '/branding/icon-192.png',
            });
          }
        }
      } catch { /* ignore polling errors */ }
    };
    const interval = setInterval(poll, 10000);
    // Initial poll after a short delay
    const initial = setTimeout(poll, 2000);
    return () => { clearInterval(interval); clearTimeout(initial); };
  }, [user]);

  // Auto-hide toast after 5 seconds
  useEffect(() => {
    if (toastVisible) {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
      toastTimerRef.current = setTimeout(() => setToastVisible(false), 5000);
    }
    return () => { if (toastTimerRef.current) clearTimeout(toastTimerRef.current); };
  }, [toastVisible]);

  // Request notification permission on first user interaction (not auto on mount)
  useEffect(() => {
    if (typeof window === 'undefined' || !('Notification' in window) || Notification.permission !== 'default') return;
    const requestPerm = () => {
      Notification.requestPermission();
      document.removeEventListener('click', requestPerm);
    };
    document.addEventListener('click', requestPerm, { once: true });
    return () => document.removeEventListener('click', requestPerm);
  }, []);

  const filtered = groups.filter(g => {
    if (activeFilter === 'active') return g.status === 'active' || g.status === 'pending';
    if (activeFilter === 'completed') return g.status === 'completed' || Number(g.is_complete) === 1;
    return true;
  });

  // ── Attendance ──

  const openAttendance = (lectureId: number, groupId: number) => {
    setAttModal({ lectureId, groupId });
    setAttCode('');
    setAttStatus('idle');
    setAttMessage('');
    setAttMethod('qr');
  };

  const initScanner = async (lectureId: number) => {
    if (typeof window === 'undefined') return;
    try {
      const { Html5Qrcode } = await import('html5-qrcode');
      if (qrVideoRef.current) {
        qrVideoRef.current.innerHTML = '';
        const scanner = new Html5Qrcode('qr-reader');
        qrScannerRef.current = scanner;
        await scanner.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 250, height: 250 } },
          async (decodedText: string) => {
            scanner.stop().catch(() => {});
            await handleScan(decodedText, lectureId);
          },
          () => {},
        );
      }
    } catch {
      setAttMethod('manual');
    }
  };

  const stopScanner = async () => {
    try {
      if (qrScannerRef.current) {
        await qrScannerRef.current.stop();
        qrScannerRef.current = null;
      }
    } catch { /* ignore */ }
    if (qrVideoRef.current) qrVideoRef.current.innerHTML = '';
  };

  const handleScan = async (data: string, lectureId: number) => {
    let code = '';
    try {
      const parsed = JSON.parse(data);
      if (parsed.v === 1 && parsed.l === lectureId && parsed.c) {
        code = parsed.c;
      } else {
        code = data.trim().toUpperCase();
      }
    } catch {
      code = data.trim().toUpperCase();
    }
    if (!code) return;
    await markAttendance(lectureId, code, 'qr');
  };

  const markAttendance = async (lectureId: number, code: string, method: 'qr' | 'manual') => {
    setAttStatus('loading');
    setAttMessage('');
    try {
      const res = await api('/api/attendance/mark', {
        method: 'POST',
        body: JSON.stringify({ lectureId, code, method }),
      });
      if (res.success) {
        setAttStatus('success');
        setAttMessage(res.alreadyMarked ? 'تم تسجيل الحضور مسبقاً' : 'تم تسجيل الحضور بنجاح');
        // Refresh lectures to update status
        if (attModal) {
          const lecs = await api(`/api/groups/my/${attModal.groupId}/lectures`);
          setExpandedLectures(prev => ({ ...prev, [attModal.groupId]: lecs || [] }));
        }
      } else {
        setAttStatus('error');
        setAttMessage(res.error || 'فشل تسجيل الحضور');
      }
    } catch (err: any) {
      setAttStatus('error');
      setAttMessage(err?.message || 'حدث خطأ');
    }
  };

  const submitManualCode = () => {
    if (!attCode.trim() || attCode.trim().length !== 6) {
      setAttStatus('error');
      setAttMessage('الكود يجب أن يكون 6 أحرف/أرقام');
      return;
    }
    if (attModal) markAttendance(attModal.lectureId, attCode.trim().toUpperCase(), 'manual');
  };

  const closeAttendance = () => {
    stopScanner();
    setAttModal(null);
  };

  // Switch method: stop scanner when going manual, re-init when going QR
  // Unified scanner lifecycle: start on modal+qr, stop otherwise
  useEffect(() => {
    if (!attModal || attMethod === 'manual') { stopScanner(); return; }
    const timer = setTimeout(() => initScanner(attModal.lectureId), 400);
    return () => { clearTimeout(timer); stopScanner(); };
  }, [attModal, attMethod]);

  const toggleLectures = async (groupId: number) => {
    if (expandedLectures[groupId]) {
      setExpandedLectures(prev => { const n = { ...prev }; delete n[groupId]; return n; });
      return;
    }
    setLoadingLectures(prev => ({ ...prev, [groupId]: true }));
    try {
      const lecs = await api(`/api/groups/my/${groupId}/lectures`);
      setExpandedLectures(prev => ({ ...prev, [groupId]: lecs || [] }));
    } catch {
      setExpandedLectures(prev => ({ ...prev, [groupId]: [] }));
    } finally {
      setLoadingLectures(prev => ({ ...prev, [groupId]: false }));
    }
  };

  if (authLoading || loading) {
    return (
      <div className="max-w-5xl mx-auto p-4 space-y-4">
        <Skeleton className="h-8 w-1/3" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2].map(i => <Skeleton key={i} className="h-64 w-full rounded-md3-md" />)}
        </div>
        <div className="flex justify-center py-4">
          <div className="w-48 h-1 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--md-sys-color-surface-container-high)' }}><div className="h-full rounded-full animate-pulse" style={{ width: '40%', backgroundColor: 'var(--md-sys-color-primary)' }} /></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <span className="material-symbols-outlined text-[48px]" style={{ color: 'var(--md-sys-color-error)' }}>error</span>
        <p style={{ color: 'var(--md-sys-color-on-surface)' }}>{error}</p>
        <button
          onClick={load}
          className="h-10 px-6 rounded-full text-sm font-medium"
          style={{ backgroundColor: 'var(--md-sys-color-primary)', color: 'var(--md-sys-color-on-primary)' }}
        >
          إعادة المحاولة
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2" style={{ color: 'var(--md-sys-color-on-surface)' }}>
            <span className="material-symbols-outlined text-[28px]" style={{ color: 'var(--md-sys-color-primary)' }}>school</span>
            كورساتي
          </h2>
          <p className="text-sm" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>
            {groups.length > 0 ? `أنت مسجل في ${groups.length} كورس` : 'لم تسجل في أي كورس بعد'}
          </p>
        </div>
      </div>

      {/* Filter Tabs */}
      {groups.length > 0 && (
        <div className="flex gap-2 mb-6">
          {([
            { key: 'all', label: 'الكل', icon: 'apps' },
            { key: 'active', label: 'النشطة', icon: 'fiber_manual_record' },
            { key: 'completed', label: 'المكتملة', icon: 'check_circle' },
          ] as const).map(f => (
            <button
              key={f.key}
              onClick={() => setActiveFilter(f.key)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-medium transition-all"
              style={activeFilter === f.key
                ? { backgroundColor: 'var(--md-sys-color-primary)', color: 'var(--md-sys-color-on-primary)' }
                : { backgroundColor: 'var(--md-sys-color-surface-container)', color: 'var(--md-sys-color-on-surface-variant)' }
              }
            >
              <span className="material-symbols-outlined text-[16px]">{f.icon}</span>
              {f.label}
            </button>
          ))}
        </div>
      )}

      {/* Course Grid */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 rounded-md3-md" style={{ backgroundColor: 'var(--md-sys-color-surface-container-low)' }}>
          <span
            className="material-symbols-outlined text-[64px] block mb-4"
            style={{ color: 'var(--md-sys-color-outline)' }}
          >
            {activeFilter === 'all' ? 'gps_fixed' : activeFilter === 'active' ? 'fiber_manual_record' : 'check_circle'}
          </span>
          <h3 className="text-xl font-bold mb-2" style={{ color: 'var(--md-sys-color-on-surface)' }}>
            {activeFilter === 'all' ? 'لم تسجل في أي كورس بعد' :
             activeFilter === 'active' ? 'لا توجد كورسات نشطة حالياً' : 'لا توجد كورسات مكتملة'}
          </h3>
          <p className="mb-6" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>
            {activeFilter === 'all' ? 'سجل في كورس وابدأ التعلم اليوم' : 'غير فلتر العرض'}
          </p>
          {activeFilter === 'all' && (
            <Link
              href="/courses"
              className="inline-flex items-center gap-2 h-10 px-6 rounded-full text-sm font-medium"
              style={{ backgroundColor: 'var(--md-sys-color-primary)', color: 'var(--md-sys-color-on-primary)' }}
            >
              <span className="material-symbols-outlined text-[18px]">search</span>
              تصفح الكورسات
            </Link>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map(group => {
            const total = group.lecture_progress?.total || 0;
            const done = group.lecture_progress?.done || 0;
            const pct = total > 0 ? Math.round((done / total) * 100) : 0;
            const barColor = getProgressColor(pct);
            const nl = group.next_lecture;

            return (
              <div
                key={group.id}
                className="rounded-md3-md overflow-hidden transition-all"
                style={{
                  backgroundColor: 'var(--md-sys-color-surface-container)',
                  border: '1px solid var(--md-sys-color-outline-variant)',
                }}
              >
                {/* Image / Placeholder */}
                {group.image_url ? (
                  <div className="h-32 overflow-hidden">
                    <img src={group.image_url} alt={group.title_ar} className="w-full h-full object-cover" />
                  </div>
                ) : (
                  <div
                    className="h-32 flex items-center justify-center text-white text-2xl font-bold"
                    style={{ backgroundColor: 'var(--md-sys-color-primary)' }}
                  >
                    <span className="material-symbols-outlined text-[40px]">school</span>
                  </div>
                )}

                <div className="p-4">
                  {/* Header: Title + Status */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="min-w-0 flex-1">
                      <h3 className="font-bold text-base truncate" style={{ color: 'var(--md-sys-color-on-surface)' }}>{group.title_ar}</h3>
                      <p className="text-xs font-medium" style={{ color: 'var(--md-sys-color-primary)' }}>{group.name}</p>
                    </div>
                    <span
                      className="text-[11px] px-2.5 py-0.5 rounded-full font-medium shrink-0"
                      style={{
                        backgroundColor: statusColorMap[group.status]?.bg || '#f3f4f6',
                        color: statusColorMap[group.status]?.fg || '#374151',
                      }}
                    >
                      {statusLabels[group.status] || group.status}
                    </span>
                  </div>

                  {/* Instructor + Location + Students */}
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs mb-3" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>
                    {group.instructor_name && (
                      <span className="flex items-center gap-1">
                        <span className="material-symbols-outlined text-[14px]">person</span>
                        {group.instructor_name}
                      </span>
                    )}
                    {group.location && (
                      <span className="flex items-center gap-1">
                        <span className="material-symbols-outlined text-[14px]">location_on</span>
                        {group.location}
                      </span>
                    )}
                    {group.student_count != null && (
                      <span className="flex items-center gap-1">
                        <span className="material-symbols-outlined text-[14px]">group</span>
                        {group.student_count} طالب
                      </span>
                    )}
                  </div>

                  {/* Progress Bar */}
                  {total > 0 && (
                    <div className="mb-3">
                      <div className="flex items-center justify-between text-xs mb-1.5">
                        <span className="flex items-center gap-1" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>
                          <span className="material-symbols-outlined text-[14px]">{getProgressIcon(pct, Number(group.is_complete) === 1)}</span>
                          التقدم
                        </span>
                        <span style={{ color: barColor, fontWeight: 700 }}>{done}/{total} ({pct}%)</span>
                      </div>
                      <div className="w-full h-2 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--md-sys-color-surface-container-highest)' }}>
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{ width: `${pct}%`, backgroundColor: barColor }}
                        />
                      </div>
                      <p className="text-[10px] mt-1 flex items-center gap-1" style={{ color: barColor }}>
                        <span className="material-symbols-outlined text-[12px]">{getProgressIcon(pct, Number(group.is_complete) === 1)}</span>
                        {getProgressLabel(pct, Number(group.is_complete) === 1)}
                      </p>
                    </div>
                  )}

                  {/* Next Lecture */}
                  {nl && (
                    <div className="rounded-md3-md p-3 mb-3" style={{ backgroundColor: 'var(--md-sys-color-surface-container-low)' }}>
                      <p className="text-[10px] font-bold mb-1 flex items-center gap-1" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>
                        <span className="material-symbols-outlined text-[12px]">schedule</span>
                        المحاضرة القادمة
                      </p>
                      <p className="text-sm font-medium" style={{ color: 'var(--md-sys-color-on-surface)' }}>
                        {nl.day_of_week_name || ['السبت', 'الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة'][Number(nl.day_of_week)]}
                        {nl.time_from ? ` ${nl.time_from} - ${nl.time_to}` : ''}
                      </p>
                      {nl.topic && <p className="text-xs mt-0.5" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>{nl.topic}</p>}
                      {nl.date && <p className="text-xs" style={{ color: 'var(--md-sys-color-outline)' }}>{nl.date}</p>}
                    </div>
                  )}

                  {/* Lectures Expandable */}
                  <button
                    onClick={() => toggleLectures(group.id)}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-full text-xs font-medium transition-all mb-2"
                    style={{ backgroundColor: 'var(--md-sys-color-surface-container-low)', color: 'var(--md-sys-color-on-surface)' }}
                  >
                    <span className="flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[14px]">calendar_today</span>
                      جميع المحاضرات ({total})
                    </span>
                    <span
                      className="material-symbols-outlined text-[18px]"
                      style={{
                        transform: expandedLectures[group.id] ? 'rotate(180deg)' : 'rotate(0deg)',
                        transition: 'transform 0.2s ease',
                      }}
                    >
                      expand_more
                    </span>
                  </button>

                  {loadingLectures[group.id] && (
                    <div className="flex justify-center py-3">
                      <div className="w-32 h-1 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--md-sys-color-surface-container-high)' }}><div className="h-full rounded-full animate-pulse" style={{ width: '40%', backgroundColor: 'var(--md-sys-color-primary)' }} /></div>
                    </div>
                  )}

                  {expandedLectures[group.id] && !loadingLectures[group.id] && (
                    <div className="space-y-1.5 mb-3 max-h-60 overflow-y-auto">
                      {expandedLectures[group.id].length === 0 ? (
                        <p className="text-xs py-2 text-center" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>لا توجد محاضرات</p>
                      ) : (
                        expandedLectures[group.id].map((lec: Lecture) => (
                          <div
                            key={lec.id}
                            className="flex items-center justify-between px-3 py-2 rounded-md3-md text-xs"
                            style={{ backgroundColor: 'var(--md-sys-color-surface-container-low)' }}
                          >
                            <div className="flex items-center gap-2 min-w-0 flex-1">
                              <span className="material-symbols-outlined text-[16px]" style={{ color: Number(lec.is_completed) ? 'var(--md-sys-color-primary)' : 'var(--md-sys-color-outline)' }}>
                                {Number(lec.is_completed) ? 'check_circle' : 'radio_button_unchecked'}
                              </span>
                              <span className="font-medium" style={{ color: 'var(--md-sys-color-on-surface)' }}>{lec.day_of_week_name}</span>
                              {lec.time_from && <span style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>{lec.time_from}</span>}
                              {lec.topic && <span className="truncate max-w-[120px]" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>{lec.topic}</span>}
                              {lec.location && (
                                <span className="hidden sm:inline flex items-center gap-0.5" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>
                                  <span className="material-symbols-outlined text-[12px]">location_on</span>
                                  {lec.location}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              {lec.attended ? (
                                <span className="font-medium flex items-center gap-1" style={{ color: 'var(--md-sys-color-primary)' }}>
                                  <span className="material-symbols-outlined text-[14px]">check_circle</span>
                                  حاضر
                                  {lec.attended_at_time && <span className="text-[10px] opacity-70">{formatTime(lec.attended_at_time)}</span>}
                                </span>
                              ) : Number(lec.attendance_active) === 1 ? (
                                <button
                                  onClick={(e) => { e.stopPropagation(); openAttendance(lec.id, group.id); }}
                                  className="flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-medium"
                                  style={{
                                    backgroundColor: 'var(--md-sys-color-secondary-container)',
                                    color: 'var(--md-sys-color-on-secondary-container)',
                                    animation: 'm3-pulse 2s infinite',
                                  }}
                                >
                                  <span className="material-symbols-outlined text-[12px]">gps_fixed</span>
                                  تسجيل حضور
                                </button>
                              ) : (
                                <span className="text-[10px] flex items-center gap-0.5" style={{ color: 'var(--md-sys-color-outline)' }}>
                                  <span className="material-symbols-outlined text-[12px]">schedule</span>
                                  غير متاح
                                </span>
                              )}
                              <span className="text-[10px]" style={{ color: 'var(--md-sys-color-outline)' }}>{lec.date}</span>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}

                  {/* Zoom Link */}
                  {group.zoom_link && (
                    <a
                      href={group.zoom_link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-2 w-full py-2 rounded-full text-white text-sm font-medium"
                      style={{ backgroundColor: 'var(--md-sys-color-primary)', color: 'var(--md-sys-color-on-primary)' }}
                    >
                      <span className="material-symbols-outlined text-[16px]">link</span>
                      رابط Zoom
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ========== ATTENDANCE TOAST (MD3 Snackbar) ========== */}
      {toastVisible && toastData && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] w-full max-w-md px-4" style={{ animation: 'm3-slide-up 0.3s ease' }}>
          <div
            onClick={() => { setToastVisible(false); openAttendance(toastData.lectureId, toastData.groupId); }}
            className="flex items-center gap-3 px-5 py-4 rounded-md3-md cursor-pointer shadow-lg"
            style={{
              backgroundColor: 'var(--md-sys-color-inverse-surface)',
              color: 'var(--md-sys-color-inverse-on-surface)',
            }}
          >
            <span className="material-symbols-outlined text-[24px]" style={{ color: 'var(--md-sys-color-inverse-primary)' }}>campaign</span>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-sm">تم فتح باب الحضور!</p>
              <p className="text-xs mt-0.5 opacity-80">
                {toastData.topic} — {toastData.groupName}
              </p>
              <p className="text-xs mt-1 font-medium flex items-center gap-1" style={{ color: 'var(--md-sys-color-inverse-primary)' }}>
                <span className="material-symbols-outlined text-[14px]">gps_fixed</span>
                اضغط هنا لتسجيل الحضور
              </p>
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); setToastVisible(false); }}
              className="shrink-0 p-1 rounded-full"
              style={{ color: 'var(--md-sys-color-inverse-on-surface)', opacity: 0.7 }}
            >
              <span className="material-symbols-outlined text-[18px]">close</span>
            </button>
          </div>
        </div>
      )}

      {/* ========== ATTENDANCE MODAL ========== */}
      {attModal && (
        isMobile ? (
          <M3BottomSheet open={!!attModal} onClose={closeAttendance} title="تسجيل الحضور" maxHeightVh={90}>
            <div className="px-5 pb-6 space-y-4">
              {attStatus === 'idle' || attStatus === 'loading' ? (
                <>
                  {attMethod === 'qr' && (
                    <div className="space-y-2">
                      <div
                        id="qr-reader"
                        ref={qrVideoRef}
                        className="w-full aspect-square rounded-md3-md overflow-hidden"
                        style={{ backgroundColor: 'var(--md-sys-color-surface-container-highest)', minHeight: '200px' }}
                      />
                      <p className="text-xs text-center flex items-center justify-center gap-1" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>
                        <span className="material-symbols-outlined text-[14px]">camera_alt</span>
                        وجّه الكاميرا نحو QR code
                      </p>
                      <button
                        onClick={() => setAttMethod('manual')}
                        className="w-full py-2 rounded-full text-xs font-medium flex items-center justify-center gap-1.5"
                        style={{
                          border: '1px solid var(--md-sys-color-outline)',
                          color: 'var(--md-sys-color-on-surface)',
                          backgroundColor: 'transparent',
                        }}
                      >
                        <span className="material-symbols-outlined text-[14px]">smartphone</span>
                        الكاميرا مش شغالة؟ أدخل الكود يدوياً
                      </button>
                    </div>
                  )}

                  {attMethod === 'manual' && (
                    <div className="space-y-3">
                      <div className="text-center">
                        <p className="text-xs mb-3 flex items-center justify-center gap-1" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>
                          <span className="material-symbols-outlined text-[14px]">keyboard</span>
                          أدخل الكود الظاهر على شاشة المحاضر
                        </p>
                        <input
                          value={attCode}
                          onChange={e => { setAttCode(e.target.value.toUpperCase()); setAttStatus('idle'); }}
                          onKeyDown={e => e.key === 'Enter' && submitManualCode()}
                          placeholder="XXXXXX"
                          maxLength={6}
                          className="w-full text-center text-2xl font-mono font-bold px-4 py-3 rounded-md3-md outline-none"
                          style={{
                            backgroundColor: 'var(--md-sys-color-surface-container-highest)',
                            border: '2px solid var(--md-sys-color-outline)',
                            color: 'var(--md-sys-color-on-surface)',
                            letterSpacing: '0.3em',
                          }}
                          autoFocus
                        />
                      </div>
                      <button
                        onClick={() => setAttMethod('qr')}
                        className="w-full py-2 rounded-full text-xs font-medium flex items-center justify-center gap-1.5"
                        style={{
                          border: '1px solid var(--md-sys-color-outline)',
                          color: 'var(--md-sys-color-on-surface)',
                          backgroundColor: 'transparent',
                        }}
                      >
                        <span className="material-symbols-outlined text-[14px]">camera_alt</span>
                        مسح QR بالكاميرا
                      </button>
                      <button
                        onClick={submitManualCode}
                        disabled={attCode.trim().length !== 6 || attStatus === 'loading'}
                        className="w-full py-3 rounded-full text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2"
                        style={{ backgroundColor: 'var(--md-sys-color-primary)', color: 'var(--md-sys-color-on-primary)' }}
                      >
                        {attStatus === 'loading' ? (
                          <>
                            <div style={{ width: 80, backgroundColor: 'var(--md-sys-color-surface-container-high)' }} className="h-1 rounded-full overflow-hidden"><div className="h-full rounded-full animate-pulse" style={{ width: '60%', backgroundColor: 'var(--md-sys-color-primary)' }} /></div>
                            جاري التحقق...
                          </>
                        ) : 'تأكيد الحضور'}
                      </button>
                    </div>
                  )}

                  {attStatus === 'loading' && attMethod === 'qr' && (
                    <div
                      className="absolute inset-0 flex items-center justify-center rounded-md3-md"
                      style={{ backgroundColor: 'rgba(0, 0, 0, 0.4)' }}
                    >
                      <div style={{ width: 120, backgroundColor: 'var(--md-sys-color-surface-container-high)' }} className="h-1 rounded-full overflow-hidden"><div className="h-full rounded-full animate-pulse" style={{ width: '60%', backgroundColor: 'var(--md-sys-color-primary)' }} /></div>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center py-6 space-y-3">
                  {attStatus === 'success' ? (
                    <>
                      <span className="material-symbols-outlined text-[56px] block" style={{ color: 'var(--md-sys-color-primary)' }}>check_circle</span>
                      <p className="font-bold text-lg" style={{ color: 'var(--md-sys-color-primary)' }}>{attMessage}</p>
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-[56px] block" style={{ color: 'var(--md-sys-color-error)' }}>cancel</span>
                      <p className="font-bold text-sm" style={{ color: 'var(--md-sys-color-error)' }}>{attMessage}</p>
                      <button
                        onClick={() => { setAttStatus('idle'); setAttCode(''); initScanner(attModal.lectureId); }}
                        className="h-10 px-6 rounded-full text-sm font-medium flex items-center justify-center gap-2 mx-auto"
                        style={{ backgroundColor: 'var(--md-sys-color-primary)', color: 'var(--md-sys-color-on-primary)' }}
                      >
                        <span className="material-symbols-outlined text-[16px]">refresh</span>
                        إعادة المحاولة
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          </M3BottomSheet>
        ) : (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)', backdropFilter: 'blur(8px)' }}
            onClick={closeAttendance}
          >
            <div
              className="w-full max-w-sm rounded-md3-md p-5 shadow-xl space-y-4"
              style={{
                backgroundColor: 'var(--md-sys-color-surface-container)',
                border: '1px solid var(--md-sys-color-outline-variant)',
                animation: 'm3-scale-in 0.2s ease',
              }}
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-sm flex items-center gap-2" style={{ color: 'var(--md-sys-color-on-surface)' }}>
                  <span className="material-symbols-outlined text-[20px]" style={{ color: 'var(--md-sys-color-primary)' }}>gps_fixed</span>
                  تسجيل الحضور
                </h3>
                <button
                  onClick={closeAttendance}
                  className="p-1 rounded-full"
                  style={{ color: 'var(--md-sys-color-on-surface-variant)' }}
                >
                  <span className="material-symbols-outlined text-[20px]">close</span>
                </button>
              </div>

              {attStatus === 'idle' || attStatus === 'loading' ? (
                <>
                  {/* QR Scanner */}
                  {attMethod === 'qr' && (
                    <div className="space-y-2">
                      <div
                        id="qr-reader"
                        ref={qrVideoRef}
                        className="w-full aspect-square rounded-md3-md overflow-hidden"
                        style={{ backgroundColor: 'var(--md-sys-color-surface-container-highest)', minHeight: '200px' }}
                      />
                      <p className="text-xs text-center flex items-center justify-center gap-1" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>
                        <span className="material-symbols-outlined text-[14px]">camera_alt</span>
                        وجّه الكاميرا نحو QR code
                      </p>
                      <button
                        onClick={() => setAttMethod('manual')}
                        className="w-full py-2 rounded-full text-xs font-medium flex items-center justify-center gap-1.5"
                        style={{
                          border: '1px solid var(--md-sys-color-outline)',
                          color: 'var(--md-sys-color-on-surface)',
                          backgroundColor: 'transparent',
                        }}
                      >
                        <span className="material-symbols-outlined text-[14px]">smartphone</span>
                        الكاميرا مش شغالة؟ أدخل الكود يدوياً
                      </button>
                    </div>
                  )}

                  {/* Manual Code */}
                  {attMethod === 'manual' && (
                    <div className="space-y-3">
                      <div className="text-center">
                        <p className="text-xs mb-3 flex items-center justify-center gap-1" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>
                          <span className="material-symbols-outlined text-[14px]">keyboard</span>
                          أدخل الكود الظاهر على شاشة المحاضر
                        </p>
                        <input
                          value={attCode}
                          onChange={e => { setAttCode(e.target.value.toUpperCase()); setAttStatus('idle'); }}
                          onKeyDown={e => e.key === 'Enter' && submitManualCode()}
                          placeholder="XXXXXX"
                          maxLength={6}
                          className="w-full text-center text-2xl font-mono font-bold px-4 py-3 rounded-md3-md outline-none"
                          style={{
                            backgroundColor: 'var(--md-sys-color-surface-container-highest)',
                            border: '2px solid var(--md-sys-color-outline)',
                            color: 'var(--md-sys-color-on-surface)',
                            letterSpacing: '0.3em',
                          }}
                          autoFocus
                        />
                      </div>
                      <button
                        onClick={() => setAttMethod('qr')}
                        className="w-full py-2 rounded-full text-xs font-medium flex items-center justify-center gap-1.5"
                        style={{
                          border: '1px solid var(--md-sys-color-outline)',
                          color: 'var(--md-sys-color-on-surface)',
                          backgroundColor: 'transparent',
                        }}
                      >
                        <span className="material-symbols-outlined text-[14px]">camera_alt</span>
                        مسح QR بالكاميرا
                      </button>
                      <button
                        onClick={submitManualCode}
                        disabled={attCode.trim().length !== 6 || attStatus === 'loading'}
                        className="w-full py-3 rounded-full text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2"
                        style={{ backgroundColor: 'var(--md-sys-color-primary)', color: 'var(--md-sys-color-on-primary)' }}
                      >
                        {attStatus === 'loading' ? (
                          <>
                            <div style={{ width: 80, backgroundColor: 'var(--md-sys-color-surface-container-high)' }} className="h-1 rounded-full overflow-hidden"><div className="h-full rounded-full animate-pulse" style={{ width: '60%', backgroundColor: 'var(--md-sys-color-primary)' }} /></div>
                            جاري التحقق...
                          </>
                        ) : 'تأكيد الحضور'}
                      </button>
                    </div>
                  )}

                  {attStatus === 'loading' && attMethod === 'qr' && (
                    <div
                      className="absolute inset-0 flex items-center justify-center rounded-md3-md"
                      style={{ backgroundColor: 'rgba(0, 0, 0, 0.4)' }}
                    >
                      <div style={{ width: 120, backgroundColor: 'var(--md-sys-color-surface-container-high)' }} className="h-1 rounded-full overflow-hidden"><div className="h-full rounded-full animate-pulse" style={{ width: '60%', backgroundColor: 'var(--md-sys-color-primary)' }} /></div>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center py-6 space-y-3">
                  {attStatus === 'success' ? (
                    <>
                      <span className="material-symbols-outlined text-[56px] block" style={{ color: 'var(--md-sys-color-primary)' }}>check_circle</span>
                      <p className="font-bold text-lg" style={{ color: 'var(--md-sys-color-primary)' }}>{attMessage}</p>
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-[56px] block" style={{ color: 'var(--md-sys-color-error)' }}>cancel</span>
                      <p className="font-bold text-sm" style={{ color: 'var(--md-sys-color-error)' }}>{attMessage}</p>
                      <button
                        onClick={() => { setAttStatus('idle'); setAttCode(''); initScanner(attModal.lectureId); }}
                        className="h-10 px-6 rounded-full text-sm font-medium flex items-center justify-center gap-2 mx-auto"
                        style={{ backgroundColor: 'var(--md-sys-color-primary)', color: 'var(--md-sys-color-on-primary)' }}
                      >
                        <span className="material-symbols-outlined text-[16px]">refresh</span>
                        إعادة المحاولة
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        )
      )}

    </div>
  );
}
