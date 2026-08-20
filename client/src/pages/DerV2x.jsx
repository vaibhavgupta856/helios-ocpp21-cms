import { useState } from 'react';
import PageHeader from '../components/PageHeader.jsx';
import StationPicker from '../components/StationPicker.jsx';
import CallResultPanel from '../components/CallResultPanel.jsx';
import { pretty } from '../api.js';

export default function DerV2x({
  stations,
  selectedStationId,
  setSelectedStationId,
  callStation,
  derEvents,
  batterySwaps,
  selected,
}) {
  const [controlId, setControlId] = useState('der-1');
  const [signal, setSignal] = useState('0');
  const [busy, setBusy] = useState('');
  const [callResult, setCallResult] = useState(null);

  const run = async (action, payload) => {
    setBusy(action);
    setCallResult(null);
    try {
      const res = await callStation(action, payload);
      setCallResult({
        action: res.action || action,
        stationId: selectedStationId,
        payload: res.payload ?? payload,
        result: res.result,
      });
    } catch (err) {
      setCallResult({
        action,
        stationId: selectedStationId,
        payload,
        error: err.message || String(err),
      });
    } finally {
      setBusy('');
    }
  };

  return (
    <>
      <PageHeader
        title="DER & V2X"
        subtitle="Distributed energy resource control, AFRR, allowed energy transfer, and battery swap"
        tour="der-page"
      />
      <div className="card">
        <div className="form-row">
          <StationPicker stations={stations} value={selectedStationId} onChange={setSelectedStationId} />
          <label className="field">
            Control id
            <input value={controlId} onChange={(e) => setControlId(e.target.value)} />
          </label>
          <label className="field">
            AFRR signal
            <input value={signal} onChange={(e) => setSignal(e.target.value)} />
          </label>
        </div>
        <div className="ops">
          <button
            type="button"
            className="btn primary"
            disabled={!!busy}
            onClick={() => run('SetDERControl', { isDefault: true, controlId, controlType: 'EnterService' })}
          >
            SetDERControl
          </button>
          <button
            type="button"
            className="btn"
            disabled={!!busy}
            onClick={() => run('GetDERControl', { requestId: 1, controlId })}
          >
            GetDERControl
          </button>
          <button
            type="button"
            className="btn"
            disabled={!!busy}
            onClick={() => run('ClearDERControl', { isDefault: true, controlId })}
          >
            ClearDERControl
          </button>
          <button
            type="button"
            className="btn"
            disabled={!!busy}
            onClick={() =>
              run('NotifyAllowedEnergyTransfer', { allowedEnergyTransfer: ['AC_single_phase', 'DC'] })
            }
          >
            Energy transfer
          </button>
          <button
            type="button"
            className="btn"
            disabled={!!busy}
            onClick={() => run('AFRRSignal', { timestamp: new Date().toISOString(), signal: Number(signal) })}
          >
            AFRRSignal
          </button>
          <button
            type="button"
            className="btn"
            disabled={!!busy}
            onClick={() =>
              run('RequestBatterySwap', {
                requestId: 1,
                idToken: { idToken: 'RFID-MASSIVE-01', type: 'ISO14443' },
              })
            }
          >
            RequestBatterySwap
          </button>
        </div>
        {busy ? <p className="muted">Sending {busy}…</p> : null}
        <CallResultPanel result={callResult} onClear={() => setCallResult(null)} />
      </div>
      <div className="grid-2">
        <div className="card">
          <h3>DER events</h3>
          {(derEvents.length ? derEvents : selected?.der || []).length === 0 ? (
            <p className="empty">No ReportDERControl / DER alarm messages.</p>
          ) : (
            (derEvents.length ? derEvents : selected.der).map((row, i) => (
              <pre className="payload mono" key={i}>
                {pretty(row)}
              </pre>
            ))
          )}
        </div>
        <div className="card">
          <h3>Battery swap</h3>
          {batterySwaps.length === 0 ? (
            <p className="empty">No BatterySwap notifications.</p>
          ) : (
            batterySwaps.map((row, i) => (
              <pre className="payload mono" key={i}>
                {pretty(row)}
              </pre>
            ))
          )}
        </div>
      </div>
    </>
  );
}
