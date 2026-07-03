const MODE_KEY = "ph_theme";
const PALETTE_KEY = "ph_theme_palette";

export const PALETTES = [
  { id: "hardcourt", label: "Hard Court", swatch: "#155E9E" },
  { id: "clay", label: "Clay Court", swatch: "#B5502E" },
  { id: "grandslam", label: "Grand Slam", swatch: "#5B3AA0" },
];

export function getStoredMode() {
  try {
    return localStorage.getItem(MODE_KEY);
  } catch {
    return null;
  }
}

export function getPreferredMode() {
  const stored = getStoredMode();
  if (stored === "dark" || stored === "light") return stored;
  const prefersDark = window.matchMedia?.("(prefers-color-scheme: dark)").matches;
  return prefersDark ? "dark" : "light";
}

export function getPreferredPalette() {
  try {
    const stored = localStorage.getItem(PALETTE_KEY);
    if (PALETTES.some((p) => p.id === stored)) return stored;
  } catch {}
  return "hardcourt";
}

export function applyTheme(mode, palette) {
  const root = document.documentElement;
  if (mode === "dark") root.classList.add("dark");
  else root.classList.remove("dark");
  root.dataset.theme = palette;
}

export function setMode(mode) {
  try {
    localStorage.setItem(MODE_KEY, mode);
  } catch {}
  applyTheme(mode, getPreferredPalette());
}

export function setPalette(palette) {
  try {
    localStorage.setItem(PALETTE_KEY, palette);
  } catch {}
  applyTheme(getPreferredMode(), palette);
}

export function initTheme() {
  applyTheme(getPreferredMode(), getPreferredPalette());
}
