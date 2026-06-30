'use client';

import { useState, useEffect } from 'react';
import { useBranding } from '../components/BrandingProvider';
import { CourseCard } from '../components/CourseCard';
import { PageSkeleton } from '../components/Skeleton';
import { api } from '../lib/api';

interface Course {
  id: number;
  title_ar: string;
  title_en: string;
  description?: string;
  price: number;
  image_url?: string;
  category_name_ar?: string;
}

export default function HomePage() {
  const { sloganAr } = useBranding();
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api('/api/courses').then(setCourses).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) return <PageSkeleton />;

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--bg)' }}>
      <section className="mb-8 animate-fade-in">
        <h2 className="text-2xl font-bold mb-1" style={{ color: 'var(--text)' }}>مرحباً بك</h2>
        <p style={{ color: 'var(--text-muted)' }}>{sloganAr}</p>
      </section>

      <section>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold" style={{ color: 'var(--text)' }}>الكورسات المتاحة</h3>
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{courses.length} كورس</span>
        </div>
        <div className="grid grid-cols-1 gap-4 animate-stagger">
          {courses.map((course, i) => (
            <CourseCard key={course.id} course={course} index={i} />
          ))}
        </div>
        {courses.length === 0 && (
          <div className="text-center py-12" style={{ color: 'var(--text-muted)' }}>
            لا توجد كورسات متاحة حالياً
          </div>
        )}
      </section>
    </div>
  );
}
