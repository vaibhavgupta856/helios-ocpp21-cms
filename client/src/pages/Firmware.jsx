import PageHeader from '../components/PageHeader.jsx';
import StationPicker from '../components/StationPicker.jsx';
import StatusBadge from '../components/StatusBadge.jsx';
import { pretty } from '../api.js';

export default function Firmware({
  stations,
  selected,
  selectedStationId,
  setSelectedStationId,
  callStation,
  firmware,
}) {
  return (
    <>
      <PageHeader title="Firmware & Logs" subtitle="UpdateFirmware, PublishFirmware, GetLog, and status notifications" tour="firmware-page" />
      <div className="card">
        <div className="form-row">
          <StationPicker stations={stations} value={selectedStationId} onChange={setSelectedStationId} />
        </div>
        <div className="ops">
          <button
            type="button"
            className="btn primary"
            onClick={() =>
              callStation('UpdateFirmware', {
                requestId: 1,
                firmware: {
                  location: 'https://firmware.helios.lab/ocpp21.bin',
                  retrieveDateTime: new Date().toISOString(),
                },
              })
            }
          >
            UpdateFirmware
          </button>
          <button
            type="button"
            className="btn"
            onClick={() =>
              callStation('PublishFirmware', {
                location: 'https://firmware.helios.lab/ocpp21.bin',
                checksum: 'd41d8cd98f00b204e9800998ecf8427e',
                requestId: 1,
              })
            }
          >
            PublishFirmware
          </button>
          <button
            type="button"
            className="btn"
            onClick={() => callStation('UnpublishFirmware', { checksum: 'd41d8cd98f00b204e9800998ecf8427e' })}
          >
            UnpublishFirmware
          </button>
          <button
            type="button"
            className="btn"
            onClick={() =>
              callStation('GetLog', {
                logType: 'DiagnosticsLog',
                requestId: 1,
                log: { remoteLocation: 'https://logs.helios.lab/upload' },
              })
            }
          >
            GetLog
          </button>
        </div>
        <p className="muted" style={{ marginTop: '0.75rem' }}>
          Station firmware status: {selected?.firmwareStatus || '—'} · log: {selected?.logStatus || '—'}
        </p>
      </div>
      <div className="card">
        <h3>Jobs</h3>
        {firmware.length === 0 ? (
          <p className="empty">No firmware or log jobs yet.</p>
        ) : (
          <table className="data">
            <thead>
              <tr>
                <th>When</th>
                <th>Station</th>
                <th>Action</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {firmware.map((j) => (
                <tr key={j.id}>
                  <td>{j.at ? new Date(j.at).toLocaleString() : '—'}</td>
                  <td>{j.stationId}</td>
                  <td>{j.action}</td>
                  <td>
                    <StatusBadge value={j.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {selected?.events?.length ? (
        <div className="card">
          <h3>NotifyEvent</h3>
          <pre className="payload mono">{pretty(selected.events.slice(-8))}</pre>
        </div>
      ) : null}
    </>
  );
}
