# OCPP 2.1 — Complete Message Reference (91 Messages)

Compiled for Massive Mobility. Source: Open Charge Alliance OCPP 2.1 specification, cross-referenced against [ocpp.md](https://ocpp.md/ocpp-2.1/), a schema reference generated from the official OCA JSON schemas.

OCPP 2.1 defines **91 messages** (each a Request/Response pair, except where noted as one-way) organized into **19 functional blocks (A–S)**. A message is exchanged between the **Charging Station (CS)** and the **Charging Station Management System (CSMS)** using OCPP-J (JSON over WebSocket), wrapped in the standard `[MessageTypeId, MessageId, Action, Payload]` envelope.

64 of the 91 messages carry over from OCPP 2.0.1; 27 are new or substantially reworked in 2.1 — most visibly the three brand-new functional blocks: **I – Tariff & Cost**, **Q – Bidirectional/V2X**, **R – DER Control**, and **S – Battery Swap**, plus additions like `GetCertificateChainStatus`, `UpdateDynamicSchedule`, `UsePriorityCharging`, and the Periodic Event Stream family in Diagnostics.

---

## Functional Block Summary

| Block | Name | # Msgs | Highlights |
|---|---|---|---|
| A | Security | 1 | SecurityEventNotification |
| B | Provisioning | 9 | BootNotification, Heartbeat, GetReport, SetVariables, Reset |
| C | Authorization | 2 | Authorize, ClearCache |
| D | Local Auth List | 2 | SendLocalList, GetLocalListVersion |
| E | Transactions | 2 | TransactionEvent, GetTransactionStatus |
| F | Remote Control | 4 | RequestStartTransaction, RequestStopTransaction, UnlockConnector, TriggerMessage |
| G | Availability | 2 | ChangeAvailability, StatusNotification |
| H | Reservation | 3 | ReserveNow, CancelReservation, ReservationStatusUpdate |
| I | Tariff & Cost *(new in 2.1)* | 8 | CostUpdated, GetTariffs, SetDefaultTariff, NotifySettlement |
| J | Meter Values | 1 | MeterValues |
| K | Smart Charging | 13 | SetChargingProfile, GetCompositeSchedule, UpdateDynamicSchedule *(new)*, UsePriorityCharging *(new)* |
| L | Firmware | 5 | UpdateFirmware, PublishFirmware, FirmwareStatusNotification |
| M | Certificates | 8 | InstallCertificate, SignCertificate, GetCertificateChainStatus *(new)* |
| N | Diagnostics | 16 | GetLog, NotifyEvent, monitoring + Periodic Event Stream family *(new)* |
| O | Display | 4 | SetDisplayMessage, GetDisplayMessages, NotifyDisplayMessages |
| P | Data Transfer | 1 | DataTransfer |
| Q | Bidirectional / V2X *(new in 2.1)* | 2 | NotifyAllowedEnergyTransfer, AFRRSignal |
| R | DER Control *(new in 2.1)* | 6 | SetDERControl, GetDERControl, NotifyDERAlarm |
| S | Battery Swap *(new in 2.1)* | 2 | BatterySwap, RequestBatterySwap |
| | **Total** | **91** | |

---

## Block A — Security (1)

### 1. SecurityEventNotification
**Direction:** CS → CSMS &nbsp;|&nbsp; **Purpose:** Reports a security-relevant event (e.g. tamper detection, failed firmware signature check) from the station to the CSMS for logging/monitoring.

**Request**
```json
{
  "timestamp": "2024-01-15T10:30:00Z",
  "type": "string",
  "techInfo": "string",
  "customData": {}
}
```
**Response**
```json
{}
```

---

## Block B — Provisioning (9)

### 2. BootNotification
**Direction:** CS → CSMS &nbsp;|&nbsp; **Purpose:** Station announces itself (model, vendor, firmware, serial) and boot reason on every (re)connect; CSMS returns the accepted heartbeat interval.

**Request**
```json
{
  "chargingStation": {
    "model": "string",
    "vendorName": "string",
    "firmwareVersion": "string",
    "serialNumber": "string",
    "modem": { "iccid": "string", "imsi": "string" }
  },
  "reason": "ApplicationReset|FirmwareUpdate|LocalReset|PowerUp|RemoteReset|ScheduledReset|Triggered|Unknown|Watchdog",
  "customData": {}
}
```
**Response**
```json
{
  "currentTime": "2024-01-15T10:30:00Z",
  "interval": 0,
  "status": "Accepted|Pending|Rejected",
  "statusInfo": { "reasonCode": "string", "additionalInfo": "string" },
  "customData": {}
}
```

### 3. Heartbeat
**Direction:** CS → CSMS &nbsp;|&nbsp; **Purpose:** Periodic keep-alive; CSMS's response is also how the station syncs its clock.

**Request**
```json
{ "customData": {} }
```
**Response**
```json
{ "currentTime": "2024-01-15T10:30:00Z", "customData": {} }
```

### 4. GetBaseReport
**Direction:** CSMS → CS &nbsp;|&nbsp; **Purpose:** Requests a full/summary/configuration inventory report (delivered later via NotifyReport).

**Request**
```json
{
  "reportBase": "ConfigurationInventory|FullInventory|SummaryInventory",
  "requestId": 0,
  "customData": {}
}
```
**Response**
```json
{
  "status": "Accepted|Rejected|AcceptedCanceled|AcceptedWithWarnings",
  "statusInfo": { "reasonCode": "string", "additionalInfo": "string" },
  "customData": {}
}
```

### 5. GetReport
**Direction:** CSMS → CS &nbsp;|&nbsp; **Purpose:** Like GetBaseReport but filtered to specific components/variables or component criteria.

**Request**
```json
{
  "requestId": 0,
  "componentCriteria": ["Active|Available|Enabled|Problem"],
  "componentVariable": [
    { "component": { "name": "string", "instance": "string" },
      "variable": { "name": "string", "instance": "string" } }
  ],
  "customData": {}
}
```
**Response**
```json
{
  "status": "Accepted|Rejected|AcceptedCanceled|AcceptedWithWarnings",
  "statusInfo": { "reasonCode": "string", "additionalInfo": "string" },
  "customData": {}
}
```

### 6. NotifyReport
**Direction:** CS → CSMS &nbsp;|&nbsp; **Purpose:** Delivers the report data requested via GetBaseReport/GetReport, possibly split across multiple messages (`tbc` = "to be continued").

**Request**
```json
{
  "generatedAt": "2024-01-15T10:30:00Z",
  "requestId": 0,
  "seqNo": 0,
  "reportData": [
    {
      "component": { "name": "string", "instance": "string" },
      "variable": { "name": "string", "instance": "string" },
      "variableAttribute": [
        { "type": "Actual|Target|MinSet|MaxSet", "value": "string",
          "mutability": "ReadOnly|WriteOnly|ReadWrite", "persistent": false, "constant": false }
      ],
      "variableCharacteristics": {
        "dataType": "string|decimal|integer|dateTime|boolean|OptionList|SequenceList|MemberList",
        "supportsMonitoring": true, "unit": "string", "minLimit": 0, "maxLimit": 0, "valuesList": "string"
      }
    }
  ],
  "tbc": false,
  "customData": {}
}
```
**Response**
```json
{ "customData": {} }
```

### 7. GetVariables
**Direction:** CSMS → CS &nbsp;|&nbsp; **Purpose:** Reads current values of one or more device-model variables.

**Request**
```json
{
  "getVariableData": [
    { "component": { "name": "string", "instance": "string" },
      "variable": { "name": "string", "instance": "string" },
      "attributeType": "Actual|Target|MinSet|MaxSet" }
  ],
  "customData": {}
}
```
**Response**
```json
{
  "getVariableResult": [
    { "attributeStatus": "Accepted|Rejected|UnknownComponent|UnknownVariable|NotSupportedAttributeType",
      "component": { "name": "string", "instance": "string" },
      "variable": { "name": "string", "instance": "string" },
      "attributeStatusInfo": { "reasonCode": "string", "additionalInfo": "string" },
      "attributeType": "Actual|Target|MinSet|MaxSet",
      "attributeValue": "string" }
  ],
  "customData": {}
}
```

### 8. SetVariables
**Direction:** CSMS → CS &nbsp;|&nbsp; **Purpose:** Writes configuration/operational variables on the station (the core config-push mechanism in 2.x, replacing OCPP 1.6's ChangeConfiguration).

**Request**
```json
{
  "setVariableData": [
    { "attributeValue": "string",
      "component": { "name": "string", "instance": "string" },
      "variable": { "name": "string", "instance": "string" },
      "attributeType": "Actual|Target|MinSet|MaxSet" }
  ],
  "customData": {}
}
```
**Response**
```json
{
  "setVariableResult": [
    { "attributeStatus": "Accepted|Rejected|UnknownComponent|UnknownVariable|NotSupportedAttributeType|RebootRequired",
      "component": { "name": "string", "instance": "string" },
      "variable": { "name": "string", "instance": "string" },
      "attributeStatusInfo": { "reasonCode": "string", "additionalInfo": "string" },
      "attributeType": "Actual|Target|MinSet|MaxSet" }
  ],
  "customData": {}
}
```

### 9. SetNetworkProfile
**Direction:** CSMS → CS &nbsp;|&nbsp; **Purpose:** Pushes a network/connection profile (URL, security profile, VPN/APN settings) into one of the station's configuration slots.

**Request**
```json
{
  "configurationSlot": 0,
  "connectionData": {
    "ocppInterface": "Wired0|Wired1|Wired2|Wired3|Wireless0|Wireless1|Wireless2|Wireless3|Any",
    "ocppTransport": "SOAP|JSON",
    "messageTimeout": 0,
    "ocppCsmsUrl": "string",
    "securityProfile": 0,
    "apn": { "apn": "string", "apnAuthentication": "PAP|CHAP|NONE|AUTO", "apnPassword": "string",
      "apnUserName": "string", "preferredNetwork": "string", "simPin": 0, "useOnlyPreferredNetwork": false },
    "basicAuthPassword": "string",
    "identity": "string",
    "ocppVersion": "OCPP12|OCPP15|OCPP16|OCPP20|OCPP201|OCPP21",
    "vpn": { "key": "string", "password": "string", "server": "string", "type": "IKEv2|IPSec|L2TP|PPTP", "user": "string", "group": "string" }
  },
  "customData": {}
}
```
**Response**
```json
{
  "status": "Accepted|Rejected|Failed",
  "statusInfo": { "reasonCode": "string", "additionalInfo": "string" },
  "customData": {}
}
```

### 10. Reset
**Direction:** CSMS → CS &nbsp;|&nbsp; **Purpose:** Requests a full station reset or reset of a specific EVSE, immediate or on-idle.

**Request**
```json
{ "type": "Immediate|OnIdle|ImmediateAndResume", "evseId": 0, "customData": {} }
```
**Response**
```json
{
  "status": "Accepted|Rejected|Scheduled",
  "statusInfo": { "reasonCode": "string", "additionalInfo": "string" },
  "customData": {}
}
```

---

## Block C — Authorization (2)

### 11. Authorize
**Direction:** CS → CSMS &nbsp;|&nbsp; **Purpose:** Asks the CSMS to authorize an ID token (RFID, app, ISO 15118 contract certificate) before/while starting a charge.

**Request**
```json
{
  "idToken": { "idToken": "string", "type": "string" },
  "certificate": "string",
  "iso15118CertificateHashData": [
    { "hashAlgorithm": "string", "issuerKeyHash": "string", "issuerNameHash": "string",
      "responderURL": "string", "serialNumber": "string", "customData": {} }
  ],
  "customData": {}
}
```
**Response**
```json
{
  "idTokenInfo": {},
  "allowedEnergyTransfer": ["string"],
  "certificateStatus": "Accepted",
  "tariff": {},
  "customData": {}
}
```

### 12. ClearCache
**Direction:** CSMS → CS &nbsp;|&nbsp; **Purpose:** Instructs the station to clear its local authorization cache.

**Request**
```json
{ "customData": {} }
```
**Response**
```json
{ "status": "Accepted", "statusInfo": {}, "customData": {} }
```

---

## Block D — Local Auth List (2)

### 13. SendLocalList
**Direction:** CSMS → CS &nbsp;|&nbsp; **Purpose:** Pushes a full or differential update of the station's local authorization list.

**Request**
```json
{
  "updateType": "Differential|Full",
  "versionNumber": 0,
  "localAuthorizationList": [
    { "idToken": { "idToken": "string", "type": "string" }, "idTokenInfo": { "status": "string" }, "customData": {} }
  ],
  "customData": {}
}
```
**Response**
```json
{
  "status": "Accepted|Failed|VersionMismatch",
  "statusInfo": { "reasonCode": "string", "additionalInfo": "string" },
  "customData": {}
}
```

### 14. GetLocalListVersion
**Direction:** CSMS → CS &nbsp;|&nbsp; **Purpose:** Reads the current version number of the local list stored on the station.

**Request**
```json
{ "customData": {} }
```
**Response**
```json
{ "versionNumber": 0, "customData": {} }
```

---

## Block E — Transactions (2)

### 15. TransactionEvent
**Direction:** CS → CSMS &nbsp;|&nbsp; **Purpose:** The single, unified message for a transaction's full lifecycle (Started/Updated/Ended) — carries meter values, cost details, and charging state.

**Request**
```json
{
  "eventType": "Started|Updated|Ended",
  "seqNo": 0,
  "timestamp": "2024-01-15T10:30:00Z",
  "transactionInfo": {
    "transactionId": "string",
    "chargingState": "EVConnected|Charging|SuspendedEV|SuspendedEVSE|Idle",
    "operationMode": "string",
    "remoteStartId": 0,
    "stoppedReason": "DeAuthorized|EmergencyStop|Local|Remote",
    "tariffId": "string",
    "timeSpentCharging": 0,
    "transactionLimit": { "maxCost": 0.0, "maxEnergy": 0.0, "maxSoC": 100, "maxTime": 0 }
  },
  "triggerReason": "AbnormalCondition|Authorized|CablePluggedIn",
  "cableMaxCurrent": 0,
  "costDetails": {
    "totalCost": { "currency": "USD", "total": { "exclTax": 0.0, "inclTax": 0.0 },
      "typeOfCost": "NormalCost|MinCost|MaxCost", "energy": { "exclTax": 0.0, "inclTax": 0.0 } },
    "totalUsage": { "chargingTime": 0, "energy": 0.0, "idleTime": 0 },
    "chargingPeriods": [
      { "startPeriod": "2024-01-15T10:30:00Z",
        "dimensions": [ { "type": "Energy|Power|Time", "volume": 0.0 } ],
        "tariffId": "string" }
    ]
  },
  "meterValue": [
    { "timestamp": "2024-01-15T10:30:00Z",
      "sampledValue": [
        { "value": 0.0, "context": "Sample.Periodic|Transaction.Begin|Transaction.End",
          "location": "Outlet|Inlet|Cable|Body|EV|Upstream",
          "measurand": "Energy.Active.Import.Register|Current.Import|Voltage",
          "phase": "L1|L2|L3|N|L1-N",
          "unitOfMeasure": { "unit": "Wh", "multiplier": 0 },
          "signedMeterValue": { "encodingMethod": "OCMF", "signedMeterData": "string", "signingMethod": "string", "publicKey": "string" } } ] }
  ],
  "numberOfPhasesUsed": 3,
  "offline": false,
  "preconditioningStatus": "Unknown|Ready|NotReady|Preconditioning",
  "reservationId": 0,
  "evseSleep": false
}
```
**Response**
```json
{
  "chargingPriority": 0,
  "idTokenInfo": {
    "status": "Accepted|Blocked|ConcurrentTx|Expired|Invalid|NoCredit|NotAllowedTypeEV|NotAtThisLocation|NotAtThisTime|Unknown",
    "cacheExpiryDateTime": "2024-01-15T10:30:00Z",
    "chargingPriority": 0,
    "chargingProfileId": 0,
    "groupIdTokenInfo": { "status": "Accepted|Blocked", "cacheExpiryDateTime": "2024-01-15T10:30:00Z", "chargingPriority": 0, "chargingProfileId": 0 },
    "language1": "en", "language2": "en",
    "personalMessage": { "format": "ASCII|HTML|URI", "language": "en", "content": "string" }
  },
  "totalCost": 0.0,
  "transactionLimit": { "maxCost": 0.0, "maxEnergy": 0.0, "maxSoC": 100, "maxTime": 0 },
  "updatedPersonalMessage": { "format": "ASCII|HTML|URI", "language": "en", "content": "string" },
  "updatedPersonalMessageExtra": [ { "format": "ASCII|HTML|URI", "language": "en", "content": "string" } ]
}
```

### 16. GetTransactionStatus
**Direction:** CSMS → CS &nbsp;|&nbsp; **Purpose:** Checks whether a transaction is still ongoing and whether messages are queued for delivery.

**Request**
```json
{ "transactionId": "string" }
```
**Response**
```json
{ "messagesInQueue": true, "ongoingIndicator": true }
```

---

## Block F — Remote Control (4)

### 17. RequestStartTransaction
**Direction:** CSMS → CS &nbsp;|&nbsp; **Purpose:** Remotely starts a transaction (e.g. from an app or operator dashboard) with an ID token and optional charging profile.

**Request**
```json
{
  "idToken": { "idToken": "string", "type": "string" },
  "remoteStartId": 0,
  "chargingProfile": {},
  "evseId": 1,
  "groupIdToken": {},
  "customData": {}
}
```
**Response**
```json
{ "status": "Accepted|Rejected", "statusInfo": {}, "transactionId": "string", "customData": {} }
```

### 18. RequestStopTransaction
**Direction:** CSMS → CS &nbsp;|&nbsp; **Purpose:** Remotely stops a running transaction by ID.

**Request**
```json
{ "transactionId": "string", "customData": {} }
```
**Response**
```json
{ "status": "Accepted|Rejected", "statusInfo": {}, "customData": {} }
```

### 19. UnlockConnector
**Direction:** CSMS → CS &nbsp;|&nbsp; **Purpose:** Physically unlocks a connector (e.g. for support/troubleshooting).

**Request**
```json
{ "connectorId": 0, "evseId": 0, "customData": {} }
```
**Response**
```json
{ "status": "Unlocked|UnlockFailed|OngoingAuthorizedTransaction|UnknownConnector", "statusInfo": {}, "customData": {} }
```

### 20. TriggerMessage
**Direction:** CSMS → CS &nbsp;|&nbsp; **Purpose:** Asks the station to (re)send a specific message type on demand (e.g. force a fresh StatusNotification or BootNotification).

**Request**
```json
{
  "requestedMessage": "BootNotification|LogStatusNotification|FirmwareStatusNotification|Heartbeat|MeterValues|SignChargingStationCertificate|SignV2GCertificate|SignV2G20Certificate|StatusNotification|TransactionEvent|SignCombinedCertificate|PublishFirmwareStatusNotification|CustomTrigger",
  "customTrigger": "string",
  "evse": {},
  "customData": {}
}
```
**Response**
```json
{ "status": "Accepted|Rejected|NotImplemented", "statusInfo": {}, "customData": {} }
```

---

## Block G — Availability (2)

### 21. ChangeAvailability
**Direction:** CSMS → CS &nbsp;|&nbsp; **Purpose:** Sets a station or EVSE Operative/Inoperative.

**Request**
```json
{ "operationalStatus": "Inoperative", "evse": null, "customData": null }
```
**Response**
```json
{ "status": "Accepted", "statusInfo": null, "customData": null }
```

### 22. StatusNotification
**Direction:** CS → CSMS &nbsp;|&nbsp; **Purpose:** Reports a connector's current status (Available/Occupied/Faulted/etc.) — the core presence signal for a connector.

**Request**
```json
{ "connectorId": 0, "connectorStatus": "Available", "evseId": 0, "timestamp": "2024-01-15T10:30:00Z", "customData": null }
```
**Response**
```json
{}
```

---

## Block H — Reservation (3)

### 23. ReserveNow
**Direction:** CSMS → CS &nbsp;|&nbsp; **Purpose:** Reserves a connector/EVSE for a specific ID token until an expiry time.

**Request**
```json
{
  "expiryDateTime": "2024-01-15T10:30:00Z",
  "id": 0,
  "idToken": { "idToken": "string", "type": "string" },
  "connectorType": "string",
  "evseId": 0,
  "groupIdToken": { "idToken": "string", "type": "string" },
  "customData": {}
}
```
**Response**
```json
{ "status": "Accepted|Faulted|Occupied|Rejected|Unavailable", "statusInfo": {}, "customData": {} }
```

### 24. CancelReservation
**Direction:** CSMS → CS &nbsp;|&nbsp; **Purpose:** Cancels an existing reservation by ID.

**Request**
```json
{ "reservationId": 0, "customData": {} }
```
**Response**
```json
{ "status": "Accepted|Rejected", "statusInfo": {}, "customData": {} }
```

### 25. ReservationStatusUpdate
**Direction:** CS → CSMS &nbsp;|&nbsp; **Purpose:** Notifies the CSMS that a reservation expired, was removed, or resulted in no transaction.

**Request**
```json
{ "reservationId": 0, "reservationUpdateStatus": "Expired|Removed|NoTransaction", "customData": {} }
```
**Response**
```json
{}
```

---

## Block I — Tariff & Cost *(new in OCPP 2.1)* (8)

### 26. CostUpdated
**Direction:** CSMS → CS &nbsp;|&nbsp; **Purpose:** Pushes a live running cost total for an ongoing transaction, for display to the driver.

**Request**
```json
{ "totalCost": 0.0, "transactionId": "string", "customData": {} }
```
**Response**
```json
{}
```

### 27. GetTariffs
**Direction:** CSMS → CS &nbsp;|&nbsp; **Purpose:** Reads which tariffs are currently assigned to an EVSE (or all EVSEs).

**Request**
```json
{ "evseId": 0, "customData": {} }
```
**Response**
```json
{
  "status": "Accepted",
  "statusInfo": {},
  "tariffAssignments": [
    { "tariffId": "string", "tariffKind": "DefaultTariff", "evseIds": [0], "idTokens": ["string"],
      "validFrom": "2024-01-15T10:30:00Z", "customData": {} }
  ],
  "customData": {}
}
```

### 28. SetDefaultTariff
**Direction:** CSMS → CS &nbsp;|&nbsp; **Purpose:** Sets the default tariff (pricing structure) for one or more EVSEs — enables the station to show/enforce price-per-kWh, per-minute, etc.

**Request**
```json
{ "evseId": 0, "tariff": { "tariffId": "string", "currency": "string" }, "customData": {} }
```
**Response**
```json
{ "status": "Accepted", "statusInfo": {}, "customData": {} }
```

### 29. ChangeTransactionTariff
**Direction:** CSMS → CS &nbsp;|&nbsp; **Purpose:** Changes the tariff applied mid-transaction (e.g. a promo rate kicking in).

**Request**
```json
{ "tariff": { "tariffId": "string", "currency": "string" }, "transactionId": "string", "customData": {} }
```
**Response**
```json
{ "status": "Accepted", "statusInfo": {}, "customData": {} }
```

### 30. ClearTariffs
**Direction:** CSMS → CS &nbsp;|&nbsp; **Purpose:** Removes tariffs (by ID or for an EVSE) from the station.

**Request**
```json
{ "evseId": 0, "tariffIds": ["string"], "customData": {} }
```
**Response**
```json
{
  "clearTariffsResult": [ { "status": "Accepted", "statusInfo": {}, "tariffId": "string", "customData": {} } ],
  "customData": {}
}
```

### 31. NotifySettlement
**Direction:** CS → CSMS &nbsp;|&nbsp; **Purpose:** Reports a payment settlement outcome (e.g. after an on-station card/tap-to-pay transaction) including receipt info and VAT company details.

**Request**
```json
{
  "pspRef": "string", "settlementAmount": 0.0, "settlementTime": "2024-01-15T10:30:00Z",
  "status": "Settled", "receiptId": "string", "receiptUrl": "string", "statusInfo": "string",
  "transactionId": "string",
  "vatCompany": { "address1": "string", "city": "string", "country": "string", "name": "string",
    "address2": "string", "postalCode": "string", "customData": {} },
  "vatNumber": "string", "customData": {}
}
```
**Response**
```json
{ "receiptId": "string", "receiptUrl": "string", "customData": {} }
```

### 32. NotifyWebPaymentStarted
**Direction:** CSMS → CS &nbsp;|&nbsp; **Purpose:** Tells the station a web-based payment flow (e.g. QR-code checkout) has begun for a given EVSE, with a timeout.

**Request**
```json
{ "evseId": 0, "timeout": 0, "customData": {} }
```
**Response**
```json
{}
```

### 33. VatNumberValidation
**Direction:** CS → CSMS &nbsp;|&nbsp; **Purpose:** Asks the CSMS to validate a VAT number (e.g. entered by a business driver) and return company details.

**Request**
```json
{ "vatNumber": "string", "evseId": 0, "customData": {} }
```
**Response**
```json
{
  "status": "Accepted", "vatNumber": "string",
  "company": { "address1": "string", "city": "string", "country": "string", "name": "string",
    "address2": "string", "postalCode": "string", "customData": {} },
  "evseId": 0, "statusInfo": {}, "customData": {}
}
```

---

## Block J — Meter Values (1)

### 34. MeterValues
**Direction:** CS → CSMS &nbsp;|&nbsp; **Purpose:** Sends periodic/triggered meter readings (energy, current, voltage, power, SoC, etc.) outside a transaction context (in-transaction readings ride on TransactionEvent).

**Request**
```json
{
  "evseId": 0,
  "meterValue": [
    { "timestamp": "2024-01-15T10:30:00Z",
      "sampledValue": [
        { "value": 0, "context": "Sample.Periodic", "location": "Outlet",
          "measurand": "Energy.Active.Import.Register", "phase": "L1",
          "signedMeterValue": { "encodingMethod": "string", "signedMeterData": "string", "publicKey": "string", "signingMethod": "string", "customData": {} },
          "unitOfMeasure": { "multiplier": 0, "unit": "Wh", "customData": {} },
          "customData": {} } ],
      "customData": {} }
  ],
  "customData": {}
}
```
**Response**
```json
{}
```

---

## Block K — Smart Charging (13)

### 35. SetChargingProfile
**Direction:** CSMS → CS &nbsp;|&nbsp; **Purpose:** Installs a charging profile (schedule of power/current limits) on an EVSE — the primary lever for load management and V1G smart charging.

**Request**
```json
{
  "chargingProfile": { "id": 0, "stackLevel": 0, "chargingProfilePurpose": "ChargingStationExternalConstraints",
    "chargingProfileKind": "Absolute", "chargingSchedule": ["{...}"] },
  "evseId": 0
}
```
**Response**
```json
{ "status": "Accepted", "statusInfo": {}, "customData": {} }
```

### 36. GetChargingProfiles
**Direction:** CSMS → CS &nbsp;|&nbsp; **Purpose:** Requests the station report back charging profiles matching given criteria (results arrive via ReportChargingProfiles).

**Request**
```json
{ "chargingProfile": {}, "requestId": 0 }
```
**Response**
```json
{ "status": "Accepted", "statusInfo": {}, "customData": {} }
```

### 37. ClearChargingProfile
**Direction:** CSMS → CS &nbsp;|&nbsp; **Purpose:** Removes charging profile(s) by ID or by criteria.

**Request**
```json
{ "chargingProfileId": 0, "chargingProfileCriteria": {} }
```
**Response**
```json
{ "status": "Accepted", "statusInfo": {}, "customData": {} }
```

### 38. ReportChargingProfiles
**Direction:** CS → CSMS &nbsp;|&nbsp; **Purpose:** Delivers the charging profiles requested via GetChargingProfiles.

**Request**
```json
{
  "chargingLimitSource": "string",
  "chargingProfile": [
    { "id": 0, "stackLevel": 0, "chargingProfilePurpose": "ChargingStationExternalConstraints",
      "chargingProfileKind": "Absolute", "chargingSchedule": ["{...}"] }
  ],
  "evseId": 0, "requestId": 0, "tbc": false
}
```
**Response**
```json
{}
```

### 39. GetCompositeSchedule
**Direction:** CSMS → CS &nbsp;|&nbsp; **Purpose:** Asks the station to calculate and return the resulting effective schedule (composite of all stacked profiles) for an EVSE over a duration.

**Request**
```json
{ "duration": 0, "evseId": 0, "chargingRateUnit": "W" }
```
**Response**
```json
{
  "status": "Accepted",
  "schedule": { "chargingRateUnit": "W", "chargingSchedulePeriod": ["{...}"], "duration": 0, "evseId": 0, "scheduleStart": "2024-01-15T10:30:00Z" },
  "statusInfo": {}
}
```

### 40. ClearedChargingLimit
**Direction:** CS → CSMS &nbsp;|&nbsp; **Purpose:** Reports that an external charging limit (e.g. from an energy management system) has been cleared.

**Request**
```json
{ "chargingLimitSource": "string", "evseId": 0 }
```
**Response**
```json
{}
```

### 41. NotifyChargingLimit
**Direction:** CS → CSMS &nbsp;|&nbsp; **Purpose:** Reports an externally-imposed charging limit (grid constraint, local generation) currently in effect.

**Request**
```json
{
  "chargingLimit": { "chargingLimitSource": "string", "isGridCritical": true, "isLocalGeneration": true },
  "chargingSchedule": ["{...}"], "evseId": 0
}
```
**Response**
```json
{}
```

### 42. NotifyEVChargingSchedule
**Direction:** CS → CSMS &nbsp;|&nbsp; **Purpose:** Reports the schedule the EV itself proposed (ISO 15118 smart charging), for CSMS visibility/override.

**Request**
```json
{
  "chargingSchedule": { "id": 0, "chargingRateUnit": "W", "chargingSchedulePeriod": ["{...}"] },
  "evseId": 0, "timeBase": "2024-01-15T10:30:00Z", "powerToleranceAcceptance": true, "selectedChargingScheduleId": 0
}
```
**Response**
```json
{ "status": "Accepted", "statusInfo": {}, "customData": {} }
```

### 43. NotifyEVChargingNeeds
**Direction:** CS → CSMS &nbsp;|&nbsp; **Purpose:** Reports the EV's charging needs (energy transfer mode, AC/DC parameters, departure time, V2X parameters) as negotiated over ISO 15118.

**Request**
```json
{
  "chargingNeeds": { "requestedEnergyTransfer": "AC_single_phase", "acChargingParameters": {},
    "dcChargingParameters": {}, "departureTime": "2024-01-15T10:30:00Z", "derChargingParameters": {},
    "evEnergyOffer": {}, "v2xChargingParameters": {} },
  "evseId": 0, "maxScheduleTuples": 0, "timestamp": "2024-01-15T10:30:00Z"
}
```
**Response**
```json
{ "status": "Accepted", "statusInfo": {}, "customData": {} }
```

### 44. PullDynamicScheduleUpdate
**Direction:** CS → CSMS &nbsp;|&nbsp; **Purpose:** Station asks the CSMS for the latest update to a dynamic (externally-managed) charging schedule.

**Request**
```json
{ "chargingProfileId": 0 }
```
**Response**
```json
{ "status": "Accepted", "scheduleUpdate": { "limit": 0, "setpoint": 0 }, "statusInfo": {} }
```

### 45. UpdateDynamicSchedule *(new in 2.1)*
**Direction:** CSMS → CS &nbsp;|&nbsp; **Purpose:** Pushes an incremental limit/setpoint update to an already-installed dynamic charging profile without replacing the whole profile.

**Request**
```json
{ "chargingProfileId": 0, "scheduleUpdate": { "limit": 0, "setpoint": 0 } }
```
**Response**
```json
{ "status": "Accepted", "statusInfo": {}, "customData": {} }
```

### 46. NotifyPriorityCharging
**Direction:** CS → CSMS &nbsp;|&nbsp; **Purpose:** Reports whether priority charging is currently active for a transaction.

**Request**
```json
{ "activated": false, "transactionId": "string" }
```
**Response**
```json
{}
```

### 47. UsePriorityCharging *(new in 2.1)*
**Direction:** CSMS → CS &nbsp;|&nbsp; **Purpose:** Activates/deactivates priority charging for a specific transaction (e.g. a subscriber tier that bypasses load-management throttling).

**Request**
```json
{ "activate": false, "transactionId": "string" }
```
**Response**
```json
{ "status": "Accepted", "statusInfo": {}, "customData": {} }
```

---

## Block L — Firmware (5)

### 48. UpdateFirmware
**Direction:** CSMS → CS &nbsp;|&nbsp; **Purpose:** Instructs the station to download and install firmware from a given location, with retry/scheduling parameters.

**Request**
```json
{
  "firmware": { "location": "string", "retrieveDateTime": "2024-01-15T10:30:00Z", "installDateTime": "2024-01-15T10:30:00Z",
    "signature": "string", "signingCertificate": "string", "customData": {} },
  "requestId": 0, "retries": 0, "retryInterval": 0, "customData": {}
}
```
**Response**
```json
{ "status": "Accepted", "statusInfo": {}, "customData": {} }
```

### 49. FirmwareStatusNotification
**Direction:** CS → CSMS &nbsp;|&nbsp; **Purpose:** Reports firmware install progress (Downloading, Downloaded, Installing, Installed, etc.).

**Request**
```json
{ "status": "Downloaded", "requestId": 0, "statusInfo": {}, "customData": {} }
```
**Response**
```json
{}
```

### 50. PublishFirmware
**Direction:** CSMS → CS &nbsp;|&nbsp; **Purpose:** Directs a station to host/publish a firmware file locally (e.g. so nearby stations on the same LAN can fetch it), with a checksum for verification.

**Request**
```json
{ "checksum": "string", "location": "string", "requestId": 0, "retries": 0, "retryInterval": 0, "customData": {} }
```
**Response**
```json
{ "status": "Accepted", "statusInfo": {}, "customData": {} }
```

### 51. PublishFirmwareStatusNotification
**Direction:** CS → CSMS &nbsp;|&nbsp; **Purpose:** Reports progress of the local firmware-publishing operation, including the resulting download URI(s).

**Request**
```json
{ "status": "Idle", "location": ["string"], "requestId": 0, "statusInfo": {}, "customData": {} }
```
**Response**
```json
{}
```

### 52. UnpublishFirmware
**Direction:** CSMS → CS &nbsp;|&nbsp; **Purpose:** Removes a previously published firmware file from the station.

**Request**
```json
{ "checksum": "string", "customData": {} }
```
**Response**
```json
{ "status": "Unpublished", "customData": {} }
```

---

## Block M — Certificates (8)

### 53. Get15118EVCertificate
**Direction:** CS → CSMS &nbsp;|&nbsp; **Purpose:** Relays an EV's ISO 15118 certificate install/update EXI request to the CSMS (which typically forwards it to a Contract Certificate Pool), supporting 15118-2 and 15118-20.

**Request**
```json
{ "action": "Install", "exiRequest": "string", "iso15118SchemaVersion": "string", "maximumContractCertificateChains": 0, "prioritizedEMAIDs": ["string"], "customData": {} }
```
**Response**
```json
{ "exiResponse": "string", "status": "Accepted", "remainingContracts": 0, "statusInfo": {}, "customData": {} }
```

### 54. GetCertificateStatus
**Direction:** CS → CSMS &nbsp;|&nbsp; **Purpose:** Asks the CSMS for the OCSP revocation status of a single certificate.

**Request**
```json
{
  "ocspRequestData": { "hashAlgorithm": "SHA256", "issuerNameHash": "string", "issuerKeyHash": "string", "serialNumber": "string", "responderURL": "string" },
  "customData": {}
}
```
**Response**
```json
{ "status": "Accepted", "ocspResult": "string", "statusInfo": {}, "customData": {} }
```

### 55. GetCertificateChainStatus *(new in 2.1)*
**Direction:** CS → CSMS &nbsp;|&nbsp; **Purpose:** Like GetCertificateStatus but for an entire certificate chain, via CRL or OCSP sources — reduces round-trips versus checking each certificate individually.

**Request**
```json
{
  "certificateStatusRequests": [
    { "certificateHashData": { "hashAlgorithm": "SHA256", "issuerNameHash": "string", "issuerKeyHash": "string", "serialNumber": "string" },
      "source": "CRL", "urls": ["string"] }
  ],
  "customData": {}
}
```
**Response**
```json
{
  "certificateStatus": [ { "certificateHashData": {}, "nextUpdate": "2024-01-01T00:00:00Z", "source": "CRL", "status": "Good" } ],
  "customData": {}
}
```

### 56. SignCertificate
**Direction:** CS → CSMS &nbsp;|&nbsp; **Purpose:** Station submits a Certificate Signing Request (RFC 2986) for the CSMS to sign (station or V2G certificates).

**Request**
```json
{
  "csr": "string", "certificateType": "ChargingStationCertificate",
  "hashRootCertificate": { "hashAlgorithm": "SHA256", "issuerNameHash": "string", "issuerKeyHash": "string", "serialNumber": "string" },
  "requestId": 0, "customData": {}
}
```
**Response**
```json
{ "status": "Accepted", "statusInfo": {}, "customData": {} }
```

### 57. CertificateSigned
**Direction:** CSMS → CS &nbsp;|&nbsp; **Purpose:** Delivers the signed certificate chain back to the station after a SignCertificate request.

**Request**
```json
{ "certificateChain": "string", "certificateType": "V2GCertificate", "requestId": 0, "customData": {} }
```
**Response**
```json
{ "status": "Accepted", "statusInfo": {}, "customData": {} }
```

### 58. InstallCertificate
**Direction:** CSMS → CS &nbsp;|&nbsp; **Purpose:** Installs a root/intermediate CA certificate on the station.

**Request**
```json
{ "certificate": "string", "certificateType": "V2GRootCertificate", "customData": {} }
```
**Response**
```json
{ "status": "Accepted", "statusInfo": {}, "customData": {} }
```

### 59. DeleteCertificate
**Direction:** CSMS → CS &nbsp;|&nbsp; **Purpose:** Removes a specific installed certificate identified by its hash data.

**Request**
```json
{
  "certificateHashData": { "hashAlgorithm": "SHA256", "issuerNameHash": "string", "issuerKeyHash": "string", "serialNumber": "string" },
  "customData": {}
}
```
**Response**
```json
{ "status": "Accepted", "statusInfo": {}, "customData": {} }
```

### 60. GetInstalledCertificateIds
**Direction:** CSMS → CS &nbsp;|&nbsp; **Purpose:** Lists identifiers of certificates currently installed on the station, optionally filtered by type.

**Request**
```json
{ "certificateType": ["V2GRootCertificate"], "customData": {} }
```
**Response**
```json
{
  "status": "Accepted",
  "certificateHashDataChain": [ { "certificateHashData": {}, "certificateType": "V2GRootCertificate", "childCertificateHashData": [] } ],
  "statusInfo": {}, "customData": {}
}
```

---

## Block N — Diagnostics (16)

### 61. GetLog
**Direction:** CSMS → CS &nbsp;|&nbsp; **Purpose:** Requests the station upload a diagnostics or security log to a remote location.

**Request**
```json
{ "log": { "remoteLocation": "string" }, "logType": "DiagnosticsLog", "requestId": 0, "retries": 0, "retryInterval": 0, "customData": {} }
```
**Response**
```json
{ "status": "Accepted", "filename": "string", "statusInfo": {}, "customData": {} }
```

### 62. LogStatusNotification
**Direction:** CS → CSMS &nbsp;|&nbsp; **Purpose:** Reports progress of a log upload triggered by GetLog.

**Request**
```json
{ "status": "BadMessage", "requestId": 0, "statusInfo": {}, "customData": {} }
```
**Response**
```json
{}
```

### 63. NotifyEvent
**Direction:** CS → CSMS &nbsp;|&nbsp; **Purpose:** Reports monitored/alerting events on device-model variables — the general-purpose event channel underpinning the monitoring system.

**Request**
```json
{
  "eventData": [
    { "eventId": 0, "timestamp": "2024-01-15T10:30:00Z", "trigger": "Alerting", "actualValue": "string",
      "eventNotificationType": "HardWiredNotification", "component": {}, "variable": {}, "cause": 0,
      "cleared": false, "severity": 5, "techCode": "string", "techInfo": "string", "transactionId": "string",
      "variableMonitoringId": 0, "customData": {} }
  ],
  "generatedAt": "2024-01-15T10:30:00Z", "seqNo": 0, "tbc": false, "customData": {}
}
```
**Response**
```json
{}
```

### 64. SetMonitoringBase
**Direction:** CSMS → CS &nbsp;|&nbsp; **Purpose:** Selects which baseline set of monitors (factory default, hard-wired, or all) the station should apply.

**Request**
```json
{ "monitoringBase": "All", "customData": {} }
```
**Response**
```json
{ "status": "Accepted", "statusInfo": {}, "customData": {} }
```

### 65. SetVariableMonitoring
**Direction:** CSMS → CS &nbsp;|&nbsp; **Purpose:** Creates/updates a threshold- or delta-based monitor on a device-model variable.

**Request**
```json
{
  "setMonitoringData": [
    { "value": 0.0, "type": "UpperThreshold", "severity": 0, "component": {}, "variable": {}, "id": 0,
      "periodicEventStream": {}, "transaction": false, "customData": {} }
  ],
  "customData": {}
}
```
**Response**
```json
{
  "setMonitoringResult": [
    { "component": {}, "severity": 0, "status": "Accepted", "type": "UpperThreshold", "variable": {}, "id": 0, "statusInfo": {}, "customData": {} }
  ],
  "customData": {}
}
```

### 66. SetMonitoringLevel
**Direction:** CSMS → CS &nbsp;|&nbsp; **Purpose:** Sets the minimum severity level at which the station will send NotifyEvent messages.

**Request**
```json
{ "severity": 0, "customData": {} }
```
**Response**
```json
{ "status": "Accepted", "statusInfo": {}, "customData": {} }
```

### 67. GetMonitoringReport
**Direction:** CSMS → CS &nbsp;|&nbsp; **Purpose:** Requests the current monitoring configuration (results delivered via NotifyMonitoringReport).

**Request**
```json
{
  "requestId": 0,
  "componentVariable": [ { "component": {}, "variable": {}, "customData": {} } ],
  "monitoringCriteria": ["ThresholdMonitoring"], "customData": {}
}
```
**Response**
```json
{ "status": "Accepted", "statusInfo": {}, "customData": {} }
```

### 68. ClearVariableMonitoring
**Direction:** CSMS → CS &nbsp;|&nbsp; **Purpose:** Removes monitors by ID.

**Request**
```json
{ "id": [0], "customData": {} }
```
**Response**
```json
{ "clearMonitoringResult": [ { "id": 0, "status": "Accepted", "statusInfo": {}, "customData": {} } ], "customData": {} }
```

### 69. NotifyMonitoringReport
**Direction:** CS → CSMS &nbsp;|&nbsp; **Purpose:** Delivers the monitoring configuration requested via GetMonitoringReport.

**Request**
```json
{
  "generatedAt": "2024-01-15T10:30:00Z", "requestId": 0, "seqNo": 0,
  "monitor": [
    { "component": {}, "variable": {},
      "variableMonitoring": [ { "eventNotificationType": "HardWiredNotification", "id": 0, "severity": 5, "transaction": false, "type": "UpperThreshold", "value": 0.0, "customData": {} } ],
      "customData": {} }
  ],
  "tbc": false, "customData": {}
}
```
**Response**
```json
{}
```

### 70. CustomerInformation
**Direction:** CSMS → CS &nbsp;|&nbsp; **Purpose:** Requests retrieval or GDPR-style clearance of stored customer data by identifier, ID token, or certificate.

**Request**
```json
{ "clear": false, "report": false, "requestId": 0, "customerCertificate": {}, "customerIdentifier": "string", "idToken": {}, "customData": {} }
```
**Response**
```json
{ "status": "Accepted", "statusInfo": {}, "customData": {} }
```

### 71. NotifyCustomerInformation
**Direction:** CS → CSMS &nbsp;|&nbsp; **Purpose:** Delivers the customer information requested via CustomerInformation, possibly paginated.

**Request**
```json
{ "data": "string", "generatedAt": "2024-01-15T10:30:00Z", "requestId": 0, "seqNo": 0, "tbc": false, "customData": {} }
```
**Response**
```json
{}
```

### 72. OpenPeriodicEventStream *(new in 2.1)*
**Direction:** CS → CSMS &nbsp;|&nbsp; **Purpose:** Opens a continuous streaming channel for a variable monitor's data — part of the new Periodic Event Stream family enabling near-real-time telemetry.

**Request**
```json
{ "constantStreamData": { "id": 0, "variableMonitoringId": 0, "params": {}, "customData": {} }, "customData": {} }
```
**Response**
```json
{ "status": "Accepted", "statusInfo": {}, "customData": {} }
```

### 73. ClosePeriodicEventStream *(new in 2.1)*
**Direction:** CS → CSMS &nbsp;|&nbsp; **Purpose:** Terminates an active periodic event stream.

**Request**
```json
{ "id": 0, "customData": {} }
```
**Response**
```json
{}
```

### 74. GetPeriodicEventStream *(new in 2.1)*
**Direction:** CSMS → CS &nbsp;|&nbsp; **Purpose:** Lists currently active periodic event streams on the station.

**Request**
```json
{ "customData": {} }
```
**Response**
```json
{ "constantStreamData": [ { "id": 0, "params": {}, "variableMonitoringId": 0, "customData": {} } ], "customData": {} }
```

### 75. AdjustPeriodicEventStream *(new in 2.1)*
**Direction:** CSMS → CS &nbsp;|&nbsp; **Purpose:** Modifies the sampling interval/parameters of an active stream.

**Request**
```json
{ "id": 0, "params": {}, "customData": {} }
```
**Response**
```json
{ "status": "Accepted", "statusInfo": {}, "customData": {} }
```

### 76. NotifyPeriodicEventStream *(new in 2.1, one-way)*
**Direction:** CS → CSMS (no response expected) &nbsp;|&nbsp; **Purpose:** Carries the actual streamed data points (timestamp/value pairs) for an open stream.

**Request**
```json
{ "basetime": "2024-01-15T10:30:00Z", "data": [ { "t": 0.0, "v": "string", "customData": {} } ], "id": 0, "pending": 0, "customData": {} }
```
**Response:** none — this is a one-way/fire-and-forget message.

---

## Block O — Display (4)

### 77. SetDisplayMessage
**Direction:** CSMS → CS &nbsp;|&nbsp; **Purpose:** Pushes a message to be shown on the station's screen (e.g. "Please move your vehicle").

**Request**
```json
{ "message": { "id": 0, "priority": "AlwaysFront", "message": { "format": "ASCII", "content": "string" } }, "customData": {} }
```
**Response**
```json
{ "status": "Accepted", "statusInfo": {}, "customData": {} }
```

### 78. GetDisplayMessages
**Direction:** CSMS → CS &nbsp;|&nbsp; **Purpose:** Retrieves currently configured display messages matching given criteria (results via NotifyDisplayMessages).

**Request**
```json
{ "requestId": 0, "id": [0], "priority": "AlwaysFront", "state": "Active", "customData": {} }
```
**Response**
```json
{ "status": "Accepted", "statusInfo": {}, "customData": {} }
```

### 79. ClearDisplayMessage
**Direction:** CSMS → CS &nbsp;|&nbsp; **Purpose:** Removes a specific display message by ID.

**Request**
```json
{ "id": 0, "customData": {} }
```
**Response**
```json
{ "status": "Accepted", "statusInfo": {}, "customData": {} }
```

### 80. NotifyDisplayMessages
**Direction:** CS → CSMS &nbsp;|&nbsp; **Purpose:** Delivers display message details requested via GetDisplayMessages.

**Request**
```json
{ "requestId": 0, "messageInfo": [ { "id": 0, "message": {}, "priority": "AlwaysFront" } ], "tbc": false, "customData": {} }
```
**Response**
```json
{}
```

---

## Block P — Data Transfer (1)

### 81. DataTransfer
**Direction:** Bidirectional (either party can initiate) &nbsp;|&nbsp; **Purpose:** The vendor-specific escape hatch — exchanges arbitrary payloads (`vendorId`/`messageId`/`data`) for functionality not covered by the standard schema.

**Request**
```json
{ "vendorId": "string", "messageId": "string", "data": {}, "customData": {} }
```
**Response**
```json
{ "status": "Accepted", "data": {}, "statusInfo": {}, "customData": {} }
```
*Status values:* `Accepted` | `Rejected` | `UnknownMessageId` | `UnknownVendorId`

---

## Block Q — Bidirectional / V2X *(new in OCPP 2.1)* (2)

### 82. NotifyAllowedEnergyTransfer
**Direction:** CSMS → CS &nbsp;|&nbsp; **Purpose:** Tells the station which energy transfer modes (AC single/three-phase, DC, V2G, etc.) the CSMS currently permits for a transaction — key to vehicle-to-grid (V2X) support.

**Request**
```json
{ "allowedEnergyTransfer": ["AC_single_phase"], "transactionId": "string", "customData": {} }
```
**Response**
```json
{ "status": "Accepted", "statusInfo": {}, "customData": {} }
```

### 83. AFRRSignal
**Direction:** CSMS → CS &nbsp;|&nbsp; **Purpose:** Delivers an Automatic Frequency Restoration Reserve (aFRR) grid-balancing signal value with an effective timestamp — supports grid-services use cases where charging stations act as a flexible resource.

**Request**
```json
{ "signal": 0, "timestamp": "2024-01-15T10:30:00Z", "customData": {} }
```
**Response**
```json
{ "status": "Accepted", "statusInfo": {}, "customData": {} }
```

---

## Block R — DER Control *(new in OCPP 2.1)* (6)

### 84. GetDERControl
**Direction:** CSMS → CS &nbsp;|&nbsp; **Purpose:** Requests current Distributed Energy Resource (DER) control settings (results via ReportDERControl) — DER control governs grid-support functions like volt-var/frequency-watt curves for inverter-based charging equipment.

**Request**
```json
{ "requestId": 0, "controlId": "string", "controlType": "EnterService", "isDefault": false, "customData": {} }
```
**Response**
```json
{ "status": "Accepted", "statusInfo": {}, "customData": {} }
```

### 85. SetDERControl
**Direction:** CSMS → CS &nbsp;|&nbsp; **Purpose:** Configures a specific DER control (curve, enter-service, fixed power factor, fixed var, frequency-droop, gradient, discharge limit, etc.).

**Request**
```json
{
  "controlId": "string", "controlType": "EnterService", "isDefault": false,
  "curve": {}, "enterService": {}, "fixedPFAbsorb": {}, "fixedPFInject": {}, "fixedVar": {},
  "freqDroop": {}, "gradient": {}, "limitMaxDischarge": {}, "customData": {}
}
```
**Response**
```json
{ "status": "Accepted", "statusInfo": {}, "supersededIds": ["string"], "customData": {} }
```

### 86. ClearDERControl
**Direction:** CSMS → CS &nbsp;|&nbsp; **Purpose:** Removes active or default DER control settings.

**Request**
```json
{ "isDefault": false, "controlId": "string", "controlType": "EnterService", "customData": {} }
```
**Response**
```json
{ "status": "Accepted", "statusInfo": {}, "customData": {} }
```

### 87. ReportDERControl
**Direction:** CS → CSMS &nbsp;|&nbsp; **Purpose:** Reports the station's current DER control configuration in response to GetDERControl.

**Request**
```json
{
  "requestId": 0, "curve": [{}], "enterService": [{}], "fixedPFAbsorb": [{}], "fixedPFInject": [{}],
  "fixedVar": [{}], "freqDroop": [{}], "gradient": [{}], "limitMaxDischarge": [{}], "tbc": false, "customData": {}
}
```
**Response**
```json
{}
```

### 88. NotifyDERAlarm
**Direction:** CS → CSMS &nbsp;|&nbsp; **Purpose:** Reports the start/end of a grid-disturbance alarm (e.g. current imbalance, over/under-voltage) detected by DER control logic.

**Request**
```json
{ "controlType": "EnterService", "timestamp": "2024-01-15T10:30:00Z", "alarmEnded": false, "extraInfo": "string", "gridEventFault": "CurrentImbalance", "customData": {} }
```
**Response**
```json
{}
```

### 89. NotifyDERStartStop
**Direction:** CS → CSMS &nbsp;|&nbsp; **Purpose:** Notifies that a DER control has started or stopped, with timing and any superseded control IDs.

**Request**
```json
{ "controlId": "string", "started": false, "timestamp": "2024-01-15T10:30:00Z", "supersededIds": ["string"], "customData": {} }
```
**Response**
```json
{}
```

---

## Block S — Battery Swap *(new in OCPP 2.1)* (2)

### 90. BatterySwap
**Direction:** CS → CSMS &nbsp;|&nbsp; **Purpose:** Reports battery insertion/removal at a swap station, including per-battery serial number, State of Charge (SoC), and State of Health (SoH) — supports battery-swap charging networks (common for two/three-wheelers).

**Request**
```json
{
  "batteryData": [
    { "evseId": 0, "serialNumber": "string", "soC": 0.0, "soH": 0.0, "productionDate": "2024-01-01T00:00:00Z", "vendorInfo": "string", "customData": {} }
  ],
  "eventType": "BatteryIn",
  "idToken": { "idToken": "string", "type": "string" },
  "requestId": 0, "customData": {}
}
```
**Response**
```json
{}
```

### 91. RequestBatterySwap
**Direction:** CSMS → CS &nbsp;|&nbsp; **Purpose:** Instructs the station to initiate a battery swap operation for a given user/ID token.

**Request**
```json
{ "idToken": { "idToken": "string", "type": "string" }, "requestId": 0, "customData": {} }
```
**Response**
```json
{ "status": "Accepted", "statusInfo": {}, "customData": {} }
```

---

## Notes on using this reference

- Every request/response pair above is the *shape* of the payload only — required vs. optional fields, enums, and length limits are defined precisely in the OCA's official JSON Schema files (`.json`) shipped with the spec; use those for actual validation/codegen, not this document.
- `customData` is a free-form vendor-extension object present on nearly every message/sub-object; it's safe to omit if unused.
- Messages with an empty `{}` response are acknowledgements only — no status field is returned, so success is implied by the mere fact of a response arriving.
- Block S (Battery Swap) is especially relevant for two/three-wheeler and swap-network operators; Block Q/R (V2X, DER Control) matter if any pilot involves bidirectional charging or grid-services participation; Block I (Tariff & Cost) is the block to look at for in-station pricing/payment display without a separate billing backend.
