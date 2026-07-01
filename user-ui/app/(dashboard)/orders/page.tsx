'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '../../../lib/api';
import { useAuth } from '../../../lib/auth';
import { useBranding } from '../../../components/BrandingProvider';
import { PageSkeleton } from '../../../components/Skeleton';

interface Order {
  id: number;
  course_id: number;
  amount: number;
  status: string;
  title_ar: string;
  title_en: string;
  instructor?: string;
  course_mode?: string;
  created_at: string;
  notes_student?: string;
  payment_method?: string;
}

interface OrderDetail extends Order {
  image_url?: string;
  groups: Array<{
    id: number;
    name: string;
    instructor_name: string;
    location: string;
    start_date: string;
    end_date: string;
    is_complete: number;
    zoom_link: string;
  }>;
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

export default function OrdersPage() {
  const { user, loading: authLoading } = useAuth();
  const { primaryColor } = useBranding();
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [detailOrder, setDetailOrder] = useState<OrderDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const fetchOrders = useCallback(async () => {
    if (!user) return;
    try {
      const data = await api('/api/orders/my');
      setOrders(data || []);
    } catch { /* ignore */ } finally { setLoading(false); }
  }, [user]);

  useEffect(() => {
    if (!authLoading && !user) { router.push('/login'); return; }
    fetchOrders();
  }, [user, authLoading, router, fetchOrders]);

  const openDetail = async (orderId: number) => {
    setDetailLoading(true);
    setDetailOrder(null);
    try {
      const data = await api(`/api/orders/my/${orderId}`);
      setDetailOrder(data);
    } catch { setDetailOrder(null); }
    setDetailLoading(false);
  };

  if (authLoading || loading) return <PageSkeleton />;

  return (
    <div className="max-w-4xl mx-auto p-4">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>طلباتي</h1>
        <Link href="/courses" className="text-sm" style={{ color: primaryColor }}>← تصفح الكورسات</Link>
      </div>

      {orders.length === 0 ? (
        <div className="text-center py-16">
          <div className="text-6xl mb-4">📋</div>
          <h2 className="text-xl font-bold mb-2" style={{ color: 'var(--text)' }}>لا توجد طلبات</h2>
          <p className="mb-6" style={{ color: 'var(--text-muted)' }}>لم تقم بالتسجيل في أي كورس بعد</p>
          <Link href="/courses" className="inline-block px-6 py-3 rounded-xl text-white font-medium" style={{ backgroundColor: primaryColor }}>
            تصفح الكورسات
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map(order => (
            <button key={order.id} onClick={() => openDetail(order.id)} className="w-full text-right">
              <div className="rounded-2xl p-4 shadow-sm border text-right w-full transition-all hover:shadow-md" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-bold" style={{ color: 'var(--text)' }}>{order.title_ar}</h3>
                  <span className={`text-xs px-3 py-1 rounded-full font-medium ${statusColors[order.status] || 'bg-gray-100'}`}>
                    {statusLabels[order.status] || order.status}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-3">
                    <span style={{ color: 'var(--text-muted)' }}>{new Date(order.created_at).toLocaleDateString('ar-EG')}</span>
                    {order.payment_method && <span className="text-xs" style={{ color: 'var(--text-muted)' }}>💳 {order.payment_method}</span>}
                  </div>
                  <span className="font-bold" style={{ color: primaryColor }}>{order.amount} ج.م</span>
                </div>
                {order.notes_student && (
                  <div className="mt-2 pt-2 border-t text-xs" style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
                    📝 {order.notes_student}
                  </div>
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Detail Modal */}
      {detailOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setDetailOrder(null)}>
          <div className="absolute inset-0 bg-black/40" />
          <div className="relative w-full max-w-lg max-h-[80vh] overflow-y-auto rounded-2xl p-6 shadow-xl" style={{ backgroundColor: 'var(--card)' }} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold" style={{ color: 'var(--text)' }}>تفاصيل الطلب</h2>
              <button onClick={() => setDetailOrder(null)} className="p-1 text-lg" style={{ color: 'var(--text-muted)' }}>✕</button>
            </div>

            {detailLoading ? (
              <div className="text-center py-8" style={{ color: 'var(--text-muted)' }}>جاري التحميل...</div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-14 h-14 rounded-xl overflow-hidden">
                    {detailOrder.image_url ? (
                      <img src={detailOrder.image_url} alt={detailOrder.title_ar} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-white font-bold" style={{ backgroundColor: primaryColor }}>
                        {detailOrder.title_ar.charAt(0)}
                      </div>
                    )}
                  </div>
                  <div>
                    <p className="font-bold" style={{ color: 'var(--text)' }}>{detailOrder.title_ar}</p>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{detailOrder.title_en}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="p-3 rounded-xl" style={{ backgroundColor: 'var(--bg)' }}>
                    <p className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>المبلغ</p>
                    <p className="font-bold" style={{ color: primaryColor }}>{detailOrder.amount} ج.م</p>
                  </div>
                  <div className="p-3 rounded-xl" style={{ backgroundColor: 'var(--bg)' }}>
                    <p className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>الحالة</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${statusColors[detailOrder.status] || ''}`}>
                      {statusLabels[detailOrder.status] || detailOrder.status}
                    </span>
                  </div>
                  <div className="p-3 rounded-xl" style={{ backgroundColor: 'var(--bg)' }}>
                    <p className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>طريقة الدفع</p>
                    <p style={{ color: 'var(--text)' }}>{detailOrder.payment_method || 'cash'}</p>
                  </div>
                  <div className="p-3 rounded-xl" style={{ backgroundColor: 'var(--bg)' }}>
                    <p className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>التاريخ</p>
                    <p style={{ color: 'var(--text)' }}>{new Date(detailOrder.created_at).toLocaleDateString('ar-EG')}</p>
                  </div>
                </div>

                {detailOrder.notes_student && (
                  <div className="p-3 rounded-xl" style={{ backgroundColor: 'var(--bg)' }}>
                    <p className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>ملاحظاتك</p>
                    <p className="text-sm" style={{ color: 'var(--text)' }}>{detailOrder.notes_student}</p>
                  </div>
                )}

                {detailOrder.groups && detailOrder.groups.length > 0 && (
                  <div>
                    <h4 className="font-bold text-sm mb-2" style={{ color: 'var(--text)' }}>المجموعات</h4>
                    <div className="space-y-2">
                      {detailOrder.groups.map((g: any) => (
                        <div key={g.id} className="p-3 rounded-xl" style={{ backgroundColor: 'var(--bg)' }}>
                          <p className="font-medium text-sm" style={{ color: 'var(--text)' }}>{g.name}</p>
                          {g.instructor_name && <p className="text-xs" style={{ color: 'var(--text-muted)' }}>🧑‍🏫 {g.instructor_name}</p>}
                          {g.location && <p className="text-xs" style={{ color: 'var(--text-muted)' }}>📍 {g.location}</p>}
                          {g.start_date && (
                            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                              📅 {new Date(g.start_date).toLocaleDateString('ar-EG')} - {g.end_date ? new Date(g.end_date).toLocaleDateString('ar-EG') : 'بدون'}
                            </p>
                          )}
                          {g.zoom_link && (
                            <a href={g.zoom_link} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 underline">رابط Zoom</a>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
