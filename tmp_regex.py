import re
from pathlib import Path
path=Path('src/pages/Quiz.tsx')
text=path.read_text(encoding='utf-8')
pattern=r"\{\s*\[\s*\{ type: 'multiple-choice' as QuizType[^\n]*\n\s*\{ type: 'flashcard' as QuizType[^\n]*\n\s*\{ type: 'matching' as QuizType[^\n]*\n\s*\]\s*\.map"
m=re.search(pattern,text,re.MULTILINE)
if not m:
    raise SystemExit('pattern not found')
replacement="""{
                { type: 'multiple-choice' as QuizType, icon: '??', label: 'Coktan Secmeli' },
                { type: 'flashcard' as QuizType, icon: '??', label: 'Flashcard' },
                { type: 'matching' as QuizType, icon: '??', label: 'Eslesme' },
                { type: 'write' as QuizType, icon: '?', label: 'Yazarak Cevap' }
              ].map"""
text=text[:m.start()]+replacement+text[m.end():]
path.write_text(text,encoding='utf-8')
