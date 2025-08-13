import GoogleSignInButton from '@/components/GoogleSignInButton';
import AuthSwitcher from '@/components/AuthSwitcher';
import Link from 'next/link';

export default function SignupPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-xl border p-6 shadow-sm">
        <h1 className="text-2xl font-semibold">Đăng ký</h1>
        <p className="text-sm text-neutral-600 mb-4">Chọn một phương thức</p>
        <div className="space-y-6">
          <AuthSwitcher mode="signup" />
          <div className="my-2 flex items-center gap-3">
            <div className="h-px flex-1 bg-neutral-200 dark:bg-neutral-800" />
            <span className="text-xs text-neutral-500">hoặc</span>
            <div className="h-px flex-1 bg-neutral-200 dark:bg-neutral-800" />
          </div>
          <GoogleSignInButton />
          <p className="mt-2 text-sm">Đã có tài khoản? <Link className="underline" href="/auth/login">Đăng nhập</Link></p>
        </div>
      </div>
    </div>
  );
} 