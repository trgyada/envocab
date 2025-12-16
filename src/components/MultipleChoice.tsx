import React, { useEffect, useState } from 'react';
import { PartOfSpeech, QuizQuestion, Word } from '../types';
import SelectableText from './SelectableText';
import { useWordListStore } from '../stores/wordListStore';

interface MultipleChoiceProps {
  question: QuizQuestion;
  onAnswer: (isCorrect: boolean, word: Word, userAnswer: string, direction: 'en-to-tr' | 'tr-to-en' | undefined) => void;
  optionMeaning?: (option: string) => string;
  example?: {
    sentence?: string;
    translation?: string;
    loading?: boolean;
    error?: string;
    lang?: 'en' | 'tr';
  };
  onRequestExample?: (force?: boolean) => void;
  definition?: {
    text?: string;
    loading?: boolean;
    error?: string;
  };
  debugInfo?: string | null;
  examMode?: boolean;
}

const getPartOfSpeechLabel = (pos?: PartOfSpeech): string => {
  if (!pos) return '';
  const labels: Record<PartOfSpeech, string> = {
    n: '(n.)',
    v: '(v.)',
    adj: '(adj.)',
    adv: '(adv.)',
    prep: '(prep.)',
    conj: '(conj.)',
    pron: '(pron.)',
    interj: '(interj.)',
    det: '(det.)',
    phr: '(phr.)',
    '': ''
  };
  return labels[pos] || '';
};

const MultipleChoice: React.FC<MultipleChoiceProps> = ({
  question,
  onAnswer,
  optionMeaning,
  example,
  onRequestExample,
  definition,
  debugInfo,
  examMode
}) => {
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [selectedWord, setSelectedWord] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  const [translationText, setTranslationText] = useState<string | null>(null);
  const [translateError, setTranslateError] = useState<string | null>(null);
  const [showDefinition, setShowDefinition] = useState(false);
  const { addUnknownWord, wordLists } = useWordListStore();

  useEffect(() => {
    setSelectedAnswer(null);
    setShowResult(false);
    setIsTransitioning(false);
    setSelectedWord(null);
    setIsModalOpen(false);
    setTranslateError(null);
    setTranslationText(null);
    setShowDefinition(false);
  }, [question.id]);

  const handleOptionClick = (option: string) => {
    if ((!examMode && showResult) || isTransitioning) return;
    setSelectedAnswer(option);
    if (!examMode) setShowResult(true);
    setIsTransitioning(true);
    const isCorrect = option === question.correctAnswer;
    setTimeout(() => onAnswer(isCorrect, question.word, option, question.direction), 1);
  };

  const handleUnknown = () => {
    if ((!examMode && showResult) || isTransitioning) return;
    setSelectedAnswer('UNKNOWN');
    if (!examMode) setShowResult(true);
    setIsTransitioning(true);
    setTimeout(() => onAnswer(false, question.word, 'UNKNOWN', question.direction), 1);
  };

  const getButtonClass = (option: string) => {
    const base = 'option-btn';
    if (examMode) {
      return `${base} ${selectedAnswer === option ? 'selected-neutral' : ''}`.trim();
    }
    if (!showResult) return base;
    if (option === question.correctAnswer) return `${base} correct`;
    if (option === selectedAnswer && option !== question.correctAnswer) return `${base} incorrect`;
    return base;
  };

  const isEnglishToTurkish = question.direction !== 'tr-to-en';
  const directionLabel = isEnglishToTurkish ? 'İngilizce -> Türkçe' : 'Türkçe -> İngilizce';
  const speakCurrent = () => {
    const text = isEnglishToTurkish ? question.word.english : question.word.turkish;
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = isEnglishToTurkish ? 'en-US' : 'tr-TR';
    speechSynthesis.speak(utter);
  };

  const handleWordClick = (word: string) => {
    setSelectedWord(word);
    setIsModalOpen(true);
    setTranslateError(null);
    setTranslationText(null);
    const lang = example?.lang || (question.direction === 'tr-to-en' ? 'tr' : 'en');
    const target = lang === 'tr' ? 'en' : 'tr';
    setIsTranslating(true);
    fetch('/api/translate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: word, from: lang, to: target })
    })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || 'Çeviri başarısız');
        setTranslationText(data.translation || '');
      })
      .catch((err: any) => {
        setTranslateError(err?.message || 'Çeviri yapılamadı');
      })
      .finally(() => setIsTranslating(false));
  };

  const confirmAddUnknown = async () => {
    if (!selectedWord) return;
    setIsTranslating(true);
    setTranslateError(null);
    const lang = example?.lang || (question.direction === 'tr-to-en' ? 'tr' : 'en');
    const target = lang === 'tr' ? 'en' : 'tr';
    const unknownList = wordLists.find((l) => l.id === 'unknown');
    const normalized = (lang === 'en' ? selectedWord : translationText || selectedWord).trim().toLowerCase();
    if (unknownList?.words.some((w) => w.english.trim().toLowerCase() === normalized)) {
      setTranslateError('Bu kelime zaten Bilinmeyenler listesinde.');
      setIsTranslating(false);
      return;
    }
    try {
      let finalTranslation = translationText;
      if (!finalTranslation) {
        const res = await fetch('/api/translate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: selectedWord, from: lang, to: target })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || 'Çeviri başarısız');
        finalTranslation = data.translation || '';
      }
      const english = lang === 'en' ? selectedWord : finalTranslation || selectedWord;
      const turkish = lang === 'tr' ? selectedWord : finalTranslation || selectedWord;
      addUnknownWord({ english, turkish, source: 'example' });
      setIsModalOpen(false);
    } catch (err: any) {
      setTranslateError(err?.message || 'Çeviri yapılamadı');
    } finally {
      setIsTranslating(false);
    }
  };

  return (
    <div className="quiz-card">
      <div className="question-badge">{directionLabel}</div>
      <div className="question-text-row">
        <h2 className="question-text">
          {question.question}
          {question.word.partOfSpeech && (
            <span className="part-of-speech"> {getPartOfSpeechLabel(question.word.partOfSpeech)}</span>
          )}
        </h2>
        <button className="question-speak-btn" onClick={speakCurrent} title="Sesli oku">
          🔊
        </button>
      </div>
      <p className="question-hint">
        {isEnglishToTurkish ? 'Doğru Türkçe karşılığını seç' : 'Doğru İngilizce karşılığını seç'}
      </p>

      {onRequestExample && !examMode && (
        <div className="example-box">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px' }}>
            <div className="example-title">Örnek cümle (Gemini)</div>
            <button className="btn btn-outline btn-sm" onClick={() => onRequestExample?.(true)} disabled={example?.loading}>
              {example?.loading ? 'Yükleniyor...' : 'Yeniden getir'}
            </button>
          </div>
          {example?.error && <div className="example-error">{example.error}</div>}
          {example?.sentence && (
            <div className="example-sentence">
              <SelectableText text={example.sentence} onWordClick={handleWordClick} />
              {showResult && example.translation && (
                <div className="example-translation">Çeviri: {example.translation}</div>
              )}
            </div>
          )}
        </div>
      )}

      {definition && !examMode && (
        <div className="example-box" style={{ marginTop: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px' }}>
            <div className="example-title">🇬🇧 İngilizce Tanım</div>
            <button 
              className="btn btn-outline btn-sm" 
              onClick={() => setShowDefinition((v) => !v)} 
              disabled={definition?.loading}
            >
              {definition?.loading ? 'Yükleniyor...' : showDefinition ? 'Gizle' : 'Göster'}
            </button>
          </div>
          {definition?.error && <div className="example-error">{definition.error}</div>}
          {showDefinition && definition?.text && (
            <div className="example-sentence" style={{ fontStyle: 'italic', color: 'var(--text-secondary)' }}>
              {definition.text}
            </div>
          )}
        </div>
      )}

      {debugInfo && <div className="example-debug">{debugInfo}</div>}

      <div className="options">
        {question.options?.map((option, index) => (
          <button
            key={`${question.id}-${index}`}
            className={getButtonClass(option)}
            onClick={() => handleOptionClick(option)}
            disabled={showResult}
          >
            <span className="option-letter">{String.fromCharCode(65 + index)}</span>
            <span className="option-text">{option}</span>
            {showResult && optionMeaning && <span className="option-meaning-inline">{optionMeaning(option) || ''}</span>}
            {showResult && option === question.correctAnswer && <span className="option-icon"></span>}
            {showResult && option === selectedAnswer && option !== question.correctAnswer && (
              <span className="option-icon"></span>
            )}
          </button>
        ))}
      </div>

      {!showResult && (
        <div style={{ marginTop: '14px', textAlign: 'center' }}>
          <button className="btn btn-outline btn-sm" onClick={handleUnknown}>
            Bilmiyorum / Listeye ekle
          </button>
        </div>
      )}

      {!examMode && showResult && (
        <div className={`result-feedback ${selectedAnswer === question.correctAnswer ? 'correct' : 'incorrect'}`}>
          {selectedAnswer === question.correctAnswer ? (
            <>Doğru!</>
          ) : (
            <>
              {selectedAnswer === 'UNKNOWN' ? 'Bilmiyorum olarak işaretlendi. ' : 'Yanlış! '}
              Doğru cevap: <strong>{question.correctAnswer}</strong>
            </>
          )}
        </div>
      )}

      {isModalOpen && selectedWord && (
        <div className="modal-backdrop">
          <div className="modal-card">
            <h4>Bilinmeyen kelime</h4>
            <p>
              <strong>{selectedWord}</strong> kelimesini Bilinmeyenler listesine eklemek ister misin?
            </p>
            {translationText && (
              <div style={{ marginBottom: 8, color: 'var(--text-secondary)' }}>
                Çeviri: <strong>{translationText}</strong>
              </div>
            )}
            {translateError && <div className="example-error" style={{ marginBottom: 8 }}>{translateError}</div>}
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button className="btn btn-outline btn-sm" onClick={() => setIsModalOpen(false)} disabled={isTranslating}>
                İptal
              </button>
              <button className="btn btn-primary btn-sm" onClick={confirmAddUnknown} disabled={isTranslating}>
                {isTranslating ? 'Ekleniyor...' : 'Ekle'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MultipleChoice;


