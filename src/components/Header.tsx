import Link from 'next/link';
import { cookies } from 'next/headers';
import { createClient as createServerSupabase } from '@/utils/supabase/server';
import UserMenu from '@/components/UserMenu';

export default async function Header() {
  const cookieStore = await cookies();
  const supabase = createServerSupabase(cookieStore);
  const { data } = await supabase.auth.getUser();
  const user = data.user;

  if (!user) return null; // Only show header after login

  const avatarUrl = user?.user_metadata?.avatar_url as string | undefined;
  const fullName = (user?.user_metadata?.full_name as string | undefined) ?? user?.email ?? 'User';

  return (
    <header className="w-full border-b bg-background/60 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto max-w-5xl px-4 h-14 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.svg" alt="logo" className="h-20 w-20" />
            <span className="font-semibold">CSLD English</span>
          </Link>
        </div>
        <div className="flex items-center gap-2">
          <UserMenu fullName={fullName} email={user.email ?? ''} avatarUrl={avatarUrl} />
        </div>
      </div>
    </header>
  );
} 