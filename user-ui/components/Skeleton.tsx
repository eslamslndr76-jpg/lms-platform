'use client';

export function Skeleton({ className = '' }: { className?: string }) {
  return (
    <div className={`skeleton ${className}`} />
  );
}

export function CourseCardSkeleton() {
  return (
    <div
      className="md3-card md3-card--outlined overflow-hidden animate-pulse"
    >
      <div className="skeleton h-[180px] w-full" style={{ borderRadius: 0 }} />
      <div className="p-4 space-y-2.5">
        <div className="skeleton h-6 w-20" style={{ borderRadius: 'var(--md-sys-shape-corner-extra-small)' }} />
        <div className="skeleton h-5 w-full" style={{ borderRadius: 'var(--md-sys-shape-corner-extra-small)' }} />
        <div className="skeleton h-4 w-3/4" style={{ borderRadius: 'var(--md-sys-shape-corner-extra-small)' }} />
        <div className="skeleton h-4 w-1/2" style={{ borderRadius: 'var(--md-sys-shape-corner-extra-small)' }} />
        <div className="flex gap-3">
          <div className="skeleton h-4 w-24" style={{ borderRadius: 'var(--md-sys-shape-corner-extra-small)' }} />
          <div className="skeleton h-4 w-20" style={{ borderRadius: 'var(--md-sys-shape-corner-extra-small)' }} />
        </div>
        <div className="pt-3" style={{ borderTop: '1px solid var(--md-sys-color-outline-variant)' }}>
          <div className="flex justify-between">
            <div className="skeleton h-5 w-16" style={{ borderRadius: 'var(--md-sys-shape-corner-extra-small)' }} />
            <div className="skeleton h-4 w-20" style={{ borderRadius: 'var(--md-sys-shape-corner-extra-small)' }} />
          </div>
        </div>
      </div>
    </div>
  );
}

export function PageSkeleton() {
  return (
    <div style={{ backgroundColor: 'var(--md-sys-color-surface)' }}>
      {/* Hero Skeleton */}
      <div
        className="relative overflow-hidden pb-16"
        style={{ backgroundColor: 'var(--md-sys-color-surface-container-low)' }}
      >
        <div className="max-w-6xl mx-auto px-4 pt-12 md:pt-16">
          <div className="skeleton h-5 w-48 rounded-md3-sm mb-4" />
          <div className="skeleton h-12 w-96 rounded-md3-sm mb-3" />
          <div className="skeleton h-6 w-64 rounded-md3-sm mb-6" />
          <div className="skeleton h-14 w-full max-w-lg rounded-md3-sm mb-6" />
          <div className="flex gap-3">
            <div className="skeleton h-10 w-32 rounded-full" />
            <div className="skeleton h-10 w-32 rounded-full" />
            <div className="skeleton h-10 w-32 rounded-full" />
          </div>
        </div>
      </div>
      {/* Filters Skeleton */}
      <div className="max-w-6xl mx-auto px-4 -mt-6 mb-8">
        <div className="skeleton h-12 w-full rounded-md3-sm" />
      </div>
      {/* Grid Skeleton */}
      <div className="max-w-6xl mx-auto px-4 pb-12">
        <div className="skeleton h-7 w-40 rounded-md3-sm mb-6" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <CourseCardSkeleton key={i} />
          ))}
        </div>
      </div>
    </div>
  );
}
