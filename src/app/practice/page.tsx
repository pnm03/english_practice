'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { getBrowserSupabaseClient } from '@/lib/supabaseClient';

type Word = {
  word_id: string;
  lecture_id: string;
  text: string;
  ipa: string | null;
  audio_url?: string | null;
};

export default function PracticePage() {
  const params = useSearchParams();
  const router = useRouter();
  const lectureId = params.get('lectureId');
  const supabase = useMemo(() => getBrowserSupabaseClient(), []);

  const [tab, setTab] = useState<'practice' | 'exam' | 'wrong'>('practice');
  const [words, setWords] = useState<Word[]>([]);
  const [meanings, setMeanings] = useState<Record<string, string>>({});
  const [allMeanings, setAllMeanings] = useState<Record<string, string[]>>({});
  const [idx, setIdx] = useState(0);
  const [attempts, setAttempts] = useState(0);
  const [message, setMessage] = useState<string>('');
  const [autoNext, setAutoNext] = useState(true);
  const [loading, setLoading] = useState(false);
  const [input, setInput] = useState('');
  const [answered, setAnswered] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const current = words[idx];
  const total = words.length;

  // Config section
  const [courses, setCourses] = useState<any[]>([]);
  const [lectures, setLectures] = useState<any[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<string | null>(null);
  const [selectedCourseName, setSelectedCourseName] = useState<string>('');
  const [selectedLectures, setSelectedLectures] = useState<Set<string>>(new Set());
  const [wordsByLecture, setWordsByLecture] = useState<Record<string, Word[]>>({});
  const [selectedWordIds, setSelectedWordIds] = useState<Set<string>>(new Set());
  const [explicitSelect, setExplicitSelect] = useState<boolean>(false);
  const [questionCount, setQuestionCount] = useState<number>(0);
  const [shuffle, setShuffle] = useState<boolean>(false);
  const [direction, setDirection] = useState<'vi2en' | 'en2vi' | 'random'>('vi2en');
  const [configured, setConfigured] = useState<boolean>(false);
  const [stats, setStats] = useState<{topWrong: Array<{word_id:string; text:string; count:number}>}>({ topWrong: [] });
  const [loadingLectures, setLoadingLectures] = useState(false);
  const [modes, setModes] = useState<Array<'vi2en'|'en2vi'>>([]);
  const [practiceResults, setPracticeResults] = useState<Array<{word: Word; userAnswer: string; correct: boolean; attempts: number}>>([]);
  const [showResults, setShowResults] = useState(false);
  const [isReviewMode, setIsReviewMode] = useState(false);
  const [currentProgressIdx, setCurrentProgressIdx] = useState(0); // Track actual progress (max index reached)

  const toPublicUrl = (p: string | null | undefined, bucket: string) => {
    if (!p) return null;
    if (p.startsWith('http')) return p;
    try { return supabase.storage.from(bucket).getPublicUrl(p).data.publicUrl; } catch { return null; }
  };

  useEffect(() => {
    if (!lectureId) return;
    (async () => {
      setLoading(true);
      const { data: w } = await supabase
        .from('words')
        .select('word_id,lecture_id,text,ipa,audio_url')
        .eq('lecture_id', lectureId)
        .order('order_in_lecture', { ascending: true });
      const list = (w as any[]) || [];
      setWords(list as Word[]);
      if (list.length > 0) {
        const ids = list.map((x) => x.word_id);
        const { data: m } = await supabase
          .from('wordmeanings')
          .select('word_id,meaning')
          .in('word_id', ids)
          .order('meaning_added_at', { ascending: true });
        const map: Record<string, string> = {};
        const multi: Record<string, string[]> = {};
        (m as any[] | null)?.forEach((row) => {
          if (!map[row.word_id]) map[row.word_id] = row.meaning;
          if (!multi[row.word_id]) multi[row.word_id] = [];
          multi[row.word_id].push(row.meaning);
        });
        setMeanings(map);
        setAllMeanings(multi);
      }
      setLoading(false);
    })();
  }, [lectureId, supabase]);

  // Load courses for config with lecture counts
  const [courseLectureCounts, setCourseLectureCounts] = useState<Record<string, number>>({});
  useEffect(() => {
    (async () => {
      const { data: cs } = await supabase.from('courses').select('course_id,name');
      setCourses((cs as any[]) || []);
      const { data: lc } = await supabase.from('lectures').select('course_id');
      const counts: Record<string, number> = {};
      (lc as any[] || []).forEach((r: any) => { counts[r.course_id] = (counts[r.course_id] || 0) + 1; });
      setCourseLectureCounts(counts);
    })();
  }, [supabase]);

  // When selecting course, load lectures and words
  useEffect(() => {
    if (!selectedCourse) return;
    (async () => {
      setLoadingLectures(true);
      const { data: ls } = await supabase
        .from('lectures')
        .select('lecture_id,title')
        .eq('course_id', selectedCourse)
        .order('title');
      const lectureList = (ls as any[]) || [];
      setLectures(lectureList);
      // Fetch words for these lectures
      const ids = lectureList.map((l) => l.lecture_id);
      if (ids.length === 0) return;
      const { data: ws } = await supabase
        .from('words')
        .select('word_id,lecture_id,text,ipa,audio_url')
        .in('lecture_id', ids)
        .order('order_in_lecture', { ascending: true });
      const map: Record<string, Word[]> = {};
      (ws as any[] || []).forEach((w: any) => {
        if (!map[w.lecture_id]) map[w.lecture_id] = [];
        map[w.lecture_id].push(w as Word);
      });
      setWordsByLecture(map);
      setLoadingLectures(false);
    })();
  }, [selectedCourse, supabase]);

  // Load simple stats (top wrong words) for selected lectures
  useEffect(() => {
    (async () => {
      const lids = Array.from(selectedLectures);
      if (lids.length === 0) { setStats({ topWrong: [] }); return; }
      const ids = lids.flatMap((id) => (wordsByLecture[id] || []).map((w) => w.word_id));
      if (ids.length === 0) { setStats({ topWrong: [] }); return; }
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData?.user?.id;
      if (!userId) { setStats({ topWrong: [] }); return; }
      const { data: nt } = await supabase
        .from('note')
        .select('word_id')
        .eq('user_id', userId)
        .in('word_id', ids);
      const counts: Record<string, number> = {};
      (nt as any[] || []).forEach((n) => { counts[n.word_id] = (counts[n.word_id] || 0) + 1; });
      const arr = Object.entries(counts)
        .sort((a,b)=>b[1]-a[1])
        .slice(0, 10)
        .map(([word_id,count]) => {
          const w = lids.flatMap((lid)=> wordsByLecture[lid] || []).find((x)=>x.word_id===word_id);
          return { word_id, text: w?.text || word_id, count: count as number };
        });
      setStats({ topWrong: arr });
    })();
  }, [selectedLectures, wordsByLecture, supabase]);

  useEffect(() => {
    // reset per-word state
    setInput('');
    setAttempts(0);
    setMessage('');
    setAnswered(false);
    setTimeout(() => inputRef.current?.focus(), 0);
  }, [idx]);

  const maskHint = (target: string) => {
    const t = target.trim();
    if (t.length <= 2) return '*'.repeat(t.length);
    const first = t[0];
    const last = t[t.length - 1];
    return `${first}${'*'.repeat(Math.max(1, t.length - 2))}${last}`;
  };

  const removeVietnameseAccents = (str: string) => {
    return str
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Remove accents
      .replace(/đ/g, 'd')
      .replace(/Đ/g, 'D')
      .toLowerCase();
  };

  // Load preferences from localStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedShuffle = localStorage.getItem('practice-shuffle');
      const savedDirection = localStorage.getItem('practice-direction');
      
      if (savedShuffle !== null) {
        setShuffle(savedShuffle === 'true');
      }
      
      if (savedDirection && ['vi2en', 'en2vi', 'random'].includes(savedDirection)) {
        setDirection(savedDirection as 'vi2en' | 'en2vi' | 'random');
      }
    }
  }, []);

  // Save preferences to localStorage when they change
  const handleShuffleChange = (newShuffle: boolean) => {
    setShuffle(newShuffle);
    if (typeof window !== 'undefined') {
      localStorage.setItem('practice-shuffle', newShuffle.toString());
    }
  };

  const handleDirectionChange = (newDirection: 'vi2en' | 'en2vi' | 'random') => {
    setDirection(newDirection);
    if (typeof window !== 'undefined') {
      localStorage.setItem('practice-direction', newDirection);
    }
  };

  const onSubmit = async () => {
    if (!current) return;
    const target = current.text.trim().toLowerCase();
    const value = input.trim().toLowerCase();
    if (!value) return;

    // Direction check - use fixed mode for each question
    const mode = direction === 'random' ? (modes[idx] || 'en2vi') : direction;
    const isCorrect = mode === 'vi2en'
      ? value === target  // vi2en: hiển thị tiếng Việt (meaning), nhập tiếng Anh (target)
      : (allMeanings[current.word_id] || []).some((m) => {
          const meaning = m.trim().toLowerCase();
          // Check exact match first
          if (meaning.includes(value)) return true;
          // Check without accents
          return removeVietnameseAccents(meaning).includes(removeVietnameseAccents(value));
        }); // en2vi: hiển thị tiếng Anh (target), nhập tiếng Việt (meaning)

    if (isCorrect) {
      setMessage('✅ Chính xác!');
      setAnswered(true);
      // Save result
      setPracticeResults(prev => [...prev, { word: current, userAnswer: input.trim(), correct: true, attempts: attempts + 1 }]);
      
      // Check if this is the last question
      if (idx + 1 >= total) {
        setTimeout(() => setShowResults(true), 600);
        return;
      }
      
      if (autoNext) setTimeout(() => {
        setIdx((p) => p + 1);
        setCurrentProgressIdx((p) => Math.max(p, idx + 1));
        setInput('');
        setAnswered(false);
        setAttempts(0);
        setMessage('');
        setTimeout(() => inputRef.current?.focus(), 0);
      }, 600);
      return;
    }

    if (attempts === 0) {
      setAttempts(1);
      setInput(''); // Clear input on first wrong attempt
      // Gợi ý dựa theo hướng luyện tập
      const currentMode = direction === 'random' ? (modes[idx] || 'en2vi') : direction;
      const hint = currentMode === 'en2vi' ? maskHint((allMeanings[current.word_id]?.[0] || '')) : maskHint(current.text);
      setMessage(`Gợi ý: ${hint}`);
      setTimeout(() => inputRef.current?.focus(), 0);
      return;
    }

    // Sai lần 2 → thêm vào note
    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData?.user?.id;
      if (userId) {
        await supabase.from('note').insert([
          { user_id: userId, word_id: current.word_id, note_text: 'Sai trong luyện tập' },
        ] as any);
      }
    } catch {}
    const currentMode = direction === 'random' ? (modes[idx] || 'en2vi') : direction;
    const answer = currentMode === 'en2vi' ? (allMeanings[current.word_id]?.[0] || '') : current.text;
    setMessage(`❌ Sai. Đáp án: ${answer}`);
    setAnswered(true);
    
    // Save result
    setPracticeResults(prev => [...prev, { word: current, userAnswer: input.trim(), correct: false, attempts: attempts + 1 }]);
    
    // Check if this is the last question
    if (idx + 1 >= total) {
      setTimeout(() => setShowResults(true), 900);
      return;
    }
    
    // Don't auto-next when wrong - user needs to manually proceed
  };

  const next = () => {
    // If in review mode, check if we can advance to next available question
    if (isReviewMode) {
      if (idx + 1 <= currentProgressIdx) {
        const newIdx = idx + 1;
        setIdx(newIdx);
        // Check if this is a completed question (has result)
        const nextResult = practiceResults[newIdx];
        if (nextResult) {
          // Show result for completed question
          setInput(nextResult.userAnswer);
          setAnswered(true);
          // Enhanced message showing all details
          const nextMode = direction === 'random' ? (modes[newIdx] || 'en2vi') : direction;
          const correctAnswer = nextMode === 'en2vi' ? (allMeanings[nextResult.word.word_id]?.[0] || '') : nextResult.word.text;
          const resultMessage = nextResult.correct 
            ? `✅ Chính xác! Bạn đã nhập: "${nextResult.userAnswer}" (${nextResult.attempts} lần thử)`
            : `❌ Sai. Bạn đã nhập: "${nextResult.userAnswer}" | Đáp án đúng: "${correctAnswer}" (${nextResult.attempts} lần thử)`;
          setMessage(resultMessage);
        } else {
          // This is the current question being worked on
          setInput('');
          setAnswered(false);
          setAttempts(0);
          setMessage('');
          setIsReviewMode(false);
          setTimeout(() => inputRef.current?.focus(), 0);
        }
      }
      return;
    }
    
    // Normal next logic
    if (idx + 1 >= total) {
      setShowResults(true);
      return;
    }
    setIdx((p) => p + 1);
    setCurrentProgressIdx((p) => Math.max(p, idx + 1));
    setInput('');
    setAnswered(false);
    setAttempts(0);
    setMessage('');
    setTimeout(() => inputRef.current?.focus(), 0);
  };
  
  const prev = () => {
    if (idx > 0) {
      const newIdx = idx - 1;
      setIdx(newIdx);
      // Show previous result in review mode
      const prevResult = practiceResults[newIdx];
      if (prevResult) {
        setInput(prevResult.userAnswer);
        setAnswered(true);
        setIsReviewMode(true);
        // Enhanced message showing all details
        const prevMode = direction === 'random' ? (modes[newIdx] || 'en2vi') : direction;
        const correctAnswer = prevMode === 'en2vi' ? (allMeanings[prevResult.word.word_id]?.[0] || '') : prevResult.word.text;
        const resultMessage = prevResult.correct 
          ? `✅ Chính xác! Bạn đã nhập: "${prevResult.userAnswer}" (${prevResult.attempts} lần thử)`
          : `❌ Sai. Bạn đã nhập: "${prevResult.userAnswer}" | Đáp án đúng: "${correctAnswer}" (${prevResult.attempts} lần thử)`;
        setMessage(resultMessage);
      } else {
        // No result yet, just clear input and show placeholder
        setInput('');
        setAnswered(false);
        setIsReviewMode(true);
        setMessage('Câu này chưa được trả lời');
      }
    }
  };

  const totalWordsSelected = Array.from(selectedLectures).reduce((sum, lid) => sum + (wordsByLecture[lid]?.length || 0), 0);
  useEffect(() => {
    // enforce min number
    if (totalWordsSelected > 0 && questionCount < totalWordsSelected) setQuestionCount(totalWordsSelected);
  }, [totalWordsSelected]);

  return (
    <div className="p-6 space-y-4">

      {showResults ? (
        <div className="space-y-6">
          <div className="text-center">
            <h2 className="text-2xl font-bold mb-2">Kết quả luyện tập</h2>
            <p className="text-neutral-600 dark:text-neutral-400">
              Hoàn thành {practiceResults.length} / {total} câu hỏi
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
            <div className="p-4 border rounded-lg">
              <div className="text-2xl font-bold text-green-600">{practiceResults.filter(r => r.correct).length}</div>
              <div className="text-sm text-neutral-600 dark:text-neutral-400">Đúng</div>
            </div>
            <div className="p-4 border rounded-lg">
              <div className="text-2xl font-bold text-red-600">{practiceResults.filter(r => !r.correct).length}</div>
              <div className="text-sm text-neutral-600 dark:text-neutral-400">Sai</div>
            </div>
            <div className="p-4 border rounded-lg">
              <div className="text-2xl font-bold text-blue-600">
                {practiceResults.length > 0 ? Math.round((practiceResults.filter(r => r.correct).length / practiceResults.length) * 100) : 0}%
              </div>
              <div className="text-sm text-neutral-600 dark:text-neutral-400">Tỷ lệ đúng</div>
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="text-lg font-semibold">Chi tiết từng câu:</h3>
            <div className="space-y-2 max-h-96 overflow-auto">
              {practiceResults.map((result, i) => (
                <div key={i} className={`flex items-center justify-between p-3 rounded border ${result.correct ? 'bg-green-50 dark:bg-green-900/20' : 'bg-red-50 dark:bg-red-900/20'}`}>
                  <div className="flex items-center gap-3">
                    <span className={`text-lg ${result.correct ? 'text-green-600' : 'text-red-600'}`}>
                      {result.correct ? '✅' : '❌'}
                    </span>
                    <div>
                      <div className="font-medium">
                        {direction === 'en2vi' ? result.word.text : (allMeanings[result.word.word_id]?.[0] || meanings[result.word.word_id] || '—')}
                      </div>
                      <div className="text-sm text-neutral-600 dark:text-neutral-400">
                        Câu trả lời: {result.userAnswer || '(Không trả lời)'}
                      </div>
                      {!result.correct && (
                        <div className="text-sm text-red-600 dark:text-red-400">
                          Đáp án: {direction === 'en2vi' ? (allMeanings[result.word.word_id]?.[0] || '') : result.word.text}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="text-sm text-neutral-500">
                    {result.attempts} lần thử
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-3 justify-center">
            <button 
              onClick={() => {
                setShowResults(false);
                setConfigured(false);
                setIdx(0);
                setPracticeResults([]);
                setInput('');
                setAnswered(false);
                setAttempts(0);
                setMessage('');
              }}
              className="border rounded px-6 py-2"
            >
              Luyện tập lại
            </button>
            <button 
              onClick={() => router.push('/practice')}
              className="bg-black text-white dark:bg-white dark:text-black rounded px-6 py-2"
            >
              Về trang chủ
            </button>
          </div>
        </div>
      ) : tab === 'practice' && (
        !configured ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <div className="text-xl font-semibold mb-2">Chọn Bộ Luyện Tập</div>
                <label className="block text-sm mb-1">Chọn khóa lớn:</label>
                <select className="border rounded px-3 py-2 w-full" value={selectedCourse ?? ''} onChange={(e)=>{ const val = e.target.value || null; setSelectedCourse(val); setSelectedLectures(new Set()); const found = courses.find((c:any)=>c.course_id===val); setSelectedCourseName(found?.name || ''); }}>
                  <option value="">-- Chọn khóa học --</option>
                  {courses.map((c)=> (
                    <option key={c.course_id} value={c.course_id}>{c.name} ({courseLectureCounts[c.course_id] || 0} bài giảng)</option>
                  ))}
                </select>
              </div>
              <div>
                <div className="text-sm font-medium mb-1">Chọn khóa nhỏ: {selectedCourse ? `(${lectures.length} bài giảng)` : ''}</div>
                <div className="max-h-64 overflow-auto border rounded p-2 space-y-2">
                  {lectures.map((l)=> {
                    const count = (wordsByLecture[l.lecture_id]?.length || 0);
                    const checked = selectedLectures.has(l.lecture_id);
                    return (
                      <label key={l.lecture_id} className="flex items-center gap-2">
                        <input type="checkbox" checked={checked} onChange={(e)=>{
                          const s = new Set(selectedLectures);
                          if (e.target.checked) s.add(l.lecture_id); else s.delete(l.lecture_id);
                          setSelectedLectures(s);
                          // Reset selected words when lecture toggled
                          setSelectedWordIds(new Set());
                        }} />
                        <span>{l.title} ({count} từ)</span>
                      </label>
                    );
                  })}
                </div>
              </div>
              <div>
                <label className="block text-sm mb-1">Số câu hỏi</label>
                <input type="number" min={Math.max(1,totalWordsSelected)} value={questionCount || 0} onChange={(e)=> setQuestionCount(parseInt(e.target.value || '0',10))} className="border rounded px-3 py-2 w-full" />
                <div className="text-xs text-neutral-500 mt-1">Tối thiểu: {totalWordsSelected}. Nếu nhập nhiều hơn, hệ thống sẽ lặp từ để đủ số câu.</div>
              </div>
              <div>
                <div className="text-sm font-medium mb-1">Kiểu sắp xếp</div>
                <label className="flex items-center gap-2"><input type="radio" checked={!shuffle} onChange={()=>handleShuffleChange(false)} />Không xáo trộn (lần lượt)</label>
                <label className="flex items-center gap-2"><input type="radio" checked={shuffle} onChange={()=>handleShuffleChange(true)} />Xáo trộn (random)</label>
              </div>
              <div>
                <div className="text-sm font-medium mb-1">Chế độ luyện</div>
                <label className="flex items-center gap-2"><input type="radio" checked={direction==='vi2en'} onChange={()=>handleDirectionChange('vi2en')} />Hiển thị tiếng Việt → nhập tiếng Anh</label>
                <label className="flex items-center gap-2"><input type="radio" checked={direction==='en2vi'} onChange={()=>handleDirectionChange('en2vi')} />Hiển thị tiếng Anh → nhập tiếng Việt</label>
                <label className="flex items-center gap-2"><input type="radio" checked={direction==='random'} onChange={()=>handleDirectionChange('random')} />Ngẫu nhiên</label>
              </div>
                <button
                className="rounded bg-black text-white dark:bg-white dark:text-black px-4 py-2"
                disabled={totalWordsSelected === 0}
                onClick={async ()=>{
                  // Build sequence
                  let base: Word[] = [];
                  Array.from(selectedLectures).forEach((lid)=>{ base = base.concat(wordsByLecture[lid] || []); });
                  if (base.length === 0) return;
                  // Apply explicit word selection if any
                  if (explicitSelect && selectedWordIds.size > 0) {
                    base = base.filter((w)=> selectedWordIds.has(w.word_id));
                  }
                  
                  // Load meanings for all selected words
                  const allWordIds = base.map(w => w.word_id);
                  const { data: m } = await supabase
                    .from('wordmeanings')
                    .select('word_id,meaning')
                    .in('word_id', allWordIds)
                    .order('meaning_added_at', { ascending: true });
                  
                  const meaningMap: Record<string, string> = {};
                  const allMeaningsMap: Record<string, string[]> = {};
                  (m as any[] | null)?.forEach((row) => {
                    if (!meaningMap[row.word_id]) meaningMap[row.word_id] = row.meaning;
                    if (!allMeaningsMap[row.word_id]) allMeaningsMap[row.word_id] = [];
                    allMeaningsMap[row.word_id].push(row.meaning);
                  });
                  setMeanings(meaningMap);
                  setAllMeanings(allMeaningsMap);
                  
                  let needed = Math.max(questionCount, base.length);
                  const seq: Word[] = [];
                  let i = 0;
                  while (seq.length < needed) { seq.push(base[i % base.length]); i++; }
                  if (shuffle) {
                    for (let j = seq.length - 1; j > 0; j--) { const r = Math.floor(Math.random() * (j + 1)); [seq[j], seq[r]] = [seq[r], seq[j]]; }
                  }
                  setWords(seq);
                  
                  // Generate random modes if direction is random
                  if (direction === 'random') {
                    const randomModes = seq.map(() => Math.random() < 0.5 ? 'vi2en' : 'en2vi');
                    setModes(randomModes);
                  } else {
                    setModes([]);
                  }
                  
                  setIdx(0);
                  setCurrentProgressIdx(0);
                  setConfigured(true);
                  setAnswered(false);
                  setPracticeResults([]);
                  setIsReviewMode(false);
                  setInput('');
                  setAttempts(0);
                  setMessage('');
                  setTimeout(()=>inputRef.current?.focus(), 0);
                }}
              >Bắt đầu</button>
            </div>
            <div className="space-y-4">
              <div>
                <div className="text-xl font-semibold mb-2">Chọn từ muốn luyện</div>
                <div className="space-y-3 max-h-[420px] overflow-auto">
                  {loadingLectures && (
                    <div className="p-4 text-sm text-neutral-500 animate-pulse">Đang tải bài giảng và từ vựng...</div>
                  )}
                  {Array.from(selectedLectures).map((lid)=> (
                    <div key={lid} className="border rounded p-2">
                      <div className="font-semibold mb-1">{lectures.find((l)=>l.lecture_id===lid)?.title}</div>
                      <ul className="text-sm grid grid-cols-2 gap-2">
                        {(wordsByLecture[lid] || []).map((w)=> {
                          const checked = explicitSelect ? selectedWordIds.has(w.word_id) : true;
                          return (
                            <li key={w.word_id}>
                              <label className="flex items-center gap-1"><input type="checkbox" checked={checked} onChange={(e)=>{
                                let s = new Set(selectedWordIds);
                                if (!explicitSelect) {
                                  const allIds: string[] = Array.from(selectedLectures).flatMap((lid2)=> (wordsByLecture[lid2] || []).map((x)=> x.word_id));
                                  s = new Set(allIds);
                                  setExplicitSelect(true);
                                }
                                if (e.target.checked) s.add(w.word_id); else s.delete(w.word_id);
                                setSelectedWordIds(s);
                              }} />{w.text}</label>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>

              <div className="border rounded p-3">
                <div className="text-sm font-medium mb-2">Thống kê gần đây</div>
                {stats.topWrong.length === 0 ? (
                  <div className="text-sm text-neutral-500">Chưa có dữ liệu sai cho lựa chọn hiện tại.</div>
                ) : (
                  <ul className="text-sm list-disc pl-5">
                    {stats.topWrong.map((t) => (
                      <li key={t.word_id}>{t.text}: {t.count} lần sai</li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        ) : (
        <div className="space-y-3 max-w-4xl mx-auto">
          {/* breadcrumb + progress */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between rounded-md border p-3 gap-2">
            <div className="text-sm truncate">
              {selectedCourseName || 'Khóa học'}
              {' > '}
              {(() => {
                const titles = Array.from(selectedLectures).map((lid)=> lectures.find((l)=>l.lecture_id===lid)?.title).filter(Boolean);
                if (titles.length === 1) return titles[0];
                return `${titles.length} bài giảng`;
              })()} ({total} từ vựng)
            </div>
            <div className="flex items-center gap-3 text-sm">
              <label className="flex items-center gap-2 whitespace-nowrap">
                <input type="checkbox" checked={autoNext} onChange={(e)=>setAutoNext(e.target.checked)} />
                <span className="hidden sm:inline">Tự động tiếp theo nếu trả lời đúng</span>
                <span className="sm:hidden">Auto next</span>
              </label>
            </div>
          </div>

          {/* Notification row */}
          <div className="flex items-center justify-between rounded-md border p-3">
            <div className="text-sm min-h-6 flex items-center gap-2">
              {message ? (
                message
              ) : (
                <div className="animate-pulse">
                  <svg className="w-4 h-4 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                </div>
              )}
            </div>
            <div className="text-sm">{idx + 1}/{total}</div>
          </div>

          {/* Word prompt depends on direction */}
          <div className="rounded-md border p-4 sm:p-6 text-center text-lg sm:text-xl font-semibold min-h-[64px] flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-3">
            {current ? (() => {
              const currentMode = direction === 'random' ? (modes[idx] || 'en2vi') : direction;
              return currentMode === 'en2vi' ? (
                <>
                  <span>{current.text}</span>
                  {current.ipa && <span className="text-sm sm:text-base text-neutral-500">[{current.ipa}]</span>}
                  {current.audio_url && (
                    <audio controls className="h-8 w-full max-w-48"><source src={toPublicUrl(current.audio_url, 'word-audios') || undefined} /></audio>
                  )}
                </>
              ) : (
                <span className="break-words">{allMeanings[current.word_id]?.[0] || meanings[current.word_id] || '—'}</span>
              );
            })() : '—'}
          </div>

          {/* Input */}
          <div className="rounded-md border p-4 sm:p-6">
            <input
              value={input}
              onChange={(e) => !isReviewMode && setInput(e.target.value)}
              onKeyDown={(e) => { 
                if (e.key==='Enter' && !isReviewMode) {
                  onSubmit(); 
                } else if (e.key==='ArrowLeft' && answered) {
                  next(); // Go to next question with left arrow when answered
                }
              }}
              placeholder={isReviewMode ? 'Chế độ xem lại (chỉ đọc)' : (() => {
                const currentMode = direction === 'random' ? (modes[idx] || 'en2vi') : direction;
                return currentMode === 'en2vi' ? 'Nhập nghĩa tiếng Việt...' : 'Nhập từ tiếng Anh...';
              })()}
              className={`w-full rounded border px-4 py-3 text-base ${isReviewMode ? 'bg-neutral-100 dark:bg-neutral-800 cursor-not-allowed' : 'bg-transparent'}`}
              disabled={isReviewMode}
              ref={inputRef}
            />
          </div>

          {/* Controls */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <button 
              onClick={() => {
                setConfigured(false);
                setShowResults(false);
                setIdx(0);
                setPracticeResults([]);
                setIsReviewMode(false);
                setInput('');
                setAttempts(0);
                setMessage('');
                setCurrentProgressIdx(0);
              }} 
              className="border rounded px-4 py-3 sm:py-2 text-sm text-red-600 border-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 order-3 sm:order-1"
            >
              ← Thoát
            </button>
            <div className="flex items-center gap-3 order-1 sm:order-2">
              <button 
                onClick={onSubmit} 
                disabled={isReviewMode || answered || input.trim()===''} 
                className={`flex-1 sm:flex-none border rounded px-4 py-3 sm:py-2 text-sm ${(!isReviewMode && !answered && input.trim()!=='') ? '' : 'opacity-60 cursor-not-allowed'}`}
              >
                Kiểm tra
              </button>
              <button 
                disabled={(!isReviewMode && !answered) || (isReviewMode && idx >= currentProgressIdx)} 
                onClick={next} 
                className={`flex-1 sm:flex-none rounded px-4 py-3 sm:py-2 text-sm ${(isReviewMode && idx < currentProgressIdx) || (!isReviewMode && answered) ? 'bg-black text-white dark:bg-white dark:text-black' : 'bg-neutral-200 text-neutral-600 cursor-not-allowed'}`}
              >
                {isReviewMode 
                  ? (idx < currentProgressIdx ? 'Tiếp tục' : 'Đã xem hết')
                  : (idx + 1 >= total ? 'Kết thúc' : 'Từ tiếp theo')
                }
              </button>
            </div>
          </div>
        </div>)
      )}

      {tab !== 'practice' && (
        <div className="p-6 border rounded-md">Chức năng này sẽ được triển khai tiếp theo.</div>
      )}
    </div>
  );
}

// duplicate stub removed