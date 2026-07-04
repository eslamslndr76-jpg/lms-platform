'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '../../../lib/api';
import { useAuth } from '../../../lib/auth';
import { useBranding } from '../../../components/BrandingProvider';
import { useToast } from '../../../components/Toast';
import { PageSkeleton } from '../../../components/Skeleton';

interface CartItem {
  id: number;
  course_id: number;
  title_ar: string;
  price: number;
  image_url?: string;
  instructor?: string;
  category_name_ar?: string;
}

interface Suggestion {
  id: number;
  title_ar: string;
  price: number;
  image_url?: string;
  instructor?: string;
  category_name_ar?: string;
}

export default function CartPage() {
  const { user, loading: authLoading } = useAuth();
  const { primaryColor, secondaryColor } = useBranding();
  const { show } = useToast();
  const router = useRouter();
  const [items, setItems] = useState<CartItem[]>([]);
  const [total, setTotal] = useState(0);
  const [count, setCount] = useState(0);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchCart = useCallback(async () => {
    if (!user) return;
    try {
      const data = await api('/api/cart');
      setItems(data.items || []);
      setTotal(data.total || 0);
      setCount(data.count || 0);
    } catch {
      show('فشل تحميل السلة', 'error');
    } finally {
      setLoading(false);
    }
  }, [user, show]);

  const fetchSuggestions = useCallback(async () => {
    if (!user) return;
    try {
      const data = await api('/api/cart/suggestions');
      setSuggestions(data || []);
    } catch { /* ignore */ }
  }, [user]);

  useEffect(() => {
    if (!authLoading && !user) { router.push('/login'); return; }
    Promise.all([fetchCart(), fetchSuggestions()]);
  }, [user, authLoading, router, fetchCart, fetchSuggestions]);

  const removeItem = async (itemId: number) => {
    try {
      await api(`/api/cart/${itemId}`, { method: 'DELETE' });
      show('تم حذف الكورس من السلة');
      fetchCart();
      fetchSuggestions();
    } catch {
      show('فشل الحذف', 'error');
    }
  };

  const clearCart = async () => {
    try {
      await api('/api/cart', { method: 'DELETE' });
      show('تم تفريغ السلة');
      fetchCart();
      fetchSuggestions();
    } catch {
      show('فشل تفريغ السلة', 'error');
    }
  };

  const addToCart = async (courseId: number) => {
    try {
      await api('/api/cart', { method: 'POST', body: JSON.stringify({ course_id: courseId }) });
      show('أضيف للسلة');
      fetchCart();
      fetchSuggestions();
    } catch {
      show('فشل الإضافة', 'error');
    }
  };

  if (authLoading || loading) return <PageSkeleton />;

  return (
    <div className="max-w-4xl mx-auto p-4">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>
          سلة المشتريات {count > 0 && <span className="text-sm font-normal" style={{ color: 'var(--text-muted)' }}>({count})</span>}
        </h1>
        <Link href="/courses" className="text-sm" style={{ color: primaryColor }}>← متابعة التسوق</Link>
      </div>

      {items.length === 0 ? (
        <div className="text-center py-16">
          <div className="text-6xl mb-4">🛒</div>
          <h2 className="text-xl font-bold mb-2" style={{ color: 'var(--text)' }}>السلة فارغة</h2>
          <p className="mb-6" style={{ color: 'var(--text-muted)' }}>لم تقم بإضافة أي كورسات بعد</p>
          <Link href="/courses" className="inline-block px-6 py-3 rounded-xl text-white font-medium shadow-lg" style={{ backgroundColor: primaryColor }}>
            تصفح الكورسات
          </Link>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Cart Items */}
          <div className="space-y-3">
            {items.map(item => (
              <div key={item.id} className="rounded-2xl p-4 shadow-sm flex gap-4" style={{ backgroundColor: 'var(--card)' }}>
                <Link href={`/courses/${item.course_id}`} className="w-20 h-20 rounded-xl overflow-hidden flex-shrink-0">
                  {item.image_url ? (
                    <img src={item.image_url} alt={item.title_ar} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-white font-bold" style={{ backgroundColor: primaryColor }}>
                      {item.title_ar.charAt(0)}
                    </div>
                  )}
                </Link>
                <div className="flex-1 min-w-0">
                  <Link href={`/courses/${item.course_id}`} className="block font-bold text-sm hover:underline" style={{ color: 'var(--text)' }}>
                    {item.title_ar}
                  </Link>
                  {item.instructor && <p className="text-xs" style={{ color: 'var(--text-muted)' }}>🧑‍🏫 {item.instructor}</p>}
                  <div className="flex items-center justify-between mt-3">
                    <div className="flex items-center gap-3">
                      <span className="text-lg font-bold" style={{ color: primaryColor }}>{Number(item.price).toLocaleString()} ج.م</span>
                      <button onClick={() => removeItem(item.id)} className="text-xs px-2 py-1 rounded-lg bg-red-50 text-red-600 hover:bg-red-100">🗑️</button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Summary */}
          <div className="rounded-2xl p-4 shadow-sm" style={{ backgroundColor: 'var(--card)' }}>
            <div className="flex items-center justify-between mb-3">
              <span style={{ color: 'var(--text-muted)' }}>الإجمالي</span>
              <span className="text-2xl font-bold" style={{ color: primaryColor }}>{total.toLocaleString()} ج.م</span>
            </div>
            <div className="flex gap-3">
              <button onClick={() => router.push('/checkout')} className="flex-1 py-3.5 rounded-xl text-white font-bold shadow-lg" style={{ backgroundColor: primaryColor }}>
                إتمام الشراء
              </button>
              <button onClick={clearCart} className="px-4 py-3.5 rounded-xl border text-sm font-medium" style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
                تفريغ
              </button>
            </div>
          </div>

          {/* Suggestions */}
          {suggestions.length > 0 && (
            <div>
              <h3 className="font-bold text-lg mb-3" style={{ color: 'var(--text)' }}>🔍 قد يعجبك أيضاً</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {suggestions.map(s => (
                  <div key={s.id} className="rounded-2xl p-3 flex items-center gap-3 shadow-sm border" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}>
                    <Link href={`/courses/${s.id}`} className="w-16 h-16 rounded-xl overflow-hidden flex-shrink-0">
                      {s.image_url ? (
                        <img src={s.image_url} alt={s.title_ar} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-white font-bold text-sm" style={{ background: `linear-gradient(135deg, ${primaryColor}, ${secondaryColor})` }}>
                          {s.title_ar.charAt(0)}
                        </div>
                      )}
                    </Link>
                    <div className="flex-1 min-w-0">
                      <Link href={`/courses/${s.id}`} className="block font-medium text-sm truncate hover:underline" style={{ color: 'var(--text)' }}>
                        {s.title_ar}
                      </Link>
                      {s.category_name_ar && <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{s.category_name_ar}</span>}
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-sm font-bold" style={{ color: primaryColor }}>{s.price > 0 ? `${s.price} ج.م` : 'مجاني'}</span>
                        <button onClick={() => addToCart(s.id)} className="text-xs px-2.5 py-1.5 rounded-lg text-white font-medium" style={{ backgroundColor: primaryColor }}>+ أضف للسلة</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
