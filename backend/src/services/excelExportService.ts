import ExcelJS from 'exceljs';
import { sql } from '../db/helpers';
import { DEFAULT_LOGO_DATA_URL } from '../config/brandLogo';
import { UNIT_LOGO_B64, INSTITUTE_LOGO_B64 } from '../config/reportLogos';

/**
 * Branded Excel exporter.
 *
 * Every workbook produced here is:
 *  - RTL (Arabic sheet direction) and print-ready (A4 landscape)
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
  /** Value → status badge rendering (matched on the raw cell value, e.g. attendance status). */
  badge?: Record<string, { label: string; tone: 'success' | 'danger' | 'neutral' }>;
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
  /** Optional label/value pairs rendered above the table (report info block, e.g. course/group header). */
  infoBlock?: { label: string; value: string }[];
  /** Show the instructor signature block alongside the unit director signature (per A1, for group/lecture reports). */
  showInstructorSignature?: boolean;
  /** Name of instructor to show under the instructor signature label. */
  instructorName?: string;
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

// ─── Merge helper ──────────────────────────────────────────────────

/** Merge a rectangular range only when it covers more than one cell (ExcelJS safety). */
function safeMerge(
  ws: ExcelJS.Worksheet,
  startCol: number,
  startRow: number,
  endCol: number,
  endRow: number,
): void {
  if (startCol === endCol && startRow === endRow) return;
  const from = `${ws.getColumn(startCol).letter}${startRow}`;
  const to = `${ws.getColumn(endCol).letter}${endRow}`;
  ws.mergeCells(`${from}:${to}`);
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

/** Light fills + readable text colors for status badges (WCAG-safe pairs). */
const BADGE_STYLE: Record<'success' | 'danger' | 'neutral', { fill: string; color: string }> = {
  success: { fill: 'FFE7F6EC', color: 'FF166534' },
  danger: { fill: 'FFFDE8E8', color: 'FF991B1B' },
  neutral: { fill: 'FFF3F4F6', color: 'FF374151' },
};

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
    infoBlock = [],
    showInstructorSignature = false,
    instructorName,
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

  // ── Ensure minimum sheet width for the dual-logo header (D6) ──
  // Distribute deficit across expandable columns so narrow '#' columns stay compact.
  const rawColWidths = columns.map((c) => columnWidth(c, rows));
  const totalWidth = rawColWidths.reduce((s, w) => s + w, 0);
  if (totalWidth < 110) {
    const diff = 110 - totalWidth;
    const expandable = columns
      .map((c, i) => ({ c, i }))
      .filter(({ c }) => c.key !== 'id' && (!c.width || c.width > 10));
    const targets = expandable.length > 0 ? expandable.map((x) => x.i) : rawColWidths.map((_, i) => i);
    const addEach = Math.floor(diff / targets.length);
    let rem = diff % targets.length;
    for (const idx of targets) {
      rawColWidths[idx] += addEach + (rem > 0 ? 1 : 0);
      if (rem > 0) rem -= 1;
    }
  }

  // ── Header block (D6) ─────────────────────────────────────────
  // Fixed report logos (trimmed PNGs embedded at build time, height 110px).
  const LOGO_HEIGHT_PX = 110; // ≈ 82.5pt
  const logoSize = (origW: number, origH: number) => {
    const ratio = origW && origH ? origW / origH : 1;
    return { height: LOGO_HEIGHT_PX, width: Math.round(LOGO_HEIGHT_PX * ratio) };
  };
  // unit: 478×365, institute: 351×298
  const unitSz = logoSize(478, 365); // 144×110
  const instSz = logoSize(351, 298); // 130×110

  // Gutter column for unit logo (leftmost in RTL view = rightmost column index)
  const unitGutterWidthUnits = Math.max(14, Math.ceil((unitSz.width + 14) / 7));
  const unitGutterIndex = columnCount + 1;
  const lastCol = ws.getColumn(unitGutterIndex).letter;

  const allWidths = [...rawColWidths, unitGutterWidthUnits];
  ws.columns = [
    ...columns.map((column, i) => ({ key: column.key, width: rawColWidths[i] })),
    { width: unitGutterWidthUnits },
  ];

  // Institute logo — anchored at col A (rightmost in RTL), rows 1–4.
  // Skip enough leading columns so the 130px (~20 width units) logo never overlaps title text.
  const instLogoMinUnits = Math.ceil((instSz.width + 14) / 7);
  let titleStartColumn = 1;
  let rightLogoZoneWidth = 0;
  const totalDataWidth = rawColWidths.reduce((s, w) => s + w, 0);
  for (let i = 0; i < columnCount - 1; i++) {
    if (rightLogoZoneWidth >= instLogoMinUnits) break;
    if (totalDataWidth - (rightLogoZoneWidth + rawColWidths[i]) < 55) break;
    rightLogoZoneWidth += rawColWidths[i];
    titleStartColumn = i + 2;
  }
  const titleEndColumn = Math.max(titleStartColumn, unitGutterIndex - 1);

  const instLogoId = workbook.addImage({ base64: INSTITUTE_LOGO_B64, extension: 'png' });
  ws.addImage(instLogoId, { tl: { col: 0, row: 0 }, ext: instSz, editAs: 'oneCell' });
  if (titleStartColumn > 1) {
    safeMerge(ws, 1, 1, titleStartColumn - 1, 4);
  }

  // Unit logo — anchored at gutter column (leftmost in RTL), rows 1–4
  const unitLogoId = workbook.addImage({ base64: UNIT_LOGO_B64, extension: 'png' });
  ws.addImage(unitLogoId, { tl: { col: unitGutterIndex - 1, row: 0 }, ext: unitSz, editAs: 'oneCell' });
  safeMerge(ws, unitGutterIndex, 1, unitGutterIndex, 4);

  const titleStartLetter = ws.getColumn(titleStartColumn).letter;

  // Center header block: institute name → unit name → report title → slogan/description
  // Total height = 24 + 24 + 30 + 20 = 98pt (≥ 90pt / ~131px > 110px logo height)
  safeMerge(ws, titleStartColumn, 1, titleEndColumn, 1);
  const instNameCell = ws.getCell(`${titleStartLetter}1`);
  instNameCell.value = 'المعهد العالي للعلوم الإدارية بالقطامية (HIMS)';
  instNameCell.font = { name: FONT, size: 12, bold: true, color: { argb: primary } };
  instNameCell.alignment = { horizontal: 'center', vertical: 'middle', readingOrder: 'rtl' };
  ws.getRow(1).height = 24;

  safeMerge(ws, titleStartColumn, 2, titleEndColumn, 2);
  const unitNameCell = ws.getCell(`${titleStartLetter}2`);
  unitNameCell.value = branding.systemName;
  unitNameCell.font = { name: FONT, size: 11, bold: true, color: { argb: secondary } };
  unitNameCell.alignment = { horizontal: 'center', vertical: 'middle', readingOrder: 'rtl' };
  ws.getRow(2).height = 24;

  safeMerge(ws, titleStartColumn, 3, titleEndColumn, 3);
  const titleCell = ws.getCell(`${titleStartLetter}3`);
  titleCell.value = title;
  titleCell.font = { name: FONT, size: 16, bold: true, color: { argb: 'FF111827' } };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle', readingOrder: 'rtl' };
  ws.getRow(3).height = 30;

  safeMerge(ws, titleStartColumn, 4, titleEndColumn, 4);
  const subtitleCell = ws.getCell(`${titleStartLetter}4`);
  subtitleCell.value = [branding.sloganAr, description].filter(Boolean).join(' · ');
  subtitleCell.font = { name: FONT, size: 9, color: { argb: 'FF6B7280' } };
  subtitleCell.alignment = { horizontal: 'center', vertical: 'middle', readingOrder: 'rtl' };
  ws.getRow(4).height = 20;

  // Meta line: filters (omit keys already shown in infoBlock) + count + timestamp
  safeMerge(ws, 1, 5, unitGutterIndex, 5);
  const metaCell = ws.getCell('A5');
  const infoBlockLabels = new Set(infoBlock.map((x) => x.label));
  const filteredFilters = filters.filter((f) => !infoBlockLabels.has(f.label));
  const filterText = filteredFilters.length ? filteredFilters.map((f) => `${f.label}: ${f.value}`).join('  |  ') : 'بدون فلاتر';
  metaCell.value = `عدد السجلات: ${rows.length}   |   ${filterText}   |   تاريخ الإصدار: ${now.toLocaleString('ar-EG')}`;
  metaCell.font = { name: FONT, size: 9, color: { argb: 'FF4B5563' } };
  metaCell.alignment = { horizontal: 'right', vertical: 'middle', readingOrder: 'rtl' };
  metaCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: primarySoft } };
  metaCell.border = { bottom: { style: 'thin', color: { argb: BORDER } } };
  ws.getRow(5).height = 22;

  // Find balanced split column (1..unitGutterIndex-1) so 2-column blocks divide width evenly
  const totalSheetWidth = allWidths.reduce((s, w) => s + w, 0);
  const halfWidth = totalSheetWidth / 2;
  let splitCol = 1;
  let bestDiff = Infinity;
  let accW = 0;
  for (let i = 0; i < unitGutterIndex - 1; i++) {
    accW += allWidths[i];
    const diff = Math.abs(accW - halfWidth);
    if (diff < bestDiff) {
      bestDiff = diff;
      splitCol = i + 1;
    }
  }

  // ── Report info block (2-column metadata grid above the table) ─
  let infoBlockRow = 6;
  const styleInfoCell = (cell: ExcelJS.Cell, label: string, value: string) => {
    cell.value = {
      richText: [
        { text: `${label}: `, font: { name: FONT, size: 9, bold: true, color: { argb: 'FF374151' } } },
        { text: value, font: { name: FONT, size: 9, color: { argb: 'FF111827' } } },
      ],
    };
    cell.alignment = { horizontal: 'right', vertical: 'middle', wrapText: true, readingOrder: 'rtl' };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: primarySoft } };
    cell.border = {
      top: { style: 'thin', color: { argb: BORDER } },
      bottom: { style: 'thin', color: { argb: BORDER } },
      left: { style: 'thin', color: { argb: BORDER } },
      right: { style: 'thin', color: { argb: BORDER } },
    };
  };

  for (let i = 0; i < infoBlock.length; i += 2) {
    const rightItem = infoBlock[i];
    const leftItem = infoBlock[i + 1];
    if (leftItem) {
      safeMerge(ws, 1, infoBlockRow, splitCol, infoBlockRow);
      styleInfoCell(ws.getCell(`A${infoBlockRow}`), rightItem.label, rightItem.value);

      safeMerge(ws, splitCol + 1, infoBlockRow, unitGutterIndex, infoBlockRow);
      styleInfoCell(ws.getCell(`${ws.getColumn(splitCol + 1).letter}${infoBlockRow}`), leftItem.label, leftItem.value);
    } else {
      safeMerge(ws, 1, infoBlockRow, unitGutterIndex, infoBlockRow);
      styleInfoCell(ws.getCell(`A${infoBlockRow}`), rightItem.label, rightItem.value);
    }
    ws.getRow(infoBlockRow).height = 22;
    infoBlockRow += 1;
  }

  ws.getRow(infoBlockRow).height = 6;

  // ── Table header ──────────────────────────────────────────────
  const headerRowIndex = infoBlockRow + 1;
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
  ws.views = [{ rightToLeft: true, showGridLines: false }];

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
        // Status badge columns: value → label with a tone fill (text is always
        // present, so the color is never the only signal).
        const badge = column.badge?.[String(record[column.key] ?? '')];
        cell.value = badge ? badge.label : cellValue(record[column.key], column.type);
        cell.font = badge
          ? { name: FONT, size: 10, bold: true, color: { argb: BADGE_STYLE[badge.tone].color } }
          : { name: FONT, size: 10, color: { argb: 'FF111827' } };
        cell.alignment = cellAlignment(badge ? 'text' : column.type);
        const format = numFmt(column.type);
        if (format) cell.numFmt = format;
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: {
            argb: badge
              ? BADGE_STYLE[badge.tone].fill
              : rowIndex % 2 === 0
                ? 'FFFFFFFF'
                : stripe,
          },
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
  const hasTotals = totalColumns.length > 0 && rows.length > 0;
  const disclaimer = branding.messageFooter || DISCLAIMER;
  const notes = [
    footerNote,
    hasTotals
      ? 'يمكن تعديل أي خلية مباشرة في هذا الملف. صف الإجماليات يستخدم دالة SUBTOTAL ويتحدّث تلقائيًا مع القيم أو الفلاتر.'
      : 'يمكن تعديل أي خلية مباشرة في هذا الملف.',
    disclaimer,
  ].filter(Boolean) as string[];

  notes.forEach((note) => {
    safeMerge(ws, 1, cursor, unitGutterIndex, cursor);
    const cell = ws.getCell(`A${cursor}`);
    cell.value = note;
    cell.font = { name: FONT, size: 9, color: { argb: 'FF6B7280' } };
    cell.alignment = { horizontal: 'right', vertical: 'middle', wrapText: true, readingOrder: 'rtl' };
    ws.getRow(cursor).height = 18;
    cursor += 1;
  });

  // ── Signatures (A1: instructor + director for group/lecture reports; director only otherwise) ──
  cursor += 1;
  const sigRightEnd = splitCol;
  const sigLeftStart = splitCol + 1;

  if (showInstructorSignature) {
    safeMerge(ws, 1, cursor, sigRightEnd, cursor);
    const instSigLabel = ws.getCell(`A${cursor}`);
    instSigLabel.value = instructorName ? `توقيع المحاضر (${instructorName})` : 'توقيع المحاضر';
    instSigLabel.font = { name: FONT, size: 10, bold: true, color: { argb: 'FF1F2937' } };
    instSigLabel.alignment = { horizontal: 'center', vertical: 'middle', readingOrder: 'rtl' };

    safeMerge(ws, 1, cursor + 1, sigRightEnd, cursor + 1);
    const instSigLine = ws.getCell(`A${cursor + 1}`);
    instSigLine.value = '........................................';
    instSigLine.font = { name: FONT, size: 10, color: { argb: 'FF6B7280' } };
    instSigLine.alignment = { horizontal: 'center', vertical: 'bottom' };
  }

  safeMerge(ws, sigLeftStart, cursor, unitGutterIndex, cursor);
  const dirSigLabel = ws.getCell(`${ws.getColumn(sigLeftStart).letter}${cursor}`);
  dirSigLabel.value = 'اعتماد مدير الوحدة';
  dirSigLabel.font = { name: FONT, size: 10, bold: true, color: { argb: 'FF1F2937' } };
  dirSigLabel.alignment = { horizontal: 'center', vertical: 'middle', readingOrder: 'rtl' };

  safeMerge(ws, sigLeftStart, cursor + 1, unitGutterIndex, cursor + 1);
  const dirSigLine = ws.getCell(`${ws.getColumn(sigLeftStart).letter}${cursor + 1}`);
  dirSigLine.value = '........................................';
  dirSigLine.font = { name: FONT, size: 10, color: { argb: 'FF6B7280' } };
  dirSigLine.alignment = { horizontal: 'center', vertical: 'bottom' };

  ws.getRow(cursor).height = 22;
  ws.getRow(cursor + 1).height = 36;
  cursor += 2;

  // ── Print header/footer ───────────────────────────────────────
  ws.headerFooter = {
    oddHeader: `&R&"${FONT},Bold"&10${branding.systemName}&L&"${FONT}"&9${title}`,
    oddFooter: `&C&"${FONT}"&8صفحة &P من &N`,
  };

  // ── Info sheet ────────────────────────────────────────────────
  const info = workbook.addWorksheet('معلومات التقرير', {
    views: [{ rightToLeft: true, showGridLines: false }],
    properties: { tabColor: { argb: secondary } },
    pageSetup: {
      paperSize: 9,
      orientation: 'landscape',
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      horizontalCentered: true,
    },
  });
  info.columns = [{ width: 26 }, { width: 62 }, { width: 23 }];

  // Dual-logo band: institute (HIMS) right (col A), unit left (col C), header text centered in col B.
  const infoInstId = workbook.addImage({ base64: INSTITUTE_LOGO_B64, extension: 'png' });
  info.addImage(infoInstId, { tl: { col: 0, row: 0 }, ext: instSz, editAs: 'oneCell' });
  info.mergeCells('A1:A4');

  const infoUnitId = workbook.addImage({ base64: UNIT_LOGO_B64, extension: 'png' });
  info.addImage(infoUnitId, { tl: { col: 2, row: 0 }, ext: unitSz, editAs: 'oneCell' });
  info.mergeCells('C1:C4');

  const infoInstName = info.getCell('B1');
  infoInstName.value = 'المعهد العالي للعلوم الإدارية بالقطامية (HIMS)';
  infoInstName.font = { name: FONT, size: 12, bold: true, color: { argb: primary } };
  infoInstName.alignment = { horizontal: 'center', vertical: 'middle', readingOrder: 'rtl' };
  info.getRow(1).height = 24;

  const infoUnitName = info.getCell('B2');
  infoUnitName.value = branding.systemName;
  infoUnitName.font = { name: FONT, size: 11, bold: true, color: { argb: secondary } };
  infoUnitName.alignment = { horizontal: 'center', vertical: 'middle', readingOrder: 'rtl' };
  info.getRow(2).height = 24;

  const infoTitle = info.getCell('B3');
  infoTitle.value = title;
  infoTitle.font = { name: FONT, size: 15, bold: true, color: { argb: 'FF111827' } };
  infoTitle.alignment = { horizontal: 'center', vertical: 'middle', readingOrder: 'rtl' };
  info.getRow(3).height = 28;

  const infoSubtitle = info.getCell('B4');
  infoSubtitle.value = branding.sloganAr;
  infoSubtitle.font = { name: FONT, size: 9, color: { argb: 'FF6B7280' } };
  infoSubtitle.alignment = { horizontal: 'center', vertical: 'middle', readingOrder: 'rtl' };
  info.getRow(4).height = 20;

  info.getRow(5).height = 8;

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

  let infoCursor = 6;
  infoRows.forEach(([label, value]) => {
    info.mergeCells(`B${infoCursor}:C${infoCursor}`);
    const labelCell = info.getCell(`A${infoCursor}`);
    const valueCell = info.getCell(`B${infoCursor}`);
    labelCell.value = label;
    labelCell.font = { name: FONT, size: 10, bold: true, color: { argb: 'FF374151' } };
    labelCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: primarySoft } };
    labelCell.alignment = { horizontal: 'right', vertical: 'middle', readingOrder: 'rtl' };
    labelCell.border = { bottom: { style: 'thin', color: { argb: BORDER } } };

    valueCell.value = value;
    valueCell.font = { name: FONT, size: 10, color: { argb: 'FF111827' } };
    valueCell.alignment = { horizontal: 'right', vertical: 'middle', wrapText: true, readingOrder: 'rtl' };
    valueCell.border = { bottom: { style: 'thin', color: { argb: BORDER } } };
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
