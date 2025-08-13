import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { token } = await req.json();
    const secret = process.env.RECAPTCHA_SECRET_KEY;
    if (!secret) return NextResponse.json({ ok: false, error: 'Missing RECAPTCHA_SECRET_KEY' }, { status: 500 });
    const params = new URLSearchParams({ secret, response: token ?? '' });
    const resp = await fetch('https://www.google.com/recaptcha/api/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });
    const data = await resp.json();
    if (data.success) return NextResponse.json({ ok: true });
    return NextResponse.json({ ok: false, error: 'verify_failed', data }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ ok: false, error: 'unexpected' }, { status: 500 });
  }
} 