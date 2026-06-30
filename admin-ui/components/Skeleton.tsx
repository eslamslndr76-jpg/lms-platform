'use client';

export default function Skeleton({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="space-y-3 animate-pulse">
      <div className="flex gap-4 mb-4">
        {Array.from({ length: cols }).map((_, i) => (
          <div key={i} className="h-4 rounded-lg flex-1" style={{ backgroundColor: 'var(--border)' }} />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex gap-4">
          {Array.from({ length: cols }).map((_, c) => (
            <div key={c} className="h-10 rounded-lg flex-1" style={{ backgroundColor: 'var(--border)', opacity: 1 - r * 0.1 }} />
          ))}
        </div>
      ))}
    </div>
  );
}
