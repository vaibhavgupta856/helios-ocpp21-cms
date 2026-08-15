import fs from 'fs';
import path from 'path';
import { CERT_DIR } from './tls.js';

const FILE = () => path.join(CERT_DIR, 'security.json');

export const HTTP_PORT = Number(process.env.PORT) || 9090;
export const WSS_PORT = Number(process.env.CMS_WSS_PORT) || 9443;

export function isCloudHost() {
  return !!(process.env.RENDER || process.env.CMS_PUBLIC_HOST);
}

/**
 * Render (and similar hosts) terminate TLS at the edge and forward HTTP to PORT.
 * OCPP "require WSS" / Profile 1 must treat those upgrades as secure.
 * Set CMS_TLS_TERMINATED=0 to force lab behaviour if RENDER is somehow set locally.
 */
export function tlsTerminated() {
  const v = String(process.env.CMS_TLS_TERMINATED || '').toLowerCase();
  if (v === '0' || v === 'false' || v === 'no') return false;
  if (v === '1' || v === 'true' || v === 'yes') return true;
  return !!process.env.RENDER;
}

export function publicHost() {
  const raw =
    process.env.CMS_PUBLIC_HOST ||
    process.env.RENDER_EXTERNAL_HOSTNAME ||
    '127.0.0.1';
  return String(raw)
    .trim()
    .replace(/^wss?:\/\//i, '')
    .replace(/^https?:\/\//i, '')
    .replace(/\/.*$/, '')
    .replace(/:\d+$/, (port) => (port === ':443' || port === ':80' ? '' : port)) || '127.0.0.1';
}

/** Lab TLS listener on 9443 — skip on Render (edge TLS already on PORT). */
export function enableLabHttps() {
  if (process.env.CMS_ENABLE_LAB_TLS === '1') return true;
  if (process.env.CMS_ENABLE_LAB_TLS === '0') return false;
  return !process.env.RENDER;
}

export function connectionUrls() {
  const host = publicHost();
  const local = host === '127.0.0.1' || host === 'localhost';
  const wsBase = process.env.CMS_PUBLIC_WS || (local ? `ws://${host}:${HTTP_PORT}/ocpp/2.1` : `wss://${host}/ocpp/2.1`);
  const wssBase =
    process.env.CMS_PUBLIC_WSS ||
    (local ? `wss://${host}:${WSS_PORT}/ocpp/2.1` : `wss://${host}/ocpp/2.1`);
  return {
    wsBase,
    wssBase,
    ws: `${wsBase}/{stationId}`,
    wss: `${wssBase}/{stationId}`,
  };
}

export function publicSecurity() {
  const s = loadSecurity();
  const urls = connectionUrls();
  const host = publicHost();
  return {
    profile: s.profile,
    profileName: s.profile === 2 ? 'mTLS' : s.profile === 1 ? 'WSS+Basic' : 'WSS/lab',
    basicUser: s.basicUser,
    basicConfigured: !!(s.basicUser && s.basicPass),
    requireWss: s.requireWss,
    wsPort: HTTP_PORT,
    wssPort: WSS_PORT,
    host,
    cloud: isCloudHost() || !!process.env.RENDER,
    tlsTerminated: tlsTerminated(),
    subprotocol: 'ocpp2.1',
    wsBase: urls.wsBase,
    wssBase: urls.wssBase,
    ws: urls.ws,
    wss: urls.wss,
  };
}

function fromEnv() {
  const profile = Number(process.env.CMS_SECURITY_PROFILE);
  return {
    profile: [0, 1, 2].includes(profile) ? profile : 0,
    basicUser: process.env.CMS_BASIC_USER || '',
    basicPass: process.env.CMS_BASIC_PASS || '',
    requireWss: process.env.CMS_REQUIRE_WSS === '1',
  };
}

let cached = null;

export function loadSecurity() {
  if (cached) return cached;
  const env = fromEnv();
  try {
    const file = JSON.parse(fs.readFileSync(FILE(), 'utf8'));
    cached = {
      profile: [0, 1, 2].includes(Number(file.profile)) ? Number(file.profile) : env.profile,
      basicUser: file.basicUser != null ? String(file.basicUser) : env.basicUser,
      basicPass: file.basicPass != null ? String(file.basicPass) : env.basicPass,
      requireWss: !!(file.requireWss ?? env.requireWss),
    };
  } catch {
    cached = env;
  }
  return cached;
}

export function saveSecurity(patch = {}) {
  const cur = loadSecurity();
  const next = {
    profile: patch.profile != null ? Number(patch.profile) : cur.profile,
    basicUser: patch.basicUser != null ? String(patch.basicUser) : cur.basicUser,
    basicPass: patch.basicPass != null ? String(patch.basicPass) : cur.basicPass,
    requireWss: patch.requireWss != null ? !!patch.requireWss : cur.requireWss,
  };
  if (![0, 1, 2].includes(next.profile)) next.profile = 0;
  fs.mkdirSync(CERT_DIR, { recursive: true });
  fs.writeFileSync(FILE(), JSON.stringify(next, null, 2));
  cached = next;
  return publicSecurity();
}

export function stationUrls(stationId) {
  const id = encodeURIComponent(stationId || '{stationId}');
  const urls = connectionUrls();
  return {
    wsUrl: urls.ws.replace('{stationId}', id),
    wssUrl: urls.wss.replace('{stationId}', id),
  };
}
