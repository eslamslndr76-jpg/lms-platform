'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '../../../lib/api';
import StatusBadge from '../../../components/StatusBadge';
import ExportButton from '../../../components/ExportButton';
import { useToast } from '../../../components/Toast';

export default function StudentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { toast } = useToast();
  const [student, setStudent] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    api(`/api/admin/users/${id}`)
      .then((data) => { if (active) setStudent(data); })
      .catch((err: any) => {
        if (!active) return;
        // Surface the failure, then fall back to the list.
        const message = err?.message || 'تعذّر تحميل ملف الطالب';
        setError(message);
        toast(message, 'error');
        setTimeout(() => router.push('/students'), 1200);
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [id, router, toast]);

  const infoCard = (label: string, value: string, opts: { ltr?: boolean } = {}) => (
    <div
      className="p-3"
      style={{
        backgroundColor: 'var(--md-sys-color-surface-container)',
        borderRadius: 'var(--md-sys-shape-corner-small)',
      }}
    >
      <span className="block text-xs mb-1" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>{label}</span>
      <span className="text-sm" style={{ color: 'var(--md-sys-color-on-surface)' }} dir={opts.ltr ? 'ltr' : undefined}>
        {value}
      </span>
    </div>
  );

  const sectionCard = (children: React.ReactNode) => (
    <section
      className="p-4 sm:p-5"
      style={{
        backgroundColor: 'var(--md-sys-color-surface-container-low)',
        borderRadius: 'var(--md-sys-shape-corner-medium)',
      }}
    >
      {children}
    </section>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64" role="status" aria-label="جارٍ التحميل">
        <div
          className="animate-spin h-9 w-9 rounded-full border-4"
          style={{ borderColor: 'var(--md-sys-color-primary)', borderTopColor: 'transparent' }}
        />
      </div>
    );
  }

  if (error || !student) {
    return (
      <div
        className="p-6 rounded-[var(--md-sys-shape-corner-medium)] flex flex-col items-center gap-3 text-center"
        style={{ backgroundColor: 'var(--md-sys-color-error-container)', color: 'var(--md-sys-color-on-error-container)' }}
      >
        <span className="material-symbols-outlined text-[28px]" aria-hidden>error</span>
        <p className="text-sm">{error || 'لم يتم العثور على الطالب'}</p>
        <Link href="/students" className="md3-btn md3-btn--filled text-sm">العودة للطلاب</Link>
      </div>
    );
  }

  return (
    <div className="space-y-5 animate-fade-in">
      <Link
        href="/students"
        className="inline-flex items-center gap-1.5 text-sm font-medium"
        style={{ color: 'var(--md-sys-color-primary)' }}
      >
        <span className="material-symbols-outlined text-[18px]" aria-hidden>arrow_forward</span>
        رجوع للطلاب
      </Link>

      {sectionCard(
        <div className="flex items-start gap-4">
          <div
            className="w-16 h-16 rounded-full shrink-0 flex items-center justify-center text-2xl font-bold overflow-hidden"
            style={{ backgroundColor: 'var(--md-sys-color-primary-container)', color: 'var(--md-sys-color-on-primary-container)' }}
          >
            {student.avatar
              ? <img src={student.avatar} alt="" className="w-full h-full object-cover" />
              : String(student.name || '?').charAt(0)}
          </div>
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold" style={{ color: 'var(--md-sys-color-on-surface)' }}>
              {student.name}
            </h1>
            <div className="mt-2 space-y-1 text-sm" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>
              <p className="flex items-center gap-1.5" dir="ltr">
                <span className="material-symbols-outlined text-[16px]" aria-hidden>mail</span>
                {student.email}
              </p>
              <p className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[16px]" aria-hidden>call</span>
                {student.phone || '—'}
              </p>
              <p className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[16px]" aria-hidden>badge</span>
                {student.role_name}
              </p>
            </div>
          </div>
        </div>,
      )}

      {sectionCard(
        <>
          <h2 className="font-bold mb-3 flex items-center gap-2" style={{ color: 'var(--md-sys-color-on-surface)' }}>
            <span className="material-symbols-outlined text-[20px]" aria-hidden>id_card</span>
            المعلومات الشخصية الإضافية
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {infoCard('الرقم القومي', student.national_id || '—', { ltr: true })}
            {infoCard('تاريخ الميلاد', student.birth_date || '—', { ltr: true })}
            {infoCard('النوع', student.gender || '—')}
            {infoCard('المحافظة', student.governorate || '—')}
            {infoCard('مسجل بجامعة', Number(student.is_enrolled) ? 'نعم' : 'لا')}
            {Number(student.is_enrolled) && infoCard('اسم الجامعة', student.university_name || '—')}
            {Number(student.is_enrolled) && infoCard('الكود الجامعي', student.university_code || '—', { ltr: true })}
          </div>
        </>,
      )}

      {sectionCard(
        <>
          <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
            <h2 className="font-bold" style={{ color: 'var(--md-sys-color-on-surface)' }}>
              الطلبات ({student.orders?.length || 0})
            </h2>
            <ExportButton
              dataset="orders"
              title={`تصدير طلبات ${student.name}`}
              query={{ studentId: id }}
              variant="soft"
            />
          </div>
          {student.orders?.length === 0 ? (
            <p className="text-sm" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>لا توجد طلبات.</p>
          ) : (
            <div className="space-y-2">
              {student.orders.map((o: any) => (
                <div
                  key={o.id}
                  className="flex items-center justify-between gap-2 p-3 text-sm"
                  style={{
                    backgroundColor: 'var(--md-sys-color-surface-container)',
                    borderRadius: 'var(--md-sys-shape-corner-small)',
                  }}
                >
                  <div className="min-w-0">
                    <span className="font-medium" style={{ color: 'var(--md-sys-color-on-surface)' }}>{o.title_ar}</span>
                    <span className="ms-2" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>{o.amount} ج.م</span>
                  </div>
                  <StatusBadge status={o.status} />
                </div>
              ))}
            </div>
          )}
        </>,
      )}

      {sectionCard(
        <>
          <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
            <h2 className="font-bold" style={{ color: 'var(--md-sys-color-on-surface)' }}>
              المجموعات ({student.groups?.length || 0})
            </h2>
            <ExportButton
              dataset="enrollments"
              title={`تصدير مجموعات ${student.name}`}
              query={{ studentId: id }}
              variant="soft"
            />
          </div>
          {student.groups?.length === 0 ? (
            <p className="text-sm" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>لا توجد مجموعات.</p>
          ) : (
            <div className="space-y-2">
              {student.groups.map((g: any) => (
                <div
                  key={g.id}
                  className="p-3 text-sm"
                  style={{
                    backgroundColor: 'var(--md-sys-color-surface-container)',
                    borderRadius: 'var(--md-sys-shape-corner-small)',
                  }}
                >
                  <span className="font-medium" style={{ color: 'var(--md-sys-color-on-surface)' }}>{g.name}</span>
                  <span className="ms-2" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>({g.course_name})</span>
                </div>
              ))}
            </div>
          )}
        </>,
      )}
    </div>
  );
}