export const NAV = [
  { id: 'dashboard', label: 'Dashboard', group: 'Operate' },
  { id: 'twin', label: 'Digital twin', group: 'Operate' },
  { id: 'assistant', label: 'Ask Helios', group: 'Operate' },
  { id: 'stations', label: 'Stations', group: 'Operate' },
  { id: 'sessions', label: 'Sessions', group: 'Operate' },
  { id: 'tokens', label: 'RFID & tokens', group: 'Operate' },
  { id: 'tariffs', label: 'Tariffs', group: 'Operate' },
  { id: 'demand', label: 'Demand', group: 'Plan' },
  { id: 'sites', label: 'Site planner', group: 'Plan' },
  { id: 'smart-charging', label: 'Smart charging', group: 'Plan' },
  { id: 'security', label: 'Security', group: 'Setup' },
  { id: 'roles', label: 'Roles', group: 'Setup' },
];

/** Pages kept in the app but off the sidebar. */
export const HIDDEN_VIEWS = [
  'firmware',
  'diagnostics',
  'display',
  'der',
  'catalog',
  'trace',
];

export const VIEW_IDS = [...NAV.map((n) => n.id), ...HIDDEN_VIEWS];

export function hashView() {
  const raw = (window.location.hash || '').replace(/^#\/?/, '');
  const id = raw.split('/')[0] || 'dashboard';
  return VIEW_IDS.includes(id) ? id : 'dashboard';
}
