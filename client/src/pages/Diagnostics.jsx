import PageHeader from '../components/PageHeader.jsx';
import StationPicker from '../components/StationPicker.jsx';
import { pretty } from '../api.js';

export default function Diagnostics({
  stations,
  selected,
  selectedStationId,
  setSelectedStationId,
  callStation,
  diagnostics,
  streamSamples = [],
}) {
  return (
    <>
      <PageHeader
        title="Diagnostics & Monitoring"
        subtitle="Variable monitoring, customer information, reports, and periodic event streams"
        tour="diagnostics-page"
      />
      <div className="card">
        <div className="form-row">
          <StationPicker stations={stations} value={selectedStationId} onChange={setSelectedStationId} />
        </div>
        <div className="ops">
          <button type="button" className="btn" onClick={() => callStation('GetBaseReport', { requestId: 1, reportBase: 'FullInventory' })}>
            GetBaseReport
          </button>
          <button type="button" className="btn" onClick={() => callStation('SetMonitoringBase', { monitoringBase: 'All' })}>
            SetMonitoringBase
          </button>
          <button
            type="button"
            className="btn"
            onClick={() =>
              callStation('SetVariableMonitoring', {
                setMonitoringData: [
                  {
                    id: 1,
                    value: 80,
                    type: 'UpperThreshold',
                    severity: 3,
                    component: { name: 'TemperatureSensor' },
                    variable: { name: 'Temperature' },
                  },
                ],
              })
            }
          >
            SetVariableMonitoring
          </button>
          <button type="button" className="btn" onClick={() => callStation('GetMonitoringReport', { requestId: 1 })}>
            GetMonitoringReport
          </button>
          <button type="button" className="btn" onClick={() => callStation('ClearVariableMonitoring', { id: [1] })}>
            ClearVariableMonitoring
          </button>
          <button
            type="button"
            className="btn"
            onClick={() =>
              callStation('CustomerInformation', {
                requestId: 1,
                report: true,
                clear: false,
                customerIdentifier: 'CUST-001',
              })
            }
          >
            CustomerInformation
          </button>
          <button
            type="button"
            className="btn"
            onClick={() =>
              callStation('OpenPeriodicEventStream', {
                constantStreamData: { id: 1, params: { interval: 10, values: 1 } },
              })
            }
          >
            OpenPeriodicEventStream
          </button>
          <button type="button" className="btn" onClick={() => callStation('GetPeriodicEventStream', {})}>
            GetPeriodicEventStream
          </button>
          <button type="button" className="btn" onClick={() => callStation('ClosePeriodicEventStream', { id: 1 })}>
            ClosePeriodicEventStream
          </button>
        </div>
      </div>
      <div className="card">
        <h3>Tickets</h3>
        {diagnostics.length === 0 ? (
          <p className="empty">No NotifyReport / NotifyEvent / monitoring / customer tickets yet.</p>
        ) : (
          <table className="data">
            <thead>
              <tr>
                <th>When</th>
                <th>Station</th>
                <th>Kind</th>
                <th>Action</th>
                <th>Detail</th>
              </tr>
            </thead>
            <tbody>
              {diagnostics.slice(0, 40).map((d) => (
                <tr key={d.id}>
                  <td className="muted">{d.at ? new Date(d.at).toLocaleString() : '—'}</td>
                  <td>{d.stationId}</td>
                  <td>{d.kind}</td>
                  <td>{d.action}</td>
                  <td>
                    <pre className="payload mono">{pretty(d.payload).slice(0, 280)}</pre>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <div className="grid-2">
        <div className="card">
          <h3>Inventory variables</h3>
          {(selected?.variables || []).length === 0 ? (
            <p className="empty">No NotifyReport data on the selected station.</p>
          ) : (
            <pre className="payload mono">{pretty(selected.variables.slice(-12))}</pre>
          )}
        </div>
        <div className="card">
          <h3>Periodic event stream</h3>
          {(streamSamples || []).length === 0 ? (
            <p className="empty">No NotifyPeriodicEventStream samples yet.</p>
          ) : (
            streamSamples.slice(0, 8).map((s, i) => (
              <pre className="payload mono" key={i}>
                {pretty(s)}
              </pre>
            ))
          )}
        </div>
      </div>
    </>
  );
}
