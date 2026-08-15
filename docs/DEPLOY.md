# Deploy Helios CSMS

This service is the **OCPP 2.1 CSMS**. Do not deploy it as if it were Voltforge (the charge point lab).

## Render (one web service)

`render.yaml`:

- Build: `npm run install:all && npm run build`
- Start: `npm start` (`NODE_ENV=production`)
- Health: `GET /api/health` — expect `"role":"csms"`
- Single public port: operator UI **and** charge-point WSS share the same HTTPS URL

After deploy:

| Use | URL |
|-----|-----|
| Operator UI | `https://<service>.onrender.com` |
| Health | `https://<service>.onrender.com/api/health` |
| Charge point WSS base | `wss://<service>.onrender.com/ocpp/2.1` |
| Example station | `wss://<service>.onrender.com/ocpp/2.1/VF-CP-21` |

Lab listener **9443 is off** on Render (`RENDER` env). Profile 2 mTLS stays a local-only feature. Use **Profile 0** (TLS only) or **Profile 1** (TLS + Basic) when hosted. Public certificates come from Render — do not install the lab CA.

Pairing with Voltforge:

1. Enroll the Charge Point ID on Helios **Stations**.
2. Copy the WSS **base** `wss://<service>.onrender.com/ocpp/2.1` (no ID).
3. On Voltforge set `CMS_WSS_BASE` to that base (or paste it in Commission).
4. Connect EVSE in Voltforge; BootNotification appears on Helios Trace.

`CMS_REQUIRE_WSS=1` is safe on Render: upgrades arrive on HTTP `PORT` after edge TLS and are accepted (`RENDER` implies `CMS_TLS_TERMINATED`).

Optional env:

| Variable | Meaning |
|----------|---------|
| `CMS_PUBLIC_HOST` | Custom domain (no scheme) |
| `CMS_PUBLIC_WSS` | Full WSS base override (`wss://host/ocpp/2.1`) |
| `CMS_PUBLIC_WS` | Full WS base override (unused on Render) |
| `CMS_TLS_TERMINATED=1` | Treat HTTP `PORT` upgrades as WSS (set automatically via `RENDER`) |
| `CMS_BASIC_USER` / `CMS_BASIC_PASS` | Profile 1 |
| `CMS_REQUIRE_WSS=1` | Reject plaintext OCPP (local :9090 only; hosted still accepts edge TLS) |
| `CMS_SECURITY_PROFILE` | `0` (default) or `1` on Render; `2` is local-only |
| `CMS_LLM_API_KEY` | Ask Helios LLM |

Free instances sleep; first hit can take about a minute.

## Local production-style

```bash
npm run install:all
npm run build
$env:NODE_ENV='production'
npm start
```

UI + API on **9090**, lab WSS still on **9443** unless `CMS_ENABLE_LAB_TLS=0`.
