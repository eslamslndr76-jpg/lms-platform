'use client';

import { useEffect, useRef, useState, useCallback, ReactNode } from 'react';

interface M3BottomSheetProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  title?: string;
  maxHeightVh?: number;
  zIndex?: number;
}

/* ── spring physics (MD3 standard fast spatial approximation) ── */
const SPRING_DAMPING = 28;
const SPRING_DAMPING_DISMISS = 35;
const SPRING_STIFFNESS = 300;
const SPRING_THRESHOLD = 0.5;

/* ── gesture tuning ── */
const DISMISS_VELOCITY = 600;
const DISMISS_DISTANCE_RATIO = 0.35;
const VELOCITY_SMOOTHING = 0.3;

/* ── motion tokens (MD3) ── */
const OPEN_DURATION = 300;
const CLOSE_DURATION = 250;
const OPEN_EASING = `cubic-bezier(0.05, 0.7, 0.1, 1)`;
const CLOSE_EASING = `cubic-bezier(0.3, 0, 0.8, 0.15)`;

export default function M3BottomSheet({
  open,
  onClose,
  children,
  title,
  maxHeightVh = 90,
  zIndex = 60,
}: M3BottomSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);

  const [visible, setVisible] = useState(false);

  /* ── mutable gesture state (never triggers re-render) ── */
  const gesture = useRef({
    active: false,
    startY: 0,
    startPos: 0,
    lastY: 0,
    lastTime: 0,
    smoothedVelocity: 0,
  });

  const animFrame = useRef(0);
  const openRaf = useRef(0);
  const scrollLocked = useRef(false);
  const historyPushed = useRef(false);
  const isDragging = useRef(false);
  const resizeObserver = useRef<ResizeObserver | null>(null);

  /* ── helpers ── */

  const vh = useCallback((pct: number) => (pct / 100) * window.innerHeight, []);

  const getContentFitHeight = useCallback(() => {
    const sheetEl = sheetRef.current;
    const contentEl = contentRef.current;
    if (!sheetEl || !contentEl) return vh(maxHeightVh);
    const contentH = contentEl.scrollHeight;
    const chromeH = sheetEl.offsetHeight - contentEl.offsetHeight;
    const maxPx = vh(maxHeightVh);
    if (contentH > 0) return Math.min(contentH + chromeH, maxPx);
    return maxPx;
  }, [vh, maxHeightVh]);

  const getSheetTranslateY = useCallback(() => {
    const el = sheetRef.current;
    if (!el) return 0;
    const cs = getComputedStyle(el);
    if (cs.transform === 'none') return 0;
    return new DOMMatrixReadOnly(cs.transform).m42;
  }, []);

  /* ── backdrop ── */

  const setBackdropOpacity = useCallback(
    (opacity: number) => {
      if (!backdropRef.current) return;
      backdropRef.current.style.opacity = String(opacity);
    },
    [],
  );

  /* ── set sheet transform directly (no React state) ── */

  const setSheetTransform = useCallback(
    (px: number, transition?: string) => {
      const el = sheetRef.current;
      if (!el) return;
      if (transition) {
        el.style.transition = transition;
      } else {
        el.style.transition = 'none';
      }
      el.style.transform = `translateY(${px}px)`;
    },
    [],
  );

  /* ── compute backdrop opacity from sheet position ── */

  const updateBackdropFromPosition = useCallback(
    (pos: number) => {
      const ratio = Math.max(0, Math.min(1, 1 - pos / window.innerHeight));
      setBackdropOpacity(ratio * 0.32);
    },
    [setBackdropOpacity],
  );

  /* ── spring settle animation ── */

  const springSettle = useCallback(
    (from: number, to: number, initialVelocity: number, isDismiss = false): Promise<void> => {
      return new Promise((resolve) => {
        let pos = from;
        let vel = initialVelocity;
        let lastTime = performance.now();
        const damping = isDismiss ? SPRING_DAMPING_DISMISS : SPRING_DAMPING;

        const step = (now: number) => {
          const elapsed = Math.min((now - lastTime) / 1000, 0.064);
          lastTime = now;

          const displacement = pos - to;
          const springForce = -SPRING_STIFFNESS * displacement;
          const dampingForce = -damping * vel;
          const acceleration = springForce + dampingForce;

          vel += acceleration * elapsed;
          pos += vel * elapsed;

          setSheetTransform(pos);

          /* backdrop: map sheet position to opacity [0, 0.32] */
          const ratio = Math.max(0, Math.min(1, 1 - pos / window.innerHeight));
          setBackdropOpacity(ratio * 0.32);

          if (Math.abs(pos - to) < SPRING_THRESHOLD && Math.abs(vel) < SPRING_THRESHOLD) {
            setSheetTransform(to);
            resolve();
            return;
          }

          animFrame.current = requestAnimationFrame(step);
        };

        animFrame.current = requestAnimationFrame(step);
      });
    },
    [setSheetTransform, setBackdropOpacity],
  );

  /* ── open ── */

  const handleOpen = useCallback(async () => {
    /* Set visible FIRST so the component renders and refs exist */
    setVisible(true);

    /* Wait for React to commit the DOM (double rAF) */
    await new Promise((r) => {
      openRaf.current = requestAnimationFrame(() => {
        openRaf.current = requestAnimationFrame(r);
      });
    });

    const sheetEl = sheetRef.current;
    const contentEl = contentRef.current;
    if (!sheetEl || !contentEl) return;

    /* measure content — adaptive height: wrap to content, cap at max */
    const contentH = contentEl.scrollHeight;
    const chromeH = sheetEl.offsetHeight - contentEl.offsetHeight;
    const maxPx = vh(maxHeightVh);
    const targetPx = Math.min(contentH + chromeH, maxPx);

    /* Position sheet off-screen, set dimensions, then animate in */
    sheetEl.style.height = `${targetPx}px`;
    sheetEl.style.maxHeight = `${targetPx}px`;
    setSheetTransform(targetPx + window.innerHeight);
    document.body.style.overflow = 'hidden';

    /* push history entry for back-button support */
    if (!historyPushed.current) {
      window.history.pushState({ __sheetOpen: true }, '');
      historyPushed.current = true;
    }

    /* Wait one frame for the off-screen position to paint */
    await new Promise((r) => requestAnimationFrame(r));

    /* Slide up with MD3 emphasized decelerate */
    setSheetTransform(0, `${OPEN_DURATION}ms ${OPEN_EASING}`);

    /* Animate backdrop via CSS transition */
    if (backdropRef.current) {
      backdropRef.current.style.transition = `opacity ${OPEN_DURATION}ms ${OPEN_EASING}`;
    }
    setBackdropOpacity(0.32);

    /* ── Adaptive height: ResizeObserver on content ── */
    if (resizeObserver.current) resizeObserver.current.disconnect();
    resizeObserver.current = new ResizeObserver(() => {
      if (isDragging.current) return;
      const el = sheetRef.current;
      const contentElInner = contentRef.current;
      if (!el || !contentElInner) return;
      const newContentH = contentElInner.scrollHeight;
      const chrome = el.offsetHeight - contentElInner.offsetHeight;
      const max = vh(maxHeightVh);
      const newHeight = Math.min(newContentH + chrome, max);
      el.style.height = `${newHeight}px`;
      el.style.maxHeight = `${newHeight}px`;
    });
    resizeObserver.current.observe(contentEl);
  }, [vh, maxHeightVh, setSheetTransform, setBackdropOpacity]);

  /* ── close ── */

  const handleClose = useCallback(async () => {
    const el = sheetRef.current;
    if (!el) return;

    /* disconnect ResizeObserver */
    if (resizeObserver.current) {
      resizeObserver.current.disconnect();
      resizeObserver.current = null;
    }

    document.body.style.overflow = '';

    /* Fade backdrop out via CSS transition */
    if (backdropRef.current) {
      backdropRef.current.style.transition = `opacity ${CLOSE_DURATION}ms ${CLOSE_EASING}`;
    }
    setBackdropOpacity(0);

    /* Slide down off-screen */
    setSheetTransform(window.innerHeight + 10, `${CLOSE_DURATION}ms ${CLOSE_EASING}`);

    await new Promise((r) => setTimeout(r, CLOSE_DURATION + 30));

    setVisible(false);
    historyPushed.current = false;
    cancelAnimationFrame(animFrame.current);
  }, [setSheetTransform, setBackdropOpacity]);

  /* ── open/close lifecycle ── */

  useEffect(() => {
    cancelAnimationFrame(animFrame.current);
    cancelAnimationFrame(openRaf.current);
    if (open) handleOpen();
    else if (visible) handleClose();
    return () => {
      document.body.style.overflow = '';
      cancelAnimationFrame(animFrame.current);
      cancelAnimationFrame(openRaf.current);
      if (resizeObserver.current) {
        resizeObserver.current.disconnect();
        resizeObserver.current = null;
      }
    };
  }, [open]); // eslint-disable-line

  /* ── browser back button: close sheet instead of navigating ── */

  useEffect(() => {
    if (!open) return;
    const handlePopState = () => {
      historyPushed.current = false;
      onClose();
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [open, onClose]);

  /* ── keyboard: Escape to close ── */

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  /* ── scroll tracking on content ── */

  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    const check = () => {
      scrollLocked.current = el.scrollTop > 1;
    };
    el.addEventListener('scroll', check, { passive: true });
    return () => el.removeEventListener('scroll', check);
  }, [visible]);

  /* ── TOUCH GESTURE ── */

  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      /* If content can scroll up, don't capture — let browser scroll */
      const contentEl = contentRef.current;
      if (contentEl && contentEl.scrollTop > 1) {
        gesture.current.active = false;
        return;
      }

      /* No preventDefault needed — touch-action: none on sheet div handles it */

      const touch = e.touches[0];
      const g = gesture.current;
      g.active = true;
      g.startY = touch.clientY;
      g.lastY = touch.clientY;
      g.lastTime = performance.now();
      g.smoothedVelocity = 0;
      isDragging.current = true;

      const sheetEl = sheetRef.current;
      if (sheetEl) {
        g.startPos = getSheetTranslateY();
      }

      cancelAnimationFrame(animFrame.current);
      if (sheetRef.current) sheetRef.current.style.transition = 'none';
    },
    [getSheetTranslateY],
  );

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      const g = gesture.current;
      if (!g.active) return;

      /* No preventDefault needed — touch-action: none handles it */

      const touch = e.touches[0];
      const now = performance.now();
      const dt = now - g.lastTime;

      if (dt > 0) {
        const rawVelocity = ((touch.clientY - g.lastY) / dt) * 1000;
        /* Exponential moving average for smooth velocity */
        g.smoothedVelocity =
          VELOCITY_SMOOTHING * rawVelocity + (1 - VELOCITY_SMOOTHING) * g.smoothedVelocity;
      }
      g.lastY = touch.clientY;
      g.lastTime = now;

      const deltaY = touch.clientY - g.startY;
      let newPos = g.startPos + deltaY;

      /* Hard clamp — no overscroll, no blank areas */
      newPos = Math.min(newPos, 0);
      newPos = Math.max(newPos, -window.innerHeight);

      setSheetTransform(newPos);
      updateBackdropFromPosition(newPos);
    },
    [setSheetTransform, updateBackdropFromPosition],
  );

  const handleTouchEnd = useCallback(async () => {
    const g = gesture.current;
    if (!g.active) return;
    g.active = false;
    isDragging.current = false;

    const velocity = g.smoothedVelocity;

    /* Use actual DOM position for accuracy */
    const currentPos = getSheetTranslateY();
    const sheetH = getContentFitHeight();

    /* dismiss? */
    const dismissThreshold = sheetH * DISMISS_DISTANCE_RATIO;
    if (currentPos > dismissThreshold || velocity > DISMISS_VELOCITY) {
      /* animate out then close */
      setBackdropOpacity(0);
      await springSettle(currentPos, window.innerHeight + 10, velocity, true);
      historyPushed.current = false;
      onClose();
      return;
    }

    /* spring back to open position */
    await springSettle(currentPos, 0, velocity);
  }, [
    onClose,
    springSettle,
    setBackdropOpacity,
    getSheetTranslateY,
    getContentFitHeight,
  ]);

  /* ── keyboard: drag handle cycles snaps ── */

  const handleHandleKeyDown = useCallback(
    async (e: React.KeyboardEvent) => {
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        const currentPos = getSheetTranslateY();
        setBackdropOpacity(0);
        await springSettle(currentPos, window.innerHeight + 10, 0, true);
        historyPushed.current = false;
        onClose();
      }
    },
    [onClose, springSettle, setBackdropOpacity, getSheetTranslateY],
  );

  const handleBackdropClick = useCallback(() => {
    onClose();
  }, [onClose]);

  /* ── drag handle state ── */

  const isExpanded = true;

  /* ── render ── */

  if (!visible) return null;

  return (
    <div
      className="fixed inset-0"
      style={{ zIndex, pointerEvents: open ? 'auto' : 'none' }}
    >
      {/* Backdrop */}
      <div
        ref={backdropRef}
        className="absolute inset-0"
        style={{
          backgroundColor: 'rgba(0,0,0,1)',
          opacity: 0,
          pointerEvents: open ? 'auto' : 'none',
        }}
        onClick={handleBackdropClick}
      />

      {/* Sheet */}
      <div
        ref={sheetRef}
        className="absolute bottom-0 right-0 left-0 flex flex-col"
        style={{
          backgroundColor: 'var(--md-sys-color-surface-container-low)',
          borderTopLeftRadius: 'var(--md-sys-shape-corner-extra-large)',
          borderTopRightRadius: 'var(--md-sys-shape-corner-extra-large)',
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
          touchAction: 'none',
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Drag handle — 48px touch target (MD3 a11y) with animated indicator */}
        <div
          className="flex flex-col items-center shrink-0"
          style={{
            height: '48px',
            cursor: 'grab',
            touchAction: 'none',
            paddingTop: '10px',
          }}
          tabIndex={0}
          role="button"
          aria-label="طي أو توسيع"
          onKeyDown={handleHandleKeyDown}
        >
          <span
            className="material-symbols-outlined text-[18px] leading-none"
            style={{
              color: 'var(--md-sys-color-outline-variant)',
              transform: isExpanded ? 'rotate(0deg)' : 'rotate(180deg)',
              transition: 'transform 200ms ease',
              marginBottom: '4px',
            }}
          >
            expand_less
          </span>
          <div
            className="w-10 h-1 rounded-full"
            style={{
              backgroundColor: 'var(--md-sys-color-outline-variant)',
            }}
          />
        </div>

        {/* Title bar — only if title is provided */}
        {title && (
          <div className="px-5 pb-3 flex items-center shrink-0">
            <h2
              className="text-base font-bold"
              style={{ color: 'var(--md-sys-color-on-surface)' }}
            >
              {title}
            </h2>
          </div>
        )}

        {/* Content — scrollable */}
        <div
          ref={contentRef}
          className="flex-1 overflow-y-auto overscroll-contain"
          style={{ minHeight: 0 }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
