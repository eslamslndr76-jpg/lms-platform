import { chromium, Browser } from 'playwright';
import QRCode from 'qrcode';
import path from 'path';
import fs from 'fs';

let browserInstance: Browser | null = null;

async function getBrowser(): Promise<Browser> {
  if (!browserInstance || !browserInstance.isConnected()) {
    browserInstance = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
  }
  return browserInstance;
}

export interface CertificateData {
  studentName: string;
  courseNameAr: string;
  courseNameEn: string;
  instructorName: string;
  lecturesAttended: number;
  lecturesTotal: number;
  courseDuration: string;
  issueDate: string;
  serialId: string;
  verificationUrl: string;
  logoBase64: string;
  systemName: string;
  primaryColor: string;
  secondaryColor: string;
  directorName: string;
  directorTitle: string;
  certificateTitle: string;
  certificateTitleEn: string;
  footerText: string;
}

function formatDateAr(dateStr: string): string {
  const d = new Date(dateStr);
  const months = [
    'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
    'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر',
  ];
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

export async function generateCertificatePdf(data: CertificateData): Promise<Buffer> {
  // 1. Generate QR Code as data URL
  const qrDataUrl = await QRCode.toDataURL(data.verificationUrl, {
    width: 200,
    margin: 2,
    color: {
      dark: data.primaryColor || '#2563eb',
      light: '#ffffff',
    },
  });

  // 2. Build logo HTML
  let logoHtml = '';
  if (data.logoBase64) {
    logoHtml = `<img class="logo" src="${data.logoBase64}" alt="Logo" />`;
  }

  // 3. Read HTML template
  const templatePath = path.join(__dirname, '../templates/certificate.html');
  let html = fs.readFileSync(templatePath, 'utf-8');

  // 4. Replace all placeholders
  const replacements: Record<string, string> = {
    studentName: data.studentName || '',
    courseNameAr: data.courseNameAr || '',
    courseNameEn: data.courseNameEn || '',
    instructorName: data.instructorName || 'غير محدد',
    lecturesAttended: String(data.lecturesAttended || 0),
    lecturesTotal: String(data.lecturesTotal || 0),
    courseDuration: data.courseDuration || '',
    issueDate: formatDateAr(data.issueDate || new Date().toISOString()),
    serialId: data.serialId || '',
    verificationUrl: data.verificationUrl || '',
    qrDataUrl,
    logoHtml,
    systemName: data.systemName || 'وحدة التدريب و التطوير',
    primaryColor: data.primaryColor || '#2563eb',
    secondaryColor: data.secondaryColor || '#7c3aed',
    directorName: data.directorName || '',
    directorTitle: data.directorTitle || 'مدير وحدة التدريب و التطوير',
    certificateTitle: data.certificateTitle || 'شهادة إتمام',
    certificateTitleEn: data.certificateTitleEn || 'Certificate of Completion',
    footerText: data.footerText || '',
  };

  html = html.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    return replacements[key] !== undefined ? replacements[key] : match;
  });

  // 5. Generate PDF via Playwright
  const browser = await getBrowser();
  const page = await browser.newPage();

  try {
    await page.setContent(html, { waitUntil: 'networkidle', timeout: 30000 });

    // Wait for fonts to load
    await page.evaluate('document.fonts.ready');

    const pdfBuffer = await page.pdf({
      format: 'A4',
      landscape: true,
      printBackground: true,
      margin: { top: '0', right: '0', bottom: '0', left: '0' },
    });

    return Buffer.from(pdfBuffer);
  } finally {
    await page.close();
  }
}

// Cleanup on process exit
process.on('exit', () => {
  if (browserInstance) {
    browserInstance.close().catch(() => {});
  }
});
