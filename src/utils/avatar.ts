/**
 * Generates a deterministic "initials avatar" as an inline SVG data URI —
 * used as the fallback whenever a player has no avatarDataUrl set yet.
 * Unlike a remote Unsplash placeholder, this never fails to load (no
 * network request, no rate limiting, works offline).
 */
const PALETTE = [
  '#E4572E', '#1C4E80', '#2F9E44', '#F2B705', '#8338EC', '#E63980',
  '#0FA3B1', '#B5651D', '#6C757D', '#D62828', '#3A86FF', '#2A9D8F',
];

function colorForName(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return PALETTE[Math.abs(hash) % PALETTE.length];
}

function initialsFor(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function defaultAvatar(name: string): string {
  const safeName = name || 'Player';
  const initials = initialsFor(safeName);
  const color = colorForName(safeName);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
    <rect width="100" height="100" rx="20" fill="${color}"/>
    <text x="50" y="50" font-family="monospace, sans-serif" font-size="38" font-weight="700" fill="white" text-anchor="middle" dominant-baseline="central">${initials}</text>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
