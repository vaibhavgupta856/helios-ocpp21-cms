import { useState } from 'react';
import { api } from '../api.js';
import PageHeader from '../components/PageHeader.jsx';
import StatusBadge from '../components/StatusBadge.jsx';
import { isWalkHit } from '../agentWalk.js';

export default function Tokens({ tokens, selected, callStation, refresh, setError, setNotice, can = () => false, walkFocus = null }) {
  const [idToken, setIdToken] = useState('');
  const [type, setType] = useState('ISO14443');
  const [status, setStatus] = useState('Accepted');

  const add = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await api('/api/tokens', {
        method: 'POST',
        body: JSON.stringify({ idToken, type, status }),
      });
      setIdToken('');
      setNotice('Token saved');
      refresh();
    } catch (err) {
      setError(err.message);
    }
  };

  const sendLocalList = async () => {
    await callStation('SendLocalList', {
      versionNumber: (selected?.localListVersion || 0) + 1,
      updateType: 'Full',
      localAuthorizationList: tokens.map((t) => ({
        idToken: { idToken: t.idToken, type: t.type },
        idTokenInfo: { status: t.status },
      })),
    });
  };

  return (
    <>
      <PageHeader
        title="Authorization / Tokens"
        subtitle="Local authorization list used by Authorize. Accepted, Blocked, or Invalid."
        tour="tokens-page"
        actions={
          can('ocpp.call') ? (
          <>
            <button type="button" className="btn" onClick={() => callStation('ClearCache', {})} disabled={!selected}>
              ClearCache
            </button>
            <button type="button" className="btn" onClick={sendLocalList} disabled={!selected}>
              SendLocalList
            </button>
          </>
          ) : null
        }
      />
      {can('tokens.write') ? (
      <div className="card">
        <h3>Add token</h3>
        <form className="form-row" onSubmit={add}>
          <label className="field">
            Id token
            <input value={idToken} onChange={(e) => setIdToken(e.target.value)} required />
          </label>
          <label className="field">
            Type
            <select value={type} onChange={(e) => setType(e.target.value)}>
              <option>ISO14443</option>
              <option>ISO15693</option>
              <option>eMAID</option>
              <option>Central</option>
              <option>NoAuthorization</option>
            </select>
          </label>
          <label className="field">
            Status
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option>Accepted</option>
              <option>Blocked</option>
              <option>Expired</option>
              <option>Invalid</option>
              <option>NoCredit</option>
            </select>
          </label>
          <button type="submit" className="btn primary">
            Save
          </button>
        </form>
      </div>
      ) : null}
      <div className={`card ${walkFocus ? 'walk-reading' : ''}`} data-tour="tokens-list">
        <h3>Authorization list</h3>
        <table className="data">
          <thead>
            <tr>
              <th>Token</th>
              <th>Type</th>
              <th>Status</th>
              <th>Updated</th>
            </tr>
          </thead>
          <tbody>
            {tokens.map((t) => (
              <tr key={t.idToken} className={isWalkHit(walkFocus, 'token', { id: t.idToken }) ? 'walk-pulse' : ''}>
                <td>{t.idToken}</td>
                <td>{t.type}</td>
                <td>
                  <StatusBadge value={t.status} />
                </td>
                <td className="muted">{t.updatedAt ? new Date(t.updatedAt).toLocaleString() : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
