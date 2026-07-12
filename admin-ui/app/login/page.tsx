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
    <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: 'var(--bg)' }}>
      <div className="rounded-3xl shadow-xl p-8 w-full max-w-sm animate-scale-in" style={{ backgroundColor: 'var(--card)' }}>
        <div className="flex justify-between items-center mb-6">
          {logoHeader ? (
            <div className="rounded-xl p-0.5 shadow-sm border" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}>
              <img src={logoHeader} alt={systemName} className="h-12" />
            </div>
          ) : (
            <h1 className="text-2xl font-bold" style={{ color: 'var(--primary)' }}>{systemName}</h1>
          )}
          <button onClick={toggleDark} className="p-2 rounded-xl border text-sm" style={{ borderColor: 'var(--border)', color: 'var(--text)' }}>
            {dark ? '☀️' : '🌙'}
          </button>
        </div>
        <p className="mb-8 text-sm" style={{ color: 'var(--text-muted)' }}>تسجيل دخول الأدمن</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <div className="p-3 rounded-xl text-sm" style={{ backgroundColor: '#fef2f2', color: '#dc2626' }}>{error}</div>}
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text)' }}>البريد الإلكتروني أو رقم الهاتف</label>
            <input type="text" value={email} onChange={e => setEmail(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2"
              style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }}
              placeholder="admin@lms.com" required />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text)' }}>كلمة المرور</label>
            <div className="relative">
              <input type={showPw ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2"
                style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }}
                placeholder="••••••••" required />
              <button type="button" onClick={() => setShowPw(!showPw)}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-xs" style={{ color: 'var(--text-muted)' }}>
                {showPw ? 'إخفاء' : 'إظهار'}
              </button>
            </div>
          </div>
          <button type="submit" disabled={loading}
            className="w-full py-3 rounded-xl text-white font-bold text-lg disabled:opacity-50 transition-transform active:scale-[0.98]"
            style={{ backgroundColor: 'var(--primary,#2563eb)' }}>
            {loading ? 'جاري...' : 'دخول'}
          </button>
        </form>
      </div>
    </div>
  );
}
