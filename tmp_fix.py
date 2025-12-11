# -*- coding: latin-1 -*-
from pathlib import Path
p = Path('src/components/MultipleChoice.tsx')
text = p.read_bytes().decode('latin-1')
text = text.replace('esult-feedback }>', "result-feedback >")
text = text.replace('Do§ru!', 'Doðru!')
text = text.replace('iŸaretlendi.', 'iþaretlendi.')
text = text.replace('YanlŸ!', 'Yanlýþ!')
text = text.replace('Do§ru cevap', 'Doðru cevap')
text = text.replace('€eviri:', 'Çeviri:')
text = text.replace('Ceviri:', 'Çeviri:')
text = text.replace('Iptal', 'Ýptal')
# Normalize translation block manually
text = text.replace("""
              <div style={{ marginBottom: 8, color: 'var(--text-secondary)' }}>

                Çeviri: <strong>{translationText}</strong>
                Çeviri: <strong>{translationText}</strong>
""", """
              <div style={{ marginBottom: 8, color: 'var(--text-secondary)' }}>
                Çeviri: <strong>{translationText}</strong>
""")
# Ensure modal translation block wrapped conditionally
text = text.replace('            <p>\n              <strong>{selectedWord}</strong> kelimesini Bilinmeyenler listesine eklemek ister misin?\n            </p>\n            {translationText && (\n              <div style={{ marginBottom: 8, color: \'var(--text-secondary)\' }}>',
                       '            <p>\n              <strong>{selectedWord}</strong> kelimesini Bilinmeyenler listesine eklemek ister misin?\n            </p>\n            {translationText && (\n              <div style={{ marginBottom: 8, color: \'var(--text-secondary)\' }}>', 1)
p.write_text(text, encoding='utf-8')
