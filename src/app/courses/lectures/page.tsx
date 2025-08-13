'use client';

import { useEffect, useMemo, useState } from 'react';
import { getBrowserSupabaseClient } from '@/lib/supabaseClient';
import { useToast } from '@/components/ToastProvider';
import LectureFormModal, { Lecture } from '@/components/LectureFormModal';
import { useRouter } from 'next/navigation';

export default function LecturesManagePage() {
  const supabase = getBrowserSupabaseClient();
  const { showToast } = useToast();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [lectures, setLectures] = useState<Lecture[]>([]);
  const [courses, setCourses] = useState<Array<{ course_id: string; name: string; creator_id: string }>>([]);
  const [selectedCourse, setSelectedCourse] = useState<string>('');
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Lecture | null>(null);
  const [initialCourseId, setInitialCourseId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return lectures.filter((l) => (selectedCourse ? l.course_id === selectedCourse : true) && (!q || l.title.toLowerCase().includes(q)));
  }, [lectures, query, selectedCourse]);

  const toPublicUrl = (cover: string | null) => {
    if (!cover) return null;
    if (cover.startsWith('http')) return cover;
    return supabase.storage.from('lecture-covers').getPublicUrl(cover).data.publicUrl;
  };

  const loadCourses = async () => {
    const { data: auth } = await supabase.auth.getUser();
    const uid = auth.user?.id;
    const { data } = await supabase
      .from('courses')
      .select('course_id,name,creator_id')
      .eq('creator_id', uid);
    setCourses((data as any) ?? []);
  };

  const fetchLectures = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('lectures')
      .select('lecture_id,course_id,title,order_index,cover_image_url,lecture_revised_at, courses!inner(course_id,creator_id,name)')
      .order('order_index', { ascending: true });
    if (error) {
      showToast(error.message, { type: 'error' });
    } else {
      setLectures((data as any) ?? []);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadCourses();
    fetchLectures();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onDelete = async (lecture: Lecture) => {
    // allow delete only if user owns the parent course
    const parent = courses.find((c) => c.course_id === lecture.course_id);
    const { data: auth } = await supabase.auth.getUser();
    const uid = auth.user?.id;
    if (!parent || parent.creator_id !== uid) return showToast('Bạn không có quyền xóa bài giảng này', { type: 'error' });

    if (!confirm(`Xóa bài giảng "${lecture.title}"?`)) return;
    const { error } = await supabase.from('lectures').delete().eq('lecture_id', lecture.lecture_id);
    if (error) return showToast(error.message, { type: 'error' });
    showToast('Đã xóa bài giảng', { type: 'success' });
    fetchLectures();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Quản lý bài giảng</h1>
        <button onClick={() => { setEditing(null); setInitialCourseId(selectedCourse || null); setOpen(true); }} className="rounded bg-black text-white dark:bg-white dark:text-black px-4 py-2 text-sm">Tạo bài giảng</button>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <input
          placeholder="Tìm bài giảng..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full rounded-md border px-3 py-2 bg-transparent"
        />
        <select
          value={selectedCourse}
          onChange={(e) => setSelectedCourse(e.target.value)}
          className="rounded-md border px-3 py-2 bg-transparent sm:w-60"
        >
          <option value="">Tất cả khóa học</option>
          {courses.map((c) => (
            <option key={c.course_id} value={c.course_id}>{c.name}</option>
          ))}
        </select>
      </div>

      <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {loading ? (
          <div className="p-4 col-span-full">Đang tải…</div>
        ) : filtered.length === 0 ? (
          <div className="p-4 col-span-full">Không có bài giảng.</div>
        ) : (
          filtered.map((l) => {
            const url = toPublicUrl(l.cover_image_url as any);
            const parent = courses.find((c) => c.course_id === l.course_id);
            const canEdit = parent && parent.creator_id;
            return (
              <div key={l.lecture_id} className="rounded-lg border overflow-hidden flex flex-col transition transform hover:-translate-y-1 hover:shadow-lg">
                <div className="w-full bg-neutral-100 dark:bg-neutral-900">
                  {url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={url} alt="cover" className="w-full h-28 object-cover" />
                  ) : (
                    <div className="w-full h-28" />
                  )}
                </div>
                <div className="p-3 flex-1 flex flex-col min-w-0">
                  <div className="font-semibold truncate" title={l.title}>{l.title}</div>
                  <div className="text-xs text-neutral-500">#{l.order_index ?? 0}</div>
                  <div className="mt-3 grid grid-cols-1 gap-2">
                    <button onClick={() => router.push(`/courses/lectures/${l.lecture_id}/words`)} className="border rounded px-3 py-2 text-sm w-full text-center">Danh sách từ vựng</button>
                    <button onClick={() => { setEditing(l); setInitialCourseId(l.course_id); setOpen(true); }} className="border rounded px-3 py-2 text-sm w-full text-center">Xem chi tiết</button>
                    {canEdit ? (
                      <button onClick={() => onDelete(l)} className="border rounded px-3 py-2 text-sm w-full text-center">Xóa</button>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      <LectureFormModal open={open} onClose={() => setOpen(false)} onSaved={fetchLectures} editing={editing} initialCourseId={initialCourseId} />
    </div>
  );
} 