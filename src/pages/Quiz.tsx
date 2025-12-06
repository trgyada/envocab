import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWordListStore } from '../stores/wordListStore';
import { useUserProgressStore } from '../stores/userProgressStore';
import { QuizQuestion, QuizType, Word } from '../types';
import { generateQuiz, calculateScore } from '../services/quizEngine';
import MultipleChoice from '../components/MultipleChoice';
import Matching from '../components/Matching';

type QuizPhase = 'select-list' | 'select-type' | 'quiz' | 'finished';

// Timer Component
const Timer: React.FC<{ startTime: Date | null }> = ({ startTime }) => {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!startTime) return;
    
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTime.getTime()) / 1000));
    }, 1000);

    return () => clearInterval(interval);
  }, [startTime]);

  const minutes = Math.floor(elapsed / 60);
  const seconds = elapsed % 60;

  return (
    <div style={{ 
      display: 'flex', 
      alignItems: 'center', 
      gap: '8px',
      padding: '8px 16px',
      background: 'rgba(102, 126, 234, 0.2)',
      borderRadius: '20px',
      fontSize: '1rem',
      fontWeight: '600'
    }}>
      ⏱️ {minutes.toString().padStart(2, '0')}:{seconds.toString().padStart(2, '0')}
    </div>
  );
};

const Quiz: React.FC = () => {
  const navigate = useNavigate();
  const { wordLists, selectedListId, selectWordList, updateWordMastery } = useWordListStore();
  const { addQuizResult } = useUserProgressStore();
  
  const [phase, setPhase] = useState<QuizPhase>('select-list');
  const [quizType, setQuizType] = useState<QuizType>('multiple-choice');
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [wrongWords, setWrongWords] = useState<Word[]>([]);
  const [startTime, setStartTime] = useState<Date | null>(null);
  const [questionCount, setQuestionCount] = useState(10);
  const [onlyDifficultWords, setOnlyDifficultWords] = useState(false); // Sadece zor kelimeler
  const [quizDirection, setQuizDirection] = useState<'en-to-tr' | 'tr-to-en'>('en-to-tr'); // Quiz yönü
  
  // Flashcard specific state
  const [flashcardWords, setFlashcardWords] = useState<Word[]>([]);
  const [currentFlashcardIndex, setCurrentFlashcardIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);

  // useRef to track total questions (to avoid closure issues)
  const totalQuestionsRef = useRef(0);
  const quizStartedRef = useRef(false);

  const selectedList = wordLists.find((list) => list.id === selectedListId);
  
  // Zor kelimeleri hesapla (yanlış sayısı > 0 veya mastery < 50)
  const difficultWords = selectedList?.words.filter(w => w.incorrectCount > 0 || (w.correctCount > 0 && w.mastery < 50)) || [];

  // Sadece quiz başlamadan önce ve liste seçildiğinde phase'i değiştir
  useEffect(() => {
    if (!quizStartedRef.current && selectedListId && wordLists.find(l => l.id === selectedListId)) {
      setPhase('select-type');
    }
  }, [selectedListId, wordLists]);

  const handleStartQuiz = () => {
    if (!selectedList) return;

    // Kullanılacak kelimeleri belirle
    const wordsToUse = onlyDifficultWords ? difficultWords : selectedList.words;
    
    if (wordsToUse.length === 0) {
      alert('Bu kategoride kelime bulunamadı!');
      return;
    }
    
    const count = Math.min(questionCount, wordsToUse.length);
    
    // Mark quiz as started
    quizStartedRef.current = true;
    
    // Reset all state
    setStartTime(new Date());
    setCorrectCount(0);
    setWrongWords([]);
    setCurrentIndex(0);
    
    if (quizType === 'matching') {
      setPhase('quiz');
      return;
    }

    if (quizType === 'flashcard') {
      const shuffled = [...wordsToUse].sort(() => Math.random() - 0.5).slice(0, count);
      setFlashcardWords(shuffled);
      setCurrentFlashcardIndex(0);
      setIsFlipped(false);
      totalQuestionsRef.current = shuffled.length;
      setPhase('quiz');
      return;
    }

    // Multiple choice or mixed
    const isEnglishToTurkish = quizDirection === 'en-to-tr';
    const generatedQuestions = generateQuiz(wordsToUse, quizType, count, isEnglishToTurkish);
    console.log('Generated', generatedQuestions.length, 'questions');
    setQuestions(generatedQuestions);
    totalQuestionsRef.current = generatedQuestions.length;
    setPhase('quiz');
  };

  const finishQuiz = (finalCorrect: number, finalTotal: number, finalWrongWords: Word[]) => {
    const endTime = new Date();
    const duration = startTime ? Math.round((endTime.getTime() - startTime.getTime()) / 1000) : 0;

    // Reset quiz started flag
    quizStartedRef.current = false;

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
      wrongWords: finalWrongWords,
    });

    navigate('/results', { 
      state: { 
        score: calculateScore(finalCorrect, finalTotal),
        correct: finalCorrect,
        total: finalTotal,
        wrongWords: finalWrongWords,
        quizType,
        duration
      } 
    });
  };

  const handleAnswer = (isCorrect: boolean, word: Word) => {
    const totalQuestions = totalQuestionsRef.current;
    
    console.log('Answer - currentIndex:', currentIndex, 'totalQuestions:', totalQuestions);
    
    if (selectedListId) {
      updateWordMastery(selectedListId, word.id, isCorrect);
    }

    const newCorrectCount = isCorrect ? correctCount + 1 : correctCount;
    const newWrongWords = isCorrect ? wrongWords : [...wrongWords, word];
    
    setCorrectCount(newCorrectCount);
    setWrongWords(newWrongWords);

    const isLastQuestion = currentIndex >= totalQuestions - 1;

    if (isLastQuestion) {
      setTimeout(() => {
        finishQuiz(newCorrectCount, totalQuestions, newWrongWords);
      }, 1200);
    } else {
      setTimeout(() => {
        setCurrentIndex(prev => prev + 1);
      }, 1200);
    }
  };

  const handleFlashcardAnswer = (knew: boolean) => {
    const currentWord = flashcardWords[currentFlashcardIndex];
    const totalCards = flashcardWords.length;
    
    if (selectedListId) {
      updateWordMastery(selectedListId, currentWord.id, knew);
    }

    const newCorrectCount = knew ? correctCount + 1 : correctCount;
    const newWrongWords = knew ? wrongWords : [...wrongWords, currentWord];
    
    setCorrectCount(newCorrectCount);
    setWrongWords(newWrongWords);
    setIsFlipped(false);

    const isLastCard = currentFlashcardIndex >= totalCards - 1;

    if (isLastCard) {
      setTimeout(() => {
        finishQuiz(newCorrectCount, totalCards, newWrongWords);
      }, 500);
    } else {
      setTimeout(() => {
        setCurrentFlashcardIndex(prev => prev + 1);
      }, 300);
    }
  };

  const handleMatchingComplete = (correct: number, total: number, wrong: Word[]) => {
    finishQuiz(correct, total, wrong);
  };

  // Quizden çık
  const handleExitQuiz = () => {
    if (window.confirm('Quiz\'den çıkmak istediğinize emin misiniz? İlerlemeniz kaydedilmeyecek.')) {
      quizStartedRef.current = false;
      setPhase('select-type');
      setCurrentIndex(0);
      setCorrectCount(0);
      setWrongWords([]);
      setStartTime(null);
    }
  };

  // Liste Seçimi
  if (phase === 'select-list') {
    return (
      <div className="quiz-container">
        <h1 style={{ marginBottom: '30px', textAlign: 'center' }}>📚 Liste Seç</h1>
        
        {wordLists.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">📭</div>
            <p>Henüz kelime listesi yok.</p>
            <button 
              className="btn btn-primary" 
              onClick={() => navigate('/word-lists')}
              style={{ marginTop: '20px' }}
            >
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

  // Quiz Tipi Seçimi
  if (phase === 'select-type') {
    const maxQuestions = selectedList?.words.length || 10;
    
    return (
      <div className="quiz-container">
        <h1 style={{ marginBottom: '10px', textAlign: 'center' }}>🎯 Quiz Ayarları</h1>
        <p style={{ textAlign: 'center', color: 'var(--text-secondary)', marginBottom: '30px' }}>
          {selectedList?.title} - {selectedList?.words.length} kelime
        </p>

        <div style={{ maxWidth: '500px', margin: '0 auto' }}>
          {/* Soru Sayısı */}
          <div style={{ marginBottom: '30px' }}>
            <label style={{ display: 'block', marginBottom: '10px', fontWeight: '600' }}>
              📝 Soru Sayısı: {questionCount}
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

          {/* Quiz Tipi */}
          <div style={{ marginBottom: '30px' }}>
            <label style={{ display: 'block', marginBottom: '15px', fontWeight: '600' }}>
              🎮 Quiz Tipi Seç
            </label>
            <div className="quiz-type-grid">
              {[
                { type: 'multiple-choice' as QuizType, icon: '📝', label: 'Çoktan Seçmeli' },
                { type: 'flashcard' as QuizType, icon: '🎴', label: 'Flashcard' },
                { type: 'matching' as QuizType, icon: '🔗', label: 'Eşleştirme' },
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

          {/* Dikkat Edilmesi Gereken Kelimeler Toggle */}
          <div 
            style={{ 
              marginBottom: '30px',
              padding: '15px 20px',
              background: onlyDifficultWords ? 'rgba(235, 51, 73, 0.15)' : 'rgba(255, 255, 255, 0.05)',
              borderRadius: '12px',
              border: onlyDifficultWords ? '2px solid var(--danger-color)' : '2px solid transparent',
              cursor: 'pointer',
              transition: 'all 0.3s ease'
            }}
            onClick={() => setOnlyDifficultWords(!onlyDifficultWords)}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontWeight: '600', marginBottom: '5px' }}>
                  ⚠️ Dikkat Edilmesi Gereken Kelimeler
                </div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  Sadece daha önce yanlış yapılan kelimeler ({difficultWords.length} kelime)
                </div>
              </div>
              <div 
                style={{ 
                  width: '50px', 
                  height: '28px', 
                  borderRadius: '14px',
                  background: onlyDifficultWords ? 'var(--danger-color)' : 'rgba(255,255,255,0.2)',
                  position: 'relative',
                  transition: 'all 0.3s ease'
                }}
              >
                <div 
                  style={{ 
                    width: '22px', 
                    height: '22px', 
                    borderRadius: '50%',
                    background: 'white',
                    position: 'absolute',
                    top: '3px',
                    left: onlyDifficultWords ? '25px' : '3px',
                    transition: 'all 0.3s ease'
                  }}
                />
              </div>
            </div>
            {onlyDifficultWords && difficultWords.length === 0 && (
              <div style={{ marginTop: '10px', color: 'var(--warning-color)', fontSize: '0.85rem' }}>
                ℹ️ Henüz yanlış yapılan kelime yok. Önce quiz çözerek başlayın!
              </div>
            )}
          </div>

          {/* Quiz Yönü Seçimi */}
          <div style={{ marginBottom: '30px' }}>
            <label style={{ display: 'block', marginBottom: '15px', fontWeight: '600' }}>
              🔄 Soru Yönü
            </label>
            <div style={{ display: 'flex', gap: '10px' }}>
              <div
                style={{
                  flex: 1,
                  padding: '15px',
                  borderRadius: '12px',
                  background: quizDirection === 'en-to-tr' ? 'rgba(102, 126, 234, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                  border: quizDirection === 'en-to-tr' ? '2px solid var(--primary-color)' : '2px solid transparent',
                  cursor: 'pointer',
                  textAlign: 'center',
                  transition: 'all 0.3s ease'
                }}
                onClick={() => setQuizDirection('en-to-tr')}
              >
                <div style={{ fontSize: '1.5rem', marginBottom: '5px' }}>🇬🇧 → 🇹🇷</div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>İngilizce → Türkçe</div>
              </div>
              <div
                style={{
                  flex: 1,
                  padding: '15px',
                  borderRadius: '12px',
                  background: quizDirection === 'tr-to-en' ? 'rgba(102, 126, 234, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                  border: quizDirection === 'tr-to-en' ? '2px solid var(--primary-color)' : '2px solid transparent',
                  cursor: 'pointer',
                  textAlign: 'center',
                  transition: 'all 0.3s ease'
                }}
                onClick={() => setQuizDirection('tr-to-en')}
              >
                <div style={{ fontSize: '1.5rem', marginBottom: '5px' }}>🇹🇷 → 🇬🇧</div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Türkçe → İngilizce</div>
              </div>
            </div>
          </div>

          {/* Başlat Butonu */}
          <button 
            className="btn btn-primary btn-lg" 
            onClick={handleStartQuiz}
            style={{ width: '100%', marginTop: '20px' }}
            disabled={onlyDifficultWords && difficultWords.length === 0}
          >
            🚀 Quiz'i Başlat
          </button>
          
          <button 
            className="btn btn-outline" 
            onClick={() => {
              quizStartedRef.current = false;
              selectWordList(null);
              setPhase('select-list');
            }}
            style={{ width: '100%', marginTop: '15px' }}
          >
            ← Farklı Liste Seç
          </button>
        </div>
      </div>
    );
  }

  // Quiz Aşaması
  if (phase === 'quiz' && selectedList) {
    // Matching Game
    if (quizType === 'matching') {
      const wordsForMatching = onlyDifficultWords ? difficultWords : selectedList.words;
      return (
        <Matching 
          words={wordsForMatching.slice(0, 8)} 
          onComplete={handleMatchingComplete}
          onExit={handleExitQuiz}
          onWordResult={(wordId, isCorrect) => {
            if (selectedListId) {
              updateWordMastery(selectedListId, wordId, isCorrect);
            }
          }}
        />
      );
    }

    // Flashcard Mode
    if (quizType === 'flashcard' && flashcardWords.length > 0) {
      const currentWord = flashcardWords[currentFlashcardIndex];
      const remaining = flashcardWords.length - currentFlashcardIndex;
      
      return (
        <div className="quiz-container">
          {/* Çıkış Butonu */}
          <button 
            className="quiz-exit-btn"
            onClick={handleExitQuiz}
            title="Quizden Çık"
          >
            ✕
          </button>

          <div className="quiz-header">
            <div className="quiz-progress">
              <div 
                className="quiz-progress-bar" 
                style={{ width: `${((currentFlashcardIndex + 1) / flashcardWords.length) * 100}%` }}
              />
            </div>
            <Timer startTime={startTime} />
          </div>

          <div style={{ textAlign: 'center', marginBottom: '10px', color: 'var(--text-secondary)' }}>
            Kart {currentFlashcardIndex + 1} / {flashcardWords.length} • Kalan: {remaining}
          </div>

          <div className="flashcard-container">
            <div 
              className={`flashcard ${isFlipped ? 'flipped' : ''}`} 
              onClick={() => setIsFlipped(!isFlipped)}
            >
              <div className="flashcard-front">
                <span className="flashcard-label">{quizDirection === 'en-to-tr' ? 'İngilizce' : 'Türkçe'}</span>
                <span>{quizDirection === 'en-to-tr' ? currentWord.english : currentWord.turkish}</span>
              </div>
              <div className="flashcard-back">
                <span className="flashcard-label">{quizDirection === 'en-to-tr' ? 'Türkçe' : 'İngilizce'}</span>
                <span>{quizDirection === 'en-to-tr' ? currentWord.turkish : currentWord.english}</span>
              </div>
            </div>

            {!isFlipped && (
              <p className="flashcard-tip">
                👆 Kartı çevirmek için tıkla
              </p>
            )}

            {isFlipped && (
              <div className="flashcard-controls">
                <button 
                  className="btn btn-danger" 
                  onClick={() => handleFlashcardAnswer(false)}
                >
                  ❌ Bilmedim
                </button>
                <button 
                  className="btn btn-secondary" 
                  onClick={() => handleFlashcardAnswer(true)}
                >
                  ✓ Bildim
                </button>
              </div>
            )}
          </div>

          <div style={{ 
            display: 'flex', 
            justifyContent: 'center', 
            gap: '30px', 
            marginTop: '30px',
            fontSize: '1.1rem'
          }}>
            <div style={{ color: 'var(--success-color)' }}>
              ✓ Doğru: {correctCount}
            </div>
            <div style={{ color: 'var(--danger-color)' }}>
              ✗ Yanlış: {wrongWords.length}
            </div>
          </div>
        </div>
      );
    }

    // Multiple Choice & Mixed Mode
    if (questions.length > 0 && currentIndex < questions.length) {
      const currentQuestion = questions[currentIndex];
      
      return (
        <div className="quiz-container">
          {/* Çıkış Butonu */}
          <button 
            className="quiz-exit-btn"
            onClick={handleExitQuiz}
            title="Quizden Çık"
          >
            ✕
          </button>

          <div className="quiz-header">
            <div className="quiz-progress">
              <div 
                className="quiz-progress-bar" 
                style={{ width: `${((currentIndex + 1) / questions.length) * 100}%` }}
              />
            </div>
            <Timer startTime={startTime} />
          </div>

          <div style={{ textAlign: 'center', marginBottom: '20px' }}>
            <span className="quiz-counter">Soru {currentIndex + 1} / {questions.length}</span>
          </div>

          <MultipleChoice
            question={currentQuestion}
            onAnswer={(isCorrect) => handleAnswer(isCorrect, currentQuestion.word)}
          />

          <div style={{ 
            display: 'flex', 
            justifyContent: 'center', 
            gap: '30px', 
            marginTop: '20px',
            fontSize: '1rem'
          }}>
            <div style={{ color: 'var(--success-color)' }}>
              ✓ Doğru: {correctCount}
            </div>
            <div style={{ color: 'var(--danger-color)' }}>
              ✗ Yanlış: {wrongWords.length}
            </div>
          </div>
        </div>
      );
    }
  }

  return null;
};

export default Quiz;
