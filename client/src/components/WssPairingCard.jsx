import { useState } from 'react';

const LAB_WSS = 'wss://127.0.0.1:9443/ocpp/2.1';
const LAB_WS = 'ws://127.0.0.1:9090/ocpp/2.1';
const EXAMPLE_ID = 'VF-CP-21';

export function CopyField({ label, value }) {
  const [copied, setCopied] = useState(false);
  if (!value) return null;
  return (
    <label className="field" style={{ minWidth: '100%' }}>
      {label}
      <div className="form-row" style={{ marginBottom: 0 }}>
        <input readOnly value={value} onFocus={(e) => e.target.select()} />
        <button
          type="button"
          className="btn"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(value);
              setCopied(true);
              setTimeout(() => setCopied(false), 1200);
            } catch {
              /* ignore */
            }
          }}
        >
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
    </label>
  );
}

export default function WssPairingCard({ security, stationId, tour = 'stations-wss' }) {
  const wssBase = String(security?.wssBase || LAB_WSS).replace(/\/+$/, '');
  const exampleId = String(stationId || EXAMPLE_ID).trim() || EXAMPLE_ID;
  const exampleUrl = `${wssBase}/${encodeURIComponent(exampleId)}`;
  const cloud = !!security?.cloud;
  const subprotocol = security?.subprotocol || 'ocpp2.1';

  return (
    <div className="card pairing-card" data-tour={tour}>
      <div className="pairing-card-head">
        <h3>Charge point WebSocket (OCPP 2.1)</h3>
        <span className="badge pairing-proto">{subprotocol}</span>
      </div>
      <p className="pairing-lead">
        Charge points (Voltforge) connect <strong>outbound</strong>. Paste the <strong>base</strong> into
        Voltforge, not the full path.
      </p>
      {cloud ? (
        <p className="muted pairing-host">Hosted: public HTTPS (no :9443).</p>
      ) : (
        <p className="muted pairing-host">
          Local lab WSS <code>{LAB_WSS}</code>
        </p>
      )}
      <CopyField label="WSS base" value={wssBase} />
      <CopyField label="Example full URL" value={exampleUrl} />
      <CopyField label="Subprotocol" value={subprotocol} />
      {!cloud ? <CopyField label="Plain WS base (local lab only)" value={security?.wsBase || LAB_WS} /> : null}
    </div>
  );
}
