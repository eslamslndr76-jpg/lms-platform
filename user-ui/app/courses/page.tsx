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
    <div style={{ backgroundColor: 'var(--bg)' }}>
      {/* Hero Skeleton */}
      <div
        className="relative overflow-hidden pb-16"
        style={{ backgroundColor: 'var(--surface)' }}
      >
        <div className="max-w-6xl mx-auto px-4 pt-12 md:pt-16">
          <div className="skeleton h-5 w-48 rounded-lg mb-4" />
          <div className="skeleton h-12 w-96 rounded-xl mb-3" />
          <div className="skeleton h-6 w-64 rounded-lg mb-6" />
          <div className="skeleton h-14 w-full max-w-lg rounded-2xl mb-6" />
          <div className="flex gap-3">
            <div className="skeleton h-16 w-32 rounded-2xl" />
            <div className="skeleton h-16 w-32 rounded-2xl" />
            <div className="skeleton h-16 w-32 rounded-2xl" />
          </div>
        </div>
      </div>
      {/* Filters Skeleton */}
      <div className="max-w-6xl mx-auto px-4 -mt-6 mb-8">
        <div className="skeleton h-12 w-full rounded-2xl" />
      </div>
      {/* Grid Skeleton */}
      <div className="max-w-6xl mx-auto px-4 pb-12">
        <div className="skeleton h-7 w-40 rounded-lg mb-6" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              className="rounded-2xl overflow-hidden animate-pulse"
              style={{ backgroundColor: 'var(--card)' }}
            >
              <div className="skeleton h-48 w-full rounded-none" />
              <div className="p-4 space-y-3">
                <div className="skeleton h-4 w-20 rounded-lg" />
                <div className="skeleton h-5 w-full rounded-lg" />
                <div className="skeleton h-4 w-3/4 rounded-lg" />
                <div className="flex gap-4">
                  <div className="skeleton h-4 w-24 rounded-lg" />
                  <div className="skeleton h-4 w-20 rounded-lg" />
                </div>
                <div className="skeleton h-2 w-full rounded-full mt-2" />
                <div className="flex justify-between pt-2">
                  <div className="skeleton h-5 w-16 rounded-lg" />
                  <div className="skeleton h-4 w-20 rounded-lg" />
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
      style={{ backgroundColor: 'var(--bg)' }}
    >
      <div className="text-center max-w-md">
        <div className="w-20 h-20 mx-auto mb-6 rounded-full flex items-center justify-center text-3xl"
          style={{ backgroundColor: `${primaryColor}15` }}>
          ⚠️
        </div>
        <h2 className="text-xl font-bold mb-2" style={{ color: 'var(--text)' }}>
          تعذر تحميل الكورسات
        </h2>
        <p className="text-sm mb-6" style={{ color: 'var(--text-muted)' }}>
          {message}
        </p>
        <button
          onClick={onRetry}
          className="px-6 py-3 rounded-xl text-white font-bold shadow-lg hover:shadow-xl transition-all hover:-translate-y-0.5"
          style={{ backgroundColor: primaryColor }}
        >
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
      <div className="text-5xl mb-4">
        {search ? '🔍' : '📭'}
      </div>
      <h3 className="text-lg font-bold mb-2" style={{ color: 'var(--text)' }}>
        {search
          ? `لا توجد نتائج لـ "${search}"`
          : category
          ? 'لا توجد كورسات في هذا القسم حالياً'
          : 'لا توجد كورسات متاحة حالياً'}
      </h3>
      <p className="text-sm mb-6" style={{ color: 'var(--text-muted)' }}>
        {search
          ? 'حاول البحث بكلمات أخرى أو تصفح جميع الكورسات'
          : 'ترقبوا قريباً كورسات جديدة ومميزة'}
      </p>
      {search && (
        <Link
          href="/courses"
          className="px-5 py-2.5 rounded-xl text-white font-bold shadow-md hover:shadow-lg transition-all"
          style={{ backgroundColor: primaryColor }}
        >
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
      { icon: '📚', value: courses.length, label: 'كورس متاح' },
      { icon: '🧑‍🏫', value: new Set(courses.filter((c) => c.instructor).map((c) => c.instructor)).size, label: 'مدرب' },
      { icon: '📂', value: categories.length, label: 'قسم' },
      { icon: '💻', value: new Set(courses.filter((c) => c.course_mode).map((c) => c.course_mode)).size, label: 'نوع تدريب' },
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
    <div style={{ backgroundColor: 'var(--bg)' }}>
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
          className="relative border-b"
          style={{ borderColor: 'var(--border)' }}
        >
          <div className="max-w-6xl mx-auto px-4 pt-10 pb-14 md:pt-14 md:pb-16">
            {/* Badge */}
            <div
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold mb-4 animate-fade-down"
              style={{
                backgroundColor: `${primaryColor}12`,
                color: primaryColor,
                border: `1px solid ${primaryColor}20`,
              }}
            >
              <span>✨</span>
              <span>اكتشف مسارك التعليمي</span>
            </div>

            {/* Headline */}
            <h1
              className="text-3xl md:text-5xl lg:text-6xl font-black leading-[1.1] tracking-tight mb-4 animate-fade-up"
              style={{ color: 'var(--text)' }}
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
              style={{ animationDelay: '0.1s', color: 'var(--text-muted)' }}
            >
              {sloganAr || 'جودة . ثقة . امان'}
              <span className="mx-2">—</span>
              <span className="text-sm">{sloganEn || 'Make Your Power'}</span>
            </p>

            {/* Disclaimer */}
            <p
              className="text-xs mb-6 animate-fade-up opacity-80"
              style={{ animationDelay: '0.15s', color: 'var(--text-light)' }}
            >
              الكورس مقدم من نادي ريادة الاعمال بالتعاون مع المعهد العالي للعلوم الإدارية بالقطامية (HIMS)
            </p>

            {/* Search Bar */}
            <div
              className="relative max-w-lg animate-fade-up"
              style={{ animationDelay: '0.2s' }}
            >
              <div
                className="relative flex items-center rounded-2xl border-2 overflow-hidden transition-all duration-300"
                style={{
                  backgroundColor: 'var(--surface)',
                  borderColor: searchQuery ? primaryColor : 'var(--border)',
                  boxShadow: searchQuery
                    ? `0 0 0 4px ${primaryColor}15, var(--shadow-md)`
                    : 'var(--shadow-sm)',
                }}
              >
                <span className="px-4 text-lg" style={{ color: 'var(--text-light)' }}>
                  🔍
                </span>
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="ابحث عن كورس..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="flex-1 py-3.5 bg-transparent text-sm outline-none"
                  style={{ color: 'var(--text)' }}
                />
                {searchQuery && (
                  <button
                    onClick={() => {
                      setSearchQuery('');
                      searchInputRef.current?.focus();
                    }}
                    className="px-3 text-sm font-bold transition-opacity hover:opacity-70"
                    style={{ color: 'var(--text-light)' }}
                  >
                    ✕
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
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl border"
                  style={{
                    backgroundColor: 'var(--card)',
                    borderColor: 'var(--border)',
                  }}
                >
                  <span className="text-lg">{stat.icon}</span>
                  <div>
                    <span
                      className="text-sm font-extrabold"
                      style={{ color: primaryColor }}
                    >
                      {stat.value}
                    </span>
                    <span
                      className="text-[10px] mr-1.5"
                      style={{ color: 'var(--text-light)' }}
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
        {/* Category Filters */}
        <div className="mt-6 mb-6">
          <div
            className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none"
            style={{ scrollbarWidth: 'none' }}
          >
            {/* All */}
            <button
              onClick={() => setSelectedCategory(null)}
              className="flex-shrink-0 px-4 py-2 rounded-xl text-xs font-bold transition-all duration-300 border"
              style={{
                backgroundColor: selectedCategory === null ? primaryColor : 'var(--card)',
                color: selectedCategory === null ? '#fff' : 'var(--text)',
                borderColor: selectedCategory === null ? primaryColor : 'var(--border)',
              }}
            >
              الكل
            </button>

            {/* Category Pills */}
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(selectedCategory === cat.id ? null : cat.id)}
                className="flex-shrink-0 px-4 py-2 rounded-xl text-xs font-bold transition-all duration-300 border whitespace-nowrap"
                style={{
                  backgroundColor: selectedCategory === cat.id ? primaryColor : 'var(--card)',
                  color: selectedCategory === cat.id ? '#fff' : 'var(--text)',
                  borderColor: selectedCategory === cat.id ? primaryColor : 'var(--border)',
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
            <h2 className="text-lg font-bold" style={{ color: 'var(--text)' }}>
              {searchQuery
                ? `نتائج البحث عن "${searchQuery}"`
                : selectedCategory
                ? categories.find((c) => c.id === selectedCategory)?.name_ar || 'الكورسات'
                : 'جميع الكورسات'}
            </h2>
            <span
              className="px-2.5 py-0.5 rounded-lg text-[10px] font-extrabold"
              style={{
                backgroundColor: `${primaryColor}12`,
                color: primaryColor,
              }}
            >
              {filteredCourses.length}
            </span>
          </div>

          {/* View Toggle */}
          <div className="flex items-center gap-1 p-1 rounded-xl border" style={{ borderColor: 'var(--border)' }}>
            <button
              onClick={() => setViewMode('grid')}
              className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
              style={{
                backgroundColor: viewMode === 'grid' ? primaryColor : 'transparent',
                color: viewMode === 'grid' ? '#fff' : 'var(--text-light)',
              }}
            >
              ▦
            </button>
            <button
              onClick={() => setViewMode('list')}
              className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
              style={{
                backgroundColor: viewMode === 'list' ? primaryColor : 'transparent',
                color: viewMode === 'list' ? '#fff' : 'var(--text-light)',
              }}
            >
              ☰
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
                  /* ── List View Card ── */
                  <Link
                    href={`/courses/${course.id}`}
                    className="group block"
                  >
                    <div
                      className="flex gap-4 rounded-2xl overflow-hidden border transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5"
                      style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}
                    >
                      {/* Thumbnail */}
                      <div className="w-28 h-28 md:w-36 md:h-36 flex-shrink-0 overflow-hidden">
                        {course.image_url ? (
                          <img
                            src={course.image_url}
                            alt={course.title_ar}
                            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                          />
                        ) : (
                          <div
                            className="w-full h-full flex items-center justify-center text-white text-3xl font-black"
                            style={{ background: heroGradient }}
                          >
                            {course.title_ar.charAt(0)}
                          </div>
                        )}
                      </div>

                      {/* Details */}
                      <div className="flex-1 py-3 pl-4 pr-1 flex flex-col justify-center gap-1">
                        {course.category_name_ar && (
                          <span
                            className="text-[10px] px-2 py-0.5 rounded-lg font-bold self-start"
                            style={{ backgroundColor: `${secondaryColor}12`, color: secondaryColor }}
                          >
                            {course.category_name_ar}
                          </span>
                        )}
                        <h3
                          className="font-bold text-sm line-clamp-1 group-hover:text-[var(--primary)] transition-colors"
                          style={{ color: 'var(--text)' }}
                        >
                          {course.title_ar}
                        </h3>
                        {course.instructor && (
                          <span className="text-[11px]" style={{ color: 'var(--text-light)' }}>
                            🧑‍🏫 {course.instructor}
                          </span>
                        )}
                        <div className="flex items-center justify-between mt-1">
                          <span
                            className="text-sm font-extrabold"
                            style={{ color: primaryColor }}
                          >
                            {course.price > 0 ? `${course.price.toLocaleString()} ج.م` : '🎯 مجاني'}
                          </span>
                          <span className="text-[10px] font-medium" style={{ color: 'var(--text-muted)' }}>
                            عرض التفاصيل ←
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
          className="border-t"
          style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }}
        >
          <div className="max-w-6xl mx-auto px-4 py-12 text-center">
            <h2 className="text-xl md:text-2xl font-bold mb-3" style={{ color: 'var(--text)' }}>
              🎯 لم تجد ما تبحث عنه؟
            </h2>
            <p className="text-sm mb-6 max-w-md mx-auto" style={{ color: 'var(--text-muted)' }}>
              تواصل معنا وسنساعدك في اختيار المسار التعليمي المناسب لك
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              <a
                href="tel:+201234567890"
                className="px-5 py-2.5 rounded-xl text-white font-bold shadow-lg hover:shadow-xl transition-all hover:-translate-y-0.5"
                style={{ backgroundColor: primaryColor }}
              >
                📞 اتصل بنا
              </a>
              <Link
                href="/"
                className="px-5 py-2.5 rounded-xl font-bold border-2 transition-all hover:-translate-y-0.5"
                style={{ borderColor: primaryColor, color: primaryColor }}
              >
                العودة للرئيسية
              </Link>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
