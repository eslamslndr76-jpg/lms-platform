'use client';

import { useState } from 'react';

export interface DataTableColumn {
  key: string;
  label: string;
  render?: (val: any, row: any) => React.ReactNode;
  sortable?: boolean;
  align?: 'right' | 'center' | 'left';
  minWidth?: string | number;
  nowrap?: boolean;
}

const ALIGN_CLASS: Record<'right' | 'center' | 'left', string> = {
  right: 'text-right',
  center: 'text-center',
  left: 'text-left',
};

export default function DataTable({
  columns,
  data,
  onRowClick,
  selectable,
  rowKey,
  selectedIds,
  onSelectionChange,
  selectionLabel = 'عنصر',
}: {
  columns: DataTableColumn[];
  data: any[];
  onRowClick?: (row: any) => void;
  selectable?: boolean;
  rowKey?: string;
  selectedIds?: Set<number>;
  onSelectionChange?: (ids: Set<number>) => void;
  selectionLabel?: string;
}) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [search, setSearch] = useState('');

  const keyField = rowKey || 'id';
  const getRowId = (row: any, fallbackIndex: number): number => {
    const n = Number(row?.[keyField]);
    return Number.isFinite(n) ? n : fallbackIndex;
  };

  const sorted = [...data]
    .filter((row) => !search || Object.values(row).some((v) => String(v ?? '').includes(search)))
    .sort((a, b) => {
      if (!sortKey) return 0;
      const va = a[sortKey];
      const vb = b[sortKey];
      if (va < vb) return sortDir === 'asc' ? -1 : 1;
      if (va > vb) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });

  const toggleSort = (key: string) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const isAllSelected = sorted.length > 0 && sorted.every((row, i) => selectedIds?.has(getRowId(row, i)));

  const toggleSelect = (id: number) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onSelectionChange?.(next);
  };

  const toggleAll = () => {
    if (isAllSelected) {
      onSelectionChange?.(new Set());
    } else {
      onSelectionChange?.(new Set(sorted.map((row, i) => getRowId(row, i))));
    }
  };

  const colCount = columns.length + (selectable ? 1 : 0);
  const cellClass = 'px-4 py-3.5 align-middle';
  // Sticky first column on <lg viewports only; desktop uses static flow.
  const stickyClass = 'sticky right-0 z-10 lg:static lg:z-auto';

  const seenKeys = new Map<string, number>();
  const getReactKey = (row: any, index: number): string => {
    const raw = row?.[keyField];
    const valid = raw !== undefined && raw !== null && raw !== '' && !Number.isNaN(raw);
    const base = valid ? String(raw) : `row-${index}`;
    const count = seenKeys.get(base) ?? 0;
    seenKeys.set(base, count + 1);
    return count === 0 ? base : `${base}#${count}`;
  };

  return (
    <div>
      {selectable && selectedIds && selectedIds.size > 0 && (
        <div
          className="mb-3 px-4 py-2.5 rounded-[var(--md-sys-shape-corner-small)] text-sm flex items-center gap-3"
          style={{
            backgroundColor: 'var(--md-sys-color-primary-container)',
            color: 'var(--md-sys-color-on-primary-container)',
          }}
        >
          <span className="material-symbols-outlined text-[20px]" aria-hidden>
            check_circle
          </span>
          <span>
            تم تحديد {selectedIds.size} {selectionLabel}
          </span>
          <button
            onClick={() => onSelectionChange?.(new Set())}
            className="mr-auto px-3 py-1.5 rounded-full text-xs font-medium transition-colors hover:brightness-95"
            style={{
              backgroundColor: 'var(--md-sys-color-on-primary-container)',
              color: 'var(--md-sys-color-primary-container)',
            }}
          >
            إلغاء التحديد
          </button>
        </div>
      )}
      <div className="mb-3">
        <input
          type="text"
          placeholder="بحث..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="بحث في الجدول"
          className="md3-field"
        />
      </div>
      <div className="md3-table-wrap">
        <table className="md3-table">
          <thead>
            <tr>
              {selectable && (
                <th
                  className={`${cellClass} w-12 text-center ${stickyClass}`}
                  style={{ backgroundColor: 'var(--md-sys-color-surface-container)' }}
                >
                  <input
                    type="checkbox"
                    checked={isAllSelected}
                    onChange={toggleAll}
                    aria-label="تحديد الكل"
                    className="w-4 h-4 cursor-pointer"
                    style={{ accentColor: 'var(--md-sys-color-primary)' }}
                  />
                </th>
              )}
              {columns.map((col, colIndex) => {
                const isFirstSticky = !selectable && colIndex === 0;
                const align = col.align || 'right';
                return (
                  <th
                    key={col.key}
                    onClick={() => col.sortable !== false && toggleSort(col.key)}
                    scope="col"
                    className={`${cellClass} ${ALIGN_CLASS[align]} whitespace-nowrap border-b ${
                      col.sortable !== false ? 'cursor-pointer select-none' : ''
                    } ${isFirstSticky ? stickyClass : ''}`}
                    style={{
                      backgroundColor: 'var(--md-sys-color-surface-container)',
                      borderColor: 'var(--md-sys-color-outline-variant)',
                      color: 'var(--md-sys-color-on-surface-variant)',
                      fontWeight: 500,
                      fontSize: '13px',
                      minWidth: col.minWidth,
                    }}
                  >
                    <span className={`inline-flex items-center gap-1 ${align === 'center' ? 'justify-center' : ''}`}>
                      {col.label}
                      {sortKey === col.key && (
                        <span className="material-symbols-outlined text-[16px]" aria-hidden>
                          {sortDir === 'asc' ? 'arrow_upward' : 'arrow_downward'}
                        </span>
                      )}
                    </span>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 ? (
              <tr>
                <td colSpan={colCount} className="md3-table-empty">
                  لا توجد بيانات
                </td>
              </tr>
            ) : (
              sorted.map((row, i) => {
                const rowId = getRowId(row, i);
                const isSelected = selectedIds?.has(rowId);
                return (
                  <tr
                    key={getReactKey(row, i)}
                    onClick={() => onRowClick?.(row)}
                    data-selected={isSelected ? 'true' : undefined}
                    className={`md3-table-row ${selectable || onRowClick ? 'cursor-pointer' : ''}`}
                  >
                    {selectable && (
                      <td
                        className={`${cellClass} w-12 text-center ${stickyClass}`}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <input
                          type="checkbox"
                          checked={!!isSelected}
                          onChange={() => toggleSelect(rowId)}
                          aria-label={`تحديد الصف ${rowId}`}
                          className="w-4 h-4 cursor-pointer"
                          style={{ accentColor: 'var(--md-sys-color-primary)' }}
                        />
                      </td>
                    )}
                    {columns.map((col, colIndex) => {
                      const isFirstSticky = !selectable && colIndex === 0;
                      const align = col.align || 'right';
                      const rawText = String(row[col.key] ?? '');
                      return (
                        <td
                          key={col.key}
                          className={`${cellClass} ${ALIGN_CLASS[align]} ${
                            col.nowrap ? 'whitespace-nowrap' : ''
                          } ${isFirstSticky ? stickyClass : ''}`}
                          style={{ minWidth: col.minWidth }}
                        >
                          {col.render ? (
                            col.render(row[col.key], row)
                          ) : (
                            <span
                              className={
                                col.nowrap
                                  ? 'whitespace-nowrap'
                                  : 'block max-w-[260px] break-words line-clamp-2'
                              }
                              title={rawText.length > 24 ? rawText : undefined}
                            >
                              {rawText}
                            </span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      <p className="text-xs mt-2" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>
        {sorted.length} نتيجة
      </p>
    </div>
  );
}
