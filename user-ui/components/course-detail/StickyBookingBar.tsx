'use client';

import { useState, useEffect, useRef } from 'react';
import { useBranding } from '../BrandingProvider';
import { useToast } from '../Toast';

interface StickyBookingBarProps {
  course: {
    id: number;
    title_ar: string;
    price: number;
    original_price?: number;
    enable_direct_purchase?: number;
    group_max?: number;
    group_current?: number;
  };
  onAddToCart: () => Promise<void>;
  onBuyNow: () => void;
  isAddingToCart?: boolean;
  showRePurchaseWarning?: boolean;
  onConfirmRePurchase?: () => void;
  onCancelRePurchase?: () => void;
  hasCertificate?: boolean;
}

export function StickyBookingBar({
  course,
  onAddToCart,
  onBuyNow,
  isAddingToCart,
  showRePurchaseWarning,
  onConfirmRePurchase,
  onCancelRePurchase,
  hasCertificate,
}: StickyBookingBarProps) {
  const { primaryColor } = useBranding();
  const { show } = useToast();
  const [isSticky, setIsSticky] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const barRef = useRef<HTMLDivElement>(null);
  const placeholderRef = useRef<HTMLDivElement>(null);

  const allowDirectPurchase = course.enable_direct_purchase !== 0;
  const hasGroup = course.group_max && course.group_max > 0;
  const groupCurrent = course.group_current || 0;
  const groupMax = course.group_max || 0;
  const pct = hasGroup ? Math.min(Math.round((groupCurrent / groupMax) * 100), 100) : 0;
  const isFull = hasGroup && pct >= 100;
  const isAlmostFull = hasGroup && pct >= 80 && pct < 100;
  const remaining = groupMax - groupCurrent;

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 1024);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    if (isMobile) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsSticky(!entry.isIntersecting);
      },
      { threshold: 0, rootMargin: '-96px 0px 0px 0px' }
    );

    if (placeholderRef.current) {
      observer.observe(placeholderRef.current);
    }
    return () => observer.disconnect();
  }, [isMobile]);

  if (showRePurchaseWarning) {
    return (
      <div
        className="fixed inset-0 z-[var(--z-modal-backdrop)] flex items-center justify-center p-4 animate-fade-in"
        role="dialog"
        aria-modal="true"
        aria-labelledby="repurchase-title"
      >
        <div
          className="absolute inset-0"
          style={{ backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}
          onClick={onCancelRePurchase}
        />
        <div
          className="relative z-10 w-full max-w-md p-6 animate-bounce-in"
          style={{
            backgroundColor: 'var(--md-sys-color-surface-container-high)',
            borderRadius: '28px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.24)',
          }}
        >
          <div className="flex items-center justify-center mb-4">
            <span
              className="material-symbols-outlined"
              style={{ fontSize: '48px', color: 'var(--md-sys-color-primary)' }}
            >
              shopping_cart
            </span>
          </div>
          <h3 id="repurchase-title" className="text-xl font-bold text-center mb-3" style={{ color: 'var(--md-sys-color-on-surface)' }}>
            هل أنت متأكد؟
          </h3>
          <p className="text-center mb-6 leading-relaxed" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>
            {hasCertificate
              ? 'لقد سبق لك شراء هذا الكورس وتم إصدار شهادة لك به. يمكنك شراؤه مرة أخرى إذا كنت ترغب في مراجعة المحتوى.'
              : 'يبدو أن لديك طلب سابق لهذا الكورس. يمكنك شراؤه مرة أخرى إذا كنت ترغب.'}
          </p>
          <div className="flex gap-3">
            <button
              onClick={onCancelRePurchase}
              className="flex-1 py-3 rounded-full font-bold text-sm transition-all"
              style={{
                border: '2px solid var(--md-sys-color-outline)',
                color: 'var(--md-sys-color-on-surface)',
                backgroundColor: 'transparent',
              }}
            >
              إلغاء
            </button>
            <button
              onClick={onConfirmRePurchase}
              className="flex-1 py-3 rounded-full text-white font-bold text-sm transition-all"
              style={{
                backgroundColor: 'var(--md-sys-color-primary)',
                color: 'var(--md-sys-color-on-primary)',
              }}
            >
              تأكيد الشراء
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div ref={placeholderRef} className={isMobile ? 'hidden' : 'h-24'} aria-hidden="true" />

      {isMobile && (
        <div
          className="fixed bottom-0 left-0 right-0 z-[var(--z-sticky)] animate-slide-up-reveal safe-bottom"
          role="region"
          aria-label="شريط الحجز السريع"
        >
          <div className="max-w-4xl mx-auto px-4 pb-4">
            <div
              className="p-4"
              style={{
                backgroundColor: 'var(--md-sys-color-surface-container)',
                borderRadius: '16px',
                boxShadow: '0 -2px 12px rgba(0,0,0,0.15)',
              }}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>
                    سعر الكورس
                  </p>
                  <p className="text-2xl font-extrabold" style={{ color: 'var(--md-sys-color-primary)' }}>
                    {course.price > 0 ? `${course.price.toLocaleString()} ج.م` : 'مجاني'}
                  </p>
                </div>
                <div className="flex gap-2 flex-nowrap">
                  <button
                    onClick={onAddToCart}
                    disabled={isAddingToCart}
                    className="flex-1 min-w-[100px] py-3 px-4 rounded-full font-bold text-sm transition-all"
                    style={{
                      backgroundColor: 'var(--md-sys-color-secondary-container)',
                      color: 'var(--md-sys-color-on-secondary-container)',
                    }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '18px', verticalAlign: 'middle', marginLeft: '4px' }}>add_shopping_cart</span>
                    {isAddingToCart ? 'جاري...' : 'السلة'}
                  </button>
                  {allowDirectPurchase && (
                    <button
                      onClick={onBuyNow}
                      className="flex-1 min-w-[100px] py-3 px-4 rounded-full font-bold text-sm transition-all"
                      style={{
                        backgroundColor: 'var(--md-sys-color-primary)',
                        color: 'var(--md-sys-color-on-primary)',
                      }}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: '18px', verticalAlign: 'middle', marginLeft: '4px' }}>credit_card</span>
                      اشترِ الآن
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {!isMobile && (
        <div
          className={`transition-all duration-500 ease-expo ${
            isSticky ? 'fixed top-24 right-4 z-[var(--z-sticky)]' : 'sticky top-24'
          }`}
          style={{ maxWidth: '380px', width: '100%' }}
          role="region"
          aria-label="ملخص الحجز"
        >
          <div
            ref={barRef}
            className="p-6 animate-slide-in-right"
            style={{
              backgroundColor: 'var(--md-sys-color-surface-container)',
              borderRadius: '24px',
              boxShadow: '0 4px 24px rgba(0,0,0,0.12)',
            }}
          >
            <h3 className="text-sm font-bold mb-1 truncate" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>
              {course.title_ar}
            </h3>

            <div className="mb-6">
              <p className="text-xs font-medium mb-2" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>
                سعر الكورس
              </p>

              <div className="flex items-baseline gap-3 mb-2">
                <span className="text-4xl font-extrabold" style={{ color: 'var(--md-sys-color-primary)' }}>
                  {course.price > 0 ? `${course.price.toLocaleString()} ج.م` : 'مجاني'}
                </span>

                {course.original_price && course.original_price > course.price && (
                  <span className="text-lg line-through" style={{ color: 'var(--md-sys-color-outline)' }}>
                    {course.original_price.toLocaleString()} ج.م
                  </span>
                )}

                {course.price > 0 && (
                  <span
                    className="px-3 py-1 text-xs font-bold rounded-full ml-auto"
                    style={{ backgroundColor: 'var(--md-sys-color-primary-container)', color: 'var(--md-sys-color-on-primary-container)' }}
                  >
                    شامل الشهادة المعتمدة
                  </span>
                )}
              </div>

              <div
                className="flex items-center gap-2 p-3 rounded-md3-sm"
                style={{ backgroundColor: 'rgba(22,163,74,0.08)', border: '1px solid rgba(22,163,74,0.15)' }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '20px', color: '#16a34a' }}>verified</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium" style={{ color: '#16a34a' }}>ضمان أفضل سعر</p>
                  <p className="text-[11px]" style={{ color: '#16a34a' }}>لو لقيت سعر أقل، نرد الفرق</p>
                </div>
              </div>
            </div>

            {hasGroup && (
              <div
                className={`mb-6 p-4 relative overflow-hidden ${isAlmostFull && !isFull ? 'animate-pulse-soft' : ''}`}
                style={{
                  backgroundColor: isFull ? 'rgba(220,38,38,0.08)' : isAlmostFull ? 'rgba(217,119,6,0.08)' : 'rgba(22,163,74,0.08)',
                  border: `1px solid ${isFull ? 'rgba(220,38,38,0.2)' : isAlmostFull ? 'rgba(217,119,6,0.2)' : 'rgba(22,163,74,0.2)'}`,
                  borderRadius: '16px',
                }}
              >
                <div className="mb-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-bold" style={{ color: 'var(--md-sys-color-on-surface)' }}>
                      المجموعة الحالية
                    </span>
                    <span className="text-xs font-bold" style={{
                      color: isFull ? '#dc2626' : isAlmostFull ? '#d97706' : '#16a34a',
                    }}>
                      {groupCurrent} / {groupMax} طالب
                    </span>
                  </div>

                  <div className="relative h-3 rounded-full overflow-hidden" style={{ backgroundColor: 'rgba(0,0,0,0.05)' }}>
                    <div
                      className="h-full rounded-full transition-all duration-1000 ease-expo relative"
                      style={{
                        width: `${Math.min(pct, 100)}%`,
                        background: isFull
                          ? 'linear-gradient(90deg, #dc2626, #ef4444)'
                          : isAlmostFull
                          ? 'linear-gradient(90deg, #d97706, #f59e0b)'
                          : 'linear-gradient(90deg, #16a34a, #22c55e)',
                      }}
                    >
                      <div className="absolute inset-0 animate-shimmer rounded-full" style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent)' }} />
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-center gap-2">
                  <span className="material-symbols-outlined" style={{
                    fontSize: '18px',
                    color: isFull ? '#dc2626' : isAlmostFull ? '#d97706' : '#16a34a',
                  }}>
                    {isFull ? 'emoji_events' : isAlmostFull ? 'bolt' : 'check_circle'}
                  </span>
                  <p className="text-xs text-center font-medium" style={{
                    color: isFull ? '#dc2626' : isAlmostFull ? '#d97706' : '#16a34a',
                  }}>
                    {isFull
                      ? 'المجموعة الحالية اكتملت — احجز الآن لتكون أول شخص في المجموعة الجديدة'
                      : isAlmostFull
                      ? `لم يتبق سوى ${remaining} مقاعد! احجز الآن قبل نفادها`
                      : `مازال متسع — ${remaining} مقعد متاح`}
                  </p>
                </div>

                <div className="flex justify-between mt-4 pt-4" style={{ borderTop: '1px solid rgba(0,0,0,0.05)' }}>
                  {[25, 50, 75, 100].map((milestone) => (
                    <div key={milestone} className="text-center flex-1">
                      <div className="w-2 h-2 rounded-full mx-auto mb-1 transition-all duration-500" style={{
                        backgroundColor: pct >= milestone ? (isFull ? '#dc2626' : '#16a34a') : 'var(--md-sys-color-outline-variant)',
                        transform: pct >= milestone ? 'scale(1.3)' : 'scale(1)',
                      }} />
                      <span className="text-[10px] font-bold" style={{
                        color: pct >= milestone ? (isFull ? '#dc2626' : '#16a34a') : 'var(--md-sys-color-outline)',
                      }}>
                        {milestone}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-3 gap-3 mb-6">
              {[
                { icon: 'lock', label: 'دفع آمن', color: primaryColor },
                { icon: 'workspace_premium', label: 'شهادة معتمدة', color: '#f59e0b' },
                { icon: 'replay', label: 'ضمان 14 يوم', color: '#16a34a' },
              ].map((badge, i) => (
                <div
                  key={i}
                  className="flex flex-col items-center gap-1.5 p-3 rounded-md3-sm transition-all hover:scale-[1.02]"
                  style={{ backgroundColor: 'var(--md-sys-color-surface-container-low)' }}
                >
                  <div
                    className="w-10 h-10 rounded-md3-sm flex items-center justify-center"
                    style={{ backgroundColor: `${badge.color}15` }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '20px', color: badge.color }}>
                      {badge.icon}
                    </span>
                  </div>
                  <span className="text-xs font-bold text-center" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>
                    {badge.label}
                  </span>
                </div>
              ))}
            </div>

            <div className="space-y-3">
              <button
                onClick={onAddToCart}
                disabled={isAddingToCart}
                className="w-full py-3 rounded-full font-bold text-sm transition-all"
                style={{
                  backgroundColor: 'var(--md-sys-color-secondary-container)',
                  color: 'var(--md-sys-color-on-secondary-container)',
                }}
              >
                {isAddingToCart ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    جاري الإضافة للسلة...
                  </span>
                ) : (
                  <span>
                    <span className="material-symbols-outlined" style={{ fontSize: '18px', verticalAlign: 'middle', marginLeft: '4px' }}>add_shopping_cart</span>
                    أضف للسلة
                  </span>
                )}
              </button>

              {allowDirectPurchase && (
                <button
                  onClick={onBuyNow}
                  className="w-full py-3 rounded-full font-bold text-sm transition-all relative overflow-hidden"
                  style={{
                    backgroundColor: 'var(--md-sys-color-primary)',
                    color: 'var(--md-sys-color-on-primary)',
                  }}
                >
                  <span className="relative z-10">
                    <span className="material-symbols-outlined" style={{ fontSize: '18px', verticalAlign: 'middle', marginLeft: '4px' }}>credit_card</span>
                    اشترِ الآن
                  </span>
                  <span className="absolute inset-0 animate-shimmer" style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent)' }} aria-hidden="true" />
                </button>
              )}

              {course.price > 1000 && (
                <p className="text-center text-xs flex items-center justify-center gap-1" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>
                  <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>credit_card</span>
                  متاح بالتقسيط عبر <strong style={{ color: 'var(--md-sys-color-primary)' }}>فاليو / تمارا / تمويل</strong>
                </p>
              )}

              <div className="flex items-center justify-center gap-2 text-[11px]" style={{ color: 'var(--md-sys-color-outline)' }}>
                <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>lock</span>
                <span>دفع آمن ومشفّر</span>
                <span>•</span>
                <span>إيصال فوري</span>
                <span>•</span>
                <span>دعم 24/7</span>
              </div>
            </div>

            <div className="mt-6 pt-6" style={{ borderTop: '1px solid var(--md-sys-color-outline-variant)' }}>
              <p className="text-xs font-medium mb-3 flex items-center justify-center gap-1" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>
                <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>inventory_2</span>
                ما ستحصل عليه
              </p>
              <ul className="space-y-2 text-sm" style={{ color: 'var(--md-sys-color-on-surface)' }}>
                {[
                  'الوصول الكامل لمحتوى الكورس',
                  'شهادة معتمدة برقم تسلسلي',
                  'دعم فني طوال مدة الكورس',
                  'تحديثات مجانية للمحتوى',
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-2 animate-fade-up" style={{ animationDelay: `${0.3 + i * 0.1}s` }}>
                    <span
                      className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center"
                      style={{ backgroundColor: 'var(--md-sys-color-primary-container)', color: 'var(--md-sys-color-on-primary-container)' }}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>check</span>
                    </span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
