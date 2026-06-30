'use client';

export default function Pagination({ page, total, limit, onChange }: {
  page: number; total: number; limit: number; onChange: (p: number) => void;
}) {
  const pages = Math.ceil(total / limit);
  if (pages <= 1) return null;

  const getPageNumbers = () => {
    const delta = 2;
    const range: (number | string)[] = [];
    for (let i = 1; i <= pages; i++) {
      if (i === 1 || i === pages || (i >= page - delta && i <= page + delta)) {
        range.push(i);
      } else if (range[range.length - 1] !== '...') {
        range.push('...');
      }
    }
    return range;
  };

  return (
    <div className="flex items-center justify-between mt-4">
      <span className="text-sm" style={{ color: 'var(--text-muted)' }}>
        إجمالي {total} نتيجة
      </span>
      <div className="flex items-center gap-1">
        <button disabled={page <= 1} onClick={() => onChange(page - 1)}
          className="px-3 py-1.5 text-sm rounded-lg disabled:opacity-30 border transition-all hover:opacity-80"
          style={{ borderColor: 'var(--border)', color: 'var(--text)' }}>
          ←
        </button>
        {getPageNumbers().map((p, i) =>
          typeof p === 'string' ? (
            <span key={`e${i}`} className="px-2 text-xs" style={{ color: 'var(--text-muted)' }}>...</span>
          ) : (
            <button key={p} onClick={() => onChange(p)}
              className="px-3 py-1.5 text-sm rounded-lg transition-all"
              style={p === page ? { backgroundColor: 'var(--primary)', color: '#fff' } : { color: 'var(--text)', border: '1px solid var(--border)' }}>
              {p}
            </button>
          )
        )}
        <button disabled={page >= pages} onClick={() => onChange(page + 1)}
          className="px-3 py-1.5 text-sm rounded-lg disabled:opacity-30 border transition-all hover:opacity-80"
          style={{ borderColor: 'var(--border)', color: 'var(--text)' }}>
          →
        </button>
      </div>
    </div>
  );
}
