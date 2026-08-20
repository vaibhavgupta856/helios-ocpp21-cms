import { useMemo, useState } from 'react';
import PageHeader from '../components/PageHeader.jsx';
import { pretty } from '../api.js';

export default function Trace({ messages, stations }) {
  const [stationId, setStationId] = useState('');
  const [type, setType] = useState('All');
  const filtered = useMemo(() => {
    return messages.filter((m) => {
      if (stationId && m.stationId !== stationId) return false;
      if (type !== 'All' && m.type !== type) return false;
      return true;
    });
  }, [messages, stationId, type]);

  return (
    <>
      <PageHeader title="Live Trace" subtitle="CALL / CALLRESULT / CALLERROR stream between CSMS and charging stations" tour="trace-page" />
      <div className="card">
        <div className="form-row">
          <label className="field">
            Station
            <select value={stationId} onChange={(e) => setStationId(e.target.value)}>
              <option value="">All stations</option>
              {stations.map((s) => (
                <option key={s.stationId} value={s.stationId}>
                  {s.stationId}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            Type
            <select value={type} onChange={(e) => setType(e.target.value)}>
              <option>All</option>
              <option>CALL</option>
              <option>CALLRESULT</option>
              <option>CALLERROR</option>
            </select>
          </label>
          <span className="muted">{filtered.length} frames</span>
        </div>
      </div>
      <div className="trace-list">
        {filtered.length === 0 ? (
          <p className="empty">No frames yet. Connect a charge point or send a CSMS CALL.</p>
        ) : (
          filtered.map((m) => (
            <div className="trace-row" key={m.id}>
              <div className="meta">
                <span>{m.at ? new Date(m.at).toLocaleTimeString() : ''}</span>
                <span className={String(m.direction || '').includes('csms→') ? 'dir-out' : 'dir-in'}>
                  {m.direction}
                </span>
                <strong>{m.type}</strong>
                <span>{m.action}</span>
                <span>{m.stationId}</span>
                <span>{m.messageId}</span>
                {m.simulated ? <span>sim</span> : null}
                {m.queued ? <span>queued</span> : null}
                {m.orphan ? <span>orphan</span> : null}
              </div>
              <pre className="payload mono">{pretty(m.payload)}</pre>
            </div>
          ))
        )}
      </div>
    </>
  );
}
