import React from 'react';

const AnimatedFlame: React.FC = () => (
  <div className="flame-logo">
    <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <defs>
        {/* Gradient'lar */}
        <linearGradient id="grad-navy" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#669BBC" />
          <stop offset="100%" stopColor="#003049" />
        </linearGradient>
        <linearGradient id="grad-crimson" x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#780000" />
          <stop offset="50%" stopColor="#C1121F" />
          <stop offset="100%" stopColor="#e63946" />
        </linearGradient>
        <linearGradient id="grad-gold" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FDF0D5" />
          <stop offset="100%" stopColor="#d4c4a8" />
        </linearGradient>
        
        {/* Glow Efekti */}
        <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
          <feMerge>
            <feMergeNode in="coloredBlur"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
        
        {/* Drop Shadow */}
        <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#000" floodOpacity="0.3"/>
        </filter>
      </defs>

      {/* Arka Plan Halkası */}
      <circle cx="50" cy="50" r="42" fill="none" stroke="#669BBC" strokeWidth="1.5" strokeOpacity="0.3" />
      
      {/* Ana Kalkan/Badge Şekli */}
      <path
        d="M50,12 L82,28 L82,58 C82,72 68,84 50,90 C32,84 18,72 18,58 L18,28 Z"
        fill="url(#grad-navy)"
        filter="url(#shadow)"
      />
      
      {/* İç Kalkan Highlight */}
      <path
        d="M50,18 L76,32 L76,56 C76,68 64,78 50,83 C36,78 24,68 24,56 L24,32 Z"
        fill="none"
        stroke="#669BBC"
        strokeWidth="1"
        strokeOpacity="0.4"
      />

      {/* "V" Harfi - Modern Tasarım */}
      <g filter="url(#glow)">
        {/* V Sol Kol */}
        <path
          d="M32,32 L50,68 L50,58 L38,32 Z"
          fill="url(#grad-crimson)"
        />
        {/* V Sağ Kol */}
        <path
          d="M68,32 L50,68 L50,58 L62,32 Z"
          fill="url(#grad-crimson)"
        />
      </g>
      
      {/* Üst Parlama */}
      <ellipse
        cx="50"
        cy="28"
        rx="18"
        ry="6"
        fill="#FDF0D5"
        fillOpacity="0.15"
      />
      
      {/* Alt Accent Çizgisi */}
      <path
        d="M35,75 Q50,80 65,75"
        fill="none"
        stroke="#C1121F"
        strokeWidth="2"
        strokeLinecap="round"
        strokeOpacity="0.8"
      />
    </svg>
  </div>
);

export default AnimatedFlame;
