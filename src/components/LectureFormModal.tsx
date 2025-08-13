'use client';

import { useEffect, useMemo, useState } from 'react';
import { getBrowserSupabaseClient } from '@/lib/supabaseClient';
import { useToast } from '@/components/ToastProvider';

export type Lecture = {
  lecture_id: string;
  course_id: string;
  title: string;
  order_index: number | null;
  cover_image_url: string | null;
  lecture_revised_at?: string;
  course?: { course_id: string; name: string; creator_id: string; is_public?: boolean };
};

export default function LectureFormModal({
  open,
  onClose,
  onSaved,
  editing,
  initialCourseId,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  editing?: Lecture | null;
  initialCourseId?: string | null;
}) {
  const supabase = getBrowserSupabaseClient();
  const { showToast } = useToast();

  const [courses, setCourses] = useState<Array<{ course_id: string; name: string; creator_id: string }>>([]);
  const [courseId, setCourseId] = useState<string>('');
  const [title, setTitle] = useState('');
  const [orderIndex, setOrderIndex] = useState<string>('');
  const [coverPath, setCoverPath] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      // Load only my courses for selection
      const { data } = await supabase
        .from('courses')
        .select('course_id,name,creator_id')
        .eq('creator_id', uid);
      setCourses((data as any) ?? []);
    })();
  }, [supabase]);

  useEffect(() => {
    if (editing) {
      setCourseId(editing.course_id);
      setTitle(editing.title);
      setOrderIndex(editing.order_index != null ? String(editing.order_index) : '');
      const v = editing.cover_image_url ?? null;
      if (v && v.startsWith('http')) {
        const idx = v.indexOf('/lecture-covers/');
        setCoverPath(idx >= 0 ? v.substring(idx + '/lecture-covers/'.length) : v);
      } else {
        setCoverPath(v);
      }
    } else {
      setCourseId(initialCourseId ?? '');
      setTitle('');
      setOrderIndex('');
      setCoverPath(null);
    }
  }, [editing, open, initialCourseId]);

  const previewUrl = useMemo(() => {
    if (!coverPath) return null;
    if (coverPath.startsWith('http')) return coverPath;
    return supabase.storage.from('lecture-covers').getPublicUrl(coverPath).data.publicUrl;
  }, [coverPath, supabase]);

  if (!open) return null;

  const uploadCover = async (file: File) => {
    const ext = file.name.split('.').pop();
    const fileName = `${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from('lecture-covers').upload(fileName, file, { cacheControl: '3600', upsert: false });
    if (error) throw error;
    return fileName;
  };

  const getNextOrderIndex = async (cid: string) => {
    const { data, error } = await supabase
      .from('lectures')
      .select('order_index')
      .eq('course_id', cid)
      .order('order_index', { ascending: false })
      .limit(1);
    if (error || !data || data.length === 0) return 0;
    const max = data[0].order_index ?? 0;
    return (max as number) + 1;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      if (!courseId) throw new Error('Vui lòng chọn khóa học');
      const idx = orderIndex.trim() === '' ? await getNextOrderIndex(courseId) : parseInt(orderIndex, 10);
      if (Number.isNaN(idx) || idx < 0) throw new Error('Thứ tự phải là số không âm');

      if (editing) {
        const { error } = await supabase
          .from('lectures')
          .update({ course_id: courseId, title, order_index: idx, cover_image_url: coverPath, lecture_revised_at: new Date().toISOString() })
          .eq('lecture_id', editing.lecture_id);
        if (error) throw error;
        showToast('Đã lưu bài giảng', { type: 'success' });
      } else {
        const { error } = await supabase.from('lectures').insert([
          { course_id: courseId, title, order_index: idx, cover_image_url: coverPath },
        ]);
        if (error) throw error;
        showToast('Đã tạo bài giảng', { type: 'success' });
      }
      onSaved();
      onClose();
    } catch (err: any) {
      showToast(err.message ?? 'Có lỗi xảy ra', { type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[1200] bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-lg border bg-background p-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">{editing ? 'Sửa bài giảng' : 'Tạo bài giảng'}</h2>
          <button onClick={onClose} className="text-sm border rounded px-2 py-1">Đóng</button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium">Thuộc khóa học</label>
            <select value={courseId} onChange={(e) => setCourseId(e.target.value)} className="w-full rounded-md border px-3 py-2 bg-transparent">
              <option value="">-- Chọn khóa học --</option>
              {courses.map((c) => (
                <option key={c.course_id} value={c.course_id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium">Tiêu đề</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} required className="w-full rounded-md border px-3 py-2 bg-transparent" />
          </div>
          <div>
            <label className="block text-sm font-medium">Thứ tự (để trống sẽ tự động)</label>
            <input value={orderIndex} onChange={(e) => setOrderIndex(e.target.value)} className="w-full rounded-md border px-3 py-2 bg-transparent" inputMode="numeric" />
          </div>
          <div className="space-y-2">
            <label className="block text-sm font-medium">Ảnh bìa (tùy chọn)</label>
            {previewUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={previewUrl} alt="cover" className="w-full h-36 object-cover rounded" />
            )}
            <input type="file" accept="image/*" onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              try {
                setLoading(true);
                const path = await uploadCover(file);
                setCoverPath(path);
                showToast('Đã tải ảnh bìa', { type: 'success' });
              } catch (err: any) {
                showToast(err.message ?? 'Tải ảnh thất bại', { type: 'error' });
              } finally {
                setLoading(false);
              }
            }} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="border rounded px-4 py-2 text-sm">Hủy</button>
            <button disabled={loading} type="submit" className="rounded bg-black text-white dark:bg-white dark:text-black px-4 py-2 text-sm">
              {loading ? 'Đang lưu…' : editing ? 'Lưu' : 'Tạo'}
            </button>
          </div>
        </form>
        <p className="text-xs text-neutral-500 mt-2">Gợi ý: Tạo bucket Storage tên "lecture-covers" (Public) để hiển thị ảnh bìa.</p>
      </div>
    </div>
  );
}
