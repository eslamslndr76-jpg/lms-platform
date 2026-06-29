'use client';

import { useState, useEffect } from 'react';
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
}

export default function CoursesPage() {
  const { primaryColor } = useBranding();
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api('/api/courses').then(setCourses).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) return <PageSkeleton />;

  return (
    <div className="min-h-screen p-4">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">الكورسات</h1>
        <Link href="/" className="text-sm" style={{ color: primaryColor }}>← رجوع</Link>
      </div>
      <div className="grid grid-cols-1 gap-4">
        {courses.map(course => <CourseCard key={course.id} course={course} />)}
      </div>
    </div>
  );
}
