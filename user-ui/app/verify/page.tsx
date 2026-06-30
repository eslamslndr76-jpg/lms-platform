'use client';

import { useState } from 'react';
import { api } from '../../lib/api';
import { useBranding } from '../../components/BrandingProvider';

export default function VerifyPage() {
  const { primaryColor } = useBranding();
  const [serial, setSerial] = useState('');
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const verify = async () => {
    if (!serial.trim()) return;
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const data = await api(`/api/certificates/verify/${serial.trim()}`);
      setResult(data.certificate);
    } catch (e: any) {
      setError(e?.message || 'شهادة غير صالحة أو لم يتم العثور عليها');
    }
    setLoading(false);
  };

  return (
    <div className="px-4 py-8 max-w-md mx-auto">
      <h1 className="text-2xl font-bold text-center mb-2" style={{ color: 'var(--text)' }}>التحقق من الشهادة</h1>
      <p className="text-sm text-center mb-6" style={{ color: 'var(--text-muted)' }}>أدخل الرقم التسلسلي للشهادة للتحقق من صحتها</p>

      <div className="flex gap-2">
        <input
          value={serial}
          onChange={e => setSerial(e.target.value)}
          placeholder="الرقم التسلسلي"
          className="flex-1 px-4 py-3 rounded-xl border text-sm" style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }}
          onKeyDown={e => e.key === 'Enter' && verify()}
        />
        <button onClick={verify} disabled={loading || !serial.trim()}
          className="px-6 py-3 rounded-xl text-white font-medium text-sm disabled:opacity-50"
          style={{ backgroundColor: primaryColor }}>
          {loading ? 'جاري...' : 'تحقق'}
        </button>
      </div>

      {error && (
        <div className="mt-6 p-4 rounded-xl text-sm" style={{ backgroundColor: '#fef2f2', color: '#dc2626' }}>
          ⚠️ {error}
        </div>
      )}

      {result && (
        <div className="mt-6 rounded-2xl p-6 text-center shadow-lg border-2" style={{ borderColor: '#22c55e', backgroundColor: 'var(--card)' }}>
          <div className="text-5xl mb-4">✅</div>
          <h2 className="text-xl font-bold mb-1" style={{ color: primaryColor }}>شهادة صالحة</h2>
          <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>تم التحقق من صحة هذه الشهادة</p>
          <div className="space-y-2 text-sm" style={{ color: 'var(--text)' }}>
            <p><strong>اسم الطالب:</strong> {result.student_name}</p>
            <p><strong>البريد الإلكتروني:</strong> {result.student_email}</p>
            <p><strong>اسم الكورس:</strong> {result.title_ar}</p>
            <p><strong>تاريخ الإصدار:</strong> {new Date(result.issued_at).toLocaleDateString('ar-EG')}</p>
            <p className="text-xs font-mono mt-3" style={{ color: 'var(--text-muted)' }}>الرقم التسلسلي: {result.serial_id}</p>
          </div>
        </div>
      )}
    </div>
  );
}
