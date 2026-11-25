'use client';

import { useState } from 'react';
import { useAdminAuth } from '../../lib/auth';
import { useDarkMode } from '../../components/DarkModeProvider';
import { useBranding } from '../../components/BrandingProvider';

export default function AdminLoginPage() {
  const { login } = useAdminAuth();
  const { dark, toggle: toggleDark } = useDarkMode();
  const { systemName, logoHeader } = useBranding();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPw, setShowPw] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
    } catch (err: any) {
      setError(err.message || 'فشل تسجيل الدخول');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ backgroundColor: 'var(--md-sys-color-surface-container)' }}
    >
      <div
        className="md3-elevation-2 w-full max-w-sm p-7 animate-scale-in"
        style={{
          backgroundColor: 'var(--md-sys-color-surface-container-lowest)',
          borderRadius: 'var(--md-sys-shape-corner-extra-large)',
        }}
      >
        <div className="flex justify-between items-center mb-6">
          <img src={logoHeader || '/branding/logo.png'} alt={systemName} className="h-14" />
          <button
            type="button"
            onClick={toggleDark}
            aria-label={dark ? 'الوضع الفاتح' : 'الوضع الداكن'}
            className="md3-btn md3-btn--icon"
          >
            <span className="material-symbols-outlined text-[22px]">{dark ? 'light_mode' : 'dark_mode'}</span>
          </button>
        </div>

        <h1 className="text-xl font-bold mb-1" style={{ color: 'var(--md-sys-color-on-surface)' }}>تسجيل الدخول</h1>
        <p className="mb-6 text-sm" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>
          لوحة تحكم {systemName}
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div
              role="alert"
              className="p-3 rounded-[var(--md-sys-shape-corner-small)] text-sm flex items-start gap-2"
              style={{
                backgroundColor: 'var(--md-sys-color-error-container)',
                color: 'var(--md-sys-color-on-error-container)',
              }}
            >
              <span className="material-symbols-outlined text-[18px] shrink-0" aria-hidden>error</span>
              <span>{error}</span>
            </div>
          )}

          <div>
            <label htmlFor="admin-email" className="block text-sm font-medium mb-1.5" style={{ color: 'var(--md-sys-color-on-surface)' }}>
              البريد الإلكتروني أو رقم الهاتف
            </label>
            <input
              id="admin-email"
              type="text"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="md3-field"
              placeholder="admin@lms.com"
              autoComplete="username"
              required
            />
          </div>

          <div>
            <label htmlFor="admin-password" className="block text-sm font-medium mb-1.5" style={{ color: 'var(--md-sys-color-on-surface)' }}>
              كلمة المرور
            </label>
            <div className="relative">
              <input
                id="admin-password"
                type={showPw ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="md3-field pl-16"
                placeholder="••••••••"
                autoComplete="current-password"
                required
              />
              <button
                type="button"
                onClick={() => setShowPw(!showPw)}
                className="absolute left-2 top-1/2 -translate-y-1/2 md3-btn md3-btn--text text-xs"
                style={{ minHeight: 32, padding: '0 8px' }}
              >
                {showPw ? 'إخفاء' : 'إظهار'}
              </button>
            </div>
          </div>

          <button type="submit" disabled={loading} className="md3-btn md3-btn--filled w-full text-base font-bold">
            {loading ? (
              <>
                <span className="material-symbols-outlined text-[18px] animate-spin" aria-hidden>progress_activity</span>
                جاري الدخول...
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-[18px]" aria-hidden>login</span>
                دخول
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}