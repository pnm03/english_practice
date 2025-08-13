'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import SignOutButton from '@/components/SignOutButton';

export default function UserMenu({ fullName, email, avatarUrl }: { fullName: string; email: string; avatarUrl?: string; }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!ref.current) return;
      if (!ref.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener('click', onClick);
    return () => window.removeEventListener('click', onClick);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen((v) => !v)} className="flex items-center gap-3">
        <div className="text-right hidden sm:block">
          <div className="text-sm font-medium leading-tight">{fullName}</div>
          <div className="text-xs text-neutral-500 leading-tight">{email}</div>
        </div>
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={avatarUrl} alt="avatar" className="h-9 w-9 rounded-full object-cover" />
        ) : (
          <div className="h-9 w-9 rounded-full bg-neutral-300 flex items-center justify-center text-sm">
            {fullName?.[0]?.toUpperCase() ?? 'U'}
          </div>
        )}
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-56 rounded-md border bg-background shadow-md z-50">
          <div className="py-1 text-sm">
            <Link href="/settings/profile" onClick={() => setOpen(false)} className="block px-3 py-2 hover:bg-neutral-50 dark:hover:bg-neutral-900">Thông tin cá nhân</Link>
            <Link href="/settings/preferences" onClick={() => setOpen(false)} className="block px-3 py-2 hover:bg-neutral-50 dark:hover:bg-neutral-900">Cài đặt</Link>
            <div className="border-t my-1" />
            <div className="px-3 py-2">
              <SignOutButton fullWidth />
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 