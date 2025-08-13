'use client';

import { useEffect, useMemo, useState } from 'react';
import { getBrowserSupabaseClient } from '@/lib/supabaseClient';
import CourseFormModal, { Course } from '@/components/CourseFormModal';
import { useToast } from '@/components/ToastProvider';
import CourseDetailModal from '@/components/CourseDetailModal';

type CourseWithCreator = Course & { creator_name?: string };

export default function CoursesManagePage() {
  const supabase = getBrowserSupabaseClient();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [courses, setCourses] = useState<CourseWithCreator[]>([]);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Course | null>(null);
  const [detail, setDetail] = useState<Course | null>(null);
  const [page, setPage] = useState(1);
  const pageSize = 8;
  const [filterMode, setFilterMode] = useState<'mine' | 'public'>('mine');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return courses;
    return courses.filter((c) => c.name.toLowerCase().includes(q) || (c.description ?? '').toLowerCase().includes(q));
  }, [courses, query]);

  const paged = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));

  const toPublicUrl = (cover: string | null) => {
    if (!cover) return null;
    if (cover.startsWith('http')) return cover;
    return supabase.storage.from('course-covers').getPublicUrl(cover).data.publicUrl;
  };

  const fetchCourses = async () => {
    setLoading(true);
    const { data: userData } = await supabase.auth.getUser();
    const uid = userData.user?.id ?? null;

    let queryBuilder = supabase
      .from('courses')
      .select('course_id, name, description, is_public, cover_image_url, creator_id, course_updated_at')
      .order('course_updated_at', { ascending: false });

    if (filterMode === 'mine') {
      if (uid) queryBuilder = queryBuilder.eq('creator_id', uid);
      else queryBuilder = queryBuilder.eq('creator_id', '00000000-0000-0000-0000-000000000000');
    } else if (filterMode === 'public') {
      queryBuilder = queryBuilder.eq('is_public', true);
    }

    const { data, error } = await queryBuilder;
    if (error) {
      showToast(error.message, { type: 'error' });
    } else {
      const list = (data as any as CourseWithCreator[]) ?? [];
      // fetch creator names
      const creatorIds = Array.from(new Set(list.map((c) => c.creator_id).filter(Boolean)));
      if (creatorIds.length > 0) {
        const { data: creators } = await supabase
          .from('users')
          .select('user_id, full_name')
          .in('user_id', creatorIds);
        const map = new Map<string, string>();
        creators?.forEach((u: any) => map.set(u.user_id, u.full_name));
        list.forEach((c) => (c.creator_name = map.get(c.creator_id) ?? ''));
      }
      setCourses(list);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchCourses();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterMode]);

  const onDelete = async (course: Course) => {
    if (!confirm(`Xóa khóa học "${course.name}"?`)) return;
    const { error } = await supabase.from('courses').delete().eq('course_id', course.course_id);
    if (error) return showToast(error.message, { type: 'error' });
    showToast('Đã xóa khóa học', { type: 'success' });
    fetchCourses();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Quản lý khóa học</h1>
        <button onClick={() => { setEditing(null); setOpen(true); }} className="rounded bg-black text-white dark:bg-white dark:text-black px-4 py-2 text-sm">Tạo khóa học</button>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <input
          placeholder="Tìm kiếm khóa học..."
          value={query}
          onChange={(e) => { setQuery(e.target.value); setPage(1); }}
          className="w-full rounded-md border px-3 py-2 bg-transparent"
        />
        <select
          value={filterMode}
          onChange={(e) => { setFilterMode(e.target.value as 'mine' | 'public'); setPage(1); }}
          className="rounded-md border px-3 py-2 bg-transparent sm:w-60"
          title="Chế độ hiển thị"
        >
          <option value="mine">Chỉ khóa học của tôi</option>
          <option value="public">Tất cả khóa học công khai</option>
        </select>
      </div>

      {/* Responsive card grid for all screens */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
        {loading ? (
          <div className="p-4 col-span-full">Đang tải…</div>
        ) : paged.length === 0 ? (
          <div className="p-4 col-span-full">Không có khóa học.</div>
        ) : (
          paged.map((c) => {
            const url = toPublicUrl(c.cover_image_url as any);
            return (
              <div key={c.course_id} className="rounded-lg border overflow-hidden flex flex-col transition transform hover:-translate-y-1 hover:shadow-lg">
                <div className="w-full bg-neutral-100 dark:bg-neutral-900">
                  {url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={url} alt="cover" className="w-full h-28 object-cover" />
                  ) : (
                    <div className="w-full h-28" />
                  )}
                </div>
                <div className="p-3 flex-1 flex flex-col min-w-0">
                  <div className="font-semibold truncate" title={c.name}>{c.name}</div>
                  <div className="text-sm text-neutral-600 dark:text-neutral-300 truncate" title={c.description ?? ''}>{c.description ?? '-'}</div>
                  <div className="text-xs text-neutral-500 truncate" title={c.creator_name || ''}>{c.creator_name ? `Người tạo: ${c.creator_name}` : ''}</div>
                  <div className="mt-2 text-xs flex items-center justify-between">
                    <span>{c.is_public ? '🌐 Công khai' : '🔒 Riêng tư'}</span>
                    <span className="whitespace-nowrap">{c.course_updated_at ? new Date(c.course_updated_at).toLocaleDateString() : '-'}</span>
                  </div>
                  <div className="mt-3 space-x-2">
                    <button onClick={() => setDetail(c)} className="border rounded px-3 py-2 text-sm w-full text-center">Xem chi tiết</button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="flex items-center justify-between text-sm">
        <div>Trang {page}/{totalPages}</div>
        <div className="space-x-2">
          <button disabled={page === 1} onClick={() => setPage((p) => Math.max(1, p - 1))} className="border rounded px-3 py-2 disabled:opacity-50">Trước</button>
          <button disabled={page === totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))} className="border rounded px-3 py-2 disabled:opacity-50">Sau</button>
        </div>
      </div>

      <CourseFormModal open={open} onClose={() => setOpen(false)} onSaved={fetchCourses} editing={editing} />
      <CourseDetailModal open={!!detail} onClose={() => setDetail(null)} onSaved={fetchCourses} course={detail} />
    </div>
  );
} 