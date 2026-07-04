'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useBranding } from './BrandingProvider';
import { useToast } from './Toast';

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
}

export default function CartDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user } = useAuth();
  const { primaryColor } = useBranding();
  const { show } = useToast();
  const router = useRouter();
  const [items, setItems] = useState<CartItem[]>([]);
  const [total, setTotal] = useState(0);
  const [count, setCount] = useState(0);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchCart = useCallback(async () => {
    if (!user) { setItems([]); setTotal(0); setCount(0); setLoading(false); return; }
    try {
      const data = await api('/api/cart');
      setItems(data.items || []);
      setTotal(data.total || 0);
      setCount(data.count || 0);
    } catch {
      setItems([]); setTotal(0); setCount(0);
    } finally {
      setLoading(false);
    }
  }, [user]);

  const fetchSuggestions = useCallback(async () => {
    if (!user) return;
    try {
      const data = await api('/api/cart/suggestions');
      setSuggestions(data || []);
    } catch { /* ignore */ }
  }, [user]);

  useEffect(() => {
    if (open) { fetchCart(); fetchSuggestions(); }
  }, [open, fetchCart, fetchSuggestions]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (open) document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  const removeItem = async (itemId: number) => {
    try {
      await api(`/api/cart/${itemId}`, { method: 'DELETE' });
      show('تم حذف الكورس من السلة');
      fetchCart();
    } catch {
      show('فشل الحذف', 'error');
    }
  };

  const checkout = () => {
    onClose();
    router.push('/checkout');
  };

  const addSuggestionToCart = async (courseId: number) => {
    try {
      await api('/api/cart', { method: 'POST', body: JSON.stringify({ course_id: courseId }) });
      show('أضيف للسلة');
      fetchCart();
      fetchSuggestions();
    } catch {
      show('فشل الإضافة', 'error');
    }
  };

  return (
    <>
      {open && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/40" onClick={onClose} />
          <div className="absolute inset-y-0 left-0 w-full max-w-md shadow-2xl animate-slide-left" style={{ backgroundColor: 'var(--card)' }}>
            <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: 'var(--border)' }}>
              <h2 className="text-lg font-bold" style={{ color: 'var(--text)' }}>
                سلة المشتريات {count > 0 && <span className="text-sm font-normal" style={{ color: 'var(--text-muted)' }}>({count})</span>}
              </h2>
              <button onClick={onClose} className="p-2 rounded-xl hover:bg-black/5" style={{ color: 'var(--text)' }}>✕</button>
            </div>

            <div className="overflow-y-auto" style={{ height: 'calc(100vh - 140px)' }}>
              {loading ? (
                <div className="p-8 text-center" style={{ color: 'var(--text-muted)' }}>جاري التحميل...</div>
              ) : items.length === 0 ? (
                <div className="p-8 text-center">
                  <div className="text-4xl mb-4">🛒</div>
                  <p className="font-medium mb-1" style={{ color: 'var(--text)' }}>السلة فارغة</p>
                  <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>تصفح الكورسات وأضف ما يعجبك</p>
                  <button onClick={() => { onClose(); router.push('/courses'); }}
                    className="px-6 py-2.5 text-white rounded-xl text-sm font-medium" style={{ backgroundColor: primaryColor }}>
                    تصفح الكورسات
                  </button>
                </div>
              ) : (
                <div className="p-4 space-y-3">
                  {items.map(item => (
                    <div key={item.id} className="flex gap-3 p-3 rounded-xl" style={{ backgroundColor: 'var(--bg)' }}>
                      <div className="w-16 h-16 rounded-xl overflow-hidden flex-shrink-0">
                        {item.image_url ? (
                          <img src={item.image_url} alt={item.title_ar} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-white font-bold" style={{ backgroundColor: primaryColor }}>
                            {item.title_ar.charAt(0)}
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <Link href={`/courses/${item.course_id}`} onClick={onClose} className="block font-medium text-sm truncate" style={{ color: 'var(--text)' }}>
                          {item.title_ar}
                        </Link>
                        {item.instructor && <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>{item.instructor}</p>}
                        <div className="flex items-center justify-between mt-2">
                          <span className="text-sm font-bold" style={{ color: primaryColor }}>{Number(item.price).toLocaleString()} ج.م</span>
                          <button onClick={() => removeItem(item.id)} className="p-1 text-xs hover:bg-red-50 rounded-lg" style={{ color: '#dc2626' }}>🗑️</button>
                        </div>
                      </div>
                    </div>
                  ))}

                  {suggestions.length > 0 && (
                    <div className="mt-4 pt-4 border-t" style={{ borderColor: 'var(--border)' }}>
                      <p className="text-xs font-bold mb-3" style={{ color: 'var(--text-muted)' }}>🔍 قد يعجبك أيضاً</p>
                      <div className="space-y-2">
                        {suggestions.map(s => (
                          <div key={s.id} className="flex items-center justify-between p-2 rounded-lg" style={{ backgroundColor: 'var(--bg)' }}>
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="text-sm font-medium truncate" style={{ color: 'var(--text)' }}>{s.title_ar}</span>
                              <span className="text-xs font-bold whitespace-nowrap" style={{ color: primaryColor }}>{Number(s.price) > 0 ? `${s.price} ج.م` : 'مجاني'}</span>
                            </div>
                            <button onClick={() => addSuggestionToCart(s.id)} className="text-xs px-2 py-1 rounded-lg text-white whitespace-nowrap" style={{ backgroundColor: primaryColor }}>+ أضف</button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {items.length > 0 && (
              <div className="absolute bottom-0 left-0 right-0 p-4 border-t" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm" style={{ color: 'var(--text-muted)' }}>الإجمالي</span>
                  <span className="text-xl font-bold" style={{ color: primaryColor }}>{total.toLocaleString()} ج.م</span>
                </div>
                <button onClick={checkout} className="w-full py-3 rounded-xl text-white font-bold text-sm" style={{ backgroundColor: primaryColor }}>
                  إتمام الشراء
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
