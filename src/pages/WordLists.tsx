import React, { useRef, useState } from 'react';
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

  const allWrong = new Map<string, Word>();
  wordLists.forEach((l) => {
    l.words
      .filter((w) => w.incorrectCount > 0)
      .forEach((w) => {
        if (!allWrong.has(w.id)) allWrong.set(w.id, w);
      });
  });
  const wrongWords = Array.from(allWrong.values());

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
      setMessage({ text: 'Lutfen gecerli bir Excel veya CSV dosyasi secin.', type: 'error' });
      return;
    }

    setIsLoading(true);
    setMessage(null);

    const result = await parseExcelFile(file);

    if (result.success) {
      const title = listTitle.trim() || file.name.replace(/\.[^/.]+$/, '');
      addWordList(title, result.words);
      setMessage({
        text: `"${title}" basariyla yüklendi! ${result.words.length} kelime eklendi.`,
        type: 'success'
      });
      setListTitle('');
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } else {
      setMessage({ text: result.error || 'Dosya yüklenirken hata olustu.', type: 'error' });
    }

    setIsLoading(false);
  };

  const handleRemoveList = (id: string, title: string) => {
    if (window.confirm(`"${title}" listesini silmek istedigine emin misin?`)) {
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
        setMessage({ text: 'Lutfen liste adini gir.', type: 'error' });
        return;
      }
      addWordList(manualListName.trim(), validWords);
      setMessage({ text: `"${manualListName}" olusturuldu! ${validWords.length} kelime eklendi.`, type: 'success' });
      setManualListName('');
      setManualWords([{ english: '', turkish: '' }]);
      setViewMode('lists');
      return;
    }

    const targetList = wordLists.find((l) => l.id === manualTargetListId);
    if (!targetList) {
      setMessage({ text: 'Hedef liste bulunamadi.', type: 'error' });
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
      text: `${targetList.title} listesine ${added} kelime eklendi${skipped ? `, ${skipped} tekrar atlandi` : ''}.`,
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
      setMessage({ text: 'Ingilizce ve Turkce alanlarini doldurun.', type: 'error' });
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
    setMessage({ text: 'Kelime guncellendi!', type: 'success' });
  };
  const cancelEdit = () => setEditingWordId(null);

  const handleExportList = (list: typeof wordLists[0]) => {
    const csvContent = list.words.map((w) => `${w.english};${w.turkish}`).join('\n');
    const blob = new Blob([`English;Turkish\n${csvContent}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${list.title}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    setMessage({ text: `"${list.title}" indirildi.`, type: 'success' });
  };

  const handleShareList = (list: typeof wordLists[0]) => {
    const text = list.words.map((w) => `${w.english} - ${w.turkish}`).join('\n');
    navigator.clipboard.writeText(text);
    setMessage({ text: 'Liste panoya kopyalandi.', type: 'success' });
  };

  if (viewMode === 'add-manual') {
    return (
      <div className="wordlists-container">
        <button className="btn btn-outline" onClick={() => setViewMode('lists')} style={{ marginBottom: '16px' }}>
          Geri
        </button>

        <h1 style={{ marginBottom: '24px' }}>Manuel Liste Olustur</h1>

        <div className="manual-add-section">
          <input
            type="text"
            value={manualListName}
            onChange={(e) => setManualListName(e.target.value)}
            placeholder="Liste adi *"
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
              <option value="new">Yeni liste olustur</option>
              {wordLists.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.title} ({l.words.length} kelime)
                </option>
              ))}
            </select>
            <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', alignSelf: 'center' }}>
              Mevcut liste secersen ad alani pasif olur.
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
                    placeholder="Ingilizce"
                    className="word-card-edit-input"
                    style={{ flex: 1 }}
                  />
                  <div className="word-card-separator" />
                  <input
                    type="text"
                    value={word.turkish}
                    onChange={(e) => updateManualWord(index, 'turkish', e.target.value)}
                    placeholder="Turkce"
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
            + Yeni Satir Ekle
          </button>

          <button
            className="btn btn-primary btn-lg"
            onClick={handleCreateManualList}
            style={{ marginTop: '16px', width: '100%' }}
          >
            {manualTargetListId === 'new' ? 'Listeyi Olustur' : 'Listeye Ekle'} (
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
                      setMessage({ text: 'Baslik guncellendi!', type: 'success' });
                    }
                  }}
                >
                  Kaydet
                </button>
                <button className="btn btn-outline btn-sm" onClick={() => setEditingTitle(false)}>
                  Iptal
                </button>
              </div>
            ) : (
              <h1
                className="word-list-title"
                onClick={() => {
                  setNewTitle(viewingList.title);
                  setEditingTitle(true);
                }}
                title="Basligi duzenlemek icin tikla"
              >
                <span className="word-list-icon">📑</span>
                {viewingList.title}
              </h1>
            )}
            <div className="word-list-actions">
              <button className="word-list-action-btn" onClick={() => handleExportList(viewingList)}>
                Indir
              </button>
              <button className="word-list-action-btn" onClick={() => handleShareList(viewingList)}>
                Kopyala
              </button>
            </div>
          </div>
          <p className="word-list-meta">
            {viewingList.words.length} kelime • Olusturulma: {new Date(viewingList.createdAt).toLocaleDateString('tr-TR')}
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
          <span className="word-table-col">Turkce</span>
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
            placeholder="Cevirisi..."
            className="word-table-input"
          />
          <button className="word-table-add-btn" onClick={handleAddWordToList} title="Ekle">
            +
          </button>
        </div>

        <div className="word-table-body">
          {filteredWords.length === 0 ? (
            <div className="word-table-empty">{searchQuery ? 'Arama sonucu bulunamadi.' : 'Henuz kelime yok.'}</div>
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
                      <button onClick={cancelEdit} className="word-table-icon-btn cancel" title="Iptal">
                        Iptal
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <span className="word-table-english">{word.english}</span>
                    <span className="word-table-turkish">{word.turkish}</span>
                    <div className="word-table-actions">
                      <button className={`word-table-icon-btn star ${word.incorrectCount > 0 ? 'active' : ''}`} title="Isaretle">
                        ★
                      </button>
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
                      <button className="word-table-icon-btn edit" onClick={() => startEditWord(word)} title="Duzenle">
                        Duzenle
                      </button>
                      <button
                        className="word-table-icon-btn delete"
                        onClick={() => {
                          if (window.confirm('Bu kelimeyi silmek istedigine emin misin?')) {
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

      <div className="upload-section">
        <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap', justifyContent: 'center' }}>
          <div className="upload-option">
            <span className="upload-icon">📂</span>
            <h3>Dosyadan Yukle</h3>
            <div className="file-input-wrapper">
              <input
                type="text"
                value={listTitle}
                onChange={(e) => setListTitle(e.target.value)}
                placeholder="Liste adi (opsiyonel)"
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
                Excel / CSV Sec
              </label>
            </div>
          </div>

          <div className="upload-option">
            <span className="upload-icon">✍️</span>
            <h3>Manuel Olustur</h3>
            <button className="btn btn-secondary" onClick={() => setViewMode('add-manual')}>
              Elle Kelime Ekle
            </button>
          </div>
        </div>

        <p className="upload-hint" style={{ marginTop: '14px' }}>
          Excel/CSV: 1. sutun Ingilizce, 2. sutun Turkce | Ayrac: virgul veya noktalı virgul
        </p>

        {isLoading && <div className="spinner" />}
        {message && <div className={`message message-${message.type}`}>{message.text}</div>}
      </div>

      <h2 style={{ marginBottom: '16px', marginTop: '26px' }}>Mevcut Listeler ({wordLists.length})</h2>

      {wrongWords.length > 0 && (
        <div className="wordlist-grid" style={{ marginBottom: '16px' }}>
          <div className="wordlist-card">
            <h3>Bilemedigim Kelimeler</h3>
            <p>{wrongWords.length} kelime</p>
            <div className="word-preview" style={{ maxHeight: '180px', overflowY: 'auto' }}>
              {wrongWords.slice(0, 12).map((w) => (
                <div key={w.id} className="word-preview-item">
                  <div className="word-preview-term">{w.english}</div>
                  <div className="word-preview-translation">{w.turkish}</div>
                </div>
              ))}
              {wrongWords.length > 12 && (
                <div className="word-preview-more">+ {wrongWords.length - 12} kelime daha</div>
              )}
            </div>
          </div>
        </div>
      )}

      {wordLists.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">📭</div>
          <p>Henuz kelime listesi yok.</p>
          <p style={{ fontSize: '0.9rem' }}>Dosya yukleyerek veya manuel ekleyerek baslayabilirsin.</p>
        </div>
      ) : (
        <div className="wordlist-grid">
          {wordLists.map((list) => (
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
                  {selectedListId === list.id ? 'Secili' : 'Quiz icin Sec'}
                </button>
                <button
                  className="btn btn-outline"
                  onClick={(e) => {
                    e.stopPropagation();
                    setViewingListId(list.id);
                    setViewMode('detail');
                  }}
                >
                  Goruntule
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
