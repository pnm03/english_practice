import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabaseServer';

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const supabase = await createSupabaseServerClient();

  if (code) {
    await supabase.auth.exchangeCodeForSession(code);
  } else {
    // If using implicit flow and got tokens in hash, the browser will handle it.
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      return NextResponse.redirect(new URL('/auth/login', request.url));
    }
  }

  return NextResponse.redirect(new URL('/', request.url));
} 