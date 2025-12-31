import React, { useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { useWordListStore } from '../stores/wordListStore';
import { useUserProgressStore } from '../stores/userProgressStore';
import { parseExcelFile, isValidExcelFile } from '../services/excelParser';
import { Word } from '../types';

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
    updateListTitle
  } = useWordListStore();

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

  const filteredWords =
    viewingList?.words.filter(
      (word) =>
        word.english.toLowerCase().includes(searchQuery.toLowerCase()) ||
        word.turkish.toLowerCase().includes(searchQuery.toLowerCase())
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
      setMessage({ text: 'İngilizce ve Türkçe alanlarını doldurun.', type: 'error' });
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

  const startEditWord = (word: Word) => {
    setEditingWordId(word.id);
    setEditEnglish(word.english);
    setEditTurkish(word.turkish);
  };
  const saveEditWord = () => {
    if (!viewingListId || !editingWordId) return;
    updateWord(viewingListId, editingWordId, editEnglish.trim(), editTurkish.trim());
    setEditingWordId(null);
    setMessage({ text: 'Kelime güncellendi!', type: 'success' });
  };
  const cancelEdit = () => setEditingWordId(null);

  const handleExportWords = (title: string, words: Word[]) => {
    const safeTitle = title.trim().replace(/[<>:"/\\|?*]+/g, '') || 'liste';
    const data = [
      ['English', 'Türkçe'],
      ...words.map((w) => [w.english, w.turkish]),
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
                    placeholder="İngilizce"
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
            <div className="word-list-actions">
              <button className="word-list-action-btn" onClick={() => handleExportList(viewingList)}>
                İndir
              </button>
              <button className="word-list-action-btn" onClick={() => handleShareList(viewingList)}>
                Kopyala
              </button>
            </div>
          </div>
          <p className="word-list-meta">
            {viewingList.words.length} kelime • Oluşturulma: {new Date(viewingList.createdAt).toLocaleDateString('tr-TR')}
          </p>
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
          <span className="word-table-col">English</span>
          <span className="word-table-col">Türkçe</span>
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
          <button className="word-table-add-btn" onClick={handleAddWordToList} title="Ekle">
            +
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
                    <div className="word-table-actions">
                      <button onClick={saveEditWord} className="word-table-icon-btn save" title="Kaydet">
                        Kaydet
                      </button>
                      <button onClick={cancelEdit} className="word-table-icon-btn cancel" title="İptal">
                        İptal
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <span className="word-table-english">{word.english}</span>
                    <span className="word-table-turkish">{word.turkish}</span>
                    <div className="word-table-actions">
                      <button
                        className="word-table-icon-btn sound"
                        onClick={() => {
                          const utterance = new SpeechSynthesisUtterance(word.english);
                          utterance.lang = 'en-US';
                          speechSynthesis.speak(utterance);
                        }}
                        title="Sesli oku"
                      >
                        🔊
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
          Excel/CSV: 1. sütun İngilizce, 2. sütun Türkçe | Ayraç: virgül veya noktalı virgül
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
          Az kelimeli listeleri tek bir listede topla. Aynı İngilizce kelime tekrar eklenmez.
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
