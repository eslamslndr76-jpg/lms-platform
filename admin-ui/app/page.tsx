'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { api } from '../lib/api';
import StatsCard from '../components/StatsCard';
import DataTable from '../components/DataTable';
import ExportButton from '../components/ExportButton';
import StatusBadge from '../components/StatusBadge';
import { useAdminAuth } from '../lib/auth';

export default function AdminDashboard() {
  const { user, can, isAdmin } = useAdminAuth();
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [incompleteGroups, setIncompleteGroups] = useState<any[]>([]);
  const [unassignedCount, setUnassignedCount] = useState<number | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    Promise.all([
      can('financials') ? api('/api/admin/orders/financials') : Promise.resolve(null),
      isAdmin ? api('/api/groups/incomplete').catch(() => null) : Promise.resolve([]),
      can('groups')
        ? api('/api/admin/unassigned/count').then((r: any) => Number(r?.count) || 0).catch(() => null)
        : Promise.resolve(0),
    ])
      .then(([s, g, u]) => {
        if (!active) return;
        setStats(s);
        setIncompleteGroups(Array.isArray(g) ? g : []);
        // null means "could not load" — distinct from a real zero.
        setUnassignedCount(typeof u === 'number' ? u : null);
      })
      .catch((err: any) => {
        if (active) setError(err?.message || 'تعذّر تحميل بيانات اللوحة');
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [can, isAdmin]);

  const pendingCount = Number(stats?.totalPending?.count) || 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64" role="status" aria-label="جارٍ التحميل">
        <div
          className="animate-spin h-9 w-9 rounded-full border-4"
          style={{ borderColor: 'var(--md-sys-color-primary)', borderTopColor: 'transparent' }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--md-sys-color-on-surface)' }}>مرحباً، {user?.name}</h1>
        <p className="text-sm" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>لوحة التحكم</p>
      </div>

      {error && (
        <div
          role="alert"
          className="p-4 rounded-[var(--md-sys-shape-corner-small)] flex items-center gap-3"
          style={{
            backgroundColor: 'var(--md-sys-color-error-container)',
            color: 'var(--md-sys-color-on-error-container)',
          }}
        >
          <span className="material-symbols-outlined text-[22px]" aria-hidden>error</span>
          <p className="text-sm flex-1">{error}</p>
          <button onClick={() => window.location.reload()} className="md3-btn md3-btn--text text-sm" style={{ color: 'inherit' }}>
            إعادة المحاولة
          </button>
        </div>
      )}

      {/* Alert banners */}
      <div className="space-y-2">
        {pendingCount > 0 && can('orders') && (
          <div
            className="rounded-[var(--md-sys-shape-corner-medium)] p-4 flex items-center gap-3"
            style={{ backgroundColor: 'var(--md-sys-color-warning-container)', color: 'var(--md-sys-color-on-warning-container)' }}
          >
            <span className="material-symbols-outlined text-[26px]" aria-hidden>pending_actions</span>
            <div className="flex-1 min-w-0">
              <h3 className="font-bold text-sm">طلبات جديدة في انتظار المراجعة</h3>
              <p className="text-xs mt-1">
                يوجد {pendingCount} طلب {pendingCount > 1 ? 'جديدة' : 'جديد'} لم يتم مراجعتها بعد
              </p>
            </div>
            <Link
              href="/orders"
              className="md3-btn md3-btn--tonal shrink-0"
              style={{ minHeight: 40, padding: '0 14px' }}
            >
              عرض الطلبات
            </Link>
          </div>
        )}

        {unassignedCount === null && (
          <div
            className="rounded-[var(--md-sys-shape-corner-medium)] p-4 flex items-center gap-3 text-sm"
            style={{
              backgroundColor: 'var(--md-sys-color-surface-container)',
              color: 'var(--md-sys-color-on-surface-variant)',
            }}
          >
            <span className="material-symbols-outlined text-[22px]" aria-hidden>help</span>
            <span className="flex-1">تعذّر تحميل عدد الطلاب غير المسكّنين — تحقق من الاتصال.</span>
          </div>
        )}

        {unassignedCount !== null && unassignedCount > 0 && (
          <div
            className="rounded-[var(--md-sys-shape-corner-medium)] p-4 flex items-center gap-3"
            style={{ backgroundColor: 'var(--md-sys-color-error-container)', color: 'var(--md-sys-color-on-error-container)' }}
          >
            <span className="material-symbols-outlined text-[26px]" aria-hidden>person_alert</span>
            <div className="flex-1 min-w-0">
              <h3 className="font-bold text-sm">طلاب غير مسكّنين</h3>
              <p className="text-xs mt-1">
                يوجد {unassignedCount} طالب تم تأكيد دفعه ولم يتم تسكينه في مجموعات
              </p>
            </div>
            <Link href="/courses" className="md3-btn md3-btn--tonal shrink-0" style={{ minHeight: 40, padding: '0 14px' }}>
              عرض الكورسات
            </Link>
          </div>
        )}

        {incompleteGroups.length > 0 && (
          <div
            className="rounded-[var(--md-sys-shape-corner-medium)] p-4 flex items-start gap-3"
            style={{ backgroundColor: 'var(--md-sys-color-warning-container)', color: 'var(--md-sys-color-on-warning-container)' }}
          >
            <span className="material-symbols-outlined text-[26px]" aria-hidden>warning</span>
            <div className="flex-1 min-w-0">
              <h3 className="font-bold text-sm">مجموعات غير مكتملة</h3>
              <p className="text-xs mt-1">يوجد {incompleteGroups.length} مجموعة غير مكتملة البيانات</p>
              <div className="flex flex-wrap gap-2 mt-2">
                {incompleteGroups.map((g: any) => (
                  <Link
                    key={g.id}
                    href={`/courses/${g.course_id || ''}`}
                    className="text-xs px-2.5 py-1 rounded-full font-medium"
                    style={{ backgroundColor: 'var(--md-sys-color-surface-container-lowest)', color: 'var(--md-sys-color-on-warning-container)' }}
                  >
                    {g.name} ({g.course_name})
                  </Link>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {can('financials') && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 animate-stagger">
          <StatsCard
            title="إجمالي المبيعات"
            value={`${stats?.totalPaid?.sum || 0} ج.م`}
            subtitle={`${stats?.totalPaid?.count || 0} طلب مدفوع`}
            icon="payments"
            color="var(--md-sys-color-success)"
          />
          <StatsCard
            title="طلبات معلقة"
            value={stats?.totalPending?.count || 0}
            subtitle={`بقيمة ${stats?.totalPending?.sum || 0} ج.م`}
            icon="pending_actions"
            color="var(--md-sys-color-warning)"
          />
          <StatsCard
            title="الطلبات المدفوعة"
            value={stats?.totalPaid?.count || 0}
            icon="task_alt"
            color="var(--md-sys-color-primary)"
          />
          <StatsCard
            title="آخر 6 أشهر"
            value={stats?.monthly?.[0]?.sum || 0}
            subtitle="الشهر الحالي"
            icon="trending_up"
            color="var(--md-sys-color-tertiary)"
          />
        </div>
      )}

      {can('orders') && (
        <div
          className="md3-card md3-card--outlined p-4"
          style={{ borderColor: 'var(--md-sys-color-outline-variant)' }}
        >
          <div className="flex items-center justify-between mb-4 gap-2">
            <h2 className="font-bold" style={{ color: 'var(--md-sys-color-on-surface)' }}>آخر الطلبات</h2>
            <div className="flex items-center gap-2">
              <ExportButton variant="icon" dataset="orders" title="تصدير الطلبات" label="تصدير الطلبات" />
              <Link href="/orders" className="text-sm font-medium" style={{ color: 'var(--md-sys-color-primary)' }}>
                عرض الكل
              </Link>
            </div>
          </div>
          <DataTable
            columns={[
              { key: 'id', label: '#' },
              { key: 'student_name', label: 'الطالب' },
              { key: 'title_ar', label: 'الكورس' },
              { key: 'amount', label: 'المبلغ', render: (v: number) => `${v} ج.م` },
              { key: 'status', label: 'الحالة', render: (v: string) => <StatusBadge status={v} /> },
            ]}
            data={stats?.recent || []}
          />
        </div>
      )}
    </div>
  );
}