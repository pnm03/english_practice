'use client';

import { useTheme } from 'next-themes';
import { useLanguage } from '@/components/LanguageProvider';
import { useEffect, useState } from 'react';
import { getBrowserSupabaseClient } from '@/lib/supabaseClient';
import { useToast } from '@/components/ToastProvider';

export default function PreferencesForm() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const { locale, setLocale } = useLanguage();
  const supabase = getBrowserSupabaseClient();
  const { showToast } = useToast();
  const [message, setMessage] = useState<string | null>(null);
  const currentTheme = theme ?? resolvedTheme ?? 'system';

  const [autoMenu, setAutoMenu] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    const v = localStorage.getItem('sidebar_auto_collapse');
    return v ? v === '1' : true;
  });

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      const meta = (data.user?.user_metadata ?? {}) as any;
      if (typeof meta.menu_auto_collapse === 'boolean') setAutoMenu(meta.menu_auto_collapse);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    try {
      const { error } = await supabase.auth.updateUser({ data: { preferred_theme: currentTheme, preferred_language: locale, menu_auto_collapse: autoMenu } });
      if (error) throw error;
      localStorage.setItem('sidebar_auto_collapse', autoMenu ? '1' : '0');
      // Notify in-tab listeners (Sidebar) to update immediately
      window.dispatchEvent(new CustomEvent('preferences:menu_auto_collapse', { detail: { value: autoMenu } }));
      setMessage('Đã lưu cài đặt.');
      showToast('Đã lưu cài đặt ứng dụng', { type: 'success' });
    } catch (err: unknown) {
      setMessage(err instanceof Error ? err.message : 'Có lỗi xảy ra.');
    }
  };

  return (
    <form onSubmit={save} className="space-y-6">
      <div className="space-y-2">
        <label className="block text-sm font-medium">Ngôn ngữ</label>
        <select
          className="rounded-md border px-3 py-2 bg-transparent"
          value={locale}
          onChange={(e) => setLocale(e.target.value as 'vi' | 'en')}
        >
          <option value="vi">Tiếng Việt</option>
          <option value="en">English</option>
        </select>
      </div>

      <div className="space-y-2">
        <label className="block text-sm font-medium">Theme</label>
        <select
          className="rounded-md border px-3 py-2 bg-transparent"
          value={currentTheme}
          onChange={(e) => setTheme(e.target.value)}
        >
          <option value="light">Light</option>
          <option value="dark">Dark</option>
          <option value="system">System</option>
        </select>
      </div>

      <div className="space-y-2">
        <label className="block text-sm font-medium">Tự động đóng menu</label>
        <button
          type="button"
          onClick={() => setAutoMenu((v) => !v)}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${autoMenu ? 'bg-black dark:bg-white' : 'bg-neutral-300 dark:bg-neutral-700'}`}
          aria-pressed={autoMenu}
          aria-label="Toggle auto-collapse"
        >
          <span
            className={`inline-block h-5 w-5 transform rounded-full bg-white dark:bg-black transition-transform ${autoMenu ? 'translate-x-5' : 'translate-x-1'}`}
          />
        </button>
        <p className="text-xs text-neutral-500">Bật để menu tự thu gọn; di chuột vào để mở rộng.</p>
      </div>

      <button type="submit" className="rounded-md bg-black text-white dark:bg-white dark:text-black px-4 py-2 text-sm">Lưu cài đặt</button>
      {message && <p className="text-sm text-neutral-600 dark:text-neutral-300">{message}</p>}
    </form>
  );
} 