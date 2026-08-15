import { useState } from 'react';
import { api, pretty, tokenLabel } from '../api.js';
import PageHeader from '../components/PageHeader.jsx';
import StationPicker from '../components/StationPicker.jsx';
import StatusBadge from '../components/StatusBadge.jsx';

export default function DisplayReservations({
  stations,
  selected,
  selectedStationId,
  setSelectedStationId,
  callStation,
  reservations,
  transactions = [],
  refresh,
  setError,
  setNotice,
  walkFocus = null,
}) {
  const [message, setMessage] = useState('Welcome to Helios');
  const [token, setToken] = useState('RFID-MASSIVE-01');

  const reserve = async () => {
    try {
      await api('/api/reservations', {
        method: 'POST',
        body: JSON.stringify({
          stationId: selectedStationId,
          evseId: 1,
          idToken: { idToken: token, type: 'ISO14443' },
        }),
      });
      setNotice('Reservation created');
      refresh();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <>
      <PageHeader title="Display & Reservations" subtitle="SetDisplayMessage, CostUpdated, ReserveNow, CancelReservation" tour="display-page" />
      <div className="card">
        <h3>Display</h3>
        <div className="form-row">
          <StationPicker stations={stations} value={selectedStationId} onChange={setSelectedStationId} />
          <label className="field">
            Message
            <input value={message} onChange={(e) => setMessage(e.target.value)} style={{ minWidth: 280 }} />
          </label>
        </div>
        <div className="ops">
          <button
            type="button"
            className="btn primary"
            onClick={() =>
              callStation('SetDisplayMessage', {
                message: {
                  id: 1,
                  priority: 'NormalCycle',
                  message: { format: 'UTF8', language: 'en', content: message },
                },
              })
            }
          >
            SetDisplayMessage
          </button>
          <button type="button" className="btn" onClick={() => callStation('GetDisplayMessages', { requestId: 1 })}>
            GetDisplayMessages
          </button>
          <button type="button" className="btn" onClick={() => callStation('ClearDisplayMessage', { id: 1 })}>
            ClearDisplayMessage
          </button>
          <button
            type="button"
            className="btn"
            onClick={() => {
              const live = transactions.find((t) => t.stationId === selectedStationId && t.status !== 'Ended');
              callStation('CostUpdated', {
                totalCost: live?.cost ?? 0,
                transactionId: live?.transactionId || 'tx-demo',
              });
            }}
          >
            CostUpdated
          </button>
        </div>
        {(selected?.displayMessages || []).length > 0 && (
          <pre className="payload mono">{pretty(selected.displayMessages)}</pre>
        )}
      </div>
      <div className={`card ${walkFocus ? 'walk-reading' : ''}`}>
        <h3>Reservations</h3>
        <div className="form-row">
          <label className="field">
            Id token
            <input value={token} onChange={(e) => setToken(e.target.value)} />
          </label>
          <button type="button" className="btn primary" onClick={reserve}>
            ReserveNow
          </button>
          <button
            type="button"
            className="btn"
            onClick={() => callStation('CancelReservation', { reservationId: reservations[0]?.id || 1 })}
          >
            CancelReservation
          </button>
        </div>
        {reservations.length === 0 ? (
          <p className="empty">No reservations.</p>
        ) : (
          <table className="data">
            <thead>
              <tr>
                <th>Id</th>
                <th>Station</th>
                <th>EVSE</th>
                <th>Token</th>
                <th>Expiry</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {reservations.map((r) => (
                <tr
                  key={r.id}
                  className={walkFocus?.stationId && r.stationId === walkFocus.stationId ? 'walk-pulse' : ''}
                >
                  <td>{r.id}</td>
                  <td>{r.stationId}</td>
                  <td>{r.evseId}</td>
                  <td>{tokenLabel(r.idToken)}</td>
                  <td className="muted">{r.expiryDateTime ? new Date(r.expiryDateTime).toLocaleString() : '—'}</td>
                  <td>
                    <StatusBadge value={r.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
