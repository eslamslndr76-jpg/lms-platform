'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '../../../lib/api';
import { Skeleton } from '../../../components/Skeleton';
import { useBranding } from '../../../components/BrandingProvider';
import { useAuth } from '../../../lib/auth';
import { useToast } from '../../../components/Toast';
import {
  HeroBanner,
  StickyBookingBar,
  TrustBar,
  InfoGrid,
  CurriculumAccordion,
  InstructorCard,
  FAQAccordion,
  CourseDetailSkeleton,
} from '@/components/course-detail';

interface Course {
  id: number;
  title_ar: string;
  title_en: string;
  description?: string;
  price: number;
  original_price?: number;
  category_name_ar?: string;
  instructor?: string;
  course_mode?: 'online' | 'offline';
  lecture_count?: number;
  lecture_duration?: number;
  max_students?: number;
  enable_direct_purchase?: number;
  featured?: number;
  group_max?: number;
  group_current?: number;
  image_url?: string;
  what_you_learn?: string[];
  requirements?: string[];
  target_audience?: string[];
}

interface Module {
  id: number | string;
  title: string;
  description?: string;
  lessons: Array<{
    id: number | string;
    title: string;
    duration?: string;
    type?: 'video' | 'reading' | 'quiz' | 'assignment' | 'live';
    is_free?: boolean;
    is_completed?: boolean;
    is_locked?: boolean;
    description?: string;
  }>;
  is_completed?: boolean;
  progress?: number;
}

export default function CourseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const { primaryColor, secondaryColor, systemName, sloganAr } = useBranding();
  const { show } = useToast();
  const [course, setCourse] = useState<Course | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [addingToCart, setAddingToCart] = useState(false);
  const [rePurchaseWarn, setRePurchaseWarn] = useState<{ show: boolean; hasCertificate: boolean }>({ show: false, hasCertificate: false });
  const [activeTab, setActiveTab] = useState<'overview' | 'curriculum' | 'instructor' | 'faqs' | 'reviews'>('overview');

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
    return <CourseDetailSkeleton />;
  }

  if (error) {
    return <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4"><p style={{ color: '#dc2626' }}>{error}</p><Link href="/courses" className="px-4 py-2 rounded-xl text-white text-sm" style={{ backgroundColor: 'var(--primary)' }}>رجوع للكورسات</Link></div>;
  }

  if (!course) return null;

  // Computed values
  const totalLessons = course.lecture_count || 0;
  const totalDuration = course.lecture_duration || 0;
  const hasGroup = course.group_max && course.group_max > 0;
  const groupCurrent = course.group_current || 0;
  const groupMax = course.group_max || 0;
  const pct = hasGroup ? Math.min(Math.round((groupCurrent / groupMax) * 100), 100) : 0;
  const isFull = hasGroup && pct >= 100;
  const isAlmostFull = hasGroup && pct >= 80 && pct < 100;
  const remaining = groupMax - groupCurrent;
  const allowDirectPurchase = course.enable_direct_purchase !== 0;

  // Mock data for curriculum (in real app, this would come from API)
  const mockCurriculum: Module[] = [
    {
      id: 1,
      title: 'الوحدة 1: الأساسيات والمقدمة',
      description: 'تعلم الأساسيات والمفاهيم الأساسية',
      lessons: [
        { id: 1, title: 'مرحباً بكم في الكورس', duration: '10 دقيقة', type: 'video', is_free: true, is_completed: true },
        { id: 2, title: 'ما ستتعلمه في هذا الكورس', duration: '8 دقيقة', type: 'video', is_free: true },
        { id: 3, title: 'المتطلبات والأدوات المطلوبة', duration: '12 دقيقة', type: 'reading', is_locked: false },
        { id: 4, title: 'إعداد بيئة العمل', duration: '20 دقيقة', type: 'video', is_locked: false },
        { id: 5, title: 'اختبار سريع: الأساسيات', duration: '10 دقيقة', type: 'quiz', is_locked: false },
      ],
    },
    {
      id: 2,
      title: 'الوحدة 2: المفاهيم المتقدمة',
      description: 'التعمق في المفاهيم المتقدمة والتطبيقات العملية',
      lessons: [
        { id: 6, title: 'المفهوم الأول المتقدم', duration: '25 دقيقة', type: 'video', is_locked: false },
        { id: 7, title: 'تطبيق عملي 1', duration: '30 دقيقة', type: 'assignment', is_locked: false },
        { id: 8, title: 'المفهوم الثاني المتقدم', duration: '22 دقيقة', type: 'video', is_locked: false },
        { id: 9, title: 'تطبيق عملي 2', duration: '35 دقيقة', type: 'assignment', is_locked: false },
        { id: 10, title: 'اختبار الوحدة 2', duration: '15 دقيقة', type: 'quiz', is_locked: false },
      ],
    },
    {
      id: 3,
      title: 'الوحدة 3: المشاريع العملية',
      description: 'بناء مشاريع حقيقية من البداية للنهاية',
      lessons: [
        { id: 11, title: 'مشروع 1: تطبيق بسيط', duration: '45 دقيقة', type: 'video', is_locked: true },
        { id: 12, title: 'مشروع 2: تطبيق متوسط', duration: '60 دقيقة', type: 'video', is_locked: true },
        { id: 13, title: 'مشروع毕业: تطبيق متكامل', duration: '90 دقيقة', type: 'video', is_locked: true },
        { id: 14, title: 'النشر والاستضافة', duration: '20 دقيقة', type: 'video', is_locked: true },
        { id: 15, title: 'اختبار نهائي شامل', duration: '30 دقيقة', type: 'quiz', is_locked: true },
      ],
    },
  ];

  const mockInstructor = {
    name: course.instructor || 'أحمد محمد',
    title: 'خبير ومدرب معتمد',
    bio: 'مدرب محترف مع أكثر من 10 سنوات خبرة في المجال. حاصل على شهادات معتمدة دولياً. درب أكثر من 5000 طالب وساعدهم في تحقيق أهدافهم المهنية. شغوف بنقل المعرفة بأسلوب مبسط وعملي.',
    avatar: undefined,
    rating: 4.9,
    studentsCount: 12400,
    coursesCount: 8,
    experience: '10+ سنوات',
    socialLinks: {
      linkedin: 'https://linkedin.com',
      twitter: 'https://twitter.com',
      website: 'https://example.com',
    },
    badges: [
      { icon: '🏆', label: 'أفضل مدرب 2024', color: '#f59e0b' },
      { icon: '📜', label: 'مدرب معتمد', color: '#16a34a' },
      { icon: '⭐', label: 'تقييم 4.9/5', color: '#7c3aed' },
    ],
  };

  const mockFAQs = [
    {
      id: 1,
      question: 'هل الكورس مناسب للمبتدئين تماماً؟',
      answer: 'نعم، الكورس مصمم ليبدأ من الصفر وينقلك للمستوى المتقدم تدريجياً. لا تحتاج لأي خبرة سابقة، فقط الحماس والرغبة في التعلم.',
      category: 'البدء',
    },
    {
      id: 2,
      question: 'ما هي طرق الدفع المتاحة؟',
      answer: 'نحن نقبل جميع طرق الدفع: البطاقات الائتمانية (فيزا، ماستركارد)، المحافظ الإلكترونية (أبل باي، جوجل باي)، إنستاباي، والدفع نقداً في منافذنا. كما يتوفر التقسيط عبر فاليو، تمارا، وتمويل.',
      category: 'الدفع',
    },
    {
      id: 3,
      question: 'هل أحصل على شهادة معتمدة؟',
      answer: 'نعم، عند إتمام الكورس بنجاح واجتياز الاختبارات، تحصل على شهادة معتمدة من نادي ريادة الأعمال بالتعاون مع المعهد العالي للعلوم الإدارية (HIMS) برقم تسلسلي يمكن التحقق منه إلكترونياً.',
      category: 'الشهادة',
    },
    {
      id: 4,
      question: 'كم مدة الوصول للكورس؟',
      answer: 'لديك وصول مدى الحياة لمحتوى الكورس بما في ذلك جميع التحديثات المستقبلية. يمكنك التعلم بالسرعة التي تناسبك والعودة للمحتوى في أي وقت.',
      category: 'الوصول',
    },
    {
      id: 5,
      question: 'هل يوجد ضمان استرداد المال؟',
      answer: 'نعم، نقدم ضمان استرداد المال خلال 14 يوماً من تاريخ الشراء إذا لم تكن راضياً عن الكورس، دون أي أسئلة. هدفك هو رضاك وتحقيق أهدافك التعليمية.',
      category: 'الضمان',
    },
    {
      id: 6,
      question: 'كيف يمكنني التواصل مع المدرب؟',
      answer: 'يمكنك طرح أسئلتك في منتدى الكورس المخصص، وسيقوم المدرب أو فريق المساعدين بالرد خلال 24 ساعة. كما يوجد جلسات أسئلة وأجوبة مباشرة أسبوعياً.',
      category: 'الدعم',
    },
    {
      id: 7,
      question: 'هل يمكنني تحميل الفيديوهات للمشاهدة دون إنترنت؟',
      answer: 'نعم، تطبيقنا يدعم تحميل الدروس للمشاهدة أوفلاين. يمكنك تحميل أي درس على جهازك ومشاهدته في أي وقت دون حاجة للإنترنت.',
      category: 'التقنية',
    },
    {
      id: 8,
      question: 'هل الكورس يتضمن مشاريع عملية؟',
      answer: 'بالتأكيد! الكورس يتضمن 3 مشاريع عملية متكاملة تبنيها خطوة بخطوة مع المدرب، بالإضافة لتمارين عملية في كل وحدة. هذه المشاريع ستكون إضافة قوية لملفك المهني.',
      category: 'المحتوى',
    },
  ];

  // Course badges for TrustBar
  const courseBadges = [
    { icon: '🏆', label: 'أفضل تقييم', color: '#f59e0b' },
    { icon: '📜', label: 'شهادة معتمدة', color: '#16a34a' },
    { icon: '🤝', label: 'شراكة HIMS', color: '#7c3aed' },
    { icon: '🔄', label: 'تحديثات مجانية', color: '#2563eb' },
  ];

  // Tabs config
  const tabs = [
    { id: 'overview', label: 'نظرة عامة', icon: '📋', count: null },
    { id: 'curriculum', label: 'المحتوى', icon: '📚', count: totalLessons },
    { id: 'instructor', label: 'المدرب', icon: '🧑‍🏫', count: null },
    { id: 'faqs', label: 'الأسئلة', icon: '❓', count: mockFAQs.length },
    { id: 'reviews', label: 'التقييمات', icon: '⭐', count: 0 },
  ];

  return (
    <div className="min-h-screen max-w-4xl mx-auto">
      {/* Hero Banner */}
      <HeroBanner course={course} />

      {/* Content */}
      <div className="-mt-6 relative px-4 pb-12 md:pb-20">
        <div className="rounded-t-3xl p-4 md:p-6" style={{ backgroundColor: 'var(--card)' }}>
          {/* Sticky Booking Bar will be rendered in sidebar */}

          <div className="lg:grid lg:grid-cols-12 lg:gap-6 lg:mt-6">
            {/* Main Content */}
            <div className="lg:col-span-8 lg:pr-4">
              {/* Trust Bar */}
              <TrustBar
                stats={{
                  students: 12400,
                  rating: 4.9,
                  reviews: 847,
                  completionRate: 94,
                }}
                badges={courseBadges}
                testimonials={[
                  { name: 'أحمد علي', role: 'مهندس برمجيات', avatar: 'أ', content: 'كورس ممتاز جداً، المدرب يشرح بأسلوب مبسط وعملي. المشاريع كانت إضافة قوية لملفي.', rating: 5 },
                  { name: 'فاطمة الزهراء', role: 'طالب جامعي', avatar: 'ف', content: 'أفضل استثمار قمت به. الدعم الفني سريع والشهادة معتمدة ومعترف بها.', rating: 5 },
                  { name: 'محمد عبدالله', role: 'مصمم واجهات', avatar: 'م', content: 'المحتوى منظم ومحدث. تعلمت مهارات جديدة استطع تطبيقها مباشرة في عملي.', rating: 5 },
                ]}
              />

              {/* Tab Navigation */}
              <div className="mb-6" role="tablist" aria-label="أقسام الكورس">
                <div className="flex flex-wrap gap-2 lg:gap-3 p-1 rounded-xl" style={{ backgroundColor: 'var(--bg)' }}>
                  {tabs.map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id as typeof activeTab)}
                      className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-300 ${
                        activeTab === tab.id
                          ? 'text-white shadow-lg'
                          : 'text-[var(--text-muted)] hover:text-[var(--text)]'
                      }`}
                      style={{
                        backgroundColor: activeTab === tab.id ? primaryColor : 'transparent',
                      }}
                      role="tab"
                      aria-selected={activeTab === tab.id}
                      aria-controls={`panel-${tab.id}`}
                    >
                      <span aria-hidden="true">{tab.icon}</span>
                      {tab.label}
                      {tab.count !== null && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold" style={{
                          backgroundColor: activeTab === tab.id ? 'rgba(255,255,255,0.2)' : 'var(--bg)',
                          color: activeTab === tab.id ? 'white' : 'var(--text-muted)',
                        }}>
                          {tab.count}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Tab Panters */}
              <div className="space-y-6">
                {/* Overview Tab */}
                <div
                  id="panel-overview"
                  role="tabpanel"
                  aria-labelledby="tab-overview"
                  hidden={activeTab !== 'overview'}
                  className="animate-fade-up"
                >
                  {/* Description */}
                  <section className="rounded-2xl p-6 md:p-8 glass-card" style={{ borderColor: 'var(--glass-border)' }}>
                    <div className="flex items-center gap-3 mb-5">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl" style={{ backgroundColor: `${primaryColor}15`, color: primaryColor }}>
                        <span aria-hidden="true">📖</span>
                      </div>
                      <h3 className="text-xl font-bold" style={{ color: 'var(--text)' }}>عن الكورس</h3>
                    </div>
                    <div className="prose prose-ar max-w-none" style={{ color: 'var(--text-secondary)', lineHeight: '1.9' }}>
                      <p>{course.description || 'لا يوجد وصف متاح لهذا الكورس. تواصل معنا للمزيد من المعلومات.'}</p>
                    </div>
                  </section>

                  {/* What You'll Learn */}
                  {course.what_you_learn && course.what_you_learn.length > 0 && (
                    <section className="rounded-2xl p-6 md:p-8 glass-card" style={{ borderColor: 'var(--glass-border)' }}>
                      <div className="flex items-center gap-3 mb-5">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl" style={{ backgroundColor: `${primaryColor}15`, color: primaryColor }}>
                          <span aria-hidden="true">🎯</span>
                        </div>
                        <h3 className="text-xl font-bold" style={{ color: 'var(--text)' }}>ماذا ستتعلم</h3>
                      </div>
                      <ul className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {course.what_you_learn.map((item, i) => (
                          <li key={i} className="flex items-center gap-3 p-3 rounded-xl transition-all hover:shadow-md" style={{ backgroundColor: 'var(--bg)' }}>
                            <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${primaryColor}15`, color: primaryColor }}>
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7"/></svg>
                            </div>
                            <span style={{ color: 'var(--text)' }}>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </section>
                  )}

                  {/* Requirements */}
                  {course.requirements && course.requirements.length > 0 && (
                    <section className="rounded-2xl p-6 md:p-8 glass-card" style={{ borderColor: 'var(--glass-border)' }}>
                      <div className="flex items-center gap-3 mb-5">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl" style={{ backgroundColor: `${primaryColor}15`, color: primaryColor }}>
                          <span aria-hidden="true">📋</span>
                        </div>
                        <h3 className="text-xl font-bold" style={{ color: 'var(--text)' }}>المتطلبات</h3>
                      </div>
                      <ul className="space-y-2">
                        {course.requirements.map((req, i) => (
                          <li key={i} className="flex items-center gap-3 p-3 rounded-xl" style={{ backgroundColor: 'var(--bg)' }}>
                            <span className="text-lg" aria-hidden="true">✓</span>
                            <span style={{ color: 'var(--text-secondary)' }}>{req}</span>
                          </li>
                        ))}
                      </ul>
                    </section>
                  )}

                  {/* Target Audience */}
                  {course.target_audience && course.target_audience.length > 0 && (
                    <section className="rounded-2xl p-6 md:p-8 glass-card" style={{ borderColor: 'var(--glass-border)' }}>
                      <div className="flex items-center gap-3 mb-5">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl" style={{ backgroundColor: `${primaryColor}15`, color: primaryColor }}>
                          <span aria-hidden="true">🎯</span>
                        </div>
                        <h3 className="text-xl font-bold" style={{ color: 'var(--text)' }}>هذا الكورس مناسب لـ</h3>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {course.target_audience.map((audience, i) => (
                          <span key={i} className="px-4 py-2 rounded-xl text-sm font-medium" style={{ backgroundColor: `${primaryColor}15`, color: primaryColor }}>
                            {audience}
                          </span>
                        ))}
                      </div>
                    </section>
                  )}

                  {/* Quick Info Grid */}
                  <section className="rounded-2xl p-6 md:p-8 glass-card" style={{ borderColor: 'var(--glass-border)' }}>
                    <div className="flex items-center gap-3 mb-5">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl" style={{ backgroundColor: `${primaryColor}15`, color: primaryColor }}>
                        <span aria-hidden="true">⚡</span>
                      </div>
                      <h3 className="text-xl font-bold" style={{ color: 'var(--text)' }}>معلومات سريعة</h3>
                    </div>
                    <InfoGrid
                      cards={[
                        { icon: '📚', label: 'إجمالي الدروس', value: totalLessons, color: primaryColor },
                        { icon: '⏱', label: 'إجمالي الساعات', value: `${totalDuration} ساعة`, color: '#16a34a' },
                        { icon: '🎓', label: 'المستوى', value: 'جميع المستويات', color: '#7c3aed' },
                        { icon: '🌐', label: 'اللغة', value: 'العربية', color: '#f59e0b' },
                        { icon: '📜', label: 'الشهادة', value: 'معتمدة', color: '#16a34a' },
                        { icon: '🔄', label: 'التحديثات', value: 'مجانية مدى الحياة', color: '#2563eb' },
                      ]}
                      columns={3}
                    />
                  </section>
                </div>

                {/* Curriculum Tab */}
                <div
                  id="panel-curriculum"
                  role="tabpanel"
                  aria-labelledby="tab-curriculum"
                  hidden={activeTab !== 'curriculum'}
                  className="animate-fade-up"
                >
                  <CurriculumAccordion
                    modules={mockCurriculum}
                    showProgress={true}
                    completedLessons={[]}
                    onLessonClick={(lesson, module) => {
                      if (lesson.isFree) {
                        show(`جاري فتح: ${lesson.title}`, 'success');
                      }
                    }}
                  />
                </div>

                {/* Instructor Tab */}
                <div
                  id="panel-instructor"
                  role="tabpanel"
                  aria-labelledby="tab-instructor"
                  hidden={activeTab !== 'instructor'}
                  className="animate-fade-up"
                >
                  <InstructorCard instructor={mockInstructor} variant="default" />
                </div>

                {/* FAQs Tab */}
                <div
                  id="panel-faqs"
                  role="tabpanel"
                  aria-labelledby="tab-faqs"
                  hidden={activeTab !== 'faqs'}
                  className="animate-fade-up"
                >
                  <FAQAccordion
                    items={mockFAQs}
                    title="الأسئلة الشائعة"
                    subtitle="أكثر الأسئلة تكراراً من طلابنا - إذا لم تجد إجابتك، تواصل معنا"
                    searchable={true}
                    showHelpful={true}
                    onHelpfulClick={(faqId, vote) => {
                      show(vote === 'yes' ? 'شكراً لتقييمك! 👍' : 'سنعمل على تحسين الإجابة 👎');
                    }}
                  />
                </div>

                {/* Reviews Tab */}
                <div
                  id="panel-reviews"
                  role="tabpanel"
                  aria-labelledby="tab-reviews"
                  hidden={activeTab !== 'reviews'}
                  className="animate-fade-up"
                >
                  <div className="rounded-2xl p-6 md:p-8 glass-card" style={{ borderColor: 'var(--glass-border)' }}>
                    <div className="flex items-center gap-3 mb-5">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl" style={{ backgroundColor: `${primaryColor}15`, color: primaryColor }}>
                        <span aria-hidden="true">⭐</span>
                      </div>
                      <h3 className="text-xl font-bold" style={{ color: 'var(--text)' }}>تقييمات الطلاب</h3>
                    </div>
                    <p className="text-center py-8" style={{ color: 'var(--text-muted)' }}>
                      🚧 قسم التقييمات قيد التطوير<br />
                      سيعرض هنا تقييمات وآراء الطلاب الحقيقيين قريباً
                    </p>
                  </div>
                </div>
              </div>

              {/* Course Provider Info */}
              <div className="mt-8 p-5 rounded-2xl text-center" style={{ backgroundColor: 'var(--bg)', border: '1px solid var(--border)' }}>
                <p style={{ color: 'var(--text-muted)' }}>
                  الكورس مقدم من <strong style={{ color: 'var(--text)' }}>{systemName || 'نادي ريادة الاعمال'}</strong> بالتعاون مع <strong style={{ color: 'var(--text)' }}>المعهد العالي للعلوم الإدارية بالقطامية (HIMS)</strong>.
                  بعد إتمام الكورس بنجاح، ستحصل على شهادة معتمدة برقم تسلسلي يمكن التحقق منه.
                </p>
              </div>
            </div>

            {/* Sticky Booking Sidebar */}
            <div className="lg:w-80 flex-shrink-0">
              <StickyBookingBar
                course={{
                  id: course.id,
                  title_ar: course.title_ar,
                  price: course.price,
                  original_price: course.original_price,
                  enable_direct_purchase: course.enable_direct_purchase,
                  group_max: course.group_max,
                  group_current: course.group_current,
                }}
                onAddToCart={handleAddToCart}
                onBuyNow={handleBuyNow}
                isAddingToCart={addingToCart}
                showRePurchaseWarning={rePurchaseWarn.show}
                onConfirmRePurchase={confirmRePurchase}
                onCancelRePurchase={() => setRePurchaseWarn({ show: false, hasCertificate: false })}
                hasCertificate={rePurchaseWarn.hasCertificate}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Re-purchase Warning Modal */}
      {rePurchaseWarn.show && (
        <div className="fixed inset-0 z-[var(--z-modal-backdrop)] flex items-center justify-center p-4 animate-fade-in" role="dialog" aria-modal="true" aria-labelledby="repurchase-title">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setRePurchaseWarn({ show: false, hasCertificate: false })} />
          <div className="relative z-10 w-full max-w-md rounded-2xl p-6 glass-card animate-bounce-in" style={{ boxShadow: 'var(--shadow-xl)' }}>
            <div className="text-6xl mb-4 text-center">🛒</div>
            <h3 id="repurchase-title" className="text-xl font-bold text-center mb-3" style={{ color: 'var(--text)' }}>هل أنت متأكد؟</h3>
            <p className="text-center mb-6 leading-relaxed" style={{ color: 'var(--text-muted)' }}>
              {rePurchaseWarn.hasCertificate
                ? 'لقد سبق لك شراء هذا الكورس وتم إصدار شهادة لك به. يمكنك شراؤه مرة أخرى إذا كنت ترغب في مراجعة المحتوى.'
                : 'يبدو أن لديك طلب سابق لهذا الكورس. يمكنك شراؤه مرة أخرى إذا كنت ترغب.'}
            </p>
            <div className="flex gap-3">
              <button onClick={() => setRePurchaseWarn({ show: false, hasCertificate: false })} className="flex-1 py-3 rounded-xl font-bold text-sm border-2 transition-all" style={{ borderColor: 'var(--border)', color: 'var(--text)', backgroundColor: 'var(--bg)' }}>إلغاء</button>
              <button onClick={confirmRePurchase} className="flex-1 py-3 rounded-xl text-white font-bold text-sm shadow-lg transition-all" style={{ backgroundColor: primaryColor, boxShadow: `0 4px 20px ${primaryColor}40` }}>تأكيد الشراء</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}