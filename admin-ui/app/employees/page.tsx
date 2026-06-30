'use client';

import { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import Modal from '../../components/Modal';
import ConfirmDialog from '../../components/ConfirmDialog';
import DataTable from '../../components/DataTable';
import Skeleton from '../../components/Skeleton';
import { useToast } from '../../components/Toast';

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
  const { toast } = useToast();
  const [users, setUsers] = useState<any[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [addModal, setAddModal] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', password: '', phone: '', role_id: '2' });

  const [editModal, setEditModal] = useState(false);
  const [editTarget, setEditTarget] = useState<any>(null);
  const [editForm, setEditForm] = useState({ name: '', email: '', phone: '', password: '' });

  const [permModal, setPermModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [editingRole, setEditingRole] = useState<Role | null>(null);

  const [confirmDelete, setConfirmDelete] = useState<any>(null);
  const [confirmToggle, setConfirmToggle] = useState<any>(null);

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
      setAddModal(false);
      setForm({ name: '', email: '', password: '', phone: '', role_id: '2' });
      toast('تم إنشاء الموظف', 'success');
      load();
    } catch {
      toast('فشل إنشاء الموظف', 'error');
    }
  };

  const startEdit = (user: any) => {
    setEditTarget(user);
    setEditForm({ name: user.name, email: user.email, phone: user.phone || '', password: '' });
    setEditModal(true);
  };

  const saveEdit = async () => {
    try {
      const body: any = { name: editForm.name, email: editForm.email, phone: editForm.phone };
      if (editForm.password) body.password = editForm.password;
      await api(`/api/admin/users/${editTarget.id}`, { method: 'PUT', body: JSON.stringify(body) });
      toast('تم تحديث بيانات الموظف', 'success');
      setEditModal(false);
      load();
    } catch {
      toast('فشل تحديث البيانات', 'error');
    }
  };

  const toggleActive = async () => {
    if (!confirmToggle) return;
    try {
      if (Number(confirmToggle.is_active)) {
        await api(`/api/admin/users/${confirmToggle.id}`, { method: 'DELETE' });
        toast('تم تعطيل الموظف', 'success');
      } else {
        await api(`/api/admin/users/${confirmToggle.id}/reactivate`, { method: 'PUT' });
        toast('تم تفعيل الموظف', 'success');
      }
      setConfirmToggle(null);
      load();
    } catch {
      toast('فشل تغيير الحالة', 'error');
    }
  };

  const deleteEmployee = async () => {
    if (!confirmDelete) return;
    try {
      await api(`/api/admin/users/${confirmDelete.id}/hard`, { method: 'DELETE' });
      toast('تم حذف الموظف نهائياً', 'success');
      setConfirmDelete(null);
      load();
    } catch {
      toast('فشل حذف الموظف', 'error');
    }
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
      toast('تم حفظ الصلاحيات', 'success');
      setPermModal(false);
      load();
    } catch {
      toast('فشل حفظ الصلاحيات', 'error');
    }
  };

  if (loading) return <div className="space-y-4"><div className="flex items-center justify-between"><h1 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>الموظفين</h1></div><div className="rounded-2xl p-4 border" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}><Skeleton rows={5} cols={6} /></div></div>;
  if (error) return <div className="flex flex-col items-center justify-center h-64 gap-4"><p style={{ color: '#dc2626' }}>{error}</p><button onClick={load} className="px-4 py-2 bg-[var(--primary)] text-white rounded-xl text-sm">إعادة المحاولة</button></div>;

  const employeeRole = roles.find(r => r.id === 2);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>الموظفين</h1>
        <button onClick={() => setAddModal(true)} className="px-4 py-2 rounded-xl text-white text-sm font-medium" style={{ backgroundColor: 'var(--primary)' }}>
          + إضافة موظف
        </button>
      </div>

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
            { key: 'is_active', label: 'الحالة', render: (v: any) => Number(v) ? '🟢 نشط' : '🔴 غير نشط' },
            { key: 'actions', label: 'الإجراءات', render: (_: any, row: any) => (
              <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                <button onClick={() => startEdit(row)}
                  className="px-2 py-1 rounded-lg text-xs font-medium bg-blue-50 text-blue-600 hover:bg-blue-100">تعديل</button>
                <button onClick={() => openPermEditor(row)}
                  className="px-2 py-1 rounded-lg text-xs text-white" style={{ backgroundColor: 'var(--primary)' }}>
                  صلاحيات
                </button>
                <button onClick={() => setConfirmToggle(row)}
                  className="px-2 py-1 rounded-lg text-xs font-medium"
                  style={{ backgroundColor: Number(row.is_active) ? '#fef2f2' : '#f0fdf4', color: Number(row.is_active) ? '#dc2626' : '#16a34a' }}>
                  {Number(row.is_active) ? 'تعطيل' : 'تفعيل'}
                </button>
                <button onClick={() => setConfirmDelete(row)}
                  className="px-2 py-1 rounded-lg text-xs font-medium bg-red-50 text-red-600 hover:bg-red-100">حذف</button>
              </div>
            )},
          ]}
          data={users}
        />
      </div>

      <Modal open={addModal} onClose={() => setAddModal(false)} title="إضافة موظف جديد">
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

      <Modal open={editModal} onClose={() => setEditModal(false)} title={`تعديل: ${editTarget?.name || ''}`}>
        <div className="space-y-3">
          <input placeholder="الاسم" value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })}
            className="w-full px-4 py-2.5 rounded-xl border text-sm" style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }} />
          <input placeholder="البريد الإلكتروني" type="email" value={editForm.email} onChange={e => setEditForm({ ...editForm, email: e.target.value })}
            className="w-full px-4 py-2.5 rounded-xl border text-sm" style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }} />
          <input placeholder="رقم الهاتف" value={editForm.phone} onChange={e => setEditForm({ ...editForm, phone: e.target.value })}
            className="w-full px-4 py-2.5 rounded-xl border text-sm" style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }} />
          <input placeholder="كلمة المرور (اترك فارغاً إن لم ترد التغيير)" type="password" value={editForm.password}
            onChange={e => setEditForm({ ...editForm, password: e.target.value })}
            className="w-full px-4 py-2.5 rounded-xl border text-sm" style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }} />
          <button onClick={saveEdit} className="w-full py-3 rounded-xl text-white font-medium" style={{ backgroundColor: 'var(--primary)' }}>حفظ التعديلات</button>
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

      <ConfirmDialog
        open={!!confirmToggle}
        title={Number(confirmToggle?.is_active) ? 'تعطيل الموظف' : 'تفعيل الموظف'}
        message={Number(confirmToggle?.is_active) ? `تعطيل "${confirmToggle?.name}"؟` : `تفعيل "${confirmToggle?.name}"؟`}
        confirmLabel={Number(confirmToggle?.is_active) ? 'تعطيل' : 'تفعيل'}
        variant={Number(confirmToggle?.is_active) ? 'warning' : 'info'}
        onConfirm={toggleActive}
        onCancel={() => setConfirmToggle(null)}
      />

      <ConfirmDialog
        open={!!confirmDelete}
        title="حذف الموظف"
        message={`حذف "${confirmDelete?.name}" نهائياً؟ هذا الإجراء لا يمكن التراجع عنه.`}
        confirmLabel="حذف"
        variant="danger"
        onConfirm={deleteEmployee}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  );
}
