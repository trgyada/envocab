import React, { useEffect, useState } from 'react';
import { PartOfSpeech, QuizQuestion, Word } from '../types';
import SelectableText from './SelectableText';
import { useWordListStore } from '../stores/wordListStore';

interface MultipleChoiceProps {
  question: QuizQuestion;
  onAnswer: (isCorrect: boolean, word: Word) => void;
  optionMeaning?: (option: string) => string;
  example?: {
    sentence?: string;
    translation?: string;
    loading?: boolean;
    error?: string;
    lang?: 'en' | 'tr';
  };
  onRequestExample?: () => void;
  debugInfo?: string | null;
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
  debugInfo
}) => {
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [selectedWord, setSelectedWord] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  const [translateError, setTranslateError] = useState<string | null>(null);
  const { addUnknownWord } = useWordListStore();

  useEffect(() => {
    setSelectedAnswer(null);
    setShowResult(false);
    setIsTransitioning(false);
    setSelectedWord(null);
    setIsModalOpen(false);
    setTranslateError(null);
  }, [question.id]);

  const handleOptionClick = (option: string) => {
    if (showResult || isTransitioning) return;
    setSelectedAnswer(option);
    setShowResult(true);
    setIsTransitioning(true);
    const isCorrect = option === question.correctAnswer;
    setTimeout(() => onAnswer(isCorrect, question.word), 1);
  };

  const handleUnknown = () => {
    if (showResult || isTransitioning) return;
    setSelectedAnswer('UNKNOWN');
    setShowResult(true);
    setIsTransitioning(true);
    setTimeout(() => onAnswer(false, question.word), 1);
  };

  const getButtonClass = (option: string) => {
    const base = 'option-btn';
    if (!showResult) return base;
    if (option === question.correctAnswer) return `${base} correct`;
    if (option === selectedAnswer && option !== question.correctAnswer) return `${base} incorrect`;
    return base;
  };

  const isEnglishToTurkish = question.direction !== 'tr-to-en';
  const directionLabel = isEnglishToTurkish ? 'Ingilizce -> Turkce' : 'Turkce -> Ingilizce';
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
  };

  const confirmAddUnknown = async () => {
    if (!selectedWord) return;
    setIsTranslating(true);
    setTranslateError(null);
    const lang = example?.lang || (question.direction === 'tr-to-en' ? 'tr' : 'en');
    const target = lang === 'tr' ? 'en' : 'tr';
    try {
      const res = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: selectedWord, from: lang, to: target })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Ceviri basarisiz');
      const english = lang === 'en' ? selectedWord : data.translation || selectedWord;
      const turkish = lang === 'tr' ? selectedWord : data.translation || selectedWord;
      addUnknownWord({ english, turkish, source: 'example' });
      setIsModalOpen(false);
    } catch (err: any) {
      setTranslateError(err?.message || 'Ceviri yapilamadi');
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
          §Y"S
        </button>
      </div>
      <p className="question-hint">
        {isEnglishToTurkish ? 'Dogru Turkce karsiligini sec' : 'Dogru Ingilizce karsiligini sec'}
      </p>

      {onRequestExample && (
        <div className="example-box">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px' }}>
            <div className="example-title">Ornek cumle (Gemini)</div>
            <button className="btn btn-outline btn-sm" onClick={onRequestExample} disabled={example?.loading}>
              {example?.loading ? 'Yukleniyor...' : 'Yeniden getir'}
            </button>
          </div>
          {example?.error && <div className="example-error">{example.error}</div>}
          {example?.sentence && (
            <div className="example-sentence">
              <SelectableText text={example.sentence} onWordClick={handleWordClick} />
              {showResult && example.translation && (
                <div className="example-translation">Ceviri: {example.translation}</div>
              )}
            </div>
          )}
          {debugInfo && <div className="example-debug">{debugInfo}</div>}
        </div>
      )}

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

      {showResult && (
        <div className={`result-feedback ${selectedAnswer === question.correctAnswer ? 'correct' : 'incorrect'}`}>
          {selectedAnswer === question.correctAnswer ? (
            <>DoŽYru!</>
          ) : (
            <>
              {selectedAnswer === 'UNKNOWN' ? 'Bilmiyorum olarak iYaretlendi. ' : 'YanlŽñY! '}
              Doru cevap: <strong>{question.correctAnswer}</strong>
            </>
          )}
        </div>
      )}

      {isModalOpen && selectedWord && (
        <div className="modal-backdrop">
          <div className="modal-card">
            <h4>Bilinmeyen kelime</h4>
            <p>
              <strong>{selectedWord}</strong> kelimesini “Bilinmeyenler” listesine eklemek ister misin?
            </p>
            {translateError && <div className="example-error" style={{ marginBottom: 8 }}>{translateError}</div>}
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button className="btn btn-outline btn-sm" onClick={() => setIsModalOpen(false)} disabled={isTranslating}>
                Iptal
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
