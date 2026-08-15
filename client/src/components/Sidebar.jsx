import { NAV } from '../nav.js';
import { can } from '../auth.js';

const ICONS = {
  dashboard: '▦',
  twin: '◎',
  assistant: 'AI',
  stations: '⌖',
  sessions: '◷',
  tokens: 'ID',
  tariffs: '₹',
  demand: '3d',
  sites: '＋',
  'smart-charging': 'kW',
  security: '⚿',
  roles: '⌘',
};

export default function Sidebar({ view, onNavigate, open, me, walkingView = '' }) {
  const nav = NAV.filter((item) => !me || can(me, `nav.${item.id}`));
  let lastGroup = '';
  return (
    <nav className={`cms-nav ${open ? 'open' : ''}`} aria-label="CMS pages" data-tour="nav">
      {nav.map((item) => {
        const showGroup = item.group !== lastGroup;
        lastGroup = item.group;
        return (
          <div key={item.id}>
            {showGroup && <div className="nav-label">{item.group}</div>}
            <button
              type="button"
              className={`nav-item ${view === item.id ? 'active' : ''} ${walkingView === item.id ? 'walking' : ''}`}
              data-tour={`nav-${item.id}`}
              onClick={() => onNavigate(item.id)}
            >
              <span className="nav-ico" aria-hidden>
                {ICONS[item.id] || '•'}
              </span>
              {item.label}
            </button>
          </div>
        );
      })}
    </nav>
  );
}
