'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
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
  const [openPractice, setOpenPractice] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Check if mobile view
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const checkIfMobile = () => {
      setIsMobile(window.innerWidth < 768); // 768px is typical md breakpoint
    };
    
    // Initial check
    checkIfMobile();
    
    // Add event listener
    window.addEventListener('resize', checkIfMobile);
    
    // Cleanup
    return () => window.removeEventListener('resize', checkIfMobile);
  }, []);

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

  // Always collapse sidebar on mobile
  useEffect(() => {
    if (isMobile) {
      setCollapsed(true);
    }
  }, [isMobile]);

  // Close mobile menu when navigating
  const pathname = usePathname();
  useEffect(() => {
    if (isMobile) {
      setIsMobileMenuOpen(false);
    }
  }, [pathname, isMobile]);

  const widthClass = collapsed ? 'w-[56px]' : 'w-64';
  
  // For mobile: off-canvas behavior
  // Always render panel at fixed width, slide in/out and disable interactions when hidden
  const panelWidthClass = isMobile ? 'w-64' : widthClass;
  const mobileClass = isMobile
    ? (isMobileMenuOpen ? 'translate-x-0 pointer-events-auto' : '-translate-x-full invisible pointer-events-none')
    : '';

  const NavItem = ({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) => {
    const active = pathname?.startsWith(href);
    return (
      <Link
        href={href}
        className={`${itemClass} relative ${active ? 'bg-neutral-100 dark:bg-neutral-900' : ''}`}
      >
        <span className="text-lg">{icon}</span>
        {(!collapsed || isMobileMenuOpen) && <span className="flex-1 font-semibold">{label}</span>}
        {active && (
          <span className="absolute right-2 h-2 w-2 rounded-full bg-emerald-500" />
        )}
      </Link>
    );
  };

  const handleMouseEnter = () => {
    if (auto && collapsed && !isMobile) setCollapsed(false);
  };
  
  const handleMouseLeave = () => {
    if (auto && !collapsed && !isMobile) setCollapsed(true);
  };

  const itemClass = 'flex items-center gap-3 px-3 py-2 rounded-md transition-colors duration-150 hover:bg-neutral-100 dark:hover:bg-neutral-900';

  // Mobile menu toggle button
  const MobileMenuButton = () => {
    if (!isMobile) return null;
    
    return (
      <button
        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        className="fixed left-2 top-[4.5rem] z-50 bg-neutral-100 dark:bg-neutral-800 p-2 rounded-md shadow-md"
        aria-label={isMobileMenuOpen ? "Close menu" : "Open menu"}
      >
        {isMobileMenuOpen ? '✕' : '☰'}
      </button>
    );
  };

  return (
    <>
      <MobileMenuButton />
      <aside
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className={`
          ${panelWidthClass} 
          ${mobileClass}
          transition-all duration-200 
          border-r bg-neutral-50 dark:bg-neutral-950/70 backdrop-blur
          ${isMobile ? 'fixed left-0 top-14 bottom-0 z-40 shadow-lg' : ''}
        `}
      >
        <div className="p-3 flex items-center justify-between">
          {(!collapsed || isMobileMenuOpen) && <div className="text-sm font-medium">Menu</div>}
          {!isMobile && (
            <button
              onClick={() => setCollapsed((v) => !v)}
              className="text-xs border rounded px-2 py-1"
              title={collapsed ? 'Mở menu' : 'Thu gọn menu'}
            >
              {collapsed ? '›' : '‹'}
            </button>
          )}
          {isMobile && isMobileMenuOpen && (
            <button
              onClick={() => setIsMobileMenuOpen(false)}
              className="text-xs border rounded px-2 py-1"
            >
              ✕
            </button>
          )}
        </div>

        <nav className="px-2 text-sm">
          <div className="mt-1">
            <button onClick={() => setOpenPractice((v) => !v)} className={itemClass + ' w-full'}>
              <span>🏋️</span>
              {(!collapsed || isMobileMenuOpen) && <span className="flex-1 text-left font-semibold">Luyện tập</span>}
              {(!collapsed || isMobileMenuOpen) && <span className="opacity-70">{openPractice ? '▾' : '▸'}</span>}
            </button>
            {(!collapsed || isMobileMenuOpen) && openPractice && (
              <div className="ml-9 border-l pl-3">
                <NavItem href="/practice" icon={<>📝</>} label="Luyện tập" />
                <NavItem href="/test" icon={<>🧪</>} label="Kiểm tra" />
                <NavItem href="/practice/wrong" icon={<>⚠️</>} label="Luyện tập từ sai" />
              </div>
            )}
          </div>

          <div className="mt-1">
            <button onClick={() => setOpenCourses((v) => !v)} className={itemClass + ' w-full'}>
              <span>📚</span>
              {(!collapsed || isMobileMenuOpen) && <span className="flex-1 text-left font-semibold">Khóa học</span>}
              {(!collapsed || isMobileMenuOpen) && <span className="opacity-70">{openCourses ? '▾' : '▸'}</span>}
            </button>
            {(!collapsed || isMobileMenuOpen) && openCourses && (
              <div className="ml-9 border-l pl-3">
                <NavItem href="/courses/manage" icon={<>🗂️</>} label="Quản lý khóa học" />
                <NavItem href="/courses/lectures" icon={<>📖</>} label="Quản lý bài giảng" />
              </div>
            )}
          </div>

          <NavItem href="/translate" icon={<>🌐</>} label="Dịch" />
        </nav>
      </aside>
      
      {/* Overlay for mobile menu */}
      {isMobile && (
        <div 
          className={`fixed inset-0 z-30 transition-opacity duration-200 ${isMobileMenuOpen ? 'bg-black/30 opacity-100' : 'opacity-0 pointer-events-none'}`}
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}
    </>
  );
}