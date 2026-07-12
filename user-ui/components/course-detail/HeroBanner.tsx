'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { useBranding } from '../BrandingProvider';

interface HeroBannerProps {
  course: {
    title_ar: string;
    title_en?: string;
    image_url?: string;
    category_name_ar?: string;
    instructor?: string;
    price: number;
    featured?: number;
    course_mode?: 'online' | 'offline';
    lecture_count?: number;
    lecture_duration?: number;
    max_students?: number;
  };
  isLoading?: boolean;
  className?: string;
}

export function HeroBanner({ course, isLoading }: HeroBannerProps) {
  const { primaryColor, secondaryColor, sloganAr } = useBranding();
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollY, setScrollY] = useState(0);
  const [isVisible, setIsVisible] = useState(false);

  // Parallax scroll effect
  useEffect(() => {
    const handleScroll = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const scrollProgress = Math.max(0, Math.min(1, -rect.top / rect.height));
        setScrollY(scrollProgress * 100);
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Entrance animation
  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), 100);
    return () => clearTimeout(timer);
  }, []);

  if (isLoading) {
    return (
      <div
        ref={containerRef}
        className="relative overflow-hidden"
        style={{ height: '28rem', maxHeight: '40vh' }}
        aria-busy="true"
        aria-label="جاري تحميل صورة الكورس"
      >
        <div className="absolute inset-0 skeleton" style={{ backgroundColor: 'var(--surface)' }} />
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 h-1/2 bg-gradient-to-t from-black/60 to-transparent" />
      </div>
    );
  }

  const gradientStyle = {
    background: `linear-gradient(135deg, ${primaryColor} 0%, ${secondaryColor} 100%)`,
  } as React.CSSProperties;

  const parallaxTransform = `translateY(${scrollY * 0.3}px) scale(${1 + scrollY * 0.0005})`;
  const overlayOpacity = Math.min(0.6, 0.3 + scrollY * 0.003);

  return (
    <section
      ref={containerRef}
      className="relative overflow-hidden"
      style={{ height: '28rem', maxHeight: '40vh' }}
      aria-labelledby="course-title"
    >
      {/* Background Layer */}
      <div
        className="absolute inset-0 transition-all duration-700 ease-out will-change-transform"
        style={{
          transform: parallaxTransform,
          ...(course.image_url ? {} : gradientStyle),
        }}
        aria-hidden="true"
      >
        {course.image_url ? (
          <Image
            src={course.image_url}
            alt=""
            fill
            priority
            sizes="100vw"
            className="object-cover transition-all duration-700 ease-out"
            style={{ filter: `brightness(0.9) saturate(1.1)` }}
          />
        ) : (
          <>
            {/* Animated gradient mesh */}
            <div
              className="absolute inset-0"
              style={{
                background: `radial-gradient(ellipse at 30% 20%, ${primaryColor}40 0%, transparent 50%),
                           radial-gradient(ellipse at 70% 80%, ${secondaryColor}30 0%, transparent 50%),
                           radial-gradient(ellipse at 50% 50%, ${primaryColor}20 0%, transparent 40%)`,
                animation: 'gradient-shift 12s ease-in-out infinite',
                backgroundSize: '400% 400%',
              }}
            />

            {/* Floating decorative elements */}
            <div className="absolute inset-0" aria-hidden="true">
              {[1, 2, 3, 4, 5].map((i) => (
                <div
                  key={i}
                  className="absolute rounded-full opacity-10 animate-float-slow"
                  style={{
                    width: `${[80, 60, 100, 40, 70][i - 1]}px`,
                    height: `${[80, 60, 100, 40, 70][i - 1]}px`,
                    left: `${[10, 80, 20, 70, 40][i - 1]}%`,
                    top: `${[15, 70, 40, 10, 85][i - 1]}%`,
                    backgroundColor: i % 2 === 0 ? primaryColor : secondaryColor,
                    animationDelay: `${i * 1.5}s`,
                    animationDuration: `${15 + i * 2}s`,
                  }}
                />
              ))}
            </div>

            {/* Course initial letter */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <span
                className="text-9xl md:text-[12rem] font-extrabold text-white/10"
                style={{
                  textShadow: `0 0 60px ${primaryColor}60, 0 0 120px ${secondaryColor}40`,
                  fontFamily: 'var(--font-sans)',
                }}
                aria-hidden="true"
              >
                {course.title_ar.charAt(0)}
              </span>
            </div>
          </>
        )}

        {/* Dark overlay for text readability */}
        <div
          className="absolute inset-0 transition-opacity duration-300"
          style={{
            background: `linear-gradient(
              180deg,
              rgba(0,0,0,${0.2 + overlayOpacity * 0.2}) 0%,
              rgba(0,0,0,${0.1 + overlayOpacity * 0.1}) 50%,
              rgba(0,0,0,${0.4 + overlayOpacity * 0.2}) 100%
            )`,
          }}
          aria-hidden="true"
        />
      </div>

      {/* Floating particles */}
      <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div
            key={i}
            className="absolute w-1.5 h-1.5 rounded-full animate-float-slow"
            style={{
              left: `${[5, 15, 85, 90, 30, 70][i - 1]}%`,
              top: `${[20, 60, 30, 80, 10, 75][i - 1]}%`,
              backgroundColor: i % 3 === 0 ? '#fbbf24' : 'rgba(255,255,255,0.6)',
              opacity: [0.4, 0.3, 0.5, 0.2, 0.4, 0.3][i - 1],
              animationDelay: `${i * 1.2}s`,
              animationDuration: `${12 + i * 1.5}s`,
              boxShadow: `0 0 20px ${i % 3 === 0 ? '#fbbf24' : 'rgba(255,255,255,0.4)'}`,
            }}
          />
        ))}
      </div>

      {/* Content Layer */}
      <div className="relative z-10 h-full flex flex-col">
        {/* Top Bar - Back button & Featured badge */}
        <div className="flex items-start justify-between p-4 md:p-6">
          {/* Back Button */}
          <a
            href="/courses"
            className="group inline-flex items-center gap-2 px-4 py-2 rounded-xl glass-strong text-white text-sm font-medium transition-all duration-300 hover:scale-105 hover:bg-white/20 animate-fade-down stagger-1"
            style={{ borderColor: 'rgba(255,255,255,0.2)' }}
          >
            <svg
              className="w-5 h-5 transition-transform duration-300 group-hover:-translate-x-1"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            <span>العودة للكورسات</span>
          </a>

          {/* Featured Badge */}
          {Number(course.featured) === 1 && (
            <span className="animate-fade-down stagger-2 inline-flex items-center gap-1.5 px-3 px-3 py-1.5 rounded-full text-xs font-bold text-white backdrop-blur-sm" style={{ backgroundColor: 'rgba(251,191,36,0.9)' }}>
              <span aria-hidden="true">⭐</span>
              مميز
            </span>
          )}

          {/* Mode Badge */}
          {course.course_mode && (
            <span className="animate-fade-down stagger-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold text-white glass-strong" style={{ borderColor: 'rgba(255,255,255,0.2)' }}>
              {course.course_mode === 'offline' ? (
                <>
                  <span aria-hidden="true">🏫</span>
                  حضوري
                </>
              ) : (
                <>
                  <span aria-hidden="true">💻</span>
                  أونلاين
                </>
              )}
            </span>
          )}
        </div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col justify-end p-4 md:p-6 pb-8">
          <div className="max-w-4xl mx-auto w-full animate-slide-up" style={{ animationDelay: '0.3s' }}>
            {/* Category Tag */}
            {course.category_name_ar && (
              <span className="inline-block px-4 py-1.5 rounded-full text-xs font-extrabold tracking-wider mb-4 animate-fade-up stagger-3 glass-strong" style={{ borderColor: 'rgba(255,255,255,0.2)' }}>
                {course.category_name_ar}
              </span>
            )}

            {/* Title */}
            <h1
              id="course-title"
              className="text-3xl md:text-4xl lg:text-5xl font-extrabold text-white leading-tight mb-4 animate-fade-up stagger-4 text-balance"
              style={{
                textShadow: '0 4px 20px rgba(0,0,0,0.3), 0 0 60px rgba(0,0,0,0.2)',
                fontFamily: 'var(--font-sans)',
              }}
            >
              {course.title_ar}
            </h1>

            {/* English Title */}
            {course.title_en && (
              <p className="text-lg md:text-xl text-white/80 mb-6 animate-fade-up stagger-5 font-medium" style={{ fontFamily: 'var(--font-sans)' }}>
                {course.title_en}
              </p>
            )}

            {/* Meta Info Row */}
            <div className="flex flex-wrap items-center gap-3 md:gap-5 mb-6 animate-fade-up stagger-6">
              {course.instructor && (
                <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl glass-strong text-white/90 text-sm font-medium" style={{ borderColor: 'rgba(255,255,255,0.2)' }}>
                  <span aria-hidden="true">🧑‍🏫</span>
                  <span>{course.instructor}</span>
                </span>
              )}

              {course.lecture_count && course.lecture_count > 0 && (
                <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl glass-strong text-white/90 text-sm font-medium" style={{ borderColor: 'rgba(255,255,255,0.2)' }}>
                  <span aria-hidden="true">📚</span>
                  <span>{course.lecture_count} محاضرة</span>
                </span>
              )}

              {course.lecture_duration && course.lecture_duration > 0 && (
                <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl glass-strong text-white/90 text-sm font-medium" style={{ borderColor: 'rgba(255,255,255,0.2)' }}>
                  <span aria-hidden="true">⏱</span>
                  <span>{course.lecture_duration} ساعة محتوى</span>
                </span>
              )}

              {course.max_students && (
                <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl glass-strong text-white/90 text-sm font-medium" style={{ borderColor: 'rgba(255,255,255,0.2)' }}>
                  <span aria-hidden="true">👥</span>
                  <span>حد أقصى {course.max_students} طالب</span>
                </span>
              )}
            </div>

            {/* Slogan / Trust line */}
            <div className="flex items-center justify-center gap-3 md:gap-6 pt-4 animate-fade-up stagger-7" style={{ borderTop: '1px solid rgba(255,255,255,0.15)' }}>
              <span className="flex items-center gap-2 text-white/70 text-sm font-medium" style={{ fontFamily: 'var(--font-sans)' }}>
                <span aria-hidden="true">🏷️</span>
                {sloganAr}
              </span>
              <span className="flex items-center gap-2 text-white/70 text-sm font-medium" style={{ fontFamily: 'var(--font-sans)' }}>
                <span aria-hidden="true">🤝</span>
                بالتعاون مع HIMS
              </span>
            </div>
          </div>
        </div>

        {/* Bottom Gradient Fade */}
        <div
          className="absolute bottom-0 left-0 right-0 h-32 pointer-events-none"
          style={{
            background: `linear-gradient(180deg, transparent 0%, var(--bg) 100%)`,
          }}
          aria-hidden="true"
        />
      </div>
    </section>
  );
}

/* Mini Hero Banner for when used inline */
export function MiniHeroBanner({
  course,
  className = '',
}: HeroBannerProps) {
  const { primaryColor, secondaryColor } = useBranding();

  const gradientStyle = {
    background: `linear-gradient(135deg, ${primaryColor} 0%, ${secondaryColor} 100%)`,
  } as React.CSSProperties;

  return (
    <div
      className={`relative rounded-2xl overflow-hidden ${className}`}
      style={{ height: '20rem', maxHeight: '320px' }}
      aria-label={course.title_ar}
    >
      <div className="absolute inset-0" style={{ ...gradientStyle }}>
        {course.image_url ? (
          <Image
            src={course.image_url}
            alt={course.title_ar}
            fill
            priority
            sizes="100vw"
            className="object-cover"
            style={{ opacity: 0.9 }}
          />
        ) : null}
        <div className="absolute inset-0 bg-gradient-to-r from-black/50 via-black/30 to-transparent" />
      </div>

      <div className="relative z-10 h-full flex flex-col justify-end p-6">
        <div className="max-w-3xl">
          {course.category_name_ar && (
            <span className="inline-block px-3 py-1 rounded-full text-xs font-bold text-white/90 mb-3 glass-strong" style={{ borderColor: 'rgba(255,255,255,0.2)' }}>
              {course.category_name_ar}
            </span>
          )}
          <h2 className="text-2xl md:text-3xl lg:text-4xl font-extrabold text-white mb-2 leading-tight" style={{ textShadow: '0 2px 10px rgba(0,0,0,0.3)' }}>
            {course.title_ar}
          </h2>
          <div className="flex flex-wrap items-center gap-3 text-white/80 text-sm">
            {course.instructor && <span className="flex items-center gap-1">🧑‍🏫 {course.instructor}</span>}
            {course.lecture_count && <span className="flex items-center gap-1">📚 {course.lecture_count} محاضرة</span>}
            {course.lecture_duration && <span className="flex items-center gap-1">⏱ {course.lecture_duration} ساعة</span>}
          </div>
        </div>
      </div>
    </div>
  );
}