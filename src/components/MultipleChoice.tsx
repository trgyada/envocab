import React, { useEffect, useState } from 'react';
import { RefreshCw, Volume2 } from 'lucide-react';
import { PartOfSpeech, QuizQuestion, Word } from '../types';
import SelectableText from './SelectableText';
import { useWordListStore } from '../stores/wordListStore';
import {
  AppLanguageCode,
  DEFAULT_STUDY_LANGUAGE,
  getStudyLanguageConfig,
} from '../utils/languages';
import {
  GERMAN_EXAMPLE_LEVEL_OPTIONS,
  type GermanExampleLevel,
} from '../utils/exampleGeneration';
import { speakText } from '../utils/speech';

interface MultipleChoiceProps {
  question: QuizQuestion;
  onAnswer: (isCorrect: boolean, word: Word, userAnswer: string, direction: 'en-to-tr' | 'tr-to-en' | undefined) => void;
  optionMeaning?: (option: string) => string;
  example?: {
    sentence?: string;
    translation?: string;
    loading?: boolean;
    error?: string;
    lang?: AppLanguageCode;
    level?: GermanExampleLevel;
  };
  onRequestExample?: (force?: boolean) => void;
  germanExampleLevel?: GermanExampleLevel;
  onGermanExampleLevelChange?: (level: GermanExampleLevel) => void;
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
  germanExampleLevel,
  onGermanExampleLevelChange,
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
  const { addUnknownWord, wordLists, activeLanguage } = useWordListStore();
  const studyLanguage = activeLanguage || DEFAULT_STUDY_LANGUAGE;
  const languageConfig = getStudyLanguageConfig(studyLanguage);

  useEffect(() => {
    setSelectedAnswer(null);
    setShowResult(false);
    setIsTransitioning(false);
    setSelectedWord(null);
    setIsModalOpen(false);
    setTranslateError(null);
    setTranslationText(null);
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

  const isSynonymMode = question.questionType === 'synonym';
  const isEnglishToTurkish = isSynonymMode ? true : question.direction !== 'tr-to-en';
  const directionLabel = isSynonymMode
    ? `${languageConfig.sourceLabel} → ${languageConfig.sourceLabel}`
    : isEnglishToTurkish
      ? `${languageConfig.sourceLabel} → Türkçe`
      : `Türkçe → ${languageConfig.sourceLabel}`;
  const speakCurrent = () => {
    const text = isEnglishToTurkish ? question.word.english : question.word.turkish;
    speakText(text, isEnglishToTurkish ? studyLanguage : 'tr');
  };

  const speakExample = () => {
    if (!example?.sentence) return;
    speakText(example.sentence, example.lang || studyLanguage);
  };

  const handleWordClick = (word: string) => {
    setSelectedWord(word);
    setIsModalOpen(true);
    setTranslateError(null);
    setTranslationText(null);
    const lang = example?.lang || (question.direction === 'tr-to-en' ? 'tr' : studyLanguage);
    const target = lang === 'tr' ? studyLanguage : 'tr';
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
    const lang = example?.lang || (question.direction === 'tr-to-en' ? 'tr' : studyLanguage);
    const target = lang === 'tr' ? studyLanguage : 'tr';
    const unknownList = wordLists.find((l) => l.id === 'unknown');
    const normalized = (lang === 'tr' ? translationText || selectedWord : selectedWord).trim().toLowerCase();
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
      const english = lang === 'tr' ? finalTranslation || selectedWord : selectedWord;
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
        <button
          type="button"
          className="question-speak-btn"
          onClick={speakCurrent}
          title="Soruyu seslendir"
          aria-label="Soruyu seslendir"
        >
          <Volume2 size={18} aria-hidden="true" />
        </button>
      </div>
      <p className="question-hint">
        {isSynonymMode
          ? 'Doğru eş anlamlıyı seç'
          : (isEnglishToTurkish ? 'Doğru Türkçe karşılığını seç' : `Doğru ${languageConfig.sourceLabel} karşılığını seç`)}
      </p>

      {onRequestExample && !examMode && (
        <div className="example-box">
          <div className="example-header">
            <div className="example-title">
              Örnek cümle (Gemini)
              {example?.level && <small className="example-level-badge">{example.level.toUpperCase()}</small>}
            </div>
            <div className="example-actions">
              {example?.sentence && (
                <button
                  type="button"
                  className="example-speak-btn"
                  onClick={speakExample}
                  title="Örnek cümleyi seslendir"
                  aria-label="Örnek cümleyi seslendir"
                >
                  <Volume2 size={17} aria-hidden="true" />
                </button>
              )}
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => onRequestExample?.(true)}
                disabled={example?.loading}
              >
                <RefreshCw size={16} aria-hidden="true" />
                {example?.loading ? 'Yükleniyor...' : 'Yeniden getir'}
              </button>
            </div>
          </div>
          {germanExampleLevel && onGermanExampleLevelChange && (
            <div className="example-inline-level">
              <span>Seviye</span>
              <div className="example-level-segments compact">
                {GERMAN_EXAMPLE_LEVEL_OPTIONS.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    className={germanExampleLevel === option.id ? 'active' : ''}
                    onClick={() => onGermanExampleLevelChange(option.id)}
                    aria-pressed={germanExampleLevel === option.id}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          )}
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
          <div className="example-title">{languageConfig.flag} {languageConfig.definitionLabel}</div>
          {definition?.loading && <div className="example-sentence">Yükleniyor...</div>}
          {definition?.error && <div className="example-error">{definition.error}</div>}
          {!definition?.loading && definition?.text && (
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


