'use client';

import { useState, useEffect } from 'react';
import { useBranding } from '../components/BrandingProvider';
import { CourseCard } from '../components/CourseCard';
import { PageSkeleton } from '../components/Skeleton';
import { api } from '../lib/api';
import Link from 'next/link';

interface Course {
  id: number;
  title_ar: string;
  title_en: string;
  description?: string;
  price: number;
  category_name_ar?: string;
}

export default function HomePage() {
  const { systemName, sloganAr, primaryColor, logoHeader } = useBranding();
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api('/api/courses').then(setCourses).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) return <PageSkeleton />;

  return (
    <div className="min-h-screen">
      <header className="bg-white shadow-sm sticky top-0 z-40">
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {logoHeader ? (
              <img src={logoHeader} alt={systemName} className="h-8" />
            ) : (
              <h1 className="text-lg font-bold" style={{ color: primaryColor }}>{systemName}</h1>
            )}
          </div>
          <Link href="/login" className="text-sm font-medium" style={{ color: primaryColor }}>
            دخول
          </Link>
        </div>
      </header>

      <main className="px-4 py-6">
        <section className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-1">مرحباً بك</h2>
          <p className="text-gray-500">{sloganAr}</p>
        </section>

        <section>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-gray-900">الكورسات المتاحة</h3>
            <span className="text-xs text-gray-400">{courses.length} كورس</span>
          </div>
          <div className="grid grid-cols-1 gap-4">
            {courses.map(course => (
              <CourseCard key={course.id} course={course} />
            ))}
          </div>
          {courses.length === 0 && (
            <div className="text-center py-12 text-gray-400">
              لا توجد كورسات متاحة حالياً
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
