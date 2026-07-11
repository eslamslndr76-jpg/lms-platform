'use client';

export function Skeleton({ className = '' }: { className?: string }) {
  return (
    <div className={`skeleton ${className}`} />
  );
}

export function CourseCardSkeleton() {
  return (
    <div
      className="rounded-2xl overflow-hidden animate-pulse"
      style={{ backgroundColor: 'var(--card)' }}
    >
      <div className="skeleton h-48 w-full rounded-none" />
      <div className="p-4 space-y-3">
        <div className="skeleton h-4 w-20 rounded-lg" />
        <div className="skeleton h-5 w-full rounded-lg" />
        <div className="skeleton h-4 w-3/4 rounded-lg" />
        <div className="flex gap-4">
          <div className="skeleton h-4 w-24 rounded-lg" />
          <div className="skeleton h-4 w-20 rounded-lg" />
        </div>
        <div className="skeleton h-2 w-full rounded-full mt-2" />
        <div className="flex justify-between pt-2">
          <div className="skeleton h-5 w-16 rounded-lg" />
          <div className="skeleton h-4 w-20 rounded-lg" />
        </div>
      </div>
    </div>
  );
}

export function PageSkeleton() {
  return (
    <div style={{ backgroundColor: 'var(--bg)' }}>
      {/* Hero Skeleton */}
      <div
        className="relative overflow-hidden pb-16"
        style={{ backgroundColor: 'var(--surface)' }}
      >
        <div className="max-w-6xl mx-auto px-4 pt-12 md:pt-16">
          <div className="skeleton h-5 w-48 rounded-lg mb-4" />
          <div className="skeleton h-12 w-96 rounded-xl mb-3" />
          <div className="skeleton h-6 w-64 rounded-lg mb-6" />
          <div className="skeleton h-14 w-full max-w-lg rounded-2xl mb-6" />
          <div className="flex gap-3">
            <div className="skeleton h-16 w-32 rounded-2xl" />
            <div className="skeleton h-16 w-32 rounded-2xl" />
            <div className="skeleton h-16 w-32 rounded-2xl" />
          </div>
        </div>
      </div>
      {/* Filters Skeleton */}
      <div className="max-w-6xl mx-auto px-4 -mt-6 mb-8">
        <div className="skeleton h-12 w-full rounded-2xl" />
      </div>
      {/* Grid Skeleton */}
      <div className="max-w-6xl mx-auto px-4 pb-12">
        <div className="skeleton h-7 w-40 rounded-lg mb-6" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <CourseCardSkeleton key={i} />
          ))}
        </div>
      </div>
    </div>
  );
}
