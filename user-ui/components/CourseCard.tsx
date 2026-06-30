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
}

export function CourseCard({ course, index = 0 }: { course: Course; index?: number }) {
  const { primaryColor, secondaryColor } = useBranding();

  return (
    <Link href={`/courses/${course.id}`} className="block group animate-slide-up" style={{ animationDelay: `${index * 0.05}s` }}>
      <div className="rounded-2xl overflow-hidden transition-all duration-300 hover:shadow-xl hover:-translate-y-1 border" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}>
        {course.image_url ? (
          <div className="h-40 overflow-hidden">
            <img src={course.image_url} alt={course.title_ar} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
          </div>
        ) : (
          <div className="h-40 flex items-center justify-center text-white text-3xl font-bold transition-colors" style={{ backgroundColor: primaryColor }}>
            {course.title_ar.charAt(0)}
          </div>
        )}
        <div className="p-4">
          <h3 className="font-bold mb-1 transition-colors group-hover:text-[var(--primary)]" style={{ color: 'var(--text)' }}>{course.title_ar}</h3>
          {course.category_name_ar && (
            <span className="text-xs px-2 py-1 rounded-full" style={{ backgroundColor: secondaryColor + '20', color: secondaryColor }}>
              {course.category_name_ar}
            </span>
          )}
          <div className="mt-3 flex items-center justify-between">
            <span className="text-lg font-bold" style={{ color: primaryColor }}>
              {course.price > 0 ? `${course.price} ج.م` : 'مجاني'}
            </span>
            <span className="text-sm transition-all group-hover:translate-x-1" style={{ color: 'var(--text-muted)' }}>عرض التفاصيل ←</span>
          </div>
        </div>
      </div>
    </Link>
  );
}
