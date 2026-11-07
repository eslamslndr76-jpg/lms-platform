'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '../../../../lib/api';

/* ────────────────────────── Types ────────────────────────── */

interface ScaleOption { value: number; label: string }
interface SurveyItem { key: string; label: string }
interface SurveySection { key: string; title: string; items: SurveyItem[] }

interface SurveyResponse {
  status: 'draft' | 'submitted';
  is_anonymous: boolean;
  answers: Record<string, any>;
  current_step: number;
  updated_at: string | null;
  submitted_at: string | null;
}

interface Survey {
  available: boolean;
  status: 'not_open' | 'closed' | 'submitted' | 'draft' | 'pending';
  can_edit: boolean;
  is_closed: boolean;
  closes_at: string | null;
  days_left: number;
  group: {
    id: number;
    name: string;
    course_id: number;
    course_title: string;
    course_mode: string;
    instructor_name: string;
    place_name: string | null;
    location: string | null;
    start_date: string | null;
    end_date: string | null;
    completed_at: string | null;
    lecture_count: number;
    lecture_duration: number;
  };
  student: { name: string };
  sections: SurveySection[];
  helped: SurveyItem;
  notes_label: string;
  scale: ScaleOption[];
  settings: { openDays: number };
  response: SurveyResponse | null;
}

/* ────────────────────────── Helpers ────────────────────────── */

function parseDate(value?: string | null): Date | null {
  if (!value) return null;
  const raw = String(value).trim();
  if (!raw) return null;
  const iso = raw.includes('T') ? raw : `${raw.replace(' ', 'T')}Z`;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

function formatDate(value?: string | null): string {
  const d = parseDate(value);
  if (!d) return '—';
  return d.toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' });
}

function formatDuration(survey: Survey): string {
  const hours = survey.group.lecture_duration;
  const lectures = survey.group.lecture_count;
  if (hours && hours > 0) {
    return `${hours % 1 === 0 ? hours : hours.toFixed(1)} ساعة${lectures ? ` · ${lectures} محاضرة` : ''}`;
  }
  return lectures ? `${lectures} محاضرة` : '—';
}

const STEP_TITLES = ['بيانات البرنامج', 'تقييم المحاضر', 'تقييم البرنامج', 'رأيك والملاحظات'];

/* ────────────────────────── Page ────────────────────────── */

export default function SurveyPage() {
  const params = useParams();
  const router = useRouter();
  const groupId = params?.groupId as string | undefined;

  const [survey, setSurvey] = useState<Survey | null>(null);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string>('');
  const [saveError, setSaveError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const hydrated = useRef(false);
  const dirty = useRef(false);

  const load = async () => {
    if (!groupId) return;
    setLoading(true);
    setError('');
    try {
      const data: Survey = await api(`/api/surveys/my/${groupId}`);
      setSurvey(data);
      if (data.response) {
        setAnswers(data.response.answers || {});
        setIsAnonymous(!data.response.is_anonymous);
        setStep(Math.min(3, Math.max(0, Number(data.response.current_step) || 0)));
      } else {
        setAnswers({});
        setIsAnonymous(true); // «إظهار اسمي وبياناتي للإدارة» مفعّل افتراضياً
        setStep(0);
      }
      hydrated.current = true;
      dirty.current = false;
    } catch (err: any) {
      setError(err?.message || 'تعذر تحميل الاستبيان');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId]);

  /* ── Auto-save (debounced) ── */
  useEffect(() => {
    if (!hydrated.current || !dirty.current || !survey || !groupId) return;
    if (survey.status !== 'draft' && survey.status !== 'pending') return;

    const timer = setTimeout(async () => {
      setSaving(true);
      setSaveError('');
      try {
        await api(`/api/surveys/my/${groupId}/draft`, {
          method: 'PUT',
          body: JSON.stringify({ answers, is_anonymous: !isAnonymous, current_step: step }),
        });
        setSavedAt(new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }));
      } catch (err: any) {
        setSaveError(err?.message || 'تعذر الحفظ التلقائي');
      } finally {
        setSaving(false);
      }
    }, 800);

    return () => clearTimeout(timer);
  }, [answers, isAnonymous, step, survey, groupId]);

  const setAnswer = (key: string, value: any) => {
    dirty.current = true;
    setAnswers(prev => ({ ...prev, [key]: value }));
  };

  const changeAnonymous = (value: boolean) => {
    dirty.current = true;
    setIsAnonymous(value);
  };

  const goToStep = (next: number) => {
    dirty.current = true;
    setStep(next);
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  /* ── Progress ── */
  const ratingItems = useMemo(
    () => (survey ? survey.sections.flatMap(s => s.items) : []),
    [survey],
  );
  const totalRequired = ratingItems.length + 1; // + سؤال «هل ساعدك؟»
  const answeredCount = useMemo(() => {
    const rated = ratingItems.filter(item => answers[item.key]).length;
    const helped = answers.helped_develop ? 1 : 0;
    return rated + helped;
  }, [answers, ratingItems]);
  const progress = totalRequired > 0 ? Math.round((answeredCount / totalRequired) * 100) : 0;

  const submit = async () => {
    if (!groupId || !survey) return;
    setSubmitting(true);
    setSubmitError('');
    try {
      await api(`/api/surveys/my/${groupId}/submit`, {
        method: 'POST',
        body: JSON.stringify({ answers, is_anonymous: !isAnonymous }),
      });
      dirty.current = false;
      await load();
    } catch (err: any) {
      setSubmitError(err?.message || 'تعذر إرسال الاستبيان');
    } finally {
      setSubmitting(false);
    }
  };

  /* ── Loading / error ── */
  if (loading) {
    return (
      <div className="max-w-2xl mx-auto space-y-4 animate-pulse">
        <div className="h-8 w-48 rounded-md3-sm" style={{ backgroundColor: 'var(--md-sys-color-surface-container-high)' }} />
        <div className="h-40 rounded-md3-lg" style={{ backgroundColor: 'var(--md-sys-color-surface-container)' }} />
        <div className="h-64 rounded-md3-lg" style={{ backgroundColor: 'var(--md-sys-color-surface-container)' }} />
      </div>
    );
  }

  if (error || !survey) {
    return (
      <div className="max-w-xl mx-auto text-center py-16 px-4">
        <span className="material-symbols-outlined text-[56px] mb-3" style={{ color: 'var(--md-sys-color-error)' }}>error</span>
        <p className="font-bold mb-1" style={{ color: 'var(--md-sys-color-on-surface)' }}>تعذر تحميل الاستبيان</p>
        <p className="text-sm mb-6" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>{error || 'رابط غير صالح'}</p>
        <div className="flex items-center justify-center gap-3">
          <button onClick={load} className="h-11 px-5 rounded-full text-sm font-medium"
            style={{ backgroundColor: 'var(--md-sys-color-primary)', color: 'var(--md-sys-color-on-primary)' }}>
            إعادة المحاولة
          </button>
          <Link href="/dashboard" className="h-11 px-5 rounded-full text-sm font-medium inline-flex items-center border"
            style={{ borderColor: 'var(--md-sys-color-outline-variant)', color: 'var(--md-sys-color-on-surface)' }}>
            الرئيسية
          </Link>
        </div>
      </div>
    );
  }

  /* ── Not available yet ── */
  if (survey.status === 'not_open') {
    return (
      <StateCard
        icon="hourglass_top"
        title="الاستبيان لم يُفتح بعد"
        text="يُفتح استبيان تقييم الدورة بعد إنهاء المجموعة رسمياً. ستجده في صفحتك الرئيسية."
      />
    );
  }

  /* ── Closed ── */
  if (survey.status === 'closed') {
    return (
      <StateCard
        icon="lock_clock"
        title="أُغلق الاستبيان"
        text={`انتهت مدة الاستبيان (${survey.settings.openDays} يوماً بعد الإنهاء). تواصل مع الإدارة إن كنت تريد فرصة أخرى.`}
      />
    );
  }

  /* ── Submitted ── */
  if (survey.status === 'submitted') {
    return (
      <div className="max-w-xl mx-auto text-center py-12 px-4">
        <div className="w-20 h-20 mx-auto rounded-full flex items-center justify-center mb-4"
          style={{ backgroundColor: 'var(--md-sys-color-primary-container)' }}>
          <span className="material-symbols-outlined text-[40px]" style={{ color: 'var(--md-sys-color-on-primary-container)' }}>task_alt</span>
        </div>
        <h1 className="text-2xl font-bold mb-2" style={{ color: 'var(--md-sys-color-on-surface)' }}>شكراً لك!</h1>
        <p className="text-sm mb-1" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>
          تم إرسال إجابتك في {formatDate(survey.response?.submitted_at || undefined)}.
        </p>
        <p className="text-sm mb-8" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>
          إجابة واحدة لكل طالب، ولا يمكن تعديلها بعد الإرسال.
        </p>
        <Link href="/dashboard" className="inline-flex items-center gap-2 h-12 px-6 rounded-full text-sm font-medium"
          style={{ backgroundColor: 'var(--md-sys-color-primary)', color: 'var(--md-sys-color-on-primary)' }}>
          <span className="material-symbols-outlined text-[18px]">home</span> العودة للرئيسية
        </Link>
      </div>
    );
  }

  /* ── Form ── */
  const g = survey.group;
  const place = g.place_name || g.location;

  return (
    <div className="max-w-2xl mx-auto pb-28">
      {/* Header */}
      <div className="mb-4">
        <Link href="/dashboard" className="inline-flex items-center gap-1 text-sm mb-2"
          style={{ color: 'var(--md-sys-color-primary)' }}>
          <span className="material-symbols-outlined text-[18px]">arrow_forward</span> الرئيسية
        </Link>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--md-sys-color-on-surface)' }}>قيّم دورتك</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>
          {g.course_title} · {g.name}
        </p>
        <p className="text-xs mt-2 flex items-center gap-1" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>
          <span className="material-symbols-outlined text-[14px]">schedule</span>
          يستغرق نحو دقيقتين · يتبقى {survey.days_left} يوماً للإجابة
        </p>
      </div>

      {/* Progress */}
      <div className="sticky top-0 z-10 py-3 -mx-1 px-1" style={{ backgroundColor: 'var(--md-sys-color-surface)' }}>
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs font-medium" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>
            الخطوة {step + 1} من 4 · {STEP_TITLES[step]}
          </span>
          <span className="text-xs font-bold" style={{ color: 'var(--md-sys-color-primary)' }}>{progress}%</span>
        </div>
        <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--md-sys-color-surface-container-highest)' }}>
          <div className="h-full rounded-full transition-all duration-500"
            style={{ width: `${Math.max(progress, 4)}%`, backgroundColor: 'var(--md-sys-color-primary)' }} />
        </div>
        <div className="flex items-center justify-between mt-1.5 h-4">
          <span className="text-[11px]" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>
            {saving ? 'جاري الحفظ…' : savedAt ? `تم الحفظ التلقائي ${savedAt}` : 'يُحفظ تلقائياً أثناء الكتابة'}
          </span>
          {saveError && <span className="text-[11px]" style={{ color: 'var(--md-sys-color-error)' }}>{saveError}</span>}
        </div>
      </div>

      {/* Step 0 — read-only data + anonymity */}
      {step === 0 && (
        <section className="space-y-3 animate-fade-in">
          <div className="rounded-md3-lg p-4" style={{ backgroundColor: 'var(--md-sys-color-surface-container)' }}>
            <h2 className="font-bold mb-3 flex items-center gap-2" style={{ color: 'var(--md-sys-color-on-surface)' }}>
              <span className="material-symbols-outlined text-[20px]" style={{ color: 'var(--md-sys-color-primary)' }}>badge</span>
              بياناتك وبيانات البرنامج
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <InfoRow icon="person" label="الاسم" value={survey.student.name || '—'} />
              <InfoRow icon="menu_book" label="البرنامج" value={g.course_title || '—'} />
              <InfoRow icon="event" label="تاريخ الانعقاد"
                value={`${formatDate(g.start_date)}${g.end_date ? ` — ${formatDate(g.end_date)}` : ''}`} />
              <InfoRow icon="timer" label="المدة" value={formatDuration(survey)} />
              {g.course_mode === 'offline' && place && (
                <InfoRow icon="location_on" label="المكان" value={place} />
              )}
            </div>
            <p className="text-[11px] mt-3 flex items-start gap-1" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>
              <span className="material-symbols-outlined text-[14px]">info</span>
              هذه البيانات للقراءة فقط ويُعبأها النظام تلقائياً — لا حاجة لكتابتها.
            </p>
          </div>

          <button type="button" onClick={() => changeAnonymous(!isAnonymous)}
            className="w-full rounded-md3-lg p-4 flex items-center justify-between gap-4 text-right transition-colors"
            style={{ backgroundColor: 'var(--md-sys-color-surface-container)' }}>
            <span className="flex items-start gap-3">
              <span className="material-symbols-outlined text-[22px] mt-0.5"
                style={{ color: isAnonymous ? 'var(--md-sys-color-primary)' : 'var(--md-sys-color-on-surface-variant)' }}>
                {isAnonymous ? 'visibility' : 'visibility_off'}
              </span>
              <span>
                <span className="block font-bold text-sm" style={{ color: 'var(--md-sys-color-on-surface)' }}>
                  إظهار اسمي وبياناتي للإدارة
                </span>
                <span className="block text-xs mt-1" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>
                  {isAnonymous
                    ? 'مفعّل — سترى الإدارة اسمك بجانب ردودك.'
                    : 'مُطفأ — سترى الإدارة الردود دون اسمك. المحاضر لا يرى اسمك ولا النتائج في الحالتين.'}
                </span>
              </span>
            </span>
            <span className="relative w-12 h-7 rounded-full shrink-0 transition-colors"
              style={{ backgroundColor: isAnonymous ? 'var(--md-sys-color-primary)' : 'var(--md-sys-color-surface-container-highest)' }}>
              <span className="absolute top-1 w-5 h-5 rounded-full bg-white transition-all"
                style={{ right: isAnonymous ? '4px' : '26px' }} />
            </span>
          </button>

          <div className="rounded-md3-lg p-4 text-sm" style={{ backgroundColor: 'var(--md-sys-color-secondary-container)', color: 'var(--md-sys-color-on-secondary-container)' }}>
            <p className="font-bold mb-1">المشاركة اختيارية</p>
            <p className="text-xs leading-relaxed">
              الاستبيان غير إجباري ولا يؤثر على شهادتك. يمكنك التوقف في أي وقت — تُحفظ إجاباتك تلقائياً وتكمل من حيث توقفت.
            </p>
          </div>

          <NavButtons
            onNext={() => goToStep(1)}
            onLater={() => router.push('/dashboard')}
          />
        </section>
      )}

      {/* Step 1 & 2 — rating sections */}
      {step > 0 && step < 3 && (() => {
        const section = survey.sections[step - 1];
        if (!section) return null;
        return (
          <section className="space-y-3 animate-fade-in">
            <div className="rounded-md3-lg p-4" style={{ backgroundColor: 'var(--md-sys-color-surface-container)' }}>
              <h2 className="font-bold mb-1 flex items-center gap-2" style={{ color: 'var(--md-sys-color-on-surface)' }}>
                <span className="material-symbols-outlined text-[20px]" style={{ color: 'var(--md-sys-color-primary)' }}>
                  {section.key === 'lecturer' ? 'co_present' : 'school'}
                </span>
                {section.title}
              </h2>
              <p className="text-xs mb-4" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>
                اختر التقييم المناسب لكل بند
              </p>
              <div className="space-y-5">
                {section.items.map((item, idx) => (
                  <RatingRow
                    key={item.key}
                    index={idx + 1}
                    item={item}
                    scale={survey.scale}
                    value={Number(answers[item.key]) || 0}
                    onChange={value => setAnswer(item.key, value)}
                  />
                ))}
              </div>
            </div>
            <NavButtons
              onBack={() => goToStep(step - 1)}
              onNext={() => goToStep(step + 1)}
              onLater={() => router.push('/dashboard')}
            />
          </section>
        );
      })()}

      {/* Step 3 — general info + notes + review */}
      {step === 3 && (
        <section className="space-y-3 animate-fade-in">
          <div className="rounded-md3-lg p-4" style={{ backgroundColor: 'var(--md-sys-color-surface-container)' }}>
            <h2 className="font-bold mb-3 flex items-center gap-2" style={{ color: 'var(--md-sys-color-on-surface)' }}>
              <span className="material-symbols-outlined text-[20px]" style={{ color: 'var(--md-sys-color-primary)' }}>quiz</span>
              ثالثاً: معلومات عامة
            </h2>
            <p className="text-sm font-medium mb-3" style={{ color: 'var(--md-sys-color-on-surface)' }}>{survey.helped.label}</p>
            <div className="grid grid-cols-2 gap-2">
              {[
                { value: 'yes', label: 'نعم', icon: 'thumb_up' },
                { value: 'no', label: 'لا', icon: 'thumb_down' },
              ].map(option => {
                const selected = answers.helped_develop === option.value;
                return (
                  <button key={option.value} type="button" onClick={() => setAnswer('helped_develop', option.value)}
                    aria-pressed={selected}
                    className="h-14 rounded-md3-md flex items-center justify-center gap-2 text-sm font-bold border transition-all"
                    style={{
                      backgroundColor: selected ? 'var(--md-sys-color-primary-container)' : 'transparent',
                      color: selected ? 'var(--md-sys-color-on-primary-container)' : 'var(--md-sys-color-on-surface)',
                      borderColor: selected ? 'var(--md-sys-color-primary)' : 'var(--md-sys-color-outline-variant)',
                    }}>
                    <span className="material-symbols-outlined text-[20px]">{option.icon}</span>
                    {option.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="rounded-md3-lg p-4" style={{ backgroundColor: 'var(--md-sys-color-surface-container)' }}>
            <h2 className="font-bold mb-1 flex items-center gap-2" style={{ color: 'var(--md-sys-color-on-surface)' }}>
              <span className="material-symbols-outlined text-[20px]" style={{ color: 'var(--md-sys-color-primary)' }}>edit_note</span>
              {survey.notes_label}
            </h2>
            <p className="text-xs mb-3" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>اختياري — أي اقتراح يساعدنا على التحسين</p>
            <textarea
              value={answers.notes || ''}
              onChange={e => setAnswer('notes', e.target.value)}
              rows={5}
              maxLength={4000}
              placeholder="اكتب ملاحظاتك هنا…"
              className="w-full rounded-md3-md p-3 text-sm resize-y outline-none border focus:border-[var(--md-sys-color-primary)]"
              style={{
                backgroundColor: 'var(--md-sys-color-surface-container-low)',
                borderColor: 'var(--md-sys-color-outline-variant)',
                color: 'var(--md-sys-color-on-surface)',
              }}
            />
            <p className="text-[11px] text-left mt-1" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>
              {(answers.notes || '').length}/4000
            </p>
          </div>

          <div className="rounded-md3-lg p-4" style={{ backgroundColor: 'var(--md-sys-color-surface-container-low)' }}>
            <div className="flex items-center justify-between text-sm mb-2">
              <span style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>البنود المكتملة</span>
              <span className="font-bold" style={{ color: 'var(--md-sys-color-primary)' }}>{answeredCount} من {totalRequired}</span>
            </div>
            {answeredCount < totalRequired && (
              <p className="text-xs flex items-start gap-1" style={{ color: 'var(--md-sys-color-error)' }}>
                <span className="material-symbols-outlined text-[14px]">error</span>
                أكمل جميع بنود التقييم وسؤال «هل ساعدك؟» قبل الإرسال. يمكنك الرجوع للخطوات السابقة.
              </p>
            )}
            {submitError && (
              <p className="text-xs mt-2 px-3 py-2 rounded-md3-sm" style={{ backgroundColor: 'var(--md-sys-color-error-container)', color: 'var(--md-sys-color-on-error-container)' }}>
                {submitError}
              </p>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button type="button" onClick={() => goToStep(2)}
              className="h-12 px-5 rounded-full text-sm font-medium border"
              style={{ borderColor: 'var(--md-sys-color-outline-variant)', color: 'var(--md-sys-color-on-surface)' }}>
              السابق
            </button>
            <button type="button" onClick={submit} disabled={submitting || answeredCount < totalRequired}
              className="flex-1 h-12 rounded-full text-sm font-bold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              style={{ backgroundColor: 'var(--md-sys-color-primary)', color: 'var(--md-sys-color-on-primary)' }}>
              <span className="material-symbols-outlined text-[18px]">{submitting ? 'progress_activity' : 'send'}</span>
              {submitting ? 'جاري الإرسال…' : 'إرسال الإجابة'}
            </button>
          </div>
          <p className="text-[11px] text-center pb-4" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>
            بعد الإرسال لا يمكن تعديل الإجابة — إجابة واحدة لكل طالب.
          </p>
        </section>
      )}
    </div>
  );
}

/* ────────────────────────── Sub-components ────────────────────────── */

function InfoRow({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div className="rounded-md3-sm p-3" style={{ backgroundColor: 'var(--md-sys-color-surface-container-low)' }}>
      <span className="flex items-center gap-1 text-[11px] mb-1" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>
        <span className="material-symbols-outlined text-[13px]">{icon}</span> {label}
      </span>
      <span className="text-sm font-medium break-words" style={{ color: 'var(--md-sys-color-on-surface)' }}>{value}</span>
    </div>
  );
}

function RatingRow({
  index, item, scale, value, onChange,
}: {
  index: number;
  item: SurveyItem;
  scale: ScaleOption[];
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <div>
      <p className="text-sm font-medium mb-2 flex items-start gap-1.5" style={{ color: 'var(--md-sys-color-on-surface)' }}>
        <span className="w-5 h-5 rounded-full text-[11px] font-bold flex items-center justify-center shrink-0 mt-0.5"
          style={{ backgroundColor: 'var(--md-sys-color-surface-container-highest)', color: 'var(--md-sys-color-on-surface-variant)' }}>
          {index}
        </span>
        {item.label}
      </p>
      <div className="grid grid-cols-5 gap-1.5">
        {scale.map(option => {
          const selected = value === option.value;
          return (
            <button key={option.value} type="button" onClick={() => onChange(option.value)}
              aria-pressed={selected}
              className="rounded-md3-sm py-2 flex flex-col items-center gap-0.5 border transition-all min-h-[52px]"
              style={{
                backgroundColor: selected ? 'var(--md-sys-color-primary)' : 'var(--md-sys-color-surface-container-low)',
                borderColor: selected ? 'var(--md-sys-color-primary)' : 'var(--md-sys-color-outline-variant)',
                color: selected ? 'var(--md-sys-color-on-primary)' : 'var(--md-sys-color-on-surface)',
              }}>
              <span className="text-sm font-bold leading-none">{option.value}</span>
              <span className="text-[9px] leading-tight text-center px-0.5 opacity-90">{option.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function NavButtons({
  onBack, onNext, onLater,
}: { onBack?: () => void; onNext: () => void; onLater: () => void }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        {onBack && (
          <button type="button" onClick={onBack}
            className="h-12 px-5 rounded-full text-sm font-medium border"
            style={{ borderColor: 'var(--md-sys-color-outline-variant)', color: 'var(--md-sys-color-on-surface)' }}>
            السابق
          </button>
        )}
        <button type="button" onClick={onNext}
          className="flex-1 h-12 rounded-full text-sm font-bold flex items-center justify-center gap-2"
          style={{ backgroundColor: 'var(--md-sys-color-primary)', color: 'var(--md-sys-color-on-primary)' }}>
          التالي
          <span className="material-symbols-outlined text-[18px]">arrow_back</span>
        </button>
      </div>
      <button type="button" onClick={onLater}
        className="w-full h-10 rounded-full text-xs font-medium"
        style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>
        لاحقاً — تُحفظ إجاباتي
      </button>
    </div>
  );
}

function StateCard({ icon, title, text }: { icon: string; title: string; text: string }) {
  return (
    <div className="max-w-xl mx-auto text-center py-16 px-4">
      <span className="material-symbols-outlined text-[56px] mb-3" style={{ color: 'var(--md-sys-color-outline)' }}>{icon}</span>
      <h1 className="text-xl font-bold mb-2" style={{ color: 'var(--md-sys-color-on-surface)' }}>{title}</h1>
      <p className="text-sm mb-8 leading-relaxed" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>{text}</p>
      <Link href="/dashboard" className="inline-flex items-center gap-2 h-12 px-6 rounded-full text-sm font-medium"
        style={{ backgroundColor: 'var(--md-sys-color-primary)', color: 'var(--md-sys-color-on-primary)' }}>
        <span className="material-symbols-outlined text-[18px]">home</span> العودة للرئيسية
      </Link>
    </div>
  );
}
