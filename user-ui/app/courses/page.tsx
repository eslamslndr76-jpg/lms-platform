'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { api } from '../../lib/api';
import { CourseCard } from '../../components/CourseCard';
import { PageSkeleton } from '../../components/Skeleton';
import { useBranding } from '../../components/BrandingProvider';

interface Course {
  id: number;
  title_ar: string;
  title_en: string;
  price: number;
  category_name_ar?: string;
  group_max?: number;
  group_current?: number;
}

export default function CoursesPage() {
  const { primaryColor } = useBranding();
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchCourses = useCallback(() => {
    api('/api/courses').then(setCourses).catch(() => setError('فشل تحميل الكورسات')).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchCourses();
    const onFocus = () => fetchCourses();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [fetchCourses]);

  if (loading) return <PageSkeleton />;
  if (error) return <div className="text-center py-12"><p className="text-red-500">{error}</p><button onClick={() => window.location.reload()} className="mt-4 px-4 py-2 rounded-xl text-white" style={{backgroundColor:'var(--primary)'}}>إعادة المحاولة</button></div>;

  return (
    <div className="min-h-screen p-4">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>الكورسات</h1>
        <Link href="/" className="text-sm" style={{ color: primaryColor }}>← رجوع</Link>
      </div>
      <div className="grid grid-cols-1 gap-4">
        {courses.map((course, i) => <CourseCard key={course.id} course={course} index={i} />)}
      </div>
    </div>
  );
}
