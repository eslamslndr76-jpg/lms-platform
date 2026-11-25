import { Router, Request, Response } from 'express';
import { sql } from '../db/helpers';
import { authMiddleware } from '../middleware/auth';
import {
  CERT_PATTERN_DATA_URL,
  CERT_WATERMARK_DATA_URL,
  CERT_UNIT_LOGO_DATA_URL,
  CERT_INSTITUTE_LOGO_DATA_URL,
  CERT_DIVIDER_DATA_URL,
  CERT_CORNER_SVG_DATA_URL,
  CERT_FLOURISH_SVG_DATA_URL,
} from '../config/certificateAssets';

const router = Router();

// Fixed signers and identity per the approved design reference
// (docs/certificate-design). The unit-manager name honours the existing
// 'certificate' setting when one is configured.
const CERT_CHAIRMAN_NAME = 'أ.د. عادل المهدي';
const CERT_DEAN_NAME = 'أ.د. عمر صقر';
const CERT_UNIT_MANAGER_DEFAULT = 'د. شيماء عبدالدايم';
const ARABIC_MONTHS = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيه', 'يوليه', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];

// ─── Shared certificate rendering: one data builder, one template ───

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Egyptian national-id digit normalization (Arabic/Indic → Latin). */
function normalizeDigits(value: unknown): string {
  const arabicIndic = '٠١٢٣٤٥٦٧٨٩';
  const easternArabicIndic = '۰۱۲۳۴۵۶۷۸۹';
  return String(value || '')
    .replace(/[٠-٩]/g, (ch) => String(arabicIndic.indexOf(ch)))
    .replace(/[۰-۹]/g, (ch) => String(easternArabicIndic.indexOf(ch)))
    .replace(/[\s-]/g, '');
}

/**
 * Structural national-id check (format only — NOT an identity verification):
 * 14 digits, century code 2/3, valid birth date, known governorate code.
 * Digit 13 (odd = male, even = female) decides the wording, per the design
 * reference. Returns null when the id is missing or invalid.
 */
function genderFromNationalId(nationalId: unknown): 'male' | 'female' | null {
  const id = normalizeDigits(nationalId);
  if (!/^\d{14}$/.test(id)) return null;
  const centuryCode = id[0];
  if (centuryCode !== '2' && centuryCode !== '3') return null;
  const year = Number((centuryCode === '2' ? '19' : '20') + id.slice(1, 3));
  const month = Number(id.slice(3, 5));
  const day = Number(id.slice(5, 7));
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  const governorate = id.slice(7, 9);
  const validGovernorates = new Set([
    '01', '02', '03', '04', '11', '12', '13', '14', '15', '16', '17', '18', '19',
    '21', '22', '23', '24', '25', '26', '27', '28', '29', '31', '32', '33', '34', '35', '88',
  ]);
  if (!validGovernorates.has(governorate)) return null;
  return Number(id[12]) % 2 === 0 ? 'female' : 'male';
}

/**
 * الطالب/الطالبة wording: the registered gender field first, then the
 * national-id structure. When neither is conclusive the wording stays neutral
 * (both forms) and a warning is logged for the admin — never a guess.
 */
function resolveGenderTexts(genderField: unknown, nationalId: unknown, userId: number) {
  const g = String(genderField || '').trim().toLowerCase();
  if (g === 'female' || g === 'أنثى' || g === 'f') {
    return { studentLabel: 'الطالبة', completionVerb: 'قد اجتازت بنجاح الدورة التدريبية' };
  }
  if (g === 'male' || g === 'ذكر' || g === 'm') {
    return { studentLabel: 'الطالب', completionVerb: 'قد اجتاز بنجاح الدورة التدريبية' };
  }
  const derived = genderFromNationalId(nationalId);
  if (derived === 'female') return { studentLabel: 'الطالبة', completionVerb: 'قد اجتازت بنجاح الدورة التدريبية' };
  if (derived === 'male') return { studentLabel: 'الطالب', completionVerb: 'قد اجتاز بنجاح الدورة التدريبية' };
  console.warn(
    `[Certificate] Gender unknown for student ${userId} (missing/invalid gender and national_id) — neutral wording used; please review the student record.`,
  );
  return { studentLabel: 'الطالب/الطالبة', completionVerb: 'قد اجتاز/اجتازت بنجاح الدورة التدريبية' };
}

// Certificate page: A4 landscape (297×210mm), the approved reference design.
// Assets are inlined as data URLs so the HTML is fully self-contained.
const CERTIFICATE_TEMPLATE = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>شهادة {{serialId}}</title>
  <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Arabic:wght@400;700;800;900&family=Amiri:wght@400;700&display=swap" rel="stylesheet">
  <style>
    @page { size: A4 landscape; margin: 0; }
    :root {
      --navy: #18366f;
      --navy-deep: #102958;
      --blue: #159bc8;
      --gold: #ad9143;
      --gold-light: #d8c58b;
      --paper: #fffdf7;
      --ink: #1b2d55;
    }
    * { box-sizing: border-box; }
    html, body { margin: 0; width: 297mm; height: 210mm; background: #fff; }
    body {
      font-family: "Noto Sans Arabic", "Noto Naskh Arabic", "Amiri", Tahoma, sans-serif;
      color: var(--ink);
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .certificate {
      position: relative;
      direction: ltr;
      width: 297mm;
      height: 210mm;
      overflow: hidden;
      background: var(--paper);
      isolation: isolate;
    }
    /* Repeated geometric arabesque pattern: visible but soft behind the text. */
    .pattern-layer {
      position: absolute;
      z-index: 0;
      top: 8mm;
      right: 8mm;
      bottom: 8mm;
      left: 8mm;
      background-image: url("__ASSET_PATTERN__");
      background-size: 34mm 34mm;
      background-repeat: repeat;
      opacity: .36;
      pointer-events: none;
    }
    .watermark {
      position: absolute;
      z-index: 1;
      width: 120mm;
      height: 120mm;
      object-fit: contain;
      left: 88.5mm;
      top: 43mm;
      opacity: .12;
      pointer-events: none;
    }
    .outer-border, .inner-border {
      position: absolute;
      pointer-events: none;
      z-index: 8;
    }
    .outer-border { top: 5mm; right: 5mm; bottom: 5mm; left: 5mm; border: .65mm solid var(--navy); }
    .inner-border { top: 7mm; right: 7mm; bottom: 7mm; left: 7mm; border: .25mm solid var(--gold); }
    .corner {
      position: absolute;
      z-index: 9;
      width: 25mm;
      height: 25mm;
      object-fit: contain;
      pointer-events: none;
    }
    .corner-tl { top: 4.5mm; left: 4.5mm; }
    .corner-tr { top: 4.5mm; right: 4.5mm; transform: scaleX(-1); }
    .corner-bl { bottom: 4.5mm; left: 4.5mm; transform: scaleY(-1); }
    .corner-br { bottom: 4.5mm; right: 4.5mm; transform: scale(-1); }
    .header {
      position: absolute;
      top: 8mm;
      left: 15mm;
      right: 15mm;
      height: 34mm;
      display: block;
      z-index: 5;
      direction: ltr;
    }
    .logo-box {
      position: absolute;
      top: 0;
      height: 31mm;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
    }
    .unit-logo-box { left: 9mm; width: 42mm; }
    .institute-logo-box { right: 9mm; width: 42mm; }
    .unit-logo { width: 37mm; height: 29mm; object-fit: contain; }
    .institute-logo { width: 39mm; height: 30mm; object-fit: contain; }
    .title-block {
      position: absolute;
      top: 0.5mm;
      left: 50%;
      transform: translateX(-50%);
      width: 138mm;
      text-align: center;
      padding: 0 4mm;
    }
    .title-kicker {
      color: var(--blue);
      font: 700 9.5pt "DejaVu Sans", sans-serif;
      letter-spacing: 2px;
      margin-bottom: 1mm;
    }
    .title-heading {
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 17mm;
      margin: .2mm auto 0;
    }
    .title-flourish {
      position: absolute;
      top: 50%;
      width: 30mm;
      height: 10mm;
      object-fit: fill;
      transform: translateY(-50%);
      opacity: .98;
    }
    .title-flourish-left { left: 3mm; }
    .title-flourish-right { right: 3mm; transform: translateY(-50%) scaleX(-1); }
    h1 {
      position: relative;
      margin: 0;
      padding: 0 3mm 1mm;
      color: var(--navy);
      font-family: "Amiri", "Noto Naskh Arabic", "Noto Sans Arabic", serif;
      font-size: 43pt;
      line-height: 1.12;
      font-weight: 700;
      text-shadow: 0 .35mm 0 rgba(173,145,67,.30), 0 .8mm 1mm rgba(16,41,88,.10);
    }
    .title-rule {
      display: flex;
      align-items: center;
      gap: 3mm;
      justify-content: center;
      margin: 1mm auto 0;
      width: 62mm;
      color: var(--gold);
    }
    .title-rule span { height: .6mm; background: var(--gold); flex: 1; }
    .title-rule b { font-size: 14pt; line-height: 1; }
    .content {
      direction: rtl;
      position: absolute;
      z-index: 3;
      top: 47mm;
      left: 22mm;
      right: 22mm;
      height: 111mm;
      text-align: center;
    }
    .intro {
      margin: 0 auto 1mm;
      max-width: 205mm;
      color: var(--navy);
      font-family: "Noto Sans Arabic", "Noto Naskh Arabic", Tahoma, sans-serif;
      font-size: 20.5pt;
      line-height: 1.48;
      font-weight: 700;
    }
    .intro strong { color: #087fae; font-weight: 800; }
    .student-name {
      margin: 2mm auto 1.5mm;
      color: #a1873b;
      font-family: "Noto Sans Arabic", "Noto Naskh Arabic", Tahoma, sans-serif;
      font-size: 38pt;
      line-height: 1.25;
      font-weight: 800;
      letter-spacing: -.2px;
      text-shadow: 0 .25mm 0 rgba(100,80,20,.09);
      max-width: 175mm;
      white-space: nowrap;
      overflow: hidden;
    }
    .completion-verb {
      margin: 1mm 0 0;
      color: var(--navy);
      font-family: "Noto Sans Arabic", "Noto Naskh Arabic", Tahoma, sans-serif;
      font-size: 21pt;
      font-weight: 700;
      line-height: 1.42;
    }
    .course-name {
      margin: 2.2mm auto 0;
      color: #15243a;
      font-family: "Aptos", "Segoe UI", "DejaVu Sans", "Noto Sans Arabic", sans-serif;
      font-size: 29pt;
      font-weight: 700;
      line-height: 1.22;
      max-width: 175mm;
      white-space: nowrap;
      direction: auto;
      unicode-bidi: isolate;
    }
    .course-meta {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 5mm;
      width: 184mm;
      margin: 6mm auto 0;
    }
    .course-meta p {
      margin: 0;
      padding: 2.8mm 8mm;
      border: .4mm solid var(--gold);
      border-radius: 3.5mm;
      color: var(--navy);
      background: rgba(255,253,247,.9);
      font-family: "Noto Sans Arabic", "Noto Naskh Arabic", Tahoma, sans-serif;
      font-size: 18pt;
      font-weight: 700;
      white-space: nowrap;
    }
    .meta-line { height: .5mm; flex: 1; max-width: 22mm; background: var(--gold); }
    /* Verification card: scannable QR + the same serial printed as real text. */
    .verification-card {
      position: absolute;
      z-index: 6;
      right: 20mm;
      top: 63mm;
      direction: ltr;
      width: 47mm;
      min-height: 59mm;
      padding: 2mm 2mm 1.7mm;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: flex-start;
      gap: .85mm;
      text-align: center;
      background: rgba(255,253,247,.96);
      border: .45mm solid var(--gold);
      border-radius: 3.4mm;
      box-shadow: inset 0 0 0 .45mm rgba(216,197,139,.48), 0 .5mm 1.2mm rgba(16,41,88,.07);
    }
    .verification-card::before,
    .verification-card::after {
      content: "✦";
      position: absolute;
      top: 2.3mm;
      color: var(--gold);
      font-size: 7pt;
      line-height: 1;
    }
    .verification-card::before { left: 2.4mm; }
    .verification-card::after { right: 2.4mm; }
    .verification-title {
      direction: rtl;
      width: 100%;
      padding: 0 4mm .6mm;
      color: var(--navy);
      font-family: "Noto Sans Arabic", "Noto Naskh Arabic", Tahoma, sans-serif;
      font-size: 8.6pt;
      line-height: 1.35;
      font-weight: 800;
      white-space: nowrap;
    }
    .verification-link {
      /* Full-width flex row so the QR frame is centered on the card axis. */
      display: flex;
      width: 100%;
      min-width: 0;
      padding: 0;
      margin: 0 auto;
      align-items: center;
      justify-content: center;
      align-self: stretch;
      text-align: center;
      text-decoration: none;
      line-height: 0;
      direction: ltr;
    }
    .qr-frame {
      display: flex;
      flex: 0 0 30.5mm;
      width: 30.5mm;
      height: 30.5mm;
      padding: 1.1mm;
      margin: 0 auto;
      align-items: center;
      justify-content: center;
      background: #fff;
      border: .45mm solid var(--navy);
      border-radius: 1.6mm;
    }
    .qr-frame img {
      display: block;
      width: 100%;
      height: 100%;
      object-fit: contain;
      image-rendering: pixelated;
    }
    .verification-hint {
      direction: rtl;
      color: var(--navy);
      font-family: "Noto Sans Arabic", "Noto Naskh Arabic", Tahoma, sans-serif;
      font-size: 6.5pt;
      font-weight: 700;
      line-height: 1.25;
      width: 100%;
      text-align: center;
      white-space: nowrap;
    }
    .serial-label {
      direction: rtl;
      margin-top: .2mm;
      color: #8b7130;
      font-family: "Noto Sans Arabic", "Noto Naskh Arabic", Tahoma, sans-serif;
      width: 100%;
      text-align: center;
      font-size: 6.5pt;
      font-weight: 800;
      line-height: 1.1;
    }
    .certificate-serial {
      max-width: 100%;
      color: var(--navy-deep);
      font-family: "DejaVu Sans", "Liberation Mono", monospace;
      width: 100%;
      text-align: center;
      font-size: 7.6pt;
      line-height: 1.2;
      font-weight: 800;
      letter-spacing: .15px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: clip;
    }
    .divider-bottom {
      position: absolute;
      z-index: 3;
      left: 58mm;
      right: 58mm;
      bottom: 48mm;
      width: 181mm;
      height: 8mm;
      object-fit: fill;
      opacity: .95;
    }
    .signatures {
      position: absolute;
      z-index: 4;
      left: 18mm;
      right: 18mm;
      bottom: 10mm;
      height: 35mm;
      display: block;
      direction: ltr;
    }
    .signature {
      position: absolute;
      top: 0;
      width: 75mm;
      min-width: 0;
      overflow: visible;
      text-align: center;
      direction: rtl;
    }
    .signature:nth-child(1) { left: 0; }
    .signature:nth-child(2) { left: 50%; transform: translateX(-50%); }
    .signature:nth-child(3) { right: 0; }
    .signature-role {
      max-width: 100%;
      margin: 0 0 2.3mm;
      color: var(--navy);
      font-family: "Noto Sans Arabic", "Noto Naskh Arabic", Tahoma, sans-serif;
      font-size: 15pt;
      line-height: 1.4;
      font-weight: 700;
      white-space: normal;
    }
    .signature-name {
      margin: 0;
      padding-top: 2.5mm;
      border-top: .25mm solid rgba(24,54,111,.38);
      color: var(--navy-deep);
      font-family: "Noto Sans Arabic", "Noto Naskh Arabic", Tahoma, sans-serif;
      font-size: 18pt;
      font-weight: 700;
    }
    @media screen {
      html, body { width: 100%; min-height: 100%; height: auto; background: #e8ebf2; }
      .certificate { margin: 18px auto; box-shadow: 0 12px 40px rgba(10,25,60,.18); }
    }
    @media print {
      html, body { width: 297mm; height: 210mm; background: #fff; }
      .certificate { margin: 0; box-shadow: none; }
    }
  </style>
</head>
<body>
  <main class="certificate" aria-label="شهادة إتمام دورة تدريبية">
    <div class="pattern-layer" aria-hidden="true"></div>
    <img class="watermark" src="__ASSET_WATERMARK__" alt="" aria-hidden="true">

    <div class="outer-border" aria-hidden="true"></div>
    <div class="inner-border" aria-hidden="true"></div>

    <img class="corner corner-tl" src="__ASSET_CORNER__" alt="" aria-hidden="true">
    <img class="corner corner-tr" src="__ASSET_CORNER__" alt="" aria-hidden="true">
    <img class="corner corner-bl" src="__ASSET_CORNER__" alt="" aria-hidden="true">
    <img class="corner corner-br" src="__ASSET_CORNER__" alt="" aria-hidden="true">

    <header class="header">
      <div class="logo-box unit-logo-box">
        <img src="__ASSET_UNIT_LOGO__" alt="شعار وحدة التدريب والتطوير بالمعهد" class="unit-logo">
      </div>

      <div class="title-block">
        <div class="title-kicker">H.I.M.S · T.D.U</div>
        <div class="title-heading">
          <img class="title-flourish title-flourish-left" src="__ASSET_FLOURISH__" alt="" aria-hidden="true">
          <h1>شهادة</h1>
          <img class="title-flourish title-flourish-right" src="__ASSET_FLOURISH__" alt="" aria-hidden="true">
        </div>
        <div class="title-rule"><span></span><b>✦</b><span></span></div>
      </div>

      <div class="logo-box institute-logo-box">
        <img src="__ASSET_INSTITUTE_LOGO__" alt="شعار المعهد العالي للعلوم الإدارية" class="institute-logo">
      </div>
    </header>

    <section class="content" aria-label="بيانات الشهادة">
      <p class="intro">تشهد وحدة التدريب والتطوير بالمعهد بأن <strong>{{studentLabel}}</strong></p>
      <h2 class="student-name">{{studentName}}</h2>
      <p class="completion-verb">{{completionVerb}}</p>
      <h3 class="course-name" dir="auto">{{courseName}}</h3>

      <div class="course-meta">
        <span class="meta-line"></span>
        <p>{{periodText}}</p>
        <span class="meta-line"></span>
      </div>
    </section>

    <aside class="verification-card" aria-label="التحقق الإلكتروني من الشهادة">
      <div class="verification-title">تحقق من صحة الشهادة</div>
      <a class="verification-link" href="{{verificationUrl}}" aria-label="فتح صفحة التحقق من الشهادة">
        <span class="qr-frame">
          <img src="{{qrDataUrl}}" alt="رمز QR للتحقق من صحة الشهادة">
        </span>
      </a>
      <div class="verification-hint">امسح الرمز لفتح صفحة التحقق</div>
      <div class="serial-label">كود الشهادة (Serial)</div>
      <div class="certificate-serial" dir="ltr">{{serialId}}</div>
    </aside>

    <img class="divider divider-bottom" src="__ASSET_DIVIDER__" alt="">

    <footer class="signatures">
      <section class="signature">
        <p class="signature-role">رئيس مجلس الإدارة</p>
        <p class="signature-name">{{chairmanName}}</p>
      </section>
      <section class="signature">
        <p class="signature-role">عميد المعهد</p>
        <p class="signature-name">{{deanName}}</p>
      </section>
      <section class="signature">
        <p class="signature-role">مدير وحدة التدريب<br>والتطوير</p>
        <p class="signature-name">{{unitManagerName}}</p>
      </section>
    </footer>
  </main>
</body>
</html>`;

// Resolve asset placeholders once at boot (all inlined, no runtime file access).
const CERTIFICATE_HTML_TEMPLATE = CERTIFICATE_TEMPLATE.replace(/__ASSET_(\w+)__/g, (_m, key: string) => {
  const assets: Record<string, string> = {
    PATTERN: CERT_PATTERN_DATA_URL,
    WATERMARK: CERT_WATERMARK_DATA_URL,
    UNIT_LOGO: CERT_UNIT_LOGO_DATA_URL,
    INSTITUTE_LOGO: CERT_INSTITUTE_LOGO_DATA_URL,
    DIVIDER: CERT_DIVIDER_DATA_URL,
    CORNER: CERT_CORNER_SVG_DATA_URL,
    FLOURISH: CERT_FLOURISH_SVG_DATA_URL,
  };
  return assets[key] || '';
});

/**
 * The single certificate data builder + renderer. Every HTML route (public
 * verify by serial, owner view, legacy download) renders through this — one
 * design, one source of data, no duplicated template. No survey or identity
 * data beyond the public name is embedded; the national_id is used only to
 * resolve the wording and never reaches the HTML, QR, logs or errors.
 */
async function renderCertificateFor(
  cert: { serial_id: string; issued_at: string; user_id: number; course_id: number },
  frontendUrl: string,
): Promise<string> {
  const studentResult = await sql('SELECT name, gender, national_id FROM users WHERE id=?', cert.user_id);
  const courseResult = await sql('SELECT title_ar, title_en, lecture_count, lecture_duration FROM courses WHERE id=?', cert.course_id);
  if (studentResult.rows.length === 0 || courseResult.rows.length === 0) {
    throw new Error('Certificate data not found');
  }
  const student = studentResult.rows[0] as any;
  const course = courseResult.rows[0] as any;

  // Completion month/year: the student's own group(s) for this course.
  let completedAt: string | null = null;
  try {
    const completedResult = await sql(
      `SELECT MAX(COALESCE(completed_at, end_date)) AS completed
       FROM groups g
       JOIN group_students gs ON gs.group_id = g.id
       WHERE g.course_id=? AND gs.user_id=?`,
      cert.course_id, cert.user_id,
    );
    completedAt = ((completedResult.rows[0] as any)?.completed as string) || null;
  } catch { /* fall back to the issue date below */ }
  const periodSource = completedAt || cert.issued_at;
  const periodDate = periodSource ? new Date(periodSource) : null;
  const hasPeriod = !!periodDate && !Number.isNaN(periodDate.getTime());
  const completionMonth = hasPeriod ? ARABIC_MONTHS[periodDate!.getMonth()] : '';
  const completionYear = hasPeriod ? String(periodDate!.getFullYear()) : '';

  // Training hours from the course definition; the term is omitted when unknown.
  const hours = course.lecture_count && course.lecture_duration
    ? Number(course.lecture_count) * Number(course.lecture_duration)
    : Number(course.lecture_duration) || null;
  const periodText = hasPeriod
    ? `${completionMonth} ${completionYear}${hours ? ` (بواقع ${hours} ساعة)` : ''}`
    : '';

  const { studentLabel, completionVerb } = resolveGenderTexts(student.gender, student.national_id, Number(cert.user_id));

  let unitManagerName = CERT_UNIT_MANAGER_DEFAULT;
  try {
    const settingsResult = await sql("SELECT value FROM system_settings WHERE key='certificate'");
    if (settingsResult.rows.length > 0) {
      const certSettings = JSON.parse(String(settingsResult.rows[0].value));
      if (typeof certSettings.directorName === 'string' && certSettings.directorName.trim()) {
        unitManagerName = certSettings.directorName.trim();
      }
    }
  } catch { /* keep the design default */ }

  // Real verification link + QR (same serial and page the system already uses).
  const verificationUrl = `${frontendUrl}/verify?serial=${cert.serial_id}`;
  const QRCode = (await import('qrcode')).default;
  const qrDataUrl = await QRCode.toDataURL(verificationUrl, {
    width: 240, margin: 2, color: { dark: '#18366f', light: '#ffffff' },
  });

  const values: Record<string, string> = {
    studentName: escapeHtml(student.name),
    studentLabel: escapeHtml(studentLabel),
    completionVerb: escapeHtml(completionVerb),
    courseName: escapeHtml(course.title_ar || course.title_en || ''),
    periodText: escapeHtml(periodText),
    chairmanName: escapeHtml(CERT_CHAIRMAN_NAME),
    deanName: escapeHtml(CERT_DEAN_NAME),
    unitManagerName: escapeHtml(unitManagerName),
    serialId: escapeHtml(cert.serial_id),
    verificationUrl: escapeHtml(verificationUrl),
    qrDataUrl,
  };
  return CERTIFICATE_HTML_TEMPLATE.replace(/\{\{(\w+)\}\}/g, (match, key: string) =>
    values[key] !== undefined ? values[key] : match,
  );
}
router.get('/my', authMiddleware, async (req: Request, res: Response) => {
  try {
    let result;
    try {
      result = await sql(
        `SELECT cert.id, cert.serial_id, cert.issued_at, cert.status, cert.revoked_at, cert.revoke_reason,
                c.title_ar, c.title_en
         FROM certificates cert JOIN courses c ON cert.course_id=c.id
         WHERE cert.user_id=? ORDER BY cert.issued_at DESC`,
        req.user!.userId,
      );
    } catch {
      result = await sql(
        `SELECT cert.id, cert.serial_id, cert.issued_at, 'active' as status, NULL as revoked_at, NULL as revoke_reason,
                c.title_ar, c.title_en
         FROM certificates cert JOIN courses c ON cert.course_id=c.id
         WHERE cert.user_id=? ORDER BY cert.issued_at DESC`,
        req.user!.userId,
      );
    }
    res.json(result.rows);
  } catch {
    res.status(500).json({ error: 'Failed to fetch certificates' });
  }
});

router.get('/verify/:serial', async (req: Request, res: Response) => {
  try {
    const result = await sql(
      `SELECT cert.id, cert.serial_id, cert.issued_at, cert.status, cert.revoked_at, cert.revoke_reason,
              u.name as student_name, u.email as student_email,
              c.title_ar, c.title_en
       FROM certificates cert
       JOIN users u ON cert.user_id=u.id
       JOIN courses c ON cert.course_id=c.id
       WHERE cert.serial_id=?`,
      req.params.serial,
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Certificate not found' });

    const cert = result.rows[0] as any;
    if (cert.status === 'revoked') {
      return res.json({
        valid: false,
        revoked: true,
        revoke_reason: cert.revoke_reason || null,
        certificate: cert,
      });
    }

    res.json({ valid: true, certificate: cert });
  } catch {
    res.status(500).json({ error: 'Verification failed' });
  }
});

// ═══════════════════════════════════════════════
// Public Certificate HTML Preview by serial
// (No auth required — for verify page)
// ═══════════════════════════════════════════════
router.get('/verify/:serial/html', async (req: Request, res: Response) => {
  try {
    const certResult = await sql(
      'SELECT cert.id, cert.serial_id, cert.issued_at, cert.user_id, cert.course_id, cert.status FROM certificates cert WHERE cert.serial_id=?',
      req.params.serial,
    );
    if (certResult.rows.length === 0) {
      return res.status(404).json({ error: 'Certificate not found' });
    }
    const cert = certResult.rows[0] as any;

    // Only serve active certificates
    if (cert.status === 'revoked') {
      return res.status(403).json({ error: 'This certificate has been revoked' });
    }

    const frontendUrl = process.env.FRONTEND_URL || `${req.protocol}://${req.headers.host || 'localhost:3000'}`;
    const html = await renderCertificateFor(cert, frontendUrl);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (err: any) {
    console.error('[Certificate Verify HTML] Error:', err.message);
    res.status(500).json({ error: 'Failed to generate certificate HTML' });
  }
});

// ═══════════════════════════════════════════════
// Download Certificate — Returns filled HTML
// (PDF is generated client-side via html2pdf.js)
// ═══════════════════════════════════════════════
router.get('/:id/html', authMiddleware, async (req: Request, res: Response) => {
  try {
    const certId = req.params.id;

    // 1. Fetch the certificate base row (student/course data is loaded by the
    //    shared renderer below).
    const certResult = await sql(
      'SELECT cert.id, cert.serial_id, cert.issued_at, cert.user_id, cert.course_id, cert.status FROM certificates cert WHERE cert.id=?',
      certId,
    );

    if (certResult.rows.length === 0) {
      return res.status(404).json({ error: 'Certificate not found' });
    }

    const cert = certResult.rows[0] as any;

    // 2. Block revoked certificates from being downloaded
    if (cert.status === 'revoked') {
      return res.status(403).json({ error: 'This certificate has been revoked and is no longer valid' });
    }

    // 3. Check ownership
    if (Number(req.user!.userId) !== Number(cert.user_id) && req.user!.roleId !== 1) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const frontendUrl = process.env.FRONTEND_URL || `${req.protocol}://${req.headers.host || 'localhost:3000'}`;
    const html = await renderCertificateFor(cert, frontendUrl);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (err: any) {
    console.error('[Certificate HTML] Error:', err.message);
    res.status(500).json({ error: 'Failed to generate certificate' });
  }
});

// Keep the old download endpoint for backwards compatibility — returns HTML
router.get('/:id/download', authMiddleware, async (req: Request, res: Response) => {
  try {
    const certId = req.params.id;

    const certResult = await sql(
      'SELECT cert.id, cert.serial_id, cert.issued_at, cert.user_id, cert.course_id, cert.status FROM certificates cert WHERE cert.id=?',
      certId,
    );

    if (certResult.rows.length === 0) {
      return res.status(404).json({ error: 'Certificate not found' });
    }

    const cert = certResult.rows[0] as any;

    if (cert.status === 'revoked') {
      return res.status(403).json({ error: 'This certificate has been revoked and is no longer valid' });
    }

    if (Number(req.user!.userId) !== Number(cert.user_id) && req.user!.roleId !== 1) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const frontendUrl = process.env.FRONTEND_URL || `${req.protocol}://${req.headers.host || 'localhost:3000'}`;
    const html = await renderCertificateFor(cert, frontendUrl);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (err: any) {
    console.error('[Certificate Download] Error:', err.message);
    res.status(500).json({ error: 'Failed to generate certificate' });
  }
});

export default router;
