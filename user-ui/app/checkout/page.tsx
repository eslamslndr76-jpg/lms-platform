'use client';

import { useCallback, useEffect, useMemo, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { api } from '../../lib/api';
import { useToast } from '../../components/Toast';
import { useBranding } from '../../components/BrandingProvider';
import { useAuth } from '../../lib/auth';
import PaymentStep from '../../components/PaymentStep';
import { loginUrl } from '../../lib/redirect';

interface CheckoutItem {
  course_id: number;
  title_ar: string;
  title_en?: string;
  price: number;
  image_url?: string;
}

type Phase = 'review' | 'data' | 'payment' | 'done';

const PHASE_LABELS: Record<string, string> = {
  review: 'مراجعة الطلب',
  data: 'بياناتك',
  payment: 'الدفع',
};

/* Only the fields the checkout-requirements endpoint reports as missing. */
const FIELD_META: Record<string, { label: string; placeholder: string; type?: string; ltr?: boolean }> = {
  name: { label: 'الاسم', placeholder: 'اكتب اسمك بالكامل' },
  phone: { label: 'رقم الهاتف', placeholder: '01XXXXXXXXX', type: 'tel', ltr: true },
  national_id: { label: 'الرقم القومي', placeholder: '14 رقماً', ltr: true },
  university_name: { label: 'اسم الجامعة', placeholder: 'اسم جامعتك' },
  university_code: { label: 'الكود الجامعي', placeholder: 'كود الطالب', ltr: true },
};

const PROFILE_KEYS: Record<string, string> = {
  name: 'name',
  phone: 'phone',
  national_id: 'nationalId',
  university_name: 'universityName',
  university_code: 'universityCode',
};

function StepBadge({ num, active, done }: { num: number; active: boolean; done: boolean }) {
  return (
    <div className="flex items-center justify-center text-xs font-bold shrink-0"
      style={{
        width: '26px',
        height: '26px',
        borderRadius: '50%',
        backgroundColor: active || done ? 'var(--md-sys-color-primary)' : 'transparent',
        color: active || done ? 'var(--md-sys-color-on-primary)' : 'var(--md-sys-color-outline)',
        border: active || done ? 'none' : '1px solid var(--md-sys-color-outline-variant)',
        transition: 'all 0.3s ease',
      }}>
      {done ? '✓' : num}
    </div>
  );
}

function CheckoutContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const { show } = useToast();
  const { primaryColor } = useBranding();

  const courseId = Number(searchParams.get('course_id') || 0);
  const isDirect = courseId > 0;

  const [items, setItems] = useState<CheckoutItem[]>([]);
  const [cartTotal, setCartTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [phase, setPhase] = useState<Phase>('review');
  const [missing, setMissing] = useState<string[]>([]);
  const [form, setForm] = useState<Record<string, string>>({});
  const [note, setNote] = useState('');
  const [savingData, setSavingData] = useState(false);
  const [order, setOrder] = useState<{ id: number; amount: number } | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError('');
    try {
      const requirements: any = await api('/api/orders/checkout-requirements')
        .catch(() => ({ missing_fields: [] }));
      setMissing((requirements?.missing_fields || []).map((f: any) => String(f.key)));

      if (isDirect) {
        const course: any = await api(`/api/courses/${courseId}`);
        setItems([{
          course_id: courseId,
          title_ar: course.title_ar,
          title_en: course.title_en,
          price: Number(course.price),
          image_url: course.image_url,
        }]);
        setCartTotal(Number(course.price));
      } else {
        const cart: any = await api('/api/cart');
        setItems((cart.items || []).map((i: any) => ({
          course_id: Number(i.course_id),
          title_ar: i.title_ar,
          title_en: i.title_en,
          price: Number(i.price),
          image_url: i.image_url,
        })));
        setCartTotal(Number(cart.total || 0));
      }
    } catch (e: any) {
      setError(e?.message || 'فشل تحميل بيانات الطلب');
    } finally {
      setLoading(false);
    }
  }, [user, isDirect, courseId]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.push(loginUrl()); return; }
    load();
  }, [user, authLoading, router, load]);

  /* "بياناتك" appears only when something required is actually missing. */
  const steps = useMemo(() => {
    const list: Phase[] = ['review'];
    if (missing.length > 0) list.push('data');
    list.push('payment');
    return list;
  }, [missing.length]);

  const stepIndex = phase === 'done' ? steps.length - 1 : Math.max(0, steps.indexOf(phase));
  const total = order ? order.amount : cartTotal;
  const currency = 'ج.م';

  const goNext = () => {
    const next = steps[stepIndex + 1];
    if (next) setPhase(next);
  };

  const saveData = async () => {
    const body: Record<string, unknown> = {};
    for (const key of missing) {
      const value = String(form[key] || '').trim();
      if (!value) { show(`أدخل ${FIELD_META[key]?.label || key}`, 'error'); return; }
      body[PROFILE_KEYS[key] || key] = value;
    }
    if (body.phone && !/^01\d{9}$/.test(String(body.phone))) {
      show('رقم الهاتف يجب أن يكون 11 رقماً ويبدأ بـ 01', 'error');
      return;
    }
    if (body.nationalId && !/^\d{14}$/.test(String(body.nationalId))) {
      show('الرقم القومي يجب أن يكون 14 رقماً', 'error');
      return;
    }
    setSavingData(true);
    try {
      await api('/api/auth/profile', { method: 'PUT', body: JSON.stringify(body) });
      const requirements: any = await api('/api/orders/checkout-requirements');
      const still: string[] = (requirements?.missing_fields || []).map((f: any) => String(f.key));
      setMissing(still);
      if (still.length > 0) { show('ما زالت هناك بيانات ناقصة', 'error'); return; }
      setPhase('payment');
    } catch (e: any) {
      show(e?.message || 'فشل حفظ البيانات', 'error');
    } finally {
      setSavingData(false);
    }
  };

  const bookingFinished = (status: string, id: number, amount: number) => {
    setOrder({ id, amount });
    setCartTotal(amount);
    // The server removes booked courses from the cart with the booking.
    if (!isDirect) setItems([]);
    window.dispatchEvent(new Event('cart:updated'));
    setPhase('done');
  };

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]" style={{ backgroundColor: 'var(--md-sys-color-surface)' }}>
        <div className="text-center">
          <div className="w-6 h-6 border-2 rounded-full animate-spin mx-auto mb-3" style={{ borderColor: `${primaryColor}33`, borderTopColor: primaryColor }} />
          <p className="text-sm" style={{ color: 'var(--md-sys-color-outline)' }}>جاري التحميل...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 px-4">
        <p className="text-sm text-center" style={{ color: 'var(--md-sys-color-error)' }}>{error}</p>
        <button onClick={load} className="h-11 px-6 rounded-full text-sm font-medium"
          style={{ backgroundColor: primaryColor, color: 'var(--md-sys-color-on-primary)' }}>
          إعادة المحاولة
        </button>
      </div>
    );
  }

  if (items.length === 0 && !order) {
    return (
      <div className="text-center py-20 px-4" style={{ backgroundColor: 'var(--md-sys-color-surface)' }}>
        <span className="material-symbols-outlined text-[64px] block mb-4" style={{ color: 'var(--md-sys-color-outline)' }}>shopping_cart</span>
        <h1 className="text-xl font-bold mb-2" style={{ color: 'var(--md-sys-color-on-surface)' }}>السلة فارغة</h1>
        <p className="mb-6 text-sm" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>أضف كورساً واحداً على الأقل قبل إتمام الشراء</p>
        <Link href="/courses" className="inline-flex items-center gap-2 h-12 px-6 rounded-full text-sm font-medium"
          style={{ backgroundColor: primaryColor, color: 'var(--md-sys-color-on-primary)' }}>
          تصفح الكورسات
        </Link>
      </div>
    );
  }

  return (
    <div style={{ backgroundColor: 'var(--md-sys-color-surface)', minHeight: '100vh' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-4"
        style={{ borderBottom: '1px solid var(--md-sys-color-outline-variant)', maxWidth: '560px', margin: '0 auto' }}>
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-[22px]" style={{ color: primaryColor }}>shopping_bag</span>
          <h1 className="text-lg font-semibold" style={{ color: 'var(--md-sys-color-on-surface)' }}>إتمام الشراء</h1>
        </div>
        <span className="text-xs" style={{ color: 'var(--md-sys-color-outline)' }}>
          الخطوة {stepIndex + 1} من {steps.length}
        </span>
      </div>

      {/* Progress */}
      <div className="flex items-center justify-center gap-1 py-5 flex-wrap" style={{ maxWidth: '560px', margin: '0 auto' }}>
        {steps.map((step, i) => (
          <div key={step} className="flex items-center">
            <button type="button"
              onClick={() => { if (!order && i <= stepIndex) setPhase(step); }}
              className="flex items-center gap-1.5 px-1"
              style={{ cursor: !order && i <= stepIndex ? 'pointer' : 'default' }}>
              <StepBadge num={i + 1} active={i === stepIndex} done={i < stepIndex} />
              <span className="text-[11px] font-medium hidden sm:inline"
                style={{ color: i === stepIndex ? 'var(--md-sys-color-on-surface)' : 'var(--md-sys-color-outline)' }}>
                {PHASE_LABELS[step]}
              </span>
            </button>
            {i < steps.length - 1 && (
              <div className="w-4 sm:w-8 h-px mx-1"
                style={{ backgroundColor: i < stepIndex ? primaryColor : 'var(--md-sys-color-outline-variant)' }} />
            )}
          </div>
        ))}
      </div>

      <div className="px-4 pb-12 space-y-4" style={{ maxWidth: '560px', margin: '0 auto' }}>
        {/* ---------- REVIEW ---------- */}
        {phase === 'review' && (
          <div className="rounded-md3-md p-5 space-y-4"
            style={{ backgroundColor: 'var(--md-sys-color-surface)', border: '1px solid var(--md-sys-color-outline-variant)' }}>
            <h2 className="text-base font-bold" style={{ color: 'var(--md-sys-color-on-surface)' }}>مراجعة الطلب</h2>
            <div className="space-y-2">
              {items.map(item => (
                <div key={item.course_id} className="flex items-center gap-3 p-3 rounded-md3-sm"
                  style={{ backgroundColor: 'var(--md-sys-color-surface-container-low)' }}>
                  <div className="w-12 h-12 rounded-md3-sm overflow-hidden shrink-0 flex items-center justify-center"
                    style={{ backgroundColor: 'var(--md-sys-color-surface-container-high)' }}>
                    {item.image_url
                      ? <img src={item.image_url} alt={item.title_ar} className="w-full h-full object-cover" />
                      : <span className="material-symbols-outlined text-[22px]" style={{ color: 'var(--md-sys-color-outline)' }}>school</span>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: 'var(--md-sys-color-on-surface)' }}>{item.title_ar}</p>
                    <p className="text-xs" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>{item.price.toLocaleString()} {currency}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between pt-3" style={{ borderTop: '1px solid var(--md-sys-color-outline-variant)' }}>
              <span className="text-sm font-semibold" style={{ color: 'var(--md-sys-color-on-surface)' }}>الإجمالي</span>
              <span className="text-lg font-bold" style={{ color: primaryColor }}>{total.toLocaleString()} {currency}</span>
            </div>
            <div className="flex gap-2">
              <Link href={isDirect ? `/courses/${courseId}` : '/cart'}
                className="flex-1 h-12 rounded-full text-sm font-medium flex items-center justify-center border"
                style={{ borderColor: 'var(--md-sys-color-outline-variant)', color: 'var(--md-sys-color-on-surface-variant)' }}>
                رجوع
              </Link>
              <button type="button" onClick={goNext}
                className="flex-1 h-12 rounded-full text-sm font-bold"
                style={{ backgroundColor: primaryColor, color: 'var(--md-sys-color-on-primary)' }}>
                متابعة
              </button>
            </div>
          </div>
        )}

        {/* ---------- MISSING DATA ---------- */}
        {phase === 'data' && (
          <div className="rounded-md3-md p-5 space-y-4"
            style={{ backgroundColor: 'var(--md-sys-color-surface)', border: '1px solid var(--md-sys-color-outline-variant)' }}>
            <div>
              <h2 className="text-base font-bold mb-1" style={{ color: 'var(--md-sys-color-on-surface)' }}>استكمال بياناتك</h2>
              <p className="text-xs leading-relaxed" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>
                نحتاج هذه البيانات فقط لإتمام التسجيل. بياناتك المعروفة لدينا لا نطلبها مرة أخرى.
              </p>
            </div>
            {missing.map(key => {
              const meta = FIELD_META[key] || { label: key, placeholder: '' };
              return (
                <div key={key} className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>{meta.label}</label>
                  <input
                    type={meta.type || 'text'}
                    dir={meta.ltr ? 'ltr' : 'rtl'}
                    value={form[key] || ''}
                    onChange={e => setForm({ ...form, [key]: e.target.value })}
                    placeholder={meta.placeholder}
                    className="w-full text-sm outline-none"
                    style={{
                      backgroundColor: 'var(--md-sys-color-surface-container-low)',
                      border: '1px solid var(--md-sys-color-outline-variant)',
                      borderRadius: 'var(--md-sys-shape-corner-small)',
                      padding: '12px 16px',
                      color: 'var(--md-sys-color-on-surface)',
                    }}
                  />
                </div>
              );
            })}
            <button type="button" onClick={saveData} disabled={savingData}
              className="w-full h-12 rounded-full text-sm font-bold disabled:opacity-50 flex items-center justify-center gap-2"
              style={{ backgroundColor: primaryColor, color: 'var(--md-sys-color-on-primary)' }}>
              {savingData && <span className="w-4 h-4 border-2 rounded-full animate-spin" style={{ borderColor: 'rgba(255,255,255,0.35)', borderTopColor: 'var(--md-sys-color-on-primary)' }} />}
              {savingData ? 'جاري الحفظ...' : 'حفظ ومتابعة'}
            </button>
          </div>
        )}

        {/* ---------- PAYMENT (last step: creates + confirms the booking) ---------- */}
        {phase === 'payment' && (
          <div className="rounded-md3-md p-5 space-y-4"
            style={{ backgroundColor: 'var(--md-sys-color-surface)', border: '1px solid var(--md-sys-color-outline-variant)' }}>
            <div>
              <h2 className="text-base font-bold mb-1" style={{ color: 'var(--md-sys-color-on-surface)' }}>الدفع وتأكيد الحجز</h2>
              <p className="text-xs" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>
                لن يُسجَّل الحجز إلا بعد إتمام هذه الخطوة. تُثبَّت الأسعار عند التأكيد.
              </p>
            </div>
            <div className="p-3 rounded-md3-sm space-y-1" style={{ backgroundColor: 'var(--md-sys-color-surface-container-low)' }}>
              {items.map(item => (
                <div key={item.course_id} className="flex items-center justify-between gap-2 text-sm">
                  <span className="truncate" style={{ color: 'var(--md-sys-color-on-surface)' }}>{item.title_ar}</span>
                  <span style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>{item.price.toLocaleString()} {currency}</span>
                </div>
              ))}
              <div className="flex items-center justify-between pt-2 mt-1 text-sm font-bold"
                style={{ borderTop: '1px solid var(--md-sys-color-outline-variant)', color: 'var(--md-sys-color-on-surface)' }}>
                <span>الإجمالي</span>
                <span style={{ color: primaryColor }}>{total.toLocaleString()} {currency}</span>
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>ملاحظات (اختياري)</label>
              <textarea value={note} onChange={e => setNote(e.target.value)} rows={3}
                placeholder="أي ملاحظات تريد إضافتها لحجزك..."
                className="w-full text-sm outline-none resize-none"
                style={{
                  backgroundColor: 'var(--md-sys-color-surface-container-low)',
                  border: '1px solid var(--md-sys-color-outline-variant)',
                  borderRadius: 'var(--md-sys-shape-corner-small)',
                  padding: '12px 16px',
                  color: 'var(--md-sys-color-on-surface)',
                }} />
            </div>
            <PaymentStep
              amount={total}
              booking={{
                items: items.map(i => ({ course_id: i.course_id })),
                note: note.trim() || undefined,
              }}
              onDone={bookingFinished}
            />
          </div>
        )}

        {/* ---------- DONE ---------- */}
        {phase === 'done' && order && (
          <div className="rounded-md3-md p-6 text-center space-y-4"
            style={{ backgroundColor: 'var(--md-sys-color-surface)', border: '1px solid var(--md-sys-color-outline-variant)' }}>
            <span className="material-symbols-outlined text-[56px] block" style={{ color: primaryColor }}>check_circle</span>
            <h2 className="text-lg font-bold" style={{ color: 'var(--md-sys-color-on-surface)' }}>تم تأكيد حجزك</h2>
            <p className="text-sm" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>
              رقم الحجز <span dir="ltr" className="font-bold">#{order.id}</span> — ستتابع حالته من صفحة طلباتي.
            </p>
            <Link href="/orders" className="block w-full h-12 rounded-full text-sm font-bold flex items-center justify-center"
              style={{ backgroundColor: primaryColor, color: 'var(--md-sys-color-on-primary)' }}>
              طلباتي
            </Link>
            <Link href="/courses" className="block text-sm" style={{ color: primaryColor }}>تصفح كورسات أخرى</Link>
          </div>
        )}
      </div>
    </div>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-screen" style={{ backgroundColor: 'var(--md-sys-color-surface)' }}>
          <div className="w-6 h-6 border-2 rounded-full animate-spin" style={{ borderColor: 'var(--md-sys-color-outline-variant)', borderTopColor: 'var(--md-sys-color-primary)' }} />
        </div>
      }
    >
      <CheckoutContent />
    </Suspense>
  );
}
