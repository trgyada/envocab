import * as XLSX from 'xlsx';
import { PartOfSpeech } from '../types';

export interface RawWordEntry {
  english: string;
  turkish: string;
  partOfSpeech?: PartOfSpeech;
}

export interface ParsedExcelResult {
  success: boolean;
  words: RawWordEntry[];
  error?: string;
  fileName: string;
}

/**
 * Kelime türünü normalize eder
 */
const normalizePartOfSpeech = (pos: string): PartOfSpeech => {
  const normalized = pos.toLowerCase().trim().replace(/[().\s]/g, '');
  
  const mapping: Record<string, PartOfSpeech> = {
    'n': 'n',
    'noun': 'n',
    'isim': 'n',
    'v': 'v',
    'verb': 'v',
    'fiil': 'v',
    'adj': 'adj',
    'adjective': 'adj',
    'sıfat': 'adj',
    'adv': 'adv',
    'adverb': 'adv',
    'zarf': 'adv',
    'prep': 'prep',
    'preposition': 'prep',
    'edat': 'prep',
    'conj': 'conj',
    'conjunction': 'conj',
    'bağlaç': 'conj',
    'pron': 'pron',
    'pronoun': 'pron',
    'zamir': 'pron',
    'interj': 'interj',
    'interjection': 'interj',
    'ünlem': 'interj',
    'det': 'det',
    'determiner': 'det',
    'belirteç': 'det',
    'phr': 'phr',
    'phrase': 'phr',
    'deyim': 'phr',
  };
  
  return mapping[normalized] || '';
};

/**
 * CSV dosyasını parse eder (;  veya , ile ayrılmış)
 * Format: İngilizce;Türkçe;Tür (3. sütun opsiyonel)
 */
const parseCSVContent = (content: string): RawWordEntry[] => {
  const lines = content.split('\n').filter(line => line.trim());
  const words: RawWordEntry[] = [];
  
  for (const line of lines) {
    // Önce ; sonra , ile dene
    let parts = line.split(';');
    if (parts.length < 2) {
      parts = line.split(',');
    }
    
    if (parts.length >= 2) {
      const english = parts[0].trim();
      const turkish = parts[1].trim();
      const partOfSpeech = parts.length >= 3 ? normalizePartOfSpeech(parts[2]) : '';
      
      // Başlık satırını atla
      if (
        english.toLowerCase().includes('english') ||
        english.toLowerCase().includes('eng') ||
        english.toLowerCase().includes('ingilizce') ||
        turkish.toLowerCase().includes('turkish') ||
        turkish.toLowerCase().includes('türkçe')
      ) {
        continue;
      }
      
      if (english && turkish) {
        words.push({ english, turkish, partOfSpeech: partOfSpeech || undefined });
      }
    }
  }
  
  return words;
};

/**
 * Excel veya CSV dosyasını parse eder
 * İlk sütun: İngilizce (ENG)
 * İkinci sütun: Türkçe (TR)
 */
export const parseExcelFile = (file: File): Promise<ParsedExcelResult> => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    const isCSV = file.name.toLowerCase().endsWith('.csv');

    reader.onload = (e) => {
      try {
        let words: RawWordEntry[] = [];

        if (isCSV) {
          // CSV dosyası - metin olarak oku
          const content = e.target?.result as string;
          words = parseCSVContent(content);
        } else {
          // Excel dosyası
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          
          // Excel verilerini diziye çevir
          const rawData: unknown[][] = XLSX.utils.sheet_to_json(worksheet, { 
            header: 1,
            defval: '' 
          });

          // Başlık satırını kontrol et ve atla
          let startIndex = 0;
          if (rawData.length > 0) {
            const firstRow = rawData[0];
            if (Array.isArray(firstRow)) {
              const firstCell = String(firstRow[0] || '').toLowerCase().trim();
              const secondCell = String(firstRow[1] || '').toLowerCase().trim();
              
              if (
                firstCell.includes('eng') || 
                firstCell.includes('english') || 
                firstCell.includes('ingilizce') ||
                secondCell.includes('tr') || 
                secondCell.includes('turkish') || 
                secondCell.includes('türkçe')
              ) {
                startIndex = 1;
              }
            }
          }

          // Kelimeleri parse et
          for (let i = startIndex; i < rawData.length; i++) {
            const row = rawData[i];
            if (Array.isArray(row) && row.length >= 2) {
              const english = String(row[0] || '').trim();
              const turkish = String(row[1] || '').trim();
              const partOfSpeech = row.length >= 3 ? normalizePartOfSpeech(String(row[2] || '')) : '';
              
              if (english && turkish) {
                words.push({ english, turkish, partOfSpeech: partOfSpeech || undefined });
              }
            }
          }
        }

        if (words.length === 0) {
          resolve({
            success: false,
            words: [],
            error: 'Dosyada geçerli kelime bulunamadı. Format: İngilizce;Türkçe veya İngilizce,Türkçe',
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
          error: `Dosya okuma hatası: ${error instanceof Error ? error.message : 'Bilinmeyen hata'}`,
          fileName: file.name,
        });
      }
    };

    reader.onerror = () => {
      resolve({
        success: false,
        words: [],
        error: 'Dosya okunamadı. Lütfen geçerli bir dosya seçin.',
        fileName: file.name,
      });
    };

    // CSV için text, Excel için ArrayBuffer olarak oku
    if (isCSV) {
      reader.readAsText(file, 'UTF-8');
    } else {
      reader.readAsArrayBuffer(file);
    }
  });
};

/**
 * Dosya uzantısını kontrol eder
 */
export const isValidExcelFile = (file: File): boolean => {
  const validExtensions = ['.xlsx', '.xls', '.csv'];
  const fileName = file.name.toLowerCase();
  return validExtensions.some(ext => fileName.endsWith(ext));
};