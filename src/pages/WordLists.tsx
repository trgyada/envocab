import React, { useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { useWordListStore } from '../stores/wordListStore';
import { useUserProgressStore } from '../stores/userProgressStore';
import { parseExcelFile, isValidExcelFile } from '../services/excelParser';
import { Word } from '../types';
import { DEFAULT_STUDY_LANGUAGE, getStudyLanguageConfig } from '../utils/languages';

type ViewMode = 'lists' | 'detail' | 'add-manual';

const WordLists: React.FC = () => {
  const {
    wordLists,
    addWordList,
    removeWordList,
    selectWordList,
    selectedListId,
    addWordToList,
    removeWordFromList,
    updateWord,
    updateWordsSynonyms,
    updateListTitle,
    activeLanguage
  } = useWordListStore();
  const studyLanguage = activeLanguage || DEFAULT_STUDY_LANGUAGE;
  const languageConfig = getStudyLanguageConfig(studyLanguage);
  const definitionPluralLabel = `${languageConfig.definitionLabel}ları`;

  const listsWithoutUnknown = React.useMemo(() => wordLists.filter((l) => l.id !== 'unknown'), [wordLists]);

  const allWrong = new Map<string, Word>();
  listsWithoutUnknown.forEach((l) => {
    l.words
      .filter((w) => w.incorrectCount > 0)
      .forEach((w) => {
        if (!allWrong.has(w.id)) allWrong.set(w.id, w);
      });
  });
  const wrongWords = Array.from(allWrong.values());
  const unknownList = wordLists.find((l) => l.id === 'unknown');
  const combinedUnknown = React.useMemo(() => {
    const map = new Map<string, Word>();
    wrongWords.forEach((w) => map.set(w.english.trim().toLowerCase(), w));
    if (unknownList) {
      unknownList.words.forEach((w) => {
        if (!map.has(w.english.trim().toLowerCase())) map.set(w.english.trim().toLowerCase(), w);
      });
    }
    return Array.from(map.values());
  }, [wrongWords, unknownList]);

  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [listTitle, setListTitle] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('lists');
  const [viewingListId, setViewingListId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const [manualListName, setManualListName] = useState('');
  const [manualWords, setManualWords] = useState<{ english: string; turkish: string }[]>([{ english: '', turkish: '' }]);
  const [manualTargetListId, setManualTargetListId] = useState<'new' | string>('new');

  const [editingWordId, setEditingWordId] = useState<string | null>(null);
  const [editEnglish, setEditEnglish] = useState('');
  const [editTurkish, setEditTurkish] = useState('');
  const [editSynonyms, setEditSynonyms] = useState('');
  const [editExampleSentence, setEditExampleSentence] = useState('');
  const [editExampleTranslation, setEditExampleTranslation] = useState('');
  const [editEnglishDefinition, setEditEnglishDefinition] = useState('');
  const [isGeneratingSynonyms, setIsGeneratingSynonyms] = useState(false);
  const [synonymProgress, setSynonymProgress] = useState<{ current: number; total: number } | null>(null);
  const [synonymError, setSynonymError] = useState<string | null>(null);
  const [isGeneratingExamples, setIsGeneratingExamples] = useState(false);
  const [exampleProgress, setExampleProgress] = useState<{ current: number; total: number } | null>(null);
  const [exampleError, setExampleError] = useState<string | null>(null);
  const [generatingExampleId, setGeneratingExampleId] = useState<string | null>(null);
  const [isGeneratingDefinitions, setIsGeneratingDefinitions] = useState(false);
  const [definitionProgress, setDefinitionProgress] = useState<{ current: number; total: number } | null>(null);
  const [definitionError, setDefinitionError] = useState<string | null>(null);
  const [generatingDefinitionId, setGeneratingDefinitionId] = useState<string | null>(null);
  const [translatingWordId, setTranslatingWordId] = useState<string | null>(null);
  const [isTranslatingAll, setIsTranslatingAll] = useState(false);
  const [translateProgress, setTranslateProgress] = useState<{ current: number; total: number } | null>(null);

  const [editingTitle, setEditingTitle] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [duplicateReport, setDuplicateReport] = useState<
    { word: string; occurrences: { listId: string; listTitle: string; wordId: string }[] }[]
  >([]);
  const [isScanning, setIsScanning] = useState(false);
  const [mergeSelection, setMergeSelection] = useState<string[]>([]);
  const [mergeName, setMergeName] = useState('Birleşik Liste');

  const fileInputRef = useRef<HTMLInputElement>(null);

  const viewingList = wordLists.find((l) => l.id === viewingListId);

  const normalizedQuery = searchQuery.toLowerCase();
  const filteredWords =
    viewingList?.words.filter(
      (word) =>
        word.english.toLowerCase().includes(normalizedQuery) ||
        word.turkish.toLowerCase().includes(normalizedQuery) ||
        (word.synonyms || []).some((syn) => syn.toLowerCase().includes(normalizedQuery))
    ) || [];

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!isValidExcelFile(file)) {
      setMessage({ text: 'Lütfen geçerli bir Excel veya CSV dosyası seçin.', type: 'error' });
      return;
    }

    setIsLoading(true);
    setMessage(null);

    const result = await parseExcelFile(file);

    if (result.success) {
      const title = listTitle.trim() || file.name.replace(/\.[^/.]+$/, '');
      addWordList(title, result.words);
      setMessage({
        text: `"${title}" başarıyla yüklendi! ${result.words.length} kelime eklendi.`,
        type: 'success'
      });
      setListTitle('');
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } else {
      setMessage({ text: result.error || 'Dosya yüklenirken hata oluştu.', type: 'error' });
    }

    setIsLoading(false);
  };

  const handleRemoveList = (id: string, title: string) => {
    if (window.confirm(`"${title}" listesini silmek istediğine emin misin?`)) {
      removeWordList(id);
      setMessage({ text: `"${title}" silindi.`, type: 'success' });
      if (viewingListId === id) {
        setViewMode('lists');
        setViewingListId(null);
      }
    }
  };

  const addManualWordRow = () => setManualWords([...manualWords, { english: '', turkish: '' }]);
  const removeManualWordRow = (index: number) => {
    if (manualWords.length > 1) setManualWords(manualWords.filter((_, i) => i !== index));
  };
  const updateManualWord = (index: number, field: 'english' | 'turkish', value: string) => {
    const updated = [...manualWords];
    updated[index][field] = value;
    setManualWords(updated);
  };

  const normalizeSynonymsInput = (value: string) => {
    const items = value
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const unique = Array.from(new Set(items.map((s) => s.toLowerCase())))
      .map((lower) => items.find((s) => s.toLowerCase() === lower) as string)
      .filter(Boolean);
    return unique.slice(0, 4);
  };

  const normalizeSynonymList = (items: string[]) => normalizeSynonymsInput(items.join(', '));

  const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  const RATE_LIMIT = {
    perRequestMs: 2200,
    batchSize: 5,
    batchPauseMs: 4000,
    retryFallbackMs: 15000,
  };

  const requestExample = async (english: string) => {
    const attempt = async () => {
      const res = await fetch('/api/example', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ word: english, lang: studyLanguage })
      });
      const data = await res.json();
      return { res, data };
    };

    let { res, data } = await attempt();
    if (res.status === 429) {
      const waitMs = Number(data?.retryAfterMs) || RATE_LIMIT.retryFallbackMs;
      await sleep(waitMs);
      ({ res, data } = await attempt());
    }
    if (!res.ok) throw new Error(data?.error || 'Örnek cümle alınamadı');

    let sentence = (data.sentence || '').trim();
    let translation = (data.translation || '').trim();
    if (!sentence) {
      ({ res, data } = await attempt());
      if (!res.ok) throw new Error(data?.error || 'Örnek cümle alınamadı');
      sentence = (data.sentence || '').trim();
      translation = (data.translation || '').trim();
    }
    if (!sentence) throw new Error('Örnek cümle alınamadı');
    return { sentence, translation };
  };

  const requestDefinition = async (english: string) => {
    const attempt = async () => {
      const res = await fetch('/api/definition', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ word: english, language: studyLanguage })
      });
      const data = await res.json();
      return { res, data };
    };

    let { res, data } = await attempt();
    if (res.status === 429) {
      const waitMs = Number(data?.retryAfterMs) || RATE_LIMIT.retryFallbackMs;
      await sleep(waitMs);
      ({ res, data } = await attempt());
    }
    if (!res.ok) throw new Error(data?.error || 'Tanım alınamadı');

    let definition = (data.definition || '').trim();
    if (!definition) {
      ({ res, data } = await attempt());
      if (!res.ok) throw new Error(data?.error || 'Tanım alınamadı');
      definition = (data.definition || '').trim();
    }
    if (!definition) throw new Error('Tanım alınamadı');
    return definition;
  };

  const requestTranslation = async (english: string) => {
    const attempt = async () => {
      const res = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: english, from: studyLanguage, to: 'tr' })
      });
      const data = await res.json();
      return { res, data };
    };

    let { res, data } = await attempt();
    if (res.status === 429) {
      const waitMs = Number(data?.retryAfterMs) || RATE_LIMIT.retryFallbackMs;
      await sleep(waitMs);
      ({ res, data } = await attempt());
    }
    if (!res.ok) throw new Error(data?.error || 'Çeviri alınamadı');
    const translation = (data.translation || '').trim();
    if (!translation) throw new Error('Çeviri alınamadı');
    return translation;
  };

  const requestSynonyms = async (english: string, count: number) => {
    const attempt = async () => {
      const res = await fetch('/api/synonyms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ word: english, count, language: studyLanguage })
      });
      const data = await res.json();
      return { res, data };
    };

    let { res, data } = await attempt();
    if (res.status === 429) {
      const waitMs = Number(data?.retryAfterMs) || RATE_LIMIT.retryFallbackMs;
      await sleep(waitMs);
      ({ res, data } = await attempt());
    }
    if (!res.ok) throw new Error(data?.error || 'Eş anlamlı alınamadı');
    return Array.isArray(data?.synonyms) ? data.synonyms : [];
  };

  const handleCreateManualList = () => {
    const validWords = manualWords.filter((w) => w.english.trim() && w.turkish.trim());
    if (validWords.length === 0) {
      setMessage({ text: 'En az bir kelime eklemelisin.', type: 'error' });
      return;
    }

    if (manualTargetListId === 'new') {
      if (!manualListName.trim()) {
        setMessage({ text: 'Lütfen liste adını gir.', type: 'error' });
        return;
      }
      addWordList(manualListName.trim(), validWords);
      setMessage({ text: `"${manualListName}" oluşturuldu! ${validWords.length} kelime eklendi.`, type: 'success' });
      setManualListName('');
      setManualWords([{ english: '', turkish: '' }]);
      setViewMode('lists');
      return;
    }

    const targetList = wordLists.find((l) => l.id === manualTargetListId);
    if (!targetList) {
      setMessage({ text: 'Hedef liste bulunamadı.', type: 'error' });
      return;
    }

    const existingEnglish = new Set(targetList.words.map((w) => w.english.toLowerCase()));
    let added = 0;
    let skipped = 0;
    validWords.forEach((w) => {
      const key = w.english.toLowerCase();
      if (existingEnglish.has(key)) {
        skipped++;
        return;
      }
      existingEnglish.add(key);
      addWordToList(targetList.id, w.english.trim(), w.turkish.trim());
      added++;
    });

    setMessage({
      text: `${targetList.title} listesine ${added} kelime eklendi${skipped ? `, ${skipped} tekrar atlandı` : ''}.`,
      type: added > 0 ? 'success' : 'error'
    });
    setManualWords([{ english: '', turkish: '' }]);
    if (added > 0) setViewMode('lists');
  };

  const handleAddWordToList = () => {
    if (!viewingListId || !viewingList) return;
    const { english, turkish } = manualWords[0];
    const en = english.trim();
    const tr = turkish.trim();
    if (!en || !tr) {
      setMessage({ text: `${languageConfig.sourceLabel} ve Türkçe alanlarını doldurun.`, type: 'error' });
      return;
    }
    const isDuplicate = viewingList.words.some((w) => w.english.toLowerCase() === en.toLowerCase());
    if (isDuplicate) {
      setMessage({ text: 'Bu kelime zaten listede var.', type: 'error' });
      return;
    }
    addWordToList(viewingListId, en, tr);
    setMessage({ text: 'Kelime eklendi!', type: 'success' });
    setManualWords([{ english: '', turkish: '' }]);
  };

  const handleTranslateWord = async (word: Word) => {
    if (!viewingListId) return;
    const english = word.english.trim();
    if (!english) {
      setMessage({ text: `Çevirmek için ${languageConfig.sourceLabel} kelime gerekli.`, type: 'error' });
      return;
    }
    if (translatingWordId === word.id) return;
    setTranslatingWordId(word.id);
    try {
      const translation = await requestTranslation(english);
      updateWord(viewingListId, word.id, { english: word.english, turkish: translation });
      setMessage({ text: 'Türkçe çeviri güncellendi.', type: 'success' });
    } catch (err: any) {
      setMessage({ text: err?.message || 'Çeviri alınamadı.', type: 'error' });
    } finally {
      setTranslatingWordId(null);
    }
  };

  const handleTranslateAll = async () => {
    if (!viewingListId || !viewingList) return;
    if (isTranslatingAll) return;
    const confirmed = window.confirm(
      'Tüm Türkçe çeviriler Gemini ile yeniden oluşturulacak. Mevcut çeviriler üzerine yazılır. Devam edilsin mi?'
    );
    if (!confirmed) return;

    const total = viewingList.words.length;
    if (total === 0) return;

    setIsTranslatingAll(true);
    setTranslateProgress({ current: 0, total });
    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < viewingList.words.length; i++) {
      const word = viewingList.words[i];
      setTranslateProgress({ current: i + 1, total });

      try {
        const translation = await requestTranslation(word.english);
        updateWord(viewingListId, word.id, { english: word.english, turkish: translation });
        successCount += 1;
      } catch {
        failCount += 1;
      }

      if (i < total - 1) {
        await sleep(RATE_LIMIT.perRequestMs);
        if ((i + 1) % RATE_LIMIT.batchSize === 0) {
          await sleep(RATE_LIMIT.batchPauseMs);
        }
      }
    }

    setTranslateProgress(null);
    setIsTranslatingAll(false);
    setMessage({
      text: `Toplu çeviri tamamlandı. Başarılı: ${successCount}, Hatalı: ${failCount}.`,
      type: failCount > 0 ? 'error' : 'success'
    });
  };

  const startEditWord = (word: Word) => {
    setEditingWordId(word.id);
    setEditEnglish(word.english);
    setEditTurkish(word.turkish);
    setEditSynonyms((word.synonyms || []).join(', '));
    setEditExampleSentence(word.exampleSentence || '');
    setEditExampleTranslation(word.exampleTranslation || '');
    setEditEnglishDefinition(word.englishDefinition || '');
  };
  const saveEditWord = () => {
    if (!viewingListId || !editingWordId) return;
    const normalizedSynonyms = normalizeSynonymsInput(editSynonyms);
    updateWord(viewingListId, editingWordId, {
      english: editEnglish.trim(),
      turkish: editTurkish.trim(),
      synonyms: normalizedSynonyms,
      exampleSentence: editExampleSentence.trim(),
      exampleTranslation: editExampleTranslation.trim(),
      englishDefinition: editEnglishDefinition.trim()
    });
    setEditingWordId(null);
    setEditSynonyms('');
    setEditExampleSentence('');
    setEditExampleTranslation('');
    setEditEnglishDefinition('');
    setMessage({ text: 'Kelime güncellendi!', type: 'success' });
  };
  const cancelEdit = () => {
    setEditingWordId(null);
    setEditSynonyms('');
    setEditExampleSentence('');
    setEditExampleTranslation('');
    setEditEnglishDefinition('');
  };

  const handleExportWords = (title: string, words: Word[]) => {
    const safeTitle = title.trim().replace(/[<>:"/\\|?*]+/g, '') || 'liste';
    const data = [
      [languageConfig.sourceLabel, 'Türkçe', 'Örnek Cümle', 'Örnek Çeviri', languageConfig.definitionLabel, 'Eş Anlamlılar'],
      ...words.map((w) => [
        w.english,
        w.turkish,
        w.exampleSentence || '',
        w.exampleTranslation || '',
        w.englishDefinition || '',
        (w.synonyms || []).join(', ')
      ]),
    ];
    const worksheet = XLSX.utils.aoa_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Kelimeler');
    XLSX.writeFile(workbook, `${safeTitle}.xlsx`);
    setMessage({ text: `"${title}" Excel olarak indirildi.`, type: 'success' });
  };

  const handleExportList = (list: typeof wordLists[0]) => handleExportWords(list.title, list.words);

  const handleShareList = (list: typeof wordLists[0]) => {
    const text = list.words.map((w) => `${w.english} - ${w.turkish}`).join('\n');
    navigator.clipboard.writeText(text);
    setMessage({ text: 'Liste panoya kopyalandı.', type: 'success' });
  };

  const scanDuplicates = () => {
    setIsScanning(true);
    const map = new Map<string, { listId: string; listTitle: string; wordId: string }[]>();
    wordLists.forEach((list) => {
      if (list.id === 'unknown') return; // bilinmeyenler tarama dışı
      list.words.forEach((w) => {
        const key = w.english.trim().toLowerCase();
        if (!key) return;
        const arr = map.get(key) || [];
        arr.push({ listId: list.id, listTitle: list.title, wordId: w.id });
        map.set(key, arr);
      });
    });
    const dup = Array.from(map.entries())
      .filter(([, occ]) => occ.length > 1)
      .map(([word, occurrences]) => ({ word, occurrences }));
    setDuplicateReport(dup);
    setIsScanning(false);
    setMessage(
      dup.length > 0
        ? { text: `Toplam ${dup.length} kelime birden fazla listede bulundu.`, type: 'success' }
        : { text: 'Tekrar eden kelime bulunamadı.', type: 'success' }
    );
  };

  const cleanDuplicatesKeepLargest = () => {
    if (duplicateReport.length === 0) return;
    // en büyük listeyi bul
    const keepList = wordLists.reduce((acc, curr) => (acc && acc.words.length >= curr.words.length ? acc : curr));
    if (!keepList) return;
    duplicateReport.forEach((dup) => {
      dup.occurrences.forEach((occ) => {
        if (occ.listId !== keepList.id) {
          removeWordFromList(occ.listId, occ.wordId);
        }
      });
    });
    scanDuplicates();
  };


  const toggleMergeSelection = (id: string) => {
    setMergeSelection((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const handleMergeLists = () => {
    const selected = wordLists.filter((l) => mergeSelection.includes(l.id));
    if (selected.length < 2) {
      setMessage({ text: 'En az iki liste seçmelisin.', type: 'error' });
      return;
    }
    const mergedMap = new Map<string, { english: string; turkish: string }>();
    selected.forEach((list) => {
      list.words.forEach((w) => {
        const key = w.english.trim().toLowerCase();
        if (!key) return;
        if (!mergedMap.has(key)) {
          mergedMap.set(key, { english: w.english, turkish: w.turkish });
        }
      });
    });
    const mergedWords = Array.from(mergedMap.values());
    const title = mergeName.trim() || 'Birleşik Liste';
    addWordList(title, mergedWords);
    setMessage({
      text: `"${title}" oluşturuldu. ${selected.length} liste birleştirildi, ${mergedWords.length} benzersiz kelime eklendi.`,
      type: 'success',
    });
    setMergeSelection([]);
    setMergeName('Birleşik Liste');
  };

  const handleGenerateSynonyms = async () => {
    if (!viewingListId || !viewingList) return;
    if (isGeneratingSynonyms) return;

    const targets = viewingList.words.filter((w) => !w.synonyms || w.synonyms.length < 4);
    if (targets.length === 0) {
      setMessage({ text: 'Bu listedeki tüm kelimelerin eş anlamlıları mevcut.', type: 'success' });
      return;
    }

    setIsGeneratingSynonyms(true);
    setSynonymError(null);
    setSynonymProgress({ current: 0, total: targets.length });

    let pending: { wordId: string; synonyms: string[] }[] = [];

    for (let i = 0; i < targets.length; i++) {
      const word = targets[i];
      setSynonymProgress({ current: i + 1, total: targets.length });

      try {
        const rawSynonyms = await requestSynonyms(word.english, 4);
        const synonyms = normalizeSynonymList(rawSynonyms);
        if (synonyms.length) {
          pending.push({ wordId: word.id, synonyms });
        }
      } catch (err: any) {
        setSynonymError(err?.message || 'Eş anlamlı alınamadı');
      }

      if (pending.length >= 10) {
        updateWordsSynonyms(viewingListId, pending);
        pending = [];
      }

      if (i < targets.length - 1) {
        await sleep(RATE_LIMIT.perRequestMs);
        if ((i + 1) % RATE_LIMIT.batchSize === 0) {
          await sleep(RATE_LIMIT.batchPauseMs);
        }
      }
    }

    if (pending.length) updateWordsSynonyms(viewingListId, pending);
    setSynonymProgress(null);
    setIsGeneratingSynonyms(false);
    setMessage({ text: 'Eş anlamlılar güncellendi.', type: 'success' });
  };

  const handleGenerateExampleForWord = async (word: Word) => {
    if (!viewingListId) return;
    if (generatingExampleId === word.id) return;
    setGeneratingExampleId(word.id);
    setExampleError(null);
    try {
      const result = await requestExample(word.english);
      updateWord(viewingListId, word.id, {
        english: word.english,
        turkish: word.turkish,
        exampleSentence: result.sentence,
        exampleTranslation: result.translation,
        exampleLang: studyLanguage,
        exampleModel: 'gemini-2.5-flash',
        exampleUpdatedAt: new Date()
      });
    } catch (err: any) {
      setExampleError(err?.message || 'Örnek cümle alınamadı');
    } finally {
      setGeneratingExampleId(null);
    }
  };

  const handleGenerateDefinitionForWord = async (word: Word) => {
    if (!viewingListId) return;
    if (generatingDefinitionId === word.id) return;
    setGeneratingDefinitionId(word.id);
    setDefinitionError(null);
    try {
      const definition = await requestDefinition(word.english);
      updateWord(viewingListId, word.id, {
        english: word.english,
        turkish: word.turkish,
        englishDefinition: definition
      });
    } catch (err: any) {
      setDefinitionError(err?.message || 'Tanım alınamadı');
    } finally {
      setGeneratingDefinitionId(null);
    }
  };

  const handleGenerateExamples = async () => {
    if (!viewingListId || !viewingList) return;
    if (isGeneratingExamples) return;

    const targets = viewingList.words.filter((w) => !(w.exampleSentence || '').trim());
    if (targets.length === 0) {
      setMessage({ text: 'Bu listedeki tüm örnek cümleler mevcut.', type: 'success' });
      return;
    }

    setIsGeneratingExamples(true);
    setExampleError(null);
    setExampleProgress({ current: 0, total: targets.length });

    for (let i = 0; i < targets.length; i++) {
      const word = targets[i];
      setExampleProgress({ current: i + 1, total: targets.length });
      try {
        const result = await requestExample(word.english);
        updateWord(viewingListId, word.id, {
          english: word.english,
          turkish: word.turkish,
          exampleSentence: result.sentence,
          exampleTranslation: result.translation,
          exampleLang: studyLanguage,
          exampleModel: 'gemini-2.5-flash',
          exampleUpdatedAt: new Date()
        });
      } catch (err: any) {
        setExampleError(err?.message || 'Örnek cümle alınamadı');
      }

      if (i < targets.length - 1) {
        await sleep(RATE_LIMIT.perRequestMs);
        if ((i + 1) % RATE_LIMIT.batchSize === 0) {
          await sleep(RATE_LIMIT.batchPauseMs);
        }
      }
    }

    setExampleProgress(null);
    setIsGeneratingExamples(false);
    setMessage({ text: 'Örnek cümleler güncellendi.', type: 'success' });
  };

  const handleGenerateDefinitions = async () => {
    if (!viewingListId || !viewingList) return;
    if (isGeneratingDefinitions) return;

    const targets = viewingList.words.filter((w) => !(w.englishDefinition || '').trim());
    if (targets.length === 0) {
      setMessage({ text: `Bu listedeki tüm ${definitionPluralLabel} mevcut.`, type: 'success' });
      return;
    }

    setIsGeneratingDefinitions(true);
    setDefinitionError(null);
    setDefinitionProgress({ current: 0, total: targets.length });

    for (let i = 0; i < targets.length; i++) {
      const word = targets[i];
      setDefinitionProgress({ current: i + 1, total: targets.length });
      try {
        const definition = await requestDefinition(word.english);
        updateWord(viewingListId, word.id, {
          english: word.english,
          turkish: word.turkish,
          englishDefinition: definition
        });
      } catch (err: any) {
        setDefinitionError(err?.message || 'Tanım alınamadı');
      }

      if (i < targets.length - 1) {
        await sleep(RATE_LIMIT.perRequestMs);
        if ((i + 1) % RATE_LIMIT.batchSize === 0) {
          await sleep(RATE_LIMIT.batchPauseMs);
        }
      }
    }

    setDefinitionProgress(null);
    setIsGeneratingDefinitions(false);
    setMessage({ text: `${definitionPluralLabel} güncellendi.`, type: 'success' });
  };

  if (viewMode === 'add-manual') {
    return (
      <div className="wordlists-container">
        <button className="btn btn-outline" onClick={() => setViewMode('lists')} style={{ marginBottom: '16px' }}>
          Geri
        </button>

        <h1 style={{ marginBottom: '24px' }}>Manuel Liste Oluştur</h1>

        <div className="manual-add-section">
          <input
            type="text"
            value={manualListName}
            onChange={(e) => setManualListName(e.target.value)}
            placeholder="Liste adı *"
            className="input-field"
            style={{ marginBottom: '16px', fontSize: '1.05rem', padding: '14px' }}
            disabled={manualTargetListId !== 'new'}
          />

          <div style={{ display: 'flex', gap: '10px', marginBottom: '12px', flexWrap: 'wrap' }}>
            <select
              className="input-field"
              value={manualTargetListId}
              onChange={(e) => setManualTargetListId(e.target.value as 'new' | string)}
              style={{ flex: 1, minWidth: '220px' }}
            >
              <option value="new">Yeni liste oluştur</option>
              {listsWithoutUnknown.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.title} ({l.words.length} kelime)
                </option>
              ))}
            </select>
            <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', alignSelf: 'center' }}>
              Mevcut liste seçersen ad alanı pasif olur.
            </span>
          </div>

          <div className="word-cards-list">
            {manualWords.map((word, index) => (
              <div key={index} className="word-card">
                <div className="word-card-body">
                  <input
                    type="text"
                    value={word.english}
                    onChange={(e) => updateManualWord(index, 'english', e.target.value)}
                    placeholder={languageConfig.sourceLabel}
                    className="word-card-edit-input"
                    style={{ flex: 1 }}
                  />
                  <div className="word-card-separator" />
                  <input
                    type="text"
                    value={word.turkish}
                    onChange={(e) => updateManualWord(index, 'turkish', e.target.value)}
                    placeholder="Türkçe"
                    className="word-card-edit-input"
                    style={{ flex: 1 }}
                  />
                </div>
                <div className="word-card-icons">
                  <button
                    className="word-card-icon-btn delete"
                    onClick={() => removeManualWordRow(index)}
                    disabled={manualWords.length === 1}
                    title="Sil"
                  >
                    Sil
                  </button>
                </div>
              </div>
            ))}
          </div>

          <button className="btn btn-outline" onClick={addManualWordRow} style={{ marginTop: '14px', width: '100%' }}>
            + Yeni Satır Ekle
          </button>

          <button
            className="btn btn-primary btn-lg"
            onClick={handleCreateManualList}
            style={{ marginTop: '16px', width: '100%' }}
          >
            {manualTargetListId === 'new' ? 'Listeyi Oluştur' : 'Listeye Ekle'} (
            {manualWords.filter((w) => w.english && w.turkish).length} kelime)
          </button>
        </div>

        {message && (
          <div className={`message message-${message.type}`} style={{ marginTop: '16px' }}>
            {message.text}
          </div>
        )}
      </div>
    );
  }

  if (viewMode === 'detail' && viewingList) {
    return (
      <div className="wordlists-container">
        <button
          className="btn btn-outline"
          onClick={() => {
            setViewMode('lists');
            setViewingListId(null);
            setSearchQuery('');
          }}
          style={{ marginBottom: '16px' }}
        >
          Geri
        </button>

        <div className="word-list-header">
          <div className="word-list-title-section">
            <div className="word-list-title-block">
              {editingTitle ? (
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                  <input
                    type="text"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    className="input-field"
                    style={{ fontSize: '1.25rem', fontWeight: 'bold', padding: '8px 12px' }}
                    autoFocus
                  />
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => {
                      if (newTitle.trim()) {
                        updateListTitle(viewingListId!, newTitle.trim());
                        setEditingTitle(false);
                        setMessage({ text: 'Başlık güncellendi!', type: 'success' });
                      }
                    }}
                  >
                    Kaydet
                  </button>
                  <button className="btn btn-outline btn-sm" onClick={() => setEditingTitle(false)}>
                    İptal
                  </button>
                </div>
              ) : (
                <h1
                  className="word-list-title"
                  onClick={() => {
                    setNewTitle(viewingList.title);
                    setEditingTitle(true);
                  }}
                  title="Başlığı düzenlemek için tıkla"
                >
                  <span className="word-list-icon">📖</span>
                  {viewingList.title}
                </h1>
              )}
              <p className="word-list-meta">
                {viewingList.words.length} kelime • Oluşturulma:{' '}
                {new Date(viewingList.createdAt).toLocaleDateString('tr-TR')}
              </p>
            </div>

            <div className="word-list-toolbar">
              <div className="word-list-actions">
                <button className="word-list-action-btn" onClick={() => handleExportList(viewingList)}>
                  İndir
                </button>
                <button className="word-list-action-btn" onClick={() => handleShareList(viewingList)}>
                  Kopyala
                </button>
              </div>
              <details className="word-list-bulk">
                <summary>Toplu işlemler</summary>
                <div className="word-list-actions bulk-actions">
                  <button
                    className="word-list-action-btn"
                    onClick={handleTranslateAll}
                    disabled={isTranslatingAll}
                  >
                    {isTranslatingAll ? 'Çeviriliyor...' : 'Tüm Türkçeleri düzelt'}
                  </button>
                  <button
                    className="word-list-action-btn"
                    onClick={handleGenerateSynonyms}
                    disabled={isGeneratingSynonyms}
                  >
                    {isGeneratingSynonyms ? 'Üretiliyor...' : 'Eş anlamlıları üret'}
                  </button>
                  <button
                    className="word-list-action-btn"
                    onClick={handleGenerateExamples}
                    disabled={isGeneratingExamples}
                  >
                    {isGeneratingExamples ? 'Üretiliyor...' : 'Örnek cümleleri üret'}
                  </button>
                  <button
                    className="word-list-action-btn"
                    onClick={handleGenerateDefinitions}
                    disabled={isGeneratingDefinitions}
                  >
                    {isGeneratingDefinitions ? 'Üretiliyor...' : languageConfig.definitionActionLabel}
                  </button>
                </div>
              </details>
            </div>
          </div>

          <div className="word-list-status">
            {synonymProgress && (
              <div className="synonym-progress">
                Eş anlamlılar üretiliyor: {synonymProgress.current}/{synonymProgress.total}
              </div>
            )}
            {translateProgress && (
              <div className="translate-progress">
                Türkçe çeviriler güncelleniyor: {translateProgress.current}/{translateProgress.total}
              </div>
            )}
            {exampleProgress && (
              <div className="example-progress">
                Örnek cümleler üretiliyor: {exampleProgress.current}/{exampleProgress.total}
              </div>
            )}
            {definitionProgress && (
              <div className="definition-progress">
                {definitionPluralLabel} üretiliyor: {definitionProgress.current}/{definitionProgress.total}
              </div>
            )}
            {synonymError && <div className="synonym-error">{synonymError}</div>}
            {exampleError && <div className="example-error">{exampleError}</div>}
            {definitionError && <div className="definition-error">{definitionError}</div>}
          </div>
        </div>

        <div className="word-list-search">
          <span className="search-icon">🔍</span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Kelime ara..."
            className="word-list-search-input"
          />
        </div>

        {message && (
          <div className={`message message-${message.type}`} style={{ marginBottom: '16px' }}>
            {message.text}
          </div>
        )}

        <div className="word-table-header">
          <span className="word-table-col">{languageConfig.sourceLabel}</span>
          <span className="word-table-col">Türkçe</span>
          <span className="word-table-col">Eş Anlamlılar</span>
          <span className="word-table-col-actions"></span>
        </div>

        <div className="word-table-add-row">
          <input
            type="text"
            value={manualWords[0]?.english || ''}
            onChange={(e) => updateManualWord(0, 'english', e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleAddWordToList();
            }}
            placeholder="Yeni kelime..."
            className="word-table-input"
          />
          <input
            type="text"
            value={manualWords[0]?.turkish || ''}
            onChange={(e) => updateManualWord(0, 'turkish', e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleAddWordToList();
            }}
            placeholder="Çevirisi..."
            className="word-table-input"
          />
          <div className="word-table-placeholder">Eş anlamlılar (opsiyonel)</div>
          <button className="word-table-add-btn" onClick={handleAddWordToList} title="Ekle">
            Ekle
          </button>
        </div>

        <div className="word-table-body">
          {filteredWords.length === 0 ? (
            <div className="word-table-empty">{searchQuery ? 'Arama sonucu bulunamadı.' : 'Henüz kelime yok.'}</div>
          ) : (
            filteredWords.map((word) => (
              <div key={word.id} className="word-table-row">
                {editingWordId === word.id ? (
                  <>
                    <input
                      type="text"
                      value={editEnglish}
                      onChange={(e) => setEditEnglish(e.target.value)}
                      className="word-table-input editing"
                      autoFocus
                    />
                    <input
                      type="text"
                      value={editTurkish}
                      onChange={(e) => setEditTurkish(e.target.value)}
                      className="word-table-input editing"
                    />
                    <input
                      type="text"
                      value={editSynonyms}
                      onChange={(e) => setEditSynonyms(e.target.value)}
                      className="word-table-input editing"
                      placeholder="Eş anlamlılar (virgülle)"
                    />
                    <div className="word-table-actions">
                      <button onClick={saveEditWord} className="word-table-icon-btn save" title="Kaydet">
                        Kaydet
                      </button>
                      <button onClick={cancelEdit} className="word-table-icon-btn cancel" title="İptal">
                        İptal
                      </button>
                    </div>
                    <div className="word-table-details is-edit">
                      <div className="word-table-details-grid">
                        <div className="word-table-detail">
                          <label>Örnek cümle</label>
                          <textarea
                            className="word-table-textarea"
                            rows={3}
                            value={editExampleSentence}
                            onChange={(e) => setEditExampleSentence(e.target.value)}
                          />
                        </div>
                        <div className="word-table-detail">
                          <label>Örnek çeviri</label>
                          <textarea
                            className="word-table-textarea"
                            rows={3}
                            value={editExampleTranslation}
                            onChange={(e) => setEditExampleTranslation(e.target.value)}
                          />
                        </div>
                        <div className="word-table-detail">
                          <label>{languageConfig.definitionLabel}</label>
                          <textarea
                            className="word-table-textarea"
                            rows={3}
                            value={editEnglishDefinition}
                            onChange={(e) => setEditEnglishDefinition(e.target.value)}
                          />
                        </div>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <span className="word-table-english">{word.english}</span>
                    <span className="word-table-turkish">{word.turkish}</span>
                    <span className="word-table-synonyms">
                      {word.synonyms && word.synonyms.length > 0 ? word.synonyms.join(', ') : '—'}
                    </span>
                    <div className="word-table-actions">
                      <button
                        className="word-table-icon-btn sound"
                        onClick={() => {
                          const utterance = new SpeechSynthesisUtterance(word.english);
                          utterance.lang = languageConfig.sourceSpeechLang;
                          speechSynthesis.speak(utterance);
                        }}
                        title="Sesli oku"
                      >
                        🔊
                      </button>
                      <button
                        className="word-table-icon-btn translate"
                        onClick={() => handleTranslateWord(word)}
                        disabled={translatingWordId === word.id}
                        title="Türkçe çeviri üret"
                      >
                        {translatingWordId === word.id ? 'Çeviriliyor...' : 'Çevir'}
                      </button>
                      <button
                        className="word-table-icon-btn example"
                        onClick={() => handleGenerateExampleForWord(word)}
                        disabled={generatingExampleId === word.id || isGeneratingExamples}
                        title="Örnek cümle üret"
                      >
                        {generatingExampleId === word.id ? 'Örnek...' : 'Örnek'}
                      </button>
                      <button
                        className="word-table-icon-btn definition"
                        onClick={() => handleGenerateDefinitionForWord(word)}
                        disabled={generatingDefinitionId === word.id || isGeneratingDefinitions}
                        title={`${languageConfig.definitionLabel} üret`}
                      >
                        {generatingDefinitionId === word.id ? 'Tanım...' : 'Tanım'}
                      </button>
                      <button className="word-table-icon-btn edit" onClick={() => startEditWord(word)} title="Düzenle">
                        Düzenle
                      </button>
                      <button
                        className="word-table-icon-btn delete"
                        onClick={() => {
                          if (window.confirm('Bu kelimeyi silmek istediğine emin misin?')) {
                            removeWordFromList(viewingListId!, word.id);
                          }
                        }}
                        title="Sil"
                      >
                        Sil
                      </button>
                    </div>
                    {(word.exampleSentence || word.exampleTranslation || word.englishDefinition) && (
                      <details className="word-table-details">
                        <summary>Örnek cümle ve tanım</summary>
                        <div className="word-table-details-grid">
                          {word.exampleSentence && (
                            <div className="word-table-detail">
                              <label>Örnek cümle</label>
                              <div className="word-table-detail-text">{word.exampleSentence}</div>
                              {word.exampleTranslation && (
                                <div className="word-table-detail-sub">Çeviri: {word.exampleTranslation}</div>
                              )}
                            </div>
                          )}
                          {word.englishDefinition && (
                            <div className="word-table-detail">
                              <label>{languageConfig.definitionLabel}</label>
                              <div className="word-table-detail-text">{word.englishDefinition}</div>
                            </div>
                          )}
                        </div>
                      </details>
                    )}
                  </>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="wordlists-container">
      <h1 style={{ marginBottom: '24px' }}>Kelime Listeleri</h1>

      {/* Dosya Yükleme ve Manuel Ekleme */}
      <div className="upload-section">
        <div className="upload-grid">
          <div className="upload-option">
            <span className="upload-icon">📂</span>
            <h3>Dosyadan Yükle</h3>
            <div className="file-input-wrapper">
              <input
                type="text"
                value={listTitle}
                onChange={(e) => setListTitle(e.target.value)}
                placeholder="Liste adı (opsiyonel)"
                className="input-field"
                style={{ marginBottom: '10px' }}
              />
              <input
                ref={fileInputRef}
                type="file"
                id="file-upload"
                accept=".xlsx,.xls,.csv"
                onChange={handleFileChange}
                disabled={isLoading}
                style={{ display: 'none' }}
              />
              <label htmlFor="file-upload" className="file-label" style={{ cursor: 'pointer' }}>
                Excel / CSV Seç
              </label>
            </div>
          </div>

          <div className="upload-option">
            <span className="upload-icon">✏️</span>
            <h3>Manuel Oluştur</h3>
            <button className="btn btn-secondary" onClick={() => setViewMode('add-manual')}>
              Elle Kelime Ekle
            </button>
          </div>
        </div>

        <p className="upload-hint">
          {languageConfig.excelHint} | Ayraç: virgül veya noktalı virgül
        </p>

        {isLoading && <div className="spinner" />}
        {message && <div className={`message message-${message.type}`}>{message.text}</div>}
      </div>

      {/* Tekrar Tarama */}
      <div className="tools-section">
        <h3 className="section-title">🔍 Tekrar Tarama</h3>
        <div className="tools-actions">
          <button className="btn btn-secondary" onClick={scanDuplicates} disabled={isScanning}>
            {isScanning ? 'Taranıyor...' : 'Tekrarları Tara'}
          </button>
          <button
            className="btn btn-outline"
            onClick={cleanDuplicatesKeepLargest}
            disabled={duplicateReport.length === 0}
          >
            Tekrarları Temizle (En Büyük Listeyi Koru)
          </button>
        </div>

        {duplicateReport.length > 0 && (
          <div className="duplicate-panel">
            <h4>Tekrar Eden Kelimeler ({duplicateReport.length})</h4>
            <div className="duplicate-list">
              {duplicateReport.map((dup) => (
                <div key={dup.word} className="duplicate-item">
                  <div className="duplicate-word">{dup.word}</div>
                  <div className="duplicate-occ">
                    {dup.occurrences.map((occ, idx) => (
                      <span key={occ.wordId} className="duplicate-chip">
                        {occ.listTitle}
                        {idx < dup.occurrences.length - 1 ? "," : ""}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Listeleri Birleştir */}
      <div className="tools-section">
        <h3 className="section-title">🔗 Listeleri Birleştir</h3>
        <p className="section-desc">
          Az kelimeli listeleri tek bir listede topla. Aynı {languageConfig.sourceLabel} kelime tekrar eklenmez.
        </p>
        <div className="merge-header">
          <input
            type="text"
            value={mergeName}
            onChange={(e) => setMergeName(e.target.value)}
            className="input-field"
            placeholder="Birleşik liste adı"
          />
          <button
            className="btn btn-primary"
            onClick={handleMergeLists}
            disabled={mergeSelection.length < 2}
          >
            {mergeSelection.length < 2 ? 'En az 2 liste seç' : `Birleştir (${mergeSelection.length})`}
          </button>
        </div>
        <div className="merge-list">
          {listsWithoutUnknown.map((list) => (
            <label key={`merge-${list.id}`} className="merge-item">
              <input
                type="checkbox"
                checked={mergeSelection.includes(list.id)}
                onChange={() => toggleMergeSelection(list.id)}
              />
              <span>{list.title} ({list.words.length} kelime)</span>
            </label>
          ))}
        </div>
      </div>

      <h2 style={{ marginBottom: "16px", marginTop: "26px" }}>Mevcut Listeler ({listsWithoutUnknown.length})</h2>

      {combinedUnknown.length > 0 && (
        <div className="wordlist-grid" style={{ marginBottom: '16px' }}>
          <div className="wordlist-card">
            <h3>Zor / Bilinmeyenler</h3>
            <p>{combinedUnknown.length} kelime</p>
            <div className="word-preview" style={{ maxHeight: '180px', overflowY: 'auto' }}>
              {combinedUnknown.slice(0, 12).map((w) => (
                <div key={w.id} className="word-preview-item">
                  <div className="word-preview-term">{w.english}</div>
                  <div className="word-preview-translation">{w.turkish}</div>
                </div>
              ))}
              {combinedUnknown.length > 12 && (
                <div className="word-preview-more">+ {combinedUnknown.length - 12} kelime daha</div>
              )}
            </div>
            <div className="wordlist-actions" style={{ marginTop: '12px' }}>
              <button
                className="btn btn-outline"
                onClick={() => handleExportWords('Zor-Bilinmeyenler', combinedUnknown)}
              >
                Excel indir
              </button>
            </div>
          </div>
        </div>
      )}

      {listsWithoutUnknown.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">📚</div>
          <p>Henüz kelime listesi yok.</p>
          <p style={{ fontSize: '0.9rem' }}>Dosya yükleyerek veya manuel ekleyerek başlayabilirsin.</p>
        </div>
      ) : (
        <div className="wordlist-grid">
          {listsWithoutUnknown.map((list) => (
            <div key={list.id} className={`wordlist-card ${selectedListId === list.id ? 'selected' : ''}`}>
              <div
                style={{ cursor: 'pointer' }}
                onClick={() => {
                  setViewingListId(list.id);
                  setViewMode('detail');
                }}
              >
                <h3>{list.title}</h3>
                <p>{list.words.length} kelime</p>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  {new Date(list.createdAt).toLocaleDateString('tr-TR')}
                </p>
                <div className="list-stats">
                  <span className="stat-item">✅ {list.words.filter((w) => w.correctCount > 0).length}</span>
                  <span className="stat-item warning">⚠️ {list.words.filter((w) => w.incorrectCount > 0).length}</span>
                </div>
              </div>

              <div className="wordlist-actions">
                <button
                  className={`btn ${selectedListId === list.id ? 'btn-secondary' : 'btn-primary'}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    selectWordList(selectedListId === list.id ? null : list.id);
                  }}
                >
                  {selectedListId === list.id ? 'Seçili' : 'Quiz için Seç'}
                </button>
                <button
                  className="btn btn-outline"
                  onClick={(e) => {
                    e.stopPropagation();
                    setViewingListId(list.id);
                    setViewMode('detail');
                  }}
                >
                  Görüntüle
                </button>
                <button
                  className="btn btn-danger"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRemoveList(list.id, list.title);
                  }}
                >
                  Sil
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default WordLists;
