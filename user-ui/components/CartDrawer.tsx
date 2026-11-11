'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useBranding } from './BrandingProvider';
import { useToast } from './Toast';
import M3BottomSheet from './M3BottomSheet';

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
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 1024);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

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
    } catch (e) {
      show(e instanceof Error ? e.message : 'فشل الإضافة', 'error');
    }
  };

  const cartContent = (
    <>
      {loading ? (
        <div className="p-8 text-center" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>
          <div className="w-full h-1 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--md-sys-color-surface-container-high)' }}><div className="h-full rounded-full animate-pulse" style={{ width: '40%', backgroundColor: 'var(--md-sys-color-primary)' }} /></div>
          <p className="mt-4 text-sm">جاري التحميل...</p>
        </div>
      ) : items.length === 0 ? (
        <div className="p-8 text-center">
          <span className="material-symbols-outlined text-[48px] block mb-4" style={{ color: 'var(--md-sys-color-outline)' }}>shopping_cart</span>
          <p className="font-medium mb-1" style={{ color: 'var(--md-sys-color-on-surface)' }}>السلة فارغة</p>
          <p className="text-sm mb-4" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>تصفح الكورسات وأضف ما يعجبك</p>
          <button onClick={() => { onClose(); router.push('/courses'); }}
            className="h-10 px-6 rounded-full text-sm font-medium"
            style={{ backgroundColor: 'var(--md-sys-color-primary)', color: 'var(--md-sys-color-on-primary)' }}>
            تصفح الكورسات
          </button>
        </div>
      ) : (
        <div className="p-4 space-y-2">
          {items.map(item => (
            <div key={item.id} className="flex gap-3 p-3 rounded-md3-md" style={{ backgroundColor: 'var(--md-sys-color-surface-container-low)' }}>
              <div className="w-16 h-16 rounded-md3-md overflow-hidden flex-shrink-0">
                {item.image_url ? (
                  <img src={item.image_url} alt={item.title_ar} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center font-bold" style={{ backgroundColor: 'var(--md-sys-color-primary-container)', color: 'var(--md-sys-color-on-primary-container)' }}>
                    {item.title_ar.charAt(0)}
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <Link href={`/courses/${item.course_id}`} onClick={onClose} className="block font-medium text-sm truncate" style={{ color: 'var(--md-sys-color-on-surface)' }}>
                  {item.title_ar}
                </Link>
                {item.instructor && <p className="text-xs truncate" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>{item.instructor}</p>}
                <div className="flex items-center justify-between mt-2">
                  <span className="text-sm font-bold" style={{ color: 'var(--md-sys-color-primary)' }}>{Number(item.price).toLocaleString()} ج.م</span>
                  <button onClick={() => removeItem(item.id)} className="w-8 h-8 rounded-full flex items-center justify-center" style={{ color: 'var(--md-sys-color-error)' }}>
                    <span className="material-symbols-outlined text-[18px]">delete</span>
                  </button>
                </div>
              </div>
            </div>
          ))}

          {suggestions.length > 0 && (
            <div className="mt-4 pt-4" style={{ borderTop: '1px solid var(--md-sys-color-outline-variant)' }}>
              <p className="text-xs font-medium mb-3 flex items-center gap-1.5" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>
                <span className="material-symbols-outlined text-[16px]">recommend</span>
                قد يعجبك أيضاً
              </p>
              <div className="space-y-2">
                {suggestions.map(s => (
                  <div key={s.id} className="flex items-center justify-between p-2 rounded-md3-md" style={{ backgroundColor: 'var(--md-sys-color-surface-container-lowest)' }}>
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-sm font-medium truncate" style={{ color: 'var(--md-sys-color-on-surface)' }}>{s.title_ar}</span>
                      <span className="text-xs font-bold whitespace-nowrap" style={{ color: 'var(--md-sys-color-primary)' }}>{Number(s.price) > 0 ? `${s.price} ج.م` : 'مجاني'}</span>
                    </div>
                    <button onClick={() => addSuggestionToCart(s.id)} className="text-xs px-3 py-1.5 rounded-full font-medium whitespace-nowrap" style={{ backgroundColor: 'var(--md-sys-color-secondary-container)', color: 'var(--md-sys-color-on-secondary-container)' }}>+ أضف</button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );

  const footerContent = items.length > 0 ? (
    <div className="shrink-0 p-4" style={{ backgroundColor: 'var(--md-sys-color-surface-container)', borderTop: '1px solid var(--md-sys-color-outline-variant)' }}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>الإجمالي</span>
        <span className="text-xl font-bold" style={{ color: 'var(--md-sys-color-primary)' }}>{total.toLocaleString()} ج.م</span>
      </div>
      <button onClick={checkout} className="w-full h-12 rounded-full font-medium text-sm" style={{ backgroundColor: 'var(--md-sys-color-primary)', color: 'var(--md-sys-color-on-primary)' }}>
        إتمام الشراء
      </button>
    </div>
  ) : null;

  if (isMobile) {
    return (
      <M3BottomSheet open={open} onClose={onClose} maxHeightVh={90}>
        <div className="flex flex-col">
          <div className="px-5 pb-3 flex items-center gap-2">
            <span className="material-symbols-outlined" style={{ color: 'var(--md-sys-color-on-surface)' }}>shopping_cart</span>
            <span className="font-medium text-base" style={{ color: 'var(--md-sys-color-on-surface)' }}>
              سلة المشتريات
              {count > 0 && <span className="text-sm font-normal mr-1" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>({count})</span>}
            </span>
          </div>
          {cartContent}
        </div>
        {footerContent}
      </M3BottomSheet>
    );
  }

  return (
    <>
      {open && (
        <div className="fixed inset-0 z-50">
          <div
            className="absolute inset-0 transition-opacity duration-300"
            style={{ backgroundColor: 'rgba(0,0,0,0.32)' }}
            onClick={onClose}
          />
          <div
            className="absolute inset-y-0 left-0 w-full max-w-md shadow-2xl animate-slide-left flex flex-col"
            style={{ backgroundColor: 'var(--md-sys-color-surface-container)' }}
          >
            {/* Header */}
            <div
              className="h-16 px-4 flex items-center justify-between shrink-0"
              style={{ borderBottom: '1px solid var(--md-sys-color-outline-variant)' }}
            >
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined" style={{ color: 'var(--md-sys-color-on-surface)' }}>shopping_cart</span>
                <h2 className="text-lg font-medium" style={{ color: 'var(--md-sys-color-on-surface)' }}>
                  سلة المشتريات
                  {count > 0 && <span className="text-sm font-normal ml-1" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>({count})</span>}
                </h2>
              </div>
              <button onClick={onClose} className="w-10 h-10 rounded-full flex items-center justify-center" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto" style={{ minHeight: 0 }}>
              {cartContent}
            </div>

            {/* Footer */}
            {footerContent}
          </div>
        </div>
      )}
    </>
  );
}
