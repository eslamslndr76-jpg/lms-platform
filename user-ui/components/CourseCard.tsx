'use client';

import Link from 'next/link';
import { useBranding } from './BrandingProvider';
import { GlareCard } from './ui/glare-card';

interface Course {
  id: number;
  title_ar: string;
  title_en: string;
  description?: string;
  price: number;
  image_url?: string;
  category_name_ar?: string;
  instructor?: string;
  course_mode?: string;
  lecture_count?: number;
  lecture_duration?: number;
  group_max?: number;
  group_current?: number;
}

function CourseFallbackIllustration({ seed, courseMode: _courseMode }: { seed: number; courseMode?: string }) {
  const variant = Math.abs(seed) % 3;
  const viewBox = '0 0 180 130';
  const sw = 1.8;
  const sc = 'rgba(255,255,255,0.35)';
  const sc2 = 'rgba(255,255,255,0.20)';
  const sf = 'rgba(255,255,255,0.12)';
  const sf2 = 'rgba(255,255,255,0.08)';

  if (variant === 0) {
    return (
      <svg viewBox={viewBox} className="absolute inset-0 w-full h-full p-4" xmlns="http://www.w3.org/2000/svg">
        {/* Open Book base */}
        <path d="M50 90 C50 78 78 72 90 72 C102 72 130 78 130 90 L130 100 C130 100 102 92 90 92 C78 92 50 100 50 100Z" fill={sf} stroke={sc} strokeWidth={sw} />
        {/* Book spine */}
        <line x1="90" y1="72" x2="90" y2="100" stroke={sc2} strokeWidth={sw} />
        {/* Book pages left */}
        <path d="M50 90 C50 85 65 80 78 80 M50 95 C55 90 68 87 78 86" stroke={sc2} strokeWidth="1" fill="none" />
        {/* Book pages right */}
        <path d="M130 90 C130 85 115 80 102 80 M130 95 C125 90 112 87 102 86" stroke={sc2} strokeWidth="1" fill="none" />
        {/* Pencil */}
        <line x1="38" y1="75" x2="48" y2="88" stroke={sc} strokeWidth="2" strokeLinecap="round" />
        <line x1="35" y1="78" x2="38" y2="75" stroke={sc} strokeWidth="1.5" strokeLinecap="round" />
        {/* Eraser */}
        <rect x="34" y="79" width="3" height="5" rx="0.5" fill={sf2} stroke={sc2} strokeWidth="0.8" />
        {/* Graduation Cap */}
        <polygon points="90,46 115,58 90,68 65,58" fill={sf} stroke={sc} strokeWidth={sw} />
        <polygon points="65,58 90,50 115,58 90,62" fill={sf2} />
        {/* Tassel */}
        <line x1="90" y1="68" x2="85" y2="80" stroke={sc} strokeWidth="1.2" />
        <circle cx="85" cy="82" r="1.5" fill={sc} />
        {/* Star */}
        <polygon points="90,28 92.5,35 100,35 94,40 96,48 90,43 84,48 86,40 80,35 87.5,35" fill={sc} />
      </svg>
    );
  }

  if (variant === 1) {
    return (
      <svg viewBox={viewBox} className="absolute inset-0 w-full h-full p-4" xmlns="http://www.w3.org/2000/svg">
        {/* Steps / Staircase */}
        <rect x="40" y="100" width="100" height="6" rx="2" fill={sf} stroke={sc2} strokeWidth="0.8" />
        <rect x="50" y="88" width="80" height="6" rx="2" fill={sf} stroke={sc2} strokeWidth="0.8" />
        <rect x="62" y="76" width="56" height="6" rx="2" fill={sf} stroke={sc2} strokeWidth="0.8" />
        <rect x="76" y="64" width="28" height="6" rx="2" fill={sf} stroke={sc2} strokeWidth="0.8" />
        {/* Person on top */}
        {/* Head */}
        <circle cx="90" cy="50" r="7" fill={sf} stroke={sc} strokeWidth={sw} />
        {/* Body */}
        <path d="M83 58 L97 58 L94 70 L86 70Z" fill={sf} stroke={sc} strokeWidth={sw} />
        {/* Arms raised */}
        <line x1="83" y1="60" x2="76" y2="52" stroke={sc} strokeWidth={sw} strokeLinecap="round" />
        <line x1="97" y1="60" x2="104" y2="52" stroke={sc} strokeWidth={sw} strokeLinecap="round" />
        {/* Achievement Star above */}
        <polygon points="90,20 92,28 100,28 94,33 96,42 90,37 84,42 86,33 80,28 88,28" fill="rgba(255,255,255,0.5)" />
        {/* Sparkle dots */}
        <circle cx="105" cy="22" r="1.5" fill={sc2} />
        <circle cx="75" cy="26" r="1" fill={sc2} />
        <circle cx="110" cy="38" r="1.2" fill={sc2} />
      </svg>
    );
  }

  // variant 2: Lightbulb + Knowledge
  return (
    <svg viewBox={viewBox} className="absolute inset-0 w-full h-full p-4" xmlns="http://www.w3.org/2000/svg">
      {/* Lightbulb body */}
      <path d="M90 28 C74 28 64 40 64 52 C64 62 70 68 76 72 L76 80 L104 80 L104 72 C110 68 116 62 116 52 C116 40 106 28 90 28Z" fill={sf} stroke={sc} strokeWidth={sw} />
      {/* Bulb inner glow */}
      <ellipse cx="90" cy="48" rx="16" ry="12" fill={sf2} opacity="0.5" />
      {/* Filament */}
      <path d="M86 55 L90 61 L94 55" stroke={sc} strokeWidth="1.2" fill="none" />
      {/* Base of bulb */}
      <rect x="84" y="80" width="12" height="3" rx="1" fill={sf2} stroke={sc2} strokeWidth="0.8" />
      <rect x="86" y="83" width="8" height="2" rx="0.8" fill={sf2} stroke={sc2} strokeWidth="0.8" />
      {/* Light rays */}
      <line x1="90" y1="18" x2="90" y2="12" stroke={sc} strokeWidth={sw} strokeLinecap="round" />
      <line x1="110" y1="26" x2="116" y2="22" stroke={sc} strokeWidth={sw} strokeLinecap="round" />
      <line x1="118" y1="46" x2="126" y2="44" stroke={sc} strokeWidth={sw} strokeLinecap="round" />
      <line x1="70" y1="26" x2="64" y2="22" stroke={sc} strokeWidth={sw} strokeLinecap="round" />
      <line x1="62" y1="46" x2="54" y2="44" stroke={sc} strokeWidth={sw} strokeLinecap="round" />
      <line x1="110" y1="66" x2="116" y2="70" stroke={sc2} strokeWidth="1.2" strokeLinecap="round" />
      <line x1="70" y1="66" x2="64" y2="70" stroke={sc2} strokeWidth="1.2" strokeLinecap="round" />
      {/* Book at base */}
      <path d="M70 92 C70 86 90 84 90 84 C90 84 110 86 110 92 L110 98 C110 98 90 94 70 98Z" fill={sf} stroke={sc2} strokeWidth="0.8" />
      <line x1="90" y1="84" x2="90" y2="96" stroke={sc2} strokeWidth="0.8" />
    </svg>
  );
}

export function CourseCard({ course, index = 0 }: { course: Course; index?: number }) {
  const { primaryColor, secondaryColor } = useBranding();

  const gMax = course.group_max;
  const gCur = course.group_current;
  const hasGroup = gMax && gMax > 0;
  const pct = hasGroup ? Math.min(Math.round((gCur! / gMax!) * 100), 100) : 0;
  const isFull = hasGroup && pct >= 100;
  const isAlmostFull = hasGroup && pct >= 80 && pct < 100;

  return (
    <Link
      href={`/courses/${course.id}`}
      className="group block"
      style={{ animationDelay: `${index * 0.06}s` }}
    >
      <GlareCard
        radius="16px"
        aspectRatio="340/480"
        className="w-full"
      >
        <div className="relative flex flex-col h-full">
          {/* Image / Gradient Fallback */}
          <div className="relative h-48 overflow-hidden flex-shrink-0">
            {course.image_url ? (
              <>
                <img
                  src={course.image_url}
                  alt={course.title_ar}
                  className="w-full h-full object-cover transition-all duration-700 ease-out group-hover:scale-110"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              </>
            ) : (
              <div
                className="w-full h-full relative overflow-hidden transition-all duration-500"
                style={{
                  background: `linear-gradient(145deg, ${primaryColor} 0%, ${secondaryColor} 100%)`,
                }}
              >
                {/* Decorative floating shapes */}
                <div
                  className="absolute -top-4 -right-4 w-20 h-20 rounded-full opacity-[0.12] animate-float"
                  style={{ backgroundColor: '#ffffff', animationDelay: '0s' }}
                />
                <div
                  className="absolute -bottom-3 -left-3 w-14 h-14 rounded-full opacity-[0.10] animate-float"
                  style={{ backgroundColor: '#ffffff', animationDelay: '2s' }}
                />
                <div
                  className="absolute top-1/4 left-1/5 w-2.5 h-2.5 rounded-full opacity-[0.18]"
                  style={{ backgroundColor: '#ffffff' }}
                />
                <div
                  className="absolute bottom-1/3 right-1/5 w-2 h-2 rounded-full opacity-[0.15]"
                  style={{ backgroundColor: '#ffffff' }}
                />
                <div
                  className="absolute top-1/3 right-1/4 w-1.5 h-1.5 rounded-full opacity-[0.20]"
                  style={{ backgroundColor: '#ffffff' }}
                />

                {/* Subtle dot grid pattern */}
                <div className="absolute inset-0 opacity-[0.06]"
                  style={{
                    backgroundImage: `radial-gradient(circle, #fff 0.5px, transparent 0.5px)`,
                    backgroundSize: '16px 16px',
                  }}
                />

                {/* Glowing aura */}
                <div
                  className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-36 h-36 rounded-full opacity-[0.12]"
                  style={{
                    background: `radial-gradient(circle, rgba(255,255,255,0.4) 0%, transparent 65%)`,
                  }}
                />

                {/* SVG Illustration */}
                <CourseFallbackIllustration
                  seed={course.id}
                  courseMode={course.course_mode}
                />

                {/* Subtle inner border */}
                <div
                  className="absolute inset-[2px] rounded-2xl pointer-events-none"
                  style={{ border: '1px solid rgba(255,255,255,0.08)' }}
                />
              </div>
            )}

            {/* Price Badge */}
            <div className="absolute top-3 left-3 z-10">
              <span
                className="inline-block px-3.5 py-1.5 rounded-xl text-xs font-extrabold tracking-wide shadow-lg backdrop-blur-md"
                style={{
                  backgroundColor: course.price > 0 ? 'rgba(0,0,0,0.7)' : `${primaryColor}CC`,
                  color: '#fff',
                  backdropFilter: 'blur(8px)',
                }}
              >
                {course.price > 0 ? `${course.price.toLocaleString()} ج.م` : '🎯 مجاني'}
              </span>
            </div>

            {/* Course Mode Badge */}
            {course.course_mode && (
              <div className="absolute top-3 right-3 z-10">
                <span
                  className="inline-block px-2.5 py-1 rounded-lg text-[10px] font-bold tracking-wide shadow-lg backdrop-blur-md"
                  style={{
                    backgroundColor: 'rgba(0,0,0,0.6)',
                    color: '#fff',
                    backdropFilter: 'blur(8px)',
                  }}
                >
                  {course.course_mode === 'offline' ? '🏫 حضوري' : '💻 أونلاين'}
                </span>
              </div>
            )}

            {/* Hover Info Overlay */}
            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-500 z-10">
              <span
                className="px-5 py-2.5 rounded-xl text-sm font-bold text-white shadow-2xl transform translate-y-4 group-hover:translate-y-0 transition-all duration-500"
                style={{ backgroundColor: primaryColor }}
              >
                عرض التفاصيل
              </span>
            </div>
          </div>

          {/* Content */}
          <div className="p-4 flex flex-col flex-1 gap-2">
            {/* Category Tag */}
            {course.category_name_ar && (
              <span
                className="self-start text-[10px] px-2.5 py-1 rounded-lg font-bold tracking-wide"
                style={{
                  backgroundColor: `${secondaryColor}15`,
                  color: secondaryColor,
                }}
              >
                {course.category_name_ar}
              </span>
            )}

            {/* Title */}
            <h3
              className="font-bold text-base leading-snug transition-colors duration-300 line-clamp-2"
              style={{ color: 'var(--text)' }}
            >
              {course.title_ar}
            </h3>

            {/* Brief Description */}
            {course.description && (
              <p
                className="text-xs leading-relaxed line-clamp-2"
                style={{ color: 'var(--text-muted)' }}
              >
                {course.description.replace(/<[^>]*>/g, '').substring(0, 100)}
              </p>
            )}

            {/* Instructor */}
            {course.instructor && (
              <div className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--text-light)' }}>
                <span>🧑‍🏫</span>
                <span>{course.instructor}</span>
              </div>
            )}

            {/* Meta Row */}
            <div className="flex items-center gap-3 text-xs" style={{ color: 'var(--text-light)' }}>
              {course.lecture_count != null && course.lecture_count > 0 && (
                <span className="flex items-center gap-1">
                  <span>📚</span>
                  <span>{course.lecture_count} محاضرة</span>
                </span>
              )}
              {course.lecture_duration != null && course.lecture_duration > 0 && (
                <span className="flex items-center gap-1">
                  <span>⏱</span>
                  <span>{course.lecture_duration} ساعة</span>
                </span>
              )}
            </div>

            {/* Spacer */}
            <div className="flex-1" />

            {/* Group Fill Bar */}
            {hasGroup && (
              <div className="mt-1">
                <div className="flex items-center justify-between text-[10px] mb-1">
                  <span style={{ color: 'var(--text-light)' }}>المقاعد المتبقية</span>
                  <span
                    className="font-extrabold"
                    style={{
                      color: isFull ? '#dc2626' : isAlmostFull ? '#d97706' : '#16a34a',
                    }}
                  >
                    {isFull ? 'مكتمل' : `${gMax! - gCur!} مقعد`}
                  </span>
                </div>
                <div
                  className="w-full h-2 rounded-full overflow-hidden"
                  style={{ backgroundColor: `${isFull ? '#dc2626' : isAlmostFull ? '#d97706' : '#16a34a'}15` }}
                >
                  <div
                    className="h-full rounded-full transition-all duration-700 ease-out"
                    style={{
                      width: `${pct}%`,
                      background: isFull
                        ? 'linear-gradient(90deg, #dc2626, #ef4444)'
                        : isAlmostFull
                        ? 'linear-gradient(90deg, #d97706, #f59e0b)'
                        : 'linear-gradient(90deg, #16a34a, #22c55e)',
                    }}
                  />
                </div>
              </div>
            )}

            {/* CTA Row */}
            <div
              className="flex items-center justify-between pt-2 border-t mt-1"
              style={{ borderColor: 'var(--border)' }}
            >
              <span
                className="text-sm font-extrabold tracking-tight"
                style={{ color: primaryColor }}
              >
                {course.price > 0 ? `${course.price.toLocaleString()} ج.م` : 'مجاناً'}
              </span>
              <span
                className="text-xs font-medium transition-all duration-300 group-hover:translate-x-1"
                style={{ color: 'var(--text-muted)' }}
              >
                سجل الآن ←
              </span>
            </div>
          </div>
        </div>
      </GlareCard>
    </Link>
  );
}
