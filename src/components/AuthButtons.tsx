'use client';

import { getBrowserSupabaseClient } from '@/lib/supabaseClient';
import { useEffect, useMemo, useState } from 'react';

export default function AuthButtons() {
  const [loading, setLoading] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [envReady, setEnvReady] = useState(false);

  const supabase = useMemo(() => {
    if (typeof window === 'undefined') return null;
    try {
      // This will throw if env vars are missing
      return getBrowserSupabaseClient();
    } catch (e) {
      console.warn('Supabase env missing. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY');
      return null;
    }
  }, []);

  useEffect(() => {
    if (!supabase) return;
    setEnvReady(true);
    const getUser = async () => {
      const { data } = await supabase.auth.getUser();
      setUserEmail(data.user?.email ?? null);
    };
    getUser();
    const { data: sub } = supabase.auth.onAuthStateChange(() => getUser());
    return () => {
      sub.subscription.unsubscribe();
    };
  }, [supabase]);

  const signInWithGoogle = async () => {
    if (!supabase) return;
    try {
      setLoading(true);
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      if (error) throw error;
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    if (!supabase) return;
    try {
      setLoading(true);
      await supabase.auth.signOut();
    } finally {
      setLoading(false);
    }
  };

  if (!envReady || !supabase) {
    return (
      <button className="border px-3 py-1 rounded opacity-70 cursor-not-allowed" title="Set Supabase env in .env.local">
        Continue with Google
      </button>
    );
  }

  if (userEmail) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-sm">{userEmail}</span>
        <button onClick={signOut} className="border px-3 py-1 rounded" disabled={loading}>
          Sign out
        </button>
      </div>
    );
  }

  return (
    <button onClick={signInWithGoogle} className="border px-3 py-1 rounded" disabled={loading}>
      {loading ? '...' : 'Continue with Google'}
    </button>
  );
} 