import { useState } from 'react';
import { api, pretty } from '../api.js';
import PageHeader from '../components/PageHeader.jsx';
import StationPicker from '../components/StationPicker.jsx';
import { isWalkHit } from '../agentWalk.js';

export default function Tariffs({
  tariffs,
  payments,
  stations,
  selectedStationId,
  setSelectedStationId,
  callStation,
  refresh,
  setError,
  setNotice,
  transactions = [],
  can = () => false,
  walkFocus = null,
}) {
  const [tariffId, setTariffId] = useState('MASSIVE-AC-DEFAULT');
  const [currency, setCurrency] = useState('EUR');
  const [energyKwh, setEnergyKwh] = useState('0.42');
  const [description, setDescription] = useState('');

  const add = async (e) => {
    e.preventDefault();
    try {
      await api('/api/tariffs', {
        method: 'POST',
        body: JSON.stringify({ tariffId, currency, energyKwh: Number(energyKwh), description }),
      });
      setNotice('Tariff saved');
      refresh();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <>
      <PageHeader title="Tariffs & Cost" subtitle="Default tariffs, transaction tariff changes, and settlement notifications" tour="tariffs-page" />
      {can('tariffs.write') ? (
      <div className="card" data-tour="tariffs-create">
        <h3>Create tariff</h3>
        <form className="form-row" onSubmit={add}>
          <label className="field">
            Tariff id
            <input value={tariffId} onChange={(e) => setTariffId(e.target.value)} required />
          </label>
          <label className="field">
            Currency
            <input value={currency} onChange={(e) => setCurrency(e.target.value)} />
          </label>
          <label className="field">
            € / kWh
            <input value={energyKwh} onChange={(e) => setEnergyKwh(e.target.value)} />
          </label>
          <label className="field">
            Description
            <input value={description} onChange={(e) => setDescription(e.target.value)} />
          </label>
          <button className="btn primary" type="submit">
            Save
          </button>
        </form>
      </div>
      ) : null}
      {can('ocpp.call') ? (
      <div className="card" data-tour="tariffs-push">
        <h3>Push to station</h3>
        <div className="form-row">
          <StationPicker stations={stations} value={selectedStationId} onChange={setSelectedStationId} />
          <button type="button" className="btn" onClick={() => callStation('GetTariffs', { evseId: 1 })}>
            GetTariffs
          </button>
          <button
            type="button"
            className="btn primary"
            onClick={() => callStation('SetDefaultTariff', { evseId: 1, tariffId })}
          >
            SetDefaultTariff
          </button>
          <button type="button" className="btn" onClick={() => callStation('ClearTariffs', { tariffIds: [tariffId] })}>
            ClearTariffs
          </button>
          <button
            type="button"
            className="btn"
            onClick={() => {
              const live = transactions.find((t) => t.stationId === selectedStationId && t.status !== 'Ended');
              callStation('ChangeTransactionTariff', {
                tariffId,
                transactionId: live?.transactionId || 'tx-demo',
              });
            }}
          >
            ChangeTransactionTariff
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
      </div>
      ) : null}
      <div className="grid-2" data-tour="tariffs-book">
        <div className="card">
          <h3>Tariff book</h3>
          <table className="data">
            <thead>
              <tr>
                <th>Id</th>
                <th>Currency</th>
                <th>Energy</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {tariffs.map((t) => (
                <tr
                  key={t.tariffId}
                  className={`clickable ${isWalkHit(walkFocus, 'tariff', { id: t.tariffId }) ? 'walk-pulse' : ''}`}
                  onClick={() => setTariffId(t.tariffId)}
                >
                  <td>{t.tariffId}</td>
                  <td>{t.currency}</td>
                  <td>{t.energyKwh}</td>
                  <td>{t.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="card">
          <h3>Settlements / payments</h3>
          {payments.length === 0 ? (
            <p className="empty">No NotifySettlement or web payment events.</p>
          ) : (
            payments.map((p, i) => (
              <pre className="payload mono" key={i}>
                {pretty(p)}
              </pre>
            ))
          )}
        </div>
      </div>
    </>
  );
}
