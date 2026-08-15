/**
 * Slot-filling: if a CMS job is missing tenant, station, name, id, … ask before executing.
 */

import { listTenants, listSites } from '../org.js';
import {
  parseAgentIntents,
  parseMultitaskIntents,
  looksLikeQuestion,
  wantsMutation,
  cleanName,
  resolveSite,
  resolveTenantNamed,
  canonicalCity,
  ALLOWED_TOOLS,
} from './agent.js';
import { parseNavIntent } from './navIntent.js';

const SLOTS = {
  addTenant: {
    label: 'add a tenant',
    required: [{ key: 'name', prompt: 'What should we call this tenant?' }],
  },
  addStation: {
    label: 'add a station',
    required: [
      { key: 'name', prompt: 'What should the station be called?' },
      { key: 'tenant', prompt: 'Which tenant should this station sit under? Tap one below.', choices: 'tenants' },
    ],
    optional: [{ key: 'city', prompt: 'Which city? Tap skip if you do not want one.' }],
  },
  addChargePoint: {
    label: 'add a charge point',
    required: [
      { key: 'tenant', prompt: 'Which tenant should this charge point sit under? Tap one below.', choices: 'tenants' },
      { key: 'site', prompt: 'Which station (hub) under that tenant? Tap one or type the name.', choices: 'sites' },
      { key: 'stationId', prompt: 'What should we call this charge point (OCPP ID)? Example: CP-21. Tap Auto if I should assign one.', allowAuto: true },
    ],
  },
  simulateChargePoint: {
    label: 'simulate a charge point',
    required: [
      { key: 'tenant', prompt: 'Which tenant should the simulated charger sit under? Tap one below.', choices: 'tenants' },
      { key: 'site', prompt: 'Which station under that tenant? Tap one or type the name.', choices: 'sites' },
      { key: 'stationId', prompt: 'What ID should the simulated charger use? Example: SIM-CP-01. Tap Auto if I should assign one.', allowAuto: true },
    ],
  },
  moveChargePoint: {
    label: 'move a charge point',
    required: [
      { key: 'stationId', prompt: 'Which charge point should I move? Tap one below.', choices: 'cps' },
      { key: 'site', prompt: 'Which station should it move to?', choices: 'sites' },
    ],
  },
  addToken: {
    label: 'add a token',
    required: [{ key: 'idToken', prompt: 'What is the token / RFID id?' }],
  },
  blockToken: {
    label: 'block a token',
    required: [{ key: 'idToken', prompt: 'Which token should I block? Tap one below.', choices: 'tokens' }],
  },
  addTariff: {
    label: 'add a tariff',
    required: [{ key: 'tariffId', prompt: 'What should the tariff id be?' }],
    optional: [{ key: 'energyKwh', prompt: 'Price per kWh? Tap skip to use 0.39.' }],
  },
  setDefaultTariff: {
    label: 'set a default tariff',
    required: [
      { key: 'tariffId', prompt: 'Which tariff? Tap one below.', choices: 'tariffs' },
      { key: 'stationId', prompt: 'On which charge point?', choices: 'cps' },
    ],
  },
  addReservation: {
    label: 'add a reservation',
    required: [{ key: 'stationId', prompt: 'Which charge point should hold the reservation?', choices: 'cps' }],
  },
  saveSite: {
    label: 'save a next-site candidate',
    required: [{ key: 'city', prompt: 'Which city should I save?' }],
  },
};

export function isCancel(question) {
  return /^(cancel|never mind|nevermind|stop|abort|forget it|forget that|no thanks)\b/i.test(String(question || '').trim());
}

export function isSkip(question) {
  return /^(skip|auto|default|none|n\/a|na|whatever|you (choose|pick)|doesn'?t matter)\b/i.test(
    String(question || '').trim()
  );
}

function stripReply(raw) {
  let text = cleanName(raw);
  text = text.replace(/^[.:,-]+\s*/, '');
  for (let i = 0; i < 4; i++) {
    const next = text.replace(
      /^(it'?s|it is|the|station|tenant|site|hub|called|named|under|at|in|on|for|to|id|use|put it|put this)\s+/i,
      ''
    );
    if (next === text) break;
    text = next;
  }
  return text.trim();
}

function hasValue(args, key) {
  if (args?._skip?.[key]) return true;
  const v = args?.[key];
  if (v == null) return false;
  if (typeof v === 'number') return Number.isFinite(v);
  return String(v).trim() !== '';
}

function slotList(tool) {
  const spec = SLOTS[tool];
  if (!spec) return [];
  return [
    ...(spec.required || []).map((s) => ({ ...s, required: true })),
    ...(spec.optional || []).map((s) => ({ ...s, required: false })),
  ];
}

function firstGap(calls) {
  for (let i = 0; i < calls.length; i++) {
    const call = calls[i];
    for (const slot of slotList(call.tool)) {
      if (!hasValue(call.args, slot.key)) return { callIndex: i, call, slot };
    }
  }
  return null;
}

function choiceRows(registry, kind, call = null) {
  if (kind === 'tenants') {
    return listTenants(registry).map((t) => ({ id: t.id, label: t.name }));
  }
  if (kind === 'sites') {
    const tenants = listTenants(registry);
    const named = call?.args?.tenant ? resolveTenantNamed(registry, call.args.tenant) : null;
    const sites = listSites(registry, named?.id);
    return sites.map((s) => {
      const tenant = tenants.find((t) => t.id === s.tenantId);
      return {
        id: s.id,
        label: s.name,
        sub: [named ? null : tenant?.name, s.city].filter(Boolean).join(' · '),
      };
    });
  }
  if (kind === 'cps') {
    return (typeof registry.listStations === 'function' ? registry.listStations() : []).map((s) => ({
      id: s.stationId,
      label: s.stationId,
    }));
  }
  if (kind === 'tokens') {
    return (typeof registry.listTokens === 'function' ? registry.listTokens() : []).map((t) => ({
      id: t.idToken,
      label: t.idToken,
      sub: t.status,
    }));
  }
  if (kind === 'tariffs') {
    return (registry.tariffs || []).map((t) => ({
      id: t.tariffId,
      label: t.tariffId,
      sub: t.energyKwh != null ? `${t.currency || ''} ${t.energyKwh}/kWh`.trim() : '',
    }));
  }
  return [];
}

function formatPrompt(registry, call, slot) {
  const spec = SLOTS[call.tool];
  const job = spec?.label || call.tool;
  const choices = slot.choices ? choiceRows(registry, slot.choices, call).slice(0, 40) : [];
  const tenant = call?.args?.tenant ? resolveTenantNamed(registry, call.args.tenant) : null;
  const lines = [
    `Happy to **${job}** — I need this detail before I change the CMS.`,
    '',
    slot.key === 'site' && tenant
      ? `Which station under **${tenant.name}**? Tap one or type the name.`
      : slot.prompt,
    '',
    'Type the answer in the reply box under this message, or tap a chip.',
  ];
  if (!choices.length && slot.choices === 'tenants') {
    lines.push('', 'There is no tenant yet — reply with a new tenant name and I will create it.');
  } else if (!choices.length && slot.choices === 'sites') {
    lines.push(
      '',
      tenant
        ? `**${tenant.name}** has no station yet — tell me a station name and I will add it under that tenant first.`
        : 'There is no station yet — tell me a station name (and I will ask which tenant).'
    );
  }
  if (slot.allowAuto) {
    lines.push('', 'Or tap **Auto** if I should assign an ID.');
  }
  lines.push('', 'Say **cancel** to drop this job.');
  return lines.join('\n');
}

function publicPending(registry, pending, slot) {
  if (!pending || !slot) return null;
  const call = pending.calls[pending.callIndex];
  return {
    tool: call?.tool || null,
    slot: slot.key,
    optional: !slot.required || !!slot.allowAuto,
    prompt:
      slot.key === 'site' && call?.args?.tenant
        ? `Which station under ${call.args.tenant}? Tap one or type the name.`
        : slot.prompt,
    choices: slot.choices ? choiceRows(registry, slot.choices, call).slice(0, 40) : [],
  };
}

function cloneCalls(calls) {
  return (calls || []).map((c) => ({
    tool: c.tool,
    args: { ...(c.args || {}) },
    title: c.title,
  }));
}

function coerceSlot(registry, slot, raw, calls, call) {
  const text = stripReply(raw);
  if (!text) return { error: 'I did not catch a value. Try again, or say **cancel**.' };
  if (isSkip(text)) {
    if (slot.required && !slot.allowAuto) {
      return { error: `I still need ${slot.prompt.replace(/\?$/, '')}.` };
    }
    return { skip: true };
  }

  if (slot.choices === 'tenants') {
    const hit = resolveTenantNamed(registry, text);
    if (hit) return { value: hit.name };
    const already = calls.some((c) => c.tool === 'addTenant' && cleanName(c.args?.name).toLowerCase() === text.toLowerCase());
    if (!already) calls.unshift({ tool: 'addTenant', args: { name: text } });
    return { value: text };
  }

  if (slot.choices === 'sites') {
    const tenant = call?.args?.tenant ? resolveTenantNamed(registry, call.args.tenant) : null;
    const hit = resolveSite(registry, text, tenant?.id);
    if (hit) return { value: hit.name };
    if (tenant) {
      const already = calls.some(
        (c) => c.tool === 'addStation' && cleanName(c.args?.name).toLowerCase() === text.toLowerCase()
      );
      if (!already) {
        const idx = calls.indexOf(call);
        calls.splice(idx >= 0 ? idx : 0, 0, {
          tool: 'addStation',
          args: { name: text, tenant: tenant.name, city: '', _skip: { city: true } },
        });
      }
      return { value: text };
    }
    return {
      error: `I do not see a station called “${text}”. Pick a tenant first, then a station, or add the station first.`,
    };
  }

  if (slot.choices === 'cps') {
    const list = typeof registry.listStations === 'function' ? registry.listStations() : [];
    const n = text.toLowerCase();
    const hit = list.find((s) => String(s.stationId).toLowerCase() === n) || list.find((s) => String(s.stationId).toLowerCase().includes(n));
    if (!hit) return { error: `I do not see charge point “${text}”.` };
    return { value: hit.stationId };
  }

  if (slot.choices === 'tokens') {
    const list = typeof registry.listTokens === 'function' ? registry.listTokens() : [];
    const hit = list.find((t) => String(t.idToken).toLowerCase() === text.toLowerCase());
    if (!hit) return { value: text };
    return { value: hit.idToken };
  }

  if (slot.choices === 'tariffs') {
    const hit = (registry.tariffs || []).find((t) => String(t.tariffId).toLowerCase() === text.toLowerCase());
    if (!hit) return { error: `I do not see tariff “${text}”.` };
    return { value: hit.tariffId };
  }

  if (slot.key === 'city') return { value: canonicalCity(text) };
  if (slot.key === 'energyKwh') {
    const n = Number(String(text).replace(/[^\d.]/g, ''));
    if (!Number.isFinite(n)) return { error: 'Send a number for €/kWh, or say **skip**.' };
    return { value: n };
  }
  return { value: text };
}

function applyReply(registry, pending, reply) {
  const calls = cloneCalls(pending.calls);
  const call = calls[pending.callIndex];
  if (!call) return { error: 'That job is no longer pending.', calls: [] };
  const slot = slotList(call.tool).find((s) => s.key === pending.slot);
  if (!slot) return { error: 'That job is no longer pending.', calls: [] };

  const result = coerceSlot(registry, slot, reply, calls, call);
  if (result.error) return { error: result.error, calls };
  if (result.skip) {
    call.args._skip = { ...(call.args._skip || {}), [slot.key]: true };
    call.args[slot.key] = '';
  } else {
    call.args[slot.key] = result.value;
  }
  return { calls };
}

function looksLikeFill(question, pending) {
  const q = String(question || '').trim();
  if (!pending) return false;
  if (parseNavIntent(q)) return false;
  if (isCancel(q) || isSkip(q)) return true;
  if (looksLikeQuestion(q)) return false;
  if (wantsMutation(q)) {
    const fresh = parseAgentIntents(q);
    if (fresh.length) return false;
  }
  return true;
}

function collectCalls(question, { multitask = false, extraTools = [] } = {}) {
  const extras = (extraTools || [])
    .filter((t) => t && ALLOWED_TOOLS.has(t.tool))
    .map((t) => ({ tool: t.tool, args: { ...(t.args || {}) }, title: t.title }));
  if (extras.length && !String(question || '').trim()) return extras;
  const parsed = multitask ? parseMultitaskIntents(question) : parseAgentIntents(question);
  const merged = [...parsed, ...extras.filter((e) => !parsed.some((p) => p.tool === e.tool && JSON.stringify(p.args) === JSON.stringify(e.args)))];
  return merged;
}

function inferTenantFromSite(registry, calls) {
  const next = cloneCalls(calls);
  for (const c of next) {
    if (
      (c.tool === 'addChargePoint' || c.tool === 'simulateChargePoint') &&
      hasValue(c.args, 'site') &&
      !hasValue(c.args, 'tenant')
    ) {
      const hit = resolveSite(registry, c.args.site);
      const tenant = hit ? listTenants(registry).find((t) => t.id === hit.tenantId) : null;
      if (tenant) c.args.tenant = tenant.name;
    }
  }
  return next;
}

function ensureTenantJob(registry, calls) {
  const next = cloneCalls(calls);
  const hasTenantTool = next.some((c) => c.tool === 'addTenant');
  const needsTenant = next.some((c) => c.tool === 'addStation' && !hasValue(c.args, 'tenant'));
  if (needsTenant && !listTenants(registry).length && !hasTenantTool) {
    next.unshift({ tool: 'addTenant', args: {} });
  }
  return next;
}

function readyCalls(calls) {
  return cloneCalls(calls).map((c) => {
    const args = { ...c.args };
    delete args._skip;
    return { tool: c.tool, args, title: c.title };
  });
}

export function resolveJob(registry, { question, extraTools = [], pending = null, multitask = false } = {}) {
  const q = String(question || '').trim();

  if (isCancel(q) && pending?.calls?.length) {
    return { cancelled: true, calls: [], pending: null };
  }

  let calls;
  if (pending?.calls?.length && looksLikeFill(q, pending)) {
    const applied = applyReply(registry, pending, q);
    if (applied.error) {
      const slot = slotList(pending.calls[pending.callIndex]?.tool || '').find((s) => s.key === pending.slot);
      const hold = { ...pending, calls: applied.calls?.length ? applied.calls : pending.calls };
      return {
        needsInput: true,
        pending: hold,
        publicPending: publicPending(registry, hold, slot),
        prompt: `${applied.error}\n\n${slot ? formatPrompt(registry, hold.calls[hold.callIndex], slot) : ''}`.trim(),
        calls: hold.calls,
      };
    }
    calls = applied.calls;
  } else {
    const fresh = collectCalls(q, { multitask, extraTools });
    if (parseNavIntent(q)) {
      if (pending?.calls?.length) {
        return { divert: true, pending, calls: pending.calls };
      }
      calls = [];
    } else if (!fresh.length && pending?.calls?.length && !looksLikeQuestion(q) && !wantsMutation(q)) {
      const applied = applyReply(registry, pending, q);
      if (applied.error) {
        const slot = slotList(pending.calls[pending.callIndex]?.tool || '').find((s) => s.key === pending.slot);
        return {
          needsInput: true,
          pending,
          publicPending: publicPending(registry, pending, slot),
          prompt: applied.error,
          calls: pending.calls,
        };
      }
      calls = applied.calls;
    } else if (!fresh.length && pending?.calls?.length) {
      return { divert: true, pending, calls: pending.calls };
    } else {
      calls = fresh;
    }
  }

  if (!calls.length) {
    return { needsInput: false, pending: null, calls: [] };
  }

  calls = ensureTenantJob(registry, calls);
  calls = inferTenantFromSite(registry, calls);
  const gap = firstGap(calls);
  if (gap) {
    const hold = { calls, callIndex: gap.callIndex, slot: gap.slot.key };
    return {
      needsInput: true,
      pending: hold,
      publicPending: publicPending(registry, hold, gap.slot),
      prompt: formatPrompt(registry, gap.call, gap.slot),
      calls,
    };
  }

  return { needsInput: false, pending: null, calls: readyCalls(calls) };
}
