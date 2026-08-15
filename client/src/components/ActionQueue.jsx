import { useState } from 'react';
import { api } from '../api.js';

export default function ActionQueue({ actions, onDone, empty = null, canApprove = true }) {
  const [busyId, setBusyId] = useState('');
  const [err, setErr] = useState('');

  const run = async (id, verb) => {
    setBusyId(id);
    setErr('');
    try {
      await api(`/api/actions/${encodeURIComponent(id)}/${verb}`, { method: 'POST' });
      onDone?.();
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusyId('');
    }
  };

  if (!actions?.length) return empty;

  return (
    <div className="action-queue">
      {err ? <p className="error">{err}</p> : null}
      {actions.map((a) => (
        <div className={`action-card ${a.status}`} key={a.id}>
          <div>
            <strong>{a.label}</strong>
            {a.reason ? <p className="muted">{a.reason}</p> : null}
            <div className="action-meta">
              <span className={`badge ${a.status}`}>{a.status}</span>
              {a.ocppAction ? (
                <span className="muted">
                  {a.ocppAction}
                  {a.stationId ? ` → ${a.stationId}` : ''}
                </span>
              ) : (
                <span className="muted">ops note{a.stationId ? ` · ${a.stationId}` : ''}</span>
              )}
            </div>
            {a.error ? <p className="error">{a.error}</p> : null}
          </div>
          {a.status === 'proposed' && canApprove ? (
            <div className="ops">
              <button
                type="button"
                className="btn primary"
                disabled={!!busyId}
                onClick={() => run(a.id, 'approve')}
              >
                {busyId === a.id ? 'Sending…' : 'Approve'}
              </button>
              <button type="button" className="btn" disabled={!!busyId} onClick={() => run(a.id, 'reject')}>
                Dismiss
              </button>
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}
