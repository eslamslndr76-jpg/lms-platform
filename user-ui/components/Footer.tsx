'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useBranding } from './BrandingProvider';
import { useAuth } from '../lib/auth';

export default function Footer() {
  const { primaryColor, secondaryColor, sloganAr, sloganEn, logoFooter, systemName } = useBranding();
  const { user } = useAuth();
  const pathname = usePathname();
  const [showBackToTop, setShowBackToTop] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  const HIDDEN_PATHS = ['/login', '/register', '/forgot-password', '/verify'];
  const isAuthedPage = user && !HIDDEN_PATHS.some((p) => pathname?.startsWith(p));
  const hasBottomNav = isMobile && isAuthedPage;

  useEffect(() => {
    const onScroll = () => setShowBackToTop(window.scrollY > 500);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 1024);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const currentYear = new Date().getFullYear();

  return (
    <>
      <footer
        className="relative overflow-hidden"
        style={{
          backgroundColor: 'var(--md-sys-color-surface-container-low)',
        }}
      >
        <div className="max-w-6xl mx-auto px-4 pt-12 pb-6">
          {/* Main Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-10">
            {/* Brand Column */}
            <div className="lg:col-span-1">
              <Link href="/" className="inline-block group mb-3">
                {logoFooter ? (
                  <div className="rounded-md3-sm overflow-hidden inline-block transition-transform duration-200 group-hover:scale-105">
                    <img src={logoFooter} alt={systemName} className="h-14" />
                  </div>
                ) : (
                  <h3
                    className="text-xl font-bold tracking-tight"
                    style={{ color: 'var(--md-sys-color-primary)' }}
                  >
                    وحدة التدريب و التطوير
                  </h3>
                )}
              </Link>
              <p
                className="text-sm leading-relaxed mb-3"
                style={{ color: 'var(--md-sys-color-on-surface-variant)' }}
              >
                {sloganAr || 'نحو تعليم أفضل'}
                <span className="mx-1.5">—</span>
                <span className="text-xs">{sloganEn || 'Towards Better Learning'}</span>
              </p>
              <p
                className="text-xs leading-relaxed"
                style={{ color: 'var(--md-sys-color-outline)' }}
              >
                هذه المنصة مقدمة من وحدة التدريب و التطوير بالتعاون مع المعهد العالي للعلوم الإدارية بالقطامية (HIMS)
              </p>

              {/* Social Icons */}
              <div className="flex items-center gap-2 mt-4">
                {[
                  { icon: 'language', href: '#', label: 'فيسبوك' },
                  { icon: 'photo_camera', href: '#', label: 'انستغرام' },
                  { icon: 'tag', href: '#', label: 'تويتر' },
                  { icon: 'work', href: '#', label: 'لينكد إن' },
                ].map((social) => (
                  <a
                    key={social.label}
                    href={social.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center w-9 h-9 rounded-full transition-colors duration-200"
                    style={{
                      color: 'var(--md-sys-color-on-surface-variant)',
                    }}
                    title={social.label}
                  >
                    <span className="material-symbols-outlined text-[20px]">{social.icon}</span>
                  </a>
                ))}
              </div>
            </div>

            {/* Quick Links */}
            <div>
              <h4
                className="text-sm font-medium mb-4"
                style={{ color: 'var(--md-sys-color-on-surface)' }}
              >
                روابط سريعة
              </h4>
              <div className="space-y-2.5">
                {[
                  { label: 'جميع الكورسات', href: '/courses', icon: 'school' },
                  { label: 'تحقق من شهادة', href: '/verify', icon: 'verified' },
                  { label: 'تسجيل جديد', href: '/register', icon: 'person_add' },
                  { label: 'تسجيل دخول', href: '/login', icon: 'login' },
                ].map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="flex items-center gap-2.5 text-sm transition-colors duration-200 group"
                    style={{ color: 'var(--md-sys-color-on-surface-variant)' }}
                  >
                    <span className="material-symbols-outlined text-[18px]" style={{ color: 'var(--md-sys-color-primary)' }}>
                      {link.icon}
                    </span>
                    <span>{link.label}</span>
                  </Link>
                ))}
              </div>
            </div>

            {/* Contact */}
            <div>
              <h4
                className="text-sm font-medium mb-4"
                style={{ color: 'var(--md-sys-color-on-surface)' }}
              >
                تواصل معنا
              </h4>
              <div className="space-y-3 text-sm" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>
                <div className="flex items-start gap-2.5">
                  <span className="material-symbols-outlined text-[18px] mt-0.5" style={{ color: 'var(--md-sys-color-primary)' }}>location_on</span>
                  <span>
                    المعهد العالي للعلوم الإدارية
                    <br />
                    بالقطامية، القاهرة، مصر
                  </span>
                </div>
                <div className="flex items-center gap-2.5">
                  <span className="material-symbols-outlined text-[18px]" style={{ color: 'var(--md-sys-color-primary)' }}>call</span>
                  <a
                    href="tel:+201234567890"
                    className="transition-colors duration-200 hover:opacity-80"
                    style={{ color: 'var(--md-sys-color-primary)' }}
                  >
                    +20 123 456 7890
                  </a>
                </div>
                <div className="flex items-center gap-2.5">
                  <span className="material-symbols-outlined text-[18px]" style={{ color: 'var(--md-sys-color-primary)' }}>mail</span>
                  <a
                    href="mailto:info@entrepreneurship-club.edu"
                    className="transition-colors duration-200 hover:opacity-80"
                    style={{ color: 'var(--md-sys-color-primary)' }}
                  >
                    info@entrepreneurship-club.edu
                  </a>
                </div>
              </div>
            </div>

            {/* Working Hours */}
            <div>
              <h4
                className="text-sm font-medium mb-4"
                style={{ color: 'var(--md-sys-color-on-surface)' }}
              >
                أوقات العمل
              </h4>
              <div className="space-y-2.5 text-sm" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>
                <div className="flex items-center justify-between">
                  <span>السبت — الخميس</span>
                  <span className="font-medium" style={{ color: 'var(--md-sys-color-on-surface)' }}>٩ص — ٥م</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>الجمعة</span>
                  <span className="font-medium" style={{ color: 'var(--md-sys-color-on-surface)' }}>مغلق</span>
                </div>
                <div
                  className="mt-3 pt-3 text-xs flex items-center gap-2"
                >
                  <span
                    className="inline-block w-2 h-2 rounded-full"
                    style={{ backgroundColor: '#16a34a' }}
                  />
                  <span>الدعم متاح الآن</span>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Bar */}
          <div
            className="pt-5 pb-2 flex flex-col sm:flex-row items-center justify-between gap-3"
          >
            <p className="text-xs" style={{ color: 'var(--md-sys-color-outline)' }}>
              © {currentYear} وحدة التدريب و التطوير. جميع الحقوق محفوظة.
            </p>
            <div className="flex items-center gap-4 text-xs" style={{ color: 'var(--md-sys-color-outline)' }}>
              <span>ن نحو تعليم أفضل</span>
              <span className="w-1 h-1 rounded-full" style={{ backgroundColor: 'var(--md-sys-color-outline)' }} />
              <span>Towards Better Learning</span>
            </div>
          </div>
        </div>
      </footer>

      {/* Back to Top Button */}
      <button
        onClick={scrollToTop}
        className={`fixed z-30 w-12 h-12 rounded-full shadow-lg flex items-center justify-center transition-all duration-300 ${hasBottomNav ? 'bottom-20 right-4' : 'bottom-6 right-6'}`}
        style={{
          backgroundColor: 'var(--md-sys-color-primary-container)',
          color: 'var(--md-sys-color-on-primary-container)',
          opacity: showBackToTop ? 1 : 0,
          transform: showBackToTop ? 'translateY(0)' : 'translateY(16px)',
          pointerEvents: showBackToTop ? 'auto' : 'none',
        }}
        aria-label="العودة للأعلى"
      >
        <span className="material-symbols-outlined">arrow_upward</span>
      </button>
    </>
  );
}
