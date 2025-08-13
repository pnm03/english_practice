'use client';

import { getBrowserSupabaseClient } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import ReCaptcha from './ReCaptcha';

export default function AuthPasswordForm({ mode }: { mode: 'login' | 'signup' }) {
  const supabase = typeof window !== 'undefined' ? getBrowserSupabaseClient() : null;
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const verifyCaptcha = async (): Promise<boolean> => {
    if (!captchaToken) return false;
    const res = await fetch('/api/recaptcha/verify', { method: 'POST', body: JSON.stringify({ token: captchaToken }) });
    if (!res.ok) return false;
    const data = await res.json();
    return !!data.ok;
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) return;

    setStatus(null);
    if (mode === 'signup' && password !== confirm) {
      setStatus('Mật khẩu xác nhận không khớp.');
      return;
    }
    const captchaOk = await verifyCaptcha();
    if (!captchaOk) {
      setStatus('Xác thực reCAPTCHA thất bại hoặc chưa hoàn thành.');
      return;
    }

    try {
      setLoading(true);
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        router.replace('/');
      } else {
        const redirectTo = `${window.location.origin}/auth/callback`;
        const { error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: redirectTo } });
        if (error) throw error;
        router.replace('/auth/login?notice=verify_email_sent');
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
      <div>
        <label className="block text-sm font-medium">Email</label>
        <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="w-full rounded-md border px-3 py-2 bg-transparent" />
      </div>
      <div>
        <label className="block text-sm font-medium">Mật khẩu</label>
        <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className="w-full rounded-md border px-3 py-2 bg-transparent" />
      </div>
      {mode === 'signup' && (
        <div>
          <label className="block text-sm font-medium">Xác nhận mật khẩu</label>
          <input type="password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} className="w-full rounded-md border px-3 py-2 bg-transparent" />
        </div>
      )}
      <ReCaptcha onVerify={setCaptchaToken} />
      <button type="submit" disabled={loading} className="w-full rounded-md bg-black text-white dark:bg-white dark:text-black px-4 py-2 text-sm font-medium">
        {loading ? 'Đang xử lý…' : mode === 'login' ? 'Đăng nhập' : 'Đăng ký'}
      </button>
      {status && <p className="text-sm text-red-600 dark:text-red-400">{status}</p>}
    </form>
  );
} 