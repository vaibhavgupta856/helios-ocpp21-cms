import { useCallback, useEffect, useMemo, useState } from 'react';
import PageHeader from '../components/PageHeader.jsx';
import ActionQueue from '../components/ActionQueue.jsx';
import { api } from '../api.js';

function rangeText(lo, hi, suffix = '') {
  const a = Math.round(Number(lo) || 0);
  const b = Math.round(Number(hi) || 0);
  if (a <= 0 && b <= 0) return `~0${suffix}`;
  if (a === b) return `~${a}${suffix}`;
  return `~${Math.min(a, b)}–${Math.max(a, b)}${suffix}`;
}

function peakLabel(site) {
  const w = site?.peakWindow;
  if (w && w.startHour !== w.endHour) {
    return `${w.dayLabel} around ${String(w.startHour).padStart(2, '0')}:00–${String(w.endHour).padStart(2, '0')}:00`;
  }
  if (site?.peak) {
    return `${site.peak.dayLabel} around ${String(site.peak.hour).padStart(2, '0')}:00`;
  }
  return '—';
}

export default function Demand({ can = () => false }) {
  const [data, setData] = useState(null);
  const [queued, setQueued] = useState([]);
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState('');
  const [siteId, setSiteId] = useState('');

  const load = useCallback(async () => {
    try {
      const [forecast, acts] = await Promise.all([api('/api/forecast'), api('/api/actions')]);
      setData(forecast);
      setQueued((acts.actions || []).filter((a) => a.status === 'proposed'));
      setSiteId((prev) => {
        const list = forecast.stations || [];
        if (prev && list.some((s) => s.id === prev)) return prev;
        const hottest = [...list].sort((a, b) => b.kwh3d - a.kwh3d)[0];
        return hottest?.id || list[0]?.id || '';
      });
    } catch (e) {
      setErr(e.message);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const queue = async (rec) => {
    setBusy(rec.label);
    setErr('');
    try {
      await api('/api/actions', { method: 'POST', body: JSON.stringify(rec) });
      await load();
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy('');
    }
  };

  const stations = data?.stations || [];
  const selected = useMemo(
    () => stations.find((s) => s.id === siteId) || stations[0] || null,
    [stations, siteId]
  );
  const weather = selected?.weather || data?.weather;
  const hours = selected?.hours || [];
  const days = selected?.days || [];
  const maxKwh = Math.max(1, ...hours.map((h) => h.kwh));
  const maxSiteKwh = Math.max(1, ...stations.map((s) => s.kwh3d || 0));
  let lastDay = '';

  return (
    <>
      <PageHeader
        title="Demand"
        subtitle="3-day estimate per station — ranges, not exact future sessions"
        tour="demand-page"
      />
      {err ? <p className="error">{err}</p> : null}
      {weather ? (
        <div className="stat-grid">
          <div className="stat-card">
            <div className="k">Stations</div>
            <div className="v">{stations.length}</div>
          </div>
          <div className="stat-card">
            <div className="k">{selected ? selected.name : 'Now (lab)'}</div>
            <div className="v">{weather.condition}</div>
          </div>
          <div className="stat-card">
            <div className="k">Temp</div>
            <div className="v">{weather.tempC}°C</div>
          </div>
          <div className="stat-card">
            <div className="k">Likely peak window</div>
            <div className="v">{selected ? peakLabel(selected) : '—'}</div>
          </div>
        </div>
      ) : null}
      <p className="muted">{data?.note}</p>
      {stations.length ? (
        <div className="forecast-station-grid" data-tour="demand-stations">
          {stations.map((s) => (
            <button
              type="button"
              key={s.id}
              className={`card forecast-station-card ${s.id === selected?.id ? 'selected' : ''}`}
              onClick={() => setSiteId(s.id)}
            >
              <h3>
                {s.name}
                <span className="badge Pending">{s.city || '—'}</span>
              </h3>
              <p className="muted">
                {s.tenant ? `${s.tenant} · ` : ''}
                {s.mix.replace('-', ' ')} · {s.chargePointCount} CP
              </p>
              <p>
                <strong>{rangeText(s.kwh3dLow ?? s.kwh3d, s.kwh3dHigh ?? s.kwh3d, ' kWh')}</strong>
                {' / 3 days · '}
                {peakLabel(s)}
              </p>
              <p className="muted">
                Likely {s.weather?.condition} · ~{Math.round(s.weather?.tempC ?? 0)}°C
                {s.weather?.rain ? ' · rain' : ''}
              </p>
              <div className="forecast-spark" aria-hidden="true">
                {(s.days || []).map((d) => (
                  <span
                    key={d.date}
                    title={`${d.label}: ${d.kwh} kWh`}
                    style={{ height: `${Math.max(12, Math.round((d.kwh / maxSiteKwh) * 100))}%` }}
                  />
                ))}
              </div>
            </button>
          ))}
        </div>
      ) : null}
      {days.length ? (
        <div className="day-grid">
          {days.map((d) => (
            <div className={`card day-card ${d.holiday ? 'holiday' : ''} ${d.weekend ? 'weekend' : ''}`} key={d.date}>
              <h3>
                {d.label}
                {d.holiday ? <span className="badge proposed">Holiday</span> : null}
                {d.weekend && !d.holiday ? <span className="badge Pending">Weekend</span> : null}
              </h3>
              <p className="muted">Likely {d.weather}</p>
              <p>
                {rangeText(d.sessionsLow ?? d.sessions, d.sessionsHigh ?? d.sessions, ' sessions')} ·{' '}
                {rangeText(d.kwhLow ?? d.kwh, d.kwhHigh ?? d.kwh, ' kWh')}
              </p>
              <p>
                Peak around <strong>{String(d.peak.hour).padStart(2, '0')}:00</strong> · quiet around{' '}
                <strong>{String(d.low.hour).padStart(2, '0')}:00</strong>
              </p>
            </div>
          ))}
        </div>
      ) : null}
      {(selected?.chargePoints || []).length > 1 ? (
        <div className="card">
          <h3>Charge points at {selected.name}</h3>
          <p className="muted">Same station — still an estimate per CP, shown as a range.</p>
          <table className="data">
            <thead>
              <tr>
                <th>Charge point</th>
                <th>Status</th>
                <th>3-day kWh (est.)</th>
                <th>Sessions (est.)</th>
                <th>Likely peak</th>
              </tr>
            </thead>
            <tbody>
              {selected.chargePoints.map((cp) => (
                <tr key={cp.stationId}>
                  <td>{cp.stationId}</td>
                  <td>{cp.online ? 'Online' : cp.simulated ? 'Simulated' : 'Offline'}</td>
                  <td>{rangeText(cp.kwhLow ?? cp.kwh, cp.kwhHigh ?? cp.kwh)}</td>
                  <td>{rangeText(cp.sessionsLow ?? cp.sessions, cp.sessionsHigh ?? cp.sessions)}</td>
                  <td>
                    {cp.peak
                      ? `${cp.peak.dayLabel || ''} around ${String(cp.peak.startHour ?? cp.peak.hour).padStart(2, '0')}:00`
                      : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      {(selected?.briefing || []).length ? (
        <div className="card">
          <h3>CPO arrangement — {selected.name}</h3>
          <ul className="briefing-list">
            {selected.briefing.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
      ) : null}
      <div className="card" data-tour="demand-hourly">
        <h3>Hourly estimate — {selected ? selected.name : '72 hours'}</h3>
        {hours.length === 0 ? (
          <p className="empty">No forecast yet.</p>
        ) : (
          <table className="data">
            <thead>
              <tr>
                <th>When</th>
                <th>Likely weather</th>
                <th>Sessions (est.)</th>
                <th>kWh (est.)</th>
                <th>Load</th>
              </tr>
            </thead>
            <tbody>
              {hours.map((h) => {
                const showDay = h.dayKey !== lastDay;
                lastDay = h.dayKey;
                const isPeak =
                  h.hour === selected?.peak?.hour && h.dayKey === selected?.peak?.dayKey;
                return (
                  <tr key={h.at} className={isPeak ? 'peak-row' : ''}>
                    <td>
                      {showDay ? <strong>{h.dayLabel} </strong> : null}
                      {String(h.hour).padStart(2, '0')}:00
                      {h.confidencePct ? (
                        <span className="muted"> · {h.confidencePct}%</span>
                      ) : null}
                    </td>
                    <td>
                      Likely {h.weather} · ~{Math.round(h.tempC)}°C
                      {h.holiday ? ' · holiday' : h.weekend ? ' · weekend' : ''}
                    </td>
                    <td>{rangeText(h.sessionsLow ?? h.sessions, h.sessionsHigh ?? h.sessions)}</td>
                    <td>{rangeText(h.kwhLow ?? h.kwh, h.kwhHigh ?? h.kwh)}</td>
                    <td>
                      <div
                        className="demand-bar"
                        title={rangeText(h.kwhLow ?? h.kwh, h.kwhHigh ?? h.kwh, ' kWh')}
                      >
                        <span style={{ width: `${Math.round((h.kwh / maxKwh) * 100)}%` }} />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
      <div className="card">
        <h3>Proposed ops — {selected ? selected.name : 'station'}</h3>
        <p className="muted">
          Maintenance, peak power cap, and ReserveNow target this station’s own low/peak windows — not the fleet average.
        </p>
        <div className="ops">
          {can('actions.propose') ? (
            (selected?.proposals || []).length === 0 ? (
            <p className="empty">Enroll or simulate a charge point at this station so maintenance and ReserveNow can target it.</p>
          ) : (
            (selected?.proposals || []).map((p) => (
              <button
                type="button"
                className="btn"
                key={p.label}
                disabled={!!busy}
                onClick={() => queue(p)}
              >
                {busy === p.label ? 'Queuing…' : p.label}
              </button>
            ))
          )
          ) : (
            <p className="muted">Your role can view the forecast. An admin or user queues the actions.</p>
          )}
        </div>
        <ActionQueue actions={queued} onDone={load} canApprove={can('actions.approve')} />
      </div>
    </>
  );
}
