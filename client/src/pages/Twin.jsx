import { useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import PageHeader from '../components/PageHeader.jsx';
import StatusBadge from '../components/StatusBadge.jsx';

const TECHS = ['Anita R.', 'Vikram S.', 'Priya M.', 'Rahul K.', 'Fatima N.'];

const ALARM_FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'fault', label: 'Fault' },
  { id: 'offline', label: 'Offline' },
  { id: 'charging', label: 'Charging' },
];

function formatWhen(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString();
}

function alarmTimestamp(cp, live, code) {
  if (code === 'charging') {
    const latest = [...live].sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')))[0];
    return latest?.updatedAt || latest?.startedAt || cp.lastMessageAt || null;
  }
  if (code === 'offline') return cp.lastMessageAt || cp.heartbeatAt || cp.connectedAt || null;
  return cp.lastMessageAt || cp.heartbeatAt || cp.bootAt || null;
}

function hasFaultAlarm(alarms) {
  return (alarms || []).some((a) => a?.severity === 'fault' || /Fault/i.test(a?.label || a));
}

const CITY_GEO = {
  Bengaluru: { lat: 12.9716, lng: 77.5946 },
  Hyderabad: { lat: 17.385, lng: 78.4867 },
  Pune: { lat: 18.5204, lng: 73.8567 },
  Gurugram: { lat: 28.4595, lng: 77.0266 },
  Mumbai: { lat: 19.076, lng: 72.8777 },
  Chennai: { lat: 13.0827, lng: 80.2707 },
};

function hashId(id) {
  let n = 0;
  for (const c of String(id)) n = (n * 31 + c.charCodeAt(0)) >>> 0;
  return n;
}

function geoOf(city, lat, lng, id) {
  const base =
    Number.isFinite(lat) && Number.isFinite(lng)
      ? { lat, lng }
      : CITY_GEO[city] || { lat: 20.5937, lng: 78.9629 };
  const j = ((hashId(id || city) % 17) - 8) * 0.012;
  return { lat: base.lat + j, lng: base.lng - j / 1.4 };
}

function chargerCard(cp, transactions) {
  const evses = cp.evses || [];
  const occupied = evses.filter((e) => /Occup|Charging|Suspended/i.test(e.connectorStatus || '')).length;
  const live = transactions.filter((t) => t.stationId === cp.stationId && t.status && t.status !== 'Ended');
  const util = evses.length ? occupied / evses.length : 0;
  const hour = new Date().getHours();
  const tempC = Number((27 + (hour % 7) * 0.6 + occupied * 1.8 + (hashId(cp.stationId) % 5) * 0.3).toFixed(1));
  const alarms = [];
  if (!cp.online) {
    alarms.push({
      code: 'offline',
      label: 'Offline',
      severity: 'offline',
      at: alarmTimestamp(cp, live, 'offline'),
    });
  }
  if (evses.some((e) => /Fault/i.test(e.connectorStatus || ''))) {
    alarms.push({
      code: 'fault',
      label: 'Faulted connector',
      severity: 'fault',
      at: alarmTimestamp(cp, live, 'fault'),
    });
  }
  if (evses.length && occupied >= evses.length) {
    alarms.push({
      code: 'charging',
      label: 'All connectors busy',
      severity: 'charging',
      at: alarmTimestamp(cp, live, 'charging'),
    });
  }
  const queueLength =
    evses.length && occupied >= evses.length ? Math.max(1, live.length - occupied + (hashId(cp.stationId) % 2)) : 0;
  const status = !cp.online ? 'Offline' : occupied ? 'Charging' : 'Available';
  const city = cp.location?.city || cp.site?.city || '';
  const { lat, lng } = geoOf(city, Number(cp.site?.lat), Number(cp.site?.lng), cp.stationId);
  return {
    ...cp,
    kind: 'charger',
    lat,
    lng,
    city: city || '—',
    status,
    utilizationPct: Number((util * 100).toFixed(0)),
    temperatureC: tempC,
    liveSessions: live.length,
    technician: cp.online ? TECHS[hashId(cp.stationId) % TECHS.length] : 'Dispatch pending',
    queueLength,
    alarms,
    occupied,
    connectors: evses.length,
  };
}

const DARK_THEMES = new Set(['dark', 'midnight', 'forest']);

function themeIsDark(themeId) {
  if (DARK_THEMES.has(themeId)) return true;
  return /\bdark\b/.test(getComputedStyle(document.documentElement).getPropertyValue('color-scheme'));
}

function tileSpec(themeId) {
  if (themeIsDark(themeId)) {
    return {
      url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
      attribution: '&copy; OpenStreetMap &copy; CARTO',
    };
  }
  return {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles © Esri — English street names',
  };
}

function escHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function MapLegend() {
  return (
    <ul className="twin-legend">
      <li className="twin-key">
        <span className="twin-swatch available" /> Available
      </li>
      <li className="twin-key">
        <span className="twin-swatch charging" /> Charging
      </li>
      <li className="twin-key">
        <span className="twin-swatch offline" /> Offline / fault
      </li>
      <li className="twin-key">
        <span className="twin-swatch vacant" /> Station with no charge point
      </li>
    </ul>
  );
}

function NetworkMap({ pins, pickedId, onPick }) {
  const el = useRef(null);
  const mapRef = useRef(null);
  const layerRef = useRef(null);
  const tileRef = useRef(null);
  const [themeId, setThemeId] = useState(() => document.documentElement.getAttribute('data-theme') || 'massive');
  const [mapReady, setMapReady] = useState(0);

  useEffect(() => {
    const onTheme = (e) => setThemeId(e.detail || 'massive');
    window.addEventListener('cms-theme', onTheme);
    return () => window.removeEventListener('cms-theme', onTheme);
  }, []);

  useEffect(() => {
    if (!el.current || mapRef.current) return undefined;
    const map = L.map(el.current, { scrollWheelZoom: true, zoomControl: true }).setView([20.6, 78.9], 5);
    layerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;
    const resize = () => map.invalidateSize({ animate: false });
    const ro = new ResizeObserver(resize);
    ro.observe(el.current);
    if (el.current.parentElement) ro.observe(el.current.parentElement);
    window.addEventListener('resize', resize);
    map.whenReady(resize);
    const later = [40, 200, 500].map((ms) => setTimeout(resize, ms));
    setMapReady((n) => n + 1);
    return () => {
      later.forEach(clearTimeout);
      window.removeEventListener('resize', resize);
      ro.disconnect();
      map.remove();
      mapRef.current = null;
      layerRef.current = null;
      tileRef.current = null;
      setMapReady(0);
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    if (tileRef.current) {
      map.removeLayer(tileRef.current);
      tileRef.current = null;
    }
    const spec = tileSpec(themeId);
    tileRef.current = L.tileLayer(spec.url, { maxZoom: 19, attribution: spec.attribution }).addTo(map);
  }, [themeId, mapReady]);

  useEffect(() => {
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!map || !layer || !mapReady) return;
    layer.clearLayers();
    const bounds = [];
    const theme = getComputedStyle(document.documentElement);
    const down = theme.getPropertyValue('--signal-red').trim() || '#e11d48';
    const live = theme.getPropertyValue('--signal-green').trim() || '#10b981';
    const idle = theme.getPropertyValue('--signal-blue').trim() || '#2563eb';
    const empty = '#64748b';
    for (const p of pins) {
      const offline = p.status === 'Offline' || p.online === false;
      const fault = hasFaultAlarm(p.alarms);
      const color =
        p.kind === 'station' ? empty : offline || fault ? down : p.status === 'Charging' ? live : idle;
      const marker = L.circleMarker([p.lat, p.lng], {
        radius: pickedId === p.stationId ? 13 : p.kind === 'station' ? 10 : 8,
        color: '#fff',
        weight: 2,
        fillColor: color,
        fillOpacity: 1,
      });
      const title = p.kind === 'station' ? p.name || p.location?.name || p.stationId : p.stationId;
      const place = [p.location?.name, p.city].filter(Boolean).join(', ');
      marker.bindTooltip(
        `<strong>${escHtml(title)}</strong><br/>${escHtml(place)}<br/>${escHtml(p.status)}${
          p.kind === 'charger' ? ` · ${escHtml(p.utilizationPct)}% utilized` : ''
        }`,
        { direction: 'top', opacity: 0.95, className: 'twin-tip' }
      );
      marker.on('click', () => onPick(p.stationId));
      marker.addTo(layer);
      bounds.push([p.lat, p.lng]);
    }
    if (pickedId) {
      const pin = pins.find((p) => p.stationId === pickedId);
      if (pin) {
        map.flyTo([pin.lat, pin.lng], 12, { duration: 0.55 });
        setTimeout(() => map.invalidateSize({ animate: false }), 50);
        return;
      }
    }
    if (bounds.length === 1) map.setView(bounds[0], 12);
    else if (bounds.length > 1) map.fitBounds(bounds, { padding: [48, 48], maxZoom: 12 });
    setTimeout(() => map.invalidateSize({ animate: false }), 50);
  }, [pins, pickedId, onPick, themeId, mapReady]);

  return <div className="twin-map" ref={el} />;
}

function AlarmChip({ severity, children }) {
  return <span className={`badge ${severity}`}>{children}</span>;
}

export default function Twin({ stations, sites = [], transactions, setSelectedStationId, navigate, walkFocus = null }) {
  const [pickedId, setPickedId] = useState(walkFocus?.stationId || walkFocus?.siteId || '');
  const [alarmFilter, setAlarmFilter] = useState('all');
  useEffect(() => {
    if (walkFocus?.stationId) setPickedId(walkFocus.stationId);
    else if (walkFocus?.siteId) setPickedId(walkFocus.siteId);
  }, [walkFocus?.stationId, walkFocus?.siteId]);
  const chargers = useMemo(
    () => stations.map((s) => chargerCard(s, transactions || [])),
    [stations, transactions]
  );
  const pins = useMemo(() => {
    const used = new Set(chargers.map((c) => c.siteId).filter(Boolean));
    const emptyStations = (sites || [])
      .filter((s) => !used.has(s.id))
      .map((s) => {
        const { lat, lng } = geoOf(s.city, Number(s.lat), Number(s.lng), s.id);
        return {
          stationId: s.id,
          kind: 'station',
          name: s.name,
          location: s,
          tenant: { name: '' },
          city: s.city || '—',
          lat,
          lng,
          status: 'No charge points',
          online: false,
          utilizationPct: 0,
          temperatureC: '—',
          liveSessions: 0,
          technician: '—',
          queueLength: 0,
          alarms: [],
          evses: [],
        };
      });
    return [...chargers, ...emptyStations];
  }, [chargers, sites]);
  const picked = pins.find((p) => p.stationId === pickedId) || null;
  const alarmItems = useMemo(() => {
    const rows = [];
    for (const c of chargers) {
      for (const a of c.alarms || []) {
        rows.push({
          key: `${c.stationId}:${a.code}`,
          stationId: c.stationId,
          site: c.location?.name || c.city,
          city: c.city,
          ...a,
        });
      }
    }
    rows.sort((a, b) => String(b.at || '').localeCompare(String(a.at || '')));
    return rows;
  }, [chargers]);
  const alarmCounts = useMemo(() => {
    const counts = { all: alarmItems.length, fault: 0, offline: 0, charging: 0 };
    for (const a of alarmItems) {
      if (counts[a.severity] != null) counts[a.severity] += 1;
    }
    return counts;
  }, [alarmItems]);
  const visibleAlarms = alarmFilter === 'all' ? alarmItems : alarmItems.filter((a) => a.severity === alarmFilter);
  const alarmEmpty =
    alarmItems.length === 0
      ? 'No active alarms on the network.'
      : `No ${ALARM_FILTERS.find((f) => f.id === alarmFilter)?.label.toLowerCase() || alarmFilter} alarms.`;

  return (
    <div className="twin-page">
      <PageHeader
        title="Digital twin"
        subtitle="Live map of the charging network — click a charger for status, utilization, temperature, sessions, technician, queue, alarms"
        actions={
          <button type="button" className="btn" onClick={() => navigate('stations')}>
            Open stations
          </button>
        }
      />
      <div className="stat-grid">
        <div className="stat-card tone-info">
          <div className="k">Chargers</div>
          <div className="v">{chargers.length}</div>
        </div>
        <div className="stat-card tone-ok">
          <div className="k">Online</div>
          <div className="v">{chargers.filter((c) => c.online).length}</div>
        </div>
        <div className="stat-card tone-charge">
          <div className="k">Live sessions</div>
          <div className="v">{chargers.reduce((s, c) => s + c.liveSessions, 0)}</div>
        </div>
        <div className="stat-card tone-down">
          <div className="k">Alarms</div>
          <div className="v">{alarmItems.length}</div>
        </div>
      </div>
      <div className="twin-split">
        <div className={`card twin-map-card ${walkFocus ? 'walk-reading' : ''}`} data-tour="twin-map">
          <h3>Network map</h3>
          <div className="twin-map-stage">
            {pins.length === 0 ? (
              <p className="empty">No stations or charge points yet. Add a station on Stations.</p>
            ) : (
              <NetworkMap pins={pins} pickedId={pickedId} onPick={setPickedId} />
            )}
            <MapLegend />
          </div>
        </div>
        <div className={`card twin-detail-card ${picked && walkFocus ? 'walk-pulse' : ''}`} data-tour="twin-detail">
          <h3>{picked ? picked.stationId : 'Select a charger'}</h3>
          {!picked ? (
            <p className="empty">Click a pin on the map.</p>
          ) : picked.kind === 'station' ? (
            <>
              <p className="muted">
                {picked.name} · {picked.city} — no charge points yet
              </p>
              <div className="ops">
                <button type="button" className="btn primary" onClick={() => navigate('stations')}>
                  Add charge point
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="muted">
                {picked.tenant?.name || '—'} · {picked.location?.name || picked.city} · {picked.city}
              </p>
              <div className="twin-metrics">
                <div>
                  <span className="k">Status</span>
                  <StatusBadge value={picked.status} />
                </div>
                <div>
                  <span className="k">Utilization</span>
                  <strong>{picked.utilizationPct}%</strong>
                </div>
                <div>
                  <span className="k">Temperature</span>
                  <strong>{picked.temperatureC}°C</strong>
                </div>
                <div>
                  <span className="k">Active sessions</span>
                  <strong>{picked.liveSessions}</strong>
                </div>
                <div>
                  <span className="k">Technician</span>
                  <strong>{picked.technician}</strong>
                </div>
                <div>
                  <span className="k">Queue</span>
                  <strong>{picked.queueLength}</strong>
                </div>
              </div>
              <div className="twin-detail-alarms">
                <span className="k">Alarms</span>
                {picked.alarms.length ? (
                  <div className="twin-alarm-chips">
                    {picked.alarms.map((a) => (
                      <AlarmChip key={a.code} severity={a.severity}>
                        {a.label}
                      </AlarmChip>
                    ))}
                  </div>
                ) : (
                  <p className="muted">No alarms on this charger.</p>
                )}
              </div>
              <div className="evse-pills twin-evses">
                {(picked.evses || []).map((e) => (
                  <span key={`${e.evseId}:${e.connectorId}`} className={`badge ${e.connectorStatus}`}>
                    EVSE {e.evseId} / C{e.connectorId} · {e.connectorStatus}
                  </span>
                ))}
              </div>
              <div className="ops twin-detail-ops">
                <button
                  type="button"
                  className="btn primary"
                  onClick={() => {
                    setSelectedStationId(picked.stationId);
                    navigate('stations');
                  }}
                >
                  Open in Stations
                </button>
              </div>
            </>
          )}
        </div>
      </div>
      <div className="card twin-alarms-card">
        <div className="twin-alarms-head">
          <h3>
            Alarms
            <span className="twin-alarms-count">{alarmItems.length}</span>
          </h3>
          <div className="chip-picks twin-alarm-filters" role="tablist" aria-label="Alarm severity">
            {ALARM_FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                role="tab"
                aria-selected={alarmFilter === f.id}
                className={`chip-pick ${alarmFilter === f.id ? 'on' : ''}`}
                onClick={() => setAlarmFilter(f.id)}
              >
                {f.label}
                <span className="twin-filter-n">{alarmCounts[f.id]}</span>
              </button>
            ))}
          </div>
        </div>
        {visibleAlarms.length === 0 ? (
          <p className="empty">{alarmEmpty}</p>
        ) : (
          <div className="twin-alarms-pane">
            {visibleAlarms.map((a) => (
              <button
                key={a.key}
                type="button"
                className={`twin-alarm-row ${pickedId === a.stationId ? 'selected' : ''}`}
                onClick={() => setPickedId(a.stationId)}
              >
                <AlarmChip severity={a.severity}>
                  {ALARM_FILTERS.find((f) => f.id === a.severity)?.label || a.severity}
                </AlarmChip>
                <span className="twin-alarm-body">
                  <span className="id" title={a.stationId}>
                    {a.stationId}
                  </span>
                  <span className="sub">
                    {a.label} · {a.site}
                    {a.city && a.city !== a.site ? ` · ${a.city}` : ''}
                  </span>
                </span>
                <time className="when" dateTime={a.at || undefined}>
                  {formatWhen(a.at)}
                </time>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
