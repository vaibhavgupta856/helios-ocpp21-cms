import { useEffect, useState } from 'react';
import PageHeader from '../components/PageHeader.jsx';
import StationPicker from '../components/StationPicker.jsx';
import WssPairingCard from '../components/WssPairingCard.jsx';
import { api, pretty } from '../api.js';

const DEMO_CERT = '-----BEGIN CERTIFICATE-----\nDEMO\n-----END CERTIFICATE-----';

export default function Security({
  stations,
  selected,
  selectedStationId,
  setSelectedStationId,
  callStation,
  certificates,
  securityEvents,
  security,
  refresh,
  setNotice,
  setError,
  can = () => false,
}) {
  const [profile, setProfile] = useState(0);
  const [basicUser, setBasicUser] = useState('');
  const [basicPass, setBasicPass] = useState('');
  const [requireWss, setRequireWss] = useState(false);

  useEffect(() => {
    if (!security) return;
    setProfile(security.profile ?? 0);
    setBasicUser(security.basicUser || '');
    setRequireWss(!!security.requireWss);
  }, [security]);

  const save = async (e) => {
    e.preventDefault();
    if (!can('security.write')) return;
    try {
      await api('/api/security', {
        method: 'PUT',
        body: JSON.stringify({
          profile: Number(profile),
          basicUser,
          basicPass,
          requireWss,
        }),
      });
      setNotice('Security profile saved. New WebSocket handshakes use it immediately.');
      refresh();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <>
      <PageHeader
        title="Security & Certificates"
        subtitle="WSS profiles 0–2, lab CA download, and OCPP certificate operations"
      />
      <WssPairingCard security={security} stationId={selected?.stationId} tour="security-wss" />
      <div className="card" data-tour="security-page">
        <h3>CSMS security profile</h3>
        <p className="muted">
          Profile 0: TLS only (or plaintext WS on :9090 locally). Profile 1: HTTP Basic over WSS. Profile 2: mTLS
          client certificate signed by the lab CA — <strong>local port 9443 only</strong>. Hosted (Render) uses
          Profile 0 or 1: the public HTTPS port already provides TLS. Plain WS stays open locally unless “Require
          WSS” is on; on Render, reverse-proxy TLS counts as WSS.
        </p>
        <form onSubmit={save}>
          <div className="form-row">
            <label className="field">
              Profile
              <select value={profile} onChange={(e) => setProfile(e.target.value)}>
                <option value={0}>0 — WSS / lab (no extra auth)</option>
                <option value={1}>1 — WSS + Basic Auth</option>
                <option value={2}>2 — WSS + mTLS client cert</option>
              </select>
            </label>
            <label className="field">
              Basic user
              <input value={basicUser} onChange={(e) => setBasicUser(e.target.value)} autoComplete="off" />
            </label>
            <label className="field">
              Basic password
              <input
                type="password"
                value={basicPass}
                onChange={(e) => setBasicPass(e.target.value)}
                autoComplete="off"
                placeholder={security?.basicConfigured ? 'unchanged unless set' : ''}
              />
            </label>
          </div>
          <label className="field" style={{ flexDirection: 'row', alignItems: 'center', gap: '0.5rem' }}>
            <input type="checkbox" checked={requireWss} onChange={(e) => setRequireWss(e.target.checked)} />
            Require WSS (reject ws:// OCPP)
          </label>
          {can('security.write') ? (
          <button className="btn primary" type="submit" style={{ marginTop: '0.75rem' }}>
            Save profile
          </button>
          ) : (
            <p className="muted" style={{ marginTop: '0.75rem' }}>
              Only admin and super admin can change the CSMS security profile.
            </p>
          )}
        </form>
          {security ? (
          <p className="muted" style={{ marginTop: '0.75rem' }}>
            WS {security.ws} · WSS {security.wss}
            {security.cloud || security.tlsTerminated
              ? ' · Hosted TLS is terminated at the proxy; OCPP upgrades on this HTTP port are treated as WSS.'
              : ''}
          </p>
        ) : null}
      </div>
      <div className="card" data-tour="security-certs">
        <h3>Lab certificates</h3>
        <p className="muted">Self-signed CA + server + client material for local WSS. Trust the CA on real CPs; Voltforge can skip verification with Trust lab TLS. Profile 2 mTLS is for local port 9443, not a hosted HTTPS URL.</p>
        <div className="ops">
          <a className="btn" href="/api/security/certs/ca.pem">
            Download CA
          </a>
          <a className="btn" href="/api/security/certs/server.pem">
            Download server cert
          </a>
          <a className="btn primary" href="/api/security/certs/client.pem">
            Download client cert
          </a>
          <a className="btn" href="/api/security/certs/client-key.pem">
            Download client key
          </a>
        </div>
      </div>
      <div className="card" data-tour="security-ops">
        <div className="form-row">
          <StationPicker stations={stations} value={selectedStationId} onChange={setSelectedStationId} />
        </div>
        <div className="ops">
          <button
            type="button"
            className="btn primary"
            onClick={() =>
              callStation('InstallCertificate', { certificateType: 'CSMSRootCertificate', certificate: DEMO_CERT })
            }
          >
            InstallCertificate
          </button>
          <button
            type="button"
            className="btn"
            onClick={() => callStation('CertificateSigned', { certificateChain: DEMO_CERT })}
          >
            CertificateSigned
          </button>
          <button
            type="button"
            className="btn"
            onClick={() => callStation('GetInstalledCertificateIds', { certificateType: 'CSMSRootCertificate' })}
          >
            GetInstalledCertificateIds
          </button>
          <button
            type="button"
            className="btn"
            onClick={() =>
              callStation('DeleteCertificate', {
                certificateHashData: {
                  hashAlgorithm: 'SHA256',
                  issuerNameHash: 'aa',
                  issuerKeyHash: 'bb',
                  serialNumber: '1',
                },
              })
            }
          >
            DeleteCertificate
          </button>
        </div>
      </div>
      <div className="card">
        <h3>Installed certificate IDs (selected station)</h3>
        <p className="muted">
          Profile 2 accepts client certs signed by the lab CA, plus extra CAs in <code>certs/trust/*.pem</code>. WSS
          handshakes record the peer fingerprint here.
        </p>
        {(selected?.installedCertificates || []).length === 0 ? (
          <p className="empty">No installed certificate IDs yet. Use GetInstalledCertificateIds or connect with mTLS.</p>
        ) : (
          <table className="data">
            <thead>
              <tr>
                <th>Type</th>
                <th>Serial / fingerprint</th>
                <th>When</th>
              </tr>
            </thead>
            <tbody>
              {selected.installedCertificates.map((c, i) => (
                <tr key={c.fingerprint256 || c.serialNumber || i}>
                  <td>{c.certificateType || c.type || '—'}</td>
                  <td className="muted">
                    {c.fingerprint256 ||
                      c.serialNumber ||
                      c.certificateHashData?.serialNumber ||
                      pretty(c).slice(0, 120)}
                  </td>
                  <td className="muted">{c.at ? new Date(c.at).toLocaleString() : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <div className="grid-2">
        <div className="card">
          <h3>Certificate operations</h3>
          {certificates.length === 0 ? (
            <p className="empty">No certificate operations yet.</p>
          ) : (
            certificates.map((c) => (
              <div key={c.id}>
                <strong>
                  {c.action} · {c.stationId}
                </strong>
                <pre className="payload mono">{pretty(c.payload)}</pre>
              </div>
            ))
          )}
        </div>
        <div className="card">
          <h3>Security events</h3>
          {(securityEvents.length ? securityEvents : selected?.securityEvents || []).length === 0 ? (
            <p className="empty">No SecurityEventNotification messages.</p>
          ) : (
            (securityEvents.length ? securityEvents : selected.securityEvents).map((e, i) => (
              <pre className="payload mono" key={i}>
                {pretty(e)}
              </pre>
            ))
          )}
        </div>
      </div>
    </>
  );
}
