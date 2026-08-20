import { useEffect, useMemo, useState } from 'react';
import PageHeader from '../components/PageHeader.jsx';
import StatusBadge from '../components/StatusBadge.jsx';
import WssPairingCard, { CopyField } from '../components/WssPairingCard.jsx';
import { api } from '../api.js';
import { buildOrgTree, stationLabel } from '../org.js';
import { isWalkHit } from '../agentWalk.js';
import JsonEditor from '../components/JsonEditor.jsx';
import CallResultPanel from '../components/CallResultPanel.jsx';
import { pretty } from '../api.js';

function connectionUrls(stationId, security) {
  if (!stationId) return { wsUrl: '', wssUrl: '' };
  const id = encodeURIComponent(stationId);
  const ws =
    security?.ws?.replace('{stationId}', id) || `ws://127.0.0.1:9090/ocpp/2.1/${id}`;
  const wss =
    security?.wss?.replace('{stationId}', id) || `wss://127.0.0.1:9443/ocpp/2.1/${id}`;
  return { wsUrl: ws, wssUrl: wss };
}

export default function Stations({
  stations,
  tenants = [],
  sites = [],
  selected,
  setSelectedStationId,
  callStation,
  simulate,
  security,
  refresh,
  setNotice,
  setError,
  can = () => false,
  walkFocus = null,
  catalog = null,
  transactions = [],
}) {
  const canTenant = can('org.tenant');
  const canSite = can('org.site');
  const canEnroll = can('org.enroll');
  const canSim = can('org.simulate');
  const canCall = can('ocpp.call');
  const canAssign = can('org.assign');
  const [busy, setBusy] = useState('');
  const [callResult, setCallResult] = useState(null);
  const [stopTxId, setStopTxId] = useState('');
  const [idToken, setIdToken] = useState('RFID-MASSIVE-01');
  const [startEvseId, setStartEvseId] = useState(1);
  const [newId, setNewId] = useState('VF-CP-21');
  const [query, setQuery] = useState('');
  const [tenantId, setTenantId] = useState(tenants[0]?.id || '');
  const [siteId, setSiteId] = useState('');
  const [newTenantName, setNewTenantName] = useState('');
  const [newSiteName, setNewSiteName] = useState('');
  const [newSiteCity, setNewSiteCity] = useState('');
  const [openSiteId, setOpenSiteId] = useState('');
  const [addingSiteId, setAddingSiteId] = useState('');
  const [addingTenantId, setAddingTenantId] = useState('');
  const [addingRootTenant, setAddingRootTenant] = useState(false);
  const [openTenantId, setOpenTenantId] = useState('');
  const [collapsedTenants, setCollapsedTenants] = useState(() => new Set());

  const sitesForTenant = useMemo(
    () => sites.filter((s) => s.tenantId === (tenantId || tenants[0]?.id)).sort((a, b) => (a.order ?? 99) - (b.order ?? 99)),
    [sites, tenantId, tenants]
  );

  const activeTenantId = tenantId || tenants[0]?.id || '';
  const activeSiteId = siteId && sitesForTenant.some((s) => s.id === siteId) ? siteId : sitesForTenant[0]?.id || '';

  const tree = useMemo(
    () => buildOrgTree({ tenants, sites, stations, query }),
    [tenants, sites, stations, query]
  );

  const activeTxForStation = useMemo(() => {
    const sid = selected?.stationId;
    if (!sid) return [];
    return (transactions || [])
      .filter((t) => t.stationId === sid && t.status && t.status !== 'Ended')
      .sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')));
  }, [transactions, selected?.stationId]);

  useEffect(() => {
    setStopTxId(activeTxForStation[0]?.transactionId || '');
  }, [activeTxForStation, selected?.stationId]);

  const [actionBlock, setActionBlock] = useState('All');
  const [selectedAction, setSelectedAction] = useState(null);
  const [payloadText, setPayloadText] = useState('{}');

  const csmsToCsActions = useMemo(() => catalog?.csmsToCs || [], [catalog]);
  const blocks = useMemo(() => catalog?.blocks || [], [catalog]);
  const visibleActions = useMemo(() => {
    const list = csmsToCsActions || [];
    if (actionBlock === 'All') return list;
    return list.filter((a) => a.block === actionBlock);
  }, [actionBlock, csmsToCsActions]);

  const pickAction = (action) => {
    setSelectedAction(action);
    const def = catalog?.defaults?.[action.action] || {};
    setPayloadText(pretty(def));
  };

  useEffect(() => {
    if (selected?.siteId && openSiteId) setOpenSiteId(selected.siteId);
  }, [selected?.siteId]);

  useEffect(() => {
    if (!walkFocus) return;
    if (walkFocus.tenantId) {
      setTenantId(walkFocus.tenantId);
      setOpenTenantId(walkFocus.tenantId);
      setCollapsedTenants((prev) => {
        const next = new Set(prev);
        next.delete(walkFocus.tenantId);
        return next;
      });
    } else if (walkFocus.tenantName) {
      const hit = tenants.find((t) => String(t.name).toLowerCase() === String(walkFocus.tenantName).toLowerCase());
      if (hit) {
        setTenantId(hit.id);
        setOpenTenantId(hit.id);
        setCollapsedTenants((prev) => {
          const next = new Set(prev);
          next.delete(hit.id);
          return next;
        });
      }
    }
    if (walkFocus.siteId) {
      setOpenSiteId(walkFocus.siteId);
      setSiteId(walkFocus.siteId);
    } else if (walkFocus.siteName) {
      const hit = sites.find((s) => String(s.name).toLowerCase() === String(walkFocus.siteName).toLowerCase());
      if (hit) {
        setOpenSiteId(hit.id);
        setSiteId(hit.id);
        if (hit.tenantId) {
          setTenantId(hit.tenantId);
          setOpenTenantId(hit.tenantId);
        }
      }
    }
    if (walkFocus.stationId) {
      const cp = stations.find((s) => s.stationId === walkFocus.stationId);
      if (cp) {
        setSelectedStationId(cp.stationId);
        if (cp.siteId) {
          setOpenSiteId(cp.siteId);
          setSiteId(cp.siteId);
        }
        const site = sites.find((s) => s.id === cp.siteId);
        const tid = cp.tenantId || site?.tenantId;
        if (tid) {
          setTenantId(tid);
          setOpenTenantId(tid);
          setCollapsedTenants((prev) => {
            const next = new Set(prev);
            next.delete(tid);
            return next;
          });
        }
      }
    }
    const t = window.setTimeout(() => {
      document.querySelector('.walk-pulse')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 80);
    return () => window.clearTimeout(t);
  }, [
    walkFocus?.tenantId,
    walkFocus?.tenantName,
    walkFocus?.siteId,
    walkFocus?.siteName,
    walkFocus?.stationId,
    tenants,
    sites,
    stations,
  ]);

  const opened = useMemo(() => {
    for (const tenant of tree) {
      const site = tenant.stations.find((s) => s.id === openSiteId);
      if (site) return { tenant, site };
    }
    return null;
  }, [tree, openSiteId]);

  const tenantIsOpen = (tenant) => {
    if (collapsedTenants.has(tenant.id)) return false;
    if (tenant.stations.length > 0) return true;
    return openTenantId === tenant.id || addingTenantId === tenant.id;
  };

  const toggleTenant = (tenant) => {
    if (tenant.stations.length > 0) {
      setCollapsedTenants((prev) => {
        const next = new Set(prev);
        if (next.has(tenant.id)) next.delete(tenant.id);
        else next.add(tenant.id);
        return next;
      });
      return;
    }
    setOpenTenantId((id) => (id === tenant.id ? '' : tenant.id));
  };

  const openStation = (site, tenant) => {
    setOpenSiteId(site.id);
    setTenantId(tenant.id);
    setOpenTenantId(tenant.id);
    setCollapsedTenants((prev) => {
      const next = new Set(prev);
      next.delete(tenant.id);
      return next;
    });
    setSiteId(site.id);
    if (selected?.siteId && selected.siteId !== site.id) setSelectedStationId('');
  };

  const toggleStation = (site, tenant) => {
    if (openSiteId === site.id) {
      setOpenSiteId('');
      setAddingSiteId((current) => (current === site.id ? '' : current));
      return;
    }
    openStation(site, tenant);
  };

  const run = async (action, payload) => {
    setBusy(action);
    setError('');
    setCallResult(null);
    try {
      const res = await callStation(action, payload, selected?.stationId);
      setCallResult({
        action: res.action || action,
        stationId: selected?.stationId,
        payload: res.payload ?? payload,
        result: res.result,
      });
      return res;
    } catch (err) {
      const message = err.message || String(err);
      setError(message);
      setCallResult({
        action,
        stationId: selected?.stationId,
        payload,
        error: message,
      });
      throw err;
    } finally {
      setBusy('');
    }
  };

  const enroll = async (e, site = null) => {
    e?.preventDefault?.();
    const stationId = String(newId || '').trim();
    if (!stationId) {
      setError('Charge point ID is required');
      return;
    }
    try {
      const data = await api('/api/stations/enroll', {
        method: 'POST',
        body: JSON.stringify({
          stationId,
          tenantId: site?.tenantId || activeTenantId,
          siteId: site?.id || activeSiteId,
        }),
      });
      setSelectedStationId(data.station.stationId);
      setOpenSiteId(data.station.siteId || site?.id || activeSiteId);
      setAddingSiteId('');
      setNotice(`Added charge point ${data.station.stationId} at ${stationLabel(data.station) || site?.name || 'station'} — copy the WSS base into Voltforge`);
      setError('');
      refresh();
    } catch (err) {
      const text = String(err.message || '');
      setError(
        /not found/i.test(text)
          ? 'Enroll API is missing — the CMS on port 9090 is an old process. Stop it and start massive-ocpp21-cms with npm run dev.'
          : text
      );
    }
  };

  const addTenant = async (e) => {
    e?.preventDefault?.();
    const name = String(newTenantName || '').trim();
    if (!name) {
      setError('Tenant name is required');
      return;
    }
    try {
      const data = await api('/api/tenants', {
        method: 'POST',
        body: JSON.stringify({ name }),
      });
      setTenantId(data.tenant.id);
      setOpenTenantId(data.tenant.id);
      setAddingRootTenant(false);
      setNewTenantName('');
      setNotice(`Tenant ${data.tenant.name} added — click it to add a station underneath`);
      setError('');
      refresh();
    } catch (err) {
      setError(err.message);
    }
  };

  const addSite = async (e, tenant = null) => {
    e?.preventDefault?.();
    const name = String(newSiteName || '').trim();
    if (!name) {
      setError('Station name is required');
      return;
    }
    const tid = tenant?.id || activeTenantId;
    if (!tid) {
      setError('Pick a tenant first');
      return;
    }
    try {
      const data = await api('/api/sites', {
        method: 'POST',
        body: JSON.stringify({
          tenantId: tid,
          name,
          city: newSiteCity.trim(),
        }),
      });
      setTenantId(tid);
      setSiteId(data.site.id);
      setOpenSiteId(data.site.id);
      setAddingTenantId('');
      setNewSiteName('');
      setNewSiteCity('');
      setNotice(`Added station ${data.site.name}`);
      setError('');
      refresh();
    } catch (err) {
      setError(err.message);
    }
  };

  const moveSelected = async (nextSiteId) => {
    if (!selected?.stationId || !nextSiteId) return;
    try {
      const data = await api(`/api/stations/${encodeURIComponent(selected.stationId)}/org`, {
        method: 'PATCH',
        body: JSON.stringify({ siteId: nextSiteId }),
      });
      setNotice(`Moved ${selected.stationId} to ${data.station.location?.name || nextSiteId}`);
      refresh();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <>
      <PageHeader
        title="Stations"
        subtitle="Tenants → stations → charge points. Search the tree, then enroll a CP under a station."
        tour={canEnroll || canTenant || canSite ? undefined : 'stations-enroll'}
        actions={
          <>
            {canTenant ? (
              <button type="button" className="btn" onClick={() => setAddingRootTenant(true)}>
                Add tenant
              </button>
            ) : null}
            {canSim ? (
              <button
                type="button"
                className="btn"
                onClick={() => simulate({ tenantId: activeTenantId, siteId: activeSiteId })}
              >
                Simulate charge point
              </button>
            ) : null}
          </>
        }
      />
      <WssPairingCard security={security} stationId={selected?.stationId || newId} tour="stations-wss" />
      {canEnroll || canTenant || canSite ? (
      <div className="card" data-tour="stations-enroll">
        <h3>Add charging point</h3>
        <p className="muted">
          This console is the <strong>CSMS</strong> (Helios). Charge points such as{' '}
          <strong>Voltforge</strong> connect <em>out</em> to it. Enroll the Charge Point ID here, copy the{' '}
          <strong>WSS base</strong> into Voltforge (do not put the ID in the base), keep subprotocol{' '}
          <code>ocpp2.1</code>
          {security ? ` · profile ${security.profile} (${security.profileName})` : ''}.
        </p>
        {canEnroll ? (
        <form className="form-row" onSubmit={enroll}>
          <label className="field">
            Tenant
            <select
              value={activeTenantId}
              onChange={(e) => {
                setTenantId(e.target.value);
                setSiteId('');
              }}
            >
              {tenants.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            Station
            <select value={activeSiteId} onChange={(e) => setSiteId(e.target.value)}>
              {sitesForTenant.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                  {s.city ? ` · ${s.city}` : ''}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            Charge point ID
            <input value={newId} onChange={(e) => setNewId(e.target.value)} required placeholder="VF-CP-21" />
          </label>
          <button className="btn primary" type="submit">
            Add charge point
          </button>
        </form>
        ) : null}
        {canTenant ? (
        <form className="form-row org-add-row" onSubmit={addTenant}>
          <label className="field">
            New tenant
            <input value={newTenantName} onChange={(e) => setNewTenantName(e.target.value)} placeholder="Tenant name" />
          </label>
          <button className="btn" type="submit" disabled={!newTenantName.trim()}>
            Add tenant
          </button>
        </form>
        ) : null}
        {canSite ? (
        <form className="form-row org-add-row" onSubmit={addSite}>
          <label className="field">
            New station
            <input value={newSiteName} onChange={(e) => setNewSiteName(e.target.value)} placeholder="Station name" />
          </label>
          <label className="field">
            City
            <input value={newSiteCity} onChange={(e) => setNewSiteCity(e.target.value)} placeholder="Optional city" />
          </label>
          <button className="btn" type="submit" disabled={!newSiteName.trim() || !activeTenantId}>
            Add station
          </button>
        </form>
        ) : null}
      </div>
      ) : null}
      <div className="station-split">
        <div className={`org-tree ${walkFocus ? 'walk-reading' : ''}`} data-tour="stations-tree">
          <label className="field search-field">
            Search
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Tenant, station, city, or charge point ID"
              type="search"
            />
          </label>
          {tree.length === 0 && (
            <p className="empty">{query ? 'No matches.' : 'No tenants yet. Add a tenant above.'}</p>
          )}
          {tree.map((tenant) => {
            const tenantOpen = tenantIsOpen(tenant);
            return (
            <section className={`tree-tenant ${tenantOpen ? 'open' : ''} ${isWalkHit(walkFocus, 'tenant', { id: tenant.id, name: tenant.name }) ? 'walk-pulse' : ''}`} key={tenant.id}>
              <button type="button" className={`list-item station-row tenant-row ${tenantOpen ? 'selected' : ''} ${isWalkHit(walkFocus, 'tenant', { id: tenant.id, name: tenant.name }) ? 'walk-pulse' : ''}`} onClick={() => toggleTenant(tenant)}>
                <div className="id">{tenant.name}</div>
                <div className="sub">
                  Tenant · {tenant.stations.length} station{tenant.stations.length === 1 ? '' : 's'} ·{' '}
                  {tenant.stations.reduce((n, s) => n + s.chargePoints.length, 0)} CP
                </div>
                <span className="tree-chevron" aria-hidden>
                  {tenantOpen ? '▾' : '▸'}
                </span>
              </button>
              {tenantOpen ? (
                <>
              {tenant.stations.map((site) => {
                const isOpen = openSiteId === site.id;
                const online = site.chargePoints.filter((cp) => cp.online).length;
                return (
                  <div className={`tree-station ${isOpen ? 'open' : ''} ${isWalkHit(walkFocus, 'site', { id: site.id, name: site.name }) ? 'walk-pulse' : ''}`} key={site.id}>
                    <button
                      type="button"
                      className={`list-item station-row ${openSiteId === site.id ? 'selected' : ''} ${isWalkHit(walkFocus, 'site', { id: site.id, name: site.name }) ? 'walk-pulse' : ''}`}
                      onClick={() => toggleStation(site, tenant)}
                    >
                      <div className="id">{site.name}</div>
                      <div className="sub">
                        {site.city || tenant.name} · {site.chargePoints.length} charge point
                        {site.chargePoints.length === 1 ? '' : 's'}
                        {site.chargePoints.length ? ` · ${online} online` : ''}
                      </div>
                      <span className="tree-chevron" aria-hidden>
                        {isOpen ? '▾' : '▸'}
                      </span>
                    </button>
                    {isOpen ? (
                      <>
                        {site.chargePoints.length === 0 ? (
                          <p className="tree-empty">No charge points at this station yet.</p>
                        ) : (
                          site.chargePoints.map((s) => (
                            <button
                              type="button"
                              key={s.stationId}
                              className={`list-item cp-row ${selected?.stationId === s.stationId ? 'selected' : ''} ${isWalkHit(walkFocus, 'cp', { id: s.stationId }) ? 'walk-pulse' : ''}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                openStation(site, tenant);
                                setSelectedStationId(s.stationId);
                              }}
                            >
                              <div className="id">{s.stationId}</div>
                              <div className="sub">
                                {s.identity?.vendorName || 'Unknown vendor'} · {s.identity?.model || '—'}
                                {s.transport ? ` · ${s.transport}` : ''}
                              </div>
                              <StatusBadge online={s.online} />
                              {s.enrolled && !s.online ? <span className="badge Pending">Enrolled</span> : null}
                              {s.simulated ? <span className="badge Pending">Simulated</span> : null}
                            </button>
                          ))
                        )}
                        {canEnroll && addingSiteId === site.id ? (
                          <form
                            className="form-row add-cp-inline"
                            onSubmit={(e) => enroll(e, site)}
                          >
                            <label className="field">
                              Charge point ID
                              <input
                                value={newId}
                                onChange={(e) => setNewId(e.target.value)}
                                placeholder="VF-CP-21"
                                autoFocus
                                required
                              />
                            </label>
                            <button className="btn primary" type="submit">
                              Add
                            </button>
                            <button type="button" className="btn" onClick={() => setAddingSiteId('')}>
                              Cancel
                            </button>
                          </form>
                        ) : canEnroll ? (
                          <button
                            type="button"
                            className="list-item cp-row add-cp"
                            onClick={(e) => {
                              e.stopPropagation();
                              openStation(site, tenant);
                              setAddingSiteId(site.id);
                            }}
                          >
                            <div className="id">+ Add charge point</div>
                            <div className="sub">Enroll a new OCPP ID at {site.name}</div>
                          </button>
                        ) : null}
                      </>
                    ) : null}
                  </div>
                );
              })}
              {canSite && addingTenantId === tenant.id ? (
                <form className="form-row add-cp-inline add-station-inline" onSubmit={(e) => addSite(e, tenant)}>
                  <label className="field">
                    Station name
                    <input
                      value={newSiteName}
                      onChange={(e) => setNewSiteName(e.target.value)}
                      placeholder="Whitefield Hub"
                      autoFocus
                      required
                    />
                  </label>
                  <label className="field">
                    City
                    <input
                      value={newSiteCity}
                      onChange={(e) => setNewSiteCity(e.target.value)}
                      placeholder="Optional city"
                    />
                  </label>
                  <button className="btn primary" type="submit">
                    Add
                  </button>
                  <button type="button" className="btn" onClick={() => setAddingTenantId('')}>
                    Cancel
                  </button>
                </form>
              ) : canSite ? (
                <button
                  type="button"
                  className="list-item add-cp add-station"
                  onClick={() => {
                    setTenantId(tenant.id);
                    setAddingTenantId(tenant.id);
                    setAddingSiteId('');
                  }}
                >
                  <div className="id">+ Add station</div>
                  <div className="sub">New site under {tenant.name}</div>
                </button>
              ) : null}
                </>
              ) : null}
            </section>
            );
          })}
          {canTenant && addingRootTenant ? (
            <form className="form-row add-cp-inline add-station-inline" onSubmit={addTenant}>
              <label className="field">
                Tenant name
                <input
                  value={newTenantName}
                  onChange={(e) => setNewTenantName(e.target.value)}
                  placeholder="Orbit Fleet"
                  autoFocus
                  required
                />
              </label>
              <button className="btn primary" type="submit" disabled={!newTenantName.trim()}>
                Add
              </button>
              <button type="button" className="btn" onClick={() => setAddingRootTenant(false)}>
                Cancel
              </button>
            </form>
          ) : canTenant ? (
            <button
              type="button"
              className="list-item add-cp add-station add-tenant"
              onClick={() => {
                setAddingRootTenant(true);
                setAddingTenantId('');
              }}
            >
              <div className="id">+ Add tenant</div>
              <div className="sub">New operator / CPO at the top of the tree</div>
            </button>
          ) : null}
        </div>
        <div data-tour="stations-detail">
          {!opened ? (
            <div className="card">
              <p className="empty">Click a station to see its charge points. Click it again to close.</p>
            </div>
          ) : null}
          {opened && selected?.siteId !== opened.site.id ? (
            <div className="card">
              <h3>{opened.site.name}</h3>
              <p className="muted">
                {opened.tenant.name}
                {opened.site.city ? ` · ${opened.site.city}` : ''} · {opened.site.chargePoints.length} charge point
                {opened.site.chargePoints.length === 1 ? '' : 's'}
              </p>
              {opened.site.chargePoints.length === 0 ? (
                <p className="empty">No charge points at this station yet.</p>
              ) : (
                opened.site.chargePoints.map((s) => (
                  <button
                    type="button"
                    key={s.stationId}
                    className="list-item"
                    onClick={() => setSelectedStationId(s.stationId)}
                  >
                    <div className="id">{s.stationId}</div>
                    <div className="sub">
                      {s.identity?.vendorName || 'Unknown vendor'} · {s.identity?.model || '—'}
                      {s.transport ? ` · ${s.transport}` : ''}
                    </div>
                    <StatusBadge online={s.online} />
                    {s.enrolled && !s.online ? <span className="badge Pending">Enrolled</span> : null}
                    {s.simulated ? <span className="badge Pending">Simulated</span> : null}
                  </button>
                ))
              )}
              {canEnroll || canSim ? (
              <form className="form-row" style={{ marginTop: '0.85rem' }} onSubmit={(e) => enroll(e, opened.site)}>
                {canEnroll ? (
                <label className="field">
                  Charge point ID
                  <input
                    value={newId}
                    onChange={(e) => setNewId(e.target.value)}
                    placeholder="VF-CP-21"
                    required
                  />
                </label>
                ) : null}
                {canEnroll ? (
                <button className="btn primary" type="submit">
                  Add charge point
                </button>
                ) : null}
                {canSim ? (
                <button
                  type="button"
                  className="btn"
                  onClick={() => simulate({ tenantId: opened.tenant.id, siteId: opened.site.id })}
                >
                  Simulate
                </button>
                ) : null}
              </form>
              ) : null}
            </div>
          ) : null}
          {opened && selected?.siteId === opened.site.id ? (
            <>
              <div className={`card ${isWalkHit(walkFocus, 'cp', { id: selected.stationId }) ? 'walk-pulse' : ''}`}>
                <h3>{selected.stationId}</h3>
                <p className="muted">
                  {selected.tenant?.name || '—'} · {selected.location?.name || '—'}
                  {selected.location?.city ? ` · ${selected.location.city}` : ''}
                </p>
                <p className="muted">
                  {selected.identity?.vendorName} {selected.identity?.model} · SN{' '}
                  {selected.identity?.serialNumber || '—'} · FW {selected.identity?.firmwareVersion || '—'}
                </p>
                <p className="muted">
                  Boot {selected.bootAt ? new Date(selected.bootAt).toLocaleString() : '—'} · Heartbeat{' '}
                  {selected.heartbeatAt ? new Date(selected.heartbeatAt).toLocaleString() : '—'}
                  {selected.transport ? ` · ${selected.transport}` : ''}
                </p>
                {canAssign ? (
                <label className="field" style={{ minWidth: '100%' }}>
                  Move to station
                  <select
                    value={selected.siteId || ''}
                    onChange={(e) => moveSelected(e.target.value)}
                  >
                    {tenants.map((t) => (
                      <optgroup key={t.id} label={t.name}>
                        {sites
                          .filter((s) => s.tenantId === t.id)
                          .sort((a, b) => (a.order ?? 99) - (b.order ?? 99))
                          .map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.name}
                              {s.city ? ` · ${s.city}` : ''}
                            </option>
                          ))}
                      </optgroup>
                    ))}
                  </select>
                </label>
                ) : null}
                <CopyField
                  label="Full WSS URL (ID already appended)"
                  value={selected.wssUrl || connectionUrls(selected.stationId, security).wssUrl}
                />
                <div className="evse-pills" style={{ marginTop: '0.75rem' }}>
                  {(selected.evses || []).length === 0 && <span className="muted">No EVSE status yet</span>}
                  {(selected.evses || []).map((e) => (
                    <span key={`${e.evseId}:${e.connectorId}`} className={`badge ${e.connectorStatus}`}>
                      EVSE {e.evseId} / C{e.connectorId} · {e.connectorStatus}
                    </span>
                  ))}
                </div>
              </div>
              {canCall ? (
              <div className="card">
                <h3>Remote operations</h3>
                <p className="muted">
                  Needs a <strong>live</strong> charge point (WebSocket open — see Live Trace for BootNotification) or a{' '}
                  <strong>(sim)</strong> station for instant demo responses. Offline enrolled IDs return an error immediately.
                </p>
                <div className="ops">
                  <button type="button" className="btn" disabled={!!busy} onClick={() => run('Reset', { type: 'OnIdle' })}>
                    Reset
                  </button>
                  <button
                    type="button"
                    className="btn"
                    disabled={!!busy}
                    onClick={() => run('ChangeAvailability', { operationalStatus: 'Operative', evse: { id: 1 } })}
                  >
                    ChangeAvailability
                  </button>
                  <button
                    type="button"
                    className="btn"
                    disabled={!!busy}
                    onClick={() => run('UnlockConnector', { evseId: 1, connectorId: 1 })}
                  >
                    UnlockConnector
                  </button>
                  <button
                    type="button"
                    className="btn"
                    disabled={!!busy}
                    onClick={() => run('TriggerMessage', { requestedMessage: 'Heartbeat' })}
                  >
                    TriggerMessage
                  </button>
                  <button type="button" className="btn" disabled={!!busy} onClick={() => run('ClearCache', {})}>
                    ClearCache
                  </button>
                  <button
                    type="button"
                    className="btn"
                    disabled={!!busy}
                    onClick={() => run('GetLocalListVersion', {})}
                  >
                    GetLocalListVersion
                  </button>
                </div>
                <div className="form-row" style={{ marginTop: '0.85rem' }}>
                  <label className="field">
                    Id token
                    <input value={idToken} onChange={(e) => setIdToken(e.target.value)} />
                  </label>
                  <label className="field" style={{ maxWidth: '5.5rem' }}>
                    EVSE
                    <select value={startEvseId} onChange={(e) => setStartEvseId(Number(e.target.value))}>
                      {(selected?.evses?.length ? selected.evses : [{ evseId: 1, connectorId: 1 }]).map((ev) => (
                        <option key={`${ev.evseId}:${ev.connectorId}`} value={ev.evseId}>
                          {ev.evseId}/{ev.connectorId}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    type="button"
                    className="btn primary"
                    disabled={!!busy}
                    onClick={() =>
                      run('RequestStartTransaction', {
                        idToken: { idToken, type: 'ISO14443' },
                        remoteStartId: Date.now() % 1e9,
                        evseId: startEvseId,
                      })
                    }
                  >
                    RequestStart
                  </button>
                </div>
                <div className="form-row">
                  <button
                    type="button"
                    className="btn"
                    disabled={!!busy || !stopTxId}
                    onClick={() => run('RequestStopTransaction', { transactionId: stopTxId })}
                  >
                    RequestStop
                  </button>
                </div>

                {activeTxForStation.length ? (
                  <p className="muted" style={{ marginTop: '0.5rem' }}>
                    Active Tx: <code>{activeTxForStation[0].transactionId}</code>
                  </p>
                ) : (
                  <p className="muted" style={{ marginTop: '0.5rem' }}>
                    No active transaction detected on this station.
                  </p>
                )}

                <hr style={{ margin: '1rem 0' }} />

                <h3 style={{ marginTop: 0 }}>CSMS → CS actions</h3>
                <div className="form-row" style={{ alignItems: 'flex-end' }}>
                  <label className="field" style={{ marginRight: '0.75rem' }}>
                    Block
                    <select value={actionBlock} onChange={(e) => setActionBlock(e.target.value)}>
                      <option value="All">All</option>
                      {blocks.map((b) => (
                        <option key={b} value={b}>
                          {b}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <div className="action-grid" style={{ marginTop: '0.6rem' }}>
                  {visibleActions.map((item) => (
                    <button
                      type="button"
                      key={item.action}
                      className={`action-chip ${selectedAction?.action === item.action ? 'active' : ''}`}
                      disabled={!!busy}
                      onClick={() => pickAction(item)}
                    >
                      {item.action}
                      <small>{item.block}</small>
                    </button>
                  ))}
                </div>

                {selectedAction ? (
                  <div style={{ marginTop: '0.85rem' }}>
                    {selectedAction.purpose && <p className="muted">{selectedAction.purpose}</p>}
                    <p className="muted">
                      Payload for <code>{selectedAction.action}</code> (defaults prefilled). Edit and send.
                    </p>
                    <JsonEditor value={payloadText} onChange={setPayloadText} rows={10} />
                    <div className="ops" style={{ marginTop: '0.65rem' }}>
                      <button
                        type="button"
                        className="btn primary"
                        disabled={!!busy || !selected?.stationId}
                        onClick={async () => {
                          let parsed = {};
                          try {
                            parsed = JSON.parse(payloadText || '{}');
                          } catch {
                            setError('Payload is not valid JSON');
                            return;
                          }
                          try {
                            await run(selectedAction.action, parsed);
                          } catch (e) {
                            setError(e?.message || String(e));
                          }
                        }}
                      >
                        Send CALL
                      </button>
                    </div>
                  </div>
                ) : null}
                {busy ? <p className="muted">Sending {busy}…</p> : null}
                <CallResultPanel result={callResult} onClear={() => setCallResult(null)} />
              </div>
              ) : null}
            </>
          ) : null}
        </div>
      </div>
    </>
  );
}
