/**
 * No-key Ask Helios: answer live CMS / OCPP / how-to from the briefing.
 * Cloud LLM is only for jokes, poems, and off-topic write-ups.
 */

import { buildForecast, recommendSites, listActions, labWeather } from './index.js';
import { mdTable } from './replyFormat.js';
import { ROLES } from '../iam.js';

const CMS_TERM =
  /\b(helios|voltforge|csms|cms|ocpp(?:\s*2\.?1)?|wss|websocket|evse|charge[- ]?points?|charging\s*points?|chargepoints?|cp|chargers?|stations?|hubs?|depots?|tenants?|tariffs?|rfid|tokens?|sessions?|transactions?|firmware|approve|approvals?|enroll(?:ed|ing)?|commission(?:ing)?|simulate(?:d|r)?|twin|dashboard|demand|planner|security|mtls|tls|idtags?|id\s*tokens?|connectors?|outlets?|guns?|bootnotification|heartbeat|reset|unlock|availability|authorize|authorization|reservations?|smart\s*charg(?:e|ing)|profile\s*[012]|roles?|iam|kpis?|queue|pair(?:ing)?|lab\s*csms|central\s*system|setdefaulttariff|requeststart|transactionevent|emaid|local\s*list|site\s*planner|digital\s*twin|action\s*queue|certificates?|diagnostics?)\b/i;

const CMS_ID = /\b(?:massive|orbit|volt|him|vf|cp|sim|rfid|card|fob|token|emaid)[-_][a-z0-9._:-]+\b/i;

const HOW_TO =
  /\b(how (do i|to|can i|does (one|it|this)|does a)|walk me through|steps? to|where do i|show me how|tell me how|guide me)\b/i;

export function looksLikeCmsQuestion(question) {
  const q = String(question || '').trim();
  if (!q) return false;
  if (CMS_TERM.test(q) || CMS_ID.test(q)) return true;
  if (
    /\b(what is online|what'?s online|who is offline|who should we restart|why did revenue|lost revenue|income drop|keep .+ hub|underperform|where (should|to) (we )?(build|open|put|add|expand)|next site|site planner|best city)\b/i.test(
      q
    )
  ) {
    return true;
  }
  if (
    /\b(add|create|enroll|register|make|provision|onboard|pair|simulate|move|block|reserve)\b/i.test(q) &&
    /\b(tenant|station|hub|depot|charger|charge|charging|token|rfid|tariff|cp|evse|reservation)\b/i.test(q)
  ) {
    return true;
  }
  if (HOW_TO.test(q) && /\b(add|create|open|connect|pair|start|stop|approve|restart|enroll|list|show|queue|push)\b/i.test(q)) {
    if (/\b(tenant|station|hub|depot|charger|charge|token|rfid|tariff|page|screen|queue|firmware|session|reset|wss|ocpp|cp|evse)\b/i.test(q)) {
      return true;
    }
  }
  return false;
}

export function isHowToQuestion(question) {
  return HOW_TO.test(String(question || '').toLowerCase());
}

function money(n, currency = 'EUR') {
  const v = Number(n);
  if (!Number.isFinite(v)) return '—';
  return `${currency} ${v.toFixed(2)}`;
}

function header(briefing) {
  const k = briefing.kpis || {};
  const cur = k.currency || 'EUR';
  return `Live CMS (${new Date(briefing.at || Date.now()).toLocaleString()}): **${k.online || 0}/${k.stations || 0} charge points online**, **${k.liveSessions || 0} live sessions**, **${k.energyKwh || 0} kWh**, revenue **${money(k.sessionRevenue, cur)}**.`;
}

function norm(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/['"]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function namedHits(question, briefing) {
  const ql = norm(question);
  const hits = [];
  const stations = briefing.stations || [];
  const sites = briefing.org?.sites || [];
  const tenants = briefing.org?.tenants || [];
  const tokens = briefing.tokens || [];
  const tariffs = briefing.tariffs || [];

  for (const s of stations) {
    const id = norm(s.stationId);
    if (id && (ql.includes(id) || ql.replace(/\s+/g, '-') === id)) {
      hits.push({ kind: 'cp', score: id.length + 20, item: s });
    }
  }
  for (const s of [...sites].sort((a, b) => String(b.name || '').length - String(a.name || '').length)) {
    const name = norm(s.name);
    const city = norm(s.city);
    if (name && name.length >= 4 && ql.includes(name)) hits.push({ kind: 'site', score: name.length + 10, item: s });
    else if (city && city.length >= 4 && ql.includes(city) && /\b(hub|depot|station|site|city)\b/.test(ql)) {
      hits.push({ kind: 'site', score: city.length, item: s });
    }
  }
  for (const t of tenants) {
    const name = norm(t.name);
    if (name && name.length >= 3 && ql.includes(name)) hits.push({ kind: 'tenant', score: name.length + 8, item: t });
  }
  for (const t of tokens) {
    const id = norm(t.idToken);
    if (id && id.length >= 4 && ql.includes(id)) hits.push({ kind: 'token', score: id.length + 12, item: t });
  }
  for (const t of tariffs) {
    const id = norm(t.tariffId);
    if (id && ql.includes(id)) hits.push({ kind: 'tariff', score: id.length + 8, item: t });
  }
  hits.sort((a, b) => b.score - a.score);
  return hits;
}

function cpTable(rows) {
  return mdTable(
    ['Charge point', 'Status', 'Hub', 'Kind', 'EVSE'],
    rows.map((s) => [
      s.stationId,
      s.online ? 'online' : 'offline',
      s.siteName || '—',
      [s.simulated ? 'simulated' : null, s.enrolled ? 'enrolled' : null, s.transport].filter(Boolean).join(', ') || '—',
      (s.evses || []).map((e) => `EVSE ${e.evseId}/C${e.connectorId} ${e.status}`).join(', ') || '—',
    ])
  );
}

function describeCp(s, briefing) {
  const sessions = (briefing.sessions || []).filter((t) => t.stationId === s.stationId);
  const live = sessions.filter((t) => t.status && t.status !== 'Ended');
  const lines = [
    `## ${s.stationId}`,
    '',
    header(briefing),
    '',
    `- **Status:** ${s.online ? 'online' : 'offline'}${s.simulated ? ' · simulated' : ''}${s.enrolled ? ' · enrolled' : ''}`,
    `- **Hub:** ${s.siteName || '—'} (${s.city || '—'}) · tenant **${s.tenantName || '—'}**`,
    `- **Identity:** ${[s.vendor, s.model, s.firmware].filter(Boolean).join(' · ') || 'no BootNotification yet'}`,
    `- **Last heartbeat:** ${s.heartbeatAt || 'none'}`,
    `- **Default tariff:** ${s.defaultTariffId || 'none — push SetDefaultTariff so Ended sessions get totalCost'}`,
    s.wssUrl ? `- **WSS URL:** \`${s.wssUrl}\`` : '- Enrolled IDs get a copyable WSS URL on **Stations**.',
  ];
  if ((s.evses || []).length) {
    lines.push(
      `- **Connectors:** ${(s.evses || []).map((e) => `EVSE ${e.evseId} / connector ${e.connectorId} · ${e.status}`).join('; ')}`
    );
  }
  if (live.length) {
    lines.push(
      `- **Live session:** ${live.map((t) => `\`${t.transactionId}\` · ${t.kwh || 0} kWh · token ${t.token || '—'}`).join('; ')}`
    );
  } else if (sessions.length) {
    lines.push(`- **Sessions on the book:** ${sessions.length} (none live)`);
  }
  if (!s.online) {
    lines.push(
      '',
      'Offline chargers cannot receive Reset or firmware until they reconnect. Commission **WSS** from Voltforge (paste the **base** only), then **Approve** a Reset if it still stays dark.'
    );
  }
  return lines.join('\n');
}

function describeSite(site, briefing) {
  const cps = (briefing.stations || []).filter((s) => s.siteId === site.id || norm(s.siteName) === norm(site.name));
  const cur = briefing.kpis?.currency || 'EUR';
  const lines = [
    `## ${site.name}`,
    '',
    header(briefing),
    '',
    `- **City:** ${site.city || '—'} · tenant **${site.tenantName || site.tenantId || '—'}**`,
    `- **Online:** ${site.online}/${site.cps} · **${site.kwh || 0} kWh** · **${money(site.revenue, cur)}**`,
    `- **Verdict:** ${String(site.verdict || 'keep').replaceAll('_', ' ')}${site.issue ? ` — ${site.issue}` : ''}`,
  ];
  if (cps.length) {
    lines.push('', '### Charge points', '', cpTable(cps));
  } else {
    lines.push('', 'No charge points at this hub yet. Switch to **Agent** and say **Add a charge point** or **Simulate a charger at ' + site.name + '**.');
  }
  return lines.join('\n');
}

function describeTenant(tenant, briefing) {
  const sites = (briefing.org?.sites || []).filter((s) => s.tenantId === tenant.id);
  const cps = (briefing.stations || []).filter((s) => s.tenantId === tenant.id || s.tenantName === tenant.name);
  const online = cps.filter((s) => s.online).length;
  const lines = [
    `## Tenant ${tenant.name}`,
    '',
    header(briefing),
    '',
    `- **Stations:** ${sites.length} · **Charge points:** ${online}/${cps.length} online`,
  ];
  if (sites.length) {
    lines.push(
      '',
      mdTable(
        ['Hub', 'City', 'Online', 'kWh', 'Verdict'],
        sites.map((s) => [
          s.name,
          s.city || '—',
          `${s.online}/${s.cps}`,
          s.kwh || 0,
          String(s.verdict || '').replaceAll('_', ' ') || '—',
        ])
      )
    );
  }
  return lines.join('\n');
}

function glossary(q) {
  const entries = [
    {
      test: /\bocpp\b/,
      title: 'OCPP',
      body: `**OCPP** is the protocol between a charge point and this CSMS. Helios speaks **OCPP 2.1** on WebSocket subprotocol \`ocpp2.1\`. Frames are CALL 2, CALLRESULT 3, CALLERROR 4, CALLRESULTERROR 5, SEND 6. One outstanding CALL per direction.

Do **not** send OCPP 1.6 StartTransaction / RemoteStartTransaction — they return NotImplemented. Boot with chargingStation.model, chargingStation.vendorName, and reason. Open **OCPP catalog** for every action.`,
    },
    {
      test: /\b(csms|central system)\b/,
      title: 'CSMS',
      body: `A **CSMS** is the central system that charge points connect to. **Helios** is the CSMS in this lab. **Voltforge** is a separate 3D charge-point lab — it is not a second CSMS. Pair them on **WSS** with subprotocol \`ocpp2.1\`. This lab is **not** OCA-certified.`,
    },
    {
      test: /\bevse\b/,
      title: 'EVSE',
      body: `An **EVSE** is one electrical outlet group on a charge point. OCPP 2.1 addresses EVSE id + connector id (gun). StatusNotification / TransactionEvent use those ids. Helios shows them on **Stations** and in Ask when you name a charge point.`,
    },
    {
      test: /\b(rfid|id\s*token|idtag|emaid)\b/,
      title: 'RFID / idToken',
      body: `Authorize looks up **idToken** in this CSMS (RFID, eMAID, …). Add a tag in **Agent**: \`Add RFID CARD-7F2A91\`. Then start a session from Voltforge or **Stations → RequestStart**. SendLocalList / ClearCache on **RFID & tokens** push the list to the charger. Blocking a token is Agent: \`Block token CARD-7F2A91\`.`,
    },
    {
      test: /\btariff\b/,
      title: 'Tariff',
      body: `Tariffs live on **Tariffs & Cost**. Push **SetDefaultTariff** onto an online charge point so Ended **TransactionEvent** sessions get totalCost. Agent: \`Add tariff PEAK at 0.55\` then \`Set default tariff PEAK on MASSIVE-WF-01\`. Live OCPP still needs **Approve**.`,
    },
    {
      test: /\b(wss|websocket|tls|mtls)\b/,
      title: 'WSS pairing',
      body: `Real path is **WSS** (WebSocket over TLS), not plain WS. Paste only the **WSS base** into Voltforge — the lab appends the charge point ID. Subprotocol \`ocpp2.1\`. Local lab uses port **9443** and Trust lab TLS. Hosted Helios uses the same HTTPS host (no 9443).`,
    },
    {
      test: /\b(voltforge|helios)\b/,
      title: 'Helios vs Voltforge',
      body: `**Helios** = this CSMS (operator UI + OCPP 2.1). **Voltforge** = 3D charge-point lab. Enroll the ID on Helios **Stations** (or Agent: \`Add a charge point\`), copy the WSS **base** into Voltforge, connect. Simulated chargers in Helios skip WSS — they are already “online” in the lab.`,
    },
    {
      test: /\b(approve|action queue)\b/,
      title: 'Approve',
      body: `Ask and Agent can **create records** (tenant, hub, RFID, tariff) immediately. They cannot fire live OCPP. Reset, firmware, stop session, ChangeAvailability sit on the Dashboard **Approve** queue until an operator confirms. Offline chargers still will not receive the CALL until they reconnect on WSS.`,
    },
  ];
  if (!/^(what is|what's|whats|define|explain|tell me about)\b/.test(q)) return '';
  const hit = entries.find((e) => e.test.test(q));
  if (!hit) return '';
  return `## ${hit.title}\n\n${hit.body}`;
}

function howTo(q, briefing) {
  const wss = briefing.product || {};
  const sample = (briefing.stations || []).find((s) => s.wssUrl) || briefing.stations?.[0];

  if (/\b(pair|commission|connect|wss|voltforge|websocket|tls)\b/.test(q) && /\b(charge|charger|cp|station|ocpp|lab|voltforge|wss|how)\b/.test(q)) {
    return [
      '## Pair Voltforge on WSS',
      '',
      header(briefing),
      '',
      '1. Enroll the OCPP ID on **Stations**, or in **Agent** say `Add a charge point VF-CP-21 at Whitefield Hub`.',
      '2. Copy the **WSS base** only (no station ID on the end).',
      `   - Base: \`${wss.wssBase || 'wss://HOST/ocpp/2.1'}\``,
      `   - Template: \`${wss.wss || 'wss://HOST/ocpp/2.1/{id}'}\``,
      sample?.wssUrl ? `   - Example enrolled URL: \`${sample.wssUrl}\`` : '',
      '3. In Voltforge paste that base, set subprotocol `ocpp2.1`, connect.',
      '4. Local lab: Trust lab TLS on port **9443**. Hosted Helios uses the site HTTPS host — no 9443.',
      '5. Simulated chargers (`Simulate a charger at Cyber Hub` in Agent) skip WSS — they are already online in this lab.',
      '',
      `Security profile **${wss.securityProfile ?? '—'}** (${wss.profileName || '—'}). Require WSS: ${wss.requireWss ? 'yes' : 'no'}.`,
    ]
      .filter((line) => line !== '')
      .join('\n');
  }

  if (/\b(rfid|token|idtag|id token|authoriz)\b/.test(q) && (HOW_TO.test(q) || /\b(add|register|create|new)\b/.test(q))) {
    return [
      '## Add RFID / idToken',
      '',
      header(briefing),
      '',
      'Ask mode will not write. Switch to **Agent** and say:',
      '',
      '- `Add RFID CARD-7F2A91`',
      '- or `Add token FLEET-22`',
      '',
      'Then start a session from Voltforge (present the tag) or **Stations → RequestStart**. Push the list to a charger with SendLocalList on **RFID & tokens**. To stop a tag: `Block token CARD-7F2A91`.',
      '',
      (briefing.tokens || []).length
        ? mdTable(
            ['Token', 'Type', 'Status'],
            briefing.tokens.slice(0, 12).map((t) => [t.idToken, t.type, t.status])
          )
        : 'No tokens in the book yet.',
    ].join('\n');
  }

  if (/\btariff\b/.test(q) && (HOW_TO.test(q) || /\b(add|set|push|default)\b/.test(q))) {
    return [
      '## Tariffs',
      '',
      header(briefing),
      '',
      '1. Create or pick a tariff on **Tariffs & Cost**, or Agent: `Add tariff PEAK at 0.55`.',
      '2. Push it to an **online** charge point: `Set default tariff MASSIVE-AC-DEFAULT on MASSIVE-WF-01`.',
      '3. That is live OCPP (**SetDefaultTariff**) — it waits on **Approve**.',
      '4. Ended TransactionEvent sessions then carry totalCost.',
      '',
      (briefing.tariffs || []).length
        ? mdTable(
            ['Tariff', 'Energy', 'Parking'],
            briefing.tariffs.map((t) => [t.tariffId, `${t.currency} ${t.energyKwh}/kWh`, t.parkingPerHour ? `${t.parkingPerHour}/h` : '—'])
          )
        : 'No tariffs yet.',
    ].join('\n');
  }

  if (/\b(approve|approval|action queue|queue a reset|send ocpp)\b/.test(q)) {
    return [
      '## Approve live OCPP',
      '',
      header(briefing),
      '',
      'Helios will **not** Reset, update firmware, or stop a session until you Approve.',
      '',
      '1. Ask something like `Who should we restart?` — proposals appear under the answer.',
      '2. Open **Dashboard** (or say `open Dashboard`) and use the **Approve** queue.',
      '3. Approve sends the CALL. Reject drops it.',
      '4. An **offline** charge point still cannot receive OCPP. Pair WSS first, then Approve.',
      '',
      'Record writes (tenant, hub, RFID, enroll ID) from **Agent** do **not** need Approve.',
    ].join('\n');
  }

  if (/\b(simulate|fake charger|virtual charger|lab charger)\b/.test(q)) {
    return [
      '## Simulate a charge point',
      '',
      'Switch to **Agent** and say `Simulate a charger at Cyber Hub` (or another hub). Helios creates an already-online lab CP — **no Voltforge / WSS** needed. Use this to fill a hub for Ask, Demand, and the twin map.',
      '',
      'A **real** cabinet still needs enroll + WSS. That is `Add a charge point VF-CP-21 at Whitefield Hub` then pair Voltforge.',
    ].join('\n');
  }

  if (/\b(add|create|enroll|register|new)\b/.test(q) && /\b(tenant|station|hub|depot|charge\s*point|charging\s*point|chargepoint|charger|\bcp\b|evse)\b/.test(q)) {
    return [
      '## Add tenant / station / charge point',
      '',
      'I can do this **locally in Agent** — no API key. If you are still in Ask, switch to **Agent** (or say the same line there).',
      '',
      '- `Add tenant FleetCo with a station Indiranagar Hub in Bengaluru and a charge point CP-01`',
      '- `Add station Koramangala Hub in Bengaluru`',
      '- `Add a charge point VF-CP-21 at Whitefield Hub`',
      '- `Add CP DEMO-01 at Whitefield Hub`',
      '- `Enroll MASSIVE-WF-99 at Whitefield Hub`',
      '',
      'If a tenant, hub, or OCPP ID is missing, Helios asks before writing. After enroll, commission **WSS** in Voltforge (base only). Simulated CPs skip that.',
    ].join('\n');
  }

  if (/\b(role|iam|permission|who can)\b/.test(q)) {
    return [
      '## Roles',
      '',
      'Open **Roles** (or say `open Roles`). Lab identity is the operator switcher — not production login.',
      '',
      mdTable(
        ['Role', 'What they can do'],
        ROLES.map((r) => [r.label, r.blurb])
      ),
      '',
      '**Member** can Ask but cannot run Agent writes. Live OCPP still needs **Approve** for every role.',
    ].join('\n');
  }

  if (/\b(reset|restart|bring back|reboot)\b/.test(q) && HOW_TO.test(q)) {
    return [
      '## Restart a charge point',
      '',
      header(briefing),
      '',
      'Ask `Who should we restart?` to attach Reset proposals. Then **Approve** on Dashboard. Helios does not send Reset from Ask or Agent itself.',
      '',
      'If the CP is offline, Approve still cannot reach it — pair **WSS** first.',
    ].join('\n');
  }

  if (/\b(ask vs agent|agent vs ask|difference between ask|when to use agent)\b/.test(q) || (/\b(ask|agent)\b/.test(q) && HOW_TO.test(q) && /\b(mode|use|switch)\b/.test(q))) {
    return [
      '## Ask vs Agent',
      '',
      '- **Ask** — live snapshot, how-tos, keep vs remove, Demand, named status. Nothing is created.',
      '- **Agent** — creates tenants, hubs, charge points, RFID, tariffs, reservations, simulated CPs. Asks if a name is missing.',
      '- **Approve** — live OCPP only (Reset, firmware, stop session, availability).',
      '',
      'No API key is required for any of that. A key (or local Ollama) is only for jokes, poems, and off-topic write-ups.',
    ].join('\n');
  }

  return '';
}

function demandAnswer(registry, question, briefing) {
  if (!registry) return '';
  const q = String(question || '').toLowerCase();
  if (!/\b(demand|forecast|load|peak window|quiet window|next (3|three) days)\b/.test(q)) return '';
  if (/\b(weather outside|news)\b/.test(q) && !/\b(demand|hub|station|site|forecast)\b/.test(q)) return '';
  const fc = buildForecast(registry);
  const ql = norm(question);
  const named =
    (fc.stations || []).find((s) => ql.includes(norm(s.name)) || (s.city && ql.includes(norm(s.city)))) || fc.stations?.[0];
  const wx = named?.weather || fc.weather || labWeather();
  const lines = [
    '## Demand (lab estimate)',
    '',
    header(briefing),
    '',
    fc.note || 'Lab estimate, not a meter. Weather is simulated.',
    '',
    named
      ? `**${named.name}** (${named.city || '—'}): next ~3 days **${named.kwh3dLow}–${named.kwh3dHigh} kWh**, **${named.sessions3dLow}–${named.sessions3dHigh} sessions**. Mix ${named.mix || '—'}. Lab weather now: ${wx.condition || wx.summary || '—'} ~${wx.tempC ?? '—'}°C.`
      : 'No hubs to forecast yet.',
  ];
  if (named?.briefing?.length) {
    lines.push('', '### Next days', '', named.briefing.map((b) => `- ${b}`).join('\n'));
  }
  if (named?.peakWindow || named?.peak) {
    const p = named.peakWindow || named.peak;
    lines.push('', `Peak window around **${p.dayLabel || ''} ${p.hour != null ? `${p.hour}:00` : ''}**. Use quiet hours on Demand for Inoperative / firmware.`);
  }
  lines.push('', 'Open **Demand** for the full 72-hour chart. Say `open Demand`.');
  return lines.join('\n');
}

function plannerAnswer(registry, question, briefing) {
  if (!registry) return '';
  const q = String(question || '').toLowerCase();
  if (!/\b(site planner|where (should|to) (we )?(build|open|put|add|expand)|next site|recommend (a )?site|best city)\b/.test(q)) {
    return '';
  }
  const rec = recommendSites(registry);
  const top = (rec.candidates || []).slice(0, 6);
  const lines = [
    '## Site planner',
    '',
    header(briefing),
    '',
    rec.note || 'Lab planner — not Google Maps.',
    '',
    top.length
      ? mdTable(
          ['City', 'Daily kWh (lab)', 'Payback (mo)', 'Risk', 'Existing Helios'],
          top.map((c) => [
            c.city,
            c.expectedDailyKwh,
            c.paybackMonths,
            c.risk,
            c.existingMassive || 0,
          ])
        )
      : 'No candidates.',
    '',
    'Open **Site planner** for the map. Agent can `Save Pune as a next site` after you pick one.',
  ];
  return lines.join('\n');
}

function securityAnswer(question, briefing) {
  const q = String(question || '').toLowerCase();
  if (!/\b(security profile|profile [012]|basic auth|client cert|mtls|require wss|certificates?)\b/.test(q)) return '';
  const p = briefing.product || {};
  return [
    '## Security',
    '',
    header(briefing),
    '',
    `- **Profile ${p.securityProfile}** — ${p.profileName}`,
    `- **Require WSS:** ${p.requireWss ? 'yes' : 'no'}`,
    `- **Basic auth configured:** ${p.basicConfigured ? 'yes' : 'no'}`,
    `- **WSS base:** \`${p.wssBase || ''}\``,
    `- **WS (lab only):** \`${p.wsBase || p.ws || ''}\``,
    '',
    'Change profile on **Security**. Profile 0 is unsecured WS (lab). Profile 1 is WSS + optional basic. Profile 2 is mTLS. Hosted Helios already sits on HTTPS — use the same host for WSS.',
  ].join('\n');
}

function approveQueueAnswer(registry, question, briefing) {
  const q = String(question || '').toLowerCase();
  if (!registry) return '';
  if (!/\b(pending actions|proposed actions|what'?s (in )?(the )?queue|approve queue|waiting for approve)\b/.test(q)) return '';
  const proposed = listActions(registry, 'proposed');
  const lines = ['## Approve queue', '', header(briefing), ''];
  if (!proposed.length) {
    lines.push('Nothing waiting. Ask `Who should we restart?` or `Why did revenue drop?` to attach Reset / stop-session proposals, then Approve on Dashboard.');
    return lines.join('\n');
  }
  lines.push(
    mdTable(
      ['Action', 'Charge point', 'OCPP', 'Why'],
      proposed.slice(0, 12).map((a) => [a.label || a.id, a.stationId || '—', a.ocppAction || '—', a.reason || '—'])
    )
  );
  lines.push('', 'Open **Dashboard** and Approve. Helios will not send these CALLs until you do.');
  return lines.join('\n');
}

function listOrgAnswer(question, briefing) {
  const q = String(question || '').toLowerCase();
  const wantList = /\b(list|show all|inventory|how many|which)\b/.test(q);
  if (wantList && /\btenants?\b/.test(q)) {
    const tenants = briefing.org?.tenants || [];
    const sites = briefing.org?.sites || [];
    return [
      '## Tenants',
      '',
      header(briefing),
      '',
      tenants.length
        ? mdTable(
            ['Tenant', 'Hubs'],
            tenants.map((t) => [t.name, sites.filter((s) => s.tenantId === t.id).length])
          )
        : 'No tenants yet. Agent: `Add tenant FleetCo`.',
    ].join('\n');
  }
  if (wantList && /\b(hubs?|sites?|stations?)\b/.test(q) && !/\bcharge\s*points?\b/.test(q)) {
    const sites = briefing.org?.sites || [];
    const cur = briefing.kpis?.currency || 'EUR';
    return [
      '## Hubs',
      '',
      header(briefing),
      '',
      sites.length
        ? mdTable(
            ['Hub', 'City', 'Online', 'kWh', 'Revenue', 'Verdict'],
            sites.map((s) => [
              s.name,
              s.city || '—',
              `${s.online}/${s.cps}`,
              s.kwh || 0,
              money(s.revenue, cur),
              String(s.verdict || '').replaceAll('_', ' ') || '—',
            ])
          )
        : 'No hubs yet. Agent: `Add station Koramangala Hub in Bengaluru`.',
    ].join('\n');
  }
  if (/\b(who is offline|offline charge|offline charger|which .{0,20}offline)\b/.test(q)) {
    const offline = (briefing.stations || []).filter((s) => !s.online);
    return [
      '## Offline charge points',
      '',
      header(briefing),
      '',
      offline.length ? cpTable(offline) : 'Every enrolled charge point is online.',
      '',
      offline.length
        ? 'Approve Reset only after WSS is up — an offline CP cannot receive the CALL. Ask `Who should we restart?` to attach proposals.'
        : '',
    ]
      .filter(Boolean)
      .join('\n');
  }
  if (/\b(what is online|what'?s online|who is online)\b/.test(q)) {
    const online = (briefing.stations || []).filter((s) => s.online);
    const offline = (briefing.stations || []).filter((s) => !s.online);
    return [
      '## Online now',
      '',
      header(briefing),
      '',
      `**${online.length}** online · **${offline.length}** offline.`,
      '',
      online.length ? cpTable(online.slice(0, 24)) : 'None online. Pair WSS or simulate a charger in Agent.',
      offline.length ? `\n${offline.length} offline: ${offline.slice(0, 8).map((s) => s.stationId).join(', ')}${offline.length > 8 ? '…' : ''}` : '',
    ]
      .filter(Boolean)
      .join('\n');
  }
  return '';
}

function helpAnswer(briefing) {
  return [
    '## What I can do without an API key',
    '',
    header(briefing),
    '',
    '**Ask** (this mode) reads the live CSMS:',
    '- Status of a named CP or hub — `Status of MASSIVE-WF-01` / `Whitefield Hub`',
    '- `What is online right now?` · `Who is offline?` · `List tenants` · `List hubs`',
    '- `Should we keep Whitefield Hub?` · `Why did revenue drop?`',
    '- How-tos: pair Voltforge on WSS, add RFID, tariffs, Approve, roles, simulate',
    '- `Demand forecast` · `Where should we build next?`',
    '- `Open Stations` / Demand / Security / RFID — I take you there',
    '',
    '**Agent** writes records: tenant, hub, charge point, RFID, tariff, reservation, simulated CP.',
    '',
    '**Approve** is still required for live OCPP (Reset, firmware, stop session).',
    '',
    'A cloud API key (or local Ollama) is **optional** — only for jokes, poems, and off-topic CS write-ups.',
  ].join('\n');
}

export function cmsFallback(question, briefing) {
  const slice = String(question || '').trim().slice(0, 160);
  return [
    helpAnswer(briefing),
    '',
    `I did not match a tighter playbook for “${slice}”. Ask again with a hub name, charge-point ID, or one of the phrases above.`,
  ].join('\n');
}

/**
 * Local CMS answer, or '' to let assistant.js keep its existing matchers.
 */
export function localOpsAnswer(question, briefing, registry) {
  const q = String(question || '').trim().toLowerCase();
  if (!q) return '';

  if (
    /^(what can you do|help|help me|capabilities|what do you (do|support)|how does ask work)\b/.test(q) ||
    /\b(without (an? )?(api )?key|no api key)\b/.test(q)
  ) {
    return helpAnswer(briefing);
  }

  const gloss = glossary(q);
  if (gloss) return gloss;

  const guide = howTo(q, briefing);
  if (guide) return guide;

  const listed = listOrgAnswer(question, briefing);
  if (listed) return listed;

  const demand = demandAnswer(registry, question, briefing);
  if (demand) return demand;

  const planner = plannerAnswer(registry, question, briefing);
  if (planner) return planner;

  const security = securityAnswer(question, briefing);
  if (security) return security;

  const queue = approveQueueAnswer(registry, question, briefing);
  if (queue) return queue;

  const hits = namedHits(question, briefing);
  const lookingUp = /\b(status|about|details?|info|inventory|where is|how is|tell me)\b/.test(q) || hits.length && !HOW_TO.test(q) && !/\b(add|create|enroll|simulate|move|block|reserve|keep|remove)\b/.test(q);
  if (lookingUp && hits.length) {
    const top = hits[0];
    if (top.kind === 'cp') return describeCp(top.item, briefing);
    if (top.kind === 'site') return describeSite(top.item, briefing);
    if (top.kind === 'tenant') return describeTenant(top.item, briefing);
    if (top.kind === 'token') {
      const t = top.item;
      return `**${t.idToken}** is in the token book as **${t.type}** · **${t.status}**. Authorize uses this store. Agent: \`Block token ${t.idToken}\` if it should stop. Start a session from Voltforge or Stations → RequestStart.`;
    }
    if (top.kind === 'tariff') {
      const t = top.item;
      return `**${t.tariffId}**: ${t.currency} ${t.energyKwh}/kWh${t.parkingPerHour ? `, parking ${t.parkingPerHour}/h` : ''}. ${t.description || ''} Push with Agent: \`Set default tariff ${t.tariffId} on MASSIVE-WF-01\` then **Approve**.`;
    }
  }

  return '';
}
