'use client';

import { useState } from 'react';
import AuthPasswordForm from '@/components/AuthPasswordForm';
import AuthEmailForm from '@/components/AuthEmailForm';

export default function AuthSwitcher({ mode }: { mode: 'login' | 'signup' }) {
  const [method, setMethod] = useState<'password' | 'magic'>('password');

  return (
    <div className="space-y-4">
      <div className="flex gap-2 text-sm">
        <button
          type="button"
          onClick={() => setMethod('password')}
          className={`rounded-md border px-3 py-1 ${method === 'password' ? 'bg-black text-white dark:bg-white dark:text-black' : ''}`}
        >
          {mode === 'login' ? 'Đăng nhập bằng mật khẩu' : 'Đăng ký bằng mật khẩu'}
        </button>
        <button
          type="button"
          onClick={() => setMethod('magic')}
          className={`rounded-md border px-3 py-1 ${method === 'magic' ? 'bg-black text-white dark:bg-white dark:text-black' : ''}`}
        >
          {mode === 'login' ? 'Dùng email (magic link)' : 'Đăng ký bằng email (magic link)'}
        </button>
      </div>

      {method === 'password' ? (
        <AuthPasswordForm mode={mode} />
      ) : (
        <AuthEmailForm mode={mode} />
      )}
    </div>
  );
} 