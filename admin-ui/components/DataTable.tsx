'use client';

import { useState } from 'react';

interface Column { key: string; label: string; render?: (val: any, row: any) => React.ReactNode; sortable?: boolean; }

export default function DataTable({ columns, data, onRowClick, selectable, rowKey, selectedIds, onSelectionChange }: {
  columns: Column[]; data: any[]; onRowClick?: (row: any) => void;
  selectable?: boolean; rowKey?: string; selectedIds?: Set<number>; onSelectionChange?: (ids: Set<number>) => void;
}) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [search, setSearch] = useState('');

  const getRowId = (row: any) => Number(row[rowKey || 'id']);

  const sorted = [...data]
    .filter(row => !search || Object.values(row).some(v => String(v).includes(search)))
    .sort((a, b) => {
      if (!sortKey) return 0;
      const va = a[sortKey], vb = b[sortKey];
      if (va < vb) return sortDir === 'asc' ? -1 : 1;
      if (va > vb) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });

  const toggleSort = (key: string) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  };

  const isAllSelected = sorted.length > 0 && sorted.every(row => selectedIds?.has(getRowId(row)));

  const toggleSelect = (id: number) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id); else next.add(id);
    onSelectionChange?.(next);
  };

  const toggleAll = () => {
    if (isAllSelected) {
      onSelectionChange?.(new Set());
    } else {
      onSelectionChange?.(new Set(sorted.map(getRowId)));
    }
  };

  const colCount = columns.length + (selectable ? 1 : 0);
  // Row height lands in the 52–56px range (M3 data-table rows).
  const cellClass = 'px-4 py-3.5 align-middle';

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
          <span className="material-symbols-outlined text-[20px]" aria-hidden>check_circle</span>
          <span>تم تحديد {selectedIds.size} مجموعة</span>
          <button
            onClick={() => onSelectionChange?.(new Set())}
            className="mr-auto px-3 py-1.5 rounded-full text-xs font-medium transition-colors hover:brightness-95"
            style={{ backgroundColor: 'var(--md-sys-color-on-primary-container)', color: 'var(--md-sys-color-primary-container)' }}
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
          onChange={e => setSearch(e.target.value)}
          aria-label="بحث في الجدول"
          className="md3-field"
        />
      </div>
      <div className="overflow-x-auto rounded-[var(--md-sys-shape-corner-small)] border" style={{ borderColor: 'var(--md-sys-color-outline-variant)' }}>
        <table className="w-full text-sm" style={{ borderCollapse: 'separate', borderSpacing: 0 }}>
          <thead>
            <tr>
              {selectable && (
                <th className={`${cellClass} w-12 sticky right-0 z-10`} style={{ backgroundColor: 'var(--md-sys-color-surface-container)' }}>
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
                return (
                  <th
                    key={col.key}
                    onClick={() => col.sortable !== false && toggleSort(col.key)}
                    scope="col"
                    className={`${cellClass} text-right whitespace-nowrap border-b ${col.sortable !== false ? 'cursor-pointer select-none' : ''} ${isFirstSticky ? 'sticky right-0 z-10' : ''}`}
                    style={{
                      backgroundColor: 'var(--md-sys-color-surface-container)',
                      borderColor: 'var(--md-sys-color-outline-variant)',
                      color: 'var(--md-sys-color-on-surface-variant)',
                      fontWeight: 500,
                      fontSize: '13px',
                    }}
                  >
                    <span className="inline-flex items-center gap-1">
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
                <td colSpan={colCount} className="px-4 py-10 text-center" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>
                  لا توجد بيانات
                </td>
              </tr>
            ) : sorted.map((row, i) => {
              const rowId = getRowId(row);
              const isSelected = selectedIds?.has(rowId);
              return (
                <tr
                  key={rowId}
                  onClick={() => onRowClick?.(row)}
                  className={`transition-colors ${selectable || onRowClick ? 'cursor-pointer' : ''}`}
                  style={{ animationDelay: `${i * 0.03}s` }}
                  onMouseEnter={e => { if (!isSelected) e.currentTarget.style.backgroundColor = 'color-mix(in srgb, var(--md-sys-color-on-surface) 4%, transparent)'; }}
                  onMouseLeave={e => { e.currentTarget.style.backgroundColor = isSelected ? 'color-mix(in srgb, var(--md-sys-color-primary) 8%, transparent)' : ''; }}
                >
                  {selectable && (
                    <td
                      className={`${cellClass} w-12 sticky right-0 z-10 border-b`}
                      onClick={e => e.stopPropagation()}
                      style={{
                        backgroundColor: isSelected ? 'color-mix(in srgb, var(--md-sys-color-primary) 8%, var(--md-sys-color-surface-container-lowest))' : 'var(--md-sys-color-surface-container-lowest)',
                        borderColor: 'var(--md-sys-color-outline-variant)',
                      }}
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
                    return (
                      <td
                        key={col.key}
                        className={`${cellClass} border-b ${isFirstSticky ? 'sticky right-0 z-10' : ''}`}
                        style={{
                          color: 'var(--md-sys-color-on-surface)',
                          borderColor: 'var(--md-sys-color-outline-variant)',
                          backgroundColor: isSelected
                            ? 'color-mix(in srgb, var(--md-sys-color-primary) 8%, var(--md-sys-color-surface-container-lowest))'
                            : isFirstSticky
                              ? 'var(--md-sys-color-surface-container-lowest)'
                              : undefined,
                        }}
                      >
                        {col.render ? col.render(row[col.key], row) : String(row[col.key] ?? '')}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-xs mt-2" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>{sorted.length} نتيجة</p>
    </div>
  );
}
