'use client';

import { useState, useRef, useEffect } from 'react';
import { api } from '../../lib/api';
import { useAdminAuth } from '../../lib/auth';
import { compressAndEncode } from '../../lib/imageUtils';

export default function AdminAccountPage() {
  const { user } = useAdminAuth();
  const fileRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [avatar, setAvatar] = useState('');
  const [saving, setSaving] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [pwSaving, setPwSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [msgType, setMsgType] = useState<'success' | 'error'>('success');

  useEffect(() => {
    if (user) {
      setName(user.name || '');
      setPhone((user as any).phone || '');
      setAvatar((user as any).avatar || '');
    }
  }, [user]);

  const notify = (text: string, type: 'success' | 'error' = 'success') => {
    setMsg(text);
    setMsgType(type);
    setTimeout(() => setMsg(''), 3000);
  };

  const handleAvatar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await compressAndEncode(file);
      setAvatar(dataUrl);
      await api('/api/auth/profile', { method: 'PUT', body: JSON.stringify({ avatar: dataUrl }) });
      notify('تم تحديث الصورة');
    } catch (err: any) {
      notify(err?.message || 'فشل رفع الصورة', 'error');
    }
  };

  const saveProfile = async () => {
    setSaving(true);
    try {
      await api('/api/auth/profile', { method: 'PUT', body: JSON.stringify({ name, phone, avatar }) });
      notify('تم حفظ الملف الشخصي');
    } catch (err: any) {
      notify(err?.message || 'فشل الحفظ', 'error');
    }
    setSaving(false);
  };

  const changePassword = async () => {
    if (newPassword.length < 6) { notify('كلمة المرور الجديدة أقل من 6 أحرف', 'error'); return; }
    setPwSaving(true);
    try {
      await api('/api/auth/change-password', {
        method: 'PUT', body: JSON.stringify({ currentPassword, newPassword }),
      });
      notify('تم تغيير كلمة المرور');
      setCurrentPassword('');
      setNewPassword('');
    } catch (err: any) { notify(err.message || 'فشل تغيير كلمة المرور', 'error'); }
    setPwSaving(false);
  };

  const fieldLabel = (text: string, htmlFor?: string) => (
    <label htmlFor={htmlFor} className="block text-sm font-medium mb-1.5" style={{ color: 'var(--md-sys-color-on-surface)' }}>
      {text}
    </label>
  );

  return (
    <div className="space-y-6 animate-fade-in max-w-3xl">
      <h1 className="text-2xl font-bold" style={{ color: 'var(--md-sys-color-on-surface)' }}>حسابي</h1>

      {msg && (
        <div
          role="status"
          className="px-4 py-3 rounded-[var(--md-sys-shape-corner-small)] text-sm flex items-center gap-2 animate-slide-up"
          style={
            msgType === 'success'
              ? { backgroundColor: 'var(--md-sys-color-success-container)', color: 'var(--md-sys-color-on-success-container)' }
              : { backgroundColor: 'var(--md-sys-color-error-container)', color: 'var(--md-sys-color-on-error-container)' }
          }
        >
          <span className="material-symbols-outlined text-[18px]" aria-hidden>
            {msgType === 'success' ? 'check_circle' : 'error'}
          </span>
          {msg}
        </div>
      )}

      <section
        className="p-5 sm:p-6"
        style={{
          backgroundColor: 'var(--md-sys-color-surface-container-low)',
          borderRadius: 'var(--md-sys-shape-corner-large)',
        }}
      >
        <div className="flex items-center gap-4 mb-6">
          <div className="relative shrink-0">
            <div
              className="w-20 h-20 rounded-full overflow-hidden border-2"
              style={{ borderColor: 'var(--md-sys-color-primary)' }}
            >
              {avatar ? (
                <img src={avatar} className="w-full h-full object-cover" alt="" />
              ) : (
                <div
                  className="w-full h-full flex items-center justify-center text-2xl font-bold"
                  style={{ backgroundColor: 'var(--md-sys-color-primary-container)', color: 'var(--md-sys-color-on-primary-container)' }}
                >
                  {name.charAt(0)}
                </div>
              )}
            </div>
            <button
              onClick={() => fileRef.current?.click()}
              aria-label="تغيير الصورة الشخصية"
              className="absolute -bottom-1 -left-1 w-8 h-8 rounded-full md3-elevation-1 flex items-center justify-center"
              style={{
                backgroundColor: 'var(--md-sys-color-primary)',
                color: 'var(--md-sys-color-on-primary)',
              }}
            >
              <span className="material-symbols-outlined text-[16px]" aria-hidden>photo_camera</span>
            </button>
            <input ref={fileRef} type="file" accept="image/*" onChange={handleAvatar} className="hidden" />
          </div>
          <div className="min-w-0">
            <h2 className="font-bold truncate" style={{ color: 'var(--md-sys-color-on-surface)' }}>{user?.name}</h2>
            <p className="text-sm truncate" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>
              {user?.email} · {user?.role === 'admin' ? 'مدير النظام' : user?.role === 'employee' ? 'موظف' : user?.role}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            {fieldLabel('الاسم', 'account-name')}
            <input id="account-name" value={name} onChange={e => setName(e.target.value)} className="md3-field" />
          </div>
          <div>
            {fieldLabel('رقم الهاتف', 'account-phone')}
            <input id="account-phone" value={phone} onChange={e => setPhone(e.target.value)} className="md3-field" inputMode="tel" />
          </div>
        </div>
        <button onClick={saveProfile} disabled={saving} className="md3-btn md3-btn--filled">
          {saving ? 'جاري الحفظ...' : 'حفظ التغييرات'}
        </button>
      </section>

      <section
        className="p-5 sm:p-6"
        style={{
          backgroundColor: 'var(--md-sys-color-surface-container-low)',
          borderRadius: 'var(--md-sys-shape-corner-large)',
        }}
      >
        <h2 className="font-bold mb-4" style={{ color: 'var(--md-sys-color-on-surface)' }}>تغيير كلمة المرور</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            {fieldLabel('كلمة المرور الحالية', 'account-current-pw')}
            <input
              id="account-current-pw"
              type="password"
              value={currentPassword}
              onChange={e => setCurrentPassword(e.target.value)}
              className="md3-field"
              autoComplete="current-password"
            />
          </div>
          <div>
            {fieldLabel('كلمة المرور الجديدة', 'account-new-pw')}
            <input
              id="account-new-pw"
              type="password"
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              className="md3-field"
              autoComplete="new-password"
              aria-describedby="account-pw-hint"
            />
            <p id="account-pw-hint" className="text-xs mt-1" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>
              6 أحرف على الأقل
            </p>
          </div>
        </div>
        <button onClick={changePassword} disabled={pwSaving || !currentPassword || !newPassword} className="md3-btn md3-btn--filled">
          {pwSaving ? 'جاري...' : 'تغيير كلمة المرور'}
        </button>
      </section>
    </div>
  );
}