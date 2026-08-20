/**
 * Helios OCPP 2.1 CSMS — HTTP + HTTPS/WSS + Socket.IO
 */

import express from 'express';
import cors from 'cors';
import http from 'http';
import https from 'https';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { WebSocketServer } from 'ws';
import { Server as SocketIOServer } from 'socket.io';
import { Registry } from './registry.js';
import { SUBPROTOCOL, parseBasicAuth } from './ocpp/protocol.js';
import { defaultCsmsPayload } from './ocpp/catalog.js';
import { ensureLabCerts, httpsOptions, clientCertOk, certFile, peerCertificateInfo } from './tls.js';
import {
  HTTP_PORT,
  WSS_PORT,
  loadSecurity,
  saveSecurity,
  publicSecurity,
  stationUrls,
  enableLabHttps,
  tlsTerminated,
} from './security.js';
import { PRODUCT } from './product.js';
import { askAssistant, assistantStatus, feedLiveContext } from './assistant.js';
import { saveLlm, clearLlm, publicLlm, probeLlm, discoverOllama, useOllama, isAbortError } from './llm.js';
import {
  buildInsights,
  buildForecast,
  recommendSites,
  saveSiteRecommendation,
  proposeAction,
  listActions,
  approveAction,
  rejectAction,
} from './ai/index.js';
import { addTenant, addSite, assignChargePoint, orgSnapshot } from './org.js';
import {
  createIam,
  attachUser,
  requirePerm,
  publicUser,
  can,
  denyStatus,
  assertAssigned,
} from './iam.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

const app = express();
app.use(cors());
app.use(express.json({ limit: '2mb' }));

const httpServer = http.createServer(app);
const io = new SocketIOServer(httpServer, {
  cors: { origin: '*' },
  /* Do not destroy non-Socket.IO upgrades — OCPP WSS shares this HTTP server. */
  destroyUpgrade: false,
});
const registry = new Registry({ io });
const iam = createIam();
const certs = ensureLabCerts();

app.use('/api', attachUser(iam));

function asyncRoute(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

app.get('/api/health', (_req, res) => {
  const sec = publicSecurity();
  res.json({
    ok: true,
    role: PRODUCT.role,
    product: PRODUCT.name,
    service: PRODUCT.service,
    protocol: PRODUCT.protocol,
    subprotocol: PRODUCT.subprotocol,
    certified: PRODUCT.certified,
    chargePointLab: PRODUCT.chargePointLab,
    version: '2.1',
    port: HTTP_PORT,
    wssPort: enableLabHttps() ? WSS_PORT : null,
    stations: registry.stations.size,
    ws: sec.ws,
    wss: sec.wss,
    wsBase: sec.wsBase,
    wssBase: sec.wssBase,
    securityProfile: sec.profile,
    tlsTerminated: tlsTerminated(),
    tlsSource: certs.source,
    labHttps: enableLabHttps(),
    commit: (process.env.RENDER_GIT_COMMIT || process.env.GITHUB_SHA || '').slice(0, 7) || null,
    heartbeatDefault: 300,
    framing: ['CALL', 'CALLRESULT', 'CALLERROR', 'CALLRESULTERROR', 'SEND'],
  });
});

app.get('/api/security', (_req, res) => {
  res.json({ security: publicSecurity(), tlsSource: certs.source });
});

app.put(
  '/api/security',
  requirePerm('security.write'),
  asyncRoute(async (req, res) => {
    const body = req.body || {};
    const cur = loadSecurity();
    const patch = { ...body };
    if (!patch.basicPass) patch.basicPass = cur.basicPass;
    const security = saveSecurity(patch);
    io.emit('cms:security', security);
    res.json({ security });
  })
);

app.get('/api/security/certs/:name', (req, res) => {
  const file = certFile(req.params.name);
  if (!file || !fs.existsSync(file)) return res.status(404).json({ error: 'Unknown certificate' });
  res.type('application/x-pem-file');
  res.setHeader('Content-Disposition', `attachment; filename="${req.params.name}"`);
  res.send(fs.readFileSync(file, 'utf8'));
});

app.get('/api/catalog', (_req, res) => {
  res.json(registry.catalog());
});

app.get('/api/stations', (_req, res) => {
  res.json({ stations: registry.listStations(), connection: publicSecurity(), ...orgSnapshot(registry) });
});

app.get('/api/org', (_req, res) => {
  res.json(orgSnapshot(registry));
});

app.get('/api/me', (req, res) => {
  res.json({
    user: req.cmsUser,
    users: iam.listUsers().map(publicUser),
    ...iam.catalog(),
  });
});

app.get('/api/users', requirePerm('users.read'), (req, res) => {
  res.json({ users: iam.listUsers().map(publicUser), ...iam.catalog() });
});

app.post('/api/users', requirePerm('users.write'), (req, res) => {
  try {
    const user = publicUser(iam.addUser(req.cmsUser, req.body || {}));
    res.status(201).json({ user, users: iam.listUsers().map(publicUser) });
  } catch (err) {
    denyStatus(err, res);
  }
});

app.patch('/api/users/:id', requirePerm('users.write'), (req, res) => {
  try {
    const user = publicUser(iam.patchUser(req.cmsUser, req.params.id, req.body || {}));
    res.json({ user, users: iam.listUsers().map(publicUser) });
  } catch (err) {
    denyStatus(err, res);
  }
});

app.delete('/api/users/:id', requirePerm('users.write'), (req, res) => {
  try {
    iam.removeUser(req.cmsUser, req.params.id);
    res.json({ ok: true, users: iam.listUsers().map(publicUser) });
  } catch (err) {
    denyStatus(err, res);
  }
});

app.get('/api/chats', (req, res) => {
  res.json({ chats: iam.listChats(req.cmsUser) });
});

app.post('/api/chats', (req, res) => {
  const chat = iam.createChat(req.cmsUser, req.body || {});
  res.status(201).json({ chat: iam.publicChat(chat) });
});

app.get('/api/chats/:id', (req, res) => {
  const chat = iam.getChat(req.params.id);
  if (!chat || !iam.canSeeChat(req.cmsUser, chat)) return res.status(404).json({ error: 'Chat not found' });
  res.json({ chat: iam.publicChat(chat) });
});

app.patch('/api/chats/:id', (req, res) => {
  try {
    const chat = iam.patchChat(req.cmsUser, req.params.id, req.body || {});
    res.json({ chat: iam.publicChat(chat) });
  } catch (err) {
    denyStatus(err, res);
  }
});

app.delete('/api/chats/:id', (req, res) => {
  try {
    iam.removeChat(req.cmsUser, req.params.id);
    res.json({ ok: true, chats: iam.listChats(req.cmsUser) });
  } catch (err) {
    denyStatus(err, res);
  }
});

app.post(
  '/api/chats/:id/live-pack',
  requirePerm('assistant.ask'),
  (req, res) => {
    try {
      const chat = iam.getChat(req.params.id);
      if (!chat || !iam.canSeeChat(req.cmsUser, chat)) return res.status(404).json({ error: 'Chat not found' });
      const fed = feedLiveContext(registry);
      iam.setLivePack(chat, fed.summary);
      iam.appendMessage(chat, {
        role: 'assistant',
        content: fed.answer,
        userId: null,
        userName: 'Helios',
        mode: 'ask',
        source: 'live-pack',
        model: null,
      });
      res.json({ ok: true, chat: iam.publicChat(chat), summary: fed.summary });
    } catch (err) {
      denyStatus(err, res);
    }
  }
);

app.post(
  '/api/chats/:id/messages',
  asyncRoute(async (req, res) => {
    const chat = iam.getChat(req.params.id);
    if (!chat || !iam.canSeeChat(req.cmsUser, chat)) return res.status(404).json({ error: 'Chat not found' });
    const { question, history, agentMode, mode, tools } = req.body || {};
    const q = String(question || '').trim();
    if (!q) return res.status(400).json({ error: 'question is required' });
    const resolvedMode = mode || (agentMode === false ? 'ask' : 'agent');
    if (!can(req.cmsUser, `assistant.${resolvedMode}`)) {
      return res.status(403).json({
        error: `${req.cmsUser.name} (${req.cmsUser.roleLabel}) cannot use ${resolvedMode} mode`,
      });
    }
    iam.appendMessage(chat, {
      role: 'user',
      content: q,
      userId: req.cmsUser.id,
      userName: req.cmsUser.name,
      mode: mode || 'ask',
    });
    const prior = (chat.messages || [])
      .filter((m) => m.role === 'user' || m.role === 'assistant')
      .slice(-12)
      .map((m) => ({ role: m.role, content: m.content }));
    const ac = new AbortController();
    const stopIfClientGone = () => {
      if (!res.headersSent && !res.writableEnded) ac.abort();
    };
    res.on('close', stopIfClientGone);
    const appendStopped = () => {
      const last = (chat.messages || [])[chat.messages.length - 1];
      if (last?.role === 'assistant' && last.source === 'cancelled') return;
      iam.appendMessage(chat, {
        role: 'assistant',
        content: 'Stopped.',
        userId: null,
        userName: 'Helios',
        mode: resolvedMode,
        source: 'cancelled',
      });
    };
    try {
      const result = await askAssistant(registry, {
        question: q,
        history: Array.isArray(history) && history.length ? history : prior,
        agentMode,
        mode,
        tools,
        actor: req.cmsUser,
        pendingJob: chat.pendingJob || null,
        livePackEnabled: !!chat.livePackEnabled,
        signal: ac.signal,
      });
      chat.pendingJob = result.pendingJob || null;
      iam.appendMessage(chat, {
        role: 'assistant',
        content: result.answer,
        userId: null,
        userName: 'Helios',
        mode: result.mode,
        source: result.source,
        model: result.model,
        plan: result.plan,
        proposedActions: result.proposedActions,
        executedActions: result.executedActions,
        pending: result.pending || null,
        needsInput: !!result.needsInput,
        suggestions: result.suggestions || [],
      });
      if (!res.headersSent) {
        res.json({ ...result, chat: iam.publicChat(chat) });
      }
    } catch (err) {
      if (isAbortError(err) || ac.signal.aborted) {
        appendStopped();
        if (!res.headersSent) {
          return res.status(499).json({ error: 'Stopped', aborted: true, chat: iam.publicChat(chat) });
        }
        return;
      }
      if (err.status === 403) return res.status(403).json({ error: err.message, chat: iam.publicChat(chat) });
      throw err;
    } finally {
      res.off('close', stopIfClientGone);
    }
  })
);

app.post('/api/tenants', requirePerm('org.tenant'), (req, res) => {
  try {
    const tenant = addTenant(registry, req.body || {});
    res.status(201).json({ tenant, ...orgSnapshot(registry) });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/sites', requirePerm('org.site'), (req, res) => {
  try {
    assertAssigned(req.cmsUser, { tenantId: req.body?.tenantId }, registry);
    const site = addSite(registry, req.body || {});
    res.status(201).json({ site, ...orgSnapshot(registry) });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/stations/enroll', requirePerm('org.enroll'), (req, res) => {
  try {
    assertAssigned(req.cmsUser, { tenantId: req.body?.tenantId, siteId: req.body?.siteId }, registry);
    const station = registry.enrollStation(req.body || {});
    res.status(201).json({ station, urls: stationUrls(station.stationId) });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/stations/:id', (req, res) => {
  const station = registry.getStation(req.params.id);
  if (!station) return res.status(404).json({ error: 'Station not found' });
  res.json({ station: registry.decorate(station.snapshot()), urls: stationUrls(req.params.id) });
});

app.patch('/api/stations/:id/org', requirePerm('org.assign'), (req, res) => {
  const station = registry.getStation(req.params.id);
  if (!station) return res.status(404).json({ error: 'Charge point not found' });
  try {
    assertAssigned(req.cmsUser, { stationId: req.params.id, siteId: req.body?.siteId, tenantId: req.body?.tenantId }, registry);
    assignChargePoint(registry, req.params.id, req.body || {});
    registry.emitStation(station);
    res.json({ station: registry.decorate(station.snapshot()), ...orgSnapshot(registry) });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post(
  '/api/stations/:id/call',
  requirePerm('ocpp.call'),
  asyncRoute(async (req, res) => {
    try {
      assertAssigned(req.cmsUser, { stationId: req.params.id }, registry);
    } catch (err) {
      return res.status(403).json({ error: err.message });
    }
    const { action, payload } = req.body || {};
    if (!action) return res.status(400).json({ error: 'action is required' });
    try {
      const result = await registry.callStation(req.params.id, action, payload);
      res.json(result);
    } catch (err) {
      const status = err.code === 'STATION_OFFLINE' ? 409 : 500;
      res.status(status).json({ error: err.message, code: err.code || 'CALL_FAILED' });
    }
  })
);

app.get('/api/messages', (req, res) => {
  const stationId = req.query.stationId ? String(req.query.stationId) : '';
  res.json({ messages: registry.listMessages(stationId) });
});

app.get('/api/tokens', (_req, res) => {
  res.json({ tokens: registry.listTokens() });
});

app.post('/api/tokens', requirePerm('tokens.write'), (req, res) => {
  try {
    const token = registry.upsertToken(req.body || {});
    res.status(201).json({ token });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/tariffs', (_req, res) => {
  res.json({ tariffs: registry.listTariffs(), payments: registry.payments });
});

app.post('/api/tariffs', requirePerm('tariffs.write'), (req, res) => {
  const tariff = registry.addTariff(req.body || {});
  res.status(201).json({ tariff });
});

app.get('/api/transactions', (_req, res) => {
  res.json({ transactions: registry.listTransactions() });
});

app.get('/api/reservations', (_req, res) => {
  res.json({ reservations: registry.listReservations() });
});

app.post('/api/reservations', requirePerm('reservations.write'), (req, res) => {
  const reservation = registry.addReservation(req.body || {});
  res.status(201).json({ reservation });
});

app.get('/api/firmware', (_req, res) => {
  res.json({ jobs: registry.listFirmware() });
});

app.get('/api/certificates', (_req, res) => {
  res.json({
    certificates: registry.listCertificates(),
    securityEvents: registry.securityEvents,
  });
});

app.get('/api/diagnostics', (_req, res) => {
  res.json({
    diagnostics: registry.listDiagnostics(),
    streams: registry.streamSamples.slice(0, 50),
  });
});

app.get('/api/der', (_req, res) => {
  res.json({
    der: registry.derEvents,
    batterySwaps: registry.batterySwaps,
  });
});

app.get('/api/snapshot', (_req, res) => {
  res.json({ ...registry.snapshot(), security: publicSecurity() });
});

app.get(
  '/api/assistant',
  asyncRoute(async (_req, res) => {
    const ollama = await discoverOllama();
    res.json({ assistant: assistantStatus(), llm: publicLlm(), ollama });
  })
);

app.post(
  '/api/assistant/llm/ollama',
  requirePerm('security.write'),
  asyncRoute(async (req, res) => {
    try {
      const llm = await useOllama(req.body?.model);
      const probe = await probeLlm();
      const ollama = await discoverOllama();
      res.json({ assistant: assistantStatus(), llm, probe, ollama, keyUpdated: false });
    } catch (err) {
      denyStatus(err, res);
    }
  })
);

app.put(
  '/api/assistant/llm',
  requirePerm('security.write'),
  asyncRoute(async (req, res) => {
    try {
      const pasted = String(req.body?.apiKey || '').trim().length > 0;
      const llm = saveLlm(req.body || {});
      const probe = await probeLlm();
      const ollama = await discoverOllama();
      res.json({ assistant: assistantStatus(), llm, probe, keyUpdated: pasted, ollama });
    } catch (err) {
      denyStatus(err, res);
    }
  })
);

app.delete('/api/assistant/llm', requirePerm('security.write'), (_req, res) => {
  res.json({ assistant: assistantStatus(), llm: clearLlm() });
});

app.post(
  '/api/assistant',
  asyncRoute(async (req, res) => {
    const { question, history, agentMode, mode, tools } = req.body || {};
    const result = await askAssistant(registry, {
      question,
      history,
      agentMode,
      mode,
      tools,
      actor: req.cmsUser,
    });
    res.json(result);
  })
);

app.get('/api/insights', (_req, res) => {
  res.json(buildInsights(registry));
});

app.get('/api/forecast', (_req, res) => {
  res.json(buildForecast(registry));
});

app.get('/api/sites/recommend', (_req, res) => {
  res.json(recommendSites(registry));
});

app.post('/api/sites/recommend', requirePerm('sites.recommend'), (req, res) => {
  try {
    const saved = saveSiteRecommendation(registry, req.body || {});
    res.status(201).json({ saved, ...recommendSites(registry) });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/actions', (req, res) => {
  const status = req.query.status ? String(req.query.status) : '';
  res.json({ actions: listActions(registry, status || undefined) });
});

app.post('/api/actions', requirePerm('actions.propose'), (req, res) => {
  try {
    const action = proposeAction(registry, req.body || {});
    res.status(201).json({ action });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post(
  '/api/actions/:id/approve',
  requirePerm('actions.approve'),
  asyncRoute(async (req, res) => {
    const action = await approveAction(registry, req.params.id);
    res.json({ action });
  })
);

app.post('/api/actions/:id/reject', requirePerm('actions.approve'), (req, res) => {
  try {
    const action = rejectAction(registry, req.params.id);
    res.json({ action });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/simulate-station', requirePerm('org.simulate'), (req, res) => {
  try {
    assertAssigned(req.cmsUser, { tenantId: req.body?.tenantId, siteId: req.body?.siteId }, registry);
  } catch (err) {
    return res.status(403).json({ error: err.message });
  }
  const station = registry.simulateStation(req.body || {});
  res.status(201).json({ station });
});

app.use('/api', (req, res) => {
  res.status(404).json({ error: `Not Found: ${req.method} ${req.path}` });
});

app.use((err, _req, res, _next) => {
  res.status(err.status || 500).json({ error: err.message || 'Internal error' });
});

const dist = path.join(ROOT, 'client', 'dist');
if (fs.existsSync(dist)) {
  app.use(
    express.static(dist, {
      setHeaders(res, filePath) {
        if (filePath.endsWith('.html')) {
          res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        } else if (/\.[a-f0-9]{8,}\.(js|css|woff2?)$/i.test(filePath)) {
          res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        }
      },
    })
  );
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/ocpp') || req.path.startsWith('/socket.io')) {
      return next();
    }
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.sendFile(path.join(dist, 'index.html'));
  });
}

const wss = new WebSocketServer({
  noServer: true,
  handleProtocols: (protocols) => {
    if (protocols.has(SUBPROTOCOL)) return SUBPROTOCOL;
    return false;
  },
});

function unauthorized(socket, secure) {
  const proto = secure ? 'HTTP/1.1' : 'HTTP/1.1';
  socket.write(
    `${proto} 401 Unauthorized\r\nWWW-Authenticate: Basic realm="ocpp2.1"\r\nConnection: close\r\n\r\n`
  );
  socket.destroy();
}

function forbidden(socket, reason) {
  socket.write(`HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n${reason || ''}`);
  socket.destroy();
}

function attachOcppUpgrade(server, { nodeTls }) {
  server.on('upgrade', (req, socket, head) => {
    const { pathname } = new URL(req.url, `http://${req.headers.host || '127.0.0.1'}`);
    const match = pathname.match(/^\/ocpp\/2\.1\/([^/]+)(?:\/\1)?$/);
    if (!match) {
      /* Let Socket.IO (and other) upgrade handlers run. Do not destroy. */
      return;
    }

    const edgeTls = tlsTerminated();
    const transportSecure = !!(nodeTls || edgeTls);
    const sec = loadSecurity();

    if (sec.requireWss && !transportSecure) {
      forbidden(socket, 'WSS required');
      return;
    }

    if (sec.profile === 2 && !nodeTls) {
      forbidden(
        socket,
        'Security Profile 2 (mTLS) is local-only on the lab HTTPS listener; use Profile 0 or 1 on hosted CSMS'
      );
      return;
    }

    if (sec.profile >= 1 && transportSecure) {
      const user = sec.basicUser || process.env.CMS_BASIC_USER;
      const pass = sec.basicPass || process.env.CMS_BASIC_PASS || '';
      if (user) {
        const creds = parseBasicAuth(req.headers.authorization);
        if (!creds || creds.username !== user || creds.password !== pass) {
          unauthorized(socket, transportSecure);
          return;
        }
      } else if (sec.profile === 1) {
        forbidden(socket, 'Profile 1 requires Basic Auth credentials on the CSMS');
        return;
      }
    }

    if (sec.profile === 2 && nodeTls) {
      if (!clientCertOk(socket, certs.caPem)) {
        forbidden(socket, 'Client certificate required (Security Profile 2)');
        return;
      }
    }

    const stationId = decodeURIComponent(match[1]);
    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit('connection', ws, req, stationId, { nodeTls, transportSecure });
    });
  });
}

attachOcppUpgrade(httpServer, { nodeTls: false });

wss.on('connection', (ws, _req, stationId, meta = {}) => {
  const nodeTls = typeof meta === 'object' ? !!meta.nodeTls : !!meta;
  const transportSecure = typeof meta === 'object' ? !!meta.transportSecure : !!meta;
  const station = registry.attachStation(stationId, ws, {
    transport: transportSecure ? 'wss' : 'ws',
  });
  if (nodeTls) {
    station.noteClientCertificate(peerCertificateInfo(ws._socket));
    registry.emitStation(station);
  }
  ws.on('message', (data) => {
    try {
      station.handleRaw(data);
    } catch (err) {
      try {
        station.replyError('', 'InternalError', err.message);
      } catch {
        /* ignore */
      }
    }
  });
  ws.on('close', () => registry.detachStation(stationId, ws));
  ws.on('error', () => registry.detachStation(stationId, ws));
});

io.on('connection', (socket) => {
  socket.emit('cms:stations', registry.listStations());
  socket.emit('cms:store', registry.storeSnapshot());
  socket.emit('cms:messages', registry.messages.slice(0, 80));
  socket.emit('cms:security', publicSecurity());
});

httpServer.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${HTTP_PORT} is already in use. Stop the old CMS process, then run npm run dev again.`);
    process.exit(1);
  }
  throw err;
});

httpServer.listen(HTTP_PORT, '0.0.0.0', () => {
  const sec = publicSecurity();
  console.log(`${PRODUCT.name} CSMS (${PRODUCT.protocol}) HTTP on http://0.0.0.0:${HTTP_PORT}`);
  console.log(`Operator UI: same origin in production, or http://localhost:5174 in dev`);
  console.log(`Charge point WS base:  ${sec.wsBase}  (${PRODUCT.subprotocol})`);
  console.log(`Charge point WSS base: ${sec.wssBase}  (${PRODUCT.subprotocol})`);
  if (tlsTerminated()) {
    console.log('Edge TLS is terminated in front of this process — OCPP WSS upgrades are accepted on PORT.');
  }
  console.log(`This process is the CSMS. Charge points (e.g. ${PRODUCT.chargePointLab}) connect outbound.`);
});

const tlsOpts = httpsOptions(certs, { requestClientCert: true });
if (enableLabHttps()) {
  const httpsServer = https.createServer(tlsOpts, app);
  attachOcppUpgrade(httpsServer, { nodeTls: true });
  httpsServer.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`WSS port ${WSS_PORT} is already in use.`);
      process.exit(1);
    }
    throw err;
  });
  httpsServer.listen(WSS_PORT, '0.0.0.0', () => {
    const sec = publicSecurity();
    console.log(`${PRODUCT.name} lab TLS on https://0.0.0.0:${WSS_PORT}`);
    console.log(`Charge point WSS: ${sec.wss} (${SUBPROTOCOL})`);
  });
} else {
  console.log('Lab TLS listener (9443) is off — public WSS uses the reverse-proxy HTTPS port.');
}

export { defaultCsmsPayload };
