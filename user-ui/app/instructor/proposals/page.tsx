'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../../lib/auth';
import { api } from '../../../lib/api';

interface Proposal {
  id: number;
  course_title: string;
  status: 'draft' | 'submitted' | 'approved' | 'rejected' | 'needs_changes';
  status_label: string;
  admin_note: string;
  course_id: number | null;
  submitted_at: string | null;
  updated_at: string | null;
}

const STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  draft: { bg: 'var(--md-sys-color-surface-container-high)', color: 'var(--md-sys-color-on-surface-variant)' },
  submitted: { bg: 'var(--md-sys-color-primary-container)', color: 'var(--md-sys-color-on-primary-container)' },
  approved: { bg: 'var(--md-sys-color-tertiary-container)', color: 'var(--md-sys-color-on-tertiary-container)' },
  rejected: { bg: 'var(--md-sys-color-error-container)', color: 'var(--md-sys-color-on-error-container)' },
  needs_changes: { bg: 'var(--md-sys-color-secondary-container)', color: 'var(--md-sys-color-on-secondary-container)' },
};

function formatDate(value?: string | null): string {
  if (!value) return '';
  const raw = String(value);
  const iso = raw.includes('T') ? raw : `${raw.replace(' ', 'T')}Z`;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' });
}

export default function InstructorProposalsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.push('/login');
      return;
    }
    if (user.role !== 'instructor') router.push('/dashboard');
  }, [user, loading, router]);

  const load = useCallback(async () => {
    setLoadingList(true);
    setError('');
    try {
      const data = await api('/api/instructor/proposals');
      setProposals(Array.isArray(data) ? data : []);
    } catch {
      setError('تعذّر تحميل مقترحاتك. تحقق من اتصالك وحاول مرة أخرى.');
    } finally {
      setLoadingList(false);
    }
  }, []);

  useEffect(() => {
    if (!loading && user?.role === 'instructor') void load();
  }, [loading, user, load]);

  const createProposal = async () => {
    if (creating) return;
    setCreating(true);
    try {
      const res: any = await api('/api/instructor/proposals', {
        method: 'POST',
        body: JSON.stringify({ course_title: '', objectives: [], daily_content: [] }),
      });
      const id = res?.proposal?.id;
      if (id) router.push(`/instructor/proposals/${id}`);
      else throw new Error('تعذّر إنشاء المقترح');
    } catch (err: any) {
      setError(err?.message || 'تعذّر إنشاء المقترح');
      setCreating(false);
    }
  };

  if (loading || !user || user.role !== 'instructor') {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div
          className="animate-spin h-8 w-8 border-4 rounded-full"
          style={{ borderColor: 'var(--md-sys-color-primary)', borderTopColor: 'transparent' }}
        />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 pb-24">
      <Link
        href="/instructor"
        className="inline-flex items-center gap-1 text-sm mb-4"
        style={{ color: 'var(--md-sys-color-primary)' }}
      >
        <span className="material-symbols-outlined text-[18px]" aria-hidden="true">arrow_forward</span>
        مجموعاتي
      </Link>

      <header className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--md-sys-color-on-surface)' }}>
            مقترحات الكورسات
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>
            قدّم مقترح دورة تدريبية ليراجعه فريق الوحدة، ثم يُنشأ الكورس بعد القبول.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void createProposal()}
          disabled={creating}
          className="inline-flex items-center gap-1.5 min-h-[44px] px-5 rounded-full text-sm font-medium disabled:opacity-60"
          style={{
            backgroundColor: 'var(--md-sys-color-primary)',
            color: 'var(--md-sys-color-on-primary)',
          }}
        >
          <span className="material-symbols-outlined text-[18px]" aria-hidden="true">add</span>
          {creating ? 'جارٍ الإنشاء…' : 'مقترح جديد'}
        </button>
      </header>

      {error && (
        <p
          role="alert"
          className="text-sm rounded-2xl p-3 mb-4"
          style={{
            backgroundColor: 'var(--md-sys-color-error-container)',
            color: 'var(--md-sys-color-on-error-container)',
          }}
        >
          {error}
        </p>
      )}

      {loadingList ? (
        <div className="space-y-3" aria-label="جارٍ التحميل">
          {[0, 1, 2].map((row) => (
            <div
              key={row}
              className="h-28 rounded-3xl animate-pulse"
              style={{ backgroundColor: 'var(--md-sys-color-surface-container)' }}
            />
          ))}
        </div>
      ) : proposals.length === 0 ? (
        <div
          className="rounded-3xl p-10 text-center space-y-2"
          style={{ backgroundColor: 'var(--md-sys-color-surface-container)' }}
        >
          <span
            className="material-symbols-outlined text-[44px]"
            style={{ color: 'var(--md-sys-color-outline)' }}
            aria-hidden="true"
          >
            description
          </span>
          <p className="font-medium" style={{ color: 'var(--md-sys-color-on-surface)' }}>
            لا توجد مقترحات بعد
          </p>
          <p className="text-xs" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>
            ابدأ بمقترح جديد، واحفظه كمسودة ثم قدّمه للإدارة.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {proposals.map((proposal) => {
            const style = STATUS_STYLE[proposal.status] || STATUS_STYLE.draft;
            return (
              <Link
                key={proposal.id}
                href={`/instructor/proposals/${proposal.id}`}
                className="block rounded-3xl p-5 transition-shadow hover:shadow-md"
                style={{
                  backgroundColor: 'var(--md-sys-color-surface-container)',
                  border: '1px solid var(--md-sys-color-outline-variant)',
                }}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="font-bold text-base" style={{ color: 'var(--md-sys-color-on-surface)' }}>
                      {proposal.course_title || 'مقترح بلا عنوان'}
                    </h2>
                    <p className="text-xs mt-1" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>
                      {proposal.submitted_at
                        ? `قُدّم في ${formatDate(proposal.submitted_at)}`
                        : `آخر تحديث ${formatDate(proposal.updated_at)}`}
                    </p>
                  </div>
                  <span
                    className="text-xs px-3 py-1 rounded-full font-medium shrink-0"
                    style={{ backgroundColor: style.bg, color: style.color }}
                  >
                    {proposal.status_label}
                  </span>
                </div>
                {proposal.status === 'needs_changes' && proposal.admin_note && (
                  <p
                    className="text-xs mt-3 rounded-xl p-2.5"
                    style={{
                      backgroundColor: 'var(--md-sys-color-secondary-container)',
                      color: 'var(--md-sys-color-on-secondary-container)',
                    }}
                  >
                    ملاحظة الإدارة: {proposal.admin_note}
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
