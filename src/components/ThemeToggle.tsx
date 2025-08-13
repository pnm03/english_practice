'use client';

import { useTheme } from 'next-themes';

export default function ThemeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const current = theme ?? resolvedTheme ?? 'system';

  return (
    <button
      onClick={() => setTheme(current === 'dark' ? 'light' : 'dark')}
      className="border px-3 py-1 rounded"
    >
      {current === 'dark' ? 'Light' : 'Dark'}
    </button>
  );
} 