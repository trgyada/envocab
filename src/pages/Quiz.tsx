import React, { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import MultipleChoice from '../components/MultipleChoice';
import Matching from '../components/Matching';
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
      ⏱️ {minutes}:{seconds}
    </div>
  );
};

type ExampleState = {
  sentence?: string;
  translation?: string;
  loading?: boolean;
  error?: string;
};

const Quiz: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { wordLists, selectedListId, selectWordList, updateWordMastery } = useWordListStore();
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
  const [currentIndex, setCurrentIndex] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [wrongWords, setWrongWords] = useState<Word[]>([]);
  const [startTime, setStartTime] = useState<Date | null>(null);
  const [questionCount, setQuestionCount] = useState(10);
  const [onlyDifficultWords, setOnlyDifficultWords] = useState(false);
  const [useSM2Selection, setUseSM2Selection] = useState(true);
  const [showExamples, setShowExamples] = useState(false);
  const [exampleMap, setExampleMap] = useState<Record<string, ExampleState>>({});

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
    let wordsToUse: Word[];

    if (onlyDifficultWords) {
      wordsToUse = difficultWords;
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
    setCurrentIndex(0);
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
        duration
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

  const handleAnswer = (isCorrect: boolean, word: Word) => {
    const totalQuestions = totalQuestionsRef.current || questions.length;
    const responseTimeMs = Date.now() - questionStartTimeRef.current;
    if (selectedListId) updateWordMastery(selectedListId, word.id, isCorrect);
    updateSM2CardState(word, isCorrect, responseTimeMs);

    const newCorrect = isCorrect ? correctCount + 1 : correctCount;
    const newWrong = isCorrect ? wrongWords : [...wrongWords, word];
    setCorrectCount(newCorrect);
    setWrongWords(newWrong);

    const isLast = currentIndex >= totalQuestions - 1;
    if (isLast) {
      setTimeout(() => finishQuiz(newCorrect, totalQuestions, newWrong), 1000);
    } else {
      setTimeout(() => {
        setCurrentIndex((prev) => prev + 1);
        questionStartTimeRef.current = Date.now();
      }, 1000);
    }
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
  if (phase === 'select-type') {
    const maxQuestions = selectedList?.words.length || 10;
    return (
      <div className="quiz-container">
        <h1 style={{ marginBottom: '10px', textAlign: 'center' }}>Quiz Ayarları</h1>
        <p style={{ textAlign: 'center', color: 'var(--text-secondary)', marginBottom: '30px' }}>
          {selectedList?.title} - {selectedList?.words.length} kelime
        </p>

        <div style={{ maxWidth: '520px', margin: '0 auto' }}>
          <div style={{ marginBottom: '30px' }}>
            <label style={{ display: 'block', marginBottom: '10px', fontWeight: '600' }}>
              Soru Sayısı: {questionCount}
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
            <label style={{ display: 'block', marginBottom: '15px', fontWeight: '600' }}>Quiz Tipi Seç</label>
            <div className="quiz-type-grid">
              {[
                { type: 'multiple-choice' as QuizType, icon: '📝', label: 'Çoktan Seçmeli' },
                { type: 'flashcard' as QuizType, icon: '📑', label: 'Flashcard' },
                { type: 'matching' as QuizType, icon: '🔗', label: 'Eşleştirme' }
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
          </div>

          <div style={{ marginBottom: '24px' }}>
            <label style={{ display: 'block', marginBottom: '12px', fontWeight: '600' }}>Soru yönü</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '10px' }}>
              {[
                { value: 'mixed' as const, label: 'Karışık' },
                { value: 'en-to-tr' as const, label: 'İng → Tr' },
                { value: 'tr-to-en' as const, label: 'Tr → İng' }
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
              gap: '10px'
            }}
          >
            <div>
              <div style={{ fontWeight: '700', marginBottom: '6px' }}>Örnek cümle (Gemini)</div>
              <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                Butonla aç; yanıt sonrası çeviri gösterilir (kota için kapalı başlar).
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input
                id="toggle-example"
                type="checkbox"
                checked={showExamples}
                onChange={(e) => setShowExamples(e.target.checked)}
              />
              <label htmlFor="toggle-example" style={{ fontSize: '0.9rem' }}>
                Açık
              </label>
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
                  Sadece daha önce hata yapılan kelimeler ({difficultWords.length} kelime)
                </div>
              </div>
              <div
                style={{
                  width: '50px',
                  height: '28px',
                  borderRadius: '14px',
                  background: onlyDifficultWords ? 'var(--danger)' : '#e2e8f0',
                  position: 'relative',
                  transition: 'all 0.2s ease'
                }}
              >
                <div
                  style={{
                    width: '22px',
                    height: '22px',
                    borderRadius: '50%',
                    background: onlyDifficultWords ? '#0b0f1c' : '#e5e7eb',
                    position: 'absolute',
                    top: '3px',
                    left: onlyDifficultWords ? '25px' : '3px',
                    transition: 'all 0.2s ease'
                  }}
                />
              </div>
            </div>
            {onlyDifficultWords && difficultWords.length === 0 && (
              <div style={{ marginTop: '10px', color: 'var(--warning)', fontSize: '0.9rem' }}>
                Henüz işaretli zor kelime yok. Önce birkaç quiz çözebilirsiniz.
              </div>
            )}
          </div>

          <button
            className="btn btn-primary btn-lg"
            onClick={startQuiz}
            style={{ width: '100%', marginTop: '20px' }}
            disabled={onlyDifficultWords && difficultWords.length === 0}
          >
            Quiz'i Başlat
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
            Farklı Liste Seç
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

    // multiple choice
    if (questions.length > 0 && currentIndex < questions.length) {
      const currentQuestion = questions[currentIndex];
      const exampleKey = `${currentQuestion.word.id}-${currentQuestion.direction}`;
      const exampleState = exampleMap[exampleKey];

      const requestExample = async () => {
        if (!showExamples) return;
        if (exampleState?.sentence && !exampleState.error) return;
        setExampleMap((prev) => ({ ...prev, [exampleKey]: { ...prev[exampleKey], loading: true, error: undefined } }));
        const lang = currentQuestion.direction === 'tr-to-en' ? 'tr' : 'en';
        try {
          const res = await fetch('/api/example', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              word: lang === 'tr' ? currentQuestion.word.turkish : currentQuestion.word.english,
              lang
            })
          });
          if (!res.ok) throw new Error('İstek başarısız');
          const data = await res.json();
          setExampleMap((prev) => ({
            ...prev,
            [exampleKey]: { sentence: data.sentence, translation: data.translation, loading: false }
          }));
        } catch (err) {
          setExampleMap((prev) => ({
            ...prev,
            [exampleKey]: { loading: false, error: 'Örnek cümle alınamadı.' }
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
            question={currentQuestion}
            onAnswer={(isCorrect, word) => handleAnswer(isCorrect, word)}
            optionMeaning={getOptionMeaning}
            example={showExamples ? exampleState : undefined}
            onRequestExample={showExamples ? requestExample : undefined}
          />

          <div
            style={{
              display: 'flex',
              justifyContent: 'center',
              gap: '30px',
              marginTop: '20px',
              fontSize: '1rem'
            }}
          >
            <div style={{ color: 'var(--success)' }}>Doğru: {correctCount}</div>
            <div style={{ color: 'var(--danger)' }}>Yanlış: {wrongWords.length}</div>
          </div>
        </div>
      );
    }
  }

  return null;
};

export default Quiz;


