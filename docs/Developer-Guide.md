# Helios — developer guide

Helios is the OCPP 2.1 **CSMS**. Folder on disk: `massive-ocpp21-cms`. GitHub: `vaibhavgupta856/helios-ocpp21-cms`. Product name is **Helios**; do not confuse with Voltforge (`evse-ocpp16-console`).

---

## Run locally

```powershell
npm run install:all
npm run dev
```

| Process | Port |
|---------|------|
| Vite operator UI | **5174** (proxies `/api`, `/ocpp`, `/socket.io` → 9090) |
| CSMS HTTP + plain WS | **9090** |
| Lab HTTPS / WSS | **9443** (self-signed; off on Render) |

```powershell
npm run build
$env:NODE_ENV='production'; npm start
```

serves `client/dist` from 9090; lab WSS still on 9443 unless `CMS_ENABLE_LAB_TLS=0`.

Health: `GET /api/health` → `{ ok, role: "csms", product: "Helios", service: "helios-ocpp21-cms", protocol: "OCPP 2.1", wssBase, commit }`.

---

## Architecture

```
Operator browser (React)
        │  REST /api  +  Socket.IO  cms:stations | cms:store | cms:messages
        ▼
Express + Registry + IAM
        │
        └── WebSocket upgrade  /ocpp/2.1/{stationId}   subprotocol ocpp2.1
                    ▲
                    │  outbound from the charge point
              Voltforge Node (or any OCPP 2.1 CP)
```

The browser never opens OCPP. Only the Node process accepts the station socket.

Hosted (Render): one public HTTPS port. Edge TLS terminates; Node listens on `PORT`. Those upgrades are treated as WSS (`RENDER` / `CMS_TLS_TERMINATED=1`). Lab 9443 is off.

---

## Env

| Variable | Meaning |
|----------|---------|
| `PORT` | HTTP listen (Render-assigned; local default 9090) |
| `CMS_WSS_PORT` | Lab TLS port (default 9443) |
| `CMS_ENABLE_LAB_TLS` | `0` on Render; `1` to force 9443 |
| `CMS_PUBLIC_HOST` | Hostname for copyable URLs (else `RENDER_EXTERNAL_HOSTNAME` or `127.0.0.1`) |
| `CMS_PUBLIC_WSS` / `CMS_PUBLIC_WS` | Full base overrides |
| `CMS_SECURITY_PROFILE` | `0` or `1` hosted; `2` local-only |
| `CMS_BASIC_USER` / `CMS_BASIC_PASS` | Profile 1 |
| `CMS_REQUIRE_WSS` | `1` rejects plaintext on :9090 |
| `CMS_LLM_API_KEY` | Ask Helios (also OpenAI / Groq / Anthropic / OpenRouter env names) |
| `CMS_LLM_BASE_URL` / `CMS_LLM_MODEL` | Compatible API |

---

## REST (selection)

| Method | Path |
|--------|------|
| GET | `/api/health` |
| GET/PUT | `/api/security` |
| GET | `/api/security/certs/{ca.pem,server.pem,client.pem,client-key.pem}` |
| GET | `/api/stations` `/api/org` `/api/me` |
| POST | `/api/stations/enroll` `{ stationId, tenantId, siteId }` |
| POST | `/api/stations/:id/call` `{ action, payload }` |
| GET | `/api/messages` `/api/transactions` `/api/tokens` `/api/tariffs` |
| POST | `/api/simulate-station` |
| GET/POST | `/api/assistant` `/api/chats` |
| GET/POST | `/api/actions` + approve / reject |
| GET | `/api/insights` `/api/catalog` |

IAM: `attachUser` + `requirePerm`. Header **Act as** sends the lab user id.

---

## Socket.IO

| Event | Payload |
|-------|---------|
| `cms:stations` | charge point list |
| `cms:store` | tokens, tariffs, transactions, … |
| `cms:messages` | recent OCPP frames |
| `cms:security` | public WSS bases + profile |

---

## Key files

| Path | Role |
|------|------|
| `server/index.js` | HTTP, WSS upgrade, static UI |
| `server/security.js` | Profiles, public `wssBase` |
| `server/product.js` | Helios identity |
| `server/registry.js` | Stations, simulate, traces |
| `server/ocpp/` | Protocol + Station |
| `server/ai/` | Ask Helios, advisor, Approve |
| `server/iam.js` | Roles |
| `client/src/pages/` | Operator screens |
| `client/src/components/WssPairingCard.jsx` | Copyable WSS card |
| `client/src/tutorial.js` | Product tour |

---

## Tests / pairing

Voltforge `CMS_WSS_BASE=wss://<helios-host>/ocpp/2.1`. Enroll the same Charge Point ID. Expect BootNotification on `/api/messages`.

---

## Deploy

See [DEPLOY.md](./DEPLOY.md). Blueprint: `render.yaml`. Live health must show `"role":"csms"`.
