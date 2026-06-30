'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { useBranding } from '../../components/BrandingProvider';
import { Skeleton } from '../../components/Skeleton';

interface Order {
  id: number;
  course_id: number;
  amount: number;
  status: string;
  title_ar: string;
  title_en: string;
  created_at: string;
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
  const [myGroup, setMyGroup] = useState<any>(null);
  const [certs, setCerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    if (!user) return;
    setLoading(true);
    setError('');
    try {
      const [data, group, myCerts] = await Promise.all([
        api('/api/orders/my'),
        api('/api/groups/my'),
        api('/api/certificates/my'),
      ]);
      setOrders(data);
      setMyGroup(group);
      setCerts(myCerts);
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
    return <div className="space-y-4"><Skeleton className="h-8 w-1/2" /><Skeleton className="h-24 w-full rounded-2xl" /><Skeleton className="h-24 w-full rounded-2xl" /></div>;
  }
  if (error) return <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4"><p className="text-red-500">{error}</p><button onClick={load} className="px-6 py-2.5 text-white rounded-xl text-sm font-medium" style={{ backgroundColor: primaryColor }}>إعادة المحاولة</button></div>;

  return (
    <div>
      <section className="mb-6">
        <h2 className="text-xl font-bold" style={{ color: 'var(--text)' }}>مرحباً، {user?.name}</h2>
        <p style={{ color: 'var(--text-muted)' }} className="text-sm">لوحة التحكم الخاصة بك</p>
      </section>

        <section>
          <h3 className="font-bold text-gray-900 mb-4">طلباتي</h3>
          {orders.length === 0 ? (
            <div className="text-center py-12">
              <p className="mb-4" style={{ color: 'var(--text-muted)' }}>لا توجد طلبات حتى الآن</p>
              <Link href="/courses"
                className="inline-block px-6 py-3 rounded-xl text-white font-medium"
                style={{ backgroundColor: primaryColor }}>
                تصفح الكورسات
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {orders.map(order => (
                <div key={order.id} className="rounded-2xl p-4 shadow-sm" style={{ backgroundColor: 'var(--card)' }}>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-bold" style={{ color: 'var(--text)' }}>{order.title_ar}</h4>
                    <span className={`text-xs px-3 py-1 rounded-full font-medium ${statusColors[order.status] || 'bg-gray-100 dark:bg-gray-800'}`}>
                      {statusLabels[order.status] || order.status}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span style={{ color: 'var(--text-muted)' }}>{new Date(order.created_at).toLocaleDateString('ar-EG')}</span>
                    <span className="font-bold" style={{ color: primaryColor }}>{order.amount} ج.م</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="mt-8">
          <Link href="/courses"
            className="block w-full py-3 text-center rounded-xl text-white font-medium shadow-lg"
            style={{ backgroundColor: primaryColor }}>
            تصفح المزيد من الكورسات
          </Link>
        </section>

        {myGroup && (
          <section className="mt-8">
            <h3 className="font-bold mb-4" style={{ color: 'var(--text)' }}>مجموعتي</h3>
            <div className="rounded-2xl p-4 shadow-sm" style={{ backgroundColor: 'var(--card)' }}>
              <p className="font-bold text-lg mb-2" style={{ color: 'var(--text)' }}>{myGroup.name}</p>
              {myGroup.schedule && (
                <p className="text-sm mb-1" style={{ color: 'var(--text-muted)' }}>
                  🗓 {myGroup.schedule.day || ''} {myGroup.schedule.time || ''}
                </p>
              )}
              {myGroup.zoom_link && (
                <a href={myGroup.zoom_link} target="_blank" rel="noopener noreferrer"
                  className="inline-block px-4 py-2 rounded-xl text-white text-sm font-medium mt-2"
                  style={{ backgroundColor: primaryColor }}>
                  🔗 رابط Zoom
                </a>
              )}
              {myGroup.start_date && (
                <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>
                  📅 من {new Date(myGroup.start_date).toLocaleDateString('ar-EG')} إلى {myGroup.end_date ? new Date(myGroup.end_date).toLocaleDateString('ar-EG') : 'بدون'}
                </p>
              )}
            </div>
          </section>
        )}

        {certs.length > 0 && (
          <section className="mt-8">
            <h3 className="font-bold mb-4" style={{ color: 'var(--text)' }}>الشهادات</h3>
            <div className="space-y-3">
              {certs.map((cert: any) => (
                <div key={cert.id} className="rounded-2xl p-4 shadow-sm" style={{ backgroundColor: 'var(--card)' }}>
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
    </div>
  );
}
