export function Skeleton({ className = '' }: { className?: string }) {
  return (
    <div className={`animate-pulse rounded-md bg-gray-200 ${className}`} />
  );
}

export function CourseCardSkeleton() {
  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm space-y-3">
      <Skeleton className="h-40 w-full rounded-xl" />
      <Skeleton className="h-5 w-3/4" />
      <Skeleton className="h-4 w-1/2" />
      <Skeleton className="h-10 w-full rounded-xl" />
    </div>
  );
}

export function PageSkeleton() {
  return (
    <div className="p-4 space-y-4">
      <Skeleton className="h-8 w-1/3" />
      <div className="grid grid-cols-1 gap-4">
        {[1, 2, 3, 4].map(i => <CourseCardSkeleton key={i} />)}
      </div>
    </div>
  );
}
