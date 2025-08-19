import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

async function fetchFromJokeAPI(topic: string | null) {
  // Sv443 JokeAPI v2
  // Prefer everyday-life vibes: Misc + Pun (exclude Programming and Dark)
  const category = topic === 'lifestyle' ? 'Misc,Pun' : 'Any';
  const url = `https://v2.jokeapi.dev/joke/${category}?safe-mode&blacklistFlags=nsfw,religious,political,racist,sexist,explicit&format=json`;
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error('JokeAPI error');
  const data = await res.json();
  const joke = data?.type === 'single' ? data.joke : [data?.setup, data?.delivery].filter(Boolean).join(' ');
  if (!joke) throw new Error('No joke');
  return joke as string;
}

async function fetchFromOfficialJokeAPI() {
  const url = 'https://official-joke-api.appspot.com/random_joke';
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error('OfficialJoke error');
  const data = await res.json();
  const joke = [data?.setup, data?.punchline].filter(Boolean).join(' ');
  if (!joke) throw new Error('No joke');
  return joke as string;
}

async function translateTo(text: string, lang: 'vi'|'en'): Promise<string> {
  if (lang === 'en') return text;
  try {
    const res = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=en|${lang}`);
    const data = await res.json();
    const translated = data?.responseData?.translatedText || '';
    return translated || text;
  } catch {
    return text;
  }
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const topic = searchParams.get('topic'); // 'lifestyle' for Misc/Pun
    try {
      const en = await fetchFromJokeAPI(topic);
      const vi = await translateTo(en, 'vi');
      return NextResponse.json({ en, vi, joke: vi });
    } catch {
      const en = await fetchFromOfficialJokeAPI();
      const vi = await translateTo(en, 'vi');
      return NextResponse.json({ en, vi, joke: vi });
    }
  } catch {
    return NextResponse.json({ joke: 'Keep calm and try again later 😄' }, { status: 200 });
  }
}


