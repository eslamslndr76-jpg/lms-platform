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
  pending: 'bg-yellow-100 text-yellow-800',
  review: 'bg-blue-100 text-blue-800',
  paid: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-800',
};

const statusLabels: Record<string, string> = {
  pending: 'قيد الانتظار',
  review: 'قيد المراجعة',
  paid: 'تم الدفع',
  cancelled: 'ملغي',
};

export default function DashboardPage() {
  const { user, logout, loading: authLoading } = useAuth();
  const { primaryColor, systemName } = useBranding();
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) router.push('/login');
    if (user) {
      api('/api/orders/my').then(setOrders).catch(() => {}).finally(() => setLoading(false));
    }
  }, [user, authLoading, router]);

  if (authLoading || loading) {
    return <div className="p-4 space-y-4"><Skeleton className="h-8 w-1/2" /><Skeleton className="h-24 w-full rounded-2xl" /><Skeleton className="h-24 w-full rounded-2xl" /></div>;
  }

  return (
    <div className="min-h-screen">
      <header className="bg-white shadow-sm sticky top-0 z-40">
        <div className="px-4 py-3 flex items-center justify-between">
          <h1 className="text-lg font-bold" style={{ color: primaryColor }}>{systemName}</h1>
          <button onClick={() => { logout(); router.push('/'); }}
            className="text-sm text-gray-500">تسجيل خروج</button>
        </div>
      </header>

      <main className="px-4 py-6">
        <section className="mb-6">
          <h2 className="text-xl font-bold text-gray-900">مرحباً، {user?.name}</h2>
          <p className="text-gray-500 text-sm">لوحة التحكم الخاصة بك</p>
        </section>

        <section>
          <h3 className="font-bold text-gray-900 mb-4">طلباتي</h3>
          {orders.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-400 mb-4">لا توجد طلبات حتى الآن</p>
              <Link href="/courses"
                className="inline-block px-6 py-3 rounded-xl text-white font-medium"
                style={{ backgroundColor: primaryColor }}>
                تصفح الكورسات
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {orders.map(order => (
                <div key={order.id} className="bg-white rounded-2xl p-4 shadow-sm">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-bold text-gray-900">{order.title_ar}</h4>
                    <span className={`text-xs px-3 py-1 rounded-full font-medium ${statusColors[order.status] || 'bg-gray-100'}`}>
                      {statusLabels[order.status] || order.status}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">{new Date(order.created_at).toLocaleDateString('ar-EG')}</span>
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
      </main>
    </div>
  );
}
