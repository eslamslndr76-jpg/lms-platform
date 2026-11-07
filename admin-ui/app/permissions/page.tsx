'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../../lib/api';
import { useAdminAuth } from '../../lib/auth';
import Modal from '../../components/Modal';
import ConfirmDialog from '../../components/ConfirmDialog';
import DataTable from '../../components/DataTable';
import Skeleton from '../../components/Skeleton';
import StatsCard from '../../components/StatsCard';
import ExportButton from '../../components/ExportButton';
import { useToast } from '../../components/Toast';

type Tab = 'accounts' | 'roles' | 'logins';

interface PermissionSection {
  key: string;
  label: string;
  icon: string;
  description: string;
  managerOnly?: boolean;
}

interface Role {
  id: number;
  name: string;
  permissions: Record<string, string>;
  users_count: number;
  is_system: boolean;
}

interface StaffUser {
  id: number;
  name: string;
  email: string;
  phone?: string | null;
  avatar?: string | null;
  role_id: number;
  role_name: string;
  is_active: number;
  permissions: Record<string, string> | null;
  last_login?: string | null;
  created_at?: string | null;
}

const TABS: { key: Tab; label: string; icon: string; hint: string }[] = [
  { key: 'accounts', label: 'الحسابات', icon: '👤', hint: 'إدارة حسابات الفريق والموظفين' },
  { key: 'roles', label: 'الأدوار والصلاحيات', icon: '🛡️', hint: 'مصفوفة صلاحيات كل دور' },
  { key: 'logins', label: 'بيانات الدخول', icon: '🔑', hint: 'البريد وكلمة المرور وآخر دخول' },
];

const ROLE_LABELS: Record<number, string> = { 1: 'مدير النظام', 2: 'موظف', 3: 'طالب', 4: 'محاضر' };

const EMPTY_FORM = { name: '', email: '', password: '', phone: '', role_id: '2' };

function roleLabel(roleId: number, roleName?: string): string {
  return ROLE_LABELS[roleId] || roleName || `دور #${roleId}`;
}

function parseActions(value?: string): string[] {
  return String(value || '')
    .split(',')
    .map((action) => action.trim())
    .filter(Boolean);
}

function hasAction(permissions: Record<string, string>, section: string, action: 'read' | 'write'): boolean {
  if (permissions.all) return true;
  return parseActions(permissions[section]).includes(action);
}

function togglePermission(
  permissions: Record<string, string>,
  section: string,
  action: 'read' | 'write',
): Record<string, string> {
  const current = parseActions(permissions[section]);
  let next: string[];
  if (current.includes(action)) {
    next = current.filter((item) => item !== action);
    if (action === 'read') next = next.filter((item) => item !== 'write');
  } else {
    next = action === 'write' ? Array.from(new Set([...current, 'read', 'write'])) : [...current, 'read'];
  }
  return { ...permissions, [section]: next.join(',') };
}

function mergePermissions(
  rolePermissions: Record<string, string>,
  overrides: Record<string, string> | null,
): Record<string, string> {
  const merged: Record<string, string> = { ...rolePermissions };
  if (overrides) {
    for (const [section, actions] of Object.entries(overrides)) merged[section] = actions;
  }
  return merged;
}

function summarize(permissions: Record<string, string>, sections: PermissionSection[]): string {
  if (permissions.all) return 'كل الصلاحيات';
  const granted = sections.filter((section) => hasAction(permissions, section.key, 'read'));
  if (granted.length === 0) return 'لا يوجد وصول';
  const withWrite = granted.filter((section) => hasAction(permissions, section.key, 'write')).length;
  return `${granted.length} قسم${withWrite ? ` · ${withWrite} قابل للتعديل` : ''}`;
}

function formatDate(value?: string | null): string {
  if (!value) return '—';
  const raw = String(value);
  const normalized = raw.includes('T') ? raw : `${raw.replace(' ', 'T')}Z`;
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return raw;
  return date.toLocaleString('ar-EG', { dateStyle: 'medium', timeStyle: 'short' });
}

// ─── Permission matrix ─────────────────────────────────────────────

function PermissionMatrix({
  sections,
  value,
  onChange,
  disabled,
  inheritHint,
}: {
  sections: PermissionSection[];
  value: Record<string, string>;
  onChange: (next: Record<string, string>) => void;
  disabled?: boolean;
  inheritHint?: string;
}) {
  return (
    <div className="space-y-2">
      {inheritHint && (
        <p className="text-xs rounded-xl px-3 py-2" style={{ backgroundColor: 'var(--bg)', color: 'var(--text-muted)' }}>
          {inheritHint}
        </p>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {sections.map((section) => {
          const actions = parseActions(value[section.key]);
          const locked = disabled || section.managerOnly;
          return (
            <div
              key={section.key}
              className="rounded-xl p-3 border flex flex-col gap-2"
              style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)' }}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium flex items-center gap-2" style={{ color: 'var(--text)' }}>
                    <span>{section.icon}</span>
                    <span className="truncate">{section.label}</span>
                  </p>
                  <p className="text-[11px] mt-0.5 leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                    {section.description}
                  </p>
                </div>
                {section.managerOnly && (
                  <span
                    className="text-[10px] px-2 py-0.5 rounded-full shrink-0"
                    style={{ backgroundColor: 'rgba(245,158,11,0.15)', color: '#f59e0b' }}
                  >
                    مدير فقط
                  </span>
                )}
              </div>
              <div className="flex gap-2">
                {(['read', 'write'] as const).map((action) => {
                  const active = actions.includes(action);
                  return (
                    <button
                      key={action}
                      type="button"
                      disabled={locked}
                      onClick={() => onChange(togglePermission(value, section.key, action))}
                      className="px-3 py-1 rounded-lg text-xs font-medium border transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                      style={
                        active
                          ? { backgroundColor: 'var(--primary)', borderColor: 'var(--primary)', color: '#fff' }
                          : { backgroundColor: 'transparent', borderColor: 'var(--border)', color: 'var(--text-muted)' }
                      }
                    >
                      {action === 'read' ? 'عرض' : 'تعديل'}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Page ──────────────────────────────────────────────────────────

export default function PermissionsPage() {
  const { toast } = useToast();
  const { can, user: currentUser } = useAdminAuth();

  const [tab, setTab] = useState<Tab>('accounts');
  const [users, setUsers] = useState<StaffUser[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [sections, setSections] = useState<PermissionSection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // accounts tab
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [editTarget, setEditTarget] = useState<StaffUser | null>(null);
  const [editForm, setEditForm] = useState({ name: '', email: '', phone: '', password: '', role_id: '2' });
  const [toggleTarget, setToggleTarget] = useState<StaffUser | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<StaffUser | null>(null);

  // per-user overrides
  const [permTarget, setPermTarget] = useState<StaffUser | null>(null);
  const [permInherit, setPermInherit] = useState(true);
  const [permDraft, setPermDraft] = useState<Record<string, string>>({});

  // login data tab
  const [passwordTarget, setPasswordTarget] = useState<StaffUser | null>(null);
  const [newPassword, setNewPassword] = useState('');

  // roles tab
  const [selectedRoleId, setSelectedRoleId] = useState<number | null>(null);
  const [roleDraft, setRoleDraft] = useState<Record<string, string>>({});
  const [roleNameDraft, setRoleNameDraft] = useState('');
  const [roleNameSaving, setRoleNameSaving] = useState(false);
  const [savingRole, setSavingRole] = useState(false);
  const [createRoleOpen, setCreateRoleOpen] = useState(false);
  const [newRoleName, setNewRoleName] = useState('');
  const [deleteRoleTarget, setDeleteRoleTarget] = useState<Role | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [usersRes, rolesRes, catalogRes] = await Promise.all([
        api('/api/admin/users?role=staff&limit=100'),
        api('/api/roles'),
        api('/api/roles/catalog'),
      ]);
      const staff: StaffUser[] = usersRes.users || [];
      const roleList: Role[] = rolesRes || [];
      setUsers(staff);
      setRoles(roleList);
      setSections(catalogRes.sections || []);
      setSelectedRoleId((prev) => {
        const next = prev && roleList.some((role) => role.id === prev) ? prev : roleList.find((role) => role.id === 2)?.id ?? roleList[0]?.id ?? null;
        return next;
      });
    } catch {
      setError('تعذر تحميل بيانات الحسابات والصلاحيات');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const selectedRole = useMemo(
    () => roles.find((role) => role.id === selectedRoleId) || null,
    [roles, selectedRoleId],
  );

  useEffect(() => {
    if (!selectedRole) {
      setRoleDraft({});
      setRoleNameDraft('');
      return;
    }
    setRoleDraft({ ...selectedRole.permissions });
    setRoleNameDraft(selectedRole.name);
  }, [selectedRole]);

  const activeUsers = users.filter((user) => Number(user.is_active));
  const disabledUsers = users.filter((user) => !Number(user.is_active));
  const customPermissionUsers = users.filter(
    (user) => user.permissions && Object.keys(user.permissions).length > 0,
  );

  const rolePermissionMap = useCallback(
    (roleId: number) => roles.find((role) => role.id === roleId)?.permissions || {},
    [roles],
  );

  // ─── Account actions ─────────────────────────────────────────────

  const createAccount = async () => {
    if (!form.name.trim() || !form.email.trim() || !form.password) {
      toast('الاسم والبريد وكلمة المرور مطلوبة', 'warning');
      return;
    }
    setSaving(true);
    try {
      await api('/api/admin/users', {
        method: 'POST',
        body: JSON.stringify({ ...form, role_id: Number(form.role_id) }),
      });
      toast('تم إنشاء الحساب بنجاح', 'success');
      setAddOpen(false);
      setForm(EMPTY_FORM);
      await load();
    } catch (err: any) {
      toast(err?.message || 'فشل إنشاء الحساب', 'error');
    } finally {
      setSaving(false);
    }
  };

  const openEdit = (staff: StaffUser) => {
    setEditTarget(staff);
    setEditForm({
      name: staff.name,
      email: staff.email,
      phone: staff.phone || '',
      password: '',
      role_id: String(staff.role_id),
    });
  };

  const saveEdit = async () => {
    if (!editTarget) return;
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        name: editForm.name,
        email: editForm.email,
        phone: editForm.phone,
        role_id: Number(editForm.role_id),
      };
      if (editForm.password) body.password = editForm.password;
      await api(`/api/admin/users/${editTarget.id}`, { method: 'PUT', body: JSON.stringify(body) });
      toast('تم تحديث الحساب', 'success');
      setEditTarget(null);
      await load();
    } catch (err: any) {
      toast(err?.message || 'فشل تحديث الحساب', 'error');
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async () => {
    if (!toggleTarget) return;
    setSaving(true);
    try {
      if (Number(toggleTarget.is_active)) {
        await api(`/api/admin/users/${toggleTarget.id}`, { method: 'DELETE' });
        toast('تم تعطيل الحساب', 'success');
      } else {
        await api(`/api/admin/users/${toggleTarget.id}/reactivate`, { method: 'PUT' });
        toast('تم تفعيل الحساب', 'success');
      }
      setToggleTarget(null);
      await load();
    } catch (err: any) {
      toast(err?.message || 'فشل تغيير حالة الحساب', 'error');
    } finally {
      setSaving(false);
    }
  };

  const deleteAccount = async () => {
    if (!deleteTarget) return;
    setSaving(true);
    try {
      await api(`/api/admin/users/${deleteTarget.id}/hard`, { method: 'DELETE' });
      toast('تم حذف الحساب نهائيًا', 'success');
      setDeleteTarget(null);
      await load();
    } catch (err: any) {
      toast(err?.message || 'فشل حذف الحساب', 'error');
    } finally {
      setSaving(false);
    }
  };

  // ─── Per-user permissions ────────────────────────────────────────

  const openPermissions = (staff: StaffUser) => {
    const overrides = staff.permissions || {};
    const custom = Object.keys(overrides).length > 0;
    setPermTarget(staff);
    setPermInherit(!custom);
    setPermDraft(custom ? { ...overrides } : { ...rolePermissionMap(staff.role_id) });
  };

  const saveUserPermissions = async () => {
    if (!permTarget) return;
    setSaving(true);
    try {
      await api(`/api/admin/users/${permTarget.id}/permissions`, {
        method: 'PUT',
        body: JSON.stringify({ permissions: permInherit ? null : permDraft }),
      });
      toast(permInherit ? 'تمت إعادة الصلاحيات لصلاحيات الدور' : 'تم حفظ صلاحيات الحساب', 'success');
      setPermTarget(null);
      await load();
    } catch (err: any) {
      toast(err?.message || 'فشل حفظ الصلاحيات', 'error');
    } finally {
      setSaving(false);
    }
  };

  // ─── Login data ──────────────────────────────────────────────────

  const resetPassword = async () => {
    if (!passwordTarget) return;
    if (newPassword.trim().length < 6) {
      toast('كلمة المرور يجب أن تكون 6 أحرف على الأقل', 'warning');
      return;
    }
    setSaving(true);
    try {
      await api(`/api/admin/users/${passwordTarget.id}`, {
        method: 'PUT',
        body: JSON.stringify({ password: newPassword }),
      });
      toast('تم تحديث كلمة المرور', 'success');
      setPasswordTarget(null);
      setNewPassword('');
    } catch (err: any) {
      toast(err?.message || 'فشل تحديث كلمة المرور', 'error');
    } finally {
      setSaving(false);
    }
  };

  // ─── Roles ───────────────────────────────────────────────────────

  const saveRolePermissions = async () => {
    if (!selectedRole || selectedRole.id === 1) return;
    setSavingRole(true);
    try {
      await api(`/api/roles/${selectedRole.id}`, {
        method: 'PUT',
        body: JSON.stringify({ permissions: roleDraft }),
      });
      toast('تم حفظ صلاحيات الدور', 'success');
      await load();
    } catch (err: any) {
      toast(err?.message || 'فشل حفظ صلاحيات الدور', 'error');
    } finally {
      setSavingRole(false);
    }
  };

  const renameRole = async () => {
    if (!selectedRole || selectedRole.is_system) return;
    if (roleNameDraft.trim().length < 2) {
      toast('اسم الدور قصير جدًا', 'warning');
      return;
    }
    setRoleNameSaving(true);
    try {
      await api(`/api/roles/${selectedRole.id}`, {
        method: 'PUT',
        body: JSON.stringify({ name: roleNameDraft.trim() }),
      });
      toast('تم تحديث اسم الدور', 'success');
      await load();
    } catch (err: any) {
      toast(err?.message || 'فشل تحديث اسم الدور', 'error');
    } finally {
      setRoleNameSaving(false);
    }
  };

  const createRole = async () => {
    if (newRoleName.trim().length < 2) {
      toast('اسم الدور قصير جدًا', 'warning');
      return;
    }
    setSaving(true);
    try {
      const created: any = await api('/api/roles', {
        method: 'POST',
        body: JSON.stringify({ name: newRoleName.trim(), permissions: { dashboard: 'read' } }),
      });
      toast('تم إنشاء الدور', 'success');
      setCreateRoleOpen(false);
      setNewRoleName('');
      if (created?.id) setSelectedRoleId(Number(created.id));
      setTab('roles');
      await load();
    } catch (err: any) {
      toast(err?.message || 'فشل إنشاء الدور', 'error');
    } finally {
      setSaving(false);
    }
  };

  const deleteRole = async () => {
    if (!deleteRoleTarget) return;
    setSaving(true);
    try {
      await api(`/api/roles/${deleteRoleTarget.id}`, { method: 'DELETE' });
      toast('تم حذف الدور', 'success');
      setDeleteRoleTarget(null);
      if (selectedRoleId === deleteRoleTarget.id) setSelectedRoleId(2);
      await load();
    } catch (err: any) {
      toast(err?.message || 'فشل حذف الدور', 'error');
    } finally {
      setSaving(false);
    }
  };

  // ─── Guards & layout helpers ─────────────────────────────────────

  if (!can('employees')) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3 rounded-2xl border" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}>
        <span className="text-4xl">🔒</span>
        <h1 className="text-lg font-bold" style={{ color: 'var(--text)' }}>هذه المنطقة مخصصة لمدير النظام</h1>
        <p className="text-sm text-center px-6" style={{ color: 'var(--text-muted)' }}>
          إدارة الحسابات والأدوار والصلاحيات متاحة لمدير النظام فقط.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>المستخدمون والصلاحيات</h1>
        </div>
        <div className="rounded-2xl p-4 border" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}>
          <Skeleton rows={6} cols={6} />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <p style={{ color: '#dc2626' }}>{error}</p>
        <button onClick={load} className="px-4 py-2 rounded-xl text-white text-sm" style={{ backgroundColor: 'var(--primary)' }}>
          إعادة المحاولة
        </button>
      </div>
    );
  }

  const inputClass = 'w-full px-4 py-2.5 rounded-xl border text-sm outline-none transition-all focus:ring-2';
  const inputStyle = { backgroundColor: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' } as const;
  const staffRoles = roles.filter((role) => role.id !== 3);

  const userColumns = [
    {
      key: 'name',
      label: 'الحساب',
      render: (value: string, row: StaffUser) => (
        <div className="flex items-center gap-2 min-w-0">
          {row.avatar ? (
            <img src={row.avatar} alt={value} className="w-8 h-8 rounded-full object-cover" />
          ) : (
            <span
              className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
              style={{ backgroundColor: 'var(--bg)', color: 'var(--primary)' }}
            >
              {String(value || '?').trim().charAt(0)}
            </span>
          )}
          <div className="min-w-0">
            <p className="text-sm font-medium truncate" style={{ color: 'var(--text)' }}>{value}</p>
            <p className="text-[11px] truncate" style={{ color: 'var(--text-muted)' }}>{row.email}</p>
          </div>
        </div>
      ),
    },
    { key: 'phone', label: 'الهاتف', render: (value: string) => value || <span style={{ color: 'var(--text-muted)' }}>—</span> },
    {
      key: 'role_id',
      label: 'الدور',
      render: (value: number, row: StaffUser) => (
        <span
          className="inline-block px-2.5 py-0.5 rounded-full text-xs font-medium"
          style={
            Number(value) === 1
              ? { backgroundColor: 'rgba(37,99,235,0.12)', color: 'var(--primary)' }
              : { backgroundColor: 'var(--bg)', color: 'var(--text)' }
          }
        >
          {roleLabel(Number(value), row.role_name)}
        </span>
      ),
    },
    {
      key: 'permissions',
      label: 'الصلاحيات',
      render: (value: Record<string, string> | null, row: StaffUser) => {
        const custom = !!value && Object.keys(value).length > 0;
        const effective = mergePermissions(rolePermissionMap(row.role_id), value);
        return (
          <div className="flex flex-col gap-1">
            <span
              className="inline-block w-fit px-2 py-0.5 rounded-full text-[11px] font-medium"
              style={custom ? { backgroundColor: 'rgba(245,158,11,0.15)', color: '#f59e0b' } : { backgroundColor: 'rgba(34,197,94,0.12)', color: '#16a34a' }}
            >
              {custom ? 'مخصصة للحساب' : 'وراثة من الدور'}
            </span>
            <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{summarize(effective, sections)}</span>
          </div>
        );
      },
    },
    { key: 'last_login', label: 'آخر دخول', render: (value: string) => <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{formatDate(value)}</span> },
    {
      key: 'is_active',
      label: 'الحالة',
      render: (value: number) => (
        <span className="inline-flex items-center gap-1 text-xs" style={{ color: Number(value) ? '#16a34a' : '#dc2626' }}>
          <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: Number(value) ? '#16a34a' : '#dc2626' }} />
          {Number(value) ? 'نشط' : 'معطل'}
        </span>
      ),
    },
    {
      key: 'actions',
      label: 'الإجراءات',
      render: (_: unknown, row: StaffUser) => (
        <div className="flex flex-wrap gap-1" onClick={(event) => event.stopPropagation()}>
          <button onClick={() => openPermissions(row)} className="px-2 py-1 rounded-lg text-xs text-white" style={{ backgroundColor: 'var(--primary)' }}>
            الصلاحيات
          </button>
          <button onClick={() => openEdit(row)} className="px-2 py-1 rounded-lg text-xs font-medium bg-blue-50 text-blue-600 hover:bg-blue-100">
            تعديل
          </button>
          <button
            onClick={() => setToggleTarget(row)}
            disabled={row.id === currentUser?.id}
            className="px-2 py-1 rounded-lg text-xs font-medium disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ backgroundColor: Number(row.is_active) ? '#fef2f2' : '#f0fdf4', color: Number(row.is_active) ? '#dc2626' : '#16a34a' }}
          >
            {Number(row.is_active) ? 'تعطيل' : 'تفعيل'}
          </button>
          <button
            onClick={() => setDeleteTarget(row)}
            disabled={row.id === currentUser?.id}
            className="px-2 py-1 rounded-lg text-xs font-medium bg-red-50 text-red-600 hover:bg-red-100 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            حذف
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>المستخدمون والصلاحيات</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
            إدارة حسابات الموظفين، والأدوار، ومصفوفة الصلاحيات، وبيانات الدخول من مكان واحد.
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={load} className="px-3 py-2 rounded-xl border text-sm" style={{ borderColor: 'var(--border)', color: 'var(--text)' }}>
            تحديث
          </button>
          <ExportButton dataset="employees" title="تصدير الحسابات" />
          <button
            onClick={() => setAddOpen(true)}
            className="px-4 py-2 rounded-xl text-white text-sm font-medium"
            style={{ backgroundColor: 'var(--primary)' }}
          >
            + حساب موظف
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div
        className="flex flex-wrap gap-1 p-1 rounded-2xl border"
        style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}
        role="tablist"
      >
        {TABS.map((item) => {
          const active = tab === item.key;
          return (
            <button
              key={item.key}
              role="tab"
              aria-selected={active}
              onClick={() => setTab(item.key)}
              className="flex-1 min-w-[150px] text-start px-4 py-2.5 rounded-xl transition-all"
              style={active ? { backgroundColor: 'var(--primary)', color: '#fff' } : { color: 'var(--text)' }}
            >
              <span className="text-sm font-medium flex items-center gap-2">
                <span>{item.icon}</span>
                <span>{item.label}</span>
              </span>
              <span className="text-[11px] block mt-0.5" style={{ color: active ? 'rgba(255,255,255,0.8)' : 'var(--text-muted)' }}>
                {item.hint}
              </span>
            </button>
          );
        })}
      </div>

      {/* ─── Accounts ─────────────────────────────────────────── */}
      {tab === 'accounts' && (
        <div className="space-y-4 animate-fade-in">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatsCard title="إجمالي الحسابات" value={users.length} icon="👥" color="var(--primary)" />
            <StatsCard title="حسابات نشطة" value={activeUsers.length} icon="🟢" color="#16a34a" />
            <StatsCard title="حسابات معطلة" value={disabledUsers.length} icon="🔴" color="#dc2626" />
            <StatsCard title="صلاحيات مخصصة" value={customPermissionUsers.length} subtitle="تتجاوز صلاحيات الدور" icon="🎯" color="#f59e0b" />
          </div>

          <div className="rounded-2xl p-4 border" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}>
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-bold" style={{ color: 'var(--text)' }}>حسابات الفريق</h2>
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>اضغط «الصلاحيات» لتخصيص وصول موظف بعينه</span>
            </div>
            {users.length === 0 ? (
              <div className="text-center py-10 space-y-2">
                <p className="text-3xl">🗂️</p>
                <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>لا توجد حسابات بعد</p>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>ابدأ بإنشاء أول حساب موظف وحدد دوره.</p>
              </div>
            ) : (
              <DataTable columns={userColumns} data={users} />
            )}
          </div>
        </div>
      )}

      {/* ─── Roles ────────────────────────────────────────────── */}
      {tab === 'roles' && (
        <div className="grid grid-cols-1 lg:grid-cols-[290px_1fr] gap-4 animate-fade-in">
          <div className="rounded-2xl border p-3 space-y-2 h-fit" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}>
            <div className="flex items-center justify-between px-1">
              <h2 className="font-bold text-sm" style={{ color: 'var(--text)' }}>الأدوار</h2>
              <button
                onClick={() => setCreateRoleOpen(true)}
                className="px-2.5 py-1 rounded-lg text-xs text-white"
                style={{ backgroundColor: 'var(--primary)' }}
              >
                + دور
              </button>
            </div>
            {roles.map((role) => {
              const active = role.id === selectedRoleId;
              return (
                <button
                  key={role.id}
                  onClick={() => setSelectedRoleId(role.id)}
                  aria-label={`اختيار دور ${roleLabel(role.id, role.name)}`}
                  className="w-full text-start px-3 py-2.5 rounded-xl border transition-all"
                  style={
                    active
                      ? { backgroundColor: 'var(--primary)', borderColor: 'var(--primary)', color: '#fff' }
                      : { backgroundColor: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }
                  }
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium truncate">{roleLabel(role.id, role.name)}</span>
                    {role.is_system && (
                      <span
                        className="text-[10px] px-1.5 py-0.5 rounded-full shrink-0"
                        style={
                          active
                            ? { backgroundColor: 'rgba(255,255,255,0.2)', color: '#fff' }
                            : { backgroundColor: 'var(--card)', color: 'var(--text-muted)' }
                        }
                      >
                        نظامي
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] mt-0.5" style={{ color: active ? 'rgba(255,255,255,0.75)' : 'var(--text-muted)' }}>
                    {role.users_count} حساب · {summarize(role.permissions, sections)}
                  </p>
                </button>
              );
            })}
            <p className="text-[11px] px-1 pt-2 leading-relaxed" style={{ color: 'var(--text-muted)' }}>
              الأدوار النظامية محمية من الحذف. يمكن إنشاء أدوار مخصصة وربطها بالموظفين.
            </p>
          </div>

          <div className="rounded-2xl border p-4 space-y-4" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}>
            {!selectedRole ? (
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>اختر دورًا لعرض صلاحياته.</p>
            ) : (
              <>
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div className="flex-1 min-w-[200px]">
                    <label className="text-xs block mb-1" style={{ color: 'var(--text-muted)' }}>اسم الدور</label>
                    <div className="flex gap-2">
                      <input
                        value={roleNameDraft}
                        onChange={(event) => setRoleNameDraft(event.target.value)}
                        disabled={selectedRole.is_system}
                        className={inputClass}
                        style={inputStyle}
                      />
                      {!selectedRole.is_system && (
                        <button
                          onClick={renameRole}
                          disabled={roleNameSaving || roleNameDraft.trim() === selectedRole.name}
                          className="px-3 py-2 rounded-xl text-sm text-white disabled:opacity-40"
                          style={{ backgroundColor: 'var(--primary)' }}
                        >
                          حفظ الاسم
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {selectedRole.is_system && (
                      <span className="text-xs px-3 py-2 rounded-xl" style={{ backgroundColor: 'var(--bg)', color: 'var(--text-muted)' }}>
                        {selectedRole.id === 1 ? 'المدير يملك كل الصلاحيات دائمًا' : 'دور نظامي — الاسم غير قابل للتعديل'}
                      </span>
                    )}
                    {!selectedRole.is_system && (
                      <button
                        onClick={() => setDeleteRoleTarget(selectedRole)}
                        className="px-3 py-2 rounded-xl text-sm font-medium bg-red-50 text-red-600 hover:bg-red-100"
                      >
                        حذف الدور
                      </button>
                    )}
                  </div>
                </div>

                <div className="rounded-xl p-3 text-xs leading-relaxed" style={{ backgroundColor: 'var(--bg)', color: 'var(--text-muted)' }}>
                  صلاحيات الدور تُطبق على كل حساب مرتبط به. يمكنك تجاوزها لحساب معيّن من تبويب «الحسابات» ← «الصلاحيات».
                  إدارة الحسابات والإعدادات محصورة بمدير النظام ولا يمكن منحها لأي دور.
                </div>

                {selectedRole.id === 1 ? (
                  <div className="rounded-xl p-4 text-sm" style={{ backgroundColor: 'var(--bg)', color: 'var(--text)' }}>
                    ✅ دور «مدير النظام» يملك وصولًا كاملًا لكل الأقسام، بما فيها الحسابات والإعدادات. لا يمكن تقييده.
                  </div>
                ) : (
                  <>
                    <PermissionMatrix
                      sections={sections}
                      value={roleDraft}
                      onChange={setRoleDraft}
                      disabled={selectedRole.id === 3}
                      inheritHint={selectedRole.id === 3 ? 'دور الطالب نظامي ومخصص لواجهة الطالب، ولا يمكن تعديل صلاحياته.' : undefined}
                    />
                    {selectedRole.id !== 3 && (
                      <button
                        onClick={saveRolePermissions}
                        disabled={savingRole}
                        className="w-full py-3 rounded-xl text-white font-medium disabled:opacity-60"
                        style={{ backgroundColor: 'var(--primary)' }}
                      >
                        {savingRole ? 'جارٍ الحفظ...' : 'حفظ صلاحيات الدور'}
                      </button>
                    )}
                  </>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* ─── Login data ───────────────────────────────────────── */}
      {tab === 'logins' && (
        <div className="space-y-4 animate-fade-in">
          <div className="rounded-2xl p-4 border" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}>
            <h2 className="font-bold mb-1" style={{ color: 'var(--text)' }}>بيانات الدخول</h2>
            <p className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>
              البريد الإلكتروني أو رقم الهاتف يُستخدمان لتسجيل الدخول. كلمات المرور مشفّرة ولا يمكن عرضها — يمكنك إعادة تعيينها فقط.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    <th className="text-start py-2 px-2 font-medium">الحساب</th>
                    <th className="text-start py-2 px-2 font-medium">البريد الإلكتروني</th>
                    <th className="text-start py-2 px-2 font-medium">الهاتف</th>
                    <th className="text-start py-2 px-2 font-medium">الدور</th>
                    <th className="text-start py-2 px-2 font-medium">آخر دخول</th>
                    <th className="text-start py-2 px-2 font-medium">تاريخ الإنشاء</th>
                    <th className="text-start py-2 px-2 font-medium">الحالة</th>
                    <th className="text-start py-2 px-2 font-medium">كلمة المرور</th>
                  </tr>
                </thead>
                <tbody>
                  {users.length === 0 && (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
                        لا توجد حسابات بعد.
                      </td>
                    </tr>
                  )}
                  {users.map((staff) => (
                    <tr key={staff.id} className="border-t" style={{ borderColor: 'var(--border)' }}>
                      <td className="py-2.5 px-2">
                        <span className="font-medium" style={{ color: 'var(--text)' }}>{staff.name}</span>
                      </td>
                      <td className="py-2.5 px-2" dir="ltr" style={{ color: 'var(--text)' }}>{staff.email}</td>
                      <td className="py-2.5 px-2" dir="ltr" style={{ color: 'var(--text)' }}>{staff.phone || '—'}</td>
                      <td className="py-2.5 px-2" style={{ color: 'var(--text)' }}>{roleLabel(staff.role_id, staff.role_name)}</td>
                      <td className="py-2.5 px-2 text-xs" style={{ color: 'var(--text-muted)' }}>{formatDate(staff.last_login)}</td>
                      <td className="py-2.5 px-2 text-xs" style={{ color: 'var(--text-muted)' }}>{formatDate(staff.created_at)}</td>
                      <td className="py-2.5 px-2">
                        <span className="text-xs" style={{ color: Number(staff.is_active) ? '#16a34a' : '#dc2626' }}>
                          {Number(staff.is_active) ? 'نشط' : 'معطل'}
                        </span>
                      </td>
                      <td className="py-2.5 px-2">
                        <button
                          onClick={() => { setPasswordTarget(staff); setNewPassword(''); }}
                          className="px-2.5 py-1 rounded-lg text-xs font-medium border"
                          style={{ borderColor: 'var(--border)', color: 'var(--text)' }}
                        >
                          إعادة تعيين
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-2xl p-4 border text-xs leading-relaxed" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
            🔐 نصيحة أمنية: استخدم كلمات مرور قوية (8 أحرف على الأقل مع أرقام ورموز)، وعطّل حساب أي موظف يتوقف عن العمل بدل حذفه،
            لتبقى سجلاته المرتبطة بالطلبات والشهادات محفوظة.
          </div>
        </div>
      )}

      {/* ─── Create account ───────────────────────────────────── */}
      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="إنشاء حساب موظف">
        <div className="space-y-3">
          <div>
            <label className="text-xs block mb-1" style={{ color: 'var(--text-muted)' }}>الاسم الكامل</label>
            <input className={inputClass} style={inputStyle} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
          </div>
          <div>
            <label className="text-xs block mb-1" style={{ color: 'var(--text-muted)' }}>البريد الإلكتروني</label>
            <input type="email" dir="ltr" className={inputClass} style={inputStyle} value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
          </div>
          <div>
            <label className="text-xs block mb-1" style={{ color: 'var(--text-muted)' }}>رقم الهاتف</label>
            <input dir="ltr" className={inputClass} style={inputStyle} value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} />
          </div>
          <div>
            <label className="text-xs block mb-1" style={{ color: 'var(--text-muted)' }}>كلمة المرور</label>
            <input type="password" dir="ltr" className={inputClass} style={inputStyle} value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} />
          </div>
          <div>
            <label className="text-xs block mb-1" style={{ color: 'var(--text-muted)' }}>الدور</label>
            <select className={inputClass} style={inputStyle} value={form.role_id} onChange={(event) => setForm({ ...form, role_id: event.target.value })}>
              {staffRoles.map((role) => (
                <option key={role.id} value={String(role.id)}>{roleLabel(role.id, role.name)}</option>
              ))}
            </select>
          </div>
          <p className="text-[11px] leading-relaxed" style={{ color: 'var(--text-muted)' }}>
            سيحصل الحساب على صلاحيات الدور المختار. يمكنك تخصيصها بعد الإنشاء من زر «الصلاحيات».
          </p>
          <button
            onClick={createAccount}
            disabled={saving}
            className="w-full py-3 rounded-xl text-white font-medium disabled:opacity-60"
            style={{ backgroundColor: 'var(--primary)' }}
          >
            {saving ? 'جارٍ الإنشاء...' : 'إنشاء الحساب'}
          </button>
        </div>
      </Modal>

      {/* ─── Edit account ─────────────────────────────────────── */}
      <Modal open={!!editTarget} onClose={() => setEditTarget(null)} title={`تعديل الحساب: ${editTarget?.name || ''}`}>
        <div className="space-y-3">
          <div>
            <label className="text-xs block mb-1" style={{ color: 'var(--text-muted)' }}>الاسم الكامل</label>
            <input className={inputClass} style={inputStyle} value={editForm.name} onChange={(event) => setEditForm({ ...editForm, name: event.target.value })} />
          </div>
          <div>
            <label className="text-xs block mb-1" style={{ color: 'var(--text-muted)' }}>البريد الإلكتروني</label>
            <input type="email" dir="ltr" className={inputClass} style={inputStyle} value={editForm.email} onChange={(event) => setEditForm({ ...editForm, email: event.target.value })} />
          </div>
          <div>
            <label className="text-xs block mb-1" style={{ color: 'var(--text-muted)' }}>رقم الهاتف</label>
            <input dir="ltr" className={inputClass} style={inputStyle} value={editForm.phone} onChange={(event) => setEditForm({ ...editForm, phone: event.target.value })} />
          </div>
          <div>
            <label className="text-xs block mb-1" style={{ color: 'var(--text-muted)' }}>الدور</label>
            <select
              className={inputClass}
              style={inputStyle}
              value={editForm.role_id}
              disabled={editTarget?.id === currentUser?.id}
              onChange={(event) => setEditForm({ ...editForm, role_id: event.target.value })}
            >
              {staffRoles.map((role) => (
                <option key={role.id} value={String(role.id)}>{roleLabel(role.id, role.name)}</option>
              ))}
            </select>
            {editTarget?.id === currentUser?.id && (
              <p className="text-[11px] mt-1" style={{ color: 'var(--text-muted)' }}>لا يمكنك تغيير دور حسابك الخاص.</p>
            )}
          </div>
          <div>
            <label className="text-xs block mb-1" style={{ color: 'var(--text-muted)' }}>كلمة مرور جديدة (اختياري)</label>
            <input type="password" dir="ltr" placeholder="اترك الحقل فارغًا للإبقاء على كلمة المرور الحالية" className={inputClass} style={inputStyle} value={editForm.password} onChange={(event) => setEditForm({ ...editForm, password: event.target.value })} />
          </div>
          <button
            onClick={saveEdit}
            disabled={saving}
            className="w-full py-3 rounded-xl text-white font-medium disabled:opacity-60"
            style={{ backgroundColor: 'var(--primary)' }}
          >
            {saving ? 'جارٍ الحفظ...' : 'حفظ التعديلات'}
          </button>
        </div>
      </Modal>

      {/* ─── Per-user permissions ─────────────────────────────── */}
      <Modal open={!!permTarget} onClose={() => setPermTarget(null)} title={`صلاحيات الحساب: ${permTarget?.name || ''}`} size="xl">
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <button
              onClick={() => setPermInherit(true)}
              className="text-start p-3 rounded-xl border transition-all"
              style={permInherit ? { borderColor: 'var(--primary)', backgroundColor: 'rgba(37,99,235,0.06)' } : { borderColor: 'var(--border)' }}
            >
              <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>وراثة صلاحيات الدور</p>
              <p className="text-[11px] mt-1" style={{ color: 'var(--text-muted)' }}>
                يتبع الحساب دور «{permTarget ? roleLabel(permTarget.role_id, permTarget.role_name) : ''}» ويتحدث تلقائيًا عند تعديل الدور.
              </p>
            </button>
            <button
              onClick={() => setPermInherit(false)}
              className="text-start p-3 rounded-xl border transition-all"
              style={!permInherit ? { borderColor: 'var(--primary)', backgroundColor: 'rgba(37,99,235,0.06)' } : { borderColor: 'var(--border)' }}
            >
              <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>صلاحيات مخصصة لهذا الحساب</p>
              <p className="text-[11px] mt-1" style={{ color: 'var(--text-muted)' }}>
                تتجاوز صلاحيات الدور لهذا الموظف فقط.
              </p>
            </button>
          </div>

          {permTarget && Number(permTarget.role_id) === 1 && (
            <div className="text-xs rounded-xl px-3 py-2" style={{ backgroundColor: 'rgba(245,158,11,0.12)', color: '#b45309' }}>
              هذا الحساب مدير نظام ويملك كل الصلاحيات دائمًا؛ التخصيص لا يقيّده.
            </div>
          )}

          {permInherit ? (
            <div className="rounded-xl p-3" style={{ backgroundColor: 'var(--bg)' }}>
              <p className="text-xs mb-2" style={{ color: 'var(--text-muted)' }}>الصلاحيات الموروثة من الدور:</p>
              <PermissionMatrix
                sections={sections}
                value={permTarget ? rolePermissionMap(permTarget.role_id) : {}}
                onChange={() => undefined}
                disabled
              />
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setPermDraft(permTarget ? { ...rolePermissionMap(permTarget.role_id) } : {})}
                  className="px-3 py-1.5 rounded-lg text-xs border"
                  style={{ borderColor: 'var(--border)', color: 'var(--text)' }}
                >
                  نسخ صلاحيات الدور
                </button>
                <button
                  onClick={() => setPermDraft({})}
                  className="px-3 py-1.5 rounded-lg text-xs border"
                  style={{ borderColor: 'var(--border)', color: 'var(--text)' }}
                >
                  إزالة كل الصلاحيات
                </button>
              </div>
              <PermissionMatrix sections={sections} value={permDraft} onChange={setPermDraft} />
            </div>
          )}

          <button
            onClick={saveUserPermissions}
            disabled={saving}
            className="w-full py-3 rounded-xl text-white font-medium disabled:opacity-60"
            style={{ backgroundColor: 'var(--primary)' }}
          >
            {saving ? 'جارٍ الحفظ...' : 'حفظ الصلاحيات'}
          </button>
        </div>
      </Modal>

      {/* ─── Reset password ───────────────────────────────────── */}
      <Modal open={!!passwordTarget} onClose={() => { setPasswordTarget(null); setNewPassword(''); }} title={`إعادة تعيين كلمة المرور: ${passwordTarget?.name || ''}`}>
        <div className="space-y-3">
          <p className="text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>
            سيتم استبدال كلمة المرور الحالية فورًا. أبلغ الموظف بكلمة المرور الجديدة واطلب منه تغييرها من صفحة «حسابي».
          </p>
          <div>
            <label className="text-xs block mb-1" style={{ color: 'var(--text-muted)' }}>كلمة المرور الجديدة</label>
            <input type="password" dir="ltr" className={inputClass} style={inputStyle} value={newPassword} onChange={(event) => setNewPassword(event.target.value)} />
          </div>
          <button
            onClick={resetPassword}
            disabled={saving}
            className="w-full py-3 rounded-xl text-white font-medium disabled:opacity-60"
            style={{ backgroundColor: 'var(--primary)' }}
          >
            {saving ? 'جارٍ التحديث...' : 'تحديث كلمة المرور'}
          </button>
        </div>
      </Modal>

      {/* ─── Create role ──────────────────────────────────────── */}
      <Modal open={createRoleOpen} onClose={() => setCreateRoleOpen(false)} title="إنشاء دور جديد">
        <div className="space-y-3">
          <div>
            <label className="text-xs block mb-1" style={{ color: 'var(--text-muted)' }}>اسم الدور</label>
            <input className={inputClass} style={inputStyle} placeholder="مثال: مشرف مالي" value={newRoleName} onChange={(event) => setNewRoleName(event.target.value)} />
          </div>
          <p className="text-[11px] leading-relaxed" style={{ color: 'var(--text-muted)' }}>
            يُنشأ الدور بصلاحية عرض لوحة التحكم فقط، ثم حدّد صلاحياته من المصفوفة.
          </p>
          <button
            onClick={createRole}
            disabled={saving}
            className="w-full py-3 rounded-xl text-white font-medium disabled:opacity-60"
            style={{ backgroundColor: 'var(--primary)' }}
          >
            {saving ? 'جارٍ الإنشاء...' : 'إنشاء الدور'}
          </button>
        </div>
      </Modal>

      {/* ─── Dialogs ──────────────────────────────────────────── */}
      <ConfirmDialog
        open={!!toggleTarget}
        title={Number(toggleTarget?.is_active) ? 'تعطيل الحساب' : 'تفعيل الحساب'}
        message={Number(toggleTarget?.is_active) ? `تعطيل حساب «${toggleTarget?.name}»؟ لن يستطيع تسجيل الدخول حتى تعيد تفعيله.` : `تفعيل حساب «${toggleTarget?.name}»؟`}
        confirmLabel={Number(toggleTarget?.is_active) ? 'تعطيل' : 'تفعيل'}
        variant={Number(toggleTarget?.is_active) ? 'warning' : 'info'}
        loading={saving}
        onConfirm={toggleActive}
        onCancel={() => setToggleTarget(null)}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        title="حذف الحساب نهائيًا"
        message={`حذف حساب «${deleteTarget?.name}» وكل بياناته المرتبطة؟ هذا الإجراء لا يمكن التراجع عنه.`}
        confirmLabel="حذف نهائي"
        loading={saving}
        onConfirm={deleteAccount}
        onCancel={() => setDeleteTarget(null)}
      />

      <ConfirmDialog
        open={!!deleteRoleTarget}
        title="حذف الدور"
        message={`حذف دور «${deleteRoleTarget?.name || ''}»؟ يجب ألا يكون مرتبطًا بأي حساب.`}
        confirmLabel="حذف"
        loading={saving}
        onConfirm={deleteRole}
        onCancel={() => setDeleteRoleTarget(null)}
      />
    </div>
  );
}
