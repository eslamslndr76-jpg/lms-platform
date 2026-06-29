'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '../../../lib/api';
import { Skeleton } from '../../../components/Skeleton';
import { useBranding } from '../../../components/BrandingProvider';

interface Course {
  id: number;
  title_ar: string;
  title_en: string;
  description: string;
  price: number;
  category_name_ar: string;
  category_name_en: string;
}

export default function CourseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { primaryColor } = useBranding();
  const [course, setCourse] = useState<Course | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api(`/api/courses/${id}`).then(setCourse).catch(() => router.push('/')).finally(() => setLoading(false));
  }, [id, router]);

  if (loading) {
    return <div className="p-4 space-y-4"><Skeleton className="h-8 w-2/3" /><Skeleton className="h-48 w-full rounded-2xl" /><Skeleton className="h-4 w-full" /><Skeleton className="h-12 w-full rounded-xl" /></div>;
  }

  if (!course) return null;

  return (
    <div className="min-h-screen">
      <div className="relative h-48 flex items-center justify-center text-white text-6xl font-bold" style={{ backgroundColor: primaryColor }}>
        {course.title_ar.charAt(0)}
        <Link href="/" className="absolute top-4 right-4 text-white text-sm bg-black/20 px-3 py-1 rounded-full">← رجوع</Link>
      </div>

      <div className="px-4 py-6 -mt-6 bg-white rounded-t-3xl relative">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">{course.title_ar}</h1>
        {course.category_name_ar && (
          <span className="text-xs px-3 py-1 rounded-full bg-gray-100 text-gray-600">{course.category_name_ar}</span>
        )}

        <div className="mt-6">
          <h2 className="font-bold text-gray-900 mb-2">عن الكورس</h2>
          <p className="text-gray-600 text-sm leading-relaxed">{course.description || 'لا يوجد وصف'}</p>
        </div>

        <div className="mt-8">
          <div className="flex items-center justify-between mb-4">
            <span className="text-2xl font-bold" style={{ color: primaryColor }}>
              {course.price > 0 ? `${course.price} ج.م` : 'مجاني'}
            </span>
          </div>
          <button
            onClick={() => router.push(`/checkout?course_id=${course.id}&amount=${course.price}`)}
            className="w-full py-4 rounded-2xl text-white font-bold text-lg shadow-lg"
            style={{ backgroundColor: primaryColor }}
          >
            اشتراك الآن
          </button>
        </div>
      </div>
    </div>
  );
}
