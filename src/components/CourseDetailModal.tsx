'use client';

import { useEffect, useMemo, useState } from 'react';
import { getBrowserSupabaseClient } from '@/lib/supabaseClient';
import { useToast } from '@/components/ToastProvider';
import type { Course } from '@/components/CourseFormModal';

export default function CourseDetailModal({
  open,
  onClose,
  onSaved,
  course,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  course: Course | null;
}) {
  const supabase = getBrowserSupabaseClient();
  const { showToast } = useToast();
  const [uid, setUid] = useState<string | null>(null);
  const [isOwner, setIsOwner] = useState(false);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      const id = data.user?.id ?? null;
      setUid(id);
      setIsOwner(id !== null && course?.creator_id === id);
    })();
  }, [supabase, course]);

  useEffect(() => {
    if (course) {
      setName(course.name);
      setDescription(course.description ?? '');
      setIsPublic(course.is_public);
      setEditing(false);
      setConfirmDelete(false);
    }
  }, [course, open]);

  const coverUrl = useMemo(() => {
    const v = course?.cover_image_url ?? null;
    if (!v) return null;
    if (v.startsWith('http')) return v;
    return supabase.storage.from('course-covers').getPublicUrl(v).data.publicUrl;
  }, [course, supabase]);

  if (!open || !course) return null;

  const handleSave = async () => {
    try {
      const { error } = await supabase
        .from('courses')
        .update({ name, description, is_public: isPublic, course_updated_at: new Date().toISOString() })
        .eq('course_id', course.course_id);
      if (error) throw error;
      showToast('Đã lưu khóa học', { type: 'success' });
      setEditing(false);
      onSaved();
    } catch (err: any) {
      showToast(err.message ?? 'Có lỗi xảy ra', { type: 'error' });
    }
  };

  const handleDelete = async () => {
    try {
      const { error } = await supabase.from('courses').delete().eq('course_id', course.course_id);
      if (error) throw error;
      showToast('Đã xóa khóa học', { type: 'success' });
      onSaved();
      onClose();
    } catch (err: any) {
      showToast(err.message ?? 'Không thể xóa', { type: 'error' });
    }
  };

  return (
    <div className="fixed inset-0 z-[1100] bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-lg border bg-background p-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">Chi tiết khóa học</h2>
          <button onClick={onClose} className="text-sm border rounded px-2 py-1">Đóng</button>
        </div>

        <div className="space-y-3">
          {coverUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={coverUrl} alt="cover" className="w-full h-40 object-cover rounded" />
          )}

          <div>
            <label className="block text-sm font-medium">Tên</label>
            {editing ? (
              <input value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded-md border px-3 py-2 bg-transparent" />
            ) : (
              <div className="text-base">{name}</div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium">Mô tả</label>
            {editing ? (
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className="w-full rounded-md border px-3 py-2 bg-transparent" />
            ) : (
              <div className="text-sm text-neutral-600 dark:text-neutral-300 whitespace-pre-wrap">{description || '-'}</div>
            )}
          </div>

          <div className="flex items-center gap-2">
            {editing ? (
              <label className="inline-flex items-center gap-2 text-sm">
                <input type="checkbox" checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)} />
                Công khai
              </label>
            ) : (
              <span className="text-sm">{isPublic ? '🌐 Công khai' : '🔒 Riêng tư'}</span>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between mt-4">
          {isOwner ? (
            <div className="space-x-2">
              {!editing ? (
                <button onClick={() => setEditing(true)} className="rounded bg-black text-white dark:bg-white dark:text-black px-4 py-2 text-sm">Sửa</button>
              ) : (
                <button onClick={handleSave} className="rounded bg-black text-white dark:bg-white dark:text-black px-4 py-2 text-sm">Lưu</button>
              )}
              <button onClick={() => setConfirmDelete(true)} className="border rounded px-4 py-2 text-sm">Xóa</button>
            </div>
          ) : (
            <div />
          )}
          <button onClick={onClose} className="border rounded px-4 py-2 text-sm">Hủy</button>
        </div>

        {confirmDelete && (
          <div className="fixed inset-0 z-[1150] bg-black/40 flex items-center justify-center p-4">
            <div className="bg-background border rounded p-4 w-full max-w-sm">
              <div className="mb-3">Bạn có chắc muốn xóa khóa học này?</div>
              <div className="flex justify-end gap-2">
                <button onClick={() => setConfirmDelete(false)} className="border rounded px-3 py-1 text-sm">Hủy</button>
                <button onClick={handleDelete} className="rounded bg-black text-white dark:bg-white dark:text-black px-3 py-1 text-sm">Xác nhận</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 