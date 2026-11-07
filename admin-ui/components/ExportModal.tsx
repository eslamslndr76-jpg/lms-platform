'use client';

import { useEffect, useMemo, useState } from 'react';
import Modal from './Modal';
import {
  downloadExport,
  fetchCatalog,
  type ExportDatasetMeta,
  type ExportQuery,
} from '../lib/exportUtils';

interface Props {
  open: boolean;
  onClose: () => void;
  /** Dataset key from the backend registry (orders, students, groups, …). */
  dataset: string;
  /** Heading shown in the modal — defaults to the dataset name. */
  title?: string;
  /** Current page filters, forwarded to the export request. */
  query?: ExportQuery;
  /** Pre-select a subset of columns. Defaults to every column. */
  columns?: string[];
}

export default function ExportModal({ open, onClose, dataset, title, query, columns }: Props) {
  const [meta, setMeta] = useState<ExportDatasetMeta | null>(null);
  const [metaError, setMetaError] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState<'' | 'xlsx' | 'csv'>('');
  const [error, setError] = useState('');
  const [done, setDone] = useState('');

  // Load the dataset definition (columns + description) once per open.
  useEffect(() => {
    if (!open) return;
    let active = true;
    setMetaError('');
    fetchCatalog()
      .then((datasets) => {
        if (!active) return;
        const found = datasets.find((d) => d.key === dataset) || null;
        setMeta(found);
        setSelected(columns?.length ? columns : (found?.columns || []).map((c) => c.key));
      })
      .catch((err) => active && setMetaError(err?.message || 'تعذّر تحميل بيانات التصدير'));
    return () => {
      active = false;
    };
  }, [open, dataset]);

  useEffect(() => {
    if (!open) {
      setError('');
      setDone('');
      setLoading('');
    }
  }, [open]);

  const allKeys = useMemo(() => (meta?.columns || []).map((c) => c.key), [meta]);
  const allSelected = allKeys.length > 0 && selected.length === allKeys.length;

  const toggleColumn = (key: string) => {
    setSelected((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  };

  const run = async (format: 'xlsx' | 'csv') => {
    setLoading(format);
    setError('');
    setDone('');
    try {
      const filename = await downloadExport(dataset, {
        format,
        params: query,
        columns: allSelected ? [] : selected,
      });
      setDone(filename);
      setTimeout(() => onClose(), 1200);
    } catch (err: any) {
      setError(err?.message || 'فشل التصدير');
    } finally {
      setLoading('');
    }
  };

  const appliedFilters = Object.entries(query || {}).filter(
    ([, value]) => value !== undefined && value !== null && value !== '' && value !== 'all',
  );

  return (
    <Modal open={open} onClose={onClose} title={title || meta?.name || 'تصدير البيانات'}>
      <div className="space-y-4">
        {metaError && (
          <p className="text-xs rounded-xl px-3 py-2" style={{ backgroundColor: '#fef2f2', color: '#dc2626' }}>
            {metaError}
          </p>
        )}

        {meta && (
          <p className="text-xs leading-6" style={{ color: 'var(--text-muted)' }}>
            {meta.description}
          </p>
        )}

        <div
          className="rounded-xl border px-3 py-2 text-xs leading-5"
          style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text-muted)' }}
        >
          ملف Excel مُنسّق بهوية المنصة وشعارها، بصف إجماليات تلقائي وفلاتر — قابل للتعديل بالكامل.
          {appliedFilters.length > 0 ? ' سيتم تطبيق الفلاتر الحالية على الملف.' : ' سيتم تصدير كل السجلات.'}
        </div>

        {meta && meta.columns.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium" style={{ color: 'var(--text)' }}>
                الأعمدة ({selected.length}/{meta.columns.length})
              </span>
              <button
                type="button"
                onClick={() => setSelected(allSelected ? [] : allKeys)}
                className="text-xs font-medium"
                style={{ color: 'var(--primary)' }}
              >
                {allSelected ? 'إلغاء الكل' : 'تحديد الكل'}
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto">
              {meta.columns.map((column) => {
                const active = selected.includes(column.key);
                return (
                  <button
                    key={column.key}
                    type="button"
                    onClick={() => toggleColumn(column.key)}
                    className="px-2.5 py-1 rounded-lg text-xs border transition-colors"
                    style={
                      active
                        ? {
                            backgroundColor: 'var(--primary)',
                            borderColor: 'var(--primary)',
                            color: 'var(--primary-contrast, #fff)',
                          }
                        : { borderColor: 'var(--border)', color: 'var(--text-muted)' }
                    }
                  >
                    {column.header}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={() => run('xlsx')}
            disabled={!!loading || selected.length === 0}
            className="flex-1 py-3 rounded-xl text-white font-medium text-sm disabled:opacity-50"
            style={{ backgroundColor: 'var(--primary)' }}
          >
            {loading === 'xlsx' ? 'جاري التحضير...' : '📊 تنزيل Excel'}
          </button>
          <button
            onClick={() => run('csv')}
            disabled={!!loading || selected.length === 0}
            className="flex-1 py-3 rounded-xl font-medium text-sm disabled:opacity-50"
            style={{ backgroundColor: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--border)' }}
          >
            {loading === 'csv' ? 'جاري التحضير...' : '🧾 CSV'}
          </button>
        </div>

        {selected.length === 0 && (
          <p className="text-xs text-center" style={{ color: '#dc2626' }}>
            اختر عمودًا واحدًا على الأقل.
          </p>
        )}

        {error && (
          <p className="text-xs text-center" style={{ color: '#dc2626' }}>
            {error}
          </p>
        )}

        {done && (
          <p className="text-xs text-center" style={{ color: '#16a34a' }}>
            ✅ تم تنزيل: {done}
          </p>
        )}
      </div>
    </Modal>
  );
}
