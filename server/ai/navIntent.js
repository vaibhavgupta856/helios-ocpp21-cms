/**
 * “Take me to Site planner” / “open Stations” — open a CMS page, do not mutate.
 */

const PAGES = [
  { view: 'sites', label: 'Site planner', keys: ['site planner', 'site-planner', 'sites planner'] },
  { view: 'smart-charging', label: 'Smart charging', keys: ['smart charging', 'smart-charging'] },
  { view: 'twin', label: 'Digital twin', keys: ['digital twin'] },
  { view: 'assistant', label: 'Ask Helios', keys: ['ask massive', 'ask helios', 'ask ai', 'assistant'] },
  { view: 'tokens', label: 'RFID & tokens', keys: ['rfid', 'tokens'] },
  { view: 'tariffs', label: 'Tariffs', keys: ['tariff'] },
  { view: 'sessions', label: 'Sessions', keys: ['sessions', 'transactions'] },
  { view: 'stations', label: 'Stations', keys: ['stations', 'charge points', 'chargers'] },
  { view: 'dashboard', label: 'Dashboard', keys: ['dashboard', 'home kpis', 'the kpis', 'approve queue', 'action queue', 'approvals'] },
  { view: 'demand', label: 'Demand', keys: ['demand', 'forecast'] },
  { view: 'security', label: 'Security', keys: ['security', 'certificates'] },
  { view: 'roles', label: 'Roles', keys: ['roles', 'iam'] },
  { view: 'firmware', label: 'Firmware', keys: ['firmware'] },
  { view: 'diagnostics', label: 'Diagnostics', keys: ['diagnostics'] },
  { view: 'display', label: 'Display & Reservations', keys: ['reservation', 'display'] },
  { view: 'der', label: 'DER / V2X', keys: ['der', 'v2x'] },
  { view: 'catalog', label: 'OCPP catalog', keys: ['catalog'] },
  { view: 'trace', label: 'Trace', keys: ['trace'] },
  { view: 'twin', label: 'Digital twin', keys: ['twin', 'map'] },
  { view: 'dashboard', label: 'Dashboard', keys: ['dashboard', 'home'] },
];

export const NAV_PAGES = PAGES;

export function pageByView(view) {
  return PAGES.find((p) => p.view === view) || null;
}

export function parseNavIntent(question) {
  const q = String(question || '')
    .trim()
    .toLowerCase()
    .replace(/[?!.,]+$/g, '')
    .replace(/\s+/g, ' ');
  if (!q) return null;
  const hasVerb =
    /^(please\s+)?(take me|take us|bring me|bring us|open|go to|goto|show me|show|switch to|navigate to|head to|jump to|open up)\b/.test(
      q
    );
  const hasPlace = /\b(section|page|screen|tab)\b/.test(q);
  if (!hasVerb && !hasPlace) return null;
  for (const page of PAGES) {
    if (page.keys.some((k) => q.includes(k))) {
      return { view: page.view, label: page.label };
    }
  }
  return null;
}
