import { Router, Request, Response } from 'express';
import { sql } from '../db/helpers';
import { authMiddleware } from '../middleware/auth';
import { requireRole, ADMIN, EMPLOYEE } from '../middleware/rbac';
import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';

const router = Router();

function sendJSON(res: Response, data: any, filename: string) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}.json"`);
  res.json(data);
}

async function sendExcel(res: Response, rows: Record<string, any>[], filename: string) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Sheet1');
  if (rows.length > 0) {
    ws.columns = Object.keys(rows[0]).map(k => ({ header: k, key: k }));
    rows.forEach(r => ws.addRow(r));
    ws.getRow(1).font = { bold: true };
  }
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}.xlsx"`);
  const buf = await wb.xlsx.writeBuffer();
  res.send(Buffer.from(buf));
}

function sendPDF(res: Response, rows: Record<string, any>[], title: string, filename: string) {
  const doc = new PDFDocument({ margin: 30, size: 'A4' });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}.pdf"`);
  doc.pipe(res);
  doc.fontSize(16).font('Helvetica-Bold').text(title, { align: 'right' });
  doc.moveDown();
  if (rows.length > 0) {
    const keys = Object.keys(rows[0]);
    const colW = Math.min(120, Math.floor(500 / keys.length));
    doc.fontSize(10).font('Helvetica-Bold');
    let x = 30;
    keys.forEach(k => { doc.text(k, x, doc.y, { width: colW, align: 'right' }); x += colW; });
    doc.moveDown(0.5);
    doc.font('Helvetica').fontSize(8);
    rows.forEach(r => {
      x = 30;
      const y = doc.y;
      if (y > 750) { doc.addPage(); }
      keys.forEach(k => { doc.text(String(r[k] ?? ''), x, doc.y, { width: colW, align: 'right' }); x += colW; });
      doc.moveDown(0.3);
    });
  }
  doc.end();
}

router.get('/students/:courseId', authMiddleware, requireRole(ADMIN, EMPLOYEE), async (req: Request, res: Response) => {
  try {
    const { courseId } = req.params;
    const course = await sql('SELECT title_ar FROM courses WHERE id=?', courseId);
    if (course.rows.length === 0) return res.status(404).json({ error: 'Course not found' });
    const students = await sql(
      `SELECT u.name, u.email, u.phone, o.status, o.created_at as order_date
       FROM orders o JOIN users u ON o.user_id=u.id
       WHERE o.course_id=? AND o.status='paid'
       ORDER BY u.name ASC`,
      courseId,
    );
    const format = (req.query.format as string) || 'json';
    const rows = students.rows.map((s: any) => ({ name: s.name, email: s.email, phone: s.phone, status: s.status, date: s.order_date }));
    const courseName = (course.rows[0] as any).title_ar;
    const fn = `students-${courseId}`;
    if (format === 'xlsx') return sendExcel(res, rows, fn);
    if (format === 'pdf') return sendPDF(res, rows, `طلاب: ${courseName}`, fn);
    sendJSON(res, { course: courseName, students: rows }, fn);
  } catch {
    res.status(500).json({ error: 'Failed to export students' });
  }
});

router.get('/orders', authMiddleware, requireRole(ADMIN, EMPLOYEE), async (_req: Request, res: Response) => {
  try {
    const result = await sql(
      `SELECT o.id, u.name as student, c.title_ar as course, o.amount, o.status, o.created_at
       FROM orders o JOIN users u ON o.user_id=u.id JOIN courses c ON o.course_id=c.id
       ORDER BY o.created_at DESC`,
    );
    const format = (_req.query.format as string) || 'json';
    const rows = result.rows.map((r: any) => ({ id: r.id, student: r.student, course: r.course, amount: r.amount, status: r.status, date: r.created_at }));
    if (format === 'xlsx') return sendExcel(res, rows, 'orders');
    if (format === 'pdf') return sendPDF(res, rows, 'جميع الطلبات', 'orders');
    sendJSON(res, { data: rows }, 'orders');
  } catch {
    res.status(500).json({ error: 'Failed to export orders' });
  }
});

router.get('/financials', authMiddleware, requireRole(ADMIN, EMPLOYEE), async (_req: Request, res: Response) => {
  try {
    const result = await sql(
      `SELECT strftime('%Y-%m', created_at) as month, COUNT(*) as count, SUM(amount) as total
       FROM orders WHERE status='paid'
       GROUP BY month ORDER BY month DESC`,
    );
    const format = (_req.query.format as string) || 'json';
    const rows = result.rows.map((r: any) => ({ month: r.month, count: Number(r.count), total: Number(r.total) }));
    if (format === 'xlsx') return sendExcel(res, rows, 'financials');
    if (format === 'pdf') return sendPDF(res, rows, 'التقارير المالية', 'financials');
    sendJSON(res, { data: rows }, 'financials');
  } catch {
    res.status(500).json({ error: 'Failed to export financials' });
  }
});

export default router;
