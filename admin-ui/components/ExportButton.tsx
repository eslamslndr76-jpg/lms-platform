'use client';

import { useState, type CSSProperties } from 'react';
import ExportModal from './ExportModal';
import type { ExportQuery } from '../lib/exportUtils';

interface Props {
  /** Dataset key from the backend registry. */
  dataset: string;
  /** Modal heading (defaults to the dataset name). */
  title?: string;
  /** The filters currently applied on the page. */
  query?: ExportQuery;
  /** Preselect specific columns. */
  columns?: string[];
  label?: string;
  /**
   * primary — filled brand button (page header)
   * soft    — outlined button (toolbars)
   * icon    — compact square button (cards / table headers)
   */
  variant?: 'primary' | 'soft' | 'icon';
  className?: string;
  disabled?: boolean;
}

const base =
  'inline-flex items-center justify-center gap-1.5 text-sm font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed';

export default function ExportButton({
  dataset,
  title,
  query,
  columns,
  label = 'تصدير',
  variant = 'primary',
  className = '',
  disabled,
}: Props) {
  const [open, setOpen] = useState(false);

  const styles: Record<string, CSSProperties> = {
    primary: { backgroundColor: 'var(--primary)', color: '#fff' },
    soft: { backgroundColor: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--border)' },
    icon: { backgroundColor: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--border)' },
  };

  const sizes: Record<string, string> = {
    primary: 'px-4 py-2 rounded-xl',
    soft: 'px-3 py-2 rounded-xl',
    icon: 'w-9 h-9 rounded-xl',
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={disabled}
        title={variant === 'icon' ? label : undefined}
        aria-label={label}
        className={`${base} ${sizes[variant]} ${className}`}
        style={styles[variant]}
      >
        <span aria-hidden>📥</span>
        {variant !== 'icon' && <span>{label}</span>}
      </button>

      <ExportModal
        open={open}
        onClose={() => setOpen(false)}
        dataset={dataset}
        title={title}
        query={query}
        columns={columns}
      />
    </>
  );
}
