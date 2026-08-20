/**
 * OCPP 2.1 Edition 2 message catalog (91 messages, blocks A–S).
 * Payload shapes follow docs/OCPP-2.1-Messages-Reference.md.
 * CALL = [2, messageId, action, payload]
 * CALLRESULT = [3, messageId, payload]
 * CALLERROR = [4, messageId, errorCode, errorDescription, errorDetails]
 */

import {
  SPEC_MESSAGE_COUNT,
  FUNCTIONAL_BLOCKS,
  MESSAGE_CATALOG,
  CS_TO_CSMS,
  CSMS_TO_CS,
  ALL_ACTIONS,
  BLOCKS,
  MESSAGE_BY_ACTION,
  messagePurpose,
  messageDirection,
} from './ocpp21-messages.js';

export {
  SPEC_MESSAGE_COUNT,
  FUNCTIONAL_BLOCKS,
  MESSAGE_CATALOG,
  CS_TO_CSMS,
  CSMS_TO_CS,
  ALL_ACTIONS,
  BLOCKS,
  MESSAGE_BY_ACTION,
  messagePurpose,
  messageDirection,
};

export const CALL = 2;
export const CALLRESULT = 3;
export const CALLERROR = 4;
export const SUBPROTOCOL = 'ocpp2.1';

export function nowIso() {
  return new Date().toISOString();
}

/** Book row → OCPP 2.1 TariffType (SetDefaultTariff / ChangeTransactionTariff). */
export function ocppTariffFromBook(rec = {}) {
  const nested = rec.tariff && typeof rec.tariff === 'object' ? rec.tariff : null;
  const tariffId = rec.tariffId || nested?.tariffId || 'MASSIVE-AC-DEFAULT';
  const currency = rec.currency || nested?.currency || 'EUR';
  const price = Number(
    rec.energyKwh ?? nested?.energy?.prices?.[0]?.priceKwh ?? 0.39
  );
  const description = rec.description || nested?.description?.[0]?.content || '';
  const tariff = {
    tariffId: String(tariffId).slice(0, 60),
    currency: String(currency).slice(0, 3).toUpperCase() || 'EUR',
    energy: { prices: [{ priceKwh: Number.isFinite(price) ? price : 0.39 }] },
  };
  if (description) {
    tariff.description = [{ format: 'UTF8', language: 'en', content: String(description).slice(0, 1024) }];
  }
  return tariff;
}

export function getTariffsResult(installed = [], evseId = 0) {
  const wanted = Number(evseId) || 0;
  const list = (installed || []).filter((row) => {
    const tariff = row.tariff || row;
    if (!tariff?.tariffId) return false;
    if (wanted === 0) return true;
    const rowEvse = Number(row.evseId ?? 0);
    return rowEvse === 0 || rowEvse === wanted;
  });
  if (!list.length) return { status: 'NoTariff' };
  return {
    status: 'Accepted',
    tariffAssignments: list.map((row) => ({
      tariffId: row.tariff?.tariffId || row.tariffId,
      tariffKind: row.tariffKind || 'DefaultTariff',
      evseIds: [Number(row.evseId ?? wanted ?? 0)],
    })),
    customData: { tariffs: list.map((row) => row.tariff || row) },
  };
}

export function defaultCsmsPayload(action, ctx = {}) {
  const stationId = ctx.stationId || 'CS';
  const evseId = ctx.evseId ?? 1;
  const connectorId = ctx.connectorId ?? 1;
  const idToken = ctx.idToken || { idToken: 'RFID-MASSIVE-01', type: 'ISO14443' };
  const transactionId = ctx.transactionId || 'tx-demo';
  const requestId = ctx.requestId ?? 1;

  const table = {
    GetVariables: {
      getVariableData: [
        {
          component: { name: 'OCPPCommCtrlr' },
          variable: { name: 'HeartbeatInterval' },
        },
      ],
    },
    SetVariables: {
      setVariableData: [
        {
          component: { name: 'OCPPCommCtrlr' },
          variable: { name: 'HeartbeatInterval' },
          attributeValue: '60',
        },
      ],
    },
    GetBaseReport: { requestId, reportBase: 'FullInventory' },
    GetReport: {
      requestId,
      componentVariable: [{ component: { name: 'ChargingStation' } }],
    },
    SetNetworkProfile: {
      configurationSlot: 1,
      connectionData: {
        ocppVersion: 'OCPP21',
        ocppTransport: 'JSON',
    ocppCsmsUrl: ctx.csmsUrl || 'wss://127.0.0.1:9443/ocpp/2.1',
        messageTimeout: 30,
        securityProfile: 1,
        ocppInterface: 'Wired0',
      },
    },
    Reset: { type: 'Immediate' },
    ClearCache: {},
    SendLocalList: {
      versionNumber: 1,
      updateType: 'Full',
      localAuthorizationList: [
        { idToken, idTokenInfo: { status: 'Accepted' } },
      ],
    },
    GetLocalListVersion: {},
    RequestStartTransaction: { idToken, remoteStartId: Date.now() % 1e9, evseId },
    RequestStopTransaction: { transactionId },
    GetTransactionStatus: { transactionId },
    TriggerMessage: { requestedMessage: 'Heartbeat' },
    UnlockConnector: { evseId, connectorId },
    ChangeAvailability: { operationalStatus: 'Operative', evse: { id: evseId } },
    SetChargingProfile: {
      evseId,
      chargingProfile: {
        id: 1,
        stackLevel: 0,
        chargingProfilePurpose: 'TxDefaultProfile',
        chargingProfileKind: 'Absolute',
        chargingSchedule: [
          {
            id: 1,
            chargingRateUnit: 'W',
            chargingSchedulePeriod: [{ startPeriod: 0, limit: 11000 }],
          },
        ],
      },
    },
    GetChargingProfiles: {
      requestId,
      evseId,
      chargingProfile: { chargingProfilePurpose: 'TxDefaultProfile' },
    },
    ClearChargingProfile: { chargingProfileId: 1 },
    GetCompositeSchedule: { duration: 3600, chargingRateUnit: 'W', evseId },
    UpdateFirmware: {
      requestId,
      firmware: {
        location: 'https://firmware.massive.mobility/ocpp21.bin',
        retrieveDateTime: nowIso(),
      },
    },
    PublishFirmware: {
      location: 'https://firmware.massive.mobility/ocpp21.bin',
      checksum: 'd41d8cd98f00b204e9800998ecf8427e',
      requestId,
    },
    UnpublishFirmware: { checksum: 'd41d8cd98f00b204e9800998ecf8427e' },
    CertificateSigned: { certificateChain: '-----BEGIN CERTIFICATE-----\nDEMO\n-----END CERTIFICATE-----' },
    InstallCertificate: {
      certificateType: 'CSMSRootCertificate',
      certificate: '-----BEGIN CERTIFICATE-----\nDEMO\n-----END CERTIFICATE-----',
    },
    DeleteCertificate: { certificateHashData: { hashAlgorithm: 'SHA256', issuerNameHash: 'aa', issuerKeyHash: 'bb', serialNumber: '1' } },
    GetInstalledCertificateIds: { certificateType: 'CSMSRootCertificate' },
    GetLog: {
      logType: 'DiagnosticsLog',
      requestId,
      log: { remoteLocation: 'https://logs.massive.mobility/upload' },
    },
    SetMonitoringBase: { monitoringBase: 'All' },
    SetVariableMonitoring: {
      setMonitoringData: [
        {
          id: 1,
          value: 80,
          type: 'UpperThreshold',
          severity: 3,
          component: { name: 'TemperatureSensor' },
          variable: { name: 'Temperature' },
        },
      ],
    },
    SetMonitoringLevel: { severity: 3 },
    GetMonitoringReport: { requestId },
    ClearVariableMonitoring: { id: [1] },
    CustomerInformation: { requestId, report: true, clear: false, customerIdentifier: 'CUST-001' },
    CostUpdated: { totalCost: 18.5, transactionId },
    SetDisplayMessage: {
      message: {
        id: 1,
        priority: 'NormalCycle',
        message: { format: 'UTF8', language: 'en', content: `Welcome to Helios · ${stationId}` },
      },
    },
    GetDisplayMessages: { requestId },
    ClearDisplayMessage: { id: 1 },
    ReserveNow: {
      id: 1,
      expiryDateTime: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      idToken,
      evseId,
    },
    CancelReservation: { reservationId: 1 },
    DataTransfer: { vendorId: 'MassiveMobility', messageId: 'Ping', data: 'hello' },
    SetDERControl: {
      isDefault: true,
      controlId: 'der-1',
      controlType: 'EnterService',
    },
    GetDERControl: { requestId, controlId: 'der-1' },
    ClearDERControl: { isDefault: true, controlId: 'der-1' },
    NotifyWebPaymentStarted: { evseId, timeout: 120 },
    NotifyAllowedEnergyTransfer: {
      allowedEnergyTransfer: ['AC_single_phase', 'AC_three_phase', 'DC'],
      transactionId,
    },
    AFRRSignal: { timestamp: nowIso(), signal: 0 },
    RequestBatterySwap: { requestId, idToken },
    GetTariffs: { evseId: 0 },
    SetDefaultTariff: {
      evseId: 0,
      tariff: ocppTariffFromBook({
        tariffId: 'MASSIVE-AC-DEFAULT',
        currency: 'EUR',
        energyKwh: 0.39,
        description: 'Standard AC public tariff',
      }),
    },
    ChangeTransactionTariff: {
      transactionId,
      tariff: ocppTariffFromBook({
        tariffId: 'MASSIVE-AC-PEAK',
        currency: 'EUR',
        energyKwh: 0.55,
        description: 'Peak-hours AC tariff',
      }),
    },
    ClearTariffs: { tariffIds: ['MASSIVE-AC-PEAK'] },
    UpdateDynamicSchedule: { chargingProfileId: 1, scheduleUpdate: { limit: 7000 } },
    UsePriorityCharging: { activate: true, transactionId },
    GetPeriodicEventStream: {},
    AdjustPeriodicEventStream: { id: 1, params: { interval: 5, values: 1 } },
  };

  return table[action] || {};
}

export function defaultCsResponse(action, payload = {}) {
  const accepted = { status: 'Accepted' };
  const ok = {};
  const map = {
    BootNotification: {
      currentTime: nowIso(),
      interval: 300,
      status: 'Accepted',
    },
    Heartbeat: { currentTime: nowIso() },
    StatusNotification: ok,
    NotifyReport: ok,
    Authorize: { idTokenInfo: { status: 'Accepted' } },
    TransactionEvent:
      payload.eventType === 'Ended'
        ? { totalCost: 0 }
        : { status: 'Accepted' },
    MeterValues: ok,
    ClearedChargingLimit: ok,
    NotifyChargingLimit: ok,
    ReportChargingProfiles: ok,
    NotifyEVChargingSchedule: accepted,
    NotifyEVChargingNeeds: accepted,
    FirmwareStatusNotification: ok,
    PublishFirmwareStatusNotification: ok,
    Get15118EVCertificate: { status: 'Accepted', exiResponse: '' },
    GetCertificateStatus: { status: 'Accepted' },
    SignCertificate: accepted,
    SecurityEventNotification: ok,
    LogStatusNotification: ok,
    NotifyEvent: ok,
    NotifyMonitoringReport: ok,
    NotifyCustomerInformation: ok,
    NotifyDisplayMessages: ok,
    ReservationStatusUpdate: ok,
    DataTransfer: { status: 'Accepted' },
    ReportDERControl: ok,
    NotifyDERAlarm: ok,
    NotifyDERStartStop: ok,
    BatterySwap: accepted,
    NotifySettlement: accepted,
    VatNumberValidation: {
      status: 'Accepted',
      vatNumber: payload.vatNumber || '',
      evseId: payload.evseId ?? 0,
      company: {
        name: 'Massive Mobility Lab GmbH',
        address1: '1 Lab Street',
        city: 'Berlin',
        country: 'DE',
        postalCode: '10115',
      },
    },
    OpenPeriodicEventStream: accepted,
    ClosePeriodicEventStream: ok,
    PullDynamicScheduleUpdate: { status: 'Accepted' },
    NotifyPriorityCharging: ok,
    NotifyPeriodicEventStream: undefined,
    GetCertificateChainStatus: { status: 'Accepted' },
  };
  if (action === 'NotifyPeriodicEventStream') return null;
  return map[action] ?? accepted;
}
