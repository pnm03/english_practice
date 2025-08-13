import { cookies } from 'next/headers';
import { createClient as createServerSupabase } from '@/utils/supabase/server';
import ProfileForm from '@/components/ProfileForm';

export default async function ProfileSettingsPage() {
  const cookieStore = await cookies();
  const supabase = createServerSupabase(cookieStore);
  const { data } = await supabase.auth.getUser();
  const user = data.user;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Thông tin cá nhân</h1>
      <ProfileForm
        initialEmail={user?.email ?? ''}
        initialName={(user?.user_metadata?.full_name as string) ?? ''}
        initialAvatar={(user?.user_metadata?.avatar_url as string) ?? ''}
      />
    </div>
  );
} 