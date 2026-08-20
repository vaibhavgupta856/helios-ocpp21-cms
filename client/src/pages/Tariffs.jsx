import { useEffect, useMemo, useRef, useState } from 'react';
import { api, pretty } from '../api.js';
import PageHeader from '../components/PageHeader.jsx';
import StationPicker from '../components/StationPicker.jsx';
import CallResultPanel from '../components/CallResultPanel.jsx';
import { isWalkHit } from '../agentWalk.js';

function bookToOcppTariff(rec) {
  return {
    tariffId: rec.tariffId,
    currency: rec.currency || 'EUR',
    description: rec.description
      ? [{ format: 'UTF8', language: 'en', content: rec.description }]
      : undefined,
    energy: { prices: [{ priceKwh: Number(rec.energyKwh) || 0 }] },
  };
}

const SELECTED_KEY = 'helios.tariff.selected';

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
  const [tariffId, setTariffId] = useState(() => localStorage.getItem(SELECTED_KEY) || 'MASSIVE-AC-DEFAULT');
  const [currency, setCurrency] = useState('EUR');
  const [energyKwh, setEnergyKwh] = useState('0.39');
  const [description, setDescription] = useState('');
  const [lastCall, setLastCall] = useState(null);
  const restored = useRef(false);

  useEffect(() => {
    if (restored.current || !tariffs.length) return;
    restored.current = true;
    const saved = localStorage.getItem(SELECTED_KEY);
    const rec = tariffs.find((t) => t.tariffId === saved) || tariffs.find((t) => t.tariffId === tariffId) || tariffs[0];
    if (!rec) return;
    setTariffId(rec.tariffId);
    setCurrency(rec.currency || 'EUR');
    setEnergyKwh(String(rec.energyKwh ?? '0.39'));
    setDescription(rec.description || '');
  }, [tariffs, tariffId]);

  const rememberTariff = (rec) => {
    if (!rec?.tariffId) return;
    localStorage.setItem(SELECTED_KEY, rec.tariffId);
    setTariffId(rec.tariffId);
    setCurrency(rec.currency || 'EUR');
    setEnergyKwh(String(rec.energyKwh ?? ''));
    setDescription(rec.description || '');
  };

  const selectedBook = useMemo(
    () =>
      tariffs.find((t) => t.tariffId === tariffId) || {
        tariffId,
        currency,
        energyKwh: Number(energyKwh),
        description,
      },
    [tariffs, tariffId, currency, energyKwh, description]
  );

  const selectedStation = useMemo(
    () => stations.find((s) => s.stationId === selectedStationId) || null,
    [stations, selectedStationId]
  );

  const installed = useMemo(() => {
    const rows = selectedStation?.tariffs || [];
    return rows.filter((row) => row?.tariff?.tariffId || row?.tariffId);
  }, [selectedStation]);

  const add = async (e) => {
    e.preventDefault();
    try {
      await api('/api/tariffs', {
        method: 'POST',
        body: JSON.stringify({ tariffId, currency, energyKwh: Number(energyKwh), description }),
      });
      setNotice('Tariff saved in the Helios book');
      localStorage.setItem(SELECTED_KEY, tariffId);
      refresh();
    } catch (err) {
      setError(err.message);
    }
  };

  const push = async (action, payload) => {
    try {
      const res = await callStation(action, payload);
      setLastCall({
        action: res.action || action,
        stationId: selectedStationId,
        payload: res.payload ?? payload,
        result: res.result,
      });
      refresh();
    } catch (err) {
      setLastCall({
        action,
        stationId: selectedStationId,
        payload,
        error: err.message,
      });
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
        <p className="muted">Save writes the Helios book. Push <strong>SetDefaultTariff</strong> to install that rate on the selected charge point, then <strong>GetTariffs</strong> to read it back.</p>
      </div>
      ) : null}
      {can('ocpp.call') ? (
      <div className="card" data-tour="tariffs-push">
        <h3>Push to station</h3>
        <div className="form-row">
          <StationPicker stations={stations} value={selectedStationId} onChange={setSelectedStationId} />
          <button type="button" className="btn" onClick={() => push('GetTariffs', { evseId: 0 })}>
            GetTariffs
          </button>
          <button
            type="button"
            className="btn primary"
            onClick={() =>
              push('SetDefaultTariff', {
                evseId: 0,
                tariff: bookToOcppTariff(selectedBook),
              })
            }
          >
            SetDefaultTariff
          </button>
          <button type="button" className="btn" onClick={() => push('ClearTariffs', { tariffIds: [tariffId] })}>
            ClearTariffs
          </button>
          <button
            type="button"
            className="btn"
            onClick={() => {
              const live = transactions.find((t) => t.stationId === selectedStationId && t.status !== 'Ended');
              push('ChangeTransactionTariff', {
                tariff: bookToOcppTariff(selectedBook),
                transactionId: live?.transactionId,
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
              push('CostUpdated', {
                totalCost: live?.cost ?? 0,
                transactionId: live?.transactionId || 'tx-demo',
              });
            }}
          >
            CostUpdated
          </button>
        </div>
        {selectedStation?.defaultTariffId ? (
          <p className="muted" style={{ marginTop: '0.65rem' }}>
            Default on {selectedStation.stationId}: <code>{selectedStation.defaultTariffId}</code>
          </p>
        ) : (
          <p className="muted" style={{ marginTop: '0.65rem' }}>
            No default tariff installed on this charge point yet.
          </p>
        )}
        {installed.length ? (
          <div style={{ marginTop: '0.85rem' }}>
            <h4 style={{ margin: '0 0 0.4rem' }}>Installed on this charge point</h4>
            <table className="data">
              <thead>
                <tr>
                  <th>Tariff id</th>
                  <th>Currency</th>
                  <th>€ / kWh</th>
                  <th>Kind</th>
                </tr>
              </thead>
              <tbody>
                {installed.map((row, i) => {
                  const t = row.tariff || row;
                  return (
                    <tr key={`${t.tariffId || i}`}>
                      <td>{t.tariffId}</td>
                      <td>{t.currency || '—'}</td>
                      <td>{t.energy?.prices?.[0]?.priceKwh ?? '—'}</td>
                      <td>{row.tariffKind || 'DefaultTariff'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : null}
        <CallResultPanel result={lastCall} onClear={() => setLastCall(null)} />
        {lastCall?.result?.status === 'NoTariff' ? (
          <p className="muted" style={{ marginTop: '0.4rem' }}>
            Station has no tariff installed. Push SetDefaultTariff first.
          </p>
        ) : null}
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
                  className={`clickable ${t.tariffId === tariffId ? 'selected' : ''} ${isWalkHit(walkFocus, 'tariff', { id: t.tariffId }) ? 'walk-pulse' : ''}`}
                  onClick={() => rememberTariff(t)}
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
