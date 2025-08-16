'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { getBrowserSupabaseClient } from '@/lib/supabaseClient';

interface Course {
  course_id: string;
  name: string;
}

interface Lecture {
  lecture_id: string;
  course_id: string;
  title: string;
  order_in_course: number;
}

interface Word {
  word_id: string;
  lecture_id: string;
  text: string;
  ipa?: string;
  audio_url?: string;
  image_url?: string;
  order_in_lecture: number;
}

interface WordMeaning {
  meaning_id: string;
  word_id: string;
  meaning_text: string;
  meaning_type?: string;
}

const toPublicUrl = (path: string | null, bucket: string): string | null => {
  if (!path) return null;
  const supabase = getBrowserSupabaseClient();
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
};

export default function TestPage() {
  // Configuration states
  const [configured, setConfigured] = useState(false);
  const [courses, setCourses] = useState<Course[]>([]);
  const [lectures, setLectures] = useState<Lecture[]>([]);
  const [selectedCourse, setSelectedCourse] = useState('');
  const [selectedCourseName, setSelectedCourseName] = useState('');
  const [selectedLectures, setSelectedLectures] = useState<Set<string>>(new Set());
  const [questionCount, setQuestionCount] = useState(10);
  const [loadingCourses, setLoadingCourses] = useState(true);
  const [loadingLectures, setLoadingLectures] = useState(false);

  // Test states
  const [words, setWords] = useState<Word[]>([]);
  const [allMeanings, setAllMeanings] = useState<{[wordId: string]: string[]}>({});
  const [testQuestions, setTestQuestions] = useState<{word: Word, mode: 'en2vi' | 'vi2en'}[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [userAnswers, setUserAnswers] = useState<string[]>([]);
  const [currentAnswer, setCurrentAnswer] = useState('');
  const [isFlipped, setIsFlipped] = useState(false);
  const [showResults, setShowResults] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const supabase = useMemo(() => getBrowserSupabaseClient(), []);

  // Load courses (exact same logic as practice page)
  useEffect(() => {
    (async () => {
      const { data: cs } = await supabase.from('courses').select('course_id,name');
      setCourses((cs as any[]) || []);
      setLoadingCourses(false);
    })();
  }, [supabase]);

  // Load lectures when course selected (exact same logic as practice page)
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
      setSelectedLectures(new Set(lectureList.map(l => l.lecture_id)));
      setLoadingLectures(false);
    })();
  }, [selectedCourse, supabase]);

  const handleCourseChange = (courseId: string) => {
    setSelectedCourse(courseId);
    const course = courses.find(c => c.course_id === courseId);
    setSelectedCourseName(course?.name || '');
    setSelectedLectures(new Set());
  };

  const toggleLecture = (lectureId: string) => {
    const newSet = new Set(selectedLectures);
    if (newSet.has(lectureId)) {
      newSet.delete(lectureId);
    } else {
      newSet.add(lectureId);
    }
    setSelectedLectures(newSet);
  };

  const startTest = async () => {
    if (selectedLectures.size === 0) return;

    try {
      // Fetch words
      const { data: wordsData } = await supabase
        .from('words')
        .select('*')
        .in('lecture_id', Array.from(selectedLectures))
        .order('order_in_lecture', { ascending: true });

      // Fetch meanings
      const wordIds = wordsData?.map(w => w.word_id) || [];
      const { data: meaningsData } = await supabase
        .from('wordmeanings')
        .select('*')
        .in('word_id', wordIds);

      // Group meanings by word_id
      const meaningsMap: {[wordId: string]: string[]} = {};
      meaningsData?.forEach(m => {
        if (!meaningsMap[m.word_id]) meaningsMap[m.word_id] = [];
        meaningsMap[m.word_id].push(m.meaning_text);
      });

      // Shuffle words and create test questions
      const shuffledWords = [...(wordsData || [])].sort(() => Math.random() - 0.5);
      const selectedWords = shuffledWords.slice(0, Math.min(questionCount, shuffledWords.length));
      
      // Random mode for each question
      const questions = selectedWords.map(word => ({
        word,
        mode: Math.random() > 0.5 ? 'en2vi' : 'vi2en' as 'en2vi' | 'vi2en'
      }));

      setWords(wordsData || []);
      setAllMeanings(meaningsMap);
      setTestQuestions(questions);
      setUserAnswers(new Array(questions.length).fill(''));
      setCurrentIdx(0);
      setCurrentAnswer('');
      setIsFlipped(false);
      setConfigured(true);
      setShowResults(false);

      // Focus input after setup
      setTimeout(() => inputRef.current?.focus(), 100);
    } catch (error) {
      console.error('Error starting test:', error);
    }
  };

  const handleAnswerChange = (value: string) => {
    setCurrentAnswer(value);
    const newAnswers = [...userAnswers];
    newAnswers[currentIdx] = value;
    setUserAnswers(newAnswers);
  };

  const goToPrevious = () => {
    if (currentIdx > 0) {
      setCurrentIdx(currentIdx - 1);
      setCurrentAnswer(userAnswers[currentIdx - 1] || '');
      setIsFlipped(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  };

  const goToNext = () => {
    if (currentIdx < testQuestions.length - 1) {
      setCurrentIdx(currentIdx + 1);
      setCurrentAnswer(userAnswers[currentIdx + 1] || '');
      setIsFlipped(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    } else {
      // Finish test
      setShowResults(true);
    }
  };

  const finishTest = () => {
    setShowResults(true);
  };

  const resetTest = () => {
    setConfigured(false);
    setShowResults(false);
    setCurrentIdx(0);
    setUserAnswers([]);
    setCurrentAnswer('');
    setIsFlipped(false);
    setTestQuestions([]);
  };

  const currentQuestion = testQuestions[currentIdx];
  const currentWord = currentQuestion?.word;

  if (!configured) {
    return (
      <div className="p-6 space-y-6">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-2xl font-bold mb-6">Kiểm Tra</h1>

          {/* Course Selection */}
          <div className="bg-white dark:bg-neutral-900 rounded-lg border border-neutral-200 dark:border-neutral-700 p-6 mb-6">
            <h2 className="text-lg font-semibold mb-4">Chọn khóa học</h2>
            
            {loadingCourses ? (
              <div className="animate-pulse text-neutral-500">Đang tải khóa học...</div>
            ) : courses.length === 0 ? (
              <div className="text-center py-8">
                <div className="text-neutral-500 dark:text-neutral-400 mb-4">
                  Không có khóa học nào. Vui lòng tạo khóa học trước.
                </div>
                <a 
                  href="/courses/manage" 
                  className="inline-block bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg transition-colors"
                >
                  Tạo khóa học mới
                </a>
              </div>
            ) : (
              <div>
                <select
                  value={selectedCourse}
                  onChange={(e) => handleCourseChange(e.target.value)}
                  className="w-full p-3 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-800"
                >
                  <option value="">Chọn khóa học</option>
                  {courses.map(course => (
                    <option key={course.course_id} value={course.course_id}>
                      {course.name}
                    </option>
                  ))}
                </select>
                <div className="text-xs text-neutral-500 mt-2">
                  Tìm thấy {courses.length} khóa học
                </div>
              </div>
            )}
          </div>

          {/* Lecture Selection */}
          {selectedCourse && (
            <div className="bg-white dark:bg-neutral-900 rounded-lg border border-neutral-200 dark:border-neutral-700 p-6 mb-6">
              <h2 className="text-lg font-semibold mb-4">Chọn bài giảng</h2>
              
              {loadingLectures ? (
                <div className="animate-pulse text-neutral-500">Đang tải bài giảng...</div>
              ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {lectures.map(lecture => (
                    <label key={lecture.lecture_id} className="flex items-center gap-3 p-3 hover:bg-neutral-50 dark:hover:bg-neutral-800 rounded cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedLectures.has(lecture.lecture_id)}
                        onChange={() => toggleLecture(lecture.lecture_id)}
                        className="rounded"
                      />
                      <span>{lecture.title}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Question Count */}
          {selectedLectures.size > 0 && (
            <div className="bg-white dark:bg-neutral-900 rounded-lg border border-neutral-200 dark:border-neutral-700 p-6 mb-6">
              <h2 className="text-lg font-semibold mb-4">Số lượng câu hỏi</h2>
              <input
                type="number"
                min="1"
                max="100"
                value={questionCount}
                onChange={(e) => setQuestionCount(parseInt(e.target.value) || 10)}
                className="w-full p-3 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-800"
                placeholder="Nhập số câu hỏi"
              />
            </div>
          )}

          {/* Start Button */}
          {selectedLectures.size > 0 && (
            <button
              onClick={startTest}
              className="w-full bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white py-4 rounded-lg font-semibold text-lg transition-all duration-200 shadow-lg hover:shadow-xl"
            >
              Bắt Đầu Kiểm Tra
            </button>
          )}
        </div>
      </div>
    );
  }

  if (showResults) {
    // Results page implementation can be added here
    return (
      <div className="p-6 space-y-6">
        <div className="max-w-2xl mx-auto text-center">
          <h1 className="text-2xl font-bold mb-6">Kết Quả Kiểm Tra</h1>
          <p className="mb-6">Đã hoàn thành {testQuestions.length} câu hỏi</p>
          <button
            onClick={resetTest}
            className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold"
          >
            Làm Lại
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-4">
      <div className="max-w-2xl mx-auto px-2 sm:px-4">
        {/* Header */}
        <div className="bg-white dark:bg-neutral-900 rounded-lg sm:rounded-xl shadow-sm border border-neutral-200 dark:border-neutral-700 p-3 sm:p-6 mb-4 sm:mb-6">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-xl font-bold">Luyện tập Flashcard</h1>
            <span className="text-sm text-neutral-600 dark:text-neutral-400">
              Flashcard {currentIdx + 1} / {testQuestions.length}
            </span>
          </div>
          
          {/* Progress bar */}
          <div className="w-full bg-neutral-200 dark:bg-neutral-700 rounded-full h-2 mb-2">
            <div 
              className="bg-gradient-to-r from-green-500 to-blue-500 h-2 rounded-full transition-all duration-300"
              style={{ width: `${testQuestions.length > 0 ? ((currentIdx + 1) / testQuestions.length) * 100 : 0}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-neutral-500 dark:text-neutral-400">
            <span>Câu {currentIdx + 1} / {testQuestions.length}</span>
            <span>{testQuestions.length > 0 ? Math.round(((currentIdx + 1) / testQuestions.length) * 100) : 0}%</span>
          </div>
        </div>

        {/* Flashcard */}
        <div className="bg-white dark:bg-neutral-900 rounded-xl sm:rounded-2xl shadow-lg border border-neutral-200 dark:border-neutral-700 overflow-hidden">
          <div className="p-4 sm:p-8">
            {/* Flashcard Container */}
            <div className="mb-8">
              <div 
                className="relative w-full h-80 cursor-pointer"
                onClick={() => setIsFlipped(!isFlipped)}
              >
                <div className={`absolute inset-0 w-full h-full transition-transform duration-500 transform-style-preserve-3d ${isFlipped ? 'rotate-y-180' : ''}`}>
                  {/* Front Side */}
                  <div className="absolute inset-0 w-full h-full backface-hidden bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 border-2 border-neutral-200 dark:border-neutral-700 rounded-2xl flex flex-col items-center justify-center p-6">
                    <div className="text-center">
                      {currentQuestion?.mode === 'en2vi' ? (
                        <div>
                          <div className="text-sm text-neutral-500 dark:text-neutral-400 mb-2">Từ tiếng Anh:</div>
                          <div className="text-3xl sm:text-4xl font-bold text-neutral-800 dark:text-neutral-100 mb-3">
                            {currentWord?.text}
                          </div>
                          {currentWord?.ipa && (
                            <div className="text-lg text-neutral-600 dark:text-neutral-400 mb-4">
                              /{currentWord.ipa}/
                            </div>
                          )}
                          {currentWord?.audio_url && (
                            <audio controls className="mx-auto">
                              <source src={toPublicUrl(currentWord.audio_url, 'word-audios') || undefined} />
                            </audio>
                          )}
                        </div>
                      ) : (
                        <div>
                          <div className="text-sm text-neutral-500 dark:text-neutral-400 mb-2">Định nghĩa:</div>
                          <div className="text-2xl sm:text-3xl font-bold text-neutral-800 dark:text-neutral-100">
                            {allMeanings[currentWord?.word_id || '']?.[0] || '—'}
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="absolute bottom-4 right-4 text-xs text-neutral-400">
                      Nhấn để xem mặt sau
                    </div>
                  </div>

                  {/* Back Side */}
                  <div className="absolute inset-0 w-full h-full backface-hidden rotate-y-180 bg-gradient-to-br from-green-50 to-teal-50 dark:from-green-900/20 dark:to-teal-900/20 border-2 border-neutral-200 dark:border-neutral-700 rounded-2xl flex flex-col items-center justify-center p-6">
                    <div className="text-center">
                      {currentQuestion?.mode === 'en2vi' ? (
                        <div>
                          <div className="text-sm text-neutral-500 dark:text-neutral-400 mb-2">Nghĩa tiếng Việt:</div>
                          <div className="text-2xl sm:text-3xl font-bold text-neutral-800 dark:text-neutral-100">
                            {allMeanings[currentWord?.word_id || '']?.[0] || '—'}
                          </div>
                        </div>
                      ) : (
                        <div>
                          <div className="text-sm text-neutral-500 dark:text-neutral-400 mb-2">Từ tiếng Anh:</div>
                          <div className="text-3xl sm:text-4xl font-bold text-neutral-800 dark:text-neutral-100 mb-3">
                            {currentWord?.text}
                          </div>
                          {currentWord?.ipa && (
                            <div className="text-lg text-neutral-600 dark:text-neutral-400 mb-4">
                              /{currentWord.ipa}/
                            </div>
                          )}
                          {currentWord?.audio_url && (
                            <audio controls className="mx-auto">
                              <source src={toPublicUrl(currentWord.audio_url, 'word-audios') || undefined} />
                            </audio>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="absolute bottom-4 right-4 text-xs text-neutral-400">
                      Nhấn để xem mặt trước
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Input */}
            <div className="mb-6">
              <input
                ref={inputRef}
                value={currentAnswer}
                onChange={(e) => handleAnswerChange(e.target.value)}
                placeholder="Nhập câu trả lời..."
                className="w-full text-center text-lg px-6 py-4 rounded-xl border-2 border-neutral-300 dark:border-neutral-600 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-white dark:bg-neutral-800"
              />
            </div>

            {/* Navigation */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 sm:gap-4">
              <button 
                onClick={resetTest}
                className="flex items-center justify-center gap-2 px-4 py-2 text-red-600 hover:text-red-700 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                <span className="text-sm font-medium">Thoát</span>
              </button>
              
              <div className="flex items-center gap-3 order-1 sm:order-none">
                <button 
                  onClick={goToPrevious}
                  disabled={currentIdx === 0}
                  className={`flex-1 sm:flex-none px-4 sm:px-6 py-3 rounded-xl font-medium transition-all duration-200 ${
                    currentIdx > 0
                      ? 'bg-neutral-500 hover:bg-neutral-600 text-white shadow-md hover:shadow-lg' 
                      : 'bg-neutral-200 dark:bg-neutral-700 text-neutral-400 cursor-not-allowed'
                  }`}
                >
                  ← Quay lại
                </button>
                
                <button 
                  onClick={currentIdx === testQuestions.length - 1 ? finishTest : goToNext}
                  className="flex-1 sm:flex-none px-4 sm:px-6 py-3 rounded-xl font-medium transition-all duration-200 bg-gradient-to-r from-green-500 to-blue-500 hover:from-green-600 hover:to-blue-600 text-white shadow-md hover:shadow-lg"
                >
                  {currentIdx === testQuestions.length - 1 ? 'Kết thúc' : 'Tiếp theo →'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        .transform-style-preserve-3d {
          transform-style: preserve-3d;
        }
        .backface-hidden {
          backface-visibility: hidden;
        }
        .rotate-y-180 {
          transform: rotateY(180deg);
        }
      `}</style>
    </div>
  );
}
