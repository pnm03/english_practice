import { cookies } from 'next/headers';
import { createClient as createServerSupabase } from '@/utils/supabase/server';
import Sidebar from '@/components/Sidebar';

export default async function AppShell({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const supabase = createServerSupabase(cookieStore);
  const { data } = await supabase.auth.getUser();
  const user = data.user;

  if (!user) {
    return <>{children}</>;
  }

  const meta = (user.user_metadata ?? {}) as any;
  const initialAuto: boolean = typeof meta.menu_auto_collapse === 'boolean' ? meta.menu_auto_collapse : true;

  return (
    <div className="flex min-h-[calc(100vh-3.5rem)]">{/* below 56px header */}
      {/* Sidebar (client) */}
      {/* @ts-expect-error Server-to-Client */}
      <Sidebar initialAuto={initialAuto} />
      <div className="flex-1">
        {children}
      </div>
    </div>
  );
} 