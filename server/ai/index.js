/**
 * Lab AI ops: KPI history, proposed OCPP actions, demand, site planner.
 * Simulated weather/geo only — no Google Maps or live weather APIs.
 */

import { nowIso, defaultCsmsPayload } from '../ocpp/catalog.js';
import { listSites, listTenants } from '../org.js';

const CITIES = [
  { city: 'Bengaluru', lat: 12.9716, lng: 77.5946, evDensity: 0.82, traffic: 0.78, catchment: 42000, climate: { base: 24.8, amp: 6.2, rainOffset: 0, weekendLift: 1.2 } },
  { city: 'Hyderabad', lat: 17.385, lng: 78.4867, evDensity: 0.71, traffic: 0.74, catchment: 38000, climate: { base: 31.2, amp: 8.5, rainOffset: 1, weekendLift: 1.12 } },
  { city: 'Pune', lat: 18.5204, lng: 73.8567, evDensity: 0.64, traffic: 0.7, catchment: 31000, climate: { base: 26.4, amp: 7, rainOffset: 2, weekendLift: 1.16 } },
  { city: 'Gurugram', lat: 28.4595, lng: 77.0266, evDensity: 0.88, traffic: 0.86, catchment: 36000, climate: { base: 33.1, amp: 10.2, rainOffset: 3, weekendLift: 1.08 } },
  { city: 'Mumbai', lat: 19.076, lng: 72.8777, evDensity: 0.76, traffic: 0.91, catchment: 54000, climate: { base: 29.4, amp: 3.8, rainOffset: 0, weekendLift: 1.26 } },
  { city: 'Chennai', lat: 13.0827, lng: 80.2707, evDensity: 0.58, traffic: 0.72, catchment: 29000, climate: { base: 32, amp: 4.5, rainOffset: 4, weekendLift: 1.14 } },
  { city: 'Delhi', lat: 28.6139, lng: 77.209, evDensity: 0.9, traffic: 0.88, catchment: 62000, climate: { base: 32.4, amp: 9.5, rainOffset: 2, weekendLift: 1.1 } },
  { city: 'Noida', lat: 28.5355, lng: 77.391, evDensity: 0.84, traffic: 0.8, catchment: 28000, climate: { base: 32.8, amp: 10, rainOffset: 2, weekendLift: 1.09 } },
  { city: 'Jaipur', lat: 26.9124, lng: 75.7873, evDensity: 0.52, traffic: 0.61, catchment: 18000, climate: { base: 33.6, amp: 11, rainOffset: 5, weekendLift: 1.18 } },
  { city: 'Ahmedabad', lat: 23.0225, lng: 72.5714, evDensity: 0.6, traffic: 0.68, catchment: 24000, climate: { base: 34.2, amp: 9.8, rainOffset: 4, weekendLift: 1.14 } },
  { city: 'Kochi', lat: 9.9312, lng: 76.2673, evDensity: 0.55, traffic: 0.66, catchment: 16000, climate: { base: 29.8, amp: 3.2, rainOffset: 1, weekendLift: 1.22 } },
  { city: 'Kolkata', lat: 22.5726, lng: 88.3639, evDensity: 0.57, traffic: 0.77, catchment: 33000, climate: { base: 30.1, amp: 6.4, rainOffset: 2, weekendLift: 1.2 } },
  { city: 'Chandigarh', lat: 30.7333, lng: 76.7794, evDensity: 0.63, traffic: 0.58, catchment: 14000, climate: { base: 28.4, amp: 9.1, rainOffset: 3, weekendLift: 1.15 } },
];

const COMPETITORS = [
  { name: 'ChargeZone Hub', offsetKm: 1.2 },
  { name: 'Tata Power EZ', offsetKm: 2.8 },
  { name: 'BP Pulse', offsetKm: 4.1 },
];

function hashId(id) {
  let n = 0;
  for (const c of String(id)) n = (n * 31 + c.charCodeAt(0)) >>> 0;
  return n;
}

export function labWeather(at = new Date(), cityName = '') {
  const hour = at.getHours();
  const day = at.getDate();
  const city = CITIES.find((c) => c.city === cityName);
  const climate = city?.climate || { base: 26, amp: 7, rainOffset: 0, weekendLift: 1.22 };
  const weekend = at.getDay() === 0 || at.getDay() === 6;
  const holiday = at.getDay() === 0 || day === 15 || day === 26;
  const rainCycle = (day + climate.rainOffset) % 7;
  const rain = rainCycle === 3 || rainCycle === 4 || (cityName === 'Mumbai' && rainCycle === 2);
  const hot = !rain && hour >= 11 && hour <= 17;
  const tempC = Number(
    (climate.base + climate.amp * Math.sin(((hour - 7) / 24) * Math.PI * 2) + (weekend ? 1.2 : 0) - (rain ? 4.2 : 0)).toFixed(1)
  );
  return {
    at: at.toISOString(),
    city: cityName || null,
    tempC,
    condition: rain ? 'Rain' : hot ? 'Hot / clear' : hour < 6 || hour > 20 ? 'Mild evening' : 'Clear',
    rain,
    hot,
    weekend,
    holiday,
    demandFactor: Number(
      ((weekend ? climate.weekendLift : 1) * (holiday ? 1.12 : 1) * (hot ? 1.16 : 1) * (rain ? 0.82 : 1)).toFixed(3)
    ),
  };
}

export function attachAi(registry) {
  registry.kpiHistory = [];
  registry.proposedActions = [];
  registry.siteMeta = new Map();
  registry.siteCandidates = [];
  registry.savedSites = [];
  registry.actionSeq = 1;
  registry.offlineSince = new Map();
  registry.captureKpi = () => captureKpi(registry);
  registry._kpiTimer = setInterval(() => {
    try {
      captureKpi(registry);
    } catch {
      /* ignore */
    }
  }, 60_000);
  if (typeof registry._kpiTimer.unref === 'function') registry._kpiTimer.unref();
  captureKpi(registry);
}

export function ensureSiteMeta(registry, stationId) {
  if (registry.siteMeta.has(stationId)) return registry.siteMeta.get(stationId);
  const city = CITIES[hashId(stationId) % CITIES.length];
  const jitter = (hashId(stationId + 'j') % 80) / 1000;
  const meta = {
    stationId,
    city: city.city,
    lat: Number((city.lat + jitter).toFixed(4)),
    lng: Number((city.lng - jitter).toFixed(4)),
    evDensity: city.evDensity,
    traffic: city.traffic,
    catchment: city.catchment,
    competitors: COMPETITORS.map((c, i) => ({
      name: c.name,
      km: Number((c.offsetKm + (hashId(stationId + i) % 12) / 10).toFixed(1)),
    })),
  };
  registry.siteMeta.set(stationId, meta);
  return meta;
}

export function currentKpis(registry) {
  const stations = [...registry.stations.values()];
  const tx = registry.transactions || [];
  const live = tx.filter((t) => t.status && t.status !== 'Ended');
  const kwh = tx.reduce((s, t) => s + (Number(t.kwh) || 0), 0);
  const revenue = tx.reduce((s, t) => s + (Number(t.cost) || 0), 0);
  const evses = stations.flatMap((s) => [...(s.evses?.values?.() || [])]);
  const occupied = evses.filter((e) => /Occup|Charging|Suspended/i.test(e.connectorStatus || '')).length;
  const offline = stations.filter((s) => !s.online).map((s) => s.stationId);
  const tariff = registry.tariffs?.[0];
  return {
    at: nowIso(),
    stations: stations.length,
    online: stations.filter((s) => s.online).length,
    offlineIds: offline,
    liveSessions: live.length,
    kwh: Number(kwh.toFixed(3)),
    revenue: Number(revenue.toFixed(2)),
    currency: tx.find((t) => t.currency)?.currency || tariff?.currency || 'EUR',
    evses: evses.length,
    occupied,
    utilizationPct: evses.length ? Number(((occupied / evses.length) * 100).toFixed(1)) : 0,
    energyRate: Number(tariff?.energyKwh || 0.39),
  };
}

export function captureKpi(registry) {
  const snap = currentKpis(registry);
  const last = registry.kpiHistory[0];
  const changed =
    !last ||
    last.online !== snap.online ||
    last.revenue !== snap.revenue ||
    last.liveSessions !== snap.liveSessions ||
    last.occupied !== snap.occupied ||
    (last.offlineIds || []).join() !== snap.offlineIds.join();
  const stale = !last || Date.now() - new Date(last.at).getTime() > 50_000;
  if (changed || stale) {
    registry.kpiHistory.unshift(snap);
    registry.kpiHistory = registry.kpiHistory.slice(0, 240);
  }
  for (const s of registry.stations.values()) {
    if (s.online) registry.offlineSince.delete(s.stationId);
    else if (!registry.offlineSince.has(s.stationId)) registry.offlineSince.set(s.stationId, nowIso());
  }
  return { snap, changed };
}

export function lostRevenue(registry) {
  const k = currentKpis(registry);
  const hoursSample = Math.max(1, registry.kpiHistory.length / 60);
  const kwhPerHour = k.kwh / hoursSample || 8;
  const items = [];
  let total = 0;
  for (const [stationId, since] of registry.offlineSince.entries()) {
    const hours = Math.max(0.1, (Date.now() - new Date(since).getTime()) / 3_600_000);
    const loss = Number((hours * (kwhPerHour / Math.max(1, k.stations)) * k.energyRate).toFixed(2));
    total += loss;
    items.push({ stationId, since, hours: Number(hours.toFixed(2)), loss, currency: k.currency });
  }
  items.sort((a, b) => b.loss - a.loss || b.hours - a.hours);
  return { total: Number(total.toFixed(2)), currency: k.currency, items, labEstimate: true };
}

export function proposeAction(registry, spec = {}) {
  const stationId = spec.stationId || '';
  const ocppAction = spec.ocppAction || null;
  const existing = (registry.proposedActions || []).find(
    (a) => a.status === 'proposed' && a.stationId === stationId && a.ocppAction === ocppAction && a.kind === (spec.kind || ocppAction || 'ops')
  );
  if (existing) return existing;
  const rec = {
    id: `act-${registry.actionSeq++}`,
    kind: spec.kind || ocppAction || 'ops',
    stationId,
    ocppAction,
    payload: spec.payload || {},
    reason: spec.reason || '',
    label: spec.label || ocppAction || 'Action',
    status: 'proposed',
    at: nowIso(),
  };
  registry.proposedActions.unshift(rec);
  registry.proposedActions = registry.proposedActions.slice(0, 80);
  registry.emitStore?.();
  return rec;
}

export function listActions(registry, status) {
  const all = registry.proposedActions || [];
  if (!status) return all;
  return all.filter((a) => a.status === status);
}

export async function approveAction(registry, id) {
  const rec = registry.proposedActions.find((a) => a.id === id);
  if (!rec) throw new Error('Action not found');
  if (rec.status !== 'proposed') throw new Error(`Action is ${rec.status}`);
  rec.status = 'approved';
  rec.approvedAt = nowIso();
  if (rec.ocppAction && rec.stationId) {
    if (!registry.getStation(rec.stationId)) {
      rec.status = 'failed';
      rec.error = 'Station not found';
    } else {
      try {
        rec.result = await registry.callStation(rec.stationId, rec.ocppAction, rec.payload);
        rec.status = 'executed';
        rec.executedAt = nowIso();
      } catch (err) {
        rec.status = 'failed';
        rec.error = err.message;
      }
    }
  } else {
    rec.status = 'recorded';
  }
  registry.emitStore?.();
  return rec;
}

export function rejectAction(registry, id) {
  const rec = registry.proposedActions.find((a) => a.id === id);
  if (!rec) throw new Error('Action not found');
  rec.status = 'rejected';
  rec.rejectedAt = nowIso();
  registry.emitStore?.();
  return rec;
}

function pctChange(now, prev) {
  if (prev == null || prev === 0) return now ? 100 : 0;
  return Number((((now - prev) / Math.abs(prev)) * 100).toFixed(1));
}

export function buildInsights(registry) {
  captureKpi(registry);
  const now = currentKpis(registry);
  const realHistory = (registry.kpiHistory || []).filter((s) => !s.seeded);
  const prev = realHistory[Math.min(Math.max(realHistory.length - 1, 0), 15)] || now;
  const lost = lostRevenue(registry);
  const stations = [...registry.stations.values()];
  const offline = stations.filter((s) => !s.online);
  const noTariff = stations.filter((s) => s.online && !s.defaultTariffId);
  const idleOnline = stations.filter((s) => s.online && now.liveSessions === 0);
  const revenuePct = realHistory.length > 1 ? pctChange(now.revenue, prev.revenue) : 0;
  const onlineDelta = now.online - prev.online;

  const reasons = [];
  if (offline.length) reasons.push(`${offline.length} station(s) offline`);
  if (now.liveSessions === 0 && now.online) reasons.push('online stations have no live sessions');
  if (noTariff.length) reasons.push(`${noTariff.length} online station(s) have no SetDefaultTariff`);
  if (!reasons.length) reasons.push('no material outage; volume follows current utilization');

  let headline;
  if (revenuePct <= -5) headline = `Revenue is down ${Math.abs(revenuePct)}% vs the last window`;
  else if (revenuePct >= 5) headline = `Revenue is up ${revenuePct}% vs the last window`;
  else if (offline.length) headline = `${offline.length} station(s) offline — estimated loss ${lost.currency} ${lost.total.toFixed(2)}`;
  else headline = `Network stable: ${now.online}/${now.stations} online, ${now.liveSessions} live sessions`;

  const recommendations = [];
  for (const s of offline.slice(0, 3)) {
    recommendations.push({
      label: `Queue Reset for ${s.stationId}`,
      kind: 'restart',
      stationId: s.stationId,
      ocppAction: 'Reset',
      payload: { type: 'Immediate' },
      reason: `Offline since ${registry.offlineSince.get(s.stationId) || 'unknown'}. Reset is not sent until Approve, and the charge point must be reachable on WS/WSS.`,
    });
    recommendations.push({
      label: `Firmware check ${s.stationId}`,
      kind: 'firmware',
      stationId: s.stationId,
      ocppAction: 'UpdateFirmware',
      payload: defaultCsmsPayload('UpdateFirmware', { stationId: s.stationId }),
      reason: 'Repeated offline — queue lab firmware update after approval',
    });
  }
  if (noTariff[0]) {
    recommendations.push({
      label: `Set default tariff on ${noTariff[0].stationId}`,
      kind: 'tariff',
      stationId: noTariff[0].stationId,
      ocppAction: 'SetDefaultTariff',
      payload: { evseId: 1, tariffId: registry.tariffs[0]?.tariffId || 'MASSIVE-AC-DEFAULT' },
      reason: 'Ended sessions need a station default tariff for totalCost',
    });
  }
  if (idleOnline[0] && now.liveSessions === 0) {
    recommendations.push({
      label: `Remote start test on ${idleOnline[0].stationId}`,
      kind: 'start',
      stationId: idleOnline[0].stationId,
      ocppAction: 'RequestStartTransaction',
      payload: defaultCsmsPayload('RequestStartTransaction', { stationId: idleOnline[0].stationId }),
      reason: 'Online but idle — validate the session path',
    });
  }
  if (offline[0]) {
    recommendations.push({
      label: `Technician note: inspect ${offline[0].stationId}`,
      kind: 'technician',
      stationId: offline[0].stationId,
      ocppAction: null,
      payload: { note: `Inspect ${offline[0].stationId} — offline, estimated loss ${lost.currency} ${lost.total.toFixed(2)}` },
      reason: 'Lab technician assignment (no OCPP). Approve records the ticket.',
    });
  }

  return {
    at: now.at,
    headline,
    reason: reasons.join(' · '),
    kpis: now,
    previous: { at: prev.at, revenue: prev.revenue, online: prev.online },
    delta: { revenuePct, onlineDelta },
    lostRevenue: lost,
    idleOnline: idleOnline.map((s) => s.stationId),
    recommendations,
  };
}

function diurnal(hour) {
  const curve = [0.15, 0.1, 0.08, 0.08, 0.12, 0.25, 0.45, 0.7, 0.85, 0.75, 0.7, 0.8, 0.9, 0.85, 0.8, 0.95, 1, 0.98, 0.88, 0.7, 0.5, 0.4, 0.3, 0.2];
  return curve[hour] ?? 0.5;
}

function cityMeta(cityName) {
  return CITIES.find((c) => c.city === cityName) || CITIES[0];
}

function siteMix(site) {
  const name = `${site?.name || ''} ${site?.city || ''}`.toLowerCase();
  if (/depot/.test(name)) {
    return { kind: 'fleet-depot', weekend: 0.7, morning: 1.4, evening: 0.82, kwhPerSession: 22 };
  }
  if (/plaza|hub/.test(name)) {
    return { kind: 'public-hub', weekend: 1.28, morning: 0.88, evening: 1.22, kwhPerSession: 16 };
  }
  return { kind: 'mixed', weekend: 1.08, morning: 1, evening: 1.05, kwhPerSession: 18 };
}

function hourMixFactor(hour, mix, shift) {
  const h = (hour + shift + 24) % 24;
  let d = diurnal(h);
  if (h >= 6 && h <= 10) d *= mix.morning;
  if (h >= 17 && h <= 21) d *= mix.evening;
  return d;
}

function connectorCount(station) {
  const n = station?.evses?.size || (Array.isArray(station?.evses) ? station.evses.length : 0);
  return Math.max(1, n || 2);
}

function rollupHours(hours) {
  const dayMap = new Map();
  for (const h of hours) {
    if (!dayMap.has(h.dayKey)) dayMap.set(h.dayKey, []);
    dayMap.get(h.dayKey).push(h);
  }
  const days = [...dayMap.entries()].map(([date, list]) => {
    const peakH = [...list].sort((a, b) => b.kwh - a.kwh)[0];
    const lowH = [...list].sort((a, b) => a.kwh - b.kwh)[0];
    return {
      date,
      label: list[0].dayLabel,
      weekday: list[0].weekday,
      weekend: list.some((x) => x.weekend),
      holiday: list.some((x) => x.holiday),
      kwh: Number(list.reduce((s, x) => s + x.kwh, 0).toFixed(0)),
      kwhLow: list.reduce((s, x) => s + (x.kwhLow ?? x.kwh), 0),
      kwhHigh: list.reduce((s, x) => s + (x.kwhHigh ?? x.kwh), 0),
      sessions: list.reduce((s, x) => s + x.sessions, 0),
      sessionsLow: list.reduce((s, x) => s + (x.sessionsLow ?? x.sessions), 0),
      sessionsHigh: list.reduce((s, x) => s + (x.sessionsHigh ?? x.sessions), 0),
      peak: peakH,
      low: lowH,
      weather: peakH.weather,
    };
  });
  const sorted = [...hours].sort((a, b) => a.kwh - b.kwh);
  const peak = [...hours].sort((a, b) => b.kwh - a.kwh)[0] || null;
  const windowHours = peak
    ? hours.filter((h) => h.dayKey === peak.dayKey && h.kwh >= peak.kwh * 0.82)
    : [];
  const peakWindow = peak
    ? {
        dayLabel: peak.dayLabel,
        dayKey: peak.dayKey,
        startHour: windowHours[0]?.hour ?? peak.hour,
        endHour: windowHours[windowHours.length - 1]?.hour ?? peak.hour,
      }
    : null;
  return {
    days,
    lowWindows: sorted.slice(0, 4),
    peak,
    peakWindow,
  };
}

function roundTo(n, step) {
  return Math.max(0, Math.round(Number(n) / step) * step);
}

function sessionBand(expected, hoursAhead) {
  const conf = Math.max(0.34, 0.72 - hoursAhead * 0.0055);
  if (expected < 0.2) {
    return {
      sessions: 0,
      sessionsLow: 0,
      sessionsHigh: hoursAhead > 6 ? 1 : 0,
      kwh: 0,
      kwhLow: 0,
      kwhHigh: hoursAhead > 6 ? 10 : 0,
      confidencePct: Math.round(conf * 100),
    };
  }
  const spread = 0.22 + (1 - conf) * 0.85;
  const lo = Math.max(0, expected * (1 - spread));
  const hi = expected * (1 + spread);
  const sessionsLow = Math.floor(lo);
  const sessionsHigh = Math.max(sessionsLow + 1, Math.ceil(hi));
  const kwhStep = hoursAhead < 12 ? 10 : hoursAhead < 36 ? 20 : 30;
  return {
    sessions: Number(expected.toFixed(1)),
    sessionsLow,
    sessionsHigh,
    kwh: roundTo(expected * 18, kwhStep) || kwhStep,
    kwhLow: roundTo(lo * 18, kwhStep),
    kwhHigh: Math.max(roundTo(hi * 18, kwhStep), kwhStep),
    confidencePct: Math.round(conf * 100),
  };
}

function clock(hour) {
  return `${String(hour).padStart(2, '0')}:00`;
}

function aroundLabel(peak, window) {
  if (window && window.startHour !== window.endHour) {
    return `around ${clock(window.startHour)}–${clock(window.endHour)}`;
  }
  return `around ${clock(peak?.hour ?? 0)}`;
}

function hourSlots(horizon = 72) {
  const start = new Date();
  start.setMinutes(0, 0, 0);
  return Array.from({ length: horizon }, (_, i) => new Date(start.getTime() + i * 3600_000));
}

function historyByHour(tx, stationIds) {
  const byHour = Array.from({ length: 24 }, () => 0);
  const idSet = stationIds ? new Set(stationIds) : null;
  for (const t of tx) {
    if (idSet && !idSet.has(t.stationId)) continue;
    const h = new Date(t.startedAt || t.updatedAt || t.timestamp || Date.now()).getHours();
    byHour[h] += Number(t.kwh) || 1;
  }
  const peakHist = Math.max(1, ...byHour);
  return { byHour, peakHist, hasHistory: byHour.some((v) => v > 0) };
}

function buildSiteHours({ site, cps, tx, slots }) {
  const mix = siteMix(site);
  const city = cityMeta(site.city);
  const shift = (hashId(site.id || site.name) % 5) - 2;
  const plugs = cps.reduce((n, s) => n + connectorCount(s), 0) || 2;
  const onlineBoost = cps.length ? 0.55 + 0.45 * (cps.filter((s) => s.online).length / cps.length) : 0.7;
  const { byHour, peakHist, hasHistory } = historyByHour(tx, cps.map((s) => s.stationId));
  const density = city.evDensity * city.traffic * (city.catchment / 40000);
  const hours = slots.map((t, i) => {
    const w = labWeather(t, site.city);
    const weekendMod = w.weekend || w.holiday ? mix.weekend : 1;
    const model = hourMixFactor(t.getHours(), mix, shift);
    const hist = hasHistory ? byHour[t.getHours()] / peakHist : model;
    const blended = hasHistory ? 0.4 * hist + 0.6 * model : model;
    const expected = Math.max(0, blended * plugs * 3.2 * w.demandFactor * weekendMod * density * onlineBoost);
    const band = sessionBand(expected, i);
    const kwhScale = mix.kwhPerSession / 18;
    return {
      at: t.toISOString(),
      hour: t.getHours(),
      dayKey: t.toISOString().slice(0, 10),
      dayLabel: t.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }),
      weekday: t.toLocaleDateString(undefined, { weekday: 'short' }),
      kwh: roundTo(band.kwh * kwhScale, i < 12 ? 10 : 20),
      kwhLow: roundTo(band.kwhLow * kwhScale, i < 12 ? 10 : 20),
      kwhHigh: roundTo(band.kwhHigh * kwhScale, i < 12 ? 10 : 20),
      sessions: band.sessions,
      sessionsLow: band.sessionsLow,
      sessionsHigh: band.sessionsHigh,
      confidencePct: band.confidencePct,
      weather: w.condition,
      tempC: Math.round(w.tempC),
      factor: w.demandFactor,
      weekend: w.weekend,
      holiday: w.holiday,
    };
  });
  return { hours, mix, city, plugs, weather: labWeather(slots[0], site.city) };
}

function siteProposals(site, cps, peak, low, peakWindow) {
  const target = cps.find((s) => s.online) || cps[0];
  if (!target || !peak) return [];
  const peakWhen = aroundLabel(peak, peakWindow);
  const lowWhen = `around ${clock(low?.hour ?? 0)}`;
  const proposals = [];
  if (low) {
    proposals.push({
      label: `${site.name}: maintenance ${low.dayLabel} ${lowWhen}`,
      kind: 'maintenance',
      stationId: target.stationId,
      ocppAction: 'ChangeAvailability',
      payload: { operationalStatus: 'Inoperative', evse: { id: 1 } },
      reason: `Quiet window at ${site.name} (${low.kwhLow ?? 0}–${low.kwhHigh ?? low.kwh} kWh est.). Service then restore.`,
    });
  }
  proposals.push({
    label: `${site.name}: pre-peak power cap ${peak.dayLabel} ${peakWhen}`,
    kind: 'power',
    stationId: target.stationId,
    ocppAction: 'SetChargingProfile',
    payload: {
      evseId: 1,
      chargingProfile: {
        id: 21,
        stackLevel: 0,
        chargingProfilePurpose: 'TxDefaultProfile',
        chargingProfileKind: 'Absolute',
        chargingSchedule: [
          {
            id: 1,
            chargingRateUnit: 'W',
            chargingSchedulePeriod: [{ startPeriod: 0, limit: 7000 }],
          },
        ],
      },
    },
    reason: `Likely peak at ${site.name} ${peakWhen} (${peak.kwhLow ?? peak.kwh}–${peak.kwhHigh ?? peak.kwh} kWh est., ${peak.weather}).`,
  });
  proposals.push({
    label: `${site.name}: reserve ahead of ${peak.dayLabel} peak`,
    kind: 'reserve',
    stationId: target.stationId,
    ocppAction: 'ReserveNow',
    payload: {
      ...defaultCsmsPayload('ReserveNow', { stationId: target.stationId }),
      expiryDateTime: peak.at,
    },
    reason: `Hold a connector at ${site.name} around this station's likely peak — estimate only.`,
  });
  proposals.push({
    label: `${site.name}: technician stand-by ${peak.dayLabel} ${peakWhen}`,
    kind: 'technician',
    stationId: target.stationId,
    ocppAction: null,
    payload: { note: `Stand by at ${site.name} / ${target.stationId} ${peak.dayLabel} ${peakWhen}` },
    reason: 'Lab ops job — not an OCPP call. Approve records the assignment.',
  });
  if (low) {
    proposals.push({
      label: `${site.name}: restore after ${low.dayLabel} maintenance`,
      kind: 'restore',
      stationId: target.stationId,
      ocppAction: 'ChangeAvailability',
      payload: { operationalStatus: 'Operative', evse: { id: 1 } },
      reason: `Bring EVSE 1 at ${target.stationId} back Operative after the quiet window (${lowWhen}).`,
    });
  }
  return proposals;
}

function forecastGroups(registry) {
  const tenants = listTenants(registry);
  const tenantName = (id) => tenants.find((t) => t.id === id)?.name || '';
  const groups = listSites(registry).map((site) => ({
    site,
    tenantName: tenantName(site.tenantId),
    cps: [...registry.stations.values()].filter((s) => registry.cpOrg?.get(s.stationId)?.siteId === site.id),
  }));
  const assigned = new Set(groups.flatMap((g) => g.cps.map((s) => s.stationId)));
  const orphan = [...registry.stations.values()].filter((s) => !assigned.has(s.stationId));
  if (orphan.length) {
    groups.push({
      site: { id: '_none', name: 'Unassigned', city: '' },
      tenantName: '',
      cps: orphan,
    });
  }
  return groups;
}

export function buildForecast(registry) {
  const tx = registry.transactions || [];
  const slots = hourSlots(72);
  const stations = forecastGroups(registry).map(({ site, tenantName, cps }) => {
    const built = buildSiteHours({ site, cps, tx, slots });
    const rollup = rollupHours(built.hours);
    const cpForecasts = cps.map((cp) => {
      const one = buildSiteHours({ site, cps: [cp], tx, slots });
      const oneRoll = rollupHours(one.hours);
      return {
        stationId: cp.stationId,
        online: !!cp.online,
        simulated: !!cp.simulated,
        kwh: roundTo(oneRoll.days.reduce((s, d) => s + d.kwh, 0), 20),
        kwhLow: roundTo(oneRoll.days.reduce((s, d) => s + d.kwhLow, 0), 20),
        kwhHigh: roundTo(oneRoll.days.reduce((s, d) => s + d.kwhHigh, 0), 20),
        sessionsLow: oneRoll.days.reduce((s, d) => s + d.sessionsLow, 0),
        sessionsHigh: oneRoll.days.reduce((s, d) => s + d.sessionsHigh, 0),
        peak: oneRoll.peakWindow || (oneRoll.peak
          ? { hour: oneRoll.peak.hour, dayLabel: oneRoll.peak.dayLabel, kwh: oneRoll.peak.kwh }
          : null),
      };
    });
    const briefing = rollup.days.map((d) => {
      const tags = [d.weekend ? 'weekend' : null, d.holiday ? 'holiday' : null].filter(Boolean).join(', ');
      return `${d.label}${tags ? ` (${tags})` : ''}: likely peak around ${clock(d.peak.hour)} · ~${d.sessionsLow}–${d.sessionsHigh} sessions · ~${Math.round(d.kwhLow)}–${Math.round(d.kwhHigh)} kWh. Quiet around ${clock(d.low.hour)} for maintenance. Estimate only.`;
    });
    const kwh3dLow = roundTo(rollup.days.reduce((s, d) => s + d.kwhLow, 0), 50);
    const kwh3dHigh = roundTo(rollup.days.reduce((s, d) => s + d.kwhHigh, 0), 50);
    return {
      id: site.id,
      name: site.name,
      city: site.city || built.city.city,
      tenant: tenantName,
      mix: built.mix.kind,
      plugs: built.plugs,
      chargePointCount: cps.length,
      onlineCount: cps.filter((s) => s.online).length,
      weather: { ...built.weather, tempC: Math.round(built.weather.tempC) },
      hours: built.hours,
      days: rollup.days,
      peak: rollup.peak,
      peakWindow: rollup.peakWindow,
      lowWindows: rollup.lowWindows,
      briefing,
      proposals: siteProposals(site, cps, rollup.peak, rollup.lowWindows[0], rollup.peakWindow),
      chargePoints: cpForecasts,
      kwh3d: roundTo(rollup.days.reduce((s, d) => s + d.kwh, 0), 50),
      kwh3dLow,
      kwh3dHigh,
      sessions3dLow: rollup.days.reduce((s, d) => s + d.sessionsLow, 0),
      sessions3dHigh: rollup.days.reduce((s, d) => s + d.sessionsHigh, 0),
    };
  });

  const fleetHours = slots.map((t, i) => {
    const parts = stations.map((s) => s.hours[i]).filter(Boolean);
    const kwh = Number(parts.reduce((sum, h) => sum + h.kwh, 0).toFixed(1));
    const sessions = parts.reduce((sum, h) => sum + h.sessions, 0);
    const sample = parts[0] || {
      hour: t.getHours(),
      dayKey: t.toISOString().slice(0, 10),
      dayLabel: t.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }),
      weekday: t.toLocaleDateString(undefined, { weekday: 'short' }),
      weather: labWeather(t).condition,
      tempC: labWeather(t).tempC,
      weekend: labWeather(t).weekend,
      holiday: labWeather(t).holiday,
      factor: 1,
    };
    return {
      at: t.toISOString(),
      hour: sample.hour,
      dayKey: sample.dayKey,
      dayLabel: sample.dayLabel,
      weekday: sample.weekday,
      kwh,
      sessions,
      weather: sample.weather,
      tempC: sample.tempC,
      factor: sample.factor,
      weekend: sample.weekend,
      holiday: sample.holiday,
    };
  });
  const fleet = rollupHours(fleetHours);
  const hottest = [...stations].sort((a, b) => b.kwh3d - a.kwh3d)[0] || null;

  return {
    weather: hottest?.weather || labWeather(),
    horizonHours: 72,
    stations,
    hours: fleetHours,
    days: fleet.days,
    peak: fleet.peak,
    lowWindows: fleet.lowWindows,
    briefing: (hottest?.briefing || []).map((line) => `${hottest.name}: ${line}`),
    proposals: hottest?.proposals || [],
    note: 'Lab estimate, not a meter. Each hour is a range that gets wider further out — we cannot know exact future sessions. Weather is simulated, not a live feed.',
  };
}

export function recommendSites(registry) {
  captureKpi(registry);
  const k = currentKpis(registry);
  const stations = [...registry.stations.values()];
  stations.forEach((s) => ensureSiteMeta(registry, s.stationId));
  const usedCities = new Set([...registry.siteMeta.values()].map((m) => m.city));
  const yieldKwh = k.energyRate || 0.39;
  const candidates = [];
  for (const city of CITIES) {
    const existing = [...registry.siteMeta.values()].filter((m) => m.city === city.city);
    const util = k.utilizationPct / 100;
    const cannibal = existing.length ? Math.min(0.45, existing.length * 0.12) : 0;
    const demand = city.evDensity * city.traffic * (0.7 + util);
    const dailySessions = Number((18 * demand * (1 - cannibal) * (city.catchment / 40000)).toFixed(1));
    const dailyKwh = dailySessions * 18;
    const dailyRev = dailyKwh * yieldKwh;
    const capex = 42000 + city.evDensity * 18000;
    const paybackMonths = dailyRev > 0 ? Number((capex / (dailyRev * 30)).toFixed(1)) : 99;
    const risk =
      cannibal > 0.2 ? 'Cannibalization — nearby Helios site' : city.evDensity < 0.62 ? 'Lower EV density' : 'Balanced';
    candidates.push({
      id: `site-${city.city.toLowerCase()}`,
      city: city.city,
      lat: city.lat,
      lng: city.lng,
      evDensity: city.evDensity,
      traffic: city.traffic,
      catchment: city.catchment,
      competitors: COMPETITORS.map((c) => ({ name: c.name, km: c.offsetKm })),
      existingMassive: existing.length,
      expectedDailySessions: dailySessions,
      expectedDailyKwh: Number(dailyKwh.toFixed(1)),
      expectedDailyRevenue: Number(dailyRev.toFixed(2)),
      currency: k.currency,
      utilizationForecastPct: Number(Math.min(92, 35 + city.evDensity * 50 - cannibal * 40).toFixed(1)),
      paybackMonths,
      capexEur: capex,
      risk,
      score: Number((dailyRev * (1 - cannibal) * city.evDensity).toFixed(2)),
    });
  }
  candidates.sort((a, b) => b.score - a.score);
  registry.siteCandidates = candidates;
  return {
    at: nowIso(),
    kpis: { utilizationPct: k.utilizationPct, yieldPerKwh: yieldKwh, currency: k.currency, citiesWithStations: [...usedCities] },
    candidates: registry.siteCandidates,
    saved: registry.savedSites || [],
    note: 'Lab planner: utilization + mock EV density, traffic, and competitors. Not Google Maps.',
  };
}

export function saveSiteRecommendation(registry, body = {}) {
  const { candidates } = recommendSites(registry);
  const pick =
    candidates.find((c) => c.id === body.id || c.city === body.city) || candidates[0];
  if (!pick) throw new Error('No site candidate to save');
  const saved = { ...pick, savedAt: nowIso(), status: 'candidate' };
  registry.savedSites = [saved, ...(registry.savedSites || []).filter((s) => s.id !== saved.id)].slice(0, 20);
  registry.emitStore?.();
  return saved;
}

export function proposeCopilotActions(registry, question) {
  const q = String(question || '').toLowerCase();
  const insights = buildInsights(registry);
  const live = (registry.transactions || []).filter((t) => t.status && t.status !== 'Ended');
  const zero = (registry.transactions || []).filter((t) => t.status === 'Ended' && !(Number(t.kwh) > 0));
  const created = [];
  const add = (spec) => created.push(proposeAction(registry, spec));

  const wantsRestart = /restart|reset|who should we restart|offline/.test(q);
  const wantsRevenue = /revenue drop|why did revenue|lost revenue|income/.test(q);
  const wantsLost = /lost session|failed session|zero session|any lost/.test(q);
  const wantsFirmware = /firmware|upgrade|updatefirmware/.test(q);
  const wantsStop = /stop session|stop transaction|abort/.test(q);

  if (wantsRestart || wantsRevenue) {
    for (const rec of insights.recommendations.filter((r) => r.kind === 'restart').slice(0, 3)) {
      add(rec);
    }
  }
  if (wantsFirmware) {
    for (const rec of insights.recommendations.filter((r) => r.kind === 'firmware')) add(rec);
    const online = [...registry.stations.values()].find((s) => s.online);
    if (online && !created.length) {
      add({
        label: `Firmware update ${online.stationId}`,
        kind: 'firmware',
        stationId: online.stationId,
        ocppAction: 'UpdateFirmware',
        payload: defaultCsmsPayload('UpdateFirmware', { stationId: online.stationId }),
        reason: 'Operator asked about firmware — queued lab UpdateFirmware for approval.',
      });
    }
  }
  if (wantsLost || wantsStop) {
    for (const tx of live.slice(0, 3)) {
      add({
        label: `Stop session ${tx.transactionId}`,
        kind: 'stop',
        stationId: tx.stationId,
        ocppAction: 'RequestStopTransaction',
        payload: { transactionId: tx.transactionId },
        reason: 'Live session — RequestStopTransaction after approval.',
      });
    }
    for (const id of insights.kpis.offlineIds.slice(0, 2)) {
      add({
        label: `Restart ${id} (lost sessions)`,
        kind: 'restart',
        stationId: id,
        ocppAction: 'Reset',
        payload: { type: 'Immediate' },
        reason: zero.length
          ? `${zero.length} ended session(s) with 0 kWh. Restart may recover the connector.`
          : 'Offline station — sessions cannot start until it is back.',
      });
    }
  }
  if (wantsRevenue && !created.length) {
    for (const rec of insights.recommendations.slice(0, 3)) add(rec);
  }
  return created;
}

export function opsHints(registry) {
  const insights = buildInsights(registry);
  const lost = insights.lostRevenue;
  return {
    outages: insights.kpis.offlineIds,
    lostRevenue: lost,
    firmware: (registry.firmwareJobs || []).slice(0, 8),
    tickets: (registry.diagnostics || []).slice(0, 8),
    delta: insights.delta,
    headline: insights.headline,
    reason: insights.reason,
  };
}
