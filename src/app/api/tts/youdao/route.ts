import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const text = url.searchParams.get('text') || '';
    if (!text) return new NextResponse('Bad Request', { status: 400 });
    const upstream = `https://dict.youdao.com/dictvoice?type=2&audio=${encodeURIComponent(text)}`;
    const res = await fetch(upstream, { cache: 'no-store' });
    if (!res.ok) return new NextResponse('Upstream error', { status: 502 });
    const buf = await res.arrayBuffer();
    return new NextResponse(Buffer.from(buf), {
      status: 200,
      headers: {
        'Content-Type': res.headers.get('Content-Type') || 'audio/mpeg',
        'Cache-Control': 'no-store',
      },
    });
  } catch (e) {
    return new NextResponse('Unexpected', { status: 500 });
  }
}


