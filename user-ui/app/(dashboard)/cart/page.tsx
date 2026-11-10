'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '../../../lib/api';
import { useAuth } from '../../../lib/auth';
import { useBranding } from '../../../components/BrandingProvider';
import { useToast } from '../../../components/Toast';
import { PageSkeleton } from '../../../components/Skeleton';
import { loginUrl } from '../../../lib/redirect';

interface CartItem { id: number; course_id: number; title_ar: string; price: number; image_url?: string; instructor?: string; category_name_ar?: string; }
interface Suggestion { id: number; title_ar: string; price: number; image_url?: string; instructor?: string; category_name_ar?: string; }

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
    try { const d = await api('/api/cart'); setItems(d.items || []); setTotal(d.total || 0); setCount(d.count || 0); } catch { show('فشل تحميل السلة', 'error'); } finally { setLoading(false); }
  }, [user, show]);

  const fetchSuggestions = useCallback(async () => {
    if (!user) return;
    try { setSuggestions((await api('/api/cart/suggestions')) || []); } catch { /* ignore */ }
  }, [user]);

  useEffect(() => {
    if (!authLoading && !user) { router.push(loginUrl()); return; }
    Promise.all([fetchCart(), fetchSuggestions()]);
  }, [user, authLoading, router, fetchCart, fetchSuggestions]);

  const removeItem = async (itemId: number) => { try { await api(`/api/cart/${itemId}`, { method: 'DELETE' }); show('تم حذف الكورس من السلة'); fetchCart(); fetchSuggestions(); } catch { show('فشل الحذف', 'error'); } };
  const clearCart = async () => { try { await api('/api/cart', { method: 'DELETE' }); show('تم تفريغ السلة'); fetchCart(); fetchSuggestions(); } catch { show('فشل تفريغ السلة', 'error'); } };
  const addToCart = async (courseId: number) => { try { await api('/api/cart', { method: 'POST', body: JSON.stringify({ course_id: courseId }) }); show('أضيف للسلة'); fetchCart(); fetchSuggestions(); } catch { show('فشل الإضافة', 'error'); } };

  if (authLoading || loading) return <PageSkeleton />;

  return (
    <div className="max-w-4xl mx-auto p-4">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2" style={{ color: 'var(--md-sys-color-on-surface)' }}>
          <span className="material-symbols-outlined" style={{ color: 'var(--md-sys-color-primary)' }}>shopping_cart</span>
          سلة المشتريات {count > 0 && <span className="text-sm font-normal" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>({count})</span>}
        </h1>
        <Link href="/courses" className="text-sm flex items-center gap-1" style={{ color: 'var(--md-sys-color-primary)' }}>
          <span className="material-symbols-outlined text-[16px]">arrow_forward</span> متابعة التسوق
        </Link>
      </div>

      {items.length === 0 ? (
        <div className="text-center py-16">
          <span className="material-symbols-outlined text-[64px] block mb-4" style={{ color: 'var(--md-sys-color-outline)' }}>shopping_cart</span>
          <h2 className="text-xl font-bold mb-2" style={{ color: 'var(--md-sys-color-on-surface)' }}>السلة فارغة</h2>
          <p className="mb-6" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>لم تقم بإضافة أي كورسات بعد</p>
          <Link href="/courses" className="inline-flex items-center gap-2 h-12 px-6 rounded-full text-sm font-medium"
            style={{ backgroundColor: 'var(--md-sys-color-primary)', color: 'var(--md-sys-color-on-primary)' }}>
            <span className="material-symbols-outlined text-[18px]">search</span> تصفح الكورسات
          </Link>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="space-y-3">
            {items.map(item => (
              <div key={item.id} className="rounded-md3-md p-4 flex gap-4" style={{ backgroundColor: 'var(--md-sys-color-surface-container)' }}>
                <Link href={`/courses/${item.course_id}`} className="w-20 h-20 rounded-md3-md overflow-hidden flex-shrink-0">
                  {item.image_url ? (
                    <img src={item.image_url} alt={item.title_ar} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-white font-bold" style={{ backgroundColor: 'var(--md-sys-color-primary)' }}>{item.title_ar.charAt(0)}</div>
                  )}
                </Link>
                <div className="flex-1 min-w-0">
                  <Link href={`/courses/${item.course_id}`} className="block font-bold text-sm hover:underline" style={{ color: 'var(--md-sys-color-on-surface)' }}>{item.title_ar}</Link>
                  {item.instructor && <p className="text-xs flex items-center gap-1" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}><span className="material-symbols-outlined text-[12px]">person</span> {item.instructor}</p>}
                  <div className="flex items-center justify-between mt-3">
                    <span className="text-lg font-bold" style={{ color: 'var(--md-sys-color-primary)' }}>{Number(item.price).toLocaleString()} ج.م</span>
                    <button onClick={() => removeItem(item.id)} className="w-8 h-8 rounded-full flex items-center justify-center" style={{ color: 'var(--md-sys-color-error)' }}>
                      <span className="material-symbols-outlined text-[18px]">delete</span>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="rounded-md3-md p-4" style={{ backgroundColor: 'var(--md-sys-color-surface-container)' }}>
            <div className="flex items-center justify-between mb-3">
              <span style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>الإجمالي</span>
              <span className="text-2xl font-bold" style={{ color: 'var(--md-sys-color-primary)' }}>{total.toLocaleString()} ج.م</span>
            </div>
            <div className="flex gap-3">
              <button onClick={() => router.push('/checkout')} className="flex-1 h-12 rounded-full text-white font-bold text-sm"
                style={{ backgroundColor: 'var(--md-sys-color-primary)', color: 'var(--md-sys-color-on-primary)' }}>إتمام الشراء</button>
              <button onClick={clearCart} className="px-4 h-12 rounded-full border text-sm font-medium"
                style={{ borderColor: 'var(--md-sys-color-outline)', color: 'var(--md-sys-color-on-surface-variant)' }}>تفريغ</button>
            </div>
          </div>

          {suggestions.length > 0 && (
            <div>
              <h3 className="font-bold text-lg mb-3 flex items-center gap-2" style={{ color: 'var(--md-sys-color-on-surface)' }}>
                <span className="material-symbols-outlined" style={{ color: 'var(--md-sys-color-primary)' }}>recommend</span> قد يعجبك أيضاً
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {suggestions.map(s => (
                  <div key={s.id} className="rounded-md3-md p-3 flex items-center gap-3" style={{ backgroundColor: 'var(--md-sys-color-surface-container)' }}>
                    <Link href={`/courses/${s.id}`} className="w-16 h-16 rounded-md3-md overflow-hidden flex-shrink-0">
                      {s.image_url ? <img src={s.image_url} alt={s.title_ar} className="w-full h-full object-cover" /> : (
                        <div className="w-full h-full flex items-center justify-center text-white font-bold text-sm" style={{ background: `linear-gradient(135deg, ${primaryColor}, ${secondaryColor})` }}>{s.title_ar.charAt(0)}</div>
                      )}
                    </Link>
                    <div className="flex-1 min-w-0">
                      <Link href={`/courses/${s.id}`} className="block font-medium text-sm truncate hover:underline" style={{ color: 'var(--md-sys-color-on-surface)' }}>{s.title_ar}</Link>
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-sm font-bold" style={{ color: 'var(--md-sys-color-primary)' }}>{s.price > 0 ? `${s.price} ج.م` : 'مجاني'}</span>
                        <button onClick={() => addToCart(s.id)} className="text-xs px-2.5 py-1.5 rounded-full text-white font-medium"
                          style={{ backgroundColor: 'var(--md-sys-color-secondary-container)', color: 'var(--md-sys-color-on-secondary-container)' }}>+ أضف</button>
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
