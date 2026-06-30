'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '../../lib/api';
import { compressAndEncode } from '../../lib/imageUtils';
import { useAuth } from '../../lib/auth';
import { useToast } from '../../components/Toast';
import { useBranding } from '../../components/BrandingProvider';
import { useDarkMode } from '../../components/DarkModeProvider';
import { Skeleton } from '../../components/Skeleton';
import PasswordInput from '../../components/PasswordInput';

export default function AccountPage() {
  const { user, loading: authLoading } = useAuth();
  const { show } = useToast();
  const { primaryColor } = useBranding();
  const { dark, toggle: toggleDark } = useDarkMode();
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  const [tab, setTab] = useState<'profile' | 'password' | 'certificates'>('profile');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [avatar, setAvatar] = useState('');
  const [saving, setSaving] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [pwSaving, setPwSaving] = useState(false);

  const [certificates, setCertificates] = useState<any[]>([]);
  const [certsLoading, setCertsLoading] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) router.push('/login');
    if (user) {
      setName(user.name || '');
      setPhone((user as any).phone || '');
      setAvatar((user as any).avatar || '');
    }
  }, [user, authLoading, router]);

  const loadCertificates = async () => {
    setCertsLoading(true);
    try {
      const data = await api('/api/certificates/my');
      setCertificates(data);
    } catch { show('فشل تحميل الشهادات', 'error'); }
    setCertsLoading(false);
  };

  useEffect(() => { if (tab === 'certificates') loadCertificates(); }, [tab]);

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await compressAndEncode(file);
      setAvatar(dataUrl);
      await api('/api/auth/profile', { method: 'PUT', body: JSON.stringify({ avatar: dataUrl }) });
      show('تم تحديث الصورة');
    } catch { show('فشل رفع الصورة', 'error'); }
  };

  const saveProfile = async () => {
    setSaving(true);
    try {
      await api('/api/auth/profile', { method: 'PUT', body: JSON.stringify({ name, phone, avatar }) });
      show('تم حفظ الملف الشخصي');
    } catch { show('فشل الحفظ', 'error'); }
    setSaving(false);
  };

  const changePassword = async () => {
    if (newPassword.length < 6) { show('كلمة المرور الجديدة أقل من 6 أحرف', 'error'); return; }
    setPwSaving(true);
    try {
      await api('/api/auth/change-password', {
        method: 'PUT', body: JSON.stringify({ currentPassword, newPassword }),
      });
      show('تم تغيير كلمة المرور');
      setCurrentPassword('');
      setNewPassword('');
    } catch (err: any) {
      show(err.message || 'فشل تغيير كلمة المرور', 'error');
    }
    setPwSaving(false);
  };

  if (authLoading) return <div className="p-4 space-y-4"><Skeleton className="h-8 w-1/2" /><Skeleton className="h-64 w-full rounded-2xl" /></div>;

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--bg)' }}>
      <header className="sticky top-0 z-40 border-b" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}>
        <div className="px-4 py-3 flex items-center justify-between">
          <Link href="/dashboard" className="text-sm" style={{ color: primaryColor }}>← الرجوع</Link>
          <h1 className="font-bold" style={{ color: 'var(--text)' }}>حسابي</h1>
          <button onClick={toggleDark} className="p-2 rounded-xl border text-sm" style={{ borderColor: 'var(--border)', color: 'var(--text)' }}>
            {dark ? '☀️' : '🌙'}
          </button>
        </div>
      </header>

      <main className="px-4 py-6 max-w-lg mx-auto space-y-6 animate-fade-in">
        <div className="flex items-center gap-4 animate-slide-up">
          <div className="relative">
            <div className="w-20 h-20 rounded-full overflow-hidden border-2" style={{ borderColor: primaryColor }}>
              {avatar ? <img src={avatar} className="w-full h-full object-cover" alt="" />
                : <div className="w-full h-full flex items-center justify-center text-2xl font-bold" style={{ backgroundColor: primaryColor + '20', color: primaryColor }}>{name.charAt(0)}</div>}
            </div>
            <button onClick={() => fileRef.current?.click()} className="absolute -bottom-1 -left-1 w-7 h-7 rounded-full bg-white dark:bg-gray-700 shadow flex items-center justify-center text-xs border" style={{ borderColor: 'var(--border)' }}>
              📷
            </button>
            <input ref={fileRef} type="file" accept="image/*" onChange={handleAvatarChange} className="hidden" />
          </div>
          <div>
            <h2 className="font-bold text-lg" style={{ color: 'var(--text)' }}>{user?.name}</h2>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{user?.email}</p>
          </div>
        </div>

        <div className="flex gap-2 overflow-x-auto">
          {([{ k: 'profile', l: 'الملف الشخصي' }, { k: 'password', l: 'كلمة المرور' }, { k: 'certificates', l: 'الشهادات' }] as const).map(t => (
            <button key={t.k} onClick={() => setTab(t.k)}
              className={`px-4 py-2 rounded-xl text-sm whitespace-nowrap transition-all ${tab === t.k ? 'text-white font-medium shadow-lg' : 'border'}`}
              style={tab === t.k ? { backgroundColor: primaryColor } : { borderColor: 'var(--border)', color: 'var(--text)' }}>
              {t.l}
            </button>
          ))}
        </div>

        {tab === 'profile' && (
          <div className="space-y-4 animate-fade-in">
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text)' }}>الاسم</label>
              <input value={name} onChange={e => setName(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2"
                style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)', color: 'var(--text)' }} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text)' }}>رقم الهاتف</label>
              <input value={phone} onChange={e => setPhone(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2"
                style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)', color: 'var(--text)' }} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text)' }}>البريد الإلكتروني</label>
              <input value={user?.email || ''} disabled
                className="w-full px-4 py-3 rounded-xl border opacity-60"
                style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)', color: 'var(--text)' }} />
            </div>
            <button onClick={saveProfile} disabled={saving}
              className="w-full py-3 rounded-xl text-white font-bold disabled:opacity-50 transition-transform active:scale-[0.98]"
              style={{ backgroundColor: primaryColor }}>
              {saving ? 'جاري الحفظ...' : 'حفظ التغييرات'}
            </button>
          </div>
        )}

        {tab === 'password' && (
          <div className="space-y-4 animate-fade-in">
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text)' }}>كلمة المرور الحالية</label>
              <PasswordInput value={currentPassword} onChange={setCurrentPassword} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text)' }}>كلمة المرور الجديدة</label>
              <PasswordInput value={newPassword} onChange={setNewPassword} />
            </div>
            <button onClick={changePassword} disabled={pwSaving || !currentPassword || !newPassword}
              className="w-full py-3 rounded-xl text-white font-bold disabled:opacity-50 transition-transform active:scale-[0.98]"
              style={{ backgroundColor: primaryColor }}>
              {pwSaving ? 'جاري...' : 'تغيير كلمة المرور'}
            </button>
          </div>
        )}

        {tab === 'certificates' && (
          <div className="space-y-3 animate-fade-in">
            {certsLoading ? (
              <div className="space-y-3"><Skeleton className="h-24 w-full rounded-2xl" /><Skeleton className="h-24 w-full rounded-2xl" /></div>
            ) : certificates.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-lg mb-2" style={{ color: 'var(--text-muted)' }}>📜</p>
                <p style={{ color: 'var(--text-muted)' }}>لا توجد شهادات حتى الآن</p>
                <Link href="/courses" className="inline-block mt-4 px-6 py-2 rounded-xl text-white text-sm font-medium" style={{ backgroundColor: primaryColor }}>
                  تصفح الكورسات
                </Link>
              </div>
            ) : certificates.map((cert: any) => (
              <div key={cert.id} className="rounded-2xl p-4 border animate-slide-up" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}>
                <h3 className="font-bold mb-1" style={{ color: 'var(--text)' }}>{cert.title_ar}</h3>
                <p className="text-xs mb-2" style={{ color: 'var(--text-muted)' }}>رقم الشهادة: {cert.serial_id}</p>
                <div className="flex items-center justify-between">
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{new Date(cert.issued_at).toLocaleDateString('ar-EG')}</span>
                  <Link href={`/verify?serial=${cert.serial_id}`} className="text-xs font-medium" style={{ color: primaryColor }}>
                    عرض الشهادة
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
