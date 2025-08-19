import { cookies, headers } from "next/headers";
import { createClient as createServerSupabase } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import SignOutButton from "@/components/SignOutButton";
import DailyJoke from "./components/DailyJoke";

export default async function Home() {
  const cookieStore = await cookies();
  const supabase = createServerSupabase(cookieStore);
  const { data } = await supabase.auth.getUser();
  const user = data.user;

  if (!user) {
    redirect('/auth/login');
  }


  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-6 p-6">
      <h1 className="text-3xl font-bold">Câu nói vui hôm nay</h1>
      <p className="text-neutral-600">Xin chào, {user?.email}</p>
      {/* Client component to show one joke with refresh */}
      <DailyJoke />
      <SignOutButton />
    </div>
  );
}
