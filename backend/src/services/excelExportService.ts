import ExcelJS from 'exceljs';
import { sql } from '../db/helpers';
import { DEFAULT_LOGO_DATA_URL } from '../config/brandLogo';

/**
 * Branded Excel exporter.
 *
 * Every workbook produced here is:
 *  - RTL (Arabic sheet direction) and print-ready (A4 landscape, repeated header)
 *  - branded with the logo + colors configured in Settings → الهوية
 *  - editable: real cells (no images of tables), real numbers/dates, autofilter,
 *    frozen header and a live SUBTOTAL row that recalculates when values change
 *  - self-documenting: a second sheet describing the report, filters and source
 */

export type CellType =
  | 'text'
  | 'number'
  | 'currency'
  | 'percent'
  | 'date'
  | 'datetime'
  | 'boolean'
  | 'duration';

export interface ExportColumn {
  key: string;
  header: string;
  type?: CellType;
  width?: number;
  /** Add this column to the totals row (formula-based, editable). */
  total?: 'sum' | 'count';
}

export interface BrandingInfo {
  systemName: string;
  sloganAr: string;
  sloganEn: string;
  messageFooter: string;
  logoHeader: string;
  logoFooter: string;
  primaryColor: string;
  secondaryColor: string;
}

export interface BuildOptions {
  sheetName: string;
  title: string;
  description?: string;
  columns: ExportColumn[];
  rows: Record<string, unknown>[];
  branding: BrandingInfo;
  filters?: { label: string; value: string }[];
  exportedBy?: string;
  exportedByRole?: string;
  /** Extra lines shown in the footer of the data sheet. */
  footerNote?: string;
}

const DEFAULT_BRANDING: BrandingInfo = {
  systemName: 'وحدة التدريب و التطوير',
  sloganAr: 'نحو تعليم أفضل',
  sloganEn: 'Towards Better Learning',
  messageFooter:
    'هذه المنصة مقدمة من وحدة التدريب و التطوير بالتعاون مع المعهد العالي للعلوم الإدارية بالقطامية (HIMS)',
  logoHeader: DEFAULT_LOGO_DATA_URL,
  logoFooter: DEFAULT_LOGO_DATA_URL,
  primaryColor: '#2563eb',
  secondaryColor: '#7c3aed',
};

const DISCLAIMER =
  'هذه المنصة مقدمة من وحدة التدريب و التطوير بالتعاون مع المعهد العالي للعلوم الإدارية بالقطامية (HIMS)';

const FONT = 'Arial';
const BORDER = 'FFE2E8F0';

// ─── Colour helpers ────────────────────────────────────────────────

function toArgb(color: string | undefined, fallback: string): string {
  const hex = (color || '').trim().replace('#', '');
  if (/^[0-9a-fA-F]{6}$/.test(hex)) return `FF${hex.toUpperCase()}`;
  if (/^[0-9a-fA-F]{8}$/.test(hex)) return hex.toUpperCase();
  return `FF${fallback.replace('#', '').toUpperCase()}`;
}

function mixArgb(argb: string, target: 'white' | 'black', ratio: number): string {
  const rgb = argb.slice(2);
  const t = target === 'white' ? 255 : 0;
  const parts = [0, 2, 4].map((i) => {
    const c = parseInt(rgb.slice(i, i + 2), 16);
    return Math.round(c + (t - c) * ratio)
      .toString(16)
      .padStart(2, '0');
  });
  return `FF${parts.join('').toUpperCase()}`;
}

function readableText(argb: string): string {
  const rgb = argb.slice(2);
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(rgb.slice(i, i + 2), 16));
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.62 ? 'FF1F2937' : 'FFFFFFFF';
}

// ─── Branding ──────────────────────────────────────────────────────

export async function loadBranding(): Promise<BrandingInfo> {
  try {
    const result = await sql("SELECT value FROM system_settings WHERE key='branding'");
    if (result.rows.length > 0) {
      const parsed = JSON.parse(String(result.rows[0].value));
      return {
        ...DEFAULT_BRANDING,
        ...parsed,
        systemName: parsed.systemName || DEFAULT_BRANDING.systemName,
        sloganAr: parsed.sloganAr || DEFAULT_BRANDING.sloganAr,
        // An empty stored value means "never uploaded": use the new default logo.
        logoHeader: parsed.logoHeader || DEFAULT_BRANDING.logoHeader,
        logoFooter: parsed.logoFooter || DEFAULT_BRANDING.logoFooter,
      };
    }
  } catch {
    /* brand settings are optional — fall back to defaults */
  }
  return DEFAULT_BRANDING;
}

// ─── Images ────────────────────────────────────────────────────────

interface ParsedImage {
  base64: string;
  extension: 'png' | 'jpeg' | 'gif';
  width: number;
  height: number;
}

/** Read pixel dimensions from the file header so the logo keeps its ratio. */
function imageSize(buf: Buffer): { width: number; height: number } {
  // PNG
  if (buf.length > 24 && buf[0] === 0x89 && buf[1] === 0x50) {
    return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
  }
  // GIF
  if (buf.length > 10 && buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46) {
    return { width: buf.readUInt16LE(6), height: buf.readUInt16LE(8) };
  }
  // JPEG — scan for a SOF marker
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

async function parseImage(source?: string): Promise<ParsedImage | null> {
  if (!source) return null;
  try {
    let buf: Buffer | null = null;
    let mime = '';

    if (source.startsWith('data:')) {
      const match = /^data:([^;]+);base64,(.+)$/i.exec(source);
      if (!match) return null;
      mime = match[1];
      buf = Buffer.from(match[2], 'base64');
    } else if (/^https?:\/\//i.test(source)) {
      const res = await fetch(source);
      if (!res.ok) return null;
      mime = res.headers.get('content-type') || '';
      buf = Buffer.from(await res.arrayBuffer());
    } else if (source.length > 100) {
      // Raw base64 without a data-URL prefix
      buf = Buffer.from(source, 'base64');
    }

    if (!buf || buf.length === 0) return null;

    const extension: ParsedImage['extension'] = /png/i.test(mime)
      ? 'png'
      : /gif/i.test(mime)
        ? 'gif'
        : 'jpeg';

    const { width, height } = imageSize(buf);
    return { base64: buf.toString('base64'), extension, width, height };
  } catch {
    return null;
  }
}

// ─── Value/type helpers ────────────────────────────────────────────

function parseDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  const raw = String(value).trim();
  if (!raw) return null;
  // SQLite timestamps are "YYYY-MM-DD HH:MM:SS" (UTC)
  const normalized = raw.includes('T') ? raw : raw.replace(' ', 'T') + (raw.length <= 10 ? 'T00:00:00' : 'Z');
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
}

function numeric(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function cellValue(value: unknown, type: CellType | undefined): ExcelJS.CellValue {
  switch (type) {
    case 'date':
    case 'datetime': {
      const d = parseDate(value);
      return d ?? (value === null || value === undefined ? null : String(value));
    }
    case 'number':
    case 'currency':
    case 'percent':
    case 'duration': {
      const n = numeric(value);
      return n ?? (value === null || value === undefined ? null : String(value));
    }
    case 'boolean': {
      if (value === null || value === undefined) return null;
      if (typeof value === 'boolean') return value;
      return Number(value) === 1 ? 'نعم' : 'لا';
    }
    default:
      return value === null || value === undefined ? null : String(value);
  }
}

function numFmt(type: CellType | undefined): string | undefined {
  switch (type) {
    case 'number':
      return '#,##0.##;-#,##0.##;"-"';
    case 'currency':
      return '#,##0.00 [$ج.م];-#,##0.00 [$ج.م];"-"';
    case 'percent':
      return '0.0%';
    case 'date':
      return 'yyyy-mm-dd';
    case 'datetime':
      return 'yyyy-mm-dd hh:mm';
    case 'duration':
      return '#,##0 "دقيقة"';
    default:
      return undefined;
  }
}

function cellAlignment(type: CellType | undefined): Partial<ExcelJS.Alignment> {
  if (type && type !== 'text' && type !== 'boolean') {
    return { horizontal: 'center', vertical: 'middle', readingOrder: 'ltr' };
  }
  return { horizontal: 'right', vertical: 'middle', wrapText: false, readingOrder: 'rtl' };
}

/** Rough visual width of an Arabic/Latin string (Arabic glyphs are narrower). */
function visualLength(value: unknown): number {
  const text = value === null || value === undefined ? '' : String(value);
  let length = 0;
  for (const char of text) length += /[\u0600-\u06FF]/.test(char) ? 0.85 : 1;
  return length;
}

function columnWidth(column: ExportColumn, rows: Record<string, unknown>[]): number {
  if (column.width) return column.width;
  if (column.type === 'datetime') return 18;
  if (column.type === 'date') return 13;
  if (column.type === 'currency') return 15;
  if (column.type === 'number' || column.type === 'percent') return 12;

  const longest = rows.reduce(
    (max, row) => Math.max(max, visualLength(row[column.key])),
    visualLength(column.header),
  );
  return Math.min(48, Math.max(12, Math.ceil(longest) + 3));
}

// ─── Workbook builder ──────────────────────────────────────────────

export async function buildBrandedWorkbook(options: BuildOptions): Promise<Buffer> {
  const {
    sheetName,
    title,
    description,
    columns,
    rows,
    branding,
    filters = [],
    exportedBy,
    exportedByRole,
    footerNote,
  } = options;

  const primary = toArgb(branding.primaryColor, '#2563eb');
  const secondary = toArgb(branding.secondaryColor, '#7c3aed');
  const primarySoft = mixArgb(primary, 'white', 0.9);
  const secondarySoft = mixArgb(secondary, 'white', 0.88);
  const stripe = mixArgb(primary, 'white', 0.965);
  const headerText = readableText(primary);
  const now = new Date();

  const workbook = new ExcelJS.Workbook();
  workbook.creator = branding.systemName;
  workbook.lastModifiedBy = exportedBy || branding.systemName;
  workbook.created = now;
  workbook.modified = now;
  workbook.company = branding.systemName;
  workbook.title = title;
  workbook.subject = description || title;

  const dataSheetName = (sheetName || title).replace(/[\\/*?:[\]]/g, ' ').slice(0, 31) || 'البيانات';
  const ws = workbook.addWorksheet(dataSheetName, {
    views: [{ rightToLeft: true, showGridLines: false }],
    properties: { defaultRowHeight: 20, tabColor: { argb: primary } },
    pageSetup: {
      paperSize: 9,
      orientation: 'landscape',
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      horizontalCentered: true,
      margins: { left: 0.3, right: 0.3, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 },
    },
  });

  const columnCount = Math.max(columns.length, 1);
  const lastCol = ws.getColumn(columnCount).letter;
  ws.columns = columns.map((column) => ({
    key: column.key,
    width: columnWidth(column, rows),
  }));

  // ── Header block ──────────────────────────────────────────────
  const logo = await parseImage(branding.logoHeader);
  const logoRows = logo ? 3 : 0;
  const titleStartColumn = logo ? 2 : 1;

  if (logo) {
    const targetHeight = 54;
    const ratio = logo.width && logo.height ? logo.width / logo.height : 1;
    const height = targetHeight;
    const width = Math.min(170, Math.max(60, Math.round(height * ratio)));
    const imageId = workbook.addImage({ base64: logo.base64, extension: logo.extension });
    ws.addImage(imageId, {
      tl: { col: 0, row: 0 },
      ext: { width, height },
      editAs: 'oneCell',
    });
  }

  const titleRange = `${ws.getColumn(titleStartColumn).letter}1:${lastCol}1`;
  if (logo) ws.mergeCells(`${ws.getColumn(1).letter}1:${ws.getColumn(1).letter}${logoRows}`);

  ws.mergeCells(titleRange);
  const brandCell = ws.getCell(`${ws.getColumn(titleStartColumn).letter}1`);
  brandCell.value = branding.systemName;
  brandCell.font = { name: FONT, size: 11, bold: true, color: { argb: primary } };
  brandCell.alignment = { horizontal: 'right', vertical: 'middle' };
  ws.getRow(1).height = 20;

  ws.mergeCells(`${ws.getColumn(titleStartColumn).letter}2:${lastCol}2`);
  const titleCell = ws.getCell(`${ws.getColumn(titleStartColumn).letter}2`);
  titleCell.value = title;
  titleCell.font = { name: FONT, size: 17, bold: true, color: { argb: 'FF111827' } };
  titleCell.alignment = { horizontal: 'right', vertical: 'middle' };
  ws.getRow(2).height = 28;

  ws.mergeCells(`${ws.getColumn(titleStartColumn).letter}3:${lastCol}3`);
  const subtitleCell = ws.getCell(`${ws.getColumn(titleStartColumn).letter}3`);
  subtitleCell.value = [branding.sloganAr, description].filter(Boolean).join(' · ');
  subtitleCell.font = { name: FONT, size: 9, color: { argb: 'FF6B7280' } };
  subtitleCell.alignment = { horizontal: 'right', vertical: 'middle' };
  ws.getRow(3).height = 18;

  // Meta line: filters + count + timestamp
  ws.mergeCells(`A4:${lastCol}4`);
  const metaCell = ws.getCell('A4');
  const filterText = filters.length ? filters.map((f) => `${f.label}: ${f.value}`).join('  |  ') : 'بدون فلاتر';
  metaCell.value = `عدد السجلات: ${rows.length}   |   ${filterText}   |   تاريخ الإصدار: ${now.toLocaleString('ar-EG')}`;
  metaCell.font = { name: FONT, size: 9, color: { argb: 'FF4B5563' } };
  metaCell.alignment = { horizontal: 'right', vertical: 'middle', readingOrder: 'rtl' };
  metaCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: primarySoft } };
  metaCell.border = { bottom: { style: 'thin', color: { argb: BORDER } } };
  ws.getRow(4).height = 22;

  ws.getRow(5).height = 6;

  // ── Table header ──────────────────────────────────────────────
  const headerRowIndex = 6;
  const headerRow = ws.getRow(headerRowIndex);
  columns.forEach((column, index) => {
    const cell = headerRow.getCell(index + 1);
    cell.value = column.header;
    cell.font = { name: FONT, size: 11, bold: true, color: { argb: headerText } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: primary } };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true, readingOrder: 'rtl' };
    cell.border = {
      top: { style: 'thin', color: { argb: primary } },
      bottom: { style: 'medium', color: { argb: secondary } },
      left: { style: 'thin', color: { argb: mixArgb(primary, 'white', 0.25) } },
      right: { style: 'thin', color: { argb: mixArgb(primary, 'white', 0.25) } },
    };
  });
  headerRow.height = 34;

  ws.autoFilter = {
    from: { row: headerRowIndex, column: 1 },
    to: { row: headerRowIndex, column: columnCount },
  };
  ws.views = [{ state: 'frozen', ySplit: headerRowIndex, rightToLeft: true, showGridLines: false }];

  // ── Data rows ─────────────────────────────────────────────────
  const firstDataRow = headerRowIndex + 1;

  if (rows.length === 0) {
    const row = ws.getRow(firstDataRow);
    ws.mergeCells(`A${firstDataRow}:${lastCol}${firstDataRow}`);
    const cell = row.getCell(1);
    cell.value = 'لا توجد بيانات مطابقة للفلاتر الحالية';
    cell.font = { name: FONT, size: 11, italic: true, color: { argb: 'FF6B7280' } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9FAFB' } };
    row.height = 30;
  } else {
    rows.forEach((record, rowIndex) => {
      const row = ws.getRow(firstDataRow + rowIndex);
      columns.forEach((column, columnIndex) => {
        const cell = row.getCell(columnIndex + 1);
        cell.value = cellValue(record[column.key], column.type);
        cell.font = { name: FONT, size: 10, color: { argb: 'FF111827' } };
        cell.alignment = cellAlignment(column.type);
        const format = numFmt(column.type);
        if (format) cell.numFmt = format;
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: rowIndex % 2 === 0 ? 'FFFFFFFF' : stripe },
        };
        cell.border = {
          top: { style: 'hair', color: { argb: BORDER } },
          bottom: { style: 'hair', color: { argb: BORDER } },
          left: { style: 'hair', color: { argb: BORDER } },
          right: { style: 'hair', color: { argb: BORDER } },
        };
      });
      row.height = 20;
    });
  }

  const lastDataRow = Math.max(firstDataRow, firstDataRow + rows.length - 1);
  let cursor = lastDataRow + 1;

  // ── Totals row (live formulas, so the file stays editable) ────
  const totalColumns = columns
    .map((column, index) => ({ column, index }))
    .filter(({ column }) => column.total === 'sum' || column.total === 'count');

  if (totalColumns.length > 0 && rows.length > 0) {
    const totalsRow = ws.getRow(cursor);
    columns.forEach((column, index) => {
      const cell = totalsRow.getCell(index + 1);
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: secondarySoft } };
      cell.font = { name: FONT, size: 10, bold: true, color: { argb: 'FF111827' } };
      cell.border = {
        top: { style: 'medium', color: { argb: secondary } },
        bottom: { style: 'double', color: { argb: secondary } },
      };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
    });

    const labelCell = totalsRow.getCell(1);
    labelCell.value = 'الإجمالي';
    labelCell.font = { name: FONT, size: 10, bold: true, color: { argb: secondary } };

    const letter = (index: number) => ws.getColumn(index + 1).letter;
    totalColumns.forEach(({ column, index }) => {
      const cell = totalsRow.getCell(index + 1);
      const range = `${letter(index)}${firstDataRow}:${letter(index)}${lastDataRow}`;
      // SUBTOTAL(109, …) sums only visible rows, so totals follow the autofilter.
      cell.value = { formula: column.total === 'count' ? `SUBTOTAL(103,${range})` : `SUBTOTAL(109,${range})` } as ExcelJS.CellFormulaValue;
      if (column.total === 'count') cell.numFmt = '#,##0';
    });
    totalsRow.height = 24;
    cursor += 1;
  }

  // ── Notes ─────────────────────────────────────────────────────
  cursor += 1;
  const notes = [
    footerNote,
    'يمكن تعديل أي خلية مباشرة في هذا الملف. صف الإجماليات يستخدم دالة SUBTOTAL ويتحدّث تلقائيًا مع القيم أو الفلاتر.',
    branding.messageFooter,
    DISCLAIMER,
  ].filter(Boolean) as string[];

  notes.forEach((note) => {
    ws.mergeCells(`A${cursor}:${lastCol}${cursor}`);
    const cell = ws.getCell(`A${cursor}`);
    cell.value = note;
    cell.font = { name: FONT, size: 9, color: { argb: 'FF6B7280' } };
    cell.alignment = { horizontal: 'right', vertical: 'middle', wrapText: true, readingOrder: 'rtl' };
    ws.getRow(cursor).height = 18;
    cursor += 1;
  });

  // ── Print header/footer ───────────────────────────────────────
  ws.headerFooter = {
    oddHeader: `&R&"${FONT},Bold"&10${branding.systemName}&L&"${FONT}"&9${title}`,
    oddFooter: `&L&"${FONT}"&8${DISCLAIMER}&R&"${FONT}"&8صفحة &P من &N`,
  };

  // ── Info sheet ────────────────────────────────────────────────
  const info = workbook.addWorksheet('معلومات التقرير', {
    views: [{ rightToLeft: true, showGridLines: false }],
    properties: { tabColor: { argb: secondary } },
  });
  info.columns = [{ width: 26 }, { width: 62 }];

  info.mergeCells('A1:B1');
  const infoTitle = info.getCell('A1');
  infoTitle.value = branding.systemName;
  infoTitle.font = { name: FONT, size: 14, bold: true, color: { argb: primary } };
  infoTitle.alignment = { horizontal: 'right', vertical: 'middle' };
  info.getRow(1).height = 26;

  info.mergeCells('A2:B2');
  const infoSubtitle = info.getCell('A2');
  infoSubtitle.value = `${title} — ${branding.sloganAr}`;
  infoSubtitle.font = { name: FONT, size: 10, color: { argb: 'FF6B7280' } };
  infoSubtitle.alignment = { horizontal: 'right', vertical: 'middle' };
  info.getRow(2).height = 20;

  const infoRows: [string, string][] = [
    ['اسم المنصة', branding.systemName],
    ['نوع البيانات', title],
    ['الوصف', description || '—'],
    ['عدد السجلات', String(rows.length)],
    ['الفلاتر المطبقة', filters.length ? filters.map((f) => `${f.label}: ${f.value}`).join(' | ') : 'بدون فلاتر'],
    ['تاريخ الإصدار', now.toLocaleString('ar-EG')],
    ['تم التصدير بواسطة', exportedBy || '—'],
    ['صلاحية المُصدِّر', exportedByRole || '—'],
    ['الأعمدة', columns.map((c) => c.header).join('، ')],
    ['ملاحظة', 'الملف قابل للتعديل بالكامل ويمكن إعادة استخدامه كقاعدة بيانات.'],
    ['إخلاء مسؤولية', DISCLAIMER],
  ];

  let infoCursor = 4;
  infoRows.forEach(([label, value]) => {
    const labelCell = info.getCell(`A${infoCursor}`);
    const valueCell = info.getCell(`B${infoCursor}`);
    labelCell.value = label;
    labelCell.font = { name: FONT, size: 10, bold: true, color: { argb: 'FF374151' } };
    labelCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: primarySoft } };
    labelCell.alignment = { horizontal: 'right', vertical: 'middle', readingOrder: 'rtl' };
    labelCell.border = { bottom: { style: 'hair', color: { argb: BORDER } } };

    valueCell.value = value;
    valueCell.font = { name: FONT, size: 10, color: { argb: 'FF111827' } };
    valueCell.alignment = { horizontal: 'right', vertical: 'middle', wrapText: true, readingOrder: 'rtl' };
    valueCell.border = { bottom: { style: 'hair', color: { argb: BORDER } } };
    info.getRow(infoCursor).height = label === 'الأعمدة' || label === 'إخلاء مسؤولية' ? 34 : 22;
    infoCursor += 1;
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

/** Make a value safe for a Content-Disposition filename. */
export function safeFilename(name: string, extension = 'xlsx'): string {
  const base = name
    .trim()
    .replace(/[\\/:*?"<>|]/g, '-')
    .replace(/\s+/g, '-')
    .slice(0, 80);
  return `${base || 'export'}-${new Date().toISOString().slice(0, 10)}.${extension}`;
}
