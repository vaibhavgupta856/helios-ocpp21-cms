export function sortChargePoints(list = []) {
  return [...list].sort((a, b) => {
    const tenantOrder = (a.tenant?.order ?? 99) - (b.tenant?.order ?? 99);
    if (tenantOrder) return tenantOrder;
    const tenantName = String(a.tenant?.name || '').localeCompare(String(b.tenant?.name || ''));
    if (tenantName) return tenantName;
    const siteOrder = (a.location?.order ?? 99) - (b.location?.order ?? 99);
    if (siteOrder) return siteOrder;
    const siteName = String(a.location?.name || '').localeCompare(String(b.location?.name || ''));
    if (siteName) return siteName;
    const cpOrder = (a.cpOrder ?? 99) - (b.cpOrder ?? 99);
    if (cpOrder) return cpOrder;
    return String(a.stationId).localeCompare(String(b.stationId));
  });
}

export function buildOrgTree({ tenants = [], sites = [], stations = [], query = '' } = {}) {
  const q = String(query || '').trim().toLowerCase();
  const hit = (value) => !q || String(value || '').toLowerCase().includes(q);

  const cpsBySite = new Map();
  for (const cp of sortChargePoints(stations)) {
    const sid = cp.siteId || cp.location?.id || '_none';
    if (!cpsBySite.has(sid)) cpsBySite.set(sid, []);
    cpsBySite.get(sid).push(cp);
  }

  return [...tenants]
    .sort((a, b) => (a.order ?? 99) - (b.order ?? 99) || String(a.name).localeCompare(String(b.name)))
    .map((tenant) => {
      const tenantHit = hit(tenant.name);
      const stationsForTenant = [...sites]
        .filter((site) => site.tenantId === tenant.id)
        .sort((a, b) => (a.order ?? 99) - (b.order ?? 99) || String(a.name).localeCompare(String(b.name)))
        .map((site) => {
          const cps = cpsBySite.get(site.id) || [];
          const siteHit = tenantHit || hit(site.name) || hit(site.city);
          const filtered = q
            ? cps.filter(
                (cp) =>
                  siteHit ||
                  hit(cp.stationId) ||
                  hit(cp.identity?.model) ||
                  hit(cp.identity?.vendorName)
              )
            : cps;
          return { ...site, chargePoints: filtered, _keep: !q || siteHit || filtered.length > 0 };
        })
        .filter((site) => site._keep);
      return { ...tenant, stations: stationsForTenant, _keep: !q || tenantHit || stationsForTenant.length > 0 };
    })
    .filter((tenant) => tenant._keep);
}

export function stationLabel(cp) {
  if (!cp) return '';
  const tenant = cp.tenant?.name;
  const site = cp.location?.name;
  if (tenant && site) return `${tenant} · ${site}`;
  return site || tenant || '';
}
