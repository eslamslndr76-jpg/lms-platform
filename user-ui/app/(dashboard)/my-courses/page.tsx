'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '../../../lib/api';
import { useAuth } from '../../../lib/auth';
import { useBranding } from '../../../components/BrandingProvider';
import { Skeleton } from '../../../components/Skeleton';

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
}

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300',
  active: 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300',
  completed: 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300',
  cancelled: 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300',
};

const statusLabels: Record<string, string> = {
  pending: '⏳ قيد الانتظار',
  active: '🟢 نشط',
  completed: '✅ مكتمل',
  cancelled: '❌ ملغي',
};

const progressColors = [
  { threshold: 80, color: '#dc2626', label: '🔥 أوشكت على الانتهاء!' },
  { threshold: 50, color: '#d97706', label: '💪 استمر!' },
  { threshold: 0, color: '#16a34a', label: '🚀 بداية قوية!' },
];

function getProgressColor(pct: number): string {
  if (pct >= 80) return '#dc2626';
  if (pct >= 50) return '#d97706';
  return '#16a34a';
}

function getProgressLabel(pct: number, isComplete: boolean): string {
  if (isComplete) return '🎉 مبروك! اكتمل الكورس';
  if (pct === 0) return 'لم تبدأ بعد';
  if (pct >= 100) return '🏆 اكتملت كل المحاضرات';
  if (pct >= 80) return '🔥 أوشكت على الانتهاء!';
  if (pct >= 50) return '💪 استمر! أنت في منتصف الطريق!';
  return '🚀 بداية قوية! واصل التقدم!';
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
    if (!authLoading && !user) router.push('/login');
    if (user) load();
  }, [user, authLoading, router]);

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
        setAttMessage(res.alreadyMarked ? 'تم تسجيل الحضور مسبقاً' : '✅ تم تسجيل الحضور بنجاح');
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
          {[1, 2].map(i => <Skeleton key={i} className="h-64 w-full rounded-2xl" />)}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <p className="text-red-500">{error}</p>
        <button onClick={load} className="px-6 py-2.5 text-white rounded-xl text-sm font-medium" style={{ backgroundColor: primaryColor }}>
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
          <h2 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>🎓 كورساتي</h2>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            {groups.length > 0 ? `أنت مسجل في ${groups.length} كورس` : 'لم تسجل في أي كورس بعد'}
          </p>
        </div>
      </div>

      {/* Filter Tabs */}
      {groups.length > 0 && (
        <div className="flex gap-2 mb-6">
          {(['all', 'active', 'completed'] as const).map(f => (
            <button key={f} onClick={() => setActiveFilter(f)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${activeFilter === f ? 'text-white shadow-sm' : ''}`}
              style={activeFilter === f ? { backgroundColor: primaryColor } : { backgroundColor: 'var(--card)', color: 'var(--text)' }}>
              {f === 'all' ? 'الكل' : f === 'active' ? '🟢 النشطة' : '✅ المكتملة'}
            </button>
          ))}
        </div>
      )}

      {/* Course Grid */}
      {filtered.length === 0 ? (
        <div className="text-center py-16">
          <div className="text-6xl mb-4">
            {activeFilter === 'all' ? '🎯' : activeFilter === 'active' ? '🟢' : '✅'}
          </div>
          <h3 className="text-xl font-bold mb-2" style={{ color: 'var(--text)' }}>
            {activeFilter === 'all' ? 'لم تسجل في أي كورس بعد' :
             activeFilter === 'active' ? 'لا توجد كورسات نشطة حالياً' : 'لا توجد كورسات مكتملة'}
          </h3>
          <p className="mb-6" style={{ color: 'var(--text-muted)' }}>
            {activeFilter === 'all' ? 'سجل في كورس وابدأ التعلم اليوم' : 'غير فلتر العرض'}
          </p>
          {activeFilter === 'all' && (
            <Link href="/courses" className="inline-block px-6 py-3 rounded-xl text-white font-medium shadow-lg" style={{ backgroundColor: primaryColor }}>
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
              <div key={group.id} className="rounded-2xl overflow-hidden shadow-sm border transition-all hover:shadow-md" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}>
                {/* Image / Placeholder */}
                {group.image_url ? (
                  <div className="h-32 overflow-hidden">
                    <img src={group.image_url} alt={group.title_ar} className="w-full h-full object-cover" />
                  </div>
                ) : (
                  <div className="h-32 flex items-center justify-center text-white text-2xl font-bold" style={{ backgroundColor: primaryColor }}>
                    {group.title_ar?.charAt(0) || '📚'}
                  </div>
                )}

                <div className="p-4">
                  {/* Header: Title + Status */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="min-w-0 flex-1">
                      <h3 className="font-bold text-base truncate" style={{ color: 'var(--text)' }}>{group.title_ar}</h3>
                      <p className="text-xs font-medium" style={{ color: primaryColor }}>{group.name}</p>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${statusColors[group.status] || ''}`}>
                      {statusLabels[group.status] || group.status}
                    </span>
                  </div>

                  {/* Instructor + Location */}
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs mb-3" style={{ color: 'var(--text-muted)' }}>
                    {group.instructor_name && <span>🧑‍🏫 {group.instructor_name}</span>}
                    {group.location && <span>📍 {group.location}</span>}
                    {group.student_count != null && <span>👥 {group.student_count} طالب</span>}
                  </div>

                  {/* Progress Bar */}
                  {total > 0 && (
                    <div className="mb-3">
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span style={{ color: 'var(--text-muted)' }}>التقدم</span>
                        <span style={{ color: barColor, fontWeight: 700 }}>{done}/{total} ({pct}%)</span>
                      </div>
                      <div className="w-full h-2 rounded-full overflow-hidden" style={{ backgroundColor: `${barColor}15` }}>
                        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: barColor }} />
                      </div>
                      <p className="text-[10px] mt-1" style={{ color: barColor }}>
                        {getProgressLabel(pct, Number(group.is_complete) === 1)}
                      </p>
                    </div>
                  )}

                  {/* Next Lecture */}
                  {nl && (
                    <div className="rounded-xl p-3 mb-3" style={{ backgroundColor: 'var(--bg)' }}>
                      <p className="text-[10px] font-bold mb-1" style={{ color: 'var(--text-muted)' }}>⏰ المحاضرة القادمة</p>
                      <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>
                        {nl.day_of_week_name || ['السبت', 'الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة'][Number(nl.day_of_week)]}
                        {nl.time_from ? ` ${nl.time_from} - ${nl.time_to}` : ''}
                      </p>
                      {nl.topic && <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{nl.topic}</p>}
                      {nl.date && <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{nl.date}</p>}
                    </div>
                  )}

                  {/* Lectures Expandable */}
                  <button onClick={() => toggleLectures(group.id)}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all mb-2"
                    style={{ backgroundColor: 'var(--bg)', color: 'var(--text)' }}>
                    <span>📅 جميع المحاضرات ({total})</span>
                    <span style={{ transform: expandedLectures[group.id] ? 'rotate(180deg)' : '', transition: 'transform 0.2s' }}>▼</span>
                  </button>

                  {loadingLectures[group.id] && (
                    <div className="flex justify-center py-3">
                      <div className="animate-spin h-4 w-4 border-2 rounded-full" style={{ borderColor: primaryColor, borderTopColor: 'transparent' }} />
                    </div>
                  )}

                  {expandedLectures[group.id] && !loadingLectures[group.id] && (
                    <div className="space-y-1.5 mb-3 max-h-60 overflow-y-auto">
                      {expandedLectures[group.id].length === 0 ? (
                        <p className="text-xs py-2 text-center" style={{ color: 'var(--text-muted)' }}>لا توجد محاضرات</p>
                      ) : (
                        expandedLectures[group.id].map((lec: Lecture) => (
                          <div key={lec.id} className="flex items-center justify-between px-3 py-2 rounded-xl text-xs" style={{ backgroundColor: 'var(--bg)' }}>
                            <div className="flex items-center gap-2 min-w-0 flex-1">
                              <span>{Number(lec.is_completed) ? '✅' : '⬜'}</span>
                              <span className="font-medium" style={{ color: 'var(--text)' }}>{lec.day_of_week_name}</span>
                              {lec.time_from && <span style={{ color: 'var(--text-muted)' }}>{lec.time_from}</span>}
                              {lec.topic && <span className="truncate max-w-[120px]" style={{ color: 'var(--text-muted)' }}>{lec.topic}</span>}
                              {lec.location && <span className="hidden sm:inline" style={{ color: 'var(--text-muted)' }}>📍{lec.location}</span>}
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              {(lec as any).attended ? (
                                <span className="text-green-600 font-medium">✅ حاضر</span>
                              ) : (
                                <button onClick={(e) => { e.stopPropagation(); openAttendance(lec.id, group.id); }}
                                  className="px-2 py-1 rounded text-[10px] font-medium"
                                  style={{ backgroundColor: '#fefce8', color: '#a16207' }}>
                                  🎯 تسجيل حضور
                                </button>
                              )}
                              <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{lec.date}</span>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}

                  {/* Zoom Link */}
                  {group.zoom_link && (
                    <a href={group.zoom_link} target="_blank" rel="noopener noreferrer"
                      className="block w-full py-2 text-center rounded-xl text-white text-sm font-medium"
                      style={{ backgroundColor: primaryColor }}>
                      🔗 رابط Zoom
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ========== ATTENDANCE MODAL ========== */}
      {attModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={closeAttendance}>
          <div className="w-full max-w-sm rounded-2xl p-5 shadow-xl border space-y-4" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-sm" style={{ color: 'var(--text)' }}>🎯 تسجيل الحضور</h3>
              <button onClick={closeAttendance} className="text-lg" style={{ color: 'var(--text-muted)' }}>✕</button>
            </div>

            {attStatus === 'idle' || attStatus === 'loading' ? (
              <>
                {/* QR Scanner */}
                {attMethod === 'qr' && (
                  <div className="space-y-2">
                    <div id="qr-reader" ref={qrVideoRef} className="w-full aspect-square rounded-xl overflow-hidden bg-black" style={{ minHeight: '200px' }} />
                    <p className="text-xs text-center" style={{ color: 'var(--text-muted)' }}>
                      وجّه الكاميرا نحو QR code
                    </p>
                    <button onClick={() => setAttMethod('manual')} className="w-full py-2 rounded-xl text-xs font-medium border"
                      style={{ borderColor: 'var(--border)', color: 'var(--text)' }}>
                      📱 الكاميرا مش شغالة؟ أدخل الكود يدوياً
                    </button>
                  </div>
                )}

                {/* Manual Code */}
                {attMethod === 'manual' && (
                  <div className="space-y-3">
                    <div className="text-center">
                      <p className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>
                        أدخل الكود الظاهر على شاشة المحاضر
                      </p>
                      <input
                        value={attCode}
                        onChange={e => { setAttCode(e.target.value.toUpperCase()); setAttStatus('idle'); }}
                        onKeyDown={e => e.key === 'Enter' && submitManualCode()}
                        placeholder="XXXXXX"
                        maxLength={6}
                        className="w-full text-center text-2xl font-mono font-bold tracking-[0.3em] px-4 py-3 rounded-xl border"
                        style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)', letterSpacing: '0.3em' }}
                        autoFocus
                      />
                    </div>
                    <button onClick={() => setAttMethod('qr')} className="w-full py-2 rounded-xl text-xs font-medium border"
                      style={{ borderColor: 'var(--border)', color: 'var(--text)' }}>
                      📷 مسح QR بالكاميرا
                    </button>
                    <button onClick={submitManualCode} disabled={attCode.trim().length !== 6 || attStatus === 'loading'}
                      className="w-full py-3 rounded-xl text-white font-medium disabled:opacity-50"
                      style={{ backgroundColor: primaryColor }}>
                      {attStatus === 'loading' ? (
                        <span className="flex items-center justify-center gap-2">
                          <div className="animate-spin h-4 w-4 border-2 rounded-full border-white border-t-transparent" />
                          جاري التحقق...
                        </span>
                      ) : 'تأكيد الحضور'}
                    </button>
                  </div>
                )}

                {attStatus === 'loading' && attMethod === 'qr' && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-xl">
                    <div className="animate-spin h-8 w-8 border-2 rounded-full" style={{ borderColor: 'white', borderTopColor: 'transparent' }} />
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-6 space-y-3">
                {attStatus === 'success' ? (
                  <>
                    <p className="text-5xl">✅</p>
                    <p className="font-bold text-lg" style={{ color: '#16a34a' }}>{attMessage}</p>
                  </>
                ) : (
                  <>
                    <p className="text-5xl">❌</p>
                    <p className="font-bold text-sm" style={{ color: '#dc2626' }}>{attMessage}</p>
                    <button onClick={() => { setAttStatus('idle'); setAttCode(''); initScanner(attModal.lectureId); }}
                      className="px-6 py-2 rounded-xl text-sm font-medium text-white"
                      style={{ backgroundColor: primaryColor }}>
                      🔄 إعادة المحاولة
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
