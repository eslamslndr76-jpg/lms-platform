'use client';

export default function Skeleton({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="space-y-3" role="status" aria-label="جارٍ التحميل">
      <div className="flex gap-4 mb-4">
        {Array.from({ length: cols }).map((_, i) => (
          <div key={i} className="h-4 skeleton flex-1" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex gap-4">
          {Array.from({ length: cols }).map((_, c) => (
            <div
              key={c}
              className="h-11 skeleton flex-1"
              style={{ animationDelay: `${r * 60}ms` }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
