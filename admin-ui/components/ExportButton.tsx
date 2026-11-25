'use client';

import { useState } from 'react';
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

const sizeClasses: Record<string, string> = {
  primary: 'md3-btn md3-btn--filled',
  soft: 'md3-btn md3-btn--outlined',
  icon: 'md3-btn md3-btn--icon md3-btn--outlined',
};

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

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={disabled}
        title={variant === 'icon' ? label : undefined}
        aria-label={label}
        className={`${sizeClasses[variant]} ${variant !== 'primary' ? 'rounded-[var(--md-sys-shape-corner-small)]' : ''} ${className}`}
      >
        <span className="material-symbols-outlined text-[18px]" aria-hidden>download</span>
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
