'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '../../../../lib/auth';
import { api, downloadFile } from '../../../../lib/api';

interface DayContent {
  day: string;
  topic: string;
  instructor: string;
}

interface Proposal {
  id: number;
  course_title: string;
  instructor_name: string;
  objectives: string[];
  daily_content: DayContent[];
  status: 'draft' | 'submitted' | 'approved' | 'rejected' | 'needs_changes';
  status_label: string;
  admin_note: string;
  course_id: number | null;
  submitted_at: string | null;
  updated_at: string | null;
}

function formatDate(value?: string | null): string {
  if (!value) return '';
  const raw = String(value);
  const iso = raw.includes('T') ? raw : `${raw.replace(' ', 'T')}Z`;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' });
}

const STATUS_HINT: Record<string, string> = {
  submitted: 'المقترح بانتظار مراجعة الإدارة — لا يمكن تعديله الآن.',
  approved: 'تم قبول المقترح، وسيُنشأ الكورس من بياناته بواسطة الإدارة.',
  rejected: 'تم رفض المقترح. تواصل مع الإدارة لمعرفة التفاصيل.',
  needs_changes: 'طلبت الإدارة تعديلات على المقترح. عدّل ثم أعد التقديم.',
};

export default function ProposalEditorPage() {
  const params = useParams();
  const proposalId = Number(Array.isArray(params.id) ? params.id[0] : params.id);
  const router = useRouter();
  const { user, loading } = useAuth();

  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [title, setTitle] = useState('');
  const [objectives, setObjectives] = useState<string[]>([]);
  const [days, setDays] = useState<{ day: string; topic: string }[]>([]);
  const [loadingProposal, setLoadingProposal] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.push('/login');
      return;
    }
    if (user.role !== 'instructor') router.push('/dashboard');
  }, [user, loading, router]);

  const hydrate = useCallback((data: Proposal) => {
    setProposal(data);
    setTitle(data.course_title || '');
    setObjectives(data.objectives.length ? data.objectives : ['']);
    setDays(
      data.daily_content.length
        ? data.daily_content.map((row) => ({ day: row.day, topic: row.topic }))
        : [{ day: '', topic: '' }],
    );
  }, []);

  const load = useCallback(async () => {
    if (!proposalId) return;
    setLoadingProposal(true);
    setError('');
    try {
      const data: Proposal = await api(`/api/instructor/proposals/${proposalId}`);
      hydrate(data);
    } catch (err: any) {
      setError(err?.message || 'تعذّر تحميل المقترح. حاول مرة أخرى.');
    } finally {
      setLoadingProposal(false);
    }
  }, [proposalId, hydrate]);

  useEffect(() => {
    if (!loading && user?.role === 'instructor') void load();
  }, [loading, user, load]);

  const canEdit = proposal?.status === 'draft' || proposal?.status === 'needs_changes';

  const payload = useMemo(
    () => ({
      course_title: title,
      objectives: objectives.map((text) => text.trim()).filter(Boolean),
      daily_content: days
        .map((row) => ({ day: row.day.trim(), topic: row.topic.trim() }))
        .filter((row) => row.day || row.topic),
    }),
    [title, objectives, days],
  );

  const save = async (): Promise<Proposal | null> => {
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const res: any = await api(`/api/instructor/proposals/${proposalId}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
      const next: Proposal = res?.proposal;
      if (next) hydrate(next);
      setNotice('تم حفظ المسودة');
      return next || null;
    } catch (err: any) {
      setError(err?.message || 'تعذّر حفظ المقترح');
      return null;
    } finally {
      setSaving(false);
    }
  };

  const submit = async () => {
    if (submitting) return;
    setSubmitting(true);
    setError('');
    setNotice('');
    try {
      await api(`/api/instructor/proposals/${proposalId}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
      const res: any = await api(`/api/instructor/proposals/${proposalId}/submit`, { method: 'POST' });
      if (res?.proposal) hydrate(res.proposal);
      setNotice('تم تقديم المقترح للإدارة');
    } catch (err: any) {
      setError(err?.message || 'تعذّر تقديم المقترح');
    } finally {
      setSubmitting(false);
    }
  };

  const exportWord = async () => {
    if (exporting) return;
    setExporting(true);
    setError('');
    try {
      await downloadFile(`/api/instructor/proposals/${proposalId}/word`, `proposal-${proposalId}.docx`);
    } catch (err: any) {
      setError(err?.message || 'تعذّر تصدير المقترح');
    } finally {
      setExporting(false);
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

  const inputStyle = {
    backgroundColor: 'var(--md-sys-color-surface)',
    borderColor: 'var(--md-sys-color-outline-variant)',
    color: 'var(--md-sys-color-on-surface)',
  } as const;

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 pb-28">
      <Link
        href="/instructor/proposals"
        className="inline-flex items-center gap-1 text-sm mb-4"
        style={{ color: 'var(--md-sys-color-primary)' }}
      >
        <span className="material-symbols-outlined text-[18px]" aria-hidden="true">arrow_forward</span>
        مقترحاتي
      </Link>

      {loadingProposal ? (
        <div className="space-y-3" aria-label="جارٍ التحميل">
          {[0, 1, 2].map((row) => (
            <div
              key={row}
              className="h-32 rounded-3xl animate-pulse"
              style={{ backgroundColor: 'var(--md-sys-color-surface-container)' }}
            />
          ))}
        </div>
      ) : !proposal ? (
        <div
          className="rounded-3xl p-6 text-center space-y-3"
          style={{ backgroundColor: 'var(--md-sys-color-error-container)' }}
        >
          <p className="text-sm" style={{ color: 'var(--md-sys-color-on-error-container)' }}>
            {error || 'المقترح غير موجود'}
          </p>
          <button
            type="button"
            onClick={() => void load()}
            className="px-5 py-2 rounded-full text-sm font-medium"
            style={{
              backgroundColor: 'var(--md-sys-color-primary)',
              color: 'var(--md-sys-color-on-primary)',
            }}
          >
            إعادة المحاولة
          </button>
        </div>
      ) : (
        <div className="space-y-5">
          <header>
            <p className="text-xs" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>
              وزارة التعليم العالي — المعهد العالي للعلوم الإدارية بالقطامية
            </p>
            <h1 className="text-xl font-bold mt-1" style={{ color: 'var(--md-sys-color-on-surface)' }}>
              مقترح دورة تدريبية
            </h1>
            <div className="flex flex-wrap items-center gap-2 mt-2">
              <span
                className="text-xs px-3 py-1 rounded-full font-medium"
                style={{
                  backgroundColor: 'var(--md-sys-color-primary-container)',
                  color: 'var(--md-sys-color-on-primary-container)',
                }}
              >
                {proposal.status_label}
              </span>
              <span className="text-xs" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>
                المحاضر: {proposal.instructor_name}
                {proposal.submitted_at ? ` · قُدّم في ${formatDate(proposal.submitted_at)}` : ''}
              </span>
            </div>
          </header>

          {proposal.status === 'needs_changes' && proposal.admin_note && (
            <div
              className="rounded-2xl p-4 text-sm"
              style={{
                backgroundColor: 'var(--md-sys-color-secondary-container)',
                color: 'var(--md-sys-color-on-secondary-container)',
              }}
            >
              <span className="font-medium block mb-1">ملاحظة الإدارة</span>
              {proposal.admin_note}
            </div>
          )}

          {STATUS_HINT[proposal.status] && (
            <p
              className="text-xs rounded-2xl p-3"
              style={{
                backgroundColor: proposal.status === 'rejected'
                  ? 'var(--md-sys-color-error-container)'
                  : 'var(--md-sys-color-surface-container)',
                color: proposal.status === 'rejected'
                  ? 'var(--md-sys-color-on-error-container)'
                  : 'var(--md-sys-color-on-surface-variant)',
              }}
            >
              {STATUS_HINT[proposal.status]}
            </p>
          )}

          <section
            className="rounded-3xl p-4 sm:p-5 space-y-3"
            style={{
              backgroundColor: 'var(--md-sys-color-surface-container)',
              border: '1px solid var(--md-sys-color-outline-variant)',
            }}
          >
            <h2 className="font-bold text-sm" style={{ color: 'var(--md-sys-color-on-surface)' }}>
              اسم الدورة
            </h2>
            <input
              type="text"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              disabled={!canEdit}
              maxLength={200}
              placeholder="اسم الدورة المقترح"
              className="w-full px-4 py-2.5 rounded-xl border text-sm disabled:opacity-70"
              style={inputStyle}
            />
          </section>

          <section
            className="rounded-3xl p-4 sm:p-5 space-y-3"
            style={{
              backgroundColor: 'var(--md-sys-color-surface-container)',
              border: '1px solid var(--md-sys-color-outline-variant)',
            }}
          >
            <div>
              <h2 className="font-bold text-sm" style={{ color: 'var(--md-sys-color-on-surface)' }}>
                أهداف الدورة التدريبية
              </h2>
              <p className="text-xs mt-1" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>
                في نهاية الدورة التدريبية سوف يكون المتدرب قادراً على:
              </p>
            </div>
            {objectives.map((objective, index) => (
              <div key={index} className="flex items-start gap-2">
                <span
                  className="text-sm pt-2.5 shrink-0"
                  style={{ color: 'var(--md-sys-color-on-surface-variant)' }}
                >
                  •
                </span>
                <textarea
                  value={objective}
                  onChange={(event) => {
                    const next = [...objectives];
                    next[index] = event.target.value;
                    setObjectives(next);
                  }}
                  disabled={!canEdit}
                  rows={2}
                  maxLength={500}
                  placeholder="هدف من أهداف الدورة"
                  className="flex-1 px-4 py-2.5 rounded-xl border text-sm resize-y disabled:opacity-70"
                  style={inputStyle}
                />
                {canEdit && objectives.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setObjectives(objectives.filter((_, i) => i !== index))}
                    aria-label="حذف الهدف"
                    className="min-h-[42px] min-w-[42px] rounded-xl text-sm"
                    style={{
                      backgroundColor: 'var(--md-sys-color-error-container)',
                      color: 'var(--md-sys-color-on-error-container)',
                    }}
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
            {canEdit && objectives.length < 40 && (
              <button
                type="button"
                onClick={() => setObjectives([...objectives, ''])}
                className="text-xs font-medium px-4 py-2 rounded-full"
                style={{
                  backgroundColor: 'var(--md-sys-color-secondary-container)',
                  color: 'var(--md-sys-color-on-secondary-container)',
                }}
              >
                + إضافة هدف
              </button>
            )}
          </section>

          <section
            className="rounded-3xl p-4 sm:p-5 space-y-3"
            style={{
              backgroundColor: 'var(--md-sys-color-surface-container)',
              border: '1px solid var(--md-sys-color-outline-variant)',
            }}
          >
            <div>
              <h2 className="font-bold text-sm" style={{ color: 'var(--md-sys-color-on-surface)' }}>
                المحتوى العلمي
              </h2>
              <p className="text-xs mt-1" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>
                مقسّم يوماً بيوم — اسم المحاضر يُملأ تلقائياً باسمك.
              </p>
            </div>
            {days.map((row, index) => (
              <div
                key={index}
                className="rounded-2xl p-3 space-y-2"
                style={{ backgroundColor: 'var(--md-sys-color-surface)' }}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>
                    اليوم {index + 1}
                  </span>
                  {canEdit && days.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setDays(days.filter((_, i) => i !== index))}
                      aria-label={`حذف اليوم ${index + 1}`}
                      className="text-xs px-3 py-1 rounded-full"
                      style={{
                        backgroundColor: 'var(--md-sys-color-error-container)',
                        color: 'var(--md-sys-color-on-error-container)',
                      }}
                    >
                      حذف
                    </button>
                  )}
                </div>
                <input
                  type="text"
                  value={row.day}
                  onChange={(event) => {
                    const next = [...days];
                    next[index] = { ...next[index], day: event.target.value };
                    setDays(next);
                  }}
                  disabled={!canEdit}
                  maxLength={120}
                  placeholder="اسم اليوم (مثال: اليوم الأول)"
                  className="w-full px-4 py-2.5 rounded-xl border text-sm disabled:opacity-70"
                  style={inputStyle}
                />
                <textarea
                  value={row.topic}
                  onChange={(event) => {
                    const next = [...days];
                    next[index] = { ...next[index], topic: event.target.value };
                    setDays(next);
                  }}
                  disabled={!canEdit}
                  rows={3}
                  maxLength={2000}
                  placeholder="موضوعات اليوم"
                  className="w-full px-4 py-2.5 rounded-xl border text-sm resize-y disabled:opacity-70"
                  style={inputStyle}
                />
                <p className="text-[11px]" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>
                  المحاضر: {proposal.instructor_name}
                </p>
              </div>
            ))}
            {canEdit && days.length < 60 && (
              <button
                type="button"
                onClick={() => setDays([...days, { day: '', topic: '' }])}
                className="text-xs font-medium px-4 py-2 rounded-full"
                style={{
                  backgroundColor: 'var(--md-sys-color-secondary-container)',
                  color: 'var(--md-sys-color-on-secondary-container)',
                }}
              >
                + إضافة يوم
              </button>
            )}
          </section>

          {error && (
            <p
              role="alert"
              className="text-sm rounded-2xl p-3"
              style={{
                backgroundColor: 'var(--md-sys-color-error-container)',
                color: 'var(--md-sys-color-on-error-container)',
              }}
            >
              {error}
            </p>
          )}
          {notice && (
            <p
              className="text-sm rounded-2xl p-3"
              style={{
                backgroundColor: 'var(--md-sys-color-tertiary-container)',
                color: 'var(--md-sys-color-on-tertiary-container)',
              }}
            >
              {notice}
            </p>
          )}

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void exportWord()}
              disabled={exporting}
              className="inline-flex items-center gap-1.5 min-h-[46px] px-5 rounded-full text-sm font-medium disabled:opacity-60"
              style={{
                backgroundColor: 'var(--md-sys-color-secondary-container)',
                color: 'var(--md-sys-color-on-secondary-container)',
              }}
            >
              <span className="material-symbols-outlined text-[18px]" aria-hidden="true">download</span>
              {exporting ? 'جارٍ التصدير…' : 'تصدير Word'}
            </button>
          </div>
        </div>
      )}

      {proposal?.status === 'draft' || proposal?.status === 'needs_changes' ? (
        <div
          className="fixed bottom-0 inset-x-0 border-t px-4 py-3"
          style={{
            backgroundColor: 'var(--md-sys-color-surface)',
            borderColor: 'var(--md-sys-color-outline-variant)',
          }}
        >
          <div className="max-w-3xl mx-auto w-full flex gap-2">
            <button
              type="button"
              onClick={() => void save()}
              disabled={saving || submitting}
              className="flex-1 min-h-[46px] rounded-full text-sm font-medium disabled:opacity-60"
              style={{
                backgroundColor: 'var(--md-sys-color-secondary-container)',
                color: 'var(--md-sys-color-on-secondary-container)',
              }}
            >
              {saving ? 'جارٍ الحفظ…' : 'حفظ كمسودة'}
            </button>
            <button
              type="button"
              onClick={() => void submit()}
              disabled={saving || submitting}
              className="flex-1 min-h-[46px] rounded-full text-sm font-medium disabled:opacity-60"
              style={{
                backgroundColor: 'var(--md-sys-color-primary)',
                color: 'var(--md-sys-color-on-primary)',
              }}
            >
              {submitting ? 'جارٍ التقديم…' : 'تقديم للإدارة'}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
