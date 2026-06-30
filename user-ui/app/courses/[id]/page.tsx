'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '../../../lib/api';
import { Skeleton } from '../../../components/Skeleton';
import { useBranding } from '../../../components/BrandingProvider';
import { useAuth } from '../../../lib/auth';

interface Course {
  id: number;
  title_ar: string;
  title_en: string;
  description?: string;
  price: number;
  category_name_ar?: string;
  category_name_en?: string;
  lecture_count?: number;
  lecture_duration?: number;
  instructor?: string;
  course_mode?: string;
  image_url?: string;
}

export default function CourseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const { primaryColor } = useBranding();
  const [course, setCourse] = useState<Course | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api(`/api/courses/${id}`).then(setCourse).catch(() => setError('فشل تحميل بيانات الكورس')).finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return <div className="p-4 space-y-4"><Skeleton className="h-8 w-2/3" /><Skeleton className="h-48 w-full rounded-2xl" /><Skeleton className="h-4 w-full" /><Skeleton className="h-12 w-full rounded-xl" /></div>;
  }

  if (error) {
    return <div className="flex flex-col items-center justify-center h-64 gap-4"><p style={{ color: '#dc2626' }}>{error}</p><Link href="/courses" className="px-4 py-2 rounded-xl text-white text-sm" style={{ backgroundColor: 'var(--primary)' }}>رجوع للكورسات</Link></div>;
  }

  if (!course) return null;

  return (
    <div className="min-h-screen">
      <div className="relative h-48 flex items-center justify-center text-white text-6xl font-bold" style={{ backgroundColor: primaryColor }}>
        {course.title_ar.charAt(0)}
        <Link href="/" className="absolute top-4 right-4 text-white text-sm bg-black/20 px-3 py-1 rounded-full">← رجوع</Link>
      </div>

      <div className="px-4 py-6 -mt-6 rounded-t-3xl relative" style={{ backgroundColor: 'var(--card)' }}>
        <h1 className="text-2xl font-bold mb-1" style={{ color: 'var(--text)' }}>{course.title_ar}</h1>
        {course.category_name_ar && (
          <span className="text-xs px-3 py-1 rounded-full" style={{ backgroundColor: 'var(--bg)', color: 'var(--text-muted)' }}>{course.category_name_ar}</span>
        )}

        <div className="flex gap-3 mt-4">
          {course.course_mode && (
            <div className="flex-1 p-3 rounded-xl text-center" style={{ backgroundColor: 'var(--bg)' }}>
              <p className="text-sm font-bold" style={{ color: 'var(--text)' }}>{course.course_mode === 'offline' ? '🏫 حضوري' : '💻 أونلاين'}</p>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>نوع الكورس</p>
            </div>
          )}
          {(course.lecture_count ?? 0) > 0 && (
            <div className="flex-1 p-3 rounded-xl text-center" style={{ backgroundColor: 'var(--bg)' }}>
              <p className="text-lg font-bold" style={{ color: 'var(--text)' }}>{course.lecture_count ?? 0}</p>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>محاضرة</p>
            </div>
          )}
          {(course.lecture_duration ?? 0) > 0 && (
            <div className="flex-1 p-3 rounded-xl text-center" style={{ backgroundColor: 'var(--bg)' }}>
              <p className="text-lg font-bold" style={{ color: 'var(--text)' }}>{course.lecture_duration ?? 0}</p>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>مدة المحاضرة (ساعة)</p>
            </div>
          )}
          {course.instructor && (
            <div className="flex-1 p-3 rounded-xl text-center" style={{ backgroundColor: 'var(--bg)' }}>
              <p className="text-sm font-bold" style={{ color: 'var(--text)' }}>{course.instructor}</p>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>المدرب</p>
            </div>
          )}
        </div>

        <div className="mt-6">
          <h2 className="font-bold mb-2" style={{ color: 'var(--text)' }}>عن الكورس</h2>
          <p className="text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>{course.description || 'لا يوجد وصف'}</p>
        </div>

        <div className="mt-6">
          <div className="flex items-center justify-between mb-4">
            <span className="text-2xl font-bold" style={{ color: primaryColor }}>
              {course.price > 0 ? `${course.price} ج.م` : 'مجاني'}
            </span>
          </div>
          <button
            onClick={() => {
              if (!user) { router.push('/login'); return; }
              router.push(`/checkout?course_id=${course.id}&amount=${course.price}`);
            }}
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
