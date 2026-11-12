'use client';

import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { compressAndEncode } from '../lib/imageUtils';
import { useToast } from './Toast';

export interface PaymentMethod {
  id: number;
  key: string;
  label: string;
  kind: 'digital' | 'cash';
  account_number: string;
  account_name: string;
  instructions: string;
  sort_order: number;
}

export interface BookingDraft {
  items: { course_id: number }[];
  note?: string;
}

/**
 * One place for "how do I pay this booking": methods come from the admin
 * settings, digital payments need the sender phone and a compressed receipt,
 * cash just explains the treasury step.
 *
 * - With `orderId`: pays an existing booking (PATCH /api/orders/:id/pay).
 * - With `booking`: the checkout's last step — the booking is created and
 *   confirmed in one request (POST /api/orders), so nothing is booked earlier.
 */
export default function PaymentStep({ orderId, amount, booking, onDone }: {
  orderId?: number;
  amount: number;
  booking?: BookingDraft;
  onDone?: (status: string, orderId: number, amount: number) => void;
}) {
  const receiptInputId = `receipt-${orderId ?? 'new'}`;
  const { show } = useToast();
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [methodKey, setMethodKey] = useState('');
  const [senderPhone, setSenderPhone] = useState('');
  const [receipt, setReceipt] = useState('');
  const [fileName, setFileName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    api('/api/payment-methods')
      .then((data: any) => {
        const list: PaymentMethod[] = Array.isArray(data) ? data : [];
        setMethods(list);
        setMethodKey((prev) => (prev && list.some(m => m.key === prev) ? prev : list[0]?.key || ''));
      })
      .catch(() => setError('فشل تحميل طرق الدفع'))
      .finally(() => setLoading(false));
  }, []);

  const selected = methods.find(m => m.key === methodKey) || null;
  const isDigital = selected ? selected.kind === 'digital' : false;
  const currency = 'ج.م';

  const copyNumber = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      show('تعذر النسخ، انسخ الرقم يدوياً', 'error');
    }
  };

  const pickFile = async (file: File | null) => {
    if (!file) { setReceipt(''); setFileName(''); return; }
    try {
      const encoded = await compressAndEncode(file);
      setReceipt(encoded);
      setFileName(file.name);
    } catch {
      show('تعذر قراءة الصورة، جرّب صورة أخرى', 'error');
    }
  };

  const submit = async () => {
    setError('');
    if (!selected) { setError('اختر طريقة الدفع'); return; }
    if (isDigital) {
      if (!receipt) { setError('أرفق صورة إيصال التحويل'); return; }
      if (!senderPhone.trim()) { setError('أدخل رقم الهاتف المحوِّل منه'); return; }
    }
    setSubmitting(true);
    try {
      const payload = {
        payment_method: selected.key,
        sender_phone: senderPhone.trim() || undefined,
        receipt: isDigital ? receipt : undefined,
        note_student: booking?.note,
      };
      let res: any;
      if (orderId) {
        res = await api(`/api/orders/${orderId}/pay`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
      } else if (booking) {
        res = await api('/api/orders', {
          method: 'POST',
          body: JSON.stringify({ ...payload, items: booking.items }),
        });
      } else {
        setError('تعذر تحديد الطلب، أعد تحميل الصفحة');
        return;
      }
      show(res?.message || 'تم تأكيد الحجز', 'success');
      onDone?.(
        res?.status || (isDigital ? 'review' : 'pending'),
        Number(res?.id) || Number(orderId) || 0,
        Number(res?.amount) || amount,
      );
    } catch (e: any) {
      setError(e?.message || 'فشل تأكيد الحجز، حاول مرة أخرى');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-3">
        {[0, 1, 2].map(i => (
          <div key={i} className="h-12 rounded-md3-sm animate-pulse" style={{ backgroundColor: 'var(--md-sys-color-surface-container-high)' }} />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="p-3 rounded-md3-sm flex items-center justify-between" style={{ backgroundColor: 'var(--md-sys-color-surface-container-low)' }}>
        <span className="text-xs" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>رقم الحجز</span>
        <span className="text-sm font-bold" dir="ltr" style={{ color: 'var(--md-sys-color-on-surface)' }}>
          {orderId ? `#${orderId}` : 'يصدر بعد التأكيد'}
        </span>
      </div>
      <div className="p-3 rounded-md3-sm flex items-center justify-between" style={{ backgroundColor: 'var(--md-sys-color-surface-container-low)' }}>
        <span className="text-xs" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>المبلغ المطلوب</span>
        <span className="text-lg font-bold" style={{ color: 'var(--md-sys-color-primary)' }}>{amount.toLocaleString()} {currency}</span>
      </div>

      {methods.length === 0 ? (
        <p className="text-sm" style={{ color: 'var(--md-sys-color-error)' }}>لا توجد طرق دفع متاحة حالياً، تواصل مع الإدارة.</p>
      ) : (
        <div className="space-y-2">
          {methods.map(method => (
            <label key={method.key} className="flex items-center gap-3 px-4 py-3 cursor-pointer"
              style={{
                backgroundColor: methodKey === method.key ? 'var(--md-sys-color-surface-container-high)' : 'var(--md-sys-color-surface-container-low)',
                border: methodKey === method.key ? '1px solid var(--md-sys-color-primary)' : '1px solid var(--md-sys-color-outline-variant)',
                borderRadius: 'var(--md-sys-shape-corner-small)',
              }}>
              <input
                type="radio"
                name={`pay-method-${orderId ?? 'new'}`}
                checked={methodKey === method.key}
                onChange={() => { setMethodKey(method.key); setError(''); }}
                className="appearance-none w-4 h-4 rounded-full border-2 cursor-pointer"
                style={{
                  borderColor: methodKey === method.key ? 'var(--md-sys-color-primary)' : 'var(--md-sys-color-outline-variant)',
                  backgroundColor: methodKey === method.key ? 'var(--md-sys-color-primary)' : 'transparent',
                  boxShadow: methodKey === method.key ? 'inset 0 0 0 3px var(--md-sys-color-surface)' : 'none',
                }}
              />
              <span className="text-sm" style={{ color: 'var(--md-sys-color-on-surface)' }}>{method.label}</span>
            </label>
          ))}
        </div>
      )}

      {selected && !isDigital && (
        <div className="p-4 space-y-1 rounded-md3-sm" style={{ backgroundColor: 'var(--md-sys-color-surface-container-low)' }}>
          <p className="text-sm font-medium" style={{ color: 'var(--md-sys-color-on-surface)' }}>الدفع في خزنة المعهد</p>
          <p className="text-xs leading-relaxed" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>
            {selected.instructions || 'توجّه إلى خزنة المعهد واذكر رقم الحجز أعلاه. سيتم تأكيد الطلب بعد استلام المبلغ.'}
          </p>
        </div>
      )}

      {selected && isDigital && (
        <div className="space-y-4">
          {(selected.account_number || selected.instructions) && (
            <div className="p-4 space-y-2 rounded-md3-sm" style={{ backgroundColor: 'var(--md-sys-color-surface-container-low)', border: '1px solid var(--md-sys-color-outline-variant)' }}>
              {selected.account_number && (
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>حوّل على:</span>
                  <code dir="ltr" className="text-sm font-bold" style={{ color: 'var(--md-sys-color-on-surface)' }}>{selected.account_number}</code>
                  <button type="button" onClick={() => copyNumber(selected.account_number)} className="text-xs px-2 py-1 rounded-lg"
                    style={{ backgroundColor: 'var(--md-sys-color-surface-container-high)', color: 'var(--md-sys-color-primary)' }}>
                    {copied ? 'تم النسخ ✓' : 'نسخ'}
                  </button>
                  {selected.account_name && (
                    <span className="text-xs" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>{selected.account_name}</span>
                  )}
                </div>
              )}
              {selected.instructions && (
                <p className="text-xs whitespace-pre-line leading-relaxed" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>
                  {selected.instructions}
                </p>
              )}
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>رقم الهاتف المحوِّل منه</label>
            <input
              type="tel"
              value={senderPhone}
              onChange={e => setSenderPhone(e.target.value)}
              placeholder="01XXXXXXXXX"
              dir="ltr"
              className="w-full text-sm outline-none"
              style={{
                backgroundColor: 'var(--md-sys-color-surface-container-low)',
                border: '1px solid var(--md-sys-color-outline-variant)',
                borderRadius: 'var(--md-sys-shape-corner-small)',
                padding: '12px 16px',
                color: 'var(--md-sys-color-on-surface)',
              }}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>
              صورة إيصال التحويل <span style={{ color: 'var(--md-sys-color-error)' }}>*</span>
            </label>
            <input id={receiptInputId} type="file" accept="image/*" className="hidden"
              onChange={e => pickFile(e.target.files?.[0] || null)} />
            <button type="button" onClick={() => document.getElementById(receiptInputId)?.click()}
              className="flex items-center justify-center gap-2 w-full px-4 py-3 text-sm font-medium"
              style={{
                backgroundColor: receipt ? 'var(--md-sys-color-surface-container-high)' : 'var(--md-sys-color-surface-container-low)',
                border: `1px solid ${receipt ? 'var(--md-sys-color-primary)' : 'var(--md-sys-color-outline-variant)'}`,
                borderRadius: 'var(--md-sys-shape-corner-small)',
                color: 'var(--md-sys-color-on-surface)',
              }}>
              <span className="material-symbols-outlined text-[20px]">{receipt ? 'attach_file' : 'upload'}</span>
              <span className="truncate max-w-[200px]">{fileName || 'اضغط لاختيار صورة الإيصال'}</span>
            </button>
            {receipt && (
              <img src={receipt} alt="الإيصال" className="w-full max-h-48 object-contain rounded-md3-sm border"
                style={{ borderColor: 'var(--md-sys-color-outline-variant)' }} />
            )}
          </div>
        </div>
      )}

      {error && <p className="text-sm" style={{ color: 'var(--md-sys-color-error)' }}>{error}</p>}

      <button type="button" onClick={submit} disabled={submitting || methods.length === 0}
        className="w-full py-3.5 rounded-full text-sm font-bold disabled:opacity-50 flex items-center justify-center gap-2"
        style={{ backgroundColor: 'var(--md-sys-color-primary)', color: 'var(--md-sys-color-on-primary)' }}>
        {submitting && <span className="w-4 h-4 border-2 rounded-full animate-spin" style={{ borderColor: 'rgba(255,255,255,0.35)', borderTopColor: 'var(--md-sys-color-on-primary)' }} />}
        {submitting ? 'جاري الإرسال...' : orderId
          ? (isDigital ? 'إرسال الإيصال للمراجعة' : 'تأكيد اختيار الدفع')
          : (isDigital ? 'تأكيد الحجز وإرسال الإيصال' : 'تأكيد الحجز')}
      </button>
    </div>
  );
}
