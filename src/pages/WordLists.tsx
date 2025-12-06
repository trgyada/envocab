import React, { useState, useRef } from 'react';
import { useWordListStore } from '../stores/wordListStore';
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
  
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [listTitle, setListTitle] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('lists');
  const [viewingListId, setViewingListId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Manuel ekleme state'leri
  const [manualListName, setManualListName] = useState('');
  const [manualWords, setManualWords] = useState<{ english: string; turkish: string }[]>([
    { english: '', turkish: '' }
  ]);
  
  // Kelime düzenleme
  const [editingWordId, setEditingWordId] = useState<string | null>(null);
  const [editEnglish, setEditEnglish] = useState('');
  const [editTurkish, setEditTurkish] = useState('');
  
  // Başlık düzenleme
  const [editingTitle, setEditingTitle] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const viewingList = wordLists.find(l => l.id === viewingListId);

  // Filtrelenmiş kelimeler
  const filteredWords = viewingList?.words.filter(word => 
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
    if (window.confirm(`"${title}" listesini silmek istediğinize emin misiniz?`)) {
      removeWordList(id);
      setMessage({ text: `"${title}" silindi.`, type: 'success' });
      if (viewingListId === id) {
        setViewMode('lists');
        setViewingListId(null);
      }
    }
  };

  // Manuel kelime ekleme fonksiyonları
  const addManualWordRow = () => {
    setManualWords([...manualWords, { english: '', turkish: '' }]);
  };

  const removeManualWordRow = (index: number) => {
    if (manualWords.length > 1) {
      setManualWords(manualWords.filter((_, i) => i !== index));
    }
  };

  const updateManualWord = (index: number, field: 'english' | 'turkish', value: string) => {
    const updated = [...manualWords];
    updated[index][field] = value;
    setManualWords(updated);
  };

  const handleCreateManualList = () => {
    const validWords = manualWords.filter(w => w.english.trim() && w.turkish.trim());
    
    if (!manualListName.trim()) {
      setMessage({ text: 'Lütfen liste adı girin.', type: 'error' });
      return;
    }
    
    if (validWords.length === 0) {
      setMessage({ text: 'En az bir kelime eklemelisiniz.', type: 'error' });
      return;
    }

    addWordList(manualListName.trim(), validWords);
    setMessage({ text: `"${manualListName}" oluşturuldu! ${validWords.length} kelime eklendi.`, type: 'success' });
    setManualListName('');
    setManualWords([{ english: '', turkish: '' }]);
    setViewMode('lists');
  };

  // Mevcut listeye kelime ekleme
  const handleAddWordToList = () => {
    if (!viewingListId || !viewingList) return;
    
    const newWord = manualWords[0];
    const english = newWord.english.trim();
    const turkish = newWord.turkish.trim();
    
    // Boş alan kontrolü
    if (!english || !turkish) {
      setMessage({ text: 'İngilizce ve Türkçe alanlarını doldurun.', type: 'error' });
      return;
    }

    // Tekrar eden kelime kontrolü
    const isDuplicate = viewingList.words.some(
      w => w.english.toLowerCase() === english.toLowerCase()
    );
    
    if (isDuplicate) {
      setMessage({ text: 'Bu kelime zaten listede mevcut!', type: 'error' });
      return;
    }

    addWordToList(viewingListId, english, turkish);
    setMessage({ text: 'Kelime eklendi!', type: 'success' });
    setManualWords([{ english: '', turkish: '' }]);
  };

  // Kelime düzenleme
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

  const cancelEdit = () => {
    setEditingWordId(null);
  };

  // Liste export
  const handleExportList = (list: typeof wordLists[0]) => {
    const csvContent = list.words
      .map(w => `${w.english};${w.turkish}`)
      .join('\n');
    
    const blob = new Blob([`English;Turkish\n${csvContent}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${list.title}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    
    setMessage({ text: `"${list.title}" indirildi!`, type: 'success' });
  };

  // Liste paylaşma (kopyala)
  const handleShareList = (list: typeof wordLists[0]) => {
    const text = list.words
      .map(w => `${w.english} - ${w.turkish}`)
      .join('\n');
    
    navigator.clipboard.writeText(text);
    setMessage({ text: 'Liste panoya kopyalandı!', type: 'success' });
  };

  // Manuel Liste Oluşturma Ekranı
  if (viewMode === 'add-manual') {
    return (
      <div className="wordlists-container">
        <button 
          className="btn btn-outline" 
          onClick={() => setViewMode('lists')}
          style={{ marginBottom: '20px' }}
        >
          ← Geri
        </button>
        
        <h1 style={{ marginBottom: '30px' }}>✏️ Manuel Liste Oluştur</h1>

        <div className="manual-add-section">
          <input
            type="text"
            value={manualListName}
            onChange={(e) => setManualListName(e.target.value)}
            placeholder="Liste Adı *"
            className="input-field"
            style={{ marginBottom: '20px', fontSize: '1.1rem', padding: '15px' }}
          />

          <div className="word-cards-list">
            {manualWords.map((word, index) => (
              <div key={index} className="word-card">
                <div className="word-card-body">
                  <input
                    type="text"
                    value={word.english}
                    onChange={(e) => updateManualWord(index, 'english', e.target.value)}
                    placeholder="English"
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
                    🗑️
                  </button>
                </div>
              </div>
            ))}
          </div>

          <button 
            className="btn btn-outline"
            onClick={addManualWordRow}
            style={{ marginTop: '15px', width: '100%' }}
          >
            + Yeni Satır Ekle
          </button>

          <button 
            className="btn btn-primary btn-lg"
            onClick={handleCreateManualList}
            style={{ marginTop: '20px', width: '100%' }}
          >
            ✓ Listeyi Oluştur ({manualWords.filter(w => w.english && w.turkish).length} kelime)
          </button>
        </div>

        {message && (
          <div className={`message message-${message.type}`} style={{ marginTop: '20px' }}>
            {message.text}
          </div>
        )}
      </div>
    );
  }

  // Liste Detay Ekranı
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
          style={{ marginBottom: '20px' }}
        >
          ← Geri
        </button>

        {/* Liste Başlığı */}
        <div className="word-list-header">
          <div className="word-list-title-section">
            {editingTitle ? (
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="input-field"
                  style={{ fontSize: '1.3rem', fontWeight: 'bold', padding: '8px 12px' }}
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
                  ✓
                </button>
                <button 
                  className="btn btn-outline btn-sm" 
                  onClick={() => setEditingTitle(false)}
                >
                  ✕
                </button>
              </div>
            ) : (
              <h1 
                className="word-list-title"
                onClick={() => {
                  setNewTitle(viewingList.title);
                  setEditingTitle(true);
                }}
                title="Başlığı düzenlemek için tıklayın"
              >
                <span className="word-list-icon">📖</span>
                {viewingList.title}
              </h1>
            )}
            <div className="word-list-actions">
              <button className="word-list-action-btn" onClick={() => handleExportList(viewingList)}>
                📥 İndir
              </button>
              <button className="word-list-action-btn" onClick={() => handleShareList(viewingList)}>
                📋 Kopyala
              </button>
            </div>
          </div>
          <p className="word-list-meta">
            {viewingList.words.length} kelime • Oluşturulma: {new Date(viewingList.createdAt).toLocaleDateString('tr-TR')}
          </p>
        </div>

        {/* Arama */}
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
          <div className={`message message-${message.type}`} style={{ marginBottom: '20px' }}>
            {message.text}
          </div>
        )}

        {/* Tablo Başlığı */}
        <div className="word-table-header">
          <span className="word-table-col">English</span>
          <span className="word-table-col">Türkçe</span>
          <span className="word-table-col-actions"></span>
        </div>

        {/* Yeni Kelime Ekleme Satırı */}
        <div className="word-table-add-row">
          <input
            type="text"
            value={manualWords[0]?.english || ''}
            onChange={(e) => updateManualWord(0, 'english', e.target.value)}
            placeholder="Yeni kelime..."
            className="word-table-input"
          />
          <input
            type="text"
            value={manualWords[0]?.turkish || ''}
            onChange={(e) => updateManualWord(0, 'turkish', e.target.value)}
            placeholder="Çevirisi..."
            className="word-table-input"
          />
          <button className="word-table-add-btn" onClick={handleAddWordToList} title="Ekle">
            +
          </button>
        </div>

        {/* Kelime Listesi */}
        <div className="word-table-body">
          {filteredWords.length === 0 ? (
            <div className="word-table-empty">
              {searchQuery ? 'Arama sonucu bulunamadı.' : 'Henüz kelime yok.'}
            </div>
          ) : (
            filteredWords.map((word) => (
              <div key={word.id} className="word-table-row">
                {editingWordId === word.id ? (
                  /* Düzenleme Modu */
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
                      <button onClick={saveEditWord} className="word-table-icon-btn save" title="Kaydet">✓</button>
                      <button onClick={cancelEdit} className="word-table-icon-btn cancel" title="İptal">✕</button>
                    </div>
                  </>
                ) : (
                  /* Normal Görünüm */
                  <>
                    <span className="word-table-english">{word.english}</span>
                    <span className="word-table-turkish">{word.turkish}</span>
                    <div className="word-table-actions">
                      <button 
                        className={`word-table-icon-btn star ${word.incorrectCount > 0 ? 'active' : ''}`}
                        title="Yıldızla"
                      >
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
                      <button 
                        className="word-table-icon-btn edit" 
                        onClick={() => startEditWord(word)} 
                        title="Düzenle"
                      >
                        ✏️
                      </button>
                      <button 
                        className="word-table-icon-btn delete" 
                        onClick={() => {
                          if (window.confirm('Bu kelimeyi silmek istediğinize emin misiniz?')) {
                            removeWordFromList(viewingListId!, word.id);
                          }
                        }}
                        title="Sil"
                      >
                        🗑️
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

  // Ana Liste Görünümü
  return (
    <div className="wordlists-container">
      <h1 style={{ marginBottom: '30px' }}>📋 Kelime Listeleri</h1>

      {/* Yükleme Bölümü */}
      <div className="upload-section">
        <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap', justifyContent: 'center' }}>
          {/* Dosyadan Yükle */}
          <div className="upload-option">
            <span className="upload-icon">📁</span>
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
              <label htmlFor="file-upload" className="btn btn-primary" style={{ cursor: 'pointer' }}>
                Excel / CSV Seç
              </label>
            </div>
          </div>

          {/* Manuel Oluştur */}
          <div className="upload-option">
            <span className="upload-icon">✏️</span>
            <h3>Manuel Oluştur</h3>
            <button 
              className="btn btn-secondary"
              onClick={() => setViewMode('add-manual')}
            >
              Elle Kelime Ekle
            </button>
          </div>
        </div>

        <p className="upload-hint" style={{ marginTop: '20px' }}>
          💡 Excel/CSV: 1. sütun İngilizce, 2. sütun Türkçe | Ayraç: virgül veya noktalı virgül
        </p>

        {isLoading && <div className="spinner" />}

        {message && (
          <div className={`message message-${message.type}`}>
            {message.text}
          </div>
        )}
      </div>

      {/* Mevcut Listeler */}
      <h2 style={{ marginBottom: '20px', marginTop: '40px' }}>
        📚 Mevcut Listeler ({wordLists.length})
      </h2>

      {wordLists.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">📭</div>
          <p>Henüz kelime listesi yok.</p>
          <p style={{ fontSize: '0.9rem' }}>Dosya yükleyerek veya manuel ekleyerek başlayın.</p>
        </div>
      ) : (
        <div className="wordlist-grid">
          {wordLists.map((list) => (
            <div 
              key={list.id} 
              className={`wordlist-card ${selectedListId === list.id ? 'selected' : ''}`}
            >
              <div 
                style={{ cursor: 'pointer' }}
                onClick={() => {
                  setViewingListId(list.id);
                  setViewMode('detail');
                }}
              >
                <h3>{list.title}</h3>
                <p>{list.words.length} kelime</p>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  {new Date(list.createdAt).toLocaleDateString('tr-TR')}
                </p>
                
                {/* İstatistik */}
                <div className="list-stats">
                  <span className="stat-item">
                    ✓ {list.words.filter(w => w.correctCount > 0).length}
                  </span>
                  <span className="stat-item warning">
                    ⚠️ {list.words.filter(w => w.incorrectCount > 0).length}
                  </span>
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
                  {selectedListId === list.id ? '✓ Seçili' : 'Quiz için Seç'}
                </button>
                <button
                  className="btn btn-outline"
                  onClick={(e) => {
                    e.stopPropagation();
                    setViewingListId(list.id);
                    setViewMode('detail');
                  }}
                >
                  👁️
                </button>
                <button
                  className="btn btn-danger"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRemoveList(list.id, list.title);
                  }}
                >
                  🗑️
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
