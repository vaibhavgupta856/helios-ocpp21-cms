/**
 * OCPP 2.1 message catalog — aligned with OCPP_2.1_Messages_Reference.md (91 messages, blocks A–S).
 * Source: Open Charge Alliance OCPP 2.1, cross-referenced with ocpp.md schemas.
 */

export const SPEC_MESSAGE_COUNT = 91;

export const FUNCTIONAL_BLOCKS = [
  { id: 'A', name: 'Security', key: 'Security' },
  { id: 'B', name: 'Provisioning', key: 'Provisioning' },
  { id: 'C', name: 'Authorization', key: 'Authorization' },
  { id: 'D', name: 'Local Auth List', key: 'LocalAuthList' },
  { id: 'E', name: 'Transactions', key: 'Transactions' },
  { id: 'F', name: 'Remote Control', key: 'RemoteControl' },
  { id: 'G', name: 'Availability', key: 'Availability' },
  { id: 'H', name: 'Reservation', key: 'Reservation' },
  { id: 'I', name: 'Tariff & Cost', key: 'TariffAndCost' },
  { id: 'J', name: 'Meter Values', key: 'MeterValues' },
  { id: 'K', name: 'Smart Charging', key: 'SmartCharging' },
  { id: 'L', name: 'Firmware', key: 'Firmware' },
  { id: 'M', name: 'Certificates', key: 'Certificates' },
  { id: 'N', name: 'Diagnostics', key: 'Diagnostics' },
  { id: 'O', name: 'Display', key: 'Display' },
  { id: 'P', name: 'Data Transfer', key: 'DataTransfer' },
  { id: 'Q', name: 'Bidirectional / V2X', key: 'Bidirectional' },
  { id: 'R', name: 'DER Control', key: 'DERControl' },
  { id: 'S', name: 'Battery Swap', key: 'BatterySwap' },
];

/** @typedef {'CS_TO_CSMS'|'CSMS_TO_CS'} MessageDirection */

/**
 * @type {Array<{ num: number, action: string, block: string, direction: MessageDirection, purpose: string, oneWay?: boolean }>}
 */
export const MESSAGE_CATALOG = [
  { num: 1, action: 'SecurityEventNotification', block: 'Security', direction: 'CS_TO_CSMS', purpose: 'Reports a security-relevant event from the station.' },
  { num: 2, action: 'BootNotification', block: 'Provisioning', direction: 'CS_TO_CSMS', purpose: 'Station announces model, vendor, firmware on connect.' },
  { num: 3, action: 'Heartbeat', block: 'Provisioning', direction: 'CS_TO_CSMS', purpose: 'Periodic keep-alive and clock sync.' },
  { num: 4, action: 'GetBaseReport', block: 'Provisioning', direction: 'CSMS_TO_CS', purpose: 'Requests full/summary/configuration inventory (NotifyReport).' },
  { num: 5, action: 'GetReport', block: 'Provisioning', direction: 'CSMS_TO_CS', purpose: 'Filtered device-model report request.' },
  { num: 6, action: 'NotifyReport', block: 'Provisioning', direction: 'CS_TO_CSMS', purpose: 'Delivers report data from GetBaseReport/GetReport.' },
  { num: 7, action: 'GetVariables', block: 'Provisioning', direction: 'CSMS_TO_CS', purpose: 'Reads device-model variable values.' },
  { num: 8, action: 'SetVariables', block: 'Provisioning', direction: 'CSMS_TO_CS', purpose: 'Writes configuration/operational variables.' },
  { num: 9, action: 'SetNetworkProfile', block: 'Provisioning', direction: 'CSMS_TO_CS', purpose: 'Pushes network/connection profile to the station.' },
  { num: 10, action: 'Reset', block: 'Provisioning', direction: 'CSMS_TO_CS', purpose: 'Requests immediate, on-idle, or immediate-and-resume reset.' },
  { num: 11, action: 'Authorize', block: 'Authorization', direction: 'CS_TO_CSMS', purpose: 'Authorizes an idToken before/during charge.' },
  { num: 12, action: 'ClearCache', block: 'Authorization', direction: 'CSMS_TO_CS', purpose: 'Clears local authorization cache on the station.' },
  { num: 13, action: 'SendLocalList', block: 'LocalAuthList', direction: 'CSMS_TO_CS', purpose: 'Pushes local authorization list (full or differential).' },
  { num: 14, action: 'GetLocalListVersion', block: 'LocalAuthList', direction: 'CSMS_TO_CS', purpose: 'Reads local list version on the station.' },
  { num: 15, action: 'TransactionEvent', block: 'Transactions', direction: 'CS_TO_CSMS', purpose: 'Unified transaction lifecycle (Started/Updated/Ended).' },
  { num: 16, action: 'GetTransactionStatus', block: 'Transactions', direction: 'CSMS_TO_CS', purpose: 'Checks ongoing transaction and queued messages.' },
  { num: 17, action: 'RequestStartTransaction', block: 'RemoteControl', direction: 'CSMS_TO_CS', purpose: 'Remotely starts a transaction with idToken.' },
  { num: 18, action: 'RequestStopTransaction', block: 'RemoteControl', direction: 'CSMS_TO_CS', purpose: 'Remotely stops a transaction by ID.' },
  { num: 19, action: 'UnlockConnector', block: 'RemoteControl', direction: 'CSMS_TO_CS', purpose: 'Physically unlocks a connector.' },
  { num: 20, action: 'TriggerMessage', block: 'RemoteControl', direction: 'CSMS_TO_CS', purpose: 'Forces the station to (re)send a message type.' },
  { num: 21, action: 'ChangeAvailability', block: 'Availability', direction: 'CSMS_TO_CS', purpose: 'Sets station/EVSE operative or inoperative.' },
  { num: 22, action: 'StatusNotification', block: 'Availability', direction: 'CS_TO_CSMS', purpose: 'Reports connector status (Available/Occupied/Faulted).' },
  { num: 23, action: 'ReserveNow', block: 'Reservation', direction: 'CSMS_TO_CS', purpose: 'Reserves a connector for an idToken until expiry.' },
  { num: 24, action: 'CancelReservation', block: 'Reservation', direction: 'CSMS_TO_CS', purpose: 'Cancels a reservation by ID.' },
  { num: 25, action: 'ReservationStatusUpdate', block: 'Reservation', direction: 'CS_TO_CSMS', purpose: 'Reservation expired, removed, or no transaction.' },
  { num: 26, action: 'CostUpdated', block: 'TariffAndCost', direction: 'CSMS_TO_CS', purpose: 'Pushes live running cost for display.' },
  { num: 27, action: 'GetTariffs', block: 'TariffAndCost', direction: 'CSMS_TO_CS', purpose: 'Reads tariffs assigned to an EVSE.' },
  { num: 28, action: 'SetDefaultTariff', block: 'TariffAndCost', direction: 'CSMS_TO_CS', purpose: 'Sets default tariff for one or more EVSEs.' },
  { num: 29, action: 'ChangeTransactionTariff', block: 'TariffAndCost', direction: 'CSMS_TO_CS', purpose: 'Changes tariff mid-transaction.' },
  { num: 30, action: 'ClearTariffs', block: 'TariffAndCost', direction: 'CSMS_TO_CS', purpose: 'Removes tariffs by ID or EVSE.' },
  { num: 31, action: 'NotifySettlement', block: 'TariffAndCost', direction: 'CS_TO_CSMS', purpose: 'Reports payment settlement outcome.' },
  { num: 32, action: 'NotifyWebPaymentStarted', block: 'TariffAndCost', direction: 'CSMS_TO_CS', purpose: 'Web payment flow started for an EVSE (timeout).' },
  { num: 33, action: 'VatNumberValidation', block: 'TariffAndCost', direction: 'CS_TO_CSMS', purpose: 'Validates VAT number and returns company details.' },
  { num: 34, action: 'MeterValues', block: 'MeterValues', direction: 'CS_TO_CSMS', purpose: 'Periodic meter readings outside a transaction.' },
  { num: 35, action: 'SetChargingProfile', block: 'SmartCharging', direction: 'CSMS_TO_CS', purpose: 'Installs a charging power/current schedule.' },
  { num: 36, action: 'GetChargingProfiles', block: 'SmartCharging', direction: 'CSMS_TO_CS', purpose: 'Requests matching profiles (ReportChargingProfiles).' },
  { num: 37, action: 'ClearChargingProfile', block: 'SmartCharging', direction: 'CSMS_TO_CS', purpose: 'Removes charging profile(s).' },
  { num: 38, action: 'ReportChargingProfiles', block: 'SmartCharging', direction: 'CS_TO_CSMS', purpose: 'Delivers profiles from GetChargingProfiles.' },
  { num: 39, action: 'GetCompositeSchedule', block: 'SmartCharging', direction: 'CSMS_TO_CS', purpose: 'Returns effective composite schedule for an EVSE.' },
  { num: 40, action: 'ClearedChargingLimit', block: 'SmartCharging', direction: 'CS_TO_CSMS', purpose: 'External charging limit cleared.' },
  { num: 41, action: 'NotifyChargingLimit', block: 'SmartCharging', direction: 'CS_TO_CSMS', purpose: 'External charging limit currently in effect.' },
  { num: 42, action: 'NotifyEVChargingSchedule', block: 'SmartCharging', direction: 'CS_TO_CSMS', purpose: 'EV-proposed ISO 15118 schedule.' },
  { num: 43, action: 'NotifyEVChargingNeeds', block: 'SmartCharging', direction: 'CS_TO_CSMS', purpose: 'EV charging needs from ISO 15118.' },
  { num: 44, action: 'PullDynamicScheduleUpdate', block: 'SmartCharging', direction: 'CS_TO_CSMS', purpose: 'Station asks for dynamic schedule update.' },
  { num: 45, action: 'UpdateDynamicSchedule', block: 'SmartCharging', direction: 'CSMS_TO_CS', purpose: 'Incremental limit/setpoint on dynamic profile.' },
  { num: 46, action: 'NotifyPriorityCharging', block: 'SmartCharging', direction: 'CS_TO_CSMS', purpose: 'Reports priority charging active state.' },
  { num: 47, action: 'UsePriorityCharging', block: 'SmartCharging', direction: 'CSMS_TO_CS', purpose: 'Activates/deactivates priority charging.' },
  { num: 48, action: 'UpdateFirmware', block: 'Firmware', direction: 'CSMS_TO_CS', purpose: 'Download and install firmware.' },
  { num: 49, action: 'FirmwareStatusNotification', block: 'Firmware', direction: 'CS_TO_CSMS', purpose: 'Firmware install progress.' },
  { num: 50, action: 'PublishFirmware', block: 'Firmware', direction: 'CSMS_TO_CS', purpose: 'Host firmware locally for nearby stations.' },
  { num: 51, action: 'PublishFirmwareStatusNotification', block: 'Firmware', direction: 'CS_TO_CSMS', purpose: 'Local firmware publish progress.' },
  { num: 52, action: 'UnpublishFirmware', block: 'Firmware', direction: 'CSMS_TO_CS', purpose: 'Removes published firmware file.' },
  { num: 53, action: 'Get15118EVCertificate', block: 'Certificates', direction: 'CS_TO_CSMS', purpose: 'ISO 15118 certificate install/update EXI relay.' },
  { num: 54, action: 'GetCertificateStatus', block: 'Certificates', direction: 'CS_TO_CSMS', purpose: 'OCSP revocation status of a certificate.' },
  { num: 55, action: 'GetCertificateChainStatus', block: 'Certificates', direction: 'CS_TO_CSMS', purpose: 'Certificate chain status via CRL/OCSP.' },
  { num: 56, action: 'SignCertificate', block: 'Certificates', direction: 'CS_TO_CSMS', purpose: 'Submits CSR for CSMS signing.' },
  { num: 57, action: 'CertificateSigned', block: 'Certificates', direction: 'CSMS_TO_CS', purpose: 'Delivers signed certificate chain.' },
  { num: 58, action: 'InstallCertificate', block: 'Certificates', direction: 'CSMS_TO_CS', purpose: 'Installs root/intermediate CA certificate.' },
  { num: 59, action: 'DeleteCertificate', block: 'Certificates', direction: 'CSMS_TO_CS', purpose: 'Removes installed certificate by hash.' },
  { num: 60, action: 'GetInstalledCertificateIds', block: 'Certificates', direction: 'CSMS_TO_CS', purpose: 'Lists installed certificate IDs.' },
  { num: 61, action: 'GetLog', block: 'Diagnostics', direction: 'CSMS_TO_CS', purpose: 'Requests diagnostics/security log upload.' },
  { num: 62, action: 'LogStatusNotification', block: 'Diagnostics', direction: 'CS_TO_CSMS', purpose: 'Log upload progress from GetLog.' },
  { num: 63, action: 'NotifyEvent', block: 'Diagnostics', direction: 'CS_TO_CSMS', purpose: 'Monitored/alerting device-model events.' },
  { num: 64, action: 'SetMonitoringBase', block: 'Diagnostics', direction: 'CSMS_TO_CS', purpose: 'Selects baseline monitor set.' },
  { num: 65, action: 'SetVariableMonitoring', block: 'Diagnostics', direction: 'CSMS_TO_CS', purpose: 'Creates/updates variable monitor.' },
  { num: 66, action: 'SetMonitoringLevel', block: 'Diagnostics', direction: 'CSMS_TO_CS', purpose: 'Minimum NotifyEvent severity level.' },
  { num: 67, action: 'GetMonitoringReport', block: 'Diagnostics', direction: 'CSMS_TO_CS', purpose: 'Requests monitoring config (NotifyMonitoringReport).' },
  { num: 68, action: 'ClearVariableMonitoring', block: 'Diagnostics', direction: 'CSMS_TO_CS', purpose: 'Removes monitors by ID.' },
  { num: 69, action: 'NotifyMonitoringReport', block: 'Diagnostics', direction: 'CS_TO_CSMS', purpose: 'Delivers monitoring configuration.' },
  { num: 70, action: 'CustomerInformation', block: 'Diagnostics', direction: 'CSMS_TO_CS', purpose: 'Retrieve or clear stored customer data.' },
  { num: 71, action: 'NotifyCustomerInformation', block: 'Diagnostics', direction: 'CS_TO_CSMS', purpose: 'Delivers customer information (paginated).' },
  { num: 72, action: 'OpenPeriodicEventStream', block: 'Diagnostics', direction: 'CS_TO_CSMS', purpose: 'Opens continuous variable monitor stream.' },
  { num: 73, action: 'ClosePeriodicEventStream', block: 'Diagnostics', direction: 'CS_TO_CSMS', purpose: 'Terminates an active periodic stream.' },
  { num: 74, action: 'GetPeriodicEventStream', block: 'Diagnostics', direction: 'CSMS_TO_CS', purpose: 'Lists active periodic event streams.' },
  { num: 75, action: 'AdjustPeriodicEventStream', block: 'Diagnostics', direction: 'CSMS_TO_CS', purpose: 'Modifies stream sampling interval/parameters.' },
  { num: 76, action: 'NotifyPeriodicEventStream', block: 'Diagnostics', direction: 'CS_TO_CSMS', purpose: 'Streamed data points (one-way, no response).', oneWay: true },
  { num: 77, action: 'SetDisplayMessage', block: 'Display', direction: 'CSMS_TO_CS', purpose: 'Pushes HMI display message.' },
  { num: 78, action: 'GetDisplayMessages', block: 'Display', direction: 'CSMS_TO_CS', purpose: 'Retrieves display messages (NotifyDisplayMessages).' },
  { num: 79, action: 'ClearDisplayMessage', block: 'Display', direction: 'CSMS_TO_CS', purpose: 'Removes display message by ID.' },
  { num: 80, action: 'NotifyDisplayMessages', block: 'Display', direction: 'CS_TO_CSMS', purpose: 'Delivers display message details.' },
  { num: 81, action: 'DataTransfer', block: 'DataTransfer', direction: 'CS_TO_CSMS', purpose: 'Vendor-specific escape hatch (bidirectional).' },
  { num: 82, action: 'NotifyAllowedEnergyTransfer', block: 'Bidirectional', direction: 'CSMS_TO_CS', purpose: 'Permitted energy transfer modes for V2X.' },
  { num: 83, action: 'AFRRSignal', block: 'Bidirectional', direction: 'CSMS_TO_CS', purpose: 'Automatic Frequency Restoration Reserve signal.' },
  { num: 84, action: 'GetDERControl', block: 'DERControl', direction: 'CSMS_TO_CS', purpose: 'Requests DER control settings (ReportDERControl).' },
  { num: 85, action: 'SetDERControl', block: 'DERControl', direction: 'CSMS_TO_CS', purpose: 'Configures DER control curve/settings.' },
  { num: 86, action: 'ClearDERControl', block: 'DERControl', direction: 'CSMS_TO_CS', purpose: 'Removes active/default DER controls.' },
  { num: 87, action: 'ReportDERControl', block: 'DERControl', direction: 'CS_TO_CSMS', purpose: 'Reports current DER configuration.' },
  { num: 88, action: 'NotifyDERAlarm', block: 'DERControl', direction: 'CS_TO_CSMS', purpose: 'Grid-disturbance DER alarm start/end.' },
  { num: 89, action: 'NotifyDERStartStop', block: 'DERControl', direction: 'CS_TO_CSMS', purpose: 'DER control started or stopped.' },
  { num: 90, action: 'BatterySwap', block: 'BatterySwap', direction: 'CS_TO_CSMS', purpose: 'Battery insertion/removal at swap station.' },
  { num: 91, action: 'RequestBatterySwap', block: 'BatterySwap', direction: 'CSMS_TO_CS', purpose: 'Initiates battery swap for idToken.' },
];

/** DataTransfer is also CSMS→CS */
export const DATA_TRANSFER_CSMS = {
  num: 81,
  action: 'DataTransfer',
  block: 'DataTransfer',
  direction: 'CSMS_TO_CS',
  purpose: 'Vendor-specific escape hatch (bidirectional).',
};

export const CS_TO_CSMS = MESSAGE_CATALOG.filter((m) => m.direction === 'CS_TO_CSMS').map(({ action, block, purpose, num }) => ({
  action,
  block,
  purpose,
  num,
}));

export const CSMS_TO_CS = [
  ...MESSAGE_CATALOG.filter((m) => m.direction === 'CSMS_TO_CS').map(({ action, block, purpose, num }) => ({
    action,
    block,
    purpose,
    num,
  })),
  { action: 'DataTransfer', block: 'DataTransfer', purpose: DATA_TRANSFER_CSMS.purpose, num: 81 },
];

export const ALL_ACTIONS = [...new Set(MESSAGE_CATALOG.map((m) => m.action))].sort();

export const BLOCKS = FUNCTIONAL_BLOCKS.map((b) => b.key);

export const MESSAGE_BY_ACTION = Object.fromEntries(MESSAGE_CATALOG.map((m) => [m.action, m]));

export function messagePurpose(action) {
  return MESSAGE_BY_ACTION[action]?.purpose || '';
}

export function messageDirection(action) {
  if (action === 'DataTransfer') return 'bidirectional';
  return MESSAGE_BY_ACTION[action]?.direction === 'CSMS_TO_CS' ? 'CSMS → CS' : 'CS → CSMS';
}
