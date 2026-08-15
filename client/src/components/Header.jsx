import { useState } from 'react';
import { THEMES, readTheme, applyTheme } from '../theme.js';

export default function Header({
  stationCount,
  siteCount,
  onlineCount,
  navOpen,
  onToggleNav,
  me,
  users = [],
  onUserChange,
  onStartTutorial,
  tutorialOpen = false,
  onNavigate,
  view,
}) {
  const [theme, setTheme] = useState(readTheme);
  return (
    <header className="cms-top">
      <div className="brand-block" data-tour="brand">
        <button
          type="button"
          className={`nav-toggle ${navOpen ? 'open' : ''}`}
          aria-label={navOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={navOpen}
          onClick={onToggleNav}
        >
          <span />
        </button>
        <div className="brand-mark" aria-hidden>
          <span />
        </div>
        <div>
          <h1 className="brand-name">Helios</h1>
          <p className="brand-sub">CSMS · OCPP 2.1 — not a charge point</p>
        </div>
      </div>
      <div className="top-meta">
        <div className="top-pills" data-tour="pills">
          <span className="meta-pill meta-protocol">OCPP 2.1</span>
          <span className="meta-pill meta-stations">
            {siteCount != null ? `${siteCount} station${siteCount === 1 ? '' : 's'} · ` : ''}
            {stationCount} CP{stationCount === 1 ? '' : 's'}
          </span>
          <span className={`meta-pill ${onlineCount ? 'ok' : 'warn'}`}>
            <span className="live-dot" aria-hidden />
            {onlineCount} online
          </span>
        </div>
        {onNavigate ? (
          <button
            type="button"
            className={`btn ask-helios${view === 'assistant' ? ' active' : ''}`}
            onClick={() => onNavigate('assistant')}
          >
            Ask Helios
          </button>
        ) : null}
        {onStartTutorial ? (
          <button
            type="button"
            className={`btn tour-launch${tutorialOpen ? ' active' : ''}`}
            data-tour="tour-btn"
            aria-pressed={tutorialOpen}
            onClick={onStartTutorial}
          >
            Tutorial
          </button>
        ) : null}
        <label className="user-switch theme-switch" data-tour="theme">
          <span>Theme</span>
          <select
            value={theme}
            onChange={(e) => setTheme(applyTheme(e.target.value))}
            aria-label="Color theme"
          >
            {THEMES.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
        </label>
        {me ? (
          <label className="user-switch" data-tour="actor">
            <span>Act as</span>
            <select value={me.id} onChange={(e) => onUserChange?.(e.target.value)} aria-label="Act as user">
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} · {u.roleLabel}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>
    </header>
  );
}
