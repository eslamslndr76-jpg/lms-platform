'use client';

import { useState, useEffect, useMemo } from 'react';
import { api } from '../../lib/api';
import ExportButton from '../../components/ExportButton';

interface Student {
  id: number;
  name: string;
  email: string;
  course_id: number;
  course_name: string;
  attended: number;
  total: number;
  attendancePercent: number;
}

interface Certificate {
  id: number;
  serial_id: string;
  issued_at: string;
  status: string;
  revoked_at: string | null;
  revoke_reason: string | null;
  student_name: string;
  student_email: string;
  course_name: string;
}

type SortKey = 'issued_at' | 'student_name' | 'course_name' | 'serial_id';
type SortDir = 'asc' | 'desc';
type FilterStatus = 'all' | 'active' | 'revoked';

export default function CertificatesPage() {
  const [tab, setTab] = useState<'issue' | 'all'>('issue');
  const [students, setStudents] = useState<Student[]>([]);
  const [certs, setCerts] = useState<Certificate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [issuing, setIssuing] = useState<number | null>(null);
  const [msg, setMsg] = useState('');
  const [msgType, setMsgType] = useState<'success' | 'error'>('success');

  // ── Search / Filter / Sort state ──
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [sortKey, setSortKey] = useState<SortKey>('issued_at');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  // ── Revoke modal state ──
  const [revokeModal, setRevokeModal] = useState<{ certId: number; name: string } | null>(null);
  const [revokeReason, setRevokeReason] = useState('');
  const [revoking, setRevoking] = useState(false);

  // Student search
  const [studentSearch, setStudentSearch] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [s, c] = await Promise.all([
        api('/api/admin/certificates/students'),
        api('/api/admin/certificates'),
      ]);
      setStudents(s || []);
      setCerts(c || []);
    } catch {
      setError('فشل تحميل البيانات');
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  // ── Issue certificate ──
  const issue = async (userId: number, courseId: number) => {
    setIssuing(userId);
    try {
      await api('/api/admin/certificates', {
        method: 'POST',
        body: JSON.stringify({ user_id: userId, course_id: courseId }),
      });
      setMsgType('success');
      setMsg('تم إصدار الشهادة بنجاح');
      load();
    } catch {
      setMsgType('error');
      setMsg('فشل إصدار الشهادة');
    }
    setIssuing(null);
    setTimeout(() => setMsg(''), 3000);
  };

  // ── Revoke certificate ──
  const revoke = async (certId: number, reason: string) => {
    setRevoking(true);
    try {
      await api(`/api/admin/certificates/${certId}/revoke`, {
        method: 'PUT',
        body: JSON.stringify({ reason: reason || null }),
      });
      setMsgType('success');
      setMsg('تم سحب الشهادة بنجاح');
      setRevokeModal(null);
      setRevokeReason('');
      load();
    } catch {
      setMsgType('error');
      setMsg('فشل سحب الشهادة');
    }
    setRevoking(false);
    setTimeout(() => setMsg(''), 3000);
  };

  // ── Restore certificate ──
  const restore = async (certId: number) => {
    try {
      await api(`/api/admin/certificates/${certId}/restore`, { method: 'PUT' });
      setMsgType('success');
      setMsg('تم استعادة الشهادة بنجاح');
      load();
    } catch {
      setMsgType('error');
      setMsg('فشل استعادة الشهادة');
    }
    setTimeout(() => setMsg(''), 3000);
  };

  // ── Delete certificate (permanent) ──
  const deleteCert = async (certId: number) => {
    if (!confirm('هل أنت متأكد من حذف هذه الشهادة نهائياً؟ لا يمكن التراجع عن هذا الإجراء.')) return;
    try {
      await api(`/api/admin/certificates/${certId}`, { method: 'DELETE' });
      setMsgType('success');
      setMsg('تم حذف الشهادة نهائياً');
      load();
    } catch {
      setMsgType('error');
      setMsg('فشل حذف الشهادة');
    }
    setTimeout(() => setMsg(''), 3000);
  };

  // ── Toggle sort ──
  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  // ── Filter + Sort + Search certificates ──
  const filteredCerts = useMemo(() => {
    let list = [...certs];

    // Status filter
    if (filterStatus !== 'all') {
      list = list.filter(c => c.status === filterStatus);
    }

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter(c =>
        c.student_name.toLowerCase().includes(q) ||
        c.student_email.toLowerCase().includes(q) ||
        c.course_name.toLowerCase().includes(q) ||
        c.serial_id.toLowerCase().includes(q)
      );
    }

    // Sort
    list.sort((a, b) => {
      let valA: string, valB: string;
      switch (sortKey) {
        case 'student_name':
          valA = a.student_name; valB = b.student_name; break;
        case 'course_name':
          valA = a.course_name; valB = b.course_name; break;
        case 'serial_id':
          valA = a.serial_id; valB = b.serial_id; break;
        default:
          valA = a.issued_at; valB = b.issued_at;
      }
      const cmp = valA.localeCompare(valB, 'ar');
      return sortDir === 'asc' ? cmp : -cmp;
    });

    return list;
  }, [certs, filterStatus, searchQuery, sortKey, sortDir]);

  // ── Filter students for issue tab ──
  const filteredStudents = useMemo(() => {
    if (!studentSearch.trim()) return students;
    const q = studentSearch.trim().toLowerCase();
    return students.filter(s =>
      s.name.toLowerCase().includes(q) ||
      s.email.toLowerCase().includes(q) ||
      s.course_name.toLowerCase().includes(q)
    );
  }, [students, studentSearch]);

  // ── Stats ──
  const activeCount = certs.filter(c => c.status === 'active').length;
  const revokedCount = certs.filter(c => c.status === 'revoked').length;

  // ── Sort icon helper ──
  const sortIcon = (key: SortKey) => {
    if (sortKey !== key) return '↕';
    return sortDir === 'asc' ? '↑' : '↓';
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin h-8 w-8 border-4 rounded-full" style={{ borderColor: 'var(--primary)', borderTopColor: 'transparent' }} />
    </div>
  );

  if (error) return (
    <div className="flex flex-col items-center justify-center h-64 gap-4">
      <p style={{ color: '#dc2626' }}>{error}</p>
      <button onClick={load} className="px-4 py-2 bg-[var(--primary)] text-white rounded-xl text-sm">إعادة المحاولة</button>
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Toast */}
      {msg && (
        <div className={`px-4 py-3 rounded-xl text-sm animate-slide-up ${
          msgType === 'success'
            ? 'bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400'
            : 'bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400'
        }`}>
          {msgType === 'success' ? '✅' : '❌'} {msg}
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-2">
        <button onClick={() => setTab('issue')}
          className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${tab === 'issue' ? 'text-white' : ''}`}
          style={tab === 'issue' ? { backgroundColor: 'var(--primary)' } : { backgroundColor: 'var(--card)', color: 'var(--text)' }}>
          📋 إصدار شهادات ({students.length})
        </button>
        <button onClick={() => setTab('all')}
          className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${tab === 'all' ? 'text-white' : ''}`}
          style={tab === 'all' ? { backgroundColor: 'var(--primary)' } : { backgroundColor: 'var(--card)', color: 'var(--text)' }}>
          🎓 جميع الشهادات ({certs.length})
        </button>
        <ExportButton
          dataset="certificates"
          title="تصدير الشهادات"
          query={{ status: filterStatus, search: searchQuery }}
          variant="soft"
          className="ms-auto"
        />
      </div>

      {/* ═══════════════════════════════════════ */}
      {/* TAB: Manual Issue                      */}
      {/* ═══════════════════════════════════════ */}
      {tab === 'issue' && (
        <div className="rounded-2xl p-4" style={{ backgroundColor: 'var(--card)' }}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div>
              <h2 className="text-lg font-bold" style={{ color: 'var(--text)' }}>الطلاب المستحقون للشهادات</h2>
              <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                الطلاب الذين دفعوا ولم تُصدر لهم شهادة نشطة بعد
              </p>
            </div>
            {students.length > 0 && (
              <input
                value={studentSearch}
                onChange={e => setStudentSearch(e.target.value)}
                placeholder="🔍 بحث بالاسم أو الإيميل أو الكورس..."
                className="px-4 py-2 rounded-xl border text-sm w-full sm:w-72"
                style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }}
              />
            )}
          </div>

          {filteredStudents.length === 0 ? (
            <div className="text-center py-8">
              <div className="text-4xl mb-2">{students.length === 0 ? '✅' : '🔍'}</div>
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                {students.length === 0 ? 'لا يوجد طلاب مستحقون للشهادات' : 'لا توجد نتائج تطابق البحث'}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredStudents.map((s) => (
                <div key={`${s.id}-${s.course_id}`} className="flex items-center justify-between p-3 rounded-xl" style={{ backgroundColor: 'var(--bg)' }}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium text-sm" style={{ color: 'var(--text)' }}>{s.name}</p>
                      {s.total > 0 && (
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                          s.attendancePercent >= 80 ? 'bg-green-100 text-green-700' :
                          s.attendancePercent >= 50 ? 'bg-yellow-100 text-yellow-700' :
                          'bg-red-100 text-red-700'
                        }`}>
                          حضور {s.attendancePercent}%
                        </span>
                      )}
                    </div>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{s.email} · {s.course_name}</p>
                    {s.total > 0 && (
                      <div className="flex items-center gap-2 mt-1">
                        <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--border)' }}>
                          <div className="h-full rounded-full" style={{
                            width: `${s.attendancePercent}%`,
                            backgroundColor: s.attendancePercent >= 80 ? '#22c55e' : s.attendancePercent >= 50 ? '#eab308' : '#ef4444'
                          }} />
                        </div>
                        <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{s.attended}/{s.total}</span>
                      </div>
                    )}
                  </div>
                  <button onClick={() => issue(s.id, s.course_id)}
                    disabled={issuing === s.id}
                    className="px-3 py-1.5 bg-[var(--primary)] text-white rounded-xl text-xs font-medium disabled:opacity-50 mr-3 shrink-0">
                    {issuing === s.id ? 'جاري...' : '🎓 إصدار شهادة'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════ */}
      {/* TAB: All Certificates                  */}
      {/* ═══════════════════════════════════════ */}
      {tab === 'all' && (
        <div className="rounded-2xl p-4" style={{ backgroundColor: 'var(--card)' }}>
          {/* Stats bar */}
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <div className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full" style={{ backgroundColor: 'var(--bg)', color: 'var(--text)' }}>
              <span>📊</span>
              <span>الكل: <strong>{certs.length}</strong></span>
            </div>
            <div className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400">
              <span>✅</span>
              <span>نشط: <strong>{activeCount}</strong></span>
            </div>
            <div className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400">
              <span>🚫</span>
              <span>مسحوب: <strong>{revokedCount}</strong></span>
            </div>
          </div>

          {/* Search + Filter row */}
          <div className="flex flex-col sm:flex-row gap-2 mb-4">
            <div className="relative flex-1">
              <input
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="🔍 بحث بالاسم أو الإيميل أو الكورس أو الرقم التسلسلي..."
                className="w-full px-4 py-2.5 pr-10 rounded-xl border text-sm"
                style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }}
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-xs opacity-50 hover:opacity-100"
                  style={{ color: 'var(--text)' }}>
                  ✕
                </button>
              )}
            </div>
            <select
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value as FilterStatus)}
              className="px-4 py-2.5 rounded-xl border text-sm cursor-pointer"
              style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }}
            >
              <option value="all">📋 الكل ({certs.length})</option>
              <option value="active">✅ نشط ({activeCount})</option>
              <option value="revoked">🚫 مسحوب ({revokedCount})</option>
            </select>
          </div>

          {/* Sort buttons */}
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>ترتيب حسب:</span>
            {([
              ['issued_at', '📅 التاريخ'],
              ['student_name', '👤 الطالب'],
              ['course_name', '📚 الكورس'],
              ['serial_id', '🔢 الرقم'],
            ] as [SortKey, string][]).map(([key, label]) => (
              <button key={key} onClick={() => toggleSort(key)}
                className={`text-[11px] px-2.5 py-1 rounded-lg font-medium transition-all ${
                  sortKey === key ? 'bg-[var(--primary)] text-white' : ''
                }`}
                style={sortKey !== key ? { backgroundColor: 'var(--bg)', color: 'var(--text-muted)' } : {}}>
                {label} {sortIcon(key)}
              </button>
            ))}
          </div>

          {/* Results count */}
          {searchQuery || filterStatus !== 'all' ? (
            <p className="text-[11px] mb-2" style={{ color: 'var(--text-muted)' }}>
              {filteredCerts.length} نتيجة من أصل {certs.length}
            </p>
          ) : null}

          {/* Certificate list */}
          {filteredCerts.length === 0 ? (
            <div className="text-center py-8">
              <div className="text-4xl mb-2">📄</div>
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                {certs.length === 0 ? 'لم يتم إصدار أي شهادات بعد' : 'لا توجد نتائج تطابق البحث'}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredCerts.map((c) => (
                <div key={c.id}
                  className={`p-3 rounded-xl border-l-4 transition-all ${
                    c.status === 'revoked'
                      ? 'border-l-red-400 opacity-60'
                      : 'border-l-green-400'
                  }`}
                  style={{ backgroundColor: 'var(--bg)' }}>
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium text-sm" style={{ color: 'var(--text)' }}>{c.student_name}</p>
                        {c.status === 'revoked' ? (
                          <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400">
                            مسحوب
                          </span>
                        ) : (
                          <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400">
                            نشط
                          </span>
                        )}
                      </div>
                      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                        {c.course_name} · {c.student_email}
                      </p>
                      <div className="flex items-center gap-3 mt-1">
                        <p className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>{c.serial_id}</p>
                        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                          {new Date(c.issued_at).toLocaleDateString('ar-EG')}
                        </p>
                        {c.revoked_at && (
                          <p className="text-xs text-red-500">
                            سُحب: {new Date(c.revoked_at).toLocaleDateString('ar-EG')}
                          </p>
                        )}
                      </div>
                      {c.revoke_reason && (
                        <p className="text-[11px] mt-1 px-2 py-1 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800">
                          📝 {c.revoke_reason}
                        </p>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1.5 shrink-0">
                        {c.status === 'active' ? (
                        <button onClick={() => setRevokeModal({ certId: c.id, name: c.student_name })}
                          className="px-3 py-1.5 rounded-lg text-[11px] font-medium bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors"
                          title="سحب الشهادة">
                          🚫 سحب
                        </button>
                      ) : (
                        <>
                          <button onClick={() => restore(c.id)}
                            className="px-3 py-1.5 rounded-lg text-[11px] font-medium bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900/40 transition-colors"
                            title="استعادة الشهادة">
                            ✅ استعادة
                          </button>
                          <button onClick={() => deleteCert(c.id)}
                            className="px-3 py-1.5 rounded-lg text-[11px] font-medium bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors"
                            title="حذف نهائي">
                            🗑️
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Revoke Reason Modal ── */}
      {revokeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
          onClick={() => { setRevokeModal(null); setRevokeReason(''); }}>
          <div className="w-full max-w-md mx-4 p-6 rounded-2xl shadow-2xl border"
            style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}
            onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold mb-1" style={{ color: 'var(--text)' }}>🚫 سحب الشهادة</h3>
            <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>
              هل أنت متأكد من سحب شهادة <strong>{revokeModal.name}</strong>؟
            </p>

            <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text)' }}>
              ملاحظات السبب <span className="text-xs" style={{ color: 'var(--text-muted)' }}>(اختياري)</span>
            </label>
            <textarea
              rows={3}
              value={revokeReason}
              onChange={e => setRevokeReason(e.target.value)}
              placeholder="مثال: تم اكتشاف تلاعب في الحضور..."
              className="w-full px-3 py-2 rounded-xl border text-sm resize-none focus:outline-none focus:ring-2 focus:ring-red-400"
              style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }}
            />
            <p className="text-[11px] mt-1" style={{ color: 'var(--text-muted)' }}>
              هذه الملاحظات ستظهر للطالب في داشبورده وصفحة التحقق
            </p>

            <div className="flex gap-3 mt-5">
              <button
                disabled={revoking}
                onClick={() => revoke(revokeModal.certId, revokeReason)}
                className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 transition-colors">
                {revoking ? '⏳ جاري السحب...' : '🚫 تأكيد السحب'}
              </button>
              <button
                onClick={() => { setRevokeModal(null); setRevokeReason(''); }}
                className="px-4 py-2.5 rounded-xl text-sm font-medium border transition-colors"
                style={{ borderColor: 'var(--border)', color: 'var(--text)' }}>
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
