/**
 * Operator AI for the Helios OCPP 2.1 CMS.
 * Always sees the live registry. Uses an OpenAI-compatible LLM when a key is set;
 * otherwise answers from the live briefing plus lab OCPP knowledge.
 */

import { publicSecurity } from './security.js';
import { PRODUCT } from './product.js';
import { CS_TO_CSMS, CSMS_TO_CS, ALL_ACTIONS, BLOCKS } from './ocpp/catalog.js';
import { opsHints, proposeCopilotActions } from './ai/index.js';
import { runAgent, stripLlmTools, formatAgentReport, AGENT_TOOL_GUIDE, buildPlan, formatPlan, callsToPlan, openaiToolDefs, claudeToolDefs, toolsFromOpenAiMessage, toolsFromClaudeContent, wantsMutation } from './ai/agent.js';
import { resolveJob, isCancel } from './ai/clarify.js';
import { parseNavIntent } from './ai/navIntent.js';
import { runCopilotLoop } from './ai/loop.js';
import { can, roleLabel } from './iam.js';
import { listTenants, listSites } from './org.js';
import { llmRuntime, publicLlm, isClaudeRuntime, keyMismatchHint, postOpenAiChat, isOpenRouterLimited, throwIfAborted, isAbortError, llmAccess, markLlmUnauthorized } from './llm.js';
import {
  generalAnswer,
  hasKnownGeneralAnswer,
  isGeneralQuestion,
  isKeepRemoveQuestion,
  isLlmPrimaryQuestion,
  llmKeyNeededReply,
  keepRemoveAnswer,
  strategyPlan,
  llmFailNote,
  looksLikeCmsQuestion,
} from './ai/advisor.js';
import { localOpsAnswer, cmsFallback, isHowToQuestion } from './ai/localOps.js';
import { REPLY_FORMAT, mdTable, isUselessReply, stripLlmReply, pickOperatorReply } from './ai/replyFormat.js';

export function assistantStatus() {
  return {
    agentic: true,
    modes: ['ask', 'plan', 'agent', 'multitask'],
    ...publicLlm(),
  };
}

function tokenLabel(idToken) {
  if (!idToken) return null;
  if (typeof idToken === 'string') return idToken;
  return idToken.idToken || null;
}

export function buildBriefing(registry) {
  const stations = registry.listStations();
  const tx = registry.listTransactions();
  const live = tx.filter((t) => t.status && t.status !== 'Ended');
  const ended = tx.filter((t) => t.status === 'Ended');
  const kwh = tx.reduce((s, t) => s + (Number(t.kwh) || 0), 0);
  const revenue = tx.reduce((s, t) => s + (Number(t.cost) || 0), 0);
  const evses = stations.flatMap((s) => s.evses || []);
  const occupied = evses.filter((e) => /Occup|Charging|Suspended/i.test(e.connectorStatus || '')).length;
  const security = publicSecurity();

  return {
    at: new Date().toISOString(),
    product: {
      name: PRODUCT.name,
      role: 'csms',
      certified: false,
      protocol: 'OCPP 2.1',
      subprotocol: 'ocpp2.1',
      chargePointLab: 'Voltforge',
      framing: ['CALL 2', 'CALLRESULT 3', 'CALLERROR 4', 'CALLRESULTERROR 5', 'SEND 6'],
      ws: security.ws,
      wss: security.wss,
      wsBase: security.wsBase,
      wssBase: security.wssBase,
      securityProfile: security.profile,
      profileName: security.profileName,
      requireWss: security.requireWss,
      basicConfigured: security.basicConfigured,
    },
    kpis: {
      stations: stations.length,
      online: stations.filter((s) => s.online).length,
      simulated: stations.filter((s) => s.simulated).length,
      enrolledOffline: stations.filter((s) => s.enrolled && !s.online).length,
      liveSessions: live.length,
      endedSessions: ended.length,
      energyKwh: Number(kwh.toFixed(3)),
      sessionRevenue: Number(revenue.toFixed(2)),
      currency: tx.find((t) => t.currency)?.currency || registry.tariffs[0]?.currency || 'EUR',
      evseConnectors: evses.length,
      occupiedConnectors: occupied,
      utilizationPct: evses.length ? Number(((occupied / evses.length) * 100).toFixed(1)) : 0,
      tokens: registry.listTokens().length,
      acceptedTokens: registry.listTokens().filter((t) => t.status === 'Accepted').length,
      tariffs: registry.tariffs.length,
      openReservations: registry.reservations.filter((r) => r.status === 'Active').length,
      firmwareJobs: registry.firmwareJobs.length,
      diagnosticTickets: registry.diagnostics.length,
    },
    stations: stations.map((s) => ({
      stationId: s.stationId,
      online: s.online,
      simulated: !!s.simulated,
      enrolled: !!s.enrolled,
      transport: s.transport,
      vendor: s.identity?.vendorName,
      model: s.identity?.model,
      firmware: s.identity?.firmwareVersion,
      bootAt: s.bootAt,
      heartbeatAt: s.heartbeatAt,
      firmwareStatus: s.firmwareStatus,
      defaultTariffId: s.defaultTariffId,
      wsUrl: s.wsUrl,
      wssUrl: s.wssUrl,
      tenantId: s.tenantId,
      tenantName: s.tenant?.name,
      siteId: s.siteId,
      siteName: s.location?.name,
      city: s.location?.city,
      evses: (s.evses || []).map((e) => ({
        evseId: e.evseId,
        connectorId: e.connectorId,
        status: e.connectorStatus,
      })),
    })),
    sessions: tx.slice(0, 80).map((t) => ({
      transactionId: t.transactionId,
      stationId: t.stationId,
      status: t.status,
      kwh: t.kwh,
      cost: t.cost,
      currency: t.currency,
      tariffId: t.tariffId,
      token: tokenLabel(t.idToken),
      evseId: t.evseId,
      updatedAt: t.updatedAt,
    })),
    tokens: registry.listTokens().map((t) => ({
      idToken: t.idToken,
      type: t.type,
      status: t.status,
    })),
    tariffs: registry.tariffs.map((t) => ({
      tariffId: t.tariffId,
      currency: t.currency,
      energyKwh: t.energyKwh,
      parkingPerHour: t.parkingPerHour,
      description: t.description,
    })),
    reservations: registry.reservations.slice(0, 20),
    firmware: registry.firmwareJobs.slice(0, 15).map((j) => ({
      id: j.id,
      stationId: j.stationId,
      action: j.action,
      status: j.status,
      at: j.at,
    })),
    diagnostics: registry.diagnostics.slice(0, 15).map((d) => ({
      id: d.id,
      stationId: d.stationId,
      kind: d.kind,
      action: d.action,
      at: d.at,
    })),
    recentMessages: registry.messages.slice(0, 20).map((m) => ({
      at: m.at,
      stationId: m.stationId,
      direction: m.direction,
      type: m.type,
      action: m.action,
    })),
    org: {
      tenants: listTenants(registry).map((t) => ({ id: t.id, name: t.name })),
      sites: listSites(registry).map((s) => {
        const cps = stations.filter((st) => st.siteId === s.id);
        const ids = new Set(cps.map((st) => st.stationId));
        const siteTx = tx.filter((t) => ids.has(t.stationId));
        const kwh = siteTx.reduce((n, t) => n + (Number(t.kwh) || 0), 0);
        const revenue = siteTx.reduce((n, t) => n + (Number(t.cost) || 0), 0);
        const live = siteTx.filter((t) => t.status && t.status !== 'Ended').length;
        const online = cps.filter((st) => st.online).length;
        const faulted = cps.filter((st) =>
          (st.evses || []).some((e) => /Fault/i.test(e.connectorStatus || e.status || ''))
        ).length;
        let verdict = 'keep';
        let issue = null;
        if (!cps.length) {
          verdict = 'watch';
          issue = 'no charge points enrolled';
        } else if (!online && kwh === 0) {
          verdict = 'consider_remove';
          issue = 'offline with no billed energy';
        } else if (!online) {
          verdict = 'watch';
          issue = 'all charge points offline';
        } else if (faulted) {
          verdict = 'watch';
          issue = `${faulted} faulted charger(s)`;
        } else if (kwh === 0) {
          verdict = 'watch';
          issue = 'online but no billed kWh';
        }
        return {
          id: s.id,
          name: s.name,
          city: s.city,
          tenantId: s.tenantId,
          cps: cps.length,
          online,
          live,
          kwh: Number(kwh.toFixed(2)),
          revenue: Number(revenue.toFixed(2)),
          verdict,
          issue,
        };
      }),
    },
    ops: opsHints(registry),
    ocpp: {
      actionCount: ALL_ACTIONS.length,
      blocks: BLOCKS,
      csToCsms: CS_TO_CSMS.map((m) => m.action),
      csmsToCs: CSMS_TO_CS.map((m) => m.action),
    },
  };
}

const KNOWLEDGE = `
Helios is the CSMS (central system), OCPP 2.1 only, not OCA-certified. Voltforge is a separate charge-point lab.

Commission:
1. Stations → enroll Charge Point ID (must match the CP, example VF-CP-21)
2. Copy WSS base only (no ID). Local: wss://127.0.0.1:9443/ocpp/2.1  Hosted: wss://YOUR-HOST/ocpp/2.1
3. In Voltforge paste that base, Trust lab TLS locally, subprotocol ocpp2.1
4. Profile 1 = Basic Auth over WSS. Profile 2 = mTLS on local 9443 only (not Render)

Plain local WS: ws://127.0.0.1:9090/ocpp/2.1/{id}
OCPP 2.1 uses TransactionEvent (not 1.6 Start/StopTransaction).
`.trim();

function compactBriefing(briefing) {
  const k = briefing.kpis || {};
  const ops = briefing.ops || {};
  return {
    at: briefing.at,
    product: {
      name: briefing.product?.name,
      role: briefing.product?.role,
      protocol: briefing.product?.protocol,
      wss: briefing.product?.wss,
      wssBase: briefing.product?.wssBase,
      chargePointLab: briefing.product?.chargePointLab,
    },
    kpis: {
      stations: k.stations,
      online: k.online,
      liveSessions: k.liveSessions,
      endedSessions: k.endedSessions,
      energyKwh: k.energyKwh,
      sessionRevenue: k.sessionRevenue,
      currency: k.currency,
    },
    ops: {
      headline: ops.headline,
      reason: ops.reason,
    },
    hint: 'Summary only. Call read_org for names. Do not list the fleet unless they asked what is online, inventory, or a named hub.',
  };
}

/** Rich live org for Ollama. Built from the CSMS at call time — not stored in the model. */
export function livePackFromBriefing(briefing) {
  const liveSessions = (briefing.sessions || []).filter((t) => t.status && t.status !== 'Ended');
  const recentEnded = (briefing.sessions || []).filter((t) => t.status === 'Ended').slice(0, 20);
  const pack = {
    at: briefing.at,
    product: {
      name: briefing.product?.name,
      role: briefing.product?.role,
      protocol: briefing.product?.protocol,
      wss: briefing.product?.wss,
      wssBase: briefing.product?.wssBase,
      chargePointLab: briefing.product?.chargePointLab,
    },
    kpis: briefing.kpis,
    ops: briefing.ops,
    tenants: briefing.org?.tenants || [],
    sites: (briefing.org?.sites || []).map((s) => ({
      name: s.name,
      city: s.city,
      tenantId: s.tenantId,
      cps: s.cps,
      online: s.online,
      live: s.live,
      kwh: s.kwh,
      revenue: s.revenue,
      verdict: s.verdict,
      issue: s.issue,
    })),
    stations: (briefing.stations || []).map((s) => ({
      stationId: s.stationId,
      online: s.online,
      simulated: !!s.simulated,
      enrolled: !!s.enrolled,
      siteName: s.siteName,
      city: s.city,
      tenantName: s.tenantName,
      transport: s.transport,
      firmwareStatus: s.firmwareStatus,
      defaultTariffId: s.defaultTariffId,
      evses: s.evses || [],
    })),
    liveSessions,
    recentEnded,
    tokens: briefing.tokens || [],
    tariffs: briefing.tariffs || [],
    reservations: briefing.reservations || [],
    recentOcpp: (briefing.recentMessages || []).slice(0, 12),
  };
  if (JSON.stringify(pack).length > 28000) {
    pack.recentEnded = pack.recentEnded.slice(0, 8);
    pack.recentOcpp = [];
    pack.stations = pack.stations.map((s) => ({
      stationId: s.stationId,
      online: s.online,
      simulated: s.simulated,
      enrolled: s.enrolled,
      siteName: s.siteName,
      city: s.city,
      tenantName: s.tenantName,
      transport: s.transport,
      firmwareStatus: s.firmwareStatus,
      defaultTariffId: s.defaultTariffId,
      evseCount: (s.evses || []).length,
    }));
  }
  return pack;
}

function briefingForLlm(briefing, fullLive) {
  return fullLive ? livePackFromBriefing(briefing) : compactBriefing(briefing);
}

function useFullLive(question, enabled) {
  if (!enabled) return false;
  if (isSmallTalk(question)) return false;
  if (isGeneralQuestion(question) && !isKeepRemoveQuestion(question) && !isInsightsQuestion(question)) return false;
  return true;
}

export function livePackSummary(briefing) {
  const k = briefing.kpis || {};
  const sites = briefing.org?.sites || [];
  return {
    at: briefing.at,
    tenants: (briefing.org?.tenants || []).length,
    hubs: sites.length,
    stations: k.stations || 0,
    online: k.online || 0,
    liveSessions: k.liveSessions || 0,
    endedSessions: k.endedSessions || 0,
    tokens: k.tokens || 0,
    watchHubs: sites.filter((s) => s.verdict && s.verdict !== 'keep').length,
  };
}

export function formatLivePackNote(briefing) {
  const k = briefing.kpis || {};
  const cur = k.currency || 'EUR';
  const sites = briefing.org?.sites || [];
  const watch = [...sites]
    .filter((s) => s.verdict && s.verdict !== 'keep')
    .sort((a, b) => Number(a.revenue || 0) - Number(b.revenue || 0))
    .slice(0, 8);
  const live = (briefing.sessions || []).filter((t) => t.status && t.status !== 'Ended').slice(0, 8);
  const when = briefing.at ? new Date(briefing.at).toLocaleString() : 'now';
  const lines = [
    '## Live CMS packed for this chat',
    '',
    `Pulled **${when}** from this CSMS. Ollama does not keep the fleet in weights — this snapshot is injected into **this thread**, and every later question pulls a **fresh** copy.`,
    '',
    mdTable(
      ['Metric', 'Now'],
      [
        ['Tenants', (briefing.org?.tenants || []).length],
        ['Hubs', sites.length],
        ['Charge points', `${k.online || 0} online / ${k.stations || 0}`],
        ['Live sessions', k.liveSessions || 0],
        ['Ended sessions', k.endedSessions || 0],
        ['Energy', `${k.energyKwh || 0} kWh`],
        ['Session revenue', `${cur} ${Number(k.sessionRevenue || 0).toFixed(2)}`],
        ['Tokens', k.tokens || 0],
      ]
    ),
  ];
  if (watch.length) {
    lines.push('', '### Hubs that need a look', '');
    lines.push(
      mdTable(
        ['Hub', 'City', 'Online CPs', 'Verdict', 'Issue'],
        watch.map((s) => [s.name, s.city || '—', `${s.online}/${s.cps}`, s.verdict, s.issue || '—'])
      )
    );
  }
  if (live.length) {
    lines.push('', '### Live sessions', '');
    lines.push(
      mdTable(
        ['Station', 'kWh', 'Status'],
        live.map((t) => [t.stationId, t.kwh ?? '—', t.status])
      )
    );
  }
  lines.push('', 'Ask a question in this chat. I will use the live org, not a stale dump.');
  return lines.filter((x) => x != null).join('\n');
}

export function feedLiveContext(registry) {
  const briefing = buildBriefing(registry);
  return {
    answer: formatLivePackNote(briefing),
    summary: livePackSummary(briefing),
    at: briefing.at,
    kpis: briefing.kpis,
  };
}

function isSmallTalk(question) {
  const q = String(question || '').trim().toLowerCase();
  return /^(hi|hello|hey|yo|hiya|sup|thanks|thank you|ok|okay|cool|great|got it|who are you|what can you do|what can you|help|help me|capabilities)[\s!?.]*$/i.test(
    q
  );
}

function smallTalkAnswer() {
  return `Hi — I’m **Helios**, the operator copilot for this OCPP 2.1 lab CSMS.

I already use the **live CMS** — no API key needed for operator work.

- **Ask** — named charge points and hubs, what is online, keep vs remove, WSS pairing, RFID/tariffs, Demand, Site planner, Approve how-tos.
- **Agent** — create a tenant, station, charge point, RFID token, or simulated charger. I’ll ask if a name is missing.
- **Approve** — live OCPP (Reset, firmware, stop session) still waits on Dashboard.

A cloud key or local Ollama is only for jokes, poems, and off-topic write-ups. What do you want to look at?`;
}

function loopLive(question, briefing, { fullLive = false } = {}) {
  if (isGeneralQuestion(question) && !isKeepRemoveQuestion(question) && !isInsightsQuestion(question)) {
    return {
      note: 'General-knowledge question. Answer only that topic. Do not mention this CSMS, hubs, stations, or KPIs.',
    };
  }
  if (fullLive) return livePackFromBriefing(briefing);
  const slim = compactBriefing(briefing);
  const q = String(question || '').toLowerCase();
  if (
    isInsightsQuestion(question) ||
    isKeepRemoveQuestion(question) ||
    /\b(restart|revenue|what is online|inventory|outage)\b/.test(q)
  ) {
    slim.org = {
      sites: (briefing.org?.sites || []).map((s) => ({
        name: s.name,
        city: s.city,
        tenantId: s.tenantId,
        cps: s.cps,
        online: s.online,
        kwh: s.kwh,
        revenue: s.revenue,
        verdict: s.verdict,
        issue: s.issue,
      })),
    };
    slim.ops = briefing.ops;
  }
  return slim;
}

function systemPrompt(briefing, executed = [], mode = 'agent', recap = false, { fullLive = false } = {}) {
  const done = executed.length
    ? `\nAlready applied this turn (do not repeat these tools):\n${JSON.stringify(
        executed.map((e) => ({ tool: e.tool, ok: e.ok, summary: e.summary }))
      )}\n`
    : '';
  let modeBlock;
  if (recap && (mode === 'agent' || mode === 'multitask')) {
    modeBlock = executed.length
      ? `Recap only. Jobs already ran. Write a short friendly summary: what landed, where to see it (Stations / Dashboard), and WSS commission if a charge point was enrolled. Do not emit TOOLS. Do not invent extra work. Live OCPP still needs Approve.`
      : `Answer only — do not call tools and do not change the CMS.
Write business insights for the operator: (1) one headline from ops.headline / KPIs, (2) 5–8 hub bullets using org.sites (name the site, verdict, issue), (3) a 7-day plan (restart worst offline CPs, set missing default tariffs, decide keep vs watch). No JSON dump.`;
  } else if (mode === 'agent' || mode === 'multitask') {
    modeBlock = `${mode === 'multitask' ? 'Multitask mode is ON — split compound asks into several CMS jobs.' : 'Agent mode is ON.'} You can mutate this lab CMS.
If jobs already ran, write a short friendly recap: what landed, where to see it (Stations / Dashboard), and WSS commission if a charge point was enrolled. Do not call the same tools again.
If nothing ran and they want a change, call tools. If a tenant, station, name, or id is missing, ask — never guess a tenant or station.
Live OCPP (Reset, firmware, stop session, ChangeAvailability) still needs Approve — never claim it already ran.\n\n${AGENT_TOOL_GUIDE}`;
  } else if (mode === 'plan') {
    modeBlock = `Plan mode is ON. Do not emit TOOLS and do not claim the CMS changed. Return a numbered plan in plain language. Tell them to switch to Agent to run it.`;
  } else {
    modeBlock = `Ask mode is ON. You only answer — you never change the CMS.
CMS questions: lead with the answer in 1–2 sentences, then 2–4 evidence bullets from the live briefing, then one next step.
If they ask for business insights or a network summary: headline, then hub verdicts from org.sites (name + issue), then a 7-day plan. Do not tell them to pick a sharper ask.
Everyday questions (weather, news, math, travel, CS, greetings): answer them directly. Do not mention hubs, KPIs, or what is online unless they asked.
If they only said hi / hello / thanks: greet in 2–4 sentences. No tables.
If they want something created or changed, tell them to switch to **Agent** (and what you would need: tenant, station, name).
Do not dump raw JSON or a station inventory as the whole reply.`;
  }
  return `You are Helios, the operator copilot inside Helios CSMS, an OCPP 2.1 Charging Station Management System.

Never output a thinking process, scratchpad, chain-of-thought, or analysis of these instructions. Reply only with the operator-facing answer. Never quote LOCAL CMS NOTES or mention the live briefing.

${REPLY_FORMAT}

For CMS facts, use ONLY the live briefing numbers. Do not invent stations, sessions, street demand, or revenue.

${modeBlock}

Keep vs remove: use org.sites verdicts (keep / watch / consider_remove) plus briefing sessions / online CPs. Name the hub and the issue. Do not invent street demand.
General knowledge (weather, Dijkstra, BFS, TLS): answer directly; do not pivot to CMS KPIs.

This product is a lab CSMS, not OCA-certified.

How the lab works:
${KNOWLEDGE}

${done}
LIVE BRIEFING:
${JSON.stringify(briefingForLlm(briefing, fullLive))}`;
}

function has(q, ...words) {
  return words.some((w) => q.includes(w));
}

function money(n, currency = 'EUR') {
  const v = Number(n);
  if (!Number.isFinite(v)) return '—';
  return `${currency} ${v.toFixed(2)}`;
}

function isInsightsQuestion(question) {
  const q = String(question || '').toLowerCase();
  return /\b(insights?|sugg?est\w*|advice|recommend\w*|bussiness|business|summar(y|ise|ize)|what'?s wrong|next (7-?day )?plan|what (to|should we|should i) do next|next steps?|action items?|decisions?|scorecard|how is (the )?network|ops review|current situation|situation of|the market|market (situation|overview|status)|how are we doing|state of (the )?(network|business|ops)|overview)\b/.test(
    q
  );
}

function isLiveOpsQuestion(question) {
  const q = String(question || '').toLowerCase();
  return (
    looksLikeCmsQuestion(question) ||
    isInsightsQuestion(q) ||
    isKeepRemoveQuestion(q) ||
    /why did revenue|revenue drop|lost revenue|income drop|what is online|who should we restart|who is offline/.test(q)
  );
}

function insightsAnswer(briefing) {
  const k = briefing.kpis;
  const cur = k.currency;
  const ops = briefing.ops || {};
  const sites = briefing.org?.sites || [];
  const rank = { consider_remove: 0, watch: 1, keep: 2 };
  const worst = [...sites]
    .filter((s) => s.verdict !== 'keep' || s.issue)
    .sort((a, b) => (rank[a.verdict] ?? 9) - (rank[b.verdict] ?? 9) || a.online - b.online)
    .slice(0, 8);
  const keep = sites.filter((s) => s.verdict === 'keep').slice(0, 6);
  const lost = ops.lostRevenue || { total: 0, currency: cur, items: [] };
  const lines = [
    ops.headline
      ? `**${ops.headline}.** ${k.online}/${k.stations} charge points online, **${k.liveSessions} live sessions**, **${k.energyKwh} kWh**, revenue **${money(k.sessionRevenue, cur)}**, utilization **${k.utilizationPct}%**.`
      : `Live: **${k.online}/${k.stations} online**, **${k.liveSessions} live**, **${money(k.sessionRevenue, cur)}** session revenue, utilization **${k.utilizationPct}%**.`,
  ];
  if (ops.reason) lines.push(ops.reason);
  if (lost.items?.length) {
    lines.push(
      `## Lab outage estimate\n\n**${money(lost.total, lost.currency)}** is a *modelled* gap (hours offline × network kWh rate / CP count). It is not an invoice.\n\n` +
        mdTable(
          ['Charge point', 'Hours', 'Loss'],
          lost.items.slice(0, 8).map((i) => [i.stationId, `${i.hours}h`, money(i.loss, i.currency)])
        )
    );
  }
  if (worst.length) {
    lines.push(
      '## What is wrong\n\n' +
        mdTable(
          ['Hub', 'City', 'Verdict', 'Online', 'kWh', 'Revenue', 'Issue'],
          worst.map((s) => [
            s.name,
            s.city || '—',
            String(s.verdict).replaceAll('_', ' '),
            `${s.online}/${s.cps}`,
            s.kwh,
            money(s.revenue, cur),
            s.issue || '—',
          ])
        )
    );
  }
  if (keep.length) {
    lines.push(
      '## Keep\n\n' +
        mdTable(
          ['Hub', 'Online', 'kWh', 'Revenue'],
          keep.map((s) => [s.name, `${s.online}/${s.cps}`, s.kwh, money(s.revenue, cur)])
        )
    );
  }
  const plan = [];
  const offlineIds = ops.outages || [];
  if (k.enrolledOffline) {
    plan.push(`Restart / commission **${k.enrolledOffline}** offline charge points (Approve Reset).`);
  }
  if (offlineIds.length) {
    plan.push(`Start with ${offlineIds.slice(0, 4).join(', ')}.`);
  }
  const noTariffWatch = sites.filter((s) => s.online && s.verdict === 'watch' && /kWh/i.test(s.issue || ''));
  plan.push('Push SetDefaultTariff on online CPs that still have none so ended sessions get totalCost.');
  if (noTariffWatch.length || worst.some((s) => s.verdict === 'watch' && /kWh/i.test(s.issue || ''))) {
    const names = worst.filter((s) => /kWh/i.test(s.issue || '')).map((s) => s.name);
    if (names.length) plan.push(`Test-start a token at ${names.slice(0, 3).join(', ')} before any close talk.`);
  }
  if (keep.length) {
    plan.push(`Keep ${keep.slice(0, 4).map((s) => s.name).join(', ')} staffed — they still bill.`);
  }
  lines.push('## Next 7 days\n\n' + plan.map((p, i) => `${i + 1}. ${p}`).join('\n'));
  lines.push('Live OCPP still needs **Approve**. Switch to **Plan** if you want this as a job list.');
  return lines.join('\n\n');
}

function localAnswer(question, briefing, registry) {
  const q = question.toLowerCase();
  const k = briefing.kpis;
  const cur = k.currency;
  const lines = [];
  const nav = parseNavIntent(question);
  if (nav) {
    return `Opening **${nav.label}**.`;
  }

  if (isInsightsQuestion(question)) {
    return insightsAnswer(briefing);
  }
  if (isGeneralQuestion(question) && !isKeepRemoveQuestion(question) && !looksLikeCmsQuestion(question)) {
    return generalAnswer(question, {
      hasLlm: llmAccess().ok,
    });
  }
  if (isKeepRemoveQuestion(question) && registry) {
    return keepRemoveAnswer(registry, question);
  }

  const ops = localOpsAnswer(question, briefing, registry);
  if (ops) return ops;

  const header = () => {
    lines.push(
      `Live CMS (${new Date(briefing.at).toLocaleString()}): **${k.online}/${k.stations} stations online**, **${k.liveSessions} live sessions**, **${k.energyKwh} kWh** billed, revenue **${money(k.sessionRevenue, cur)}**, EVSE utilization **${k.utilizationPct}%**. Security profile **${briefing.product.securityProfile}** (${briefing.product.profileName}).`
    );
  };

  if (/^(hi|hello|hey|yo)\b/.test(q) || has(q, 'who are you', 'what can you')) {
    return smallTalkAnswer();
  }

  if (has(q, 'wss', 'websocket', 'tls', 'certificate', 'profile 1', 'profile 2', 'mtls', 'basic auth', 'commission', 'connect a charge')) {
    header();
    const sample = briefing.stations[0];
    lines.push('**Real (encrypted) path is WSS**, not plain WS.');
    lines.push(
      [
        `- WSS template: \`${briefing.product.wss}\``,
        `- Voltforge WSS base (no ID): \`${briefing.product.wssBase || 'wss://HOST/ocpp/2.1'}\``,
        `- Lab WS template: \`${briefing.product.ws}\``,
        `- Profile ${briefing.product.securityProfile}: ${briefing.product.profileName}. Require WSS: ${briefing.product.requireWss ? 'yes' : 'no'}.`,
        '- Paste only the base into Voltforge. The charge point ID is appended by the lab.',
        '- Local lab: Trust lab TLS for the self-signed cert on port 9443. Hosted deploy uses the site HTTPS URL (no 9443).',
        '- This app is the CSMS. Voltforge is a separate charge-point lab.',
        sample?.wssUrl ? `- Example enrolled URL: \`${sample.wssUrl}\`` : '- Enroll a station ID on Stations to get a copyable URL.',
      ].join('\n')
    );
    return lines.join('\n\n');
  }

  if (has(q, 'boot', 'heartbeat', 'ocpp', 'transactionevent', 'catalog', 'callresult', 'subprotocol', 'notimplemented', '1.6')) {
    header();
    lines.push(
      '**OCPP 2.1 on this CSMS:** subprotocol `ocpp2.1`. Frames CALL/CALLRESULT/CALLERROR/CALLRESULTERROR/SEND. One outstanding CALL per direction.'
    );
    lines.push(
      [
        `- Catalog: ${briefing.ocpp.actionCount} unique actions across ${briefing.ocpp.blocks.length} blocks.`,
        '- Charge point → CSMS examples: BootNotification, Heartbeat, StatusNotification, Authorize, TransactionEvent.',
        '- CSMS → charge point examples: RequestStartTransaction, SetChargingProfile, UpdateFirmware, SetDefaultTariff.',
        '- Do not send OCPP 1.6 StartTransaction / RemoteStartTransaction; they return NotImplemented.',
        '- BootNotification needs chargingStation.model, chargingStation.vendorName, and reason.',
      ].join('\n')
    );
    const recent = briefing.recentMessages.slice(0, 8);
    if (recent.length) {
      lines.push(
        '**Latest protocol traffic:**\n' +
          recent.map((m) => `- ${m.action || m.type} · ${m.direction} · ${m.stationId || '—'}`).join('\n')
      );
    }
    return lines.join('\n\n');
  }

  if (has(q, 'revenue drop', 'why did revenue', 'lost revenue', 'income drop')) {
    header();
    const ops = briefing.ops || {};
    const lost = ops.lostRevenue || { total: 0, currency: cur, items: [] };
    const delta = ops.delta || {};
    const offline = briefing.stations.filter((s) => !s.online);
    if (Number(delta.revenuePct) <= -5) {
      lines.push(`**${ops.headline}.** That % is vs the last *captured* KPI window in this lab, not vs last month’s invoices.`);
    } else {
      lines.push(ops.headline || 'No outage headline yet.');
    }
    lines.push(
      `On the book right now: **${k.online}/${k.stations} charge points online**, **${k.liveSessions} live sessions**, billed **${k.energyKwh} kWh**, session revenue **${money(k.sessionRevenue, cur)}**.`
    );
    if (offline.length) {
      lines.push(`**${offline.length} charge point(s) are offline.** That is the main yield gap in this lab — they cannot bill until they reconnect on WS/WSS.`);
    }
    if (lost.items?.length) {
      const top = [...lost.items].sort((a, b) => b.loss - a.loss).slice(0, 8);
      const rest = Math.max(0, lost.items.length - top.length);
      lines.push(
        `## Lab outage estimate\n\n**${money(lost.total, lost.currency)}** is a *modelled* gap (hours offline × network kWh rate / CP count). It is not an invoice.\n\n` +
          mdTable(
            ['Charge point', 'Hours offline', 'Modelled loss'],
            top.map((i) => [i.stationId, `${i.hours}h`, money(i.loss, i.currency)])
          ) +
          (rest ? `\n\n${rest} more offline CP(s) are in the same estimate, not listed.` : '')
      );
    } else {
      lines.push(`No current outage estimate. Session revenue on the book is **${money(k.sessionRevenue, cur)}**.`);
    }
    lines.push(
      'Reset is **not sent** from Ask. If a Reset is attached below, Approve only queues it — an **offline** charge point cannot receive OCPP until it comes back on WSS.'
    );
    return lines.join('\n\n');
  }

  if (has(q, 'who should we restart', 'restart', 'reset', 'bring back')) {
    header();
    const offline = briefing.stations.filter((s) => !s.online);
    if (!offline.length) {
      lines.push('Every enrolled station is online. No Reset proposed.');
      return lines.join('\n\n');
    }
    lines.push(
      '## Restart candidates (offline)\n\n' +
        mdTable(
          ['Charge point', 'Model', 'Last heartbeat'],
          offline.map((s) => [s.stationId, s.model || s.vendor || '—', s.heartbeatAt || 'none'])
        )
    );
    lines.push('Approve a Reset (Immediate) on the attached actions. This CSMS will not send OCPP until you approve.');
    return lines.join('\n\n');
  }

  if (has(q, 'lost session', 'failed session', 'zero session', 'any lost')) {
    header();
    const zero = briefing.sessions.filter((t) => t.status === 'Ended' && !(Number(t.kwh) > 0));
    const liveStuck = briefing.sessions.filter((t) => t.status && t.status !== 'Ended');
    if (!zero.length && !liveStuck.length && !briefing.kpis.enrolledOffline) {
      lines.push('No zero-kWh ended sessions and no live sessions to stop.');
      return lines.join('\n\n');
    }
    if (zero.length) {
      lines.push(
        `**${zero.length} ended session(s) with 0 kWh:**\n` +
          zero
            .slice(0, 10)
            .map((t) => `- ${t.transactionId} · ${t.stationId} · ${t.token || '—'}`)
            .join('\n')
      );
    }
    if (liveStuck.length) {
      lines.push(
        `Live sessions you can stop after approval:\n` +
          liveStuck.map((t) => `- ${t.transactionId} · ${t.stationId} · ${t.kwh || 0} kWh`).join('\n')
      );
    }
    return lines.join('\n\n');
  }

  if (!isHowToQuestion(question) && has(q, 'station', 'online', 'inventory', 'charger', 'evse', 'offline', 'who is')) {
    header();
    if (!briefing.stations.length) {
      lines.push('No stations yet. Enroll an ID on Stations or wait for a charge point to connect.');
      return lines.join('\n\n');
    }
    lines.push(
      '## Charge points\n\n' +
        mdTable(
          ['Charge point', 'Status', 'Kind', 'Vendor / model', 'EVSE'],
          briefing.stations.map((s) => {
            const ev = (s.evses || []).map((e) => `EVSE ${e.evseId}/C${e.connectorId} ${e.status}`).join(', ') || '—';
            return [
              s.stationId,
              s.online ? 'online' : 'offline',
              [s.simulated ? 'simulated' : null, s.enrolled ? 'enrolled' : null, s.transport].filter(Boolean).join(', ') || '—',
              `${s.vendor || ''} ${s.model || ''}`.trim() || '—',
              ev,
            ];
          })
        )
    );
    return lines.join('\n\n');
  }

  if (has(q, 'session', 'transaction', 'revenue', 'kwh', 'energy', 'cost', 'income', 'sales', 'live session')) {
    header();
    if (!briefing.sessions.length) {
      lines.push('No TransactionEvent sessions yet. Start a charge from Voltforge or Stations → RequestStart.');
      return lines.join('\n\n');
    }
    lines.push(
      `Energy **${k.energyKwh} kWh**, session revenue **${money(k.sessionRevenue, cur)}** (${k.liveSessions} live / ${k.endedSessions} ended).`
    );
    lines.push(
      mdTable(
        ['Session', 'Charge point', 'Status', 'kWh', 'Cost', 'Token'],
        briefing.sessions.slice(0, 12).map((t) => [
          t.transactionId,
          t.stationId,
          t.status,
          t.kwh || 0,
          money(t.cost, t.currency || cur),
          t.token || '—',
        ])
      )
    );
    return lines.join('\n\n');
  }

  if (has(q, 'tariff', 'price', '€', 'eur', 'inr', 'peak', 'margin', 'rate')) {
    header();
    lines.push(
      briefing.tariffs.length
        ? mdTable(
            ['Tariff', 'Energy', 'Parking', 'Notes'],
            briefing.tariffs.map((t) => [
              t.tariffId,
              `${t.currency} ${t.energyKwh}/kWh`,
              t.parkingPerHour ? `${t.parkingPerHour}/h` : '—',
              t.description || '—',
            ])
          )
        : 'No tariffs in the book.'
    );
    const withTariff = briefing.stations.filter((s) => s.defaultTariffId);
    if (withTariff.length) {
      lines.push(
        'Station default tariffs:\n' +
          withTariff.map((s) => `- ${s.stationId}: ${s.defaultTariffId}`).join('\n')
      );
    } else {
      lines.push(
        'No station has SetDefaultTariff yet. Push MASSIVE-AC-DEFAULT (or peak/DC) from Tariffs & Cost so Ended sessions get totalCost.'
      );
    }
    if (k.energyKwh > 0) {
      const avg = k.sessionRevenue / k.energyKwh;
      lines.push(`Implied average yield: **${money(avg, cur)} per kWh** from recorded sessions.`);
    }
    return lines.join('\n\n');
  }

  if (has(q, 'token', 'rfid', 'author', 'id tag', 'local list', 'emaid')) {
    header();
    lines.push(
      briefing.tokens.length
        ? mdTable(
            ['Token', 'Type', 'Status'],
            briefing.tokens.map((t) => [t.idToken, t.type, t.status])
          )
        : 'No tokens.'
    );
    lines.push('Authorize uses this store. SendLocalList / ClearCache on Authorization push the list to the charge point.');
    return lines.join('\n\n');
  }

  if (has(q, 'firmware', 'updatefirmware', 'log job')) {
    header();
    if (!briefing.firmware.length) {
      lines.push('No firmware or GetLog jobs yet. Use Firmware & Logs, or Approve the attached UpdateFirmware proposal.');
    } else {
      lines.push(
        briefing.firmware.map((j) => `- ${j.action} · ${j.stationId} · ${j.status}`).join('\n')
      );
    }
    return lines.join('\n\n');
  }

  if (has(q, 'diagnos', 'ticket', 'monitor', 'customer info', 'notifyevent')) {
    header();
    if (!briefing.diagnostics.length) {
      lines.push('No diagnostic tickets yet (NotifyReport / NotifyEvent / monitoring / customer info).');
    } else {
      lines.push(
        briefing.diagnostics.map((d) => `- ${d.kind} · ${d.action} · ${d.stationId}`).join('\n')
      );
    }
    return lines.join('\n\n');
  }

  if (has(q, 'reserv', 'display', 'message on screen')) {
    header();
    lines.push(
      briefing.reservations.length
        ? briefing.reservations.map((r) => `- #${r.id} ${r.stationId} EVSE ${r.evseId} · ${r.status} · expiry ${r.expiryDateTime}`).join('\n')
        : 'No reservations. Create one on Display & Reservations.'
    );
    return lines.join('\n\n');
  }

  if (has(q, 'smart charg', 'profile', 'schedule', 'der', 'v2x', 'battery')) {
    header();
    lines.push(
      'Smart charging profiles are stored per station when you send SetChargingProfile. GetChargingProfiles / GetCompositeSchedule read that store. DER, AFRR, and battery swap are operator send + event log on this lab CSMS (no live grid market).'
    );
    return lines.join('\n\n');
  }

  if (has(q, 'business', 'utiliz', 'kpi', 'roi', 'grow', 'occupancy', 'fleet', 'operator', 'manage', 'recommend')) {
    header();
    const ops = briefing.ops || {};
    const lost = ops.lostRevenue || { total: 0, currency: cur };
    lines.push(
      [
        `- Utilization: **${k.utilizationPct}%** of ${k.evseConnectors} connectors occupied.`,
        `- Throughput: **${k.energyKwh} kWh** · revenue **${money(k.sessionRevenue, cur)}**.`,
        `- Network: ${k.online} live / ${k.simulated} simulated / ${k.enrolledOffline} enrolled but not connected.`,
        `- Estimated outage loss: **${money(lost.total, lost.currency)}**.`,
        `- Auth: ${k.acceptedTokens}/${k.tokens} tokens Accepted.`,
      ].join('\n')
    );
    if (ops.headline) lines.push(ops.headline);
    const recs = [];
    if (k.enrolledOffline) recs.push('Commission enrolled IDs onto WSS so they boot and become billable.');
    if (!k.liveSessions && k.online) recs.push('Online stations with no live session — remote start a test token to validate the payment path.');
    if (k.utilizationPct < 20 && k.evseConnectors) recs.push('Utilization is low. Check site hours, tariff vs nearby AC, and whether RequestStart is allowed.');
    const peak = briefing.tariffs.find((t) => /peak/i.test(t.tariffId) || t.energyKwh >= 0.5);
    if (peak) recs.push(`Peak tariff ${peak.tariffId} at ${peak.currency} ${peak.energyKwh}/kWh can be pushed with SetDefaultTariff / ChangeTransactionTariff.`);
    if (recs.length) lines.push('**Recommendations:**\n' + recs.map((r) => `- ${r}`).join('\n'));
    return lines.join('\n\n');
  }

  return cmsFallback(question, briefing);
}

function isLocalMiss(text) {
  return /I didn’t understand “/i.test(String(text || '')) || /I did not match a tighter playbook/i.test(String(text || ''));
}

/** True when this turn would call the LLM as the answerer (not a live-CMS rewrite). */
function turnNeedsLlmApi({ question, local, nav, job, executed, mode }) {
  if (nav) return false;
  if (wantsMutation(question)) return false;
  if (job?.divert || job?.needsInput) return false;
  if ((executed || []).some((e) => e.ok)) return false;
  if (job?.calls?.length && (mode === 'agent' || mode === 'multitask')) return false;
  if (isSmallTalk(question) || isInsightsQuestion(question) || isKeepRemoveQuestion(question)) return false;
  if (looksLikeCmsQuestion(question) || isLiveOpsQuestion(question)) return false;
  if (hasKnownGeneralAnswer(question)) return false;
  if (isLlmPrimaryQuestion(question)) return true;
  if (isLocalMiss(local) && !looksLikeCmsQuestion(question) && !wantsMutation(question)) return true;
  return false;
}

function blockedLlmResult(registry, _question, resolved, canMutate, access) {
  const briefing = buildBriefing(registry);
  return {
    answer: llmKeyNeededReply(access),
    source: 'local',
    model: 'live-cms-analyst',
    mode: resolved,
    agentMode: canMutate,
    plan: [],
    kpis: briefing.kpis,
    ops: briefing.ops,
    executedActions: [],
    proposedActions: [],
    needsInput: false,
    pending: null,
    pendingJob: null,
    suggestions: [
      'What is online right now?',
      'How do I add RFID?',
      'How do I connect a charge point on WSS?',
      'Should we keep Whitefield Hub?',
    ],
    at: briefing.at,
    needsLlmKey: true,
  };
}

function claudeMessages(history, question) {
  const msgs = [];
  const push = (role, content) => {
    const text = String(content || '').trim();
    if (!text || (role !== 'user' && role !== 'assistant')) return;
    if (msgs.length && msgs[msgs.length - 1].role === role) {
      msgs[msgs.length - 1].content += `\n\n${text}`;
    } else {
      msgs.push({ role, content: text });
    }
  };
  for (const m of history || []) push(m.role, m.content);
  push('user', question);
  if (msgs[0]?.role === 'assistant') msgs.unshift({ role: 'user', content: '(operator context)' });
  if (!msgs.length) msgs.push({ role: 'user', content: question });
  return msgs;
}

function llmError(data, status) {
  const err = data?.error;
  if (!err) return `LLM HTTP ${status}`;
  if (typeof err === 'string') return err;
  return err.message || JSON.stringify(err);
}

async function llmAnswer(question, history, briefing, executed = [], mode = 'agent', opts = {}) {
  const access = llmAccess();
  if (!access.ok) return null;
  const rt = llmRuntime();
  if (!rt.llm) return null;
  const mismatch = rt.local ? '' : keyMismatchHint(rt.provider, rt.key);
  if (mismatch) throw new Error(mismatch);
  const recap = !!opts.recap;
  const fullLive = !!opts.fullLive;
  const signal = opts.signal;
  throwIfAborted(signal);
  const prior = (history || [])
    .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && m.content)
    .slice(-8)
    .map((m) => ({ role: m.role, content: String(m.content).slice(0, 2500) }));
  const mutate = !recap && (mode === 'agent' || mode === 'multitask');
  const temperature = recap ? 0.25 : mutate ? 0.2 : mode === 'plan' ? 0.25 : 0.35;
  const max_tokens = recap ? 900 : mode === 'ask' ? 900 : 800;
  const recapHint = recap
    ? '\n\nWrite the operator-facing answer only. Do not call tools. Do not invent extra CMS changes. Do not write a thinking process.'
    : '';
  const notes = opts.localNotes
    ? `\n\nLOCAL CMS NOTES (use as evidence; rewrite in plain language; do not invent numbers or street demand):\n${String(opts.localNotes).slice(0, fullLive ? 8000 : 5000)}`
    : '';
  const userContent = `${question}${recapHint}${notes}`;
  const prompt = systemPrompt(briefing, executed, mode, recap, { fullLive });

  let res;
  if (isClaudeRuntime(rt)) {
    const body = {
      model: rt.model,
      max_tokens,
      temperature,
      system: prompt,
      messages: claudeMessages(prior, userContent),
    };
    if (mutate) body.tools = claudeToolDefs();
    const headers = {
      'x-api-key': rt.key,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
    };
    res = await fetch(`${rt.baseUrl}/messages`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = llmError(data, res.status);
      if (res.status === 401 || res.status === 403) markLlmUnauthorized(msg);
      throw new Error(msg);
    }
    const text = stripThinking(
      (data.content || [])
        .filter((b) => b && b.type === 'text' && b.text)
        .map((b) => b.text)
        .join('\n')
        .trim()
    );
    const tools = toolsFromClaudeContent(data.content);
    return { text, tools };
  }

  const body = {
    model: rt.model,
    temperature,
    max_tokens,
    messages: [
      { role: 'system', content: prompt },
      ...prior,
      { role: 'user', content: userContent },
    ],
  };
  if (mutate) {
    body.tools = openaiToolDefs();
    body.tool_choice = 'auto';
    if (rt.provider === 'openai') body.parallel_tool_calls = true;
  }
  let data;
  try {
    data = await postOpenAiChat(rt, body, signal);
  } catch (err) {
    if (isAbortError(err) || !mutate || !body.tools) throw err;
    delete body.tools;
    delete body.tool_choice;
    delete body.parallel_tool_calls;
    data = await postOpenAiChat(rt, body, signal);
  }

  const message = data.choices?.[0]?.message || {};
  const text = stripThinking(openAiMessageText(message));
  const tools = toolsFromOpenAiMessage(message);
  return { text, tools, model: data.model || rt.model };
}

function stripThinking(text) {
  return stripLlmReply(text);
}

function openAiMessageText(message) {
  const content = String(message?.content || '').trim();
  if (content) return content;
  return '';
}

function agentFollowup(briefing, executed) {
  const ok = executed.filter((e) => e.ok);
  if (!ok.length) return '';
  const lines = [];
  for (const item of ok) {
    if (item.tool === 'addChargePoint' && item.data?.wssUrl) {
      lines.push(
        `Commission **${item.data.stationId}** in Voltforge with WSS base \`${briefing.product.wssBase || 'wss://HOST/ocpp/2.1'}\` (not the full path). Full URL: \`${item.data.wssUrl}\`.`
      );
    }
    if (item.tool === 'addStation') {
      lines.push('The new station is on **Stations** and the **Digital twin** map.');
    }
    if (item.tool === 'simulateChargePoint') {
      lines.push('The simulated charge point is online in the lab immediately — no WSS commission needed.');
    }
  }
  const k = briefing.kpis;
  lines.push(
    `Live now: **${k.online}/${k.stations} charge points online**, **${k.tokens} tokens**, **${k.tariffs} tariffs**. Live OCPP (Reset, firmware, stop session) still needs **Approve**.`
  );
  return lines.join('\n\n');
}

function publicExecuted(executed) {
  return executed.map((e) => {
    const d = e.data || {};
    return {
      tool: e.tool,
      ok: e.ok,
      summary: e.summary,
      error: e.error || null,
      stationId: d.stationId || null,
      siteId: e.tool === 'addStation' ? d.id || null : d.siteId || null,
      tenantId: e.tool === 'addTenant' ? d.id || null : d.tenantId || null,
      name: d.name || null,
      idToken: d.idToken || null,
      tariffId: d.tariffId || null,
      wssUrl: d.wssUrl || null,
    };
  });
}

function followUpSuggestions({ mode, question, executed, plan }) {
  const q = String(question || '').toLowerCase();
  if (parseNavIntent(question)) return [];
  if (isSmallTalk(question)) {
    return ['What is online right now?', 'How do I add RFID?', 'How do I connect a charge point on WSS?'];
  }
  const ok = (executed || []).filter((e) => e.ok);
  if (isInsightsQuestion(question) || /why did revenue|keep .+ hub|what is online/.test(q)) {
    return ['Why did revenue drop?', 'Should we keep Cyber Hub?', 'Which stations should we restart first?'];
  }
  if (mode === 'ask') {
    if ((plan || []).some((s) => s.tool)) return [];
    if (/keep|remove|close|underperform/.test(q)) {
      return ['Why did revenue drop?', 'What is online right now?'];
    }
    if (/wss|commission|connect a charge|tls|voltforge|pair/.test(q)) {
      return ['What is online right now?', 'How do I add RFID?'];
    }
    if (/rfid|token/.test(q)) {
      return ['How do I connect a charge point on WSS?', 'What is online right now?'];
    }
    if (/demand|forecast|planner|where should we build/.test(q)) {
      return ['Should we keep Whitefield Hub?', 'What is online right now?'];
    }
    return ['What is online right now?', 'How do I add RFID?', 'Should we keep Whitefield Hub?'];
  }
  if (mode === 'agent' || mode === 'multitask') {
    if (ok.some((e) => e.tool === 'addChargePoint')) {
      return ['How do I commission WSS?', 'Add another charge point at the same station', 'Simulate a charger there'];
    }
    if (ok.some((e) => e.tool === 'addStation')) {
      return ['Add a charge point at that station', 'Simulate a charger there', 'What is online right now?'];
    }
    if (ok.some((e) => e.tool === 'addTenant')) {
      return ['Add a station under that tenant', 'Add a charge point next'];
    }
    if (ok.some((e) => e.tool === 'simulateChargePoint')) {
      return ['What is online right now?', 'Add a token RFID-LAB-22'];
    }
    return ['Add a station', 'Add a charge point', 'Simulate a charger at Cyber Hub'];
  }
  return [];
}

function normalizeMode({ mode, agentMode } = {}) {
  const allowed = ['ask', 'plan', 'agent', 'multitask'];
  if (allowed.includes(mode)) return mode;
  if (agentMode === false) return 'ask';
  return 'agent';
}

function opsPlan(briefing) {
  const steps = [];
  const offline = (briefing.stations || []).filter((s) => !s.online);
  if (offline.length) {
    steps.push(`Review ${offline.length} offline charge point(s): ${offline.map((s) => s.stationId).slice(0, 4).join(', ')}.`);
    steps.push('Queue Reset (Immediate) on the worst offender — Approve before OCPP is sent.');
  }
  if (!(briefing.kpis?.stations > 0)) {
    steps.push('Enroll or simulate a charge point on Stations so the CSMS has something to manage.');
  }
  steps.push('Check Demand for each station’s 3-day load window before scheduling maintenance.');
  return steps.map((title, i) => ({ id: `ops-${i + 1}`, step: i + 1, tool: null, args: {}, title }));
}

export async function askAssistant(registry, { question, history, agentMode, mode, tools, actor, pendingJob = null, livePackEnabled = false, signal = null } = {}) {
  const q = String(question || '').trim();
  if (!q) throw new Error('question is required');
  let resolved = normalizeMode({ mode, agentMode });
  // CMS writes (add CP, tenant, RFID, …) always run locally — never wait on an API key.
  // If the operator is still in Ask but has Agent permission, escalate this turn.
  if (
    resolved === 'ask' &&
    wantsMutation(q) &&
    actor &&
    can(actor, 'assistant.agent') &&
    !isLlmPrimaryQuestion(q)
  ) {
    resolved = 'agent';
  }
  if (actor && !can(actor, `assistant.${resolved}`)) {
    const err = new Error(`${actor.name} (${roleLabel(actor.role)}) cannot use ${resolved} mode`);
    err.status = 403;
    throw err;
  }
  const extraTools = Array.isArray(tools) ? tools : [];
  const canMutate = resolved === 'agent' || resolved === 'multitask';
  const agentOpts = { multitask: resolved === 'multitask', actor };
  const fullLive = useFullLive(q, livePackEnabled);
  throwIfAborted(signal);

  if (isInsightsQuestion(q) && !pendingJob) {
    const briefing = buildBriefing(registry);
    let answer = insightsAnswer(briefing);
    if (/\bmarket\b/i.test(q)) {
      answer = `This is the **lab charging network** in this CSMS — not a live stock or electricity-market feed.\n\n${answer}`;
    }
    return {
      answer,
      source: 'local',
      model: assistantStatus().model,
      mode: resolved,
      agentMode: canMutate,
      plan: [],
      kpis: briefing.kpis,
      ops: briefing.ops,
      executedActions: [],
      proposedActions: proposeCopilotActions(registry, q),
      needsInput: false,
      pending: null,
      pendingJob: null,
      suggestions: followUpSuggestions({ mode: resolved, question: q, executed: [], plan: [] }),
      at: briefing.at,
    };
  }

  if (isSmallTalk(q) && !pendingJob) {
    const briefing = buildBriefing(registry);
    return {
      answer: smallTalkAnswer(),
      source: 'local',
      model: assistantStatus().model,
      mode: resolved,
      agentMode: canMutate,
      plan: [],
      kpis: briefing.kpis,
      ops: briefing.ops,
      executedActions: [],
      proposedActions: [],
      needsInput: false,
      pending: null,
      pendingJob: null,
      suggestions: followUpSuggestions({ mode: resolved, question: q, executed: [], plan: [] }),
      at: briefing.at,
    };
  }

  const access = llmAccess();
  if (
    isLlmPrimaryQuestion(q) &&
    !access.ok &&
    !pendingJob &&
    !isLiveOpsQuestion(q) &&
    !looksLikeCmsQuestion(q) &&
    !wantsMutation(q)
  ) {
    return blockedLlmResult(registry, q, resolved, canMutate, access);
  }

  const regexPending = pendingJob?.calls?.length && pendingJob.type !== 'ask_operator';
  // Prefer deterministic local Agent tools for CMS writes (add CP, tenant, RFID…).
  // Do not send those turns through the LLM loop — that wrongly demanded an API key
  // (or hung on Ollama) even though enroll/create is fully local.
  const preferLocalMutate = canMutate && wantsMutation(q);
  const canLoop =
    access.ok &&
    canMutate &&
    !extraTools.length &&
    !regexPending &&
    !preferLocalMutate;

  if (canLoop) {
    if (isCancel(q) && pendingJob) {
      const briefing = buildBriefing(registry);
      return {
        answer: 'Cancelled. Nothing in the CMS was changed. Ask again when you are ready.',
        source: 'local',
        model: assistantStatus().model,
        mode: resolved,
        agentMode: canMutate,
        plan: [],
        kpis: briefing.kpis,
        ops: briefing.ops,
        executedActions: [],
        proposedActions: [],
        needsInput: false,
        pending: null,
        pendingJob: null,
        suggestions: [],
        at: briefing.at,
      };
    }
    try {
      let briefing = buildBriefing(registry);
      const looped = await runCopilotLoop({
        registry,
        question: q,
        history,
        mode: resolved,
        actor,
        pending: pendingJob,
        live: loopLive(q, briefing, { fullLive }),
        signal,
      });
      briefing = buildBriefing(registry);
      if (looped.needsInput) {
        const status = assistantStatus();
        return {
          answer: looped.answer,
          source: looped.source || 'llm',
          model: status.model,
          mode: resolved,
          agentMode: canMutate,
          plan: [],
          kpis: briefing.kpis,
          ops: briefing.ops,
          executedActions: publicExecuted(looped.executed || []),
          proposedActions: [],
          needsInput: true,
          pending: looped.publicPending || null,
          pendingJob: looped.pending,
          navigateTo: looped.navigateTo || null,
          navLabel: looped.navLabel || '',
          suggestions: [],
          at: briefing.at,
        };
      }
      const didWork = (looped.executed || []).some((e) => e.ok);
      const localFallback = didWork
        ? [formatAgentReport(looped.executed), agentFollowup(briefing, looped.executed)].filter(Boolean).join('\n\n')
        : '';
      if (didWork) {
        const picked = pickOperatorReply(looped.answer, localFallback);
        const status = assistantStatus();
        return {
          answer: picked.text,
          source: picked.source,
          model: status.model,
          mode: resolved,
          agentMode: canMutate,
          plan: [],
          kpis: briefing.kpis,
          ops: briefing.ops,
          executedActions: publicExecuted(looped.executed || []),
          proposedActions: [],
          needsInput: false,
          pending: null,
          pendingJob: null,
          navigateTo: looped.navigateTo || null,
          navLabel: looped.navLabel || '',
          suggestions: followUpSuggestions({
            mode: resolved,
            question: q,
            executed: looped.executed || [],
            plan: [],
          }),
          at: briefing.at,
        };
      }
      if (wantsMutation(q) || isUselessReply(looped.answer)) {
        throw new Error('copilot loop did not produce a usable reply');
      }
      const picked = pickOperatorReply(looped.answer, '');
      if (!picked.text) throw new Error('copilot loop did not produce a usable reply');
      const status = assistantStatus();
      return {
        answer: picked.text,
        source: picked.source,
        model: status.model,
        mode: resolved,
        agentMode: canMutate,
        plan: [],
        kpis: briefing.kpis,
        ops: briefing.ops,
        executedActions: [],
        proposedActions: [],
        needsInput: false,
        pending: null,
        pendingJob: null,
        navigateTo: looped.navigateTo || null,
        navLabel: looped.navLabel || '',
        suggestions: followUpSuggestions({
          mode: resolved,
          question: q,
          executed: [],
          plan: [],
        }),
        at: briefing.at,
      };
    } catch (err) {
      if (isAbortError(err)) throw err;
      console.error('[helios copilot loop]', err?.message || err);
    }
  }

  const job = resolveJob(registry, {
    question: q,
    extraTools,
    pending: pendingJob,
    multitask: resolved === 'multitask',
  });

  if (job.cancelled) {
    const briefing = buildBriefing(registry);
    return {
      answer: 'Cancelled. Nothing in the CMS was changed. Ask again when you are ready.',
      source: 'local',
      model: assistantStatus().model,
      mode: resolved,
      agentMode: canMutate,
      plan: [],
      kpis: briefing.kpis,
      ops: briefing.ops,
      executedActions: [],
      proposedActions: [],
      needsInput: false,
      pending: null,
      pendingJob: null,
      suggestions: [],
      at: briefing.at,
    };
  }

  if (job.needsInput) {
    const briefing = buildBriefing(registry);
    const plan = callsToPlan(job.calls || []);
    return {
      answer: job.prompt,
      source: 'local',
      model: assistantStatus().model,
      mode: resolved,
      agentMode: canMutate,
      plan: resolved === 'ask' ? [] : plan,
      kpis: briefing.kpis,
      ops: briefing.ops,
      executedActions: [],
      proposedActions: [],
      needsInput: true,
      pending: job.publicPending,
      pendingJob: job.pending,
      suggestions: [],
      at: briefing.at,
    };
  }

  let plan = resolved === 'ask' ? [] : (job.calls?.length ? callsToPlan(job.calls) : buildPlan(q));
  if (resolved === 'plan') {
    const strategy = strategyPlan(registry, q);
    if (!plan.length) plan = strategy;
    else if (strategy.length && !plan.some((s) => s.tool)) {
      plan = [
        ...plan,
        ...strategy.map((s, i) => ({ ...s, step: plan.length + i + 1, id: `adv-${plan.length + i + 1}` })),
      ];
    }
  }
  if (extraTools.length && !job.calls?.length) {
    plan = extraTools.filter((t) => t && t.tool).map((c, i) => ({
      id: `step-${i + 1}`,
      step: i + 1,
      tool: c.tool,
      args: c.args || {},
      title: c.title || c.tool,
    }));
  }

  let executed = [];
  if (canMutate && job.calls?.length) {
    executed = await runAgent(registry, '', [], { ...agentOpts, presetCalls: job.calls });
  } else if (canMutate && extraTools.length) {
    executed = await runAgent(registry, extraTools.length ? '' : q, extraTools, agentOpts);
  } else if (canMutate && !job.divert) {
    executed = await runAgent(registry, q, extraTools, agentOpts);
  }

  let briefing = buildBriefing(registry);
  const status = assistantStatus();
  let source = 'local';
  let usedModel = status.model;
  let answer = '';
  const nav = parseNavIntent(q);
  const local = localAnswer(q, briefing, registry);
  const mutationPreview = resolved === 'ask' && job.calls?.length ? callsToPlan(job.calls) : [];

  if (nav) {
    answer = `Opening **${nav.label}**.`;
  } else if (job.divert) {
    const wait = job.pending?.slot
      ? `\n\nI still need a detail for the earlier job (${job.pending.slot}). Reply with that, or say **cancel**.`
      : '';
    answer = `${local}${wait}`;
  } else if (resolved === 'plan') {
    if (!plan.length) plan = strategyPlan(registry, q);
    if (!plan.length) plan = opsPlan(briefing);
    answer = formatPlan(plan) || local;
  } else if (resolved === 'ask' && mutationPreview.length) {
    plan = mutationPreview;
    answer =
      'Ask mode will not change the CMS. The jobs I would run are listed below — use Run in Agent when you are ready. Live OCPP still needs Approve.';
  } else if (executed.some((e) => e.ok)) {
    answer = agentFollowup(briefing, executed) || local;
  } else if (canMutate && /(?:\b(add|create|enroll|simulate|move|block|reserve)\b)/i.test(q) && !executed.length) {
    answer =
      'I understood you want the CMS changed, but I still need a clearer job. Try “Add station NAME in CITY”, “Add tenant NAME with a station NAME in CITY and a charge point CP-01”.';
  } else {
    answer = local;
  }

  if (turnNeedsLlmApi({ question: q, local, nav, job, executed, mode: resolved }) && !access.ok) {
    return blockedLlmResult(registry, q, resolved, canMutate, access);
  }

  const recapOnly =
    resolved === 'ask' ||
    resolved === 'plan' ||
    isInsightsQuestion(q) ||
    isKeepRemoveQuestion(q) ||
    ((resolved === 'agent' || resolved === 'multitask') && executed.some((e) => e.ok));
  if (access.ok && !job.divert && !nav && !isOpenRouterLimited()) {
    const skipRewrite =
      (resolved === 'ask' || resolved === 'plan') && !isLlmPrimaryQuestion(q) && !isLocalMiss(local);
    if (!skipRewrite) {
    throwIfAborted(signal);
    try {
      const missed = isLocalMiss(answer) || isLocalMiss(local);
      const localNotes = executed.some((e) => e.ok)
        ? `${formatAgentReport(executed)}\n\n${agentFollowup(briefing, executed)}`
        : missed
          ? 'Answer the operator’s actual wording in Markdown. Do not dump a KPI scorecard unless they asked for status or insights.'
          : answer || local;
      const llm = await llmAnswer(q, history, briefing, executed, resolved, {
        recap: recapOnly,
        localNotes,
        fullLive,
        signal,
      });
      if (llm) {
        const parsed = stripLlmTools(llm.text || '');
        const native = recapOnly ? [] : llm.tools || [];
        const moreTools = recapOnly ? [] : [...native, ...(parsed.tools || [])];
        const llmText = stripLlmReply(parsed.cleaned || llm.text || '');
        const picked = pickOperatorReply(llmText, answer);
        if (picked.text) {
          answer = picked.text;
          source = picked.source;
          if (picked.source === 'llm' && llm.model) usedModel = llm.model;
        }
        if (canMutate && moreTools.length) {
          const more = await runAgent(registry, '', moreTools, agentOpts);
          executed = [...executed, ...more];
          briefing = buildBriefing(registry);
          try {
            const recap = await llmAnswer(q, history, briefing, executed, resolved, {
              recap: true,
              fullLive,
              signal,
              localNotes: `${formatAgentReport(executed)}\n\n${agentFollowup(briefing, executed)}`,
            });
            const recapText = recap ? stripLlmReply(stripLlmTools(recap.text || '').cleaned || recap.text) : '';
            const recapPicked = pickOperatorReply(
              recapText,
              [formatAgentReport(executed), agentFollowup(briefing, executed)].filter(Boolean).join('\n\n') || answer
            );
            if (recapPicked.text) {
              answer = recapPicked.text;
              source = recapPicked.source;
              if (recapPicked.source === 'llm' && recap?.model) usedModel = recap.model;
            }
          } catch (err) {
            if (isAbortError(err)) throw err;
            if (!llmText) answer = agentFollowup(briefing, executed) || local;
          }
        }
      }
    } catch (err) {
      if (isAbortError(err)) throw err;
      const fallback = executed.some((e) => e.ok) ? agentFollowup(briefing, executed) : local;
      if (hasKnownGeneralAnswer(q) && fallback && !isLocalMiss(fallback)) {
        answer = fallback;
      } else {
        answer = `${fallback}\n\n_(${llmFailNote(err)})_`;
      }
      source = 'local-fallback';
    }
    }
  }

  const report = formatAgentReport(executed);
  if (report && resolved !== 'plan' && !job.divert && !nav && source !== 'llm') {
    answer = answer ? `${report}\n\n${answer}` : report;
  }

  const missed = isLocalMiss(answer) || isLocalMiss(local);
  const wantsOcpp =
    /restart|reset|firmware|stop session|stop transaction|revenue drop|lost session|change availability/i.test(q);
  const proposedActions =
    nav || missed || (executed.some((e) => e.ok) && !wantsOcpp) ? [] : proposeCopilotActions(registry, q);

  return {
    answer,
    source,
    model: usedModel,
    mode: resolved,
    agentMode: canMutate,
    plan: nav ? [] : plan,
    kpis: briefing.kpis,
    ops: briefing.ops,
    executedActions: publicExecuted(executed),
    proposedActions,
    needsInput: false,
    pending: null,
    pendingJob: job.divert ? job.pending : null,
    navigateTo: nav?.view || null,
    navLabel: nav?.label || '',
    suggestions: followUpSuggestions({ mode: resolved, question: q, executed, plan }),
    at: briefing.at,
  };
}
