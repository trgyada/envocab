import * as XLSX from 'xlsx';
import { PartOfSpeech } from '../types';

export interface RawWordEntry {
  english: string;
  turkish: string;
  partOfSpeech?: PartOfSpeech;
  exampleSentence?: string;      // 3rd column: English example sentence
  exampleTranslation?: string;   // 4th column: Turkish translation
  englishDefinition?: string;    // 5th column: English definition (EN-EN)
  synonyms?: string[];           // Synonyms column (optional)
}

export interface ParsedExcelResult {
  success: boolean;
  words: RawWordEntry[];
  error?: string;
  fileName: string;
}

const normalizePartOfSpeech = (pos: string): PartOfSpeech => {
  const normalized = pos.toLowerCase().trim().replace(/[().\s]/g, '');

  const mapping: Record<string, PartOfSpeech> = {
    n: 'n',
    noun: 'n',
    isim: 'n',
    v: 'v',
    verb: 'v',
    fiil: 'v',
    adj: 'adj',
    adjective: 'adj',
    s\u0131fat: 'adj',
    adv: 'adv',
    adverb: 'adv',
    zarf: 'adv',
    prep: 'prep',
    preposition: 'prep',
    edat: 'prep',
    conj: 'conj',
    conjunction: 'conj',
    ba\u011fla\u00e7: 'conj',
    pron: 'pron',
    pronoun: 'pron',
    zamir: 'pron',
    interj: 'interj',
    interjection: 'interj',
    \u00fcnlem: 'interj',
    det: 'det',
    determiner: 'det',
    belirte\u00e7: 'det',
    phr: 'phr',
    phrase: 'phr',
    deyim: 'phr',
  };

  return mapping[normalized] || '';
};

const parseCSVContent = (content: string): RawWordEntry[] => {
  const lines = content.split('\n').filter((line) => line.trim());
  const words: RawWordEntry[] = [];

  for (const line of lines) {
    let parts = line.split(';');
    if (parts.length < 2) {
      parts = line.split(',');
    }

    if (parts.length >= 2) {
      const english = parts[0].trim();
      const turkish = parts[1].trim();

      if (
        english.toLowerCase().includes('english') ||
        english.toLowerCase().includes('eng') ||
        english.toLowerCase().includes('ingilizce') ||
        turkish.toLowerCase().includes('turkish') ||
        turkish.toLowerCase().includes('t\u00fcrk\u00e7e')
      ) {
        continue;
      }

      if (english && turkish) {
        const entry: RawWordEntry = { english, turkish };

        if (parts.length >= 6) {
          const exampleSentence = parts[2]?.trim();
          const exampleTranslation = parts[3]?.trim();
          const englishDefinition = parts[4]?.trim();
          const synonymsRaw = parts[5]?.trim();

          if (exampleSentence) entry.exampleSentence = exampleSentence;
          if (exampleTranslation) entry.exampleTranslation = exampleTranslation;
          if (englishDefinition) entry.englishDefinition = englishDefinition;
          if (synonymsRaw) {
            entry.synonyms = synonymsRaw
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean);
          }
        } else if (parts.length >= 5) {
          const exampleSentence = parts[2]?.trim();
          const exampleTranslation = parts[3]?.trim();
          const englishDefinition = parts[4]?.trim();

          if (exampleSentence) entry.exampleSentence = exampleSentence;
          if (exampleTranslation) entry.exampleTranslation = exampleTranslation;
          if (englishDefinition) entry.englishDefinition = englishDefinition;
        } else if (parts.length === 3) {
          const partOfSpeech = normalizePartOfSpeech(parts[2]);
          if (partOfSpeech) entry.partOfSpeech = partOfSpeech;
        }

        words.push(entry);
      }
    }
  }

  return words;
};

export const parseExcelFile = (file: File): Promise<ParsedExcelResult> => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    const isCSV = file.name.toLowerCase().endsWith('.csv');

    reader.onload = (e) => {
      try {
        let words: RawWordEntry[] = [];

        if (isCSV) {
          const content = e.target?.result as string;
          words = parseCSVContent(content);
        } else {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];

          const rawData: unknown[][] = XLSX.utils.sheet_to_json(worksheet, {
            header: 1,
            defval: ''
          });

          let startIndex = 0;
          let hasExtendedFormat = false;
          let hasSynonymColumn = false;
          let synonymIndex = -1;

          if (rawData.length > 0) {
            const firstRow = rawData[0];
            if (Array.isArray(firstRow)) {
              const headerCells = firstRow.map((cell) => String(cell || '').toLowerCase().trim());
              const firstCell = headerCells[0] || '';
              const secondCell = headerCells[1] || '';

              if (
                firstCell.includes('eng') ||
                firstCell.includes('english') ||
                firstCell.includes('ingilizce') ||
                secondCell.includes('tr') ||
                secondCell.includes('turkish') ||
                secondCell.includes('t\u00fcrk\u00e7e')
              ) {
                startIndex = 1;
              }

              if (
                headerCells.some((cell) =>
                  cell.includes('example') ||
                  cell.includes('sentence') ||
                  cell.includes('\u00f6rnek') ||
                  cell.includes('ornek') ||
                  cell.includes('c\u00fcmle') ||
                  cell.includes('cumle') ||
                  cell.includes('definition') ||
                  cell.includes('tan\u0131m') ||
                  cell.includes('tanim')
                ) ||
                firstRow.length >= 5
              ) {
                hasExtendedFormat = true;
              }

              synonymIndex = headerCells.findIndex((cell) =>
                cell.includes('synonym') || cell.includes('e\u015f') || cell.includes('es anlam')
              );
              if (synonymIndex >= 0) {
                hasSynonymColumn = true;
              }
            }
          }

          for (let i = startIndex; i < rawData.length; i++) {
            const row = rawData[i];
            if (Array.isArray(row) && row.length >= 2) {
              const english = String(row[0] || '').trim();
              const turkish = String(row[1] || '').trim();

              if (english && turkish) {
                const entry: RawWordEntry = { english, turkish };

                if (hasExtendedFormat || row.length >= 5) {
                  const exampleSentence = String(row[2] || '').trim();
                  const exampleTranslation = String(row[3] || '').trim();
                  const englishDefinition = String(row[4] || '').trim();

                  if (exampleSentence) entry.exampleSentence = exampleSentence;
                  if (exampleTranslation) entry.exampleTranslation = exampleTranslation;
                  if (englishDefinition) entry.englishDefinition = englishDefinition;
                }

                const synonymCellIndex = hasSynonymColumn ? synonymIndex : row.length >= 6 ? 5 : -1;
                if (synonymCellIndex >= 0) {
                  const synonymsRaw = String(row[synonymCellIndex] || '').trim();
                  if (synonymsRaw) {
                    entry.synonyms = synonymsRaw
                      .split(',')
                      .map((s) => s.trim())
                      .filter(Boolean);
                  }
                } else if (!hasExtendedFormat && row.length === 3) {
                  const partOfSpeech = normalizePartOfSpeech(String(row[2] || ''));
                  if (partOfSpeech) entry.partOfSpeech = partOfSpeech;
                }

                words.push(entry);
              }
            }
          }
        }

        if (words.length === 0) {
          resolve({
            success: false,
            words: [],
            error: 'Dosyada ge\u00e7erli kelime bulunamad\u0131. Format: \u0130ngilizce;T\u00fcrk\u00e7e veya \u0130ngilizce,T\u00fcrk\u00e7e',
            fileName: file.name,
          });
          return;
        }

        resolve({
          success: true,
          words,
          fileName: file.name,
        });
      } catch (error) {
        resolve({
          success: false,
          words: [],
          error: `Dosya okuma hatas\u0131: ${error instanceof Error ? error.message : 'Bilinmeyen hata'}`,
          fileName: file.name,
        });
      }
    };

    reader.onerror = () => {
      resolve({
        success: false,
        words: [],
        error: 'Dosya okunamad\u0131. L\u00fctfen ge\u00e7erli bir dosya se\u00e7in.',
        fileName: file.name,
      });
    };

    if (isCSV) {
      reader.readAsText(file, 'UTF-8');
    } else {
      reader.readAsArrayBuffer(file);
    }
  });
};

export const isValidExcelFile = (file: File): boolean => {
  const validExtensions = ['.xlsx', '.xls', '.csv'];
  const fileName = file.name.toLowerCase();
  return validExtensions.some((ext) => fileName.endsWith(ext));
};
