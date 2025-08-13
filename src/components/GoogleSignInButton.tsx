'use client';

import { getBrowserSupabaseClient } from '@/lib/supabaseClient';
import { useState } from 'react';

export default function GoogleSignInButton({ fullWidth = true }: { fullWidth?: boolean }) {
  const supabase = typeof window !== 'undefined' ? getBrowserSupabaseClient() : null;
  const [loading, setLoading] = useState(false);

  const signIn = async () => {
    if (!supabase) return;
    try {
      setLoading(true);
      const options: any = { redirectTo: `${window.location.origin}/auth/callback`, flowType: 'pkce' };
      const { error } = await supabase.auth.signInWithOAuth({ provider: 'google', options });
      if (error) throw error;
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={signIn}
      disabled={loading}
      className={`${fullWidth ? 'w-full' : ''} inline-flex items-center justify-center gap-2 rounded-md border px-4 py-2 text-sm font-medium hover:bg-neutral-50 dark:hover:bg-neutral-900`}
    >
      <svg width="18" height="18" viewBox="0 0 48 48" className="-ml-1"><path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303C33.56 32.91 29.14 36 24 36c-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.153 7.961 3.039l5.657-5.657C33.64 6.053 28.983 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"/><path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.505 16.108 18.879 12 24 12c3.059 0 5.842 1.153 7.961 3.039l5.657-5.657C33.64 6.053 28.983 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"/><path fill="#4CAF50" d="M24 44c5.065 0 9.646-1.949 13.152-5.122l-6.071-4.991C29.05 35.091 26.648 36 24 36c-5.116 0-9.532-3.081-11.289-7.396l-6.553 5.047C9.477 39.556 16.227 44 24 44z"/><path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303c-1.3 3.01-3.784 5.42-6.851 6.887l.005-.003 6.071 4.991C33.95 40.036 40 35 40 24c0-1.341-.138-2.651-.389-3.917z"/></svg>
      {loading ? 'Signing in…' : 'Continue with Google'}
    </button>
  );
} 