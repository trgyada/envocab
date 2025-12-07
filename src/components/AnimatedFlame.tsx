import React from 'react';

const AnimatedFlame: React.FC = () => (
  <div className="flame-logo">
    <svg viewBox="0 0 115 158" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="grad-left" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FFCA28" />
          <stop offset="100%" stopColor="#FFA000" />
        </linearGradient>
        <linearGradient id="grad-center" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FF8A65" />
          <stop offset="100%" stopColor="#DD2C00" />
        </linearGradient>
      </defs>

      <path
        className="flame-left"
        d="M19.3,13.6L3.3,47.5c-1.8,4-0.6,9.1,2.8,11.8L57.5,108L19.3,13.6z"
        fill="url(#grad-left)"
      />

      <path
        className="flame-right"
        d="M86.8,40.1L65.4,7.8c-1.9-2.8-6-3-8.2-0.4L38.4,28.8l19.1,79.3L86.8,40.1z"
        fill="#FFA000"
      />

      <path
        className="flame-center"
        d="M57.5,108.1L95.6,35.7L109.8,63c1.6,3.1,1.4,6.8-0.6,9.7l-42.9,78.2c-2.7,4.9-9.9,4.9-12.6,0 L6.1,59.3L57.5,108.1z"
        fill="#DD2C00"
      />

      <path
        className="flame-center highlight"
        d="M57.5,108L38.4,28.8L28.1,50.7L57.5,108z"
        fill="#FFCA28"
        fillOpacity="0.2"
      />
    </svg>
  </div>
);

export default AnimatedFlame;
