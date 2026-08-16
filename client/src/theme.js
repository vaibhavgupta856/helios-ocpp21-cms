const KEY = 'helios-cms-theme';
const LEGACY_KEY = 'massive-cms-theme';

export const THEMES = [
  { id: 'massive', label: 'Helios', hint: 'Operator light' },
  { id: 'dark', label: 'Dark', hint: 'Control charcoal' },
  { id: 'midnight', label: 'Midnight', hint: 'Navy ops' },
  { id: 'forest', label: 'Forest', hint: 'Green gold' },
  { id: 'sand', label: 'Sand', hint: 'Warm clay' },
  { id: 'violet', label: 'Violet', hint: 'Amethyst' },
];

export function readTheme() {
  try {
    const id = localStorage.getItem(KEY) || localStorage.getItem(LEGACY_KEY);
    if (THEMES.some((t) => t.id === id)) return id;
  } catch {
    /* ignore */
  }
  return 'massive';
}

export function applyTheme(id) {
  const theme = THEMES.some((t) => t.id === id) ? id : 'massive';
  document.documentElement.setAttribute('data-theme', theme);
  try {
    localStorage.setItem(KEY, theme);
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new CustomEvent('cms-theme', { detail: theme }));
  return theme;
}

export function applyStoredTheme() {
  return applyTheme(readTheme());
}

/** Soft tour loop through every look. Caller must invoke the returned stop (restores `saved`). */
export function startThemeTourCycle(intervalMs = 850) {
  const ids = THEMES.map((t) => t.id);
  const saved = readTheme();
  let i = 0;
  applyTheme(ids[i]);
  const timer = window.setInterval(() => {
    i = (i + 1) % ids.length;
    applyTheme(ids[i]);
  }, intervalMs);
  return () => {
    window.clearInterval(timer);
    applyTheme(saved);
  };
}
