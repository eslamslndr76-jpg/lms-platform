'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '../../../lib/api';
import { Skeleton } from '../../../components/Skeleton';
import { useBranding } from '../../../components/BrandingProvider';
import { useAuth } from '../../../lib/auth';
import { useToast } from '../../../components/Toast';

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
  max_students?: number;
  enable_direct_purchase?: number;
  featured?: number;
}

export default function CourseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const { primaryColor, secondaryColor } = useBranding();
  const { show } = useToast();
  const [course, setCourse] = useState<Course | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [addingToCart, setAddingToCart] = useState(false);
  const [rePurchaseWarn, setRePurchaseWarn] = useState<{ show: boolean; hasCertificate: boolean }>({ show: false, hasCertificate: false });

  useEffect(() => {
    api(`/api/courses/${id}`).then(setCourse).catch(() => setError('فشل تحميل بيانات الكورس')).finally(() => setLoading(false));
  }, [id]);

  const handleAddToCart = async () => {
    if (!user) { router.push('/login'); return; }
    setAddingToCart(true);
    try {
      await api('/api/cart', { method: 'POST', body: JSON.stringify({ course_id: Number(id) }) });
      show('تمت الإضافة للسلة! 🛒');
    } catch (err: any) {
      show(err.message || 'فشل الإضافة للسلة', 'error');
    } finally {
      setAddingToCart(false);
    }
  };

  const handleBuyNow = async () => {
    if (!user) { router.push('/login'); return; }
    try {
      const check = await api(`/api/orders/my/check/${course!.id}`);
      if (check.hasPaidOrder || check.hasCertificate) {
        setRePurchaseWarn({ show: true, hasCertificate: check.hasCertificate });
        return;
      }
    } catch {
      // proceed anyway if check fails
    }
    router.push(`/checkout?course_id=${course!.id}&amount=${course!.price}`);
  };

  const confirmRePurchase = () => {
    setRePurchaseWarn({ show: false, hasCertificate: false });
    router.push(`/checkout?course_id=${course!.id}&amount=${course!.price}`);
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto p-4 space-y-4">
        <Skeleton className="h-64 w-full rounded-3xl" />
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-40 w-full rounded-2xl" />
      </div>
    );
  }

  if (error) {
    return <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4"><p style={{ color: '#dc2626' }}>{error}</p><Link href="/courses" className="px-4 py-2 rounded-xl text-white text-sm" style={{ backgroundColor: 'var(--primary)' }}>رجوع للكورسات</Link></div>;
  }

  if (!course) return null;

  const details = [
    { icon: course.course_mode === 'offline' ? '🏫' : '💻', label: 'النوع', value: course.course_mode === 'offline' ? 'حضوري' : 'أونلاين' },
    { icon: '📖', label: 'عدد المحاضرات', value: `${course.lecture_count || 0} محاضرة` },
    { icon: '⏱', label: 'مدة المحاضرة', value: course.lecture_duration ? `${course.lecture_duration} ساعة` : '-' },
    { icon: '🧑‍🏫', label: 'المدرب', value: course.instructor || '-' },
    { icon: '👥', label: 'الحد الأقصى', value: course.max_students ? `${course.max_students} طالب` : '-' },
  ];

  const allowDirectPurchase = course.enable_direct_purchase !== 0;

  return (
    <div className="min-h-screen max-w-4xl mx-auto">
      {/* Image Banner */}
      <div className="relative h-52 md:h-72 overflow-hidden">
        {course.image_url ? (
          <img src={course.image_url} alt={course.title_ar} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-white text-6xl font-bold"
            style={{ background: `linear-gradient(135deg, ${primaryColor}, ${secondaryColor})` }}>
            {course.title_ar.charAt(0)}
          </div>
        )}
        <Link href="/courses" className="absolute top-4 right-4 text-xs px-3 py-1.5 rounded-full bg-black/30 text-white backdrop-blur-sm hover:bg-black/50 transition-all">
          ← رجوع
        </Link>
        {Number(course.featured) === 1 && (
          <span className="absolute top-4 left-4 text-xs px-3 py-1.5 rounded-full bg-yellow-500 text-white font-medium">
            ⭐ مميز
          </span>
        )}
      </div>

      {/* Content */}
      <div className="-mt-6 relative px-4">
        <div className="rounded-t-3xl p-6 shadow-sm" style={{ backgroundColor: 'var(--card)' }}>
          {/* Title & Meta */}
          <h1 className="text-2xl md:text-3xl font-bold mb-2" style={{ color: 'var(--text)' }}>{course.title_ar}</h1>
          <div className="flex flex-wrap items-center gap-2 mb-4">
            {course.category_name_ar && (
              <span className="text-xs px-3 py-1 rounded-full" style={{ backgroundColor: `${secondaryColor}15`, color: secondaryColor }}>
                {course.category_name_ar}
              </span>
            )}
            {course.instructor && (
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>🧑‍🏫 {course.instructor}</span>
            )}
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
              🆔 {course.title_en}
            </span>
          </div>

          {/* Quick Info Grid */}
          <div className="grid grid-cols-3 md:grid-cols-5 gap-3 mb-6">
            {details.map((d, i) => (
              <div key={i} className="rounded-xl p-3 text-center" style={{ backgroundColor: 'var(--bg)' }}>
                <div className="mb-1">{d.icon}</div>
                <p className="text-xs font-bold" style={{ color: 'var(--text)' }}>{d.value}</p>
                <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{d.label}</p>
              </div>
            ))}
          </div>

          {/* Description */}
          <div className="mb-6">
            <h2 className="font-bold text-lg mb-2" style={{ color: 'var(--text)' }}>عن الكورس</h2>
            <p className="text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>
              {course.description || 'لا يوجد وصف متاح لهذا الكورس. تواصل معنا للمزيد من المعلومات.'}
            </p>
          </div>

          {/* Price & Actions */}
          <div className="rounded-2xl p-4 mb-6" style={{ backgroundColor: 'var(--bg)' }}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>سعر الكورس</p>
                <p className="text-3xl font-bold" style={{ color: primaryColor }}>
                  {course.price > 0 ? `${course.price.toLocaleString()} ج.م` : 'مجاني'}
                </p>
              </div>

            </div>

            <div className="flex gap-3">
              <button onClick={handleAddToCart} disabled={addingToCart}
                className="flex-1 py-3.5 rounded-xl font-bold text-sm border-2 transition-all hover:-translate-y-0.5 disabled:opacity-50"
                style={{ borderColor: primaryColor, color: primaryColor }}>
                {addingToCart ? 'جاري الإضافة...' : '🛒 أضف للسلة'}
              </button>
              {allowDirectPurchase && (
                <button onClick={handleBuyNow}
                  className="flex-1 py-3.5 rounded-xl text-white font-bold text-sm shadow-lg transition-all hover:-translate-y-0.5"
                  style={{ backgroundColor: primaryColor }}>
                  💳 شراء الآن
                </button>
              )}
            </div>
          </div>

          {/* Extra Info */}
          <div className="rounded-2xl p-4 text-sm leading-relaxed" style={{ backgroundColor: 'var(--bg)' }}>
            <p style={{ color: 'var(--text-muted)' }}>
              الكورس مقدم من <strong>فريق تدريب X2</strong> بالتعاون مع <strong>المعهد العالي للعلوم الإدارية بالقطامية (HIMS)</strong>.
              بعد إتمام الكورس بنجاح، ستحصل على شهادة معتمدة برقم تسلسلي يمكن التحقق منه.
            </p>
          </div>
        </div>
      </div>
      {/* Re-purchase Warning Modal */}
      {rePurchaseWarn.show && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="rounded-2xl p-6 max-w-sm w-full shadow-2xl text-center" style={{ backgroundColor: 'var(--card)' }}>
            <div className="text-4xl mb-4">🛒</div>
            <h3 className="text-lg font-bold mb-2" style={{ color: 'var(--text)' }}>هل أنت متأكد؟</h3>
            <p className="text-sm leading-relaxed mb-6" style={{ color: 'var(--text-muted)' }}>
              {rePurchaseWarn.hasCertificate
                ? 'لقد سبق لك شراء هذا الكورس وتم إصدار شهادة لك به. يمكنك شراؤه مرة أخرى إذا كنت ترغب.'
                : 'يبدو أن لديك طلب سابق لهذا الكورس. يمكنك شراؤه مرة أخرى إذا كنت ترغب.'}
            </p>
            <div className="flex gap-3">
              <button onClick={() => setRePurchaseWarn({ show: false, hasCertificate: false })}
                className="flex-1 py-3 rounded-xl font-bold text-sm border-2"
                style={{ borderColor: 'var(--border)', color: 'var(--text)' }}>
                إلغاء
              </button>
              <button onClick={confirmRePurchase}
                className="flex-1 py-3 rounded-xl text-white font-bold text-sm"
                style={{ backgroundColor: primaryColor }}>
                تأكيد الشراء
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
