'use client';

import { useEffect, useMemo, useState } from 'react';
import { getBrowserSupabaseClient } from '@/lib/supabaseClient';
import { useToast } from '@/components/ToastProvider';

export type Course = {
  course_id: string;
  name: string;
  description: string | null;
  is_public: boolean;
  cover_image_url: string | null; // may store path or full URL
  creator_id: string;
  course_updated_at?: string;
};

export default function CourseFormModal({
  open,
  onClose,
  onSaved,
  editing,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  editing?: Course | null;
}) {
  const supabase = getBrowserSupabaseClient();
  const { showToast } = useToast();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [coverPath, setCoverPath] = useState<string | null>(null); // store storage path
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (editing) {
      setName(editing.name);
      setDescription(editing.description ?? '');
      setIsPublic(editing.is_public);
      // try to normalize to path
      const val = editing.cover_image_url ?? null;
      if (val && val.startsWith('http')) {
        const idx = val.indexOf('/course-covers/');
        setCoverPath(idx >= 0 ? val.substring(idx + '/course-covers/'.length) : val);
      } else {
        setCoverPath(val);
      }
    } else {
      setName('');
      setDescription('');
      setIsPublic(true);
      setCoverPath(null);
    }
  }, [editing, open]);

  const previewUrl = useMemo(() => {
    if (!coverPath) return null;
    if (coverPath.startsWith('http')) return coverPath;
    return supabase.storage.from('course-covers').getPublicUrl(coverPath).data.publicUrl;
  }, [coverPath, supabase]);

  if (!open) return null;

  const uploadCover = async (file: File) => {
    const ext = file.name.split('.').pop();
    const fileName = `${crypto.randomUUID()}.${ext}`; // storage path
    const { error } = await supabase.storage.from('course-covers').upload(fileName, file, {
      cacheControl: '3600',
      upsert: false,
    });
    if (error) throw error;
    return fileName;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      if (!userId) throw new Error('Không tìm thấy người dùng.');

      if (editing) {
        const { error } = await supabase
          .from('courses')
          .update({ name, description, is_public: isPublic, cover_image_url: coverPath, creator_id: userId, course_updated_at: new Date().toISOString() })
          .eq('course_id', editing.course_id);
        if (error) throw error;
        showToast('Đã cập nhật khóa học', { type: 'success' });
      } else {
        const { error } = await supabase.from('courses').insert([
          {
            name,
            description: description || null,
            is_public: isPublic,
            cover_image_url: coverPath,
            creator_id: userId,
          },
        ]);
        if (error) throw error;
        showToast('Đã tạo khóa học', { type: 'success' });
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
    <div className="fixed inset-0 z-[1000] bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="w-full max-w-xl rounded-lg border bg-background p-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">{editing ? 'Sửa khóa học' : 'Tạo khóa học'}</h2>
          <button onClick={onClose} className="text-sm border rounded px-2 py-1">Đóng</button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium">Tên khóa học</label>
            <input value={name} onChange={(e) => setName(e.target.value)} required className="w-full rounded-md border px-3 py-2 bg-transparent" />
          </div>
          <div>
            <label className="block text-sm font-medium">Mô tả</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className="w-full rounded-md border px-3 py-2 bg-transparent" />
          </div>
          <div className="flex items-center gap-2">
            <input id="public" type="checkbox" checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)} />
            <label htmlFor="public" className="text-sm">Công khai</label>
          </div>
          <div className="space-y-2">
            <label className="block text-sm font-medium">Ảnh bìa</label>
            {previewUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={previewUrl} alt="cover" className="h-28 w-full object-cover rounded" />
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
        <p className="text-xs text-neutral-500 mt-2">Gợi ý: Tạo bucket Storage tên "course-covers" và bật Public để hiển thị ảnh bìa.</p>
      </div>
    </div>
  );
} 