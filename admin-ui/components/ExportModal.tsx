'use client';

import { useState } from 'react';
import Modal from './Modal';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  endpoint: string;
  filename: string;
  showCoursePicker?: boolean;
  courses?: { id: number; name_ar: string }[];
}

export default function ExportModal({ open, onClose, title, endpoint, filename, showCoursePicker, courses }: Props) {
  const [courseId, setCourseId] = useState('');
  const [loading, setLoading] = useState('');

  const download = async (format: string) => {
    let url = endpoint;
    if (showCoursePicker && !courseId) return;
    if (showCoursePicker) url = endpoint.replace(':courseId', courseId);
    setLoading(format);
    try {
      const token = localStorage.getItem('admin_token');
      const res = await fetch(`${API_URL}${url}?format=${format}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = `${filename}.${format === 'xlsx' ? 'xlsx' : 'pdf'}`;
      a.click();
      URL.revokeObjectURL(blobUrl);
    } catch {
      alert('فشل التصدير');
    }
    setLoading('');
  };

  return (
    <Modal open={open} onClose={onClose} title={title}>
      <div className="space-y-4">
        {showCoursePicker && (
          <select value={courseId} onChange={e => setCourseId(e.target.value)}
            className="w-full px-4 py-2.5 rounded-xl border text-sm" style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }}>
            <option value="">اختر الكورس</option>
            {courses?.map(c => <option key={c.id} value={c.id}>{c.name_ar}</option>)}
          </select>
        )}
        <div className="flex gap-3">
          <button onClick={() => download('xlsx')} disabled={!!loading || (showCoursePicker && !courseId)}
            className="flex-1 py-3 rounded-xl text-white font-medium text-sm disabled:opacity-50 flex items-center justify-center gap-2" style={{ backgroundColor: 'var(--primary)' }}>
            {loading === 'xlsx' ? 'جاري...' : <>📊 Excel</>}
          </button>
          <button onClick={() => download('pdf')} disabled={!!loading || (showCoursePicker && !courseId)}
            className="flex-1 py-3 rounded-xl text-white font-medium text-sm disabled:opacity-50 flex items-center justify-center gap-2" style={{ backgroundColor: '#dc2626' }}>
            {loading === 'pdf' ? 'جاري...' : <>📄 PDF</>}
          </button>
        </div>
      </div>
    </Modal>
  );
}