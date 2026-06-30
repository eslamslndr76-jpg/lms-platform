'use client';

import { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import DataTable from '../../components/DataTable';
import Modal from '../../components/Modal';
import ConfirmDialog from '../../components/ConfirmDialog';
import Skeleton from '../../components/Skeleton';
import StatusBadge from '../../components/StatusBadge';
import { compressAndEncode } from '../../lib/imageUtils';
import { useToast } from '../../components/Toast';

export default function CoursesPage() {
  const { toast } = useToast();
  const [courses, setCourses] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [addModal, setAddModal] = useState(false);
  const [addForm, setAddForm] = useState({ title_ar: '', title_en: '', description: '', price: 0, category_id: '', image_url: '', max_students: 30, lecture_count: 0, lecture_duration: 0, instructor: '', course_mode: 'online' });

  const [detailModal, setDetailModal] = useState(false);
  const [selectedCourse, setSelectedCourse] = useState<any>(null);
  const [courseStudents, setCourseStudents] = useState<any[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);

  const [editModal, setEditModal] = useState(false);
  const [editForm, setEditForm] = useState<any>({});
  const [editingId, setEditingId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  const [confirmToggle, setConfirmToggle] = useState<any>(null);
  const [confirmDelete, setConfirmDelete] = useState<any>(null);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const c = await api('/api/courses');
      setCourses(c);
    } catch {
      setError('فشل تحميل الكورسات');
      setLoading(false);
      return;
    }
    try {
      const cats = await api('/api/categories');
      setCategories(cats);
    } catch { /* categories optional */ }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const addCourse = async () => {
    try {
      await api('/api/courses', {
        method: 'POST',
        body: JSON.stringify({ ...addForm, category_id: addForm.category_id ? Number(addForm.category_id) : null }),
      });
      setAddModal(false);
      setAddForm({ title_ar: '', title_en: '', description: '', price: 0, category_id: '', image_url: '', max_students: 30, lecture_count: 0, lecture_duration: 0, instructor: '', course_mode: 'online' });
      toast('تم إضافة الكورس', 'success');
      load();
    } catch {
      toast('فشل إضافة الكورس', 'error');
    }
  };

  const openDetail = async (course: any) => {
    setSelectedCourse(course);
    setDetailModal(true);
    setDetailLoading(true);
    try {
      const c = await api(`/api/courses/${course.id}`);
      setSelectedCourse(c);
      const o = await api(`/api/admin/orders?courseId=${course.id}`);
      setCourseStudents(o.orders || []);
    } catch {
      toast('فشل تحميل التفاصيل', 'error');
      setCourseStudents([]);
    }
    setDetailLoading(false);
  };

  const startEdit = async (course: any) => {
    setEditingId(course.id);
    setSaving(true);
    try {
      const c = await api(`/api/courses/${course.id}`);
      setEditForm({
        title_ar: c.title_ar, title_en: c.title_en, description: c.description || '',
        price: c.price, category_id: c.category_id?.toString() || '',
        image_url: c.image_url || '', max_students: c.max_students,
        lecture_count: c.lecture_count || 0, lecture_duration: c.lecture_duration || 0,
        instructor: c.instructor || '', materials_url: c.materials_url || '',
        course_mode: c.course_mode || 'online',
      });
      setEditModal(true);
    } catch {
      toast('فشل تحميل بيانات الكورس', 'error');
    }
    setSaving(false);
  };

  const saveEdit = async () => {
    if (!editingId) return;
    setSaving(true);
    try {
      await api(`/api/courses/${editingId}`, {
        method: 'PUT',
        body: JSON.stringify({ ...editForm, category_id: editForm.category_id ? Number(editForm.category_id) : null }),
      });
      setEditModal(false);
      setEditingId(null);
      toast('تم حفظ التعديلات', 'success');
      if (detailModal) {
        const c = await api(`/api/courses/${editingId}`);
        setSelectedCourse(c);
      }
      load();
    } catch {
      toast('فشل حفظ التعديلات', 'error');
    }
    setSaving(false);
  };

  const toggleActive = async () => {
    if (!confirmToggle) return;
    try {
      await api(`/api/courses/${confirmToggle.id}`, {
        method: 'PUT',
        body: JSON.stringify({ is_active: Number(confirmToggle.is_active) ? 0 : 1 }),
      });
      toast(Number(confirmToggle.is_active) ? 'تم تعطيل الكورس' : 'تم تفعيل الكورس', 'success');
      setConfirmToggle(null);
      load();
    } catch {
      toast('فشل تحديث حالة الكورس', 'error');
    }
  };

  const deleteCourse = async () => {
    if (!confirmDelete) return;
    try {
      await api(`/api/courses/${confirmDelete.id}`, { method: 'DELETE' });
      toast('تم حذف الكورس نهائياً', 'success');
      setConfirmDelete(null);
      setDetailModal(false);
      load();
    } catch {
      toast('فشل حذف الكورس', 'error');
    }
  };

  if (loading) return <div className="space-y-4"><div className="flex items-center justify-between"><h1 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>الكورسات</h1></div><div className="rounded-2xl p-4 border" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}><Skeleton rows={6} cols={7} /></div></div>;
  if (error) return <div className="flex flex-col items-center justify-center h-64 gap-4"><p style={{ color: '#dc2626' }}>{error}</p><button onClick={load} className="px-4 py-2 bg-[var(--primary)] text-white rounded-xl text-sm">إعادة المحاولة</button></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>الكورسات</h1>
        <button onClick={() => setAddModal(true)} className="px-4 py-2 bg-[var(--primary)] text-white rounded-xl text-sm font-medium">
          + إضافة كورس
        </button>
      </div>

      <div className="rounded-2xl p-4" style={{ backgroundColor: 'var(--card)' }}>
        <DataTable
          columns={[
            { key: 'id', label: '#' },
            { key: 'title_ar', label: 'الاسم (عربي)' },
            { key: 'title_en', label: 'English' },
            { key: 'category_name_ar', label: 'التصنيف', render: (v: string) => v || '-' },
            { key: 'price', label: 'السعر', render: (v: number) => `${v} ج.م` },
            { key: 'course_mode', label: 'النوع', render: (v: string) => v === 'offline' ? '🏫 حضوري' : '💻 أونلاين' },
            { key: 'is_active', label: 'الحالة', render: (v: any) => Number(v) ? '🟢 نشط' : '🔴 غير نشط' },
            { key: 'actions', label: 'الإجراءات',
              render: (_: any, row: any) => (
                <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                  <button onClick={() => startEdit(row)}
                    className="px-2 py-1 rounded-lg text-xs font-medium bg-blue-50 text-blue-600 hover:bg-blue-100">تعديل</button>
                  <button onClick={() => setConfirmToggle(row)}
                    className="px-2 py-1 rounded-lg text-xs font-medium"
                    style={{ backgroundColor: Number(row.is_active) ? '#fef2f2' : '#f0fdf4', color: Number(row.is_active) ? '#dc2626' : '#16a34a' }}>
                    {Number(row.is_active) ? 'تعطيل' : 'تفعيل'}
                  </button>
                  <button onClick={() => setConfirmDelete(row)}
                    className="px-2 py-1 rounded-lg text-xs font-medium bg-red-50 text-red-600 hover:bg-red-100">حذف</button>
                </div>
              )
            },
          ]}
          data={courses}
          onRowClick={openDetail}
        />
      </div>

      <Modal open={addModal} onClose={() => setAddModal(false)} title="إضافة كورس جديد" size="lg">
        <div className="space-y-3 max-h-[70vh] overflow-y-auto">
          <div>
            <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>اسم الكورس بالعربية</label>
            <input placeholder="مثال: أساسيات البرمجة" value={addForm.title_ar}
              onChange={e => setAddForm({ ...addForm, title_ar: e.target.value })}
              className="w-full px-4 py-2.5 rounded-xl border text-sm" style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }} />
          </div>
          <div>
            <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Course name in English</label>
            <input placeholder="e.g. Programming Basics" value={addForm.title_en}
              onChange={e => setAddForm({ ...addForm, title_en: e.target.value })}
              className="w-full px-4 py-2.5 rounded-xl border text-sm" style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }} />
          </div>
          <div>
            <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>وصف الكورس</label>
            <textarea placeholder="ماذا سيتعلم الطالب في هذا الكورس؟ المحتوى الرئيسي والأهداف" value={addForm.description}
              onChange={e => setAddForm({ ...addForm, description: e.target.value })}
              className="w-full px-4 py-2.5 rounded-xl border text-sm h-20" style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }} />
          </div>
          <div>
            <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>سعر الكورس (0 = مجاني)</label>
            <input type="number" placeholder="مثال: 500" value={addForm.price}
              onChange={e => setAddForm({ ...addForm, price: Number(e.target.value) })}
              className="w-full px-4 py-2.5 rounded-xl border text-sm" style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }} />
          </div>
          <div>
            <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>التصنيف</label>
            <select value={addForm.category_id} onChange={e => setAddForm({ ...addForm, category_id: e.target.value })}
              className="w-full px-4 py-2.5 rounded-xl border text-sm" style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }}>
              <option value="">اختر تصنيف (اختياري)</option>
              {categories.map((c: any) => <option key={c.id} value={c.id}>{c.name_ar}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>عدد المحاضرات</label>
            <input type="number" placeholder="مثال: 24" value={addForm.lecture_count}
              onChange={e => setAddForm({ ...addForm, lecture_count: Number(e.target.value) })}
              className="w-full px-4 py-2.5 rounded-xl border text-sm" style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }} />
          </div>
          <div>
            <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>مدة المحاضرة (ساعة)</label>
            <input type="number" step="0.5" placeholder="مثال: 1.5" value={addForm.lecture_duration}
              onChange={e => setAddForm({ ...addForm, lecture_duration: Number(e.target.value) })}
              className="w-full px-4 py-2.5 rounded-xl border text-sm" style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }} />
          </div>
          <div>
            <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>اسم المدرب</label>
            <input placeholder="مثال: أ. محمد أحمد" value={addForm.instructor}
              onChange={e => setAddForm({ ...addForm, instructor: e.target.value })}
              className="w-full px-4 py-2.5 rounded-xl border text-sm" style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }} />
          </div>
          <div>
            <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>نوع الكورس</label>
            <select value={addForm.course_mode} onChange={e => setAddForm({ ...addForm, course_mode: e.target.value })}
              className="w-full px-4 py-2.5 rounded-xl border text-sm" style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }}>
              <option value="online">أونلاين</option>
              <option value="offline">أوفلاين (حضوري)</option>
            </select>
          </div>
          <div>
            <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>صورة الكورس</label>
            <input type="file" accept="image/*"
              onChange={async e => {
                const file = e.target.files?.[0];
                if (file) {
                  const dataUrl = await compressAndEncode(file);
                  setAddForm({ ...addForm, image_url: dataUrl });
                }
              }}
              className="w-full text-sm" style={{ color: 'var(--text)' }} />
            {addForm.image_url && (
              <div className="relative mt-2 inline-block">
                <img src={addForm.image_url} alt="Preview" className="h-20 rounded-xl object-cover" />
                <button onClick={() => setAddForm({ ...addForm, image_url: '' })} className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full text-xs">✕</button>
              </div>
            )}
          </div>
          <button onClick={addCourse} className="w-full py-3 bg-[var(--primary)] text-white rounded-xl font-medium">حفظ</button>
        </div>
      </Modal>

      <Modal open={detailModal} onClose={() => { setDetailModal(false); setSelectedCourse(null); }} title={selectedCourse?.title_ar || 'تفاصيل الكورس'} size="lg">
        {detailLoading ? (
          <div className="space-y-4"><Skeleton rows={4} cols={3} /><Skeleton rows={3} cols={1} /></div>
        ) : selectedCourse && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="p-3 rounded-xl" style={{ backgroundColor: 'var(--bg)' }}>
                <span className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>الاسم بالعربية</span>
                <span style={{ color: 'var(--text)' }}>{selectedCourse.title_ar}</span>
              </div>
              <div className="p-3 rounded-xl" style={{ backgroundColor: 'var(--bg)' }}>
                <span className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>English</span>
                <span style={{ color: 'var(--text)' }}>{selectedCourse.title_en}</span>
              </div>
              <div className="p-3 rounded-xl" style={{ backgroundColor: 'var(--bg)' }}>
                <span className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>السعر</span>
                <span style={{ color: 'var(--text)' }}>{selectedCourse.price > 0 ? `${selectedCourse.price} ج.م` : 'مجاني'}</span>
              </div>
              <div className="p-3 rounded-xl" style={{ backgroundColor: 'var(--bg)' }}>
                <span className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>التصنيف</span>
                <span style={{ color: 'var(--text)' }}>{selectedCourse.category_name_ar || '-'}</span>
              </div>
              <div className="p-3 rounded-xl" style={{ backgroundColor: 'var(--bg)' }}>
                <span className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>النوع</span>
                <span style={{ color: 'var(--text)' }}>{selectedCourse.course_mode === 'offline' ? '🏫 حضوري' : '💻 أونلاين'}</span>
              </div>
              <div className="p-3 rounded-xl" style={{ backgroundColor: 'var(--bg)' }}>
                <span className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>الحالة</span>
                <span>{Number(selectedCourse.is_active) ? '🟢 نشط' : '🔴 غير نشط'}</span>
              </div>
              {selectedCourse.lecture_count > 0 && (
                <div className="p-3 rounded-xl" style={{ backgroundColor: 'var(--bg)' }}>
                  <span className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>عدد المحاضرات</span>
                  <span style={{ color: 'var(--text)' }}>{selectedCourse.lecture_count}</span>
                </div>
              )}
              {selectedCourse.lecture_duration > 0 && (
                <div className="p-3 rounded-xl" style={{ backgroundColor: 'var(--bg)' }}>
                  <span className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>مدة المحاضرة</span>
                  <span style={{ color: 'var(--text)' }}>{selectedCourse.lecture_duration} ساعة</span>
                </div>
              )}
              {selectedCourse.max_students && (
                <div className="p-3 rounded-xl" style={{ backgroundColor: 'var(--bg)' }}>
                  <span className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>الحد الأقصى</span>
                  <span style={{ color: 'var(--text)' }}>{selectedCourse.max_students} طالب</span>
                </div>
              )}
              {selectedCourse.instructor && (
                <div className="p-3 rounded-xl" style={{ backgroundColor: 'var(--bg)' }}>
                  <span className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>المدرب</span>
                  <span style={{ color: 'var(--text)' }}>{selectedCourse.instructor}</span>
                </div>
              )}
              {selectedCourse.image_url && (
                <div className="p-3 rounded-xl col-span-2">
                  <img src={selectedCourse.image_url} alt={selectedCourse.title_ar} className="h-32 rounded-xl object-cover" />
                </div>
              )}
            </div>
            {selectedCourse.description && (
              <div className="p-3 rounded-xl" style={{ backgroundColor: 'var(--bg)' }}>
                <span className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>الوصف</span>
                <p className="text-sm leading-relaxed" style={{ color: 'var(--text)' }}>{selectedCourse.description}</p>
              </div>
            )}

            <div className="rounded-xl p-3" style={{ backgroundColor: 'var(--bg)' }}>
              <h4 className="font-bold text-sm mb-2" style={{ color: 'var(--text)' }}>الطلاب المسجلين ({courseStudents.length})</h4>
              {courseStudents.length === 0 ? (
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>لا يوجد طلاب مسجلين</p>
              ) : (
                <div className="max-h-40 overflow-y-auto space-y-1">
                  {courseStudents.map((o: any) => (
                    <div key={o.id} className="flex items-center justify-between p-2 rounded-lg text-xs" style={{ backgroundColor: 'var(--card)' }}>
                      <span style={{ color: 'var(--text)' }}>{o.student_name}</span>
                      <div className="flex items-center gap-2">
                        <span style={{ color: 'var(--text-muted)' }}>{o.amount} ج.م</span>
                        <StatusBadge status={o.status} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex gap-2 pt-2 border-t" style={{ borderColor: 'var(--border)' }}>
              <button onClick={() => { setDetailModal(false); setTimeout(() => startEdit(selectedCourse), 100); }} className="flex-1 py-2.5 rounded-xl text-sm font-medium text-white" style={{ backgroundColor: 'var(--primary)' }}>✏️ تعديل</button>
              <button onClick={() => { setDetailModal(false); setConfirmDelete(selectedCourse); }} className="px-3 py-2.5 rounded-xl text-sm font-medium text-white" style={{ backgroundColor: '#dc2626' }}>🗑️ حذف</button>
            </div>
          </div>
        )}
      </Modal>

      <Modal open={editModal} onClose={() => setEditModal(false)} title={`تعديل: ${editForm.title_ar || ''}`} size="lg">
        <div className="space-y-3 max-h-[70vh] overflow-y-auto">
          <div>
            <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>اسم الكورس بالعربية</label>
            <input value={editForm.title_ar} onChange={e => setEditForm({ ...editForm, title_ar: e.target.value })}
              className="w-full px-4 py-2.5 rounded-xl border text-sm" style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }} />
          </div>
          <div>
            <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Course name in English</label>
            <input value={editForm.title_en} onChange={e => setEditForm({ ...editForm, title_en: e.target.value })}
              className="w-full px-4 py-2.5 rounded-xl border text-sm" style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }} />
          </div>
          <div>
            <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>وصف الكورس</label>
            <textarea value={editForm.description} onChange={e => setEditForm({ ...editForm, description: e.target.value })}
              className="w-full px-4 py-2.5 rounded-xl border text-sm h-20" style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }} />
          </div>
          <div>
            <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>سعر الكورس (0 = مجاني)</label>
            <input type="number" value={editForm.price} onChange={e => setEditForm({ ...editForm, price: Number(e.target.value) })}
              className="w-full px-4 py-2.5 rounded-xl border text-sm" style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }} />
          </div>
          <div>
            <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>التصنيف</label>
            <select value={editForm.category_id} onChange={e => setEditForm({ ...editForm, category_id: e.target.value })}
              className="w-full px-4 py-2.5 rounded-xl border text-sm" style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }}>
              <option value="">اختر تصنيف (اختياري)</option>
              {categories.map((c: any) => <option key={c.id} value={c.id}>{c.name_ar}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>عدد المحاضرات</label>
            <input type="number" value={editForm.lecture_count} onChange={e => setEditForm({ ...editForm, lecture_count: Number(e.target.value) })}
              className="w-full px-4 py-2.5 rounded-xl border text-sm" style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }} />
          </div>
          <div>
            <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>مدة المحاضرة (ساعة)</label>
            <input type="number" step="0.5" value={editForm.lecture_duration} onChange={e => setEditForm({ ...editForm, lecture_duration: Number(e.target.value) })}
              className="w-full px-4 py-2.5 rounded-xl border text-sm" style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }} />
          </div>
          <div>
            <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>اسم المدرب</label>
            <input value={editForm.instructor} onChange={e => setEditForm({ ...editForm, instructor: e.target.value })}
              className="w-full px-4 py-2.5 rounded-xl border text-sm" style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }} />
          </div>
          <div>
            <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>الحد الأقصى للطلاب</label>
            <input type="number" value={editForm.max_students} onChange={e => setEditForm({ ...editForm, max_students: Number(e.target.value) })}
              className="w-full px-4 py-2.5 rounded-xl border text-sm" style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }} />
          </div>
          <div>
            <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>نوع الكورس</label>
            <select value={editForm.course_mode} onChange={e => setEditForm({ ...editForm, course_mode: e.target.value })}
              className="w-full px-4 py-2.5 rounded-xl border text-sm" style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }}>
              <option value="online">أونلاين</option>
              <option value="offline">أوفلاين (حضوري)</option>
            </select>
          </div>
          <div>
            <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>صورة الكورس</label>
            <input type="file" accept="image/*"
              onChange={async e => {
                const file = e.target.files?.[0];
                if (file) {
                  const dataUrl = await compressAndEncode(file);
                  setEditForm({ ...editForm, image_url: dataUrl });
                }
              }}
              className="w-full text-sm" style={{ color: 'var(--text)' }} />
            {editForm.image_url && (
              <div className="relative mt-2 inline-block">
                <img src={editForm.image_url} alt="Preview" className="h-20 rounded-xl object-cover" />
                <button onClick={() => setEditForm({ ...editForm, image_url: '' })} className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full text-xs">✕</button>
              </div>
            )}
          </div>
          <button onClick={saveEdit} disabled={saving}
            className="w-full py-3 rounded-xl text-white font-medium disabled:opacity-50"
            style={{ backgroundColor: 'var(--primary)' }}>
            {saving ? 'جاري الحفظ...' : 'حفظ التعديلات'}
          </button>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!confirmToggle}
        title={Number(confirmToggle?.is_active) ? 'تعطيل الكورس' : 'تفعيل الكورس'}
        message={Number(confirmToggle?.is_active) ? `تعطيل "${confirmToggle?.title_ar}"؟ سيختفي من واجهة المستخدمين.` : `تفعيل "${confirmToggle?.title_ar}"؟`}
        confirmLabel={Number(confirmToggle?.is_active) ? 'تعطيل' : 'تفعيل'}
        variant={Number(confirmToggle?.is_active) ? 'warning' : 'info'}
        onConfirm={toggleActive}
        onCancel={() => setConfirmToggle(null)}
      />

      <ConfirmDialog
        open={!!confirmDelete}
        title="حذف الكورس"
        message={`حذف "${confirmDelete?.title_ar}" نهائياً؟ سيتم حذف جميع المجموعات والطلبات والشهادات المرتبطة به.`}
        confirmLabel="حذف"
        variant="danger"
        onConfirm={deleteCourse}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  );
}