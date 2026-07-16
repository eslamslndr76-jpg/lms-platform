'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '../../lib/auth';
import { useToast } from '../../components/Toast';
import { useBranding } from '../../components/BrandingProvider';
import { parseNationalId } from '../../lib/nationalId';
import { api } from '../../lib/api';

function RegisterParticleBg() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      <div className="absolute top-5 right-5 w-72 h-72 rounded-full opacity-10 blur-3xl animate-float" style={{ backgroundColor: 'var(--primary)' }} />
      <div className="absolute bottom-5 left-5 w-96 h-96 rounded-full opacity-10 blur-3xl animate-float" style={{ backgroundColor: 'var(--secondary)', animationDelay: '2s' }} />
      <div className="absolute inset-0 bg-dots opacity-20" />
    </div>
  );
}

function PasswordStrength({ password }: { password: string }) {
  const getStrength = (): { level: number; label: string; color: string } => {
    let score = 0;
    if (password.length >= 6) score++;
    if (password.length >= 10) score++;
    if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
    if (/\d/.test(password)) score++;
    if (/[^a-zA-Z0-9]/.test(password)) score++;
    const labels = ['ضعيفة', 'متوسطة', 'قوية', 'قوية جداً', 'ممتازة'];
    const colors = ['#ef4444', '#f59e0b', '#22c55e', '#16a34a', '#059669'];
    return { level: Math.min(score, 4), label: labels[Math.min(score, 4)], color: colors[Math.min(score, 4)] };
  };

  if (!password) return null;
  const { level, label, color } = getStrength();
  return (
    <div className="mt-2">
      <div className="flex gap-1 mb-1">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="h-1.5 flex-1 rounded-full transition-all duration-300"
            style={{ backgroundColor: i <= level ? color : 'var(--border)' }} />
        ))}
      </div>
      <p className="text-xs" style={{ color }}>{label}</p>
    </div>
  );
}

const steps = [
  { title: 'المعلومات الأساسية', icon: '👤', desc: 'الاسم والبريد والهاتف' },
  { title: 'التحقق من الهاتف', icon: '📱', desc: 'رمز التحقق عبر واتساب' },
  { title: 'التحقق من الهوية', icon: '🔐', desc: 'الرقم القومي والتسجيل' },
  { title: 'كلمة المرور', icon: '🚀', desc: 'أنشئ كلمة مرور قوية' },
];

export default function RegisterPage() {
  const { register } = useAuth();
  const { show } = useToast();
  const { primaryColor, secondaryColor } = useBranding();
  const router = useRouter();

  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [nationalId, setNationalId] = useState('');
  const [nationalIdInfo, setNationalIdInfo] = useState('');
  const [isEnrolled, setIsEnrolled] = useState(false);
  const [universityName, setUniversityName] = useState('');
  const [universityCode, setUniversityCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [mounted, setMounted] = useState(false);

  // Phone verification state
  const [phoneOtp, setPhoneOtp] = useState('');
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [otpCooldown, setOtpCooldown] = useState(0);

  useEffect(() => { setMounted(true); }, []);

  // OTP cooldown timer
  useEffect(() => {
    if (otpCooldown <= 0) return;
    const timer = setInterval(() => {
      setOtpCooldown(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [otpCooldown]);

  const validateStep = (s: number): boolean => {
    const errs: Record<string, string> = {};
    if (s === 0) {
      if (!name.trim()) errs.name = 'الاسم مطلوب';
      if (!email.trim()) errs.email = 'البريد الإلكتروني مطلوب';
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errs.email = 'البريد الإلكتروني غير صحيح';
      if (!phone.trim()) errs.phone = 'رقم الهاتف مطلوب';
      else if (!/^01[0-9]{9}$/.test(phone.replace(/\s/g, ''))) errs.phone = 'رقم الهاتف يجب أن يكون 11 رقم';
    }
    if (s === 1) {
      if (!phoneVerified) errs.phoneOtp = 'يجب التحقق من رقم الهاتف';
    }
    if (s === 2) {
      const cleaned = nationalId.replace(/\s/g, '');
      if (!cleaned) errs.nationalId = 'الرقم القومي مطلوب';
      else if (!/^\d{14}$/.test(cleaned)) errs.nationalId = 'الرقم القومي يجب أن يكون 14 رقماً';
      else {
        const info = parseNationalId(cleaned);
        if (!info.valid) errs.nationalId = info.error || 'الرقم القومي غير صالح';
      }
      if (isEnrolled) {
        if (!universityName.trim()) errs.universityName = 'اسم المعهد أو الجامعة مطلوب';
        if (!universityCode.trim()) errs.universityCode = 'الكود الجامعي مطلوب';
      }
    }
    if (s === 3) {
      if (!password) errs.password = 'كلمة المرور مطلوبة';
      else if (password.length < 6) errs.password = 'كلمة المرور يجب أن تكون 6 أحرف على الأقل';
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const nextStep = () => {
    if (validateStep(step)) setStep(Math.min(step + 1, 3));
  };

  const prevStep = () => setStep(Math.max(step - 1, 0));

const handleSendPhoneOtp = async () => {
    const cleaned = phone.replace(/\s/g, '');
    if (!cleaned || !/^01[0-9]{9}$/.test(cleaned)) {
      setErrors({ phone: 'أدخل رقم هاتف صحيح أولاً' });
      return;
    }

    // Check if phone is already registered
    setSendingOtp(true);
    try {
      const checkResult = await api('/api/auth/check-phone', { method: 'POST', body: JSON.stringify({ phone: cleaned }) }) as { exists: boolean };
      if (checkResult.exists) {
        setErrors({ phone: 'الرقم مسجل من قبل، جرب تسجيل الدخول' });
        setSendingOtp(false);
        return;
      }
    } catch {
      // If check-phone fails, continue with OTP flow
    }

    try {
      await api('/api/whatsapp/send-verification', { method: 'POST', body: JSON.stringify({ phone: cleaned }) });
      show('تم إرسال رمز التحقق على واتساب');
      setOtpCooldown(60);
      setErrors({});
    } catch (err: any) {
      const msg = err.message || '';
      if (msg.includes('not connected') || msg.includes('503') || msg.includes('bot not')) {
        show('خدمة واتساب غير متصلة حالياً. حاول مرة أخرى بعد دقائق قليلة.', 'error');
      } else {
        show(msg || 'فشل إرسال الرمز', 'error');
      }
    } finally {
      setSendingOtp(false);
    }
  };

  const handleVerifyPhoneOtp = async () => {
    if (!phoneOtp || phoneOtp.length !== 6) {
      setErrors({ phoneOtp: 'أدخل الرمز المكون من 6 أرقام' });
      return;
    }

    setLoading(true);
    try {
      await api('/api/whatsapp/verify-otp', {
        method: 'POST',
        body: JSON.stringify({
          phone: phone.replace(/\s/g, ''),
          otp: phoneOtp,
        }),
      });
      setPhoneVerified(true);
      show('تم التحقق من رقم الهاتف بنجاح');
      setErrors({});
    } catch (err: any) {
      show(err.message || 'الرمز غير صحيح', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleNationalIdBlur = () => {
    const cleaned = nationalId.replace(/\s/g, '');
    if (cleaned.length !== 14) { setNationalIdInfo(''); return; }
    const info = parseNationalId(cleaned);
    if (info.valid) {
      setNationalIdInfo('valid');
      setErrors(prev => { const n = { ...prev }; delete n.nationalId; return n; });
    } else {
      setNationalIdInfo('');
      setErrors(prev => ({ ...prev, nationalId: info.error || 'الرقم القومي غير صالح' }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateStep(step)) return;
    if (step < 3) { nextStep(); return; }
    setLoading(true);
    try {
      const cleaned = nationalId.replace(/\s/g, '');
      const info = parseNationalId(cleaned);
      await register(
        name, email, password, phone.replace(/\s/g, ''),
        cleaned,
        info.valid ? info.birthDate : undefined,
        info.valid ? info.gender : undefined,
        info.valid ? info.governorate : undefined,
        isEnrolled,
        isEnrolled ? universityName.trim() : undefined,
        isEnrolled ? universityCode.trim() : undefined,
      );
      show('تم إنشاء الحساب بنجاح 🎉');
      router.push('/dashboard');
    } catch (err: any) {
      show(err.message || 'فشل إنشاء الحساب', 'error');
    } finally {
      setLoading(false);
    }
  };

  const inputClass = (field: string, hasError?: boolean) =>
    `input-focus w-full pr-10 pl-4 py-3 rounded-xl text-sm ${errors[field] || hasError ? 'border-red-500' : ''}`;

  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden pt-16" style={{ backgroundColor: 'var(--bg)' }}>
      <RegisterParticleBg />

      <div className={`relative w-full max-w-lg mx-auto px-4 py-8 ${mounted ? 'animate-fade-up' : 'opacity-0'}`}>
        {/* Progress Bar */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            {steps.map((s, i) => (
              <div key={i} className="flex flex-col items-center" style={{ flex: i === 0 ? '0 0 auto' : undefined }}>
                <button onClick={() => { if (i < step) setStep(i); }}
                  className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold transition-all duration-300 ${i <= step ? 'text-white' : ''}`}
                  style={{
                    backgroundColor: i <= step ? primaryColor : 'var(--card)',
                    borderColor: i <= step ? primaryColor : 'var(--border)',
                    border: i > step ? '2px solid' : 'none',
                    color: i > step ? 'var(--text-muted)' : 'white',
                    transform: i === step ? 'scale(1.1)' : 'scale(1)',
                  }}>
                  {i < step ? (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                    </svg>
                  ) : (
                    s.icon
                  )}
                </button>
                <p className="text-[10px] mt-1.5 font-medium" style={{ color: i === step ? 'var(--text)' : 'var(--text-light)' }}>
                  {s.title}
                </p>
                <p className="text-[9px]" style={{ color: 'var(--text-light)' }}>{s.desc}</p>
              </div>
            ))}
          </div>
          <div className="relative h-1.5 rounded-full" style={{ backgroundColor: 'var(--border)' }}>
            <div className="absolute top-0 right-0 h-full rounded-full transition-all duration-500" style={{ backgroundColor: primaryColor, width: `${((step + 1) / steps.length) * 100}%` }} />
          </div>
        </div>

        {/* Form Card */}
        <div className="glass-strong rounded-3xl p-6 sm:p-8">
          <form onSubmit={handleSubmit} noValidate>
            {/* Step 0: Basic Info */}
            {step === 0 && (
              <div className="space-y-5 animate-fade-left">
                <div className="text-center mb-4">
                  <div className="w-16 h-16 mx-auto mb-3 rounded-2xl flex items-center justify-center text-2xl" style={{ backgroundColor: `${primaryColor}12` }}>
                    {steps[0].icon}
                  </div>
                  <h2 className="text-xl font-bold" style={{ color: 'var(--text)' }}>المعلومات الأساسية</h2>
                  <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>أدخل بياناتك الشخصية</p>
                </div>
                {[
                  { key: 'name' as const, label: 'الاسم الكامل', placeholder: 'محمد أحمد', type: 'text', icon: '👤' },
                  { key: 'email' as const, label: 'البريد الإلكتروني', placeholder: 'example@email.com', type: 'email', icon: '📧' },
                  { key: 'phone' as const, label: 'رقم الهاتف', placeholder: '01000000000', type: 'tel', icon: '📱' },
                ].map((f) => {
                  const val = f.key === 'name' ? name : f.key === 'email' ? email : phone;
                  const setInput = f.key === 'name' ? setName : f.key === 'email' ? setEmail : setPhone;
                  return (
                  <div key={f.key}>
                    <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text)' }}>{f.label}</label>
                    <div className="relative">
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm">{f.icon}</span>
                      <input type={f.type} value={val}
                        onChange={e => {
                          setInput(e.target.value);
                          setErrors(prev => { const n = { ...prev }; delete n[f.key]; return n; });
                        }}
                        className={inputClass(f.key)}
                        style={{ backgroundColor: 'var(--card)', color: 'var(--text)' }}
                        placeholder={f.placeholder}
                        maxLength={f.key === 'phone' ? 11 : undefined} required />
                    </div>
                    {errors[f.key] && <p className="text-xs mt-1 text-red-500">{errors[f.key]}</p>}
                    {f.key === 'phone' && !errors.phone && (
                      <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                        💬 يُفضل أن يكون هذا الرقم مسجل على واتساب لتلقي الإشعارات
                      </p>
                    )}
                  </div>
                  );
                })}
              </div>
            )}

            {/* Step 1: Phone Verification */}
            {step === 1 && (
              <div className="space-y-5 animate-fade-left">
                <div className="text-center mb-4">
                  <div className="w-16 h-16 mx-auto mb-3 rounded-2xl flex items-center justify-center text-2xl" style={{ backgroundColor: `${primaryColor}12` }}>
                    {phoneVerified ? '✅' : steps[1].icon}
                  </div>
                  <h2 className="text-xl font-bold" style={{ color: 'var(--text)' }}>
                    {phoneVerified ? 'تم التحقق بنجاح' : 'التحقق من الهاتف'}
                  </h2>
                  <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
                    {phoneVerified 
                      ? `رقم ${phone} تم التحقق منه`
                      : 'سنرسل رمز تحقق على واتساب'
                    }
                  </p>
                </div>

                {!phoneVerified ? (
                  <>
                    <div className="rounded-xl p-4" style={{ backgroundColor: `${primaryColor}08` }}>
                      <p className="text-sm text-center" style={{ color: 'var(--text)' }}>
                        📱 سيتم إرسال رمز تحقق على الرقم: <span className="font-bold">{phone}</span>
                      </p>
                    </div>

                    {errors.phoneOtp && (
                      <p className="text-sm text-center text-red-500">{errors.phoneOtp}</p>
                    )}

                    <button
                      type="button"
                      onClick={handleSendPhoneOtp}
                      disabled={sendingOtp || otpCooldown > 0}
                      className="w-full py-3 rounded-xl text-white font-bold text-sm disabled:opacity-50 transition-transform active:scale-[0.98]"
                      style={{ backgroundColor: primaryColor }}
                    >
                      {sendingOtp ? 'جاري الإرسال...' : otpCooldown > 0 ? ` إعادة الإرسال (${otpCooldown}s)` : 'إرسال رمز التحقق'}
                    </button>

                    <div>
                      <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text)' }}>أدخل الرمز</label>
                      <input
                        type="text"
                        value={phoneOtp}
                        onChange={e => {
                          setPhoneOtp(e.target.value.replace(/\D/g, '').slice(0, 6));
                          setErrors(prev => ({ ...prev, phoneOtp: '' }));
                        }}
                        className={`input-focus w-full py-3 rounded-xl text-sm ${errors.phoneOtp ? 'border-red-500' : ''}`}
                        style={{ backgroundColor: 'var(--card)', color: 'var(--text)', direction: 'ltr', textAlign: 'center', letterSpacing: '8px', fontSize: '24px' }}
                        placeholder="000000"
                        maxLength={6}
                        dir="ltr"
                      />
                      {errors.phoneOtp && <p className="text-xs mt-1 text-red-500">{errors.phoneOtp}</p>}
                    </div>

                    <button
                      type="button"
                      onClick={handleVerifyPhoneOtp}
                      disabled={loading || phoneOtp.length !== 6}
                      className="w-full py-3 rounded-xl text-white font-bold text-sm disabled:opacity-50 transition-transform active:scale-[0.98]"
                      style={{ backgroundColor: '#22c55e' }}
                    >
                      {loading ? 'جاري التحقق...' : 'تحقق من الرمز'}
                    </button>
                  </>
                ) : (
                  <div className="text-center space-y-4">
                    <div className="w-20 h-20 mx-auto rounded-full flex items-center justify-center text-4xl" style={{ backgroundColor: '#22c55e20' }}>
                      ✅
                    </div>
                    <p className="font-medium" style={{ color: '#22c55e' }}>
                      تم التحقق من رقم الهاتف بنجاح
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Step 2: Identity Verification */}
            {step === 2 && (
              <div className="space-y-5 animate-fade-left">
                <div className="text-center mb-4">
                  <div className="w-16 h-16 mx-auto mb-3 rounded-2xl flex items-center justify-center text-2xl" style={{ backgroundColor: `${secondaryColor}12` }}>
                    {steps[2].icon}
                  </div>
                  <h2 className="text-xl font-bold" style={{ color: 'var(--text)' }}>التحقق من الهوية</h2>
                  <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>أدخل الرقم القومي للتحقق</p>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text)' }}>الرقم القومي</label>
                  <div className="relative">
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm">🆔</span>
                    <input type="text" value={nationalId} onChange={e => { setNationalId(e.target.value.replace(/\D/g, '').slice(0, 14)); setErrors(prev => { const n = { ...prev }; delete n.nationalId; return n; }); }}
                      onBlur={handleNationalIdBlur}
                      className={inputClass('nationalId', false)}
                      style={{ backgroundColor: 'var(--card)', color: 'var(--text)', direction: 'ltr', textAlign: 'center', letterSpacing: '2px', fontSize: '18px' }}
                      placeholder="_ _ _ _ _ _ _ _ _ _ _ _ _ _" />
                  </div>
                  {errors.nationalId && <p className="text-xs mt-1 text-red-500">{errors.nationalId}</p>}
                  {!errors.nationalId && nationalIdInfo === 'valid' && (
                    <p className="text-xs mt-1 flex items-center gap-1" style={{ color: '#22c55e' }}>
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                      </svg>
                      رقم قومي صحيح
                    </p>
                  )}
                </div>
                <div>
                  <label className="flex items-center gap-3 cursor-pointer group">
                    <div className="relative">
                      <input type="checkbox" checked={isEnrolled} onChange={e => setIsEnrolled(e.target.checked)}
                        className="sr-only" />
                      <div className={`w-5 h-5 rounded-lg border-2 transition-all duration-200 flex items-center justify-center ${isEnrolled ? 'text-white' : ''}`}
                        style={{ borderColor: isEnrolled ? primaryColor : 'var(--border)', backgroundColor: isEnrolled ? primaryColor : 'transparent' }}>
                        {isEnrolled && (
                          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                          </svg>
                        )}
                      </div>
                    </div>
                    <span className="text-sm font-medium group-hover:opacity-80 transition-opacity" style={{ color: 'var(--text)' }}>
                      هل الطالب مقيد بجامعة أو معهد؟
                    </span>
                  </label>
                </div>
                {isEnrolled && (
                  <div className="space-y-4 animate-fade-up">
                    <div>
                      <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text)' }}>اسم المعهد أو الجامعة</label>
                      <input type="text" value={universityName} onChange={e => { setUniversityName(e.target.value); setErrors(prev => { const n = { ...prev }; delete n.universityName; return n; }); }}
                        className={inputClass('universityName')}
                        style={{ backgroundColor: 'var(--card)', color: 'var(--text)' }}
                        placeholder="جامعة القاهرة / المعهد العالي للهندسة" />
                      {errors.universityName && <p className="text-xs mt-1 text-red-500">{errors.universityName}</p>}
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text)' }}>الكود الجامعي</label>
                      <input type="text" value={universityCode} onChange={e => { setUniversityCode(e.target.value); setErrors(prev => { const n = { ...prev }; delete n.universityCode; return n; }); }}
                        className={inputClass('universityCode')}
                        style={{ backgroundColor: 'var(--card)', color: 'var(--text)', direction: 'ltr' }}
                        placeholder="xxxxxx" />
                      {errors.universityCode && <p className="text-xs mt-1 text-red-500">{errors.universityCode}</p>}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Step 3: Password */}
            {step === 3 && (
              <div className="space-y-5 animate-fade-left">
                <div className="text-center mb-4">
                  <div className="w-16 h-16 mx-auto mb-3 rounded-2xl flex items-center justify-center text-2xl" style={{ backgroundColor: `${primaryColor}12` }}>
                    {steps[3].icon}
                  </div>
                  <h2 className="text-xl font-bold" style={{ color: 'var(--text)' }}>كلمة المرور</h2>
                  <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>اختر كلمة مرور قوية لحماية حسابك</p>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text)' }}>كلمة المرور</label>
                  <div className="relative">
                    <svg className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5" style={{ color: 'var(--text-light)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
                    </svg>
                    <input type="password" value={password} onChange={e => { setPassword(e.target.value); setErrors(prev => { const n = { ...prev }; delete n.password; return n; }); }}
                      className={inputClass('password')}
                      style={{ backgroundColor: 'var(--card)', color: 'var(--text)' }}
                      placeholder="••••••••" required />
                  </div>
                  <PasswordStrength password={password} />
                  {errors.password && <p className="text-xs mt-1 text-red-500">{errors.password}</p>}
                </div>

                <div className="rounded-2xl p-4" style={{ backgroundColor: `${primaryColor}08` }}>
                  <p className="text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                    بتسجيلك أنت توافق على{' '}
                    <span className="font-medium" style={{ color: primaryColor }}>الشروط والأحكام</span>
                    {' '}وتقر بأن جميع البيانات التي أدخلتها صحيحة.
                  </p>
                </div>
              </div>
            )}

            {/* Navigation Buttons */}
            <div className="flex items-center justify-between mt-8 gap-3">
              {step > 0 ? (
                <button type="button" onClick={prevStep}
                  className="px-6 py-3 rounded-xl border text-sm font-medium transition-all hover:bg-white/5 flex items-center gap-2"
                  style={{ borderColor: 'var(--border)', color: 'var(--text)' }}>
                  <svg className="w-4 h-4 rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="m9 5 7 7-7 7" />
                  </svg>
                  رجوع
                </button>
              ) : <div />}

              <button type="submit" disabled={loading}
                className="ripple-btn px-8 py-3 rounded-xl text-white font-bold text-sm transition-all duration-300 hover:shadow-xl disabled:opacity-60 flex items-center gap-2"
                style={{ backgroundColor: primaryColor }}>
                {loading ? (
                  <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                ) : step < 3 ? (
                  <>
                    التالي
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="m9 5 7 7-7 7" />
                    </svg>
                  </>
                ) : (
                  <>
                    🎉 أنشئ حسابي
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15m3 0 3-3m0 0-3-3m3 3H9" />
                    </svg>
                  </>
                )}
              </button>
            </div>
          </form>

          <p className="text-center mt-6 text-sm" style={{ color: 'var(--text-muted)' }}>
            لديك حساب بالفعل؟{' '}
            <Link href="/login" className="font-bold transition-all hover:opacity-80" style={{ color: primaryColor }}>
              تسجيل دخول ←
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
