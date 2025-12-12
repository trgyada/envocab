from pathlib import Path
path = Path('src/pages/Quiz.tsx')
text = path.read_text(encoding='utf-8')
old = "{\n                { type: 'multiple-choice' as QuizType, icon: '?"?', label: 'Coktan Secmeli' },\n                { type: 'flashcard' as QuizType, icon: '?f?', label: 'Flashcard' },\n                { type: 'matching' as QuizType, icon: '?"-', label: 'Eslesme' }\n              ]"
new = "{\n                { type: 'multiple-choice' as QuizType, icon: '??', label: 'Coktan Secmeli' },\n                { type: 'flashcard' as QuizType, icon: '??', label: 'Flashcard' },\n                { type: 'matching' as QuizType, icon: '??', label: 'Eslesme' },\n                { type: 'write' as QuizType, icon: '?', label: 'Yazarak Cevap' }\n              ]"
if old not in text:
    raise SystemExit('old not found')
text = text.replace(old, new, 1)
path.write_text(text, encoding='utf-8')
