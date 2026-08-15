/**
 * Copilot-style agent loop (Cursor / Codex):
 * model decides → tool calls → observations → model again
 * until a final message or ask_operator.
 */

import { completeChat, throwIfAborted } from '../llm.js';
import { listTenants, listSites } from '../org.js';
import {
  ALLOWED_TOOLS,
  openaiToolDefs,
  executeTool,
  stripLlmTools,
  AGENT_TOOL_GUIDE,
  resolveTenantNamed,
} from './agent.js';
import { NAV_PAGES, pageByView } from './navIntent.js';
import { REPLY_FORMAT, stripLlmReply } from './replyFormat.js';

const MAX_TURNS = 8;

const ASK_OPERATOR = {
  type: 'function',
  function: {
    name: 'ask_operator',
    description:
      'Stop and ask the operator for a missing detail (hub, tenant, OCPP ID, name). Never guess those. The UI shows a reply box.',
    parameters: {
      type: 'object',
      properties: {
        prompt: { type: 'string', description: 'The question to show the operator' },
        slot: {
          type: 'string',
          description: 'What you need: site, stationId, name, tenant, idToken, tariffId, city',
        },
        optional: { type: 'boolean', description: 'True if they may tap Auto' },
      },
      required: ['prompt'],
    },
  },
};

const OPEN_PAGE = {
  type: 'function',
  function: {
    name: 'open_page',
    description: 'Open a CMS page for the operator (Site planner, Stations, Dashboard, …).',
    parameters: {
      type: 'object',
      properties: {
        view: {
          type: 'string',
          enum: [...new Set(NAV_PAGES.map((p) => p.view))],
        },
      },
      required: ['view'],
    },
  },
};

const READ_ORG = {
  type: 'function',
  function: {
    name: 'read_org',
    description: 'Look up live tenants, hubs, charge points, tokens, or tariffs before acting.',
    parameters: {
      type: 'object',
      properties: {
        kind: { type: 'string', enum: ['tenants', 'sites', 'stations', 'tokens', 'tariffs'] },
        query: { type: 'string', description: 'Optional name or id filter' },
      },
      required: ['kind'],
    },
  },
};

function toolDefs(mutate) {
  return mutate ? [...openaiToolDefs(), ASK_OPERATOR, OPEN_PAGE, READ_ORG] : [OPEN_PAGE, READ_ORG, ASK_OPERATOR];
}

const TEXT_TOOL_GUIDE = `If the API did not expose native tool calls, append this block after any short note (and only then):

<<<TOOLS
[{"tool":"read_org","args":{"kind":"sites","query":"Whitefield"}}]
TOOLS>>>

Extra tools (besides CMS mutate tools):
- ask_operator { prompt, slot, optional }  slot is one of site, stationId, name, tenant, idToken, tariffId, city
- open_page { view }  view is a CMS page id (sites, stations, dashboard, assistant, …)
- read_org { kind, query? }  kind is tenants | sites | stations | tokens | tariffs

Never claim the CMS changed unless a mutate tool actually returned ok.`;

function systemPrompt({ mutate, live }) {
  return `You are Helios, the operator copilot in Helios CSMS (OCPP 2.1).

You run a Cursor / Codex-style loop: think only via tools. Either call tools, call ask_operator, or give a final operator-facing reply. Never output chain-of-thought, scratchpad, or quotes from this prompt.

1. Use read_org when you need names, IDs, or what exists — do not invent them.
2. Missing hub / tenant / OCPP ID / name → ask_operator. Never guess those. For an OCPP ID the operator may tap Auto.
   Adding a charge point or simulated charger: ask_operator slot tenant first. Then slot site (only that tenant’s stations). Never dump every hub in the lab.
3. “Take me to / open / go to …” a CMS page → open_page, then a one-line confirmation.
4. ${mutate ? 'Agent mode: you may call CMS mutate tools after you have the required slots.' : 'Ask mode: never mutate. Only read_org, open_page, ask_operator. If they want a CMS change, tell them to switch to Agent and list the slots you would need.'}
5. When finished, write the operator-facing reply in GitHub-flavored Markdown.

Match the operator’s actual wording. The briefing is context, not the answer.
- hi / thanks / who are you → a short greeting. No tables, no station list, no KPIs.
- Dijkstra, weather, math, news → that topic only. Do not mention hubs or this CSMS.
- “what is online” → one KPI line (online/total) plus a Markdown pipe table of OFFLINE or faulted charge points only. Never list the whole fleet unless they asked for inventory / all stations.
- A named hub → that hub only.
If you need names or IDs, call read_org. Do not invent rows.

${REPLY_FORMAT}

Never send live OCPP (Reset, firmware, stop session, ChangeAvailability). Those stay on Approve.
Do not dump a KPI scorecard unless they asked for status, insights, or what is online.
Do not invent stations, revenue, or sessions. Use the briefing / tool results.

${mutate ? `${AGENT_TOOL_GUIDE}\n\n` : ''}${TEXT_TOOL_GUIDE}

LIVE BRIEFING:
${JSON.stringify(live)}`;
}

function parseArgs(raw) {
  if (raw && typeof raw === 'object') return raw;
  try {
    return JSON.parse(raw || '{}');
  } catch {
    return {};
  }
}

function nativeCalls(message) {
  return (message?.tool_calls || [])
    .map((c) => ({
      id: c.id,
      tool: c.function?.name,
      args: parseArgs(c.function?.arguments),
    }))
    .filter((c) => c.tool);
}

function textCalls(text) {
  const parsed = stripLlmTools(text || '');
  const extra = [];
  try {
    const block = String(text || '').match(/<<<TOOLS\s*([\s\S]*?)\s*TOOLS>>>/);
    const arr = block ? JSON.parse(block[1].trim()) : [];
    for (const t of Array.isArray(arr) ? arr : []) {
      if (t && ['ask_operator', 'open_page', 'read_org'].includes(t.tool)) {
        extra.push({ id: `text-${t.tool}`, tool: t.tool, args: t.args || {} });
      }
    }
  } catch {
    /* ignore */
  }
  const fromAllowed = (parsed.tools || []).map((t, i) => ({
    id: `text-${i}-${t.tool}`,
    tool: t.tool,
    args: t.args || {},
  }));
  return { cleaned: parsed.cleaned, calls: [...fromAllowed, ...extra] };
}

function filterHits(list, query, fields) {
  const q = String(query || '').trim().toLowerCase();
  if (!q) return list;
  return list.filter((item) => fields.some((f) => String(item[f] || '').toLowerCase().includes(q)));
}

function readOrg(registry, kind, query) {
  if (kind === 'tenants') {
    return filterHits(
      listTenants(registry).map((t) => ({ id: t.id, name: t.name })),
      query,
      ['id', 'name']
    );
  }
  if (kind === 'sites') {
    const tenants = listTenants(registry);
    return filterHits(
      listSites(registry).map((s) => ({
        id: s.id,
        name: s.name,
        city: s.city,
        tenant: tenants.find((t) => t.id === s.tenantId)?.name,
      })),
      query,
      ['id', 'name', 'city', 'tenant']
    );
  }
  if (kind === 'stations') {
    const list = typeof registry.listStations === 'function' ? registry.listStations() : [];
    const sites = listSites(registry);
    const tenants = listTenants(registry);
    const rows = list.map((s) => {
      const site = sites.find((x) => x.id === s.siteId);
      const tenant = tenants.find((t) => t.id === (s.tenantId || site?.tenantId));
      const evses = s.evses || [];
      const faulted = evses.some((e) => /Fault/i.test(e.connectorStatus || e.status || ''));
      return {
        stationId: s.stationId,
        online: !!s.online,
        site: site?.name || s.siteName || '',
        city: site?.city || '',
        tenant: tenant?.name || '',
        firmware: s.firmwareStatus || 'Idle',
        faulted,
      };
    });
    if (query) {
      return filterHits(rows, query, ['stationId', 'site', 'city', 'tenant']).slice(0, 25);
    }
    const offline = rows.filter((s) => !s.online);
    const faulted = rows.filter((s) => s.online && s.faulted);
    return {
      totals: {
        all: rows.length,
        online: rows.filter((s) => s.online).length,
        offline: offline.length,
        faulted: faulted.length,
      },
      offline: offline.slice(0, 20),
      faulted: faulted.slice(0, 10),
      note: 'Do not list healthy online stations unless the operator asked for a full inventory.',
    };
  }
  if (kind === 'tokens') {
    const list = typeof registry.listTokens === 'function' ? registry.listTokens() : [];
    return filterHits(
      list.map((t) => ({ idToken: t.idToken, status: t.status, type: t.type })),
      query,
      ['idToken']
    );
  }
  if (kind === 'tariffs') {
    return filterHits(
      (registry.tariffs || []).map((t) => ({
        tariffId: t.tariffId,
        energyKwh: t.energyKwh,
        currency: t.currency,
      })),
      query,
      ['tariffId']
    );
  }
  return [];
}

function siteChoices(registry, tenantId) {
  const tenants = listTenants(registry);
  const named = tenantId ? tenants.find((t) => t.id === tenantId) : null;
  return listSites(registry, named?.id).map((s) => ({
    id: s.id,
    label: s.name,
    sub: [named ? null : tenants.find((t) => t.id === s.tenantId)?.name, s.city].filter(Boolean).join(' · '),
  }));
}

function tenantChoices(registry) {
  return listTenants(registry).map((t) => ({ id: t.id, label: t.name }));
}

function publicAsk(registry, args, known = {}) {
  let slot = String(args.slot || 'detail');
  let prompt = String(args.prompt || 'I need one more detail before I continue.');
  let choices = Array.isArray(args.choices) ? args.choices : [];
  const tenantHint = args.tenant || known.tenant || '';
  const tenant = tenantHint ? resolveTenantNamed(registry, tenantHint) : null;

  if (slot === 'site' || slot === 'station') {
    if (!tenant) {
      slot = 'tenant';
      prompt = 'Which tenant should this charge point sit under? Tap one below.';
      choices = tenantChoices(registry);
    } else {
      choices = siteChoices(registry, tenant.id);
      prompt = `Which station under ${tenant.name}? Tap one or type the name.`;
    }
  }
  if (!choices.length && slot === 'tenant') {
    choices = tenantChoices(registry);
  }

  return {
    tool: 'ask_operator',
    slot,
    optional: !!args.optional,
    prompt,
    choices,
    tenant: slot === 'tenant' ? '' : tenant?.name || tenantHint || '',
  };
}

function stripThink(text) {
  return stripLlmReply(text);
}

export async function runCopilotLoop({
  registry,
  question,
  history = [],
  mode = 'agent',
  actor = null,
  pending = null,
  live = {},
  signal = null,
} = {}) {
  const mutate = mode === 'agent' || mode === 'multitask';
  const tools = toolDefs(mutate);
  const known = { tenant: pending?.tenant || '' };
  let userText = String(question || '').trim();
  if (pending?.type === 'ask_operator' && pending.prompt) {
    if (pending.slot === 'tenant') known.tenant = userText;
    userText = `You asked the operator: “${pending.prompt}” (${pending.slot || 'detail'}). They replied: “${userText}”.${
      known.tenant ? ` Known tenant: “${known.tenant}”.` : ''
    } Continue. If you still need a hub, call ask_operator with slot site and tenant set to the known tenant — only that tenant’s stations. Do not re-ask the same slot if they already answered it. If they said auto/skip for an optional OCPP ID, assign one.`;
  }

  const prior = history
    .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && m.content)
    .slice(-8)
    .map((m) => ({ role: m.role, content: String(m.content).slice(0, 2500) }));
  const last = prior[prior.length - 1];
  const hist =
    last?.role === 'user' && String(last.content).trim() === String(question || '').trim()
      ? prior.slice(0, -1)
      : prior;

  const messages = [
    { role: 'system', content: systemPrompt({ mutate, live }) },
    ...hist,
    { role: 'user', content: userText },
  ];

  const executed = [];
  let navigateTo = null;
  let navLabel = '';
  let sendTools = true;

  for (let turn = 0; turn < MAX_TURNS; turn++) {
    throwIfAborted(signal);
    const { message, toolsStripped } = await completeChat({
      messages,
      tools: sendTools ? tools : undefined,
      temperature: 0.2,
      max_tokens: 1600,
      signal,
    });
    if (toolsStripped) sendTools = false;

    let calls = nativeCalls(message);
    let rawText = stripThink(message?.content || '');
    const native = Array.isArray(message?.tool_calls) && message.tool_calls.length > 0;
    if (!calls.length) {
      const parsed = textCalls(rawText);
      calls = parsed.calls || [];
      if (parsed.cleaned) rawText = stripThink(parsed.cleaned);
    }
    if (!mutate) {
      calls = calls.filter((c) => ['open_page', 'read_org', 'ask_operator'].includes(c.tool));
    }

    if (!calls.length) {
      const fallback = executed
        .filter((e) => e.ok && e.summary)
        .map((e) => e.summary)
        .join('\n');
      return {
        answer: rawText || fallback || '',
        executed,
        navigateTo,
        navLabel,
        needsInput: false,
        pending: null,
        source: 'llm',
      };
    }

    if (native && message?.tool_calls?.length) {
      messages.push({
        role: 'assistant',
        content: message.content || '',
        tool_calls: message.tool_calls,
      });
    } else {
      messages.push({ role: 'assistant', content: rawText || JSON.stringify(calls) });
    }

    const ask = calls.find((c) => c.tool === 'ask_operator');
    if (ask) {
      const pub = publicAsk(registry, ask.args || {}, known);
      return {
        answer: pub.prompt,
        executed,
        navigateTo,
        navLabel,
        needsInput: true,
        pending: { type: 'ask_operator', ...pub },
        publicPending: pub,
        source: 'llm',
      };
    }

    const observe = (call, payload) => {
      const text = JSON.stringify(payload).slice(0, 4000);
      if (native && call.id) {
        messages.push({ role: 'tool', tool_call_id: call.id, content: text });
      } else {
        messages.push({ role: 'user', content: `TOOL RESULT ${call.tool}: ${text}` });
      }
    };

    for (const call of calls) {
      if (call.tool === 'open_page') {
        const page = pageByView(call.args?.view);
        const payload = page
          ? { ok: true, view: page.view, label: page.label }
          : { ok: false, error: `Unknown page ${call.args?.view}` };
        if (page) {
          navigateTo = page.view;
          navLabel = page.label;
        }
        observe(call, payload);
        continue;
      }

      if (call.tool === 'read_org') {
        observe(call, { ok: true, kind: call.args?.kind, rows: readOrg(registry, call.args?.kind, call.args?.query) });
        continue;
      }

      if (!mutate || !ALLOWED_TOOLS.has(call.tool)) {
        observe(call, { ok: false, error: mutate ? `Unknown tool ${call.tool}` : 'Ask mode cannot change the CMS' });
        continue;
      }

      try {
        const result = await executeTool(registry, { tool: call.tool, args: call.args || {} }, actor);
        executed.push({
          tool: call.tool,
          args: call.args,
          ok: true,
          summary: result.summary,
          data: result.data,
        });
        observe(call, { ok: true, summary: result.summary, data: result.data });
      } catch (err) {
        executed.push({
          tool: call.tool,
          args: call.args,
          ok: false,
          error: err.message,
          summary: err.message,
        });
        observe(call, { ok: false, error: err.message });
      }
    }
  }

  return {
    answer: 'Stopped after too many tool turns. Say what you want next.',
    executed,
    navigateTo,
    navLabel,
    needsInput: false,
    pending: null,
    source: 'llm',
  };
}
