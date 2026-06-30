'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { api } from '../../lib/api';
import { compressAndEncode } from '../../lib/imageUtils';
import { useToast } from '../../components/Toast';
import { useBranding } from '../../components/BrandingProvider';

function CheckoutContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { show } = useToast();
  const { primaryColor } = useBranding();
  const [file, setFile] = useState<File | null>(null);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [loading, setLoading] = useState(false);

  const courseId = searchParams.get('course_id');
  const amount = searchParams.get('amount');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!courseId || !amount) {
      router.push('/courses');
      return;
    }
    setLoading(true);
    try {
      const data: any = { course_id: Number(courseId), amount: Number(amount), payment_method: paymentMethod };
      if (file) {
        data.receipt_url = await compressAndEncode(file);
      }
      await api('/api/orders', {
        method: 'POST',
        body: JSON.stringify(data),
      });
      show('تم تقديم الطلب بنجاح!');
      router.push('/dashboard');
    } catch (err: any) {
      show(err.message || 'فشل تقديم الطلب', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen p-4">
      <Link href="/" className="text-sm mb-4 block" style={{ color: primaryColor }}>← رجوع</Link>
      <h1 className="text-2xl font-bold mb-6" style={{ color: 'var(--text)' }}>إتمام الشراء</h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="rounded-2xl p-4 shadow-sm" style={{ backgroundColor: 'var(--card)' }}>
          <p className="text-sm mb-1" style={{ color: 'var(--text-muted)' }}>المبلغ المطلوب</p>
          <p className="text-3xl font-bold" style={{ color: primaryColor }}>{amount} ج.م</p>
        </div>

        <div className="rounded-2xl p-4 shadow-sm space-y-3" style={{ backgroundColor: 'var(--card)' }}>
          <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>طريقة الدفع</p>
          {[
            { value: 'wallet', label: 'محفظة إلكترونية (Wallet)' },
            { value: 'instapay', label: 'إنستاباي (InstaPay)' },
            { value: 'cash', label: 'كاش' },
          ].map(opt => (
            <label key={opt.value} className="flex items-center gap-3 p-3 rounded-xl cursor-pointer"
              style={{ backgroundColor: paymentMethod === opt.value ? 'var(--primary)' + '15' : 'var(--bg)', border: paymentMethod === opt.value ? '2px solid var(--primary)' : '2px solid transparent' }}>
              <input type="radio" name="payment_method" value={opt.value} checked={paymentMethod === opt.value}
                onChange={() => setPaymentMethod(opt.value)} className="accent-blue-600" />
              <span className="text-sm" style={{ color: 'var(--text)' }}>{opt.label}</span>
            </label>
          ))}
        </div>

        <div className="rounded-2xl p-4 shadow-sm" style={{ backgroundColor: 'var(--card)' }}>
          <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text)' }}>إرفاق إيصال الدفع (اختياري)</label>
          <input type="file" accept="image/*" onChange={e => setFile(e.target.files?.[0] || null)}
            className="w-full text-sm" style={{ color: 'var(--text)' }} />
        </div>

        <button type="submit" disabled={loading || !courseId}
          className="w-full py-4 rounded-2xl text-white font-bold text-lg shadow-lg disabled:opacity-50"
          style={{ backgroundColor: primaryColor }}>
          {loading ? 'جاري التقديم...' : 'تأكيد الطلب'}
        </button>
      </form>
    </div>
  );
}

import { Suspense } from 'react';

export default function CheckoutPage() {
  return (
    <Suspense fallback={<div className="p-4 text-center">جاري التحميل...</div>}>
      <CheckoutContent />
    </Suspense>
  );
}