/**
 * Operator org: tenants → stations (sites) → charge points (OCPP stationId).
 * Charge-point identity stays the OCPP id; this layer only groups and orders them.
 */

import { nowIso } from './ocpp/catalog.js';

export const SEEDED_TENANTS = [
  { id: 'tenant-massive', name: 'Helios', order: 1 },
  { id: 'tenant-orbit', name: 'Orbit Fleet', order: 2 },
  { id: 'tenant-voltride', name: 'VoltRide', order: 3 },
  { id: 'tenant-himalaya', name: 'Himalaya EV', order: 4 },
];

export const CITY_GEO = {
  Bengaluru: { lat: 12.9716, lng: 77.5946 },
  Hyderabad: { lat: 17.385, lng: 78.4867 },
  Pune: { lat: 18.5204, lng: 73.8567 },
  Gurugram: { lat: 28.4595, lng: 77.0266 },
  Mumbai: { lat: 19.076, lng: 72.8777 },
  Chennai: { lat: 13.0827, lng: 80.2707 },
  Delhi: { lat: 28.6139, lng: 77.209 },
  Noida: { lat: 28.5355, lng: 77.391 },
  Jaipur: { lat: 26.9124, lng: 75.7873 },
  Ahmedabad: { lat: 23.0225, lng: 72.5714 },
  Kochi: { lat: 9.9312, lng: 76.2673 },
  Kolkata: { lat: 22.5726, lng: 88.3639 },
  Chandigarh: { lat: 30.7333, lng: 76.7794 },
};

export const SEEDED_SITES = [
  { id: 'site-blr-whitefield', tenantId: 'tenant-massive', name: 'Whitefield Hub', city: 'Bengaluru', order: 1, ...CITY_GEO.Bengaluru },
  { id: 'site-hyd-hitech', tenantId: 'tenant-massive', name: 'Hitech City', city: 'Hyderabad', order: 2, ...CITY_GEO.Hyderabad },
  { id: 'site-pun-kharadi', tenantId: 'tenant-massive', name: 'Kharadi Depot', city: 'Pune', order: 3, ...CITY_GEO.Pune },
  { id: 'site-ggm-cyber', tenantId: 'tenant-massive', name: 'Cyber Hub', city: 'Gurugram', order: 4, ...CITY_GEO.Gurugram },
  { id: 'site-blr-koramangala', tenantId: 'tenant-massive', name: 'Koramangala Hub', city: 'Bengaluru', order: 5, ...CITY_GEO.Bengaluru },
  { id: 'site-blr-indiranagar', tenantId: 'tenant-massive', name: 'Indiranagar Hub', city: 'Bengaluru', order: 6, ...CITY_GEO.Bengaluru },
  { id: 'site-blr-ecity', tenantId: 'tenant-massive', name: 'Electronic City', city: 'Bengaluru', order: 7, ...CITY_GEO.Bengaluru },
  { id: 'site-hyd-gachibowli', tenantId: 'tenant-massive', name: 'Gachibowli Plaza', city: 'Hyderabad', order: 8, ...CITY_GEO.Hyderabad },
  { id: 'site-hyd-banjara', tenantId: 'tenant-massive', name: 'Banjara Hills', city: 'Hyderabad', order: 9, ...CITY_GEO.Hyderabad },
  { id: 'site-pun-hinjawadi', tenantId: 'tenant-massive', name: 'Hinjawadi Depot', city: 'Pune', order: 10, ...CITY_GEO.Pune },
  { id: 'site-mum-bkc', tenantId: 'tenant-orbit', name: 'BKC Depot', city: 'Mumbai', order: 1, ...CITY_GEO.Mumbai },
  { id: 'site-che-omr', tenantId: 'tenant-orbit', name: 'OMR Plaza', city: 'Chennai', order: 2, ...CITY_GEO.Chennai },
  { id: 'site-mum-andheri', tenantId: 'tenant-orbit', name: 'Andheri West', city: 'Mumbai', order: 3, ...CITY_GEO.Mumbai },
  { id: 'site-mum-powai', tenantId: 'tenant-orbit', name: 'Powai Lakeside', city: 'Mumbai', order: 4, ...CITY_GEO.Mumbai },
  { id: 'site-che-velachery', tenantId: 'tenant-orbit', name: 'Velachery Depot', city: 'Chennai', order: 5, ...CITY_GEO.Chennai },
  { id: 'site-del-cp', tenantId: 'tenant-voltride', name: 'Connaught Place', city: 'Delhi', order: 1, ...CITY_GEO.Delhi },
  { id: 'site-noid-18', tenantId: 'tenant-voltride', name: 'Noida Sector 18', city: 'Noida', order: 2, ...CITY_GEO.Noida },
  { id: 'site-jai-civil', tenantId: 'tenant-voltride', name: 'Jaipur Civil Lines', city: 'Jaipur', order: 3, ...CITY_GEO.Jaipur },
  { id: 'site-amd-sg', tenantId: 'tenant-voltride', name: 'SG Highway', city: 'Ahmedabad', order: 4, ...CITY_GEO.Ahmedabad },
  { id: 'site-chd-it', tenantId: 'tenant-himalaya', name: 'Chandigarh IT Park', city: 'Chandigarh', order: 1, ...CITY_GEO.Chandigarh },
  { id: 'site-cok-infopark', tenantId: 'tenant-himalaya', name: 'Kochi Infopark', city: 'Kochi', order: 2, ...CITY_GEO.Kochi },
  { id: 'site-ccu-saltlake', tenantId: 'tenant-himalaya', name: 'Salt Lake Hub', city: 'Kolkata', order: 3, ...CITY_GEO.Kolkata },
];

function hashId(id) {
  let n = 0;
  for (const c of String(id)) n = (n * 31 + c.charCodeAt(0)) >>> 0;
  return n;
}

export function attachOrg(registry) {
  registry.tenants = new Map();
  registry.sites = new Map();
  registry.cpOrg = new Map();
  registry.tenantSeq = SEEDED_TENANTS.length + 1;
  registry.siteSeq = SEEDED_SITES.length + 1;
  for (const t of SEEDED_TENANTS) {
    registry.tenants.set(t.id, { ...t, createdAt: nowIso() });
  }
  for (const s of SEEDED_SITES) {
    registry.sites.set(s.id, { ...s, createdAt: nowIso() });
  }
}

export function listTenants(registry) {
  return [...(registry.tenants?.values() || [])].sort(
    (a, b) => (a.order ?? 99) - (b.order ?? 99) || String(a.name).localeCompare(String(b.name))
  );
}

export function listSites(registry, tenantId) {
  let list = [...(registry.sites?.values() || [])];
  if (tenantId) list = list.filter((s) => s.tenantId === tenantId);
  return list.sort(
    (a, b) => (a.order ?? 99) - (b.order ?? 99) || String(a.name).localeCompare(String(b.name))
  );
}

export function orgSnapshot(registry) {
  return {
    tenants: listTenants(registry),
    sites: listSites(registry),
  };
}

export function emitOrg(registry) {
  registry.emitStore?.();
  registry.io?.emit('cms:org', orgSnapshot(registry));
  if (typeof registry.listStations === 'function') {
    registry.io?.emit('cms:stations', registry.listStations());
  }
}

export function addTenant(registry, body = {}) {
  const name = String(body.name || '').trim();
  if (!name) throw new Error('Tenant name is required');
  const existing = listTenants(registry).find((t) => String(t.name).toLowerCase() === name.toLowerCase());
  if (existing) return existing;
  const id = String(body.id || `tenant-${registry.tenantSeq++}`).trim();
  if (registry.tenants.has(id)) throw new Error('Tenant already exists');
  const rec = {
    id,
    name,
    order: Number.isFinite(Number(body.order)) ? Number(body.order) : registry.tenants.size + 1,
    createdAt: nowIso(),
  };
  registry.tenants.set(id, rec);
  emitOrg(registry);
  return rec;
}

export function addSite(registry, body = {}) {
  const tenantId = String(body.tenantId || '').trim();
  const name = String(body.name || '').trim();
  if (!tenantId) throw new Error('tenantId is required');
  if (!registry.tenants.has(tenantId)) throw new Error('Tenant not found');
  if (!name) throw new Error('Station name is required');
  const existing = listSites(registry, tenantId).find((s) => String(s.name).toLowerCase() === name.toLowerCase());
  if (existing) return existing;
  const id = String(body.id || `site-${registry.siteSeq++}`).trim();
  if (registry.sites.has(id)) throw new Error('Station already exists');
  const city = String(body.city || '').trim();
  const geo = CITY_GEO[city] || {
    lat: Number(body.lat) || 20.5937,
    lng: Number(body.lng) || 78.9629,
  };
  const rec = {
    id,
    tenantId,
    name,
    city,
    lat: geo.lat,
    lng: geo.lng,
    order: Number.isFinite(Number(body.order)) ? Number(body.order) : listSites(registry, tenantId).length + 1,
    createdAt: nowIso(),
  };
  registry.sites.set(id, rec);
  emitOrg(registry);
  return rec;
}

export function assignChargePoint(registry, stationId, opts = {}) {
  if (!registry.cpOrg) registry.cpOrg = new Map();
  const existing = registry.cpOrg.get(stationId);
  let tenantId = opts.tenantId || existing?.tenantId;
  let siteId = opts.siteId || existing?.siteId;

  if (siteId && registry.sites?.has(siteId)) {
    tenantId = registry.sites.get(siteId).tenantId;
  } else {
    siteId = null;
  }

  if (!siteId) {
    const pool = tenantId ? listSites(registry, tenantId) : listSites(registry);
    const pick = pool[hashId(stationId) % Math.max(1, pool.length)];
    siteId = pick?.id || null;
    tenantId = pick?.tenantId || tenantId || listTenants(registry)[0]?.id || null;
  }

  const tenant = tenantId ? registry.tenants.get(tenantId) : null;
  const site = siteId ? registry.sites.get(siteId) : null;
  const peers = [...registry.cpOrg.values()].filter((c) => c.siteId === siteId && c.stationId !== stationId);
  const order =
    existing?.siteId === siteId && existing?.order != null
      ? existing.order
      : Number.isFinite(Number(opts.order))
        ? Number(opts.order)
        : peers.length + 1;

  const rec = { stationId, tenantId, siteId, order };
  registry.cpOrg.set(stationId, rec);
  return { ...rec, tenant, site };
}

export function compareChargePoints(registry, a, b) {
  const oa = registry.cpOrg?.get(a.stationId) || {};
  const ob = registry.cpOrg?.get(b.stationId) || {};
  const ta = registry.tenants?.get(oa.tenantId);
  const tb = registry.tenants?.get(ob.tenantId);
  const sa = registry.sites?.get(oa.siteId);
  const sb = registry.sites?.get(ob.siteId);
  return (
    (ta?.order ?? 99) - (tb?.order ?? 99) ||
    String(ta?.name || '').localeCompare(String(tb?.name || '')) ||
    (sa?.order ?? 99) - (sb?.order ?? 99) ||
    String(sa?.name || '').localeCompare(String(sb?.name || '')) ||
    (oa.order ?? 99) - (ob.order ?? 99) ||
    String(a.stationId).localeCompare(String(b.stationId))
  );
}
