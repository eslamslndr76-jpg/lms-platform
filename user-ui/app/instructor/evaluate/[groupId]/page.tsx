'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '../../../../lib/auth';
import { api } from '../../../../lib/api';

interface EvalQuestion {
  key: string;
  label: string;
}

interface EvalStudent {
  id: number;
  name: string;
  scores: (number | null)[];
  total: number | null;
  complete: boolean;
}

interface Evaluation {
  group: {
    id: number;
    name: string;
    course_title: string;
    course_mode: string;
    completed_at: string | null;
    eval_opened_at: string | null;
    start_date: string | null;
    instructor_name: string;
    place_name: string;
  };
  questions: EvalQuestion[];
  scale: { value: number; label: string }[];
  students: EvalStudent[];
  status: 'not_open' | 'draft' | 'submitted';
  submitted_at: string | null;
  students_count: number;
  completed_count: number;
  can_edit: boolean;
}

type ScoreMap = Record<number, (number | null)[]>;

function formatDate(value?: string | null): string {
  if (!value) return '';
  const raw = String(value);
  const iso = raw.includes('T') ? raw : `${raw.replace(' ', 'T')}Z`;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' });
}

function groupMetaLine(evaluation: Evaluation): string {
  return [
    evaluation.group.instructor_name ? `المدرّب: ${evaluation.group.instructor_name}` : '',
    evaluation.group.start_date ? `تاريخ التدريب: ${formatDate(evaluation.group.start_date)}` : '',
    evaluation.group.course_mode === 'offline'
      ? evaluation.group.place_name
        ? `المكان: ${evaluation.group.place_name}`
        : ''
      : 'أونلاين',
  ]
    .filter(Boolean)
    .join(' · ');
}

function toScoreMap(evaluation: Evaluation): ScoreMap {
  const map: ScoreMap = {};
  for (const student of evaluation.students) {
    map[student.id] = evaluation.questions.map((_, index) => student.scores[index] ?? null);
  }
  return map;
}

function isStudentComplete(scores?: (number | null)[]): boolean {
  return !!scores && scores.length > 0 && scores.every((score) => score != null);
}

function totalOf(scores?: (number | null)[]): number | null {
  if (!scores || !scores.every((score) => score != null)) return null;
  return scores.reduce((sum, score) => sum + Number(score), 0);
}

export default function InstructorEvaluationPage() {
  const params = useParams();
  const groupId = Number(Array.isArray(params.groupId) ? params.groupId[0] : params.groupId);
  const router = useRouter();
  const { user, loading } = useAuth();

  const [evaluation, setEvaluation] = useState<Evaluation | null>(null);
  const [scores, setScores] = useState<ScoreMap>({});
  const [loadingEval, setLoadingEval] = useState(true);
  const [error, setError] = useState('');
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [submitError, setSubmitError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const hydrated = useRef(false);
  const dirty = useRef(false);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.push('/login');
      return;
    }
    if (user.role !== 'instructor') router.push('/dashboard');
  }, [user, loading, router]);

  const load = useCallback(async () => {
    if (!groupId) return;
    setLoadingEval(true);
    setError('');
    try {
      const data: Evaluation = await api(`/api/instructor/groups/${groupId}/evaluation`);
      setEvaluation(data);
      setScores(toScoreMap(data));
      hydrated.current = true;
      dirty.current = false;
    } catch (err: any) {
      setError(err?.message || 'تعذّر تحميل تقييم الطلاب. حاول مرة أخرى.');
    } finally {
      setLoadingEval(false);
    }
  }, [groupId]);

  useEffect(() => {
    if (!loading && user?.role === 'instructor') void load();
  }, [loading, user, load]);

  const canEdit = evaluation?.status === 'draft' && evaluation.can_edit;

  // Auto-save the draft shortly after each change (never after submission).
  useEffect(() => {
    if (!canEdit || !hydrated.current || !dirty.current) return;
    setSaveState('saving');
    const timer = setTimeout(async () => {
      try {
        await api(`/api/instructor/groups/${groupId}/evaluation/draft`, {
          method: 'PUT',
          body: JSON.stringify({ scores }),
        });
        dirty.current = false;
        setSaveState('saved');
      } catch {
        setSaveState('idle');
      }
    }, 1200);
    return () => clearTimeout(timer);
  }, [scores, canEdit, groupId]);

  const setScore = (studentId: number, questionIndex: number, value: number) => {
    if (!canEdit) return;
    setSubmitError('');
    dirty.current = true;
    setScores((current) => {
      const row = [...(current[studentId] || [])];
      row[questionIndex] = value;
      return { ...current, [studentId]: row };
    });
  };

  const saveDraft = async () => {
    if (!canEdit || saveState === 'saving') return;
    setSaveState('saving');
    try {
      await api(`/api/instructor/groups/${groupId}/evaluation/draft`, {
        method: 'PUT',
        body: JSON.stringify({ scores }),
      });
      dirty.current = false;
      setSaveState('saved');
    } catch (err: any) {
      setSaveState('idle');
      setSubmitError(err?.message || 'تعذّر حفظ المسودة');
    }
  };

  const submit = async () => {
    if (!canEdit || submitting) return;
    setSubmitError('');
    setSubmitting(true);
    try {
      const res: any = await api(`/api/instructor/groups/${groupId}/evaluation/submit`, {
        method: 'POST',
        body: JSON.stringify({ scores }),
      });
      const next: Evaluation | undefined = res?.evaluation;
      if (next) {
        setEvaluation(next);
        setScores(toScoreMap(next));
        dirty.current = false;
      }
      setSaveState('saved');
    } catch (err: any) {
      setSubmitError(err?.message || 'تعذّر إرسال التقييم');
    } finally {
      setSubmitting(false);
    }
  };

  const completedCount = useMemo(
    () => Object.values(scores).filter((row) => isStudentComplete(row)).length,
    [scores],
  );
  const allComplete =
    !!evaluation && evaluation.students.length > 0 && completedCount === evaluation.students.length;

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
    <div className="max-w-4xl mx-auto px-4 py-6 pb-28">
      <Link
        href="/instructor"
        className="inline-flex items-center gap-1 text-sm mb-4"
        style={{ color: 'var(--md-sys-color-primary)' }}
      >
        <span className="material-symbols-outlined text-[18px]" aria-hidden="true">arrow_forward</span>
        مجموعاتي
      </Link>

      {loadingEval ? (
        <div className="space-y-3" aria-label="جارٍ التحميل">
          {[0, 1, 2].map((row) => (
            <div
              key={row}
              className="h-40 rounded-3xl animate-pulse"
              style={{ backgroundColor: 'var(--md-sys-color-surface-container)' }}
            />
          ))}
        </div>
      ) : error ? (
        <div
          className="rounded-3xl p-6 text-center space-y-3"
          style={{ backgroundColor: 'var(--md-sys-color-error-container)' }}
        >
          <p className="text-sm" style={{ color: 'var(--md-sys-color-on-error-container)' }}>{error}</p>
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
      ) : evaluation ? (
        <div className="space-y-5">
          <header>
            <h1 className="text-xl font-bold" style={{ color: 'var(--md-sys-color-on-surface)' }}>
              تقييم الطلاب — {evaluation.group.name}
            </h1>
            <p className="text-sm mt-1" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>
              {evaluation.group.course_title}
              {evaluation.group.completed_at ? ` · انتهت في ${formatDate(evaluation.group.completed_at)}` : ''}
            </p>
            {groupMetaLine(evaluation) && (
              <p className="text-xs mt-1" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>
                {groupMetaLine(evaluation)}
              </p>
            )}
            <p className="text-xs mt-2" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>
              سجل سلوكي فقط لا يؤثر على الشهادة.
            </p>
          </header>

          {evaluation.status === 'not_open' && (
            <div
              className="rounded-3xl p-6 text-center text-sm"
              style={{ backgroundColor: 'var(--md-sys-color-surface-container)' }}
            >
              يُفتح التقييم بعد إنهاء المجموعة من الإدارة.
            </div>
          )}

          {evaluation.status === 'submitted' && (
            <div
              className="rounded-3xl p-6 text-center space-y-1"
              style={{ backgroundColor: 'var(--md-sys-color-tertiary-container)' }}
            >
              <p className="font-medium" style={{ color: 'var(--md-sys-color-on-tertiary-container)' }}>
                تم إرسال التقييم
              </p>
              <p className="text-xs" style={{ color: 'var(--md-sys-color-on-tertiary-container)' }}>
                {evaluation.submitted_at ? formatDate(evaluation.submitted_at) : ''}
                {' — '}
                للتصحيح تواصل مع الإدارة.
              </p>
            </div>
          )}

          {evaluation.status === 'draft' && evaluation.students.length === 0 && (
            <div
              className="rounded-3xl p-6 text-center text-sm"
              style={{ backgroundColor: 'var(--md-sys-color-surface-container)' }}
            >
              لا يوجد طلاب في هذه المجموعة.
            </div>
          )}

          {evaluation.status === 'draft' && evaluation.students.length > 0 && (
            <>
              <div
                className="rounded-2xl p-4 flex items-center justify-between gap-3 text-sm"
                style={{ backgroundColor: 'var(--md-sys-color-surface-container)' }}
              >
                <span style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>
                  {completedCount} من {evaluation.students.length} طالب مكتمل
                </span>
                <span className="text-xs" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>
                  {saveState === 'saving' ? 'جارٍ الحفظ…' : saveState === 'saved' ? 'تم حفظ المسودة' : ''}
                </span>
              </div>

              <div className="space-y-4">
                {evaluation.students.map((student, index) => {
                  const row = scores[student.id] || [];
                  const complete = isStudentComplete(row);
                  const total = totalOf(row);
                  return (
                    <article
                      key={student.id}
                      className="rounded-3xl p-4 sm:p-5"
                      style={{
                        backgroundColor: 'var(--md-sys-color-surface-container)',
                        border: '1px solid var(--md-sys-color-outline-variant)',
                      }}
                    >
                      <div className="flex items-center justify-between gap-3 mb-3">
                        <h2 className="font-bold text-sm" style={{ color: 'var(--md-sys-color-on-surface)' }}>
                          {index + 1}. {student.name}
                        </h2>
                        <span
                          className="text-xs px-3 py-1 rounded-full font-medium shrink-0"
                          style={{
                            backgroundColor: complete
                              ? 'var(--md-sys-color-primary-container)'
                              : 'var(--md-sys-color-surface-container-high)',
                            color: complete
                              ? 'var(--md-sys-color-on-primary-container)'
                              : 'var(--md-sys-color-on-surface-variant)',
                          }}
                        >
                          {complete ? `${total} / 20` : 'غير مكتمل'}
                        </span>
                      </div>

                      <div className="space-y-3">
                        {evaluation.questions.map((question, questionIndex) => (
                          <div key={question.key}>
                            <p className="text-xs mb-1.5" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>
                              {question.label}
                            </p>
                            <div className="grid grid-cols-5 gap-1.5" role="group" aria-label={question.label}>
                              {evaluation.scale.map((option) => {
                                const selected = row[questionIndex] === option.value;
                                return (
                                  <button
                                    key={option.value}
                                    type="button"
                                    disabled={!canEdit}
                                    aria-pressed={selected}
                                    onClick={() => setScore(student.id, questionIndex, option.value)}
                                    className="min-h-[42px] rounded-xl text-[11px] font-medium transition-colors disabled:opacity-60"
                                    style={{
                                      backgroundColor: selected
                                        ? 'var(--md-sys-color-primary)'
                                        : 'var(--md-sys-color-surface-container-high)',
                                      color: selected
                                        ? 'var(--md-sys-color-on-primary)'
                                        : 'var(--md-sys-color-on-surface-variant)',
                                    }}
                                  >
                                    {option.label}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    </article>
                  );
                })}
              </div>
            </>
          )}

          {submitError && (
            <p
              className="text-sm rounded-2xl p-3"
              role="alert"
              style={{
                backgroundColor: 'var(--md-sys-color-error-container)',
                color: 'var(--md-sys-color-on-error-container)',
              }}
            >
              {submitError}
            </p>
          )}

          {evaluation.status === 'draft' && evaluation.students.length > 0 && (
            <div
              className="fixed bottom-0 inset-x-0 border-t px-4 py-3 flex gap-2"
              style={{
                backgroundColor: 'var(--md-sys-color-surface)',
                borderColor: 'var(--md-sys-color-outline-variant)',
              }}
            >
              <div className="max-w-4xl mx-auto w-full flex gap-2">
                <button
                  type="button"
                  onClick={() => void saveDraft()}
                  disabled={!canEdit || saveState === 'saving'}
                  className="flex-1 min-h-[46px] rounded-full text-sm font-medium disabled:opacity-60"
                  style={{
                    backgroundColor: 'var(--md-sys-color-secondary-container)',
                    color: 'var(--md-sys-color-on-secondary-container)',
                  }}
                >
                  حفظ كمسودة
                </button>
                <button
                  type="button"
                  onClick={() => void submit()}
                  disabled={!canEdit || submitting || !allComplete}
                  className="flex-1 min-h-[46px] rounded-full text-sm font-medium disabled:opacity-50"
                  style={{
                    backgroundColor: 'var(--md-sys-color-primary)',
                    color: 'var(--md-sys-color-on-primary)',
                  }}
                >
                  {submitting ? 'جارٍ الإرسال…' : 'إرسال التقييم'}
                </button>
              </div>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
