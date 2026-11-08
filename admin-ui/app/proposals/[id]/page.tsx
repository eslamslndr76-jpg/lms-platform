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
  draft: { bg: 'var(--bg)', color: 'var(--text-muted)' },
  submitted: { bg: '#dbeafe', color: '#1e40af' },
  approved: { bg: '#dcfce7', color: '#166534' },
  rejected: { bg: '#fee2e2', color: '#991b1b' },
  needs_changes: { bg: '#fef3c7', color: '#92400e' },
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
          <div key={row} className="h-32 rounded-2xl animate-pulse" style={{ backgroundColor: 'var(--card)' }} />
        ))}
      </div>
    );
  }

  if (error || !proposal) {
    return (
      <div className="rounded-2xl p-6 text-center space-y-3" style={{ backgroundColor: 'var(--card)' }}>
        <p className="text-sm" style={{ color: '#991b1b' }}>{error || 'المقترح غير موجود'}</p>
        <button
          onClick={() => void load()}
          className="px-5 py-2 rounded-xl text-sm font-medium text-white"
          style={{ backgroundColor: 'var(--primary)' }}
        >
          إعادة المحاولة
        </button>
      </div>
    );
  }

  const colors = STATUS_COLORS[proposal.status] || STATUS_COLORS.draft;
  const inputStyle = {
    backgroundColor: 'var(--bg)',
    borderColor: 'var(--border)',
    color: 'var(--text)',
  } as const;

  return (
    <div className="space-y-5 pb-10">
      <Link href="/proposals" className="text-sm inline-flex items-center gap-1" style={{ color: 'var(--primary)' }}>
        ← مقترحات الكورسات
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>
            {proposal.course_title || 'مقترح بلا عنوان'}
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
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
            className="px-4 py-2 rounded-xl text-sm font-medium border disabled:opacity-50"
            style={{ borderColor: 'var(--border)', color: 'var(--text)' }}
          >
            {exporting ? 'جارٍ التصدير…' : '⬇️ تصدير Word'}
          </button>
        </div>
      </div>

      {proposal.status === 'approved' && proposal.course_id && (
        <div className="rounded-xl p-3 text-sm" style={{ backgroundColor: '#dcfce7', color: '#166534' }}>
          ✅ أُنشئ كورس من هذا المقترح —{' '}
          <Link href={`/courses/${proposal.course_id}`} className="underline font-medium">
            فتح الكورس #{proposal.course_id}
          </Link>
        </div>
      )}

      {/* ── Review actions ── */}
      {proposal.status !== 'approved' && (
        <section className="rounded-2xl p-4 space-y-3" style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)' }}>
          <h2 className="font-bold" style={{ color: 'var(--text)' }}>قرار المراجعة</h2>
          <textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            rows={2}
            maxLength={2000}
            placeholder="ملاحظة للمحاضر (مطلوبة عند طلب التعديل)"
            className="w-full px-4 py-2.5 rounded-xl border text-sm resize-y"
            style={inputStyle}
          />
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setConfirmAction('approve')}
              disabled={reviewing !== null}
              className="px-4 py-2 rounded-xl text-sm font-medium text-white disabled:opacity-50"
              style={{ backgroundColor: '#15803d' }}
            >
              ✅ قبول المقترح
            </button>
            <button
              onClick={() => void review('needs_changes')}
              disabled={reviewing !== null}
              className="px-4 py-2 rounded-xl text-sm font-medium disabled:opacity-50"
              style={{ backgroundColor: '#fef3c7', color: '#92400e' }}
            >
              ✏️ طلب تعديل
            </button>
            <button
              onClick={() => setConfirmAction('reject')}
              disabled={reviewing !== null}
              className="px-4 py-2 rounded-xl text-sm font-medium disabled:opacity-50"
              style={{ backgroundColor: '#fee2e2', color: '#991b1b' }}
            >
              ✖️ رفض
            </button>
          </div>
        </section>
      )}

      {/* ── Content ── */}
      <section className="rounded-2xl p-4 space-y-3" style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)' }}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-bold" style={{ color: 'var(--text)' }}>بيانات المقترح</h2>
          {editable && (
            <button
              onClick={() => void saveContent()}
              disabled={savingContent}
              className="px-4 py-1.5 rounded-xl text-xs font-medium text-white disabled:opacity-50"
              style={{ backgroundColor: 'var(--primary)' }}
            >
              {savingContent ? 'جارٍ الحفظ…' : 'حفظ التعديلات'}
            </button>
          )}
        </div>

        <div>
          <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>اسم الدورة</label>
          <input
            type="text"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            disabled={!editable}
            maxLength={200}
            className="w-full px-4 py-2.5 rounded-xl border text-sm disabled:opacity-70"
            style={inputStyle}
          />
        </div>

        <div>
          <p className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>
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
                className="flex-1 px-4 py-2 rounded-xl border text-sm resize-y disabled:opacity-70"
                style={inputStyle}
              />
              {editable && objectives.length > 1 && (
                <button
                  onClick={() => setObjectives(objectives.filter((_, i) => i !== index))}
                  className="px-3 py-2 rounded-xl text-xs"
                  style={{ backgroundColor: '#fee2e2', color: '#991b1b' }}
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
              className="text-xs px-3 py-1.5 rounded-lg border"
              style={{ borderColor: 'var(--border)', color: 'var(--text)' }}
            >
              + إضافة هدف
            </button>
          )}
        </div>

        <div>
          <p className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>المحتوى العلمي (يوماً بيوم)</p>
          {days.map((row, index) => (
            <div key={index} className="rounded-xl p-3 mb-2 space-y-2" style={{ backgroundColor: 'var(--bg)' }}>
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>اليوم {index + 1}</span>
                {editable && days.length > 1 && (
                  <button
                    onClick={() => setDays(days.filter((_, i) => i !== index))}
                    className="text-xs px-2 py-1 rounded-lg"
                    style={{ backgroundColor: '#fee2e2', color: '#991b1b' }}
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
                className="w-full px-3 py-2 rounded-xl border text-sm disabled:opacity-70"
                style={inputStyle}
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
                className="w-full px-3 py-2 rounded-xl border text-sm resize-y disabled:opacity-70"
                style={inputStyle}
              />
              <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                المحاضر: {proposal.instructor_name}
              </p>
            </div>
          ))}
          {editable && days.length < 60 && (
            <button
              onClick={() => setDays([...days, { day: '', topic: '' }])}
              className="text-xs px-3 py-1.5 rounded-lg border"
              style={{ borderColor: 'var(--border)', color: 'var(--text)' }}
            >
              + إضافة يوم
            </button>
          )}
        </div>

        <div>
          <p className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>المادة العلمية (رابط)</p>
          <input
            type="url"
            dir="ltr"
            value={materialsUrl}
            onChange={(event) => setMaterialsUrl(event.target.value)}
            disabled={!editable}
            maxLength={1000}
            placeholder="https://drive.google.com/file/d/..."
            className="w-full px-4 py-2.5 rounded-xl border text-sm text-left disabled:opacity-70"
            style={inputStyle}
          />
          <p className="text-[11px] mt-1" style={{ color: 'var(--text-muted)' }}>
            رابط Google Drive أو PDF للمادة التي سيشرح منها المحاضر (للملفات الأكبر من 20 ميجا).
          </p>
          {proposal.materials_url && (
            <a
              href={proposal.materials_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block text-xs mt-1"
              style={{ color: 'var(--primary)' }}
            >
              فتح الرابط المحفوظ ↗
            </a>
          )}
        </div>
      </section>

      {/* ── Create course from an approved proposal ── */}
      {proposal.status === 'approved' && !proposal.course_id && (
        <section className="rounded-2xl p-4 space-y-3" style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)' }}>
          <div>
            <h2 className="font-bold" style={{ color: 'var(--text)' }}>إنشاء كورس من المقترح</h2>
            <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
              الاسم والأهداف والمحتوى اليومي تنتقل تلقائياً — أكمل باقي البيانات ثم أنشئ الكورس.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>الاسم بالعربية</label>
              <input
                type="text"
                value={courseForm.title_ar}
                onChange={(event) => setCourseForm({ ...courseForm, title_ar: event.target.value })}
                className="w-full px-4 py-2.5 rounded-xl border text-sm"
                style={inputStyle}
              />
            </div>
            <div>
              <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>الاسم بالإنجليزية</label>
              <input
                type="text"
                value={courseForm.title_en}
                onChange={(event) => setCourseForm({ ...courseForm, title_en: event.target.value })}
                className="w-full px-4 py-2.5 rounded-xl border text-sm"
                style={inputStyle}
              />
            </div>
            <div>
              <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>التصنيف</label>
              <select
                value={courseForm.category_id}
                onChange={(event) => setCourseForm({ ...courseForm, category_id: event.target.value })}
                className="w-full px-4 py-2.5 rounded-xl border text-sm"
                style={inputStyle}
              >
                <option value="">بدون تصنيف</option>
                {categories.map((category: any) => (
                  <option key={category.id} value={category.id}>{category.name_ar}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>طريقة الحضور</label>
              <select
                value={courseForm.course_mode}
                onChange={(event) => setCourseForm({ ...courseForm, course_mode: event.target.value })}
                className="w-full px-4 py-2.5 rounded-xl border text-sm"
                style={inputStyle}
              >
                <option value="online">أونلاين</option>
                <option value="offline">أوفلاين</option>
              </select>
            </div>
            <div>
              <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>السعر</label>
              <input
                type="number"
                min={0}
                value={courseForm.price}
                onChange={(event) => setCourseForm({ ...courseForm, price: Number(event.target.value) })}
                className="w-full px-4 py-2.5 rounded-xl border text-sm"
                style={inputStyle}
              />
            </div>
            <div>
              <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>الحد الأقصى للطلاب</label>
              <input
                type="number"
                min={1}
                value={courseForm.max_students}
                onChange={(event) => setCourseForm({ ...courseForm, max_students: Number(event.target.value) })}
                className="w-full px-4 py-2.5 rounded-xl border text-sm"
                style={inputStyle}
              />
            </div>
            <div>
              <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>عدد المحاضرات</label>
              <input
                type="number"
                min={0}
                value={courseForm.lecture_count}
                onChange={(event) => setCourseForm({ ...courseForm, lecture_count: Number(event.target.value) })}
                className="w-full px-4 py-2.5 rounded-xl border text-sm"
                style={inputStyle}
              />
            </div>
            <div>
              <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>مدة المحاضرة (ساعة)</label>
              <input
                type="number"
                min={0}
                step={0.5}
                value={courseForm.lecture_duration}
                onChange={(event) => setCourseForm({ ...courseForm, lecture_duration: Number(event.target.value) })}
                className="w-full px-4 py-2.5 rounded-xl border text-sm"
                style={inputStyle}
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>وصف مختصر</label>
              <textarea
                value={courseForm.description}
                onChange={(event) => setCourseForm({ ...courseForm, description: event.target.value })}
                rows={3}
                className="w-full px-4 py-2.5 rounded-xl border text-sm resize-y"
                style={inputStyle}
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>مقدمة الكورس</label>
              <textarea
                value={courseForm.introduction}
                onChange={(event) => setCourseForm({ ...courseForm, introduction: event.target.value })}
                rows={3}
                className="w-full px-4 py-2.5 rounded-xl border text-sm resize-y"
                style={inputStyle}
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>الفئة المستهدفة</label>
              <textarea
                value={courseForm.target_audience}
                onChange={(event) => setCourseForm({ ...courseForm, target_audience: event.target.value })}
                rows={2}
                className="w-full px-4 py-2.5 rounded-xl border text-sm resize-y"
                style={inputStyle}
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>صورة الكورس</label>
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
                className="w-full text-sm"
                style={{ color: 'var(--text)' }}
              />
              {courseForm.image_url && (
                <img src={courseForm.image_url} alt="معاينة" className="mt-2 h-20 rounded-lg object-cover" />
              )}
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>رابط المادة العلمية</label>
              <input
                type="url"
                dir="ltr"
                value={courseForm.materials_url}
                onChange={(event) => setCourseForm({ ...courseForm, materials_url: event.target.value })}
                maxLength={500}
                placeholder="https://drive.google.com/file/d/..."
                className="w-full px-4 py-2.5 rounded-xl border text-sm text-left"
                style={inputStyle}
              />
            </div>
            <label className="flex items-center gap-2 text-sm" style={{ color: 'var(--text)' }}>
              <input
                type="checkbox"
                checked={courseForm.is_active === 1}
                onChange={(event) => setCourseForm({ ...courseForm, is_active: event.target.checked ? 1 : 0 })}
              />
              نشر الكورس مباشرة
            </label>
          </div>
          <button
            onClick={() => void createCourse()}
            disabled={creatingCourse}
            className="px-5 py-2.5 rounded-xl text-sm font-medium text-white disabled:opacity-50"
            style={{ backgroundColor: 'var(--primary)' }}
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
