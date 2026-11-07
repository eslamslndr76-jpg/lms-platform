'use client';

import Link from 'next/link';
import { useBranding } from './BrandingProvider';

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

export function CourseCard({ course, index = 0 }: { course: Course; index?: number }) {
  const { primaryColor } = useBranding();

  const gMax = course.group_max;
  const gCur = course.group_current;
  const hasGroup = gMax && gMax > 0;
  const pct = hasGroup ? Math.min(Math.round((gCur! / gMax!) * 100), 100) : 0;
  const isFull = hasGroup && pct >= 100;
  const isAlmostFull = hasGroup && pct >= 80 && pct < 100;

  const progressColor = isFull
    ? 'var(--md-sys-color-error)'
    : isAlmostFull
      ? '#d97706'
      : 'var(--md-sys-color-primary)';

  const progressBg = isFull
    ? 'var(--md-sys-color-error-container)'
    : isAlmostFull
      ? '#fef3c7'
      : 'var(--md-sys-color-primary-container)';

  return (
    <Link
      href={`/courses/${course.id}`}
      className="group block outline-none focus-visible:ring-2 focus-visible:ring-[var(--md-sys-color-primary)] focus-visible:ring-offset-2 rounded-[var(--md-sys-shape-corner-medium)]"
      style={{ animationDelay: `${index * 0.06}s` }}
    >
      <div
        className="md3-card overflow-hidden transition-all duration-200 h-full flex flex-col"
        style={{
          border: '1px solid var(--md-sys-color-outline-variant)',
        }}
      >
        {/* Cover Image */}
        <div className="relative h-[180px] overflow-hidden flex-shrink-0">
          {course.image_url ? (
            <img
              src={course.image_url}
              alt={course.title_ar}
              className="w-full h-full object-cover transition-transform duration-500 ease-out group-hover:scale-105"
            />
          ) : (
            <div
              className="w-full h-full flex items-center justify-center"
              style={{
                background: `linear-gradient(135deg, ${primaryColor}, ${primaryColor}CC)`,
              }}
            >
              <span
                className="material-symbols-outlined"
                style={{ fontSize: 56, color: 'rgba(255,255,255,0.3)' }}
              >
                school
              </span>
            </div>
          )}

          {/* Price Chip */}
          <div className="absolute top-3 right-3 z-10">
            <span
              className="inline-flex items-center h-7 px-3 text-xs font-bold"
              style={{
                backgroundColor: course.price > 0 ? 'var(--md-sys-color-surface)' : 'var(--md-sys-color-primary)',
                color: course.price > 0 ? 'var(--md-sys-color-on-surface)' : 'var(--md-sys-color-on-primary)',
                borderRadius: 'var(--md-sys-shape-corner-small)',
              }}
            >
              {course.price > 0 ? `${course.price.toLocaleString()} ج.م` : 'مجاني'}
            </span>
          </div>

          {/* Mode Chip */}
          {course.course_mode && (
            <div className="absolute top-3 left-3 z-10">
              <span
                className="inline-flex items-center gap-1 h-7 px-3 text-xs font-bold"
                style={{
                  backgroundColor: 'var(--md-sys-color-surface)',
                  color: 'var(--md-sys-color-on-surface)',
                  borderRadius: 'var(--md-sys-shape-corner-small)',
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                  {course.course_mode === 'offline' ? 'school' : 'computer'}
                </span>
                {course.course_mode === 'offline' ? 'حضوري' : 'أونلاين'}
              </span>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="p-4 flex flex-col flex-1 gap-2.5">
          {/* Category Chip */}
          {course.category_name_ar && (
            <span
              className="self-start inline-flex items-center h-6 px-2.5 text-[11px] font-bold"
              style={{
                backgroundColor: 'var(--md-sys-color-secondary-container)',
                color: 'var(--md-sys-color-on-secondary-container)',
                borderRadius: 'var(--md-sys-shape-corner-extra-small)',
              }}
            >
              {course.category_name_ar}
            </span>
          )}

          {/* Title */}
          <h3
            className="font-bold text-[15px] leading-snug line-clamp-2 transition-colors duration-200 group-hover:text-[var(--md-sys-color-primary)]"
            style={{ color: 'var(--md-sys-color-on-surface)' }}
          >
            {course.title_ar}
          </h3>

          {/* Description */}
          {course.description && (
            <p
              className="text-xs leading-relaxed line-clamp-2"
              style={{ color: 'var(--md-sys-color-on-surface-variant)' }}
            >
              {course.description.replace(/<[^>]*>/g, '').substring(0, 100)}
            </p>
          )}

          {/* Instructor */}
          {course.instructor && (
            <div className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>person</span>
              <span>{course.instructor}</span>
            </div>
          )}

          {/* Meta Row */}
          <div className="flex items-center gap-3 text-xs" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>
            {course.lecture_count != null && course.lecture_count > 0 && (
              <span className="flex items-center gap-1">
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>menu_book</span>
                <span>{course.lecture_count} محاضرة</span>
              </span>
            )}
            {course.lecture_duration != null && course.lecture_duration > 0 && (
              <span className="flex items-center gap-1">
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>schedule</span>
                <span>{course.lecture_duration} ساعة</span>
              </span>
            )}
          </div>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Group Fill Bar */}
          {hasGroup && (
            <div className="mt-1">
              <div className="flex items-center justify-between text-[11px] mb-1.5">
                <span style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>المقاعد المتبقية</span>
                <span
                  className="font-bold"
                  style={{ color: progressColor }}
                >
                  {isFull ? 'مكتمل' : `${gMax! - gCur!} مقعد`}
                </span>
              </div>
              <div
                className="w-full h-1.5 rounded-full overflow-hidden"
                style={{ backgroundColor: progressBg }}
              >
                <div
                  className="h-full rounded-full transition-all duration-700 ease-out"
                  style={{
                    width: `${pct}%`,
                    backgroundColor: progressColor,
                  }}
                />
              </div>
            </div>
          )}

          {/* Divider + CTA Row */}
          <div
            className="flex items-center justify-between pt-3 mt-1"
            style={{ borderTop: '1px solid var(--md-sys-color-outline-variant)' }}
          >
            <span
              className="text-sm font-bold"
              style={{ color: 'var(--md-sys-color-primary)' }}
            >
              {course.price > 0 ? `${course.price.toLocaleString()} ج.م` : 'مجاناً'}
            </span>
            <span
              className="flex items-center gap-1 text-xs font-medium transition-all duration-200 group-hover:gap-2"
              style={{ color: 'var(--md-sys-color-primary)' }}
            >
              سجل الآن
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>arrow_forward</span>
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}
