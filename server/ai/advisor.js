/**
 * Local Ask/Plan intelligence: keep-or-remove scoring, strategy plans, and
 * off-CMS explanations so Ask still answers when the paid LLM has no credits.
 */

import { listTenants, listSites } from '../org.js';
import { mdTable } from './replyFormat.js';
import { isOpenRouterLimited } from '../llm.js';
import { looksLikeCmsQuestion } from './localOps.js';

export { looksLikeCmsQuestion };

function money(n, currency = 'EUR') {
  const v = Number(n);
  if (!Number.isFinite(v)) return '—';
  return `${currency} ${v.toFixed(2)}`;
}

export function isGeneralQuestion(question) {
  const q = String(question || '').trim().toLowerCase();
  if (!q) return false;
  if (looksLikeCmsQuestion(question)) return false;
  if (
    /\b(station|tenant|charger|charge point|ocpp|wss|tariff|session|token|rfid|firmware|evse|csms|cms|hub|depot|approve|voltforge|helios)\b/.test(
      q
    )
  ) {
    return false;
  }
  return /^(explain|what is|what's|whats|define|how does|how do|describe|tell me about)\b/.test(q);
}

export function hasKnownGeneralAnswer(question) {
  if (!isGeneralQuestion(question) || isKeepRemoveQuestion(question)) return false;
  const q = String(question || '').toLowerCase();
  return GENERAL.some((g) => g.test.test(q));
}

export function isKeepRemoveQuestion(question) {
  const q = String(question || '').toLowerCase();
  return /\b(remove|close|shut down|decommission|keep or|should we (keep|drop|cut|retire)|divest|underperform|worth keeping)\b/.test(
    q
  );
}

const CMS_MUTATE =
  /\b(tenant|station|charge\s*point|charging\s*point|chargepoint|charger|token|tariff|reservation|hub|depot|cp|evse)\b/i;

/** Off-CMS / generative asks that would call the OpenAI-compatible API as the answerer. */
export function isLlmPrimaryQuestion(question) {
  const q = String(question || '').trim();
  if (!q) return false;
  const t = q.toLowerCase();
  if (looksLikeCmsQuestion(q) || isKeepRemoveQuestion(q) || hasKnownGeneralAnswer(q)) return false;
  if (
    /\b(what is online|what'?s online|who is offline|who should we restart|why did revenue|revenue drop|lost revenue|income drop)\b/.test(
      t
    )
  ) {
    return false;
  }

  const writing =
    /^(write|draft|compose|generate|rewrite|translate|proofread|brainstorm|summarise|summarize)\b/i.test(t) ||
    /\b(write me|draft me|compose me|generate me|make me a)\b/i.test(t);
  if (writing) {
    if (CMS_MUTATE.test(t) && /\b(add|create|enroll|simulate|register|make|new|pair)\b/i.test(t)) return false;
    if (/\b(wss|commission|connect a charge|tls|mtls)\b/.test(t) && !/\b(joke|poem|haiku|lyrics)\b/.test(t)) {
      return false;
    }
    return true;
  }
  if (/\b(joke|poem|haiku|lyrics|recipe|riddle)\b/.test(t)) return true;
  if (
    /\b(weather|temperature outside|news headline)\b/.test(t) &&
    !CMS_MUTATE.test(t) &&
    !looksLikeCmsQuestion(q)
  ) {
    return true;
  }
  if (/\bforecast\b/.test(t) && !/\b(demand|load|charging|hub|station|site|cms)\b/.test(t) && !CMS_MUTATE.test(t)) {
    return true;
  }
  if (isGeneralQuestion(q) && !hasKnownGeneralAnswer(q)) return true;
  return false;
}

export function llmKeyNeededReply(access = {}) {
  const ops =
    'I can still run this CSMS without a model: live status, named hubs and charge points, WSS pairing, RFID/tariffs how-tos, Demand, Site planner, keep vs remove, and Agent writes (tenant, hub, CP, token). A key is only for jokes, poems, and off-topic write-ups.';
  const where =
    'Add a key on this Ask page under **API key**, or set `CMS_LLM_API_KEY` (OpenAI `OPENAI_API_KEY`, Groq, Anthropic, and OpenRouter env vars also work). You can also choose **Ollama (local)** there — no cloud key.';
  const code = access.code || 'no-key';
  if (code === 'unauthorized') {
    return `This question needs the language model, and the saved key was **rejected** (unauthorized). I did not call the API this turn.

Paste a new key on this Ask page under **API key**, or replace \`CMS_LLM_API_KEY\`. Do not paste the old key into chat.

${ops}`;
  }
  if (code === 'mismatch') {
    return `${access.hint || 'The saved API key does not match this provider.'}

I did not call the API this turn. Paste a matching key on this Ask page under **API key**, or set \`CMS_LLM_API_KEY\`.

${ops}`;
  }
  return `This question needs the language model, and **no API key** is configured. The live CMS snapshot cannot answer it.

${where}

${ops}`;
}

const GENERAL = [
  {
    test: /floyd|warshall|warshal/,
    title: 'Floyd–Warshall algorithm',
    body: `Floyd–Warshall finds **shortest paths between every pair** of nodes in a weighted graph (all-pairs). It allows **negative** edge weights, but not a negative cycle.

**Idea:** try each node k as an intermediate. If going i → k → j is cheaper than the best i → j so far, keep it.

**DP:** \`dist[i][j] = min(dist[i][j], dist[i][k] + dist[k][j])\` for k, then i, then j.

**Complexity:** O(V³) time, O(V²) memory.

**Vs Dijkstra:** Dijkstra is one source, non-negative weights, usually faster on sparse graphs. Floyd–Warshall is the dense all-pairs choice, and it is simple to code.

This is general CS — it is not an OCPP procedure.`,
  },
  {
    test: /dijkstra/,
    title: 'Dijkstra’s algorithm',
    body: `Dijkstra finds the **shortest path** from one source node to every other node in a graph with **non-negative** edge weights.

**Idea:** grow a set of settled nodes. Always pick the unsettled node with the smallest known distance, then relax its outgoing edges.

**Steps**
1. Dist[source] = 0, Dist[others] = ∞. Put all nodes in a min-priority queue keyed by Dist.
2. Pop the smallest Dist node u. It is now final.
3. For each edge u → v with weight w: if Dist[u] + w < Dist[v], set Dist[v] = Dist[u] + w and remember parent[v] = u.
4. Repeat until the queue is empty (or the target is settled).

**Complexity:** O((V + E) log V) with a binary heap.

**Not for:** negative weights (use Bellman–Ford). Unweighted graphs can use BFS instead.

This is general CS — it is not an OCPP procedure. For CMS work, switch to **Plan** / **Agent**.`,
  },
  {
    test: /\b(bfs|breadth[- ]first)\b/,
    title: 'Breadth-first search (BFS)',
    body: `BFS explores a graph **level by level** from a start node, using a queue. On an unweighted graph it yields shortest paths in hops. Time O(V + E).`,
  },
  {
    test: /\b(dfs|depth[- ]first)\b/,
    title: 'Depth-first search (DFS)',
    body: `DFS walks as far as possible along each branch before backtracking (stack or recursion). Used for cycle detection, topological sort, and connected components. Time O(V + E).`,
  },
  {
    test: /binary search/,
    title: 'Binary search',
    body: `Binary search finds a target in a **sorted** array by repeatedly cutting the search range in half. O(log n). The array must stay ordered.`,
  },
  {
    test: /\b(rest\b|http api|websocket vs)\b/,
    title: 'REST vs WebSocket',
    body: `REST is request/response over HTTP. WebSocket is a persistent two-way channel. This CSMS uses **WebSocket** for OCPP-J (\`ocpp2.1\`) and REST for the operator UI (\`/api/…\`).`,
  },
  {
    test: /\b(tls|https|wss)\b/,
    title: 'TLS / WSS',
    body: `TLS encrypts a TCP stream. **WSS** is WebSocket over TLS. Local lab: \`wss://127.0.0.1:9443/ocpp/2.1/{id}\`. Hosted CSMS: \`wss://YOUR-HOST/ocpp/2.1/{id}\` (same HTTPS as the operator UI). Voltforge gets the **base** only, no ID.`,
  },
  {
    test: /\b(a\*|a-star|astar)\b/,
    title: 'A* search',
    body: `A* is Dijkstra with a heuristic h(n). It expands the node with the smallest f = g + h, where g is cost from the start. If h never overestimates true remaining cost (admissible) and is consistent, A* is optimally efficient. Same negative-weight caveat as Dijkstra.`,
  },
  {
    test: /bellman/,
    title: 'Bellman–Ford',
    body: `Bellman–Ford computes single-source shortest paths even with **negative** edge weights (no negative cycle reachable from the source). Relax every edge V−1 times, then one more pass to detect a negative cycle. Time O(VE).`,
  },
];

export function generalAnswer(question, { hasLlm = false } = {}) {
  const q = String(question || '').toLowerCase();
  const hit = GENERAL.find((g) => g.test.test(q));
  if (!hit) {
    if (!isGeneralQuestion(question)) return '';
    if (/\b(weather|temperature|forecast)\b/.test(q)) {
      return hasLlm
        ? 'This lab CSMS has no live weather feed. The language model should still answer a general weather question — if you see this instead, OpenRouter refused the call (quota or the free model is offline).'
        : llmKeyNeededReply({ code: 'no-key' });
    }
    return hasLlm
      ? isOpenRouterLimited()
        ? 'The OpenRouter key is saved and valid. Today’s **free-models-per-day** limit is used up, so Nemotron cannot answer until the daily reset or you add credit.\n\nI can still answer this CSMS without the model: **Should we keep Whitefield Hub?**, **Why did revenue drop?**, **How do I commission WSS?**, or **open Security**.'
        : 'I do not have a canned local write-up for that topic, and the language model did not return a reply. Ask a CMS question (hubs, WSS, revenue), or wait until the OpenRouter free-model daily limit resets.'
      : llmKeyNeededReply({ code: 'no-key' });
  }
  return `**${hit.title}**\n\n${hit.body}`;
}

function siteStats(registry) {
  const tx = typeof registry.listTransactions === 'function' ? registry.listTransactions() : [];
  const stations = typeof registry.listStations === 'function' ? registry.listStations() : [];
  const tenants = listTenants(registry);
  return listSites(registry).map((site) => {
    const tenant = tenants.find((t) => t.id === site.tenantId);
    const cps = stations.filter((s) => s.siteId === site.id);
    const ids = new Set(cps.map((s) => s.stationId));
    const sessions = tx.filter((t) => ids.has(t.stationId));
    const kwh = sessions.reduce((s, t) => s + (Number(t.kwh) || 0), 0);
    const revenue = sessions.reduce((s, t) => s + (Number(t.cost) || 0), 0);
    const online = cps.filter((s) => s.online).length;
    const ended = sessions.filter((t) => t.status === 'Ended').length;
    let verdict = 'keep';
    let reason = 'Has live or enrolled capacity worth operating.';
    if (!cps.length) {
      verdict = 'watch';
      reason = 'No charge points enrolled — empty heading, not a live asset.';
    } else if (!online && ended === 0 && kwh === 0) {
      verdict = 'consider_remove';
      reason = 'No online CP and no recorded energy. Do not remove until you confirm it was never commissioned; otherwise it is a failed site.';
    } else if (!online) {
      verdict = 'watch';
      reason = 'CPs exist but none are online. Commission WSS or Reset before any close decision.';
    } else if (kwh === 0) {
      verdict = 'watch';
      reason = 'Online but no billed kWh yet. Run a test session before judging yield.';
    }
    return {
      id: site.id,
      name: site.name,
      city: site.city,
      tenantId: site.tenantId,
      tenantName: tenant?.name || '—',
      cps: cps.length,
      online,
      sessions: sessions.length,
      kwh: Number(kwh.toFixed(3)),
      revenue: Number(revenue.toFixed(2)),
      verdict,
      reason,
    };
  });
}

function namedTarget(question, rows, fields) {
  const q = String(question || '').toLowerCase();
  const scored = rows
    .map((row) => {
      const hay = fields.map((f) => String(row[f] || '').toLowerCase()).filter(Boolean);
      if (hay.some((h) => h && q.includes(h))) return { row, n: Math.max(...hay.map((h) => h.length)) };
      return null;
    })
    .filter(Boolean)
    .sort((a, b) => b.n - a.n);
  return scored[0]?.row || null;
}

export function keepRemoveAnswer(registry, question) {
  const sites = siteStats(registry);
  const tenants = listTenants(registry).map((t) => {
    const kids = sites.filter((s) => s.tenantId === t.id);
    const kwh = kids.reduce((s, x) => s + x.kwh, 0);
    const revenue = kids.reduce((s, x) => s + x.revenue, 0);
    const online = kids.reduce((s, x) => s + x.online, 0);
    const cps = kids.reduce((s, x) => s + x.cps, 0);
    let verdict = 'keep';
    let reason = 'Tenant still has operating or enrolled sites.';
    if (!kids.length) {
      verdict = 'watch';
      reason = 'Tenant has no stations.';
    } else if (kids.every((s) => s.verdict === 'consider_remove')) {
      verdict = 'consider_remove';
      reason = 'Every station under this tenant looks unused. Confirm commissioning before dropping the tenant heading.';
    } else if (!online && kwh === 0) {
      verdict = 'watch';
      reason = 'No online CPs and no energy. Fix connectivity before a close decision.';
    }
    return { id: t.id, name: t.name, sites: kids.length, cps, online, kwh, revenue, verdict, reason };
  });

  const wantTenant = /\btenant\b/.test(String(question || '').toLowerCase());
  const siteHit = namedTarget(question, sites, ['name', 'city', 'id']);
  const tenantHit = namedTarget(question, tenants, ['name', 'id']);
  const cur = registry.tariffs?.[0]?.currency || 'EUR';
  const lines = ['## Keep vs remove\n\nLab evidence only (sessions and online state in this CSMS, not street demand).'];

  const siteTable = (rows) =>
    mdTable(
      ['Hub', 'Tenant', 'City', 'Online', 'Sessions', 'kWh', 'Revenue', 'Verdict', 'Why'],
      rows.map((s) => [
        s.name,
        s.tenantName || '—',
        s.city || '—',
        `${s.online}/${s.cps}`,
        s.sessions,
        s.kwh,
        money(s.revenue, cur),
        String(s.verdict).replaceAll('_', ' '),
        s.reason || '—',
      ])
    );
  const tenantTable = (rows) =>
    mdTable(
      ['Tenant', 'Stations', 'Online', 'kWh', 'Revenue', 'Verdict', 'Why'],
      rows.map((t) => [
        t.name,
        t.sites,
        `${t.online}/${t.cps}`,
        t.kwh,
        money(t.revenue, cur),
        String(t.verdict).replaceAll('_', ' '),
        t.reason || '—',
      ])
    );

  if (wantTenant && tenantHit) {
    lines.push(tenantTable([tenantHit]));
    const kids = sites.filter((s) => s.tenantId === tenantHit.id);
    if (kids.length) lines.push(siteTable(kids));
  } else if (siteHit) {
    lines.push(siteTable([siteHit]));
  } else {
    if (sites.length) lines.push('### Stations\n\n' + siteTable(sites));
    else lines.push('No stations yet.');
    if (tenants.length) lines.push('### Tenants\n\n' + tenantTable(tenants));
    else lines.push('No tenants yet.');
  }

  lines.push(
    'This lab **does not delete** a tenant or station from Agent. Use **Plan** for the close sequence (Inoperative → confirm zero sessions → operator removes the heading). Live OCPP still needs **Approve**.'
  );
  return lines.join('\n\n');
}

export function strategyPlan(registry, question) {
  const q = String(question || '').toLowerCase();
  const steps = [];
  const add = (title, extra = {}) =>
    steps.push({
      id: `adv-${steps.length + 1}`,
      step: steps.length + 1,
      tool: extra.tool || null,
      args: extra.args || {},
      title,
      note: extra.note || '',
      risk: extra.risk || '',
    });

  if (isKeepRemoveQuestion(question)) {
    add('Pull live yield: sessions, kWh, online CPs for the named station or tenant (Ask already did this from the briefing).');
    add('If CPs are enrolled but offline, commission WSS or queue Reset — do not close on a connectivity fault.', {
      risk: 'Closing a site that never booted hides a commissioning bug.',
    });
    add('If the site is live, queue ChangeAvailability Inoperative on a quiet window (Demand page) — Approve before OCPP is sent.', {
      risk: 'Live OCPP. Operator must Approve.',
    });
    add('Confirm zero live sessions, then remove the station heading in Stations (operator). Agent will not delete org records.');
    return steps;
  }

  if (/\bmaintain|firmware|update\b/.test(q)) {
    add('Read Demand for that station’s low-load window (range, not a fake exact kWh).');
    add('Queue ChangeAvailability Inoperative — Approve.', { risk: 'Live OCPP' });
    add('Queue UpdateFirmware — Approve.', { risk: 'Live OCPP' });
    add('Restore Operative after the job, then watch BootNotification / firmware status.');
    return steps;
  }

  if (/\bwss|commission|enroll|connect\b/.test(q)) {
    add('Enroll the charge point ID under the correct tenant/station (Agent can do this).', { tool: 'addChargePoint' });
    add('Copy the Voltforge WSS **base** (no station ID). Local: `wss://HOST:9443/ocpp/2.1`. Hosted: `wss://YOUR-HOST/ocpp/2.1`.');
    add('Trust lab TLS locally. Subprotocol `ocpp2.1`. Wait for BootNotification.');
    return steps;
  }

  if (/\bgrow|expand|next (site|station|market)|new market|where (to|should) (we )?(add|build|open)|recommend (a )?site\b/.test(q)) {
    add('Use Site planner / Demand for a lab city score — not a street survey.');
    add('Create a tenant heading only if this is a new CPO.', {
      tool: 'addTenant',
      note: 'Skip if the station belongs under Helios or Orbit Fleet.',
    });
    add('Add the station under that tenant with a real city name.', { tool: 'addStation' });
    add('Enroll at least one charge point and commission WSS before judging yield.', {
      tool: 'addChargePoint',
      risk: 'An empty station heading is not a live asset.',
    });
    return steps;
  }

  if (/\brevenue|utiliz|occupancy|outage|offline|lost (session|income)\b/.test(q)) {
    add('Read live KPIs: online CPs, live sessions, kWh, session revenue, estimated outage loss.');
    add('Queue Reset on enrolled-but-offline CPs during a Demand low-load window — Approve.', {
      risk: 'Live OCPP. Do not send until Approve.',
    });
    add('If a site is online with 0 kWh, remote-start a test token (Approve) before changing tariff or closing.');
    add('Push a default tariff on simulated CPs; live SetDefaultTariff stays on the Approve queue.');
    return steps;
  }

  return [];
}

export function llmFailNote(err) {
  const msg = String(err?.message || err || '');
  if (/free-models-per-day|rate limit exceeded|429/i.test(msg)) {
    return 'The OpenRouter **key is valid** (it is already saved). Today’s **free-models-per-day** limit is used up — unfunded accounts get 50 free calls/day. Do not paste the same key again. Ask CMS questions here without the model, wait for the daily reset, or add **$10 credit** at openrouter.ai to raise the cap to 1000/day.';
  }
  if (/sk-or-v1|openrouter needs|another provider/i.test(msg)) return `${msg} Answered locally.`;
  if (/fewer max_tokens|can only afford/i.test(msg)) {
    return 'OpenRouter accepted the key, but this free model would not spend that many output tokens. Ask Helios retried a smaller reply; this answer is local. Ask again, or pick another **:free** model under **API key**.';
  }
  if (/credit|billing|balance|quota|insufficient|402/i.test(msg)) {
    return 'The saved OpenRouter key is in use, but this **:free** model has no remaining quota (or a $0 / negative balance is blocking free routes). This answer is local. Check openrouter.ai → Credits, or pick another **:free** model.';
  }
  if (/auth|401|unauthorized|missing authentication|no auth credentials/i.test(msg)) {
    return 'OpenRouter rejected the key (auth). Paste a fresh **sk-or-v1-…** from openrouter.ai. Answered locally.';
  }
  if (/no endpoints|not a valid model|model not found|404|503/i.test(msg)) {
    return `OpenRouter has no live route for this model. Answered locally. Under **API key**, try another **:free** model. (${msg})`;
  }
  return `Model unavailable (${msg}). Answered locally.`;
}
