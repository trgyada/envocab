# -*- coding: utf-8 -*-
from pathlib import Path
path = Path('src/pages/WordLists.tsx')
text = path.read_text(encoding='utf-8')
old = '''
        <div style={{ marginTop: "16px", display: "flex", gap: "10px", flexWrap: "wrap", justifyContent: "center" }}>
          <button className="btn btn-secondary" onClick={scanDuplicates} disabled={isScanning}>
            {isScanning ? 'Taran‹¨«yor...' : 'Tekrarlari Tara'}
          </button>
          <button
            className="btn btn-outline"
            onClick={cleanDuplicatesKeepLargest}
            disabled={duplicateReport.length === 0}
          >
            TekrarlarZñ Temizle (En Buyuk Listeyi Koru)
          </button>
        </div>
'''
new = old + '''

        <div className="merge-panel">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <h3 style={{ margin: 0 }}>Listeleri Birleþtir</h3>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
              <input
                type="text"
                value={mergeName}
                onChange={(e) => setMergeName(e.target.value)}
                className="input-field"
                style={{ minWidth: '220px' }}
                placeholder="Yeni liste adi"
              />
              <button
                className="btn btn-primary"
                onClick={handleMergeLists}
                disabled={mergeSelection.length < 2}
              >
                {mergeSelection.length < 2 ? 'En az 2 liste sec' : 'Birleþtir'}
              </button>
            </div>
          </div>
          <p style={{ color: 'var(--text-secondary)', marginTop: '6px' }}>
            Az kelimeli listeleri tek bir listede topla. Ayný Ingilizce kelime tekrar eklenmez.
          </p>
          <div className="merge-list">
            {wordLists.map((list) => (
              <label key={merge-} className="merge-item">
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
'''
if old not in text:
    raise SystemExit('old block not found')
text = text.replace(old, new)
path.write_text(text, encoding='utf-8')
