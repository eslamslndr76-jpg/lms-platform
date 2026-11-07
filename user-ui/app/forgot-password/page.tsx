'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useToast } from '../../components/Toast';
import { useBranding } from '../../components/BrandingProvider';
import { api } from '../../lib/api';

type Step = 'email' | 'otp' | 'password' | 'success';

export default function ForgotPasswordPage() {
  const { show } = useToast();
  const { primaryColor } = useBranding();
  const router = useRouter();

  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showNewPass, setShowNewPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);

  const validateEmail = (): boolean => {
    if (!email.trim()) {
      setErrors({ email: 'البريد الإلكتروني مطلوب' });
      return false;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setErrors({ email: 'البريد الإلكتروني غير صحيح' });
      return false;
    }
    setErrors({});
    return true;
  };

  const handleSendOTP = async () => {
    if (!validateEmail()) return;
    
    setLoading(true);
    try {
      await api('/api/notifications/forgot-password', { method: 'POST', body: JSON.stringify({ email }) });
      show('تم إرسال رمز التحقق إلى بريدك الإلكتروني');
      setStep('otp');
    } catch (err: any) {
      const msg = err.message || '';
      show(msg || 'فشل إرسال رمز التحقق', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async () => {
    if (!otp || otp.length !== 6) {
      setErrors({ otp: 'أدخل رمز التحقق المكون من 6 أرقام' });
      return;
    }
    
    setLoading(true);
    try {
      await api('/api/notifications/verify-otp', { 
        method: 'POST', 
        body: JSON.stringify({ email, otp }) 
      });
      show('تم التحقق بنجاح');
      setStep('password');
    } catch (err: any) {
      show(err.message || 'الرمز غير صحيح', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    const errs: Record<string, string> = {};
    
    if (!newPassword) {
      errs.newPassword = 'كلمة المرور مطلوبة';
    } else if (newPassword.length < 6) {
      errs.newPassword = 'كلمة المرور يجب أن تكون 6 أحرف على الأقل';
    }
    
    if (newPassword !== confirmPassword) {
      errs.confirmPassword = 'كلمتا المرور غير متطابقتين';
    }
    
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }
    
    setLoading(true);
    try {
      await api('/api/notifications/reset-password', {
        method: 'POST',
        body: JSON.stringify({ email, otp, newPassword }),
      });
      show('تم إعادة تعيين كلمة المرور بنجاح');
      setStep('success');
    } catch (err: any) {
      show(err.message || 'فشل إعادة تعيين كلمة المرور', 'error');
    } finally {
      setLoading(false);
    }
  };

  const inputClass = (field: string) =>
    `w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 ${errors[field] ? 'border-red-500' : ''}`;

  return (
    <div className="flex-1 flex flex-col justify-center max-w-sm mx-auto w-full animate-fade-in p-4">
      <h1 className="text-2xl font-bold text-center mb-1" style={{ color: 'var(--text)' }}>
        نسيت كلمة المرور؟
      </h1>
      <p className="text-[var(--text-muted)] text-center mb-8">
        {step === 'email' && 'أدخل بريدك الإلكتروني لإرسال رمز التحقق'}
        {step === 'otp' && 'أدخل الرمز المرسل على بريدك الإلكتروني'}
        {step === 'password' && 'أدخل كلمة المرور الجديدة'}
        {step === 'success' && 'تم إعادة تعيين كلمة المرور بنجاح'}
      </p>

      {/* Step 1: Email */}
      {step === 'email' && (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text)' }}>
              البريد الإلكتروني
            </label>
            <div className="relative">
              <span className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }}>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" /></svg>
              </span>
              <input
                type="email"
                value={email}
                onChange={e => {
                  setEmail(e.target.value);
                  setErrors({});
                }}
                className={inputClass('email')}
                style={{ backgroundColor: 'var(--card)', color: 'var(--text)' }}
                placeholder="example@email.com"
                dir="ltr"
                required
              />
            </div>
            {errors.email && <p className="text-xs mt-1 text-red-500">{errors.email}</p>}
          </div>
          
          <button
            onClick={handleSendOTP}
            disabled={loading}
            className="w-full py-3 rounded-xl text-white font-bold text-lg disabled:opacity-50 transition-transform active:scale-[0.98]"
            style={{ backgroundColor: primaryColor }}
          >
            {loading ? 'جاري الإرسال...' : 'إرسال رمز التحقق'}
          </button>
        </div>
      )}

      {/* Step 2: OTP */}
      {step === 'otp' && (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text)' }}>
              رمز التحقق
            </label>
            <input
              type="text"
              value={otp}
              onChange={e => {
                setOtp(e.target.value.replace(/\D/g, '').slice(0, 6));
                setErrors({});
              }}
              className={inputClass('otp')}
              style={{ backgroundColor: 'var(--card)', color: 'var(--text)', direction: 'ltr', textAlign: 'center', letterSpacing: '8px', fontSize: '24px' }}
              placeholder="000000"
              maxLength={6}
              required
            />
            {errors.otp && <p className="text-xs mt-1 text-red-500">{errors.otp}</p>}
          </div>
          
          <button
            onClick={handleVerifyOTP}
            disabled={loading}
            className="w-full py-3 rounded-xl text-white font-bold text-lg disabled:opacity-50 transition-transform active:scale-[0.98]"
            style={{ backgroundColor: primaryColor }}
          >
            {loading ? 'جاري التحقق...' : 'تحقق'}
          </button>
          
          <button
            onClick={() => setStep('email')}
            className="w-full py-2 text-sm font-medium"
            style={{ color: primaryColor }}
          >
            تغيير البريد
          </button>
        </div>
      )}

      {/* Step 3: New Password */}
      {step === 'password' && (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text)' }}>
              كلمة المرور الجديدة
            </label>
            <div className="relative">
              <input
                type={showNewPass ? 'text' : 'password'}
                value={newPassword}
                onChange={e => {
                  setNewPassword(e.target.value);
                  setErrors(prev => ({ ...prev, newPassword: '' }));
                }}
                className={inputClass('newPassword')}
                style={{ backgroundColor: 'var(--card)', color: 'var(--text)' }}
                placeholder="••••••••"
                required
              />
              <button type="button" onClick={() => setShowNewPass(!showNewPass)}
                className="absolute left-3 top-1/2 -translate-y-1/2"
                style={{ color: 'var(--text-muted)' }}>
                {showNewPass ? (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88" /></svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" /></svg>
                )}
              </button>
            </div>
            {errors.newPassword && <p className="text-xs mt-1 text-red-500">{errors.newPassword}</p>}
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text)' }}>
              تأكيد كلمة المرور
            </label>
            <div className="relative">
              <input
                type={showConfirmPass ? 'text' : 'password'}
                value={confirmPassword}
                onChange={e => {
                  setConfirmPassword(e.target.value);
                  setErrors(prev => ({ ...prev, confirmPassword: '' }));
                }}
                className={inputClass('confirmPassword')}
                style={{ backgroundColor: 'var(--card)', color: 'var(--text)' }}
                placeholder="••••••••"
                required
              />
              <button type="button" onClick={() => setShowConfirmPass(!showConfirmPass)}
                className="absolute left-3 top-1/2 -translate-y-1/2"
                style={{ color: 'var(--text-muted)' }}>
                {showConfirmPass ? (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88" /></svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" /></svg>
                )}
              </button>
            </div>
            {errors.confirmPassword && <p className="text-xs mt-1 text-red-500">{errors.confirmPassword}</p>}
          </div>
          
          <button
            onClick={handleResetPassword}
            disabled={loading}
            className="w-full py-3 rounded-xl text-white font-bold text-lg disabled:opacity-50 transition-transform active:scale-[0.98]"
            style={{ backgroundColor: primaryColor }}
          >
            {loading ? 'جاري التحديث...' : 'إعادة تعيين كلمة المرور'}
          </button>
        </div>
      )}

      {/* Step 4: Success */}
      {step === 'success' && (
        <div className="text-center space-y-4">
          <div className="w-16 h-16 mx-auto rounded-full flex items-center justify-center" style={{ backgroundColor: '#22c55e20' }}>
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="#22c55e" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" /></svg>
          </div>
          <p style={{ color: 'var(--text)' }}>تم إعادة تعيين كلمة المرور بنجاح</p>
          <button
            onClick={() => router.push('/login')}
            className="w-full py-3 rounded-xl text-white font-bold text-lg"
            style={{ backgroundColor: primaryColor }}
          >
            تسجيل الدخول
          </button>
        </div>
      )}

      <p className="text-center mt-6 text-sm" style={{ color: 'var(--text-muted)' }}>
        <Link href="/login" className="font-medium" style={{ color: primaryColor }}>
          العودة لتسجيل الدخول
        </Link>
      </p>
    </div>
  );
}
