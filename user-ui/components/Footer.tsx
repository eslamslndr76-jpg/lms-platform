'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useBranding } from './BrandingProvider';

export default function Footer() {
  const { primaryColor, secondaryColor, sloganAr, sloganEn, logoFooter, systemName } = useBranding();
  const [showBackToTop, setShowBackToTop] = useState(false);

  useEffect(() => {
    const onScroll = () => setShowBackToTop(window.scrollY > 500);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const currentYear = new Date().getFullYear();

  return (
    <>
      <footer
        className="relative border-t overflow-hidden"
        style={{
          backgroundColor: 'var(--card)',
          borderColor: 'var(--border)',
        }}
      >
        {/* Animated gradient top line */}
        <div
          className="absolute top-0 left-0 right-0 h-[2px] opacity-80"
          style={{
            background: `linear-gradient(90deg, transparent, ${primaryColor}, ${secondaryColor}, ${primaryColor}, transparent)`,
            backgroundSize: '300% 100%',
            animation: 'gradient-shift 4s ease infinite',
          }}
        />

        {/* Decorative shapes */}
        <div
          className="absolute -top-16 -left-16 w-32 h-32 rounded-full opacity-[0.03] pointer-events-none animate-float"
          style={{ backgroundColor: primaryColor }}
        />
        <div
          className="absolute -bottom-20 -right-20 w-40 h-40 rounded-full opacity-[0.02] pointer-events-none animate-float"
          style={{ backgroundColor: secondaryColor, animationDelay: '2s' }}
        />

        {/* Dot pattern overlay */}
        <div
          className="absolute inset-0 opacity-[0.02] pointer-events-none"
          style={{
            backgroundImage: `radial-gradient(circle, ${primaryColor} 0.5px, transparent 0.5px)`,
            backgroundSize: '24px 24px',
          }}
        />

        <div className="relative max-w-6xl mx-auto px-4 pt-12 pb-6">
          {/* Main Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-10">
            {/* Brand Column */}
            <div className="lg:col-span-1">
              <Link href="/" className="inline-block group mb-3">
                {logoFooter ? (
                  <div className="rounded-xl p-0.5 shadow-sm border inline-block transition-all duration-300 group-hover:scale-105" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}>
                    <img src={logoFooter} alt={systemName} className="h-14 sm:h-16" />
                  </div>
                ) : (
                  <h3
                    className="text-xl font-black tracking-tight bg-clip-text text-transparent transition-all duration-300 group-hover:scale-105 inline-block"
                    style={{
                      backgroundImage: `linear-gradient(135deg, ${primaryColor}, ${secondaryColor})`,
                    }}
                  >
                    نادي ريادة الاعمال
                  </h3>
                )}
              </Link>
              <p
                className="text-sm leading-relaxed mb-3"
                style={{ color: 'var(--text-muted)' }}
              >
                {sloganAr || 'نحو تعليم أفضل'}
                <span className="mx-1.5">—</span>
                <span className="text-xs">{sloganEn || 'Towards Better Learning'}</span>
              </p>
              <p
                className="text-xs leading-relaxed"
                style={{ color: 'var(--text-light)' }}
              >
                هذه المنصة مقدمة من نادي ريادة الاعمال بالتعاون مع المعهد العالي للعلوم الإدارية بالقطامية (HIMS)
              </p>

              {/* Social Icons */}
              <div className="flex items-center gap-2 mt-4">
                {[
                  { icon: '📘', href: '#', label: 'فيسبوك' },
                  { icon: '📸', href: '#', label: 'انستغرام' },
                  { icon: '🐦', href: '#', label: 'تويتر' },
                  { icon: '💼', href: '#', label: 'لينكد إن' },
                ].map((social) => (
                  <a
                    key={social.label}
                    href={social.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center w-9 h-9 rounded-xl border text-sm transition-all duration-300 hover:scale-110 hover:-translate-y-0.5 hover:shadow-md"
                    style={{
                      borderColor: 'var(--border)',
                      backgroundColor: 'var(--bg)',
                    }}
                    title={social.label}
                  >
                    {social.icon}
                  </a>
                ))}
              </div>
            </div>

            {/* Quick Links */}
            <div>
              <h4
                className="font-bold text-sm mb-4 relative inline-block"
                style={{ color: 'var(--text)' }}
              >
                روابط سريعة
                <span
                  className="absolute -bottom-1 right-0 left-0 h-0.5 rounded-full"
                  style={{ backgroundColor: primaryColor }}
                />
              </h4>
              <div className="space-y-2.5">
                {[
                  { label: 'جميع الكورسات', href: '/courses', icon: '📚' },
                  { label: 'تحقق من شهادة', href: '/verify', icon: '🎓' },
                  { label: 'تسجيل جديد', href: '/register', icon: '✍️' },
                  { label: 'تسجيل دخول', href: '/login', icon: '🔑' },
                ].map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="flex items-center gap-2 text-sm transition-all duration-300 hover:translate-x-1 group"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    <span className="text-xs transition-transform duration-300 group-hover:scale-110">
                      {link.icon}
                    </span>
                    <span className="relative">
                      {link.label}
                      <span
                        className="absolute -bottom-0.5 right-0 left-0 h-[1.5px] scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-right"
                        style={{ backgroundColor: primaryColor }}
                      />
                    </span>
                  </Link>
                ))}
              </div>
            </div>

            {/* Contact */}
            <div>
              <h4
                className="font-bold text-sm mb-4 relative inline-block"
                style={{ color: 'var(--text)' }}
              >
                تواصل معنا
                <span
                  className="absolute -bottom-1 right-0 left-0 h-0.5 rounded-full"
                  style={{ backgroundColor: secondaryColor }}
                />
              </h4>
              <div className="space-y-3 text-sm" style={{ color: 'var(--text-muted)' }}>
                <div className="flex items-start gap-2.5">
                  <span className="text-xs mt-0.5">📍</span>
                  <span>
                    المعهد العالي للعلوم الإدارية
                    <br />
                    بالقطامية، القاهرة، مصر
                  </span>
                </div>
                <div className="flex items-center gap-2.5">
                  <span className="text-xs">📞</span>
                  <a
                    href="tel:+201234567890"
                    className="transition-colors duration-300 hover:opacity-80"
                    style={{ color: primaryColor }}
                  >
                    +20 123 456 7890
                  </a>
                </div>
                <div className="flex items-center gap-2.5">
                  <span className="text-xs">✉️</span>
                  <a
                    href="mailto:info@entrepreneurship-club.edu"
                    className="transition-colors duration-300 hover:opacity-80"
                    style={{ color: primaryColor }}
                  >
                    info@entrepreneurship-club.edu
                  </a>
                </div>
              </div>
            </div>

            {/* Working Hours */}
            <div>
              <h4
                className="font-bold text-sm mb-4 relative inline-block"
                style={{ color: 'var(--text)' }}
              >
                أوقات العمل
                <span
                  className="absolute -bottom-1 right-0 left-0 h-0.5 rounded-full"
                  style={{ backgroundColor: primaryColor }}
                />
              </h4>
              <div className="space-y-2.5 text-sm" style={{ color: 'var(--text-muted)' }}>
                <div className="flex items-center justify-between">
                  <span>السبت — الخميس</span>
                  <span className="font-medium" style={{ color: 'var(--text)' }}>٩ص — ٥م</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>الجمعة</span>
                  <span className="font-medium" style={{ color: 'var(--text)' }}>مغلق</span>
                </div>
                <div
                  className="mt-3 pt-3 border-t text-xs flex items-center gap-2"
                  style={{ borderColor: 'var(--border)' }}
                >
                  <span
                    className="inline-block w-2 h-2 rounded-full animate-pulse-soft"
                    style={{ backgroundColor: '#16a34a' }}
                  />
                  <span>الدعم متاح الآن</span>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Bar */}
          <div
            className="border-t pt-5 pb-2 flex flex-col sm:flex-row items-center justify-between gap-3"
            style={{ borderColor: 'var(--border)' }}
          >
            <p className="text-xs" style={{ color: 'var(--text-light)' }}>
              © {currentYear} نادي ريادة الاعمال. جميع الحقوق محفوظة.
            </p>
            <div className="flex items-center gap-4 text-xs" style={{ color: 'var(--text-light)' }}>
              <span>نحو تعليم أفضل</span>
              <span className="w-1 h-1 rounded-full" style={{ backgroundColor: 'var(--text-light)' }} />
              <span>Towards Better Learning</span>
            </div>
          </div>
        </div>
      </footer>

      {/* Back to Top Button */}
      <button
        onClick={scrollToTop}
        className={`fixed bottom-6 right-6 z-30 w-11 h-11 rounded-xl shadow-lg text-white flex items-center justify-center text-lg transition-all duration-500 ${
          showBackToTop
            ? 'opacity-100 translate-y-0 pointer-events-auto'
            : 'opacity-0 translate-y-4 pointer-events-none'
        } hover:shadow-xl hover:-translate-y-1 active:translate-y-0`}
        style={{ backgroundColor: primaryColor }}
        aria-label="العودة للأعلى"
      >
        ↑
      </button>
    </>
  );
}
