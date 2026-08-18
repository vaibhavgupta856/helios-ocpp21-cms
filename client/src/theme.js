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

export function applyTheme(id, opts = {}) {
  const persist = opts.persist !== false;
  const theme = THEMES.some((t) => t.id === id) ? id : 'massive';
  document.documentElement.setAttribute('data-theme', theme);
  if (persist) {
    try {
      localStorage.setItem(KEY, theme);
    } catch {
      /* ignore */
    }
  }
  window.dispatchEvent(new CustomEvent('cms-theme', { detail: theme }));
  return theme;
}

export function applyStoredTheme() {
  return applyTheme(readTheme());
}

/** Play each look once, then restore `saved`. Caller must invoke the returned stop. */
export function startThemeTourCycle(intervalMs = 900) {
  const ids = THEMES.map((t) => t.id);
  const saved = readTheme();
  let i = 0;
  applyTheme(ids[0], { persist: false });
  const timer = window.setInterval(() => {
    i += 1;
    if (i >= ids.length) {
      window.clearInterval(timer);
      applyTheme(saved);
      return;
    }
    applyTheme(ids[i], { persist: false });
  }, intervalMs);
  return () => {
    window.clearInterval(timer);
    applyTheme(saved);
  };
}
