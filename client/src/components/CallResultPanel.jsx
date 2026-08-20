import { pretty } from '../api.js';

/**
 * Shows the last OCPP CALL / CALLRESULT next to the controls that sent it.
 */
export default function CallResultPanel({ result, onClear }) {
  if (!result) return null;

  const ok = !result.error;
  const status =
    result.error ||
    result.result?.status ||
    (result.result && Object.keys(result.result).length === 0 ? 'OK (empty)' : null) ||
    'Received';

  return (
    <div className={`call-result-panel ${ok ? 'ok' : 'err'}`} role="status">
      <div className="call-result-head">
        <div>
          <strong>{result.action || 'CALL'}</strong>
          {result.stationId ? <span className="muted"> · {result.stationId}</span> : null}
          <span className={`call-result-status ${ok ? 'ok' : 'err'}`}>{String(status)}</span>
        </div>
        {onClear ? (
          <button type="button" className="btn" onClick={onClear} style={{ padding: '0.25rem 0.55rem', fontSize: '0.8rem' }}>
            Clear
          </button>
        ) : null}
      </div>
      {result.error ? (
        <p className="call-result-error">{result.error}</p>
      ) : (
        <div className="call-result-grid">
          <div>
            <div className="call-result-label">Request (CALL)</div>
            <pre className="payload mono">{pretty(result.payload ?? {})}</pre>
          </div>
          <div>
            <div className="call-result-label">Response (CALLRESULT)</div>
            <pre className="payload mono">{pretty(result.result ?? {})}</pre>
          </div>
        </div>
      )}
    </div>
  );
}
