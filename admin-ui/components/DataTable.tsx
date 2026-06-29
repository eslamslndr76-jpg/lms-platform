'use client';

import { useState } from 'react';

interface Column { key: string; label: string; render?: (val: any, row: any) => React.ReactNode; sortable?: boolean; }

export default function DataTable({ columns, data, onRowClick }: {
  columns: Column[]; data: any[]; onRowClick?: (row: any) => void;
}) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [search, setSearch] = useState('');

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

  return (
    <div>
      <div className="mb-3">
        <input type="text" placeholder="بحث..." value={search} onChange={e => setSearch(e.target.value)}
          className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
      </div>
      <div className="overflow-x-auto rounded-xl border border-gray-100">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b">
              {columns.map(col => (
                <th key={col.key} onClick={() => col.sortable !== false && toggleSort(col.key)}
                  className={`px-4 py-3 text-right text-gray-600 font-medium whitespace-nowrap ${col.sortable !== false ? 'cursor-pointer hover:text-gray-900' : ''}`}>
                  {col.label}
                  {sortKey === col.key && <span className="mr-1">{sortDir === 'asc' ? '↑' : '↓'}</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 ? (
              <tr><td colSpan={columns.length} className="px-4 py-8 text-center text-gray-400">لا توجد بيانات</td></tr>
            ) : sorted.map((row, i) => (
              <tr key={i} onClick={() => onRowClick?.(row)}
                className={`border-b border-gray-50 ${onRowClick ? 'cursor-pointer hover:bg-gray-50' : ''}`}>
                {columns.map(col => (
                  <td key={col.key} className="px-4 py-3">
                    {col.render ? col.render(row[col.key], row) : String(row[col.key] ?? '')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-gray-400 mt-2">{sorted.length} نتيجة</p>
    </div>
  );
}
