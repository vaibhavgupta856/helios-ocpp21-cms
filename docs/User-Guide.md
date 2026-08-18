# Helios — operator guide

Helios is the **OCPP 2.1 CSMS** (central system). Charge points such as **Voltforge** connect *out* to it. Helios is not a charger and not OCA-certified.

**Local UI:** http://localhost:5174  
**Live:** https://helios-ocpp21-cms.onrender.com  

Idle Render instances can take about a minute on first load. The in-app **Tutorial** starts on every open; **Skip** lasts until the next reload.

---

## This is not Voltforge

| Helios | Voltforge |
|--------|-----------|
| CSMS / operator console | Charge point lab (3D EVSE) |
| Receives BootNotification | Opens the WebSocket |
| Live: `helios-ocpp21-cms.onrender.com` | Live: `voltforge-ocpp-lab.onrender.com` |
| Health `"role":"csms"` | Health `"role":"charge-point-lab"` |

Do not paste a charger URL into Helios. You enroll an ID here; the charge point dials Helios.

---

## Screen map

| Area | What it is for |
|------|----------------|
| **Header** | Helios brand, station/CP counts, online pill, **OCPP 2.1**, Tutorial, Theme, **Act as** |
| **Sidebar — Operate** | Dashboard, Digital twin, Ask Helios, Stations, Sessions, RFID, Tariffs |
| **Sidebar — Plan** | Demand, Site planner, Smart charging |
| **Sidebar — Setup** | Security, Roles |
| **Off-menu** | Firmware, diagnostics, display, DER, catalog, Live Trace (tour opens these) |
| **Footer** | Helios CSMS · Voltforge is the separate EVSE lab |

On a phone, use the hamburger for the sidebar. Header pills wrap.

---

## Charge point WebSocket (OCPP 2.1)

The **Charge point WebSocket** card is on **Stations**, **Dashboard**, and **Security**. Copy the **WSS base** (no station ID).

| Where | WSS base | Full station URL |
|-------|----------|------------------|
| Local lab | `wss://127.0.0.1:9443/ocpp/2.1` | `…/ocpp/2.1/VF-CP-21` |
| Hosted | `wss://helios-ocpp21-cms.onrender.com/ocpp/2.1` | `…/ocpp/2.1/VF-CP-21` |

**Subprotocol:** `ocpp2.1` (required).

Local also has a plain WS base `ws://127.0.0.1:9090/ocpp/2.1` (lab only). Hosted uses public HTTPS — no port 9443.

---

## Pair Voltforge

1. **Stations** → pick tenant and hub → **Charge point ID** (example `VF-CP-21`) → **Add charge point**.
2. Copy **WSS base** from the WebSocket card.
3. In Voltforge Commission: same ID, paste that **base**, Connect EVSE.
   - Local: Trust lab TLS **on**.
   - Hosted: Trust lab TLS **off**.
4. Station goes **online**. **Live Trace** shows BootNotification.

**Simulate charge point** plants a virtual CP *inside Helios* (no Voltforge, no WebSocket). Use it for UI demos, not for real OCPP.

---

## Dashboard

Live KPIs: tenants, hubs, charge points, online count, sessions, connectors, tokens.

- **Advisor** reads the live network and proposes cards.
- Reset, firmware, and stop-session are **not** sent until someone with **Approve** clicks Approve.
- **Open stations** jumps to enrollment.

---

## Digital twin

Map of hubs and charge points (India lab fleet by default).

| Pin / legend | Meaning |
|--------------|---------|
| Blue | Available |
| Green | Charging |
| Red | Offline / fault |
| Small grey dot | Station with no charge point |

**Alarms** under the map: count, filters (All / Fault / Offline / Charging), click a row to select the pin. Detail card shows the selected CP.

---

## Ask Helios

Operator copilot with the live CMS snapshot.

- **Live ops without an API key:** what is online, WSS commissioning, KPIs, keep vs remove, Agent create-jobs (tenant / station / CP).
- **Needs a language model:** write/draft, jokes, general “what is…”, anything the snapshot cannot answer. Helios will say **add an API key** instead of guessing.
- Add a key on Ask → **API key**, or set `CMS_LLM_API_KEY`. **Ollama (local)** works with no cloud key.
- Live OCPP (Reset, firmware, stop) still needs **Approve**.

---

## Stations

- Org tree: tenant → station (hub) → charge point.
- Enroll IDs, move a CP between hubs, copy WSS URLs.
- **Remote operations** (Reset, ChangeAvailability, Unlock, TriggerMessage) go to the selected online CP. Prefer Approve on the Dashboard when testing the queue.

---

## Sessions

OCPP 2.1 **TransactionEvent** (Started / Updated / Ended) — not 1.6 Start/StopTransaction.

Stop a live session only after **Approve** (or a direct RequestStop if your role allows calls).

---

## RFID & tokens

Register idTokens Helios will accept on Authorize. Demo tags used with Voltforge include `RFID-MASSIVE-01`, `CARD-7F2A91`.

Auth on the charge point can be Local, CMS only, or Local or CMS — that setting lives on Voltforge.

---

## Tariffs

Create tariffs and set defaults. Helios can send `SetDefaultTariff` / cost updates when a CP is online.

---

## Plan pages

| Page | Use |
|------|-----|
| **Demand** | Load / utilization view |
| **Site planner** | Next-site candidates (lab recommendations) |
| **Smart charging** | Stored profiles and composite schedule |

---

## Security

Profiles 0–2, Require WSS, Basic Auth, lab PEM download.

| Profile | Local | Hosted Render |
|---------|--------|----------------|
| 0 | ws:9090 and wss:9443 | `wss://YOUR-HOST/ocpp/2.1` (edge TLS) |
| 1 | WSS + HTTP Basic | Same if Basic is set |
| 2 | mTLS on lab 9443 | Not available |

Trust the lab CA on a real CP. Voltforge can skip verification only for localhost.

---

## Roles

Lab IAM: identities (super admin, operator, member), permission matrix, tenant/station scope.

**Act as** in the header switches whose permissions you use. It is not a real login. The matrix is the catalog; it does not change until you edit a user.

---

## Themes

Header **Theme**: Helios (light), Dark, Midnight, Forest, Sand, Violet. Saved as `helios-cms-theme`. The Tutorial **Theme** step cycles all of them, then restores yours.

---

## Quick fixes

| Problem | Try |
|---------|-----|
| Charge point stays offline | Same ID on both sides; WSS **base** without the ID; `ocpp2.1`; hosted = no Trust lab TLS |
| Authorize Invalid | Register the RFID here, or set Voltforge Auth to Local / Local or CMS |
| Ask Helios asks for a key | That question needs the model — add **API key** or use Ollama |
| Old UI after deploy | Ctrl+Shift+R |
| Render sleep | Wait ~1 minute, reload |
