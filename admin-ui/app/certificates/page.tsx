'use client';

import { useState, useEffect } from 'react';
import { api } from '../../lib/api';

export default function CertificatesPage() {
  const [tab, setTab] = useState<'issue' | 'all'>('issue');
  const [students, setStudents] = useState<any[]>([]);
  const [certs, setCerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [issuing, setIssuing] = useState(false);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [s, c] = await Promise.all([
        api('/api/admin/certificates/students'),
        api('/api/admin/certificates'),
      ]);
      setStudents(s);
      setCerts(c);
    } catch {
      setError('فشل تحميل البيانات');
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const issue = async (userId: number, courseId: number) => {
    setIssuing(true);
    try {
      await api('/api/admin/certificates', {
        method: 'POST',
        body: JSON.stringify({ user_id: userId, course_id: courseId }),
      });
      load();
    } catch {
      alert('فشل إصدار الشهادة');
    }
    setIssuing(false);
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin h-8 w-8 border-4 rounded-full" style={{ borderColor: 'var(--primary)', borderTopColor: 'transparent' }} /></div>;
  if (error) return <div className="flex flex-col items-center justify-center h-64 gap-4"><p style={{ color: '#dc2626' }}>{error}</p><button onClick={load} className="px-4 py-2 bg-blue-600 text-white rounded-xl text-sm">إعادة المحاولة</button></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <button onClick={() => setTab('issue')}
          className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${tab === 'issue' ? 'text-white' : ''}`}
          style={tab === 'issue' ? { backgroundColor: 'var(--primary)' } : { backgroundColor: 'var(--card)', color: 'var(--text)' }}>
          إصدار شهادات
        </button>
        <button onClick={() => setTab('all')}
          className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${tab === 'all' ? 'text-white' : ''}`}
          style={tab === 'all' ? { backgroundColor: 'var(--primary)' } : { backgroundColor: 'var(--card)', color: 'var(--text)' }}>
          جميع الشهادات
        </button>
      </div>

      {tab === 'issue' && (
        <div className="rounded-2xl p-4" style={{ backgroundColor: 'var(--card)' }}>
          <h2 className="text-lg font-bold mb-4" style={{ color: 'var(--text)' }}>الطلاب المستحقون للشهادات</h2>
          {students.length === 0 ? (
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>لا يوجد طلاب مستحقون للشهادات</p>
          ) : (
            <div className="space-y-2">
              {students.map((s: any) => (
                <div key={`${s.id}-${s.course_id}`} className="flex items-center justify-between p-3 rounded-xl" style={{ backgroundColor: 'var(--bg)' }}>
                  <div>
                    <p className="font-medium text-sm" style={{ color: 'var(--text)' }}>{s.name}</p>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{s.email} · {s.course_name}</p>
                  </div>
                  <button onClick={() => issue(s.id, s.course_id)} disabled={issuing}
                    className="px-3 py-1.5 bg-blue-600 text-white rounded-xl text-xs font-medium disabled:opacity-50">
                    {issuing ? 'جاري...' : 'إصدار شهادة'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'all' && (
        <div className="rounded-2xl p-4" style={{ backgroundColor: 'var(--card)' }}>
          <h2 className="text-lg font-bold mb-4" style={{ color: 'var(--text)' }}>جميع الشهادات الصادرة</h2>
          {certs.length === 0 ? (
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>لم يتم إصدار أي شهادات بعد</p>
          ) : (
            <div className="space-y-2">
              {certs.map((c: any) => (
                <div key={c.id} className="p-3 rounded-xl" style={{ backgroundColor: 'var(--bg)' }}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm" style={{ color: 'var(--text)' }}>{c.student_name}</p>
                      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{c.course_name}</p>
                    </div>
                    <div className="text-left">
                      <p className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>{c.serial_id}</p>
                      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{new Date(c.issued_at).toLocaleDateString('ar-EG')}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
