import { sql } from '../db/helpers';
import { sendNotification } from './externalNotificationService';

/**
 * Orders are headers with N `order_items` rows. These helpers attach the items
 * (and optionally the single receipt) to a list of order rows so every caller
 * gets the same shape: `items[]`, a `receipt` object and legacy-friendly
 * `title_ar` / `course_id` fields for older clients.
 */

/** Max length of the receipt data URL (2MB after compression, phase 0 decision). */
export const MAX_RECEIPT_CHARS = 2 * 1024 * 1024;

export const OPEN_ORDER_STATUSES = ['pending', 'review', 'paid'] as const;

export interface CourseItemRow {
  course_id: number;
  price: number;
  title_ar: string;
  title_en: string;
  instructor: string;
  course_mode: string;
  image_url: string | null;
}

function placeholders(count: number): string {
  return Array.from({ length: count }, () => '?').join(',');
}

/** Items grouped by order id, with the course data each item needs. */
export async function getItemsByOrderIds(ids: number[]): Promise<Map<number, CourseItemRow[]>> {
  const map = new Map<number, CourseItemRow[]>();
  if (ids.length === 0) return map;

  const result = await sql(
    `SELECT oi.order_id, oi.course_id, oi.price,
            c.title_ar, c.title_en, c.instructor, c.course_mode, c.image_url
     FROM order_items oi
     LEFT JOIN courses c ON oi.course_id = c.id
     WHERE oi.order_id IN (${placeholders(ids.length)})
     ORDER BY oi.id ASC`,
    ...ids,
  );

  for (const row of result.rows as any[]) {
    const orderId = Number(row.order_id);
    if (!map.has(orderId)) map.set(orderId, []);
    map.get(orderId)!.push({
      course_id: Number(row.course_id),
      price: Number(row.price),
      title_ar: row.title_ar || '',
      title_en: row.title_en || '',
      instructor: row.instructor || '',
      course_mode: row.course_mode || '',
      image_url: row.image_url || null,
    });
  }
  return map;
}

/** One receipt per order (the table stores a single row per order). */
export async function getReceiptsByOrderIds(ids: number[]): Promise<Map<number, any>> {
  const map = new Map<number, any>();
  if (ids.length === 0) return map;

  const result = await sql(
    `SELECT order_id, file_url, payment_method, verified_by, verified_at, created_at
     FROM receipts
     WHERE order_id IN (${placeholders(ids.length)})
     ORDER BY id DESC`,
    ...ids,
  );

  for (const row of result.rows as any[]) {
    const orderId = Number(row.order_id);
    if (!map.has(orderId)) map.set(orderId, row);
  }
  return map;
}

/**
 * Adds `items`, `receipt`, `title_ar` (comma-joined titles) and `course_id`
 * (first item) to each order row. Returns the same array for convenience.
 */
export async function attachOrderDetails<T extends Record<string, any>>(
  rows: T[],
  options: { withReceipt?: boolean; withItems?: boolean } = {},
): Promise<T[]> {
  if (rows.length === 0) return rows;
  const { withReceipt = true, withItems = true } = options;
  const ids = rows.map((r) => Number(r.id));
  const [itemsMap, receiptsMap] = await Promise.all([
    withItems ? getItemsByOrderIds(ids) : Promise.resolve(new Map<number, CourseItemRow[]>()),
    withReceipt ? getReceiptsByOrderIds(ids) : Promise.resolve(new Map<number, any>()),
  ]);

  for (const row of rows as any[]) {
    const id = Number(row.id);
    const items = itemsMap.get(id) || [];
    row.items = items;
    row.course_id = items[0]?.course_id ?? row.course_id ?? null;
    row.title_ar = items.map((i) => i.title_ar).filter(Boolean).join('، ');
    row.title_en = items.map((i) => i.title_en).filter(Boolean).join('، ');
    const receipt = receiptsMap.get(id);
    row.receipt = receipt
      ? {
          file_url: receipt.file_url,
          payment_method: receipt.payment_method,
          verified_by: receipt.verified_by ? Number(receipt.verified_by) : null,
          verified_at: receipt.verified_at,
          created_at: receipt.created_at,
        }
      : null;
  }
  return rows;
}

/** The first course in `courseIds` that is paid or inside an open order. */
export async function findBlockingOrder(userId: number, courseIds: number[]): Promise<{ course_id: number; status: string } | null> {
  if (courseIds.length === 0) return null;
  const result = await sql(
    `SELECT oi.course_id, o.status
     FROM order_items oi
     JOIN orders o ON oi.order_id = o.id
     WHERE o.user_id=? AND o.status IN (${placeholders(OPEN_ORDER_STATUSES.length)})
       AND oi.course_id IN (${placeholders(courseIds.length)})
     LIMIT 1`,
    userId,
    ...OPEN_ORDER_STATUSES,
    ...courseIds,
  );
  if (result.rows.length === 0) return null;
  const row = result.rows[0] as any;
  return { course_id: Number(row.course_id), status: String(row.status) };
}

/** Course titles for an order, used in notifications. */
export async function getOrderCourseTitles(orderId: number): Promise<string[]> {
  const result = await sql(
    `SELECT c.title_ar FROM order_items oi
     JOIN courses c ON oi.course_id = c.id
     WHERE oi.order_id=? ORDER BY oi.id ASC`,
    orderId,
  );
  return (result.rows as any[]).map((r) => String(r.title_ar || '')).filter(Boolean);
}

// ═══════════════════════════════════════════════
// Booking expiry (unpaid bookings auto-cancel)
// ═══════════════════════════════════════════════

/** Admin-editable booking window in hours (default: 7 days). */
export const DEFAULT_BOOKING_EXPIRY_HOURS = 168;

export async function getBookingExpiryHours(): Promise<number> {
  const result = await sql("SELECT value FROM system_settings WHERE key='bookingExpiryHours'");
  if (result.rows.length === 0) return DEFAULT_BOOKING_EXPIRY_HOURS;
  const hours = Number(JSON.parse(String(result.rows[0].value || '{}')).hours);
  return Number.isFinite(hours) && hours >= 1 ? Math.min(hours, 720) : DEFAULT_BOOKING_EXPIRY_HOURS;
}

export async function setBookingExpiryHours(hours: number): Promise<void> {
  await sql(
    "INSERT INTO system_settings (key, value) VALUES ('bookingExpiryHours', ?) ON CONFLICT(key) DO UPDATE SET value=?, updated_at=CURRENT_TIMESTAMP",
    JSON.stringify({ hours }), JSON.stringify({ hours }),
  );
}

/** SQLite-format UTC timestamp (`CURRENT_TIMESTAMP` comparable). */
function utcSqLiteTimestamp(date: Date): string {
  return date.toISOString().slice(0, 19).replace('T', ' ');
}

/**
 * Cancels pending bookings older than the booking window (status stays
 * `cancelled` with `cancel_reason='expired'` for old clients) and notifies
 * each student. `review` bookings are never expired (admin is reviewing).
 * Returns how many bookings were cancelled.
 */
export async function expireStaleBookings(): Promise<number> {
  const hours = await getBookingExpiryHours();
  const cutoff = utcSqLiteTimestamp(new Date(Date.now() - hours * 3600 * 1000));

  const stale = await sql(
    'SELECT id, user_id, amount FROM orders WHERE status=? AND created_at < ?',
    'pending', cutoff,
  );

  for (const row of stale.rows as any[]) {
    const orderId = Number(row.id);
    await sql("UPDATE orders SET status='cancelled', cancel_reason='expired' WHERE id=? AND status='pending'", orderId);
    const titles = await getOrderCourseTitles(orderId);
    await sendNotification(Number(row.user_id), 'order_expired', {
      courseTitle: titles.join('، '),
      amount: row.amount,
      orderId,
    }).catch((e: any) => console.error(`[Notify] order_expired failed (order ${orderId}):`, e?.message || e));
  }
  return stale.rows.length;
}
