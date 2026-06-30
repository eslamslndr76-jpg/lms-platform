'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { api } from '../../lib/api';
import { useToast } from '../../components/Toast';
import { useBranding } from '../../components/BrandingProvider';

export default function CheckoutPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { show } = useToast();
  const { primaryColor } = useBranding();
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);

  const courseId = searchParams.get('course_id');
  const amount = searchParams.get('amount');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!courseId || !amount) return;
    setLoading(true);
    try {
      const data: any = { course_id: Number(courseId), amount: Number(amount) };
      if (file) {
        const formData = new FormData();
        formData.append('receipt', file);
        const uploadRes = await fetch(`http://localhost:3001/api/upload`, { method: 'POST', body: formData });
        const uploadData = await uploadRes.json();
        data.receipt_url = uploadData.url;
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
      <h1 className="text-2xl font-bold mb-6">إتمام الشراء</h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <p className="text-gray-600 mb-1">المبلغ المطلوب</p>
          <p className="text-3xl font-bold" style={{ color: primaryColor }}>{amount} ج.م</p>
        </div>

        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <label className="block text-sm font-medium text-gray-700 mb-2">إرفاق إيصال الدفع (اختياري)</label>
          <input type="file" accept="image/*,.pdf" onChange={e => setFile(e.target.files?.[0] || null)}
            className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-medium file:text-white"
            style={{ '--file-bg': primaryColor } as any} />
        </div>

        <button type="submit" disabled={loading || !courseId}
          className="w-full py-4 rounded-2xl text-white font-bold text-lg shadow-lg disabled:opacity-50"
          style={{ backgroundColor: primaryColor }}>
          {loading ? 'جاري التقديم...' : 'تأكيد الطلب'}
        </button>

        <p className="text-xs text-gray-400 text-center">
          الدفع متاح عبر: إي-والت، إنستاباي، أو كاش
        </p>
      </form>
    </div>
  );
}
