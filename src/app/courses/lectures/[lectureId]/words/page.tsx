'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getBrowserSupabaseClient } from '@/lib/supabaseClient';
import { useToast } from '@/components/ToastProvider';

export type Word = {
  word_id: string;
  lecture_id: string;
  order_in_lecture: number | null;
  text: string;
  image_url: string | null;
  ipa: string | null;
  audio_url: string | null;
};

type MeaningItem = { part_of_speech?: string; meaning: string };

type DictResult = { ipa?: string; audio?: string | null; meanings?: MeaningItem[]; suggestions?: string[] };

export default function LectureWordsPage() {
  const { lectureId } = useParams<{ lectureId: string }>();
  const router = useRouter();
  const supabase = getBrowserSupabaseClient();
  const { showToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [lectureTitle, setLectureTitle] = useState('');
  const [courseId, setCourseId] = useState<string | null>(null);
  const [canEdit, setCanEdit] = useState<boolean>(false);
  const [words, setWords] = useState<Word[]>([]);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Word | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [meaningsMap, setMeaningsMap] = useState<Record<string, string[]>>({});

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return words;
    return words.filter((w) => w.text.toLowerCase().includes(q) || (w.ipa ?? '').toLowerCase().includes(q));
  }, [words, query]);

  // Base ordered list (by order_in_lecture)
  const ordered = useMemo(
    () => [...filtered].sort((a, b) => (a.order_in_lecture ?? 0) - (b.order_in_lecture ?? 0)),
    [filtered]
  );

  // Preview order when dragging over a target (visual feedback before dropping)
  const previewed = useMemo(() => {
    if (!draggingId || !dragOverId || draggingId === dragOverId) return ordered;
    const arr = [...ordered];
    const from = arr.findIndex((w) => w.word_id === draggingId);
    const to = arr.findIndex((w) => w.word_id === dragOverId);
    if (from < 0 || to < 0) return ordered;
    const [item] = arr.splice(from, 1);
    arr.splice(to, 0, item);
    return arr;
  }, [ordered, draggingId, dragOverId]);

  const toPublicUrl = (p: string | null, bucket: string) => {
    if (!p) return null;
    if (p.startsWith('http')) return p;
    return supabase.storage.from(bucket).getPublicUrl(p).data.publicUrl;
  };

  const fetchLecture = async () => {
    const { data: lec } = await supabase.from('lectures').select('title, course_id').eq('lecture_id', lectureId).single();
    setLectureTitle((lec as any)?.title ?? '');
    const cid = (lec as any)?.course_id as string | undefined;
    setCourseId(cid ?? null);
    // check permission: course owner only
    if (cid) {
      const [{ data: c }, { data: u }] = await Promise.all([
        supabase.from('courses').select('creator_id').eq('course_id', cid).single(),
        supabase.auth.getUser(),
      ]);
      const owner = (c as any)?.creator_id ?? null;
      const uid = (u as any)?.user?.id ?? null;
      setCanEdit(owner && uid && owner === uid);
    } else {
      setCanEdit(false);
    }
  };
  const fetchWords = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('words')
      .select('word_id,lecture_id,order_in_lecture,text,image_url,ipa,audio_url')
      .eq('lecture_id', lectureId)
      .order('order_in_lecture', { ascending: true });
    if (error) showToast(error.message, { type: 'error' });
    setWords((data as any) ?? []);
    // Fetch meanings for all words
    const ids = ((data as any) ?? []).map((w: any) => w.word_id);
    if (ids.length > 0) {
      const { data: mdata } = await supabase
        .from('wordmeanings')
        .select('word_id,meaning')
        .in('word_id', ids);
      const map: Record<string, string[]> = {};
      (mdata as any[] | null)?.forEach((m) => {
        const key = m.word_id; if (!map[key]) map[key] = []; map[key].push(m.meaning);
      });
      setMeaningsMap(map);
    } else {
      setMeaningsMap({});
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchLecture();
    fetchWords();
    // load preferred view mode
    if (typeof window !== 'undefined') {
      const pref = localStorage.getItem('wordsViewMode');
      if (pref === 'grid' || pref === 'list') setViewMode(pref);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lectureId]);
  useEffect(() => {
    if (typeof window !== 'undefined') localStorage.setItem('wordsViewMode', viewMode);
  }, [viewMode]);

  const getNextOrder = async () => {
    const { data, error } = await supabase
      .from('words')
      .select('order_in_lecture')
      .eq('lecture_id', lectureId)
      .order('order_in_lecture', { ascending: false })
      .limit(1);
    if (error || !data || data.length === 0) return 0;
    const max = data[0].order_in_lecture ?? 0;
    return (max as number) + 1;
  };

  // Reorder helpers
  const persistOrder = async (orderedWords: Word[]) => {
    try {
      const ids = orderedWords.map((w) => w.word_id);
      const { error } = await supabase.rpc('reorder_words', { p_lecture_id: lectureId, p_word_ids: ids });
      if (error) throw error;
      showToast('Đã cập nhật thứ tự', { type: 'success' });
    } catch (err: any) {
      const details = [err?.message, err?.details, err?.hint, err?.code].filter(Boolean).join(' | ');
      showToast(details || 'Không thể cập nhật thứ tự', { type: 'error' });
    }
  };

  const handleReorder = async (fromId: string, toId: string) => {
    // Only when not filtering and user can edit
    if (!canEdit) return;
    if (query.trim() !== '') {
      showToast('Hãy xóa ô tìm kiếm trước khi sắp xếp', { type: 'warning' });
      return;
    }
    if (fromId === toId) return;
    const current = [...words].sort((a, b) => (a.order_in_lecture ?? 0) - (b.order_in_lecture ?? 0));
    const fromIdx = current.findIndex((w) => w.word_id === fromId);
    const toIdx = current.findIndex((w) => w.word_id === toId);
    if (fromIdx < 0 || toIdx < 0) return;
    const item = current.splice(fromIdx, 1)[0];
    current.splice(toIdx, 0, item);
    // Update local state immediately
    const updated = current.map((w, idx) => ({ ...w, order_in_lecture: idx }));
    setWords(updated);
    setDraggingId(null);
    setDragOverId(null);
    await persistOrder(updated);
  };

  const onDragStartItem = (wid: string) => (e: React.DragEvent) => {
    if (!canEdit || query.trim() !== '') return e.preventDefault();
    setDraggingId(wid);
    e.dataTransfer.effectAllowed = 'move';
  };
  const onDragOverItem = (wid: string) => (e: React.DragEvent) => {
    if (draggingId == null) return;
    e.preventDefault();
    if (wid === draggingId) return; // keep target stable when pointer is over the dragged element itself
    if (dragOverId === wid) return;
    setDragOverId(wid);
    e.dataTransfer.dropEffect = 'move';
  };
  const onDropItem = (wid: string) => async (e: React.DragEvent) => {
    e.preventDefault();
    if (draggingId == null) return;
    const targetId = wid !== draggingId ? wid : (dragOverId && dragOverId !== draggingId ? dragOverId : draggingId);
    if (targetId && targetId !== draggingId) {
      await handleReorder(draggingId, targetId);
    }
    setDragOverId(null);
    setDraggingId(null);
  };
  const onDragEndItem = () => {
    setDragOverId(null);
    setDraggingId(null);
  };
  const dragClass = (wid: string) =>
    draggingId === wid
      ? 'opacity-60'
      : dragOverId === wid
      ? 'ring-2 ring-black/20 dark:ring-white/30'
      : '';

  const [form, setForm] = useState<{ text: string; ipa: string; order: string; imagePath: string | null; audioPath: string | null; meanings: MeaningItem[] }>({ text: '', ipa: '', order: '', imagePath: null, audioPath: null, meanings: [] });
  const [textSuggestions, setTextSuggestions] = useState<string[]>([]);
  const [meaningSuggestions, setMeaningSuggestions] = useState<MeaningItem[]>([]);
  const [fetchingDict, setFetchingDict] = useState(false);

  const uploadTo = async (file: File, bucket: string) => {
    const ext = file.name.split('.').pop();
    const fileName = `${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from(bucket).upload(fileName, file, { cacheControl: '3600', upsert: false });
    if (error) throw error;
    return fileName;
  };

  const maybeUploadAudioOnSave = async (audioPath: string | null): Promise<string | null> => {
    if (!audioPath) return null;
    if (audioPath.startsWith('blob:')) {
      // fetch blob and upload
      const resp = await fetch(audioPath);
      const blob = await resp.blob();
      const file = new File([blob], 'phrase.wav', { type: 'audio/wav' });
      const path = await uploadTo(file, 'word-audios');
      return path;
    }
    // keep http URL as is to save storage
    return audioPath;
  };

  // Compose audio for phrases by concatenating word audios
  const composePhraseAudio = async (text: string): Promise<string | null> => {
    try {
      const tokens = text.split(/[\s-]+/).filter(Boolean).slice(0, 6);
      if (tokens.length < 2) return null;
      // Fetch audio buffers for tokens
      const AC = (window as any).AudioContext || (window as any).webkitAudioContext;
      const decodeCtx: AudioContext = new AC();
      const buffers: AudioBuffer[] = [];
      for (const tk of tokens) {
        const r = await fetchDictionary(tk);
        if (!r.audio) continue;
        const resp = await fetch(r.audio);
        if (!resp.ok) continue;
        const arr = await resp.arrayBuffer();
        const buf = await decodeCtx.decodeAudioData(arr.slice(0));
        // convert to mono for simplicity
        const mono = decodeCtx.createBuffer(1, buf.length, buf.sampleRate);
        mono.copyToChannel(buf.getChannelData(0), 0);
        buffers.push(mono);
      }
      decodeCtx.close();
      if (buffers.length === 0) return null;
      const sampleRate = 44100;
      const gapSec = 0.12;
      const totalSeconds = buffers.reduce((s, b) => s + b.duration, 0) + gapSec * (buffers.length - 1);
      const totalFrames = Math.ceil(totalSeconds * sampleRate);
      const offline = new (window as any).OfflineAudioContext(1, totalFrames, sampleRate);
      let t = 0;
      for (const b of buffers) {
        const src = offline.createBufferSource();
        // Resample if needed by creating a new buffer in offline context
        const buf = offline.createBuffer(1, Math.floor(b.duration * sampleRate), sampleRate);
        buf.copyToChannel(b.getChannelData(0), 0);
        src.buffer = buf;
        src.connect(offline.destination);
        src.start(t);
        t += buf.duration + gapSec;
      }
      const rendered = await offline.startRendering();
      // Encode to WAV and return a blob url (no auto-upload)
      const wavBlob = encodeWav(rendered);
      const url = URL.createObjectURL(wavBlob);
      return url;
    } catch {
      return null;
    }
  };

  function encodeWav(buffer: AudioBuffer): Blob {
    const numOfChan = 1;
    const sampleRate = buffer.sampleRate;
    const samples = buffer.getChannelData(0);
    const blockAlign = numOfChan * 2;
    const byteRate = sampleRate * blockAlign;
    const dataSize = samples.length * 2;
    const bufferArray = new ArrayBuffer(44 + dataSize);
    const view = new DataView(bufferArray);
    // RIFF chunk descriptor
    writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + dataSize, true);
    writeString(view, 8, 'WAVE');
    // fmt sub-chunk
    writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true); // PCM
    view.setUint16(22, numOfChan, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, byteRate, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, 16, true); // bits per sample
    // data sub-chunk
    writeString(view, 36, 'data');
    view.setUint32(40, dataSize, true);
    floatTo16BitPCM(view, 44, samples);
    return new Blob([view], { type: 'audio/wav' });
  }

  function writeString(view: DataView, offset: number, str: string) {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  }
  function floatTo16BitPCM(view: DataView, offset: number, input: Float32Array) {
    let pos = 0;
    for (; pos < input.length; pos++, offset += 2) {
      let s = Math.max(-1, Math.min(1, input[pos]));
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    }
  }

  const resetForm = () => {
    setForm({ text: '', ipa: '', order: '', imagePath: null, audioPath: null, meanings: [] });
    setTextSuggestions([]);
    setMeaningSuggestions([]);
  };

  const openCreateModal = async () => {
    resetForm();
    const next = await getNextOrder();
    setForm((f) => ({ ...f, order: String(next) }));
    setCreating(true);
  };

  // Lookup helpers
  const fetchTextSuggestions = async (text: string) => {
    if (!text) return setTextSuggestions([]);
    try {
      const res = await fetch(`https://api.datamuse.com/sug?s=${encodeURIComponent(text)}`);
      const data = await res.json();
      setTextSuggestions((data as any[]).slice(0, 5).map((d) => d.word));
    } catch {}
  };

  const fetchDictionary = async (text: string): Promise<DictResult> => {
    // Try straight lookup
    const fetchOnce = async (q: string) => {
      try {
        const res = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(q)}`);
        if (!res.ok) return null;
        const data = await res.json();
        const entry = Array.isArray(data) ? data[0] : null;
        if (!entry) return null;
        const ipa = entry.phonetic || (entry.phonetics?.find((p: any) => p.text)?.text) || '';
        const audio = (entry.phonetics || []).find((p: any) => p.audio)?.audio || null;
        const meanings: MeaningItem[] = [];
        (entry.meanings || []).forEach((m: any) => {
          (m.definitions || []).forEach((def: any) => {
            if (def.definition) meanings.push({ part_of_speech: m.partOfSpeech, meaning: def.definition });
          });
        });
        return { ipa, audio, meanings: meanings.slice(0, 5) } as DictResult;
      } catch {
        return null;
      }
    };

    // 1) Direct
    const direct = await fetchOnce(text);
    if (direct) return direct;

    // 2) Variants for phrases (space/hyphen)
    const variants = new Set<string>();
    variants.add(text.replace(/\s+/g, '-'));
    variants.add(text.replace(/[-]+/g, ' '));
    for (const v of variants) {
      const r = await fetchOnce(v);
      if (r) return r;
    }

    // 3) If phrase: combine token IPAs; DO NOT return token audio to avoid playing first word only
    const tokens = text.split(/[\s-]+/).filter(Boolean).slice(0, 4);
    if (tokens.length > 1) {
      const tokenResults: DictResult[] = [];
      for (const t of tokens) {
        const r = await fetchOnce(t);
        if (r) tokenResults.push(r);
      }
      if (tokenResults.length > 0) {
        const ipa = tokenResults.map((r) => r.ipa).filter(Boolean).join(' ');
        const audio = null; // important: force later composition instead of using first token audio
        const meanings = tokenResults.flatMap((r) => r.meanings || []).slice(0, 5);
        return { ipa, audio, meanings };
      }
    }

    // 4) As a last resort, use a Datamuse suggestion (may return a phrase)
    try {
      const sres = await fetch(`https://api.datamuse.com/sug?s=${encodeURIComponent(text)}`);
      const sdata = await sres.json();
      const suggestion: string | undefined = (sdata as any[])[0]?.word;
      if (suggestion) {
        const sug = (await fetchOnce(suggestion)) || undefined;
        if (sug) return sug;
      }
    } catch {}

    return {};
  };

  const translateToVietnamese = async (definitions: string[], limit = 3): Promise<string[]> => {
    try {
      const top = definitions.slice(0, limit);
      if (top.length === 0) return [];
      const res = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ texts: top, target: 'vi' }),
      });
      if (!res.ok) return [];
      const data = await res.json();
      return (data.translations as string[]) || [];
    } catch {
      return [];
    }
  };

  useEffect(() => {
    // when text changes, debounce then refresh suggestions + overwrite IPA/Audio
    const t = form.text.trim();
    let cancelled = false;
    const timer = setTimeout(async () => {
      if (cancelled) return;
      if (!t) {
        setTextSuggestions([]);
        setMeaningSuggestions([]);
        setForm((f) => ({ ...f, ipa: '', audioPath: null }));
        return;
      }
      setFetchingDict(true);
      await fetchTextSuggestions(t);
      const dict = await fetchDictionary(t);
      if (cancelled) return;
      setForm((f) => ({
        ...f,
        ipa: dict.ipa ?? '',
        audioPath: dict.audio ?? null,
      }));
      // Build suggestions: 3 vi + 2 en
      const enDefs = (dict.meanings || []).map((m) => m.meaning);
      const vi = await translateToVietnamese(enDefs, 3);
      const viItems: MeaningItem[] = vi.map((v) => ({ part_of_speech: 'vi', meaning: v }));
      const enItems: MeaningItem[] = (dict.meanings || []).slice(0, 2);
      setMeaningSuggestions([...viItems, ...enItems]);
      if (!dict.audio && /[\s-]/.test(t)) {
        const path = await composePhraseAudio(t);
        if (!cancelled && path) setForm((f) => ({ ...f, audioPath: path }));
      }
      setFetchingDict(false);
    }, 500);
    return () => { cancelled = true; clearTimeout(timer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.text]);

  const addMeaning = (m?: MeaningItem) => setForm((f) => ({ ...f, meanings: [...f.meanings, m ?? { meaning: '' }] }));
  const removeMeaning = (idx: number) => setForm((f) => ({ ...f, meanings: f.meanings.filter((_, i) => i !== idx) }));
  const updateMeaning = (idx: number, value: string) => setForm((f) => ({ ...f, meanings: f.meanings.map((m, i) => (i === idx ? { ...m, meaning: value } : m)) }));

  const submitCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      const idx = form.order.trim() === '' ? await getNextOrder() : parseInt(form.order, 10);
      if (Number.isNaN(idx) || idx < 0) throw new Error('Thứ tự phải là số không âm');
      const audioToSave = await maybeUploadAudioOnSave(form.audioPath);
      const { data, error } = await supabase
        .from('words')
        .insert([{ lecture_id: lectureId, text: form.text, ipa: form.ipa || null, image_url: form.imagePath, audio_url: audioToSave, order_in_lecture: idx }])
        .select('word_id,lecture_id,order_in_lecture,text,image_url,ipa,audio_url')
        .single();
      if (error) throw error;
      const wid = (data as any)?.word_id as string;
      if (wid && form.meanings.length > 0) {
        const payload = form.meanings
          .filter((m) => m.meaning.trim() !== '')
          .map((m) => ({ word_id: wid, part_of_speech: m.part_of_speech || null, meaning: m.meaning, example_sentence: null }));
        if (payload.length > 0) await supabase.from('wordmeanings').insert(payload);
        // update meanings map optimistically
        setMeaningsMap((mp) => ({ ...mp, [wid]: payload.map((p) => p.meaning) }));
      }
      showToast('Đã thêm từ vựng', { type: 'success' });
      // optimistic add
      setWords((prev) => {
        const next = [...prev, (data as any) as Word];
        return next.sort((a, b) => (a.order_in_lecture ?? 0) - (b.order_in_lecture ?? 0));
      });
      resetForm();
      setCreating(false);
    } catch (err: any) {
      const details = [err?.message, err?.details, err?.hint, err?.code].filter(Boolean).join(' | ');
      showToast(`Không thể thêm: ${details || 'lỗi không rõ'}`, { type: 'error' });
      console.error('Insert word failed', err);
    } finally {
      setLoading(false);
    }
  };

  const submitEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    try {
      setLoading(true);
      const idx = form.order.trim() === '' ? editing.order_in_lecture ?? 0 : parseInt(form.order, 10);
      if (Number.isNaN(idx) || idx < 0) throw new Error('Thứ tự phải là số không âm');
      const audioToSave = await maybeUploadAudioOnSave(form.audioPath);
      const { error } = await supabase
        .from('words')
        .update({ text: form.text, ipa: form.ipa || null, image_url: form.imagePath, audio_url: audioToSave, order_in_lecture: idx })
        .eq('word_id', editing.word_id);
      if (error) throw error;
      // Simplify: replace all meanings with current list
      await supabase.from('wordmeanings').delete().eq('word_id', editing.word_id);
      const payload = form.meanings
        .filter((m) => m.meaning.trim() !== '')
        .map((m) => ({ word_id: editing.word_id, part_of_speech: m.part_of_speech || null, meaning: m.meaning, example_sentence: null }));
      if (payload.length > 0) await supabase.from('wordmeanings').insert(payload);
      showToast('Đã lưu từ vựng', { type: 'success' });
      // optimistic update
      setWords((prev) => prev.map((w) => (w.word_id === editing.word_id ? { ...w, text: form.text, ipa: form.ipa || null, image_url: form.imagePath, audio_url: audioToSave, order_in_lecture: idx } as Word : w)));
      setMeaningsMap((mp) => ({ ...mp, [editing.word_id]: payload.map((p) => p.meaning) }));
      setEditing(null);
    } catch (err: any) {
      const details = [err?.message, err?.details, err?.hint, err?.code].filter(Boolean).join(' | ');
      showToast(`Không thể lưu: ${details || 'lỗi không rõ'}`, { type: 'error' });
      console.error('Update word failed', err);
    } finally {
      setLoading(false);
    }
  };

  const onDelete = async (w: Word) => {
    if (!confirm(`Xóa từ "${w.text}"?`)) return;
    const { error } = await supabase.from('words').delete().eq('word_id', w.word_id);
    if (error) return showToast(error.message, { type: 'error' });
    showToast('Đã xóa từ', { type: 'success' });
    // optimistic remove and compact order
    setWords((prev) => {
      const remain = prev.filter((x) => x.word_id !== w.word_id).sort((a, b) => (a.order_in_lecture ?? 0) - (b.order_in_lecture ?? 0));
      const reindexed = remain.map((x, i) => ({ ...x, order_in_lecture: i }));
      // persist new order silently
      persistOrder(reindexed);
      return reindexed;
    });
    setMeaningsMap((mp) => {
      const { [w.word_id]: _, ...rest } = mp as any;
      return rest;
    });
  };

  const beginEdit = (w: Word) => {
    setEditing(w);
    setForm({ text: w.text, ipa: w.ipa ?? '', order: w.order_in_lecture != null ? String(w.order_in_lecture) : '', imagePath: w.image_url, audioPath: w.audio_url, meanings: [] });
    // Load meanings for this word
    (async () => {
      const { data } = await supabase.from('wordmeanings').select('meaning,part_of_speech').eq('word_id', w.word_id).order('meaning_added_at', { ascending: true });
      setForm((f) => ({ ...f, meanings: ((data as any) ?? []).map((m: any) => ({ meaning: m.meaning, part_of_speech: m.part_of_speech || undefined })) }));
    })();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Từ vựng của bài giảng</h1>
        <button onClick={() => router.back()} className="border rounded px-4 py-2 text-sm">Quay lại</button>
      </div>
      <div className="text-sm text-neutral-600 dark:text-neutral-300">{lectureTitle}</div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <input
          placeholder="Tìm từ..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full rounded-md border px-3 py-2 bg-transparent"
        />
        {canEdit && (
          <button onClick={openCreateModal} className="h-10 px-4 rounded-md bg-black text-white dark:bg-white dark:text-black text-sm">Thêm từ</button>
        )}
         {/* view switch */}
        <div className="ml-auto">
          <div className="inline-flex items-center border rounded-full p-1 bg-neutral-50 dark:bg-neutral-900">
            <button
              onClick={() => setViewMode('grid')}
              className={`px-3 py-1.5 rounded-full text-sm transition ${viewMode === 'grid' ? 'bg-black text-white dark:bg-white dark:text-black shadow' : 'text-neutral-600 hover:text-neutral-900 dark:hover:text-white'}`}
              aria-label="Dạng ô"
              title="Dạng ô"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="4" y="4" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
                <rect x="13" y="4" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
                <rect x="4" y="13" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
                <rect x="13" y="13" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
              </svg>
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`px-3 py-1.5 rounded-full text-sm transition ${viewMode === 'list' ? 'bg-black text-white dark:bg-white dark:text-black shadow' : 'text-neutral-600 hover:text-neutral-900 dark:hover:text-white'}`}
              aria-label="Dạng hàng"
              title="Dạng hàng"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="4" y="5" width="16" height="3" rx="1.5" fill="currentColor"/>
                <rect x="4" y="10.5" width="16" height="3" rx="1.5" fill="currentColor"/>
                <rect x="4" y="16" width="16" height="3" rx="1.5" fill="currentColor"/>
              </svg>
            </button>
          </div>
        </div>
      </div>

      {viewMode === 'grid' ? (
        <div className="grid gap-3 grid-cols-1 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
          {loading ? (
            <div className="p-4 col-span-full">Đang tải…</div>
          ) : filtered.length === 0 ? (
            <div className="p-4 col-span-full">Không có từ.</div>
          ) : (
            previewed.map((w) => {
              const img = toPublicUrl(w.image_url, 'word-images');
              const aud = toPublicUrl(w.audio_url, 'word-audios');
              return (
                <div
                  key={w.word_id}
                  className={`rounded-lg border overflow-hidden flex flex-col p-2 transition-all duration-150 transform hover:-translate-y-1 hover:shadow-lg ${dragClass(w.word_id)}`}
                  draggable={canEdit && query.trim() === ''}
                  onDragStart={onDragStartItem(w.word_id)}
                  onDragOver={onDragOverItem(w.word_id)}
                  onDrop={onDropItem(w.word_id)}
                  onDragEnd={onDragEndItem}
                >
                  <div className="flex items-center justify-between text-xs text-neutral-500 mb-2">
                    <span>#{w.order_in_lecture ?? 0}</span>
                    {w.ipa && <span>[{w.ipa}]</span>}
                  </div>
                  {/* image (default to logo if missing) */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={img ?? '/logo.svg'} alt={w.text} className="w-full h-14 object-contain bg-neutral-100 dark:bg-neutral-900 rounded" />
                  <div className="mt-2 font-semibold truncate" title={w.text}>{w.text}</div>
                  <div className="text-xs text-neutral-600 dark:text-neutral-300 truncate" title={(meaningsMap[w.word_id] || []).join(' / ')}>
                    {(meaningsMap[w.word_id] || []).slice(0, 3).join(' / ') || '-'}
                  </div>
                  <div className="mt-2">
                    <button onClick={() => { beginEdit(w); setEditMode(false); }} className="border rounded px-3 py-2 text-sm w-full text-center">Xem chi tiết</button>
                    {aud && (<audio className="mt-2 w-full" controls src={aud} />)}
                  </div>
                </div>
              );
            })
          )}
        </div>
      ) : (
        <div className="rounded-md overflow-x-auto space-y-2">
          {loading ? (
            <div className="p-4">Đang tải…</div>
          ) : filtered.length === 0 ? (
            <div className="p-4">Không có từ.</div>
          ) : (
            previewed.map((w) => {
              const img = toPublicUrl(w.image_url, 'word-images');
              const aud = toPublicUrl(w.audio_url, 'word-audios');
              const meaningsText = (meaningsMap[w.word_id] || []).slice(0, 3).join(' / ');
              return (
                <div
                  key={w.word_id}
                  className={`flex items-center gap-4 p-3 border rounded-lg hover:shadow-sm transition-all duration-150 bg-white dark:bg-transparent ${dragClass(w.word_id)}`}
                  draggable={canEdit && query.trim() === ''}
                  onDragStart={onDragStartItem(w.word_id)}
                  onDragOver={onDragOverItem(w.word_id)}
                  onDrop={onDropItem(w.word_id)}
                  onDragEnd={onDragEndItem}
                >
                  <div className="text-xs text-neutral-500 w-10 shrink-0">#{w.order_in_lecture ?? 0}</div>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={img ?? '/logo.svg'} alt={w.text} className="h-12 w-12 object-contain bg-neutral-100 dark:bg-neutral-900 rounded" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <div className="font-semibold truncate" title={w.text}>{w.text}</div>
                      {w.ipa && <div className="text-xs text-neutral-500">[{w.ipa}]</div>}
                    </div>
                    <div className="text-xs text-neutral-600 dark:text-neutral-300 truncate" title={meaningsText || '-' }>{meaningsText || '-'}</div>
                  </div>
                  {aud && (<audio className="hidden sm:block w-44" controls src={aud} />)}
                  <button onClick={() => { beginEdit(w); setEditMode(false); }} className="border rounded px-3 py-2 text-sm whitespace-nowrap">Xem chi tiết</button>
                </div>
              );
            })
          )}
        </div>
      )}

      {(creating || editing) && (
        <div className="fixed inset-0 bg-black/40 z-[1200] flex items-center justify-center p-4" onClick={() => { if (editing) { setCreating(false); setEditing(null); } }}>
          <div className="w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-lg border bg-background p-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold">{editing ? 'Chi tiết từ' : 'Thêm từ'}</h2>
              <button onClick={() => { setCreating(false); setEditing(null); }} className="text-sm border rounded px-2 py-1">Đóng</button>
            </div>
            <form onSubmit={editing ? submitEdit : submitCreate} className="space-y-3">
              <div>
                <label className="block text-sm font-medium">Từ</label>
                <input value={form.text} onChange={(e) => { setForm((f) => ({ ...f, text: e.target.value })); }} required disabled={!!editing && !editMode} className="w-full rounded-md border px-3 py-2 bg-transparent" />
                {(!editing || editMode) && textSuggestions.length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-2 text-xs">
                    {textSuggestions.map((s) => (
                      <button type="button" key={s} onClick={() => setForm((f) => ({ ...f, text: s }))} className="border rounded px-2 py-1">{s}</button>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium">IPA</label>
                <input value={form.ipa} onChange={(e) => setForm((f) => ({ ...f, ipa: e.target.value }))} disabled={!!editing && !editMode} className="w-full rounded-md border px-3 py-2 bg-transparent" />
                {fetchingDict && <div className="text-xs text-neutral-500 mt-1">Đang gợi ý IPA...</div>}
              </div>
              <div>
                <label className="block text-sm font-medium">Thứ tự</label>
                <input value={form.order} onChange={(e) => setForm((f) => ({ ...f, order: e.target.value }))} disabled={!!editing && !editMode} className="w-full rounded-md border px-3 py-2 bg-transparent" inputMode="numeric" />
              </div>
              <div>
                <label className="block text-sm font-medium">Ảnh (bucket: word-images)</label>
                <input type="file" accept="image/*" disabled={!!editing && !editMode} onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  try {
                    const p = await uploadTo(file, 'word-images');
                    setForm((f) => ({ ...f, imagePath: p }));
                    showToast('Đã upload ảnh', { type: 'success' });
                  } catch (err: any) {
                    showToast(err.message ?? 'Upload ảnh thất bại', { type: 'error' });
                  }
                }} />
              </div>
              <div>
                <label className="block text-sm font-medium">Audio (bucket: word-audios)</label>
                <input type="file" accept="audio/*" disabled={!!editing && !editMode} onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  try {
                    const p = await uploadTo(file, 'word-audios');
                    setForm((f) => ({ ...f, audioPath: p }));
                    showToast('Đã upload audio', { type: 'success' });
                  } catch (err: any) {
                    showToast(err.message ?? 'Upload audio thất bại', { type: 'error' });
                  }
                }} />
                {form.audioPath && (
                  <audio className="mt-1" controls src={form.audioPath.startsWith('http') || form.audioPath.startsWith('blob:') ? form.audioPath : toPublicUrl(form.audioPath, 'word-audios') || undefined} />
                )}
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-sm font-medium">Các nghĩa</label>
                  <button type="button" onClick={() => addMeaning()} disabled={!!editing && !editMode} className="text-xs border rounded px-2 py-1">+ Thêm nghĩa</button>
                </div>
                {(!editing || editMode) && meaningSuggestions.length > 0 && (
                  <div className="mb-2 flex flex-wrap gap-2 text-xs">
                    {meaningSuggestions.map((m, i) => (
                      <button type="button" key={i} onClick={() => addMeaning(m)} disabled={!!editing && !editMode} className="border rounded px-2 py-1" title={m.part_of_speech || ''}>{m.meaning}</button>
                    ))}
                  </div>
                )}
                <div className="grid gap-2">
                  {form.meanings.map((m, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <input value={m.meaning} onChange={(e) => updateMeaning(idx, e.target.value)} placeholder={`Nghĩa #${idx + 1}`} disabled={!!editing && !editMode} className="flex-1 rounded-md border px-3 py-2 bg-transparent" />
                      <button type="button" onClick={() => removeMeaning(idx)} disabled={!!editing && !editMode} className="text-xs border rounded px-2 py-1">Xóa</button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                {editing ? (
                  <>
                    {!editMode && (
                      <>
                        {canEdit && <button type="button" onClick={() => setEditMode(true)} className="border rounded px-4 py-2 text-sm">Sửa</button>}
                        {canEdit && <button type="button" onClick={() => { if (editing) onDelete(editing); }} className="border rounded px-4 py-2 text-sm">Xóa</button>}
                      </>
                    )}
                    {editMode && canEdit && (
                      <button type="submit" className="rounded bg-black text-white dark:bg-white dark:text-black px-4 py-2 text-sm">Lưu</button>
                    )}
                    <button type="button" onClick={() => { setCreating(false); setEditing(null); }} className="border rounded px-4 py-2 text-sm">Hủy</button>
                  </>
                ) : (
                  <>
                    <button type="button" onClick={() => { setCreating(false); setEditing(null); }} className="border rounded px-4 py-2 text-sm">Hủy</button>
                    {canEdit && <button type="submit" className="rounded bg-black text-white dark:bg-white dark:text-black px-4 py-2 text-sm">Thêm</button>}
                  </>
                )}
              </div>
            </form>
            <p className="text-xs text-neutral-500 mt-2">Gợi ý: tạo bucket public "word-images" và "word-audios" để hiển thị media.</p>
          </div>
        </div>
      )}
    </div>
  );
}
