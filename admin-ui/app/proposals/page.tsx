'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { api } from '../../lib/api';
import Skeleton from '../../components/Skeleton';

interface Proposal {
  id: number;
  instructor_name: string;
  course_title: string;
  status: 'draft' | 'submitted' | 'approved' | 'rejected' | 'needs_changes';
  status_label: string;
  admin_note: string;
  course_id: number | null;
  submitted_at: string | null;
  updated_at: string | null;
}

const FILTERS = [
  { key: 'all', label: 'الكل' },
  { key: 'submitted', label: 'بانتظار المراجعة' },
  { key: 'needs_changes', label: 'مطلوب تعديل' },
  { key: 'approved', label: 'مقبولة' },
  { key: 'rejected', label: 'مرفوضة' },
  { key: 'draft', label: 'مسودات' },
] as const;

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  draft: { bg: 'var(--md-sys-color-surface-container)', color: 'var(--md-sys-color-on-surface-variant)' },
  submitted: { bg: 'var(--md-sys-color-info-container)', color: 'var(--md-sys-color-on-info-container)' },
  approved: { bg: 'var(--md-sys-color-success-container)', color: 'var(--md-sys-color-on-success-container)' },
  rejected: { bg: 'var(--md-sys-color-error-container)', color: 'var(--md-sys-color-on-error-container)' },
  needs_changes: { bg: 'var(--md-sys-color-warning-container)', color: 'var(--md-sys-color-on-warning-container)' },
};

function formatDate(value?: string | null): string {
  if (!value) return '';
  const raw = String(value);
  const iso = raw.includes('T') ? raw : `${raw.replace(' ', 'T')}Z`;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('ar-EG', { year: 'numeric', month: 'short', day: 'numeric' });
}

export default function ProposalsPage() {
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<string>('all');
  const [search, setSearch] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api('/api/admin/proposals');
      setProposals(Array.isArray(data) ? data : []);
    } catch (err: any) {
      setError(err?.message || 'فشل تحميل المقترحات');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const counts = useMemo(() => {
    const map: Record<string, number> = { all: proposals.length };
    for (const proposal of proposals) {
      map[proposal.status] = (map[proposal.status] || 0) + 1;
    }
    return map;
  }, [proposals]);

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return proposals.filter((proposal) => {
      if (filter !== 'all' && proposal.status !== filter) return false;
      if (!term) return true;
      return (
        proposal.course_title.toLowerCase().includes(term) ||
        proposal.instructor_name.toLowerCase().includes(term)
      );
    });
  }, [proposals, filter, search]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--md-sys-color-on-surface)' }}>
            مقترحات الكورسات
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>
            راجع مقترحات المحاضرين، وعدّلها إن لزم، ثم اقبلها وأنشئ الكورس منها.
          </p>
        </div>
        <button onClick={() => void load()} className="md3-btn md3-btn--outlined">
          <span className="material-symbols-outlined text-[18px]" aria-hidden>refresh</span>
          تحديث
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {FILTERS.map((item) => {
          const active = filter === item.key;
          return (
            <button
              key={item.key}
              onClick={() => setFilter(item.key)}
              aria-pressed={active}
              className="px-4 py-1.5 rounded-full text-sm font-medium transition-colors"
              style={{
                backgroundColor: active ? 'var(--md-sys-color-secondary-container)' : 'transparent',
                color: active ? 'var(--md-sys-color-on-secondary-container)' : 'var(--md-sys-color-on-surface-variant)',
                border: `1px solid ${active ? 'transparent' : 'var(--md-sys-color-outline)'}`,
                minHeight: 40,
              }}
            >
              {item.label}
              {counts[item.key] ? ` (${counts[item.key]})` : ''}
            </button>
          );
        })}
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="ابحث باسم الدورة أو المحاضر…"
          className="md3-field flex-1 min-w-[200px]"
        />
      </div>

      {error && (
        <div className="p-3 rounded-[var(--md-sys-shape-corner-small)] text-sm" style={{ backgroundColor: 'var(--md-sys-color-error-container)', color: 'var(--md-sys-color-on-error-container)' }}>
          {error}
        </div>
      )}

      {loading ? (
        <Skeleton rows={3} cols={3} />
      ) : visible.length === 0 ? (
        <div
          className="p-10 text-center flex flex-col items-center"
          style={{ backgroundColor: 'var(--md-sys-color-surface-container-low)', color: 'var(--md-sys-color-on-surface-variant)', borderRadius: 'var(--md-sys-shape-corner-medium)' }}
        >
          <span className="material-symbols-outlined text-[32px] mb-2" aria-hidden>description</span>
          لا توجد مقترحات مطابقة.
        </div>
      ) : (
        <div className="space-y-3">
          {visible.map((proposal) => {
            const colors = STATUS_COLORS[proposal.status] || STATUS_COLORS.draft;
            return (
              <Link
                key={proposal.id}
                href={`/proposals/${proposal.id}`}
                className="block p-4 md3-elevation-1"
                style={{
                  backgroundColor: 'var(--md-sys-color-surface-container-low)',
                  border: '1px solid var(--md-sys-color-outline-variant)',
                  borderRadius: 'var(--md-sys-shape-corner-medium)',
                }}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h2 className="font-bold" style={{ color: 'var(--md-sys-color-on-surface)' }}>
                      {proposal.course_title || 'مقترح بلا عنوان'}
                    </h2>
                    <p className="text-sm mt-1" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>
                      المحاضر: {proposal.instructor_name}
                      {proposal.submitted_at ? ` · قُدّم ${formatDate(proposal.submitted_at)}` : ` · آخر تحديث ${formatDate(proposal.updated_at)}`}
                      {proposal.course_id ? ` · كورس #${proposal.course_id}` : ''}
                    </p>
                  </div>
                  <span
                    className="text-xs px-3 py-1 rounded-full font-medium shrink-0"
                    style={{ backgroundColor: colors.bg, color: colors.color }}
                  >
                    {proposal.status_label}
                  </span>
                </div>
                {proposal.status === 'needs_changes' && proposal.admin_note && (
                  <p className="text-sm mt-2" style={{ color: 'var(--md-sys-color-on-warning-container)' }}>
                    ملاحظتك: {proposal.admin_note}
                  </p>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
