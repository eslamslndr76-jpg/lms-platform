'use client';

import { Skeleton } from '../Skeleton';

export function CourseDetailSkeleton() {
  return (
    <div className="max-w-4xl mx-auto p-4 space-y-4">
      <Skeleton className="h-52 md:h-72 w-full rounded-3xl" />
      <div className="-mt-6 relative px-4">
        <div className="rounded-t-3xl p-6 space-y-4" style={{ backgroundColor: 'var(--card)' }}>
          <Skeleton className="h-8 w-2/3" />
          <Skeleton className="h-4 w-full" />
          <div className="grid grid-cols-3 md:grid-cols-5 gap-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-20 w-full rounded-xl" />
            ))}
          </div>
          <Skeleton className="h-6 w-1/4" />
          <Skeleton className="h-32 w-full rounded-2xl" />
          <div className="flex gap-3">
            <Skeleton className="h-12 w-1/2 rounded-xl" />
            <Skeleton className="h-12 w-1/2 rounded-xl" />
          </div>
        </div>
      </div>
    </div>
  );
}