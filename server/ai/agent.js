/**
 * Agentic CMS tools: Ask Helios can create tenants, stations, charge points, tokens, tariffs.
 * Live OCPP (Reset, firmware, …) stays on the Approve queue.
 */

import { addTenant, addSite, assignChargePoint, listTenants, listSites, emitOrg } from '../org.js';
import { saveSiteRecommendation } from './index.js';
import { stationUrls } from '../security.js';
import { assertToolAllowed } from '../iam.js';

export const ALLOWED_TOOLS = new Set([
  'addTenant',
  'addStation',
  'addChargePoint',
  'simulateChargePoint',
  'moveChargePoint',
  'addToken',
  'blockToken',
  'addTariff',
  'setDefaultTariff',
  'addReservation',
  'saveSite',
]);

const CITY_ALIASES = {
  bangalore: 'Bengaluru',
  bengaluru: 'Bengaluru',
  hyderabad: 'Hyderabad',
  pune: 'Pune',
  gurgaon: 'Gurugram',
  gurugram: 'Gurugram',
  mumbai: 'Mumbai',
  bombay: 'Mumbai',
  chennai: 'Chennai',
  madras: 'Chennai',
};

function norm(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/['"]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function cleanName(value) {
  return String(value || '')
    .replace(/['"]/g, '')
    .replace(/\s+/g, ' ')
    .replace(/\s*(please|thanks|thank you)\s*$/i, '')
    .trim();
}

export function looksLikeQuestion(q) {
  return /^(how |what |why |who |which |where |when |can you explain|explain |tell me how)/i.test(q.trim());
}

export function wantsMutation(q) {
  return /\b(add|create|enroll|simulate|move|set|make|register|save|put|block|reserve|pair|provision|onboard|spin up|stand up|new (station|site|hub|depot|charge|tenant|token|tariff|charger|rfid))\b/i.test(
    q
  );
}

function fuzzy(list, name, fields) {
  const n = norm(name);
  if (!n) return null;
  const scored = list
    .map((item) => {
      const hay = fields.map((f) => norm(item[f])).filter(Boolean);
      if (hay.some((h) => h === n || n === item.id)) return { item, score: 3 };
      if (hay.some((h) => h.includes(n) || n.includes(h))) return { item, score: 2 };
      return null;
    })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score);
  return scored[0]?.item || null;
}

export function resolveTenantNamed(registry, name) {
  if (!name) return null;
  return fuzzy(listTenants(registry), name, ['name', 'id']);
}

function resolveTenant(registry, name) {
  return resolveTenantNamed(registry, name) || listTenants(registry)[0] || null;
}

export function resolveSite(registry, name, tenantId) {
  if (!name) return null;
  const pool = listSites(registry, tenantId || undefined);
  const hit = fuzzy(pool, name, ['name', 'city', 'id']);
  if (hit || tenantId) return hit;
  return fuzzy(listSites(registry), name, ['name', 'city', 'id']);
}

function resolveChargePoint(registry, name) {
  const list = registry.listStations();
  const n = norm(name);
  return (
    list.find((s) => norm(s.stationId) === n) ||
    list.find((s) => norm(s.stationId).includes(n) || n.includes(norm(s.stationId))) ||
    null
  );
}

function resolveTariff(registry, name) {
  const n = norm(name);
  return (
    registry.tariffs.find((t) => norm(t.tariffId) === n) ||
    registry.tariffs.find((t) => norm(t.tariffId).includes(n)) ||
    registry.tariffs[0] ||
    null
  );
}

export function canonicalCity(name) {
  const n = norm(name);
  return CITY_ALIASES[n] || cleanName(name);
}

function nextCpId(registry, requested) {
  const id = cleanName(requested);
  if (id && !/^(auto|skip|default)$/i.test(id)) return id;
  const n = registry.listStations().length + 1;
  return `MASSIVE-CP-${String(n).padStart(2, '0')}`;
}

export function parseAgentIntents(question) {
  const q = String(question || '').trim();
  if (!q || looksLikeQuestion(q) || !wantsMutation(q)) return [];

  const calls = [];

  const onboard = q.match(
    /\b(?:add|create|make|register)\s+(?:a\s+|new\s+)?tenant\s+(?:named\s+|called\s+)?["']?([A-Za-z0-9][A-Za-z0-9 ._-]{0,58}?)["']?\s+with\s+(?:a\s+)?(?:new\s+)?(?:station|site|hub|depot)\s+(?:named\s+|called\s+)?["']?([A-Za-z0-9][A-Za-z0-9 ._-]{0,78}?)["']?(?=\s+in\s+|\s+and\s+|\s*,|\s*$|\s+then\b)(?:\s+in\s+["']?([A-Za-z][A-Za-z .-]{0,38}?)["']?(?=\s+and\s+|\s*,|\s*$|\s+then\b))?(?:\s*(?:,|and)\s+(?:a\s+|an\s+)?(?:charge\s*point|charger|cp)\s+(?:named\s+|called\s+|id\s+)?["']?([A-Za-z0-9._:-]{2,64})["']?)?/i
  );
  if (onboard) {
    const tenantName = cleanName(onboard[1]);
    const stationName = cleanName(onboard[2]);
    const city = onboard[3] ? canonicalCity(onboard[3]) : '';
    const cpId = onboard[4] ? cleanName(onboard[4]) : '';
    if (tenantName) calls.push({ tool: 'addTenant', args: { name: tenantName } });
    if (stationName) calls.push({ tool: 'addStation', args: { name: stationName, city, tenant: tenantName } });
    if (cpId) calls.push({ tool: 'addChargePoint', args: { stationId: cpId, site: stationName } });
  }

  const tenantChunk = onboard
    ? null
    : q.match(
    /\b(?:add|create|make|register)\s+(?:a\s+|new\s+)?(tenants?)\s+(.+?)(?=\s+(?:add|create|enroll|simulate|move|set)\s+(?:a\s+)?(?:station|site|charge|token|tariff|charger)|$)/i
  );
  if (tenantChunk) {
    const plural = /s$/i.test(tenantChunk[1]);
    const rest = tenantChunk[2].trim();
    const thenParts = rest.split(/\s+and then\s+/i).map((p) => cleanName(p.replace(/^(named|called)\s+/i, '')));
    const secondIsTenant = /\btenant\b/i.test(rest.split(/\s+and then\s+/i).slice(1).join(' '));
    if (!plural && thenParts.length > 1 && !secondIsTenant) {
      const tenantName = thenParts[0].replace(/\btenant\b/gi, '').trim();
      if (tenantName) calls.push({ tool: 'addTenant', args: { name: tenantName } });
      for (const part of thenParts.slice(1)) {
        const stationName = cleanName(part.replace(/^(a\s+)?(station|site)\s+(named\s+|called\s+)?/i, '').replace(/\btenant\b/gi, ''));
        if (stationName) {
          calls.push({ tool: 'addStation', args: { name: stationName, city: '', tenant: tenantName } });
        }
      }
    } else {
      const names = rest
        .split(/\s*(?:,|\band\s+tenant\b|\band then\b|\band\b)\s*/i)
        .map((p) => cleanName(p.replace(/^(named|called|tenant)\s+/i, '')))
        .filter((n) => n.length >= 2);
      for (const name of names) {
        calls.push({ tool: 'addTenant', args: { name } });
      }
    }
  }

  const siteInCity = onboard
    ? null
    : q.match(
    /\b(?:add|create|make|register|new)\s+(?:a\s+)?(?:new\s+)?(?:station|site|hub|depot)\s+in\s+["']?([A-Za-z .-]{2,40}?)["']?(?:\s+(?:called|named)\s+["']?([A-Za-z0-9 ._-]{2,80}?)["']?)?(?=\s+(?:and|then|,|$)|$)/i
  );
  const siteNamed = onboard
    ? null
    : q.match(
    /\b(?:add|create|make|register)\s+(?:a\s+)?(?:new\s+)?(?:station|site|hub|depot)\s+(?:named\s+|called\s+)?["']?([A-Za-z0-9 ._-]{2,80}?)["']?(?:\s+in\s+["']?([A-Za-z .-]{2,40}?)["']?)?(?:\s+(?:under|for|to)\s+(?:tenant\s+)?["']?([A-Za-z0-9 ._-]{2,60}?)["']?)?(?=\s+(?:and|then|,|$)|$)/i
  );
  if (siteInCity && !/^in\b/i.test(siteInCity[1] || '')) {
    const city = canonicalCity(siteInCity[1]);
    calls.push({
      tool: 'addStation',
      args: {
        name: cleanName(siteInCity[2]) || `${city} Hub`,
        city,
      },
    });
  } else if (siteNamed) {
    let name = cleanName(siteNamed[1]);
    let city = siteNamed[2] ? canonicalCity(siteNamed[2]) : '';
    if (/^in\s+/i.test(name)) {
      city = canonicalCity(name.replace(/^in\s+/i, ''));
      name = `${city} Hub`;
    }
    calls.push({
      tool: 'addStation',
      args: {
        name,
        city,
        tenant: cleanName(siteNamed[3] || ''),
      },
    });
  }

  const cpWithId = q.match(
    /\b(?:add|create|enroll|register|make|provision|onboard|pair)(?:\s+me)?\s+(?:a\s+|an\s+|new\s+)?(?:charge\s*point|charger|cp)\s+(?:named\s+|called\s+|id\s+|with id\s+)?["']?([A-Za-z0-9._:-]{2,64})["']?\s+(?:at|to|under|in|on)\s+(?:station\s+)?["']?([A-Za-z0-9 ._-]{2,80}?)["']?(?=\s+(?:and|then|,|$)|$)/i
  );
  const cpIdOnly = q.match(
    /\b(?:add|create|enroll|register|make|provision|onboard|pair)(?:\s+me)?\s+(?:a\s+|an\s+|new\s+)?(?:charge\s*point|charger|cp)\s+(?:named\s+|called\s+|id\s+|with id\s+)["']?([A-Za-z0-9._:-]{2,64})["']?(?=\s+(?:and|then|,|$)|$)/i
  );
  const cpAtSite = q.match(
    /\b(?:add|create|enroll|register|make|provision|onboard|pair)(?:\s+me)?\s+(?:a\s+|an\s+|new\s+)?(?:charge\s*point|charger|cp)\s+(?:at|to|under|in|on)\s+(?:station\s+)?["']?([A-Za-z0-9 ._-]{2,80}?)["']?(?=\s+(?:and|then|,|$)|$)/i
  );
  const enrollMatch = q.match(
    /\b(?:enroll|pair)\s+["']?([A-Za-z0-9._:-]{2,64})["']?(?:\s+(?:at|to|under|in|with)\s+(?:station\s+)?["']?([A-Za-z0-9][A-Za-z0-9 ._-]{0,78}?)["']?(?=\s+(?:and|then|,|please)|$))?/i
  );

  if (!calls.some((c) => c.tool === 'addChargePoint')) {
    if (cpWithId && !/^(at|to|under|in|on)$/i.test(cpWithId[1])) {
      calls.push({
        tool: 'addChargePoint',
        args: { stationId: cleanName(cpWithId[1]), site: cleanName(cpWithId[2]) },
      });
    } else if (cpIdOnly) {
      calls.push({ tool: 'addChargePoint', args: { stationId: cleanName(cpIdOnly[1]), site: '' } });
    } else if (cpAtSite) {
      calls.push({ tool: 'addChargePoint', args: { stationId: '', site: cleanName(cpAtSite[1]) } });
    } else if (enrollMatch) {
      calls.push({
        tool: 'addChargePoint',
        args: { stationId: cleanName(enrollMatch[1]), site: cleanName(enrollMatch[2] || '') },
      });
    }
  }

  const simMatch = q.match(
    /\bsimulate\s+(?:a\s+)?(?:charge\s*point|charger|station|cp)?(?:\s+(?:at|on|under|in)\s+(?:station\s+)?["']?([A-Za-z0-9][A-Za-z0-9 ._-]{0,78}?)["']?(?=\s+(?:and|then|,|please)|$))?/i
  );
  if (simMatch && /\bsimulate\b/i.test(q)) {
    calls.push({ tool: 'simulateChargePoint', args: { site: cleanName(simMatch[1] || '') } });
  }

  const moveMatch = q.match(
    /\bmove\s+["']?([A-Za-z0-9._:-]{2,64})["']?\s+to\s+(?:station\s+)?["']?([A-Za-z0-9][A-Za-z0-9 ._-]{0,78}?)["']?(?=\s+(?:and|then|,|please)|$)/i
  );
  if (moveMatch) {
    calls.push({
      tool: 'moveChargePoint',
      args: { stationId: cleanName(moveMatch[1]), site: cleanName(moveMatch[2]) },
    });
  }

  const tokenMatch = q.match(
    /\b(?:add|create|register)\s+(?:an?\s+)?(?:rfid\s+|auth\s+)?token\s+(?:named\s+|called\s+|id\s+)?["']?([A-Za-z0-9._:-]{2,64})["']?/i
  );
  const rfidMatch = q.match(
    /\b(?:add|create|register)\s+(?:an?\s+)?(?:rfid(?:\s+(?:tag|card|fob|token))?|tag|card|fob)\s+(?:named\s+|called\s+|id\s+)?["']?([A-Za-z0-9._:-]{2,64})["']?/i
  );
  if (tokenMatch) {
    calls.push({ tool: 'addToken', args: { idToken: cleanName(tokenMatch[1]) } });
  } else if (rfidMatch) {
    calls.push({ tool: 'addToken', args: { idToken: cleanName(rfidMatch[1]) } });
  }

  const blockMatch = q.match(/\bblock\s+(?:token\s+)?["']?([A-Za-z0-9._:-]{2,64})["']?/i);
  if (blockMatch) {
    calls.push({ tool: 'blockToken', args: { idToken: cleanName(blockMatch[1]) } });
  }

  const tariffMatch = q.match(
    /\b(?:add|create)\s+(?:a\s+)?tariff\s+["']?([A-Za-z0-9._:-]{2,64})["']?(?:\s+(?:at|of)?\s*([\d.]+))?/i
  );
  if (tariffMatch) {
    calls.push({
      tool: 'addTariff',
      args: { tariffId: cleanName(tariffMatch[1]), energyKwh: tariffMatch[2] ? Number(tariffMatch[2]) : undefined },
    });
  }

  const defTariff = q.match(
    /\bset(?: the)? default tariff\s+["']?([A-Za-z0-9._:-]{2,64})["']?\s+(?:on|for|to)\s+["']?([A-Za-z0-9._:-]{2,64})["']?/i
  );
  if (defTariff) {
    calls.push({
      tool: 'setDefaultTariff',
      args: { tariffId: cleanName(defTariff[1]), stationId: cleanName(defTariff[2]) },
    });
  }

  const reserveMatch = q.match(
    /\b(?:add|create|make)\s+(?:a\s+)?reservation\s+(?:on|for|at)\s+["']?([A-Za-z0-9._:-]{2,64})["']?/i
  );
  if (reserveMatch) {
    calls.push({ tool: 'addReservation', args: { stationId: cleanName(reserveMatch[1]) } });
  }

  const saveSite = q.match(/\bsave\s+["']?([A-Za-z .-]{3,40}?)["']?\s+(?:as )?(?:a )?(?:next )?site/i);
  if (saveSite) {
    calls.push({ tool: 'saveSite', args: { city: canonicalCity(saveSite[1]) } });
  }

  if (!calls.length) {
    const bare = bareTool(q);
    if (bare) calls.push({ tool: bare, args: {} });
  }

  for (const c of calls) {
    if (c.args?.name && /^(a|an|the|please|now|here|one|it|this|that|and a|and an)$/i.test(norm(c.args.name))) {
      c.args.name = '';
    }
  }

  return calls;
}

function bareTool(q) {
  if (/\b(add|create|enroll|register|make|provision|onboard|pair)\b/i.test(q) && /\b(charge\s*points?|chargers?|\bcp\b)\b/i.test(q)) {
    return 'addChargePoint';
  }
  if (/\bsimulate\b/i.test(q) && /\b(charge\s*point|charger|station|cp)?\b/i.test(q)) return 'simulateChargePoint';
  if (/\b(add|create|make|register|new)\b/i.test(q) && /\b(stations?|sites?|hubs?|depots?)\b/i.test(q)) return 'addStation';
  if (/\b(add|create|make|register)\b/i.test(q) && /\btenants?\b/i.test(q)) return 'addTenant';
  if (/\b(add|create|register)\b/i.test(q) && /\b(tokens?|rfid|tag|card|fob)\b/i.test(q)) return 'addToken';
  if (/\bblock\b/i.test(q) && /\b(token|rfid|tag|card)\b/i.test(q)) return 'blockToken';
  if (/\b(add|create)\b/i.test(q) && /\btariffs?\b/i.test(q)) return 'addTariff';
  if (/\bset\b/i.test(q) && /\bdefault tariff\b/i.test(q)) return 'setDefaultTariff';
  if (/\b(add|create|make)\b/i.test(q) && /\breserv/i.test(q)) return 'addReservation';
  if (/\bsave\b/i.test(q) && /\bsite\b/i.test(q)) return 'saveSite';
  if (/\bmove\b/i.test(q) && /\b(charge\s*point|charger|cp)\b/i.test(q)) return 'moveChargePoint';
  return null;
}

function parseLlmTools(text) {
  const block = String(text || '').match(/<<<TOOLS\s*([\s\S]*?)\s*TOOLS>>>/);
  if (!block) return { tools: [], cleaned: String(text || '').trim() };
  let tools = [];
  try {
    const parsed = JSON.parse(block[1].trim());
    tools = (Array.isArray(parsed) ? parsed : [])
      .filter((t) => t && ALLOWED_TOOLS.has(t.tool))
      .map((t) => ({ tool: t.tool, args: t.args && typeof t.args === 'object' ? t.args : {} }));
  } catch {
    tools = [];
  }
  const cleaned = String(text || '')
    .replace(/<<<TOOLS[\s\S]*?TOOLS>>>/g, '')
    .trim();
  return { tools, cleaned };
}

export async function executeTool(registry, call, actor) {
  return executeOne(registry, call, actor);
}

async function executeOne(registry, call, actor) {
  const args = call.args || {};
  switch (call.tool) {
    case 'addTenant': {
      assertToolAllowed(actor, 'addTenant', {}, registry);
      const before = listTenants(registry).length;
      const tenant = addTenant(registry, { name: args.name });
      const existed = listTenants(registry).length === before && tenant;
      return {
        summary: existed && tenant.name.toLowerCase() === String(args.name || '').toLowerCase()
          ? `Tenant ${tenant.name} is already in the CMS — not creating another heading`
          : `Added tenant ${tenant.name}`,
        data: tenant,
      };
    }
    case 'addStation': {
      const tenant = resolveTenantNamed(registry, args.tenant || args.tenantId);
      if (!tenant) throw new Error('Which tenant should this station sit under?');
      assertToolAllowed(actor, 'addStation', { tenantId: tenant.id }, registry);
      const site = addSite(registry, {
        tenantId: tenant.id,
        name: args.name,
        city: canonicalCity(args.city || ''),
      });
      return {
        summary: `Added station ${site.name} under ${tenant.name}${site.city ? ` (${site.city})` : ''}`,
        data: site,
      };
    }
    case 'addChargePoint': {
      let tenant = resolveTenantNamed(registry, args.tenant || args.tenantId);
      let site = resolveSite(registry, args.site || args.siteId || args.station, tenant?.id);
      if (!tenant && site) tenant = registry.tenants.get(site.tenantId) || null;
      if (!tenant) throw new Error('Which tenant should this charge point sit under? Call ask_operator with slot tenant.');
      if (!site) throw new Error('Which station under that tenant? Call ask_operator with slot site.');
      assertToolAllowed(actor, 'addChargePoint', { tenantId: tenant.id || site.tenantId, siteId: site.id }, registry);
      const stationId = nextCpId(registry, args.stationId || args.id);
      const cp = registry.enrollStation({
        stationId,
        siteId: site.id,
        tenantId: tenant?.id || site.tenantId,
      });
      emitOrg(registry);
      const urls = stationUrls(cp.stationId);
      return {
        summary: `Enrolled charge point ${cp.stationId}${site ? ` at ${site.name}` : ''}. Commission WSS ${urls.wssUrl}`,
        data: { ...cp, ...urls },
      };
    }
    case 'simulateChargePoint': {
      let tenant = resolveTenantNamed(registry, args.tenant || args.tenantId);
      let site = resolveSite(registry, args.site || args.siteId, tenant?.id);
      if (!tenant && site) tenant = registry.tenants.get(site.tenantId) || null;
      if (!tenant) throw new Error('Which tenant should the simulated charger sit under? Call ask_operator with slot tenant.');
      if (!site) throw new Error('Which station under that tenant? Call ask_operator with slot site.');
      assertToolAllowed(actor, 'simulateChargePoint', { tenantId: tenant.id || site.tenantId, siteId: site.id }, registry);
      const cp = registry.simulateStation({
        siteId: site?.id,
        tenantId: tenant?.id || site?.tenantId,
        stationId: nextCpId(registry, args.stationId || args.id),
      });
      emitOrg(registry);
      return {
        summary: `Simulated charge point ${cp.stationId}${site ? ` at ${site.name}` : ''}`,
        data: cp,
      };
    }
    case 'moveChargePoint': {
      const cp = resolveChargePoint(registry, args.stationId);
      if (!cp) throw new Error(`Charge point ${args.stationId} not found`);
      const site = resolveSite(registry, args.site);
      if (!site) throw new Error(`Station ${args.site} not found`);
      assertToolAllowed(actor, 'moveChargePoint', { tenantId: site.tenantId, siteId: site.id, stationId: cp.stationId }, registry);
      const station = registry.getStation(cp.stationId);
      assignChargePoint(registry, cp.stationId, { siteId: site.id });
      registry.emitStation(station);
      emitOrg(registry);
      return { summary: `Moved ${cp.stationId} to ${site.name}`, data: { stationId: cp.stationId, siteId: site.id } };
    }
    case 'addToken': {
      assertToolAllowed(actor, 'addToken', {}, registry);
      const token = registry.upsertToken({
        idToken: args.idToken,
        type: args.type || 'ISO14443',
        status: 'Accepted',
      });
      return { summary: `Added token ${token.idToken} (${token.status})`, data: token };
    }
    case 'blockToken': {
      assertToolAllowed(actor, 'blockToken', {}, registry);
      const token = registry.upsertToken({
        idToken: args.idToken,
        type: args.type || 'ISO14443',
        status: 'Blocked',
      });
      return { summary: `Blocked token ${token.idToken}`, data: token };
    }
    case 'addTariff': {
      assertToolAllowed(actor, 'addTariff', {}, registry);
      const tariff = registry.addTariff({
        tariffId: args.tariffId,
        energyKwh: args.energyKwh ?? 0.39,
        currency: args.currency || 'EUR',
        description: args.description || 'Added by Ask Helios',
      });
      return {
        summary: `Added tariff ${tariff.tariffId} at ${tariff.currency} ${tariff.energyKwh}/kWh`,
        data: tariff,
      };
    }
    case 'setDefaultTariff': {
      const cp = resolveChargePoint(registry, args.stationId);
      if (!cp) throw new Error(`Charge point ${args.stationId} not found`);
      assertToolAllowed(actor, 'setDefaultTariff', { stationId: cp.stationId }, registry);
      const tariff = resolveTariff(registry, args.tariffId);
      if (!tariff) throw new Error('No tariff in the book');
      if (cp.simulated) {
        const result = await registry.callStation(cp.stationId, 'SetDefaultTariff', {
          evseId: 1,
          tariffId: tariff.tariffId,
        });
        return { summary: `Set default tariff ${tariff.tariffId} on simulated ${cp.stationId}`, data: result };
      }
      throw new Error(
        `${cp.stationId} is a live charge point — Approve SetDefaultTariff from the action queue instead of sending it silently`
      );
    }
    case 'addReservation': {
      const cp = resolveChargePoint(registry, args.stationId) || resolveSite(registry, args.stationId);
      const stationId = cp?.stationId || args.stationId;
      assertToolAllowed(actor, 'addReservation', { stationId }, registry);
      if (!registry.getStation(stationId)) throw new Error(`Charge point ${args.stationId} not found`);
      const reservation = registry.addReservation({
        stationId,
        evseId: args.evseId ?? 1,
        localOnly: true,
      });
      return {
        summary: `Booked reservation #${reservation.id} on ${stationId} (CMS only — live ReserveNow still needs Approve)`,
        data: reservation,
      };
    }
    case 'saveSite': {
      assertToolAllowed(actor, 'saveSite', {}, registry);
      const saved = saveSiteRecommendation(registry, { city: canonicalCity(args.city) });
      return { summary: `Saved next-site candidate ${saved.city}`, data: saved };
    }
    default:
      throw new Error(`Unknown tool ${call.tool}`);
  }
}

function chainCalls(calls) {
  let tenant = '';
  let site = '';
  return calls.map((c) => {
    const args = { ...(c.args || {}) };
    if (c.tool === 'addTenant' && args.name) tenant = args.name;
    if (c.tool === 'addStation') {
      if (!args.tenant && tenant) args.tenant = tenant;
      if (args.name) site = args.name;
    }
    if ((c.tool === 'addChargePoint' || c.tool === 'simulateChargePoint')) {
      if (!args.tenant && tenant) args.tenant = tenant;
      if (!args.site && site) args.site = site;
    }
    return { ...c, args };
  });
}

function parseForRun(question, multitask) {
  const q = String(question || '');
  if (multitask || /;|\band then\b|\balso add\b|\bplus\b|^\s*\d+[.)]/m.test(q)) {
    return parseMultitaskIntents(q);
  }
  return parseAgentIntents(q);
}

export async function runAgent(registry, question, extraTools = [], { multitask = false, actor = null, presetCalls = null } = {}) {
  const parsed = chainCalls([
    ...(Array.isArray(presetCalls) ? presetCalls : parseForRun(question, multitask)),
    ...(Array.isArray(presetCalls) ? [] : extraTools.filter((t) => t && ALLOWED_TOOLS.has(t.tool))),
  ]);
  const seen = new Set();
  const calls = parsed.filter((c) => {
    const key = `${c.tool}:${JSON.stringify(c.args || {})}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  const executed = [];
  for (const call of calls) {
    try {
      const result = await executeOne(registry, call, actor);
      executed.push({ tool: call.tool, args: call.args, ok: true, summary: result.summary, data: result.data });
    } catch (err) {
      executed.push({
        tool: call.tool,
        args: call.args,
        ok: false,
        error: err.message,
        summary: err.message,
      });
    }
  }
  return executed;
}

function toolTitle(call) {
  const a = call.args || {};
  switch (call.tool) {
    case 'addTenant':
      return `Create tenant ${a.name}`;
    case 'addStation':
      return `Add station ${a.name}${a.city ? ` in ${a.city}` : ''}${a.tenant ? ` under ${a.tenant}` : ''}`;
    case 'addChargePoint':
      return `Enroll charge point ${a.stationId || '(auto ID)'}${a.site ? ` at ${a.site}` : ''}`;
    case 'simulateChargePoint':
      return `Simulate a charger${a.site ? ` at ${a.site}` : ''}`;
    case 'moveChargePoint':
      return `Move ${a.stationId} to ${a.site}`;
    case 'addToken':
      return `Add token ${a.idToken}`;
    case 'blockToken':
      return `Block token ${a.idToken}`;
    case 'addTariff':
      return `Add tariff ${a.tariffId}${a.energyKwh != null ? ` at ${a.energyKwh}` : ''}`;
    case 'setDefaultTariff':
      return `Set default tariff ${a.tariffId} on ${a.stationId}`;
    case 'addReservation':
      return `Add a reservation on ${a.stationId}`;
    case 'saveSite':
      return `Save next-site candidate ${a.city}`;
    default:
      return call.tool;
  }
}

export function callsToPlan(calls) {
  return (calls || []).map((c, i) => ({
    id: `step-${i + 1}`,
    step: i + 1,
    tool: c.tool,
    args: c.args || {},
    title: toolTitle(c),
  }));
}

export function parseMultitaskIntents(question) {
  const raw = String(question || '').trim();
  const parts = raw
    .split(
      /\s*;\s*|\n+|\s+and then\s+|\s+then add\s+|\s+and also\s+|\s+plus\s+|\s+also\s+(?=add|create|enroll|simulate|block)|,\s*(?=add|create|enroll|simulate|then)|^\s*\d+[.)]\s+/im
    )
    .map((s) => s.trim().replace(/^(then|and|also)\s+/i, ''))
    .filter(Boolean);
  const source = parts.length > 1 ? parts : [raw];
  const seen = new Set();
  const calls = [];
  source.forEach((part, i) => {
    let clause = part;
    if (i > 0 && !wantsMutation(clause) && !looksLikeQuestion(clause)) clause = `add ${clause}`;
    for (const c of parseAgentIntents(clause)) {
      const key = `${c.tool}:${JSON.stringify(c.args || {})}`;
      if (seen.has(key)) continue;
      seen.add(key);
      calls.push(c);
    }
  });
  if (!calls.length) return parseAgentIntents(raw);
  return calls;
}

export function buildPlan(question) {
  return parseMultitaskIntents(question).map((c, i) => ({
    id: `step-${i + 1}`,
    step: i + 1,
    tool: c.tool,
    args: c.args || {},
    title: toolTitle(c),
  }));
}

export function formatPlan(plan) {
  if (!plan.length) return '';
  return (
    `**Plan — nothing has been changed yet**\n` +
    plan
      .map((s) => {
        let line = `${s.step}. ${s.title}`;
        if (s.note) line += `\n   ${s.note}`;
        if (s.risk) line += `\n   Risk: ${s.risk}`;
        return line;
      })
      .join('\n') +
    `\n\nRun CMS jobs in **Agent** or **Multitask**. Live OCPP still needs **Approve**.`
  );
}

export function stripLlmTools(text) {
  return parseLlmTools(text);
}

export function formatAgentReport(executed) {
  if (!executed.length) return '';
  const ok = executed.filter((e) => e.ok);
  const fail = executed.filter((e) => !e.ok);
  const lines = [];
  if (ok.length) lines.push(ok.map((e) => `• ${e.summary}`).join('\n'));
  if (fail.length) lines.push(fail.map((e) => `• Could not complete ${e.tool}: ${e.error}`).join('\n'));
  return `**Done in the CMS**\n${lines.join('\n')}`;
}

export const AGENT_TOOL_GUIDE = `You can mutate this lab CMS. Prefer native tool calls when the API supports them. Otherwise append this block after your reply (and only then):

<<<TOOLS
[{"tool":"addStation","args":{"name":"Koramangala Hub","city":"Bengaluru","tenant":"Helios"}}]
TOOLS>>>

Allowed tools and args:
- addTenant { name }
- addStation { name, city, tenant }
- addChargePoint { stationId, site, tenant }
- simulateChargePoint { site, stationId?, tenant }
- moveChargePoint { stationId, site }
- addToken { idToken }
- blockToken { idToken }
- addTariff { tariffId, energyKwh }
- setDefaultTariff { tariffId, stationId }
- addReservation { stationId }
- saveSite { city }

Do not emit TOOLS for how-to or explain questions. Do not emit Reset, UpdateFirmware, RequestStopTransaction, or ChangeAvailability — those stay on the Approve queue. Do not claim live OCPP already ran.
When adding a charge point: ask_operator slot tenant first. Then ask_operator slot site with only that tenant’s hubs. Never list stations from every tenant at once.`;

const TOOL_SCHEMAS = [
  ['addTenant', 'Create or reuse a tenant (CPO) heading', { name: 'string' }, ['name']],
  ['addStation', 'Add a charging station/site under a tenant', { name: 'string', city: 'string', tenant: 'string' }, ['name']],
  ['addChargePoint', 'Enroll an OCPP charge point. Ask tenant first, then that tenant’s station, then stationId unless Auto.', { stationId: 'string', site: 'string', tenant: 'string' }, ['site']],
  ['simulateChargePoint', 'Add a simulated (no WebSocket) charge point. Ask tenant first, then station, then stationId unless Auto.', { site: 'string', stationId: 'string', tenant: 'string' }, ['site']],
  ['moveChargePoint', 'Move a charge point to another station', { stationId: 'string', site: 'string' }, ['stationId', 'site']],
  ['addToken', 'Add an RFID / id token', { idToken: 'string', type: 'string' }, ['idToken']],
  ['blockToken', 'Block an id token', { idToken: 'string' }, ['idToken']],
  ['addTariff', 'Add a tariff to the book', { tariffId: 'string', energyKwh: 'number', currency: 'string' }, ['tariffId']],
  ['setDefaultTariff', 'SetDefaultTariff on a simulated CP only', { tariffId: 'string', stationId: 'string' }, ['tariffId', 'stationId']],
  ['addReservation', 'CMS-only reservation row', { stationId: 'string' }, ['stationId']],
  ['saveSite', 'Save a site-planner city candidate', { city: 'string' }, ['city']],
];

function propsFrom(fields) {
  return Object.fromEntries(Object.entries(fields).map(([k, t]) => [k, { type: t === 'number' ? 'number' : 'string' }]));
}

export function openaiToolDefs() {
  return TOOL_SCHEMAS.map(([name, description, fields, required]) => ({
    type: 'function',
    function: {
      name,
      description,
      parameters: { type: 'object', properties: propsFrom(fields), required },
    },
  }));
}

export function claudeToolDefs() {
  return TOOL_SCHEMAS.map(([name, description, fields, required]) => ({
    name,
    description,
    input_schema: { type: 'object', properties: propsFrom(fields), required },
  }));
}

export function toolsFromOpenAiMessage(message) {
  return (message?.tool_calls || [])
    .map((c) => {
      const name = c.function?.name;
      if (!ALLOWED_TOOLS.has(name)) return null;
      let args = {};
      try {
        args = JSON.parse(c.function?.arguments || '{}');
      } catch {
        args = {};
      }
      return { tool: name, args };
    })
    .filter(Boolean);
}

export function toolsFromClaudeContent(content) {
  return (content || [])
    .filter((b) => b && b.type === 'tool_use' && ALLOWED_TOOLS.has(b.name))
    .map((b) => ({ tool: b.name, args: b.input && typeof b.input === 'object' ? b.input : {} }));
}
