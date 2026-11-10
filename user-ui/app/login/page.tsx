'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '../../lib/auth';
import { useToast } from '../../components/Toast';
import { useBranding } from '../../components/BrandingProvider';
import PasswordInput from '../../components/PasswordInput';
import { postLoginTarget } from '../../lib/redirect';

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
      router.push(postLoginTarget(window.location.search));
    } catch (err: any) {
      show(err.message || 'فشل تسجيل الدخول', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col justify-center max-w-sm mx-auto w-full animate-fade-in p-4">
      <div className="text-center mb-8">
        <div
          className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
          style={{ backgroundColor: 'var(--md-sys-color-primary-container)' }}
        >
          <span className="material-symbols-outlined text-[28px]" style={{ color: 'var(--md-sys-color-on-primary-container)' }}>person</span>
        </div>
        <h1 className="text-2xl font-bold mb-1" style={{ color: 'var(--md-sys-color-on-surface)' }}>تسجيل الدخول</h1>
        <p className="text-sm" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>أدخل بياناتك للمتابعة</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--md-sys-color-on-surface)' }}>البريد الإلكتروني أو رقم الهاتف</label>
          <input type="text" value={email} onChange={e => setEmail(e.target.value)}
            className="w-full px-4 py-3 rounded-md3-sm border text-sm"
            style={{ backgroundColor: 'var(--md-sys-color-surface-container-highest)', borderColor: 'var(--md-sys-color-outline)', color: 'var(--md-sys-color-on-surface)' }}
            placeholder="example@email.com أو 01000000000" required />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--md-sys-color-on-surface)' }}>كلمة المرور</label>
          <PasswordInput value={password} onChange={setPassword} />
        </div>
        <div className="flex justify-end">
          <Link href="/forgot-password" className="text-sm font-medium" style={{ color: 'var(--md-sys-color-primary)' }}>
            نسيت كلمة المرور؟
          </Link>
        </div>
        <button type="submit" disabled={loading}
          className="w-full h-12 rounded-full text-sm font-medium disabled:opacity-50 transition-all"
          style={{ backgroundColor: 'var(--md-sys-color-primary)', color: 'var(--md-sys-color-on-primary)' }}>
          {loading ? 'جاري التحميل...' : 'دخول'}
        </button>
      </form>

      <p className="text-center mt-6 text-sm" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>
        ليس لديك حساب؟{' '}
        <Link href="/register" className="font-medium" style={{ color: 'var(--md-sys-color-primary)' }}>إنشاء حساب</Link>
      </p>
    </div>
  );
}
