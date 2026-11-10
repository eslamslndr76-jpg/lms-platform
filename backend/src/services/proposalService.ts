import {
  AlignmentType,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from 'docx';
import { sql } from '../db/helpers';
import { createNotification } from './notificationService';
import { sendNotification } from './externalNotificationService';

/**
 * Course proposals (edit-plan.md §6): an instructor proposes a course before it
 * exists, the admin reviews it and can create the course from the accepted data.
 */

export type ProposalStatus = 'draft' | 'submitted' | 'approved' | 'rejected' | 'needs_changes';

export interface ProposalObjectiveRow {
  text: string;
}

export interface ProposalDay {
  day: string;
  topic: string;
  instructor: string;
}

const STATUS_LABELS: Record<ProposalStatus, string> = {
  draft: 'مسودة',
  submitted: 'مقدَّم',
  approved: 'مقبول',
  rejected: 'مرفوض',
  needs_changes: 'مطلوب تعديل',
};

const MINISTRY_HEADER = 'وزارة التعليم العالي — المعهد العالي للعلوم الإدارية بالقطامية';
const UNIT_HEADER = 'وحدة التدريب و التطوير';

function sanitizeObjectives(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      const text = typeof item === 'string' ? item : (item as any)?.text;
      return String(text || '').trim().slice(0, 500);
    })
    .filter(Boolean)
    .slice(0, 40);
}

function sanitizeDailyContent(raw: unknown, fallbackInstructor: string): ProposalDay[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item: any) => ({
      day: String(item?.day || '').trim().slice(0, 120),
      topic: String(item?.topic || '').trim().slice(0, 2000),
      instructor: fallbackInstructor,
    }))
    .filter((day) => day.day || day.topic)
    .slice(0, 60);
}

/**
 * Course material is a link only (Drive/Dropbox/PDF host). Files above 20MB
 * cannot be uploaded, so the instructor pastes a shared link instead.
 */
function sanitizeMaterialsUrl(raw: unknown): string {
  const value = String(raw ?? '').trim();
  if (!value) return '';
  if (value.length > 500) {
    throw { status: 400, message: 'رابط المادة العلمية يجب ألا يزيد عن 500 حرف' };
  }
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw { status: 400, message: 'رابط المادة العلمية غير صالح' };
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw { status: 400, message: 'رابط المادة العلمية يجب أن يبدأ بـ http أو https' };
  }
  return parsed.toString();
}

function parseJsonArray(value: unknown): any[] {
  try {
    const parsed = JSON.parse(String(value || '[]'));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function loadInstructor(instructorId: number): Promise<{ id: number; name: string }> {
  const result = await sql('SELECT id, name FROM users WHERE id=?', instructorId);
  if (result.rows.length === 0) throw { status: 404, message: 'حساب المحاضر غير موجود' };
  return { id: Number((result.rows[0] as any).id), name: (result.rows[0] as any).name || '' };
}

export async function loadProposalForInstructor(instructorId: number, proposalId: number): Promise<any> {
  const result = await sql(
    `SELECT p.*, u.name as instructor_name
     FROM course_proposals p JOIN users u ON p.instructor_user_id=u.id
     WHERE p.id=? AND p.instructor_user_id=?`,
    proposalId, instructorId,
  );
  if (result.rows.length === 0) {
    throw { status: 404, message: 'المقترح غير موجود' };
  }
  return serializeProposal(result.rows[0]);
}

function serializeProposal(row: any): any {
  return {
    id: Number(row.id),
    instructor_user_id: Number(row.instructor_user_id),
    instructor_name: row.instructor_name || '',
    course_title: row.course_title || '',
    objectives: parseJsonArray(row.objectives).map((item) =>
      typeof item === 'string' ? item : String(item?.text || ''),
    ).filter(Boolean),
    daily_content: parseJsonArray(row.daily_content).map((day: any) => ({
      day: String(day?.day || ''),
      topic: String(day?.topic || ''),
      instructor: String(day?.instructor || row.instructor_name || ''),
    })),
    materials_url: row.materials_url || '',
    status: row.status as ProposalStatus,
    status_label: STATUS_LABELS[row.status as ProposalStatus] || row.status,
    admin_note: row.admin_note || '',
    course_id: row.course_id != null ? Number(row.course_id) : null,
    submitted_at: row.submitted_at || null,
    reviewed_at: row.reviewed_at || null,
    created_at: row.created_at || null,
    updated_at: row.updated_at || null,
  };
}

export async function getInstructorProposals(instructorId: number): Promise<any[]> {
  const result = await sql(
    `SELECT p.*, u.name as instructor_name
     FROM course_proposals p JOIN users u ON p.instructor_user_id=u.id
     WHERE p.instructor_user_id=?
     ORDER BY p.created_at DESC`,
    instructorId,
  );
  return result.rows.map(serializeProposal);
}

export async function createProposal(
  instructorId: number,
  payload: { course_title?: string; objectives?: unknown; daily_content?: unknown; materials_url?: string },
): Promise<any> {
  const instructor = await loadInstructor(instructorId);
  const result = await sql(
    `INSERT INTO course_proposals (instructor_user_id, course_title, objectives, daily_content, materials_url, status)
     VALUES (?,?,?,?,?,'draft')`,
    instructorId,
    String(payload.course_title || '').slice(0, 200),
    JSON.stringify(sanitizeObjectives(payload.objectives).map((text) => ({ text }))),
    JSON.stringify(sanitizeDailyContent(payload.daily_content, instructor.name)),
    sanitizeMaterialsUrl(payload.materials_url),
  );
  return loadProposalForInstructor(instructorId, Number(result.lastInsertRowid));
}

function canInstructorEdit(status: ProposalStatus): boolean {
  return status === 'draft' || status === 'needs_changes';
}

export async function updateProposal(
  instructorId: number,
  proposalId: number,
  payload: { course_title?: string; objectives?: unknown; daily_content?: unknown; materials_url?: string },
): Promise<any> {
  const current = await loadProposalForInstructor(instructorId, proposalId);
  if (!canInstructorEdit(current.status)) {
    throw { status: 400, message: 'لا يمكن تعديل المقترح بعد قبوله — تواصل مع الإدارة' };
  }
  const instructor = await loadInstructor(instructorId);
  await sql(
    `UPDATE course_proposals
     SET course_title=?, objectives=?, daily_content=?, materials_url=?, updated_at=datetime('now')
     WHERE id=? AND instructor_user_id=?`,
    String(payload.course_title ?? current.course_title).slice(0, 200),
    JSON.stringify(
      sanitizeObjectives(payload.objectives ?? current.objectives).map((text) => ({ text })),
    ),
    JSON.stringify(sanitizeDailyContent(payload.daily_content ?? current.daily_content, instructor.name)),
    sanitizeMaterialsUrl(payload.materials_url ?? current.materials_url),
    proposalId, instructorId,
  );
  return loadProposalForInstructor(instructorId, proposalId);
}

export async function submitProposal(instructorId: number, proposalId: number): Promise<any> {
  const current = await loadProposalForInstructor(instructorId, proposalId);
  if (!canInstructorEdit(current.status)) {
    throw { status: 400, message: 'المقترح مُقدَّم بالفعل' };
  }
  if (!current.course_title.trim()) {
    throw { status: 400, message: 'اسم الدورة مطلوب قبل التقديم' };
  }
  if (current.objectives.length === 0) {
    throw { status: 400, message: 'أضف هدفاً واحداً على الأقل للدورة' };
  }
  if (!current.daily_content.some((day: ProposalDay) => day.topic.trim())) {
    throw { status: 400, message: 'أضف محتوى علمياً ليوم واحد على الأقل' };
  }

  await sql(
    `UPDATE course_proposals
     SET status='submitted', submitted_at=datetime('now'), updated_at=datetime('now'), admin_note=''
     WHERE id=? AND instructor_user_id=?`,
    proposalId, instructorId,
  );
  await notifyAdminsOfProposal(current).catch((error) =>
    console.error('[Proposal] Admin notification failed:', error?.message || error),
  );
  return loadProposalForInstructor(instructorId, proposalId);
}

async function notifyAdminsOfProposal(proposal: any): Promise<void> {
  const admins = await sql('SELECT id FROM users WHERE role_id=1 AND is_active=1');
  for (const row of admins.rows as any[]) {
    const adminId = Number(row.id);
    await createNotification(
      adminId,
      'مقترح كورس جديد',
      `${proposal.instructor_name} قدّم مقترح دورة "${proposal.course_title}".`,
      'info',
      '/proposals',
    ).catch((e: any) => console.error(`[Proposal] Admin notification failed for user ${adminId}:`, e?.message || e));
  }
}

// ──────────────────────────────────────────────
// Admin
// ──────────────────────────────────────────────

export async function getProposals(): Promise<any[]> {
  const result = await sql(
    `SELECT p.*, u.name as instructor_name, c.title_ar as course_title_created
     FROM course_proposals p
     JOIN users u ON p.instructor_user_id=u.id
     LEFT JOIN courses c ON p.course_id=c.id
     ORDER BY
       CASE p.status WHEN 'submitted' THEN 0 WHEN 'needs_changes' THEN 1 ELSE 2 END,
       p.created_at DESC`,
  );
  return result.rows.map(serializeProposal);
}

export async function getProposal(proposalId: number): Promise<any> {
  const result = await sql(
    `SELECT p.*, u.name as instructor_name
     FROM course_proposals p JOIN users u ON p.instructor_user_id=u.id
     WHERE p.id=?`,
    proposalId,
  );
  if (result.rows.length === 0) throw { status: 404, message: 'المقترح غير موجود' };
  return serializeProposal(result.rows[0]);
}

export async function adminUpdateProposal(
  proposalId: number,
  payload: { course_title?: string; objectives?: unknown; daily_content?: unknown; materials_url?: string },
): Promise<any> {
  const current = await getProposal(proposalId);
  if (current.status === 'approved') {
    throw { status: 400, message: 'المقترح مقبول — عدّل بيانات الكورس بدلاً منه' };
  }
  const instructor = await loadInstructor(current.instructor_user_id);
  await sql(
    `UPDATE course_proposals
     SET course_title=?, objectives=?, daily_content=?, materials_url=?, updated_at=datetime('now')
     WHERE id=?`,
    String(payload.course_title ?? current.course_title).slice(0, 200),
    JSON.stringify(
      sanitizeObjectives(payload.objectives ?? current.objectives).map((text) => ({ text })),
    ),
    JSON.stringify(sanitizeDailyContent(payload.daily_content ?? current.daily_content, instructor.name)),
    sanitizeMaterialsUrl(payload.materials_url ?? current.materials_url),
    proposalId,
  );
  return getProposal(proposalId);
}

export async function reviewProposal(
  adminId: number,
  proposalId: number,
  action: 'approve' | 'reject' | 'needs_changes',
  note?: string,
): Promise<any> {
  const current = await getProposal(proposalId);
  if (current.status === 'approved') {
    throw { status: 400, message: 'المقترح مقبول بالفعل' };
  }
  const status: ProposalStatus =
    action === 'approve' ? 'approved' : action === 'reject' ? 'rejected' : 'needs_changes';
  await sql(
    `UPDATE course_proposals
     SET status=?, admin_note=?, reviewed_at=datetime('now'), reviewed_by=?, updated_at=datetime('now')
     WHERE id=?`,
    status, String(note || '').slice(0, 2000), adminId, proposalId,
  );
  const updated = await getProposal(proposalId);
  await notifyInstructorOfReview(updated).catch((error) =>
    console.error('[Proposal] Instructor notification failed:', error?.message || error),
  );
  return updated;
}

async function notifyInstructorOfReview(proposal: any): Promise<void> {
  const label = STATUS_LABELS[proposal.status as ProposalStatus] || proposal.status;
  const title = proposal.status === 'approved'
    ? 'تم قبول مقترحك'
    : proposal.status === 'rejected'
      ? 'تم رفض مقترحك'
      : 'مقترحك يحتاج تعديلاً';
  const message = proposal.status === 'needs_changes' && proposal.admin_note
    ? `ملاحظة الإدارة: ${proposal.admin_note}`
    : `مقترح دورة "${proposal.course_title}" — الحالة: ${label}`;

  await createNotification(
    proposal.instructor_user_id,
    title,
    message,
    proposal.status === 'approved' ? 'success' : proposal.status === 'rejected' ? 'warning' : 'info',
    `/instructor/proposals/${proposal.id}`,
  );
  await sendNotification(proposal.instructor_user_id, 'proposal_reviewed', {
    courseTitle: proposal.course_title,
    statusLabel: label,
    note: proposal.admin_note || '',
    proposalId: proposal.id,
  });
}

export async function createCourseFromProposal(
  proposalId: number,
  payload: {
    title_en?: string;
    price?: number;
    category_id?: number | null;
    course_mode?: string;
    max_students?: number;
    lecture_count?: number;
    lecture_duration?: number;
    image_url?: string;
    description?: string;
    target_audience?: string;
    introduction?: string;
    materials_url?: string;
    is_active?: number;
  },
): Promise<{ id: number }> {
  const proposal = await getProposal(proposalId);
  if (proposal.status !== 'approved') {
    throw { status: 400, message: 'لا يمكن إنشاء كورس إلا من مقترح مقبول' };
  }
  if (proposal.course_id) {
    throw { status: 400, message: 'تم إنشاء كورس من هذا المقترح بالفعل' };
  }

  const result = await sql(
    `INSERT INTO courses
      (title_ar, title_en, description, price, category_id, image_url, max_students,
       lecture_count, lecture_duration, course_mode, objectives, daily_content,
       introduction, target_audience, materials_url, proposal_id, instructor, is_active)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    proposal.course_title,
    String(payload.title_en || proposal.course_title).slice(0, 200),
    String(payload.description || '').slice(0, 5000),
    Number(payload.price) || 0,
    payload.category_id ?? null,
    String(payload.image_url || '').slice(0, 2000000),
    Number(payload.max_students) || 30,
    Number(payload.lecture_count) || proposal.daily_content.length || 0,
    Number(payload.lecture_duration) || 0,
    payload.course_mode === 'offline' ? 'offline' : 'online',
    JSON.stringify(proposal.objectives.map((text: string) => ({ text }))),
    JSON.stringify(proposal.daily_content),
    String(payload.introduction || '').slice(0, 5000),
    String(payload.target_audience || '').slice(0, 2000),
    sanitizeMaterialsUrl(payload.materials_url ?? proposal.materials_url),
    proposalId,
    proposal.instructor_name,
    payload.is_active === 0 ? 0 : 1,
  );
  const courseId = Number(result.lastInsertRowid);
  await sql(
    `UPDATE course_proposals SET course_id=?, updated_at=datetime('now') WHERE id=?`,
    courseId, proposalId,
  );
  return { id: courseId };
}

// ──────────────────────────────────────────────
// Word export
// ──────────────────────────────────────────────

function rtlParagraph(text: string, options: { bold?: boolean; size?: number; heading?: any; spacing?: number } = {}) {
  return new Paragraph({
    bidirectional: true,
    alignment: AlignmentType.RIGHT,
    heading: options.heading,
    spacing: { after: options.spacing ?? 120 },
    children: [
      new TextRun({
        text,
        bold: options.bold,
        size: options.size ?? 24,
        font: 'Arial',
      }),
    ],
  });
}

function cell(text: string, header = false): TableCell {
  return new TableCell({
    shading: header ? { fill: 'E8EEF7' } : undefined,
    children: [
      new Paragraph({
        bidirectional: true,
        alignment: AlignmentType.RIGHT,
        children: [new TextRun({ text, bold: header, font: 'Arial', size: 22 })],
      }),
    ],
  });
}

export async function buildProposalWord(proposal: any): Promise<Buffer> {
  const children: (Paragraph | Table)[] = [
    rtlParagraph(MINISTRY_HEADER, { bold: true, size: 24, spacing: 60 }),
    rtlParagraph(UNIT_HEADER, { bold: true, size: 28, spacing: 240 }),
    rtlParagraph('خطة تدريب', { bold: true, size: 26, spacing: 80 }),
    rtlParagraph(proposal.course_title || 'مقترح دورة تدريبية', {
      bold: true,
      size: 36,
      heading: HeadingLevel.HEADING_1,
      spacing: 240,
    }),
    rtlParagraph('في نهاية الدورة التدريبية سوف يكون المتدرب قادراً على:', {
      bold: true,
      size: 26,
      spacing: 120,
    }),
  ];

  proposal.objectives.forEach((objective: string) => {
    children.push(rtlParagraph(`• ${objective}`, { size: 24, spacing: 80 }));
  });

  children.push(
    rtlParagraph('المحتوى العلمي', {
      bold: true,
      size: 30,
      heading: HeadingLevel.HEADING_2,
      spacing: 240,
    }),
  );

  const rows: TableRow[] = [
    new TableRow({
      tableHeader: true,
      children: [cell('اليوم', true), cell('الموضوع', true), cell('المحاضر', true)],
    }),
  ];
  proposal.daily_content.forEach((day: ProposalDay) => {
    rows.push(new TableRow({ children: [cell(day.day), cell(day.topic), cell(day.instructor)] }));
  });
  if (proposal.daily_content.length === 0) {
    rows.push(new TableRow({ children: [cell('—'), cell('—'), cell(proposal.instructor_name)] }));
  }
  children.push(
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows,
    }),
  );

  if (proposal.materials_url) {
    children.push(
      rtlParagraph('المادة العلمية', {
        bold: true,
        size: 30,
        heading: HeadingLevel.HEADING_2,
        spacing: 240,
      }),
      rtlParagraph(proposal.materials_url, { size: 22, spacing: 240 }),
    );
  }

  children.push(
    rtlParagraph('', { spacing: 400 }),
    rtlParagraph('المحاضر،،،', { bold: true, size: 28, spacing: 60 }),
    rtlParagraph(proposal.instructor_name || '', { size: 24 }),
  );

  const doc = new Document({
    styles: {
      default: {
        document: {
          run: { font: 'Arial', size: 24 },
          paragraph: { spacing: { line: 320 } },
        },
      },
    },
    sections: [{ properties: { page: { margin: { top: 900, bottom: 900, left: 900, right: 900 } } }, children }],
  });
  return Packer.toBuffer(doc);
}
