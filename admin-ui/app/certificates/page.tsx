'use client';

import { useState, useEffect, useMemo } from 'react';
import { api } from '../../lib/api';
import ExportButton from '../../components/ExportButton';
import Modal from '../../components/Modal';

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
      <div className="animate-spin h-8 w-8 border-4 rounded-full" style={{ borderColor: 'var(--md-sys-color-primary)', borderTopColor: 'transparent' }} />
    </div>
  );

  if (error) return (
    <div className="flex flex-col items-center justify-center h-64 gap-4">
      <p style={{ color: 'var(--md-sys-color-on-error-container)' }}>{error}</p>
      <button onClick={load} className="md3-btn md3-btn--filled">إعادة المحاولة</button>
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Toast */}
      {msg && (
        <div className={`px-4 py-3 rounded-xl text-sm animate-slide-up ${
          msgType === 'success'
            ? 'msg-ok'
            : 'msg-err'
        }`}>
          {msgType === 'success' ? '✅' : '❌'} {msg}
        </div>
      )}

      {/* Tabs */}
      <div className="md3-tabs">
        <button role="tab" aria-selected={tab === 'issue'} onClick={() => setTab('issue')}
          className={`md3-tab ${tab === 'issue' ? 'md3-tab--active' : ''}`}>
          📋 إصدار شهادات ({students.length})
        </button>
        <button role="tab" aria-selected={tab === 'all'} onClick={() => setTab('all')}
          className={`md3-tab ${tab === 'all' ? 'md3-tab--active' : ''}`}>
          🎓 جميع الشهادات ({certs.length})
        </button>
        <div className="ms-auto self-center pb-1">
          <ExportButton
            dataset="certificates"
            title="تصدير الشهادات"
            query={{ status: filterStatus, search: searchQuery }}
            variant="soft"
          />
        </div>
      </div>

      {/* ═══════════════════════════════════════ */}
      {/* TAB: Manual Issue                      */}
      {/* ═══════════════════════════════════════ */}
      {tab === 'issue' && (
        <div className="p-4" style={{ backgroundColor: 'var(--md-sys-color-surface-container-low)', borderRadius: 'var(--md-sys-shape-corner-medium)' }}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div>
              <h2 className="text-lg font-bold" style={{ color: 'var(--md-sys-color-on-surface)' }}>الطلاب المستحقون للشهادات</h2>
              <p className="text-xs mt-1" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>
                الطلاب الذين دفعوا ولم تُصدر لهم شهادة نشطة بعد
              </p>
            </div>
            {students.length > 0 && (
              <input
                value={studentSearch}
                onChange={e => setStudentSearch(e.target.value)}
                placeholder="🔍 بحث بالاسم أو الإيميل أو الكورس..."
                className="md3-field w-full sm:w-72"
              />
            )}
          </div>

          {filteredStudents.length === 0 ? (
            <div className="text-center py-8">
              <div className="text-4xl mb-2">{students.length === 0 ? '✅' : '🔍'}</div>
              <p className="text-sm" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>
                {students.length === 0 ? 'لا يوجد طلاب مستحقون للشهادات' : 'لا توجد نتائج تطابق البحث'}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredStudents.map((s) => (
                <div key={`${s.id}-${s.course_id}`} className="flex items-center justify-between p-3 rounded-xl" style={{ backgroundColor: 'var(--md-sys-color-surface-container)' }}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium text-sm" style={{ color: 'var(--md-sys-color-on-surface)' }}>{s.name}</p>
                      {s.total > 0 && (
                        <span className="text-xs px-2.5 py-0.5 rounded-full font-medium"
                          style={s.attendancePercent >= 80
                            ? { backgroundColor: 'var(--md-sys-color-success-container)', color: 'var(--md-sys-color-on-success-container)' }
                            : s.attendancePercent >= 50
                              ? { backgroundColor: 'var(--md-sys-color-warning-container)', color: 'var(--md-sys-color-on-warning-container)' }
                              : { backgroundColor: 'var(--md-sys-color-error-container)', color: 'var(--md-sys-color-on-error-container)' }}>
                          حضور {s.attendancePercent}%
                        </span>
                      )}
                    </div>
                    <p className="text-xs" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>{s.email} · {s.course_name}</p>
                    {s.total > 0 && (
                      <div className="flex items-center gap-2 mt-1">
                        <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--md-sys-color-outline-variant)' }}>
                          <div className="h-full rounded-full" style={{
                            width: `${s.attendancePercent}%`,
                            backgroundColor: s.attendancePercent >= 80
                              ? 'var(--md-sys-color-success)'
                              : s.attendancePercent >= 50
                                ? 'var(--md-sys-color-warning)'
                                : 'var(--md-sys-color-error)'
                          }} />
                        </div>
                        <span className="text-xs" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>{s.attended}/{s.total}</span>
                      </div>
                    )}
                  </div>
                  <button onClick={() => issue(s.id, s.course_id)}
                    disabled={issuing === s.id}
                    className="md3-btn md3-btn--filled text-sm mr-3 shrink-0">
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
        <div className="p-4" style={{ backgroundColor: 'var(--md-sys-color-surface-container-low)', borderRadius: 'var(--md-sys-shape-corner-medium)' }}>
          {/* Stats bar */}
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <div className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full" style={{ backgroundColor: 'var(--md-sys-color-surface-container)', color: 'var(--md-sys-color-on-surface)' }}>
              <span>📊</span>
              <span>الكل: <strong>{certs.length}</strong></span>
            </div>
            <div className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full " style={{ backgroundColor: 'var(--md-sys-color-success-container)', color: 'var(--md-sys-color-on-success-container)' }}>
              <span>✅</span>
              <span>نشط: <strong>{activeCount}</strong></span>
            </div>
            <div className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full " style={{ backgroundColor: 'var(--md-sys-color-error-container)', color: 'var(--md-sys-color-on-error-container)' }}>
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
                className="md3-field pr-12"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  aria-label="مسح البحث"
                  className="absolute left-2 top-1/2 -translate-y-1/2 md3-btn md3-btn--icon"
                  style={{ width: 32, minWidth: 32, height: 32 }}
                >
                  <span className="material-symbols-outlined text-[18px]" aria-hidden>close</span>
                </button>
              )}
            </div>
            <select
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value as FilterStatus)}
              className="md3-field cursor-pointer"
            >
              <option value="all">📋 الكل ({certs.length})</option>
              <option value="active">✅ نشط ({activeCount})</option>
              <option value="revoked">🚫 مسحوب ({revokedCount})</option>
            </select>
          </div>

          {/* Sort buttons */}
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <span className="text-sm" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>ترتيب حسب:</span>
            {([
              ['issued_at', '📅 التاريخ'],
              ['student_name', '👤 الطالب'],
              ['course_name', '📚 الكورس'],
              ['serial_id', '🔢 الرقم'],
            ] as [SortKey, string][]).map(([key, label]) => (
              <button key={key} onClick={() => toggleSort(key)}
                className={`min-h-10 text-sm px-3 py-2 rounded-md3-full font-medium transition-all ${
                  sortKey === key ? 'chip-active' : ''
                }`}
                style={sortKey !== key ? { backgroundColor: 'var(--md-sys-color-surface-container)', color: 'var(--md-sys-color-on-surface-variant)' } : {}}>
                {label} {sortIcon(key)}
              </button>
            ))}
          </div>

          {/* Results count */}
          {searchQuery || filterStatus !== 'all' ? (
            <p className="text-xs mb-2" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>
              {filteredCerts.length} نتيجة من أصل {certs.length}
            </p>
          ) : null}

          {/* Certificate list */}
          {filteredCerts.length === 0 ? (
            <div className="text-center py-8">
              <div className="text-4xl mb-2">📄</div>
              <p className="text-sm" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>
                {certs.length === 0 ? 'لم يتم إصدار أي شهادات بعد' : 'لا توجد نتائج تطابق البحث'}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredCerts.map((c) => (
                <div key={c.id}
                  className={`p-3 rounded-xl border-l-4 transition-all ${
                    c.status === 'revoked'
                      ? 'cert-revoked'
                      : 'border-l-green-400'
                  }`}
                  style={{ backgroundColor: 'var(--md-sys-color-surface-container)' }}>
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium text-sm" style={{ color: 'var(--md-sys-color-on-surface)' }}>{c.student_name}</p>
                        {c.status === 'revoked' ? (
                          <span className="text-xs px-2.5 py-0.5 rounded-full font-medium" style={{ backgroundColor: 'var(--md-sys-color-error-container)', color: 'var(--md-sys-color-on-error-container)' }}>
                            مسحوب
                          </span>
                        ) : (
                          <span className="text-xs px-2.5 py-0.5 rounded-full font-medium" style={{ backgroundColor: 'var(--md-sys-color-success-container)', color: 'var(--md-sys-color-on-success-container)' }}>
                            نشط
                          </span>
                        )}
                      </div>
                      <p className="text-xs" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>
                        {c.course_name} · {c.student_email}
                      </p>
                      <div className="flex items-center gap-3 mt-1">
                        <p className="text-xs font-mono" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>{c.serial_id}</p>
                        <p className="text-xs" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>
                          {new Date(c.issued_at).toLocaleDateString('ar-EG')}
                        </p>
                        {c.revoked_at && (
                          <p className="text-sm" style={{ color: 'var(--md-sys-color-error)' }}>
                            سُحب: {new Date(c.revoked_at).toLocaleDateString('ar-EG')}
                          </p>
                        )}
                      </div>
                      {c.revoke_reason && (
                        <p className="text-xs mt-1 px-2 py-1 rounded-lg " style={{ backgroundColor: 'var(--md-sys-color-error-container)', color: 'var(--md-sys-color-on-error-container)' }}>
                          📝 {c.revoke_reason}
                        </p>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1.5 shrink-0">
                        {c.status === 'active' ? (
                        <button onClick={() => setRevokeModal({ certId: c.id, name: c.student_name })}
                          className="md3-btn shrink-0" style={{ backgroundColor: 'var(--md-sys-color-error-container)', color: 'var(--md-sys-color-on-error-container)' }}
                          title="سحب الشهادة">
                          🚫 سحب
                        </button>
                      ) : (
                        <>
                          <button onClick={() => restore(c.id)}
                            className="md3-btn shrink-0" style={{ backgroundColor: 'var(--md-sys-color-success-container)', color: 'var(--md-sys-color-on-success-container)' }}
                            title="استعادة الشهادة">
                            ✅ استعادة
                          </button>
                          <button onClick={() => deleteCert(c.id)}
                            className="md3-btn shrink-0" style={{ backgroundColor: 'var(--md-sys-color-error-container)', color: 'var(--md-sys-color-on-error-container)' }}
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
      <Modal
        open={!!revokeModal}
        onClose={() => { setRevokeModal(null); setRevokeReason(''); }}
        title="🚫 سحب الشهادة"
        size="md"
      >
        {revokeModal && (
          <>
            <p className="text-sm mb-4" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>
              هل أنت متأكد من سحب شهادة <strong>{revokeModal.name}</strong>؟
            </p>

            <label className="block text-sm font-medium mb-2" style={{ color: 'var(--md-sys-color-on-surface)' }}>
              ملاحظات السبب <span className="text-xs" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>(اختياري)</span>
            </label>
            <textarea
              rows={3}
              value={revokeReason}
              onChange={e => setRevokeReason(e.target.value)}
              placeholder="مثال: تم اكتشاف تلاعب في الحضور..."
              className="md3-field resize-none"
            />
            <p className="text-xs mt-1" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>
              هذه الملاحظات ستظهر للطالب في داشبورده وصفحة التحقق
            </p>

            <div className="flex gap-3 mt-5">
              <button
                disabled={revoking}
                onClick={() => revoke(revokeModal.certId, revokeReason)}
                className="md3-btn md3-btn--danger flex-1">
                {revoking ? '⏳ جاري السحب...' : '🚫 تأكيد السحب'}
              </button>
              <button
                onClick={() => { setRevokeModal(null); setRevokeReason(''); }}
                className="md3-btn md3-btn--outlined flex-1">
                إلغاء
              </button>
            </div>
          </>
        )}
      </Modal>
    </div>
  );
}
