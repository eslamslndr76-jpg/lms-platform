import { Router, Request, Response } from 'express';
import { sql } from '../db/helpers';
import { authMiddleware } from '../middleware/auth';
import { requireRole, STUDENT } from '../middleware/rbac';
import { sendNotification } from '../services/externalNotificationService';
import {
  MAX_RECEIPT_CHARS,
  attachOrderDetails,
  findBlockingOrder,
  getOrderCourseTitles,
  removeCoursesFromCart,
} from '../services/orderService';

const router = Router();

const MAX_ITEMS = 20;

/** Accepts `items:[{course_id}]`, `items:[1,2]`, or the legacy single `course_id`. */
function readCourseIds(body: any): number[] {
  const raw: unknown[] = Array.isArray(body?.items)
    ? body.items
    : body?.course_id !== undefined && body?.course_id !== null
      ? [body.course_id]
      : [];
  const ids: number[] = [];
  for (const entry of raw) {
    const value = typeof entry === 'object' && entry !== null ? (entry as any).course_id : entry;
    const id = Number(value);
    if (Number.isInteger(id) && id > 0 && !ids.includes(id)) ids.push(id);
  }
  return ids;
}

function isTooLarge(receipt: unknown): boolean {
  return typeof receipt === 'string' && receipt.length > MAX_RECEIPT_CHARS;
}

/** One confirmation notification, sent only once the booking step is finished. */
async function notifyBookingConfirmed(
  userId: number,
  orderId: number,
  total: number,
  titles: string[],
) {
  await sendNotification(userId, 'order_created', {
    courseTitle: titles.join('، '),
    amount: total,
    orderId,
  }).catch((e) => console.error('[Notify] order_created failed:', e.message));
}

/** Single receipt row per order: update the existing one or insert a new one. */
async function saveReceipt(orderId: number, fileUrl: string, paymentMethod: string) {
  const existing = await sql('SELECT id FROM receipts WHERE order_id=? ORDER BY id DESC LIMIT 1', orderId);
  if (existing.rows.length > 0) {
    await sql('UPDATE receipts SET file_url=?, payment_method=? WHERE id=?', fileUrl, paymentMethod, (existing.rows[0] as any).id);
  } else {
    await sql(
      'INSERT INTO receipts (order_id, file_url, payment_method) VALUES (?,?,?)',
      orderId, fileUrl, paymentMethod,
    );
  }
  // Keep the legacy column in sync for the installed app and old links.
  await sql('UPDATE orders SET receipt_url=? WHERE id=?', fileUrl, orderId);
}

// ─────────────────────────────────────────────────────────────
// Create a booking (supports multi-item and the legacy single course)
// ─────────────────────────────────────────────────────────────
router.post('/', authMiddleware, requireRole(STUDENT), async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const courseIds = readCourseIds(req.body);
    if (courseIds.length === 0) return res.status(400).json({ error: 'يجب اختيار كورس واحد على الأقل' });
    if (courseIds.length > MAX_ITEMS) return res.status(400).json({ error: `لا يمكن حجز أكثر من ${MAX_ITEMS} كورس في طلب واحد` });

    const receipt = req.body?.receipt ?? req.body?.receipt_url;
    if (isTooLarge(receipt)) return res.status(413).json({ error: 'حجم الإيصال أكبر من 2MB، اضغط الصورة وحاول مرة أخرى' });

    const placeholders = courseIds.map(() => '?').join(',');
    const coursesResult = await sql(
      `SELECT id, price, title_ar FROM courses WHERE id IN (${placeholders})`,
      ...courseIds,
    );
    const courses = coursesResult.rows as any[];
    if (courses.length !== courseIds.length) {
      return res.status(404).json({ error: 'أحد الكورسات غير موجود' });
    }

    const blocking = await findBlockingOrder(userId, courseIds);
    if (blocking) {
      const blocked = courses.find((c) => Number(c.id) === blocking.course_id);
      const reason = blocking.status === 'paid' ? 'مدفوع بالفعل' : 'داخل طلب مفتوح';
      return res.status(409).json({
        error: `الكورس "${blocked?.title_ar || blocking.course_id}" ${reason}. أزل الكورس من الطلب وأعد المحاولة.`,
        course_id: blocking.course_id,
        status: blocking.status,
      });
    }

    const priceById = new Map<number, number>(courses.map((c) => [Number(c.id), Number(c.price)]));
    const total = courseIds.reduce((sum, id) => sum + (priceById.get(id) || 0), 0);
    // One payment route only: the student pays at the treasury and uploads the
    // receipt later from "طلباتي". Anything digital sent by older builds is
    // ignored here instead of creating a different kind of booking.
    const paymentMethod = 'cash';
    const notesStudent = req.body?.note_student ?? req.body?.notes_student ?? null;

    // The checkout confirms the booking on its last step, which is why the
    // confirmation notification is only sent when the request carries the
    // payment choice (older builds book first, then call /:id/pay).
    const confirmedHere = Boolean(req.body?.payment_method);

    const result = await sql(
      `INSERT INTO orders (user_id, course_id, amount, status, payment_method, notes_student)
       VALUES (?,?,?,'pending',?,?)`,
      userId, courseIds[0], total, paymentMethod, notesStudent,
    );
    const orderId = Number(result.lastInsertRowid);

    for (const courseId of courseIds) {
      await sql(
        'INSERT INTO order_items (order_id, course_id, price) VALUES (?,?,?)',
        orderId, courseId, priceById.get(courseId) || 0,
      );
    }

    // The server owns the cart: the booked courses leave it (nothing else does).
    await removeCoursesFromCart(userId, courseIds);

    const titles = courses
      .filter((c) => courseIds.includes(Number(c.id)))
      .map((c) => c.title_ar)
      .filter(Boolean);

    if (confirmedHere) await notifyBookingConfirmed(userId, orderId, total, titles);

    res.status(201).json({
      id: orderId,
      status: 'pending',
      amount: total,
      message: 'تم تأكيد حجزك. ادفع في خزنة المعهد ثم ارفع صورة الإيصال من صفحة طلباتي.',
      items: courseIds.map((id) => ({ course_id: id })),
    });
  } catch (err: any) {
    console.error('Order creation error:', err?.message || err);
    res.status(500).json({ error: 'فشل إنشاء الطلب، حاول مرة أخرى' });
  }
});

// ─────────────────────────────────────────────────────────────
// Legacy pay endpoint (installed builds): the only route is the treasury, so
// the choice just confirms the booking. Receipts are uploaded from "طلباتي".
// ─────────────────────────────────────────────────────────────
router.patch('/:id/pay', authMiddleware, async (req: Request, res: Response) => {
  try {
    const orderId = Number(req.params.id);
    if (!Number.isInteger(orderId) || orderId <= 0) return res.status(400).json({ error: 'رقم غير صالح' });

    const orderResult = await sql('SELECT id, user_id, status, amount, payment_method FROM orders WHERE id=?', orderId);
    if (orderResult.rows.length === 0) return res.status(404).json({ error: 'الطلب غير موجود' });
    const order = orderResult.rows[0] as any;
    if (Number(order.user_id) !== req.user!.userId) return res.status(403).json({ error: 'غير مصرح لك بهذا الطلب' });
    if (order.status === 'paid' || order.status === 'cancelled') {
      return res.status(409).json({ error: 'لا يمكن تعديل دفعة طلب مدفوع أو ملغي' });
    }

    const paymentMethod = 'cash';
    const receipt = req.body?.receipt ?? req.body?.receipt_url;
    if (isTooLarge(receipt)) return res.status(413).json({ error: 'حجم الإيصال أكبر من 2MB، اضغط الصورة وحاول مرة أخرى' });
    const senderPhone = String(req.body?.sender_phone ?? '').trim();

    // Older builds may still send a receipt with the payment; keep it so the
    // admin sees it, but the booking itself is always a treasury payment.
    if (receipt) await saveReceipt(orderId, String(receipt), paymentMethod);

    const newStatus = receipt ? 'review' : 'pending';
    const notesStudent = req.body?.note_student ?? req.body?.notes_student;
    const sets = ['status=?', 'payment_method=?', 'sender_phone=?'];
    const params: unknown[] = [newStatus, paymentMethod, senderPhone || null];
    if (notesStudent !== undefined) {
      sets.push('notes_student=?');
      params.push(notesStudent);
    }
    params.push(orderId);
    await sql(`UPDATE orders SET ${sets.join(', ')} WHERE id=?`, ...params);

    // This is the last checkout step for clients that book first and pay after,
    // so the single "booking confirmed" notification is sent from here.
    const titles = await getOrderCourseTitles(orderId);
    await notifyBookingConfirmed(req.user!.userId, orderId, Number(order.amount) || 0, titles);

    res.json({
      id: orderId,
      status: newStatus,
      message: 'تم تأكيد حجزك. ادفع في خزنة المعهد ثم ارفع صورة الإيصال من صفحة طلباتي.',
    });
  } catch (err: any) {
    console.error('Order pay error:', err?.message || err);
    res.status(500).json({ error: 'فشل تحديث الدفع، حاول مرة أخرى' });
  }
});

// ─────────────────────────────────────────────────────────────
// Legacy receipt upload (installed app) — kept working
// ─────────────────────────────────────────────────────────────
router.patch('/:id/receipt', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { receipt_url } = req.body;
    if (!receipt_url) return res.status(400).json({ error: 'receipt_url required' });
    if (isTooLarge(receipt_url)) return res.status(413).json({ error: 'حجم الإيصال أكبر من 2MB، اضغط الصورة وحاول مرة أخرى' });

    const order = await sql('SELECT user_id, status, amount, payment_method FROM orders WHERE id=?', req.params.id);
    if (order.rows.length === 0) return res.status(404).json({ error: 'Order not found' });
    const row = order.rows[0] as any;
    if (Number(row.user_id) !== req.user!.userId) return res.status(403).json({ error: 'Unauthorized' });
    if (row.status === 'paid' || row.status === 'cancelled') {
      return res.status(409).json({ error: 'لا يمكن تعديل إيصال طلب مدفوع أو ملغي' });
    }

    await saveReceipt(Number(req.params.id), String(receipt_url), 'cash');
    await sql("UPDATE orders SET status='review', payment_method='cash', sender_phone=NULL WHERE id=?", req.params.id);

    // The student finished the treasury payment: tell them the receipt is with
    // the admin (a second, distinct notification after the booking one).
    const titles = await getOrderCourseTitles(Number(req.params.id));
    await sendNotification(req.user!.userId, 'order_receipt_uploaded', {
      courseTitle: titles.join('، '),
      amount: Number(row.amount) || undefined,
      orderId: Number(req.params.id),
    }).catch((e) => console.error('[Notify] order_receipt_uploaded failed:', e.message));

    res.json({ message: 'تم رفع الإيصال، وسيتم مراجعته من الإدارة', status: 'review' });
  } catch (err: any) {
    console.error('Receipt upload error:', err?.message || err);
    res.status(500).json({ error: 'فشل رفع الإيصال' });
  }
});

// ─────────────────────────────────────────────────────────────
// Cancel my unpaid booking (pending or review only)
// ─────────────────────────────────────────────────────────────
router.patch('/:id/cancel', authMiddleware, async (req: Request, res: Response) => {
  try {
    const orderId = Number(req.params.id);
    if (!Number.isInteger(orderId) || orderId <= 0) return res.status(400).json({ error: 'رقم غير صالح' });

    const orderResult = await sql('SELECT id, user_id, status FROM orders WHERE id=?', orderId);
    if (orderResult.rows.length === 0) return res.status(404).json({ error: 'الطلب غير موجود' });
    const order = orderResult.rows[0] as any;
    if (Number(order.user_id) !== req.user!.userId) return res.status(403).json({ error: 'غير مصرح لك بهذا الطلب' });
    if (order.status === 'paid') return res.status(409).json({ error: 'الطلب مدفوع — تواصل مع الإدارة للإلغاء أو الاسترداد' });
    if (order.status === 'cancelled') return res.status(409).json({ error: 'الطلب ملغى بالفعل' });

    await sql("UPDATE orders SET status='cancelled', cancel_reason='student' WHERE id=?", orderId);

    const titles = await getOrderCourseTitles(orderId);
    await sendNotification(req.user!.userId, 'order_cancelled', {
      courseTitle: titles.join('، '),
      orderId,
    }).catch((e) => console.error('[Notify] order_cancelled failed:', e.message));

    res.json({ id: orderId, status: 'cancelled', message: 'تم إلغاء الحجز' });
  } catch (err: any) {
    console.error('Order cancel error:', err?.message || err);
    res.status(500).json({ error: 'فشل إلغاء الحجز، حاول مرة أخرى' });
  }
});

// ─────────────────────────────────────────────────────────────
// Remove one course from my unpaid booking (server recomputes the total)
// ─────────────────────────────────────────────────────────────
router.delete('/:id/items/:courseId', authMiddleware, async (req: Request, res: Response) => {
  try {
    const orderId = Number(req.params.id);
    const courseId = Number(req.params.courseId);
    if (!Number.isInteger(orderId) || orderId <= 0) return res.status(400).json({ error: 'رقم طلب غير صالح' });
    if (!Number.isInteger(courseId) || courseId <= 0) return res.status(400).json({ error: 'رقم كورس غير صالح' });

    const orderResult = await sql('SELECT id, user_id, status FROM orders WHERE id=?', orderId);
    if (orderResult.rows.length === 0) return res.status(404).json({ error: 'الطلب غير موجود' });
    const order = orderResult.rows[0] as any;
    if (Number(order.user_id) !== req.user!.userId) return res.status(403).json({ error: 'غير مصرح لك بهذا الطلب' });
    if (order.status === 'paid') return res.status(409).json({ error: 'الطلب مدفوع — تواصل مع الإدارة لتعديله' });
    if (order.status === 'cancelled') return res.status(409).json({ error: 'الطلب ملغى بالفعل' });

    const items = await sql('SELECT course_id FROM order_items WHERE order_id=?', orderId);
    if (!(items.rows as any[]).some((i) => Number(i.course_id) === courseId)) {
      return res.status(404).json({ error: 'الكورس غير موجود في هذا الطلب' });
    }

    // Removing the last course cancels the whole booking.
    if (items.rows.length <= 1) {
      await sql("UPDATE orders SET status='cancelled', cancel_reason='student' WHERE id=?", orderId);
      return res.json({ id: orderId, status: 'cancelled', amount: 0, message: 'أُلغي الطلب لعدم وجود كورسات فيه' });
    }

    await sql('DELETE FROM order_items WHERE order_id=? AND course_id=?', orderId, courseId);
    const total = await sql('SELECT COALESCE(SUM(price),0) as total FROM order_items WHERE order_id=?', orderId);
    const amount = Number((total.rows[0] as any).total);
    await sql('UPDATE orders SET amount=? WHERE id=?', amount, orderId);

    res.json({ id: orderId, status: order.status, amount, message: 'تم حذف الكورس من الطلب وإعادة حساب الإجمالي' });
  } catch (err: any) {
    console.error('Order item removal error:', err?.message || err);
    res.status(500).json({ error: 'فشل حذف الكورس من الطلب، حاول مرة أخرى' });
  }
});

// ─────────────────────────────────────────────────────────────
// My orders
// ─────────────────────────────────────────────────────────────
router.get('/my', authMiddleware, async (req: Request, res: Response) => {
  try {
    const result = await sql(
      `SELECT o.* FROM orders o WHERE o.user_id=? ORDER BY o.created_at DESC`,
      req.user!.userId,
    );
    res.json(await attachOrderDetails(result.rows as any[]));
  } catch (err: any) {
    console.error('Fetch orders error:', err?.message || err);
    res.status(500).json({ error: 'فشل تحميل الطلبات' });
  }
});

// ─────────────────────────────────────────────────────────────
// Checkout requirements — only the fields this account is missing
// ─────────────────────────────────────────────────────────────
router.get('/checkout-requirements', authMiddleware, async (req: Request, res: Response) => {
  try {
    const result = await sql(
      'SELECT name, phone, national_id, is_enrolled, university_name, university_code FROM users WHERE id=?',
      req.user!.userId,
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'المستخدم غير موجود' });
    const user = result.rows[0] as any;
    const missing: { key: string; label: string }[] = [];
    if (!String(user.name || '').trim()) missing.push({ key: 'name', label: 'الاسم' });
    if (!String(user.phone || '').trim()) missing.push({ key: 'phone', label: 'رقم الهاتف' });
    if (!/^\d{14}$/.test(String(user.national_id || '').replace(/\s/g, ''))) {
      missing.push({ key: 'national_id', label: 'الرقم القومي' });
    }
    if (Number(user.is_enrolled) === 1) {
      if (!String(user.university_name || '').trim()) missing.push({ key: 'university_name', label: 'اسم الجامعة' });
      if (!String(user.university_code || '').trim()) missing.push({ key: 'university_code', label: 'الكود الجامعي' });
    }
    res.json({ missing_fields: missing });
  } catch (err: any) {
    console.error('Checkout requirements error:', err?.message || err);
    res.status(500).json({ error: 'فشل تحميل بيانات الحساب' });
  }
});

router.get('/my/check/:courseId', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const courseId = Number(req.params.courseId);
    if (!Number.isInteger(courseId) || courseId <= 0) return res.status(400).json({ error: 'رقم كورس غير صالح' });

    const orders = await sql(
      `SELECT oi.id FROM order_items oi
       JOIN orders o ON oi.order_id=o.id
       WHERE o.user_id=? AND oi.course_id=? AND o.status='paid' LIMIT 1`,
      userId, courseId,
    );
    const hasPaidOrder = orders.rows.length > 0;

    const certs = await sql(
      'SELECT id, serial_id FROM certificates WHERE user_id=? AND course_id=? LIMIT 1',
      userId, courseId,
    );
    const hasCertificate = certs.rows.length > 0;
    const serialId = hasCertificate ? (certs.rows[0] as any).serial_id : null;

    res.json({ hasPaidOrder, hasCertificate, serialId });
  } catch (err: any) {
    console.error('Check order error:', err?.message || err);
    res.status(500).json({ error: 'فشل التحقق من حالة الشراء' });
  }
});

router.get('/my/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const result = await sql(
      'SELECT o.* FROM orders o WHERE o.id=? AND o.user_id=?',
      req.params.id, req.user!.userId,
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Order not found' });

    const [order] = await attachOrderDetails(result.rows as any[]);
    const courseIds: number[] = (order.items || []).map((i: any) => i.course_id);
    if (courseIds.length > 0) {
      const groups = await sql(
        `SELECT g.id, g.name, g.course_id, g.instructor_name, g.location, g.start_date, g.end_date,
                g.is_complete, g.zoom_link
         FROM group_students gs
         JOIN groups g ON gs.group_id = g.id
         WHERE gs.user_id=? AND g.course_id IN (${courseIds.map(() => '?').join(',')}) AND g.is_active=1`,
        req.user!.userId,
        ...courseIds,
      );
      order.groups = groups.rows;
    } else {
      order.groups = [];
    }

    res.json(order);
  } catch (err: any) {
    console.error('Fetch order details error:', err?.message || err);
    res.status(500).json({ error: 'فشل تحميل تفاصيل الطلب' });
  }
});

export default router;
