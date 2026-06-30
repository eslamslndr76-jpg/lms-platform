'use client';

import { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import DataTable from '../../components/DataTable';
import Modal from '../../components/Modal';

export default function GroupsPage() {
  const [groups, setGroups] = useState<any[]>([]);
  const [courses, setCourses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ name: '', course_id: '', schedule: '' });

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [g, c] = await Promise.all([api('/api/groups'), api('/api/courses')]);
      setGroups(g);
      setCourses(c);
    } catch {
      setError('فشل تحميل البيانات');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const save = async () => {
    await api('/api/groups', {
      method: 'POST',
      body: JSON.stringify({ ...form, course_id: Number(form.course_id) }),
    });
    setModal(false);
    setForm({ name: '', course_id: '', schedule: '' });
    load();
  };

  const deleteGroup = async (id: number) => {
    if (!confirm('تأكيد الحذف؟')) return;
    await api(`/api/groups/${id}`, { method: 'DELETE' });
    load();
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin h-8 w-8 border-4 rounded-full" style={{ borderColor: 'var(--primary)', borderTopColor: 'transparent' }} /></div>;
  if (error) return <div className="flex flex-col items-center justify-center h-64 gap-4"><p style={{ color: '#dc2626' }}>{error}</p><button onClick={load} className="px-4 py-2 bg-blue-600 text-white rounded-xl text-sm">إعادة المحاولة</button></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>المجموعات</h1>
        <button onClick={() => setModal(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium">+ إضافة مجموعة</button>
      </div>

      <div className="rounded-2xl p-4" style={{ backgroundColor: 'var(--card)' }}>
        <DataTable
          columns={[
            { key: 'name', label: 'اسم المجموعة' },
            { key: 'course_name', label: 'الكورس' },
            { key: 'student_count', label: 'عدد الطلاب', render: (v: number) => `${v || 0} طالب` },
            { key: 'actions', label: '', render: (_: any, row: any) => (
              <button onClick={() => deleteGroup(row.id)}
                className="text-red-500 text-xs">حذف</button>
            )},
          ]}
          data={groups}
        />
      </div>

      <Modal open={modal} onClose={() => setModal(false)} title="إضافة مجموعة جديدة">
        <div className="space-y-3">
          <input placeholder="اسم المجموعة" value={form.name}
            onChange={e => setForm({ ...form, name: e.target.value })}
            className="w-full px-4 py-2.5 rounded-xl border text-sm" style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }} />
          <select value={form.course_id} onChange={e => setForm({ ...form, course_id: e.target.value })}
            className="w-full px-4 py-2.5 rounded-xl border text-sm" style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }}>
            <option value="">اختر الكورس</option>
            {courses.map((c: any) => <option key={c.id} value={c.id}>{c.title_ar}</option>)}
          </select>
          <input placeholder="الموعد (مثال: السبت 7-9 م)" value={form.schedule}
            onChange={e => setForm({ ...form, schedule: e.target.value })}
            className="w-full px-4 py-2.5 rounded-xl border text-sm" style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }} />
          <button onClick={save} className="w-full py-3 bg-blue-600 text-white rounded-xl font-medium">حفظ</button>
        </div>
      </Modal>
    </div>
  );
}
