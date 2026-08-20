import { EventEmitter } from 'events';
import { defaultCsResponse, nowIso, getTariffsResult } from './catalog.js';
import {
  MessageType,
  parseMessage,
  serializeCall,
  serializeCallResult,
  serializeCallError,
  serializeCallResultError,
  stringifyFrame,
  typeName,
  newMessageId,
  ErrorCode,
} from './protocol.js';

const WS_OPEN = 1;

export class Station extends EventEmitter {
  constructor({ stationId, ws, registry, simulated = false }) {
    super();
    this.stationId = stationId;
    this.ws = ws;
    this.registry = registry;
    this.simulated = simulated;
    this.pending = new Map();
    this.outboundQueue = [];
    this.outboundBusy = false;
    this.inboundCallId = null;
    this.seq = 0;
    this.online = simulated || !!(ws && ws.readyState === WS_OPEN);
    this.bootAccepted = false;
    this.heartbeatInterval = 300;
    this.identity = {};
    this.evses = new Map();
    this.transactions = new Map();
    this.variables = [];
    this.events = [];
    this.firmwareStatus = 'Idle';
    this.logStatus = 'Idle';
    this.securityEvents = [];
    this.reservations = [];
    this.der = [];
    this.tariffs = [];
    this.displayMessages = [];
    this.chargingLimits = [];
    this.chargingProfiles = [];
    this.installedCertificates = [];
    this.monitoring = [];
    this.periodicStreams = [];
    this.derControls = [];
    this.defaultTariffId = null;
    this.enrolled = false;
    this.transport = null;
    this.localListVersion = 0;
    this.heartbeatAt = null;
    this.bootAt = null;
    this.lastMessageAt = nowIso();
    this.connectedAt = nowIso();
  }

  nextId() {
    this.seq += 1;
    return `cms-${this.seq}-${Date.now().toString(36)}-${newMessageId().slice(0, 8)}`;
  }

  snapshot() {
    return {
      stationId: this.stationId,
      online: this.online,
      simulated: this.simulated,
      identity: this.identity,
      firmwareStatus: this.firmwareStatus,
      logStatus: this.logStatus,
      heartbeatAt: this.heartbeatAt,
      bootAt: this.bootAt,
      bootAccepted: this.bootAccepted,
      heartbeatInterval: this.heartbeatInterval,
      lastMessageAt: this.lastMessageAt,
      connectedAt: this.connectedAt,
      localListVersion: this.localListVersion,
      evses: [...this.evses.values()],
      transactions: [...this.transactions.values()],
      variables: this.variables.slice(-80),
      events: this.events.slice(-80),
      securityEvents: this.securityEvents.slice(-40),
      reservations: this.reservations,
      der: this.der.slice(-20),
      tariffs: this.tariffs,
      displayMessages: this.displayMessages,
      chargingLimits: this.chargingLimits.slice(-20),
      chargingProfiles: this.chargingProfiles.slice(-40),
      installedCertificates: this.installedCertificates.slice(-40),
      monitoring: this.monitoring.slice(-40),
      periodicStreams: this.periodicStreams,
      derControls: this.derControls.slice(-20),
      defaultTariffId: this.defaultTariffId,
      enrolled: this.enrolled,
      transport: this.transport,
    };
  }

  isOpen() {
    return this.simulated || (this.ws && this.ws.readyState === WS_OPEN);
  }

  sendFrame(frame) {
    if (!this.ws || this.ws.readyState !== WS_OPEN) return;
    this.ws.send(stringifyFrame(frame));
  }

  simulatedResult(action, body) {
    if (action === 'GetChargingProfiles') {
      return { status: this.chargingProfiles.length ? 'Accepted' : 'NoProfiles' };
    }
    if (action === 'GetCompositeSchedule') {
      const limit = this.chargingProfiles[0]?.chargingProfile?.chargingSchedule?.[0]?.chargingSchedulePeriod?.[0]?.limit ?? 11000;
      return {
        status: 'Accepted',
        evseId: body.evseId || 1,
        scheduleStart: nowIso(),
        chargingSchedule: {
          chargingRateUnit: body.chargingRateUnit || 'W',
          chargingSchedulePeriod: [{ startPeriod: 0, limit }],
        },
      };
    }
    if (action === 'GetTariffs') {
      return getTariffsResult(this.tariffs, body.evseId ?? 0);
    }
    if (action === 'GetInstalledCertificateIds') {
      return {
        status: this.installedCertificates.length ? 'Accepted' : 'NotFound',
        certificateHashDataChain: this.installedCertificates,
      };
    }
    if (action === 'GetDisplayMessages') {
      return { status: this.displayMessages.length ? 'Accepted' : 'Unknown' };
    }
    if (action === 'GetLocalListVersion') {
      return { versionNumber: this.localListVersion || 0 };
    }
    if (action === 'GetTransactionStatus') {
      const ongoing = [...this.transactions.values()].some((t) => t.eventType !== 'Ended');
      return { messagesInQueue: false, ongoingIndicator: ongoing };
    }
    if (action === 'GetDERControl') {
      return { status: this.derControls.length ? 'Accepted' : 'NotFound' };
    }
    if (action === 'GetPeriodicEventStream') {
      return { constantStreamData: this.periodicStreams };
    }
    return { status: 'Accepted' };
  }

  sendCall(action, payload) {
    const body = payload || {};
    if (this.simulated) {
      const messageId = this.nextId();
      this.registry.trace({
        stationId: this.stationId,
        direction: 'csms→cs',
        type: 'CALL',
        action,
        messageId,
        payload: body,
        simulated: true,
      });
      const result = this.simulatedResult(action, body);
      this.registry.trace({
        stationId: this.stationId,
        direction: 'cs→csms',
        type: 'CALLRESULT',
        action,
        messageId,
        payload: result,
        simulated: true,
      });
      return Promise.resolve(result);
    }
    // If the station is enrolled but currently offline, allow store-and-forward:
    // queue the CALL and send it as soon as the WebSocket becomes open.
    // This makes operator actions functional even when the charge point connects later.
    if (!this.isOpen()) {
      if (!this.enrolled) {
        return Promise.reject(new Error(`${this.stationId} is offline`));
      }
      return new Promise((resolve, reject) => {
        const queuedAt = nowIso();
        this.registry.trace({
          stationId: this.stationId,
          direction: 'csms→cs',
          type: 'CALL',
          action,
          messageId: `queued-${Date.now()}`,
          payload: body,
          queued: true,
          at: queuedAt,
        });
        const entry = { action, body, resolve, reject, queuedAt };
        this.outboundQueue.push(entry);
        entry.queueTimer = setTimeout(() => {
          const idx = this.outboundQueue.indexOf(entry);
          if (idx >= 0) {
            this.outboundQueue.splice(idx, 1);
            reject(
              new Error(
                `${this.stationId} is still offline after 30s — connect the charge point, then retry ${action}`
              )
            );
          }
        }, 30000);
        this.flushOutbound();
      });
    }
    return new Promise((resolve, reject) => {
      this.outboundQueue.push({ action, body, resolve, reject });
      this.flushOutbound();
    });
  }

  flushOutbound() {
    if (this.outboundBusy || !this.outboundQueue.length) return;
    if (!this.isOpen()) return;
    const next = this.outboundQueue.shift();
    this.outboundBusy = true;
    const messageId = this.nextId();
    const frame = serializeCall(next.action, next.body, messageId);
    const timer = setTimeout(() => {
      this.pending.delete(messageId);
      this.outboundBusy = false;
      clearTimeout(next.queueTimer);
      next.reject(new Error(`Timeout waiting for ${next.action}`));
      this.flushOutbound();
    }, 30000);
    this.pending.set(messageId, {
      resolve: (payload) => {
        clearTimeout(next.queueTimer);
        this.outboundBusy = false;
        next.resolve(payload);
        this.flushOutbound();
      },
      reject: (err) => {
        clearTimeout(next.queueTimer);
        this.outboundBusy = false;
        next.reject(err);
        this.flushOutbound();
      },
      timer,
      action: next.action,
    });
    this.sendFrame(frame);
    this.registry.trace({
      stationId: this.stationId,
      direction: 'csms→cs',
      type: 'CALL',
      action: next.action,
      messageId,
      payload: next.body,
    });
  }

  settlePending(messageId, ok, payloadOrError) {
    const pending = this.pending.get(messageId);
    if (!pending) return false;
    clearTimeout(pending.timer);
    this.pending.delete(messageId);
    if (ok) pending.resolve(payloadOrError);
    else pending.reject(payloadOrError);
    return true;
  }

  reply(messageId, payload) {
    this.sendFrame(serializeCallResult(messageId, payload ?? {}));
  }

  replyError(messageId, code, description, details = {}) {
    this.sendFrame(serializeCallError(messageId, code, description || '', details));
  }

  handleRaw(raw) {
    let msg;
    try {
      msg = parseMessage(raw);
    } catch (err) {
      this.registry.trace({
        stationId: this.stationId,
        direction: 'cs→csms',
        type: 'CALLERROR',
        action: '',
        messageId: '',
        payload: { code: err.errorCode || ErrorCode.FormationViolation, description: err.message },
      });
      this.emit('error', err);
      return;
    }
    this.lastMessageAt = nowIso();

    if (msg.type === MessageType.CALLRESULT || msg.type === MessageType.CALLERROR || msg.type === MessageType.CALLRESULTERROR) {
      const pending = this.pending.get(msg.messageId);
      const kind = typeName(msg.type);
      if (pending) {
        this.registry.trace({
          stationId: this.stationId,
          direction: 'cs→csms',
          type: kind,
          action: pending.action,
          messageId: msg.messageId,
          payload:
            msg.type === MessageType.CALLRESULT
              ? msg.payload
              : { code: msg.errorCode, description: msg.errorDescription, details: msg.errorDetails },
        });
        if (msg.type === MessageType.CALLRESULT) {
          this.settlePending(msg.messageId, true, msg.payload);
        } else {
          this.settlePending(
            msg.messageId,
            false,
            new Error(`${msg.errorCode}: ${msg.errorDescription || kind}`)
          );
        }
      } else {
        this.registry.trace({
          stationId: this.stationId,
          direction: 'cs→csms',
          type: kind,
          action: '',
          messageId: msg.messageId,
          payload:
            msg.type === MessageType.CALLRESULT
              ? msg.payload
              : { code: msg.errorCode, description: msg.errorDescription, details: msg.errorDetails },
          orphan: true,
        });
        if (msg.type === MessageType.CALLRESULT) {
          this.sendFrame(
            serializeCallResultError(
              msg.messageId,
              ErrorCode.ProtocolError,
              'No matching CALL for this CALLRESULT',
              {}
            )
          );
        }
      }
      this.emit('result', msg);
      return;
    }

    if (msg.type === MessageType.SEND) {
      this.registry.trace({
        stationId: this.stationId,
        direction: 'cs→csms',
        type: 'SEND',
        action: msg.action,
        messageId: msg.messageId,
        payload: msg.payload,
      });
      this.handleSend(msg.action, msg.payload || {});
      this.registry.emitStation(this);
      return;
    }

    if (msg.type !== MessageType.CALL) return;

    if (this.inboundCallId) {
      this.replyError(
        msg.messageId,
        ErrorCode.RpcFrameworkError,
        'Only one outstanding CALL is allowed per direction'
      );
      return;
    }
    this.inboundCallId = msg.messageId;

    this.registry.trace({
      stationId: this.stationId,
      direction: 'cs→csms',
      type: 'CALL',
      action: msg.action,
      messageId: msg.messageId,
      payload: msg.payload,
    });
    this.emit('call', msg);

    try {
      const result = this.handleCall(msg.action, msg.payload || {});
      if (result !== null && result !== undefined) {
        this.reply(msg.messageId, result);
        this.registry.trace({
          stationId: this.stationId,
          direction: 'csms→cs',
          type: 'CALLRESULT',
          action: msg.action,
          messageId: msg.messageId,
          payload: result,
        });
      }
    } catch (err) {
      const code = err.errorCode || ErrorCode.InternalError;
      this.replyError(msg.messageId, code, err.message);
      this.registry.trace({
        stationId: this.stationId,
        direction: 'csms→cs',
        type: 'CALLERROR',
        action: msg.action,
        messageId: msg.messageId,
        payload: { code, description: err.message },
      });
    }
    this.inboundCallId = null;
    this.registry.emitStation(this);
  }

  handleSend(action, payload) {
    if (action === 'NotifyPeriodicEventStream') {
      this.registry.addStreamSample({ stationId: this.stationId, payload, at: nowIso() });
      return;
    }
    this.handleCall(action, payload);
  }

  fail(code, message) {
    const err = new Error(message);
    err.errorCode = code;
    throw err;
  }

  noteClientCertificate(info) {
    if (!info) return;
    this.installedCertificates = [
      info,
      ...this.installedCertificates.filter((c) => c.fingerprint256 !== info.fingerprint256),
    ].slice(0, 40);
  }

  upsertEvse(evseId, connectorId, patch = {}) {
    const id = Number(evseId) || 1;
    const conn = Number(connectorId) || 1;
    const key = `${id}:${conn}`;
    const prev = this.evses.get(key) || {
      evseId: id,
      connectorId: conn,
      connectorStatus: 'Available',
      errorCode: 'NoError',
    };
    const next = { ...prev, ...patch, evseId: id, connectorId: conn };
    Object.keys(next).forEach((k) => {
      if (next[k] === undefined) delete next[k];
    });
    this.evses.set(key, { ...prev, ...next });
    return this.evses.get(key);
  }

  handleCall(action, payload) {
    const legacy16 = {
      StartTransaction: 'TransactionEvent (eventType=Started)',
      StopTransaction: 'TransactionEvent (eventType=Ended)',
      RemoteStartTransaction: 'RequestStartTransaction',
      RemoteStopTransaction: 'RequestStopTransaction',
      ChangeConfiguration: 'SetVariables',
      GetConfiguration: 'GetVariables',
    };
    if (legacy16[action]) {
      this.fail(
        ErrorCode.NotImplemented,
        `OCPP 2.1 does not use ${action}; send ${legacy16[action]} instead`
      );
    }

    if (action !== 'BootNotification' && !this.bootAccepted && !this.simulated) {
      this.fail(ErrorCode.ProtocolError, 'Station must complete BootNotification before other CALLs');
    }

    switch (action) {
      case 'BootNotification': {
        const station = payload.chargingStation || {};
        if (!station.model || !station.vendorName || !payload.reason) {
          this.fail(
            ErrorCode.OccurrenceConstraintViolation,
            'BootNotification requires chargingStation.model, chargingStation.vendorName, and reason'
          );
        }
        this.identity = {
          model: station.model,
          vendorName: station.vendorName,
          serialNumber: station.serialNumber,
          firmwareVersion: station.firmwareVersion,
          modem: station.modem,
          reason: payload.reason,
        };
        this.bootAt = nowIso();
        this.bootAccepted = true;
        this.online = true;
        this.heartbeatInterval = 300;
        return {
          status: 'Accepted',
          currentTime: nowIso(),
          interval: this.heartbeatInterval,
        };
      }
      case 'Heartbeat':
        this.heartbeatAt = nowIso();
        return { currentTime: nowIso() };
      case 'StatusNotification': {
        const evseId = payload.evse?.id ?? payload.evseId ?? 1;
        const connectorId = payload.evse?.connectorId ?? payload.connectorId ?? 1;
        const connectorStatus = payload.connectorStatus || payload.status;
        this.upsertEvse(evseId, connectorId, {
          connectorStatus,
          timestamp: payload.timestamp,
        });
        return {};
      }
      case 'NotifyReport':
        if (Array.isArray(payload.reportData)) {
          this.variables = [...this.variables, ...payload.reportData].slice(-200);
        }
        this.registry.addDiagnostic({
          stationId: this.stationId,
          kind: 'report',
          action,
          payload,
        });
        return {};
      case 'Authorize': {
        const token =
          payload.idToken?.idToken ||
          (typeof payload.idToken === 'string' ? payload.idToken : null) ||
          payload.idTag;
        const status = this.registry.authorizeToken(token);
        const idTokenInfo = { status };
        return { idTokenInfo, idTagInfo: idTokenInfo };
      }
      case 'TransactionEvent': {
        const info = payload.transactionInfo || payload.txInfo || {};
        const openTx = [...this.transactions.values()].find((t) => t.eventType !== 'Ended');
        const id =
          info.transactionId ||
          payload.transactionId ||
          (payload.eventType === 'Started' ? `tx-${Date.now()}` : openTx?.transactionId) ||
          `tx-${Date.now()}`;
        const evseId = payload.evse?.id ?? 1;
        const connectorId = payload.evse?.connectorId ?? 1;
        const rec = {
          transactionId: id,
          eventType: payload.eventType,
          chargingState: info.chargingState,
          stoppedReason: info.stoppedReason,
          triggerReason: payload.triggerReason,
          timestamp: payload.timestamp,
          evseId,
          connectorId,
          idToken: payload.idToken,
          meterStart: info.meterStart,
          meterStop: info.meterStop,
          meterValue: payload.meterValue,
          seqNo: payload.seqNo,
        };
        this.transactions.set(id, rec);
        this.upsertEvse(evseId, connectorId, {
          connectorStatus:
            payload.eventType === 'Ended'
              ? 'Available'
              : payload.eventType === 'Started'
                ? 'Occupied'
                : undefined,
          lastTransactionId: id,
        });
        const kwh = this.registry.energyFromMeters(payload.meterValue) || Number(info.meterStop || 0) / 1000 || 0;
        const prevTx = this.registry.transactions.find(
          (t) => t.transactionId === id && t.stationId === this.stationId
        );
        const cost = this.registry.costForStation(this, kwh, prevTx?.tariffId);
        this.registry.upsertTransaction({
          stationId: this.stationId,
          transactionId: id,
          eventType: payload.eventType,
          chargingState: info.chargingState,
          stoppedReason: info.stoppedReason,
          triggerReason: payload.triggerReason,
          timestamp: payload.timestamp || nowIso(),
          evseId,
          connectorId,
          idToken: payload.idToken,
          meterStart: info.meterStart,
          meterStop: info.meterStop,
          kwh,
          cost,
          currency: this.registry.tariffFor(this, prevTx?.tariffId)?.currency || 'EUR',
          tariffId: prevTx?.tariffId || this.defaultTariffId,
        });
        if (payload.eventType === 'Ended') {
          return { idTokenInfo: { status: 'Accepted' }, totalCost: cost };
        }
        return { status: 'Accepted' };
      }
      case 'MeterValues':
        this.upsertEvse(payload.evseId, payload.evse?.connectorId ?? payload.connectorId, {
          lastMeter: payload.meterValue,
        });
        this.registry.noteMeterValues(this.stationId, payload);
        return {};
      case 'NotifyEvent':
        if (Array.isArray(payload.eventData)) this.events.push(...payload.eventData);
        else this.events.push(payload);
        this.events = this.events.slice(-200);
        this.registry.addDiagnostic({
          stationId: this.stationId,
          kind: 'event',
          action,
          payload,
        });
        return {};
      case 'NotifyMonitoringReport':
        this.registry.addDiagnostic({
          stationId: this.stationId,
          kind: 'monitoring',
          action,
          payload,
        });
        return {};
      case 'NotifyCustomerInformation':
        this.registry.addDiagnostic({
          stationId: this.stationId,
          kind: 'customer',
          action,
          payload,
        });
        return {};
      case 'SecurityEventNotification':
        this.securityEvents.push({ ...payload, at: nowIso() });
        this.securityEvents = this.securityEvents.slice(-80);
        this.registry.addSecurityEvent({ stationId: this.stationId, payload });
        return {};
      case 'FirmwareStatusNotification':
      case 'PublishFirmwareStatusNotification':
        this.firmwareStatus = payload.status || this.firmwareStatus;
        this.registry.updateFirmwareJob(this.stationId, payload.status, payload);
        return {};
      case 'LogStatusNotification':
        this.logStatus = payload.status || this.logStatus;
        this.registry.addDiagnostic({
          stationId: this.stationId,
          kind: 'log',
          action,
          payload,
        });
        return {};
      case 'ReservationStatusUpdate':
        this.reservations = this.reservations.filter((r) => r.id !== payload.reservationId);
        this.registry.updateReservation(payload.reservationId, payload.reservationUpdateStatus);
        return {};
      case 'NotifyDisplayMessages':
        if (Array.isArray(payload.messageInfo)) this.displayMessages = payload.messageInfo;
        return {};
      case 'ReportDERControl':
      case 'NotifyDERAlarm':
      case 'NotifyDERStartStop':
        this.der.push({ action, payload, at: nowIso() });
        this.der = this.der.slice(-40);
        this.registry.addDerEvent({ stationId: this.stationId, action, payload });
        return {};
      case 'NotifySettlement':
        this.registry.addPayment({ stationId: this.stationId, action, payload, at: nowIso() });
        return {};
      case 'OpenPeriodicEventStream': {
        const stream = payload.constantStreamData || { id: 1, variableMonitoringId: 1, params: {} };
        this.periodicStreams = [
          ...this.periodicStreams.filter((s) => s.id !== stream.id),
          stream,
        ];
        this.registry.addStreamSample({
          stationId: this.stationId,
          kind: 'open',
          payload,
          at: nowIso(),
        });
        return { status: 'Accepted' };
      }
      case 'ClosePeriodicEventStream':
        this.periodicStreams = this.periodicStreams.filter((s) => s.id !== payload.id);
        this.registry.addStreamSample({
          stationId: this.stationId,
          kind: 'close',
          payload,
          at: nowIso(),
        });
        return {};
      case 'VatNumberValidation':
        this.registry.addPayment({ stationId: this.stationId, action, payload, at: nowIso() });
        return { vatNumber: payload.vatNumber || '', status: 'Accepted' };
      case 'BatterySwap':
        this.registry.addBatterySwap({ stationId: this.stationId, payload, at: nowIso() });
        return {};
      case 'PullDynamicScheduleUpdate':
        return {
          status: 'Accepted',
          scheduleUpdate: { limit: 11000 },
        };
      case 'NotifyChargingLimit':
      case 'ClearedChargingLimit':
      case 'ReportChargingProfiles':
      case 'NotifyEVChargingSchedule':
      case 'NotifyEVChargingNeeds':
      case 'NotifyPriorityCharging':
        this.chargingLimits.push({ action, payload, at: nowIso() });
        this.chargingLimits = this.chargingLimits.slice(-40);
        if (action === 'ReportChargingProfiles' && Array.isArray(payload.chargingProfile)) {
          this.chargingProfiles = payload.chargingProfile.map((p) => ({
            evseId: payload.evseId ?? 0,
            chargingProfile: p,
            at: nowIso(),
          }));
        }
        return action === 'NotifyEVChargingSchedule' || action === 'NotifyEVChargingNeeds'
          ? { status: 'Accepted' }
          : {};
      case 'Get15118EVCertificate':
      case 'GetCertificateStatus':
      case 'GetCertificateChainStatus':
      case 'SignCertificate':
        this.registry.addCertificate({ stationId: this.stationId, action, payload });
        if (action === 'Get15118EVCertificate') {
          return { status: 'Accepted', exiResponse: '' };
        }
        return { status: 'Accepted' };
      case 'DataTransfer':
        return { status: 'Accepted', data: 'Helios CSMS' };
      case 'NotifyPeriodicEventStream':
        this.registry.addStreamSample({ stationId: this.stationId, payload, at: nowIso() });
        return null;
      default:
        return defaultCsResponse(action, payload);
    }
  }

  close() {
    this.online = false;
    this.inboundCallId = null;
    this.outboundBusy = false;
    for (const p of this.pending.values()) {
      clearTimeout(p.timer);
      p.reject(new Error('Station disconnected'));
    }
    this.pending.clear();
    for (const q of this.outboundQueue) {
      q.reject(new Error('Station disconnected'));
    }
    this.outboundQueue = [];
    this.emit('close');
    this.registry.emitStation(this);
  }
}
