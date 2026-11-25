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
    <div className="flex flex-wrap items-center justify-between gap-3 mt-4">
      <span className="text-sm" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>
        إجمالي {total} نتيجة
      </span>
      <div className="flex items-center gap-1.5">
        <button
          disabled={page <= 1}
          onClick={() => onChange(page - 1)}
          aria-label="الصفحة السابقة"
          className="md3-btn md3-btn--icon md3-btn--outlined disabled:opacity-30"
          style={{ borderRadius: 'var(--md-sys-shape-corner-small)' }}
        >
          <span className="material-symbols-outlined text-[20px]">chevron_right</span>
        </button>
        {getPageNumbers().map((p, i) =>
          typeof p === 'string' ? (
            <span key={`e${i}`} className="px-1.5 text-sm" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>…</span>
          ) : (
            <button
              key={p}
              onClick={() => onChange(p)}
              aria-current={p === page ? 'page' : undefined}
              className="md3-btn"
              style={
                p === page
                  ? {
                      backgroundColor: 'var(--md-sys-color-primary-container)',
                      color: 'var(--md-sys-color-on-primary-container)',
                      fontWeight: 700,
                      minWidth: 40,
                      padding: '0 10px',
                    }
                  : {
                      background: 'transparent',
                      color: 'var(--md-sys-color-on-surface)',
                      minWidth: 40,
                      padding: '0 10px',
                    }
              }
            >
              {p}
            </button>
          ),
        )}
        <button
          disabled={page >= pages}
          onClick={() => onChange(page + 1)}
          aria-label="الصفحة التالية"
          className="md3-btn md3-btn--icon md3-btn--outlined disabled:opacity-30"
          style={{ borderRadius: 'var(--md-sys-shape-corner-small)' }}
        >
          <span className="material-symbols-outlined text-[20px]">chevron_left</span>
        </button>
      </div>
    </div>
  );
}
