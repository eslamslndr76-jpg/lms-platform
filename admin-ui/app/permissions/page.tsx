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
        <p className="text-sm rounded-md3-sm px-3 py-2 bg-surface-container-low text-on-surface-variant">
          {inheritHint}
        </p>
      )}
      <div className="md3-table-wrap max-h-[70vh] overflow-y-auto">
        <table className="md3-table min-w-[520px]">
          <caption className="sr-only">مصفوفة الصلاحيات</caption>
          <thead>
            <tr>
              <th scope="col" className="text-start sticky top-0 z-10">القسم</th>
              <th scope="col" className="text-center sticky top-0 z-10 w-24">عرض</th>
              <th scope="col" className="text-center sticky top-0 z-10 w-24">تعديل</th>
            </tr>
          </thead>
          <tbody>
            {sections.map((section) => {
              const actions = parseActions(value[section.key]);
              const locked = disabled || section.managerOnly;
              return (
                <tr key={section.key} className="md3-table-row align-top">
                  <th scope="row" className="text-start py-3.5 px-4 font-normal border-b" style={{ borderColor: 'var(--md-sys-color-outline-variant)', backgroundColor: 'var(--md-sys-color-surface-container-lowest)' }}>
                    <span className="flex flex-wrap items-center gap-2 text-sm font-medium text-on-surface">
                      <span aria-hidden>{section.icon}</span>
                      <span>{section.label}</span>
                      {section.managerOnly && (
                        <span className="text-xs px-2 py-0.5 rounded-full shrink-0 bg-warning-container text-on-warning-container">
                          مدير فقط
                        </span>
                      )}
                    </span>
                    <span className="block text-xs mt-1 leading-relaxed text-on-surface-variant">
                      {section.description}
                    </span>
                  </th>
                  {(['read', 'write'] as const).map((action) => {
                    const active = actions.includes(action);
                    const label = action === 'read' ? 'عرض' : 'تعديل';
                    return (
                      <td key={action} className="text-center">
                        <label
                          className={`inline-flex items-center justify-center min-h-[44px] min-w-[44px] ${locked ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                        >
                          <input
                            type="checkbox"
                            className="w-5 h-5 cursor-pointer disabled:cursor-not-allowed"
                            style={{ accentColor: 'var(--md-sys-color-primary)' }}
                            checked={active}
                            disabled={locked}
                            aria-label={`${label} — ${section.label}`}
                            onChange={() => onChange(togglePermission(value, section.key, action))}
                          />
                        </label>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
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
      <div className="md3-card md3-card--outlined flex flex-col items-center justify-center h-64 gap-3">
        <span className="text-4xl">🔒</span>
        <h1 className="text-lg font-bold text-on-surface">هذه المنطقة مخصصة لمدير النظام</h1>
        <p className="text-sm text-center px-6 text-on-surface-variant">
          إدارة الحسابات والأدوار والصلاحيات متاحة لمدير النظام فقط.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-on-surface">المستخدمون والصلاحيات</h1>
        </div>
        <div className="md3-card md3-card--outlined p-4">
          <Skeleton rows={6} cols={6} />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <p className="msg-err px-4 py-3 rounded-md3-sm text-sm">{error}</p>
        <button onClick={load} className="md3-btn md3-btn--filled">
          إعادة المحاولة
        </button>
      </div>
    );
  }

  const inputClass = 'w-full md3-field';
  const staffRoles = roles.filter((role) => role.id !== 3);

  const userColumns = [
    {
      key: 'name',
      label: 'الحساب',
      render: (value: string, row: StaffUser) => (
        <div className="flex items-center gap-2 min-w-0 max-w-[220px]">
          {row.avatar ? (
            <img src={row.avatar} alt={value} className="w-8 h-8 rounded-full object-cover shrink-0" />
          ) : (
            <span
              className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 bg-primary-container text-on-primary-container"
            >
              {String(value || '?').trim().charAt(0)}
            </span>
          )}
          <div className="min-w-0">
            <p className="text-sm font-medium truncate text-on-surface">{value}</p>
            <p className="text-xs truncate text-on-surface-variant" dir="ltr">{row.email}</p>
            {row.phone && <p className="text-xs truncate text-on-surface-variant" dir="ltr">{row.phone}</p>}
          </div>
        </div>
      ),
    },
    {
      key: 'role_id',
      label: 'الدور',
      align: 'center' as const,
      nowrap: true,
      render: (value: number, row: StaffUser) => (
        <span
          className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${Number(value) === 1 ? 'bg-primary-container text-on-primary-container' : 'bg-surface-container-highest text-on-surface'}`}
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
          <div className="flex flex-col gap-1 max-w-[200px]">
            <span
              className={custom ? 'inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium w-fit bg-warning-container text-on-warning-container' : 'inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium w-fit bg-success-container text-on-success-container'}
            >
              {custom ? 'مخصصة للحساب' : 'وراثة من الدور'}
            </span>
            <span className="text-xs text-on-surface-variant truncate" title={summarize(effective, sections)}>{summarize(effective, sections)}</span>
          </div>
        );
      },
    },
    { key: 'last_login', label: 'آخر دخول', align: 'center' as const, nowrap: true, render: (value: string) => <span className="text-xs text-on-surface-variant">{formatDate(value)}</span> },
    {
      key: 'is_active',
      label: 'الحالة',
      align: 'center' as const,
      nowrap: true,
      render: (value: number) => (
        <span className={`inline-flex items-center gap-1 text-xs font-medium ${Number(value) ? 'text-success' : 'text-error'}`}>
          <span className={`w-2 h-2 rounded-full ${Number(value) ? 'bg-success' : 'bg-error'}`} />
          {Number(value) ? 'نشط' : 'معطل'}
        </span>
      ),
    },
    {
      key: 'actions',
      label: 'الإجراءات',
      align: 'center' as const,
      nowrap: true,
      render: (_: unknown, row: StaffUser) => (
        <div className="flex flex-nowrap justify-center gap-1" onClick={(event) => event.stopPropagation()}>
          <button onClick={() => openPermissions(row)} className="md3-btn md3-btn--tonal text-xs" style={{ minHeight: 32, padding: '0 10px' }}>
            الصلاحيات
          </button>
          <button onClick={() => openEdit(row)} className="md3-btn md3-btn--text text-xs" style={{ minHeight: 32, padding: '0 8px' }}>
            تعديل
          </button>
          <button
            onClick={() => setToggleTarget(row)}
            disabled={row.id === currentUser?.id}
            className="md3-btn md3-btn--text text-xs disabled:cursor-not-allowed"
            style={{ minHeight: 32, padding: '0 8px', color: Number(row.is_active) ? 'var(--md-sys-color-error)' : 'var(--md-sys-color-success)' }}
          >
            {Number(row.is_active) ? 'تعطيل' : 'تفعيل'}
          </button>
          <button
            onClick={() => setDeleteTarget(row)}
            disabled={row.id === currentUser?.id}
            className="md3-btn md3-btn--text text-xs text-error"
            style={{ minHeight: 32, padding: '0 8px' }}
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
          <h1 className="text-2xl font-bold text-on-surface">المستخدمون والصلاحيات</h1>
          <p className="text-sm mt-1 text-on-surface-variant">
            إدارة حسابات الموظفين، والأدوار، ومصفوفة الصلاحيات، وبيانات الدخول من مكان واحد.
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={load} className="md3-btn md3-btn--outlined">
            تحديث
          </button>
          <ExportButton dataset="employees" title="تصدير الحسابات" />
          <button
            onClick={() => setAddOpen(true)}
            className="md3-btn md3-btn--filled"
          >
            + حساب موظف
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="md3-tabs" role="tablist" aria-label="أقسام المستخدمين والصلاحيات">
        {TABS.map((item) => {
          const active = tab === item.key;
          return (
            <button
              key={item.key}
              role="tab"
              aria-selected={active}
              onClick={() => setTab(item.key)}
              className={`md3-tab ${active ? 'md3-tab--active' : ''}`}
            >
              <span aria-hidden>{item.icon}</span>
              {item.label}
            </button>
          );
        })}
      </div>
      <p className="text-sm text-on-surface-variant">{TABS.find((item) => item.key === tab)?.hint}</p>

      {/* ─── Accounts ─────────────────────────────────────────── */}
      {tab === 'accounts' && (
        <div className="space-y-4 animate-fade-in">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatsCard title="إجمالي الحسابات" value={users.length} icon="👥" color="var(--md-sys-color-primary)" />
            <StatsCard title="حسابات نشطة" value={activeUsers.length} icon="🟢" color="var(--md-sys-color-success)" />
            <StatsCard title="حسابات معطلة" value={disabledUsers.length} icon="🔴" color="var(--md-sys-color-error)" />
            <StatsCard title="صلاحيات مخصصة" value={customPermissionUsers.length} subtitle="تتجاوز صلاحيات الدور" icon="🎯" color="var(--md-sys-color-warning)" />
          </div>

          <div className="md3-card md3-card--outlined p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-semibold text-on-surface">حسابات الفريق</h2>
              <span className="text-xs text-on-surface-variant">اضغط «الصلاحيات» لتخصيص وصول موظف بعينه</span>
            </div>
            {users.length === 0 ? (
              <div className="text-center py-10 space-y-2">
                <p className="text-3xl">🗂️</p>
                <p className="text-sm font-medium text-on-surface">لا توجد حسابات بعد</p>
                <p className="text-xs text-on-surface-variant">ابدأ بإنشاء أول حساب موظف وحدد دوره.</p>
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
          <div className="md3-card md3-card--outlined p-3 space-y-2 h-fit">
            <div className="flex items-center justify-between px-1">
              <h2 className="text-sm font-semibold text-on-surface">الأدوار</h2>
              <button
                onClick={() => setCreateRoleOpen(true)}
                className="md3-btn md3-btn--tonal text-xs"
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
                  aria-pressed={active}
                  className={`w-full text-start px-3 py-2.5 rounded-md3-md border transition-colors ${active ? 'bg-primary text-on-primary border-primary' : 'bg-surface-container-lowest text-on-surface border-outline-variant hover:bg-surface-container-high'}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium truncate">{roleLabel(role.id, role.name)}</span>
                    {role.is_system && (
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${active ? 'bg-primary-container text-on-primary-container' : 'bg-surface-container-highest text-on-surface-variant'}`}
                      >
                        نظامي
                      </span>
                    )}
                  </div>
                  <p className={`text-xs mt-0.5 ${active ? 'text-on-primary' : 'text-on-surface-variant'}`}>
                    {role.users_count} حساب · {summarize(role.permissions, sections)}
                  </p>
                </button>
              );
            })}
            <p className="text-xs px-1 pt-2 leading-relaxed text-on-surface-variant">
              الأدوار النظامية محمية من الحذف. يمكن إنشاء أدوار مخصصة وربطها بالموظفين.
            </p>
          </div>

          <div className="md3-card md3-card--outlined p-4 space-y-4">
            {!selectedRole ? (
              <p className="text-sm text-on-surface-variant">اختر دورًا لعرض صلاحياته.</p>
            ) : (
              <>
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div className="flex-1 min-w-[200px]">
                    <label className="text-sm font-medium block mb-1 text-on-surface-variant">اسم الدور</label>
                    <div className="flex gap-2">
                      <input
                        value={roleNameDraft}
                        onChange={(event) => setRoleNameDraft(event.target.value)}
                        disabled={selectedRole.is_system}
                        className="md3-field flex-1"
                      />
                      {!selectedRole.is_system && (
                        <button
                          onClick={renameRole}
                          disabled={roleNameSaving || roleNameDraft.trim() === selectedRole.name}
                          className="md3-btn md3-btn--filled"
                        >
                          حفظ الاسم
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {selectedRole.is_system && (
                      <span className="text-sm px-3 py-2 rounded-md3-sm bg-surface-container-low text-on-surface-variant">
                        {selectedRole.id === 1 ? 'المدير يملك كل الصلاحيات دائمًا' : 'دور نظامي — الاسم غير قابل للتعديل'}
                      </span>
                    )}
                    {!selectedRole.is_system && (
                      <button
                        onClick={() => setDeleteRoleTarget(selectedRole)}
                        className="md3-btn md3-btn--text text-error"
                      >
                        حذف الدور
                      </button>
                    )}
                  </div>
                </div>

                <div className="rounded-md3-sm p-3 text-sm leading-relaxed bg-surface-container-low text-on-surface-variant">
                  صلاحيات الدور تُطبق على كل حساب مرتبط به. يمكنك تجاوزها لحساب معيّن من تبويب «الحسابات» ← «الصلاحيات».
                  إدارة الحسابات والإعدادات محصورة بمدير النظام ولا يمكن منحها لأي دور.
                </div>

                {selectedRole.id === 1 ? (
                  <div className="rounded-md3-sm p-4 text-sm bg-primary-container text-on-primary-container">
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
                        className="w-full md3-btn md3-btn--filled"
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
          <div className="md3-card md3-card--outlined p-4">
            <h2 className="text-base font-semibold mb-1 text-on-surface">بيانات الدخول</h2>
            <p className="text-sm mb-3 text-on-surface-variant">
              البريد الإلكتروني أو رقم الهاتف يُستخدمان لتسجيل الدخول. كلمات المرور مشفّرة ولا يمكن عرضها — يمكنك إعادة تعيينها فقط.
            </p>
            <div className="md3-table-wrap max-h-[70vh] overflow-y-auto">
              <table className="md3-table">
                <thead>
                  <tr>
                    <th className="text-start sticky top-0 z-10">الحساب</th>
                    <th className="text-start sticky top-0 z-10">بيانات الدخول</th>
                    <th className="text-center sticky top-0 z-10">الدور</th>
                    <th className="text-center sticky top-0 z-10">آخر دخول / الإنشاء</th>
                    <th className="text-center sticky top-0 z-10">الحالة</th>
                    <th className="text-center sticky top-0 z-10">كلمة المرور</th>
                  </tr>
                </thead>
                <tbody>
                  {users.length === 0 && (
                    <tr>
                      <td colSpan={6} className="md3-table-empty">
                        لا توجد حسابات بعد.
                      </td>
                    </tr>
                  )}
                  {users.map((staff) => (
                    <tr key={staff.id} className="md3-table-row">
                      <td>
                        <span className="font-medium text-on-surface">{staff.name}</span>
                      </td>
                      <td>
                        <div className="text-on-surface" dir="ltr">{staff.email}</div>
                        {staff.phone && (
                          <div className="text-xs text-on-surface-variant" dir="ltr">{staff.phone}</div>
                        )}
                      </td>
                      <td className="text-center whitespace-nowrap text-on-surface">{roleLabel(staff.role_id, staff.role_name)}</td>
                      <td className="text-center whitespace-nowrap">
                        <div className="text-sm text-on-surface-variant">{formatDate(staff.last_login)}</div>
                        <div className="text-xs text-on-surface-variant">أنشئ: {formatDate(staff.created_at)}</div>
                      </td>
                      <td className="text-center whitespace-nowrap">
                        <span className={`text-xs font-medium ${Number(staff.is_active) ? 'text-success' : 'text-error'}`}>
                          {Number(staff.is_active) ? 'نشط' : 'معطل'}
                        </span>
                      </td>
                      <td className="text-center whitespace-nowrap">
                        <button
                          onClick={() => { setPasswordTarget(staff); setNewPassword(''); }}
                          className="md3-btn md3-btn--outlined text-xs"
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

          <div className="md3-card md3-card--outlined p-4 text-sm leading-relaxed text-on-surface-variant">
            🔐 نصيحة أمنية: استخدم كلمات مرور قوية (8 أحرف على الأقل مع أرقام ورموز)، وعطّل حساب أي موظف يتوقف عن العمل بدل حذفه،
            لتبقى سجلاته المرتبطة بالطلبات والشهادات محفوظة.
          </div>
        </div>
      )}

      {/* ─── Create account ───────────────────────────────────── */}
      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="إنشاء حساب موظف">
        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium block mb-1 text-on-surface-variant">الاسم الكامل</label>
            <input className={inputClass} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
          </div>
          <div>
            <label className="text-sm font-medium block mb-1 text-on-surface-variant">البريد الإلكتروني</label>
            <input type="email" dir="ltr" className={inputClass} value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
          </div>
          <div>
            <label className="text-sm font-medium block mb-1 text-on-surface-variant">رقم الهاتف</label>
            <input dir="ltr" className={inputClass} value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} />
          </div>
          <div>
            <label className="text-sm font-medium block mb-1 text-on-surface-variant">كلمة المرور</label>
            <input type="password" dir="ltr" className={inputClass} value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} />
          </div>
          <div>
            <label className="text-sm font-medium block mb-1 text-on-surface-variant">الدور</label>
            <select className={inputClass} value={form.role_id} onChange={(event) => setForm({ ...form, role_id: event.target.value })}>
              {staffRoles.map((role) => (
                <option key={role.id} value={String(role.id)}>{roleLabel(role.id, role.name)}</option>
              ))}
            </select>
          </div>
          <p className="text-xs leading-relaxed text-on-surface-variant">
            سيحصل الحساب على صلاحيات الدور المختار. يمكنك تخصيصها بعد الإنشاء من زر «الصلاحيات».
          </p>
          <button
            onClick={createAccount}
            disabled={saving}
            className="w-full md3-btn md3-btn--filled"
          >
            {saving ? 'جارٍ الإنشاء...' : 'إنشاء الحساب'}
          </button>
        </div>
      </Modal>

      {/* ─── Edit account ─────────────────────────────────────── */}
      <Modal open={!!editTarget} onClose={() => setEditTarget(null)} title={`تعديل الحساب: ${editTarget?.name || ''}`}>
        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium block mb-1 text-on-surface-variant">الاسم الكامل</label>
            <input className={inputClass} value={editForm.name} onChange={(event) => setEditForm({ ...editForm, name: event.target.value })} />
          </div>
          <div>
            <label className="text-sm font-medium block mb-1 text-on-surface-variant">البريد الإلكتروني</label>
            <input type="email" dir="ltr" className={inputClass} value={editForm.email} onChange={(event) => setEditForm({ ...editForm, email: event.target.value })} />
          </div>
          <div>
            <label className="text-sm font-medium block mb-1 text-on-surface-variant">رقم الهاتف</label>
            <input dir="ltr" className={inputClass} value={editForm.phone} onChange={(event) => setEditForm({ ...editForm, phone: event.target.value })} />
          </div>
          <div>
            <label className="text-sm font-medium block mb-1 text-on-surface-variant">الدور</label>
            <select
              className={inputClass}
              value={editForm.role_id}
              disabled={editTarget?.id === currentUser?.id}
              onChange={(event) => setEditForm({ ...editForm, role_id: event.target.value })}
            >
              {staffRoles.map((role) => (
                <option key={role.id} value={String(role.id)}>{roleLabel(role.id, role.name)}</option>
              ))}
            </select>
            {editTarget?.id === currentUser?.id && (
              <p className="text-xs mt-1 text-on-surface-variant">لا يمكنك تغيير دور حسابك الخاص.</p>
            )}
          </div>
          <div>
            <label className="text-sm font-medium block mb-1 text-on-surface-variant">كلمة مرور جديدة (اختياري)</label>
            <input type="password" dir="ltr" placeholder="اترك الحقل فارغًا للإبقاء على كلمة المرور الحالية" className={inputClass} value={editForm.password} onChange={(event) => setEditForm({ ...editForm, password: event.target.value })} />
          </div>
          <button
            onClick={saveEdit}
            disabled={saving}
            className="w-full md3-btn md3-btn--filled"
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
              aria-pressed={permInherit}
              className={`text-start p-3 rounded-md3-md border transition-colors ${permInherit ? 'border-primary bg-primary-container' : 'border-outline-variant bg-surface-container-lowest'}`}
            >
              <p className={`text-sm font-medium ${permInherit ? 'text-on-primary-container' : 'text-on-surface'}`}>وراثة صلاحيات الدور</p>
              <p className={`text-xs mt-1 ${permInherit ? 'text-on-primary-container' : 'text-on-surface-variant'}`}>
                يتبع الحساب دور «{permTarget ? roleLabel(permTarget.role_id, permTarget.role_name) : ''}» ويتحدث تلقائيًا عند تعديل الدور.
              </p>
            </button>
            <button
              onClick={() => setPermInherit(false)}
              aria-pressed={!permInherit}
              className={`text-start p-3 rounded-md3-md border transition-colors ${!permInherit ? 'border-primary bg-primary-container' : 'border-outline-variant bg-surface-container-lowest'}`}
            >
              <p className={`text-sm font-medium ${!permInherit ? 'text-on-primary-container' : 'text-on-surface'}`}>صلاحيات مخصصة لهذا الحساب</p>
              <p className={`text-xs mt-1 ${!permInherit ? 'text-on-primary-container' : 'text-on-surface-variant'}`}>
                تتجاوز صلاحيات الدور لهذا الموظف فقط.
              </p>
            </button>
          </div>

          {permTarget && Number(permTarget.role_id) === 1 && (
            <div className="text-sm rounded-md3-sm px-3 py-2 bg-warning-container text-on-warning-container">
              هذا الحساب مدير نظام ويملك كل الصلاحيات دائمًا؛ التخصيص لا يقيّده.
            </div>
          )}

          {permInherit ? (
            <div className="rounded-md3-md p-3 bg-surface-container-low">
              <p className="text-sm mb-2 text-on-surface-variant">الصلاحيات الموروثة من الدور:</p>
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
                  className="md3-btn md3-btn--outlined text-xs"
                >
                  نسخ صلاحيات الدور
                </button>
                <button
                  onClick={() => setPermDraft({})}
                  className="md3-btn md3-btn--outlined text-xs"
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
            className="w-full md3-btn md3-btn--filled"
          >
            {saving ? 'جارٍ الحفظ...' : 'حفظ الصلاحيات'}
          </button>
        </div>
      </Modal>

      {/* ─── Reset password ───────────────────────────────────── */}
      <Modal open={!!passwordTarget} onClose={() => { setPasswordTarget(null); setNewPassword(''); }} title={`إعادة تعيين كلمة المرور: ${passwordTarget?.name || ''}`}>
        <div className="space-y-3">
          <p className="text-xs leading-relaxed text-on-surface-variant">
            سيتم استبدال كلمة المرور الحالية فورًا. أبلغ الموظف بكلمة المرور الجديدة واطلب منه تغييرها من صفحة «حسابي».
          </p>
          <div>
            <label className="text-sm font-medium block mb-1 text-on-surface-variant">كلمة المرور الجديدة</label>
            <input type="password" dir="ltr" className={inputClass} value={newPassword} onChange={(event) => setNewPassword(event.target.value)} />
          </div>
          <button
            onClick={resetPassword}
            disabled={saving}
            className="w-full md3-btn md3-btn--filled"
          >
            {saving ? 'جارٍ التحديث...' : 'تحديث كلمة المرور'}
          </button>
        </div>
      </Modal>

      {/* ─── Create role ──────────────────────────────────────── */}
      <Modal open={createRoleOpen} onClose={() => setCreateRoleOpen(false)} title="إنشاء دور جديد">
        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium block mb-1 text-on-surface-variant">اسم الدور</label>
            <input className={inputClass} placeholder="مثال: مشرف مالي" value={newRoleName} onChange={(event) => setNewRoleName(event.target.value)} />
          </div>
          <p className="text-xs leading-relaxed text-on-surface-variant">
            يُنشأ الدور بصلاحية عرض لوحة التحكم فقط، ثم حدّد صلاحياته من المصفوفة.
          </p>
          <button
            onClick={createRole}
            disabled={saving}
            className="w-full md3-btn md3-btn--filled"
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
