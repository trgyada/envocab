const normalizeSpeechText = (value: string, locale: string) =>
  value
    .normalize('NFC')
    .toLocaleLowerCase(locale)
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const levenshteinDistance = (left: string, right: string) => {
  const previous = Array.from({ length: right.length + 1 }, (_, index) => index);

  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    const current = [leftIndex];
    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      const substitutionCost = left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1;
      current[rightIndex] = Math.min(
        current[rightIndex - 1] + 1,
        previous[rightIndex] + 1,
        previous[rightIndex - 1] + substitutionCost,
      );
    }
    previous.splice(0, previous.length, ...current);
  }

  return previous[right.length];
};

export const getSpeechSimilarity = (target: string, transcript: string, locale: string) => {
  const normalizedTarget = normalizeSpeechText(target, locale);
  const normalizedTranscript = normalizeSpeechText(transcript, locale);
  const longestLength = Math.max(normalizedTarget.length, normalizedTranscript.length);
  if (!longestLength) return 0;
  return 1 - levenshteinDistance(normalizedTarget, normalizedTranscript) / longestLength;
};

export const getSupportedRecordingMimeType = () => {
  if (typeof MediaRecorder === 'undefined') return '';
  const candidates = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/webm'];
  return candidates.find((type) => MediaRecorder.isTypeSupported(type)) || '';
};
