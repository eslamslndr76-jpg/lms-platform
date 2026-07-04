'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useBranding } from '../components/BrandingProvider';
import { useAuth } from '../lib/auth';
import { api } from '../lib/api';
import { PageSkeleton } from '../components/Skeleton';

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
  featured?: number;
}

interface Category {
  id: number;
  name_ar: string;
  name_en: string;
  description?: string;
}

export default function HomePage() {
  const { systemName, sloganAr, sloganEn, primaryColor, secondaryColor, logoHeader } = useBranding();
  const { user, loading: authLoading } = useAuth();
  const [featured, setFeatured] = useState<Course[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

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

  if (loading) return <PageSkeleton />;

  const heroCourses = featured.length > 0 ? featured : courses.slice(0, 3);
  const stats = [
    { icon: '📚', value: courses.length, label: 'كورس متاح' },
    { icon: '👨‍🎓', value: '+500', label: 'طالب مسجل' },
    { icon: '🏆', value: '+50', label: 'شهادة معتمدة' },
    { icon: '⭐', value: '4.8', label: 'تقييم الطلاب' },
  ];

  return (
    <div style={{ backgroundColor: 'var(--bg)' }}>
      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 opacity-5 pointer-events-none" style={{ background: `linear-gradient(135deg, ${primaryColor}, ${secondaryColor})` }} />
        <div className="max-w-6xl mx-auto px-4 py-16 md:py-24">
          <div className="grid md:grid-cols-2 gap-8 items-center">
            <div className="animate-fade-in">
              {logoHeader && <img src={logoHeader} alt={systemName} className="h-12 mb-4" />}
              <h1 className="text-3xl md:text-5xl font-bold leading-tight mb-4" style={{ color: 'var(--text)' }}>
                {systemName || 'مركز تدريب'}
              </h1>
              <p className="text-lg mb-2 font-medium" style={{ color: primaryColor }}>
                "{sloganAr || 'جودة . ثقة . امان'}"
              </p>
              <p className="text-sm mb-6" style={{ color: 'var(--text-muted)' }}>
                {sloganEn || 'Make Your Power'} — الكورس مقدم من فريق تدريب X2 بالتعاون مع المعهد العالي للعلوم الإدارية بالقطامية (HIMS)
              </p>
              <div className="flex flex-wrap gap-3">
                <Link href="/courses" className="px-6 py-3 rounded-xl text-white font-bold shadow-lg hover:shadow-xl transition-all hover:-translate-y-0.5"
                  style={{ backgroundColor: primaryColor }}>
                  تصفح الكورسات
                </Link>
                {!authLoading && !user && (
                  <Link href="/register" className="px-6 py-3 rounded-xl font-bold border-2 transition-all hover:-translate-y-0.5"
                    style={{ borderColor: primaryColor, color: primaryColor }}>
                    سجل الان مجاناً
                  </Link>
                )}
              </div>
            </div>
            <div className="hidden md:grid grid-cols-2 gap-3">
              {heroCourses.slice(0, 4).map((course, i) => (
                <Link key={course.id} href={`/courses/${course.id}`}
                  className={`rounded-2xl overflow-hidden shadow-lg hover:shadow-xl transition-all hover:-translate-y-1 ${i === 0 ? 'row-span-2' : ''}`}
                  style={{ backgroundColor: 'var(--card)' }}>
                  {course.image_url ? (
                    <div className={`${i === 0 ? 'h-48' : 'h-28'} overflow-hidden`}>
                      <img src={course.image_url} alt={course.title_ar} className="w-full h-full object-cover" />
                    </div>
                  ) : (
                    <div className={`${i === 0 ? 'h-48' : 'h-28'} flex items-center justify-center text-white font-bold text-lg`}
                      style={{ background: `linear-gradient(135deg, ${primaryColor}, ${secondaryColor})` }}>
                      {course.title_ar.charAt(0)}
                    </div>
                  )}
                  <div className="p-3">
                    <p className={`font-bold truncate ${i === 0 ? 'text-sm' : 'text-xs'}`} style={{ color: 'var(--text)' }}>{course.title_ar}</p>
                    <p className="text-xs font-bold mt-1" style={{ color: primaryColor }}>
                      {course.price > 0 ? `${course.price} ج.م` : 'مجاني'}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="max-w-6xl mx-auto px-4 -mt-8 mb-12">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {stats.map((stat, i) => (
            <div key={i} className="rounded-2xl p-4 text-center shadow-sm border animate-slide-up" style={{ animationDelay: `${i * 0.1}s`, backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}>
              <div className="text-2xl mb-1">{stat.icon}</div>
              <p className="text-xl font-bold" style={{ color: primaryColor }}>{stat.value}</p>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{stat.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Featured Courses */}
      {featured.length > 0 && (
        <section className="max-w-6xl mx-auto px-4 mb-12">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold" style={{ color: 'var(--text)' }}>🌟 الكورسات المميزة</h2>
            <Link href="/courses" className="text-sm font-medium" style={{ color: primaryColor }}>عرض الكل ←</Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {featured.map((course, i) => (
              <Link key={course.id} href={`/courses/${course.id}`} className="group animate-slide-up" style={{ animationDelay: `${i * 0.08}s` }}>
                <div className="rounded-2xl overflow-hidden transition-all duration-300 hover:shadow-xl hover:-translate-y-1 border" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}>
                  {course.image_url ? (
                    <div className="h-44 overflow-hidden">
                      <img src={course.image_url} alt={course.title_ar} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
                    </div>
                  ) : (
                    <div className="h-44 flex items-center justify-center text-white text-3xl font-bold" style={{ background: `linear-gradient(135deg, ${primaryColor}, ${secondaryColor})` }}>
                      {course.title_ar.charAt(0)}
                    </div>
                  )}
                  <div className="p-4">
                    <h3 className="font-bold mb-1 group-hover:text-[var(--primary)] transition-colors" style={{ color: 'var(--text)' }}>{course.title_ar}</h3>
                    {course.category_name_ar && (
                      <span className="text-xs px-2 py-1 rounded-full" style={{ backgroundColor: `${secondaryColor}20`, color: secondaryColor }}>
                        {course.category_name_ar}
                      </span>
                    )}
                    <div className="mt-3 flex items-center justify-between">
                      <span className="text-lg font-bold" style={{ color: primaryColor }}>
                        {course.price > 0 ? `${course.price} ج.م` : 'مجاني'}
                      </span>
                      {course.instructor && <span className="text-xs" style={{ color: 'var(--text-muted)' }}>🧑‍🏫 {course.instructor}</span>}
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Categories */}
      {categories.length > 0 && (
        <section className="max-w-6xl mx-auto px-4 mb-12">
          <h2 className="text-xl font-bold mb-4" style={{ color: 'var(--text)' }}>📂 الأقسام</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {categories.map(cat => (
              <Link key={cat.id} href={`/courses?category=${cat.id}`}
                className="rounded-2xl p-4 text-center border hover:shadow-md transition-all hover:-translate-y-0.5"
                style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}>
                <p className="font-bold text-sm" style={{ color: 'var(--text)' }}>{cat.name_ar}</p>
                {cat.name_en && <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{cat.name_en}</p>}
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* All Courses */}
      {courses.length > 0 && (
        <section className="max-w-6xl mx-auto px-4 mb-12">
          <h2 className="text-xl font-bold mb-4" style={{ color: 'var(--text)' }}>📖 جميع الكورسات</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {courses.slice(0, 6).map((course, i) => (
              <Link key={course.id} href={`/courses/${course.id}`} className="group animate-slide-up" style={{ animationDelay: `${i * 0.05}s` }}>
                <div className="rounded-2xl overflow-hidden transition-all duration-300 hover:shadow-xl hover:-translate-y-1 border" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}>
                  {course.image_url ? (
                    <div className="h-36 overflow-hidden">
                      <img src={course.image_url} alt={course.title_ar} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
                    </div>
                  ) : (
                    <div className="h-36 flex items-center justify-center text-white text-2xl font-bold" style={{ backgroundColor: primaryColor }}>
                      {course.title_ar.charAt(0)}
                    </div>
                  )}
                  <div className="p-3">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-bold text-sm group-hover:text-[var(--primary)] transition-colors" style={{ color: 'var(--text)' }}>{course.title_ar}</h3>
                      <span className="text-sm font-bold whitespace-nowrap" style={{ color: primaryColor }}>
                        {course.price > 0 ? `${course.price} ج.م` : 'مجاني'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      {course.category_name_ar && <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ backgroundColor: `${secondaryColor}15`, color: secondaryColor }}>{course.category_name_ar}</span>}
                      {course.course_mode && <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{course.course_mode === 'offline' ? '🏫 حضوري' : '💻 أونلاين'}</span>}
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
          {courses.length > 6 && (
            <div className="text-center mt-4">
              <Link href="/courses" className="inline-block px-6 py-2.5 rounded-xl text-white font-medium" style={{ backgroundColor: primaryColor }}>
                عرض الكل ({courses.length} كورس)
              </Link>
            </div>
          )}
        </section>
      )}

      {/* CTA Section */}
      <section className="max-w-6xl mx-auto px-4 mb-12">
        <div className="rounded-3xl p-8 md:p-12 text-center text-white relative overflow-hidden" style={{ background: `linear-gradient(135deg, ${primaryColor}, ${secondaryColor})` }}>
          <div className="absolute inset-0 opacity-10 pointer-events-none">
            <div className="absolute top-10 left-10 text-6xl">📚</div>
            <div className="absolute bottom-10 right-10 text-6xl">🎓</div>
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-8xl opacity-20">★</div>
          </div>
          <div className="relative">
            <h2 className="text-2xl md:text-3xl font-bold mb-3">ابدأ رحلتك التعليمية اليوم</h2>
            <p className="text-white/80 mb-6 max-w-md mx-auto">
              انضم إلى أكثر من 500 طالب واستثمر في مستقبلك مع كورسات معتمدة من المعهد العالي للعلوم الإدارية بالقطامية
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              <Link href="/courses"
                className="px-6 py-3 rounded-xl bg-white font-bold shadow-lg hover:shadow-xl transition-all hover:-translate-y-0.5"
                style={{ color: primaryColor }}>
                سجل الآن
              </Link>
              {!authLoading && !user && (
                <Link href="/register"
                  className="px-6 py-3 rounded-xl font-bold border-2 border-white/50 text-white hover:bg-white/10 transition-all">
                  أنشئ حساب مجاني
                </Link>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}>
        <div className="max-w-6xl mx-auto px-4 py-8">
          <div className="grid md:grid-cols-3 gap-8">
            <div>
              {logoHeader && <img src={logoHeader} alt={systemName} className="h-10 mb-3" />}
              <h3 className="font-bold text-lg mb-2" style={{ color: 'var(--text)' }}>{systemName || 'مركز تدريب'}</h3>
              <p className="text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                الكورس مقدم من فريق تدريب X2 بالتعاون مع المعهد العالي للعلوم الإدارية بالقطامية (HIMS)
              </p>
            </div>
            <div>
              <h4 className="font-bold mb-3" style={{ color: 'var(--text)' }}>روابط سريعة</h4>
              <div className="space-y-2 text-sm">
                <Link href="/courses" className="block" style={{ color: 'var(--text-muted)' }}>الكورسات</Link>
                <Link href="/verify" className="block" style={{ color: 'var(--text-muted)' }}>تحقق من شهادة</Link>
                <Link href={user ? '/dashboard' : '/login'} className="block" style={{ color: 'var(--text-muted)' }}>{user ? 'لوحة التحكم' : 'تسجيل الدخول'}</Link>
              </div>
            </div>
            <div>
              <h4 className="font-bold mb-3" style={{ color: 'var(--text)' }}>تابعنا</h4>
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                المعهد العالي للعلوم الإدارية بالقطامية<br />
                القطامية، القاهرة، مصر
              </p>
              <p className="text-sm mt-2" style={{ color: 'var(--text-muted)' }}>
                {sloganAr && `"${sloganAr}"`}<br />
                {sloganEn && `"${sloganEn}"`}
              </p>
            </div>
          </div>
          <div className="border-t mt-6 pt-4 text-center text-xs" style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
            © {new Date().getFullYear()} {systemName || 'مركز تدريب'}. جميع الحقوق محفوظة.
          </div>
        </div>
      </footer>
    </div>
  );
}
