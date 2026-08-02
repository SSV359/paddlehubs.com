/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';

interface PaddleHubsLogoProps {
  className?: string;
  size?: number | string;
  showText?: boolean;
  textColorClass?: string;
  isDarkBackground?: boolean;
}

export const PaddleHubsLogo: React.FC<PaddleHubsLogoProps> = ({
  className = '',
  size = 40,
  showText = false,
  textColorClass = 'text-white',
  isDarkBackground = true
}) => {
  return (
    <div className={`inline-flex items-center gap-3 ${className}`} id="paddlehubs-brand-logo">
      {/* SVG Vector Logo */}
      <svg
        width={size}
        height={size}
        viewBox="0 0 512 512"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="shrink-0 select-none"
      >
        {/* Left Tournament Bracket Structure */}
        <g stroke="#2A8C4A" strokeWidth="12" strokeLinecap="round" strokeLinejoin="round">
          {/* Main horizontal bar connecting to paddle */}
          <line x1="180" y1="210" x2="140" y2="210" />
          
          {/* Vertical divider line for branches */}
          <line x1="140" y1="160" x2="140" y2="260" />
          
          {/* Symmetrical branch lines going left */}
          <line x1="140" y1="160" x2="100" y2="160" />
          <line x1="140" y1="210" x2="100" y2="210" />
          <line x1="140" y1="260" x2="100" y2="260" />
          
          {/* Bracket Node Squares */}
          <rect x="75" y="145" width="30" height="30" rx="4" fill={isDarkBackground ? '#0E1726' : '#FFFFFF'} strokeWidth="12" />
          <rect x="75" y="195" width="30" height="30" rx="4" fill={isDarkBackground ? '#0E1726' : '#FFFFFF'} strokeWidth="12" />
          <rect x="75" y="245" width="30" height="30" rx="4" fill={isDarkBackground ? '#0E1726' : '#FFFFFF'} strokeWidth="12" />
        </g>
        
        {/* Symmetrical Branch Joint Circle on Left (Gold/Yellow) */}
        <circle cx="140" cy="210" r="14" fill="#D4AF37" stroke="#2A8C4A" strokeWidth="6" />

        {/* Right Tournament Bracket Structure */}
        <g stroke="#2A8C4A" strokeWidth="12" strokeLinecap="round" strokeLinejoin="round">
          {/* Main horizontal bar connecting to paddle */}
          <line x1="332" y1="210" x2="372" y2="210" />
          
          {/* Vertical divider line for branches */}
          <line x1="372" y1="160" x2="372" y2="260" />
          
          {/* Symmetrical branch lines going right */}
          <line x1="372" y1="160" x2="412" y2="160" />
          <line x1="372" y1="210" x2="412" y2="210" />
          <line x1="372" y1="260" x2="412" y2="260" />
          
          {/* Bracket Node Squares */}
          <rect x="407" y="145" width="30" height="30" rx="4" fill={isDarkBackground ? '#0E1726' : '#FFFFFF'} strokeWidth="12" />
          <rect x="407" y="195" width="30" height="30" rx="4" fill={isDarkBackground ? '#0E1726' : '#FFFFFF'} strokeWidth="12" />
          <rect x="407" y="245" width="30" height="30" rx="4" fill={isDarkBackground ? '#0E1726' : '#FFFFFF'} strokeWidth="12" />
        </g>
        
        {/* Symmetrical Branch Joint Circle on Right (Gold/Yellow) */}
        <circle cx="372" cy="210" r="14" fill="#D4AF37" stroke="#2A8C4A" strokeWidth="6" />

        {/* Pickleball Paddle Head Outer Outline */}
        <path
          d="M 256 90 
             C 325 90, 332 105, 332 165 
             L 326 250 
             C 326 295, 292 312, 276 324 
             L 276 395 
             L 236 395 
             L 236 324 
             C 220 312, 186 295, 186 250 
             L 180 165 
             C 180 105, 187 90, 256 90 Z"
          stroke="#2A8C4A"
          strokeWidth="14"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill={isDarkBackground ? 'rgba(14, 23, 38, 0.4)' : 'rgba(255, 255, 255, 0.4)'}
        />

        {/* Paddle Handle & Wrapped Grip */}
        <g stroke="#2A8C4A" strokeWidth="12" strokeLinecap="round" strokeLinejoin="round">
          {/* Handle bottom end cap */}
          <path d="M 233 415 C 233 425, 279 425, 279 415 Z" fill="#2A8C4A" />
          {/* Handle vertical borders */}
          <line x1="236" y1="395" x2="236" y2="415" />
          <line x1="276" y1="395" x2="276" y2="415" />
          
          {/* Diagonal Grip Overlays */}
          <line x1="236" y1="345" x2="276" y2="360" strokeWidth="10" />
          <line x1="236" y1="365" x2="276" y2="380" strokeWidth="10" />
          <line x1="236" y1="385" x2="276" y2="400" strokeWidth="10" />
        </g>

        {/* Stylized Overlapping PH Athletics Lettermark */}
        <g transform="skewX(-10) translate(40, -10)">
          {/* Letter H - Placed behind in darker forest green */}
          <path
            d="M 215 160 L 235 160 L 235 210 L 275 210 L 275 160 L 295 160 L 295 285 L 275 285 L 275 230 L 235 230 L 235 285 L 215 285 Z"
            fill="#1E4D2B"
          />
          
          {/* Letter P - Placed on top in bright vibrant court-green */}
          <path
            d="M 172 135 
               L 235 135 
               C 260 135, 260 195, 235 195 
               L 195 195 
               L 195 285 
               L 172 285 Z 
               M 195 155 
               L 225 155 
               C 238 155, 238 175, 225 175 
               L 195 175 Z"
            fill="#2A8C4A"
          />
        </g>

        {/* 6 Golden/Yellow Pickleball Holes Pattern */}
        <g fill="#D4AF37">
          <circle cx="256" cy="272" r="9" />
          <circle cx="240" cy="284" r="9" />
          <circle cx="272" cy="284" r="9" />
          <circle cx="240" cy="300" r="9" />
          <circle cx="272" cy="300" r="9" />
          <circle cx="256" cy="312" r="9" />
        </g>
      </svg>

      {/* Brand Text */}
      {showText && (
        <span className={`font-brand font-black select-none tracking-normal ${textColorClass}`}>
          Paddle<span className="text-court-green">Hubs</span>
        </span>
      )}
    </div>
  );
};
