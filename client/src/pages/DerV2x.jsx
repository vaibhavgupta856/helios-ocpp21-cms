import { useState } from 'react';
import PageHeader from '../components/PageHeader.jsx';
import StationPicker from '../components/StationPicker.jsx';
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
            onClick={() => callStation('SetDERControl', { isDefault: true, controlId, controlType: 'EnterService' })}
          >
            SetDERControl
          </button>
          <button type="button" className="btn" onClick={() => callStation('GetDERControl', { requestId: 1, controlId })}>
            GetDERControl
          </button>
          <button type="button" className="btn" onClick={() => callStation('ClearDERControl', { isDefault: true, controlId })}>
            ClearDERControl
          </button>
          <button
            type="button"
            className="btn"
            onClick={() =>
              callStation('NotifyAllowedEnergyTransfer', { allowedEnergyTransfer: ['AC_single_phase', 'DC'] })
            }
          >
            Energy transfer
          </button>
          <button
            type="button"
            className="btn"
            onClick={() => callStation('AFRRSignal', { timestamp: new Date().toISOString(), signal: Number(signal) })}
          >
            AFRRSignal
          </button>
          <button
            type="button"
            className="btn"
            onClick={() =>
              callStation('RequestBatterySwap', {
                requestId: 1,
                idToken: { idToken: 'RFID-MASSIVE-01', type: 'ISO14443' },
              })
            }
          >
            RequestBatterySwap
          </button>
        </div>
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
