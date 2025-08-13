'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { getBrowserSupabaseClient } from '@/lib/supabaseClient';

const COLLAPSE_KEY = 'sidebar_collapsed';
const AUTO_KEY = 'sidebar_auto_collapse';

function readBoolFromLS(key: string, fallback: boolean): boolean {
  if (typeof window === 'undefined') return fallback;
  try {
    const v = window.localStorage.getItem(key);
    return v ? v === '1' : fallback;
  } catch {
    return fallback;
  }
}

export default function Sidebar({ initialAuto = true }: { initialAuto?: boolean }) {
  const supabase = useMemo(() => (typeof window !== 'undefined' ? getBrowserSupabaseClient() : null), []);
  const [auto, setAuto] = useState<boolean>(() => readBoolFromLS(AUTO_KEY, initialAuto));
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    // If auto is enabled on first render, render collapsed to match server
    const stored = readBoolFromLS(COLLAPSE_KEY, auto ? true : false);
    return stored;
  });
  const [openCourses, setOpenCourses] = useState(true);

  useEffect(() => {
    if (!supabase) return;
    (async () => {
      const { data } = await supabase.auth.getUser();
      const meta = (data.user?.user_metadata ?? {}) as any;
      if (typeof meta.menu_auto_collapse === 'boolean') {
        setAuto(meta.menu_auto_collapse);
        if (typeof window !== 'undefined') {
          window.localStorage.setItem(AUTO_KEY, meta.menu_auto_collapse ? '1' : '0');
        }
      }
    })();
  }, [supabase]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(COLLAPSE_KEY, collapsed ? '1' : '0');
    }
  }, [collapsed]);

  useEffect(() => {
    if (auto) setCollapsed(true);
  }, [auto]);

  // Listen for preference change from PreferencesForm
  useEffect(() => {
    const handler = (e: any) => {
      const v = !!e.detail?.value;
      setAuto(v);
      if (v) setCollapsed(true);
    };
    window.addEventListener('preferences:menu_auto_collapse' as any, handler);
    return () => window.removeEventListener('preferences:menu_auto_collapse' as any, handler);
  }, []);

  const widthClass = collapsed ? 'w-[72px]' : 'w-64';

  const handleMouseEnter = () => {
    if (auto && collapsed) setCollapsed(false);
  };
  const handleMouseLeave = () => {
    if (auto && !collapsed) setCollapsed(true);
  };

  const itemClass = 'flex items-center gap-3 px-3 py-2 rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-900';

  return (
    <aside
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={`${widthClass} transition-[width] duration-200 border-r bg-background/80 backdrop-blur`}
    >
      <div className="p-3 flex items-center justify-between">
        {!collapsed && <div className="text-sm font-medium">Menu</div>}
        <button
          onClick={() => setCollapsed((v) => !v)}
          className="text-xs border rounded px-2 py-1"
          title={collapsed ? 'Mở menu' : 'Thu gọn menu'}
        >
          {collapsed ? '›' : '‹'}
        </button>
      </div>

      <nav className="px-2 text-sm">
        <Link href="/practice" className={itemClass}>
          <span>🏋️</span>
          {!collapsed && <span>Luyện tập</span>}
        </Link>

        <div>
          <button onClick={() => setOpenCourses((v) => !v)} className={itemClass + ' w-full'}>
            <span>📚</span>
            {!collapsed && <span className="flex-1 text-left">Khóa học</span>}
            {!collapsed && <span>{openCourses ? '▾' : '▸'}</span>}
          </button>
          {!collapsed && openCourses && (
            <div className="ml-9">
              <Link href="/courses/manage" className="block px-2 py-1 rounded hover:underline">Quản lý khóa học</Link>
              <Link href="/courses/lectures" className="block px-2 py-1 rounded hover:underline">Quản lý bài giảng</Link>
            </div>
          )}
        </div>
      </nav>
    </aside>
  );
} 