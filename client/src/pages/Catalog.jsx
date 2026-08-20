import { useMemo, useState } from 'react';
import PageHeader from '../components/PageHeader.jsx';
import StationPicker from '../components/StationPicker.jsx';
import JsonEditor from '../components/JsonEditor.jsx';
import CallResultPanel from '../components/CallResultPanel.jsx';
import { pretty } from '../api.js';

export default function Catalog({ catalog, stations, selectedStationId, setSelectedStationId, callStation }) {
  const [blockFilter, setBlockFilter] = useState('All');
  const [selectedAction, setSelectedAction] = useState(null);
  const [payloadText, setPayloadText] = useState('{}');
  const [result, setResult] = useState(null);
  const [sending, setSending] = useState(false);

  const grouped = useMemo(() => {
    if (!catalog) return [];
    const byBlock = new Map();
    const add = (entry, direction) => {
      const list = byBlock.get(entry.block) || [];
      list.push({ ...entry, direction });
      byBlock.set(entry.block, list);
    };
    (catalog.csToCsms || []).forEach((e) => add(e, 'CS → CSMS'));
    (catalog.csmsToCs || []).forEach((e) => add(e, 'CSMS → CS'));
    const blocks = catalog.blocks || [...byBlock.keys()];
    return blocks
      .map((block) => ({ block, items: byBlock.get(block) || [] }))
      .filter((g) => g.items.length);
  }, [catalog]);

  const visible = grouped.filter((g) => blockFilter === 'All' || g.block === blockFilter);
  const uniqueCount = catalog?.actionCount || catalog?.actions?.length || 0;
  const listedCount = grouped.reduce((n, g) => n + g.items.length, 0);

  const pick = (item) => {
    setSelectedAction(item);
    const def = item.direction === 'CSMS → CS' ? catalog?.defaults?.[item.action] || {} : {};
    setPayloadText(pretty(def));
    setResult(null);
  };

  const send = async () => {
    if (!selectedAction || selectedAction.direction !== 'CSMS → CS') return;
    let payload = {};
    try {
      payload = JSON.parse(payloadText || '{}');
    } catch {
      setResult({
        action: selectedAction.action,
        stationId: selectedStationId,
        error: 'Payload is not valid JSON',
      });
      return;
    }
    setSending(true);
    setResult(null);
    try {
      const res = await callStation(selectedAction.action, payload);
      setResult({
        action: res.action || selectedAction.action,
        stationId: selectedStationId,
        payload: res.payload ?? payload,
        result: res.result,
      });
    } catch (err) {
      setResult({
        action: selectedAction.action,
        stationId: selectedStationId,
        payload,
        error: err.message,
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Message Catalog"
        subtitle={`${catalog?.specMessageCount || uniqueCount} OCPP 2.1 messages (${listedCount} direction listings). Shapes from OCPP-2.1-Messages-Reference.md`}
        tour="catalog-page"
      />
      <div className="card">
        <div className="form-row">
          <StationPicker stations={stations} value={selectedStationId} onChange={setSelectedStationId} />
          <label className="field">
            Functional block
            <select value={blockFilter} onChange={(e) => setBlockFilter(e.target.value)}>
              <option>All</option>
              {(catalog?.blocks || []).map((b) => (
                <option key={b}>{b}</option>
              ))}
            </select>
          </label>
          <span className="meta-pill ok">{uniqueCount} actions</span>
        </div>
      </div>
      {visible.map((g) => (
        <div className="card catalog-block" key={g.block}>
          <h3>
            {g.block} <span className="muted">({g.items.length})</span>
          </h3>
          <div className="action-grid">
            {g.items.map((item) => {
              const key = `${item.action}-${item.direction}`;
              const active =
                selectedAction &&
                selectedAction.action === item.action &&
                selectedAction.direction === item.direction;
              return (
                <button
                  type="button"
                  key={key}
                  className={`action-chip ${active ? 'active' : ''}`}
                  onClick={() => pick(item)}
                >
                  {item.action}
                  <small>{item.direction}</small>
                </button>
              );
            })}
          </div>
        </div>
      ))}
      {selectedAction && (
        <div className="card">
          <h3>
            {selectedAction.action}{' '}
            <span className="muted">
              #{selectedAction.num} · {selectedAction.direction}
            </span>
          </h3>
          {selectedAction.purpose && <p className="muted">{selectedAction.purpose}</p>}
          {selectedAction.direction === 'CSMS → CS' ? (
            <>
              <JsonEditor value={payloadText} onChange={setPayloadText} />
              <div className="ops" style={{ marginTop: '0.65rem' }}>
                <button type="button" className="btn primary" disabled={sending || !selectedStationId} onClick={send}>
                  Send CALL
                </button>
              </div>
              {sending ? <p className="muted">Sending {selectedAction.action}…</p> : null}
              <CallResultPanel result={result} onClear={() => setResult(null)} />
            </>
          ) : (
            <p className="muted">
              Station-initiated. The CSMS answers with the catalog default CALLRESULT when a charge point sends this
              action.
            </p>
          )}
        </div>
      )}
    </>
  );
}
