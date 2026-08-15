/**
 * Client walkthrough: Helios leaves Ask Helios and reads/writes the real pages.
 */

function isGeneralCs(q) {
  if (/\b(dijkstra|bfs|dfs|binary search|bellman|a\*|astar)\b/.test(q)) return true;
  return (
    /^(explain|what is|what's|whats|define|how does|how do|describe|tell me about)\b/.test(q) &&
    !/\b(station|tenant|ocpp|wss|tariff|session|revenue|online|hub|cms|csms|charger)\b/.test(q)
  );
}

export function looksIncomplete(question) {
  const q = String(question || '').trim();
  return /^(add|create|enroll|simulate|move|block|set)\s+(a\s+|an\s+|new\s+|the\s+)?(cp|charge\s*points?|chargers?|stations?|sites?|hubs?|depots?|tenants?|tokens?|tariffs?|reservations?)\s*\.?$/i.test(
    q
  );
}

export function planWalkFromResult(result, mode) {
  const mutate = mode === 'agent' || mode === 'multitask';
  if (!mutate || result?.needsInput) return [];
  const ok = (result.executedActions || []).filter((a) => a.ok);
  if (!ok.length) return [];
  const steps = [];
  const org = ok.some((t) =>
    ['addStation', 'addChargePoint', 'simulateChargePoint', 'moveChargePoint'].includes(t.tool)
  );

  for (const a of ok) {
    if (a.tool === 'addTenant') {
      steps.push({
        view: 'stations',
        action: 'write',
        ms: 1600,
        caption: `On Stations — adding tenant ${a.name || ''} at the top of the tree…`,
      });
    }
    if (a.tool === 'addStation') {
      steps.push({
        view: 'stations',
        action: 'write',
        ms: 1600,
        caption: `On Stations — adding hub ${a.name || ''} under that tenant…`,
      });
    }
    if (a.tool === 'addChargePoint') {
      steps.push({
        view: 'stations',
        action: 'write',
        ms: 2000,
        caption: `On Stations — enrolling ${a.stationId || 'the charge point'}. Watch the tree and the detail pane…`,
      });
    }
    if (a.tool === 'simulateChargePoint') {
      steps.push({
        view: 'stations',
        action: 'write',
        ms: 1800,
        caption: `On Stations — simulating ${a.stationId || 'a charger'} so it shows online in the lab…`,
      });
    }
    if (a.tool === 'moveChargePoint') {
      steps.push({
        view: 'stations',
        action: 'write',
        ms: 1600,
        caption: `On Stations — moving ${a.stationId || 'the charge point'} to the new hub…`,
      });
    }
    if (a.tool === 'addToken' || a.tool === 'blockToken') {
      steps.push({
        view: 'tokens',
        action: 'write',
        ms: 1400,
        caption: `On RFID & tokens — ${a.tool === 'blockToken' ? 'blocking' : 'saving'} ${a.idToken || 'the token'}…`,
      });
    }
    if (a.tool === 'addTariff' || a.tool === 'setDefaultTariff') {
      steps.push({
        view: 'tariffs',
        action: 'write',
        ms: 1400,
        caption:
          a.tool === 'setDefaultTariff'
            ? `On Tariffs — setting ${a.tariffId || 'the tariff'} as default…`
            : `On Tariffs — saving ${a.tariffId || 'the tariff'} in the book…`,
      });
    }
    if (a.tool === 'addReservation') {
      steps.push({
        view: 'display',
        action: 'write',
        ms: 1200,
        caption: 'On Display & Reservations — saving the reservation…',
      });
    }
    if (a.tool === 'saveSite') {
      steps.push({
        view: 'sites',
        action: 'write',
        ms: 1400,
        caption: 'On Site planner — saving the candidate city…',
      });
    }
  }

  if (org) {
    steps.push({
      view: 'twin',
      action: 'read',
      ms: 1600,
      caption: 'Opening Digital twin — the map should show the new pin…',
    });
    steps.push({
      view: 'stations',
      action: 'read',
      ms: 1800,
      caption: 'Back on Stations — the new row stays highlighted.',
    });
  }

  return steps;
}

export function planWalk(question, mode) {
  const q = String(question || '').toLowerCase();
  if (!q || isGeneralCs(q) || looksIncomplete(question)) return [];
  const mutate = mode === 'agent' || mode === 'multitask';
  const steps = [];
  const org = /\b(tenant|station|site|hub|depot|charge\s*point|charger|enroll|simulate)\b/.test(q);
  const token = /\b(token|rfid)\b/.test(q) && /\b(add|create|block|register)\b/.test(q);
  const tariff = /\btariff\b/.test(q) && /\b(add|create|set)\b/.test(q);
  const reserv = /\breserv/.test(q) && /\b(add|create)\b/.test(q);
  const sitePlan = /\b(site planner|next site|save .*\bsite)\b/.test(q);

  if (mutate) {
    if (org) {
      steps.push({
        view: 'stations',
        action: 'read',
        ms: 1300,
        caption: 'Opening Stations — checking tenants, hubs, and charge points…',
      });
      steps.push({
        view: 'stations',
        action: 'write',
        ms: 800,
        caption: 'Saving that in the CMS…',
      });
    }
    if (token) {
      steps.push({ view: 'tokens', action: 'read', ms: 900, caption: 'Opening RFID & tokens — reading the list…' });
      steps.push({ view: 'tokens', action: 'write', ms: 600, caption: 'Updating the token store…' });
    }
    if (tariff) {
      steps.push({ view: 'tariffs', action: 'read', ms: 900, caption: 'Opening Tariffs — reading the book…' });
      steps.push({ view: 'tariffs', action: 'write', ms: 600, caption: 'Saving the tariff…' });
    }
    if (reserv) {
      steps.push({ view: 'display', action: 'write', ms: 800, caption: 'Opening Display & Reservations…' });
    }
    if (sitePlan) {
      steps.push({ view: 'sites', action: 'write', ms: 900, caption: 'Opening Site planner…' });
    }
    if (steps.length) {
      steps.push({
        view: 'dashboard',
        action: 'read',
        ms: 1500,
        caption: 'Checking the dashboard to confirm it landed…',
      });
    }
    return steps;
  }

  if (mode === 'plan') return [];

  if (org || /\b(keep|remove|close|whitefield|hitech|kharadi|cyber|bkc|omr)\b/.test(q)) {
    steps.push({
      view: 'stations',
      action: 'read',
      ms: 1500,
      caption: 'Opening Stations to read that hub in the tree…',
    });
    if (/\b(add|create|enroll|simulate)\b/.test(q)) {
      steps.push({
        view: 'assistant',
        action: 'read',
        ms: 500,
        caption: 'Back to Ask Helios — nothing was changed. Use Run in Agent to apply.',
      });
      return steps;
    }
  }
  if (
    /\b(online|revenue|kpi|dashboard|utiliz|session|outage|lost|inventory|who is)\b/.test(q) ||
    steps.length
  ) {
    steps.push({
      view: 'dashboard',
      action: 'read',
      ms: 1400,
      caption: 'Reading live KPIs on the dashboard…',
    });
  }
  return steps;
}

export function guessFocus(question, org = {}) {
  const q = String(question || '').toLowerCase();
  const tenants = org.tenants || [];
  const sites = org.sites || [];
  const stations = org.stations || [];
  const tokens = org.tokens || [];
  const tariffs = org.tariffs || [];

  const namedTenant = q.match(/\btenant\s+(?:named\s+|called\s+)?["']?([a-z0-9 ._-]{2,60}?)["']?(?=\s+with|\s+and|\s*$)/i);
  const namedSite = q.match(
    /\b(?:station|site|hub)\s+(?:named\s+|called\s+)?["']?([a-z0-9 ._-]{2,80}?)["']?(?=\s+in\s+|\s+and\s+|\s*$)/i
  );

  const site =
    sites.find((s) => s.name && q.includes(String(s.name).toLowerCase())) ||
    sites.find((s) => s.city && q.includes(String(s.city).toLowerCase())) ||
    (namedSite
      ? sites.find((s) => String(s.name).toLowerCase().includes(namedSite[1].trim().toLowerCase()))
      : null);
  const tenant =
    tenants.find((t) => t.name && q.includes(String(t.name).toLowerCase())) ||
    (namedTenant
      ? tenants.find((t) => String(t.name).toLowerCase().includes(namedTenant[1].trim().toLowerCase()))
      : null) ||
    (site ? tenants.find((t) => t.id === site.tenantId) : null);
  const cp = stations.find((s) => s.stationId && q.includes(String(s.stationId).toLowerCase()));
  const token = tokens.find((t) => t.idToken && q.toLowerCase().includes(String(t.idToken).toLowerCase()));
  const tariff = tariffs.find((t) => t.tariffId && q.toLowerCase().includes(String(t.tariffId).toLowerCase()));

  return {
    tenantId: tenant?.id || site?.tenantId || '',
    tenantName: tenant?.name || namedTenant?.[1]?.trim() || '',
    siteId: site?.id || '',
    siteName: site?.name || namedSite?.[1]?.trim() || '',
    stationId: cp?.stationId || '',
    tokenId: token?.idToken || '',
    tariffId: tariff?.tariffId || '',
  };
}

export function focusFromResult(result) {
  const focus = {
    tenantId: '',
    tenantName: '',
    siteId: '',
    siteName: '',
    stationId: '',
    tokenId: '',
    tariffId: '',
  };
  for (const a of result?.executedActions || []) {
    if (!a?.ok) continue;
    if (a.tool === 'addTenant') {
      focus.tenantId = a.tenantId || focus.tenantId;
      focus.tenantName = a.name || focus.tenantName;
    }
    if (a.tool === 'addStation') {
      focus.siteId = a.siteId || focus.siteId;
      focus.siteName = a.name || focus.siteName;
      focus.tenantId = a.tenantId || focus.tenantId;
    }
    if (a.tool === 'addChargePoint' || a.tool === 'simulateChargePoint' || a.tool === 'moveChargePoint') {
      focus.stationId = a.stationId || focus.stationId;
      focus.siteId = a.siteId || focus.siteId;
      focus.tenantId = a.tenantId || focus.tenantId;
    }
    if (a.tool === 'addToken' || a.tool === 'blockToken') {
      focus.tokenId = a.idToken || focus.tokenId;
    }
    if (a.tool === 'addTariff' || a.tool === 'setDefaultTariff') {
      focus.tariffId = a.tariffId || focus.tariffId;
    }
  }
  return focus;
}

export function mergeFocus(a = {}, b = {}) {
  return {
    tenantId: b.tenantId || a.tenantId || '',
    tenantName: b.tenantName || a.tenantName || '',
    siteId: b.siteId || a.siteId || '',
    siteName: b.siteName || a.siteName || '',
    stationId: b.stationId || a.stationId || '',
    tokenId: b.tokenId || a.tokenId || '',
    tariffId: b.tariffId || a.tariffId || '',
  };
}

export function enrichFocus(focus = {}, org = {}) {
  const stations = org.stations || [];
  const sites = org.sites || [];
  const tenants = org.tenants || [];
  const cp = focus.stationId
    ? stations.find((s) => String(s.stationId) === String(focus.stationId))
    : null;
  const site =
    (focus.siteId && sites.find((s) => s.id === focus.siteId)) ||
    (cp?.siteId && sites.find((s) => s.id === cp.siteId)) ||
    (focus.siteName &&
      sites.find((s) => String(s.name).toLowerCase() === String(focus.siteName).toLowerCase())) ||
    null;
  const tenant =
    (focus.tenantId && tenants.find((t) => t.id === focus.tenantId)) ||
    (cp?.tenantId && tenants.find((t) => t.id === cp.tenantId)) ||
    (site?.tenantId && tenants.find((t) => t.id === site.tenantId)) ||
    (focus.tenantName &&
      tenants.find((t) => String(t.name).toLowerCase() === String(focus.tenantName).toLowerCase())) ||
    null;
  return {
    tenantId: tenant?.id || cp?.tenantId || site?.tenantId || focus.tenantId || '',
    tenantName: tenant?.name || focus.tenantName || '',
    siteId: site?.id || cp?.siteId || focus.siteId || '',
    siteName: site?.name || focus.siteName || '',
    stationId: cp?.stationId || focus.stationId || '',
    tokenId: focus.tokenId || '',
    tariffId: focus.tariffId || '',
  };
}

export function isWalkHit(focus, kind, ids = {}) {
  if (!focus) return false;
  const same = (a, b) => a && b && String(a).toLowerCase() === String(b).toLowerCase();
  if (kind === 'tenant') return focus.tenantId === ids.id || same(focus.tenantName, ids.name);
  if (kind === 'site') return focus.siteId === ids.id || same(focus.siteName, ids.name);
  if (kind === 'cp') return focus.stationId === ids.id;
  if (kind === 'token') return same(focus.tokenId, ids.id);
  if (kind === 'tariff') return same(focus.tariffId, ids.id);
  return false;
}

export function hudAnswer(result) {
  const ok = (result?.executedActions || []).filter((a) => a.ok).map((a) => a.summary);
  if (ok.length) return ok.join(' · ');
  const text = String(result?.answer || '')
    .replace(/\*\*/g, '')
    .replace(/\n+/g, ' ')
    .trim();
  return text.slice(0, 220);
}
