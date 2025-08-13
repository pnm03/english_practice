import GoogleSignInButton from '@/components/GoogleSignInButton';
import AuthSwitcher from '@/components/AuthSwitcher';
import Link from 'next/link';
import { cookies } from 'next/headers';
import { createClient as createServerSupabase } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';
import AuthRedirectOnSession from '@/components/AuthRedirectOnSession';

export default async function LoginPage() {
  const cookieStore = await cookies();
  const supabase = createServerSupabase(cookieStore);
  const { data } = await supabase.auth.getUser();
  if (data.user) {
    redirect('/');
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <AuthRedirectOnSession />
      <div className="w-full max-w-md rounded-xl border p-6 shadow-sm">
        <h1 className="text-2xl font-semibold">Đăng nhập</h1>
        <p className="text-sm text-neutral-600 mb-4">Chọn một phương thức</p>
        <div className="space-y-6">
          <AuthSwitcher mode="login" />
          <div className="my-2 flex items-center gap-3">
            <div className="h-px flex-1 bg-neutral-200 dark:bg-neutral-800" />
            <span className="text-xs text-neutral-500">hoặc</span>
            <div className="h-px flex-1 bg-neutral-200 dark:bg-neutral-800" />
          </div>
          <GoogleSignInButton />
          <p className="mt-2 text-sm">Chưa có tài khoản? <Link className="underline" href="/auth/signup">Đăng ký</Link></p>
        </div>
      </div>
    </div>
  );
} 