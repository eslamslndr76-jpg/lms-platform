'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { api, downloadFile } from '../../../lib/api';
import { useToast } from '../../../components/Toast';
import ConfirmDialog from '../../../components/ConfirmDialog';
import { compressAndEncode } from '../../../lib/imageUtils';

interface DayContent {
  day: string;
  topic: string;
  instructor: string;
}

interface Proposal {
  id: number;
  instructor_user_id: number;
  instructor_name: string;
  course_title: string;
  objectives: string[];
  daily_content: DayContent[];
  materials_url: string;
  status: 'draft' | 'submitted' | 'approved' | 'rejected' | 'needs_changes';
  status_label: string;
  admin_note: string;
  course_id: number | null;
  submitted_at: string | null;
  reviewed_at: string | null;
  updated_at: string | null;
}

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  draft: { bg: 'var(--md-sys-color-surface-container-highest)', color: 'var(--md-sys-color-on-surface-variant)' },
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
  return date.toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' });
}

const emptyCourseForm = {
  title_ar: '',
  title_en: '',
  category_id: '',
  course_mode: 'online',
  price: 0,
  max_students: 30,
  lecture_count: 0,
  lecture_duration: 0,
  description: '',
  introduction: '',
  target_audience: '',
  image_url: '',
  materials_url: '',
  is_active: 1,
};

export default function ProposalDetailPage() {
  const params = useParams();
  const proposalId = Number(Array.isArray(params.id) ? params.id[0] : params.id);
  const router = useRouter();
  const { toast } = useToast();

  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [title, setTitle] = useState('');
  const [objectives, setObjectives] = useState<string[]>([]);
  const [days, setDays] = useState<{ day: string; topic: string }[]>([]);
  const [materialsUrl, setMaterialsUrl] = useState('');
  const [savingContent, setSavingContent] = useState(false);

  const [note, setNote] = useState('');
  const [reviewing, setReviewing] = useState<'approve' | 'reject' | 'needs_changes' | null>(null);
  const [confirmAction, setConfirmAction] = useState<'approve' | 'reject' | null>(null);
  const [exporting, setExporting] = useState(false);

  const [courseForm, setCourseForm] = useState(emptyCourseForm);
  const [creatingCourse, setCreatingCourse] = useState(false);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [data, cats] = await Promise.all([
        api(`/api/admin/proposals/${proposalId}`),
        api('/api/categories').catch(() => []),
      ]);
      const next: Proposal = data;
      setProposal(next);
      setTitle(next.course_title || '');
      setObjectives(next.objectives.length ? next.objectives : ['']);
      setDays(
        next.daily_content.length
          ? next.daily_content.map((row) => ({ day: row.day, topic: row.topic }))
          : [{ day: '', topic: '' }],
      );
      setNote(next.admin_note || '');
      setMaterialsUrl(next.materials_url || '');
      setCourseForm({
        ...emptyCourseForm,
        title_ar: next.course_title,
        title_en: next.course_title,
        lecture_count: next.daily_content.length || 0,
        materials_url: next.materials_url || '',
      });
      setCategories(Array.isArray(cats) ? cats : []);
    } catch (err: any) {
      setError(err?.message || 'فشل تحميل المقترح');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (proposalId) void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proposalId]);

  const editable = proposal?.status !== 'approved';

  const payload = useMemo(
    () => ({
      course_title: title,
      objectives: objectives.map((text) => text.trim()).filter(Boolean),
      daily_content: days
        .map((row) => ({ day: row.day.trim(), topic: row.topic.trim() }))
        .filter((row) => row.day || row.topic),
      materials_url: materialsUrl.trim(),
    }),
    [title, objectives, days, materialsUrl],
  );

  const saveContent = async () => {
    setSavingContent(true);
    try {
      const res: any = await api(`/api/admin/proposals/${proposalId}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
      if (res?.proposal) setProposal(res.proposal);
      toast('تم حفظ بيانات المقترح', 'success');
    } catch (err: any) {
      toast(err?.message || 'فشل حفظ المقترح', 'error');
    } finally {
      setSavingContent(false);
    }
  };

  const review = async (action: 'approve' | 'reject' | 'needs_changes') => {
    if (action === 'needs_changes' && !note.trim()) {
      toast('اكتب ملاحظة توضح المطلوب تعديله', 'error');
      return;
    }
    setReviewing(action);
    try {
      await api(`/api/admin/proposals/${proposalId}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
      const res: any = await api(`/api/admin/proposals/${proposalId}/review`, {
        method: 'POST',
        body: JSON.stringify({ action, note }),
      });
      if (res?.proposal) {
        setProposal(res.proposal);
        setNote(res.proposal.admin_note || '');
      }
      toast(
        action === 'approve' ? 'تم قبول المقترح' : action === 'reject' ? 'تم رفض المقترح' : 'أُرسلت الملاحظة للمحاضر',
        'success',
      );
    } catch (err: any) {
      toast(err?.message || 'فشل تنفيذ الإجراء', 'error');
    } finally {
      setReviewing(null);
      setConfirmAction(null);
    }
  };

  const exportWord = async () => {
    setExporting(true);
    try {
      await downloadFile(`/api/admin/proposals/${proposalId}/word`, `proposal-${proposalId}.docx`);
    } catch (err: any) {
      toast(err?.message || 'فشل تصدير المقترح', 'error');
    } finally {
      setExporting(false);
    }
  };

  const createCourse = async () => {
    if (!courseForm.title_ar.trim()) {
      toast('اسم الدورة مطلوب', 'error');
      return;
    }
    if (!courseForm.title_en.trim()) {
      toast('الاسم الإنجليزي مطلوب', 'error');
      return;
    }
    setCreatingCourse(true);
    try {
      const res: any = await api(`/api/admin/proposals/${proposalId}/create-course`, {
        method: 'POST',
        body: JSON.stringify({
          title_en: courseForm.title_en,
          price: Number(courseForm.price) || 0,
          category_id: courseForm.category_id ? Number(courseForm.category_id) : null,
          course_mode: courseForm.course_mode,
          max_students: Number(courseForm.max_students) || 30,
          lecture_count: Number(courseForm.lecture_count) || 0,
          lecture_duration: Number(courseForm.lecture_duration) || 0,
          description: courseForm.description,
          introduction: courseForm.introduction,
          target_audience: courseForm.target_audience,
          image_url: courseForm.image_url,
          materials_url: courseForm.materials_url,
          is_active: courseForm.is_active,
        }),
      });
      const courseId = res?.course?.id;
      toast('تم إنشاء الكورس من المقترح', 'success');
      if (courseId) router.push(`/courses/${courseId}`);
      else void load();
    } catch (err: any) {
      toast(err?.message || 'فشل إنشاء الكورس', 'error');
    } finally {
      setCreatingCourse(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-3">
        {[0, 1, 2].map((row) => (
          <div key={row} className="h-32 md3-card md3-card--filled animate-pulse" />
        ))}
      </div>
    );
  }

  if (error || !proposal) {
    return (
      <div className="md3-card md3-card--outlined p-6 text-center space-y-3">
        <p className="text-sm text-error">{error || 'المقترح غير موجود'}</p>
        <button
          onClick={() => void load()}
          className="md3-btn md3-btn--filled"
        >
          إعادة المحاولة
        </button>
      </div>
    );
  }

  const colors = STATUS_COLORS[proposal.status] || STATUS_COLORS.draft;

  return (
    <div className="space-y-5 pb-10">
      <Link href="/proposals" className="md3-btn md3-btn--text inline-flex w-fit">
        <span className="material-symbols-outlined text-[18px]" aria-hidden>arrow_forward</span>
        مقترحات الكورسات
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-on-surface">
            {proposal.course_title || 'مقترح بلا عنوان'}
          </h1>
          <p className="text-sm mt-1 text-on-surface-variant">
            المحاضر: {proposal.instructor_name}
            {proposal.submitted_at ? ` · قُدّم في ${formatDate(proposal.submitted_at)}` : ''}
            {proposal.reviewed_at ? ` · روجع في ${formatDate(proposal.reviewed_at)}` : ''}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span
            className="text-xs px-3 py-1 rounded-full font-medium"
            style={{ backgroundColor: colors.bg, color: colors.color }}
          >
            {proposal.status_label}
          </span>
          <button
            onClick={() => void exportWord()}
            disabled={exporting}
            className="md3-btn md3-btn--outlined"
          >
            {exporting ? 'جارٍ التصدير…' : '⬇️ تصدير Word'}
          </button>
        </div>
      </div>

      {proposal.status === 'approved' && proposal.course_id && (
        <div className="rounded-md3-sm p-3 text-sm" style={{ backgroundColor: 'var(--md-sys-color-success-container)', color: 'var(--md-sys-color-on-success-container)' }}>
          ✅ أُنشئ كورس من هذا المقترح —{' '}
          <Link href={`/courses/${proposal.course_id}`} className="underline font-medium">
            فتح الكورس #{proposal.course_id}
          </Link>
        </div>
      )}

      {/* ── Review actions ── */}
      {proposal.status !== 'approved' && (
        <section className="md3-card md3-card--outlined p-5 space-y-3">
          <h2 className="text-base font-semibold text-on-surface">قرار المراجعة</h2>
          <textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            rows={2}
            maxLength={2000}
            placeholder="ملاحظة للمحاضر (مطلوبة عند طلب التعديل)"
            className="md3-field"
          />
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setConfirmAction('approve')}
              disabled={reviewing !== null}
              className="md3-btn md3-btn--filled"
            >
              ✅ قبول المقترح
            </button>
            <button
              onClick={() => void review('needs_changes')}
              disabled={reviewing !== null}
              className="md3-btn md3-btn--tonal"
            >
              ✏️ طلب تعديل
            </button>
            <button
              onClick={() => setConfirmAction('reject')}
              disabled={reviewing !== null}
              className="md3-btn md3-btn--outlined text-error"
            >
              ✖️ رفض
            </button>
          </div>
        </section>
      )}

      {/* ── Content ── */}
      <section className="md3-card md3-card--outlined p-5 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-semibold text-on-surface">بيانات المقترح</h2>
          {editable && (
            <button
              onClick={() => void saveContent()}
              disabled={savingContent}
              className="md3-btn md3-btn--filled text-xs"
            >
              {savingContent ? 'جارٍ الحفظ…' : 'حفظ التعديلات'}
            </button>
          )}
        </div>

        <div>
          <label className="block text-sm mb-1 text-on-surface-variant">اسم الدورة</label>
          <input
            type="text"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            disabled={!editable}
            maxLength={200}
            className="md3-field"
          />
        </div>

        <div>
          <p className="text-sm mb-1 text-on-surface-variant">
            أهداف الدورة — في نهاية الدورة التدريبية سوف يكون المتدرب قادراً على:
          </p>
          {objectives.map((objective, index) => (
            <div key={index} className="flex items-start gap-2 mb-2">
              <textarea
                value={objective}
                onChange={(event) => {
                  const next = [...objectives];
                  next[index] = event.target.value;
                  setObjectives(next);
                }}
                disabled={!editable}
                rows={2}
                maxLength={500}
                className="md3-field flex-1"
              />
              {editable && objectives.length > 1 && (
                <button
                  onClick={() => setObjectives(objectives.filter((_, i) => i !== index))}
                  className="md3-btn md3-btn--icon text-xs text-error"
                  style={{ backgroundColor: 'var(--md-sys-color-error-container)', color: 'var(--md-sys-color-on-error-container)' }}
                  aria-label="حذف الهدف"
                >
                  ✕
                </button>
              )}
            </div>
          ))}
          {editable && objectives.length < 40 && (
            <button
              onClick={() => setObjectives([...objectives, ''])}
              className="md3-btn md3-btn--outlined text-xs"
            >
              + إضافة هدف
            </button>
          )}
        </div>

        <div>
          <p className="text-sm mb-1 text-on-surface-variant">المحتوى العلمي (يوماً بيوم)</p>
          {days.map((row, index) => (
            <div key={index} className="rounded-md3-md p-3 mb-2 space-y-2 bg-surface-container-low">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-on-surface-variant">اليوم {index + 1}</span>
                {editable && days.length > 1 && (
                  <button
                    onClick={() => setDays(days.filter((_, i) => i !== index))}
                    className="md3-btn md3-btn--text text-xs text-error"
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
                disabled={!editable}
                maxLength={120}
                placeholder="اسم اليوم"
                className="md3-field"
              />
              <textarea
                value={row.topic}
                onChange={(event) => {
                  const next = [...days];
                  next[index] = { ...next[index], topic: event.target.value };
                  setDays(next);
                }}
                disabled={!editable}
                rows={3}
                maxLength={2000}
                placeholder="موضوعات اليوم"
                className="md3-field"
              />
              <p className="text-xs text-on-surface-variant">
                المحاضر: {proposal.instructor_name}
              </p>
            </div>
          ))}
          {editable && days.length < 60 && (
            <button
              onClick={() => setDays([...days, { day: '', topic: '' }])}
              className="md3-btn md3-btn--outlined text-xs"
            >
              + إضافة يوم
            </button>
          )}
        </div>

        <div>
          <p className="text-sm mb-1 text-on-surface-variant">المادة العلمية (رابط)</p>
          <input
            type="url"
            dir="ltr"
            value={materialsUrl}
            onChange={(event) => setMaterialsUrl(event.target.value)}
            disabled={!editable}
            maxLength={1000}
            placeholder="https://drive.google.com/file/d/..."
            className="md3-field"
          />
          <p className="text-xs mt-1 text-on-surface-variant">
            رابط Google Drive أو PDF للمادة التي سيشرح منها المحاضر (للملفات الأكبر من 20 ميجا).
          </p>
          {proposal.materials_url && (
            <a
              href={proposal.materials_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block text-xs mt-1 text-primary"
            >
              فتح الرابط المحفوظ ↗
            </a>
          )}
        </div>
      </section>

      {/* ── Create course from an approved proposal ── */}
      {proposal.status === 'approved' && !proposal.course_id && (
        <section className="md3-card md3-card--outlined p-5 space-y-3">
          <div>
            <h2 className="text-base font-semibold text-on-surface">إنشاء كورس من المقترح</h2>
            <p className="text-xs mt-1 text-on-surface-variant">
              الاسم والأهداف والمحتوى اليومي تنتقل تلقائياً — أكمل باقي البيانات ثم أنشئ الكورس.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm mb-1 text-on-surface-variant">الاسم بالعربية</label>
              <input
                type="text"
                value={courseForm.title_ar}
                onChange={(event) => setCourseForm({ ...courseForm, title_ar: event.target.value })}
                className="md3-field"
              />
            </div>
            <div>
              <label className="block text-sm mb-1 text-on-surface-variant">الاسم بالإنجليزية</label>
              <input
                type="text"
                value={courseForm.title_en}
                onChange={(event) => setCourseForm({ ...courseForm, title_en: event.target.value })}
                className="md3-field"
              />
            </div>
            <div>
              <label className="block text-sm mb-1 text-on-surface-variant">التصنيف</label>
              <select
                value={courseForm.category_id}
                onChange={(event) => setCourseForm({ ...courseForm, category_id: event.target.value })}
                className="md3-field"
              >
                <option value="">بدون تصنيف</option>
                {categories.map((category: any) => (
                  <option key={category.id} value={category.id}>{category.name_ar}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm mb-1 text-on-surface-variant">طريقة الحضور</label>
              <select
                value={courseForm.course_mode}
                onChange={(event) => setCourseForm({ ...courseForm, course_mode: event.target.value })}
                className="md3-field"
              >
                <option value="online">أونلاين</option>
                <option value="offline">أوفلاين</option>
              </select>
            </div>
            <div>
              <label className="block text-sm mb-1 text-on-surface-variant">السعر</label>
              <input
                type="number"
                min={0}
                value={courseForm.price}
                onChange={(event) => setCourseForm({ ...courseForm, price: Number(event.target.value) })}
                className="md3-field"
              />
            </div>
            <div>
              <label className="block text-sm mb-1 text-on-surface-variant">الحد الأقصى للطلاب</label>
              <input
                type="number"
                min={1}
                value={courseForm.max_students}
                onChange={(event) => setCourseForm({ ...courseForm, max_students: Number(event.target.value) })}
                className="md3-field"
              />
            </div>
            <div>
              <label className="block text-sm mb-1 text-on-surface-variant">عدد المحاضرات</label>
              <input
                type="number"
                min={0}
                value={courseForm.lecture_count}
                onChange={(event) => setCourseForm({ ...courseForm, lecture_count: Number(event.target.value) })}
                className="md3-field"
              />
            </div>
            <div>
              <label className="block text-sm mb-1 text-on-surface-variant">مدة المحاضرة (ساعة)</label>
              <input
                type="number"
                min={0}
                step={0.5}
                value={courseForm.lecture_duration}
                onChange={(event) => setCourseForm({ ...courseForm, lecture_duration: Number(event.target.value) })}
                className="md3-field"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm mb-1 text-on-surface-variant">وصف مختصر</label>
              <textarea
                value={courseForm.description}
                onChange={(event) => setCourseForm({ ...courseForm, description: event.target.value })}
                rows={3}
                className="md3-field"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm mb-1 text-on-surface-variant">مقدمة الكورس</label>
              <textarea
                value={courseForm.introduction}
                onChange={(event) => setCourseForm({ ...courseForm, introduction: event.target.value })}
                rows={3}
                className="md3-field"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm mb-1 text-on-surface-variant">الفئة المستهدفة</label>
              <textarea
                value={courseForm.target_audience}
                onChange={(event) => setCourseForm({ ...courseForm, target_audience: event.target.value })}
                rows={2}
                className="md3-field"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm mb-1 text-on-surface-variant">صورة الكورس</label>
              <input
                type="file"
                accept="image/*"
                onChange={async (event) => {
                  const file = event.target.files?.[0];
                  if (file) {
                    const dataUrl = await compressAndEncode(file);
                    setCourseForm((current) => ({ ...current, image_url: dataUrl }));
                  }
                }}
                className="w-full text-sm text-on-surface"
              />
              {courseForm.image_url && (
                <img src={courseForm.image_url} alt="معاينة" className="mt-2 h-20 rounded-md3-sm object-cover" />
              )}
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm mb-1 text-on-surface-variant">رابط المادة العلمية</label>
              <input
                type="url"
                dir="ltr"
                value={courseForm.materials_url}
                onChange={(event) => setCourseForm({ ...courseForm, materials_url: event.target.value })}
                maxLength={500}
                placeholder="https://drive.google.com/file/d/..."
                className="md3-field"
              />
            </div>
            <label className="flex items-center gap-2 text-sm text-on-surface min-h-[40px] cursor-pointer">
              <input
                type="checkbox"
                className="w-5 h-5 cursor-pointer"
                style={{ accentColor: 'var(--md-sys-color-primary)' }}
                checked={courseForm.is_active === 1}
                onChange={(event) => setCourseForm({ ...courseForm, is_active: event.target.checked ? 1 : 0 })}
              />
              نشر الكورس مباشرة
            </label>
          </div>
          <button
            onClick={() => void createCourse()}
            disabled={creatingCourse}
            className="md3-btn md3-btn--filled"
          >
            {creatingCourse ? 'جارٍ الإنشاء…' : 'إنشاء الكورس'}
          </button>
        </section>
      )}

      <ConfirmDialog
        open={confirmAction === 'approve'}
        title="قبول المقترح"
        message={`سيُقبل مقترح «${proposal.course_title}» ويتوقف تعديل المحاضر له. هل تريد المتابعة؟`}
        confirmLabel="قبول"
        variant="info"
        loading={reviewing === 'approve'}
        onConfirm={() => void review('approve')}
        onCancel={() => setConfirmAction(null)}
      />
      <ConfirmDialog
        open={confirmAction === 'reject'}
        title="رفض المقترح"
        message={`سيُرفض مقترح «${proposal.course_title}» ويصل إشعار للمحاضر.`}
        confirmLabel="رفض"
        variant="danger"
        loading={reviewing === 'reject'}
        onConfirm={() => void review('reject')}
        onCancel={() => setConfirmAction(null)}
      />
    </div>
  );
}
