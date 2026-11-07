'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { api } from '../../lib/api';
import { useBranding } from '../../components/BrandingProvider';
import { downloadCertPdf } from '../../lib/certPdfUtils';

function CertModal({ certHtml, onClose, primaryColor }: { certHtml: string; onClose: () => void; primaryColor: string }) {
  const [downloading, setDownloading] = useState(false);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const serialMatch = certHtml.match(/Certificate ID<\/div>\s*<div[^>]*>([^<]+)/);
      const serial = serialMatch ? serialMatch[1].trim() : 'certificate';
      await downloadCertPdf(certHtml, `certificate-${serial}.pdf`);
    } catch {
      alert('حدث خطأ أثناء تحميل الشهادة');
    }
    setDownloading(false);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.85)' }} onClick={onClose}>
      <button onClick={onClose} className="absolute top-4 left-4 z-50 w-10 h-10 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white transition-colors">
        <span className="material-symbols-outlined">close</span>
      </button>
      <button onClick={(e) => { e.stopPropagation(); handleDownload(); }} disabled={downloading}
        className="absolute top-4 right-4 z-50 px-5 py-2.5 rounded-full text-white font-medium text-sm disabled:opacity-50 flex items-center gap-2"
        style={{ backgroundColor: primaryColor }}>
        {downloading ? (
          <><div className="w-4 h-1 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--md-sys-color-surface-container-high)' }}><div className="h-full rounded-full animate-pulse" style={{ width: '60%', backgroundColor: 'white' }} /></div> جاري التحميل...</>
        ) : (
          <><span className="material-symbols-outlined text-[18px]">download</span> تحميل كـ PDF</>
        )}
      </button>
      <div className="w-full h-full flex items-center justify-center p-4" onClick={(e) => e.stopPropagation()}>
        <iframe srcDoc={certHtml} title="Certificate"
          style={{ width: '100%', maxWidth: '1123px', height: 'auto', aspectRatio: '297 / 210', border: 'none', borderRadius: '12px', boxShadow: '0 25px 60px rgba(0,0,0,0.5)' }}
          sandbox="allow-same-origin" />
      </div>
    </div>
  );
}

function VerifyPageContent() {
  const searchParams = useSearchParams();
  const { primaryColor } = useBranding();
  const [serial, setSerial] = useState('');
  const [result, setResult] = useState<any>(null);
  const [isRevoked, setIsRevoked] = useState(false);
  const [revokeReason, setRevokeReason] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [certHtml, setCertHtml] = useState('');
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState('');
  const [showModal, setShowModal] = useState(false);

  const verify = async (serialToVerify?: string) => {
    const s = serialToVerify || serial;
    if (!s.trim()) return;
    setLoading(true);
    setError('');
    setResult(null);
    setIsRevoked(false);
    setCertHtml('');
    setPreviewError('');
    try {
      const data = await api(`/api/certificates/verify/${s.trim()}`);
      if (data.revoked) {
        setIsRevoked(true);
        setRevokeReason(data.revoke_reason || null);
        setResult(data.certificate);
      } else {
        setResult(data.certificate);
        fetchCertHtml(s.trim());
      }
    } catch (e: any) {
      setError(e?.message || 'شهادة غير صالحة أو لم يتم العثور عليها');
    }
    setLoading(false);
  };

  const fetchCertHtml = async (serialId: string) => {
    setPreviewLoading(true);
    setPreviewError('');
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const res = await fetch(`${apiUrl}/api/certificates/verify/${serialId}/html`);
      if (!res.ok) throw new Error('Failed to load certificate');
      setCertHtml(await res.text());
    } catch {
      setPreviewError('لا تمكن تحميل معاينة الشهادة');
    }
    setPreviewLoading(false);
  };

  useEffect(() => {
    const s = searchParams.get('serial');
    if (s) { setSerial(s); verify(s); }
  }, [searchParams]);

  return (
    <div className="px-4 py-8 max-w-4xl mx-auto">
      <div className="text-center mb-8">
        <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: 'var(--md-sys-color-primary-container)' }}>
          <span className="material-symbols-outlined text-[28px]" style={{ color: 'var(--md-sys-color-on-primary-container)' }}>verified</span>
        </div>
        <h1 className="text-2xl font-bold mb-2" style={{ color: 'var(--md-sys-color-on-surface)' }}>التحقق من الشهادة</h1>
        <p className="text-sm" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>أدخل الرقم التسلسلي للشهادة للتحقق من صحتها</p>
      </div>

      <div className="flex gap-2 max-w-md mx-auto">
        <input value={serial} onChange={e => setSerial(e.target.value)}
          placeholder="الرقم التسلسلي (مثل CERT-2026-A3F2B8C1)"
          className="flex-1 px-4 py-3 rounded-md3-sm border text-sm font-mono"
          style={{ backgroundColor: 'var(--md-sys-color-surface-container-highest)', borderColor: 'var(--md-sys-color-outline)', color: 'var(--md-sys-color-on-surface)' }}
          onKeyDown={e => e.key === 'Enter' && verify()} />
        <button onClick={() => verify()} disabled={loading || !serial.trim()}
          className="px-6 py-3 rounded-full text-white font-medium text-sm disabled:opacity-50"
          style={{ backgroundColor: 'var(--md-sys-color-primary)', color: 'var(--md-sys-color-on-primary)' }}>
          {loading ? 'جاري...' : 'تحقق'}
        </button>
      </div>

      {error && (
        <div className="mt-6 p-4 rounded-md3-sm text-sm max-w-md mx-auto flex items-center gap-2"
          style={{ backgroundColor: 'var(--md-sys-color-error-container)', color: 'var(--md-sys-color-on-error-container)' }}>
          <span className="material-symbols-outlined text-[18px]">error</span>
          {error}
        </div>
      )}

      {result && isRevoked && (
        <div className="mt-6 rounded-md3-sm p-6 text-center max-w-md mx-auto" style={{ backgroundColor: 'var(--md-sys-color-surface-container)', border: '2px solid var(--md-sys-color-error)' }}>
          <span className="material-symbols-outlined text-[48px] block mb-3" style={{ color: 'var(--md-sys-color-error)' }}>block</span>
          <h2 className="text-xl font-bold mb-1" style={{ color: 'var(--md-sys-color-error)' }}>شهادة مسحوبة</h2>
          <p className="text-sm mb-4" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>هذه الشهادة تم سحبها من الإدارة ولم تعد صالحة</p>
          <div className="space-y-3 text-sm">
            <div className="p-3 rounded-md3-sm" style={{ backgroundColor: 'var(--md-sys-color-surface-container-low)' }}>
              <p className="text-xs mb-1" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>اسم الطالب</p>
              <p className="font-bold" style={{ color: 'var(--md-sys-color-on-surface)' }}>{result.student_name}</p>
            </div>
            <div className="p-3 rounded-md3-sm" style={{ backgroundColor: 'var(--md-sys-color-surface-container-low)' }}>
              <p className="text-xs mb-1" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>اسم الكورس</p>
              <p className="font-bold" style={{ color: 'var(--md-sys-color-on-surface)' }}>{result.title_ar}</p>
            </div>
            <div className="p-3 rounded-md3-sm" style={{ backgroundColor: 'var(--md-sys-color-error-container)' }}>
              <p className="text-xs mb-1" style={{ color: 'var(--md-sys-color-on-error-container)' }}>حالة الشهادة</p>
              <p className="font-bold" style={{ color: 'var(--md-sys-color-error)' }}>تم السحب في {new Date(result.revoked_at).toLocaleDateString('ar-EG')}</p>
            </div>
            {revokeReason && (
              <div className="p-3 rounded-md3-sm" style={{ backgroundColor: 'var(--md-sys-color-error-container)' }}>
                <p className="text-xs mb-1" style={{ color: 'var(--md-sys-color-on-error-container)' }}>ملاحظات الإدارة</p>
                <p className="font-medium text-sm" style={{ color: 'var(--md-sys-color-error)' }}>{revokeReason}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {result && !isRevoked && (
        <div className="mt-6 space-y-4">
          <div className="rounded-md3-sm p-5 text-center" style={{ backgroundColor: 'var(--md-sys-color-surface-container)', border: '2px solid var(--md-sys-color-primary)' }}>
            <span className="material-symbols-outlined text-[48px] block mb-3" style={{ color: 'var(--md-sys-color-primary)' }}>verified</span>
            <h2 className="text-xl font-bold mb-1" style={{ color: 'var(--md-sys-color-primary)' }}>شهادة صالحة</h2>
            <p className="text-sm mb-4" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>تم التحقق من صحة هذه الشهادة بنجاح</p>
            <div className="space-y-3 text-sm">
              <div className="p-3 rounded-md3-sm" style={{ backgroundColor: 'var(--md-sys-color-surface-container-low)' }}>
                <p className="text-xs mb-1" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>اسم الطالب</p>
                <p className="font-bold" style={{ color: 'var(--md-sys-color-on-surface)' }}>{result.student_name}</p>
              </div>
              <div className="p-3 rounded-md3-sm" style={{ backgroundColor: 'var(--md-sys-color-surface-container-low)' }}>
                <p className="text-xs mb-1" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>اسم الكورس</p>
                <p className="font-bold" style={{ color: 'var(--md-sys-color-on-surface)' }}>{result.title_ar}</p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="p-3 rounded-md3-sm" style={{ backgroundColor: 'var(--md-sys-color-surface-container-low)' }}>
                  <p className="text-xs mb-1" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>تاريخ الإصدار</p>
                  <p className="font-bold" style={{ color: 'var(--md-sys-color-on-surface)' }}>{new Date(result.issued_at).toLocaleDateString('ar-EG')}</p>
                </div>
                <div className="p-3 rounded-md3-sm" style={{ backgroundColor: 'var(--md-sys-color-surface-container-low)' }}>
                  <p className="text-xs mb-1" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>الرقم التسلسلي</p>
                  <p className="font-bold font-mono text-xs" style={{ color: 'var(--md-sys-color-on-surface)' }}>{result.serial_id}</p>
                </div>
              </div>
            </div>
          </div>

          {previewLoading && (
            <div className="rounded-md3-sm p-6 text-center" style={{ backgroundColor: 'var(--md-sys-color-surface-container)' }}>
              <div className="w-full h-1 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--md-sys-color-surface-container-high)' }}><div className="h-full rounded-full animate-pulse" style={{ width: '40%', backgroundColor: 'var(--md-sys-color-primary)' }} /></div>
              <p className="text-sm mt-3" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>جاري تحميل الشهادة...</p>
            </div>
          )}

          {previewError && (
            <div className="rounded-md3-sm p-4 text-center" style={{ backgroundColor: 'var(--md-sys-color-surface-container)' }}>
              <p className="text-sm" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>{previewError}</p>
            </div>
          )}

          {certHtml && !previewLoading && (
            <button onClick={() => setShowModal(true)}
              className="w-full h-12 rounded-full text-white font-medium text-sm flex items-center justify-center gap-2"
              style={{ backgroundColor: 'var(--md-sys-color-primary)', color: 'var(--md-sys-color-on-primary)' }}>
              <span className="material-symbols-outlined text-[18px]">school</span>
              عرض الشهادة
            </button>
          )}
        </div>
      )}

      {showModal && certHtml && (
        <CertModal certHtml={certHtml} onClose={() => setShowModal(false)} primaryColor={primaryColor} />
      )}
    </div>
  );
}

export default function VerifyPage() {
  return (
    <Suspense fallback={
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="w-48 h-1 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--md-sys-color-surface-container-high)' }}><div className="h-full rounded-full animate-pulse" style={{ width: '40%', backgroundColor: 'var(--md-sys-color-primary)' }} /></div>
      </div>
    }>
      <VerifyPageContent />
    </Suspense>
  );
}
