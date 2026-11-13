'use client';

import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { useToast } from './Toast';

export interface BookingDraft {
  items: { course_id: number }[];
  note?: string;
}

/**
 * Last checkout step. The only payment route is the institute treasury:
 * confirming here creates the booking (POST /api/orders), the student pays in
 * cash and takes a receipt, then uploads it from "طلباتي" for admin approval.
 */
export default function PaymentStep({ amount, booking, onDone }: {
  amount: number;
  booking: BookingDraft;
  onDone?: (status: string, orderId: number, amount: number) => void;
}) {
  const { show } = useToast();
  const [instructions, setInstructions] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const currency = 'ج.م';

  useEffect(() => {
    api('/api/payment-methods')
      .then((data: any) => {
        const cash = Array.isArray(data) ? data.find((m: any) => m?.kind === 'cash') : null;
        setInstructions(cash?.instructions || '');
      })
      .catch(() => setInstructions(''))
      .finally(() => setLoading(false));
  }, []);

  const submit = async () => {
    setError('');
    setSubmitting(true);
    try {
      const res: any = await api('/api/orders', {
        method: 'POST',
        body: JSON.stringify({
          items: booking.items,
          note_student: booking.note,
          payment_method: 'cash',
        }),
      });
      show(res?.message || 'تم تأكيد حجزك', 'success');
      onDone?.(
        res?.status || 'pending',
        Number(res?.id) || 0,
        Number(res?.amount) || amount,
      );
    } catch (e: any) {
      setError(e?.message || 'فشل تأكيد الحجز، حاول مرة أخرى');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="p-3 rounded-md3-sm flex items-center justify-between" style={{ backgroundColor: 'var(--md-sys-color-surface-container-low)' }}>
        <span className="text-xs" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>رقم الحجز</span>
        <span className="text-sm font-bold" style={{ color: 'var(--md-sys-color-on-surface)' }}>يصدر بعد التأكيد</span>
      </div>
      <div className="p-3 rounded-md3-sm flex items-center justify-between" style={{ backgroundColor: 'var(--md-sys-color-surface-container-low)' }}>
        <span className="text-xs" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>المبلغ المطلوب</span>
        <span className="text-lg font-bold" style={{ color: 'var(--md-sys-color-primary)' }}>{amount.toLocaleString()} {currency}</span>
      </div>

      <div className="p-4 space-y-2 rounded-md3-sm"
        style={{ backgroundColor: 'var(--md-sys-color-surface-container-low)', border: '1px solid var(--md-sys-color-outline-variant)' }}>
        <p className="text-sm font-bold flex items-center gap-2" style={{ color: 'var(--md-sys-color-on-surface)' }}>
          <span className="material-symbols-outlined text-[20px]">payments</span>
          الدفع في خزنة المعهد
        </p>
        <p className="text-xs leading-relaxed" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>
          {loading
            ? 'جاري تحميل تعليمات الدفع...'
            : (instructions || 'اذهب إلى خزنة المعهد وادفع المبلغ، واستلم إيصال الدفع. بعد ذلك ارفع صورة الإيصال من صفحة "طلباتي" لتتم مراجعته والموافقة عليه.')}
        </p>
        <ol className="text-xs leading-relaxed space-y-1 pr-4 list-decimal" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>
          <li>أكّد الحجز ليصدر رقم الحجز ورقم الطلب.</li>
          <li>ادفع في الخزنة واذكر رقم الحجز.</li>
          <li>ارفع صورة الإيصال من «طلباتي» — تُراجع من الإدارة ويُفعَّل تسجيلك.</li>
        </ol>
      </div>

      {error && <p className="text-sm" style={{ color: 'var(--md-sys-color-error)' }}>{error}</p>}

      <button type="button" onClick={submit} disabled={submitting}
        className="w-full py-3.5 rounded-full text-sm font-bold disabled:opacity-50 flex items-center justify-center gap-2"
        style={{ backgroundColor: 'var(--md-sys-color-primary)', color: 'var(--md-sys-color-on-primary)' }}>
        {submitting && <span className="w-4 h-4 border-2 rounded-full animate-spin" style={{ borderColor: 'rgba(255,255,255,0.35)', borderTopColor: 'var(--md-sys-color-on-primary)' }} />}
        {submitting ? 'جاري تأكيد الحجز...' : 'تأكيد الحجز'}
      </button>
    </div>
  );
}
