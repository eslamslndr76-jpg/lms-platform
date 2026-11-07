'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import Link from 'next/link';
import { api } from '../../lib/api';
import { CourseCard } from '../../components/CourseCard';
import { useBranding } from '../../components/BrandingProvider';

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
}

interface Category {
  id: number;
  name_ar: string;
  name_en: string;
}

/* ─── Skeleton Component ─── */
function CoursesPageSkeleton() {
  return (
    <div style={{ backgroundColor: 'var(--md-sys-color-surface)' }}>
      {/* Hero Skeleton */}
      <div
        className="relative overflow-hidden pb-16"
        style={{ backgroundColor: 'var(--md-sys-color-surface-container-low)' }}
      >
        <div className="max-w-6xl mx-auto px-4 pt-12 md:pt-16">
          <div className="skeleton h-5 w-48 mb-4" style={{ borderRadius: 'var(--md-sys-shape-corner-small)' }} />
          <div className="skeleton h-12 w-96 mb-3" style={{ borderRadius: 'var(--md-sys-shape-corner-small)' }} />
          <div className="skeleton h-6 w-64 mb-6" style={{ borderRadius: 'var(--md-sys-shape-corner-small)' }} />
          <div className="skeleton h-14 w-full max-w-lg mb-6" style={{ borderRadius: 'var(--md-sys-shape-corner-extra-small)' }} />
          <div className="flex gap-3">
            <div className="skeleton h-16 w-32" style={{ borderRadius: 'var(--md-sys-shape-corner-small)' }} />
            <div className="skeleton h-16 w-32" style={{ borderRadius: 'var(--md-sys-shape-corner-small)' }} />
            <div className="skeleton h-16 w-32" style={{ borderRadius: 'var(--md-sys-shape-corner-small)' }} />
          </div>
        </div>
      </div>
      {/* Filters Skeleton */}
      <div className="max-w-6xl mx-auto px-4 -mt-6 mb-8">
        <div className="skeleton h-12 w-full" style={{ borderRadius: 'var(--md-sys-shape-corner-full)' }} />
      </div>
      {/* Linear Progress */}
      <div className="max-w-6xl mx-auto px-4 mb-6">
        <div className="w-full h-1 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--md-sys-color-surface-container-high)' }}><div className="h-full rounded-full animate-pulse" style={{ width: '40%', backgroundColor: 'var(--md-sys-color-primary)' }} /></div>
      </div>
      {/* Grid Skeleton */}
      <div className="max-w-6xl mx-auto px-4 pb-12">
        <div className="skeleton h-7 w-40 mb-6" style={{ borderRadius: 'var(--md-sys-shape-corner-small)' }} />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              className="overflow-hidden animate-pulse"
              style={{ backgroundColor: 'var(--md-sys-color-surface-container-low)', borderRadius: 'var(--md-sys-shape-corner-small)' }}
            >
              <div className="skeleton h-48 w-full" style={{ borderRadius: 0 }} />
              <div className="p-4 space-y-3">
                <div className="skeleton h-4 w-20" style={{ borderRadius: 'var(--md-sys-shape-corner-extra-small)' }} />
                <div className="skeleton h-5 w-full" style={{ borderRadius: 'var(--md-sys-shape-corner-extra-small)' }} />
                <div className="skeleton h-4 w-3/4" style={{ borderRadius: 'var(--md-sys-shape-corner-extra-small)' }} />
                <div className="flex gap-4">
                  <div className="skeleton h-4 w-24" style={{ borderRadius: 'var(--md-sys-shape-corner-extra-small)' }} />
                  <div className="skeleton h-4 w-20" style={{ borderRadius: 'var(--md-sys-shape-corner-extra-small)' }} />
                </div>
                <div className="skeleton h-2 w-full mt-2" style={{ borderRadius: 'var(--md-sys-shape-corner-full)' }} />
                <div className="flex justify-between pt-2">
                  <div className="skeleton h-5 w-16" style={{ borderRadius: 'var(--md-sys-shape-corner-extra-small)' }} />
                  <div className="skeleton h-4 w-20" style={{ borderRadius: 'var(--md-sys-shape-corner-extra-small)' }} />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─── Error Display ─── */
function ErrorDisplay({ message, onRetry }: { message: string; onRetry: () => void }) {
  const { primaryColor } = useBranding();
  return (
    <div
      className="min-h-[60vh] flex items-center justify-center px-4"
      style={{ backgroundColor: 'var(--md-sys-color-surface)' }}
    >
      <div className="text-center max-w-md">
        <div
          className="w-20 h-20 mx-auto mb-6 rounded-full flex items-center justify-center"
          style={{ backgroundColor: 'var(--md-sys-color-error-container)' }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 36, color: 'var(--md-sys-color-on-error-container)' }}>
            error
          </span>
        </div>
        <h2 className="text-xl font-bold mb-2" style={{ color: 'var(--md-sys-color-on-surface)' }}>
          تعذر تحميل الكورسات
        </h2>
        <p className="text-sm mb-6" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>
          {message}
        </p>
        <button
          onClick={onRetry}
          className="inline-flex items-center gap-2 px-6 py-3 text-sm font-bold transition-all"
          style={{
            backgroundColor: 'var(--md-sys-color-primary)',
            color: 'var(--md-sys-color-on-primary)',
            borderRadius: 'var(--md-sys-shape-corner-full)',
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>refresh</span>
          إعادة المحاولة
        </button>
      </div>
    </div>
  );
}

/* ─── Empty State ─── */
function EmptyState({ search, category }: { search: string; category: string | null }) {
  const { primaryColor } = useBranding();
  return (
    <div className="col-span-full py-16 text-center">
      <div
        className="w-20 h-20 mx-auto mb-5 rounded-full flex items-center justify-center"
        style={{ backgroundColor: 'var(--md-sys-color-surface-container-high)' }}
      >
        <span className="material-symbols-outlined" style={{ fontSize: 40, color: 'var(--md-sys-color-on-surface-variant)' }}>
          {search ? 'search_off' : 'inbox'}
        </span>
      </div>
      <h3 className="text-lg font-bold mb-2" style={{ color: 'var(--md-sys-color-on-surface)' }}>
        {search
          ? `لا توجد نتائج لـ "${search}"`
          : category
          ? 'لا توجد كورسات في هذا القسم حالياً'
          : 'لا توجد كورسات متاحة حالياً'}
      </h3>
      <p className="text-sm mb-6" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>
        {search
          ? 'حاول البحث بكلمات أخرى أو تصفح جميع الكورسات'
          : 'ترقبوا قريباً كورسات جديدة ومميزة'}
      </p>
      {search && (
        <Link
          href="/courses"
          className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-bold transition-all"
          style={{
            backgroundColor: 'var(--md-sys-color-primary)',
            color: 'var(--md-sys-color-on-primary)',
            borderRadius: 'var(--md-sys-shape-corner-full)',
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>menu_book</span>
          عرض جميع الكورسات
        </Link>
      )}
    </div>
  );
}

/* ─── Main Page ─── */
export default function CoursesPage() {
  const { primaryColor, secondaryColor, sloganAr, sloganEn } = useBranding();
  const [courses, setCourses] = useState<Course[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const searchInputRef = useRef<HTMLInputElement>(null);

  /* ── Fetch Data ── */
  const fetchData = useCallback(() => {
    setLoading(true);
    setError('');
    Promise.all([
      api('/api/courses').catch(() => {
        throw new Error('فشل تحميل الكورسات');
      }),
      api('/api/categories').catch(() => [] as Category[]),
    ])
      .then(([coursesData, categoriesData]) => {
        setCourses(coursesData || []);
        setCategories(categoriesData || []);
      })
      .catch((err: Error) => {
        setError(err.message || 'حدث خطأ غير متوقع');
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  /* ── Search & Filter ── */
  const filteredCourses = useMemo(() => {
    let result = courses;

    if (selectedCategory) {
      result = result.filter((c) => Number(c.category_id) === selectedCategory);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter(
        (c) =>
          c.title_ar.toLowerCase().includes(q) ||
          c.title_en?.toLowerCase().includes(q) ||
          c.category_name_ar?.toLowerCase().includes(q) ||
          c.instructor?.toLowerCase().includes(q),
      );
    }

    return result;
  }, [courses, selectedCategory, searchQuery]);

  /* ── Stats ── */
  const stats = useMemo(
    () => [
      { icon: 'menu_book', value: courses.length, label: 'كورس متاح' },
      { icon: 'person', value: new Set(courses.filter((c) => c.instructor).map((c) => c.instructor)).size, label: 'مدرب' },
      { icon: 'folder', value: categories.length, label: 'قسم' },
      { icon: 'computer', value: new Set(courses.filter((c) => c.course_mode).map((c) => c.course_mode)).size, label: 'نوع تدريب' },
    ],
    [courses, categories],
  );

  /* ── Retry ── */
  const handleRetry = () => {
    fetchData();
  };

  /* ── Render ── */
  if (loading) return <CoursesPageSkeleton />;
  if (error) return <ErrorDisplay message={error} onRetry={handleRetry} />;

  const heroGradient = `linear-gradient(135deg, ${primaryColor} 0%, ${secondaryColor} 100%)`;

  return (
    <div style={{ backgroundColor: 'var(--md-sys-color-surface)' }}>
      {/* ==================== HERO ==================== */}
      <section className="relative overflow-hidden">
        {/* Animated Background */}
        <div
          className="absolute inset-0 opacity-[0.03] pointer-events-none"
          style={{
            backgroundImage: `
              radial-gradient(circle at 20% 30%, ${primaryColor} 0%, transparent 50%),
              radial-gradient(circle at 80% 70%, ${secondaryColor} 0%, transparent 50%)
            `,
          }}
        />
        <div className="absolute inset-0 bg-dots pointer-events-none" />

        {/* Decorative floating shapes */}
        <div
          className="absolute -top-20 -right-20 w-72 h-72 rounded-full opacity-[0.04] pointer-events-none animate-float"
          style={{ background: primaryColor }}
        />
        <div
          className="absolute -bottom-16 -left-16 w-56 h-56 rounded-full opacity-[0.03] pointer-events-none animate-float"
          style={{ background: secondaryColor, animationDelay: '2s' }}
        />

        <div
          className="relative"
          style={{ borderBottom: '1px solid var(--md-sys-color-outline-variant)' }}
        >
          <div className="max-w-6xl mx-auto px-4 pt-10 pb-14 md:pt-14 md:pb-16">
            {/* Badge */}
            <div
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold mb-4 animate-fade-down"
              style={{
                backgroundColor: 'var(--md-sys-color-primary-container)',
                color: 'var(--md-sys-color-on-primary-container)',
                borderRadius: 'var(--md-sys-shape-corner-full)',
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>auto_awesome</span>
              <span>اكتشف مسارك التعليمي</span>
            </div>

            {/* Headline */}
            <h1
              className="text-3xl md:text-5xl lg:text-6xl font-black leading-[1.1] tracking-tight mb-4 animate-fade-up"
              style={{ color: 'var(--md-sys-color-on-surface)' }}
            >
              <span>ابدأ رحلة </span>
              <span
                className="bg-clip-text text-transparent"
                style={{
                  backgroundImage: heroGradient,
                }}
              >
                التميز
              </span>
              <span> اليوم</span>
            </h1>

            {/* Subtitle */}
            <p
              className="text-base md:text-lg max-w-xl mb-6 animate-fade-up"
              style={{ animationDelay: '0.1s', color: 'var(--md-sys-color-on-surface-variant)' }}
            >
              {sloganAr || 'نحو تعليم أفضل'}
              <span className="mx-2">—</span>
              <span className="text-sm">{sloganEn || 'Towards Better Learning'}</span>
            </p>

            {/* Disclaimer */}
            <p
              className="text-xs mb-6 animate-fade-up opacity-80"
              style={{ animationDelay: '0.15s', color: 'var(--md-sys-color-outline)' }}
            >
              الكورس مقدم من وحدة التدريب و التطوير بالتعاون مع المعهد العالي للعلوم الإدارية بالقطامية (HIMS)
            </p>

            {/* Search Bar — M3 Outlined Text Field Pattern */}
            <div
              className="relative max-w-lg animate-fade-up"
              style={{ animationDelay: '0.2s' }}
            >
              <div
                className="relative flex items-center transition-all duration-200"
                style={{
                  backgroundColor: 'var(--md-sys-color-surface)',
                  border: `1px solid ${searchQuery ? 'var(--md-sys-color-primary)' : 'var(--md-sys-color-outline)'}`,
                  borderRadius: 'var(--md-sys-shape-corner-extra-small)',
                  boxShadow: searchQuery
                    ? `0 0 0 1px var(--md-sys-color-primary)`
                    : 'none',
                }}
              >
                <span
                  className="px-4 flex items-center"
                  style={{ color: 'var(--md-sys-color-on-surface-variant)' }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 20 }}>search</span>
                </span>
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="ابحث عن كورس..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="flex-1 py-3.5 bg-transparent text-sm outline-none"
                  style={{ color: 'var(--md-sys-color-on-surface)' }}
                />
                {searchQuery && (
                  <button
                    onClick={() => {
                      setSearchQuery('');
                      searchInputRef.current?.focus();
                    }}
                    className="px-3 flex items-center transition-opacity hover:opacity-70"
                    style={{ color: 'var(--md-sys-color-on-surface-variant)' }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 20 }}>close</span>
                  </button>
                )}
              </div>
            </div>

            {/* Stats Strip */}
            <div
              className="flex flex-wrap gap-3 mt-8 animate-fade-up"
              style={{ animationDelay: '0.3s' }}
            >
              {stats.map((stat, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2 px-4 py-2.5"
                  style={{
                    backgroundColor: 'var(--md-sys-color-surface-container-low)',
                    border: '1px solid var(--md-sys-color-outline-variant)',
                    borderRadius: 'var(--md-sys-shape-corner-extra-small)',
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 20, color: 'var(--md-sys-color-primary)' }}>
                    {stat.icon}
                  </span>
                  <div className="flex items-baseline gap-1">
                    <span
                      className="text-sm font-extrabold"
                      style={{ color: 'var(--md-sys-color-primary)' }}
                    >
                      {stat.value}
                    </span>
                    <span
                      className="text-[10px]"
                      style={{ color: 'var(--md-sys-color-on-surface-variant)' }}
                    >
                      {stat.label}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ==================== FILTERS + GRID ==================== */}
      <section className="max-w-6xl mx-auto px-4 pb-16">
        {/* Category Filters — M3 Chips */}
        <div className="mt-6 mb-6">
          <div
            className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none"
            style={{ scrollbarWidth: 'none' }}
          >
            {/* All */}
            <button
              onClick={() => setSelectedCategory(null)}
              className="flex-shrink-0 px-4 py-2 text-xs font-bold transition-all duration-200"
              style={{
                backgroundColor: selectedCategory === null ? 'var(--md-sys-color-primary-container)' : 'transparent',
                color: selectedCategory === null ? 'var(--md-sys-color-on-primary-container)' : 'var(--md-sys-color-on-surface-variant)',
                border: selectedCategory === null ? 'none' : '1px solid var(--md-sys-color-outline)',
                borderRadius: 'var(--md-sys-shape-corner-full)',
              }}
            >
              الكل
            </button>

            {/* Category Chips */}
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(selectedCategory === cat.id ? null : cat.id)}
                className="flex-shrink-0 px-4 py-2 text-xs font-bold transition-all duration-200 whitespace-nowrap"
                style={{
                  backgroundColor: selectedCategory === cat.id ? 'var(--md-sys-color-primary-container)' : 'transparent',
                  color: selectedCategory === cat.id ? 'var(--md-sys-color-on-primary-container)' : 'var(--md-sys-color-on-surface-variant)',
                  border: selectedCategory === cat.id ? 'none' : '1px solid var(--md-sys-color-outline)',
                  borderRadius: 'var(--md-sys-shape-corner-full)',
                }}
              >
                {cat.name_ar}
              </button>
            ))}
          </div>
        </div>

        {/* Results Bar */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold" style={{ color: 'var(--md-sys-color-on-surface)' }}>
              {searchQuery
                ? `نتائج البحث عن "${searchQuery}"`
                : selectedCategory
                ? categories.find((c) => c.id === selectedCategory)?.name_ar || 'الكورسات'
                : 'جميع الكورسات'}
            </h2>
            <span
              className="px-2.5 py-0.5 text-[10px] font-extrabold"
              style={{
                backgroundColor: 'var(--md-sys-color-primary-container)',
                color: 'var(--md-sys-color-on-primary-container)',
                borderRadius: 'var(--md-sys-shape-corner-extra-small)',
              }}
            >
              {filteredCourses.length}
            </span>
          </div>

          {/* View Toggle — M3 Segmented Button */}
          <div
            className="flex items-center p-0.5"
            style={{
              borderRadius: 'var(--md-sys-shape-corner-full)',
              border: '1px solid var(--md-sys-color-outline)',
            }}
          >
            <button
              onClick={() => setViewMode('grid')}
              className="flex items-center justify-center px-3 py-1.5 transition-all duration-200"
              style={{
                backgroundColor: viewMode === 'grid' ? 'var(--md-sys-color-secondary-container)' : 'transparent',
                color: viewMode === 'grid' ? 'var(--md-sys-color-on-secondary-container)' : 'var(--md-sys-color-on-surface-variant)',
                borderRadius: 'var(--md-sys-shape-corner-full)',
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>grid_view</span>
            </button>
            <button
              onClick={() => setViewMode('list')}
              className="flex items-center justify-center px-3 py-1.5 transition-all duration-200"
              style={{
                backgroundColor: viewMode === 'list' ? 'var(--md-sys-color-secondary-container)' : 'transparent',
                color: viewMode === 'list' ? 'var(--md-sys-color-on-secondary-container)' : 'var(--md-sys-color-on-surface-variant)',
                borderRadius: 'var(--md-sys-shape-corner-full)',
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>view_list</span>
            </button>
          </div>
        </div>

        {/* Course Grid / List */}
        {filteredCourses.length === 0 ? (
          <EmptyState search={searchQuery} category={selectedCategory ? String(selectedCategory) : null} />
        ) : (
          <div
            className={
              viewMode === 'grid'
                ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5'
                : 'flex flex-col gap-4'
            }
          >
            {filteredCourses.map((course, i) => (
              <div key={course.id} className={viewMode === 'list' ? 'animate-fade-up' : 'animate-fade-up'}>
                {viewMode === 'list' ? (
                  /* ── List View Card — M3 styling ── */
                  <Link
                    href={`/courses/${course.id}`}
                    className="group block outline-none focus-visible:ring-2 focus-visible:ring-[var(--md-sys-color-primary)] focus-visible:ring-offset-2 rounded-[var(--md-sys-shape-corner-medium)]"
                  >
                    <div
                      className="md3-card flex gap-4 overflow-hidden transition-all duration-200"
                      style={{
                        border: '1px solid var(--md-sys-color-outline-variant)',
                      }}
                    >
                      {/* Thumbnail */}
                      <div className="w-28 h-28 md:w-36 md:h-36 flex-shrink-0 overflow-hidden">
                        {course.image_url ? (
                          <img
                            src={course.image_url}
                            alt={course.title_ar}
                            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                          />
                        ) : (
                          <div
                            className="w-full h-full flex items-center justify-center"
                            style={{ backgroundColor: 'var(--md-sys-color-primary-container)' }}
                          >
                            <span
                              className="material-symbols-outlined"
                              style={{ fontSize: 40, color: 'var(--md-sys-color-on-primary-container)' }}
                            >
                              school
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Details */}
                      <div className="flex-1 py-3 pl-4 pr-1 flex flex-col justify-center gap-1.5 min-w-0">
                        {course.category_name_ar && (
                          <span
                            className="text-[11px] px-2.5 h-6 inline-flex items-center font-bold self-start"
                            style={{
                              backgroundColor: 'var(--md-sys-color-secondary-container)',
                              color: 'var(--md-sys-color-on-secondary-container)',
                              borderRadius: 'var(--md-sys-shape-corner-extra-small)',
                            }}
                          >
                            {course.category_name_ar}
                          </span>
                        )}
                        <h3
                          className="font-bold text-sm line-clamp-1 group-hover:text-[var(--md-sys-color-primary)] transition-colors duration-200"
                          style={{ color: 'var(--md-sys-color-on-surface)' }}
                        >
                          {course.title_ar}
                        </h3>
                        {course.instructor && (
                          <span className="text-[11px] flex items-center gap-1" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>
                            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>person</span>
                            {course.instructor}
                          </span>
                        )}
                        <div className="flex items-center justify-between mt-1">
                          <span
                            className="text-sm font-bold"
                            style={{ color: 'var(--md-sys-color-primary)' }}
                          >
                            {course.price > 0 ? `${course.price.toLocaleString()} ج.م` : 'مجاني'}
                          </span>
                          <span
                            className="text-[11px] font-medium flex items-center gap-1 transition-all duration-200 group-hover:gap-2"
                            style={{ color: 'var(--md-sys-color-primary)' }}
                          >
                            عرض التفاصيل
                            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>arrow_forward</span>
                          </span>
                        </div>
                      </div>
                    </div>
                  </Link>
                ) : (
                  <CourseCard course={course} index={i} />
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ==================== CTA ==================== */}
      {courses.length > 0 && (
        <section
          style={{
            borderTop: '1px solid var(--md-sys-color-outline-variant)',
            backgroundColor: 'var(--md-sys-color-surface-container-low)',
          }}
        >
          <div className="max-w-6xl mx-auto px-4 py-12 text-center">
            <h2 className="text-xl md:text-2xl font-bold mb-3" style={{ color: 'var(--md-sys-color-on-surface)' }}>
              <span className="material-symbols-outlined align-middle mx-1" style={{ fontSize: 28, color: 'var(--md-sys-color-primary)' }}>gps_fixed</span>
              لم تجد ما تبحث عنه؟
            </h2>
            <p className="text-sm mb-6 max-w-md mx-auto" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>
              تواصل معنا وسنساعدك في اختيار المسار التعليمي المناسب لك
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              <a
                href="tel:+201234567890"
                className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-bold transition-all"
                style={{
                  backgroundColor: 'var(--md-sys-color-primary)',
                  color: 'var(--md-sys-color-on-primary)',
                  borderRadius: 'var(--md-sys-shape-corner-full)',
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>call</span>
                اتصل بنا
              </a>
              <Link
                href="/"
                className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-bold transition-all"
                style={{
                  border: '1px solid var(--md-sys-color-outline)',
                  color: 'var(--md-sys-color-primary)',
                  borderRadius: 'var(--md-sys-shape-corner-full)',
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>arrow_forward</span>
                العودة للرئيسية
              </Link>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
