'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '../../../lib/api';
import { useAuth } from '../../../lib/auth';
import { useBranding } from '../../../components/BrandingProvider';
import { PageSkeleton } from '../../../components/Skeleton';
import M3BottomSheet from '../../../components/M3BottomSheet';
import ReceiptUpload from '../../../components/ReceiptUpload';
import { loginUrl } from '../../../lib/redirect';

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
  cancel_reason?: string | null;
  items?: Array<{ course_id: number; price: number; title_ar: string; title_en: string }>;
  receipt?: { file_url: string; payment_method?: string; created_at?: string; verified_at?: string } | null;
}

interface OrderDetail extends Order {
  image_url?: string;
  groups: Array<{ id: number; name: string; instructor_name: string; location: string; start_date: string; end_date: string; is_complete: number; zoom_link: string; }>;
}

const statusStyles: Record<string, { bg: string; fg: string }> = {
  pending: { bg: '#fef3c7', fg: '#92400e' },
  review: { bg: '#dbeafe', fg: '#1e40af' },
  paid: { bg: '#dcfce7', fg: '#166534' },
  cancelled: { bg: '#fee2e2', fg: '#991b1b' },
};
const statusLabels: Record<string, string> = { pending: 'حجز', review: 'قيد المراجعة', paid: 'مدفوع', cancelled: 'ملغي' };

/* Items + receipt shared by the mobile sheet and the desktop dialog. */
function OrderExtra({ order, onRemoveItem, busy }: { order: OrderDetail; onRemoveItem?: (courseId: number) => void; busy?: boolean }) {
  const receipt = order.receipt?.file_url;
  const canEditItems = onRemoveItem && (order.status === 'pending' || order.status === 'review');
  return (
    <>
      {order.items && order.items.length > 0 && (
        <div>
          <h4 className="font-bold text-sm mb-2" style={{ color: 'var(--md-sys-color-on-surface)' }}>كورسات الطلب</h4>
          <div className="space-y-1">
            {order.items.map(item => (
              <div key={item.course_id} className="flex items-center justify-between gap-2 p-3 rounded-md3-md text-sm" style={{ backgroundColor: 'var(--md-sys-color-surface-container-low)' }}>
                <span style={{ color: 'var(--md-sys-color-on-surface)' }}>{item.title_ar}</span>
                <span className="flex items-center gap-2">
                  <span style={{ color: 'var(--md-sys-color-primary)' }}>{item.price} ج.م</span>
                  {canEditItems && (
                    <button type="button" disabled={busy} onClick={() => onRemoveItem(item.course_id)}
                      title="حذف الكورس من الطلب" className="w-8 h-8 rounded-full flex items-center justify-center"
                      style={{ color: 'var(--md-sys-color-error)' }}>
                      <span className="material-symbols-outlined text-[18px]">delete</span>
                    </button>
                  )}
                </span>
              </div>
            ))}
          </div>
          {canEditItems && (
            <p className="text-xs mt-1" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>
              حذف آخر كورس في الطلب يلغي الحجز بالكامل
            </p>
          )}
        </div>
      )}
      {receipt && (
        <div className="p-3 rounded-md3-md" style={{ backgroundColor: 'var(--md-sys-color-surface-container-low)' }}>
          <p className="text-xs mb-2" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>إيصال الدفع</p>
          <a href={receipt} target="_blank" rel="noreferrer">
            <img src={receipt} alt="إيصال الدفع" className="w-full max-h-56 object-contain rounded-md3-sm" />
          </a>
          <p className="text-xs mt-2" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>
            {order.receipt?.verified_at ? 'تم التحقق من الإيصال ✅' : 'الإيصال بانتظار مراجعة الإدارة'}
          </p>
        </div>
      )}
    </>
  );
}

export default function OrdersPage() {
  const { user, loading: authLoading } = useAuth();
  const { primaryColor } = useBranding();
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [detailOrder, setDetailOrder] = useState<OrderDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [receiptOrder, setReceiptOrder] = useState<OrderDetail | null>(null);
  const [busyOrderId, setBusyOrderId] = useState<number | null>(null);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 1024);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  const fetchOrders = useCallback(async () => {
    if (!user) return;
    try { setOrders((await api('/api/orders/my')) || []); } catch { /* ignore */ } finally { setLoading(false); }
  }, [user]);

  useEffect(() => {
    if (!authLoading && !user) { router.push(loginUrl()); return; }
    fetchOrders();
  }, [user, authLoading, router, fetchOrders]);

  const openDetail = async (orderId: number) => {
    setDetailLoading(true); setDetailOrder(null);
    try { setDetailOrder(await api(`/api/orders/my/${orderId}`)); } catch { setDetailOrder(null); }
    setDetailLoading(false);
  };

  const openReceipt = async (orderId: number) => {
    try { setReceiptOrder(await api(`/api/orders/my/${orderId}`)); }
    catch { /* keep the list usable; the toast layer reports real failures */ }
  };

  /* After uploading a receipt the order is "review" until an admin approves it. */
  const afterReceipt = async () => {
    const id = receiptOrder?.id;
    setReceiptOrder(null);
    await fetchOrders();
    if (id && detailOrder?.id === id) await openDetail(id);
  };

  /* Student cancels an unpaid booking (pending or review only). */
  const cancelOrder = async (orderId: number) => {
    if (!window.confirm('هل تريد إلغاء هذا الحجز؟ يمكنك الحجز من جديد في أي وقت.')) return;
    setBusyOrderId(orderId);
    try {
      await api(`/api/orders/${orderId}/cancel`, { method: 'PATCH' });
      await fetchOrders();
      if (detailOrder?.id === orderId) setDetailOrder(null);
    } catch (e: any) {
      window.alert(e?.message || 'فشل إلغاء الحجز');
    } finally {
      setBusyOrderId(null);
    }
  };

  /* Remove one course from an unpaid booking; the server recomputes the total. */
  const removeItem = async (orderId: number, courseId: number) => {
    if (!window.confirm('حذف هذا الكورس من الطلب؟ سيُعاد حساب الإجمالي.')) return;
    setBusyOrderId(orderId);
    try {
      const res: any = await api(`/api/orders/${orderId}/items/${courseId}`, { method: 'DELETE' });
      await fetchOrders();
      if (detailOrder?.id === orderId) {
        if (res?.status === 'cancelled') setDetailOrder(null);
        else await openDetail(orderId);
      }
    } catch (e: any) {
      window.alert(e?.message || 'فشل حذف الكورس من الطلب');
    } finally {
      setBusyOrderId(null);
    }
  };

  if (authLoading || loading) return <PageSkeleton />;

  return (
    <div className="max-w-4xl mx-auto p-4">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2" style={{ color: 'var(--md-sys-color-on-surface)' }}>
          <span className="material-symbols-outlined" style={{ color: 'var(--md-sys-color-primary)' }}>receipt_long</span> طلباتي
        </h1>
        <Link href="/courses" className="text-sm flex items-center gap-1" style={{ color: 'var(--md-sys-color-primary)' }}>
          <span className="material-symbols-outlined text-[16px]">arrow_forward</span> تصفح الكورسات
        </Link>
      </div>

      {orders.length === 0 ? (
        <div className="text-center py-16">
          <span className="material-symbols-outlined text-[64px] block mb-4" style={{ color: 'var(--md-sys-color-outline)' }}>receipt_long</span>
          <h2 className="text-xl font-bold mb-2" style={{ color: 'var(--md-sys-color-on-surface)' }}>لا توجد طلبات</h2>
          <p className="mb-6" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>لم تقم بالتسجيل في أي كورس بعد</p>
          <Link href="/courses" className="inline-flex items-center gap-2 h-12 px-6 rounded-full text-sm font-medium"
            style={{ backgroundColor: 'var(--md-sys-color-primary)', color: 'var(--md-sys-color-on-primary)' }}>
            <span className="material-symbols-outlined text-[18px]">search</span> تصفح الكورسات
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map(order => {
            const st = statusStyles[order.status] || { bg: '#f3f4f6', fg: '#374151' };
            return (
              <div key={order.id} className="space-y-2">
              <button onClick={() => openDetail(order.id)} className="w-full text-right">
                <div className="rounded-md3-md p-4 w-full transition-all hover:shadow-md" style={{ backgroundColor: 'var(--md-sys-color-surface-container)' }}>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-bold" style={{ color: 'var(--md-sys-color-on-surface)' }}>{order.title_ar}</h3>
                    <span className="text-xs px-3 py-1 rounded-full font-medium" style={{ backgroundColor: st.bg, color: st.fg }}>{statusLabels[order.status] || order.status}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-3">
                      <span className="text-xs flex items-center gap-1" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>
                        <span className="material-symbols-outlined text-[14px]">calendar_today</span>
                        {new Date(order.created_at).toLocaleDateString('ar-EG')}
                      </span>
                      {order.payment_method && (
                        <span className="text-xs flex items-center gap-1" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>
                          <span className="material-symbols-outlined text-[14px]">payment</span> {order.payment_method}
                        </span>
                      )}
                    </div>
                    <span className="font-bold" style={{ color: 'var(--md-sys-color-primary)' }}>{order.amount} ج.م</span>
                  </div>
                  {order.notes_student && (
                    <div className="mt-2 pt-2 text-xs flex items-center gap-1" style={{ borderTop: '1px solid var(--md-sys-color-outline-variant)', color: 'var(--md-sys-color-on-surface-variant)' }}>
                      <span className="material-symbols-outlined text-[14px]">sticky_note_2</span> {order.notes_student}
                    </div>
                  )}
                  {order.items && order.items.length > 1 && (
                    <div className="mt-2 pt-2 text-xs" style={{ borderTop: '1px solid var(--md-sys-color-outline-variant)', color: 'var(--md-sys-color-on-surface-variant)' }}>
                      {order.items.length} كورسات في هذا الطلب
                    </div>
                  )}
                  {order.status === 'cancelled' && order.cancel_reason === 'expired' && (
                    <div className="mt-2 pt-2 text-xs flex items-center gap-1" style={{ borderTop: '1px solid var(--md-sys-color-outline-variant)', color: 'var(--md-sys-color-error)' }}>
                      <span className="material-symbols-outlined text-[14px]">schedule</span>
                      انتهت مدة الحجز لعدم إتمام الدفع — يمكنك الحجز من جديد
                    </div>
                  )}
                </div>
              </button>
              {order.status === 'pending' && (
                <button onClick={() => openReceipt(order.id)}
                  className="w-full h-11 rounded-full text-sm font-bold"
                  style={{ backgroundColor: 'var(--md-sys-color-primary)', color: 'var(--md-sys-color-on-primary)' }}>
                  رفع إيصال الدفع
                </button>
              )}
              {order.status === 'review' && (
                <button onClick={() => openReceipt(order.id)}
                  className="w-full h-11 rounded-full text-sm font-bold border"
                  style={{ borderColor: 'var(--md-sys-color-primary)', color: 'var(--md-sys-color-primary)' }}>
                  تحديث صورة الإيصال
                </button>
              )}
              {(order.status === 'pending' || order.status === 'review') && (
                <button onClick={() => cancelOrder(order.id)} disabled={busyOrderId === order.id}
                  className="w-full h-9 rounded-full text-xs font-medium"
                  style={{ color: 'var(--md-sys-color-error)' }}>
                  {busyOrderId === order.id ? 'جارٍ الإلغاء...' : 'إلغاء الحجز'}
                </button>
              )}
              </div>
            );
          })}
        </div>
      )}

      {detailOrder && (
        isMobile ? (
          <M3BottomSheet open={!!detailOrder} onClose={() => setDetailOrder(null)} title="تفاصيل الطلب" maxHeightVh={75}>
            {detailLoading ? (
              <div className="text-center py-8" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}><div className="w-full h-1 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--md-sys-color-surface-container-high)' }}><div className="h-full rounded-full animate-pulse" style={{ width: '40%', backgroundColor: 'var(--md-sys-color-primary)' }} /></div></div>
            ) : (
              <div className="px-5 pb-6 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-14 h-14 rounded-md3-md overflow-hidden flex-shrink-0">
                    {detailOrder.image_url ? (
                      <img src={detailOrder.image_url} alt={detailOrder.title_ar} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-white font-bold" style={{ backgroundColor: 'var(--md-sys-color-primary)' }}>{detailOrder.title_ar.charAt(0)}</div>
                    )}
                  </div>
                  <div>
                    <p className="font-bold" style={{ color: 'var(--md-sys-color-on-surface)' }}>{detailOrder.title_ar}</p>
                    <p className="text-xs" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>{detailOrder.title_en}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  {[
                    { label: 'المبلغ', value: <span style={{ color: 'var(--md-sys-color-primary)' }}>{detailOrder.amount} ج.م</span> },
                    { label: 'الحالة', value: <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: statusStyles[detailOrder.status]?.bg || '#f3f4f6', color: statusStyles[detailOrder.status]?.fg || '#374151' }}>{statusLabels[detailOrder.status]}</span> },
                    { label: 'طريقة الدفع', value: <span style={{ color: 'var(--md-sys-color-on-surface)' }}>{detailOrder.payment_method || 'cash'}</span> },
                    { label: 'التاريخ', value: <span style={{ color: 'var(--md-sys-color-on-surface)' }}>{new Date(detailOrder.created_at).toLocaleDateString('ar-EG')}</span> },
                  ].map((item, i) => (
                    <div key={i} className="p-3 rounded-md3-md" style={{ backgroundColor: 'var(--md-sys-color-surface-container-low)' }}>
                      <p className="text-xs mb-1" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>{item.label}</p>
                      {item.value}
                    </div>
                  ))}
                </div>
                {detailOrder.notes_student && (
                  <div className="p-3 rounded-md3-md" style={{ backgroundColor: 'var(--md-sys-color-surface-container-low)' }}>
                    <p className="text-xs mb-1" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>ملاحظاتك</p>
                    <p className="text-sm" style={{ color: 'var(--md-sys-color-on-surface)' }}>{detailOrder.notes_student}</p>
                  </div>
                )}
                <OrderExtra order={detailOrder} busy={busyOrderId === detailOrder.id}
                  onRemoveItem={detailOrder.status === 'pending' || detailOrder.status === 'review'
                    ? (courseId) => removeItem(detailOrder.id, courseId) : undefined} />
                {detailOrder.groups && detailOrder.groups.length > 0 && (
                  <div>
                    <h4 className="font-bold text-sm mb-2" style={{ color: 'var(--md-sys-color-on-surface)' }}>المجموعات</h4>
                    <div className="space-y-2">
                      {detailOrder.groups.map((g: any) => (
                        <div key={g.id} className="p-3 rounded-md3-md" style={{ backgroundColor: 'var(--md-sys-color-surface-container-low)' }}>
                          <p className="font-medium text-sm" style={{ color: 'var(--md-sys-color-on-surface)' }}>{g.name}</p>
                          {g.instructor_name && <p className="text-xs flex items-center gap-1" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}><span className="material-symbols-outlined text-[12px]">person</span> {g.instructor_name}</p>}
                          {g.location && <p className="text-xs flex items-center gap-1" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}><span className="material-symbols-outlined text-[12px]">location_on</span> {g.location}</p>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </M3BottomSheet>
        ) : (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setDetailOrder(null)}>
            <div className="absolute inset-0" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }} />
            <div className="relative w-full max-w-lg max-h-[80vh] overflow-y-auto rounded-md3-md p-6 shadow-xl" style={{ backgroundColor: 'var(--md-sys-color-surface-container)' }} onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold" style={{ color: 'var(--md-sys-color-on-surface)' }}>تفاصيل الطلب</h2>
                <button onClick={() => setDetailOrder(null)} className="w-10 h-10 rounded-full flex items-center justify-center" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>
              {detailLoading ? (
                <div className="text-center py-8" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}><div className="w-full h-1 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--md-sys-color-surface-container-high)' }}><div className="h-full rounded-full animate-pulse" style={{ width: '40%', backgroundColor: 'var(--md-sys-color-primary)' }} /></div></div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-14 h-14 rounded-md3-md overflow-hidden flex-shrink-0">
                      {detailOrder.image_url ? (
                        <img src={detailOrder.image_url} alt={detailOrder.title_ar} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-white font-bold" style={{ backgroundColor: 'var(--md-sys-color-primary)' }}>{detailOrder.title_ar.charAt(0)}</div>
                      )}
                    </div>
                    <div>
                      <p className="font-bold" style={{ color: 'var(--md-sys-color-on-surface)' }}>{detailOrder.title_ar}</p>
                      <p className="text-xs" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>{detailOrder.title_en}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    {[
                      { label: 'المبلغ', value: <span style={{ color: 'var(--md-sys-color-primary)' }}>{detailOrder.amount} ج.م</span> },
                      { label: 'الحالة', value: <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: statusStyles[detailOrder.status]?.bg || '#f3f4f6', color: statusStyles[detailOrder.status]?.fg || '#374151' }}>{statusLabels[detailOrder.status]}</span> },
                      { label: 'طريقة الدفع', value: <span style={{ color: 'var(--md-sys-color-on-surface)' }}>{detailOrder.payment_method || 'cash'}</span> },
                      { label: 'التاريخ', value: <span style={{ color: 'var(--md-sys-color-on-surface)' }}>{new Date(detailOrder.created_at).toLocaleDateString('ar-EG')}</span> },
                    ].map((item, i) => (
                      <div key={i} className="p-3 rounded-md3-md" style={{ backgroundColor: 'var(--md-sys-color-surface-container-low)' }}>
                        <p className="text-xs mb-1" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>{item.label}</p>
                        {item.value}
                      </div>
                    ))}
                  </div>
                  {detailOrder.notes_student && (
                    <div className="p-3 rounded-md3-md" style={{ backgroundColor: 'var(--md-sys-color-surface-container-low)' }}>
                      <p className="text-xs mb-1" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>ملاحظاتك</p>
                      <p className="text-sm" style={{ color: 'var(--md-sys-color-on-surface)' }}>{detailOrder.notes_student}</p>
                    </div>
                  )}
                  <OrderExtra order={detailOrder} busy={busyOrderId === detailOrder.id}
                    onRemoveItem={detailOrder.status === 'pending' || detailOrder.status === 'review'
                      ? (courseId) => removeItem(detailOrder.id, courseId) : undefined} />
                  {detailOrder.groups && detailOrder.groups.length > 0 && (
                    <div>
                      <h4 className="font-bold text-sm mb-2" style={{ color: 'var(--md-sys-color-on-surface)' }}>المجموعات</h4>
                      <div className="space-y-2">
                        {detailOrder.groups.map((g: any) => (
                          <div key={g.id} className="p-3 rounded-md3-md" style={{ backgroundColor: 'var(--md-sys-color-surface-container-low)' }}>
                            <p className="font-medium text-sm" style={{ color: 'var(--md-sys-color-on-surface)' }}>{g.name}</p>
                            {g.instructor_name && <p className="text-xs flex items-center gap-1" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}><span className="material-symbols-outlined text-[12px]">person</span> {g.instructor_name}</p>}
                            {g.location && <p className="text-xs flex items-center gap-1" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}><span className="material-symbols-outlined text-[12px]">location_on</span> {g.location}</p>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )
      )}

      {receiptOrder && (
        isMobile ? (
          <M3BottomSheet open={!!receiptOrder} onClose={() => setReceiptOrder(null)} title="رفع إيصال الدفع" maxHeightVh={85}>
            <div className="px-5 pb-6">
              <ReceiptUpload orderId={receiptOrder.id} onDone={afterReceipt} />
            </div>
          </M3BottomSheet>
        ) : (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setReceiptOrder(null)}>
            <div className="absolute inset-0" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }} />
            <div className="relative w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-md3-md p-6 shadow-xl"
              style={{ backgroundColor: 'var(--md-sys-color-surface-container)' }} onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold" style={{ color: 'var(--md-sys-color-on-surface)' }}>رفع إيصال الدفع</h2>
                <button onClick={() => setReceiptOrder(null)} className="w-10 h-10 rounded-full flex items-center justify-center"
                  style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>
              <ReceiptUpload orderId={receiptOrder.id} onDone={afterReceipt} />
            </div>
          </div>
        )
      )}
    </div>
  );
}
