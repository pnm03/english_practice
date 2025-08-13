'use client';

import { getBrowserSupabaseClient } from '@/lib/supabaseClient';
import { useState } from 'react';

export default function SignOutButton({ fullWidth = false }: { fullWidth?: boolean }) {
  const supabase = typeof window !== 'undefined' ? getBrowserSupabaseClient() : null;
  const [loading, setLoading] = useState(false);

  const signOut = async () => {
    if (!supabase) return;
    try {
      setLoading(true);
      await supabase.auth.signOut();
      // After sign out, reload to trigger server session check
      window.location.href = '/auth/login';
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={signOut}
      disabled={loading}
      className={`${fullWidth ? 'w-full' : ''} rounded-md border px-4 py-2 text-sm font-medium hover:bg-neutral-50 dark:hover:bg-neutral-900`}
    >
      {loading ? 'Signing out…' : 'Đăng xuất'}
    </button>
  );
} 