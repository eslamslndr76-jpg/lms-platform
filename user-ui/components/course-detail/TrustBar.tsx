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
    { icon: '🏆', label: 'أفضل تقييم', color: '#f59e0b' },
    { icon: '📜', label: 'شهادة معتمدة', color: '#16a34a' },
    { icon: '🤝', label: 'شراكة HIMS', color: '#7c3aed' },
    { icon: '🔄', label: 'تحديثات مجانية', color: '#2563eb' },
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

  // Intersection Observer for scroll animation
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

  // Animate counters when visible
  useEffect(() => {
    if (!isVisible) return;

    const animateCounter = (target: number, setter: (val: number) => void, duration: number = 1500) => {
      const startTime = performance.now();
      const animate = (currentTime: number) => {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3); // easeOutCubic
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
      style={{
        background: `linear-gradient(180deg, transparent 0%, ${primaryColor}08 50%, transparent 100%)`,
      }}
    >
      {/* Top decorative line */}
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-px pointer-events-none"
        style={{
          background: `linear-gradient(90deg, transparent, ${primaryColor}, transparent)`,
        }}
        aria-hidden="true"
      />

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
              icon: '👥',
              value: animatedStats.students,
              suffix: '+',
              label: 'طالب مسجل',
              delay: 0,
              formatter: (v: number) => v.toLocaleString(),
            },
            {
              key: 'rating',
              icon: '⭐',
              value: animatedStats.rating,
              label: 'متوسط التقييم',
              delay: 1,
              formatter: (v: number) => v.toFixed(1),
            },
            {
              key: 'reviews',
              icon: '💬',
              value: animatedStats.reviews,
              suffix: '+',
              label: 'مراجعة حقيقية',
              delay: 2,
              formatter: (v: number) => v.toLocaleString(),
            },
            {
              key: 'completion',
              icon: '🎓',
              value: animatedStats.completionRate,
              suffix: '%',
              label: 'معدل الإكمال',
              delay: 3,
              formatter: (v: number) => v.toString(),
            },
          ].map((stat, index) => (
            <div
              key={stat.key}
              className="group relative text-center p-4 md:p-6 rounded-2xl glass-card animate-fade-up"
              style={{
                animationDelay: `${stat.delay * 0.1}s`,
                animationFillMode: 'both',
              }}
              role="listitem"
            >
              {/* Icon with glow */}
              <div
                className="inline-flex items-center justify-center w-14 h-14 md:w-16 md:h-16 rounded-2xl mb-3 mx-auto transition-all duration-500 group-hover:scale-110"
                style={{
                  background: `linear-gradient(135deg, ${primaryColor}15, ${secondaryColor}15)`,
                  boxShadow: `0 0 30px ${primaryColor}20`,
                }}
                aria-hidden="true"
              >
                <span className="text-2xl md:text-3xl" style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))' }}>
                  {stat.icon}
                </span>
              </div>

              {/* Animated Number */}
              <div className="mb-1">
                <span
                  className="text-3xl md:text-4xl font-extrabold gradient-text"
                  style={{
                    background: `linear-gradient(135deg, ${primaryColor}, ${secondaryColor})`,
                  }}
                >
                  {stat.formatter(stat.value)}
                  <span className="text-xl md:text-2xl font-bold" style={{ color: 'var(--text-muted)' }}>
                    {stat.suffix || ''}
                  </span>
                </span>
              </div>

              {/* Label */}
              <p className="text-sm md:text-base font-medium" style={{ color: 'var(--text-secondary)' }}>
                {stat.label}
              </p>

              {/* Hover shine effect */}
              <div
                className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
                style={{
                  background: `linear-gradient(135deg, ${primaryColor}10, ${secondaryColor}10)`,
                }}
                aria-hidden="true"
              />
            </div>
          ))}

          {/* Connecting lines between stats (desktop only) */}
          <div className="hidden md:block absolute top-1/2 left-1/4 right-1/4 h-px pointer-events-none -translate-y-1/2" aria-hidden="true">
            <div className="w-full h-full" style={{
              background: `linear-gradient(90deg, transparent, ${primaryColor}30, transparent)`,
            }} />
          </div>
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
              className="group inline-flex items-center gap-2 px-4 py-2.5 rounded-xl glass-strong transition-all duration-300 hover:scale-105 animate-fade-up"
              style={{
                animationDelay: `${(index + 4) * 0.1}s`,
                animationFillMode: 'both',
                borderColor: `${badge.color || primaryColor}30`,
              }}
              role="listitem"
            >
              <span
                className="text-lg transition-transform duration-300 group-hover:rotate-12"
                aria-hidden="true"
              >
                {badge.icon}
              </span>
              <span className="text-sm font-bold whitespace-nowrap" style={{ color: 'var(--text)' }}>
                {badge.label}
              </span>
              <div
                className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-0 h-0.5 transition-all duration-300 group-hover:w-3/4"
                style={{
                  backgroundColor: badge.color || primaryColor,
                  borderRadius: 'var(--radius-full)',
                }}
                aria-hidden="true"
              />
            </div>
          ))}
        </div>

        {/* Testimonials Carousel (if provided) */}
        {testimonials.length > 0 && (
          <div className="relative" aria-label="آراء الطلاب">
            <h3 className="text-center text-lg md:text-xl font-bold mb-8" style={{ color: 'var(--text)' }}>
              <span className="gradient-text">ماذا يقول طلابنا</span>
            </h3>

            <div
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
              role="list"
            >
              {testimonials.map((testimonial, index) => (
                <article
                  key={index}
                  className="group relative p-5 md:p-6 rounded-2xl glass-card animate-fade-up transition-all duration-500 hover:shadow-xl hover:-translate-y-1"
                  style={{
                    animationDelay: `${index * 0.1}s`,
                    animationFillMode: 'both',
                    borderColor: 'var(--glass-border)',
                  }}
                  role="listitem"
                >
                  {/* Rating */}
                  <div className="flex items-center gap-1 mb-3" aria-label={`تقييم ${testimonial.rating} من 5`}>
                    {[1, 2, 3, 4, 5].map((star) => (
                      <span
                        key={star}
                        className="text-lg transition-colors"
                        style={{
                          color: star <= testimonial.rating ? '#fbbf24' : 'var(--border)',
                          filter: star <= testimonial.rating ? 'drop-shadow(0 1px 2px rgba(251,191,36,0.4))' : 'none',
                        }}
                        aria-hidden="true"
                      >
                        ★
                      </span>
                    ))}
                  </div>

                  {/* Content */}
                  <blockquote className="text-sm md:text-base leading-relaxed mb-4" style={{ color: 'var(--text-secondary)' }}>
                    &ldquo;{testimonial.content}&rdquo;
                  </blockquote>

                  {/* Author */}
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
                      <p className="font-bold text-sm truncate" style={{ color: 'var(--text)' }}>
                        {testimonial.name}
                      </p>
                      {testimonial.role && (
                        <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>
                          {testimonial.role}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Quote decoration */}
                  <div
                    className="absolute top-4 left-4 text-6xl opacity-5 pointer-events-none"
                    style={{ color: primaryColor }}
                    aria-hidden="true"
                  >
                    &ldquo;
                  </div>
                </article>
              ))}
            </div>
          </div>
        )}

        {/* Trust CTA Line */}
        <div className="relative mt-8 md:mt-12">
          <div className="relative px-4 py-6 md:py-8 rounded-2xl text-center glass-strong" style={{
            background: `linear-gradient(135deg, ${primaryColor}15, ${secondaryColor}15)`,
            borderColor: `${primaryColor}30`,
          }}>
            {/* Animated border */}
            <div
              className="absolute inset-0 rounded-2xl pointer-events-none"
              style={{
                border: `1px solid ${primaryColor}30`,
                background: `linear-gradient(135deg, ${primaryColor}05, ${secondaryColor}05)`,
              }}
              aria-hidden="true"
            />

            <div className="relative z-10 flex flex-col md:flex-row items-center justify-center gap-4 flex-wrap">
              <div className="flex items-center justify-center gap-3 text-sm" style={{ color: 'var(--text-muted)' }}>
                <span aria-hidden="true">🛡️</span>
                <span>ضمان استرداد الأموال خلال 14 يوماً</span>
                <span aria-hidden="true">•</span>
                <span>دعم فني متواصل</span>
                <span aria-hidden="true">•</span>
                <span>تحديثات مدى الحياة</span>
              </div>

              <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-light)' }}>
                <span aria-hidden="true">🤝</span>
                <span>بالتعاون مع</span>
                <span className="font-bold gradient-text">HIMS</span>
                <span>و</span>
                <span className="font-bold gradient-text">نادي ريادة الأعمال</span>
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
      className={`flex flex-wrap items-center justify-center gap-4 md:gap-6 p-4 rounded-2xl glass-card ${className}`}
      role="list"
      aria-label="إحصائيات سريعة"
    >
      <div className="flex items-center gap-2" role="listitem">
        <span className="text-lg" aria-hidden="true">👥</span>
        <span className="font-bold gradient-text">{students.toLocaleString()}+</span>
        <span style={{ color: 'var(--text-muted)' }}>طلاب</span>
      </div>

      <div className="flex items-center gap-1 w-px h-8" style={{ backgroundColor: 'var(--border)' }} aria-hidden="true" />

      <div className="flex items-center gap-2" role="listitem">
        <span className="text-lg" aria-hidden="true">⭐</span>
        <span className="font-bold gradient-text">{rating}</span>
        <span style={{ color: 'var(--text-muted)' }}>متوسط التقييم</span>
      </div>

      <div className="flex items-center gap-1 w-px h-8" style={{ backgroundColor: 'var(--border)' }} aria-hidden="true" />

      <div className="flex items-center gap-2" role="listitem">
        <span className="text-lg" aria-hidden="true">💬</span>
        <span className="font-bold gradient-text">{reviews.toLocaleString()}+</span>
        <span style={{ color: 'var(--text-muted)' }}>مراجعة</span>
      </div>
    </div>
  );
}