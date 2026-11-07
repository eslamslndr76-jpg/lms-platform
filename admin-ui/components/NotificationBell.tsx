'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { api } from '../lib/api';

interface AppNotification {
  id: number;
  title: string;
  message?: string | null;
  type?: string | null;
  link?: string | null;
  is_read: number | boolean;
  created_at: string;
}

interface ToastState {
  notification: AppNotification;
  count: number;
}

interface PanelPosition {
  top: number;
  right: number;
  width: number;
}

const TYPE_ICON: Record<string, string> = {
  success: '✅',
  warning: '⚠️',
  info: 'ℹ️',
};

function formatRelativeTime(value?: string | null): string {
  if (!value) return '';
  const raw = String(value);
  const iso = raw.includes('T') ? raw : `${raw.replace(' ', 'T')}Z`;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';

  const diff = Date.now() - date.getTime();
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (diff < minute) return 'الآن';
  if (diff < hour) {
    const m = Math.floor(diff / minute);
    return m === 1 ? 'قبل دقيقة' : m === 2 ? 'قبل دقيقتين' : `قبل ${m} دقائق`;
  }
  if (diff < day) {
    const h = Math.floor(diff / hour);
    return h === 1 ? 'قبل ساعة' : h === 2 ? 'قبل ساعتين' : `قبل ${h} ساعات`;
  }
  const d = Math.floor(diff / day);
  return d === 1 ? 'قبل يوم' : d === 2 ? 'قبل يومين' : `قبل ${d} أيام`;
}

/** Student-facing links that have no equivalent route in the admin panel. */
function adminTarget(link: string): string {
  if (link === '/dashboard' || link.startsWith('/dashboard?') || link.startsWith('/dashboard#')) return '/';
  if (link.startsWith('/my-courses')) return '/students';
  return link;
}

export default function NotificationBell() {
  const router = useRouter();
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const latestIdRef = useRef<number | null>(null);
  const loadedOnceRef = useRef(false);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [panelPos, setPanelPos] = useState<PanelPosition | null>(null);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [toast, setToast] = useState<ToastState | null>(null);

  useEffect(() => {
    setMounted(true);
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);

  const showToast = useCallback((notification: AppNotification, count: number) => {
    setToast({ notification, count });
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToast(null), 6000);
  }, []);

  const load = useCallback(
    async (opts: { silent?: boolean; detectNew?: boolean } = {}) => {
      const silent = Boolean(opts.silent);
      const detectNew = Boolean(opts.detectNew);
      if (!silent) {
        setLoading(true);
        setError('');
      }
      try {
        const [list, count] = await Promise.all([
          api('/api/notifications?limit=30'),
          api('/api/notifications/unread-count'),
        ]);
        const items: AppNotification[] = Array.isArray(list) ? list : [];
        setNotifications(items);
        setUnread(Number(count?.count) || 0);
        setError('');
        loadedOnceRef.current = true;

        const maxId = items.reduce((max, item) => Math.max(max, Number(item.id) || 0), 0);
        if (detectNew && latestIdRef.current !== null && maxId > latestIdRef.current) {
          const fresh = items.filter((item) => Number(item.id) > (latestIdRef.current as number));
          if (fresh.length > 0) showToast(fresh[0], fresh.length);
        }
        if (latestIdRef.current === null || maxId > latestIdRef.current) {
          latestIdRef.current = maxId;
        }
      } catch {
        if (!silent) setError('تعذّر تحميل الإشعارات. تحقق من اتصالك وحاول مرة أخرى.');
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [showToast],
  );

  // Initial load + lightweight polling so the badge and toast stay current.
  useEffect(() => {
    void load();
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        void load({ silent: true, detectNew: true });
      }
    }, 30000);
    const onFocus = () => void load({ silent: true, detectNew: true });
    window.addEventListener('focus', onFocus);
    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', onFocus);
    };
  }, [load]);

  const positionPanel = useCallback(() => {
    const button = buttonRef.current;
    if (!button || typeof window === 'undefined') return;
    const rect = button.getBoundingClientRect();
    const width = Math.min(380, window.innerWidth - 24);
    const right = Math.max(
      12,
      Math.min(window.innerWidth - rect.right, window.innerWidth - width - 12),
    );
    setPanelPos({ top: rect.bottom + 10, right, width });
  }, []);

  const openPanel = useCallback(() => {
    positionPanel();
    setOpen(true);
    setToast(null);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    void load({ silent: loadedOnceRef.current });
  }, [load, positionPanel]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (panelRef.current?.contains(target)) return;
      if (buttonRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    const onResize = () => positionPanel();
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    window.addEventListener('resize', onResize);
    positionPanel();
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('resize', onResize);
    };
  }, [open, positionPanel]);

  const openNotification = async (notification: AppNotification) => {
    const wasUnread = !Number(notification.is_read);
    setOpen(false);
    setActionError('');

    if (wasUnread) {
      setNotifications((prev) =>
        prev.map((item) => (item.id === notification.id ? { ...item, is_read: 1 } : item)),
      );
      setUnread((prev) => Math.max(0, prev - 1));
      api(`/api/notifications/${notification.id}/read`, { method: 'PATCH' }).catch(() => {
        /* The next poll reconciles the read state. */
      });
    }

    if (notification.link) {
      router.push(adminTarget(notification.link));
    }
  };

  const markAllAsRead = async () => {
    if (unread === 0) return;
    const previous = notifications;
    const previousUnread = unread;
    setActionError('');
    setNotifications((prev) => prev.map((item) => ({ ...item, is_read: 1 })));
    setUnread(0);
    try {
      await api('/api/notifications/read-all', { method: 'PATCH' });
    } catch {
      setNotifications(previous);
      setUnread(previousUnread);
      setActionError('تعذّر تعليم الإشعارات كمقروءة. حاول مرة أخرى.');
    }
  };

  const badgeText = unread > 99 ? '99+' : String(unread);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        data-testid="notification-bell"
        aria-label={unread > 0 ? `الإشعارات (${unread} غير مقروء)` : 'الإشعارات'}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => (open ? setOpen(false) : openPanel())}
        className="relative w-10 h-10 rounded-xl flex items-center justify-center text-lg shrink-0 transition-colors hover:bg-[var(--bg)]"
        style={{ color: 'var(--text)', backgroundColor: open ? 'var(--bg)' : 'transparent' }}
      >
        <span aria-hidden="true">🔔</span>
        {unread > 0 && (
          <span
            data-testid="notification-unread-badge"
            className="absolute -top-1 -left-1 min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold flex items-center justify-center"
            style={{ backgroundColor: '#ef4444', color: '#ffffff' }}
          >
            {badgeText}
          </span>
        )}
      </button>

      {mounted && open && panelPos &&
        createPortal(
          <div
            ref={panelRef}
            role="dialog"
            aria-label="الإشعارات"
            data-testid="notification-panel"
            className="fixed z-[80] rounded-2xl border shadow-2xl overflow-hidden flex flex-col"
            style={{
              top: panelPos.top,
              right: panelPos.right,
              width: panelPos.width,
              maxHeight: 'min(78vh, 600px)',
              backgroundColor: 'var(--card)',
              borderColor: 'var(--border)',
              animation: 'notificationPanelIn 160ms ease-out',
            }}
          >
            <div
              className="px-4 py-3 border-b flex items-center justify-between gap-2 shrink-0"
              style={{ borderColor: 'var(--border)' }}
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-lg" aria-hidden="true">🔔</span>
                <h2 className="font-bold text-sm truncate" style={{ color: 'var(--text)' }}>
                  الإشعارات
                </h2>
                {unread > 0 && (
                  <span
                    className="text-[11px] px-2 py-0.5 rounded-full font-medium shrink-0"
                    style={{ backgroundColor: 'var(--primary)', color: '#ffffff' }}
                  >
                    {badgeText} جديد
                  </span>
                )}
              </div>
              {unread > 0 && (
                <button
                  type="button"
                  data-testid="notification-mark-all"
                  onClick={markAllAsRead}
                  className="text-xs font-medium px-2 py-1 rounded-lg whitespace-nowrap hover:bg-[var(--bg)]"
                  style={{ color: 'var(--primary)' }}
                >
                  تعليم الكل كمقروء
                </button>
              )}
            </div>

            {actionError && (
              <div
                className="px-4 py-2 text-[11px] border-b"
                style={{ color: '#dc2626', borderColor: 'var(--border)', backgroundColor: '#fef2f2' }}
              >
                {actionError}
              </div>
            )}

            <div className="flex-1 overflow-y-auto overscroll-contain" style={{ minHeight: 0 }}>
              {loading && notifications.length === 0 ? (
                <div className="p-4 space-y-3" aria-label="جارٍ تحميل الإشعارات">
                  {[0, 1, 2].map((row) => (
                    <div key={row} className="flex items-start gap-3 animate-pulse">
                      <span className="w-7 h-7 rounded-full shrink-0" style={{ backgroundColor: 'var(--bg)' }} />
                      <span className="flex-1 space-y-2">
                        <span className="block h-3 rounded" style={{ backgroundColor: 'var(--bg)', width: '70%' }} />
                        <span className="block h-2.5 rounded" style={{ backgroundColor: 'var(--bg)', width: '90%' }} />
                      </span>
                    </div>
                  ))}
                </div>
              ) : error && notifications.length === 0 ? (
                <div className="p-6 text-center space-y-3">
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{error}</p>
                  <button
                    type="button"
                    onClick={() => void load()}
                    className="px-4 py-2 rounded-xl text-xs font-medium text-white"
                    style={{ backgroundColor: 'var(--primary)' }}
                  >
                    إعادة المحاولة
                  </button>
                </div>
              ) : notifications.length === 0 ? (
                <div className="p-8 text-center space-y-2">
                  <div className="text-3xl" aria-hidden="true">🔕</div>
                  <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>لا توجد إشعارات حالياً</p>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    ستظهر هنا إشعاراتك الجديدة خلال آخر 30 يوماً.
                  </p>
                </div>
              ) : (
                notifications.map((notification) => {
                  const isRead = Boolean(Number(notification.is_read));
                  return (
                    <button
                      key={notification.id}
                      type="button"
                      data-testid="notification-item"
                      onClick={() => void openNotification(notification)}
                      className="w-full text-right px-4 py-3 flex items-start gap-3 transition-colors border-b last:border-b-0 hover:bg-[var(--bg)]"
                      style={{
                        borderColor: 'var(--border)',
                        backgroundColor: isRead
                          ? 'transparent'
                          : 'color-mix(in srgb, var(--primary) 8%, transparent)',
                      }}
                    >
                      <span className="text-lg mt-0.5 shrink-0" aria-hidden="true">
                        {TYPE_ICON[notification.type || 'info'] || TYPE_ICON.info}
                      </span>
                      <span className="flex-1 min-w-0">
                        <span className="flex items-start gap-2">
                          <span
                            className={`text-sm block truncate ${isRead ? 'font-medium' : 'font-bold'}`}
                            style={{ color: 'var(--text)' }}
                          >
                            {notification.title}
                          </span>
                          {!isRead && (
                            <span
                              className="w-2 h-2 rounded-full shrink-0 mt-1.5"
                              style={{ backgroundColor: 'var(--primary)' }}
                              aria-label="غير مقروء"
                            />
                          )}
                        </span>
                        {notification.message && (
                          <span
                            className="text-xs mt-0.5 block truncate"
                            style={{ color: 'var(--text-muted)' }}
                          >
                            {notification.message}
                          </span>
                        )}
                        <span
                          className="text-[11px] mt-1 block"
                          style={{ color: 'var(--text-muted)' }}
                        >
                          {formatRelativeTime(notification.created_at)}
                        </span>
                      </span>
                    </button>
                  );
                })
              )}
            </div>

            <div
              className="px-4 py-2 border-t text-[11px] text-center shrink-0"
              style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}
            >
              تُحفظ الإشعارات لآخر 30 يوماً فقط
            </div>
          </div>,
          document.body,
        )}

      {mounted && toast &&
        createPortal(
          <button
            type="button"
            data-testid="notification-toast"
            role="status"
            aria-live="polite"
            onClick={openPanel}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[90] w-[calc(100%-2rem)] max-w-sm text-right rounded-2xl border shadow-2xl px-4 py-3 flex items-start gap-3"
            style={{
              backgroundColor: 'var(--card)',
              borderColor: 'var(--border)',
              animation: 'notificationToastIn 200ms ease-out',
            }}
          >
            <span className="text-xl shrink-0" aria-hidden="true">
              {TYPE_ICON[toast.notification.type || 'info'] || '🔔'}
            </span>
            <span className="flex-1 min-w-0">
              <span className="block text-sm font-bold truncate" style={{ color: 'var(--text)' }}>
                {toast.notification.title}
              </span>
              {toast.notification.message && (
                <span
                  className="block text-xs mt-0.5 truncate"
                  style={{ color: 'var(--text-muted)' }}
                >
                  {toast.notification.message}
                </span>
              )}
              <span className="block text-[11px] mt-1 font-medium" style={{ color: 'var(--primary)' }}>
                {toast.count > 1 ? `${toast.count} إشعارات جديدة` : 'إشعار جديد'} · اضغط للعرض
              </span>
            </span>
          </button>,
          document.body,
        )}

      <style>{`
        @keyframes notificationPanelIn {
          from { opacity: 0; transform: translateY(-6px) scale(0.98); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes notificationToastIn {
          from { opacity: 0; transform: translate(-50%, 12px); }
          to { opacity: 1; transform: translate(-50%, 0); }
        }
      `}</style>
    </>
  );
}
