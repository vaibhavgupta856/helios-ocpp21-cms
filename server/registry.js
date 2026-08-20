import { Station } from './ocpp/Station.js';
import { nowIso, defaultCsmsPayload, CS_TO_CSMS, CSMS_TO_CS, BLOCKS, ALL_ACTIONS, SPEC_MESSAGE_COUNT, MESSAGE_CATALOG, ocppTariffFromBook } from './ocpp/catalog.js';
import { stationUrls, publicSecurity } from './security.js';
import { attachAi, ensureSiteMeta, captureKpi } from './ai/index.js';
import { attachOrg, assignChargePoint, compareChargePoints, orgSnapshot } from './org.js';
import { seedLabWorld } from './labWorld.js';
import { loadOperatorStore, saveOperatorStore } from './persist.js';

function tokenKey(idToken) {
  return String(idToken || '').trim();
}

export class Registry {
  constructor({ io }) {
    this.io = io;
    this.stations = new Map();
    this.tokens = new Map();
    this.tariffs = [];
    this.reservations = [];
    this.transactions = [];
    this.firmwareJobs = [];
    this.certificates = [];
    this.diagnostics = [];
    this.messages = [];
    this.payments = [];
    this.batterySwaps = [];
    this.streamSamples = [];
    this.securityEvents = [];
    this.derEvents = [];
    this.reservationSeq = 1;
    this.seed();
    attachOrg(this);
    attachAi(this);
    seedLabWorld(this);
    this.applyOperatorStore();
  }

  seed() {
    this.upsertToken({ idToken: 'RFID-MASSIVE-01', type: 'ISO14443', status: 'Accepted' });
    this.upsertToken({ idToken: 'RFID-BLOCKED', type: 'ISO14443', status: 'Blocked' });
    this.upsertToken({ idToken: 'EMAID-NL-MAS-C00000001', type: 'eMAID', status: 'Accepted' });
    this.upsertToken({ idToken: 'CARD-7F2A91', type: 'ISO14443', status: 'Accepted' });
    this.upsertToken({ idToken: 'FOB-ORBIT-44', type: 'ISO14443', status: 'Accepted' });
    this.upsertToken({ idToken: 'TOKEN-MASSIVE-09', type: 'ISO14443', status: 'Accepted' });
    this.tariffs = [
      {
        tariffId: 'MASSIVE-AC-DEFAULT',
        currency: 'EUR',
        energyKwh: 0.39,
        parkingPerHour: 0,
        description: 'Standard AC public tariff',
        createdAt: nowIso(),
      },
      {
        tariffId: 'MASSIVE-AC-PEAK',
        currency: 'EUR',
        energyKwh: 0.55,
        parkingPerHour: 1.2,
        description: 'Peak-hours AC tariff',
        createdAt: nowIso(),
      },
      {
        tariffId: 'MASSIVE-DC-FAST',
        currency: 'EUR',
        energyKwh: 0.69,
        parkingPerHour: 0,
        description: 'DC fast charging',
        createdAt: nowIso(),
      },
    ];
  }

  catalog() {
    return {
      version: '2.1',
      specMessageCount: SPEC_MESSAGE_COUNT,
      actionCount: ALL_ACTIONS.length,
      listingCount: CS_TO_CSMS.length + CSMS_TO_CS.length,
      blocks: BLOCKS,
      csToCsms: CS_TO_CSMS,
      csmsToCs: CSMS_TO_CS,
      actions: ALL_ACTIONS,
      messages: MESSAGE_CATALOG,
      defaults: Object.fromEntries(CSMS_TO_CS.map((m) => [m.action, defaultCsmsPayload(m.action)])),
    };
  }

  decorate(snap) {
    const urls = stationUrls(snap.stationId);
    const site = ensureSiteMeta(this, snap.stationId);
    const org = assignChargePoint(this, snap.stationId);
    if (org.site?.city) site.city = org.site.city;
    return {
      ...snap,
      ...urls,
      site,
      tenantId: org.tenantId || null,
      siteId: org.siteId || null,
      cpOrder: org.order,
      tenant: org.tenant ? { id: org.tenant.id, name: org.tenant.name, order: org.tenant.order } : null,
      location: org.site
        ? {
            id: org.site.id,
            name: org.site.name,
            city: org.site.city,
            tenantId: org.site.tenantId,
            order: org.site.order,
          }
        : null,
    };
  }

  listStations() {
    return [...this.stations.values()]
      .map((s) => this.decorate(s.snapshot()))
      .sort((a, b) => compareChargePoints(this, a, b));
  }

  getStation(id) {
    return this.stations.get(id) || null;
  }

  attachStation(stationId, ws, meta = {}) {
    const existing = this.stations.get(stationId);
    if (existing && existing.ws && existing.ws !== ws) {
      try {
        existing.ws.close();
      } catch {
        /* ignore */
      }
    }
    const station = new Station({ stationId, ws, registry: this });
    station.simulated = false;
    if (existing) {
      station.identity = existing.identity;
      station.evses = existing.evses;
      station.transactions = existing.transactions;
      station.variables = existing.variables;
      station.events = existing.events;
      station.securityEvents = existing.securityEvents;
      station.displayMessages = existing.displayMessages;
      station.localListVersion = existing.localListVersion;
      station.firmwareStatus = existing.firmwareStatus;
      station.logStatus = existing.logStatus;
      station.der = existing.der;
      station.tariffs = existing.tariffs;
      station.chargingLimits = existing.chargingLimits;
      station.chargingProfiles = existing.chargingProfiles;
      station.installedCertificates = existing.installedCertificates;
      station.monitoring = existing.monitoring;
      station.periodicStreams = existing.periodicStreams;
      station.derControls = existing.derControls;
      station.defaultTariffId = existing.defaultTariffId;
      station.enrolled = existing.enrolled;
      station.bootAt = existing.bootAt;
      station.bootAccepted = existing.bootAccepted;
      station.heartbeatInterval = existing.heartbeatInterval;
      station.reservations = existing.reservations;
    }
    station.transport = meta.transport || (meta.secure ? 'wss' : 'ws');
    station.online = true;
    this.stations.set(stationId, station);
    ensureSiteMeta(this, stationId);
    assignChargePoint(this, stationId);
    this.emitStation(station);
    this.io?.emit('cms:log', { at: nowIso(), level: 'info', text: `${stationId} connected (${station.transport})` });
    // If there were offline CALLs queued while the station was disconnected,
    // send them now that the WebSocket is open.
    try {
      station.flushOutbound?.();
    } catch {
      /* ignore */
    }
    return station;
  }

  detachStation(stationId, ws) {
    const station = this.stations.get(stationId);
    if (!station) return;
    if (ws && station.ws && station.ws !== ws) return;
    station.close();
    this.io?.emit('cms:log', { at: nowIso(), level: 'warn', text: `${stationId} disconnected` });
  }

  simulateStation(opts = {}) {
    const stationId = String(opts.stationId || `SIM-${Date.now().toString(36)}`).trim();
    const station = new Station({
      stationId,
      ws: { readyState: 1, OPEN: 1, send() {} },
      registry: this,
      simulated: true,
    });
    station.identity = {
      vendorName: 'Helios',
      model: opts.model || 'Massive-CS-Sim-21',
      serialNumber: stationId,
      firmwareVersion: '2.1.0-sim',
    };
    station.bootAt = nowIso();
    station.bootAccepted = true;
    station.heartbeatInterval = 300;
    station.heartbeatAt = nowIso();
    station.upsertEvse(1, 1, { connectorStatus: 'Available' });
    station.upsertEvse(1, 2, { connectorStatus: opts.occupied ? 'Occupied' : 'Available' });
    this.stations.set(stationId, station);
    ensureSiteMeta(this, stationId);
    assignChargePoint(this, stationId, opts);
    this.emitStation(station);
    this.io?.emit('cms:log', { at: nowIso(), level: 'info', text: `Simulated station ${stationId}` });
    return this.decorate(station.snapshot());
  }

  enrollStation(opts = {}) {
    const stationId = String(opts.stationId || '').trim();
    if (!stationId) throw new Error('stationId is required');
    const existing = this.stations.get(stationId);
    if (existing) {
      existing.enrolled = true;
      assignChargePoint(this, stationId, opts);
      this.emitStation(existing);
      return this.decorate(existing.snapshot());
    }
    const station = new Station({
      stationId,
      ws: null,
      registry: this,
      simulated: false,
    });
    station.online = false;
    station.enrolled = true;
    station.identity = {
      vendorName: opts.vendorName || '—',
      model: opts.model || 'Awaiting BootNotification',
    };
    this.stations.set(stationId, station);
    ensureSiteMeta(this, stationId);
    assignChargePoint(this, stationId, opts);
    this.emitStation(station);
    this.io?.emit('cms:log', { at: nowIso(), level: 'info', text: `Enrolled station ${stationId}` });
    return this.decorate(station.snapshot());
  }

  tariffFor(station, tariffId) {
    const id = tariffId || station?.defaultTariffId;
    return this.tariffs.find((t) => t.tariffId === id) || this.tariffs[0] || null;
  }

  costForStation(station, kwh, tariffId) {
    const tariff = this.tariffFor(station, tariffId);
    const rate = Number(tariff?.energyKwh || 0);
    return Number((Math.max(0, Number(kwh) || 0) * rate).toFixed(2));
  }

  async callStation(stationId, action, payload, opts = {}) {
    const station = this.getStation(stationId);
    if (!station) throw new Error('Station not found');

    const queueOffline = !!opts.queueOffline;
    if (!station.isOpen() && !station.simulated) {
      if (!queueOffline) {
        const err = new Error(
          `${stationId} is not connected over OCPP. Use a charge point with a green Live pill (WebSocket open), or a Sim station for instant demo responses. If Voltforge is running, commission it with this exact Charge Point ID and confirm BootNotification on Live Trace.`
        );
        err.code = 'STATION_OFFLINE';
        throw err;
      }
    }

    let body = payload && Object.keys(payload).length ? payload : defaultCsmsPayload(action, { stationId });
    if (action === 'SetDefaultTariff') {
      const book = this.tariffFor(station, body.tariffId || body.tariff?.tariffId);
      const tariff = body.tariff?.energy?.prices
        ? body.tariff
        : ocppTariffFromBook({ ...(book || {}), ...body, ...body.tariff });
      body = { evseId: body.evseId ?? 0, tariff };
      station.tariffs = [
        { evseId: body.evseId, tariffKind: 'DefaultTariff', tariff: body.tariff, at: nowIso() },
        ...station.tariffs.filter(
          (row) => (row.tariff?.tariffId || row.tariffId) !== body.tariff.tariffId || Number(row.evseId) !== Number(body.evseId)
        ),
      ].slice(0, 20);
      station.defaultTariffId = body.tariff.tariffId;
    }
    if (action === 'ChangeTransactionTariff') {
      const book = this.tariffFor(station, body.tariffId || body.tariff?.tariffId);
      const tariff = body.tariff?.energy?.prices
        ? body.tariff
        : ocppTariffFromBook({ ...(book || {}), ...body, ...body.tariff });
      body = { transactionId: body.transactionId, tariff };
    }
    if (action === 'ClearTariffs') {
      const ids = new Set(body.tariffIds || []);
      const evseId = body.evseId;
      station.tariffs = station.tariffs.filter((row) => {
        const id = row.tariff?.tariffId || row.tariffId;
        const rowEvse = Number(row.evseId ?? 0);
        if (evseId != null && rowEvse !== 0 && rowEvse !== Number(evseId)) return true;
        if (ids.size) return !ids.has(id);
        return false;
      });
    }

    // Remote stop should be "operator friendly": if UI doesn't provide transactionId,
    // pick the currently active transaction for this station from stored TransactionEvent data.
    if (action === 'RequestStopTransaction') {
      const providedTxId = payload?.transactionId;
      if (!providedTxId) {
        const active = this.transactions
          .filter((t) => t.stationId === stationId && t.status && t.status !== 'Ended')
          .sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')))[0];
        if (!active?.transactionId) {
          throw new Error(`No active transaction found on ${stationId}`);
        }
        body = { ...body, transactionId: active.transactionId };
      }
    }
    if (action === 'UpdateFirmware' || action === 'PublishFirmware' || action === 'UnpublishFirmware' || action === 'GetLog') {
      this.firmwareJobs.unshift({
        id: `${action}-${Date.now()}`,
        stationId,
        action,
        status: 'Pending',
        at: nowIso(),
        payload: body,
      });
      this.firmwareJobs = this.firmwareJobs.slice(0, 80);
      this.emitStore();
    }
    if (
      action === 'InstallCertificate' ||
      action === 'CertificateSigned' ||
      action === 'DeleteCertificate' ||
      action === 'GetInstalledCertificateIds'
    ) {
      this.addCertificate({ stationId, action, payload: body });
    }
    if (action === 'GetLog' || action === 'GetMonitoringReport' || action === 'CustomerInformation') {
      this.addDiagnostic({ stationId, kind: 'request', action, payload: body });
    }
    if (action === 'ReserveNow') {
      this.addReservation({
        stationId,
        evseId: body.evseId,
        idToken: body.idToken,
        expiryDateTime: body.expiryDateTime,
        id: body.id,
        localOnly: true,
      });
    }
    if (action === 'ChangeTransactionTariff' && body.tariff?.tariffId && body.transactionId) {
      const tx = this.transactions.find((t) => t.transactionId === body.transactionId && t.stationId === stationId);
      if (tx) {
        tx.tariffId = body.tariff.tariffId;
        tx.cost = this.costForStation(station, tx.kwh, body.tariff.tariffId);
        const tariff = this.tariffFor(station, body.tariff.tariffId);
        if (tariff?.currency) tx.currency = tariff.currency;
        tx.updatedAt = nowIso();
        this.emitStore();
      }
    }
    if (action === 'CancelReservation') {
      this.updateReservation(body.reservationId ?? body.id, 'Cancelled');
    }
    if (action === 'SetChargingProfile' && body.chargingProfile) {
      station.chargingProfiles = [
        { evseId: body.evseId ?? 1, chargingProfile: body.chargingProfile, at: nowIso() },
        ...station.chargingProfiles.filter((p) => p.chargingProfile?.id !== body.chargingProfile.id),
      ].slice(0, 40);
    }
    if (action === 'ClearChargingProfile') {
      const id = body.chargingProfileId ?? body.id;
      if (id != null) {
        station.chargingProfiles = station.chargingProfiles.filter((p) => p.chargingProfile?.id !== id);
      } else {
        station.chargingProfiles = [];
      }
    }
    if (action === 'SetDisplayMessage' && body.message) {
      station.displayMessages = [...station.displayMessages.filter((m) => m.id !== body.message.id), body.message];
    }
    if (action === 'ClearDisplayMessage') {
      station.displayMessages = station.displayMessages.filter((m) => m.id !== body.id);
    }
    if (action === 'SendLocalList' && body.versionNumber != null) {
      station.localListVersion = Number(body.versionNumber) || station.localListVersion;
    }
    if (action === 'SetDERControl') {
      station.derControls = [{ ...body, at: nowIso() }, ...station.derControls].slice(0, 20);
    }
    if (action === 'ClearDERControl') {
      station.derControls = station.derControls.filter((c) => c.controlId !== body.controlId);
    }
    if (action === 'OpenPeriodicEventStream' && body.constantStreamData) {
      station.periodicStreams = [...station.periodicStreams, body.constantStreamData];
    }
    if (action === 'ClosePeriodicEventStream') {
      station.periodicStreams = station.periodicStreams.filter((s) => s.id !== body.id);
    }
    if (action === 'InstallCertificate') {
      station.installedCertificates = [
        { certificateType: body.certificateType, at: nowIso() },
        ...station.installedCertificates,
      ].slice(0, 40);
    }
    const result = await station.sendCall(action, body);
    if (action === 'GetTariffs') {
      const installed = result?.customData?.tariffs;
      if (Array.isArray(installed) && installed.length) {
        station.tariffs = installed.map((tariff, i) => ({
          evseId: result.tariffAssignments?.[i]?.evseIds?.[0] ?? body.evseId ?? 0,
          tariffKind: result.tariffAssignments?.[i]?.tariffKind || 'DefaultTariff',
          tariff,
          at: nowIso(),
        }));
        if (installed[0]?.tariffId) station.defaultTariffId = installed[0].tariffId;
      }
    }
    if (action === 'GetInstalledCertificateIds' && Array.isArray(result?.certificateHashDataChain)) {
      station.installedCertificates = result.certificateHashDataChain;
    }
    if (action === 'GetChargingProfiles' && station.simulated) {
      station.chargingLimits = [
        {
          action: 'ReportChargingProfiles',
          payload: { chargingProfile: station.chargingProfiles, requestId: body.requestId },
          at: nowIso(),
        },
        ...station.chargingLimits,
      ].slice(0, 40);
    }
    if (action === 'SetDefaultTariff' && station.online && !station.simulated) {
      const live = this.transactions.filter((t) => t.stationId === stationId && t.status !== 'Ended');
      for (const tx of live) {
        station.sendCall('CostUpdated', { totalCost: this.costForStation(station, tx.kwh, tx.tariffId), transactionId: tx.transactionId }).catch(() => {});
      }
    }
    this.emitStation(station);
    return { action, payload: body, result };
  }

  authorizeToken(idToken) {
    if (!idToken) return 'Invalid';
    const rec = this.tokens.get(tokenKey(idToken));
    if (!rec) return 'Invalid';
    return rec.status || 'Accepted';
  }

  listTokens() {
    return [...this.tokens.values()];
  }

  upsertToken({ idToken, type = 'ISO14443', status = 'Accepted' }) {
    const key = tokenKey(idToken);
    if (!key) throw new Error('idToken is required');
    const rec = {
      idToken: key,
      type,
      status,
      updatedAt: nowIso(),
    };
    this.tokens.set(key, rec);
    this.emitStore();
    return rec;
  }

  listTariffs() {
    return this.tariffs;
  }

  addTariff(body = {}) {
    const rec = {
      tariffId: body.tariffId || `TARIFF-${Date.now().toString(36)}`,
      currency: body.currency || 'EUR',
      energyKwh: Number(body.energyKwh ?? 0.4),
      parkingPerHour: Number(body.parkingPerHour ?? 0),
      description: body.description || '',
      createdAt: nowIso(),
    };
    this.tariffs = [rec, ...this.tariffs.filter((t) => t.tariffId !== rec.tariffId)];
    this.emitStore();
    return rec;
  }

  listTransactions() {
    return this.transactions;
  }

  upsertTransaction(rec) {
    const idx = this.transactions.findIndex((t) => t.transactionId === rec.transactionId && t.stationId === rec.stationId);
    const prev = idx >= 0 ? this.transactions[idx] : {};
    const next = {
      ...prev,
      ...rec,
      startedAt: rec.eventType === 'Started' ? rec.timestamp : prev.startedAt || rec.timestamp,
      endedAt: rec.eventType === 'Ended' ? rec.timestamp : prev.endedAt,
      status:
        rec.eventType === 'Ended' ? 'Ended' : rec.eventType === 'Started' ? 'Started' : rec.eventType || prev.status || 'Updated',
      kwh: rec.kwh || prev.kwh || 0,
      cost: rec.cost != null ? rec.cost : prev.cost,
      currency: rec.currency || prev.currency,
      updatedAt: nowIso(),
    };
    if (idx >= 0) this.transactions[idx] = next;
    else this.transactions.unshift(next);
    this.transactions = this.transactions.slice(0, 800);
    this.emitStore();
    captureKpi(this);
    return next;
  }

  energyFromMeters(meterValue) {
    if (!Array.isArray(meterValue)) return 0;
    for (const mv of meterValue) {
      for (const s of mv.sampledValue || []) {
        const measurand = s.measurand || 'Energy.Active.Import.Register';
        if (measurand.includes('Energy.Active.Import')) {
          const v = Number(s.value);
          if (Number.isNaN(v)) continue;
          if ((s.unit || s.unitOfMeasure?.unit) === 'kWh') return v;
          return v >= 1000 ? v / 1000 : v;
        }
      }
    }
    return 0;
  }

  noteMeterValues(stationId, payload) {
    const kwh = this.energyFromMeters(payload.meterValue);
    if (!kwh) return;
    const open = this.transactions.find((t) => t.stationId === stationId && t.status !== 'Ended');
    if (open) {
      const station = this.getStation(stationId);
      open.kwh = kwh;
      open.cost = this.costForStation(station, kwh, open.tariffId);
      open.updatedAt = nowIso();
      this.emitStore();
    }
  }

  listReservations() {
    return this.reservations;
  }

  addReservation(body = {}) {
    const rec = {
      id: body.id ?? this.reservationSeq++,
      stationId: body.stationId || '',
      evseId: body.evseId ?? 1,
      idToken: body.idToken || { idToken: 'RFID-MASSIVE-01', type: 'ISO14443' },
      expiryDateTime: body.expiryDateTime || new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      status: 'Active',
      createdAt: nowIso(),
    };
    this.reservations.unshift(rec);
    this.reservations = this.reservations.slice(0, 200);
    const station = this.getStation(rec.stationId);
    if (station) {
      station.reservations = [...station.reservations.filter((r) => r.id !== rec.id), rec];
      if (!body.localOnly && station.online) {
        station.sendCall('ReserveNow', {
          id: rec.id,
          expiryDateTime: rec.expiryDateTime,
          idToken: rec.idToken,
          evseId: rec.evseId,
        }).catch(() => {});
      }
    }
    this.scheduleReservationExpiry(rec);
    this.emitStore();
    return rec;
  }

  scheduleReservationExpiry(rec) {
    const delay = Math.max(0, new Date(rec.expiryDateTime).getTime() - Date.now());
    setTimeout(() => {
      const current = this.reservations.find((r) => r.id === rec.id);
      if (current && current.status === 'Active') {
        this.updateReservation(rec.id, 'Expired');
        const station = this.getStation(rec.stationId);
        if (station) {
          station.reservations = station.reservations.map((r) =>
            r.id === rec.id ? { ...r, status: 'Expired' } : r
          );
          this.emitStation(station);
        }
      }
    }, delay);
  }

  updateReservation(id, status) {
    const rec = this.reservations.find((r) => r.id === id);
    if (rec) {
      rec.status = status || rec.status;
      rec.updatedAt = nowIso();
      this.emitStore();
    }
  }

  listFirmware() {
    return this.firmwareJobs;
  }

  updateFirmwareJob(stationId, status, payload) {
    const job = this.firmwareJobs.find((j) => j.stationId === stationId && j.status !== 'Installed' && j.status !== 'InvalidSignature');
    if (job) {
      job.status = status || job.status;
      job.lastPayload = payload;
      job.updatedAt = nowIso();
    } else {
      this.firmwareJobs.unshift({
        id: `fw-${Date.now()}`,
        stationId,
        action: 'FirmwareStatusNotification',
        status: status || 'Idle',
        at: nowIso(),
        payload,
      });
    }
    this.firmwareJobs = this.firmwareJobs.slice(0, 80);
    this.emitStore();
  }

  listCertificates() {
    return this.certificates;
  }

  addCertificate({ stationId, action, payload }) {
    this.certificates.unshift({
      id: `cert-${Date.now()}`,
      stationId,
      action,
      at: nowIso(),
      payload,
    });
    this.certificates = this.certificates.slice(0, 80);
    this.emitStore();
  }

  addSecurityEvent({ stationId, payload }) {
    this.securityEvents.unshift({ stationId, payload, at: nowIso() });
    this.securityEvents = this.securityEvents.slice(-80);
    this.emitStore();
  }

  listDiagnostics() {
    return this.diagnostics;
  }

  addDiagnostic({ stationId, kind, action, payload }) {
    this.diagnostics.unshift({
      id: `diag-${Date.now()}`,
      stationId,
      kind,
      action,
      at: nowIso(),
      payload,
    });
    this.diagnostics = this.diagnostics.slice(0, 200);
    this.emitStore();
  }

  addPayment(rec) {
    this.payments.unshift(rec);
    this.payments = this.payments.slice(0, 100);
    this.emitStore();
  }

  addBatterySwap(rec) {
    this.batterySwaps.unshift(rec);
    this.batterySwaps = this.batterySwaps.slice(0, 80);
    this.emitStore();
  }

  addDerEvent(rec) {
    this.derEvents.unshift({ ...rec, at: nowIso() });
    this.derEvents = this.derEvents.slice(0, 80);
    this.emitStore();
  }

  addStreamSample(rec) {
    this.streamSamples.unshift(rec);
    this.streamSamples = this.streamSamples.slice(0, 200);
    this.emitStore();
  }

  listMessages(stationId) {
    if (!stationId) return this.messages;
    return this.messages.filter((m) => m.stationId === stationId);
  }

  trace(entry) {
    const rec = {
      ...entry,
      at: nowIso(),
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    };
    this.messages.unshift(rec);
    this.messages = this.messages.slice(0, 800);
    this.io?.emit('cms:message', rec);
  }

  emitStation(station) {
    const snap = this.decorate(station.snapshot());
    this.io?.emit('station:state', snap);
    this.io?.emit('cms:stations', this.listStations());
    captureKpi(this);
    this.persistOperatorStore();
  }

  emitStore() {
    this.io?.emit('cms:store', this.storeSnapshot());
    this.persistOperatorStore();
  }

  applyOperatorStore() {
    const store = loadOperatorStore();
    this._persistReady = true;
    if (!store) {
      this.persistOperatorStore();
      return;
    }
    if (Array.isArray(store.tariffs) && store.tariffs.length) {
      this.tariffs = store.tariffs;
    }
    for (const row of store.stationTariffs || []) {
      const station = this.getStation(row.stationId);
      if (!station) continue;
      if (row.defaultTariffId) station.defaultTariffId = row.defaultTariffId;
      if (Array.isArray(row.tariffs)) station.tariffs = row.tariffs;
    }
  }

  persistOperatorStore() {
    if (!this._persistReady) return;
    saveOperatorStore({
      savedAt: nowIso(),
      tariffs: this.tariffs,
      stationTariffs: [...this.stations.values()]
        .map((station) => ({
          stationId: station.stationId,
          defaultTariffId: station.defaultTariffId,
          tariffs: station.tariffs || [],
        }))
        .filter((row) => row.defaultTariffId || (row.tariffs && row.tariffs.length)),
    });
  }

  storeSnapshot() {
    return {
      tokens: this.listTokens(),
      tariffs: this.tariffs,
      transactions: this.transactions,
      reservations: this.reservations,
      firmware: this.firmwareJobs,
      certificates: this.certificates,
      diagnostics: this.diagnostics,
      payments: this.payments,
      batterySwaps: this.batterySwaps,
      securityEvents: this.securityEvents,
      derEvents: this.derEvents,
      streamSamples: this.streamSamples.slice(0, 40),
      actions: this.proposedActions || [],
      savedSites: this.savedSites || [],
      kpiLatest: this.kpiHistory?.[0] || null,
      ...orgSnapshot(this),
    };
  }

  snapshot() {
    const stations = this.listStations();
    return {
      stations,
      online: stations.filter((s) => s.online).length,
      messages: this.messages.slice(0, 40),
      security: publicSecurity(),
      ...this.storeSnapshot(),
    };
  }
}
