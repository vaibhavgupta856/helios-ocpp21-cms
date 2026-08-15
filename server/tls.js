/**
 * Lab TLS material for OCPP 2.1 WSS (Security Profiles 0–2).
 * Uses CMS_TLS_CERT / CMS_TLS_KEY when provided; otherwise a local CA + server + client cert.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { X509Certificate } from 'node:crypto';
import forge from 'node-forge';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const CERT_DIR = path.join(__dirname, '..', 'certs');

const NAMES = {
  ca: 'ca.pem',
  caKey: 'ca-key.pem',
  server: 'server.pem',
  serverKey: 'server-key.pem',
  client: 'client.pem',
  clientKey: 'client-key.pem',
};

function p(name) {
  return path.join(CERT_DIR, NAMES[name]);
}

function subject(cn) {
  return [
    { name: 'commonName', value: cn },
    { name: 'organizationName', value: 'Helios' },
    { name: 'countryName', value: 'IN' },
  ];
}

function makeKeys() {
  return forge.pki.rsa.generateKeyPair(2048);
}

function makeCert({ keys, issuerKeys, issuerCert, cn, isCa = false, client = false, altNames = [] }) {
  const cert = forge.pki.createCertificate();
  cert.publicKey = keys.publicKey;
  cert.serialNumber = `${Date.now().toString(16)}${Math.floor(Math.random() * 1e8).toString(16)}`;
  cert.validity.notBefore = new Date(Date.now() - 60_000);
  cert.validity.notAfter = new Date();
  cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + 5);
  cert.setSubject(subject(cn));
  cert.setIssuer(issuerCert ? issuerCert.subject.attributes : subject(cn));
  const extensions = [];
  if (isCa) {
    extensions.push({ name: 'basicConstraints', cA: true, critical: true });
    extensions.push({ name: 'keyUsage', keyCertSign: true, cRLSign: true, critical: true });
  } else {
    extensions.push({ name: 'basicConstraints', cA: false });
    extensions.push({
      name: 'keyUsage',
      digitalSignature: true,
      keyEncipherment: true,
      critical: true,
    });
    extensions.push({
      name: 'extKeyUsage',
      serverAuth: !client,
      clientAuth: client,
    });
    if (!client && altNames.length) {
      extensions.push({ name: 'subjectAltName', altNames });
    }
  }
  cert.setExtensions(extensions);
  cert.sign(issuerKeys.privateKey, forge.md.sha256.create());
  return cert;
}

function generateLabBundle() {
  const caKeys = makeKeys();
  const caCert = makeCert({
    keys: caKeys,
    issuerKeys: caKeys,
    cn: 'Helios Lab CA',
    isCa: true,
  });
  const serverKeys = makeKeys();
  const serverCert = makeCert({
    keys: serverKeys,
    issuerKeys: caKeys,
    issuerCert: caCert,
    cn: 'localhost',
    altNames: [
      { type: 2, value: 'localhost' },
      { type: 7, ip: '127.0.0.1' },
      { type: 7, ip: '::1' },
    ],
  });
  const clientKeys = makeKeys();
  const clientCert = makeCert({
    keys: clientKeys,
    issuerKeys: caKeys,
    issuerCert: caCert,
    cn: 'Massive-CP-Lab',
    client: true,
  });
  return {
    caPem: forge.pki.certificateToPem(caCert),
    caKeyPem: forge.pki.privateKeyToPem(caKeys.privateKey),
    serverPem: forge.pki.certificateToPem(serverCert),
    serverKeyPem: forge.pki.privateKeyToPem(serverKeys.privateKey),
    clientPem: forge.pki.certificateToPem(clientCert),
    clientKeyPem: forge.pki.privateKeyToPem(clientKeys.privateKey),
  };
}

function readIf(file) {
  try {
    return fs.readFileSync(file, 'utf8');
  } catch {
    return null;
  }
}

export function ensureLabCerts() {
  fs.mkdirSync(CERT_DIR, { recursive: true });
  const envCert = process.env.CMS_TLS_CERT;
  const envKey = process.env.CMS_TLS_KEY;
  if (envCert && envKey && fs.existsSync(envCert) && fs.existsSync(envKey)) {
    return {
      source: 'env',
      caPem: readIf(p('ca')),
      serverPem: fs.readFileSync(envCert, 'utf8'),
      serverKeyPem: fs.readFileSync(envKey, 'utf8'),
      clientPem: readIf(p('client')),
      clientKeyPem: readIf(p('clientKey')),
    };
  }

  if (!fs.existsSync(p('ca')) || !fs.existsSync(p('server')) || !fs.existsSync(p('serverKey'))) {
    const bundle = generateLabBundle();
    fs.writeFileSync(p('ca'), bundle.caPem);
    fs.writeFileSync(p('caKey'), bundle.caKeyPem);
    fs.writeFileSync(p('server'), bundle.serverPem);
    fs.writeFileSync(p('serverKey'), bundle.serverKeyPem);
    fs.writeFileSync(p('client'), bundle.clientPem);
    fs.writeFileSync(p('clientKey'), bundle.clientKeyPem);
    return { source: 'generated', ...bundle };
  }

  return {
    source: 'lab',
    caPem: fs.readFileSync(p('ca'), 'utf8'),
    caKeyPem: readIf(p('caKey')),
    serverPem: fs.readFileSync(p('server'), 'utf8'),
    serverKeyPem: fs.readFileSync(p('serverKey'), 'utf8'),
    clientPem: readIf(p('client')),
    clientKeyPem: readIf(p('clientKey')),
  };
}

export function httpsOptions(certs, { requestClientCert } = {}) {
  return {
    key: certs.serverKeyPem,
    cert: certs.serverPem,
    ca: certs.caPem || undefined,
    requestCert: !!requestClientCert,
    rejectUnauthorized: false,
  };
}

export function extraTrustPems() {
  const dir = path.join(CERT_DIR, 'trust');
  try {
    return fs
      .readdirSync(dir)
      .filter((f) => f.endsWith('.pem'))
      .map((f) => fs.readFileSync(path.join(dir, f), 'utf8'));
  } catch {
    return [];
  }
}

export function peerCertificateInfo(tlsSocket) {
  try {
    const peerInfo = tlsSocket?.getPeerCertificate?.(true);
    if (!peerInfo?.raw) return null;
    const peer = new X509Certificate(peerInfo.raw);
    return {
      certificateType: 'ChargingStationCertificate',
      fingerprint256: peer.fingerprint256,
      subject: peer.subject,
      serialNumber: peer.serialNumber,
      at: new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

export function clientCertOk(tlsSocket, caPem) {
  const peerInfo = tlsSocket.getPeerCertificate?.(true);
  if (!peerInfo || !peerInfo.raw) return false;
  try {
    const peer = new X509Certificate(peerInfo.raw);
    const pems = [caPem, ...extraTrustPems()].filter(Boolean);
    for (const pem of pems) {
      try {
        if (peer.verify(new X509Certificate(pem).publicKey)) return true;
      } catch {
        /* try next CA */
      }
    }
    return false;
  } catch {
    return false;
  }
}

export function certFile(kind) {
  const map = {
    'ca.pem': p('ca'),
    'server.pem': p('server'),
    'client.pem': p('client'),
    'client-key.pem': p('clientKey'),
  };
  return map[kind] || null;
}
