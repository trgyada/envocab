import React, { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import React, { useEffect, useRef, useState, lazy, Suspense } from 'react';
const MultipleChoice = lazy(() => import('../components/MultipleChoice'));
const Matching = lazy(() => import('../components/Matching'));
const TypeAnswer = lazy(() => import('../components/TypeAnswer'));
import {
  calculateScore,
  generateQuiz,
  selectWordsForReview,
  selectWordsSimple,
  shuffleArray,
  prioritizeUnseenWords
} from '../services/quizEngine';
import { estimateQualityFromResponse } from '../services/sm2Algorithm';
import { useCardStore } from '../stores/cardStore';
import { useReviewSessionStore } from '../stores/reviewSessionStore';
import { useUserProgressStore } from '../stores/userProgressStore';
import { useWordListStore } from '../stores/wordListStore';
import { QuizQuestion, QuizType, Word } from '../types';

type QuizPhase = 'select-list' | 'select-type' | 'quiz';

const Timer: React.FC<{ startTime: Date | null }> = ({ startTime }) => {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!startTime) return;
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - startTime.getTime()) / 1000)), 1000);
    return () => clearInterval(id);
  }, [startTime]);
  const minutes = Math.floor(elapsed / 60)
    .toString()
    .padStart(2, '0');
  const seconds = (elapsed % 60).toString().padStart(2, '0');
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '8px 16px',
        background: 'rgba(255, 152, 0, 0.15)',
        borderRadius: '20px',
        fontWeight: 600
      }}
    >
      Sure {minutes}:{seconds}
    </div>
  );
};

type ExampleState = {
  sentence?: string;
  translation?: string;
  loading?: boolean;
  error?: string;
  lang?: 'en' | 'tr';
};

const modelForExamples = 'gemma-3-27b-it';

const getStoredExample = (word: Word, lang: 'en' | 'tr') => {
  if (word.exampleSentence && word.exampleLang === lang) {
    return {
      sentence: word.exampleSentence,
      translation: word.exampleTranslation,
      lang,
    };
  }
  return null;
};

const Quiz: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { wordLists, selectedListId, selectWordList, updateWordMastery, updateWordExample } = useWordListStore();
  const { addQuizResult } = useUserProgressStore();
  const { cards, cardStates, createCardsFromWords, getCardByWordId, updateCardState } = useCardStore();
  const { startSession, endSession, addReviewLog, incrementCorrect, incrementIncorrect, incrementReviewed } =
    useReviewSessionStore();

  const locationState = (location.state as { dueWordIds?: string[]; mode?: string } | null) || null;
  const isDueReviewMode = locationState?.mode === 'due-review';
  const dueWordIds = locationState?.dueWordIds || [];

  const [phase, setPhase] = useState<QuizPhase>('select-list');
  const [quizType, setQuizType] = useState<QuizType>('multiple-choice');
  const [quizDirection, setQuizDirection] = useState<'en-to-tr' | 'tr-to-en' | 'mixed'>('mixed');
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [answerSheet, setAnswerSheet] = useState<
    { word: Word; userAnswer: string; correctAnswer: string; isCorrect: boolean }[]
  >([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [wrongWords, setWrongWords] = useState<Word[]>([]);
  const [startTime, setStartTime] = useState<Date | null>(null);
  const [questionCount, setQuestionCount] = useState(10);
  const [onlyDifficultWords, setOnlyDifficultWords] = useState(false);
  const [useSM2Selection, setUseSM2Selection] = useState(true);
  const [showExamples, setShowExamples] = useState(false);
  const [exampleMap, setExampleMap] = useState<Record<string, ExampleState>>({});
  const [hasAnswered, setHasAnswered] = useState(false);
  const [examMode, setExamMode] = useState(false);
  const allDifficultWords = React.useMemo(() => {
    const map = new Map<string, Word>();
    wordLists.forEach((l) =>
      l.words
        .filter((w) => w.incorrectCount > 0)
        .forEach((w) => {
          if (!map.has(w.id)) map.set(w.id, w);
        })
    );
    return Array.from(map.values());
  }, [wordLists]);

  const [flashcardWords, setFlashcardWords] = useState<Word[]>([]);
  const [currentFlashcardIndex, setCurrentFlashcardIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [flashcardDirection, setFlashcardDirection] = useState<'en-to-tr' | 'tr-to-en'>('en-to-tr');

  const questionStartTimeRef = useRef<number>(0);
  const totalQuestionsRef = useRef(0);
  const quizStartedRef = useRef(false);

  const selectedList = wordLists.find((l) => l.id === selectedListId);
  const difficultWords =
    selectedList?.words.filter((w) => w.incorrectCount > 0 || (w.correctCount > 0 && w.mastery < 50)) || [];

  useEffect(() => {
    if (isDueReviewMode && dueWordIds.length > 0) {
      const allWords = wordLists.flatMap((l) => l.words);
      const dueWords = allWords.filter((w) => dueWordIds.includes(w.id));
      if (dueWords.length > 0) {
        setFlashcardWords(dueWords);
        setQuestionCount(dueWords.length);
        if (wordLists.length > 0 && !selectedListId) selectWordList(wordLists[0].id);
        setPhase('select-type');
      }
    }
  }, [isDueReviewMode, dueWordIds, selectWordList, selectedListId, wordLists]);

  useEffect(() => {
    if (!quizStartedRef.current && selectedListId && wordLists.find((l) => l.id === selectedListId)) {
      setPhase('select-type');
    }
  }, [selectedListId, wordLists]);

  useEffect(() => {
    if (selectedList && selectedList.words.length > 0) {
      createCardsFromWords(selectedList.words);
    }
  }, [selectedList, createCardsFromWords]);

  // Test modunda ornek cumle zorla kapali
  useEffect(() => {
    if (examMode) setShowExamples(false);
  }, [examMode]);

  useEffect(() => {
    if (!showExamples) return;
    if (questions.length === 0) return;
    if (currentIndex >= questions.length) return;
    const q = questions[currentIndex];
    const key = `${q.word.id}-${q.direction}`;
    const lang = q.direction === 'tr-to-en' ? 'tr' : 'en';
    const stored = getStoredExample(q.word, lang);
    if (stored?.sentence) {
      setExampleMap((prev) => ({
        ...prev,
        [key]: { ...stored, loading: false, error: undefined, lang },
      }));
      return;
    }
    const existing = exampleMap[key];
    if (existing?.sentence || existing?.loading) return;
    // fire and forget
    setExampleMap((prev) => ({ ...prev, [key]: { ...prev[key], loading: true, error: undefined } }));
    fetch('/api/example', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ word: lang === 'tr' ? q.word.turkish : q.word.english, lang })
    })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) {
          if (res.status === 429) {
            throw new Error('429: Rate limit asildi, lutfen biraz sonra tekrar dene.');
          }
          throw new Error(data?.error || 'Ornek alinamadi');
        }
        setExampleMap((prev) => ({
          ...prev,
          [key]: { sentence: data.sentence, translation: data.translation, loading: false, lang }
        }));
        updateWordExample(q.word.id, {
          sentence: data.sentence,
          translation: data.translation,
          lang,
          model: modelForExamples,
          updatedAt: new Date(),
        });
      })
      .catch((err) => {
        setExampleMap((prev) => ({
          ...prev,
          [key]: { loading: false, error: err instanceof Error ? err.message : 'Ornek alinamadi' }
        }));
      });
  }, [showExamples, questions, currentIndex, updateWordExample]);


  useEffect(() => {
    setHasAnswered(false);
  }, [currentIndex, questions]);

  const getOptionMeaning = (option: string) => {
    const list = selectedList;
    if (!list) return '';
    const lower = option.trim().toLowerCase();
    const matchTr = list.words.find((w) => w.turkish.trim().toLowerCase() === lower);
    if (matchTr) return matchTr.english;
    const matchEn = list.words.find((w) => w.english.trim().toLowerCase() === lower);
    if (matchEn) return matchEn.turkish;
    return '';
  };

  const startQuiz = () => {
    if (!selectedList) return;
    if (examMode) setShowExamples(false);
    let wordsToUse: Word[];

    if (onlyDifficultWords) {
      wordsToUse = allDifficultWords.length > 0 ? allDifficultWords : difficultWords;
    } else if (useSM2Selection && cards.length > 0) {
      wordsToUse = selectWordsForReview(selectedList.words, cardStates, cards, {
        limit: questionCount,
        newCardLimit: Math.ceil(questionCount / 3),
        shuffle: true
      });
    } else {
      wordsToUse = selectWordsSimple(selectedList.words, { limit: questionCount, prioritizeDifficult: true });
    }

    wordsToUse = shuffleArray(prioritizeUnseenWords(wordsToUse));

    const count = Math.min(questionCount, wordsToUse.length);
    quizStartedRef.current = true;
    startSession(selectedListId || '', count);
    setStartTime(new Date());
    questionStartTimeRef.current = Date.now();
    setCorrectCount(0);
    setWrongWords([]);
    setExampleMap({});
    setCurrentIndex(0);
    setAnswerSheet([]);
    totalQuestionsRef.current = count;

    if (quizType === 'matching') {
      setFlashcardWords(wordsToUse.slice(0, 8));
      setPhase('quiz');
      return;
    }

    if (quizType === 'flashcard') {
      setFlashcardWords(wordsToUse.slice(0, count));
      setCurrentFlashcardIndex(0);
      setIsFlipped(false);
      setFlashcardDirection(Math.random() < 0.5 ? 'en-to-tr' : 'tr-to-en');
      setPhase('quiz');
      return;
    }

    const generated = generateQuiz(wordsToUse, quizType, count, quizDirection);
    setQuestions(generated);
    totalQuestionsRef.current = generated.length;
    setPhase('quiz');
  };

  const finishQuiz = (finalCorrect: number, finalTotal: number, finalWrong: Word[]) => {
    const endTime = new Date();
    const duration = startTime ? Math.round((endTime.getTime() - startTime.getTime()) / 1000) : 0;
    quizStartedRef.current = false;
    endSession();
    addQuizResult({
      sessionId: crypto.randomUUID(),
      wordListId: selectedListId || '',
      wordListTitle: selectedList?.title || '',
      quizType,
      totalQuestions: finalTotal,
      correctAnswers: finalCorrect,
      incorrectAnswers: finalTotal - finalCorrect,
      score: calculateScore(finalCorrect, finalTotal),
      duration,
      wrongWords: finalWrong
    });
    navigate('/results', {
      state: {
        score: calculateScore(finalCorrect, finalTotal),
        correct: finalCorrect,
        total: finalTotal,
        wrongWords: finalWrong,
        quizType,
        duration,
        answerSheet,
        examMode
      }
    });
  };

  const handleFinishEarly = () => {
    const total = totalQuestionsRef.current || questions.length || flashcardWords.length || 0;
    const effectiveTotal = Math.max(currentIndex + 1, total);
    finishQuiz(correctCount, effectiveTotal, wrongWords);
  };

  const updateSM2CardState = (word: Word, isCorrect: boolean, responseTimeMs: number) => {
    const card = getCardByWordId(word.id);
    if (!card) return;
    const quality = estimateQualityFromResponse(responseTimeMs, isCorrect);
    updateCardState(card.id, quality, responseTimeMs);
    addReviewLog({
      cardId: card.id,
      wordId: word.id,
      responseTimeMs,
      quality,
      questionType: quizType,
      wasCorrect: isCorrect
    });
    incrementReviewed();
    if (isCorrect) incrementCorrect();
    else incrementIncorrect();
  };

  const handleAnswer = (
    isCorrect: boolean,
    word: Word,
    userAnswer: string,
    direction: 'en-to-tr' | 'tr-to-en' | undefined
  ) => {
    const responseTimeMs = Date.now() - questionStartTimeRef.current;
    if (selectedListId) updateWordMastery(selectedListId, word.id, isCorrect);
    updateSM2CardState(word, isCorrect, responseTimeMs);

    const newCorrect = isCorrect ? correctCount + 1 : correctCount;
    const newWrong = isCorrect ? wrongWords : [...wrongWords, word];
    setCorrectCount(newCorrect);
    setWrongWords(newWrong);
    const correctAnswer = direction === 'tr-to-en' ? word.english : word.turkish;
    setAnswerSheet((prev) => [
      ...prev,
      { word, userAnswer, correctAnswer, isCorrect }
    ]);
    setHasAnswered(true);
  };

  const handleFlashcardAnswer = (knew: boolean) => {
    const currentWord = flashcardWords[currentFlashcardIndex];
    const totalCards = flashcardWords.length;
    const responseTimeMs = Date.now() - questionStartTimeRef.current;
    if (selectedListId) updateWordMastery(selectedListId, currentWord.id, knew);
    updateSM2CardState(currentWord, knew, responseTimeMs);

    const newCorrect = knew ? correctCount + 1 : correctCount;
    const newWrong = knew ? wrongWords : [...wrongWords, currentWord];
    setCorrectCount(newCorrect);
    setWrongWords(newWrong);
    setIsFlipped(false);

    const isLastCard = currentFlashcardIndex >= totalCards - 1;
    if (isLastCard) {
      setTimeout(() => finishQuiz(newCorrect, totalCards, newWrong), 1000);
    } else {
      setTimeout(() => {
        setCurrentFlashcardIndex((prev) => prev + 1);
        setFlashcardDirection(Math.random() < 0.5 ? 'en-to-tr' : 'tr-to-en');
        questionStartTimeRef.current = Date.now();
      }, 1000);
    }
  };

  const handleMatchingWordResult = (wordId: string, isCorrect: boolean) => {
    const word = selectedList?.words.find((w) => w.id === wordId);
    if (!word) return;
    const responseTimeMs = Date.now() - questionStartTimeRef.current;
    updateSM2CardState(word, isCorrect, responseTimeMs);
    questionStartTimeRef.current = Date.now();
  };

  const handleMatchingComplete = (correct: number, total: number, wrong: Word[]) => {
    finishQuiz(correct, total, wrong);
  };

  const goNextQuestion = (force = false) => {
    if (!force && !hasAnswered) return;
    const isLast = currentIndex >= questions.length - 1;
    if (isLast) {
      const total = totalQuestionsRef.current || questions.length;
      finishQuiz(correctCount, total, wrongWords);
    } else {
      setCurrentIndex((prev) => prev + 1);
      questionStartTimeRef.current = Date.now();
      setHasAnswered(false);
    }
  };

  // Test modunda (sadece coktan secmeli) cevaplandiktan sonra otomatik gec
  useEffect(() => {
    if (examMode && quizType === 'multiple-choice' && hasAnswered) {
      const id = setTimeout(() => goNextQuestion(true), 300);
      return () => clearTimeout(id);
    }
  }, [examMode, quizType, hasAnswered]);

  const handleExitQuiz = () => {
    if (window.confirm('Quizden çıkmak istiyor musun? İlerlemen kaybolacak.')) {
      quizStartedRef.current = false;
      endSession();
      setPhase('select-type');
      setCurrentIndex(0);
      setCorrectCount(0);
      setWrongWords([]);
      setStartTime(null);
    }
  };

  // select list
  if (phase === 'select-list') {
    return (
      <div className="quiz-container">
        <h1 style={{ marginBottom: '30px', textAlign: 'center' }}>Liste Seç</h1>
        {wordLists.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">📂</div>
            <p>Henüz kelime listesi yok.</p>
            <button className="btn btn-primary" onClick={() => navigate('/word-lists')} style={{ marginTop: '20px' }}>
              Liste Yükle
            </button>
          </div>
        ) : (
          <div className="wordlist-grid">
            {wordLists.map((list) => (
              <div
                key={list.id}
                className={`wordlist-card ${selectedListId === list.id ? 'selected' : ''}`}
                onClick={() => {
                  selectWordList(list.id);
                  setPhase('select-type');
                }}
              >
                <h3>{list.title}</h3>
                <p>{list.words.length} kelime</p>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // select type/settings
  
  // select type/settings
  if (phase === 'select-type') {
    const maxQuestions = selectedList?.words.length || 10;
    return (
      <div className="quiz-container">
        <h1 style={{ marginBottom: '10px', textAlign: 'center' }}>Quiz Ayarlari</h1>
        <p style={{ textAlign: 'center', color: 'var(--text-secondary)', marginBottom: '30px' }}>
          {selectedList?.title} - {selectedList?.words.length} kelime
        </p>

        <div style={{ maxWidth: '520px', margin: '0 auto' }}>
          <div style={{ marginBottom: '30px' }}>
            <label style={{ display: 'block', marginBottom: '10px', fontWeight: '600' }}>
              Soru Sayisi: {questionCount}
            </label>
            <input
              type="range"
              min="5"
              max={maxQuestions}
              value={questionCount}
              onChange={(e) => setQuestionCount(parseInt(e.target.value))}
              style={{ width: '100%' }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
              <span>5</span>
              <span>{maxQuestions}</span>
            </div>
          </div>

          <div style={{ marginBottom: '30px' }}>
            <label style={{ display: 'block', marginBottom: '15px', fontWeight: '600' }}>Quiz Tipi Sec</label>
            <div className="quiz-type-grid">
              {[
                { type: 'multiple-choice' as QuizType, icon: '❓', label: 'Coktan Secmeli' },
                { type: 'flashcard' as QuizType, icon: '🃏', label: 'Flashcard' },
                { type: 'matching' as QuizType, icon: '🔗', label: 'Eslesme' },
                { type: 'write' as QuizType, icon: '⌨️', label: 'Yazarak Cevap' }
              ].map(({ type, icon, label }) => (
                <div
                  key={type}
                  className={`quiz-type-card ${quizType === type ? 'selected' : ''}`}
                  onClick={() => setQuizType(type)}
                >
                  <span className="quiz-type-icon">{icon}</span>
                  <span className="quiz-type-label">{label}</span>
                </div>
              ))}
            </div>
            <div style={{ marginTop: '10px', display: 'flex', gap: '10px', alignItems: 'center' }}>
              {(() => {
                const testToggleEnabled = quizType === 'multiple-choice';
                return (
                  <div
                    className={`toggle-shell ${examMode ? 'enabled' : 'disabled'}`}
                    onClick={() => {
                      if (!testToggleEnabled) return;
                      setExamMode(!examMode);
                    }}
                    style={{
                      cursor: testToggleEnabled ? 'pointer' : 'not-allowed',
                      opacity: testToggleEnabled ? 1 : 0.45,
                      filter: testToggleEnabled ? 'none' : 'blur(0.3px)'
                    }}
                  >
                    <div className="toggle-knob" />
                  </div>
                );
              })()}
              <div style={{ color: 'var(--text-secondary)' }}>
                Test modu (geri bildirim gizli, sonuc tablosu acik)
              </div>
            </div>
          </div>

          <div style={{ marginBottom: '24px' }}>
            <label style={{ display: 'block', marginBottom: '12px', fontWeight: '600' }}>Soru yonu</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '10px' }}>
              {[
                { value: 'mixed' as const, label: 'Karisik' },
                { value: 'en-to-tr' as const, label: 'Ing -> Tr' },
                { value: 'tr-to-en' as const, label: 'Tr -> Ing' }
              ].map((item) => (
                <button
                  key={item.value}
                  onClick={() => setQuizDirection(item.value)}
                  className={`btn ${quizDirection === item.value ? 'btn-primary' : 'btn-outline'}`}
                  style={{ width: '100%', padding: '10px 12px' }}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          <div
            style={{
              marginBottom: '20px',
              padding: '12px 14px',
              background: '#0f172a',
              border: '1px solid var(--border)',
              borderRadius: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '10px',
              opacity: quizType === 'multiple-choice' ? 1 : 0.5
            }}
          >
            <div>
              <div style={{ fontWeight: '700', marginBottom: '6px' }}>Ornek cumle (Gemini)</div>
              <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                Quiz baslamadan ornek cumleler hazirlanir; ceviri yanit sonrasinda gosterilir.
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <div
                className={`toggle-shell ${showExamples && quizType === 'multiple-choice' && !examMode ? 'enabled' : 'disabled'}`}
                style={{ cursor: quizType === 'multiple-choice' && !examMode ? 'pointer' : 'not-allowed', opacity: examMode ? 0.5 : 1 }}
                onClick={() => {
                  if (quizType !== 'multiple-choice' || examMode) return;
                  setShowExamples((v) => !v);
                }}
              >
                <div className="toggle-knob" />
              </div>
            </div>
          </div>

          <div
            style={{
              marginBottom: '30px',
              padding: '15px 20px',
              background: onlyDifficultWords ? 'rgba(239, 68, 68, 0.16)' : '#111a2d',
              borderRadius: '12px',
              border: onlyDifficultWords ? '2px solid var(--danger)' : '1px solid var(--border)',
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
            onClick={() => setOnlyDifficultWords(!onlyDifficultWords)}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontWeight: '600', marginBottom: '5px' }}>Zor Kelimeler</div>
                <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                  Sadece daha once hata yapilan kelimeler ({allDifficultWords.length} kelime)
                </div>
              </div>
              <div
                className={`toggle-shell ${onlyDifficultWords ? 'enabled' : 'disabled'}`}
              >
                <div className="toggle-knob" />
              </div>
            </div>
          </div>

          <button
            className="btn btn-primary btn-lg"
            onClick={startQuiz}
            style={{ width: '100%', marginTop: '20px' }}
            disabled={onlyDifficultWords && (allDifficultWords.length === 0 && difficultWords.length === 0)}
          >
            Quiz'i Baslat
          </button>

          <button
            className="btn btn-outline"
            onClick={() => {
              quizStartedRef.current = false;
              selectWordList(null);
              setPhase('select-list');
            }}
            style={{ width: '100%', marginTop: '12px' }}
          >
            Farkli Liste Sec
          </button>
        </div>
      </div>
    );
  }

// quiz phase
  if (phase === 'quiz' && selectedList) {
    if (quizType === 'matching') {
      const wordsForMatching =
        flashcardWords.length > 0 ? flashcardWords : (onlyDifficultWords ? difficultWords : selectedList.words).slice(0, 8);
      return (
        <Matching
          words={wordsForMatching}
          onComplete={handleMatchingComplete}
          onExit={handleExitQuiz}
          onWordResult={(wordId, isCorrect) => {
            if (selectedListId) updateWordMastery(selectedListId, wordId, isCorrect);
            handleMatchingWordResult(wordId, isCorrect);
          }}
        />
      );
    }

    if (quizType === 'flashcard' && flashcardWords.length > 0) {
      const currentWord = flashcardWords[currentFlashcardIndex];
      const remaining = flashcardWords.length - currentFlashcardIndex;
      return (
        <div className="quiz-container">
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
            <button className="quiz-exit-btn" onClick={handleExitQuiz} title="Quizden çık">
              ✖
            </button>
            <button className="btn btn-outline btn-sm" onClick={handleFinishEarly}>
              Testi Bitir
            </button>
          </div>

          <div className="quiz-header">
            <div className="quiz-progress">
              <div className="quiz-progress-bar" style={{ width: `${((currentFlashcardIndex + 1) / flashcardWords.length) * 100}%` }} />
            </div>
            <Timer startTime={startTime} />
          </div>

          <div style={{ textAlign: 'center', marginBottom: '10px', color: 'var(--text-secondary)' }}>
            Kart {currentFlashcardIndex + 1} / {flashcardWords.length} · Kalan: {remaining}
          </div>

          <div className="flashcard-container">
            <div className={`flashcard ${isFlipped ? 'flipped' : ''}`} onClick={() => setIsFlipped(!isFlipped)}>
              <div className="flashcard-front">
                <span className="flashcard-label">{flashcardDirection === 'en-to-tr' ? 'İngilizce' : 'Türkçe'}</span>
                <span>{flashcardDirection === 'en-to-tr' ? currentWord.english : currentWord.turkish}</span>
              </div>
              <div className="flashcard-back">
                <span className="flashcard-label">{flashcardDirection === 'en-to-tr' ? 'Türkçe' : 'İngilizce'}</span>
                <span>{flashcardDirection === 'en-to-tr' ? currentWord.turkish : currentWord.english}</span>
              </div>
            </div>

            {!isFlipped && <p className="flashcard-tip">Kartı çevirmek için tıkla</p>}
            {isFlipped && (
              <div className="flashcard-controls">
                <button className="btn btn-danger" onClick={() => handleFlashcardAnswer(false)}>
                  Bilmedim
                </button>
                <button className="btn btn-secondary" onClick={() => handleFlashcardAnswer(true)}>
                  Bildim
                </button>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', justifyContent: 'center', gap: '30px', marginTop: '30px', fontSize: '1.05rem' }}>
            <div style={{ color: 'var(--success)' }}>Doğru: {correctCount}</div>
            <div style={{ color: 'var(--danger)' }}>Yanlış: {wrongWords.length}</div>
          </div>
        </div>
      );
    }

    if (quizType === 'write' && questions.length > 0 && currentIndex < questions.length) {
      const currentQuestion = questions[currentIndex];
      return (
        <div className="quiz-container">
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
            <button className="quiz-exit-btn" onClick={handleExitQuiz} title="Quizden cik">
              X
            </button>
            <button className="btn btn-outline btn-sm" onClick={handleFinishEarly}>
              Testi Bitir
            </button>
          </div>

          <div className="quiz-header">
            <div className="quiz-progress">
              <div className="quiz-progress-bar" style={{ width: `${((currentIndex + 1) / questions.length) * 100}%` }} />
            </div>
            <Timer startTime={startTime} />
          </div>

          <div style={{ textAlign: 'center', marginBottom: '20px' }}>
            <span className="quiz-counter">
              Soru {currentIndex + 1} / {questions.length}
            </span>
          </div>

          <TypeAnswer
            key={currentQuestion.id}
            question={currentQuestion}
            onAnswer={(isCorrect, word, userAnswer, direction) => {
              handleAnswer(isCorrect, word, userAnswer, direction);
            }}
          />

          <div style={{ display: 'flex', justifyContent: 'center', marginTop: '16px' }}>
            <button
              className="btn btn-primary"
              onClick={() => goNextQuestion()}
              disabled={!hasAnswered}
            >
              {currentIndex >= questions.length - 1 ? 'Bitir' : 'Sonraki Soru'}
            </button>
          </div>

          {!examMode && (
            <div
              style={{
                display: 'flex',
                justifyContent: 'center',
                gap: '30px',
                marginTop: '20px',
                fontSize: '1rem',
              }}
            >
              <div style={{ color: 'var(--success)' }}>Dogru: {correctCount}</div>
              <div style={{ color: 'var(--danger)' }}>Yanlis: {wrongWords.length}</div>
            </div>
          )}
        </div>
      );
    }

    // multiple choice
    if (questions.length > 0 && currentIndex < questions.length) {
      const currentQuestion = questions[currentIndex];
      const exampleKey = `${currentQuestion.word.id}-${currentQuestion.direction}`;
      const exampleState = exampleMap[exampleKey];

      const requestExample = async (force = false) => {
        if (!showExamples) return;
        const lang = currentQuestion.direction === 'tr-to-en' ? 'tr' : 'en';
        const stored = getStoredExample(currentQuestion.word, lang);
        if (stored?.sentence && !force) {
          setExampleMap((prev) => ({
            ...prev,
            [exampleKey]: { ...stored, loading: false, error: undefined, lang },
          }));
          return;
        }
        if (exampleState?.loading) return;
        setExampleMap((prev) => ({ ...prev, [exampleKey]: { ...prev[exampleKey], loading: true, error: undefined } }));
        try {
          const res = await fetch('/api/example', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              word: lang === 'tr' ? currentQuestion.word.turkish : currentQuestion.word.english,
              lang
            })
          });
          const data = await res.json();
          if (!res.ok) {
            throw new Error(data?.error || 'Istek basarisiz');
          }
          setExampleMap((prev) => ({
            ...prev,
            [exampleKey]: { sentence: data.sentence, translation: data.translation, loading: false }
          }));
          updateWordExample(currentQuestion.word.id, {
            sentence: data.sentence,
            translation: data.translation,
            lang,
            model: modelForExamples,
            updatedAt: new Date(),
          });
        } catch (err) {
          setExampleMap((prev) => ({
            ...prev,
            [exampleKey]: { loading: false, error: err instanceof Error ? err.message : 'Ornek cumle alinamadi.' }
          }));
        }
      };

      return (
        <div className="quiz-container">
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
            <button className="quiz-exit-btn" onClick={handleExitQuiz} title="Quizden çık">
              ✖
            </button>
            <button className="btn btn-outline btn-sm" onClick={handleFinishEarly}>
              Testi Bitir
            </button>
          </div>

          <div className="quiz-header">
            <div className="quiz-progress">
              <div className="quiz-progress-bar" style={{ width: `${((currentIndex + 1) / questions.length) * 100}%` }} />
            </div>
            <Timer startTime={startTime} />
          </div>

          <div style={{ textAlign: 'center', marginBottom: '20px' }}>
            <span className="quiz-counter">
              Soru {currentIndex + 1} / {questions.length}
            </span>
          </div>

          <MultipleChoice
            key={currentQuestion.id}
            question={currentQuestion}
            onAnswer={(isCorrect, word, userAnswer, direction) => handleAnswer(isCorrect, word, userAnswer, direction)}
            optionMeaning={getOptionMeaning}
            example={showExamples && !examMode ? exampleState : undefined}
            onRequestExample={showExamples && !examMode ? (force?: boolean) => requestExample(force ?? false) : undefined}
            debugInfo={showExamples && !examMode ? exampleState?.error || null : null}
            examMode={examMode}
          />

          <div style={{ display: 'flex', justifyContent: 'center', marginTop: '16px' }}>
            <button
              className="btn btn-primary"
              onClick={() => goNextQuestion()}
              disabled={examMode || !hasAnswered}
              style={examMode ? { opacity: 0.5, cursor: 'not-allowed' } : undefined}
            >
              {currentIndex >= questions.length - 1 ? 'Bitir' : 'Sonraki Soru'}
            </button>
          </div>

          {!examMode && (
            <div
              style={{
                display: 'flex',
                justifyContent: 'center',
                gap: '30px',
                marginTop: '20px',
                fontSize: '1rem'
              }}
            >
              <div style={{ color: 'var(--success)' }}>Dogru: {correctCount}</div>
              <div style={{ color: 'var(--danger)' }}>Yanlis: {wrongWords.length}</div>
            </div>
          )}
        </div>
      );
    }
  }

  return null;
};

export default Quiz;
