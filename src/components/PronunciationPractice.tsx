import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Mic, Play, RotateCcw, Square, Volume2, X } from 'lucide-react';
import type { AppLanguageCode } from '../utils/languages';
import { getSpeechLanguage, speakText } from '../utils/speech';
import { getSpeechSimilarity, getSupportedRecordingMimeType } from '../utils/pronunciation';

interface PronunciationPracticeProps {
  text: string;
  language: AppLanguageCode;
  onClose: () => void;
}

interface SpeechRecognitionAlternativeLike {
  transcript: string;
  confidence: number;
}

interface SpeechRecognitionEventLike {
  results: ArrayLike<ArrayLike<SpeechRecognitionAlternativeLike>>;
}

interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

type RecognitionConstructor = new () => SpeechRecognitionLike;

const getRecognitionConstructor = (): RecognitionConstructor | null => {
  if (typeof window === 'undefined') return null;
  const speechWindow = window as typeof window & {
    SpeechRecognition?: RecognitionConstructor;
    webkitSpeechRecognition?: RecognitionConstructor;
  };
  return speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition || null;
};

const PronunciationPractice: React.FC<PronunciationPracticeProps> = ({ text, language, onClose }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioLevel, setAudioLevel] = useState(0);
  const [duration, setDuration] = useState(0);
  const [transcript, setTranscript] = useState('');
  const [similarity, setSimilarity] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [audioQuality, setAudioQuality] = useState<'ready' | 'quiet' | 'short' | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef(0);
  const maxLevelRef = useRef(0);
  const mountedRef = useRef(true);
  const recognitionSupported = Boolean(getRecognitionConstructor());
  const speechLocale = getSpeechLanguage(language);

  const releaseCapture = useCallback(() => {
    if (animationFrameRef.current !== null) cancelAnimationFrame(animationFrameRef.current);
    animationFrameRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      void audioContextRef.current.close();
    }
    audioContextRef.current = null;
    setAudioLevel(0);
  }, []);

  const resetAttempt = useCallback(() => {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioUrl(null);
    setDuration(0);
    setTranscript('');
    setSimilarity(null);
    setAudioQuality(null);
    setError('');
  }, [audioUrl]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === 'recording') mediaRecorderRef.current.stop();
    try {
      recognitionRef.current?.stop();
    } catch {
      recognitionRef.current?.abort();
    }
    recognitionRef.current = null;
    setIsRecording(false);
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        stopRecording();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, stopRecording]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      mountedRef.current = false;
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  useEffect(() => () => {
    recognitionRef.current?.abort();
    releaseCapture();
    if (audioUrl) URL.revokeObjectURL(audioUrl);
  }, [audioUrl, releaseCapture]);

  const startLevelMeter = (stream: MediaStream) => {
    const AudioContextConstructor = window.AudioContext ||
      (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextConstructor) return;
    const context = new AudioContextConstructor();
    const source = context.createMediaStreamSource(stream);
    const analyser = context.createAnalyser();
    analyser.fftSize = 1024;
    source.connect(analyser);
    const samples = new Float32Array(analyser.fftSize);
    audioContextRef.current = context;

    const updateMeter = () => {
      analyser.getFloatTimeDomainData(samples);
      const rms = Math.sqrt(samples.reduce((total, sample) => total + sample * sample, 0) / samples.length);
      const normalizedLevel = Math.min(1, rms * 7);
      maxLevelRef.current = Math.max(maxLevelRef.current, normalizedLevel);
      setAudioLevel(normalizedLevel);
      animationFrameRef.current = requestAnimationFrame(updateMeter);
    };
    updateMeter();
  };

  const startRecognition = () => {
    const Recognition = getRecognitionConstructor();
    if (!Recognition) return;
    const recognition = new Recognition();
    recognition.lang = speechLocale;
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.maxAlternatives = 5;
    recognition.onresult = (event) => {
      const alternatives = Array.from(event.results[event.results.length - 1] || []);
      const ranked = alternatives
        .map((alternative) => ({
          transcript: alternative.transcript.trim(),
          similarity: getSpeechSimilarity(text, alternative.transcript, speechLocale),
        }))
        .sort((left, right) => right.similarity - left.similarity);
      if (ranked[0]) {
        setTranscript(ranked[0].transcript);
        setSimilarity(ranked[0].similarity);
      }
    };
    recognition.onerror = () => {
      recognitionRef.current = null;
    };
    recognitionRef.current = recognition;
    try {
      recognition.start();
    } catch {
      recognitionRef.current = null;
    }
  };

  const startRecording = async () => {
    resetAttempt();
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setError('Bu tarayıcı mikrofon kaydını desteklemiyor. Tarayıcıyı güncelleyip tekrar deneyin.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, channelCount: 1 },
      });
      streamRef.current = stream;
      chunksRef.current = [];
      maxLevelRef.current = 0;
      startedAtRef.current = Date.now();
      const mimeType = getSupportedRecordingMimeType();
      let recorder: MediaRecorder;
      try {
        recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      } catch {
        recorder = new MediaRecorder(stream);
      }
      mediaRecorderRef.current = recorder;
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        if (!mountedRef.current) {
          releaseCapture();
          return;
        }
        const elapsed = (Date.now() - startedAtRef.current) / 1000;
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || mimeType || 'audio/mp4' });
        if (blob.size > 0) setAudioUrl(URL.createObjectURL(blob));
        setDuration(elapsed);
        setAudioQuality(elapsed < 0.7 ? 'short' : maxLevelRef.current < 0.08 ? 'quiet' : 'ready');
        releaseCapture();
      };
      recorder.start();
      startLevelMeter(stream);
      startRecognition();
      setIsRecording(true);
    } catch (captureError) {
      releaseCapture();
      const denied = captureError instanceof DOMException && captureError.name === 'NotAllowedError';
      setError(denied ? 'Mikrofon izni verilmedi. Tarayıcı ayarlarından mikrofon erişimine izin verin.' : 'Mikrofon başlatılamadı. Başka bir mikrofonla tekrar deneyin.');
    }
  };

  const closeModal = () => {
    stopRecording();
    onClose();
  };

  const recognitionMessage = similarity === null
    ? null
    : similarity >= 0.9
      ? { tone: 'success', text: 'Hedef ifade algılandı.' }
      : similarity >= 0.65
        ? { tone: 'warning', text: 'Yakın duyuldu. Referansı tekrar dinleyip yeniden deneyin.' }
        : { tone: 'danger', text: 'Hedef ifade net algılanmadı. Daha yavaş tekrar deneyin.' };

  return createPortal((
    <div className="pronunciation-backdrop" onMouseDown={(event) => event.target === event.currentTarget && closeModal()}>
      <section className="pronunciation-dialog" role="dialog" aria-modal="true" aria-labelledby="pronunciation-title">
        <header className="pronunciation-header">
          <div>
            <span className="pronunciation-eyebrow">Telaffuz çalışması</span>
            <h2 id="pronunciation-title">{text}</h2>
          </div>
          <button type="button" className="pronunciation-icon-btn" onClick={closeModal} aria-label="Kapat" title="Kapat">
            <X size={20} aria-hidden="true" />
          </button>
        </header>

        <div className="pronunciation-reference">
          <span>Referans</span>
          <div className="pronunciation-reference-actions">
            <button type="button" className="btn btn-outline btn-sm" onClick={() => speakText(text, language)}>
              <Volume2 size={17} aria-hidden="true" /> Normal
            </button>
            <button type="button" className="btn btn-outline btn-sm" onClick={() => speakText(text, language, 0.68)}>
              <Play size={16} aria-hidden="true" /> Yavaş
            </button>
          </div>
        </div>

        <div className={`pronunciation-recorder ${isRecording ? 'is-recording' : ''}`}>
          <div className="pronunciation-meter" aria-hidden="true">
            <span style={{ width: `${Math.max(isRecording ? 4 : 0, audioLevel * 100)}%` }} />
          </div>
          <button
            type="button"
            className={`pronunciation-record-btn ${isRecording ? 'stop' : ''}`}
            onClick={isRecording ? stopRecording : startRecording}
          >
            {isRecording ? <Square size={20} aria-hidden="true" /> : <Mic size={21} aria-hidden="true" />}
            {isRecording ? 'Kaydı bitir' : audioUrl ? 'Yeniden kaydet' : 'Kaydı başlat'}
          </button>
          <span className="pronunciation-mode">
            {recognitionSupported ? 'Anlaşılırlık kontrolü açık' : 'Kayıt ve karşılaştırma modu'}
          </span>
        </div>

        {error && <div className="pronunciation-feedback danger" role="alert">{error}</div>}

        {audioUrl && (
          <div className="pronunciation-result">
            <div className="pronunciation-result-header">
              <strong>Kaydınız</strong>
              <span>{duration.toFixed(1)} sn</span>
            </div>
            <audio className="pronunciation-audio" controls src={audioUrl} preload="metadata" />
            {audioQuality === 'short' && <div className="pronunciation-feedback warning">Kayıt çok kısa. Kelimeyi biraz daha belirgin söyleyin.</div>}
            {audioQuality === 'quiet' && <div className="pronunciation-feedback warning">Ses seviyesi düşük. Mikrofona biraz daha yakın konuşun.</div>}
            {audioQuality === 'ready' && <div className="pronunciation-feedback success">Kayıt seviyesi ve süresi uygun.</div>}
            {transcript && (
              <div className="pronunciation-transcript">
                <span>Algılanan</span>
                <strong>{transcript}</strong>
              </div>
            )}
            {recognitionMessage && (
              <div className={`pronunciation-feedback ${recognitionMessage.tone}`} aria-live="polite">
                {recognitionMessage.text}
              </div>
            )}
            <button type="button" className="btn btn-outline btn-sm pronunciation-reset" onClick={resetAttempt}>
              <RotateCcw size={16} aria-hidden="true" /> Temizle
            </button>
          </div>
        )}

        <p className="pronunciation-privacy">
          Kayıt geçici olarak bu cihazda tutulur ve pencere kapatıldığında silinir.
        </p>
      </section>
    </div>
  ), document.body);
};

export default PronunciationPractice;
