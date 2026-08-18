# OCPP 2.1 on Helios

Helios implements enough **OCPP 2.1 JSON** for a lab CSMS. It is not an OCA-certified stack.

- Transport: WebSocket, subprotocol **`ocpp2.1`**
- Charge point is the **client**; Helios is the **server**
- Path: `/ocpp/2.1/{stationId}`
- Frames: CALL `2`, CALLRESULT `3`, CALLERROR `4`, CALLRESULTERROR `5`, SEND `6`
- One outstanding CALL per direction

---

## Typical inbound (charge point → Helios)

| When | Action |
|------|--------|
| Socket open | **BootNotification** |
| After boot | **StatusNotification**, **Heartbeat** |
| RFID / start | **Authorize**, **TransactionEvent** `Started` |
| Charging | **TransactionEvent** `Updated` (meter samples) |
| Stop | **TransactionEvent** `Ended` |

---

## Typical outbound (Helios → charge point)

RequestStart / RequestStop, Reset, ChangeAvailability, UnlockConnector, TriggerMessage, SetChargingProfile, SetDefaultTariff, firmware / log / certificate calls (subset).

Remote start/stop from the UI or **Approve** queue.

---

## Mapping from 1.6 habits

| OCPP 1.6 | Helios (2.1) |
|----------|----------------|
| StartTransaction / StopTransaction / MeterValues | TransactionEvent Started / Ended / Updated |
| `connectorId` | `evse.id` + `connectorId` |
| `idTag` | `idToken` |
| RemoteStartTransaction | RequestStartTransaction |

1.6 action names return **NotImplemented**.

---

## Hosted vs lab TLS

| | Local | Render |
|--|--------|--------|
| URL | `wss://127.0.0.1:9443/ocpp/2.1/{id}` | `wss://<host>/ocpp/2.1/{id}` |
| Cert | Lab self-signed (Trust lab TLS on Voltforge) | Public (verify normally) |
| Profile 2 | mTLS on 9443 | Not available |

---

## Spec

Field-level schemas: Open Charge Alliance **OCPP 2.1**. This file only describes Helios behaviour.
