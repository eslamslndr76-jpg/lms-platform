'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '../../../lib/api';
import { compressAndEncode } from '../../../lib/imageUtils';
import { useAuth } from '../../../lib/auth';
import { useToast } from '../../../components/Toast';
import { useBranding } from '../../../components/BrandingProvider';
import { Skeleton } from '../../../components/Skeleton';
import PasswordInput from '../../../components/PasswordInput';
import { downloadCertPdf } from '../../../lib/certPdfUtils';

const GENDER_OPTIONS = [
  { value: '', label: 'غير محدد' },
  { value: 'male', label: 'ذكر' },
  { value: 'female', label: 'أنثى' },
];

const GOVERNORATES = [
  'القاهرة', 'الجيزة', 'الإسكندرية', 'البحيرة', 'كفر الشيخ', 'الدقهلية',
  'دمياط', 'الغربية', 'المنوفية', 'قليوبية', 'الشرقية', 'بورسعيد',
  'الإسماعيلية', 'السويس', 'شمال سيناء', 'جنوب سيناء', 'الفيوم',
  'بني سويف', 'المنيا', 'أسيوط', 'سوهاج', 'قنا', 'الأقصر',
  'أسوان', 'البحر الأحمر', 'الوادي الجديد', 'مطروح',
];

export default function AccountPage() {
  const { user, loading: authLoading, refreshUser } = useAuth();
  const { show } = useToast();
  const { primaryColor } = useBranding();
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  const [tab, setTab] = useState<'profile' | 'password' | 'certificates' | 'notifications'>('profile');
  const [editing, setEditing] = useState(false);

  /* ── profile form state ── */
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [avatar, setAvatar] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [gender, setGender] = useState('');
  const [governorate, setGovernorate] = useState('');
  const [universityName, setUniversityName] = useState('');
  const [universityCode, setUniversityCode] = useState('');
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  /* ── password state ── */
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [pwSaving, setPwSaving] = useState(false);

  /* ── certificates state ── */
  const [certificates, setCertificates] = useState<any[]>([]);
  const [certsLoading, setCertsLoading] = useState(false);
  const [downloadingCertId, setDownloadingCertId] = useState<number | null>(null);

  /* ── notification state ── */
  const [notifStatus, setNotifStatus] = useState<any>(null);
  const [notifLoading, setNotifLoading] = useState(false);
  const [tgLink, setTgLink] = useState('');
  const [unlinking, setUnlinking] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) router.push('/login');
    if (user) syncFormFromUser(user);
  }, [user, authLoading, router]);

  const syncFormFromUser = (u: any) => {
    setName(u.name || '');
    setPhone(u.phone || '');
    setAvatar(u.avatar || '');
    setBirthDate(u.birthDate || '');
    setGender(u.gender || '');
    setGovernorate(u.governorate || '');
    setUniversityName(u.universityName || '');
    setUniversityCode(u.universityCode || '');
  };

  /* ── certificates ── */
  const loadCertificates = async () => {
    setCertsLoading(true);
    try {
      const data = await api('/api/certificates/my');
      setCertificates(data);
    } catch { show('فشل تحميل الشهادات', 'error'); }
    setCertsLoading(false);
  };

  const handleDownloadCert = async (certId: number, serialId: string) => {
    setDownloadingCertId(certId);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const token = localStorage.getItem('token');
      const res = await fetch(`${apiUrl}/api/certificates/${certId}/html`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('فشل تحميل الشهادة');
      const html = await res.text();
      await downloadCertPdf(html, `certificate-${serialId}.pdf`);
    } catch (err) {
      show('حدث خطأ أثناء تحميل الشهادة', 'error');
    }
    setDownloadingCertId(null);
  };

  useEffect(() => { if (tab === 'certificates') loadCertificates(); }, [tab]);

  /* ── notifications ── */
  const loadNotificationStatus = async () => {
    setNotifLoading(true);
    try {
      const data = await api('/api/notifications/status');
      setNotifStatus(data);
      if (!data?.telegram?.connected) {
        try {
          const linkData = await api('/api/notifications/telegram/link');
          setTgLink(linkData?.link || '');
        } catch { /* ignore */ }
      }
    } catch { /* ignore */ }
    setNotifLoading(false);
  };

  const handleUnlinkTelegram = async () => {
    setUnlinking(true);
    try {
      await api('/api/notifications/telegram/unlink', { method: 'POST' });
      show('تم إلغاء ربط تيليجرام');
      loadNotificationStatus();
    } catch { show('فشل إلغاء الربط', 'error'); }
    setUnlinking(false);
  };

  useEffect(() => { if (tab === 'notifications') loadNotificationStatus(); }, [tab]);

  /* ── avatar ── */
  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await compressAndEncode(file);
      setAvatar(dataUrl);
      await api('/api/auth/profile', { method: 'PUT', body: JSON.stringify({ avatar: dataUrl }) });
      await refreshUser();
      show('تم تحديث الصورة');
    } catch { show('فشل رفع الصورة', 'error'); }
  };

  /* ── validation ── */
  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (!name.trim() || name.trim().length < 2) e.name = 'الاسم يجب أن يكون حرفين على الأقل';
    if (phone && !/^01[0-9]{8,9}$/.test(phone.replace(/\s/g, ''))) e.phone = 'رقم الهاتف غير صحيح';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  /* ── save profile ── */
  const saveProfile = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      await api('/api/auth/profile', {
        method: 'PUT',
        body: JSON.stringify({
          name: name.trim(),
          phone: phone || null,
          birthDate: birthDate || null,
          gender: gender || null,
          governorate: governorate || null,
          universityName: universityName || null,
          universityCode: universityCode || null,
        }),
      });
      await refreshUser();
      setEditing(false);
      show('تم حفظ الملف الشخصي');
    } catch { show('فشل الحفظ', 'error'); }
    setSaving(false);
  };

  const cancelEdit = () => {
    if (user) syncFormFromUser(user);
    setErrors({});
    setEditing(false);
  };

  /* ── change password ── */
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

  if (authLoading) return (
    <div className="p-4 space-y-4">
      <Skeleton className="h-8 w-1/2" />
      <Skeleton className="h-64 w-full rounded-md3-md" />
    </div>
  );

  const tabs = [
    { k: 'profile' as const, l: 'الملف الشخصي', icon: 'person' },
    { k: 'password' as const, l: 'كلمة المرور', icon: 'lock' },
    { k: 'notifications' as const, l: 'الإشعارات', icon: 'notifications' },
    { k: 'certificates' as const, l: 'الشهادات', icon: 'school' },
  ];

  /* ── shared input styles ── */
  const inputStyle = (hasError = false): React.CSSProperties => ({
    backgroundColor: 'var(--md-sys-color-surface-container-highest)',
    borderColor: hasError ? 'var(--md-sys-color-error)' : editing ? 'var(--md-sys-color-outline)' : 'var(--md-sys-color-outline-variant)',
    color: 'var(--md-sys-color-on-surface)',
  });

  const inputCls = 'w-full px-4 py-3 rounded-md3-md border text-sm transition-all duration-200 focus:outline-none';

  /* ── field row in view mode ── */
  const ViewField = ({ icon, label, value }: { icon: string; label: string; value?: string }) => (
    <div className="flex items-center gap-3 py-3">
      <div
        className="w-10 h-10 rounded-md3-md flex items-center justify-center shrink-0"
        style={{ backgroundColor: 'var(--md-sys-color-surface-container-high)' }}
      >
        <span className="material-symbols-outlined text-[20px]" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>{icon}</span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>{label}</p>
        <p className="text-sm font-medium truncate" style={{ color: value ? 'var(--md-sys-color-on-surface)' : 'var(--md-sys-color-outline)' }}>
          {value || '—'}
        </p>
      </div>
    </div>
  );

  /* ── editable field wrapper ── */
  const EditField = ({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) => (
    <div>
      <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>{label}</label>
      {children}
      {error && (
        <p className="text-xs mt-1" style={{ color: 'var(--md-sys-color-error)' }}>{error}</p>
      )}
    </div>
  );

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--md-sys-color-surface)' }}>
      <main className="px-4 py-6 max-w-lg mx-auto space-y-6 animate-fade-in">
        {/* Profile Header */}
        <div className="flex items-center gap-4 animate-slide-up">
          <div className="relative">
            <div
              className="w-20 h-20 rounded-full overflow-hidden border-2"
              style={{ borderColor: primaryColor }}
            >
              {avatar ? (
                <img src={avatar} className="w-full h-full object-cover" alt="" />
              ) : (
                <div
                  className="w-full h-full flex items-center justify-center text-2xl font-bold"
                  style={{
                    backgroundColor: 'var(--md-sys-color-primary-container)',
                    color: 'var(--md-sys-color-on-primary-container)',
                  }}
                >
                  {name.charAt(0)}
                </div>
              )}
            </div>
            <button
              onClick={() => fileRef.current?.click()}
              className="absolute -bottom-1 -left-1 w-7 h-7 rounded-full flex items-center justify-center shadow-md border transition-colors duration-200"
              style={{
                backgroundColor: 'var(--md-sys-color-surface-container-high)',
                borderColor: 'var(--md-sys-color-outline-variant)',
                color: 'var(--md-sys-color-on-surface-variant)',
              }}
            >
              <span className="material-symbols-outlined text-[16px]">camera_alt</span>
            </button>
            <input ref={fileRef} type="file" accept="image/*" onChange={handleAvatarChange} className="hidden" />
          </div>
          <div>
            <h2 className="font-bold text-lg" style={{ color: 'var(--md-sys-color-on-surface)' }}>{user?.name}</h2>
            <p className="text-sm" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>{user?.email}</p>
          </div>
        </div>

        {/* Tab Buttons */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          {tabs.map(t => (
            <button
              key={t.k}
              onClick={() => setTab(t.k)}
              className="px-4 py-2 rounded-full text-sm whitespace-nowrap transition-all duration-200 flex items-center gap-1.5 font-medium"
              style={tab === t.k ? {
                backgroundColor: 'var(--md-sys-color-primary)',
                color: 'var(--md-sys-color-on-primary)',
                boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
              } : {
                backgroundColor: 'var(--md-sys-color-surface-container)',
                color: 'var(--md-sys-color-on-surface)',
              }}
            >
              <span className="material-symbols-outlined text-[18px]">{t.icon}</span>
              {t.l}
            </button>
          ))}
        </div>

        {/* ═══════════════════ Profile Tab ═══════════════════ */}
        {tab === 'profile' && (
          <div className="space-y-4 animate-fade-in">
            {/* Edit / Save / Cancel buttons */}
            {!editing ? (
              <button
                onClick={() => setEditing(true)}
                className="w-full py-3 rounded-full text-sm font-bold transition-all duration-200 active:scale-[0.98] flex items-center justify-center gap-2"
                style={{
                  backgroundColor: 'var(--md-sys-color-primary)',
                  color: 'var(--md-sys-color-on-primary)',
                }}
              >
                <span className="material-symbols-outlined text-[18px]">edit</span>
                تعديل الملف الشخصي
              </button>
            ) : (
              <div className="flex gap-2">
                <button
                  onClick={saveProfile}
                  disabled={saving}
                  className="flex-1 py-3 rounded-full text-sm font-bold disabled:opacity-50 transition-all duration-200 active:scale-[0.98] flex items-center justify-center gap-1"
                  style={{
                    backgroundColor: 'var(--md-sys-color-primary)',
                    color: 'var(--md-sys-color-on-primary)',
                  }}
                >
                  {saving ? 'جاري الحفظ...' : (
                    <>
                      <span className="material-symbols-outlined text-[18px]">check</span>
                      حفظ
                    </>
                  )}
                </button>
                <button
                  onClick={cancelEdit}
                  disabled={saving}
                  className="flex-1 py-3 rounded-full text-sm font-bold border transition-all duration-200 active:scale-[0.98] flex items-center justify-center gap-1"
                  style={{
                    borderColor: 'var(--md-sys-color-outline)',
                    color: 'var(--md-sys-color-on-surface)',
                    backgroundColor: 'transparent',
                  }}
                >
                  <span className="material-symbols-outlined text-[18px]">close</span>
                  إلغاء
                </button>
              </div>
            )}

            {/* Fields card */}
            <div
              className="rounded-md3-lg p-4"
              style={{ backgroundColor: 'var(--md-sys-color-surface-container-low)' }}
            >
              {editing ? (
                /* ═══ EDIT MODE ═══ */
                <div className="space-y-4">
                  <EditField label="الاسم الكامل" error={errors.name}>
                    <input
                      value={name}
                      onChange={e => setName(e.target.value)}
                      className={inputCls}
                      style={inputStyle(!!errors.name)}
                    />
                  </EditField>

                  <EditField label="رقم الهاتف" error={errors.phone}>
                    <input
                      value={phone}
                      onChange={e => setPhone(e.target.value)}
                      placeholder="01xxxxxxxxx"
                      className={inputCls}
                      style={inputStyle(!!errors.phone)}
                    />
                  </EditField>

                  <div>
                    <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>البريد الإلكتروني</label>
                    <input
                      value={user?.email || ''}
                      disabled
                      className={`${inputCls} opacity-60 cursor-not-allowed`}
                      style={inputStyle()}
                    />
                    <p className="text-[11px] mt-1" style={{ color: 'var(--md-sys-color-outline)' }}>لا يمكن تغيير البريد الإلكتروني</p>
                  </div>

                  <EditField label="تاريخ الميلاد">
                    <input
                      type="date"
                      value={birthDate}
                      onChange={e => setBirthDate(e.target.value)}
                      className={inputCls}
                      style={inputStyle()}
                    />
                  </EditField>

                  <EditField label="الجنس">
                    <div className="flex gap-2">
                      {GENDER_OPTIONS.filter(o => o.value).map(opt => (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => setGender(gender === opt.value ? '' : opt.value)}
                          className="flex-1 py-2.5 rounded-md3-md text-sm font-medium border transition-all duration-200"
                          style={{
                            backgroundColor: gender === opt.value ? 'var(--md-sys-color-primary-container)' : 'transparent',
                            borderColor: gender === opt.value ? 'var(--md-sys-color-primary)' : 'var(--md-sys-color-outline)',
                            color: gender === opt.value ? 'var(--md-sys-color-on-primary-container)' : 'var(--md-sys-color-on-surface-variant)',
                          }}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </EditField>

                  <EditField label="المحافظة">
                    <select
                      value={governorate}
                      onChange={e => setGovernorate(e.target.value)}
                      className={inputCls}
                      style={{
                        ...inputStyle(),
                        appearance: 'none',
                        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24'%3E%3Cpath fill='%23666' d='M7 10l5 5 5-5z'/%3E%3C/svg%3E")`,
                        backgroundRepeat: 'no-repeat',
                        backgroundPosition: 'left 12px center',
                      }}
                    >
                      <option value="">غير محدد</option>
                      {GOVERNORATES.map(g => (
                        <option key={g} value={g}>{g}</option>
                      ))}
                    </select>
                  </EditField>

                  <EditField label="اسم الجامعة / المعهد">
                    <input
                      value={universityName}
                      onChange={e => setUniversityName(e.target.value)}
                      className={inputCls}
                      style={inputStyle()}
                    />
                  </EditField>

                  <EditField label="الكود الجامعي">
                    <input
                      value={universityCode}
                      onChange={e => setUniversityCode(e.target.value)}
                      className={inputCls}
                      style={inputStyle()}
                    />
                  </EditField>
                </div>
              ) : (
                /* ═══ VIEW MODE ═══ */
                <div className="divide-y" style={{ borderColor: 'var(--md-sys-color-outline-variant)' }}>
                  <ViewField icon="person" label="الاسم الكامل" value={user?.name} />
                  <ViewField icon="phone" label="رقم الهاتف" value={user?.phone} />
                  <ViewField icon="mail" label="البريد الإلكتروني" value={user?.email} />
                  <ViewField icon="cake" label="تاريخ الميلاد" value={birthDate ? new Date(birthDate).toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' }) : undefined} />
                  <ViewField icon="group" label="الجنس" value={gender === 'male' ? 'ذكر' : gender === 'female' ? 'أنثى' : undefined} />
                  <ViewField icon="location_on" label="المحافظة" value={governorate} />
                  <ViewField icon="school" label="الجامعة / المعهد" value={universityName} />
                  <ViewField icon="badge" label="الكود الجامعي" value={universityCode} />
                </div>
              )}
            </div>
          </div>
        )}

        {/* ═══════════════════ Password Tab ═══════════════════ */}
        {tab === 'password' && (
          <div className="space-y-4 animate-fade-in">
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>كلمة المرور الحالية</label>
              <PasswordInput value={currentPassword} onChange={setCurrentPassword} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>كلمة المرور الجديدة</label>
              <PasswordInput value={newPassword} onChange={setNewPassword} />
            </div>
            <button
              onClick={changePassword}
              disabled={pwSaving || !currentPassword || !newPassword}
              className="w-full py-3 rounded-full text-sm font-bold disabled:opacity-50 transition-all duration-200 active:scale-[0.98]"
              style={{
                backgroundColor: 'var(--md-sys-color-primary)',
                color: 'var(--md-sys-color-on-primary)',
              }}
            >
              {pwSaving ? 'جاري...' : 'تغيير كلمة المرور'}
            </button>
          </div>
        )}

        {/* ═══════════════════ Notifications Tab ═══════════════════ */}
        {tab === 'notifications' && (
          <div className="space-y-4 animate-fade-in">
            {notifLoading ? (
              <div className="space-y-3">
                <div className="text-center py-8" style={{ color: 'var(--md-sys-color-primary)' }}>
                  <div className="w-full h-1 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--md-sys-color-surface-container-high)' }}><div className="h-full rounded-full animate-pulse" style={{ width: '40%', backgroundColor: 'var(--md-sys-color-primary)' }} /></div>
                </div>
              </div>
            ) : (
              <>
                {/* Email Status */}
                <div
                  className="rounded-md3-md p-4"
                  style={{ backgroundColor: 'var(--md-sys-color-surface-container)' }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-10 h-10 rounded-md3-md flex items-center justify-center"
                        style={{ backgroundColor: 'var(--md-sys-color-primary-container)' }}
                      >
                        <span className="material-symbols-outlined text-[20px]" style={{ color: 'var(--md-sys-color-on-primary-container)' }}>mail</span>
                      </div>
                      <div>
                        <p className="font-medium text-sm" style={{ color: 'var(--md-sys-color-on-surface)' }}>البريد الإلكتروني</p>
                        <p className="text-xs" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>
                          {notifStatus?.email?.address || user?.email || 'غير مسجل'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: notifStatus?.email?.enabled ? 'var(--md-sys-color-primary)' : 'var(--md-sys-color-outline)' }}
                      />
                      <span
                        className="text-xs font-medium"
                        style={{ color: notifStatus?.email?.enabled ? 'var(--md-sys-color-primary)' : 'var(--md-sys-color-on-surface-variant)' }}
                      >
                        {notifStatus?.email?.enabled ? 'مفعّل' : 'غير مفعّل'}
                      </span>
                    </div>
                  </div>
                  <p className="text-xs mt-2" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>
                    تتلقى إشعارات عبر البريد الإلكتروني تلقائياً
                  </p>
                </div>

                {/* Telegram Status */}
                <div
                  className="rounded-md3-md p-4"
                  style={{ backgroundColor: 'var(--md-sys-color-surface-container)' }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-10 h-10 rounded-md3-md flex items-center justify-center"
                        style={{
                          backgroundColor: notifStatus?.telegram?.connected
                            ? 'var(--md-sys-color-primary-container)'
                            : 'var(--md-sys-color-surface-container-high)',
                        }}
                      >
                        <span
                          className="material-symbols-outlined text-[20px]"
                          style={{
                            color: notifStatus?.telegram?.connected
                              ? 'var(--md-sys-color-on-primary-container)'
                              : 'var(--md-sys-color-on-surface-variant)',
                          }}
                        >smart_toy</span>
                      </div>
                      <div>
                        <p className="font-medium text-sm" style={{ color: 'var(--md-sys-color-on-surface)' }}>تيليجرام</p>
                        <p className="text-xs" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>
                          {notifStatus?.telegram?.connected ? 'متصل بالبوت' : 'غير متصل'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: notifStatus?.telegram?.connected ? 'var(--md-sys-color-primary)' : 'var(--md-sys-color-outline)' }}
                      />
                      <span
                        className="text-xs font-medium"
                        style={{ color: notifStatus?.telegram?.connected ? 'var(--md-sys-color-primary)' : 'var(--md-sys-color-on-surface-variant)' }}
                      >
                        {notifStatus?.telegram?.connected ? 'متصل' : 'غير متصل'}
                      </span>
                    </div>
                  </div>

                  {!notifStatus?.telegram?.connected ? (
                    <div className="mt-3 space-y-3">
                      <div
                        className="rounded-md3-md p-3"
                        style={{ backgroundColor: 'var(--md-sys-color-surface-container-low)' }}
                      >
                        <p className="text-xs font-medium mb-2" style={{ color: 'var(--md-sys-color-on-surface)' }}>خطوات الربط:</p>
                        <ol className="text-xs space-y-1.5" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>
                          <li className="flex items-start gap-2">
                            <span
                              className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5"
                              style={{ backgroundColor: 'var(--md-sys-color-primary-container)', color: 'var(--md-sys-color-on-primary-container)' }}
                            >1</span>
                            اضغط على زر الربط أدناه
                          </li>
                          <li className="flex items-start gap-2">
                            <span
                              className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5"
                              style={{ backgroundColor: 'var(--md-sys-color-primary-container)', color: 'var(--md-sys-color-on-primary-container)' }}
                            >2</span>
                            سيفتح البوت على تيليجرام
                          </li>
                          <li className="flex items-start gap-2">
                            <span
                              className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5"
                              style={{ backgroundColor: 'var(--md-sys-color-primary-container)', color: 'var(--md-sys-color-on-primary-container)' }}
                            >3</span>
                            اضغط Start في البوت
                          </li>
                          <li className="flex items-start gap-2">
                            <span
                              className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5"
                              style={{ backgroundColor: 'var(--md-sys-color-primary-container)', color: 'var(--md-sys-color-on-primary-container)' }}
                            >4</span>
                            سيتم الربط تلقائياً
                          </li>
                        </ol>
                      </div>
                      {tgLink && (
                        <a
                          href={tgLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block w-full py-3 rounded-full text-sm font-bold text-center transition-all duration-200 active:scale-[0.98]"
                          style={{
                            backgroundColor: 'var(--md-sys-color-primary)',
                            color: 'var(--md-sys-color-on-primary)',
                          }}
                        >
                          ربط حساب تيليجرام
                        </a>
                      )}
                    </div>
                  ) : (
                    <div className="mt-3">
                      <button
                        onClick={handleUnlinkTelegram}
                        disabled={unlinking}
                        className="w-full py-2.5 rounded-full text-sm font-medium border transition-colors duration-200"
                        style={{
                          borderColor: 'var(--md-sys-color-error)',
                          color: 'var(--md-sys-color-error)',
                          backgroundColor: 'transparent',
                        }}
                        onMouseEnter={e => {
                          e.currentTarget.style.backgroundColor = 'var(--md-sys-color-error-container)';
                        }}
                        onMouseLeave={e => {
                          e.currentTarget.style.backgroundColor = 'transparent';
                        }}
                      >
                        {unlinking ? 'جاري...' : 'إلغاء الربط'}
                      </button>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {/* ═══════════════════ Certificates Tab ═══════════════════ */}
        {tab === 'certificates' && (
          <div className="space-y-3 animate-fade-in">
            {certsLoading ? (
              <div className="space-y-3">
                <div className="text-center py-8" style={{ color: 'var(--md-sys-color-primary)' }}>
                  <div className="w-full h-1 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--md-sys-color-surface-container-high)' }}><div className="h-full rounded-full animate-pulse" style={{ width: '40%', backgroundColor: 'var(--md-sys-color-primary)' }} /></div>
                </div>
              </div>
            ) : certificates.length === 0 ? (
              <div className="text-center py-12">
                <span className="material-symbols-outlined text-[48px] block mb-2" style={{ color: 'var(--md-sys-color-outline)' }}>school</span>
                <p className="text-lg mb-2" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>لا توجد شهادات حتى الآن</p>
                <Link
                  href="/courses"
                  className="inline-block mt-4 px-6 py-2 rounded-full text-sm font-medium"
                  style={{ backgroundColor: 'var(--md-sys-color-primary)', color: 'var(--md-sys-color-on-primary)' }}
                >
                  تصفح الكورسات
                </Link>
              </div>
            ) : certificates.map((cert: any) => (
              <div
                key={cert.id}
                className={`rounded-md3-md p-4 animate-slide-up ${cert.status === 'revoked' ? 'opacity-70' : ''}`}
                style={{
                  backgroundColor: 'var(--md-sys-color-surface-container)',
                  borderLeft: cert.status === 'revoked' ? '3px solid var(--md-sys-color-error)' : 'none',
                }}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-bold truncate" style={{ color: 'var(--md-sys-color-on-surface)' }}>{cert.title_ar}</p>
                      {cert.status === 'revoked' && (
                        <span
                          className="text-[10px] px-2 py-0.5 rounded-full font-medium flex items-center gap-1 shrink-0"
                          style={{
                            backgroundColor: 'var(--md-sys-color-error-container)',
                            color: 'var(--md-sys-color-on-error-container)',
                          }}
                        >
                          <span className="material-symbols-outlined text-[12px]">block</span>
                          مسحوبة
                        </span>
                      )}
                    </div>
                    <p className="text-xs font-mono" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>{cert.serial_id}</p>
                  </div>
                  <span className="text-xs shrink-0 mr-2" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>
                    {new Date(cert.issued_at).toLocaleDateString('ar-EG')}
                  </span>
                </div>
                {cert.status === 'revoked' && (
                  <div
                    className="mb-2 px-3 py-2 rounded-md3-md"
                    style={{
                      backgroundColor: 'var(--md-sys-color-error-container)',
                    }}
                  >
                    <p className="text-xs font-medium flex items-center gap-1" style={{ color: 'var(--md-sys-color-on-error-container)' }}>
                      <span className="material-symbols-outlined text-[14px]">block</span>
                      هذه الشهادة مسحوبة من الإدارة ولا تعد صالحة
                    </p>
                    {cert.revoke_reason && (
                      <p className="text-[11px] mt-1 flex items-center gap-1" style={{ color: 'var(--md-sys-color-on-error-container)' }}>
                        <span className="material-symbols-outlined text-[12px]">edit_note</span>
                        السبب: {cert.revoke_reason}
                      </p>
                    )}
                  </div>
                )}
                <div className="flex gap-2">
                  {cert.status !== 'revoked' && (
                    <button
                      onClick={() => handleDownloadCert(cert.id, cert.serial_id)}
                      disabled={downloadingCertId === cert.id}
                      className="flex-1 py-2 text-center rounded-full text-sm font-medium transition-opacity hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-1"
                      style={{
                        backgroundColor: 'var(--md-sys-color-primary)',
                        color: 'var(--md-sys-color-on-primary)',
                      }}
                    >
                      {downloadingCertId === cert.id ? (
                        <>
                          <span className="material-symbols-outlined animate-spin" style={{ fontSize: 16, color: 'var(--md-sys-color-primary)' }}>progress_activity</span>
                          جاري...
                        </>
                      ) : (
                        <>
                          <span className="material-symbols-outlined text-[16px]">download</span>
                          تحميل PDF
                        </>
                      )}
                    </button>
                  )}
                  <Link
                    href={`/verify?serial=${cert.serial_id}`}
                    className={`text-center rounded-full text-sm font-medium border transition-colors hover:opacity-80 px-4 py-2 flex items-center justify-center gap-1 ${cert.status === 'revoked' ? 'flex-1' : ''}`}
                    style={{
                      borderColor: 'var(--md-sys-color-outline)',
                      color: 'var(--md-sys-color-on-surface-variant)',
                    }}
                  >
                    <span className="material-symbols-outlined text-[16px]">search</span>
                    عرض
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
