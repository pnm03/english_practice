import { NextResponse } from 'next/server';

type RequestBody = { texts?: string[]; target?: 'vi' | 'en' };

async function translateOne(text: string, from: 'en'|'vi', to: 'en'|'vi'): Promise<string> {
  try {
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${from}|${to}`;
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) return text;
    const data = await res.json();
    const translated = (data?.responseData?.translatedText as string) || '';
    return translated || text;
  } catch {
    return text;
  }
}

export async function POST(req: Request) {
  try {
    const body: RequestBody = await req.json();
    const texts = Array.isArray(body?.texts) ? (body!.texts as string[]) : [];
    const target = (body?.target || 'vi') as 'vi' | 'en';
    const from: 'en'|'vi' = target === 'vi' ? 'en' : 'vi';
    if (texts.length === 0) return NextResponse.json({ translations: [] });
    const results = await Promise.all(
      texts.map((t) => translateOne(String(t), from, target))
    );
    return NextResponse.json({ translations: results });
  } catch (e) {
    return NextResponse.json({ translations: [] }, { status: 200 });
  }
}


