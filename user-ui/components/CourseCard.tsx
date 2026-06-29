'use client';

import Link from 'next/link';
import { useBranding } from './BrandingProvider';

interface Course {
  id: number;
  title_ar: string;
  title_en: string;
  description?: string;
  price: number;
  category_name_ar?: string;
}

export function CourseCard({ course }: { course: Course }) {
  const { primaryColor } = useBranding();

  return (
    <Link href={`/courses/${course.id}`} className="block">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow">
        <div className="h-40 flex items-center justify-center text-white text-3xl font-bold" style={{ backgroundColor: primaryColor }}>
          {course.title_ar.charAt(0)}
        </div>
        <div className="p-4">
          <h3 className="font-bold text-gray-900 mb-1">{course.title_ar}</h3>
          {course.category_name_ar && (
            <span className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-600">{course.category_name_ar}</span>
          )}
          <div className="mt-3 flex items-center justify-between">
            <span className="text-lg font-bold" style={{ color: primaryColor }}>
              {course.price > 0 ? `${course.price} ج.م` : 'مجاني'}
            </span>
            <span className="text-sm text-gray-500">عرض التفاصيل ←</span>
          </div>
        </div>
      </div>
    </Link>
  );
}
