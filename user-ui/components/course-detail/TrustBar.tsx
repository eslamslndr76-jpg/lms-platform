'use client';

import { useState, useEffect, useRef } from 'react';
import { useBranding } from '../BrandingProvider';

interface TrustBarProps {
  stats?: {
    students?: number;
    rating?: number;
    reviews?: number;
    completionRate?: number;
  };
  badges?: Array<{
    icon: string;
    label: string;
    color?: string;
  }>;
  testimonials?: Array<{
    name: string;
    role?: string;
    avatar?: string;
    content: string;
    rating: number;
  }>;
  className?: string;
}

export function TrustBar({
  stats = {
    students: 12400,
    rating: 4.9,
    reviews: 847,
    completionRate: 94,
  },
  badges = [
    { icon: 'emoji_events', label: 'أفضل تقييم', color: '#f59e0b' },
    { icon: 'workspace_premium', label: 'شهادة معتمدة', color: '#16a34a' },
    { icon: 'handshake', label: 'شراكة HIMS', color: '#7c3aed' },
    { icon: 'autorenew', label: 'تحديثات مجانية', color: '#2563eb' },
  ],
  testimonials = [],
  className = '',
}: TrustBarProps) {
  const { primaryColor, secondaryColor } = useBranding();
  const [animatedStats, setAnimatedStats] = useState({
    students: 0,
    rating: 0,
    reviews: 0,
    completionRate: 0,
  });
  const [isVisible, setIsVisible] = useState(false);
  const sectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.unobserve(entry.target);
        }
      },
      { threshold: 0.3, rootMargin: '0px 0px -100px 0px' }
    );

    if (sectionRef.current) {
      observer.observe(sectionRef.current);
    }
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!isVisible) return;

    const animateCounter = (target: number, setter: (val: number) => void, duration: number = 1500) => {
      const startTime = performance.now();
      const animate = (currentTime: number) => {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        setter(Math.floor(target * eased));
        if (progress < 1) {
          requestAnimationFrame(animate);
        } else {
          setter(target);
        }
      };
      requestAnimationFrame(animate);
    };

    animateCounter(stats.students || 0, (v) => setAnimatedStats(prev => ({ ...prev, students: v })));
    animateCounter(Math.round((stats.rating || 0) * 10), (v) => setAnimatedStats(prev => ({ ...prev, rating: v / 10 })), 1000);
    animateCounter(stats.reviews || 0, (v) => setAnimatedStats(prev => ({ ...prev, reviews: v })));
    animateCounter(stats.completionRate || 0, (v) => setAnimatedStats(prev => ({ ...prev, completionRate: v })));
  }, [isVisible, stats]);

  return (
    <section
      ref={sectionRef}
      className={`relative py-8 md:py-16 ${className}`}
      aria-label="إحصائيات الثقة والشهادات"
    >
      <div className="max-w-6xl mx-auto px-4">
        {/* Stats Grid */}
        <div
          className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 mb-10"
          role="list"
          aria-label="إحصائيات المنصة"
        >
          {[
            {
              key: 'students',
              icon: 'group',
              value: animatedStats.students,
              suffix: '+',
              label: 'طالب مسجل',
              delay: 0,
              formatter: (v: number) => v.toLocaleString(),
            },
            {
              key: 'rating',
              icon: 'star',
              value: animatedStats.rating,
              label: 'متوسط التقييم',
              delay: 1,
              formatter: (v: number) => v.toFixed(1),
            },
            {
              key: 'reviews',
              icon: 'comment',
              value: animatedStats.reviews,
              suffix: '+',
              label: 'مراجعة حقيقية',
              delay: 2,
              formatter: (v: number) => v.toLocaleString(),
            },
            {
              key: 'completion',
              icon: 'school',
              value: animatedStats.completionRate,
              suffix: '%',
              label: 'معدل الإكمال',
              delay: 3,
              formatter: (v: number) => v.toString(),
            },
          ].map((stat, index) => (
            <div
              key={stat.key}
              className="group relative text-center p-4 md:p-6 rounded-md3-md bg-[var(--md-sys-color-surface-container)] border border-[var(--md-sys-color-outline-variant)] animate-fade-up transition-all duration-300 hover:shadow-lg"
              style={{
                animationDelay: `${stat.delay * 0.1}s`,
                animationFillMode: 'both',
              }}
              role="listitem"
            >
              <div
                className="inline-flex items-center justify-center w-14 h-14 md:w-16 md:h-16 rounded-md3-md mb-3 mx-auto transition-all duration-500 group-hover:scale-110"
                style={{
                  background: `linear-gradient(135deg, ${primaryColor}18, ${secondaryColor}18)`,
                }}
                aria-hidden="true"
              >
                <span className="material-symbols-outlined text-[var(--md-sys-color-primary)]" style={{ fontSize: '2rem' }}>
                  {stat.icon}
                </span>
              </div>

              <div className="mb-1">
                <span
                  className="text-3xl md:text-4xl font-extrabold"
                  style={{ color: 'var(--md-sys-color-primary)' }}
                >
                  {stat.formatter(stat.value)}
                  <span className="text-xl md:text-2xl font-bold" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>
                    {stat.suffix || ''}
                  </span>
                </span>
              </div>

              <p className="text-sm md:text-base font-medium" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>
                {stat.label}
              </p>

              <div
                className="absolute inset-0 rounded-md3-md opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
                style={{
                  background: `linear-gradient(135deg, ${primaryColor}08, ${secondaryColor}08)`,
                }}
                aria-hidden="true"
              />
            </div>
          ))}
        </div>

        {/* Badges Row */}
        <div
          className="flex flex-wrap items-center justify-center gap-3 md:gap-4 mb-10"
          role="list"
          aria-label="شارات الاعتماد والمميزات"
        >
          {badges.map((badge, index) => (
            <div
              key={index}
              className="group inline-flex items-center gap-2 px-4 py-2.5 rounded-md3-md bg-[var(--md-sys-color-secondary-container)] transition-all duration-300 hover:scale-105 animate-fade-up"
              style={{
                animationDelay: `${(index + 4) * 0.1}s`,
                animationFillMode: 'both',
              }}
              role="listitem"
            >
              <span className="material-symbols-outlined" style={{ color: badge.color || 'var(--md-sys-color-on-secondary-container)', fontSize: '1.25rem' }} aria-hidden="true">
                {badge.icon}
              </span>
              <span className="text-sm font-bold whitespace-nowrap" style={{ color: 'var(--md-sys-color-on-secondary-container)' }}>
                {badge.label}
              </span>
            </div>
          ))}
        </div>

        {/* Testimonials Carousel */}
        {testimonials.length > 0 && (
          <div className="relative" aria-label="آراء الطلاب">
            <h3 className="text-center text-lg md:text-xl font-bold mb-8" style={{ color: 'var(--md-sys-color-on-surface)' }}>
              <span style={{ color: 'var(--md-sys-color-primary)' }}>ماذا يقول طلابنا</span>
            </h3>

            <div
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
              role="list"
            >
              {testimonials.map((testimonial, index) => (
                <article
                  key={index}
                  className="group relative p-5 md:p-6 rounded-md3-md bg-[var(--md-sys-color-surface-container)] border border-[var(--md-sys-color-outline-variant)] animate-fade-up transition-all duration-500 hover:shadow-xl hover:-translate-y-1"
                  style={{
                    animationDelay: `${index * 0.1}s`,
                    animationFillMode: 'both',
                  }}
                  role="listitem"
                >
                  <div className="flex items-center gap-1 mb-3" aria-label={`تقييم ${testimonial.rating} من 5`}>
                    {[1, 2, 3, 4, 5].map((star) => (
                      <span
                        key={star}
                        className="material-symbols-outlined transition-colors"
                        style={{
                          color: star <= testimonial.rating ? '#fbbf24' : 'var(--md-sys-color-outline-variant)',
                          fontSize: '1.25rem',
                          fontVariationSettings: star <= testimonial.rating ? "'FILL' 1" : "'FILL' 0",
                        }}
                        aria-hidden="true"
                      >
                        star
                      </span>
                    ))}
                  </div>

                  <blockquote className="text-sm md:text-base leading-relaxed mb-4" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>
                    &ldquo;{testimonial.content}&rdquo;
                  </blockquote>

                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 md:w-12 md:h-12 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
                      style={{
                        background: `linear-gradient(135deg, ${primaryColor}, ${secondaryColor})`,
                      }}
                      aria-hidden="true"
                    >
                      {testimonial.avatar || testimonial.name.charAt(0)}
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-sm truncate" style={{ color: 'var(--md-sys-color-on-surface)' }}>
                        {testimonial.name}
                      </p>
                      {testimonial.role && (
                        <p className="text-xs truncate" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>
                          {testimonial.role}
                        </p>
                      )}
                    </div>
                  </div>

                  <div
                    className="absolute top-4 left-4 opacity-5 pointer-events-none"
                    style={{ color: 'var(--md-sys-color-primary)' }}
                    aria-hidden="true"
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '4rem' }}>format_quote</span>
                  </div>
                </article>
              ))}
            </div>
          </div>
        )}

        {/* Trust CTA Line */}
        <div className="relative mt-8 md:mt-12">
          <div className="relative px-4 py-6 md:py-8 rounded-md3-md text-center bg-[var(--md-sys-color-surface-container-high)] border border-[var(--md-sys-color-outline-variant)]">
            <div className="relative z-10 flex flex-col md:flex-row items-center justify-center gap-4 flex-wrap">
              <div className="flex items-center justify-center gap-3 text-sm" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>
                <span className="material-symbols-outlined" style={{ fontSize: '1.125rem' }} aria-hidden="true">shield</span>
                <span>ضمان استرداد الأموال خلال 14 يوماً</span>
                <span aria-hidden="true">•</span>
                <span>دعم فني متواصل</span>
                <span aria-hidden="true">•</span>
                <span>تحديثات مدى الحياة</span>
              </div>

              <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>
                <span className="material-symbols-outlined" style={{ fontSize: '1rem' }} aria-hidden="true">handshake</span>
                <span>بالتعاون مع</span>
                <span className="font-bold" style={{ color: 'var(--md-sys-color-primary)' }}>HIMS</span>
                <span>و</span>
                <span className="font-bold" style={{ color: 'var(--md-sys-color-primary)' }}>وحدة التدريب و التطوير</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* Compact version for inline use */
export function CompactTrustBar({
  students = 12400,
  rating = 4.9,
  reviews = 847,
  className = '',
}: {
  students?: number;
  rating?: number;
  reviews?: number;
  className?: string;
}) {
  const { primaryColor } = useBranding();

  return (
    <div
      className={`flex flex-wrap items-center justify-center gap-4 md:gap-6 p-4 rounded-md3-md bg-[var(--md-sys-color-surface-container)] border border-[var(--md-sys-color-outline-variant)] ${className}`}
      role="list"
      aria-label="إحصائيات سريعة"
    >
      <div className="flex items-center gap-2" role="listitem">
        <span className="material-symbols-outlined text-[var(--md-sys-color-primary)]" style={{ fontSize: '1.25rem' }} aria-hidden="true">group</span>
        <span className="font-bold" style={{ color: 'var(--md-sys-color-primary)' }}>{students.toLocaleString()}+</span>
        <span style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>طلاب</span>
      </div>

      <div className="flex items-center gap-1 w-px h-8" style={{ backgroundColor: 'var(--md-sys-color-outline-variant)' }} aria-hidden="true" />

      <div className="flex items-center gap-2" role="listitem">
        <span className="material-symbols-outlined text-[var(--md-sys-color-primary)]" style={{ fontSize: '1.25rem' }} aria-hidden="true">star</span>
        <span className="font-bold" style={{ color: 'var(--md-sys-color-primary)' }}>{rating}</span>
        <span style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>متوسط التقييم</span>
      </div>

      <div className="flex items-center gap-1 w-px h-8" style={{ backgroundColor: 'var(--md-sys-color-outline-variant)' }} aria-hidden="true" />

      <div className="flex items-center gap-2" role="listitem">
        <span className="material-symbols-outlined text-[var(--md-sys-color-primary)]" style={{ fontSize: '1.25rem' }} aria-hidden="true">comment</span>
        <span className="font-bold" style={{ color: 'var(--md-sys-color-primary)' }}>{reviews.toLocaleString()}+</span>
        <span style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>مراجعة</span>
      </div>
    </div>
  );
}
