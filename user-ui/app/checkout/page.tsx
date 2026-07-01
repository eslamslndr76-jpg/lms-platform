'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { api } from '../../lib/api';
import { compressAndEncode } from '../../lib/imageUtils';
import { useToast } from '../../components/Toast';
import { useBranding } from '../../components/BrandingProvider';
import { useAuth } from '../../lib/auth';

interface CartItem {
  id: number;
  course_id: number;
  title_ar: string;
  price: number;
  quantity: number;
  image_url?: string;
}

function CheckoutContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { show } = useToast();
  const { primaryColor } = useBranding();
  const [file, setFile] = useState<File | null>(null);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [noteStudent, setNoteStudent] = useState('');
  const [loading, setLoading] = useState(false);
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [cartTotal, setCartTotal] = useState(0);
  const [cartFetching, setCartFetching] = useState(true);

  const courseId = searchParams.get('course_id');
  const amount = searchParams.get('amount');
  const isDirect = !!courseId && !!amount;

  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.push('/login'); return; }
    if (!isDirect) {
      api('/api/cart').then(data => {
        setCartItems(data.items || []);
        setCartTotal(data.total || 0);
      }).catch(() => show('فشل تحميل السلة', 'error')).finally(() => setCartFetching(false));
    } else {
      setCartFetching(false);
    }
  }, [user, authLoading, router, isDirect, show]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (isDirect) {
        const data: any = { course_id: Number(courseId), amount: Number(amount), payment_method: paymentMethod };
        if (noteStudent.trim()) data.note_student = noteStudent.trim();
        if (file) data.receipt_url = await compressAndEncode(file);
        await api('/api/orders', { method: 'POST', body: JSON.stringify(data) });
        show('تم تقديم الطلب بنجاح!');
      } else {
        if (cartItems.length === 0) { show('السلة فارغة', 'error'); setLoading(false); return; }
        for (const item of cartItems) {
          const data: any = { course_id: item.course_id, amount: Number(item.price) * item.quantity, payment_method: paymentMethod };
          if (noteStudent.trim()) data.note_student = noteStudent.trim();
          await api('/api/orders', { method: 'POST', body: JSON.stringify(data) });
        }
        await api('/api/cart', { method: 'DELETE' });
        show('تم تقديم الطلبات بنجاح!');
      }
      router.push('/dashboard');
    } catch (err: any) {
      show(err.message || 'فشل تقديم الطلب', 'error');
    } finally {
      setLoading(false);
    }
  };

  if (authLoading || cartFetching) {
    return <div className="flex items-center justify-center min-h-[60vh]"><div className="text-center" style={{ color: 'var(--text-muted)' }}>جاري التحميل...</div></div>;
  }

  const displayItems = isDirect
    ? [{ title_ar: 'الكورس', amount: Number(amount) }]
    : cartItems.map(i => ({ title_ar: i.title_ar, amount: Number(i.price) * i.quantity }));
  const totalAmount = isDirect ? Number(amount) : cartTotal;

  return (
    <div className="max-w-2xl mx-auto p-4">
      <Link href={isDirect ? `/courses/${courseId}` : '/cart'} className="text-sm mb-4 block" style={{ color: primaryColor }}>← رجوع</Link>
      <h1 className="text-2xl font-bold mb-6" style={{ color: 'var(--text)' }}>إتمام الشراء</h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Order Summary */}
        <div className="rounded-2xl p-4 shadow-sm" style={{ backgroundColor: 'var(--card)' }}>
          <h3 className="font-bold text-sm mb-3" style={{ color: 'var(--text)' }}>ملخص الطلب</h3>
          <div className="space-y-2">
            {displayItems.map((item, i) => (
              <div key={i} className="flex items-center justify-between text-sm">
                <span style={{ color: 'var(--text)' }}>{item.title_ar}</span>
                <span className="font-medium" style={{ color: 'var(--text-muted)' }}>{item.amount.toLocaleString()} ج.م</span>
              </div>
            ))}
            <div className="border-t pt-2 mt-2 flex items-center justify-between" style={{ borderColor: 'var(--border)' }}>
              <span className="font-bold" style={{ color: 'var(--text)' }}>الإجمالي</span>
              <span className="text-xl font-bold" style={{ color: primaryColor }}>{totalAmount.toLocaleString()} ج.م</span>
            </div>
          </div>
        </div>

        {/* Payment Method */}
        <div className="rounded-2xl p-4 shadow-sm space-y-3" style={{ backgroundColor: 'var(--card)' }}>
          <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>طريقة الدفع</p>
          {[
            { value: 'wallet', label: 'محفظة إلكترونية (Wallet)' },
            { value: 'instapay', label: 'إنستاباي (InstaPay)' },
            { value: 'cash', label: 'كاش' },
          ].map(opt => (
            <label key={opt.value} className="flex items-center gap-3 p-3 rounded-xl cursor-pointer"
              style={{ backgroundColor: paymentMethod === opt.value ? `${primaryColor}15` : 'var(--bg)', border: paymentMethod === opt.value ? `2px solid ${primaryColor}` : '2px solid transparent' }}>
              <input type="radio" name="payment_method" value={opt.value} checked={paymentMethod === opt.value}
                onChange={() => setPaymentMethod(opt.value)} className="accent-blue-600" />
              <span className="text-sm" style={{ color: 'var(--text)' }}>{opt.label}</span>
            </label>
          ))}
        </div>

        {/* Receipt Upload */}
        <div className="rounded-2xl p-4 shadow-sm" style={{ backgroundColor: 'var(--card)' }}>
          <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text)' }}>إرفاق إيصال الدفع (اختياري)</label>
          <input type="file" accept="image/*" onChange={e => setFile(e.target.files?.[0] || null)}
            className="w-full text-sm" style={{ color: 'var(--text)' }} />
        </div>

        {/* Note */}
        <div className="rounded-2xl p-4 shadow-sm" style={{ backgroundColor: 'var(--card)' }}>
          <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text)' }}>ملاحظاتك (اختياري)</label>
          <textarea value={noteStudent} onChange={e => setNoteStudent(e.target.value)}
            placeholder="أي ملاحظات تريد إضافتها لطلبك..."
            className="w-full px-4 py-2.5 rounded-xl border text-sm h-20"
            style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }} />
        </div>

        <button type="submit" disabled={loading || (isDirect ? false : cartItems.length === 0)}
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
