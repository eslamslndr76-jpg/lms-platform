'use client';

import { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import Modal from '../../components/Modal';
import DataTable from '../../components/DataTable';

const SECTIONS = [
  { key: 'courses', label: 'الكورسات' },
  { key: 'orders', label: 'الطلبات' },
  { key: 'students', label: 'الطلاب' },
  { key: 'groups', label: 'المجموعات' },
  { key: 'financials', label: 'المالية' },
  { key: 'settings', label: 'الإعدادات' },
  { key: 'receipts', label: 'الإيصالات' },
  { key: 'categories', label: 'التصنيفات' },
];

interface Role {
  id: number;
  name: string;
  permissions: Record<string, string>;
}

export default function EmployeesPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modal, setModal] = useState(false);
  const [permModal, setPermModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [form, setForm] = useState({ name: '', email: '', password: '', phone: '', role_id: '2' });
  const [msg, setMsg] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [u, r] = await Promise.all([
        api('/api/admin/users?role=employee'),
        api('/api/roles'),
      ]);
      setUsers(u.users);
      setRoles(r);
    } catch {
      setError('فشل تحميل البيانات');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const saveUser = async () => {
    try {
      await api('/api/admin/users', {
        method: 'POST',
        body: JSON.stringify({ ...form, role_id: Number(form.role_id) }),
      });
      setModal(false);
      setForm({ name: '', email: '', password: '', phone: '', role_id: '2' });
      setMsg('تم إنشاء المستخدم');
      load();
    } catch { setMsg('فشل إنشاء المستخدم'); }
    setTimeout(() => setMsg(''), 3000);
  };

  const toggleActive = async (user: any) => {
    try {
      if (user.is_active) {
        await api(`/api/admin/users/${user.id}`, { method: 'DELETE' });
      } else {
        await api(`/api/admin/users/${user.id}/reactivate`, { method: 'PUT' });
      }
      setMsg(user.is_active ? 'تم تعطيل المستخدم' : 'تم تفعيل المستخدم');
      load();
    } catch { setMsg('فشل'); }
    setTimeout(() => setMsg(''), 3000);
  };

  const openPermEditor = (user: any) => {
    const role = roles.find(r => r.id === user.role_id);
    if (role) {
      setSelectedUser(user);
      setEditingRole({ ...role, permissions: { ...role.permissions } });
      setPermModal(true);
    }
  };

  const togglePerm = (section: string, action: 'read' | 'write') => {
    if (!editingRole) return;
    const current = (editingRole.permissions[section] || '') as string;
    const parts = current.split(',').filter(Boolean);
    const newPerms = parts.includes(action)
      ? parts.filter(p => p !== action).join(',')
      : [...parts, action].join(',');
    setEditingRole({
      ...editingRole,
      permissions: { ...editingRole.permissions, [section]: newPerms },
    });
  };

  const savePermissions = async () => {
    if (!editingRole) return;
    try {
      await api(`/api/roles/${editingRole.id}`, {
        method: 'PUT',
        body: JSON.stringify({ permissions: editingRole.permissions }),
      });
      setMsg('تم حفظ الصلاحيات');
      setPermModal(false);
      load();
    } catch { setMsg('فشل حفظ الصلاحيات'); }
    setTimeout(() => setMsg(''), 3000);
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin h-8 w-8 border-4 rounded-full" style={{ borderColor: 'var(--primary)', borderTopColor: 'transparent' }} /></div>;
  if (error) return <div className="flex flex-col items-center justify-center h-64 gap-4"><p style={{ color: '#dc2626' }}>{error}</p><button onClick={load} className="px-4 py-2 bg-blue-600 text-white rounded-xl text-sm">إعادة المحاولة</button></div>;

  const employeeRole = roles.find(r => r.id === 2);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>الموظفين</h1>
        <button onClick={() => setModal(true)} className="px-4 py-2 rounded-xl text-white text-sm font-medium" style={{ backgroundColor: 'var(--primary)' }}>
          + إضافة موظف
        </button>
      </div>

      {msg && <div className="px-4 py-3 rounded-xl text-sm animate-slide-up bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400">{msg}</div>}

      {employeeRole && (
        <div className="rounded-2xl p-4 border animate-fade-in" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}>
          <h2 className="font-bold mb-2" style={{ color: 'var(--text)' }}>صلاحيات دور "{employeeRole.name}"</h2>
          <p className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>صلاحيات افتراضية لكل موظف. يمكن تخصيصها لكل موظف على حدة.</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {SECTIONS.map(s => {
              const perms = (employeeRole.permissions[s.key] || '') as string;
              return (
                <div key={s.key} className="text-xs px-3 py-2 rounded-lg" style={{ backgroundColor: 'var(--bg)' }}>
                  <span className="font-medium block mb-1" style={{ color: 'var(--text)' }}>{s.label}</span>
                  <span style={{ color: perms.includes('write') ? 'var(--primary)' : perms.includes('read') ? 'var(--secondary)' : 'var(--text-muted)' }}>
                    {perms.includes('write') ? 'عرض + تعديل' : perms.includes('read') ? 'عرض فقط' : '—'}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="rounded-2xl p-4 border" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}>
        <DataTable
          columns={[
            { key: 'name', label: 'الاسم' },
            { key: 'email', label: 'البريد' },
            { key: 'phone', label: 'الهاتف', render: (v: string) => v || '-' },
            { key: 'role_name', label: 'الدور' },
            { key: 'is_active', label: 'الحالة', render: (v: number) => v ? '🟢 نشط' : '🔴 غير نشط' },
            { key: 'actions', label: 'الصلاحيات', render: (_: any, row: any) => (
              <button onClick={(e) => { e?.stopPropagation?.(); openPermEditor(row); }}
                className="px-3 py-1 rounded-lg text-xs" style={{ backgroundColor: 'var(--primary)', color: '#fff' }}>
                صلاحيات
              </button>
            ) },
            { key: 'toggle', label: 'تحكم', render: (_: any, row: any) => (
              <button onClick={(e) => { e?.stopPropagation?.(); toggleActive(row); }}
                className={`px-3 py-1 rounded-lg text-xs ${row.is_active ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400' : 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400'}`}>
                {row.is_active ? 'تعطيل' : 'تفعيل'}
              </button>
            ) },
          ]}
          data={users}
        />
      </div>

      <Modal open={modal} onClose={() => setModal(false)} title="إضافة موظف جديد">
        <div className="space-y-3">
          <input placeholder="الاسم" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
            className="w-full px-4 py-2.5 rounded-xl border text-sm" style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }} />
          <input placeholder="البريد الإلكتروني" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })}
            className="w-full px-4 py-2.5 rounded-xl border text-sm" style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }} />
          <input placeholder="كلمة المرور" type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })}
            className="w-full px-4 py-2.5 rounded-xl border text-sm" style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }} />
          <input placeholder="رقم الهاتف" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })}
            className="w-full px-4 py-2.5 rounded-xl border text-sm" style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }} />
          <button onClick={saveUser} className="w-full py-3 rounded-xl text-white font-medium" style={{ backgroundColor: 'var(--primary)' }}>حفظ</button>
        </div>
      </Modal>

      <Modal open={permModal} onClose={() => setPermModal(false)} title={`صلاحيات: ${selectedUser?.name || ''}`}>
        <div className="space-y-3">
          {SECTIONS.map(s => {
            const perms = (editingRole?.permissions[s.key] || '') as string;
            return (
              <div key={s.key} className="flex items-center justify-between p-3 rounded-xl" style={{ backgroundColor: 'var(--bg)' }}>
                <span className="font-medium text-sm" style={{ color: 'var(--text)' }}>{s.label}</span>
                <div className="flex gap-2">
                  <button onClick={() => togglePerm(s.key, 'read')}
                    className={`px-3 py-1 rounded-lg text-xs ${perms.includes('read') ? 'text-white' : 'border'}`}
                    style={perms.includes('read') ? { backgroundColor: 'var(--primary)' } : { borderColor: 'var(--border)', color: 'var(--text)' }}>
                    عرض
                  </button>
                  <button onClick={() => togglePerm(s.key, 'write')}
                    className={`px-3 py-1 rounded-lg text-xs ${perms.includes('write') ? 'text-white' : 'border'}`}
                    style={perms.includes('write') ? { backgroundColor: 'var(--primary)' } : { borderColor: 'var(--border)', color: 'var(--text)' }}>
                    تعديل
                  </button>
                </div>
              </div>
            );
          })}
          <button onClick={savePermissions} className="w-full py-3 rounded-xl text-white font-medium" style={{ backgroundColor: 'var(--primary)' }}>
            حفظ الصلاحيات
          </button>
        </div>
      </Modal>
    </div>
  );
}
