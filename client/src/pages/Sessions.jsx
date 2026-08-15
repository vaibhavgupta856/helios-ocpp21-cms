import PageHeader from '../components/PageHeader.jsx';
import StatusBadge from '../components/StatusBadge.jsx';
import { tokenLabel } from '../api.js';
import { stationLabel } from '../org.js';

export default function Sessions({ transactions, stations, selected, callStation, setSelectedStationId, can = () => false }) {
  const live = transactions.filter((t) => t.status !== 'Ended');

  return (
    <>
      <PageHeader
        title="Sessions / Transactions"
        subtitle="OCPP 2.1 TransactionEvent store — Started, Updated, Ended"
      />
      <div className="stat-grid">
        <div className="stat-card">
          <div className="k">All sessions</div>
          <div className="v">{transactions.length}</div>
        </div>
        <div className="stat-card">
          <div className="k">Live</div>
          <div className="v">{live.length}</div>
        </div>
      </div>
      <div className="card" data-tour="sessions-table">
        <h3>Transactions</h3>
        {transactions.length === 0 ? (
          <p className="empty">No TransactionEvent messages received yet.</p>
        ) : (
          <table className="data">
              <thead>
                <tr>
                  <th>Id</th>
                  <th>Tenant / station</th>
                  <th>Charge point</th>
                  <th>EVSE</th>
                  <th>Status</th>
                  <th>Token</th>
                  <th>kWh</th>
                  <th>Cost</th>
                  <th>Updated</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((t) => {
                  const cp = stations.find((s) => s.stationId === t.stationId);
                  return (
                    <tr key={`${t.stationId}-${t.transactionId}`}>
                      <td>{t.transactionId}</td>
                      <td>{stationLabel(cp) || '—'}</td>
                      <td>{t.stationId}</td>
                  <td>
                    {t.evseId}/{t.connectorId}
                  </td>
                  <td>
                    <StatusBadge value={t.status} />
                  </td>
                  <td>{tokenLabel(t.idToken)}</td>
                  <td>{t.kwh || 0}</td>
                  <td>
                    {t.cost != null ? `${t.currency || 'EUR'} ${Number(t.cost).toFixed(2)}` : '—'}
                  </td>
                  <td className="muted">{t.updatedAt ? new Date(t.updatedAt).toLocaleString() : '—'}</td>
                  <td>
                    {t.status !== 'Ended' && can('ocpp.call') && (
                      <button
                        type="button"
                        className="btn"
                        onClick={() => {
                          setSelectedStationId(t.stationId);
                          callStation('RequestStopTransaction', { transactionId: t.transactionId }, t.stationId);
                        }}
                      >
                        Stop
                      </button>
                    )}
                  </td>
                </tr>
                  );
                })}
            </tbody>
          </table>
        )}
      </div>
      {selected?.transactions?.length ? (
        <div className="card">
          <h3>Station {selected.stationId} events</h3>
          <table className="data">
            <thead>
              <tr>
                <th>Tx</th>
                <th>Event</th>
                <th>State</th>
                <th>Trigger</th>
              </tr>
            </thead>
            <tbody>
              {selected.transactions.map((t) => (
                <tr key={t.transactionId}>
                  <td>{t.transactionId}</td>
                  <td>{t.eventType}</td>
                  <td>{t.chargingState || '—'}</td>
                  <td>{t.triggerReason || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      {!stations.length ? <p className="muted">Connect a charge point to record sessions.</p> : null}
    </>
  );
}
