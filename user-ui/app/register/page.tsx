'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '../../lib/auth';
import { useToast } from '../../components/Toast';
import { useBranding } from '../../components/BrandingProvider';
import PasswordInput from '../../components/PasswordInput';
import { parseNationalId } from '../../lib/nationalId';

export default function RegisterPage() {
  const { register } = useAuth();
  const { show } = useToast();
  const { primaryColor } = useBranding();
  const router = useRouter();

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

  const validate = (): boolean => {
    const errs: Record<string, string> = {};

    const phoneClean = phone.replace(/\s/g, '');
    if (!phoneClean) errs.phone = 'رقم الهاتف مطلوب';
    else if (!/^01[0-9]{9}$/.test(phoneClean)) errs.phone = 'رقم الهاتف يجب أن يكون 11 رقم ويبدأ بـ 01';

    const idClean = nationalId.replace(/\s/g, '');
    if (!idClean) errs.nationalId = 'الرقم القومى مطلوب';
    else if (!/^\d{14}$/.test(idClean)) errs.nationalId = 'الرقم القومى يجب أن يكون 14 رقماً';
    else {
      const info = parseNationalId(idClean);
      if (!info.valid) errs.nationalId = info.error || 'الرقم القومى غير صالح';
    }

    if (isEnrolled) {
      if (!universityName.trim()) errs.universityName = 'اسم المعهد او الجامعه مطلوب';
      if (!universityCode.trim()) errs.universityCode = 'الكود الجامعى مطلوب';
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleNationalIdBlur = () => {
    const cleaned = nationalId.replace(/\s/g, '');
    if (cleaned.length !== 14) {
      setNationalIdInfo('');
      return;
    }
    const info = parseNationalId(cleaned);
    if (info.valid) {
      setNationalIdInfo('valid');
      setErrors(prev => { const n = { ...prev }; delete n.nationalId; return n; });
    } else {
      setNationalIdInfo('');
      setErrors(prev => ({ ...prev, nationalId: info.error || 'الرقم القومى غير صالح' }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
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
      router.push('/dashboard');
    } catch (err: any) {
      show(err.message || 'فشل إنشاء الحساب', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fieldClass = (field: string) =>
    `w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 ${errors[field] ? 'border-red-500' : ''}`;

  return (
    <div className="flex-1 flex flex-col justify-center max-w-sm mx-auto w-full animate-fade-in p-4">
      <h1 className="text-2xl font-bold text-center mb-1" style={{ color: 'var(--text)' }}>إنشاء حساب جديد</h1>
      <p className="text-[var(--text-muted)] text-center mb-8">أدخل بياناتك للتسجيل</p>

      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text)' }}>الاسم الكامل</label>
          <input type="text" value={name} onChange={e => setName(e.target.value)}
            className={fieldClass('name')}
            style={{ backgroundColor: 'var(--card)', borderColor: errors.name ? '#ef4444' : 'var(--border)', color: 'var(--text)' }}
            placeholder="محمد أحمد" required />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text)' }}>البريد الإلكتروني</label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)}
            className={fieldClass('email')}
            style={{ backgroundColor: 'var(--card)', borderColor: errors.email ? '#ef4444' : 'var(--border)', color: 'var(--text)' }}
            placeholder="example@email.com" required />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text)' }}>رقم الهاتف</label>
          <input type="tel" value={phone} onChange={e => { setPhone(e.target.value); setErrors(prev => { const n = { ...prev }; delete n.phone; return n; }); }}
            className={fieldClass('phone')}
            style={{ backgroundColor: 'var(--card)', borderColor: errors.phone ? '#ef4444' : 'var(--border)', color: 'var(--text)' }}
            placeholder="01000000000" maxLength={11} required />
          {errors.phone && <p className="text-xs mt-1 text-red-500">{errors.phone}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text)' }}>الرقم القومى</label>
          <input type="text" value={nationalId} onChange={e => { setNationalId(e.target.value); setErrors(prev => { const n = { ...prev }; delete n.nationalId; return n; }); }}
            onBlur={handleNationalIdBlur}
            maxLength={14}
            className={fieldClass('nationalId')}
            style={{ backgroundColor: 'var(--card)', borderColor: errors.nationalId ? '#ef4444' : 'var(--border)', color: 'var(--text)' }}
            placeholder="أدخل الرقم القومى المكون من 14 رقم" dir="ltr" required />
          {errors.nationalId && <p className="text-xs mt-1 text-red-500">{errors.nationalId}</p>}
          {!errors.nationalId && nationalIdInfo === 'valid' && (
            <p className="text-xs mt-1 text-green-600 flex items-center gap-1">
              <span>✅</span> رقم قومى صحيح
            </p>
          )}
        </div>
        <div>
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" checked={isEnrolled} onChange={e => setIsEnrolled(e.target.checked)}
              className="w-5 h-5 rounded border-gray-300"
              style={{ accentColor: primaryColor }} />
            <span className="text-sm font-medium" style={{ color: 'var(--text)' }}>هل الطالب مقيد بجامعه او معهد</span>
          </label>
        </div>
        {isEnrolled && (
          <div className="space-y-4 animate-fade-in mr-7 pr-3 border-r-2" style={{ borderColor: primaryColor + '40' }}>
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text)' }}>اسم المعهد او الجامعه</label>
              <input type="text" value={universityName} onChange={e => { setUniversityName(e.target.value); setErrors(prev => { const n = { ...prev }; delete n.universityName; return n; }); }}
                className={fieldClass('universityName')}
                style={{ backgroundColor: 'var(--card)', borderColor: errors.universityName ? '#ef4444' : 'var(--border)', color: 'var(--text)' }}
                placeholder="جامعة القاهرة — المعهد العالى للهندسة" />
              {errors.universityName && <p className="text-xs mt-1 text-red-500">{errors.universityName}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text)' }}>الكود الجامعى</label>
              <input type="text" value={universityCode} onChange={e => { setUniversityCode(e.target.value); setErrors(prev => { const n = { ...prev }; delete n.universityCode; return n; }); }}
                className={fieldClass('universityCode')}
                style={{ backgroundColor: 'var(--card)', borderColor: errors.universityCode ? '#ef4444' : 'var(--border)', color: 'var(--text)' }}
                placeholder="xxxxxx" dir="ltr" />
              {errors.universityCode && <p className="text-xs mt-1 text-red-500">{errors.universityCode}</p>}
            </div>
          </div>
        )}
        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text)' }}>كلمة المرور</label>
          <PasswordInput value={password} onChange={setPassword} />
        </div>
        <button type="submit" disabled={loading}
          className="w-full py-3 rounded-xl text-white font-bold text-lg disabled:opacity-50 transition-transform active:scale-[0.98]"
          style={{ backgroundColor: primaryColor }}>
          {loading ? 'جاري التحميل...' : 'إنشاء حساب'}
        </button>
      </form>

      <p className="text-center mt-6 text-sm" style={{ color: 'var(--text-muted)' }}>
        لديك حساب بالفعل؟{' '}
        <Link href="/login" className="font-medium" style={{ color: primaryColor }}>تسجيل دخول</Link>
      </p>
    </div>
  );
}
