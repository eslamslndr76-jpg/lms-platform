'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { api } from '../../lib/api';
import { compressAndEncode } from '../../lib/imageUtils';
import { useToast } from '../../components/Toast';
import { useBranding } from '../../components/BrandingProvider';
import { useAuth } from '../../lib/auth';

interface CartItem {
  id: number;
  course_id: number;
  title_ar: string;
  price: number;
  image_url?: string;
}

/* ---- Minimalist input with top-aligned label ---- */
function MinimalInput({ label, value, onChange, placeholder, type = 'text', autoComplete, accentColor }: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  autoComplete?: string;
  accentColor?: string;
}) {
  const ac = accentColor || '#000000';
  return (
    <div className="flex flex-col gap-1.5" style={{ marginTop: 0 }}>
      <label className="text-xs uppercase tracking-widest font-medium" style={{ color: '#6B7280' }}>
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        className="w-full text-sm outline-none transition-all duration-200"
        style={{
          backgroundColor: '#F9FAFB',
          border: '1px solid #E5E7EB',
          borderRadius: '12px',
          padding: '12px 16px',
          color: '#111827',
        }}
        onFocus={e => { e.target.style.borderColor = ac; e.target.style.boxShadow = `0 0 0 1px ${ac}`; }}
        onBlur={e => { e.target.style.borderColor = '#E5E7EB'; e.target.style.boxShadow = 'none'; }}
      />
    </div>
  );
}

/* ---- Numbered Progress Badge ---- */
function StepBadge({ num, active, color }: { num: number; active: boolean; color?: string }) {
  const c = color || '#000000';
  return (
    <div
      className="flex items-center justify-center text-xs font-bold shrink-0"
      style={{
        width: '24px',
        height: '24px',
        borderRadius: '50%',
        backgroundColor: active ? c : 'transparent',
        color: active ? '#FFFFFF' : 'var(--text-light)',
        border: active ? 'none' : '1px solid var(--border)',
        transition: 'all 0.3s ease',
      }}
    >
      {num}
    </div>
  );
}

/* ---- Collapsible Order Summary ---- */
function OrderSummary({ items, total, currency, isOpen, onToggle }: {
  items: { title_ar: string; amount: number; image_url?: string }[];
  total: number;
  currency: string;
  isOpen: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="border-t border-b" style={{ borderColor: 'var(--border-light)' }}>
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between py-3 text-sm transition-all duration-200"
        style={{ color: 'var(--text)' }}
      >
        <span className="font-medium">
          ملخص الطلب (<span dir="ltr">{items.length}</span>)
        </span>
        <span
          className="text-xs transition-transform duration-300"
          style={{
            color: 'var(--text-light)',
            transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
            display: 'inline-block',
          }}
        >
          ▼
        </span>
      </button>

      <div
        className="overflow-hidden transition-all duration-300"
        style={{
          maxHeight: isOpen ? '600px' : '0px',
          opacity: isOpen ? 1 : 0,
        }}
      >
        <div className="pb-3 space-y-3">
          {items.map((item, i) => (
            <div key={i} className="flex items-center gap-3">
              <div
                className="flex items-center justify-center shrink-0"
                style={{
                  width: '64px',
                  height: '64px',
                  backgroundColor: 'var(--border-light)',
                  borderRadius: '8px',
                  overflow: 'hidden',
                }}
              >
                {item.image_url ? (
                  <img src={item.image_url} alt={item.title_ar} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-lg">📦</span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate" style={{ color: 'var(--text)' }}>
                  {item.title_ar}
                </p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-light)' }}>
                  {item.amount.toLocaleString()} {currency}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ================================================================
   MAIN CHECKOUT CONTENT
   ================================================================ */
function CheckoutContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { show } = useToast();
  const { primaryColor, sloganAr, sloganEn, systemName } = useBranding();

  const [file, setFile] = useState<File | null>(null);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [noteStudent, setNoteStudent] = useState('');
  const [senderPhone, setSenderPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [cartTotal, setCartTotal] = useState(0);
  const [cartFetching, setCartFetching] = useState(true);
  const [activeStep, setActiveStep] = useState(0);
  const [summaryOpen, setSummaryOpen] = useState(true);
  const [directCourse, setDirectCourse] = useState<any>(null);

  const courseId = searchParams.get('course_id');
  const amount = searchParams.get('amount');
  const isDirect = !!courseId && !!amount;

  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.push('/login'); return; }
    if (!isDirect) {
      api('/api/cart').then(data => {
        setCartItems(data.items || []);
        setCartTotal(data.total || 0);
      }).catch(() => show('فشل تحميل السلة', 'error')).finally(() => setCartFetching(false));
    } else {
      api(`/api/courses/${courseId}`).then(data => {
        setDirectCourse(data);
        setCartTotal(Number(data.price));
      }).catch(() => show('فشل تحميل بيانات الكورس', 'error')).finally(() => setCartFetching(false));
    }
  }, [user, authLoading, router, isDirect, show]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (isDirect) {
        const data: any = { course_id: Number(courseId), amount: Number(amount), payment_method: paymentMethod };
        if (senderPhone.trim()) data.sender_phone = senderPhone.trim();
        if (noteStudent.trim()) data.note_student = noteStudent.trim();
        if (paymentMethod !== 'cash' && !file) { show('يرجى إرفاق إيصال الدفع', 'error'); setLoading(false); return; }
        if (file) data.receipt_url = await compressAndEncode(file);
        await api('/api/orders', { method: 'POST', body: JSON.stringify(data) });
        show('تم تقديم الطلب بنجاح!');
      } else {
        if (cartItems.length === 0) { show('السلة فارغة', 'error'); setLoading(false); return; }
        if (paymentMethod !== 'cash' && !file) { show('يرجى إرفاق إيصال الدفع', 'error'); setLoading(false); return; }
        for (const item of cartItems) {
          const data: any = { course_id: item.course_id, amount: Number(item.price), payment_method: paymentMethod };
          if (senderPhone.trim()) data.sender_phone = senderPhone.trim();
          if (noteStudent.trim()) data.note_student = noteStudent.trim();
          if (file) data.receipt_url = await compressAndEncode(file);
          await api('/api/orders', { method: 'POST', body: JSON.stringify(data) });
        }
        await api('/api/cart', { method: 'DELETE' });
        show('تم تقديم الطلبات بنجاح!');
      }
      router.push('/dashboard');
    } catch (err: any) {
      show(err.message || 'فشل تقديم الطلب', 'error');
    } finally {
      setLoading(false);
    }
  };

  if (authLoading || cartFetching) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]" style={{ backgroundColor: 'var(--bg)' }}>
        <div className="text-center">
          <div className="w-6 h-6 border-2 rounded-full animate-spin mx-auto mb-3" style={{ borderColor: `${primaryColor}33`, borderTopColor: primaryColor }} />
          <p className="text-sm" style={{ color: 'var(--text-light)' }}>جاري التحميل...</p>
        </div>
      </div>
    );
  }

  const displayItems = isDirect && directCourse
    ? [{ title_ar: directCourse.title_ar || directCourse.title_en, amount: Number(amount), image_url: directCourse.image_url }]
    : cartItems.map(i => ({ title_ar: i.title_ar, amount: Number(i.price), image_url: i.image_url }));
  const totalAmount = isDirect ? Number(amount) : cartTotal;
  const totalSteps = 2;
  const currency = 'ج.م';

  /* ---- Step content renderer ---- */
  const renderStep = (step: number) => {
    switch (step) {
      /* ========== STEP 1: Payment Method ========== */
      case 0:
        return (
          <div className="rounded-2xl" style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', padding: '20px 24px' }}>
            <div className="flex items-center gap-3 mb-6">
              <StepBadge num={1} active={activeStep === 0} color={primaryColor} />
              <h2
                className="text-lg font-semibold tracking-tight"
                style={{ color: activeStep === 0 ? 'var(--text)' : 'var(--text-light)', fontWeight: 600, fontSize: '18px' }}
              >
                طريقة الدفع
              </h2>
            </div>

            <div
              className="space-y-5"
              style={{
                opacity: activeStep === 0 ? 1 : 0.4,
                filter: activeStep === 0 ? 'none' : 'grayscale(0.6)',
                pointerEvents: activeStep === 0 ? 'auto' : 'none',
                transition: 'all 0.3s ease',
              }}
            >
              {/* Payment method radios */}
              <div className="space-y-2">
                {[
                  { value: 'wallet', label: 'محفظة إلكترونية (Wallet)' },
                  { value: 'instapay', label: 'إنستاباي (InstaPay)' },
                  { value: 'cash', label: 'كاش — الدفع عند أحد منافذنا' },
                ].map(opt => (
                  <label
                    key={opt.value}
                    className="flex items-center gap-3 px-4 py-3 cursor-pointer transition-all duration-200"
                    style={{
                      backgroundColor: paymentMethod === opt.value ? 'var(--border-light)' : 'var(--surface)',
                      border: paymentMethod === opt.value ? `1px solid ${primaryColor}` : '1px solid var(--border)',
                      borderRadius: '12px',
                    }}
                  >
                    <input
                      type="radio"
                      name="payment_method"
                      value={opt.value}
                      checked={paymentMethod === opt.value}
                      onChange={() => setPaymentMethod(opt.value)}
                      className="appearance-none w-4 h-4 rounded-full border-2 transition-all duration-200 cursor-pointer"
                      style={{
                        borderColor: paymentMethod === opt.value ? primaryColor : 'var(--border)',
                        backgroundColor: paymentMethod === opt.value ? primaryColor : 'transparent',
                        boxShadow: paymentMethod === opt.value ? 'inset 0 0 0 3px var(--bg)' : 'none',
                      }}
                    />
                    <span className="text-sm" style={{ color: 'var(--text)' }}>{opt.label}</span>
                  </label>
                ))}
              </div>

              {/* Sender phone for digital payments */}
              {paymentMethod !== 'cash' && (
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs uppercase tracking-widest font-medium" style={{ color: 'var(--text-muted)' }}>
                    {paymentMethod === 'wallet' ? 'رقم المحفظة / رقم الهاتف المحوِّل' : 'رقم إنستاباي / رقم الهاتف المحوِّل'}
                  </label>
                  <input
                    type="text"
                    value={senderPhone}
                    onChange={e => setSenderPhone(e.target.value)}
                    placeholder="أدخل الرقم الذي ستحول منه"
                    className="w-full text-sm outline-none transition-all duration-200"
                    style={{
                      backgroundColor: 'var(--surface)',
                      border: '1px solid var(--border)',
                      borderRadius: '12px',
                      padding: '12px 16px',
                      color: 'var(--text)',
                    }}
                    onFocus={e => { e.target.style.borderColor = primaryColor; e.target.style.boxShadow = `0 0 0 1px ${primaryColor}`; }}
                    onBlur={e => { e.target.style.borderColor = 'var(--border)'; e.target.style.boxShadow = 'none'; }}
                  />
                </div>
              )}

              {/* Receipt upload — required for digital payments */}
              {paymentMethod !== 'cash' && (
              <div className="flex flex-col gap-1.5">
                <label className="text-xs uppercase tracking-widest font-medium" style={{ color: 'var(--text-muted)' }}>
                  إرفاق إيصال الدفع <span style={{ color: '#dc2626' }}>*</span>
                </label>
                <input
                  id="receipt-upload"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={e => setFile(e.target.files?.[0] || null)}
                />
                <button
                  type="button"
                  onClick={() => document.getElementById('receipt-upload')?.click()}
                  className="flex items-center justify-center gap-2 w-full px-4 py-3 text-sm font-medium transition-all duration-200 hover:opacity-90 active:scale-[0.99]"
                  style={{
                    backgroundColor: file ? 'var(--border-light)' : 'var(--surface)',
                    border: `1px solid ${file ? primaryColor : 'var(--border)'}`,
                    borderRadius: '12px',
                    color: file ? 'var(--text)' : 'var(--text-muted)',
                  }}
                >
                  {file ? (
                    <>
                      <span className="text-base">📎</span>
                      <span className="truncate max-w-[200px]">{file.name}</span>
                      <span
                        className="text-xs mr-auto px-2 py-0.5 rounded-full"
                        style={{ backgroundColor: primaryColor, color: '#FFFFFF' }}
                      >
                        تم الرفع
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="text-base">📤</span>
                      <span>اضغط لاختيار صورة الإيصال</span>
                    </>
                  )}
                </button>
              </div>
              )}

              {/* Notes */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs uppercase tracking-widest font-medium" style={{ color: 'var(--text-muted)' }}>
                  ملاحظات
                </label>
                <textarea
                  value={noteStudent}
                  onChange={e => setNoteStudent(e.target.value)}
                  placeholder="أي ملاحظات تريد إضافتها لطلبك..."
                  rows={3}
                  className="w-full text-sm outline-none transition-all duration-200 resize-none"
                  style={{
                    backgroundColor: 'var(--surface)',
                    border: '1px solid var(--border)',
                    borderRadius: '12px',
                    padding: '12px 16px',
                    color: 'var(--text)',
                  }}
                    onFocus={e => { e.target.style.borderColor = primaryColor; e.target.style.boxShadow = `0 0 0 1px ${primaryColor}`; }}
                    onBlur={e => { e.target.style.borderColor = 'var(--border)'; e.target.style.boxShadow = 'none'; }}
                  />
                </div>

              <div className="flex items-center justify-between pt-2">
                <Link
                  href={isDirect ? `/courses/${courseId}` : '/cart'}
                  className="text-sm transition-all duration-200 hover:opacity-70"
                  style={{ color: 'var(--text-muted)' }}
                >
                  ← رجوع
                </Link>
                <button
                  type="button"
                  onClick={() => setActiveStep(1)}
                  className="flex items-center gap-2 px-6 py-3 text-sm font-medium transition-all duration-200 active:scale-[0.99]"
                  style={{
                    backgroundColor: primaryColor,
                    color: '#FFFFFF',
                    borderRadius: '12px',
                  }}
                >
                  مراجعة →
                </button>
              </div>
            </div>
          </div>
        );

      /* ========== STEP 2: Review & Confirm ========== */
      case 1:
        return (
          <div className="rounded-2xl" style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', padding: '20px 24px' }}>
            <div className="flex items-center gap-3 mb-6">
              <StepBadge num={2} active={activeStep === 1} color={primaryColor} />
              <h2
                className="text-lg font-semibold tracking-tight"
                style={{ color: activeStep === 1 ? 'var(--text)' : 'var(--text-light)', fontWeight: 600, fontSize: '18px' }}
              >
                مراجعة الطلب
              </h2>
            </div>

            <div
              className="space-y-5"
              style={{
                opacity: activeStep === 1 ? 1 : 0.4,
                filter: activeStep === 1 ? 'none' : 'grayscale(0.6)',
                pointerEvents: activeStep === 1 ? 'auto' : 'none',
                transition: 'all 0.3s ease',
              }}
            >
              {/* Order Summary Collapsible */}
              <OrderSummary
                items={displayItems}
                total={totalAmount}
                currency={currency}
                isOpen={summaryOpen}
                onToggle={() => setSummaryOpen(!summaryOpen)}
              />

              {/* Total */}
              <div className="flex items-center justify-between py-3">
                <span className="text-sm font-semibold" style={{ color: 'var(--text)' }}>الإجمالي</span>
                <span className="text-lg font-bold" style={{ color: primaryColor }}>
                  {totalAmount.toLocaleString()} {currency}
                </span>
              </div>

              {/* Disclaimer */}
              <p className="text-xs leading-relaxed" style={{ color: 'var(--text-light)' }}>
                هذه المنصة مقدمة من {systemName || 'نادي ريادة الاعمال'} بالتعاون مع المعهد العالي للعلوم الإدارية بالقطامية (HIMS)
              </p>
              <p className="text-xs" style={{ color: 'var(--text-light)' }}>
                {sloganAr || 'جودة . ثقة . امان'} — <span dir="ltr">{sloganEn || 'Make Your Power'}</span>
              </p>

              {/* CTA Button */}
              <button
                type="submit"
                disabled={loading || (isDirect ? false : cartItems.length === 0)}
                className="w-full py-4 text-base font-medium transition-all duration-200 active:scale-[0.99] disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                style={{
                  backgroundColor: primaryColor,
                  color: '#FFFFFF',
                  borderRadius: '12px',
                }}
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    جاري التقديم...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    تأكيد الطلب
                    <span className="text-lg" style={{ lineHeight: 1 }}>→</span>
                  </span>
                )}
              </button>

              {/* Secured badge */}
              <div className="flex items-center justify-center gap-1.5 text-xs pt-1" style={{ color: 'var(--text-light)' }}>
                <span>🔒</span>
                <span>Secured</span>
              </div>

              {/* Back */}
              <div className="text-center pt-1">
                <button
                  type="button"
                  onClick={() => setActiveStep(0)}
                  className="text-sm transition-all duration-200 hover:opacity-70"
                  style={{ color: 'var(--text-muted)' }}
                >
                  ← تعديل طريقة الدفع
                </button>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  /* ================================================================
     PAGE LAYOUT
     ================================================================ */
  return (
    <form onSubmit={handleSubmit} style={{ backgroundColor: 'var(--bg)', minHeight: '100vh' }}>
      {/* ---------- HEADER ---------- */}
      <div
        className="flex items-center justify-between px-4 py-4"
        style={{
          borderBottom: '1px solid var(--border-light)',
          maxWidth: '520px',
          margin: '0 auto',
        }}
      >
        <div className="flex items-center gap-2">
          <span className="text-xl">📦</span>
          <h1
            className="text-xl font-semibold tracking-tight"
            style={{ color: 'var(--text)', fontWeight: 600, fontSize: '20px', letterSpacing: '-0.025em' }}
          >
            إتمام الشراء
          </h1>
        </div>
        <span
          className="text-xs uppercase tracking-wider font-medium"
          style={{ color: 'var(--text-light)', fontSize: '10px' }}
        >
          الخطوة {activeStep + 1} من {totalSteps}
        </span>
      </div>

      {/* ---------- PROGRESS BADGES ROW ---------- */}
      <div
        className="flex items-center justify-center gap-1 py-5"
        style={{ maxWidth: '520px', margin: '0 auto' }}
      >
        {[0, 1].map(step => (
          <div key={step} className="flex items-center">
            <button
              type="button"
              onClick={() => {
                // Allow navigating only to completed or current step
                if (step <= activeStep) setActiveStep(step);
              }}
              className="transition-all duration-200"
              style={{ cursor: step <= activeStep ? 'pointer' : 'default' }}
            >
              <StepBadge num={step + 1} active={step <= activeStep} color={primaryColor} />
            </button>
            {step < 1 && (
              <div
                className="w-12 sm:w-20 h-px mx-2 transition-all duration-300"
                style={{ backgroundColor: step < activeStep ? primaryColor : 'var(--border)' }}
              />
            )}
          </div>
        ))}
      </div>

      {/* ---------- STEP CONTENT ---------- */}
      <div
        className="px-4 pb-12"
        style={{ maxWidth: '520px', margin: '0 auto' }}
      >
        {renderStep(activeStep)}
      </div>
    </form>
  );
}

/* ---- Wrap in Suspense for useSearchParams ---- */
export default function CheckoutPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-screen" style={{ backgroundColor: 'var(--bg)' }}>
          <div className="w-6 h-6 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
        </div>
      }
    >
      <CheckoutContent />
    </Suspense>
  );
}
