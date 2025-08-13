'use client';

import { getBrowserSupabaseClient } from '@/lib/supabaseClient';
import { useEffect } from 'react';

export default function AuthRedirectOnSession() {
  const supabase = typeof window !== 'undefined' ? getBrowserSupabaseClient() : null;

  useEffect(() => {
    if (!supabase) return;

    const hardNavigateHome = () => {
      // Give the client a moment to persist cookies before server checks
      setTimeout(() => {
        window.location.replace('/');
      }, 50);
    };

    const check = async () => {
      // If tokens are present in the hash (implicit flow), let supabase process them first
      if (window.location.hash.includes('access_token')) {
        // supabase-js handles parsing on first getSession
        await supabase.auth.getSession();
        hardNavigateHome();
        return;
      }
      const { data } = await supabase.auth.getSession();
      if (data.session) hardNavigateHome();
    };

    check();
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        hardNavigateHome();
      }
    });
    return () => {
      sub.subscription.unsubscribe();
    };
  }, [supabase]);

  return null;
} 