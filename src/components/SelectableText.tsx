import React from 'react';

interface SelectableTextProps {
  text: string;
  onWordClick?: (word: string) => void;
}

// Basit tokenizasyon: kelime, bosluk, diger karakterler
const tokenize = (input: string) => {
  const regex = /([A-Za-zÇÖÜĞİŞçöüğış]+)|(\s+)|([^\sA-Za-zÇÖÜĞİŞçöüğış]+)/g;
  const parts: string[] = [];
  let match;
  while ((match = regex.exec(input)) !== null) {
    parts.push(match[0]);
  }
  if (parts.length === 0) parts.push(input);
  return parts;
};

const SelectableText: React.FC<SelectableTextProps> = ({ text, onWordClick }) => {
  const parts = tokenize(text);

  return (
    <span className="selectable-text">
      {parts.map((part, idx) => {
        const isWord = /[A-Za-zÇÖÜĞİŞçöüğış]/.test(part.trim());
        if (!isWord || !onWordClick) {
          return (
            <span key={idx} className="selectable-text-part">
              {part}
            </span>
          );
        }
        return (
          <span
            key={idx}
            className="selectable-word"
            onClick={() => onWordClick(part.trim())}
            role="button"
            tabIndex={0}
          >
            {part}
          </span>
        );
      })}
    </span>
  );
};

export default SelectableText;
