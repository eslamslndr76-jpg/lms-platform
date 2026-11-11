import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { sql } from '../db/helpers';
import { authMiddleware } from '../middleware/auth';
import { DEFAULT_LOGO_DATA_URL } from '../config/brandLogo';

/** Certificate logo markup: the configured logo, or the new default brand logo. */
function logoHtmlFor(logoHeader: unknown): string {
  const src =
    typeof logoHeader === 'string' && logoHeader.trim() ? logoHeader.trim() : DEFAULT_LOGO_DATA_URL;
  return `<img class="logo" src="${src}" alt="Logo" />`;
}

const router = Router();

// توقيع الشهادة الافتراضي: مدير وحدة التدريب والتطوير.
const DEFAULT_DIRECTOR_NAME = 'دكتور شيماء محمد محمد عبد الدايم';
const DEFAULT_DIRECTOR_TITLE = 'مدير وحدة التدريب و التطوير';

const CERTIFICATE_TEMPLATE = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700;800;900&family=Playfair+Display:wght@400;600;700;800&family=Aref+Ruqaa:wght@400;700&family=Great+Vibes&family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
  <style>
    @page { size: 297mm 210mm; margin: 0 !important; }
    * { margin: 0; padding: 0; box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; color-adjust: exact !important; }

    body {
      width: 297mm;
      height: 210mm;
      font-family: 'Cairo', 'Inter', sans-serif;
      position: relative;
      overflow: hidden;
      background: #faf7f0;
      color: #1a1a1a;
    }

    /* ═══════════════════════════════════════════
       BACKGROUND LAYERS — Floral Damask Pattern
       ═══════════════════════════════════════════ */

    /* Layer 1: Warm ivory gradient base */
    .bg-gradient {
      position: absolute;
      top: 0; right: 0; bottom: 0; left: 0;
      background: linear-gradient(135deg, #faf7f0 0%, #f5efe3 35%, #faf7f0 65%, #f0ead8 100%);
      z-index: 0;
    }

    /* Layer 2: Floral damask repeating pattern */
    .bg-floral {
      position: absolute;
      top: 0; right: 0; bottom: 0; left: 0;
      z-index: 0;
      pointer-events: none;
      background-image:
        radial-gradient(ellipse 28px 28px at 50% 50%, {{primaryColor}} 0%, transparent 65%),
        radial-gradient(ellipse 16px 16px at 25% 25%, {{primaryColor}} 0%, transparent 60%),
        radial-gradient(ellipse 16px 16px at 75% 75%, {{secondaryColor}} 0%, transparent 60%),
        radial-gradient(ellipse 10px 5px at 15% 50%, {{primaryColor}} 0%, transparent 55%),
        radial-gradient(ellipse 10px 5px at 85% 50%, {{primaryColor}} 0%, transparent 55%),
        radial-gradient(ellipse 8px 8px at 50% 20%, {{secondaryColor}} 0%, transparent 55%),
        radial-gradient(ellipse 8px 8px at 50% 80%, {{secondaryColor}} 0%, transparent 55%);
      background-size: 100px 100px;
      opacity: 0.04;
    }

    /* Layer 3: Corner glows — stronger than before */
    .bg-glow {
      position: absolute;
      top: 0; right: 0; bottom: 0; left: 0;
      z-index: 0;
      pointer-events: none;
      background:
        radial-gradient(circle at 8% 8%, {{primaryColor}} 0%, transparent 35%),
        radial-gradient(circle at 92% 92%, {{secondaryColor}} 0%, transparent 35%),
        radial-gradient(circle at 50% 50%, {{primaryColor}} 0%, transparent 50%),
        radial-gradient(circle at 92% 8%, {{primaryColor}} 0%, transparent 25%),
        radial-gradient(circle at 8% 92%, {{secondaryColor}} 0%, transparent 25%);
      opacity: 0.05;
    }

    /* Layer 4: Scattered star dots — double-layer pattern */
    .bg-stars {
      position: absolute;
      top: 0; right: 0; bottom: 0; left: 0;
      z-index: 0;
      pointer-events: none;
      background-image:
        radial-gradient(circle, {{primaryColor}} 1.2px, transparent 1.2px),
        radial-gradient(circle, {{secondaryColor}} 0.7px, transparent 0.7px);
      background-size: 55px 55px, 38px 38px;
      background-position: 0 0, 19px 19px;
      opacity: 0.055;
    }

    /* ═══════════════════════════════════════════
       SCALLOPED EDGE BORDER — 4 sides
       ═══════════════════════════════════════════ */

    .bg-scallop-top, .bg-scallop-bottom {
      position: absolute; left: 8mm; right: 8mm; height: 10px;
      z-index: 1; pointer-events: none;
    }
    .bg-scallop-top { top: 5.5mm; }
    .bg-scallop-bottom { bottom: 5.5mm; }

    .bg-scallop-top {
      background:
        radial-gradient(circle at 10px -1px, transparent 7px, {{primaryColor}} 7px, {{primaryColor}} 8px, transparent 8px),
        radial-gradient(circle at 10px -1px, transparent 7px, {{primaryColor}} 7px, {{primaryColor}} 8px, transparent 8px);
      background-size: 22px 10px;
      background-repeat: repeat-x;
    }
    .bg-scallop-bottom {
      background:
        radial-gradient(circle at 10px 11px, transparent 7px, {{primaryColor}} 7px, {{primaryColor}} 8px, transparent 8px),
        radial-gradient(circle at 10px 11px, transparent 7px, {{primaryColor}} 7px, {{primaryColor}} 8px, transparent 8px);
      background-size: 22px 10px;
      background-repeat: repeat-x;
    }

    .bg-scallop-left, .bg-scallop-right {
      position: absolute; top: 8mm; bottom: 8mm; width: 10px;
      z-index: 1; pointer-events: none;
    }
    .bg-scallop-left { left: 5.5mm; }
    .bg-scallop-right { right: 5.5mm; }

    .bg-scallop-left {
      background:
        radial-gradient(circle at -1px 10px, transparent 7px, {{primaryColor}} 7px, {{primaryColor}} 8px, transparent 8px),
        radial-gradient(circle at -1px 10px, transparent 7px, {{primaryColor}} 7px, {{primaryColor}} 8px, transparent 8px);
      background-size: 10px 22px;
      background-repeat: repeat-y;
    }
    .bg-scallop-right {
      background:
        radial-gradient(circle at 11px 10px, transparent 7px, {{primaryColor}} 7px, {{primaryColor}} 8px, transparent 8px),
        radial-gradient(circle at 11px 10px, transparent 7px, {{primaryColor}} 7px, {{primaryColor}} 8px, transparent 8px);
      background-size: 10px 22px;
      background-repeat: repeat-y;
    }

    /* Inner border */
    .border-inner {
      position: absolute;
      top: 14mm; right: 14mm; bottom: 14mm; left: 14mm;
      border: 1px solid {{primaryColor}}25;
      border-radius: 4px;
      pointer-events: none;
      z-index: 1;
    }

    /* ═══════════════════════════════════════════
       CORNER ORNAMENTS — L-shape + dot
       ═══════════════════════════════════════════ */

    .corner {
      position: absolute; width: 60px; height: 60px;
      pointer-events: none; z-index: 2;
    }
    .corner::before, .corner::after {
      content: ''; position: absolute;
      background: {{primaryColor}}; border-radius: 1px;
    }

    .corner-tl { top: 10mm; left: 10mm; }
    .corner-tl::before { top: 0; left: 0; width: 50px; height: 3px; }
    .corner-tl::after  { top: 0; left: 0; width: 3px; height: 50px; }

    .corner-tr { top: 10mm; right: 10mm; }
    .corner-tr::before { top: 0; right: 0; width: 50px; height: 3px; }
    .corner-tr::after  { top: 0; right: 0; width: 3px; height: 50px; }

    .corner-bl { bottom: 10mm; left: 10mm; }
    .corner-bl::before { bottom: 0; left: 0; width: 50px; height: 3px; }
    .corner-bl::after  { bottom: 0; left: 0; width: 3px; height: 50px; }

    .corner-br { bottom: 10mm; right: 10mm; }
    .corner-br::before { bottom: 0; right: 0; width: 50px; height: 3px; }
    .corner-br::after  { bottom: 0; right: 0; width: 3px; height: 50px; }

    .corner-dot {
      position: absolute; width: 8px; height: 8px;
      border-radius: 50%; background: {{primaryColor}};
      opacity: 0.35;
    }
    .corner-tl .corner-dot { top: -4px; left: -4px; }
    .corner-tr .corner-dot { top: -4px; right: -4px; }
    .corner-bl .corner-dot { bottom: -4px; left: -4px; }
    .corner-br .corner-dot { bottom: -4px; right: -4px; }

    /* ═══════════════════════════════════════════
       DECORATIVE CENTER LINE
       ═══════════════════════════════════════════ */

    .decorative-line {
      position: absolute;
      top: 50%; left: 50%;
      transform: translate(-50%, -50%);
      width: 70mm; height: 1px;
      background: linear-gradient(90deg, transparent, {{primaryColor}}30, transparent);
      pointer-events: none;
      z-index: 0;
    }

    /* ═══════════════════════════════════════════
       CONTENT LAYOUT
       ═══════════════════════════════════════════ */

    .content {
      position: absolute;
      top: 18mm; right: 18mm; bottom: 18mm; left: 18mm;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: space-between;
      text-align: center;
      padding: 4mm 12mm;
      z-index: 1;
    }

    /* ═══════ HEADER ═══════ */

    .header {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 5px;
    }

    .logo { max-height: 50px; max-width: 170px; object-fit: contain; }

    .system-name {
      font-family: 'Cairo', sans-serif;
      font-size: 9pt;
      font-weight: 700;
      color: {{primaryColor}};
      letter-spacing: 0.5px;
    }

    /* ═══════ TITLE SECTION ═══════ */

    .title-section {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 3px;
    }

    .title-ar {
      font-family: 'Cairo', sans-serif;
      font-size: 34pt;
      font-weight: 900;
      background: linear-gradient(135deg, {{primaryColor}} 0%, {{secondaryColor}} 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      letter-spacing: 2px;
      line-height: 1.2;
    }

    .title-en {
      font-family: 'Playfair Display', 'Inter', sans-serif;
      font-size: 10.5pt;
      font-weight: 400;
      color: #999;
      text-transform: uppercase;
      letter-spacing: 8px;
    }

    .title-divider-wrap {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-top: 4px;
    }

    .title-divider {
      width: 180px; height: 3px;
      background: linear-gradient(90deg, transparent, {{primaryColor}}, {{secondaryColor}}, {{primaryColor}}, transparent);
      border-radius: 2px;
    }

    .divider-ornament {
      color: {{primaryColor}};
      font-size: 8px;
      opacity: 0.5;
    }

    /* ═══════ STUDENT SECTION ═══════ */

    .student-section {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 6px;
    }

    .presented-to {
      font-family: 'Cairo', sans-serif;
      font-size: 9pt;
      color: #999;
      font-weight: 500;
    }

    .student-name {
      font-family: 'Cairo', sans-serif;
      font-size: 30pt;
      font-weight: 800;
      background: linear-gradient(135deg, {{primaryColor}} 0%, {{secondaryColor}} 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      padding: 6px 80px;
      border-bottom: 3px solid {{primaryColor}};
      display: inline-block;
      line-height: 1.3;
      position: relative;
    }

    .student-name::after {
      content: '✦  ✦  ✦';
      position: absolute;
      bottom: -18px; left: 50%; transform: translateX(-50%);
      font-size: 7px;
      color: {{primaryColor}};
      letter-spacing: 10px;
      -webkit-text-fill-color: initial;
      opacity: 0.5;
    }

    /* ═══════ COURSE SECTION ═══════ */

    .course-section {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 3px;
    }

    .course-label {
      font-family: 'Cairo', sans-serif;
      font-size: 9pt;
      color: #999;
      font-weight: 500;
    }

    .course-name-ar {
      font-family: 'Cairo', sans-serif;
      font-size: 15pt;
      font-weight: 700;
      color: #333;
    }

    .course-name-en {
      font-family: 'Inter', sans-serif;
      font-size: 9.5pt;
      color: #aaa;
      font-style: italic;
      font-weight: 300;
    }

    /* ═══════ STATS GRID ═══════ */

    .stats-grid {
      display: flex;
      gap: 30px;
      justify-content: center;
      align-items: flex-start;
    }

    .stat-item {
      text-align: center;
      min-width: 90px;
      padding: 8px 18px;
      border-radius: 8px;
      background: rgba(255,255,255,0.55);
      border: 1px solid {{primaryColor}}12;
      border-top: 3px solid {{primaryColor}};
      box-shadow: 0 2px 10px rgba(0,0,0,0.04);
    }

    .stat-value {
      font-family: 'Cairo', 'Inter', sans-serif;
      font-size: 13pt;
      font-weight: 700;
      color: {{primaryColor}};
      line-height: 1.3;
    }

    .stat-label {
      font-family: 'Cairo', sans-serif;
      font-size: 7pt;
      color: #aaa;
      letter-spacing: 1px;
      margin-top: 2px;
      font-weight: 600;
    }

    /* ═══════ BOTTOM SECTION ═══════ */

    .bottom-section {
      display: flex;
      align-items: flex-end;
      justify-content: space-between;
      width: 100%;
      gap: 20px;
    }

    /* ═══════ VERIFICATION ═══════ */

    .verification {
      display: flex;
      align-items: center;
      gap: 12px;
      direction: ltr;
    }

    .qr-wrapper {
      background: white;
      padding: 6px;
      border-radius: 8px;
      border: 2px solid {{primaryColor}}15;
      box-shadow: 0 2px 12px rgba(0,0,0,0.08);
    }

    .qr-code { width: 65px; height: 65px; display: block; }

    .serial-info { text-align: left; }

    .serial-label {
      font-family: 'Inter', sans-serif;
      font-size: 6.5pt;
      color: #bbb;
      text-transform: uppercase;
      letter-spacing: 1px;
      margin-bottom: 1px;
    }

    .serial-id {
      font-family: 'Inter', monospace;
      font-size: 8.5pt;
      color: #555;
      font-weight: 500;
      letter-spacing: 1px;
    }

    .verify-url { font-size: 6.5pt; color: #ccc; margin-top: 3px; }

    /* ═══════ SIGNATURES ═══════ */

    .signatures {
      display: flex;
      gap: 50px;
      justify-content: center;
    }

    .sig-block { text-align: center; min-width: 130px; }

    .sig-name {
      font-family: 'Aref Ruqaa', 'Great Vibes', cursive;
      font-size: 20pt;
      color: #1a1a1a;
      line-height: 1.3;
      font-weight: 700;
    }

    .sig-line {
      width: 140px; height: 2px;
      background: linear-gradient(90deg, transparent, {{primaryColor}}60, {{secondaryColor}}40, {{primaryColor}}60, transparent);
      margin: 6px auto;
      border-radius: 1px;
    }

    .sig-title {
      font-family: 'Cairo', sans-serif;
      font-size: 8pt;
      color: #888;
      font-weight: 600;
      letter-spacing: 0.5px;
    }

    /* ═══════ FOOTER ═══════ */

    .footer-text {
      position: absolute;
      bottom: 14mm;
      left: 50%;
      transform: translateX(-50%);
      font-family: 'Cairo', sans-serif;
      font-size: 6pt;
      color: #bbb;
      max-width: 480px;
      text-align: center;
      line-height: 1.5;
    }

    /* ═══════ SEAL WATERMARK ═══════ */

    .seal {
      position: absolute;
      bottom: 40mm;
      left: 50%;
      transform: translateX(-50%);
      width: 60px; height: 60px;
      border-radius: 50%;
      border: 3px solid {{primaryColor}}20;
      display: flex;
      align-items: center;
      justify-content: center;
      opacity: 0.18;
      z-index: 0;
    }

    .seal-inner {
      width: 42px; height: 42px;
      border-radius: 50%;
      border: 1.5px solid {{primaryColor}}30;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 18px;
    }

    /* ═══════ PRINT STYLES ═══════ */

    @media print {
      html, body { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; color-adjust: exact !important; margin: 0 !important; padding: 0 !important; }
      * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; color-adjust: exact !important; }
    }
  </style>
</head>
<body>
  <!-- Background Layers -->
  <div class="bg-gradient"></div>
  <div class="bg-floral"></div>
  <div class="bg-glow"></div>
  <div class="bg-stars"></div>

  <!-- Scalloped Border — 4 sides -->
  <div class="bg-scallop-top"></div>
  <div class="bg-scallop-bottom"></div>
  <div class="bg-scallop-left"></div>
  <div class="bg-scallop-right"></div>

  <!-- Inner Border -->
  <div class="border-inner"></div>

  <!-- Corner Ornaments with dots -->
  <div class="corner corner-tl"><span class="corner-dot"></span></div>
  <div class="corner corner-tr"><span class="corner-dot"></span></div>
  <div class="corner corner-bl"><span class="corner-dot"></span></div>
  <div class="corner corner-br"><span class="corner-dot"></span></div>

  <!-- Decorative center line -->
  <div class="decorative-line"></div>

  <!-- Seal watermark -->
  <div class="seal"><div class="seal-inner">&#x1F393;</div></div>

  <!-- Main Content -->
  <div class="content">
    <div class="header">
      {{logoHtml}}
      <div class="system-name">{{systemName}}</div>
    </div>

    <div class="title-section">
      <div class="title-ar">{{certificateTitle}}</div>
      <div class="title-en">{{certificateTitleEn}}</div>
      <div class="title-divider-wrap">
        <span class="divider-ornament">◆</span>
        <div class="title-divider"></div>
        <span class="divider-ornament">◆</span>
      </div>
    </div>

    <div class="student-section">
      <div class="presented-to">يُ certify بأن الطالب / الطالبة</div>
      <div class="student-name">{{studentName}}</div>
    </div>

    <div class="course-section">
      <div class="course-label">قد أتم بنجاح دورة تدريبية بعنوان</div>
      <div class="course-name-ar">{{courseNameAr}}</div>
      <div class="course-name-en">{{courseNameEn}}</div>
    </div>

    <div class="stats-grid">
      <div class="stat-item">
        <div class="stat-value">{{lecturesAttended}} / {{lecturesTotal}}</div>
        <div class="stat-label">المحاضرات</div>
      </div>
      <div class="stat-item">
        <div class="stat-value">{{courseDuration}}</div>
        <div class="stat-label">المدة</div>
      </div>
      <div class="stat-item">
        <div class="stat-value">{{instructorName}}</div>
        <div class="stat-label">المدرب</div>
      </div>
      <div class="stat-item">
        <div class="stat-value">{{issueDate}}</div>
        <div class="stat-label">تاريخ الإصدار</div>
      </div>
    </div>

    <div class="bottom-section">
      <div class="verification">
        <div class="qr-wrapper">
          <img class="qr-code" src="{{qrDataUrl}}" alt="QR" />
        </div>
        <div class="serial-info">
          <div class="serial-label">Certificate ID</div>
          <div class="serial-id">{{serialId}}</div>
          <div class="verify-url">{{verificationUrl}}</div>
        </div>
      </div>
      <div class="signatures">
        <div class="sig-block">
          <div class="sig-name">{{directorName}}</div>
          <div class="sig-line"></div>
          <div class="sig-title">{{directorTitle}}</div>
        </div>
        <div class="sig-block">
          <div class="sig-name">{{instructorName}}</div>
          <div class="sig-line"></div>
          <div class="sig-title">المدرب المعتمد</div>
        </div>
      </div>
    </div>
  </div>

  <div class="footer-text">{{footerText}}</div>
</body>
</html>`;

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
      `SELECT cert.id, cert.serial_id, cert.issued_at, cert.user_id, cert.course_id, cert.status
       FROM certificates cert
       WHERE cert.serial_id=?`,
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

    // Fetch student + course data
    const studentResult = await sql('SELECT name as student_name FROM users WHERE id=?', cert.user_id);
    const courseResult = await sql(
      'SELECT title_ar as course_name_ar, title_en as course_name_en, instructor as instructor_name, lecture_count, lecture_duration FROM courses WHERE id=?',
      cert.course_id,
    );
    if (studentResult.rows.length === 0 || courseResult.rows.length === 0) {
      return res.status(404).json({ error: 'Certificate data not found' });
    }
    const studentName = (studentResult.rows[0] as any).student_name;
    const course = courseResult.rows[0] as any;

    // Fetch branding
    let branding: any = {};
    try {
      const brandingResult = await sql("SELECT value FROM system_settings WHERE key='branding'");
      if (brandingResult.rows.length > 0) {
        branding = JSON.parse(brandingResult.rows[0].value as string);
      }
    } catch { /* use defaults */ }

    // Fetch certificate settings
    let certSettings: any = {};
    try {
      const settingsResult = await sql("SELECT value FROM system_settings WHERE key='certificate'");
      if (settingsResult.rows.length > 0) {
        certSettings = JSON.parse(settingsResult.rows[0].value as string);
      }
    } catch { /* use defaults */ }

    // Calculate attendance
    let lecturesAttended = 0;
    let lecturesTotal = 0;
    try {
      const groupsResult = await sql('SELECT id FROM groups WHERE course_id=?', cert.course_id);
      const groupIds = (groupsResult.rows as any[]).map(g => g.id);
      if (groupIds.length > 0) {
        const placeholders = groupIds.map(() => '?').join(',');
        const totalResult = await sql(`SELECT COUNT(*) as total FROM lectures WHERE group_id IN (${placeholders})`, ...groupIds);
        lecturesTotal = Number(totalResult.rows[0].total);
        const attendedResult = await sql(
          `SELECT COUNT(*) as attended FROM lecture_attendance la JOIN lectures l ON la.lecture_id = l.id WHERE l.group_id IN (${placeholders}) AND la.user_id = ? AND la.attended = 1`,
          ...groupIds, cert.user_id,
        );
        lecturesAttended = Number(attendedResult.rows[0].attended);
      }
    } catch { /* use defaults */ }

    // Course duration
    let courseDuration = '';
    if (course.lecture_count && course.lecture_duration) {
      courseDuration = `${course.lecture_count * course.lecture_duration} ساعة`;
    } else if (course.lecture_duration) {
      courseDuration = `${course.lecture_duration} ساعة`;
    }

    // QR code
    const frontendUrl = process.env.FRONTEND_URL || `${req.protocol}://${req.headers.host || 'localhost:3000'}`;
    const verificationUrl = `${frontendUrl}/verify?serial=${cert.serial_id}`;
    const QRCode = (await import('qrcode')).default;
    const qrDataUrl = await QRCode.toDataURL(verificationUrl, {
      width: 200, margin: 2,
      color: { dark: branding.primaryColor || '#2563eb', light: '#ffffff' },
    });

    const formatDateAr = (dateStr: string): string => {
      const d = new Date(dateStr);
      const months = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
      return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
    };

    // Fill template
    let html = CERTIFICATE_TEMPLATE;
    const logoHtml = logoHtmlFor(branding.logoHeader);
    const replacements: Record<string, string> = {
      studentName: studentName || '',
      courseNameAr: course.course_name_ar || '',
      courseNameEn: course.course_name_en || '',
      instructorName: course.instructor_name || 'غير محدد',
      lecturesAttended: String(lecturesAttended),
      lecturesTotal: String(lecturesTotal),
      courseDuration: courseDuration || 'غير محدد',
      issueDate: formatDateAr(cert.issued_at),
      serialId: cert.serial_id || '',
      verificationUrl,
      qrDataUrl,
      logoHtml,
      systemName: branding.systemName || 'وحدة التدريب و التطوير',
      primaryColor: branding.primaryColor || '#2563eb',
      secondaryColor: branding.secondaryColor || '#7c3aed',
      directorName: certSettings.directorName || DEFAULT_DIRECTOR_NAME,
      directorTitle: certSettings.directorTitle || DEFAULT_DIRECTOR_TITLE,
      certificateTitle: certSettings.certificateTitle || 'شهادة إتمام',
      certificateTitleEn: certSettings.certificateTitleEn || 'Certificate of Completion',
      footerText: certSettings.footerText || 'هذه الشهادة صادرة من وحدة التدريب و التطوير بالتعاون مع المعهد العالي للعلوم الإدارية بالقطامية (HIMS)',
    };
    html = html.replace(/\{\{(\w+)\}\}/g, (match, key) => replacements[key] !== undefined ? replacements[key] : match);

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

    // 1. Fetch certificate with student + course + instructor data
    const certResult = await sql(
      `SELECT cert.id, cert.serial_id, cert.issued_at, cert.user_id, cert.course_id,
              u.name as student_name,
              c.title_ar as course_name_ar, c.title_en as course_name_en,
              c.instructor as instructor_name, c.lecture_count, c.lecture_duration
       FROM certificates cert
       JOIN users u ON cert.user_id=u.id
       JOIN courses c ON cert.course_id=c.id
       WHERE cert.id=?`,
      certId,
    );

    if (certResult.rows.length === 0) {
      return res.status(404).json({ error: 'Certificate not found' });
    }

    const cert = certResult.rows[0] as any;

    // Block revoked certificates from being downloaded
    if (cert.status === 'revoked') {
      return res.status(403).json({ error: 'This certificate has been revoked and is no longer valid' });
    }

    // 2. Check ownership
    if (Number(req.user!.userId) !== Number(cert.user_id) && req.user!.roleId !== 1) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    // 3. Fetch branding settings
    let branding: any = {};
    try {
      const brandingResult = await sql("SELECT value FROM system_settings WHERE key='branding'");
      if (brandingResult.rows.length > 0) {
        branding = JSON.parse(brandingResult.rows[0].value as string);
      }
    } catch { /* use defaults */ }

    // 4. Fetch certificate settings
    let certSettings: any = {};
    try {
      const settingsResult = await sql("SELECT value FROM system_settings WHERE key='certificate'");
      if (settingsResult.rows.length > 0) {
        certSettings = JSON.parse(settingsResult.rows[0].value as string);
      }
    } catch { /* use defaults */ }

    // 5. Count attended lectures
    let lecturesAttended = 0;
    let lecturesTotal = 0;
    try {
      const groupsResult = await sql(
        'SELECT id FROM groups WHERE course_id=?',
        cert.course_id,
      );
      const groupIds = (groupsResult.rows as any[]).map(g => g.id);

      if (groupIds.length > 0) {
        const placeholders = groupIds.map(() => '?').join(',');
        const totalResult = await sql(
          `SELECT COUNT(*) as total FROM lectures WHERE group_id IN (${placeholders})`,
          ...groupIds,
        );
        lecturesTotal = Number(totalResult.rows[0].total);

        const attendedResult = await sql(
          `SELECT COUNT(*) as attended
           FROM lecture_attendance la
           JOIN lectures l ON la.lecture_id = l.id
           WHERE l.group_id IN (${placeholders}) AND la.user_id = ? AND la.attended = 1`,
          ...groupIds, cert.user_id,
        );
        lecturesAttended = Number(attendedResult.rows[0].attended);
      }
    } catch { /* use 0 values */ }

    // 6. Build course duration string
    let courseDuration = '';
    if (cert.lecture_count && cert.lecture_duration) {
      const totalHours = cert.lecture_count * cert.lecture_duration;
      courseDuration = `${totalHours} ساعة`;
    } else if (cert.lecture_duration) {
      courseDuration = `${cert.lecture_duration} ساعة`;
    }

    // 7. Build verification URL
    const frontendUrl = process.env.FRONTEND_URL || `${req.protocol}://${req.headers.host || 'localhost:3000'}`;
    const verificationUrl = `${frontendUrl}/verify?serial=${cert.serial_id}`;

    // 8. Generate QR code data URL
    const QRCode = (await import('qrcode')).default;
    const qrDataUrl = await QRCode.toDataURL(verificationUrl, {
      width: 200,
      margin: 2,
      color: { dark: branding.primaryColor || '#2563eb', light: '#ffffff' },
    });

    // 9. Format date
    const formatDateAr = (dateStr: string): string => {
      const d = new Date(dateStr);
      const months = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
      return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
    };

    // 10. Fill HTML template
    let html = CERTIFICATE_TEMPLATE;

    const logoHtml = logoHtmlFor(branding.logoHeader);

    const replacements: Record<string, string> = {
      studentName: cert.student_name || '',
      courseNameAr: cert.course_name_ar || '',
      courseNameEn: cert.course_name_en || '',
      instructorName: cert.instructor_name || 'غير محدد',
      lecturesAttended: String(lecturesAttended),
      lecturesTotal: String(lecturesTotal),
      courseDuration: courseDuration || 'غير محدد',
      issueDate: formatDateAr(cert.issued_at),
      serialId: cert.serial_id || '',
      verificationUrl,
      qrDataUrl,
      logoHtml,
      systemName: branding.systemName || 'وحدة التدريب و التطوير',
      primaryColor: branding.primaryColor || '#2563eb',
      secondaryColor: branding.secondaryColor || '#7c3aed',
      directorName: certSettings.directorName || DEFAULT_DIRECTOR_NAME,
      directorTitle: certSettings.directorTitle || DEFAULT_DIRECTOR_TITLE,
      certificateTitle: certSettings.certificateTitle || 'شهادة إتمام',
      certificateTitleEn: certSettings.certificateTitleEn || 'Certificate of Completion',
      footerText: certSettings.footerText || 'هذه الشهادة صادرة من وحدة التدريب و التطوير بالتعاون مع المعهد العالي للعلوم الإدارية بالقطامية (HIMS)',
    };

    html = html.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      return replacements[key] !== undefined ? replacements[key] : match;
    });

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (err: any) {
    console.error('[Certificate HTML] Error:', err.message);
    res.status(500).json({ error: 'Failed to generate certificate HTML' });
  }
});

// Keep the old download endpoint for backwards compatibility — returns HTML
router.get('/:id/download', authMiddleware, async (req: Request, res: Response) => {
  try {
    const certId = req.params.id;

    const certResult = await sql(
      `SELECT cert.id, cert.serial_id, cert.issued_at, cert.user_id, cert.course_id,
              u.name as student_name,
              c.title_ar as course_name_ar, c.title_en as course_name_en,
              c.instructor as instructor_name, c.lecture_count, c.lecture_duration
       FROM certificates cert
       JOIN users u ON cert.user_id=u.id
       JOIN courses c ON cert.course_id=c.id
       WHERE cert.id=?`,
      certId,
    );

    if (certResult.rows.length === 0) {
      return res.status(404).json({ error: 'Certificate not found' });
    }

    const cert = certResult.rows[0] as any;

    if (cert.status === 'revoked') {
      return res.status(403).json({ error: 'This certificate has been revoked' });
    }

    if (Number(req.user!.userId) !== Number(cert.user_id) && req.user!.roleId !== 1) {
      return res.status(403).json({ error: 'Not authorized' });
    }    let branding: any = {};
    try {
      const brandingResult = await sql("SELECT value FROM system_settings WHERE key='branding'");
      if (brandingResult.rows.length > 0) branding = JSON.parse(brandingResult.rows[0].value as string);
    } catch {}

    let certSettings: any = {};
    try {
      const settingsResult = await sql("SELECT value FROM system_settings WHERE key='certificate'");
      if (settingsResult.rows.length > 0) certSettings = JSON.parse(settingsResult.rows[0].value as string);
    } catch {}

    let lecturesAttended = 0;
    let lecturesTotal = 0;
    try {
      const groupsResult = await sql('SELECT id FROM groups WHERE course_id=?', cert.course_id);
      const groupIds = (groupsResult.rows as any[]).map(g => g.id);
      if (groupIds.length > 0) {
        const placeholders = groupIds.map(() => '?').join(',');
        const totalResult = await sql(`SELECT COUNT(*) as total FROM lectures WHERE group_id IN (${placeholders})`, ...groupIds);
        lecturesTotal = Number(totalResult.rows[0].total);
        const attendedResult = await sql(
          `SELECT COUNT(*) as attended FROM lecture_attendance la JOIN lectures l ON la.lecture_id = l.id WHERE l.group_id IN (${placeholders}) AND la.user_id = ? AND la.attended = 1`,
          ...groupIds, cert.user_id,
        );
        lecturesAttended = Number(attendedResult.rows[0].attended);
      }
    } catch {}

    let courseDuration = '';
    if (cert.lecture_count && cert.lecture_duration) {
      courseDuration = `${cert.lecture_count * cert.lecture_duration} ساعة`;
    } else if (cert.lecture_duration) {
      courseDuration = `${cert.lecture_duration} ساعة`;
    }

    const frontendUrl = process.env.FRONTEND_URL || `${req.protocol}://${req.headers.host || 'localhost:3000'}`;
    const verificationUrl = `${frontendUrl}/verify?serial=${cert.serial_id}`;
    const QRCode = (await import('qrcode')).default;
    const qrDataUrl = await QRCode.toDataURL(verificationUrl, { width: 200, margin: 2, color: { dark: branding.primaryColor || '#2563eb', light: '#ffffff' } });

    const formatDateAr = (dateStr: string): string => {
      const d = new Date(dateStr);
      const months = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
      return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
    };

    let html = CERTIFICATE_TEMPLATE;

    const logoHtml = logoHtmlFor(branding.logoHeader);
    const replacements: Record<string, string> = {
      studentName: cert.student_name || '', courseNameAr: cert.course_name_ar || '',
      courseNameEn: cert.course_name_en || '', instructorName: cert.instructor_name || 'غير محدد',
      lecturesAttended: String(lecturesAttended), lecturesTotal: String(lecturesTotal),
      courseDuration: courseDuration || 'غير محدد', issueDate: formatDateAr(cert.issued_at),
      serialId: cert.serial_id || '', verificationUrl, qrDataUrl, logoHtml,
      systemName: branding.systemName || 'وحدة التدريب و التطوير',
      primaryColor: branding.primaryColor || '#2563eb', secondaryColor: branding.secondaryColor || '#7c3aed',
        directorName: certSettings.directorName || DEFAULT_DIRECTOR_NAME, directorTitle: certSettings.directorTitle || DEFAULT_DIRECTOR_TITLE,
      certificateTitle: certSettings.certificateTitle || 'شهادة إتمام',
      certificateTitleEn: certSettings.certificateTitleEn || 'Certificate of Completion',
      footerText: certSettings.footerText || 'هذه الشهادة صادرة من وحدة التدريب و التطوير بالتعاون مع المعهد العالي للعلوم الإدارية بالقطامية (HIMS)',
    };
    html = html.replace(/\{\{(\w+)\}\}/g, (match, key) => replacements[key] !== undefined ? replacements[key] : match);

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (err: any) {
    console.error('[Certificate Download] Error:', err.message);
    res.status(500).json({ error: 'Failed to generate certificate' });
  }
});

export default router;
