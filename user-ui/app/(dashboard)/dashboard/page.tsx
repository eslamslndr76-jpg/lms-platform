'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '../../../lib/api';
import { useAuth } from '../../../lib/auth';
import { useBranding } from '../../../components/BrandingProvider';
import { Skeleton } from '../../../components/Skeleton';

interface Order {
  id: number;
  course_id: number;
  amount: number;
  status: string;
  title_ar: string;
  created_at: string;
}

interface Group {
  id: number;
  course_id: number;
  name: string;
  schedule: any;
  zoom_link?: string;
  start_date?: string;
  end_date?: string;
  instructor_name?: string;
  location?: string;
  is_complete: number;
  title_ar: string;
  title_en: string;
  next_lecture?: any;
  lecture_progress?: { total: number; done: number };
}

interface PendingSurvey {
  group_id: number;
  group_name: string;
  course_title: string;
  course_mode: string;
  completed_at: string | null;
  closes_at: string;
  days_left: number;
  status: 'pending' | 'draft' | 'submitted' | 'closed';
  answered_at: string | null;
  updated_at: string | null;
}

const statusStyles: Record<string, { bg: string; fg: string }> = {
  pending: { bg: '#fef3c7', fg: '#92400e' },
  review: { bg: '#dbeafe', fg: '#1e40af' },
  paid: { bg: '#dcfce7', fg: '#166534' },
  cancelled: { bg: '#fee2e2', fg: '#991b1b' },
};

const statusLabels: Record<string, string> = {
  pending: 'قيد الانتظار',
  review: 'قيد المراجعة',
  paid: 'تم الدفع',
  cancelled: 'ملغي',
};

export default function DashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const { primaryColor } = useBranding();
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [surveys, setSurveys] = useState<PendingSurvey[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    if (!user) return;
    setLoading(true);
    setError('');
    try {
      const [data, grps, srv] = await Promise.all([
        api('/api/orders/my'),
        api('/api/groups/my/all'),
        api('/api/surveys/my').catch(() => []),
      ]);
      setOrders(data || []);
      setGroups(grps || []);
      setSurveys(srv || []);
    } catch {
      setError('فشل تحميل البيانات');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading && !user) router.push('/login');
    if (user) load();
    const onFocus = () => { if (user) load(); };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [user, authLoading, router]);

  if (authLoading || loading) {
    return <div className="max-w-4xl mx-auto p-4 space-y-4"><Skeleton className="h-8 w-1/2" /><Skeleton className="h-24 w-full rounded-2xl" /><Skeleton className="h-24 w-full rounded-2xl" /></div>;
  }
  if (error) return <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
    <span className="material-symbols-outlined text-[48px]" style={{ color: 'var(--md-sys-color-error)' }}>error</span>
    <p style={{ color: 'var(--md-sys-color-on-surface)' }}>{error}</p>
    <button onClick={load} className="h-10 px-6 rounded-full text-sm font-medium" style={{ backgroundColor: 'var(--md-sys-color-primary)', color: 'var(--md-sys-color-on-primary)' }}>إعادة المحاولة</button>
  </div>;

  const pendingOrders = orders.filter(o => o.status === 'pending' || o.status === 'review');

  return (
    <div className="max-w-4xl mx-auto p-4">
      <section className="mb-6">
        <h2 className="text-2xl font-bold" style={{ color: 'var(--md-sys-color-on-surface)' }}>مرحباً، {user?.name}</h2>
        <p className="text-sm" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>لوحة التحكم الخاصة بك</p>
      </section>

      <div className="grid grid-cols-2 gap-3 mb-6">
        <div className="rounded-md3-md p-4 text-center" style={{ backgroundColor: 'var(--md-sys-color-surface-container)' }}>
          <span className="material-symbols-outlined text-[24px] mb-1 block" style={{ color: 'var(--md-sys-color-primary)' }}>school</span>
          <p className="text-lg font-bold" style={{ color: 'var(--md-sys-color-primary)' }}>{groups.length}</p>
          <p className="text-xs" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>كورسات مسجل بها</p>
        </div>
        <div className="rounded-md3-md p-4 text-center" style={{ backgroundColor: 'var(--md-sys-color-surface-container)' }}>
          <span className="material-symbols-outlined text-[24px] mb-1 block" style={{ color: 'var(--md-sys-color-primary)' }}>receipt_long</span>
          <p className="text-lg font-bold" style={{ color: 'var(--md-sys-color-primary)' }}>{pendingOrders.length}</p>
          <p className="text-xs" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>طلبات معلقة</p>
        </div>
      </div>

      {/* «قيّم دورتك» — يبقى ظاهراً حتى يجيب الطالب (edit-plan.md §4.4) */}
      {(() => {
        const open = surveys.filter(s => s.status === 'pending' || s.status === 'draft');
        if (open.length === 0) return null;
        return (
          <section className="mb-6 space-y-3">
            {open.map(s => (
              <div key={s.group_id} className="rounded-md3-lg p-4 relative overflow-hidden"
                style={{ backgroundColor: 'var(--md-sys-color-primary-container)' }}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <span className="material-symbols-outlined text-[26px] shrink-0"
                      style={{ color: 'var(--md-sys-color-on-primary-container)' }}>reviews</span>
                    <div className="min-w-0">
                      <h3 className="font-bold text-sm" style={{ color: 'var(--md-sys-color-on-primary-container)' }}>
                        قيّم دورتك
                      </h3>
                      <p className="text-sm mt-0.5 truncate" style={{ color: 'var(--md-sys-color-on-primary-container)' }}>
                        {s.course_title} · {s.group_name}
                      </p>
                      <p className="text-[11px] mt-1 flex items-center gap-1 flex-wrap" style={{ color: 'var(--md-sys-color-on-primary-container)', opacity: 0.85 }}>
                        <span className="material-symbols-outlined text-[13px]">schedule</span>
                        نحو دقيقتين · يتبقى {s.days_left} يوماً
                        {s.status === 'draft' && <span className="font-bold">· مسودة محفوظة</span>}
                      </p>
                    </div>
                  </div>
                </div>
                <Link href={`/survey/${s.group_id}`}
                  className="mt-3 h-11 w-full rounded-full text-sm font-bold flex items-center justify-center gap-2"
                  style={{ backgroundColor: 'var(--md-sys-color-primary)', color: 'var(--md-sys-color-on-primary)' }}>
                  <span className="material-symbols-outlined text-[18px]">edit_note</span>
                  {s.status === 'draft' ? 'أكمل الاستبيان' : 'ابدأ الاستبيان'}
                </Link>
              </div>
            ))}
          </section>
        );
      })()}

      {groups.length > 0 && (() => {
        const totalDone = groups.reduce((s, g) => s + (g.lecture_progress?.done || 0), 0);
        const totalLecs = groups.reduce((s, g) => s + (g.lecture_progress?.total || 0), 0);
        const pct = totalLecs > 0 ? Math.round((totalDone / totalLecs) * 100) : 0;
        const sorted = groups.filter(g => g.lecture_progress?.total != null && g.lecture_progress!.total > 0)
          .sort((a, b) => (b.lecture_progress!.done / b.lecture_progress!.total) - (a.lecture_progress!.done / a.lecture_progress!.total));
        const top = sorted[0];
        const upcoming = groups.filter(g => g.next_lecture?.date).sort((a, b) => new Date(a.next_lecture!.date).getTime() - new Date(b.next_lecture!.date).getTime())[0];

        return (
          <section className="mb-6 rounded-md3-md p-5" style={{ backgroundColor: 'var(--md-sys-color-surface-container)' }}>
            <div className="flex items-center gap-2 mb-4">
              <span className="material-symbols-outlined" style={{ color: 'var(--md-sys-color-primary)' }}>analytics</span>
              <h3 className="font-bold text-lg" style={{ color: 'var(--md-sys-color-on-surface)' }}>ملخص التقدم</h3>
            </div>
            {totalLecs > 0 && (
              <div className="mb-4">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-sm font-medium" style={{ color: 'var(--md-sys-color-on-surface)' }}>التقدم العام</span>
                  <span className="text-sm font-bold" style={{ color: 'var(--md-sys-color-primary)' }}>{totalDone}/{totalLecs}</span>
                </div>
                <div className="w-full h-2.5 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--md-sys-color-surface-container-highest)' }}>
                  <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: 'var(--md-sys-color-primary)' }} />
                </div>
              </div>
            )}
            {top && (
              <div className="rounded-md3-md p-3 mb-3" style={{ backgroundColor: 'var(--md-sys-color-surface-container-low)' }}>
                <p className="text-xs font-medium mb-1 flex items-center gap-1" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>
                  <span className="material-symbols-outlined text-[14px]">trending_up</span> أكثر كورس تقدماً
                </p>
                <p className="font-bold text-sm" style={{ color: 'var(--md-sys-color-on-surface)' }}>{top.title_ar}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs font-medium" style={{ color: 'var(--md-sys-color-primary)' }}>{top.lecture_progress!.done}/{top.lecture_progress!.total}</span>
                  <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--md-sys-color-surface-container-highest)' }}>
                    <div className="h-full rounded-full" style={{ width: `${Math.round((top.lecture_progress!.done / top.lecture_progress!.total) * 100)}%`, backgroundColor: 'var(--md-sys-color-primary)' }} />
                  </div>
                </div>
              </div>
            )}
            {upcoming && (
              <div className="rounded-md3-md p-3 mb-3" style={{ backgroundColor: 'var(--md-sys-color-surface-container-low)' }}>
                <p className="text-xs font-medium mb-1 flex items-center gap-1" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>
                  <span className="material-symbols-outlined text-[14px]">schedule</span> المحاضرة القادمة
                </p>
                <p className="text-sm font-bold" style={{ color: 'var(--md-sys-color-on-surface)' }}>{upcoming.title_ar}</p>
                <p className="text-xs mt-1" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>
                  {['السبت', 'الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة'][Number(upcoming.next_lecture!.day_of_week)] || upcoming.next_lecture!.day_of_week}
                  {' '}{upcoming.next_lecture!.time_from} - {upcoming.next_lecture!.time_to}
                </p>
              </div>
            )}
          </section>
        );
      })()}

      {groups.length > 0 && (
        <section className="mb-6">
          <h3 className="font-bold text-lg mb-3 flex items-center gap-2" style={{ color: 'var(--md-sys-color-on-surface)' }}>
            <span className="material-symbols-outlined" style={{ color: 'var(--md-sys-color-primary)' }}>menu_book</span> كورساتي
          </h3>
          <div className="space-y-3">
            {groups.map(group => (
              <div key={group.id} className="rounded-md3-md p-4" style={{ backgroundColor: 'var(--md-sys-color-surface-container)' }}>
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <h4 className="font-bold" style={{ color: 'var(--md-sys-color-on-surface)' }}>{group.title_ar}</h4>
                    <p className="text-sm font-medium" style={{ color: 'var(--md-sys-color-primary)' }}>{group.name}</p>
                  </div>
                  {group.lecture_progress && (
                    <div className="text-center">
                      <span className="text-xs px-2 py-1 rounded-full font-medium" style={{ backgroundColor: 'var(--md-sys-color-primary-container)', color: 'var(--md-sys-color-on-primary-container)' }}>
                        {group.lecture_progress.done}/{group.lecture_progress.total}
                      </span>
                      {group.lecture_progress.total > 0 && (
                        <div className="w-16 h-1.5 rounded-full mt-1 overflow-hidden" style={{ backgroundColor: 'var(--md-sys-color-surface-container-highest)' }}>
                          <div className="h-full rounded-full" style={{ width: `${Math.round((group.lecture_progress.done / group.lecture_progress.total) * 100)}%`, backgroundColor: 'var(--md-sys-color-primary)' }} />
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm mb-3">
                  {group.instructor_name && (
                    <p className="text-xs flex items-center gap-1" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>
                      <span className="material-symbols-outlined text-[14px]">person</span> {group.instructor_name}
                    </p>
                  )}
                  {group.location && (
                    <p className="text-xs flex items-center gap-1" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>
                      <span className="material-symbols-outlined text-[14px]">location_on</span> {group.location}
                    </p>
                  )}
                </div>
                {group.next_lecture && (
                  <div className="rounded-md3-md p-3 mb-3" style={{ backgroundColor: 'var(--md-sys-color-surface-container-low)' }}>
                    <p className="text-xs font-bold mb-1 flex items-center gap-1" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>
                      <span className="material-symbols-outlined text-[12px]">schedule</span> المحاضرة القادمة
                    </p>
                    <p className="text-sm font-medium" style={{ color: 'var(--md-sys-color-on-surface)' }}>
                      {['السبت', 'الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة'][Number(group.next_lecture.day_of_week)] || group.next_lecture.day_of_week}
                      {' '}{group.next_lecture.time_from} - {group.next_lecture.time_to}
                    </p>
                    {group.next_lecture.topic && <p className="text-xs mt-1" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>{group.next_lecture.topic}</p>}
                  </div>
                )}
                {group.zoom_link && (
                  <a href={group.zoom_link} target="_blank" rel="noopener noreferrer"
                    className="block w-full py-2 text-center rounded-full text-sm font-medium flex items-center justify-center gap-2"
                    style={{ backgroundColor: 'var(--md-sys-color-primary)', color: 'var(--md-sys-color-on-primary)' }}>
                    <span className="material-symbols-outlined text-[16px]">videocam</span> رابط Zoom
                  </a>
                )}
                {group.start_date && (
                  <p className="text-xs mt-2 flex items-center gap-1" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>
                    <span className="material-symbols-outlined text-[12px]">calendar_today</span>
                    من {new Date(group.start_date).toLocaleDateString('ar-EG')} إلى {group.end_date ? new Date(group.end_date).toLocaleDateString('ar-EG') : 'بدون'}
                  </p>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {pendingOrders.length > 0 && (
        <section className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-lg flex items-center gap-2" style={{ color: 'var(--md-sys-color-on-surface)' }}>
              <span className="material-symbols-outlined" style={{ color: 'var(--md-sys-color-primary)' }}>pending</span> طلبات معلقة
            </h3>
            <Link href="/orders" className="text-xs font-medium" style={{ color: 'var(--md-sys-color-primary)' }}>عرض الكل</Link>
          </div>
          <div className="space-y-2">
            {pendingOrders.slice(0, 3).map(order => {
              const st = statusStyles[order.status] || { bg: '#f3f4f6', fg: '#374151' };
              return (
                <div key={order.id} className="rounded-md3-md p-3" style={{ backgroundColor: 'var(--md-sys-color-surface-container)' }}>
                  <div className="flex items-center justify-between">
                    <p className="font-bold text-sm" style={{ color: 'var(--md-sys-color-on-surface)' }}>{order.title_ar}</p>
                    <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: st.bg, color: st.fg }}>{statusLabels[order.status]}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs mt-1">
                    <span style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>{new Date(order.created_at).toLocaleDateString('ar-EG')}</span>
                    <span className="font-bold" style={{ color: 'var(--md-sys-color-primary)' }}>{order.amount} ج.م</span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {groups.length === 0 && orders.length === 0 && (
        <div className="text-center py-12">
          <span className="material-symbols-outlined text-[64px] block mb-4" style={{ color: 'var(--md-sys-color-outline)' }}>school</span>
          <h3 className="text-xl font-bold mb-2" style={{ color: 'var(--md-sys-color-on-surface)' }}>ابدأ رحلتك التعليمية</h3>
          <p className="mb-6" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>سجل في كورس وابدأ التعلم اليوم</p>
          <Link href="/courses" className="inline-flex items-center gap-2 h-12 px-6 rounded-full text-sm font-medium"
            style={{ backgroundColor: 'var(--md-sys-color-primary)', color: 'var(--md-sys-color-on-primary)' }}>
            <span className="material-symbols-outlined text-[18px]">search</span> تصفح الكورسات
          </Link>
        </div>
      )}
    </div>
  );
}
