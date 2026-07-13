'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '../../../lib/api';
import { useAuth } from '../../../lib/auth';
import { useBranding } from '../../../components/BrandingProvider';
import { useToast } from '../../../components/Toast';

/* ─── Types ─── */
interface Course {
  id: number;
  title_ar: string;
  title_en: string;
  description?: string;
  price: number;
  image_url?: string;
  category_id?: number;
  category_name_ar?: string;
  instructor?: string;
  course_mode?: string;
  lecture_count?: number;
  lecture_duration?: number;
  group_max?: number;
  group_current?: number;
  featured?: number;
  enable_direct_purchase?: number;
  enable_mobile_sticky_cta?: number;
}

/* ─── SVG Fallback (large hero variant) ─── */
function CourseHeroFallback({ seed, mode }: { seed: number; mode?: string }) {
  const variant = Math.abs(seed) % 3;
  const vw = 400;
  const vh = 300;
  const sc = 'rgba(255,255,255,0.3)';
  const sc2 = 'rgba(255,255,255,0.18)';
  const sf = 'rgba(255,255,255,0.1)';
  const sf2 = 'rgba(255,255,255,0.06)';

  if (variant === 0) {
    return (
      <svg viewBox={`0 0 ${vw} ${vh}`} className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
        {/* Book */}
        <path d="M160 200 C160 180 200 170 200 170 C200 170 240 180 240 200 L240 220 C240 220 200 208 200 208 C200 208 160 220 160 220Z" fill={sf} stroke={sc} strokeWidth="2" />
        <line x1="200" y1="170" x2="200" y2="220" stroke={sc2} strokeWidth="2" />
        <polygon points="200,110 240,130 200,150 160,130" fill={sf} stroke={sc} strokeWidth="2" />
        <line x1="200" y1="150" x2="200" y2="170" stroke={sc} strokeWidth="1.5" />
        <circle cx="200" cy="92" r="14" fill={sc2} stroke={sc} strokeWidth="1.5" />
        {/* Decorative lines */}
        <line x1="140" y1="250" x2="260" y2="250" stroke={sc2} strokeWidth="1" />
        <line x1="150" y1="260" x2="250" y2="260" stroke={sf2} strokeWidth="1" />
        <line x1="160" y1="270" x2="240" y2="270" stroke={sf2} strokeWidth="1" />
      </svg>
    );
  }
  if (variant === 1) {
    return (
      <svg viewBox={`0 0 ${vw} ${vh}`} className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
        {/* Laptop */}
        <rect x="140" y="130" width="120" height="80" rx="8" fill={sf} stroke={sc} strokeWidth="2" />
        <rect x="148" y="138" width="104" height="56" rx="4" fill={sf2} />
        <path d="M140 210 L260 210 L250 230 L150 230Z" fill={sf} stroke={sc} strokeWidth="1.5" />
        <circle cx="200" cy="166" r="20" fill={sc2} stroke={sc} strokeWidth="1" />
        <circle cx="200" cy="166" r="8" fill="none" stroke={sc} strokeWidth="1" />
        <text x="195" y="170" fill={sc} fontSize="10" fontFamily="sans-serif">▶</text>
        {/* Code brackets */}
        <text x="170" y="240" fill={sc2} fontSize="11" fontFamily="monospace">&lt;/&gt;</text>
        <line x1="250" y1="100" x2="270" y2="80" stroke={sc2} strokeWidth="1.5" />
        <circle cx="275" cy="75" r="3" fill={sc} />
      </svg>
    );
  }
  return (
    <svg viewBox={`0 0 ${vw} ${vh}`} className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
      {/* Online / Video */}
      <rect x="150" y="100" width="100" height="80" rx="10" fill={sf} stroke={sc} strokeWidth="2" />
      <polygon points="210,140 230,155 210,170" fill={sc2} stroke={sc} strokeWidth="1" />
      {/* Play button */}
      <circle cx="200" cy="140" r="14" fill="none" stroke={sc} strokeWidth="1.5" />
      <polygon points="197,133 197,147 207,140" fill={sc} />
      {/* Signal bars */}
      <line x1="170" y1="200" x2="170" y2="220" stroke={sc2} strokeWidth="2" strokeLinecap="round" />
      <line x1="185" y1="195" x2="185" y2="220" stroke={sc2} strokeWidth="2" strokeLinecap="round" />
      <line x1="200" y1="190" x2="200" y2="220" stroke={sc2} strokeWidth="2" strokeLinecap="round" />
      <line x1="215" y1="195" x2="215" y2="220" stroke={sc2} strokeWidth="2" strokeLinecap="round" />
      <line x1="230" y1="200" x2="230" y2="220" stroke={sc2} strokeWidth="2" strokeLinecap="round" />
      {/* Ce badge */}
      <text x="260" y="115" fill={sc} fontSize="8" fontFamily="sans-serif">{mode === 'offline' ? '📍' : '📡'}</text>
    </svg>
  );
}

/* ─── Loading Skeleton ─── */
function CourseDetailSkeleton() {
  return (
    <div style={{ backgroundColor: 'var(--bg)' }}>
      {/* Hero Skeleton */}
      <div className="relative overflow-hidden" style={{ backgroundColor: 'var(--surface)' }}>
        <div className="max-w-6xl mx-auto px-4 py-10 md:py-16">
          {/* Back link */}
          <div className="skeleton h-5 w-32 rounded-lg mb-6" />
          <div className="grid md:grid-cols-5 gap-8 items-center">
            {/* Image placeholder */}
            <div className="md:col-span-2">
              <div className="skeleton rounded-3xl" style={{ width: '100%', height: '280px' }} />
            </div>
            {/* Info placeholder */}
            <div className="md:col-span-3 space-y-4">
              <div className="skeleton h-6 w-24 rounded-lg" />
              <div className="skeleton h-10 w-full rounded-xl" />
              <div className="skeleton h-10 w-3/4 rounded-xl" />
              <div className="skeleton h-5 w-48 rounded-lg" />
              <div className="flex gap-3 pt-2">
                <div className="skeleton h-10 w-28 rounded-2xl" />
                <div className="skeleton h-10 w-28 rounded-2xl" />
              </div>
            </div>
          </div>
        </div>
      </div>
      {/* Stats Skeleton */}
      <div className="max-w-6xl mx-auto px-4 -mt-6 mb-8">
        <div className="skeleton h-16 w-full rounded-2xl" />
      </div>
      {/* Description Skeleton */}
      <div className="max-w-6xl mx-auto px-4 pb-16 space-y-4">
        <div className="skeleton h-8 w-40 rounded-lg" />
        <div className="skeleton h-5 w-full rounded-lg" />
        <div className="skeleton h-5 w-full rounded-lg" />
        <div className="skeleton h-5 w-3/4 rounded-lg" />
        <div className="skeleton h-5 w-full rounded-lg" />
        <div className="skeleton h-5 w-1/2 rounded-lg" />
        {/* CTA skeleton */}
        <div className="skeleton h-20 w-full rounded-2xl mt-8" />
      </div>
    </div>
  );
}

/* ─── Error Display ─── */
function ErrorDisplay({ message, onRetry }: { message: string; onRetry: () => void }) {
  const { primaryColor } = useBranding();
  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4" style={{ backgroundColor: 'var(--bg)' }}>
      <div className="text-center max-w-md">
        <div
          className="w-20 h-20 mx-auto mb-6 rounded-full flex items-center justify-center text-3xl"
          style={{ backgroundColor: `${primaryColor}15` }}
        >
          ⚠️
        </div>
        <h2 className="text-xl font-bold mb-2" style={{ color: 'var(--text)' }}>
          تعذر تحميل الكورس
        </h2>
        <p className="text-sm mb-6" style={{ color: 'var(--text-muted)' }}>
          {message}
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <button
            onClick={onRetry}
            className="px-6 py-3 rounded-xl text-white font-bold shadow-lg hover:shadow-xl transition-all hover:-translate-y-0.5"
            style={{ backgroundColor: primaryColor }}
          >
            إعادة المحاولة
          </button>
          <Link
            href="/courses"
            className="px-6 py-3 rounded-xl font-bold border-2 transition-all hover:-translate-y-0.5"
            style={{ borderColor: primaryColor, color: primaryColor }}
          >
            العودة للكورسات
          </Link>
        </div>
      </div>
    </div>
  );
}

/* ─── Main Page ─── */
export default function CourseDetailPage() {
  const params = useParams();
  const router = useRouter();
  const courseId = Number(params.id);
  const { token, loading: authLoading } = useAuth();
  const { primaryColor, secondaryColor, sloganAr, sloganEn, systemName } = useBranding();
  const { show: showToast } = useToast();

  const [course, setCourse] = useState<Course | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [purchased, setPurchased] = useState<boolean | null>(null);
  const [cartLoading, setCartLoading] = useState(false);

  const heroGradient = `linear-gradient(135deg, ${primaryColor} 0%, ${secondaryColor} 100%)`;
  const heroGradientSoft = `linear-gradient(135deg, ${primaryColor}08 0%, ${secondaryColor}08 100%)`;

  /* ── Fetch Course ── */
  const fetchCourse = useCallback(() => {
    setLoading(true);
    setError('');
    api(`/api/courses/${courseId}`)
      .then((data) => {
        setCourse(data);
        // Check enrollment status if authenticated
        if (token) {
          api(`/api/orders/my/check/${courseId}`)
            .then((checkData) => setPurchased(Boolean(checkData.hasPaidOrder)))
            .catch(() => setPurchased(false));
        }
      })
      .catch((err) => {
        setError(err.message || 'حدث خطأ غير متوقع');
      })
      .finally(() => setLoading(false));
  }, [courseId, token]);

  useEffect(() => {
    if (courseId) fetchCourse();
  }, [courseId, fetchCourse]);

  /* ── Add to Cart ── */
  const handleAddToCart = async () => {
    if (!token) {
      router.push('/login');
      return;
    }
    setCartLoading(true);
    try {
      await api('/api/cart', {
        method: 'POST',
        body: JSON.stringify({ course_id: courseId }),
      });
      showToast('✓ تمت إضافة الكورس إلى السلة', 'success');
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'فشلت الإضافة إلى السلة', 'error');
    } finally {
      setCartLoading(false);
    }
  };

  /* ── Handlers ── */
  const handleRetry = () => fetchCourse();

  /* ── Loading ── */
  if (loading || (authLoading && token)) return <CourseDetailSkeleton />;
  if (error) return <ErrorDisplay message={error} onRetry={handleRetry} />;
  if (!course) return <ErrorDisplay message="لم يتم العثور على الكورس" onRetry={handleRetry} />;

  /* ── Derived Data ── */
  const hasSeats =
    course.group_max && course.group_current !== undefined
      ? course.group_max - course.group_current
      : null;
  const showBuyButton = course.enable_direct_purchase !== 0 && token && !purchased;
  const showCartButton = token && !purchased;
  const modeLabel = course.course_mode === 'offline' ? '📍 حضور مباشر' : '💻 أونلاين';
  const modeColor =
    course.course_mode === 'offline' ? '#059669' : '#2563eb';

  const enableMobileStickyCta =
    course.enable_mobile_sticky_cta !== 0 &&
    purchased !== true;

  return (
    <div style={{ backgroundColor: 'var(--bg)', paddingBottom: enableMobileStickyCta ? '88px' : '0' }}>
      {/* ==================== HERO ==================== */}
      <section className="relative overflow-hidden border-b" style={{ borderColor: 'var(--border)', background: heroGradientSoft }}>
        {/* Floating orbs */}
        <div className="absolute -top-24 -right-24 w-80 h-80 rounded-full opacity-[0.05] pointer-events-none animate-float" style={{ background: primaryColor }} />
        <div className="absolute -bottom-20 -left-20 w-64 h-64 rounded-full opacity-[0.04] pointer-events-none animate-float" style={{ background: secondaryColor, animationDelay: '2.5s' }} />

        <div className="max-w-6xl mx-auto px-4 py-8 md:py-14 relative z-10">
          {/* Back link */}
          <Link
            href="/courses"
            className="inline-flex items-center gap-1.5 text-xs font-bold mb-6 transition-opacity hover:opacity-70"
            style={{ color: 'var(--text-muted)' }}
          >
            ← العودة للكورسات
          </Link>

          <div className="grid md:grid-cols-5 gap-8 items-center">
            {/* ── Image / Visual ── */}
            <div className="md:col-span-2 relative">
              <div
                className="relative rounded-3xl overflow-hidden shadow-2xl"
                style={{
                  backgroundColor: `${primaryColor}10`,
                  border: `1px solid ${primaryColor}20`,
                  aspectRatio: '4/3',
                }}
              >
                {course.image_url ? (
                  <img
                    src={course.image_url}
                    alt={course.title_ar}
                    className="w-full h-full object-cover transition-transform duration-700 hover:scale-105"
                  />
                ) : (
                  <CourseHeroFallback seed={course.id} mode={course.course_mode} />
                )}

                {/* Price Badge */}
                <div className="absolute top-3 left-3">
                  <div
                    className="px-4 py-2 rounded-2xl text-white font-black text-lg shadow-lg backdrop-blur-sm animate-scale-in"
                    style={{ background: heroGradient }}
                  >
                    {course.price > 0
                      ? `${course.price.toLocaleString()} ج.م`
                      : '🎯 مجاني'}
                  </div>
                </div>

                {/* Featured Badge */}
                {course.featured === 1 && (
                  <div className="absolute top-3 right-3">
                    <div
                      className="px-3 py-1.5 rounded-xl text-white text-xs font-bold shadow-md"
                      style={{ backgroundColor: '#f59e0b' }}
                    >
                      ⭐ مميز
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* ── Info ── */}
            <div className="md:col-span-3 space-y-4">
              {/* Category */}
              {course.category_name_ar && (
                <span
                  className="inline-block px-3 py-1 rounded-lg text-[11px] font-bold tracking-wide"
                  style={{
                    backgroundColor: `${secondaryColor}12`,
                    color: secondaryColor,
                    border: `1px solid ${secondaryColor}20`,
                  }}
                >
                  {course.category_name_ar}
                </span>
              )}

              {/* Title */}
              <h1
                className="text-2xl md:text-4xl lg:text-5xl font-black leading-[1.15] tracking-tight animate-fade-up"
                style={{ color: 'var(--text)' }}
              >
                {course.title_ar}
              </h1>

              {course.title_en && (
                <p
                  className="text-sm md:text-base opacity-70 animate-fade-up"
                  style={{ animationDelay: '0.05s', color: 'var(--text-muted)' }}
                >
                  {course.title_en}
                </p>
              )}

              {/* Instructor */}
              {course.instructor && (
                <div
                  className="flex items-center gap-2 animate-fade-up"
                  style={{ animationDelay: '0.1s' }}
                >
                  <span
                    className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white"
                    style={{ background: heroGradient }}
                  >
                    {course.instructor.charAt(0)}
                  </span>
                  <span className="text-sm font-medium" style={{ color: 'var(--text)' }}>
                    {course.instructor}
                  </span>
                </div>
              )}

              {/* Mode + badges */}
              <div
                className="flex flex-wrap gap-2 animate-fade-up"
                style={{ animationDelay: '0.15s' }}
              >
                <span
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold"
                  style={{
                    backgroundColor: `${modeColor}12`,
                    color: modeColor,
                    border: `1px solid ${modeColor}20`,
                  }}
                >
                  {modeLabel}
                </span>

                {course.lecture_count && course.lecture_count > 0 && (
                  <span
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold"
                    style={{
                      backgroundColor: `${primaryColor}08`,
                      color: 'var(--text-muted)',
                      border: '1px solid var(--border)',
                    }}
                  >
                    📚 {course.lecture_count} محاضرة
                  </span>
                )}

                {course.lecture_duration && course.lecture_duration > 0 && (
                  <span
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold"
                    style={{
                      backgroundColor: `${primaryColor}08`,
                      color: 'var(--text-muted)',
                      border: '1px solid var(--border)',
                    }}
                  >
                    ⏱ {course.lecture_duration} ساعة
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ==================== CONTENT ==================== */}
      <div className="max-w-6xl mx-auto px-4 py-8 md:py-12">
        <div className="grid lg:grid-cols-3 gap-8">
          {/* ── Main Content ── */}
          <div className="lg:col-span-2 space-y-10">
            {/* Stats Strip */}
            <div
              className="grid grid-cols-2 md:grid-cols-4 gap-3 animate-fade-up"
              style={{ animationDelay: '0.2s' }}
            >
              {course.instructor && (
                <StatCard icon="🧑‍🏫" label="المدرب" value={course.instructor} />
              )}
              {course.lecture_count ? (
                <StatCard icon="📚" label="المحاضرات" value={`${course.lecture_count} محاضرة`} />
              ) : null}
              {course.lecture_duration ? (
                <StatCard icon="⏱" label="المدة" value={`${course.lecture_duration} ساعة`} />
              ) : null}
              {course.course_mode && (
                <StatCard
                  icon={course.course_mode === 'offline' ? '📍' : '💻'}
                  label="النوع"
                  value={course.course_mode === 'offline' ? 'حضور مباشر' : 'أونلاين'}
                />
              )}
            </div>

            {/* Available Seats */}
            {hasSeats !== null && (
              <div
                className="flex items-center gap-4 p-4 rounded-2xl border animate-fade-up"
                style={{
                  backgroundColor: 'var(--card)',
                  borderColor: hasSeats > 5 ? primaryColor + '20' : '#ef444440',
                }}
              >
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl"
                  style={{ backgroundColor: `${hasSeats > 5 ? primaryColor : '#ef4444'}12` }}
                >
                  👥
                </div>
                <div className="flex-1">
                  <p className="text-sm font-bold" style={{ color: 'var(--text)' }}>
                    المقاعد المتاحة
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <div
                      className="flex-1 h-2 rounded-full overflow-hidden"
                      style={{ backgroundColor: 'var(--border)' }}
                    >
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{
                          width: `${Math.min(100, ((course.group_current || 0) / (course.group_max || 1)) * 100)}%`,
                          background: heroGradient,
                        }}
                      />
                    </div>
                    <span
                      className="text-xs font-bold"
                      style={{
                        color: hasSeats > 0 ? 'var(--text)' : '#ef4444',
                      }}
                    >
                      {hasSeats > 0
                        ? `${hasSeats} مقعد`
                        : 'ممتلئ'}
                    </span>
                  </div>
                  <p
                    className="text-[10px] mt-0.5"
                    style={{ color: 'var(--text-light)' }}
                  >
                    {course.group_current} / {course.group_max} مسجل
                  </p>
                </div>
              </div>
            )}

            {/* Description */}
            {course.description && (
              <div className="animate-fade-up" style={{ animationDelay: '0.25s' }}>
                <h2 className="text-xl font-black mb-4" style={{ color: 'var(--text)' }}>
                  📖 وصف الكورس
                </h2>
                <div
                  className="prose prose-sm max-w-none leading-relaxed whitespace-pre-line"
                  style={{ color: 'var(--text-muted)' }}
                >
                  {course.description}
                </div>
              </div>
            )}
          </div>

          {/* ── Sidebar CTA ── */}
          <div className="lg:col-span-1">
            <div
              className="sticky top-24 rounded-3xl border p-6 space-y-5 animate-fade-up shadow-lg"
              style={{
                backgroundColor: 'var(--card)',
                borderColor: 'var(--border)',
              }}
            >
              {/* Price display */}
              <div className="text-center pb-4 border-b" style={{ borderColor: 'var(--border)' }}>
                <p className="text-xs font-medium mb-1" style={{ color: 'var(--text-light)' }}>
                  سعر الكورس
                </p>
                {course.price > 0 ? (
                  <div className="flex items-baseline justify-center gap-1">
                    <span
                      className="text-4xl font-black"
                      style={{ color: primaryColor }}
                    >
                      {course.price.toLocaleString()}
                    </span>
                    <span className="text-sm font-bold" style={{ color: 'var(--text-muted)' }}>
                      ج.م
                    </span>
                  </div>
                ) : (
                  <span className="text-3xl font-black gradient-text">🎯 مجاني</span>
                )}
              </div>

              {/* Action Buttons */}
              <div className="space-y-3">
                {!token ? (
                  <>
                    <button
                      onClick={() => router.push('/login')}
                      className="w-full py-3.5 rounded-2xl text-white font-bold text-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl ripple-btn"
                      style={{ background: heroGradient }}
                    >
                      تسجيل الدخول للشراء
                    </button>
                    <Link
                      href="/register"
                      className="block w-full text-center py-3.5 rounded-2xl font-bold text-sm border-2 transition-all duration-300 hover:-translate-y-0.5"
                      style={{ borderColor: primaryColor, color: primaryColor }}
                    >
                      إنشاء حساب جديد
                    </Link>
                  </>
                ) : purchased === true ? (
                  <div className="text-center space-y-3">
                    <div
                      className="w-14 h-14 mx-auto rounded-full flex items-center justify-center text-2xl"
                      style={{ backgroundColor: `${primaryColor}12` }}
                    >
                      ✅
                    </div>
                    <p className="text-sm font-bold" style={{ color: 'var(--text)' }}>
                      أنت مسجل في هذا الكورس
                    </p>
                    <Link
                      href="/dashboard"
                      className="block w-full py-3.5 rounded-2xl text-white font-bold text-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl"
                      style={{ background: heroGradient }}
                    >
                      الذهاب للوحة التحكم
                    </Link>
                  </div>
                ) : (
                  <>
                    {showBuyButton && (
                      <Link
                        href={`/checkout?course_id=${courseId}&amount=${course.price}`}
                        className="block w-full text-center py-3.5 rounded-2xl text-white font-bold text-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl animate-glow-pulse ripple-btn"
                        style={{ background: heroGradient }}
                      >
                        اشتري الآن
                      </Link>
                    )}
                    {showCartButton && (
                      <button
                        onClick={handleAddToCart}
                        disabled={cartLoading}
                        className="w-full py-3.5 rounded-2xl font-bold text-sm border-2 transition-all duration-300 hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed ripple-btn"
                        style={{
                          borderColor: primaryColor,
                          color: primaryColor,
                          backgroundColor: `${primaryColor}06`,
                        }}
                      >
                        {cartLoading ? '🔄 جاري الإضافة...' : '🛒 أضف إلى السلة'}
                      </button>
                    )}
                  </>
                )}
              </div>

              {/* Trust */}
              <div
                className="pt-4 border-t text-center"
                style={{ borderColor: 'var(--border)' }}
              >
                <p className="text-[10px] leading-relaxed" style={{ color: 'var(--text-light)' }}>
                  {sloganAr || 'نحو تعليم أفضل'}
                  <br />
                  <span className="text-[9px]">{sloganEn || 'Towards Better Learning'}</span>
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ==================== FOOTER CTA ==================== */}
      <section
        className="border-t"
        style={{
          borderColor: 'var(--border)',
          backgroundColor: 'var(--surface)',
        }}
      >
        <div className="max-w-6xl mx-auto px-4 py-10 text-center">
          <h2 className="text-lg md:text-xl font-bold mb-2" style={{ color: 'var(--text)' }}>
            لديك استفسار عن هذا الكورس؟
          </h2>
          <p className="text-xs md:text-sm mb-5 max-w-md mx-auto" style={{ color: 'var(--text-muted)' }}>
            فريق {systemName || 'نادي ريادة الاعمال'} جاهز للإجابة على جميع أسئلتك
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <a
              href="tel:+201234567890"
              className="px-5 py-2.5 rounded-xl text-white font-bold text-sm shadow-lg hover:shadow-xl transition-all hover:-translate-y-0.5"
              style={{ backgroundColor: primaryColor }}
            >
              📞 اتصل بنا
            </a>
            <Link
              href="/courses"
              className="px-5 py-2.5 rounded-xl font-bold text-sm border-2 transition-all hover:-translate-y-0.5"
              style={{ borderColor: primaryColor, color: primaryColor }}
            >
              تصفح الكورسات
            </Link>
          </div>
        </div>
      </section>

      {/* Disclaimer */}
      <div
        className="border-t text-center px-4 py-5"
        style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg)' }}
      >
        <p className="text-[10px] md:text-xs leading-relaxed" style={{ color: 'var(--text-light)' }}>
          هذه المنصة مقدمة من نادي ريادة الاعمال بالتعاون مع المعهد العالي للعلوم الإدارية بالقطامية (HIMS)
        </p>
      </div>

      {/* ==================== MOBILE STICKY CTA BAR ==================== */}
      {enableMobileStickyCta && (
        <div
          className="fixed bottom-4 left-3 right-3 z-40 md:hidden animate-fade-up shadow-2xl rounded-2xl"
          style={{
            backgroundColor: 'var(--surface)',
          }}
        >
          <div className="flex items-center justify-between px-4 py-3">
            {/* Price */}
            <div className="flex flex-col">
              <span className="text-[10px] font-medium" style={{ color: 'var(--text-light)' }}>
                سعر الكورس
              </span>
              {course.price > 0 ? (
                <span className="text-xl font-black" style={{ color: primaryColor }}>
                  {course.price.toLocaleString()} <span className="text-xs font-bold" style={{ color: 'var(--text-muted)' }}>ج.م</span>
                </span>
              ) : (
                <span className="text-xl font-black gradient-text">🎯 مجاني</span>
              )}
            </div>

            {/* CTA Button */}
            {!token ? (
              <button
                onClick={() => router.push('/login')}
                className="px-6 py-3 rounded-2xl text-white font-bold text-sm shadow-lg hover:shadow-xl transition-all duration-300 active:scale-95 ripple-btn"
                style={{ background: heroGradient }}
              >
                سجل الآن للشراء
              </button>
            ) : purchased ? null : (
              (course.enable_direct_purchase !== 0) && (
                <Link
                  href={`/checkout?course_id=${courseId}&amount=${course.price}`}
                  className="px-6 py-3 rounded-2xl text-white font-bold text-sm shadow-lg hover:shadow-xl transition-all duration-300 active:scale-95 animate-glow-pulse ripple-btn"
                  style={{ background: heroGradient }}
                >
                  اشتر الآن
                </Link>
              )
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Stat Card Subcomponent ─── */
function StatCard({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div
      className="flex items-center gap-3 p-4 rounded-2xl border transition-all duration-300 hover:shadow-md"
      style={{
        backgroundColor: 'var(--card)',
        borderColor: 'var(--border)',
      }}
    >
      <span className="text-2xl">{icon}</span>
      <div>
        <p
          className="text-[10px] font-bold uppercase tracking-wider"
          style={{ color: 'var(--text-light)' }}
        >
          {label}
        </p>
        <p
          className="text-sm font-bold mt-0.5 leading-tight"
          style={{ color: 'var(--text)' }}
        >
          {value}
        </p>
      </div>
    </div>
  );
}
