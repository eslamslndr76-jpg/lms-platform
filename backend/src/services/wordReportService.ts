import {
  AlignmentType,
  Document,
  HeadingLevel,
  ImageRun,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from 'docx';
import type { GroupReport } from './reportService';

/**
 * Word renderer for the group report (edit-plan.md §8).
 * Mirrors the paper template section by section; nothing is persisted.
 */

const MINISTRY_HEADER = 'وزارة التعليم العالي — المعهد العالي للعلوم الإدارية بالقطامية';
const UNIT_HEADER = 'وحدة التدريب و التطوير';

interface UploadedImage {
  buffer: Buffer;
  mimetype: string;
}

function rtl(
  value: string,
  options: {
    bold?: boolean;
    size?: number;
    heading?: any;
    spacing?: number;
    color?: string;
    alignment?: any;
    bullet?: boolean;
  } = {},
): Paragraph {
  return new Paragraph({
    bidirectional: true,
    alignment: options.alignment ?? AlignmentType.RIGHT,
    heading: options.heading,
    spacing: { after: options.spacing ?? 100 },
    bullet: options.bullet ? { level: 0 } : undefined,
    children: [
      new TextRun({
        text: value,
        bold: options.bold,
        size: options.size ?? 22,
        color: options.color,
        font: 'Arial',
      }),
    ],
  });
}

function sectionTitle(value: string): Paragraph {
  return rtl(value, {
    bold: true,
    size: 26,
    heading: HeadingLevel.HEADING_2,
    spacing: 160,
    color: '1F3864',
  });
}

function cell(
  value: string,
  options: { header?: boolean; width?: number; bold?: boolean; align?: any } = {},
): TableCell {
  return new TableCell({
    width: options.width ? { size: options.width, type: WidthType.PERCENTAGE } : undefined,
    shading: options.header ? { fill: 'E8EEF7' } : undefined,
    children: [
      new Paragraph({
        bidirectional: true,
        alignment: options.align ?? AlignmentType.RIGHT,
        children: [
          new TextRun({
            text: value ?? '',
            bold: options.header || options.bold,
            font: 'Arial',
            size: 20,
          }),
        ],
      }),
    ],
  });
}

function labelValueTable(rows: [string, string][]): Table {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    visuallyRightToLeft: true,
    rows: rows.map(
      ([label, value]) =>
        new TableRow({
          children: [
            cell(label, { header: true, width: 30 }),
            cell(value, { width: 70 }),
          ],
        }),
    ),
  });
}

function dataTable(headers: string[], rows: string[][], widths?: number[]): Table {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    visuallyRightToLeft: true,
    rows: [
      new TableRow({
        tableHeader: true,
        children: headers.map((header, index) =>
          cell(header, { header: true, width: widths?.[index], align: AlignmentType.CENTER }),
        ),
      }),
      ...rows.map(
        (row) =>
          new TableRow({
            children: row.map((value, index) =>
              cell(value, { width: widths?.[index], align: AlignmentType.CENTER }),
            ),
          }),
      ),
    ],
  });
}

// ──────────────────────────────────────────────
// Images (in-memory only, never stored)
// ──────────────────────────────────────────────

function imageSize(buf: Buffer): { width: number; height: number } {
  if (buf.length > 24 && buf[0] === 0x89 && buf[1] === 0x50) {
    return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
  }
  if (buf.length > 4 && buf[0] === 0xff && buf[1] === 0xd8) {
    let offset = 2;
    while (offset + 9 < buf.length) {
      if (buf[offset] !== 0xff) {
        offset += 1;
        continue;
      }
      const marker = buf[offset + 1];
      const size = buf.readUInt16BE(offset + 2);
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
        return { height: buf.readUInt16BE(offset + 5), width: buf.readUInt16BE(offset + 7) };
      }
      offset += 2 + size;
    }
  }
  return { width: 0, height: 0 };
}

function imageType(buf: Buffer, mimetype: string): 'png' | 'jpg' | null {
  if (buf.length > 4 && buf[0] === 0x89 && buf[1] === 0x50) return 'png';
  if (buf.length > 4 && buf[0] === 0xff && buf[1] === 0xd8) return 'jpg';
  if (/png/i.test(mimetype)) return 'png';
  if (/jpe?g/i.test(mimetype)) return 'jpg';
  return null;
}

function scaledTransform(buf: Buffer, maxWidth: number, maxHeight: number) {
  const { width, height } = imageSize(buf);
  if (!width || !height) return { width: maxWidth, height: Math.round(maxWidth * 0.65) };
  const ratio = width / height;
  let targetWidth = maxWidth;
  let targetHeight = Math.round(maxWidth / ratio);
  if (targetHeight > maxHeight) {
    targetHeight = maxHeight;
    targetWidth = Math.round(maxHeight * ratio);
  }
  return { width: targetWidth, height: targetHeight };
}

function imagesTable(files: UploadedImage[]): Table | null {
  const usable: { run: ImageRun }[] = [];
  for (const file of files) {
    const type = imageType(file.buffer, file.mimetype);
    if (!type) continue;
    usable.push({
      run: new ImageRun({
        type,
        data: file.buffer,
        transformation: scaledTransform(file.buffer, 290, 210),
      }),
    });
    if (usable.length === 8) break;
  }
  if (usable.length === 0) return null;

  const rows: TableRow[] = [];
  for (let i = 0; i < usable.length; i += 2) {
    const pair = usable.slice(i, i + 2);
    rows.push(
      new TableRow({
        children: pair.map(
          (image) =>
            new TableCell({
              width: { size: pair.length === 1 ? 100 : 50, type: WidthType.PERCENTAGE },
              children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [image.run] })],
            }),
        ),
      }),
    );
  }

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    visuallyRightToLeft: true,
    rows,
  });
}

// ──────────────────────────────────────────────
// Report document
// ──────────────────────────────────────────────

function durationText(report: GroupReport): string {
  const count = report.course.lecture_count || report.lectures.length;
  const hours = report.course.lecture_duration;
  const parts: string[] = [];
  if (count > 0) parts.push(`${count} محاضرة`);
  if (hours > 0) parts.push(`مدة المحاضرة ${hours} ساعة`);
  return parts.length ? parts.join(' — ') : 'غير محددة';
}

function surveyTables(report: GroupReport): (Paragraph | Table)[] {
  const survey = report.survey;
  if (!survey || !Array.isArray(survey.items) || survey.items.length === 0) {
    return [rtl('لا توجد إجابات على الاستبيان بعد.', { size: 22 })];
  }

  const sections: { key: string; title: string; avg: number | null }[] = Array.isArray(survey.sections)
    ? survey.sections
    : [];

  const rows: TableRow[] = [
    new TableRow({
      tableHeader: true,
      children: [
        cell('مجال التقييم', { header: true, width: 22, align: AlignmentType.CENTER }),
        cell('بند التقييم', { header: true, width: 44 }),
        cell('متوسط الرضا', { header: true, width: 17, align: AlignmentType.CENTER }),
        cell('متوسط الرضا العام', { header: true, width: 17, align: AlignmentType.CENTER }),
      ],
    }),
  ];

  for (const section of sections) {
    const items = (survey.items as any[]).filter(
      (item) => item.section === section.key && item.avg !== null,
    );
    if (items.length === 0) continue;
    items.forEach((item, index) => {
      rows.push(
        new TableRow({
          children: [
            cell(index === 0 ? section.title : '', { width: 22, bold: index === 0 }),
            cell(String(item.label || ''), { width: 44 }),
            cell(item.avg != null ? `${item.avg} / 5` : '—', {
              width: 17,
              align: AlignmentType.CENTER,
            }),
            cell(index === 0 && section.avg != null ? `${section.avg} / 5` : '', {
              width: 17,
              align: AlignmentType.CENTER,
              bold: index === 0,
            }),
          ],
        }),
      );
    });
  }

  const answered = Number(survey.answered || 0);
  const total = Number(survey.total_students || 0);
  const rate = Number(survey.response_rate || 0);

  return [
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      visuallyRightToLeft: true,
      rows,
    }),
    rtl('', { spacing: 60 }),
    rtl(`عدد من أجابوا: ${answered} من ${total} (${rate}%)`, { bold: true, size: 22 }),
    rtl(
      survey.overall_avg != null
        ? `المتوسط العام للرضا: ${survey.overall_avg} من 5`
        : 'المتوسط العام للرضا: —',
      { size: 22 },
    ),
    survey.helped && survey.helped.yes_percent != null
      ? rtl(
          `هل ساعد البرنامج على تطوير المهارات؟ نعم ${survey.helped.yes} (${survey.helped.yes_percent}%) — لا ${survey.helped.no}`,
          { size: 22 },
        )
      : rtl('', { spacing: 0 }),
  ];
}

export async function buildGroupReportWord(
  report: GroupReport,
  images: UploadedImage[] = [],
): Promise<Buffer> {
  const { group, course, settings } = report;
  const offline = group.course_mode === 'offline';

  const period = [group.start_date, group.end_date].filter(Boolean).join(' — ') || 'غير محددة';

  const children: (Paragraph | Table)[] = [
    rtl(MINISTRY_HEADER, { bold: true, size: 22, spacing: 40 }),
    rtl(UNIT_HEADER, { bold: true, size: 26, spacing: 160 }),
    rtl('تقرير الدورة التدريبية', {
      bold: true,
      size: 36,
      heading: HeadingLevel.HEADING_1,
      spacing: 100,
    }),
    rtl(course.title_ar, { bold: true, size: 30, spacing: 40, color: '1F3864' }),
    rtl(group.name, { size: 22, spacing: 200, color: '555555' }),
    labelValueTable([
      ['مقدم الدورة', group.instructor_name || '—'],
      ['منسق الدورة', settings.coordinatorName],
      ['الفترة التدريبية', period],
      ['أيام المحاضرات', group.days_text || 'لم تُحدد بعد'],
    ]),
    rtl('', { spacing: 160 }),
  ];

  // أولاً: معلومات عامة
  children.push(
    sectionTitle('أولاً: معلومات عامة'),
    labelValueTable([
      ['اسم الدورة', course.title_ar],
      ['مدة الدورة', durationText(report)],
      ['الجدول الزمني وميعاد الدورة', group.time_range || 'لم يُحدد بعد'],
      ['مقدم الدورة', group.instructor_name || '—'],
      ['مكان انعقاد الدورة', group.place_name || (offline ? '—' : 'أونلاين')],
      ['طريقة الحضور', offline ? 'مباشرة' : 'أونلاين'],
      ['منسق/منظم/رعاة الدورة', settings.organizerText],
      ['الفئة المستهدفة بالمشاركة', course.target_audience || '—'],
      ['نوع النشاط', group.activity_type || settings.defaultActivityType],
    ]),
    rtl('', { spacing: 140 }),
  );

  // ثانياً: مقدمة عن الدورة
  children.push(
    sectionTitle('ثانياً: مقدمة عن الدورة'),
    rtl(course.introduction || course.description || 'لا توجد مقدمة مسجلة.', {
      size: 22,
      spacing: 140,
    }),
  );

  // ثالثاً: أهداف الدورة
  children.push(sectionTitle('ثالثاً: أهداف الدورة'));
  if (course.objectives.length === 0) {
    children.push(rtl('لا توجد أهداف مسجلة.', { size: 22 }));
  } else {
    course.objectives.forEach((objective) => {
      children.push(rtl(objective, { size: 22, bullet: true, spacing: 60 }));
    });
  }
  children.push(rtl('', { spacing: 100 }));

  // رابعاً: محاور الدورة
  children.push(sectionTitle('رابعاً: محاور الدورة'));
  if (course.daily_content.length === 0) {
    children.push(rtl('لا توجد محاور مسجلة.', { size: 22 }));
  } else {
    children.push(
      dataTable(
        ['اليوم', 'الموضوع', 'المحاضر'],
        course.daily_content.map((day) => [day.day, day.topic, day.instructor]),
        [18, 52, 30],
      ),
    );
  }
  children.push(rtl('', { spacing: 100 }));

  // خامساً: قائمة المشاركين
  children.push(sectionTitle('خامساً: قائمة المشاركين'));
  if (report.students.length === 0) {
    children.push(rtl('لا يوجد مشاركون مسجلون في هذه المجموعة.', { size: 22 }));
  } else {
    children.push(
      dataTable(
        ['الرقم', 'اسم الوحدة/الجهة', 'اسم المشارك'],
        report.students.map((student, index) => [
          String(index + 1),
          student.unit || '—',
          student.name,
        ]),
        [10, 40, 50],
      ),
    );
  }
  children.push(rtl('', { spacing: 100 }));

  // سادساً: نتائج التقييم
  children.push(sectionTitle('سادساً: نتائج التقييم'), ...surveyTables(report));
  children.push(rtl('', { spacing: 100 }));

  // سابعاً: الشهادات
  children.push(
    sectionTitle('سابعاً: الشهادات'),
    rtl(settings.certificateText, { size: 22, spacing: 140 }),
  );

  // ثامناً: ملاحظات عامة
  children.push(
    sectionTitle('ثامناً: ملاحظات عامة'),
    rtl(group.notes || settings.defaultNotes, { size: 22, spacing: 140 }),
  );

  // تاسعاً: التوصيات
  children.push(
    sectionTitle('تاسعاً: التوصيات'),
    rtl(group.recommendations || settings.defaultRecommendations, { size: 22, spacing: 140 }),
  );

  // عاشراً: صور وثائقية
  children.push(sectionTitle('عاشراً: صور وثائقية'));
  const photos = imagesTable(images);
  children.push(photos ?? rtl('لا توجد صور مرفقة.', { size: 22 }));

  // Signatures
  children.push(
    rtl('', { spacing: 300 }),
    labelValueTable([
      ['منسق الدورة', settings.coordinatorName],
      ['التوقيع', ''],
    ]),
  );

  const doc = new Document({
    styles: {
      default: {
        document: {
          run: { font: 'Arial', size: 22 },
          paragraph: { spacing: { line: 320 } },
        },
      },
    },
    sections: [
      {
        properties: { page: { margin: { top: 900, bottom: 900, left: 900, right: 900 } } },
        children,
      },
    ],
  });

  return Packer.toBuffer(doc);
}
