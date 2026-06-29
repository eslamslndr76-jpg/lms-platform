'use client';

import { useState, useEffect } from 'react';
import { api } from '../../lib/api';

export default function ReportsPage() {
  const [courses, setCourses] = useState<any[]>([]);
  const [selectedCourse, setSelectedCourse] = useState('');
  const [exporting, setExporting] = useState('');

  useEffect(() => {
    api('/api/courses').then(setCourses);
  }, []);

  const doExport = async (type: string) => {
    setExporting(type);
    const endpoint = type === 'students'
      ? `/api/exports/students/${selectedCourse}`
      : type === 'orders'
        ? '/api/exports/orders'
        : '/api/exports/financials';

    try {
      const data = await api(endpoint);
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${type}-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      alert('فشل التصدير');
    }
    setExporting('');
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">التقارير والتصدير</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl p-6 shadow-sm space-y-3">
          <h2 className="font-bold">تصدير الطلاب بكورس</h2>
          <select value={selectedCourse} onChange={e => setSelectedCourse(e.target.value)}
            className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm">
            <option value="">اختر الكورس</option>
            {courses.map((c: any) => <option key={c.id} value={c.id}>{c.title_ar}</option>)}
          </select>
          <button disabled={!selectedCourse || !!exporting}
            onClick={() => doExport('students')}
            className="w-full py-2.5 bg-blue-600 text-white rounded-xl text-sm font-medium disabled:opacity-50">
            {exporting === 'students' ? 'جاري...' : '📥 تصدير'}
          </button>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm space-y-3">
          <h2 className="font-bold">تصدير جميع الطلبات</h2>
          <p className="text-sm text-gray-500">جميع الطلبات بكل حالاتها</p>
          <button disabled={!!exporting}
            onClick={() => doExport('orders')}
            className="w-full py-2.5 bg-green-600 text-white rounded-xl text-sm font-medium disabled:opacity-50">
            {exporting === 'orders' ? 'جاري...' : '📥 تصدير'}
          </button>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm space-y-3">
          <h2 className="font-bold">تصدير المالية</h2>
          <p className="text-sm text-gray-500">جميع المعاملات المالية</p>
          <button disabled={!!exporting}
            onClick={() => doExport('financials')}
            className="w-full py-2.5 bg-amber-600 text-white rounded-xl text-sm font-medium disabled:opacity-50">
            {exporting === 'financials' ? 'جاري...' : '📥 تصدير'}
          </button>
        </div>
      </div>
    </div>
  );
}
