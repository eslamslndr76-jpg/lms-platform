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

interface Cert {
  id: number;
  title_ar: string;
  serial_id: string;
  issued_at: string;
}

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300',
  review: 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300',
  paid: 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300',
  cancelled: 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300',
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
  const [certs, setCerts] = useState<Cert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    if (!user) return;
    setLoading(true);
    setError('');
    try {
      const [data, grps, myCerts] = await Promise.all([
        api('/api/orders/my'),
        api('/api/groups/my/all'),
        api('/api/certificates/my'),
      ]);
      setOrders(data || []);
      setGroups(grps || []);
      setCerts(myCerts || []);
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
  if (error) return <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4"><p className="text-red-500">{error}</p><button onClick={load} className="px-6 py-2.5 text-white rounded-xl text-sm font-medium" style={{ backgroundColor: primaryColor }}>إعادة المحاولة</button></div>;

  const pendingOrders = orders.filter(o => o.status === 'pending' || o.status === 'review');

  return (
    <div className="max-w-4xl mx-auto p-4">
      {/* Welcome */}
      <section className="mb-6">
        <h2 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>مرحباً، {user?.name}</h2>
        <p style={{ color: 'var(--text-muted)' }} className="text-sm">لوحة التحكم الخاصة بك</p>
      </section>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="rounded-2xl p-4 text-center shadow-sm border" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}>
          <div className="text-2xl mb-1">📚</div>
          <p className="text-lg font-bold" style={{ color: primaryColor }}>{groups.length}</p>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>كورسات مسجل بها</p>
        </div>
        <div className="rounded-2xl p-4 text-center shadow-sm border" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}>
          <div className="text-2xl mb-1">📋</div>
          <p className="text-lg font-bold" style={{ color: primaryColor }}>{pendingOrders.length}</p>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>طلبات معلقة</p>
        </div>
        <div className="rounded-2xl p-4 text-center shadow-sm border" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}>
          <div className="text-2xl mb-1">🎓</div>
          <p className="text-lg font-bold" style={{ color: primaryColor }}>{certs.length}</p>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>شهادات</p>
        </div>
      </div>

      {/* Progress Summary */}
      {groups.length > 0 && (() => {
        const totalDone = groups.reduce((s, g) => s + (g.lecture_progress?.done || 0), 0);
        const totalLecs = groups.reduce((s, g) => s + (g.lecture_progress?.total || 0), 0);
        const pct = totalLecs > 0 ? Math.round((totalDone / totalLecs) * 100) : 0;
        const withProgress = groups.filter(g => g.lecture_progress?.total != null && g.lecture_progress!.total > 0);
        const sorted = withProgress.sort((a, b) => (b.lecture_progress!.done / b.lecture_progress!.total) - (a.lecture_progress!.done / a.lecture_progress!.total));
        const top = sorted[0];
        const upcoming = groups.filter(g => g.next_lecture?.date).sort((a, b) => new Date(a.next_lecture!.date).getTime() - new Date(b.next_lecture!.date).getTime())[0];
        return (
          <section className="mb-6 rounded-2xl p-5 shadow-sm border" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}>
            <div className="flex items-center gap-2 mb-4">
              <span className="text-xl">📊</span>
              <h3 className="font-bold text-lg" style={{ color: 'var(--text)' }}>ملخص التقدم</h3>
            </div>
            {totalLecs > 0 && (
              <div className="mb-4">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-sm font-medium" style={{ color: 'var(--text)' }}>التقدم العام</span>
                  <span className="text-sm font-bold" style={{ color: primaryColor }}>{totalDone}/{totalLecs}</span>
                </div>
                <div className="w-full h-2.5 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--bg)' }}>
                  <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: primaryColor }} />
                </div>
              </div>
            )}
            {top && (
              <div className="rounded-xl p-3 mb-3" style={{ backgroundColor: 'var(--bg)' }}>
                <p className="text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>🔥 أكثر كورس تقدماً</p>
                <p className="font-bold text-sm" style={{ color: 'var(--text)' }}>{top.title_ar}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs font-medium" style={{ color: primaryColor }}>{top.lecture_progress!.done}/{top.lecture_progress!.total}</span>
                  <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--card)' }}>
                    <div className="h-full rounded-full" style={{ width: `${Math.round((top.lecture_progress!.done / top.lecture_progress!.total) * 100)}%`, backgroundColor: primaryColor }} />
                  </div>
                </div>
              </div>
            )}
            {upcoming && (
              <div className="rounded-xl p-3 mb-3" style={{ backgroundColor: 'var(--bg)' }}>
                <p className="text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>⏰ المحاضرة القادمة</p>
                <p className="text-sm font-bold" style={{ color: 'var(--text)' }}>{upcoming.title_ar}</p>
                <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                  {['السبت', 'الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة'][Number(upcoming.next_lecture!.day_of_week)] || upcoming.next_lecture!.day_of_week}
                  {' '}{upcoming.next_lecture!.time_from} - {upcoming.next_lecture!.time_to}
                </p>
              </div>
            )}
            {pct > 0 && (
              <div className="text-center">
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  {pct === 100 ? '🎉 مبروك! أكملت جميع المحاضرات!' :
                   pct >= 75 ? '🌟 ممتاز! باقي القليل على الإكمال!' :
                   pct >= 50 ? '💪 استمر! أنت في منتصف الطريق!' :
                   '🚀 بداية قوية! واصل التقدم!'}
                </span>
              </div>
            )}
          </section>
        );
      })()}

      {/* My Groups (All of them) */}
      {groups.length > 0 && (
        <section className="mb-6">
          <h3 className="font-bold text-lg mb-3" style={{ color: 'var(--text)' }}>📖 كورساتي</h3>
          <div className="space-y-3">
            {groups.map(group => (
              <div key={group.id} className="rounded-2xl p-4 shadow-sm border" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}>
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <h4 className="font-bold" style={{ color: 'var(--text)' }}>{group.title_ar}</h4>
                    <p className="text-sm font-medium" style={{ color: primaryColor }}>{group.name}</p>
                  </div>
                  {group.lecture_progress && (
                    <div className="text-center">
                      <span className="text-xs px-2 py-1 rounded-full font-medium" style={{ backgroundColor: `${primaryColor}15`, color: primaryColor }}>
                        {group.lecture_progress.done}/{group.lecture_progress.total}
                      </span>
                      {group.lecture_progress.total > 0 && (
                        <div className="w-16 h-1.5 rounded-full mt-1 overflow-hidden" style={{ backgroundColor: 'var(--bg)' }}>
                          <div className="h-full rounded-full" style={{ width: `${Math.round((group.lecture_progress.done / group.lecture_progress.total) * 100)}%`, backgroundColor: primaryColor }} />
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2 text-sm mb-3">
                  {group.instructor_name && (
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>🧑‍🏫 {group.instructor_name}</p>
                  )}
                  {group.location && (
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>📍 {group.location}</p>
                  )}
                </div>

                {group.next_lecture && (
                  <div className="rounded-xl p-3 mb-3" style={{ backgroundColor: 'var(--bg)' }}>
                    <p className="text-xs font-bold mb-1" style={{ color: 'var(--text-muted)' }}>المحاضرة القادمة</p>
                    <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>
                      {['السبت', 'الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة'][Number(group.next_lecture.day_of_week)] || group.next_lecture.day_of_week}
                      {' '}{group.next_lecture.time_from} - {group.next_lecture.time_to}
                    </p>
                    {group.next_lecture.topic && <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{group.next_lecture.topic}</p>}
                    {group.next_lecture.date && <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{group.next_lecture.date}</p>}
                  </div>
                )}

                {group.zoom_link && (
                  <a href={group.zoom_link} target="_blank" rel="noopener noreferrer"
                    className="block w-full py-2 text-center rounded-xl text-white text-sm font-medium"
                    style={{ backgroundColor: primaryColor }}>
                    🔗 رابط Zoom
                  </a>
                )}

                {group.start_date && (
                  <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>
                    📅 من {new Date(group.start_date).toLocaleDateString('ar-EG')} إلى {group.end_date ? new Date(group.end_date).toLocaleDateString('ar-EG') : 'بدون'}
                  </p>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Pending Orders */}
      {pendingOrders.length > 0 && (
        <section className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-lg" style={{ color: 'var(--text)' }}>⏳ طلبات معلقة</h3>
            <Link href="/orders" className="text-xs" style={{ color: primaryColor }}>عرض الكل</Link>
          </div>
          <div className="space-y-2">
            {pendingOrders.slice(0, 3).map(order => (
              <div key={order.id} className="rounded-2xl p-3 shadow-sm border" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}>
                <div className="flex items-center justify-between">
                  <p className="font-bold text-sm" style={{ color: 'var(--text)' }}>{order.title_ar}</p>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColors[order.status]}`}>
                    {statusLabels[order.status]}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs mt-1">
                  <span style={{ color: 'var(--text-muted)' }}>{new Date(order.created_at).toLocaleDateString('ar-EG')}</span>
                  <span className="font-bold" style={{ color: primaryColor }}>{order.amount} ج.م</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Certificates */}
      {certs.length > 0 && (
        <section className="mb-6">
          <h3 className="font-bold text-lg mb-3" style={{ color: 'var(--text)' }}>🎓 الشهادات</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {certs.map(cert => (
              <div key={cert.id} className="rounded-2xl p-4 shadow-sm border" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-bold" style={{ color: 'var(--text)' }}>{cert.title_ar}</p>
                    <p className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>{cert.serial_id}</p>
                  </div>
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    {new Date(cert.issued_at).toLocaleDateString('ar-EG')}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Empty State */}
      {groups.length === 0 && orders.length === 0 && certs.length === 0 && (
        <div className="text-center py-12">
          <div className="text-6xl mb-4">🎯</div>
          <h3 className="text-xl font-bold mb-2" style={{ color: 'var(--text)' }}>ابدأ رحلتك التعليمية</h3>
          <p className="mb-6" style={{ color: 'var(--text-muted)' }}>سجل في كورس وابدأ التعلم اليوم</p>
          <Link href="/courses" className="inline-block px-6 py-3 rounded-xl text-white font-medium shadow-lg" style={{ backgroundColor: primaryColor }}>
            تصفح الكورسات
          </Link>
        </div>
      )}

    </div>
  );
}
