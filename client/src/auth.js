const USER_KEY = 'massive-cms-user';

export function getCurrentUserId() {
  try {
    return localStorage.getItem(USER_KEY) || 'user-anika';
  } catch {
    return 'user-anika';
  }
}

export function setCurrentUserId(id) {
  try {
    localStorage.setItem(USER_KEY, id);
  } catch {
    /* ignore */
  }
}

export function can(user, perm) {
  if (!user || !perm) return false;
  const perms = user.permissions || [];
  if (perms.includes('*') || perms.includes(perm)) return true;
  const ns = String(perm).split('.')[0];
  return perms.includes(`${ns}.*`);
}

export function allowedModes(user) {
  return ['ask', 'agent'].filter((m) => can(user, `assistant.${m}`));
}

export function scopeOrg(user, { tenants = [], sites = [], stations = [] } = {}) {
  if (!user || can(user, '*') || user.role === 'admin') {
    return { tenants, sites, stations };
  }
  const tset = new Set(user.tenantIds || []);
  const sset = new Set(user.siteIds || []);
  if (!tset.size && !sset.size) return { tenants, sites, stations };
  const nextSites = sites.filter((s) => sset.has(s.id) || tset.has(s.tenantId));
  const siteIds = new Set(nextSites.map((s) => s.id));
  const nextTenants = tenants.filter((t) => tset.has(t.id) || nextSites.some((s) => s.tenantId === t.id));
  const nextStations = stations.filter(
    (st) => siteIds.has(st.siteId) || tset.has(st.tenantId) || sset.has(st.siteId)
  );
  return { tenants: nextTenants, sites: nextSites, stations: nextStations };
}
