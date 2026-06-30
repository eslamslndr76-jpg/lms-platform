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

  useEffect(() => {
    if (user) {
      setName(user.name || '');
      setPhone((user as any).phone || '');
      setAvatar((user as any).avatar || '');
    }
  }, [user]);

  const handleAvatar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await compressAndEncode(file);
      setAvatar(dataUrl);
      await api('/api/auth/profile', { method: 'PUT', body: JSON.stringify({ avatar: dataUrl }) });
      setMsg('تم تحديث الصورة');
    } catch { setMsg('فشل رفع الصورة'); }
  };

  const saveProfile = async () => {
    setSaving(true);
    try {
      await api('/api/auth/profile', { method: 'PUT', body: JSON.stringify({ name, phone, avatar }) });
      setMsg('تم حفظ الملف الشخصي');
    } catch { setMsg('فشل الحفظ'); }
    setSaving(false);
    setTimeout(() => setMsg(''), 3000);
  };

  const changePassword = async () => {
    if (newPassword.length < 6) { setMsg('كلمة المرور الجديدة أقل من 6 أحرف'); return; }
    setPwSaving(true);
    try {
      await api('/api/auth/change-password', {
        method: 'PUT', body: JSON.stringify({ currentPassword, newPassword }),
      });
      setMsg('تم تغيير كلمة المرور');
      setCurrentPassword('');
      setNewPassword('');
    } catch (err: any) { setMsg(err.message || 'فشل تغيير كلمة المرور'); }
    setPwSaving(false);
    setTimeout(() => setMsg(''), 3000);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <h1 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>حسابي</h1>

      {msg && <div className="px-4 py-3 rounded-xl text-sm animate-slide-up bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400">{msg}</div>}

      <div className="rounded-2xl p-6 border" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}>
        <div className="flex items-center gap-4 mb-6">
          <div className="relative">
            <div className="w-16 h-16 rounded-full overflow-hidden border-2" style={{ borderColor: 'var(--primary)' }}>
              {avatar ? <img src={avatar} className="w-full h-full object-cover" alt="" />
                : <div className="w-full h-full flex items-center justify-center text-xl font-bold" style={{ backgroundColor: 'var(--primary)' + '20', color: 'var(--primary)' }}>{name.charAt(0)}</div>}
            </div>
            <button onClick={() => fileRef.current?.click()} className="absolute -bottom-1 -left-1 w-6 h-6 rounded-full bg-white dark:bg-gray-700 shadow flex items-center justify-center text-xs border" style={{ borderColor: 'var(--border)' }}>
              📷
            </button>
            <input ref={fileRef} type="file" accept="image/*" onChange={handleAvatar} className="hidden" />
          </div>
          <div>
            <h2 className="font-bold" style={{ color: 'var(--text)' }}>{user?.name}</h2>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{user?.email} · {user?.role}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm mb-1" style={{ color: 'var(--text-muted)' }}>الاسم</label>
            <input value={name} onChange={e => setName(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border text-sm" style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }} />
          </div>
          <div>
            <label className="block text-sm mb-1" style={{ color: 'var(--text-muted)' }}>رقم الهاتف</label>
            <input value={phone} onChange={e => setPhone(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border text-sm" style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }} />
          </div>
        </div>
        <button onClick={saveProfile} disabled={saving}
          className="px-6 py-2.5 rounded-xl text-white text-sm font-medium disabled:opacity-50"
          style={{ backgroundColor: 'var(--primary)' }}>
          {saving ? 'جاري الحفظ...' : 'حفظ التغييرات'}
        </button>
      </div>

      <div className="rounded-2xl p-6 border" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}>
        <h2 className="font-bold mb-4" style={{ color: 'var(--text)' }}>تغيير كلمة المرور</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm mb-1" style={{ color: 'var(--text-muted)' }}>كلمة المرور الحالية</label>
            <input type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border text-sm" style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }} />
          </div>
          <div>
            <label className="block text-sm mb-1" style={{ color: 'var(--text-muted)' }}>كلمة المرور الجديدة</label>
            <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border text-sm" style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }} />
          </div>
        </div>
        <button onClick={changePassword} disabled={pwSaving || !currentPassword || !newPassword}
          className="px-6 py-2.5 rounded-xl text-white text-sm font-medium disabled:opacity-50"
          style={{ backgroundColor: 'var(--primary)' }}>
          {pwSaving ? 'جاري...' : 'تغيير كلمة المرور'}
        </button>
      </div>
    </div>
  );
}
