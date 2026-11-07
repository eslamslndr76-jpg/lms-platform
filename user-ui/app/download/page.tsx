'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { QRCodeSVG } from 'qrcode.react';
import { useBranding } from '../../components/BrandingProvider';

export default function DownloadPage() {
  const { systemName, sloganAr, primaryColor, secondaryColor } = useBranding();
  const [downloadUrl, setDownloadUrl] = useState('/downloads/training-unit.apk');
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<'attendance' | 'courses' | 'certs' | 'offline'>('attendance');
  const [downloading, setDownloading] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [downloadCount, setDownloadCount] = useState(1248);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const fullUrl = `${window.location.origin}/downloads/training-unit.apk`;
      setDownloadUrl(fullUrl);
    }
  }, []);

  const handleCopy = () => {
    if (typeof navigator !== 'undefined') {
      navigator.clipboard.writeText(downloadUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const handleDownload = () => {
    setDownloading(true);
    setDownloadCount(prev => prev + 1);
    setTimeout(() => {
      setDownloading(false);
    }, 4000);
  };

  const features = [
    {
      id: 'attendance',
      icon: 'qr_code_scanner',
      title: 'تسجيل الحضور الذكي بـ QR & BLE',
      desc: 'سجّل حضورك في المحاضرة بثانية واحدة عبر الكاميرا أو استشعار البلوتوث المنخفض الطاقة دون أي انتظار.',
      badge: 'حصري للتطبيق',
      color: '#2563eb',
    },
    {
      id: 'offline',
      icon: 'wifi_off',
      title: 'العمل بدون إنترنت (Offline-First)',
      desc: 'تصفح دوراتك ومواعيد المحاضرات ومعلوماتك الشخصية حتى في حال انقطاع شبكة الهاتف أو باقة الإنترنت.',
      badge: 'فائق السرعة',
      color: '#059669',
    },
    {
      id: 'certs',
      icon: 'verified',
      title: 'شهاداتك الرقمية في جيبك',
      desc: 'استعرض وحمّل شهاداتك الرسمية المعتمدة مع كود التحقق الرقمي المباشر وقدمها فوراً لأي جهة.',
      badge: 'موثق رسمياً',
      color: '#7c3aed',
    },
    {
      id: 'courses',
      icon: 'school',
      title: 'متابعة شاملة وجدول الدورات',
      desc: 'تصفح الكتالوج المعتمد، إشعارات تذكير فورية قبل بدء كل محاضرة، وحساب نسبة إنجازك لكل كورس.',
      badge: 'شامل',
      color: '#d97706',
    },
  ];

  const faqs = [
    {
      q: 'كيف أقوم بتثبيت التطبيق على هاتف الأندرويد؟',
      a: 'اضغط على زر "تحميل التطبيق"، بعد اكتمال التحميل افتح الملف، إذا ظهر لك تنبيه أمني من جوجل حول "تثبيت تطبيقات من مصادر غير معروفة"، اضغط على "الإعدادات" ثم اختر "السماح من هذا المصدر"، ثم اضغط "تثبيت". التطبيق موقع ومؤمن رسمياً بشهادة حماية معتمدة.',
    },
    {
      q: 'هل التطبيق آمن ومجاني بالكامل؟',
      a: 'نعم 100%! التطبيق مجاني بالكامل لجميع الطلاب والمتدربين، خالي تماماً من الإعلانات، وموقع بشهادة تشفير رقمية رسمية من وحدة التدريب والتطوير.',
    },
    {
      q: 'ما هي متطلبات تشغيل التطبيق على الهاتف؟',
      a: 'يعمل التطبيق بسلاسة على كافة هواتف أندرويد بنظام Android 6.0 (Marshmallow) وحتى أحدث إصدارات Android 15/16 بمساحة خفيفة (~68 ميجابايت).',
    },
    {
      q: 'هل تتوفر نسخة لهواتف الآيفون (iOS)؟',
      a: 'تم بناء التطبيق بتقنية Flutter لتكون قاعدة الأكواد جاهزة لأنظمة iOS وقريباً سيكون متاحاً على متجر App Store. كما يمكن لطلاب الآيفون استخدام الموقع مباشرة مع ميزة الحفظ كأيقونة تطبيق على الشاشة الرئيسية.',
    },
  ];

  return (
    <div className="min-h-screen pt-20 pb-28 px-4 sm:px-6 lg:px-8" style={{ backgroundColor: 'var(--md-sys-color-surface)' }}>
      {/* ── Top Hero Section ────────────────────────────────────────────── */}
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center pt-6 lg:pt-12">
          
          {/* Right Column (Text, CTA, Badges) */}
          <div className="lg:col-span-7 space-y-6 text-center lg:text-right">
            
            {/* Version & Security Pill */}
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs sm:text-sm font-semibold tracking-wide"
              style={{
                backgroundColor: 'var(--md-sys-color-primary-container)',
                color: 'var(--md-sys-color-on-primary-container)',
              }}
            >
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
              <span>الإصدار الرسمي للإنتاج v1.0.0</span>
              <span className="opacity-40">•</span>
              <span>موقع ومحمي عتادياً</span>
            </div>

            {/* Main Headline */}
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black leading-tight tracking-tight"
              style={{ color: 'var(--md-sys-color-on-surface)' }}
            >
              تجربة تدريبية متكاملة
              <span className="block mt-2 text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">
                بين يديك في أي وقت وأي مكان
              </span>
            </h1>

            {/* Subtitle */}
            <p className="text-base sm:text-lg leading-relaxed max-w-2xl mx-auto lg:mx-0"
              style={{ color: 'var(--md-sys-color-on-surface-variant)' }}
            >
              حمل التطبيق الرسمي لـ <strong className="font-bold">{systemName}</strong> واستمتع بتسجيل الحضور الذكي بالبلوتوث وكود الـ QR، التصفح بدون إنترنت، والإشعارات اللحظية لكافة دوراتك وشهاداتك.
            </p>

            {/* Quick Metrics Bar */}
            <div className="grid grid-cols-3 gap-3 py-2 max-w-lg mx-auto lg:mx-0">
              <div className="p-3 rounded-2xl text-center" style={{ backgroundColor: 'var(--md-sys-color-surface-container-low)' }}>
                <div className="text-lg sm:text-xl font-black text-blue-600">{downloadCount.toLocaleString('ar-EG')}+</div>
                <div className="text-xs font-medium" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>عملية تنزيل</div>
              </div>
              <div className="p-3 rounded-2xl text-center" style={{ backgroundColor: 'var(--md-sys-color-surface-container-low)' }}>
                <div className="text-lg sm:text-xl font-black text-emerald-600">68.8 MB</div>
                <div className="text-xs font-medium" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>حجم خفيف وسريع</div>
              </div>
              <div className="p-3 rounded-2xl text-center" style={{ backgroundColor: 'var(--md-sys-color-surface-container-low)' }}>
                <div className="text-lg sm:text-xl font-black text-purple-600">100%</div>
                <div className="text-xs font-medium" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>مجاني وآمن</div>
              </div>
            </div>

            {/* Download CTA Button & Actions */}
            <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4 pt-2">
              <a
                href="/downloads/training-unit.apk"
                download="TrainingUnit.apk"
                onClick={handleDownload}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-3 px-8 py-4 rounded-2xl font-bold text-base shadow-lg transition-all transform hover:-translate-y-1 active:translate-y-0"
                style={{
                  backgroundColor: 'var(--md-sys-color-primary)',
                  color: 'var(--md-sys-color-on-primary)',
                  boxShadow: '0 10px 25px -5px rgba(37, 99, 235, 0.4)',
                }}
              >
                <span className="material-symbols-outlined text-2xl">
                  {downloading ? 'hourglass_top' : 'download'}
                </span>
                <span className="flex flex-col text-right">
                  <span className="text-xs opacity-90">تحميل مباشر للأندرويد</span>
                  <span className="text-base font-extrabold">تحميل ملف APK الآن</span>
                </span>
              </a>

              <button
                type="button"
                onClick={handleCopy}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-4 rounded-2xl font-semibold text-sm transition-colors border"
                style={{
                  backgroundColor: 'var(--md-sys-color-surface-container)',
                  borderColor: 'var(--md-sys-color-outline-variant)',
                  color: 'var(--md-sys-color-on-surface)',
                }}
              >
                <span className="material-symbols-outlined text-lg">
                  {copied ? 'check_circle' : 'content_copy'}
                </span>
                <span>{copied ? 'تم نسخ الرابط!' : 'نسخ رابط التحميل'}</span>
              </button>
            </div>

            {/* Download feedback banner */}
            {downloading && (
              <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-200 text-sm flex items-center gap-3 animate-fade-in">
                <span className="material-symbols-outlined animate-spin text-blue-600">sync</span>
                <span>بدأ التحميل بنجاح! راجع لوحة الإشعارات بهاتفك لفتح ملف التثبيت فور انتهائه.</span>
              </div>
            )}

            {/* Desktop QR Scan Card */}
            <div className="hidden sm:flex items-center gap-4 p-4 rounded-2xl border border-dashed max-w-lg mx-auto lg:mx-0"
              style={{
                backgroundColor: 'var(--md-sys-color-surface-container-low)',
                borderColor: 'var(--md-sys-color-outline-variant)',
              }}
            >
              <div className="bg-white p-2.5 rounded-xl shadow-sm border border-slate-200">
                <QRCodeSVG value={downloadUrl} size={84} level="M" />
              </div>
              <div className="text-right">
                <div className="text-sm font-bold" style={{ color: 'var(--md-sys-color-on-surface)' }}>
                  تصفح من الكمبيوتر؟
                </div>
                <div className="text-xs mt-0.5 leading-relaxed" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>
                  وجّه كاميرا هاتفك نحو رمز الـ QR للتحميل المباشر والسريع على هاتفك فوراً دون كابلات.
                </div>
              </div>
            </div>

          </div>

          {/* Left Column (Interactive Smartphone Frame Simulator) */}
          <div className="lg:col-span-5 flex justify-center">
            <div className="relative w-full max-w-[320px] sm:max-w-[340px]">
              
              {/* Glow aura behind phone */}
              <div className="absolute -inset-4 bg-gradient-to-tr from-blue-600/30 to-purple-600/30 rounded-[48px] blur-2xl transform -rotate-1"></div>

              {/* Smartphone Outer Chassis */}
              <div className="relative rounded-[44px] p-3 shadow-2xl border-4 bg-slate-900 border-slate-800">
                
                {/* Dynamic Island / Top Speaker */}
                <div className="absolute top-6 left-1/2 -translate-x-1/2 w-28 h-4 bg-black rounded-full z-20 flex items-center justify-center">
                  <div className="w-2.5 h-2.5 rounded-full bg-slate-800 ml-3"></div>
                  <div className="w-10 h-1.5 rounded-full bg-slate-800"></div>
                </div>

                {/* Smartphone Screen Canvas */}
                <div className="rounded-[34px] overflow-hidden bg-slate-50 dark:bg-slate-950 aspect-[9/19] flex flex-col justify-between border border-slate-800">
                  
                  {/* Status Bar */}
                  <div className="pt-3 px-6 flex justify-between items-center text-[10px] text-slate-500 font-bold select-none">
                    <span>09:41</span>
                    <div className="flex items-center gap-1">
                      <span>5G</span>
                      <span className="material-symbols-outlined text-[12px]">wifi</span>
                      <span className="material-symbols-outlined text-[14px]">battery_full</span>
                    </div>
                  </div>

                  {/* Top App Header inside Phone */}
                  <div className="px-4 py-3 border-b flex items-center justify-between"
                    style={{
                      backgroundColor: 'var(--md-sys-color-surface)',
                      borderColor: 'var(--md-sys-color-outline-variant)',
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-blue-600 text-white flex items-center justify-center font-black text-xs">
                        TU
                      </div>
                      <span className="font-bold text-xs truncate max-w-[150px]">{systemName}</span>
                    </div>
                    <span className="material-symbols-outlined text-sm text-slate-400">notifications</span>
                  </div>

                  {/* Interactive Screen Content Body */}
                  <div className="p-4 flex-1 overflow-y-auto space-y-3">
                    
                    {/* Simulator Content based on activeTab */}
                    {activeTab === 'attendance' && (
                      <div className="space-y-3 animate-fade-in text-center py-2">
                        <div className="w-14 h-14 mx-auto rounded-2xl bg-blue-100 dark:bg-blue-900/40 text-blue-600 flex items-center justify-center">
                          <span className="material-symbols-outlined text-3xl">qr_code_scanner</span>
                        </div>
                        <h4 className="font-black text-xs text-slate-900 dark:text-slate-100">مسح كود الحضور الذكي</h4>
                        <p className="text-[10px] text-slate-500">تم التعرف على المحاضرة عبر تقنية Bluetooth BLE</p>
                        
                        <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-700 text-right">
                          <div className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-300 font-bold text-[11px]">
                            <span className="material-symbols-outlined text-sm">check_circle</span>
                            <span>تم تسجيل حضورك بنجاح!</span>
                          </div>
                          <div className="text-[9px] text-emerald-600 mt-1">المحاضرة: إدارة الأعمال والموارد البشرية</div>
                        </div>
                      </div>
                    )}

                    {activeTab === 'offline' && (
                      <div className="space-y-3 animate-fade-in text-center py-2">
                        <div className="w-14 h-14 mx-auto rounded-2xl bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 flex items-center justify-center">
                          <span className="material-symbols-outlined text-3xl">wifi_off</span>
                        </div>
                        <h4 className="font-black text-xs text-slate-900 dark:text-slate-100">الوضع غير المتصل (Offline)</h4>
                        <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 text-amber-800 dark:text-amber-300 text-[10px]">
                          ⚡ بياناتك محفوظة محلياً ومشفرة، تصفح جدولك بدون انترنت!
                        </div>
                        <div className="space-y-2 text-right">
                          <div className="p-2 rounded-lg bg-slate-100 dark:bg-slate-900 text-[10px] font-bold">
                            📖 دورة المحاسبة المتقدمة
                          </div>
                          <div className="p-2 rounded-lg bg-slate-100 dark:bg-slate-900 text-[10px] font-bold">
                            📖 مهارات التواصل الاحترافي
                          </div>
                        </div>
                      </div>
                    )}

                    {activeTab === 'certs' && (
                      <div className="space-y-3 animate-fade-in text-center py-2">
                        <div className="w-14 h-14 mx-auto rounded-2xl bg-purple-100 dark:bg-purple-900/40 text-purple-600 flex items-center justify-center">
                          <span className="material-symbols-outlined text-3xl">verified</span>
                        </div>
                        <h4 className="font-black text-xs text-slate-900 dark:text-slate-100">الشهادات الرقمية المعتمدة</h4>
                        <div className="p-3 rounded-xl border border-purple-200 dark:border-purple-800 bg-purple-50/50 dark:bg-purple-950/20 text-right space-y-1">
                          <div className="text-[11px] font-bold text-purple-900 dark:text-purple-200">شهادة إتمام تدريب معتمدة</div>
                          <div className="text-[9px] text-slate-500">رقم الشهادة: HIMS-2026-9941</div>
                          <div className="inline-block mt-1 px-2 py-0.5 rounded bg-purple-600 text-white text-[8px] font-bold">
                            جاهزة للتحميل PDF
                          </div>
                        </div>
                      </div>
                    )}

                    {activeTab === 'courses' && (
                      <div className="space-y-2 animate-fade-in py-1">
                        <div className="text-right text-[11px] font-bold text-slate-800 dark:text-slate-200">
                          دوراتي المسجلة (3)
                        </div>
                        <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-900 text-right space-y-1">
                          <div className="text-[10px] font-bold">التسويق الرقمي وإدارة الحملات</div>
                          <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                            <div className="bg-blue-600 h-full w-3/4"></div>
                          </div>
                          <div className="text-[8px] text-slate-500 text-left">75% مكتمل</div>
                        </div>
                        <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-900 text-right space-y-1">
                          <div className="text-[10px] font-bold">تطوير تطبيقات الويب الحديثة</div>
                          <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                            <div className="bg-emerald-600 h-full w-1/2"></div>
                          </div>
                          <div className="text-[8px] text-slate-500 text-left">50% مكتمل</div>
                        </div>
                      </div>
                    )}

                  </div>

                  {/* Simulator Bottom Navigation Bar */}
                  <div className="px-2 py-2 border-t flex justify-around items-center bg-white dark:bg-slate-900 text-[9px] text-slate-500">
                    <button onClick={() => setActiveTab('courses')} className={`flex flex-col items-center ${activeTab === 'courses' ? 'text-blue-600 font-bold' : ''}`}>
                      <span className="material-symbols-outlined text-[18px]">home</span>
                      <span>الرئيسية</span>
                    </button>
                    <button onClick={() => setActiveTab('attendance')} className={`flex flex-col items-center ${activeTab === 'attendance' ? 'text-blue-600 font-bold' : ''}`}>
                      <span className="material-symbols-outlined text-[18px]">qr_code_scanner</span>
                      <span>الحضور</span>
                    </button>
                    <button onClick={() => setActiveTab('certs')} className={`flex flex-col items-center ${activeTab === 'certs' ? 'text-blue-600 font-bold' : ''}`}>
                      <span className="material-symbols-outlined text-[18px]">school</span>
                      <span>الشهادات</span>
                    </button>
                    <button onClick={() => setActiveTab('offline')} className={`flex flex-col items-center ${activeTab === 'offline' ? 'text-blue-600 font-bold' : ''}`}>
                      <span className="material-symbols-outlined text-[18px]">wifi_off</span>
                      <span>أوفلاين</span>
                    </button>
                  </div>

                </div>
              </div>

              {/* Floating Tab Selector Pills outside the phone */}
              <div className="mt-4 flex flex-wrap justify-center gap-1.5">
                {features.map((f) => (
                  <button
                    key={f.id}
                    onClick={() => setActiveTab(f.id as any)}
                    className={`px-3 py-1 rounded-full text-xs font-semibold transition-all duration-200 ${
                      activeTab === f.id
                        ? 'bg-blue-600 text-white shadow-md scale-105'
                        : 'bg-slate-200/70 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-300'
                    }`}
                  >
                    {f.badge}
                  </button>
                ))}
              </div>

            </div>
          </div>

        </div>
      </div>

      {/* ── Feature Highlights Grid ────────────────────────────────────────── */}
      <div className="max-w-7xl mx-auto mt-24">
        <div className="text-center max-w-2xl mx-auto space-y-3 mb-12">
          <h2 className="text-2xl sm:text-3xl font-black" style={{ color: 'var(--md-sys-color-on-surface)' }}>
            لماذا صممنا هذا التطبيق خصيصاً لك؟
          </h2>
          <p className="text-sm sm:text-base leading-relaxed" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>
            حلول برمجية متطورة تضعك على مسافة ضغطة واحدة من حضورك، دوراتك، واستلام شهاداتك.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((f) => (
            <div
              key={f.id}
              onClick={() => setActiveTab(f.id as any)}
              className={`p-6 rounded-3xl border transition-all duration-300 cursor-pointer text-right flex flex-col justify-between ${
                activeTab === f.id
                  ? 'ring-2 ring-blue-500 shadow-xl -translate-y-1'
                  : 'hover:-translate-y-1 hover:shadow-md'
              }`}
              style={{
                backgroundColor: 'var(--md-sys-color-surface-container-low)',
                borderColor: activeTab === f.id ? f.color : 'var(--md-sys-color-outline-variant)',
              }}
            >
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div
                    className="w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-md"
                    style={{ backgroundColor: f.color }}
                  >
                    <span className="material-symbols-outlined text-2xl">{f.icon}</span>
                  </div>
                  <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                    {f.badge}
                  </span>
                </div>
                <h3 className="font-extrabold text-base mb-2" style={{ color: 'var(--md-sys-color-on-surface)' }}>
                  {f.title}
                </h3>
                <p className="text-xs sm:text-sm leading-relaxed" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>
                  {f.desc}
                </p>
              </div>

              <div className="mt-4 pt-3 border-t text-xs font-bold flex items-center gap-1" style={{ color: f.color, borderColor: 'var(--md-sys-color-outline-variant)' }}>
                <span>معاينة في الشاشة</span>
                <span className="material-symbols-outlined text-sm">arrow_back</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── 3-Step Simple Installation Guide ─────────────────────────────────── */}
      <div className="max-w-5xl mx-auto mt-24 p-8 sm:p-12 rounded-3xl border"
        style={{
          backgroundColor: 'var(--md-sys-color-surface-container)',
          borderColor: 'var(--md-sys-color-outline-variant)',
        }}
      >
        <div className="text-center max-w-xl mx-auto mb-10 space-y-2">
          <span className="text-xs font-extrabold uppercase tracking-widest text-blue-600">سهل وسريع</span>
          <h2 className="text-2xl sm:text-3xl font-black" style={{ color: 'var(--md-sys-color-on-surface)' }}>
            تثبيت التطبيق في 3 خطوات بسيطة
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-right">
          
          <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm relative">
            <div className="w-9 h-9 rounded-full bg-blue-600 text-white font-black flex items-center justify-center text-sm mb-4">
              1
            </div>
            <h4 className="font-extrabold text-base mb-2">تحميل ملف الـ APK</h4>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              اضغط على زر التحميل المباشر وسيبدأ المتصفح فوراً في تنزيل ملف التثبيت المعتمد.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm relative">
            <div className="w-9 h-9 rounded-full bg-blue-600 text-white font-black flex items-center justify-center text-sm mb-4">
              2
            </div>
            <h4 className="font-extrabold text-base mb-2">تأكيد التثبيت</h4>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              افتح الملف بعد اكتماله واضغط "تثبيت". في حال طُلب منك السماح من هذا المصدر، اضغط موافق.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm relative">
            <div className="w-9 h-9 rounded-full bg-blue-600 text-white font-black flex items-center justify-center text-sm mb-4">
              3
            </div>
            <h4 className="font-extrabold text-base mb-2">تسجيل الدخول فوراً</h4>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              افتح التطبيق وسجّل دخولك بنفس بريدك الإلكتروني وكلمة المرور المسجلين في المنصة!
            </p>
          </div>

        </div>
      </div>

      {/* ── FAQ Accordion Section ─────────────────────────────────────────── */}
      <div className="max-w-4xl mx-auto mt-24">
        <div className="text-center mb-10 space-y-2">
          <h2 className="text-2xl sm:text-3xl font-black" style={{ color: 'var(--md-sys-color-on-surface)' }}>
            الأسئلة الشائعة حول التطبيق
          </h2>
          <p className="text-sm" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>
            كل ما تحتاج لمعرفته حول الأمان والتوافق والتثبيت.
          </p>
        </div>

        <div className="space-y-4">
          {faqs.map((faq, idx) => (
            <div
              key={idx}
              className="rounded-2xl border transition-colors overflow-hidden"
              style={{
                backgroundColor: 'var(--md-sys-color-surface-container-low)',
                borderColor: 'var(--md-sys-color-outline-variant)',
              }}
            >
              <button
                type="button"
                onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
                className="w-full p-5 text-right font-bold text-sm sm:text-base flex items-center justify-between gap-4"
                style={{ color: 'var(--md-sys-color-on-surface)' }}
              >
                <span>{faq.q}</span>
                <span className={`material-symbols-outlined transition-transform duration-200 ${openFaq === idx ? 'rotate-180' : ''}`}>
                  expand_more
                </span>
              </button>

              {openFaq === idx && (
                <div
                  className="px-5 pb-5 text-xs sm:text-sm leading-relaxed border-t pt-3"
                  style={{
                    color: 'var(--md-sys-color-on-surface-variant)',
                    borderColor: 'var(--md-sys-color-outline-variant)',
                  }}
                >
                  {faq.a}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ── Bottom Call to Action Card ────────────────────────────────────── */}
      <div className="max-w-5xl mx-auto mt-24 p-8 sm:p-12 rounded-3xl text-center bg-gradient-to-br from-blue-600 to-indigo-700 text-white shadow-xl relative overflow-hidden">
        <div className="absolute -right-20 -bottom-20 w-64 h-64 rounded-full bg-white/10 blur-2xl"></div>
        <div className="relative z-10 space-y-6 max-w-2xl mx-auto">
          <h3 className="text-2xl sm:text-3xl font-black">جاهز للبدء؟ لا تفوّت تسجيل أي محاضرة بعد اليوم!</h3>
          <p className="text-sm sm:text-base text-blue-100 leading-relaxed">
            انضم الآن إلى زملائك من الطلاب وسجل حضورك بدقة وأمان عبر تطبيق وحدة التدريب والتطوير الرسمي.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4 pt-2">
            <a
              href="/downloads/training-unit.apk"
              download="TrainingUnit.apk"
              onClick={handleDownload}
              className="inline-flex items-center gap-2 px-8 py-4 rounded-2xl bg-white text-blue-600 font-black text-base shadow-lg hover:bg-blue-50 transition-all transform hover:scale-105"
            >
              <span className="material-symbols-outlined text-2xl">download</span>
              <span>تحميل التطبيق الآن (APK)</span>
            </a>
            <Link
              href="/courses"
              className="inline-flex items-center gap-2 px-6 py-4 rounded-2xl bg-blue-800/60 hover:bg-blue-800 text-white font-bold text-sm border border-blue-400/30 transition-all"
            >
              <span>استكشاف الدورات المتاحة</span>
              <span className="material-symbols-outlined text-sm">arrow_back</span>
            </Link>
          </div>
        </div>
      </div>

      {/* ── Mobile Sticky Download Bar ────────────────────────────────────── */}
      <div className="sm:hidden fixed bottom-4 right-4 left-4 z-40 animate-fade-up">
        <a
          href="/downloads/training-unit.apk"
          download="TrainingUnit.apk"
          onClick={handleDownload}
          className="w-full flex items-center justify-between p-3.5 rounded-2xl bg-blue-600 text-white font-bold text-sm shadow-2xl border border-blue-400/40"
        >
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center">
              <span className="material-symbols-outlined text-xl">download</span>
            </div>
            <div className="text-right">
              <div className="font-extrabold text-xs">تحميل تطبيق الأندرويد</div>
              <div className="text-[10px] text-blue-200">الإصدار 1.0.0 • 68.8 MB</div>
            </div>
          </div>
          <span className="bg-white text-blue-600 px-3 py-1.5 rounded-xl text-xs font-black">
            تحميل مجاني
          </span>
        </a>
      </div>

    </div>
  );
}
