'use client';

import { useEffect, useState } from 'react';

export default function DailyJoke() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [vi, setVi] = useState<string>('');
  const [en, setEn] = useState<string>('');

  const load = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await fetch('/api/joke?topic=lifestyle', { cache: 'no-store' });
      const data = await res.json();
      setVi(data?.vi || data?.joke || '');
      setEn(data?.en || '');
    } catch (e: any) {
      setError('Không tải được câu nói, thử lại nhé.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  return (
    <div className="w-full max-w-2xl text-center space-y-3">
      {loading ? (
        <div className="text-neutral-500">Đang tải câu nói vui…</div>
      ) : error ? (
        <div className="text-red-600 text-sm">{error}</div>
      ) : (
        <>
          <blockquote className="rounded-xl border bg-white/60 dark:bg-neutral-900/40 p-4 shadow-sm text-lg leading-relaxed">
            <div className="font-medium text-neutral-900 dark:text-neutral-100">{vi}</div>
            {en && <div className="mt-1 text-sm text-neutral-600 dark:text-neutral-300">{en}</div>}
          </blockquote>
          <button onClick={load} className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-black text-white dark:bg-white dark:text-black">
            Làm mới
          </button>
        </>
      )}
    </div>
  );
}


