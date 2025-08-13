import { cookies } from "next/headers";
import { createClient as createServerSupabase } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import SignOutButton from "@/components/SignOutButton";

export default async function Home() {
  const cookieStore = await cookies();
  const supabase = createServerSupabase(cookieStore);
  const { data } = await supabase.auth.getUser();
  const user = data.user;

  if (!user) {
    redirect('/auth/login');
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-6">
      <h1 className="text-3xl font-bold">Home</h1>
      <p className="text-neutral-600">Xin chào, {user?.email}</p>
      <SignOutButton />
    </div>
  );
}
