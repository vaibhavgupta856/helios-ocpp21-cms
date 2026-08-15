/**
 * Dense lab fleet so Ask / Plan can summarize hubs, flag faults, and propose a week plan.
 * Simulated only — no live OCPP until Approve.
 */

import { Station } from './ocpp/Station.js';
import { nowIso } from './ocpp/catalog.js';
import { assignChargePoint } from './org.js';
import { ensureSiteMeta, captureKpi, currentKpis, proposeAction } from './ai/index.js';

const LAYOUT = [
  { siteId: 'site-blr-whitefield', profile: 'star', count: 5, prefix: 'MASSIVE-WF' },
  { siteId: 'site-hyd-hitech', profile: 'healthy', count: 4, prefix: 'MASSIVE-HT' },
  { siteId: 'site-pun-kharadi', profile: 'watch', count: 3, prefix: 'MASSIVE-KH' },
  { siteId: 'site-ggm-cyber', profile: 'outage', count: 4, prefix: 'MASSIVE-CY' },
  { siteId: 'site-blr-koramangala', profile: 'star', count: 4, prefix: 'MASSIVE-KO' },
  { siteId: 'site-blr-indiranagar', profile: 'healthy', count: 4, prefix: 'MASSIVE-IN' },
  { siteId: 'site-blr-ecity', profile: 'mixed', count: 4, prefix: 'MASSIVE-EC' },
  { siteId: 'site-hyd-gachibowli', profile: 'healthy', count: 4, prefix: 'MASSIVE-GB' },
  { siteId: 'site-hyd-banjara', profile: 'watch', count: 3, prefix: 'MASSIVE-BH' },
  { siteId: 'site-pun-hinjawadi', profile: 'busy', count: 5, prefix: 'MASSIVE-HJ' },
  { siteId: 'site-mum-bkc', profile: 'busy', count: 6, prefix: 'ORBIT-BKC' },
  { siteId: 'site-che-omr', profile: 'mixed', count: 3, prefix: 'ORBIT-OMR' },
  { siteId: 'site-mum-andheri', profile: 'mixed', count: 4, prefix: 'ORBIT-AND' },
  { siteId: 'site-mum-powai', profile: 'healthy', count: 3, prefix: 'ORBIT-POW' },
  { siteId: 'site-che-velachery', profile: 'outage', count: 3, prefix: 'ORBIT-VEL' },
  { siteId: 'site-del-cp', profile: 'busy', count: 5, prefix: 'VOLT-CP' },
  { siteId: 'site-noid-18', profile: 'healthy', count: 4, prefix: 'VOLT-NOI' },
  { siteId: 'site-jai-civil', profile: 'watch', count: 3, prefix: 'VOLT-JAI' },
  { siteId: 'site-amd-sg', profile: 'mixed', count: 4, prefix: 'VOLT-AMD' },
  { siteId: 'site-chd-it', profile: 'healthy', count: 3, prefix: 'HIM-CHD' },
  { siteId: 'site-cok-infopark', profile: 'mixed', count: 3, prefix: 'HIM-COK' },
  { siteId: 'site-ccu-saltlake', profile: 'fault', count: 3, prefix: 'HIM-SL' },
];

const VENDORS = [
  { vendor: 'Helios', model: 'Massive-CS-21' },
  { vendor: 'ABB', model: 'Terra 54' },
  { vendor: 'Exicom', model: 'Harmony DC180' },
  { vendor: 'Delta', model: 'AC-22 Duo' },
  { vendor: 'Tritium', model: 'PKM150' },
  { vendor: 'ChargePoint', model: 'CPF50' },
];

const TOKENS = [
  'RFID-MASSIVE-01',
  'RFID-VAIBHAV-01',
  'RFID-FLEET-22',
  'FOB-ORBIT-44',
  'EMAID-NL-MAS-C00000001',
  'EMAID-IN-VOL-C00012',
  'RFID-HIM-07',
  'CARD-7F2A91',
  'TOKEN-MASSIVE-09',
];

function hoursAgo(h) {
  return new Date(Date.now() - h * 3600_000).toISOString();
}

function minutesAgo(m) {
  return new Date(Date.now() - m * 60_000).toISOString();
}

function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function pick(rand, min, max) {
  return min + rand() * (max - min);
}

function pickInt(rand, min, max) {
  return Math.floor(pick(rand, min, max + 1));
}

function profileOf(name, index, count) {
  if (name === 'star') return { online: true, simulated: true, occupied: index < 2, sessions: pickRange(8, 14), kwh: [14, 32], live: index === 0, tariff: 'MASSIVE-AC-DEFAULT' };
  if (name === 'busy') return { online: true, simulated: true, occupied: index < 3, sessions: pickRange(10, 16), kwh: [18, 42], live: index < 2, tariff: 'MASSIVE-DC-FAST' };
  if (name === 'healthy') return { online: index < count - 1, simulated: index < count - 1, occupied: index === 0, sessions: pickRange(4, 8), kwh: [8, 20], live: index === 0 && index < count - 1, tariff: 'MASSIVE-AC-DEFAULT' };
  if (name === 'mixed') return { online: index % 2 === 0, simulated: index % 2 === 0, occupied: false, sessions: pickRange(2, 5), kwh: [5, 14], live: false, tariff: index % 2 === 0 ? 'MASSIVE-AC-PEAK' : null, firmware: index === 1 ? 'Downloading' : 'Idle' };
  if (name === 'watch') return { online: true, simulated: true, occupied: false, sessions: pickRange(0, 1), kwh: [0, 1.5], live: false, tariff: null };
  if (name === 'outage') return { online: index === count - 1, simulated: index === count - 1, occupied: false, sessions: pickRange(0, 2), kwh: [0, 4], live: false, tariff: null, offlineHours: 18 + index * 12, firmware: 'InstallationFailed' };
  if (name === 'fault') return { online: true, simulated: true, occupied: false, faulted: index === 0, sessions: pickRange(1, 3), kwh: [2, 9], live: false, tariff: 'MASSIVE-AC-DEFAULT', firmware: index === 1 ? 'InstallRebooting' : 'Idle' };
  return { online: true, simulated: true, occupied: false, sessions: [3, 6], kwh: [8, 16], live: false, tariff: 'MASSIVE-AC-DEFAULT' };
}

function pickRange(a, b) {
  return [a, b];
}

function seedCp(registry, { stationId, siteId, spec, vendor, connectors = 2 }) {
  const station = new Station({
    stationId,
    ws: spec.simulated && spec.online ? { readyState: 1, OPEN: 1, send() {} } : null,
    registry,
    simulated: !!spec.simulated,
  });
  station.online = !!spec.online;
  station.enrolled = true;
  station.identity = {
    vendorName: vendor.vendor,
    model: vendor.model,
    serialNumber: stationId,
    firmwareVersion: spec.online ? '2.1.4' : '2.0.9',
  };
  station.bootAt = hoursAgo(spec.online ? 36 : 240);
  station.bootAccepted = !!spec.online;
  station.heartbeatAt = spec.online ? minutesAgo(3 + (hash(stationId) % 12)) : hoursAgo(spec.offlineHours || 24);
  station.firmwareStatus = spec.firmware || 'Idle';
  station.defaultTariffId = spec.tariff || null;
  station.transport = spec.simulated ? 'sim' : 'wss';
  for (let i = 1; i <= connectors; i++) {
    let connectorStatus = 'Available';
    if (spec.faulted && i === 1) connectorStatus = 'Faulted';
    else if (!spec.online) connectorStatus = 'Unavailable';
    else if (spec.occupied && i === 1) connectorStatus = 'Charging';
    else if (spec.occupied && i === 2) connectorStatus = 'Occupied';
    station.upsertEvse(1, i, {
      connectorStatus,
      errorCode: spec.faulted && i === 1 ? 'GroundFailure' : 'NoError',
    });
  }
  registry.stations.set(stationId, station);
  assignChargePoint(registry, stationId, { siteId });
  ensureSiteMeta(registry, stationId);
  if (!spec.online) {
    registry.offlineSince.set(stationId, hoursAgo(spec.offlineHours || 24));
  }
  return station;
}

function hash(id) {
  let n = 0;
  for (const c of String(id)) n = (n * 31 + c.charCodeAt(0)) >>> 0;
  return n;
}

export function seedLabWorld(registry) {
  registry.upsertToken({ idToken: 'RFID-VAIBHAV-01', type: 'ISO14443', status: 'Accepted' });
  registry.upsertToken({ idToken: 'RFID-FLEET-22', type: 'ISO14443', status: 'Accepted' });
  registry.upsertToken({ idToken: 'EMAID-IN-VOL-C00012', type: 'eMAID', status: 'Accepted' });
  registry.upsertToken({ idToken: 'RFID-HIM-07', type: 'ISO14443', status: 'Accepted' });
  registry.upsertToken({ idToken: 'RFID-EXPIRED-09', type: 'ISO14443', status: 'Expired' });
  registry.addTariff({
    tariffId: 'MASSIVE-NIGHT',
    currency: 'EUR',
    energyKwh: 0.28,
    parkingPerHour: 0,
    description: 'Off-peak night AC',
  });
  registry.addTariff({
    tariffId: 'VOLT-DC-URBAN',
    currency: 'EUR',
    energyKwh: 0.74,
    parkingPerHour: 0,
    description: 'Urban DC — VoltRide',
  });

  const tx = [];
  let liveCount = 0;

  for (const row of LAYOUT) {
    const rand = rng(hash(row.siteId) ^ 0x21);
    for (let i = 0; i < row.count; i++) {
      const stationId = `${row.prefix}-${String(i + 1).padStart(2, '0')}`;
      const spec = profileOf(row.profile, i, row.count);
      const vendor = VENDORS[(hash(stationId) + i) % VENDORS.length];
      seedCp(registry, { stationId, siteId: row.siteId, spec, vendor, connectors: spec.occupied ? 2 : 2 });
      const station = registry.getStation(stationId);
      const tariff = registry.tariffFor(station, spec.tariff);
      const sessionN = spec.online ? pickInt(rand, spec.sessions[0], spec.sessions[1]) : pickInt(rand, 0, spec.sessions[0] || 1);
      for (let s = 0; s < sessionN; s++) {
        const hours = pick(rand, 4, 14 * 24);
        const startedAt = hoursAgo(hours);
        const endedAt = hoursAgo(hours - pick(rand, 0.4, 2.2));
        const zero = row.profile === 'watch' || (row.profile === 'outage' && rand() < 0.45);
        const kwh = zero ? 0 : Number(pick(rand, spec.kwh[0], spec.kwh[1]).toFixed(2));
        const cost = Number((kwh * Number(tariff?.energyKwh || 0.39)).toFixed(2));
        const token = TOKENS[(hash(stationId) + s) % TOKENS.length];
        tx.push({
          transactionId: `tx-${stationId}-${s + 1}`,
          stationId,
          evseId: 1,
          status: 'Ended',
          eventType: 'Ended',
          kwh,
          cost,
          currency: tariff?.currency || 'EUR',
          tariffId: tariff?.tariffId || spec.tariff,
          idToken: token,
          startedAt,
          endedAt,
          timestamp: endedAt,
          updatedAt: endedAt,
        });
      }
      if (spec.live && spec.online && liveCount < 18) {
        liveCount += 1;
        const kwh = Number(pick(rand, 4, 18).toFixed(2));
        const cost = Number((kwh * Number(tariff?.energyKwh || 0.39)).toFixed(2));
        const startedAt = hoursAgo(pick(rand, 0.4, 5.5));
        tx.push({
          transactionId: `tx-live-${stationId}`,
          stationId,
          evseId: 1,
          status: 'Started',
          eventType: 'Started',
          kwh,
          cost,
          currency: tariff?.currency || 'EUR',
          tariffId: tariff?.tariffId || spec.tariff,
          idToken: 'RFID-VAIBHAV-01',
          startedAt,
          timestamp: startedAt,
          updatedAt: minutesAgo(4),
        });
      }
    }
  }

  tx.sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
  registry.transactions = tx.slice(0, 800);

  const offline = [...registry.stations.values()].filter((s) => !s.online);
  for (const s of offline.slice(0, 8)) {
    registry.firmwareJobs.unshift({
      id: `fw-${s.stationId}`,
      stationId: s.stationId,
      action: 'UpdateFirmware',
      status: s.firmwareStatus === 'InstallationFailed' ? 'InstallationFailed' : 'DownloadFailed',
      at: hoursAgo(6 + (hash(s.stationId) % 20)),
    });
    registry.diagnostics.unshift({
      id: `diag-${s.stationId}`,
      stationId: s.stationId,
      kind: 'NotifyEvent',
      action: 'NotifyEvent',
      at: hoursAgo(3 + (hash(s.stationId) % 10)),
      payload: { eventData: [{ eventId: 1, trigger: 'Alerting', actualValue: 'Offline' }] },
    });
  }
  const faulted = [...registry.stations.values()].filter((s) =>
    [...(s.evses?.values?.() || [])].some((e) => e.connectorStatus === 'Faulted')
  );
  for (const s of faulted) {
    registry.diagnostics.unshift({
      id: `diag-fault-${s.stationId}`,
      stationId: s.stationId,
      kind: 'NotifyEvent',
      action: 'NotifyEvent',
      at: hoursAgo(1),
      payload: { eventData: [{ eventId: 9, trigger: 'Alerting', actualValue: 'GroundFailure' }] },
    });
  }

  const live = registry.transactions.filter((t) => t.status !== 'Ended');
  for (const t of live.slice(0, 4)) {
    registry.reservations.unshift({
      id: registry.reservationSeq++,
      stationId: t.stationId,
      evseId: t.evseId || 1,
      idToken: { idToken: t.idToken, type: 'ISO14443' },
      expiryDateTime: hoursAgo(-2),
      status: 'Active',
      createdAt: nowIso(),
    });
  }

  const now = currentKpis(registry);
  const history = [];
  for (let i = 20; i >= 1; i--) {
    history.push({
      ...now,
      at: hoursAgo(i),
      seeded: true,
      revenue: Number((now.revenue * 1.42 + i * 18).toFixed(2)),
      kwh: Number((now.kwh * 1.35 + i * 12).toFixed(3)),
      liveSessions: Math.max(0, now.liveSessions - Math.floor(i / 6)),
      online: Math.min(now.stations, now.online + (i % 3 === 0 ? 2 : 0)),
    });
  }
  registry.kpiHistory = [now, ...history].slice(0, 240);

  for (const s of offline.slice(0, 5)) {
    proposeAction(registry, {
      stationId: s.stationId,
      ocppAction: 'Reset',
      payload: { type: 'Immediate' },
      label: `Restart ${s.stationId}`,
      reason: `Offline since ${registry.offlineSince.get(s.stationId) || 'unknown'} — queued Reset waits for Approve; the CP must be reachable.`,
      kind: 'restart',
    });
  }
  if (faulted[0]) {
    proposeAction(registry, {
      stationId: faulted[0].stationId,
      ocppAction: 'ChangeAvailability',
      payload: { operationalStatus: 'Inoperative', evse: { id: 1, connectorId: 1 } },
      label: `Isolate faulted connector on ${faulted[0].stationId}`,
      reason: 'GroundFailure on connector 1 — take inoperative until a technician clears it',
      kind: 'availability',
    });
  }

  const sample = [...registry.stations.values()].slice(0, 12);
  for (const s of sample) {
    registry.trace({
      stationId: s.stationId,
      direction: 'in',
      type: 'CALL',
      action: s.online ? 'Heartbeat' : 'BootNotification',
    });
  }

  captureKpi(registry);
  registry.emitStore?.();
}
