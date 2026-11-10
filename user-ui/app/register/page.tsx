'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '../../lib/auth';
import { useToast } from '../../components/Toast';
import { useBranding } from '../../components/BrandingProvider';
import { parseNationalId } from '../../lib/nationalId';
import { api } from '../../lib/api';
import { postLoginTarget } from '../../lib/redirect';

function RegisterParticleBg() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      <div className="absolute top-5 right-5 w-72 h-72 rounded-full opacity-10 blur-3xl animate-float" style={{ backgroundColor: 'var(--md-sys-color-primary)' }} />
      <div className="absolute bottom-5 left-5 w-96 h-96 rounded-full opacity-10 blur-3xl animate-float" style={{ backgroundColor: 'var(--md-sys-color-secondary)', animationDelay: '2s' }} />
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
    const colors = ['var(--md-sys-color-error)', '#f59e0b', '#22c55e', '#16a34a', '#059669'];
    return { level: Math.min(score, 4), label: labels[Math.min(score, 4)], color: colors[Math.min(score, 4)] };
  };

  if (!password) return null;
  const { level, label, color } = getStrength();
  return (
    <div className="mt-2">
      <div className="flex gap-1 mb-1">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="h-1.5 flex-1 rounded-full transition-all duration-300"
            style={{ backgroundColor: i <= level ? color : 'var(--md-sys-color-outline-variant)' }} />
        ))}
      </div>
      <p className="text-xs" style={{ color }}>{label}</p>
    </div>
  );
}

const steps = [
  { title: 'المعلومات الأساسية', icon: 'person', desc: 'الاسم والبريد والهاتف' },
  { title: 'التحقق من البريد', icon: 'mail', desc: 'رمز التحقق على البريد' },
  { title: 'التحقق من الهوية', icon: 'badge', desc: 'الرقم القومي' },
  { title: 'كلمة المرور', icon: 'lock', desc: 'أنشئ كلمة مرور قوية' },
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

  // Email verification state
  const [emailOtp, setEmailOtp] = useState('');
  const [emailVerified, setEmailVerified] = useState(false);
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
      if (!emailVerified) errs.emailOtp = 'يجب التحقق من البريد الإلكتروني';
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

const handleSendEmailOtp = async () => {
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setErrors({ email: 'أدخل بريد إلكتروني صحيح أولاً' });
      return;
    }

    setSendingOtp(true);
    try {
      await api('/api/notifications/send-verification', { method: 'POST', body: JSON.stringify({ email }) });
      show('تم إرسال رمز التحقق على البريد الإلكتروني');
      setOtpCooldown(60);
      setErrors({});
    } catch (err: any) {
      const msg = err.message || '';
      if (msg.includes('503') || msg.includes('قناة إشعارات')) {
        show('خدمة البريد الإلكتروني غير متصلة حالياً.', 'error');
      } else {
        show(msg || 'فشل إرسال الرمز', 'error');
      }
    } finally {
      setSendingOtp(false);
    }
  };

  const handleVerifyEmailOtp = async () => {
    if (!emailOtp || emailOtp.length !== 6) {
      setErrors({ emailOtp: 'أدخل الرمز المكون من 6 أرقام' });
      return;
    }

    setLoading(true);
    try {
      await api('/api/notifications/verify-otp', {
        method: 'POST',
        body: JSON.stringify({ email, otp: emailOtp }),
      });
      setEmailVerified(true);
      show('تم التحقق من البريد الإلكتروني بنجاح');
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
      show('تم إنشاء الحساب بنجاح');
      router.push(postLoginTarget(window.location.search));
    } catch (err: any) {
      show(err.message || 'فشل إنشاء الحساب', 'error');
    } finally {
      setLoading(false);
    }
  };

  const inputClass = (field: string, hasError?: boolean) =>
    `w-full pr-10 pl-4 py-3 rounded-md3-sm border text-sm transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-1 ${errors[field] || hasError ? 'border-[var(--md-sys-color-error)] focus:ring-[var(--md-sys-color-error)]' : 'border-[var(--md-sys-color-outline-variant)] focus:ring-[var(--md-sys-color-primary)]'}`;

  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden pt-16" style={{ backgroundColor: 'var(--md-sys-color-surface)' }}>
      <RegisterParticleBg />

      <div className={`relative w-full max-w-lg mx-auto px-4 py-8 ${mounted ? 'animate-fade-up' : 'opacity-0'}`}>
        {/* Progress Bar */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            {steps.map((s, i) => (
              <div key={i} className="flex flex-col items-center" style={{ flex: i === 0 ? '0 0 auto' : undefined }}>
                <button onClick={() => { if (i < step) setStep(i); }}
                  className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold transition-all duration-300"
                  style={{
                    backgroundColor: i < step ? 'var(--md-sys-color-primary)' : i === step ? 'var(--md-sys-color-primary)' : 'var(--md-sys-color-surface-container)',
                    color: i <= step ? 'var(--md-sys-color-on-primary)' : 'var(--md-sys-color-on-surface-variant)',
                    transform: i === step ? 'scale(1.1)' : 'scale(1)',
                    boxShadow: i === step ? '0 2px 8px rgba(0,0,0,0.15)' : 'none',
                  }}>
                  {i < step ? (
                    <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>check</span>
                  ) : (
                    <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>{s.icon}</span>
                  )}
                </button>
                <p className="text-[10px] mt-1.5 font-medium" style={{ color: i === step ? 'var(--md-sys-color-on-surface)' : 'var(--md-sys-color-on-surface-variant)' }}>
                  {s.title}
                </p>
                <p className="text-[9px]" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>{s.desc}</p>
              </div>
            ))}
          </div>
          <div className="relative h-1.5 rounded-full" style={{ backgroundColor: 'var(--md-sys-color-surface-container-highest)' }}>
            <div className="absolute top-0 right-0 h-full rounded-full transition-all duration-500" style={{ backgroundColor: 'var(--md-sys-color-primary)', width: `${((step + 1) / steps.length) * 100}%` }} />
          </div>
        </div>

        {/* Form Card */}
        <div className="rounded-md3-sm p-6 sm:p-8" style={{ backgroundColor: 'var(--md-sys-color-surface-container-low)' }}>
          <form onSubmit={handleSubmit} noValidate>
            {/* Step 0: Basic Info */}
            {step === 0 && (
              <div className="space-y-5 animate-fade-left">
                <div className="text-center mb-4">
                  <div className="w-16 h-16 mx-auto mb-3 rounded-md3-sm flex items-center justify-center" style={{ backgroundColor: 'var(--md-sys-color-primary-container)' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: '32px', color: 'var(--md-sys-color-on-primary-container)' }}>person</span>
                  </div>
                  <h2 className="text-xl font-bold" style={{ color: 'var(--md-sys-color-on-surface)' }}>المعلومات الأساسية</h2>
                  <p className="text-sm mt-1" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>أدخل بياناتك الشخصية</p>
                </div>
                {[
                  { key: 'name' as const, label: 'الاسم الكامل', placeholder: 'محمد أحمد', type: 'text', icon: 'person' },
                  { key: 'email' as const, label: 'البريد الإلكتروني', placeholder: 'example@email.com', type: 'email', icon: 'mail' },
                  { key: 'phone' as const, label: 'رقم الهاتف', placeholder: '01000000000', type: 'tel', icon: 'smartphone' },
                ].map((f) => {
                  const val = f.key === 'name' ? name : f.key === 'email' ? email : phone;
                  const setInput = f.key === 'name' ? setName : f.key === 'email' ? setEmail : setPhone;
                  return (
                  <div key={f.key}>
                    <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--md-sys-color-on-surface)' }}>{f.label}</label>
                    <div className="relative">
                      <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2" style={{ fontSize: '18px', color: 'var(--md-sys-color-on-surface-variant)' }}>{f.icon}</span>
                      <input type={f.type} value={val}
                        onChange={e => {
                          setInput(e.target.value);
                          setErrors(prev => { const n = { ...prev }; delete n[f.key]; return n; });
                        }}
                        className={inputClass(f.key)}
                        style={{ backgroundColor: 'var(--md-sys-color-surface-container-highest)', color: 'var(--md-sys-color-on-surface)' }}
                        placeholder={f.placeholder}
                        maxLength={f.key === 'phone' ? 11 : undefined} required />
                    </div>
                    {errors[f.key] && <p className="text-xs mt-1" style={{ color: 'var(--md-sys-color-error)' }}>{errors[f.key]}</p>}
                  </div>
                  );
                })}
              </div>
            )}

            {/* Step 1: Email Verification */}
            {step === 1 && (
              <div className="space-y-5 animate-fade-left">
                <div className="text-center mb-4">
                  <div className="w-16 h-16 mx-auto mb-3 rounded-md3-sm flex items-center justify-center" style={{ backgroundColor: 'var(--md-sys-color-primary-container)' }}>
                    {emailVerified ? (
                      <span className="material-symbols-outlined" style={{ fontSize: '32px', color: '#22c55e' }}>check_circle</span>
                    ) : (
                      <span className="material-symbols-outlined" style={{ fontSize: '32px', color: 'var(--md-sys-color-on-primary-container)' }}>mail</span>
                    )}
                  </div>
                  <h2 className="text-xl font-bold" style={{ color: 'var(--md-sys-color-on-surface)' }}>
                    {emailVerified ? 'تم التحقق بنجاح' : 'التحقق من البريد الإلكتروني'}
                  </h2>
                  <p className="text-sm mt-1" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>
                    {emailVerified 
                      ? `البريد ${email} تم التحقق منه`
                      : 'سنرسل رمز تحقق على بريدك الإلكتروني'
                    }
                  </p>
                </div>

                {!emailVerified ? (
                  <>
                    <div className="rounded-md3-sm p-4" style={{ backgroundColor: 'var(--md-sys-color-secondary-container)' }}>
                      <p className="text-sm text-center" style={{ color: 'var(--md-sys-color-on-secondary-container)' }}>
                        سيتم إرسال رمز تحقق على البريد: <span className="font-bold">{email}</span>
                      </p>
                    </div>

                    {errors.emailOtp && (
                      <p className="text-sm text-center" style={{ color: 'var(--md-sys-color-error)' }}>{errors.emailOtp}</p>
                    )}

                    <button
                      type="button"
                      onClick={handleSendEmailOtp}
                      disabled={sendingOtp || otpCooldown > 0}
                      className="w-full py-3 rounded-full text-sm font-bold disabled:opacity-50 transition-transform active:scale-[0.98]"
                      style={{ backgroundColor: 'var(--md-sys-color-primary)', color: 'var(--md-sys-color-on-primary)' }}
                    >
                      {sendingOtp ? 'جاري الإرسال...' : otpCooldown > 0 ? `إعادة الإرسال (${otpCooldown}s)` : 'إرسال رمز التحقق'}
                    </button>

                    <div>
                      <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--md-sys-color-on-surface)' }}>أدخل الرمز</label>
                      <input
                        type="text"
                        value={emailOtp}
                        onChange={e => {
                          setEmailOtp(e.target.value.replace(/\D/g, '').slice(0, 6));
                          setErrors(prev => ({ ...prev, emailOtp: '' }));
                        }}
                        className={`w-full py-3 rounded-md3-sm border text-sm transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-1 ${errors.emailOtp ? 'border-[var(--md-sys-color-error)] focus:ring-[var(--md-sys-color-error)]' : 'border-[var(--md-sys-color-outline-variant)] focus:ring-[var(--md-sys-color-primary)]'}`}
                        style={{ backgroundColor: 'var(--md-sys-color-surface-container-highest)', color: 'var(--md-sys-color-on-surface)', direction: 'ltr', textAlign: 'center', letterSpacing: '8px', fontSize: '24px' }}
                        placeholder="000000"
                        maxLength={6}
                        dir="ltr"
                      />
                      {errors.emailOtp && <p className="text-xs mt-1" style={{ color: 'var(--md-sys-color-error)' }}>{errors.emailOtp}</p>}
                    </div>

                    <button
                      type="button"
                      onClick={handleVerifyEmailOtp}
                      disabled={loading || emailOtp.length !== 6}
                      className="w-full py-3 rounded-full text-sm font-bold disabled:opacity-50 transition-transform active:scale-[0.98]"
                      style={{ backgroundColor: '#22c55e', color: '#fff' }}
                    >
                      {loading ? 'جاري التحقق...' : 'تحقق من الرمز'}
                    </button>
                  </>
                ) : (
                  <div className="text-center space-y-4">
                    <div className="w-20 h-20 mx-auto rounded-full flex items-center justify-center" style={{ backgroundColor: '#22c55e20' }}>
                      <span className="material-symbols-outlined" style={{ fontSize: '40px', color: '#22c55e' }}>check_circle</span>
                    </div>
                    <p className="font-medium" style={{ color: '#22c55e' }}>
                      تم التحقق من البريد الإلكتروني بنجاح
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Step 2: Identity Verification */}
            {step === 2 && (
              <div className="space-y-5 animate-fade-left">
                <div className="text-center mb-4">
                  <div className="w-16 h-16 mx-auto mb-3 rounded-md3-sm flex items-center justify-center" style={{ backgroundColor: 'var(--md-sys-color-secondary-container)' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: '32px', color: 'var(--md-sys-color-on-secondary-container)' }}>badge</span>
                  </div>
                  <h2 className="text-xl font-bold" style={{ color: 'var(--md-sys-color-on-surface)' }}>التحقق من الهوية</h2>
                  <p className="text-sm mt-1" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>أدخل الرقم القومي للتحقق</p>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--md-sys-color-on-surface)' }}>الرقم القومي</label>
                    <div className="relative">
                      <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2" style={{ fontSize: '18px', color: 'var(--md-sys-color-on-surface-variant)' }}>badge</span>
                      <input type="text" value={nationalId} onChange={e => { setNationalId(e.target.value.replace(/\D/g, '').slice(0, 14)); setErrors(prev => { const n = { ...prev }; delete n.nationalId; return n; }); }}
                      onBlur={handleNationalIdBlur}
                      className={inputClass('nationalId', false)}
                      style={{ backgroundColor: 'var(--md-sys-color-surface-container-highest)', color: 'var(--md-sys-color-on-surface)', direction: 'ltr', textAlign: 'center', letterSpacing: '2px', fontSize: '18px' }}
                      placeholder="_ _ _ _ _ _ _ _ _ _ _ _ _ _" />
                  </div>
                  {errors.nationalId && <p className="text-xs mt-1" style={{ color: 'var(--md-sys-color-error)' }}>{errors.nationalId}</p>}
                  {!errors.nationalId && nationalIdInfo === 'valid' && (
                    <p className="text-xs mt-1 flex items-center gap-1" style={{ color: '#22c55e' }}>
                      <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>check</span>
                      رقم قومي صحيح
                    </p>
                  )}
                </div>
                <div>
                  <label className="flex items-center gap-3 cursor-pointer group">
                    <div className="relative">
                      <input type="checkbox" checked={isEnrolled} onChange={e => setIsEnrolled(e.target.checked)}
                        className="sr-only" />
                      <div className="w-5 h-5 rounded-md3-sm border-2 transition-all duration-200 flex items-center justify-center"
                        style={{ borderColor: isEnrolled ? 'var(--md-sys-color-primary)' : 'var(--md-sys-color-outline)', backgroundColor: isEnrolled ? 'var(--md-sys-color-primary)' : 'transparent' }}>
                        {isEnrolled && (
                          <span className="material-symbols-outlined" style={{ fontSize: '16px', color: 'var(--md-sys-color-on-primary)' }}>check</span>
                        )}
                      </div>
                    </div>
                    <span className="text-sm font-medium group-hover:opacity-80 transition-opacity" style={{ color: 'var(--md-sys-color-on-surface)' }}>
                      هل الطالب مقيد بجامعة أو معهد؟
                    </span>
                  </label>
                </div>
                {isEnrolled && (
                  <div className="space-y-4 animate-fade-up">
                    <div>
                      <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--md-sys-color-on-surface)' }}>اسم المعهد أو الجامعة</label>
                      <input type="text" value={universityName} onChange={e => { setUniversityName(e.target.value); setErrors(prev => { const n = { ...prev }; delete n.universityName; return n; }); }}
                        className={inputClass('universityName')}
                        style={{ backgroundColor: 'var(--md-sys-color-surface-container-highest)', color: 'var(--md-sys-color-on-surface)' }}
                        placeholder="جامعة القاهرة / المعهد العالي للهندسة" />
                      {errors.universityName && <p className="text-xs mt-1" style={{ color: 'var(--md-sys-color-error)' }}>{errors.universityName}</p>}
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--md-sys-color-on-surface)' }}>الكود الجامعي</label>
                      <input type="text" value={universityCode} onChange={e => { setUniversityCode(e.target.value); setErrors(prev => { const n = { ...prev }; delete n.universityCode; return n; }); }}
                        className={inputClass('universityCode')}
                        style={{ backgroundColor: 'var(--md-sys-color-surface-container-highest)', color: 'var(--md-sys-color-on-surface)', direction: 'ltr' }}
                        placeholder="xxxxxx" />
                      {errors.universityCode && <p className="text-xs mt-1" style={{ color: 'var(--md-sys-color-error)' }}>{errors.universityCode}</p>}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Step 3: Password */}
            {step === 3 && (
              <div className="space-y-5 animate-fade-left">
                <div className="text-center mb-4">
                  <div className="w-16 h-16 mx-auto mb-3 rounded-md3-sm flex items-center justify-center" style={{ backgroundColor: 'var(--md-sys-color-primary-container)' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: '32px', color: 'var(--md-sys-color-on-primary-container)' }}>lock</span>
                  </div>
                  <h2 className="text-xl font-bold" style={{ color: 'var(--md-sys-color-on-surface)' }}>كلمة المرور</h2>
                  <p className="text-sm mt-1" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>اختر كلمة مرور قوية لحماية حسابك</p>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--md-sys-color-on-surface)' }}>كلمة المرور</label>
                  <div className="relative">
                    <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2" style={{ fontSize: '18px', color: 'var(--md-sys-color-on-surface-variant)' }}>lock</span>
                    <input type="password" value={password} onChange={e => { setPassword(e.target.value); setErrors(prev => { const n = { ...prev }; delete n.password; return n; }); }}
                      className={inputClass('password')}
                      style={{ backgroundColor: 'var(--md-sys-color-surface-container-highest)', color: 'var(--md-sys-color-on-surface)' }}
                      placeholder="••••••••" required />
                  </div>
                  <PasswordStrength password={password} />
                  {errors.password && <p className="text-xs mt-1" style={{ color: 'var(--md-sys-color-error)' }}>{errors.password}</p>}
                </div>

                <div className="rounded-md3-sm p-4" style={{ backgroundColor: 'var(--md-sys-color-secondary-container)' }}>
                  <p className="text-xs leading-relaxed" style={{ color: 'var(--md-sys-color-on-secondary-container)' }}>
                    بتسجيلك أنت توافق على{' '}
                    <span className="font-medium" style={{ color: 'var(--md-sys-color-primary)' }}>الشروط والأحكام</span>
                    {' '}وتقر بأن جميع البيانات التي أدخلتها صحيحة.
                  </p>
                </div>
              </div>
            )}

            {/* Navigation Buttons */}
            <div className="flex items-center justify-between mt-8 gap-3">
              {step > 0 ? (
                <button type="button" onClick={prevStep}
                  className="px-6 py-3 rounded-full border text-sm font-medium transition-all flex items-center gap-2"
                  style={{ borderColor: 'var(--md-sys-color-outline)', color: 'var(--md-sys-color-primary)', backgroundColor: 'transparent' }}>
                  <span className="material-symbols-outlined rotate-180" style={{ fontSize: '18px' }}>arrow_back</span>
                  رجوع
                </button>
              ) : <div />}

              <button type="submit" disabled={loading}
                className="px-8 py-3 rounded-full text-sm font-bold transition-all duration-300 disabled:opacity-60 flex items-center gap-2"
                style={{ backgroundColor: 'var(--md-sys-color-primary)', color: 'var(--md-sys-color-on-primary)' }}>
                {loading ? (
                  <span className="material-symbols-outlined animate-spin" style={{ fontSize: '20px' }}>progress_activity</span>
                ) : step < 3 ? (
                  <>
                    التالي
                    <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>arrow_forward</span>
                  </>
                ) : (
                    <>
                    أنشئ حسابي
                    <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>person_add</span>
                  </>
                )}
              </button>
            </div>
          </form>

          <p className="text-center mt-6 text-sm" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>
            لديك حساب بالفعل؟{' '}
            <Link href="/login" className="font-bold transition-all hover:opacity-80" style={{ color: 'var(--md-sys-color-primary)' }}>
              تسجيل دخول
              <span className="material-symbols-outlined align-middle" style={{ fontSize: '16px' }}>arrow_forward</span>
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
