import { useCallback, useEffect, useState } from 'react';
import PageHeader from '../components/PageHeader.jsx';
import { api } from '../api.js';

export default function Sites({ navigate, can = () => false, walkFocus = null }) {
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    try {
      setData(await api('/api/sites/recommend'));
    } catch (e) {
      setErr(e.message);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const save = async (c) => {
    setBusy(c.id);
    setErr('');
    setNotice('');
    try {
      const result = await api('/api/sites/recommend', {
        method: 'POST',
        body: JSON.stringify({ id: c.id, city: c.city }),
      });
      setData(result);
      setNotice(
        `Saved ${c.city} as a candidate. Enroll a new charge point ID on Stations when you are ready to commission — this does not create a CP.`
      );
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy('');
    }
  };

  const savedIds = new Set((data?.saved || []).map((s) => s.id));

  return (
    <>
      <PageHeader
        title="Site planner"
        subtitle="Recommend the next charging station from utilization, mock EV density, traffic, and competitors"
        tour="sites-page"
        actions={
          <button type="button" className="btn" onClick={() => navigate('stations')}>
            Enroll on Stations
          </button>
        }
      />
      {err ? <p className="error">{err}</p> : null}
      {notice ? <p className="ok-msg">{notice}</p> : null}
      <p className="muted">{data?.note}</p>
      {data?.kpis ? (
        <div className="stat-grid">
          <div className="stat-card">
            <div className="k">Network utilization</div>
            <div className="v">{data.kpis.utilizationPct}%</div>
          </div>
          <div className="stat-card">
            <div className="k">Yield / kWh</div>
            <div className="v">
              {data.kpis.currency} {data.kpis.yieldPerKwh}
            </div>
          </div>
        </div>
      ) : null}
      <div className="site-grid" data-tour="sites-grid">
        {(data?.candidates || []).map((c) => (
          <div className={`card site-card ${savedIds.has(c.id) ? 'saved' : ''}`} key={c.id}>
            <h3>
              {c.city}
              {savedIds.has(c.id) ? <span className="badge Accepted">Candidate saved</span> : null}
            </h3>
            <p className="muted">
              {c.lat.toFixed(3)}, {c.lng.toFixed(3)} · catchment {c.catchment.toLocaleString()} · {c.existingMassive}{' '}
              Helios site(s) nearby
            </p>
            <div className="stat-grid site-stats">
              <div>
                <div className="k">Daily sessions</div>
                <div className="v">{c.expectedDailySessions}</div>
              </div>
              <div>
                <div className="k">Daily revenue</div>
                <div className="v">
                  {c.currency} {c.expectedDailyRevenue}
                </div>
              </div>
              <div>
                <div className="k">Utilization</div>
                <div className="v">{c.utilizationForecastPct}%</div>
              </div>
              <div>
                <div className="k">Payback</div>
                <div className="v">{c.paybackMonths} mo</div>
              </div>
            </div>
            <p>
              <strong>Risk:</strong> {c.risk}
            </p>
            <p className="muted">
              EV density {c.evDensity} · traffic {c.traffic} · competitors{' '}
              {c.competitors.map((x) => `${x.name} ${x.km} km`).join(', ')}
            </p>
            {can('sites.recommend') ? (
            <div className="ops">
              <button type="button" className="btn primary" disabled={!!busy} onClick={() => save(c)}>
                {busy === c.id ? 'Saving…' : savedIds.has(c.id) ? 'Save again' : 'Recommend this site'}
              </button>
            </div>
            ) : null}
          </div>
        ))}
      </div>
      {(data?.saved || []).length ? (
        <div className={`card ${walkFocus ? 'walk-reading' : ''}`}>
          <h3>Saved candidates</h3>
          <table className="data">
            <thead>
              <tr>
                <th>City</th>
                <th>Sessions / day</th>
                <th>Revenue / day</th>
                <th>Payback</th>
                <th>Saved</th>
              </tr>
            </thead>
            <tbody>
              {data.saved.map((s) => (
                <tr key={`${s.id}-${s.savedAt}`}>
                  <td>{s.city}</td>
                  <td>{s.expectedDailySessions}</td>
                  <td>
                    {s.currency} {s.expectedDailyRevenue}
                  </td>
                  <td>{s.paybackMonths} mo</td>
                  <td className="muted">{s.savedAt ? new Date(s.savedAt).toLocaleString() : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </>
  );
}
