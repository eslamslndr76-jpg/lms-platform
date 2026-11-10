'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../lib/auth';
import { api } from '../../lib/api';
import { loginUrl } from '../../lib/redirect';

interface InstructorGroup {
  id: number;
  name: string;
  status: string;
  completed_at: string | null;
  instructor_eval_opened_at: string | null;
  course_title: string;
  students_count: number;
  lectures_count: number;
  eval_status: string | null;
}

function formatDate(value?: string | null): string {
  if (!value) return '';
  const raw = String(value);
  const iso = raw.includes('T') ? raw : `${raw.replace(' ', 'T')}Z`;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' });
}

export default function InstructorPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [groups, setGroups] = useState<InstructorGroup[]>([]);
  const [loadingGroups, setLoadingGroups] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.push(loginUrl());
      return;
    }
    if (user.role !== 'instructor') router.push('/dashboard');
  }, [user, loading, router]);

  const load = useCallback(async () => {
    setLoadingGroups(true);
    setError('');
    try {
      const data = await api('/api/instructor/groups');
      setGroups(Array.isArray(data) ? data : []);
    } catch {
      setError('تعذّر تحميل مجموعاتك. تحقق من اتصالك وحاول مرة أخرى.');
    } finally {
      setLoadingGroups(false);
    }
  }, []);

  useEffect(() => {
    if (!loading && user?.role === 'instructor') void load();
  }, [loading, user, load]);

  if (loading || !user || user.role !== 'instructor') {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div
          className="animate-spin h-8 w-8 border-4 rounded-full"
          style={{ borderColor: 'var(--md-sys-color-primary)', borderTopColor: 'transparent' }}
        />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <header className="mb-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: 'var(--md-sys-color-on-surface)' }}>
              مجموعاتي
            </h1>
            <p className="text-sm mt-1" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>
              المجموعات المرتبطة بحسابك فقط. يظهر تقييم الطلاب بعد إنهاء المجموعة.
            </p>
          </div>
          <Link
            href="/instructor/proposals"
            className="inline-flex items-center gap-1.5 min-h-[44px] px-5 rounded-full text-sm font-medium"
            style={{
              backgroundColor: 'var(--md-sys-color-secondary-container)',
              color: 'var(--md-sys-color-on-secondary-container)',
            }}
          >
            <span className="material-symbols-outlined text-[18px]" aria-hidden="true">description</span>
            مقترحات الكورسات
          </Link>
        </div>
      </header>

      {loadingGroups ? (
        <div className="space-y-3" aria-label="جارٍ التحميل">
          {[0, 1, 2].map((row) => (
            <div
              key={row}
              className="h-28 rounded-3xl animate-pulse"
              style={{ backgroundColor: 'var(--md-sys-color-surface-container)' }}
            />
          ))}
        </div>
      ) : error ? (
        <div
          className="rounded-3xl p-6 text-center space-y-3"
          style={{ backgroundColor: 'var(--md-sys-color-error-container)' }}
        >
          <p className="text-sm" style={{ color: 'var(--md-sys-color-on-error-container)' }}>{error}</p>
          <button
            type="button"
            onClick={() => void load()}
            className="px-5 py-2 rounded-full text-sm font-medium"
            style={{
              backgroundColor: 'var(--md-sys-color-primary)',
              color: 'var(--md-sys-color-on-primary)',
            }}
          >
            إعادة المحاولة
          </button>
        </div>
      ) : groups.length === 0 ? (
        <div
          className="rounded-3xl p-10 text-center space-y-2"
          style={{ backgroundColor: 'var(--md-sys-color-surface-container)' }}
        >
          <span
            className="material-symbols-outlined text-[44px]"
            style={{ color: 'var(--md-sys-color-outline)' }}
            aria-hidden="true"
          >
            school
          </span>
          <p className="font-medium" style={{ color: 'var(--md-sys-color-on-surface)' }}>
            لا توجد مجموعات مرتبطة بحسابك بعد
          </p>
          <p className="text-xs" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>
            تواصل مع وحدة التدريب والتطوير لربط مجموعاتك بحسابك.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {groups.map((group) => {
            const completed = group.status === 'completed';
            const evalOpen = completed;
            return (
              <article
                key={group.id}
                className="rounded-3xl p-5"
                style={{
                  backgroundColor: 'var(--md-sys-color-surface-container)',
                  border: '1px solid var(--md-sys-color-outline-variant)',
                }}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="font-bold text-base" style={{ color: 'var(--md-sys-color-on-surface)' }}>
                      {group.course_title}
                    </h2>
                    <p className="text-sm mt-0.5" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>
                      {group.name}
                    </p>
                  </div>
                  <span
                    className="text-xs px-3 py-1 rounded-full font-medium shrink-0"
                    style={{
                      backgroundColor: completed
                        ? 'var(--md-sys-color-tertiary-container)'
                        : 'var(--md-sys-color-secondary-container)',
                      color: completed
                        ? 'var(--md-sys-color-on-tertiary-container)'
                        : 'var(--md-sys-color-on-secondary-container)',
                    }}
                  >
                    {completed ? 'منتهية' : group.status === 'cancelled' ? 'ملغية' : 'جارية'}
                  </span>
                </div>

                <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs mt-3" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>
                  <span>{group.students_count} طالب</span>
                  <span>{group.lectures_count} محاضرة</span>
                  {completed && group.completed_at && <span>انتهت في {formatDate(group.completed_at)}</span>}
                </div>

                {evalOpen && (
                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <span
                      className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full font-medium"
                      style={{
                        backgroundColor: group.eval_status === 'submitted'
                          ? 'var(--md-sys-color-tertiary-container)'
                          : 'var(--md-sys-color-primary-container)',
                        color: group.eval_status === 'submitted'
                          ? 'var(--md-sys-color-on-tertiary-container)'
                          : 'var(--md-sys-color-on-primary-container)',
                      }}
                    >
                      <span className="material-symbols-outlined text-[16px]" aria-hidden="true">assignment</span>
                      {group.eval_status === 'submitted' ? 'تم إرسال التقييم' : 'تقييم الطلاب متاح'}
                    </span>
                    <Link
                      href={`/instructor/evaluate/${group.id}`}
                      className="inline-flex items-center gap-1 text-xs px-4 py-1.5 rounded-full font-medium"
                      style={{
                        backgroundColor: 'var(--md-sys-color-primary)',
                        color: 'var(--md-sys-color-on-primary)',
                      }}
                    >
                      {group.eval_status === 'submitted' ? 'عرض التقييم' : 'بدء التقييم'}
                      <span className="material-symbols-outlined text-[16px]" aria-hidden="true">chevron_left</span>
                    </Link>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
