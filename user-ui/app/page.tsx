'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useBranding } from '../components/BrandingProvider';
import { useAuth } from '../lib/auth';
import { api } from '../lib/api';
import { CourseCard } from '../components/CourseCard';
import { PageSkeleton } from '../components/Skeleton';

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
  featured?: number;
  group_max?: number;
  group_current?: number;
}

interface Category {
  id: number;
  name_ar: string;
  name_en: string;
  description?: string;
}

/* ─── Main Page ─── */
export default function HomePage() {
  const branding = useBranding();
  const sloganAr = branding.sloganAr;
  const sloganEn = branding.sloganEn;
  const primaryColor = branding.primaryColor;
  const secondaryColor = branding.secondaryColor;
  const auth = useAuth();
  const user = auth.user;
  const authLoading = auth.loading;
  const [featured, setFeatured] = useState<Course[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTestimonial, setActiveTestimonial] = useState(0);

  /* ── Testimonials (defined BEFORE early return) ── */
  const testimonials = [
    { name: 'أحمد علي', role: 'طالب — دبلوم التسويق', text: 'والله بجد تجربة تحفة! المحتوى جامد جدًا والمدربين شغل محترم. الشهادة بتاعة HIMS فتحتلي مجالات كتير في الشغل. أنصح أي حد يسجل.', rating: 5 },
    { name: 'سارة محمد', role: 'طالبة — برمجة وتطوير', text: 'بصراحة أنا كنت خايفة في الأول لكن النظام الأونلاين سهل ومريح أوي. وفريق الدعم متجاوب بجد معايا في أي مشكلة. تستاهلوا كل خير.', rating: 5 },
    { name: 'محمود حسن', role: 'طالب — إدارة أعمال', text: 'الشهادة من المعهد العالي ده غير كل حاجة بجد. ضربت عصفورين بحجر — تعلمت واشتغلت في نفس المجال بعد ما خلصت. شكرًا لفريق نادي ريادة الاعمال على المجهود الجبار.', rating: 5 },
    { name: 'نورا إبراهيم', role: 'طالبة — جرافيك ديزاين', text: 'الأسعار هنا معقولة جدًا مقارنة بباقي الأماكن، والمواد العلمية حلوة أوي. الحضور المباشر خلاني اشتغل على مشاريع حقيقية. ناقصة نجمة عشان نفسي يبقى فيه تنوع أكتر.', rating: 4 },
  ];

  useEffect(() => {
    Promise.all([
      api('/api/courses?featured=1').catch(() => []),
      api('/api/courses').catch(() => []),
      api('/api/categories').catch(() => []),
    ]).then(([f, c, cats]) => {
      setFeatured(f || []);
      setCourses(c || []);
      setCategories(cats || []);
    }).finally(() => setLoading(false));
  }, []);

  // Auto-rotate testimonials
  const tLen = testimonials.length;
  useEffect(() => {
    const interval = setInterval(() => {
      setActiveTestimonial((prev) => (prev + 1) % tLen);
    }, 4000);
    return () => clearInterval(interval);
  }, [tLen]);

  if (loading) return <PageSkeleton />;

  const heroGradient = `linear-gradient(135deg, ${primaryColor} 0%, ${secondaryColor} 100%)`;
  const displayCourses = featured.length > 0 ? featured : courses.slice(0, 3);

  /* ── Stats ── */
  const stats = [
    { icon: '📚', value: courses.length, suffix: '+', label: 'برنامج تدريبي' },
    { icon: '👨‍🎓', value: '+500', suffix: '', label: 'طالب مسجل' },
    { icon: '🏆', value: '+50', suffix: '', label: 'شهادة معتمدة' },
    { icon: '⭐', value: '4.8', suffix: '', label: 'تقييم الطلاب' },
  ];

  /* ── Benefits ── */
  const benefits = [
    { icon: '🎓', title: 'شهادات معتمدة', desc: 'شهادات رسمية من المعهد العالي للعلوم الإدارية بالقطامية (HIMS) تفتحلك أبواب الشغل' },
    { icon: '👨‍🏫', title: 'مدربون خبراء', desc: 'فريق نادي ريادة الاعمال يضم نخبة من المدربين المعتمدين ذوي الخبرة العملية في مجالاتهم' },
    { icon: '💻', title: 'نظام مرن', desc: 'اختر بين الحضور المباشر أو الدراسة أونلاين — حسب ما يناسب جدولك' },
    { icon: '💰', title: 'أسعار تنافسية', desc: 'برامج عالية الجودة بأسعار مناسبة مع إمكانية الدفع بالتقسيط' },
  ];

  /* ── How It Works ── */
  const steps = [
    { icon: '✍️', title: 'سجل حساب', desc: 'أنشئ حساب مجاني في دقائق' },
    { icon: '🔍', title: 'اختر برنامجك', desc: 'تصفح البرامج واختر ما يناسبك' },
    { icon: '🚀', title: 'ابدأ التعلم', desc: 'انطلق في رحلتك التعليمية' },
  ];


  return (
    <div style={{ backgroundColor: 'var(--bg)' }}>
      {/* ============================== */}
      {/*      1. HERO SECTION           */}
      {/* ============================== */}
      <section className="relative overflow-hidden min-h-[85vh] flex items-center">
        {/* Animated gradient background */}
        <div className="absolute inset-0 pointer-events-none">
          <div
            className="absolute inset-0 opacity-[0.04]"
            style={{
              background: `radial-gradient(circle at 20% 30%, ${primaryColor} 0%, transparent 60%),
                          radial-gradient(circle at 80% 70%, ${secondaryColor} 0%, transparent 60%)`,
            }}
          />
        </div>

        {/* Floating decorative circles */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute -top-20 -right-20 w-80 h-80 rounded-full opacity-[0.04] animate-float" style={{ background: primaryColor }} />
          <div className="absolute -bottom-20 -left-20 w-64 h-64 rounded-full opacity-[0.03] animate-float" style={{ background: secondaryColor, animationDelay: '2s' }} />
          <div className="absolute top-1/3 left-1/4 w-8 h-8 rounded-full opacity-[0.05] animate-float" style={{ background: primaryColor, animationDelay: '1s' }} />
          <div className="absolute bottom-1/3 right-1/4 w-5 h-5 rounded-full opacity-[0.04] animate-float" style={{ background: secondaryColor, animationDelay: '3s' }} />
          <div className="absolute top-1/2 right-1/3 w-3 h-3 rounded-full opacity-[0.06] animate-float" style={{ background: primaryColor, animationDelay: '0.5s' }} />
        </div>

        {/* Dot grid */}
        <div className="absolute inset-0 bg-dots pointer-events-none" />

        <div className="max-w-6xl mx-auto px-4 py-20 md:py-28 w-full relative z-10">
          <div className="grid md:grid-cols-2 gap-10 items-center">
            {/* Left Column — Text */}
            <div className="animate-fade-up">
              {/* Badge */}
              <div
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold mb-5"
                style={{
                  backgroundColor: `${primaryColor}12`,
                  color: primaryColor,
                  border: `1px solid ${primaryColor}20`,
                }}
              >
                <span className="text-sm">✨</span>
                <span>منصة تعليمية معتمدة رسميًا 🎯</span>
              </div>

              {/* Main headline */}
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-black leading-[1.05] tracking-tight mb-4">
                <span style={{ color: 'var(--text)' }}>طور </span>
                <span
                  className="bg-clip-text text-transparent"
                  style={{ backgroundImage: heroGradient }}
                >
                  مهاراتك
                </span>
                <br />
                <span style={{ color: 'var(--text)' }}>وحقق </span>
                <span
                  className="bg-clip-text text-transparent"
                  style={{ backgroundImage: heroGradient }}
                >
                  طموحك
                </span>
                <span style={{ color: 'var(--text)' }}> 🚀</span>
              </h1>

              {/* Description */}
              <p className="text-base md:text-lg max-w-lg mb-6 leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                {sloganAr || 'نحو تعليم أفضل'}
                <span className="mx-2">—</span>
                <span className="text-sm">{sloganEn || 'Towards Better Learning'}</span>
              </p>
              <p className="text-xs mb-8 leading-relaxed" style={{ color: 'var(--text-light)' }}>
                هذه المنصة مقدمة من نادي ريادة الاعمال بالتعاون مع المعهد العالي للعلوم الإدارية بالقطامية (HIMS)
              </p>

              {/* CTA Buttons */}
              <div className="flex flex-wrap gap-3 mb-8">
                <Link
                  href="/courses"
                  className="relative group/btn px-7 py-3.5 rounded-xl text-white font-bold text-sm shadow-lg transition-all duration-300 hover:shadow-xl hover:-translate-y-1 active:translate-y-0 overflow-hidden"
                  style={{ backgroundColor: primaryColor }}
                >
                  <span className="relative z-10 flex items-center gap-2">
                    ابدأ التعلم الآن
                    <span className="text-lg transition-transform duration-300 group-hover/btn:translate-x-1">←</span>
                  </span>
                  <span
                    className="absolute inset-0 -translate-x-full group-hover/btn:translate-x-full transition-transform duration-700"
                    style={{ background: `linear-gradient(90deg, transparent, rgba(255,255,255,0.15), transparent)` }}
                  />
                </Link>
                {!authLoading && !user && (
                  <Link
                    href="/register"
                    className="group px-7 py-3.5 rounded-xl font-bold text-sm border-2 transition-all duration-300 hover:-translate-y-1 active:translate-y-0 hover:shadow-md"
                    style={{ borderColor: primaryColor, color: primaryColor }}
                  >
                    <span className="flex items-center gap-2">
                      🎯 أنشئ حساب مجاني
                    </span>
                  </Link>
                )}
              </div>

              {/* Trust strip */}
              <div className="flex items-center gap-3 text-xs" style={{ color: 'var(--text-light)' }}>
                <span className="flex items-center gap-1">✅ لا حاجة لبطاقة ائتمان</span>
                <span className="w-1 h-1 rounded-full" style={{ backgroundColor: 'var(--text-light)' }} />
                <span className="flex items-center gap-1">🎓 شهادات معتمدة</span>
                <span className="w-1 h-1 rounded-full" style={{ backgroundColor: 'var(--text-light)' }} />
                <span className="flex items-center gap-1">🚀 دعم فني متواصل</span>
              </div>
            </div>

            {/* Right Column — Visual / Stats Grid */}
            <div className="hidden md:grid grid-cols-2 gap-4 animate-fade-up" style={{ animationDelay: '0.2s' }}>
              {/* Big stat cards */}
              <div className="col-span-2 rounded-3xl p-6 border relative overflow-hidden group"
                style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}>
                <div className="absolute inset-0 opacity-[0.03] pointer-events-none"
                  style={{
                    background: `radial-gradient(circle at 70% 30%, ${primaryColor} 0%, transparent 60%)`,
                  }}
                />
                <div className="relative z-10">
                    <p className="text-sm font-bold mb-2" style={{ color: 'var(--text-muted)' }}>المنصة مقدمة من</p>
                  <div className="flex items-center gap-3">
                    <div
                      className="relative w-14 h-14 rounded-xl overflow-hidden bg-white/80 dark:bg-white/10 border-2 flex-shrink-0"
                      style={{ borderColor: `${primaryColor}30` }}
                    >
                      <img
                        src="/partners/لوجو نادى ريادة الاعمال.png"
                        alt="نادي ريادة الاعمال"
                        className="absolute inset-0 w-full h-full object-contain p-1"
                      />
                    </div>
                    <div>
                      <p className="font-bold text-sm" style={{ color: 'var(--text)' }}>نادي ريادة الاعمال</p>
                      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>بالتعاون مع المعهد العالي للعلوم الإدارية (HIMS)</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Stats mini cards */}
              {stats.map((stat, i) => (
                <div key={i}
                  className="rounded-2xl p-4 border transition-all duration-300 hover:-translate-y-1 hover:shadow-md"
                  style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}>
                  <div className="text-2xl mb-2">{stat.icon}</div>
                  <p className="text-2xl font-black" style={{ color: primaryColor }}>
                    {stat.value}{stat.suffix}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{stat.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Wave divider */}
        <div className="absolute bottom-0 left-0 right-0 h-16 pointer-events-none"
          style={{
            background: `linear-gradient(to top, var(--bg), transparent)`,
          }} />
      </section>

      {/* ============================== */}
      {/*   2. TRUST BAR — PARTNERS     */}
      {/* ============================== */}
      <section className="max-w-6xl mx-auto px-4 mb-14">
        <div
          className="relative rounded-3xl p-8 md:p-10 border text-center overflow-hidden"
          style={{
            backgroundColor: 'var(--card)',
            borderColor: 'var(--border)',
          }}
        >
          {/* Subtle background glow */}
          <div
            className="absolute -top-20 -right-20 w-64 h-64 rounded-full opacity-[0.03] pointer-events-none"
            style={{ background: `radial-gradient(circle, ${primaryColor}, transparent)` }}
          />
          <div
            className="absolute -bottom-20 -left-20 w-64 h-64 rounded-full opacity-[0.02] pointer-events-none"
            style={{ background: `radial-gradient(circle, ${secondaryColor}, transparent)` }}
          />

          {/* Section heading with decorative lines */}
          <div className="flex items-center justify-center gap-4 mb-8">
            <div className="h-[1px] flex-1 max-w-[80px]" style={{ background: `linear-gradient(90deg, transparent, ${primaryColor}40)` }} />
            <div className="text-center">
              <p className="text-[10px] font-bold tracking-[0.2em] uppercase" style={{ color: 'var(--text-light)' }}>
                شركاؤنا في النجاح
              </p>
            </div>
            <div className="h-[1px] flex-1 max-w-[80px]" style={{ background: `linear-gradient(270deg, transparent, ${primaryColor}40)` }} />
          </div>

          {/* Logo Grid */}
          <div className="flex flex-wrap items-center justify-center gap-5 md:gap-6">
            {[
              { src: '/partners/لوجو  hims.png', alt: 'HIMS' },
              { src: '/partners/لوجو X2.png', alt: 'X2' },
              { src: '/partners/لوجو نادى ريادة الاعمال.png', alt: 'نادي ريادة الاعمال' },
              { src: '/partners/لوجو وزارة التعليم العالي.png', alt: 'وزارة التعليم العالي' },
              { src: '/partners/لوجو اكادمية البحث العلمى و التكنولوجيا .png', alt: 'أكاديمية البحث العلمي والتكنولوجيا' },
            ].map((partner) => (
              <div key={partner.alt}
                className="group relative w-[200px] h-[110px] rounded-2xl border overflow-hidden transition-all duration-500 hover:shadow-xl hover:-translate-y-1 hover:border-transparent"
                style={{
                  backgroundColor: 'var(--bg)',
                  borderColor: 'var(--border)',
                }}
              >
                {/* Gradient hover bg */}
                <div
                  className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
                  style={{
                    background: `linear-gradient(135deg, ${primaryColor}06, ${secondaryColor}04)`,
                  }}
                />

                {/* Premium gradient border on hover */}
                <span
                  className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
                  style={{
                    border: '1.5px solid transparent',
                    background: `linear-gradient(135deg, ${primaryColor}50, ${secondaryColor}30, ${primaryColor}50) border-box`,
                    WebkitMask: 'linear-gradient(#fff 0 0) padding-box, linear-gradient(#fff 0 0)',
                    WebkitMaskComposite: 'xor',
                    maskComposite: 'exclude',
                  }}
                />

                {/* Glow */}
                <div
                  className="absolute -inset-1 rounded-3xl opacity-0 group-hover:opacity-100 transition-all duration-500 blur-xl pointer-events-none"
                  style={{
                    background: `linear-gradient(135deg, ${primaryColor}15, ${secondaryColor}10)`,
                  }}
                />

                {/* Logo — fills the box with minimal padding */}
                <div className="absolute inset-0 flex items-center justify-center p-3">
                  <img
                    src={partner.src}
                    alt={partner.alt}
                    className="w-full h-full object-contain block transition-transform duration-500 group-hover:scale-110"
                    loading="lazy"
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Subtle bottom text */}
          <p className="text-[10px] mt-6 opacity-30" style={{ color: 'var(--text-muted)' }}>
            — شراكتنا مع هذه المؤسسات تضمن لك أفضل تجربة تعليمية —
          </p>
        </div>
      </section>

      {/* ============================== */}
      {/*   3. FEATURED COURSES         */}
      {/* ============================== */}
      {displayCourses.length > 0 && (
        <section className="max-w-6xl mx-auto px-4 mb-16">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-black" style={{ color: 'var(--text)' }}>
                ⭐ برامج مميزة
              </h2>
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>اختر من بين أفضل البرامج المتاحة</p>
            </div>
            <Link href="/courses"
              className="hidden sm:inline-flex items-center gap-1.5 text-sm font-bold px-4 py-2.5 rounded-xl transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md"
              style={{ backgroundColor: `${primaryColor}12`, color: primaryColor }}>
              عرض الكل
              <span>←</span>
            </Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {displayCourses.slice(0, 3).map((course, i) => (
              <div key={course.id} className="animate-fade-up" style={{ animationDelay: `${i * 0.1}s` }}>
                <CourseCard course={course} index={i} />
              </div>
            ))}
          </div>
          <div className="mt-6 text-center sm:hidden">
            <Link href="/courses"
              className="inline-flex items-center gap-1.5 text-sm font-bold px-5 py-3 rounded-xl transition-all duration-300"
              style={{ backgroundColor: `${primaryColor}12`, color: primaryColor }}>
              عرض جميع البرامج ←
            </Link>
          </div>
        </section>
      )}

      {/* ============================== */}
      {/*   4. WHY CHOOSE US            */}
      {/* ============================== */}
      <section className="mb-16 relative">
        <div className="absolute inset-0 pointer-events-none"
          style={{
            background: `linear-gradient(180deg, transparent 0%, ${primaryColor}03 50%, transparent 100%)`,
          }}
        />
        <div className="max-w-6xl mx-auto px-4 relative">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-black" style={{ color: 'var(--text)' }}>
               لماذا تختار <span className="bg-clip-text text-transparent" style={{ backgroundImage: heroGradient }}>نادي ريادة الاعمال</span>؟
            </h2>
            <p className="text-sm mt-2" style={{ color: 'var(--text-muted)' }}>نقدم لك تجربة تعليمية متكاملة تجمع بين الجودة والاعتماد الرسمي</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {benefits.map((benefit, i) => (
              <div key={i}
                className="group rounded-2xl p-5 border transition-all duration-300 hover:-translate-y-1 hover:shadow-lg animate-fade-up"
                style={{
                  backgroundColor: 'var(--card)',
                  borderColor: 'var(--border)',
                  animationDelay: `${i * 0.08}s`,
                }}>
                <div
                  className="w-11 h-11 rounded-xl flex items-center justify-center text-xl mb-3 transition-transform duration-300 group-hover:scale-110"
                  style={{ backgroundColor: `${primaryColor}12` }}
                >
                  {benefit.icon}
                </div>
                <h3 className="font-bold text-sm mb-1.5" style={{ color: 'var(--text)' }}>{benefit.title}</h3>
                <p className="text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>{benefit.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============================== */}
      {/*   5. CATEGORIES               */}
      {/* ============================== */}
      {categories.length > 0 && (
        <section className="max-w-6xl mx-auto px-4 mb-16">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-black" style={{ color: 'var(--text)' }}>
              📂 الأقسام التعليمية
            </h2>
            <p className="text-sm mt-2" style={{ color: 'var(--text-muted)' }}>اختر من بين مجموعة متنوعة من التخصصات</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {categories.map((cat, i) => {
              const colors = [
                `linear-gradient(135deg, ${primaryColor}, ${secondaryColor})`,
                `linear-gradient(135deg, ${secondaryColor}, ${primaryColor})`,
                `linear-gradient(135deg, ${primaryColor}DD, ${secondaryColor}DD)`,
                `linear-gradient(135deg, ${secondaryColor}DD, ${primaryColor}DD)`,
              ];
              const icons = ['📊', '💻', '🎨', '📈', '🔧', '🏗️', '🩺', '📜'];
              return (
                <Link key={cat.id} href={`/courses?category=${cat.id}`}
                  className="group relative rounded-2xl p-5 text-white overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-xl animate-fade-up"
                  style={{
                    background: colors[i % colors.length],
                    animationDelay: `${i * 0.06}s`,
                  }}>
                  {/* Decorative circle */}
                  <div className="absolute -bottom-4 -right-4 w-16 h-16 rounded-full opacity-20 transition-transform duration-500 group-hover:scale-150" style={{ backgroundColor: 'rgba(255,255,255,0.2)' }} />
                  <div className="relative z-10">
                    <span className="text-2xl mb-2 block">{icons[i % icons.length]}</span>
                    <h3 className="font-bold text-sm">{cat.name_ar}</h3>
                    {cat.name_en && <p className="text-[10px] opacity-70 mt-0.5">{cat.name_en}</p>}
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* ============================== */}
      {/*   6. HOW IT WORKS             */}
      {/* ============================== */}
      <section className="mb-16">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-black" style={{ color: 'var(--text)' }}>
              🚀 ابدأ في ٣ خطوات بسيطة
            </h2>
            <p className="text-sm mt-2" style={{ color: 'var(--text-muted)' }}>رحلة التعلم تبدأ بخطوة.. ابدأ الآن!</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {steps.map((step, i) => (
              <div key={i} className="relative animate-fade-up" style={{ animationDelay: `${i * 0.12}s` }}>
                {/* Connector line */}
                {i < steps.length - 1 && (
                  <div className="hidden md:block absolute top-10 right-full w-full h-0.5 opacity-20"
                    style={{
                      background: `linear-gradient(90deg, ${primaryColor}, ${secondaryColor})`,
                    }}
                  />
                )}
                <div className="text-center">
                  <div
                    className="w-20 h-20 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-4 shadow-lg transition-transform duration-300 hover:scale-110"
                    style={{
                      background: heroGradient,
                      boxShadow: `0 8px 30px ${primaryColor}30`,
                    }}
                  >
                    {step.icon}
                  </div>
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-black mx-auto -mt-10 mb-3 relative z-10 border-2"
                    style={{
                      backgroundColor: 'var(--card)',
                      borderColor: primaryColor,
                      color: primaryColor,
                    }}
                  >
                    {i + 1}
                  </div>
                  <h3 className="font-bold text-base mb-1" style={{ color: 'var(--text)' }}>{step.title}</h3>
                  <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============================== */}
      {/*   7. ALL COURSES              */}
      {/* ============================== */}
      {courses.length > 0 && (
        <section className="max-w-6xl mx-auto px-4 mb-16">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-black" style={{ color: 'var(--text)' }}>
                📖 جميع البرامج
              </h2>
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{courses.length} برنامج تدريبي في مختلف المجالات</p>
            </div>
            <Link href="/courses"
              className="hidden sm:inline-flex items-center gap-1.5 text-sm font-bold px-4 py-2.5 rounded-xl transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md"
              style={{ backgroundColor: `${primaryColor}12`, color: primaryColor }}>
              عرض الكل
              <span>←</span>
            </Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {courses.slice(0, 6).map((course, i) => (
              <div key={course.id} className="animate-fade-up" style={{ animationDelay: `${i * 0.05}s` }}>
                <CourseCard course={course} index={i} />
              </div>
            ))}
          </div>
          {courses.length > 6 && (
            <div className="mt-8 text-center">
              <Link href="/courses"
                className="inline-flex items-center gap-2 px-7 py-3 rounded-xl text-white font-bold text-sm shadow-lg transition-all duration-300 hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0"
                style={{ backgroundColor: primaryColor }}>
                عرض جميع البرامج ({courses.length})
                <span>←</span>
              </Link>
            </div>
          )}
        </section>
      )}

      {/* ============================== */}
      {/*   8. TESTIMONIALS             */}
      {/* ============================== */}
      <section className="mb-16">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-black" style={{ color: 'var(--text)' }}>
              💬 ماذا يقول طلابنا؟
            </h2>
            <p className="text-sm mt-2" style={{ color: 'var(--text-muted)' }}>آراء وتجارب حقيقية من طلابنا السابقين</p>
          </div>
          <div className="relative max-w-2xl mx-auto">
            <div
              className="rounded-3xl p-6 md:p-8 border relative overflow-hidden transition-all duration-500"
              style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}
            >
              {/* Quote mark */}
              <div className="absolute -top-4 -right-2 text-6xl opacity-[0.06] font-black" style={{ color: primaryColor }}>❝</div>

              {/* Stars */}
              <div className="flex gap-1 mb-4">
                {[...Array(5)].map((_, i) => (
                  <span key={i} className={`text-lg transition-all duration-300 ${i < testimonials[activeTestimonial].rating ? 'opacity-100' : 'opacity-20'}`}
                    style={{ color: i < testimonials[activeTestimonial].rating ? '#f59e0b' : 'var(--text-light)' }}>
                    ★
                  </span>
                ))}
              </div>

              {/* Text */}
              <p className="text-sm md:text-base leading-relaxed mb-6 min-h-[60px] transition-opacity duration-500" style={{ color: 'var(--text)' }}>
                {testimonials[activeTestimonial].text}
              </p>

              {/* Author */}
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm"
                  style={{ background: heroGradient }}
                >
                  {testimonials[activeTestimonial].name.charAt(0)}
                </div>
                <div>
                  <p className="font-bold text-sm" style={{ color: 'var(--text)' }}>{testimonials[activeTestimonial].name}</p>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{testimonials[activeTestimonial].role}</p>
                </div>
              </div>

              {/* Dots */}
              <div className="flex justify-center gap-2 mt-6">
                {testimonials.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setActiveTestimonial(i)}
                    className="w-2 h-2 rounded-full transition-all duration-500"
                    style={{
                      backgroundColor: i === activeTestimonial ? primaryColor : 'var(--text-light)',
                      width: i === activeTestimonial ? 24 : 8,
                    }}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============================== */}
      {/*   9. FINAL CTA                */}
      {/* ============================== */}
      <section className="max-w-6xl mx-auto px-4 mb-16">
        <div
          className="relative rounded-3xl p-8 md:p-14 text-center text-white overflow-hidden"
          style={{ background: heroGradient }}
        >
          {/* Decorative elements */}
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-5 right-5 text-5xl md:text-7xl opacity-10 animate-float">🎓</div>
            <div className="absolute bottom-5 left-5 text-5xl md:text-7xl opacity-10 animate-float" style={{ animationDelay: '2s' }}>📚</div>
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-9xl opacity-5">✦</div>
            {/* Grid pattern */}
            <div className="absolute inset-0 opacity-[0.04]"
              style={{
                backgroundImage: `radial-gradient(circle, #fff 0.5px, transparent 0.5px)`,
                backgroundSize: '20px 20px',
              }}
            />
          </div>

          <div className="relative z-10 max-w-2xl mx-auto">
            <h2 className="text-2xl md:text-4xl font-black mb-4">
              ابدأ رحلتك التعليمية اليوم 🚀
            </h2>
            <p className="text-white/80 mb-8 max-w-lg mx-auto text-sm md:text-base leading-relaxed">
              انضم إلى أكثر من 500 طالب واستثمر في مستقبلك مع برامج معتمدة من المعهد العالي للعلوم الإدارية بالقطامية (HIMS)
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              <Link href="/courses"
                className="px-7 py-3.5 rounded-xl bg-white font-black text-sm shadow-xl transition-all duration-300 hover:shadow-2xl hover:-translate-y-1 active:translate-y-0"
                style={{ color: primaryColor }}>
                سجل في برنامج الآن
              </Link>
              {!authLoading && !user && (
                <Link href="/register"
                  className="px-7 py-3.5 rounded-xl font-bold text-sm border-2 border-white/40 text-white transition-all duration-300 hover:bg-white/10 hover:-translate-y-1 active:translate-y-0">
                  أنشئ حساب مجاني ←
                </Link>
              )}
            </div>
            <p className="text-white/50 text-xs mt-5">✅ التسجيل مجاني — لا حاجة لبطاقة ائتمان</p>
          </div>
        </div>
      </section>
    </div>
  );
}
