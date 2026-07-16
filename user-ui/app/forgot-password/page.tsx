'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useToast } from '../../components/Toast';
import { useBranding } from '../../components/BrandingProvider';
import { api } from '../../lib/api';

type Step = 'phone' | 'otp' | 'password' | 'success';

export default function ForgotPasswordPage() {
  const { show } = useToast();
  const { primaryColor } = useBranding();
  const router = useRouter();

  const [step, setStep] = useState<Step>('phone');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showNewPass, setShowNewPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);

  const validatePhone = (): boolean => {
    const cleaned = phone.replace(/\s/g, '');
    if (!cleaned) {
      setErrors({ phone: 'رقم الهاتف مطلوب' });
      return false;
    }
    if (!/^01[0-9]{9}$/.test(cleaned)) {
      setErrors({ phone: 'رقم الهاتف يجب أن يكون 11 رقم ويبدأ بـ 01' });
      return false;
    }
    setErrors({});
    return true;
  };

  const handleSendOTP = async () => {
    if (!validatePhone()) return;
    
    setLoading(true);
    try {
      await api('/api/whatsapp/forgot-password', { method: 'POST', body: JSON.stringify({ phone: phone.replace(/\s/g, '') }) });
      show('تم إرسال رمز التحقق إلى رقم هاتفك');
      setStep('otp');
    } catch (err: any) {
      const msg = err.message || '';
      if (msg.includes('not connected') || msg.includes('503') || msg.includes('bot not')) {
        show('خدمة واتساب غير متصلة حالياً. حاول مرة أخرى بعد دقائق قليلة.', 'error');
      } else {
        show(msg || 'فشل إرسال رمز التحقق', 'error');
      }
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
      await api('/api/whatsapp/verify-otp', { 
        method: 'POST', 
        body: JSON.stringify({ phone: phone.replace(/\s/g, ''), otp }) 
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
      await api('/api/whatsapp/reset-password', {
        method: 'POST',
        body: JSON.stringify({
          phone: phone.replace(/\s/g, ''),
          otp,
          newPassword,
        }),
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
        {step === 'phone' && 'أدخل رقم هاتفك لإرسال رمز التحقق'}
        {step === 'otp' && 'أدخل الرمز المرسل على واتساب'}
        {step === 'password' && 'أدخل كلمة المرور الجديدة'}
        {step === 'success' && 'تم إعادة تعيين كلمة المرور بنجاح'}
      </p>

      {/* Step 1: Phone */}
      {step === 'phone' && (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text)' }}>
              رقم الهاتف
            </label>
            <div className="relative">
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm">📱</span>
              <input
                type="tel"
                value={phone}
                onChange={e => {
                  setPhone(e.target.value.replace(/\D/g, '').slice(0, 11));
                  setErrors({});
                }}
                className={inputClass('phone')}
                style={{ backgroundColor: 'var(--card)', color: 'var(--text)' }}
                placeholder="01000000000"
                maxLength={11}
                dir="ltr"
                required
              />
            </div>
            {errors.phone && <p className="text-xs mt-1 text-red-500">{errors.phone}</p>}
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
            onClick={() => setStep('phone')}
            className="w-full py-2 text-sm font-medium"
            style={{ color: primaryColor }}
          >
            تغيير الرقم
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
                className="absolute left-3 top-1/2 -translate-y-1/2 text-sm"
                style={{ color: 'var(--text-muted)' }}>
                {showNewPass ? '🙈' : '👁'}
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
                className="absolute left-3 top-1/2 -translate-y-1/2 text-sm"
                style={{ color: 'var(--text-muted)' }}>
                {showConfirmPass ? '🙈' : '👁'}
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
          <div className="w-16 h-16 mx-auto rounded-full flex items-center justify-center text-3xl" style={{ backgroundColor: '#22c55e20' }}>
            ✅
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
