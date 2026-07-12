'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '../../lib/auth';
import { useToast } from '../../components/Toast';
import { useBranding } from '../../components/BrandingProvider';
import PasswordInput from '../../components/PasswordInput';

export default function LoginPage() {
  const { login } = useAuth();
  const { show } = useToast();
  const { primaryColor } = useBranding();
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
    <div className="flex-1 flex flex-col justify-center max-w-sm mx-auto w-full animate-fade-in p-4">
      <h1 className="text-2xl font-bold text-center mb-1" style={{ color: 'var(--text)' }}>تسجيل الدخول</h1>
      <p className="text-[var(--text-muted)] text-center mb-8">أدخل بياناتك للمتابعة</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text)' }}>البريد الإلكتروني أو رقم الهاتف</label>
            <input type="text" value={email} onChange={e => setEmail(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2"
              style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)', color: 'var(--text)' }}
              placeholder="example@email.com أو 01000000000" required />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text)' }}>كلمة المرور</label>
            <PasswordInput value={password} onChange={setPassword} />
          </div>
          <div className="flex justify-end">
            <Link href="/forgot-password" className="text-sm font-medium" style={{ color: primaryColor }}>
              نسيت كلمة المرور؟
            </Link>
          </div>
          <button type="submit" disabled={loading}
            className="w-full py-3 rounded-xl text-white font-bold text-lg disabled:opacity-50 transition-transform active:scale-[0.98]"
            style={{ backgroundColor: primaryColor }}>
            {loading ? 'جاري التحميل...' : 'دخول'}
          </button>
        </form>

        <p className="text-center mt-6 text-sm" style={{ color: 'var(--text-muted)' }}>
          ليس لديك حساب؟{' '}
          <Link href="/register" className="font-medium" style={{ color: primaryColor }}>إنشاء حساب</Link>
        </p>
    </div>
  );
}
