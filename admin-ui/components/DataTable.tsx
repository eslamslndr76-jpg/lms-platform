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

  return (
    <div>
      {selectable && selectedIds && selectedIds.size > 0 && (
        <div className="mb-3 px-4 py-2.5 rounded-xl border text-sm flex items-center gap-3"
          style={{ backgroundColor: 'var(--primary)', borderColor: 'var(--primary)', color: 'white' }}>
          <span>✓ تم تحديد {selectedIds.size} مجموعة</span>
          <button onClick={() => onSelectionChange?.(new Set())}
            className="mr-auto px-3 py-1 rounded-lg text-xs font-medium bg-white/20 hover:bg-white/30 transition-all">
            إلغاء التحديد
          </button>
        </div>
      )}
      <div className="mb-3">
        <input type="text" placeholder="بحث..." value={search} onChange={e => setSearch(e.target.value)}
          className="w-full px-4 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2 transition-all"
          style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }} />
      </div>
      <div className="overflow-x-auto rounded-xl border" style={{ borderColor: 'var(--border)' }}>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b" style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)' }}>
              {selectable && (
                <th className="px-4 py-3 w-10">
                  <input type="checkbox" checked={isAllSelected} onChange={toggleAll}
                    className="accent-blue-600 w-4 h-4 cursor-pointer" />
                </th>
              )}
              {columns.map(col => (
                <th key={col.key} onClick={() => col.sortable !== false && toggleSort(col.key)}
                  className={`px-4 py-3 text-right font-medium whitespace-nowrap ${col.sortable !== false ? 'cursor-pointer hover:opacity-80' : ''}`}
                  style={{ color: 'var(--text-muted)' }}>
                  {col.label}
                  {sortKey === col.key && <span className="mr-1">{sortDir === 'asc' ? '↑' : '↓'}</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 ? (
              <tr><td colSpan={colCount} className="px-4 py-8 text-center" style={{ color: 'var(--text-muted)' }}>لا توجد بيانات</td></tr>
            ) : sorted.map((row, i) => {
              const rowId = getRowId(row);
              const isSelected = selectedIds?.has(rowId);
              return (
                <tr key={rowId} onClick={() => onRowClick?.(row)}
                  className={`border-b transition-all animate-fade-in ${selectable ? 'cursor-pointer' : ''}`}
                  style={{
                    borderColor: 'var(--border)',
                    animationDelay: `${i * 0.03}s`,
                    backgroundColor: isSelected ? 'rgba(59, 130, 246, 0.08)' : undefined,
                  }}>
                  {selectable && (
                    <td className="px-4 py-3 w-10" onClick={e => e.stopPropagation()}>
                      <input type="checkbox" checked={!!isSelected} onChange={() => toggleSelect(rowId)}
                        className="accent-blue-600 w-4 h-4 cursor-pointer" />
                    </td>
                  )}
                  {columns.map(col => (
                    <td key={col.key} className="px-4 py-3" style={{ color: 'var(--text)' }}>
                      {col.render ? col.render(row[col.key], row) : String(row[col.key] ?? '')}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>{sorted.length} نتيجة</p>
    </div>
  );
}
