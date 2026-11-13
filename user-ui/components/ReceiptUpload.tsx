'use client';

import { useState } from 'react';
import { api } from '../lib/api';
import { compressAndEncode } from '../lib/imageUtils';
import { useToast } from './Toast';

/**
 * Treasury receipt upload for a booking. The student pays in cash, takes the
 * receipt, then uploads its photo here; the order moves to "review" until an
 * admin approves it from the dashboard. PATCH /api/orders/:id/receipt.
 */
export default function ReceiptUpload({ orderId, onDone }: {
  orderId: number;
  onDone?: () => void;
}) {
  const { show } = useToast();
  const [receipt, setReceipt] = useState('');
  const [fileName, setFileName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const inputId = `receipt-upload-${orderId}`;

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
    if (!receipt) { setError('أرفق صورة إيصال الدفع'); return; }
    setBusy(true);
    try {
      await api(`/api/orders/${orderId}/receipt`, {
        method: 'PATCH',
        body: JSON.stringify({ receipt_url: receipt }),
      });
      show('تم رفع الإيصال، وسيتم مراجعته من الإدارة', 'success');
      onDone?.();
    } catch (e: any) {
      setError(e?.message || 'فشل رفع الإيصال، حاول مرة أخرى');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3" dir="rtl">
      <div className="p-3 rounded-md3-sm text-xs leading-relaxed"
        style={{ backgroundColor: 'var(--md-sys-color-surface-container-low)', color: 'var(--md-sys-color-on-surface-variant)' }}>
        ادفع في خزنة المعهد واحصل على الإيصال، ثم ارفع صورته هنا. تُراجع من الإدارة ويُفعَّل تسجيلك بعد الموافقة.
      </div>

      <input id={inputId} type="file" accept="image/*" className="hidden"
        onChange={e => pickFile(e.target.files?.[0] || null)} />
      <button type="button" onClick={() => document.getElementById(inputId)?.click()}
        className="flex items-center justify-center gap-2 w-full px-4 py-3 text-sm font-medium"
        style={{
          backgroundColor: receipt ? 'var(--md-sys-color-surface-container-high)' : 'var(--md-sys-color-surface-container-low)',
          border: `1px solid ${receipt ? 'var(--md-sys-color-primary)' : 'var(--md-sys-color-outline-variant)'}`,
          borderRadius: 'var(--md-sys-shape-corner-small)',
          color: 'var(--md-sys-color-on-surface)',
        }}>
        <span className="material-symbols-outlined text-[20px]">{receipt ? 'attach_file' : 'upload'}</span>
        <span className="truncate max-w-[240px]">{fileName || 'اضغط لاختيار صورة الإيصال'}</span>
      </button>

      {receipt && (
        <img src={receipt} alt="الإيصال" className="w-full max-h-56 object-contain rounded-md3-sm border"
          style={{ borderColor: 'var(--md-sys-color-outline-variant)' }} />
      )}

      {error && <p className="text-sm" style={{ color: 'var(--md-sys-color-error)' }}>{error}</p>}

      <button type="button" onClick={submit} disabled={busy || !receipt}
        className="w-full py-3 rounded-full text-sm font-bold disabled:opacity-50 flex items-center justify-center gap-2"
        style={{ backgroundColor: 'var(--md-sys-color-primary)', color: 'var(--md-sys-color-on-primary)' }}>
        {busy && <span className="w-4 h-4 border-2 rounded-full animate-spin" style={{ borderColor: 'rgba(255,255,255,0.35)', borderTopColor: 'var(--md-sys-color-on-primary)' }} />}
        {busy ? 'جاري الرفع...' : 'رفع الإيصال'}
      </button>
    </div>
  );
}
