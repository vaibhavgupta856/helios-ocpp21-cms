# Helios CSMS — OCPP 2.1

This repository is a **Charging Station Management System (CSMS / central system)**.

| This app | Not this app |
|----------|----------------|
| Helios **CSMS** | **Voltforge** charge point lab (separate repo) |
| Receives OCPP from stations | Pretends to be an EVSE |
| Operator UI + `/ocpp/2.1/{id}` | Connects *out* to this CSMS |

**Protocol: OCPP 2.1 only** (`ocpp2.1` subprotocol). Lab CSMS, not OCA-certified.

---

## Documentation

| Guide | Audience |
|--------|----------|
| [docs/User-Guide.md](docs/User-Guide.md) | Operators — every page, WSS pairing, Ask Helios, twin, roles |
| [docs/Developer-Guide.md](docs/Developer-Guide.md) | Local run, architecture, REST, env |
| [docs/DEPLOY.md](docs/DEPLOY.md) | Render, env vars, hosted WSS |
| [docs/OCPP-2.1-CSMS.md](docs/OCPP-2.1-CSMS.md) | What Helios sends and accepts on the wire |
| [docs/OCPP-2.1-Messages-Reference.md](docs/OCPP-2.1-Messages-Reference.md) | All 91 OCPP 2.1 messages (blocks A–S), payload shapes |

---

## Local run

```bash
cd massive-ocpp21-cms
npm run install:all
npm run dev
```

| Surface | URL |
|---------|-----|
| Operator UI | http://localhost:5174 |
| CSMS HTTP / plain WS | http://localhost:9090 |
| CSMS HTTPS / WSS (lab cert) | https://localhost:9443 |
| Health | http://localhost:9090/api/health |

Health JSON includes `"role":"csms"` so you never confuse it with Voltforge (`voltforge-ocpp-lab`).

---

## Connect a charge point (Voltforge)

Charge points connect **outbound**. Do not paste a charger URL into the CSMS.

1. **Stations** → enroll Charge Point ID (example `VF-CP-21`). Must match the ID on the CP.
2. Copy **Voltforge WSS base** from Stations (no ID).
   - Local: `wss://127.0.0.1:9443/ocpp/2.1`
   - Hosted: `wss://YOUR-HOST/ocpp/2.1` (port 443, same host as the operator UI — no 9443)
3. In Voltforge: OCPP 2.1, that base, Connect EVSE.
   - Local: Trust lab TLS on (self-signed).
   - Hosted Render: leave Trust lab TLS **off** (public certificates).
4. **Live Trace** / station detail should show BootNotification.

---

## Security profiles

| Profile | Local | Hosted (Render) |
|---------|--------|------------------|
| 0 | `ws://9090` and `wss://9443` | `wss://YOUR-HOST/ocpp/2.1` (edge TLS) |
| 1 | WSS + HTTP Basic | Same, if Basic is configured |
| 2 | mTLS on lab 9443 | Not available through Render TLS |

`CMS_REQUIRE_WSS=1` rejects plaintext upgrades on local :9090. On Render, TLS is terminated at the proxy and the Node process listens on HTTP `PORT` — those upgrades are still treated as WSS (`RENDER` or `CMS_TLS_TERMINATED=1`).

---

## Deploy

See [docs/DEPLOY.md](docs/DEPLOY.md). Blueprint: `render.yaml`.

Required for public URLs: Render sets `RENDER_EXTERNAL_HOSTNAME`. Override with `CMS_PUBLIC_HOST` if you use a custom domain.

Pair with a hosted Voltforge by setting Voltforge `CMS_WSS_BASE=wss://YOUR-HELIOS-HOST/ocpp/2.1`.

---

## Operator pages

Dashboard, Digital twin, Ask Helios, Stations, Sessions, RFID, Tariffs, Demand, Site planner, Smart charging, Security, Roles. Extra (off sidebar): firmware, diagnostics, display, DER, catalog, OCPP trace.

Live OCPP (Reset, firmware, stop session) needs **Approve**.

**Simulate charge point** is a virtual station *inside this CSMS* (no Voltforge, no WebSocket).
