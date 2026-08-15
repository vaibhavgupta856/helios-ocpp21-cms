import { useCallback, useEffect, useMemo, useState } from 'react';
import PageHeader from '../components/PageHeader.jsx';
import StatusBadge from '../components/StatusBadge.jsx';
import ActionQueue from '../components/ActionQueue.jsx';
import { api, pretty, tokenLabel } from '../api.js';
import { buildOrgTree } from '../org.js';
import { isWalkHit } from '../agentWalk.js';

export default function Dashboard({
  stations,
  tenants = [],
  sites = [],
  transactions,
  messages,
  tokens,
  simulate,
  navigate,
  can = () => false,
  walkFocus = null,
}) {
  const online = stations.filter((s) => s.online).length;
  const live = transactions.filter((t) => t.status && t.status !== 'Ended');
  const evses = stations.flatMap((s) => s.evses || []);
  const [query, setQuery] = useState('');
  const tree = useMemo(
    () => buildOrgTree({ tenants, sites, stations, query }),
    [tenants, sites, stations, query]
  );
  const [insights, setInsights] = useState(null);
  const [queued, setQueued] = useState([]);
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState('');

  const loadInsights = useCallback(async () => {
    try {
      const [ins, acts] = await Promise.all([api('/api/insights'), api('/api/actions')]);
      setInsights(ins);
      setQueued((acts.actions || []).filter((a) => a.status === 'proposed'));
    } catch (e) {
      setErr(e.message);
    }
  }, []);

  useEffect(() => {
    loadInsights();
  }, [loadInsights, stations, transactions]);

  const queueRec = async (rec) => {
    setBusy(rec.label);
    setErr('');
    try {
      await api('/api/actions', { method: 'POST', body: JSON.stringify(rec) });
      await loadInsights();
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy('');
    }
  };

  const lost = insights?.lostRevenue;
  const delta = insights?.delta;

  return (
    <>
      <PageHeader
        title="Dashboard"
        subtitle="This is the CSMS (central system). Charge points boot in on OCPP 2.1. Voltforge is a separate EVSE lab."
        actions={
          <>
            {can('org.simulate') ? (
              <button type="button" className="btn" onClick={simulate}>
                Simulate station
              </button>
            ) : null}
            <button type="button" className="btn primary" onClick={() => navigate('stations')}>
              Open stations
            </button>
          </>
        }
      />
      <div className="card advisor-card" data-tour="dash-advisor">
        <h3>Advisor</h3>
        {insights ? (
          <>
          <p className="advisor-headline">{insights.headline}</p>
          <p className="muted">{insights.reason}</p>
          <div className="advisor-kpis">
            {delta ? (
              <span>
                Revenue vs last window:{' '}
                <strong>
                  {delta.revenuePct > 0 ? '+' : ''}
                  {delta.revenuePct}%
                </strong>
              </span>
            ) : null}
            {lost ? (
              <span>
                Estimated outage loss:{' '}
                <strong>
                  {lost.currency} {Number(lost.total || 0).toFixed(2)}
                </strong>
              </span>
            ) : null}
          </div>
          {err ? <p className="error">{err}</p> : null}
          {insights.recommendations?.length && can('actions.propose') ? (
            <div className="ops advisor-ops">
              {insights.recommendations.map((rec) => (
                <button
                  type="button"
                  className="btn"
                  key={`${rec.kind}-${rec.stationId}-${rec.label}`}
                  disabled={!!busy}
                  onClick={() => queueRec(rec)}
                >
                  {busy === rec.label ? 'Queuing…' : rec.label}
                </button>
              ))}
            </div>
          ) : null}
          <ActionQueue actions={queued} onDone={loadInsights} canApprove={can('actions.approve')} />
          </>
        ) : (
          <p className="muted">Reading live KPIs…</p>
        )}
      </div>
      <div className={`stat-grid ${walkFocus ? 'walk-reading' : ''}`} data-tour="dash-stats">
        <div className="stat-card">
          <div className="k">Tenants</div>
          <div className="v">{tenants.length}</div>
        </div>
        <div className="stat-card">
          <div className="k">Stations</div>
          <div className="v">{sites.length}</div>
        </div>
        <div className="stat-card tone-info">
          <div className="k">Charge points</div>
          <div className="v">{stations.length}</div>
        </div>
        <div className="stat-card tone-ok">
          <div className="k">Online</div>
          <div className="v">{online}</div>
        </div>
        <div className="stat-card tone-charge">
          <div className="k">Live sessions</div>
          <div className="v">{live.length}</div>
        </div>
        <div className="stat-card tone-info">
          <div className="k">EVSE connectors</div>
          <div className="v">{evses.length}</div>
        </div>
        <div className="stat-card">
          <div className="k">Auth tokens</div>
          <div className="v">{tokens.length}</div>
        </div>
      </div>
      <div className="grid-2">
        <div className="card" data-tour="dash-cps">
          <h3>Charge points</h3>
          <label className="field search-field">
            Search
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Tenant, station, or charge point"
            />
          </label>
          {tree.length === 0 ? (
            <p className="empty">{query ? 'No matches.' : 'No charge points yet. Connect a 2.1 CP or simulate one.'}</p>
          ) : (
            <table className="data">
              <thead>
                <tr>
                  <th>Tenant</th>
                  <th>Station</th>
                  <th>Charge point</th>
                  <th>Link</th>
                  <th>Model</th>
                </tr>
              </thead>
              <tbody>
                {tree.flatMap((tenant) =>
                  tenant.stations.flatMap((site) =>
                    (site.chargePoints.length ? site.chargePoints : [null]).map((s, i) => (
                      <tr
                        key={s?.stationId || `${site.id}-empty-${i}`}
                        className={
                          isWalkHit(walkFocus, 'cp', { id: s?.stationId }) ||
                          isWalkHit(walkFocus, 'site', { id: site.id, name: site.name }) ||
                          isWalkHit(walkFocus, 'tenant', { id: tenant.id, name: tenant.name })
                            ? 'walk-pulse'
                            : ''
                        }
                      >
                        <td>{tenant.name}</td>
                        <td>
                          {site.name}
                          {site.city ? <span className="muted"> · {site.city}</span> : null}
                        </td>
                        <td>{s?.stationId || '—'}</td>
                        <td>{s ? <StatusBadge online={s.online} /> : <span className="muted">empty</span>}</td>
                        <td>{s?.identity?.model || s?.identity?.vendorName || '—'}</td>
                      </tr>
                    ))
                  )
                )}
              </tbody>
            </table>
          )}
        </div>
        <div className="card" data-tour="dash-live">
          <h3>Live sessions</h3>
          {live.length === 0 ? (
            <p className="empty">No active transactions.</p>
          ) : (
            <table className="data">
              <thead>
                <tr>
                  <th>Tx</th>
                  <th>Station</th>
                  <th>Token</th>
                  <th>kWh</th>
                </tr>
              </thead>
              <tbody>
                {live.slice(0, 8).map((t) => (
                  <tr key={t.transactionId}>
                    <td>{t.transactionId}</td>
                    <td>{t.stationId}</td>
                    <td>{tokenLabel(t.idToken)}</td>
                    <td>{t.kwh || 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
      <div className="card" data-tour="dash-trace">
        <h3>Recent messages</h3>
        {messages.length === 0 ? (
          <p className="empty">Message trace is empty.</p>
        ) : (
          <div className="trace-list">
            {messages.slice(0, 8).map((m) => (
              <div className="trace-row" key={m.id}>
                <div className="meta">
                  <span>{m.at ? new Date(m.at).toLocaleTimeString() : ''}</span>
                  <span className={m.direction?.includes('csms→') ? 'dir-out' : 'dir-in'}>{m.direction}</span>
                  <strong>{m.type}</strong>
                  <span>{m.action}</span>
                  <span>{m.stationId}</span>
                </div>
                <pre className="payload mono">{pretty(m.payload)}</pre>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
