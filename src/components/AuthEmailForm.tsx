'use client';

import { getBrowserSupabaseClient } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function AuthEmailForm({ mode }: { mode: 'login' | 'signup' }) {
  const supabase = typeof window !== 'undefined' ? getBrowserSupabaseClient() : null;
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) return;
    setStatus(null);
    try {
      setLoading(true);
      const redirectTo = `${window.location.origin}/auth/callback`;
      const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: redirectTo } });
      if (error) throw error;
      if (mode === 'signup') {
        router.replace('/auth/login?notice=verify_email_sent');
      } else {
        setStatus('Đã gửi liên kết đăng nhập tới email của bạn. Kiểm tra hộp thư.');
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Có lỗi xảy ra.';
      setStatus(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      <label className="block text-sm font-medium">Email</label>
      <input
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@example.com"
        className="w-full rounded-md border px-3 py-2 bg-transparent"
      />
      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-md bg-black text-white dark:bg-white dark:text-black px-4 py-2 text-sm font-medium"
      >
        {loading ? 'Đang gửi…' : mode === 'login' ? 'Gửi liên kết đăng nhập' : 'Gửi liên kết xác minh'}
      </button>
      {status && <p className="text-sm text-neutral-600 dark:text-neutral-300">{status}</p>}
    </form>
  );
} 