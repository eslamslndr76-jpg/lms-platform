'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '../../lib/auth';
import { useToast } from '../../components/Toast';
import { useBranding } from '../../components/BrandingProvider';

export default function LoginPage() {
  const { login } = useAuth();
  const { show } = useToast();
  const { primaryColor, systemName } = useBranding();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(email, password);
      show('تم تسجيل الدخول بنجاح');
      router.push('/dashboard');
    } catch (err: any) {
      show(err.message || 'فشل تسجيل الدخول', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col p-4">
      <div className="flex-1 flex flex-col justify-center max-w-sm mx-auto w-full">
        <h1 className="text-2xl font-bold text-center mb-1" style={{ color: primaryColor }}>{systemName}</h1>
        <p className="text-gray-500 text-center mb-8">تسجيل الدخول</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">البريد الإلكتروني</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
              placeholder="example@email.com"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">كلمة المرور</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2"
              placeholder="••••••••"
              required
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl text-white font-bold text-lg disabled:opacity-50"
            style={{ backgroundColor: primaryColor }}
          >
            {loading ? 'جاري التحميل...' : 'دخول'}
          </button>
        </form>

        <p className="text-center mt-6 text-sm text-gray-500">
          ليس لديك حساب؟{' '}
          <Link href="/register" className="font-medium" style={{ color: primaryColor }}>إنشاء حساب</Link>
        </p>
      </div>
    </div>
  );
}
