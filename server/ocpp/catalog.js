/**
 * OCPP 2.1 Edition 2 message catalog (91 actions).
 * CALL = [2, messageId, action, payload]
 * CALLRESULT = [3, messageId, payload]
 * CALLERROR = [4, messageId, errorCode, errorDescription, errorDetails]
 */

export const CALL = 2;
export const CALLRESULT = 3;
export const CALLERROR = 4;
export const SUBPROTOCOL = 'ocpp2.1';

/** CS → CSMS (station initiated) */
export const CS_TO_CSMS = [
  { action: 'BootNotification', block: 'Provisioning' },
  { action: 'Heartbeat', block: 'Provisioning' },
  { action: 'StatusNotification', block: 'Provisioning' },
  { action: 'NotifyReport', block: 'Provisioning' },
  { action: 'Authorize', block: 'Authorization' },
  { action: 'TransactionEvent', block: 'Transactions' },
  { action: 'MeterValues', block: 'Transactions' },
  { action: 'ClearedChargingLimit', block: 'SmartCharging' },
  { action: 'NotifyChargingLimit', block: 'SmartCharging' },
  { action: 'ReportChargingProfiles', block: 'SmartCharging' },
  { action: 'NotifyEVChargingSchedule', block: 'SmartCharging' },
  { action: 'NotifyEVChargingNeeds', block: 'SmartCharging' },
  { action: 'FirmwareStatusNotification', block: 'Firmware' },
  { action: 'PublishFirmwareStatusNotification', block: 'Firmware' },
  { action: 'Get15118EVCertificate', block: 'Security' },
  { action: 'GetCertificateStatus', block: 'Security' },
  { action: 'SignCertificate', block: 'Security' },
  { action: 'SecurityEventNotification', block: 'Security' },
  { action: 'LogStatusNotification', block: 'Diagnostics' },
  { action: 'NotifyEvent', block: 'Diagnostics' },
  { action: 'NotifyMonitoringReport', block: 'Diagnostics' },
  { action: 'NotifyCustomerInformation', block: 'Diagnostics' },
  { action: 'NotifyDisplayMessages', block: 'Display' },
  { action: 'ReservationStatusUpdate', block: 'Reservation' },
  { action: 'DataTransfer', block: 'DataTransfer' },
  { action: 'ReportDERControl', block: 'DERControl' },
  { action: 'NotifyDERAlarm', block: 'DERControl' },
  { action: 'NotifyDERStartStop', block: 'DERControl' },
  { action: 'BatterySwap', block: 'BatterySwap' },
  { action: 'NotifySettlement', block: 'TariffAndCost' },
  { action: 'NotifyWebPaymentStarted', block: 'TariffAndCost' },
  { action: 'VatNumberValidation', block: 'TariffAndCost' },
  { action: 'PullDynamicScheduleUpdate', block: 'SmartCharging' },
  { action: 'NotifyPriorityCharging', block: 'SmartCharging' },
  { action: 'NotifyPeriodicEventStream', block: 'PeriodicEventStream' },
  { action: 'GetCertificateChainStatus', block: 'Certificates' },
];

/** CSMS → CS (operator / backend initiated) */
export const CSMS_TO_CS = [
  { action: 'GetVariables', block: 'Provisioning' },
  { action: 'SetVariables', block: 'Provisioning' },
  { action: 'GetBaseReport', block: 'Provisioning' },
  { action: 'GetReport', block: 'Provisioning' },
  { action: 'SetNetworkProfile', block: 'Provisioning' },
  { action: 'Reset', block: 'Provisioning' },
  { action: 'ClearCache', block: 'Authorization' },
  { action: 'SendLocalList', block: 'Authorization' },
  { action: 'GetLocalListVersion', block: 'Authorization' },
  { action: 'RequestStartTransaction', block: 'RemoteControl' },
  { action: 'RequestStopTransaction', block: 'RemoteControl' },
  { action: 'GetTransactionStatus', block: 'Transactions' },
  { action: 'TriggerMessage', block: 'RemoteControl' },
  { action: 'UnlockConnector', block: 'RemoteControl' },
  { action: 'ChangeAvailability', block: 'Availability' },
  { action: 'SetChargingProfile', block: 'SmartCharging' },
  { action: 'GetChargingProfiles', block: 'SmartCharging' },
  { action: 'ClearChargingProfile', block: 'SmartCharging' },
  { action: 'GetCompositeSchedule', block: 'SmartCharging' },
  { action: 'UpdateFirmware', block: 'Firmware' },
  { action: 'PublishFirmware', block: 'Firmware' },
  { action: 'UnpublishFirmware', block: 'Firmware' },
  { action: 'CertificateSigned', block: 'Security' },
  { action: 'InstallCertificate', block: 'Security' },
  { action: 'DeleteCertificate', block: 'Security' },
  { action: 'GetInstalledCertificateIds', block: 'Security' },
  { action: 'GetLog', block: 'Diagnostics' },
  { action: 'SetMonitoringBase', block: 'Diagnostics' },
  { action: 'SetVariableMonitoring', block: 'Diagnostics' },
  { action: 'SetMonitoringLevel', block: 'Diagnostics' },
  { action: 'GetMonitoringReport', block: 'Diagnostics' },
  { action: 'ClearVariableMonitoring', block: 'Diagnostics' },
  { action: 'CustomerInformation', block: 'Diagnostics' },
  { action: 'CostUpdated', block: 'Display' },
  { action: 'SetDisplayMessage', block: 'Display' },
  { action: 'GetDisplayMessages', block: 'Display' },
  { action: 'ClearDisplayMessage', block: 'Display' },
  { action: 'ReserveNow', block: 'Reservation' },
  { action: 'CancelReservation', block: 'Reservation' },
  { action: 'DataTransfer', block: 'DataTransfer' },
  { action: 'SetDERControl', block: 'DERControl' },
  { action: 'GetDERControl', block: 'DERControl' },
  { action: 'ClearDERControl', block: 'DERControl' },
  { action: 'NotifyAllowedEnergyTransfer', block: 'Bidirectional' },
  { action: 'AFRRSignal', block: 'Bidirectional' },
  { action: 'RequestBatterySwap', block: 'BatterySwap' },
  { action: 'GetTariffs', block: 'TariffAndCost' },
  { action: 'SetDefaultTariff', block: 'TariffAndCost' },
  { action: 'ChangeTransactionTariff', block: 'TariffAndCost' },
  { action: 'ClearTariffs', block: 'TariffAndCost' },
  { action: 'UpdateDynamicSchedule', block: 'SmartCharging' },
  { action: 'UsePriorityCharging', block: 'SmartCharging' },
  { action: 'OpenPeriodicEventStream', block: 'PeriodicEventStream' },
  { action: 'ClosePeriodicEventStream', block: 'PeriodicEventStream' },
  { action: 'GetPeriodicEventStream', block: 'PeriodicEventStream' },
  { action: 'AdjustPeriodicEventStream', block: 'PeriodicEventStream' },
];

export const ALL_ACTIONS = [
  ...new Set([...CS_TO_CSMS, ...CSMS_TO_CS].map((m) => m.action)),
].sort();

export const BLOCKS = [
  'Provisioning',
  'Authorization',
  'Transactions',
  'RemoteControl',
  'Availability',
  'SmartCharging',
  'Firmware',
  'Security',
  'Certificates',
  'Diagnostics',
  'Display',
  'Reservation',
  'DataTransfer',
  'DERControl',
  'Bidirectional',
  'BatterySwap',
  'TariffAndCost',
  'PeriodicEventStream',
];

export function nowIso() {
  return new Date().toISOString();
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
    NotifyAllowedEnergyTransfer: { allowedEnergyTransfer: ['AC_single_phase', 'DC'] },
    AFRRSignal: { timestamp: nowIso(), signal: 0 },
    RequestBatterySwap: { requestId, idToken },
    GetTariffs: { evseId },
    SetDefaultTariff: {
      evseId,
      tariffId: 'MASSIVE-AC-DEFAULT',
    },
    ChangeTransactionTariff: { tariffId: 'MASSIVE-AC-PEAK', transactionId },
    ClearTariffs: { tariffIds: ['MASSIVE-AC-PEAK'] },
    UpdateDynamicSchedule: { chargingProfileId: 1, scheduleUpdate: { limit: 7000 } },
    UsePriorityCharging: { activate: true },
    OpenPeriodicEventStream: {
      constantStreamData: { id: 1, params: { interval: 10, values: 1 } },
    },
    ClosePeriodicEventStream: { id: 1 },
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
    NotifyWebPaymentStarted: ok,
    VatNumberValidation: { vatNumber: payload.vatNumber || '', status: 'Accepted' },
    PullDynamicScheduleUpdate: { status: 'Accepted' },
    NotifyPriorityCharging: ok,
    NotifyPeriodicEventStream: undefined,
    GetCertificateChainStatus: { status: 'Accepted' },
  };
  if (action === 'NotifyPeriodicEventStream') return null;
  return map[action] ?? accepted;
}
