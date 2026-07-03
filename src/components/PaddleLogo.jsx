// /opt/paddlehubs-site/src/components/PaddleLogo.jsx
import React from "react";

export default function PaddleLogo({ size = 40, className = "" }) {
  return (
    <svg
      viewBox="40 10 260 390"
      width={size}
      height={size}
      className={className}
      role="img"
      aria-label="PaddleHubs"
    >
      <rect x="70" y="30" width="220" height="250" rx="64" fill="rgb(var(--accent))" />
      <rect
        x="84"
        y="44"
        width="192"
        height="222"
        rx="52"
        fill="none"
        stroke="#FFFFFF"
        strokeOpacity="0.22"
        strokeWidth="6"
      />
      <rect x="150" y="280" width="60" height="95" rx="22" fill="rgb(var(--accent))" />

      <circle cx="120" cy="90" r="8" fill="#FFFFFF" fillOpacity="0.32" />
      <circle cx="160" cy="90" r="8" fill="#FFFFFF" fillOpacity="0.32" />
      <circle cx="200" cy="90" r="8" fill="#FFFFFF" fillOpacity="0.32" />
      <circle cx="240" cy="90" r="8" fill="#FFFFFF" fillOpacity="0.32" />

      <circle cx="100" cy="130" r="8" fill="#FFFFFF" fillOpacity="0.32" />
      <circle cx="140" cy="130" r="8" fill="#FFFFFF" fillOpacity="0.32" />
      <circle cx="180" cy="130" r="8" fill="#FFFFFF" fillOpacity="0.32" />
      <circle cx="220" cy="130" r="8" fill="#FFFFFF" fillOpacity="0.32" />
      <circle cx="260" cy="130" r="8" fill="#FFFFFF" fillOpacity="0.32" />

      <circle cx="120" cy="170" r="8" fill="#FFFFFF" fillOpacity="0.32" />
      <circle cx="160" cy="170" r="8" fill="#FFFFFF" fillOpacity="0.32" />
      <circle cx="200" cy="170" r="15" fill="rgb(var(--signature))" />
      <circle cx="240" cy="170" r="8" fill="#FFFFFF" fillOpacity="0.32" />

      <circle cx="100" cy="210" r="8" fill="#FFFFFF" fillOpacity="0.32" />
      <circle cx="140" cy="210" r="8" fill="#FFFFFF" fillOpacity="0.32" />
      <circle cx="180" cy="210" r="8" fill="#FFFFFF" fillOpacity="0.32" />
      <circle cx="220" cy="210" r="8" fill="#FFFFFF" fillOpacity="0.32" />
      <circle cx="260" cy="210" r="8" fill="#FFFFFF" fillOpacity="0.32" />
    </svg>
  );
}
