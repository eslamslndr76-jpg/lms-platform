'use client';

import { useEffect, useRef, useState, Suspense } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import { useBranding } from '../../../../components/BrandingProvider';
import { api } from '../../../../lib/api';

function AttendanceContent() {
  const { primaryColor } = useBranding();
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const lectureId = params?.lectureId as string | undefined;
  const initialCode = searchParams?.get('code') || '';

  const [method, setMethod] = useState<'qr' | 'manual'>(initialCode ? 'manual' : 'qr');
  const [manualCode, setManualCode] = useState(initialCode.toUpperCase());
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [scannerStarted, setScannerStarted] = useState(false);

  const qrVideoRef = useRef<HTMLDivElement>(null);
  const qrScannerRef = useRef<{ stop: () => Promise<void> } | null>(null);
  const attemptedRef = useRef<string | null>(null);
  const autoSubmittedRef = useRef(false);

  /* ── QR Scanner ── */
  const initScanner = async () => {
    if (scannerStarted || !qrVideoRef.current) return;
    try {
      const { Html5Qrcode } = await import('html5-qrcode');
      const scanner = new Html5Qrcode('qr-reader');
      qrScannerRef.current = scanner;

      await scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        async (decoded: string) => {
          if (attemptedRef.current === decoded) return;
          attemptedRef.current = decoded;

          let code = '';
          try {
            const p = JSON.parse(decoded);
            if (p.v === 1 && p.c) code = p.c;
            else code = decoded.trim().toUpperCase();
          } catch {
            if (decoded.includes('code=')) {
              try {
                const u = new URL(decoded);
                code = u.searchParams.get('code') || decoded.trim().toUpperCase();
              } catch {
                code = decoded.trim().toUpperCase();
              }
            } else {
              code = decoded.trim().toUpperCase();
            }
          }
          if (code) await submit(code, 'qr');
        },
        () => {},
      );
      setScannerStarted(true);
    } catch {
      setMethod('manual');
    }
  };

  const stopScanner = async () => {
    if (qrScannerRef.current) {
      try { await qrScannerRef.current.stop(); } catch { /* ignore */ }
      qrScannerRef.current = null;
      setScannerStarted(false);
    }
    if (qrVideoRef.current) qrVideoRef.current.innerHTML = '';
  };

  useEffect(() => {
    if (method === 'qr' && !initialCode) {
      const t = setTimeout(() => initScanner(), 300);
      return () => { clearTimeout(t); stopScanner(); };
    }
    stopScanner();
  }, [method, lectureId]);

  /* ── Auto-submit if code is passed via URL query ── */
  useEffect(() => {
    if (initialCode && lectureId && !autoSubmittedRef.current) {
      autoSubmittedRef.current = true;
      submit(initialCode.trim().toUpperCase(), 'qr');
    }
  }, [initialCode, lectureId]);

  /* ── Submit ── */
  const submit = async (code: string, markMethod: 'qr' | 'manual') => {
    if (!lectureId || status === 'loading') return;
    setStatus('loading');
    setMessage('جاري تسجيل الحضور...');

    try {
      const res = await api('/api/attendance/mark', {
        method: 'POST',
        body: JSON.stringify({ lectureId: Number(lectureId), code, method: markMethod }),
      });
      if (res.success) {
        setStatus('success');
        setMessage(res.alreadyMarked ? 'تم تسجيل الحضور مسبقاً' : 'تم تسجيل حضورك بنجاح');
        setTimeout(() => router.push('/my-courses'), 2500);
      } else {
        setStatus('error');
        setMessage(res.error || 'كود غير صحيح أو منتهي الصلاحية');
        attemptedRef.current = null;
      }
    } catch (err) {
      setStatus('error');
      setMessage(err instanceof Error ? err.message : 'حدث خطأ');
      attemptedRef.current = null;
    }
  };

  const handleManual = () => {
    if (manualCode.trim().length !== 6) {
      setStatus('error');
      setMessage('الكود يجب أن يكون 6 أحرف');
      return;
    }
    submit(manualCode.trim().toUpperCase(), 'manual');
  };

  /* ── No lectureId ── */
  if (!lectureId) {
    return (
      <div className="flex items-center justify-center min-h-screen" style={{ backgroundColor: 'var(--bg)' }}>
        <div className="text-center space-y-4 px-6">
          <div className="w-16 h-16 mx-auto rounded-2xl flex items-center justify-center" style={{ backgroundColor: '#ef444415' }}>
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="#ef4444" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
            </svg>
          </div>
          <p className="font-medium" style={{ color: 'var(--text)' }}>رابط غير صالح</p>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>تأكد من فتح الرابط من إشعار الحضور</p>
          <button onClick={() => router.push('/my-courses')} className="px-6 py-3 rounded-xl text-white font-medium" style={{ backgroundColor: primaryColor }}>
            العودة للكورسات
          </button>
        </div>
      </div>
    );
  }

  /* ── Success State ── */
  if (status === 'success') {
    return (
      <div className="flex items-center justify-center min-h-screen" style={{ backgroundColor: 'var(--bg)' }}>
        <div className="text-center space-y-4 px-6 animate-fade-in">
          <div className="w-20 h-20 mx-auto rounded-full flex items-center justify-center" style={{ backgroundColor: '#22c55e15' }}>
            <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="#22c55e" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
            </svg>
          </div>
          <p className="text-xl font-bold" style={{ color: '#22c55e' }}>{message}</p>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>جاري التحويل لصفحة الكورسات...</p>
        </div>
      </div>
    );
  }

  /* ── Main UI ── */
  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: 'var(--bg)' }}>

      {/* Header */}
      <header className="px-4 pt-4 pb-2 flex items-center justify-between">
        <button onClick={() => router.back()} className="p-2 rounded-xl" style={{ backgroundColor: 'var(--card)' }}>
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ color: 'var(--text)' }}>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
        </button>
        <h1 className="text-base font-bold" style={{ color: 'var(--text)' }}>تأكيد الحضور</h1>
        <div className="w-9" />
      </header>

      {/* Reminder Banner */}
      <div className="mx-4 mb-3 px-4 py-3 rounded-xl flex items-center gap-3" style={{ backgroundColor: '#f59e0b12', border: '1px solid #f59e0b30' }}>
        <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="#f59e0b" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
        </svg>
        <p className="text-xs font-medium" style={{ color: '#92400e' }}>
          يجب تسجيل حضورك الآن عبر مسح الـ QR code أو إدخال الكود يدوياً
        </p>
      </div>

      <main className="flex-1 px-4 pb-6 flex flex-col space-y-3 overflow-hidden">

        {/* ── QR Mode ── */}
        {method === 'qr' && (
          <>
            {/* Scanner */}
            <div className="rounded-2xl overflow-hidden flex-1 min-h-0" style={{ backgroundColor: '#000' }}>
              <div ref={qrVideoRef} id="qr-reader" className="w-full h-full min-h-[280px]" />
            </div>

            {/* Loading overlay */}
            {status === 'loading' && (
              <div className="rounded-xl p-4 flex items-center justify-center gap-2" style={{ backgroundColor: primaryColor + '15' }}>
                <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24" style={{ color: primaryColor }}>
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <span className="text-sm font-medium" style={{ color: primaryColor }}>جاري تسجيل الحضور...</span>
              </div>
            )}

            {/* Error */}
            {status === 'error' && (
              <div className="rounded-xl p-4 text-center" style={{ backgroundColor: '#ef444412', border: '1px solid #ef444430' }}>
                <p className="text-sm font-medium" style={{ color: '#ef4444' }}>{message}</p>
                <button onClick={() => { setStatus('idle'); attemptedRef.current = null; }} className="mt-2 text-xs underline" style={{ color: '#ef4444' }}>
                  إعادة المحاولة
                </button>
              </div>
            )}

            {/* Idle hint */}
            {status === 'idle' && !scannerStarted && (
              <div className="text-center py-3">
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                  جاري تجهيز الكاميرا...
                </p>
              </div>
            )}

            {status === 'idle' && scannerStarted && (
              <div className="text-center py-2">
                <p className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>
                  وجّه الكاميرا نحو QR code على شاشة المحاضر
                </p>
              </div>
            )}

            {/* Switch to manual */}
            <button onClick={() => { setMethod('manual'); setStatus('idle'); setMessage(''); }}
              className="w-full py-3 rounded-xl text-sm font-medium border"
              style={{ borderColor: 'var(--border)', color: 'var(--text)' }}>
              الكاميرا مش شغالة؟ أدخل الكود يدوياً
            </button>
          </>
        )}

        {/* ── Manual Mode ── */}
        {method === 'manual' && (
          <>
            <div className="rounded-2xl p-6 space-y-4" style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)' }}>
              <p className="text-sm text-center" style={{ color: 'var(--text-muted)' }}>
                أدخل الكود الظاهر على شاشة المحاضر
              </p>
              <input
                value={manualCode}
                onChange={e => {
                  setManualCode(e.target.value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 6));
                  if (status === 'error') setStatus('idle');
                }}
                onKeyDown={e => e.key === 'Enter' && handleManual()}
                placeholder="XXXXXX"
                maxLength={6}
                className="w-full text-center text-3xl font-mono font-bold px-4 py-4 rounded-xl border"
                style={{
                  backgroundColor: 'var(--bg)',
                  borderColor: status === 'error' ? '#ef4444' : 'var(--border)',
                  color: 'var(--text)',
                  letterSpacing: '0.35em',
                  direction: 'ltr',
                }}
                autoFocus
              />

              {status === 'error' && (
                <p className="text-xs text-center font-medium" style={{ color: '#ef4444' }}>{message}</p>
              )}

              <button onClick={handleManual} disabled={manualCode.length !== 6 || status === 'loading'}
                className="w-full py-3.5 rounded-xl font-bold text-white disabled:opacity-40 transition-transform active:scale-[0.98]"
                style={{ backgroundColor: primaryColor }}>
                {status === 'loading' ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    جاري التحقق...
                  </span>
                ) : 'تأكيد الحضور'}
              </button>
            </div>

            {/* Switch to QR */}
            <button onClick={() => { setMethod('qr'); setStatus('idle'); setMessage(''); setManualCode(''); }}
              className="w-full py-3 rounded-xl text-sm font-medium border"
              style={{ borderColor: 'var(--border)', color: 'var(--text)' }}>
              مسح QR بالكاميرا
            </button>
          </>
        )}
      </main>
    </div>
  );
}

export default function AttendancePage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><p>جاري التحميل...</p></div>}>
      <AttendanceContent />
    </Suspense>
  );
}
