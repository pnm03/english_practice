'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

const voicesCache: { en?: SpeechSynthesisVoice; vi?: SpeechSynthesisVoice } = {};

function useVoices() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const synth = window.speechSynthesis;
    const load = () => {
      const vs = synth.getVoices();
      voicesCache.en = vs.find((v) => v.lang.startsWith('en')) || voicesCache.en;
      voicesCache.vi = vs.find((v) => v.lang.startsWith('vi')) || voicesCache.vi;
      setReady(true);
    };
    load();
    if (synth.onvoiceschanged !== undefined) synth.onvoiceschanged = load;
  }, []);
  return ready;
}

export default function TranslatePage() {
  const [fromLang, setFromLang] = useState<'en' | 'vi'>('en');
  const [toLang, setToLang] = useState<'en' | 'vi'>('vi');
  const [text, setText] = useState('');
  const [result, setResult] = useState('');
  const [ipa, setIpa] = useState('');
  const [loading, setLoading] = useState(false);
  const ready = useVoices();
  const abortRef = useRef<AbortController | null>(null);
  const [recent, setRecent] = useState<{src: string; dst: string; from: 'en'|'vi'; to: 'en'|'vi'}[]>([]);
  useEffect(() => {
    try {
      const arr = JSON.parse(localStorage.getItem('recent_translations') || '[]');
      setRecent(Array.isArray(arr) ? arr.slice(0, 5) : []);
    } catch { /* noop */ }
  }, []);
  const [pending, setPending] = useState(false);
  const [copied, setCopied] = useState(false);

  // Avoid hydration mismatch: detect speech on client after mount
  const [canSpeak, setCanSpeak] = useState(false);
  useEffect(() => {
    setCanSpeak(typeof window !== 'undefined' && 'speechSynthesis' in window);
  }, []);

  const translateWith = async (qText: string, sl: 'en'|'vi', tl: 'en'|'vi') => {
    const q = qText.trim();
    if (!q) { setResult(''); setIpa(''); setPending(false); return; }
    setLoading(true);
    setPending(true);
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    try {
      // Simple translation via free MyMemory API as a demo; you can replace with your endpoint later
      const res = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(q)}&langpair=${sl}|${tl}`);
      const data = await res.json();
      const translated = data?.responseData?.translatedText || '';
      setResult(translated);
      const item = { src: q, dst: translated, from: sl as 'en'|'vi', to: tl as 'en'|'vi' };
      setRecent((prev) => {
        const next = [item, ...prev.filter((p) => p.src !== q)].slice(0,5);
        if (typeof window !== 'undefined') localStorage.setItem('recent_translations', JSON.stringify(next));
        return next;
      });

      // IPA via dictionaryapi.dev when target is English
      if (tl === 'en') {
        const d = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(translated.split(' ')[0])}`);
        if (d.ok) {
          const arr = await d.json();
          const entry = Array.isArray(arr) ? arr[0] : null;
          const ipaText = entry?.phonetic || entry?.phonetics?.find((p: any) => p.text)?.text || '';
          setIpa(ipaText || '');
        } else setIpa('');
      } else if (sl === 'en') {
        const d = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(q.split(' ')[0])}`);
        if (d.ok) {
          const arr = await d.json();
          const entry = Array.isArray(arr) ? arr[0] : null;
          const ipaText = entry?.phonetic || entry?.phonetics?.find((p: any) => p.text)?.text || '';
          setIpa(ipaText || '');
        } else setIpa('');
      } else setIpa('');
    } catch (e) {
      // ignore
    } finally {
      setLoading(false);
      setPending(false);
    }
  };

  const doTranslate = async () => translateWith(text, fromLang, toLang);

  const speak = (content: string, lang: 'en' | 'vi') => {
    if (!canSpeak || !content) return;
    const utter = new SpeechSynthesisUtterance(content);
    utter.lang = lang;
    const v = lang === 'en' ? voicesCache.en : voicesCache.vi;
    if (v) utter.voice = v;
    window.speechSynthesis.speak(utter);
  };

  // Auto translate on typing or language change (debounced)
  useEffect(() => {
    const t = setTimeout(() => {
      if (text.trim()) translateWith(text, fromLang, toLang);
    }, 500);
    return () => clearTimeout(t);
  }, [text, fromLang, toLang]);

  // Reset "Copy" label when input text changes
  useEffect(() => { setCopied(false); }, [text]);

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-3xl font-bold">Dịch</h1>
      <div className="rounded-xl border overflow-hidden shadow-sm">
        {/* Header with language selectors left/right and swap in middle */}
        <div className="flex items-center justify-between p-4 border-b">
          <select value={fromLang} onChange={(e) => setFromLang(e.target.value as any)} className="border rounded px-3 py-2">
            <option value="en">English</option>
            <option value="vi">Tiếng Việt</option>
          </select>
          <button onClick={() => { const t = fromLang; setFromLang(toLang as any); setToLang(t as any); }} className="border rounded px-3 py-2" title="Đổi chiều">⇄</button>
          <select value={toLang} onChange={(e) => setToLang(e.target.value as any)} className="border rounded px-3 py-2">
            <option value="vi">Tiếng Việt</option>
            <option value="en">English</option>
          </select>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2">
          <div className="p-4 border-r">
            <div className="relative">
              <textarea value={text} onChange={(e) => { const v = e.target.value; setText(v); const has = !!v.trim(); setPending(has); if (!has) { setResult(''); setIpa(''); } }} placeholder="Nhập văn bản..." className="w-full h-36 md:h-36 border rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-black/20 resize-none" />
              <button onClick={() => { setText(''); setResult(''); setIpa(''); setPending(false); }} className="absolute right-2 bottom-6 border rounded px-2 py-1 text-xs bg-white/80 dark:bg-black/60 shadow">Clear</button>
              <div className="absolute left-2 bottom-6 text-xs text-neutral-500">{(text.trim() ? text.trim().split(/\s+/).length : 0)} / 500 từ</div>
            </div>
            <div className="flex items-center gap-2 mt-3">
              <button onClick={doTranslate} className="rounded bg-black text-white dark:bg-white dark:text-black px-4 py-2 text-sm" disabled={loading}>Dịch</button>
              {canSpeak && <button onClick={() => speak(text, fromLang)} className="border rounded px-3 py-2 text-sm">Đọc</button>}
            </div>
            {fromLang === 'en' && ipa && (
              <div className="text-sm text-neutral-600 mt-2">IPA: <span className="font-mono">{ipa}</span></div>
            )}
          </div>
          <div className="p-4">
            <div className="relative h-36 md:h-36 border rounded-lg p-4 bg-neutral-50 dark:bg-neutral-900 whitespace-pre-wrap overflow-auto">
              {pending ? (
                <div className="h-full w-full flex items-center justify-center">
                  <div className="flex gap-1">
                    <span className="w-2 h-2 rounded-full bg-neutral-400 animate-bounce [animation-delay:-0.3s]"></span>
                    <span className="w-2 h-2 rounded-full bg-neutral-500 animate-bounce [animation-delay:-0.15s]"></span>
                    <span className="w-2 h-2 rounded-full bg-neutral-600 animate-bounce"></span>
                  </div>
                </div>
              ) : (result || '—')}
              {/* Copy button */}
              <button onClick={() => { if (result) { navigator.clipboard.writeText(result); setCopied(true); } }} className="absolute bottom-4 right-2 border rounded px-2 py-1 text-xs bg-white/80 dark:bg-black/60">{copied ? 'Đã copy' : 'Copy'}</button>
            </div>
            {toLang === 'en' && ipa && (
              <div className="text-sm text-neutral-600 mt-2">IPA: <span className="font-mono">{ipa}</span></div>
            )}
            {canSpeak && <button onClick={() => speak(result, toLang)} className="mt-3 border rounded px-3 py-2 text-sm">Đọc kết quả</button>}
          </div>
        </div>
      </div>

      <div>
        <div className="text-sm font-medium mb-2">Gần đây</div>
        <div className="rounded-lg border overflow-hidden">
          {recent.length === 0 ? (
            <div className="p-3 text-sm text-neutral-500">Chưa có bản dịch nào.</div>
          ) : (
            recent.map((r, idx) => (
              <div key={idx} className="p-3 flex items-center gap-3 border-b last:border-b-0">
                <div className="text-xs px-2 py-1 rounded-full border">{r.from}→{r.to}</div>
                <div className="flex-1 truncate" title={r.src}>{r.src}</div>
                <div className="flex-1 truncate text-neutral-600" title={r.dst}>{r.dst}</div>
                <button onClick={() => { setText(r.src); setFromLang(r.from); setToLang(r.to); translateWith(r.src, r.from, r.to); }} className="text-sm border rounded px-2 py-1">Dùng lại</button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}


