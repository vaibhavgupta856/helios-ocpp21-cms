/**
 * Lab IAM: roles, user assignment, and Ask Helios chat history.
 * Identity is the x-cms-user header (operator switcher) — not production auth.
 */

import { randomUUID } from 'crypto';
import fs from 'fs';
import path from 'path';
import { CERT_DIR } from './tls.js';

const CHATS_FILE = () => path.join(CERT_DIR, 'chats.json');

export const ROLES = [
  {
    id: 'super_admin',
    label: 'Super admin',
    rank: 4,
    blurb: 'Full CMS, every station, users, and roles — including other super admins.',
  },
  {
    id: 'admin',
    label: 'Admin',
    rank: 3,
    blurb: 'Operate the whole CMS and manage users and members. Cannot create or change super admins.',
  },
  {
    id: 'user',
    label: 'User',
    rank: 2,
    blurb: 'Operate assigned tenants and stations. Ask, Plan, and Agent. Cannot add tenants or manage users.',
  },
  {
    id: 'member',
    label: 'Member',
    rank: 1,
    blurb: 'Read assigned sites. Ask and Plan only — no CMS writes, no live OCPP, no Agent.',
  },
];

export const PERMISSIONS = [
  { id: 'nav.dashboard', label: 'Dashboard', group: 'Pages' },
  { id: 'nav.twin', label: 'Digital twin', group: 'Pages' },
  { id: 'nav.assistant', label: 'Ask Helios', group: 'Pages' },
  { id: 'nav.stations', label: 'Stations', group: 'Pages' },
  { id: 'nav.sessions', label: 'Sessions', group: 'Pages' },
  { id: 'nav.tokens', label: 'RFID & tokens', group: 'Pages' },
  { id: 'nav.tariffs', label: 'Tariffs', group: 'Pages' },
  { id: 'nav.demand', label: 'Demand', group: 'Pages' },
  { id: 'nav.sites', label: 'Site planner', group: 'Pages' },
  { id: 'nav.smart-charging', label: 'Smart charging', group: 'Pages' },
  { id: 'nav.security', label: 'Security', group: 'Pages' },
  { id: 'nav.roles', label: 'Roles & users', group: 'Pages' },
  { id: 'org.tenant', label: 'Add tenant', group: 'Org' },
  { id: 'org.site', label: 'Add station', group: 'Org' },
  { id: 'org.enroll', label: 'Enroll charge point', group: 'Org' },
  { id: 'org.assign', label: 'Move charge point', group: 'Org' },
  { id: 'org.simulate', label: 'Simulate charge point', group: 'Org' },
  { id: 'tokens.write', label: 'Add / block tokens', group: 'Operate' },
  { id: 'tariffs.write', label: 'Create tariffs', group: 'Operate' },
  { id: 'reservations.write', label: 'Create reservations', group: 'Operate' },
  { id: 'ocpp.call', label: 'Send OCPP to a charge point', group: 'Operate' },
  { id: 'actions.propose', label: 'Queue recommended actions', group: 'Operate' },
  { id: 'actions.approve', label: 'Approve live OCPP actions', group: 'Operate' },
  { id: 'sites.recommend', label: 'Save site-planner candidates', group: 'Plan' },
  { id: 'security.write', label: 'Change CSMS security profile', group: 'Setup' },
  { id: 'assistant.ask', label: 'Ask mode', group: 'Assistant' },
  { id: 'assistant.plan', label: 'Plan mode', group: 'Assistant' },
  { id: 'assistant.agent', label: 'Agent mode', group: 'Assistant' },
  { id: 'assistant.multitask', label: 'Multitask mode', group: 'Assistant' },
  { id: 'users.read', label: 'View users & roles', group: 'IAM' },
  { id: 'users.write', label: 'Create and edit users', group: 'IAM' },
  { id: 'users.super', label: 'Assign Super admin', group: 'IAM' },
  { id: 'chats.own', label: 'Own / assigned chats', group: 'IAM' },
  { id: 'chats.all', label: 'All chat history', group: 'IAM' },
];

const ADMIN_PERMS = PERMISSIONS.map((p) => p.id).filter((id) => id !== 'users.super');

export const ROLE_PERMS = {
  super_admin: ['*'],
  admin: ADMIN_PERMS,
  user: [
    'nav.dashboard',
    'nav.twin',
    'nav.assistant',
    'nav.stations',
    'nav.sessions',
    'nav.tokens',
    'nav.tariffs',
    'nav.demand',
    'nav.sites',
    'nav.smart-charging',
    'org.site',
    'org.enroll',
    'org.simulate',
    'tokens.write',
    'tariffs.write',
    'ocpp.call',
    'actions.propose',
    'actions.approve',
    'assistant.ask',
    'assistant.plan',
    'assistant.agent',
    'chats.own',
  ],
  member: [
    'nav.dashboard',
    'nav.twin',
    'nav.assistant',
    'nav.stations',
    'nav.sessions',
    'nav.demand',
    'assistant.ask',
    'assistant.plan',
    'chats.own',
  ],
};

export const TOOL_PERMS = {
  addTenant: 'org.tenant',
  addStation: 'org.site',
  addChargePoint: 'org.enroll',
  simulateChargePoint: 'org.simulate',
  moveChargePoint: 'org.assign',
  addToken: 'tokens.write',
  blockToken: 'tokens.write',
  addTariff: 'tariffs.write',
  setDefaultTariff: 'ocpp.call',
  addReservation: 'reservations.write',
  saveSite: 'sites.recommend',
};

const ROLE_BY_ID = Object.fromEntries(ROLES.map((r) => [r.id, r]));

export function roleLabel(role) {
  return ROLE_BY_ID[role]?.label || role;
}

export function roleRank(role) {
  return ROLE_BY_ID[role]?.rank || 0;
}

export function permissionsFor(role) {
  const list = ROLE_PERMS[role] || ROLE_PERMS.member;
  if (list.includes('*')) return ['*', ...PERMISSIONS.map((p) => p.id)];
  return [...list];
}

export function can(user, perm) {
  if (!user || !perm) return false;
  const perms = user.permissions || permissionsFor(user.role);
  if (perms.includes('*') || perms.includes(perm)) return true;
  const ns = String(perm).split('.')[0];
  return perms.includes(`${ns}.*`);
}

export function publicUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    roleLabel: roleLabel(user.role),
    tenantIds: [...(user.tenantIds || [])],
    siteIds: [...(user.siteIds || [])],
    permissions: permissionsFor(user.role),
    createdAt: user.createdAt,
  };
}

function iso() {
  return new Date().toISOString();
}

function ids(list) {
  return [...new Set((Array.isArray(list) ? list : []).map((x) => String(x || '').trim()).filter(Boolean))];
}

export function isUnscoped(user) {
  if (!user) return true;
  if (can(user, '*') || user.role === 'admin' || can(user, 'chats.all')) return true;
  return !(user.tenantIds || []).length && !(user.siteIds || []).length;
}

export function assertAssigned(user, scope = {}, registry) {
  if (!user || isUnscoped(user)) return;
  let tenantId = String(scope.tenantId || '').trim();
  let siteId = String(scope.siteId || '').trim();
  const stationId = String(scope.stationId || '').trim();
  if (stationId && registry) {
    const snap = registry.getStation?.(stationId)?.snapshot?.() || registry.getStation?.(stationId);
    const org = registry.cpOrg?.get?.(stationId) || {};
    siteId = siteId || snap?.siteId || org.siteId || '';
    tenantId = tenantId || snap?.tenantId || org.tenantId || '';
  }
  if (siteId) {
    if ((user.siteIds || []).includes(siteId)) return;
    const site = registry?.sites?.get?.(siteId);
    if (site && (user.tenantIds || []).includes(site.tenantId)) return;
    throw new Error(`${user.name} is not assigned to this station`);
  }
  if (tenantId) {
    if ((user.tenantIds || []).includes(tenantId)) return;
    throw new Error(`${user.name} is not assigned to this tenant`);
  }
}

export function assertToolAllowed(user, tool, scope, registry) {
  if (!user) return;
  const perm = TOOL_PERMS[tool];
  if (perm && !can(user, perm)) {
    throw new Error(`${user.name} (${roleLabel(user.role)}) cannot run ${tool}`);
  }
  assertAssigned(user, scope || {}, registry);
}

function seedUsers() {
  const at = iso();
  return [
    {
      id: 'user-vaibhav',
      name: 'Vaibhav Gupta',
      email: 'vaibhav@massive.local',
      role: 'super_admin',
      tenantIds: [],
      siteIds: [],
      createdAt: at,
    },
    {
      id: 'user-anika',
      name: 'Anika Sharma',
      email: 'anika@massive.local',
      role: 'super_admin',
      tenantIds: [],
      siteIds: [],
      createdAt: at,
    },
    {
      id: 'user-rohan',
      name: 'Rohan Mehta',
      email: 'rohan@massive.local',
      role: 'admin',
      tenantIds: [],
      siteIds: [],
      createdAt: at,
    },
    {
      id: 'user-priya',
      name: 'Priya Nair',
      email: 'priya@massive.local',
      role: 'user',
      tenantIds: ['tenant-massive'],
      siteIds: ['site-blr-whitefield', 'site-hyd-hitech'],
      createdAt: at,
    },
    {
      id: 'user-arjun',
      name: 'Arjun Rao',
      email: 'arjun@orbit.local',
      role: 'member',
      tenantIds: ['tenant-orbit'],
      siteIds: ['site-mum-bkc'],
      createdAt: at,
    },
  ];
}

function seedChats(users) {
  const vaibhav = users.find((u) => u.id === 'user-vaibhav');
  const anika = users.find((u) => u.id === 'user-anika');
  const rohan = users.find((u) => u.id === 'user-rohan');
  const t0 = new Date(Date.now() - 36e5).toISOString();
  const t1 = new Date(Date.now() - 30e5).toISOString();
  const t2 = new Date(Date.now() - 24e5).toISOString();
  const t3 = new Date(Date.now() - 18e5).toISOString();
  return [
    {
      id: 'chat-vaibhav-ops',
      title: 'Summarize the network this week',
      createdBy: vaibhav.id,
      createdByName: vaibhav.name,
      assignedTo: [vaibhav.id, anika.id, rohan.id],
      createdAt: t0,
      updatedAt: t1,
      messages: [
        {
          id: 'msg-v1',
          role: 'user',
          content: 'Summarize every hub: what is wrong, what to keep, and the next 7-day plan.',
          userId: vaibhav.id,
          userName: vaibhav.name,
          mode: 'ask',
          at: t0,
        },
        {
          id: 'msg-v2',
          role: 'assistant',
          content: 'Ask me again after the live briefing loads — I will score each hub keep / watch / consider remove from sessions and online CPs, then a 7-day ops plan.',
          userId: null,
          userName: 'Helios',
          mode: 'ask',
          at: t1,
        },
      ],
    },
    {
      id: 'chat-lab-ops',
      title: 'What is online right now?',
      createdBy: anika.id,
      createdByName: anika.name,
      assignedTo: [anika.id, rohan.id, vaibhav.id],
      createdAt: t0,
      updatedAt: t3,
      messages: [
        {
          id: 'msg-1',
          role: 'user',
          content: 'What is online right now?',
          userId: anika.id,
          userName: anika.name,
          mode: 'ask',
          at: t0,
        },
        {
          id: 'msg-2',
          role: 'assistant',
          content:
            'This is the shared ops thread. Switch **Act as** in the header to see how Admin vs Member changes Ask Helios.\n\nAsk mode only explains the live CMS. Agent and Multitask are limited by role.',
          userId: null,
          userName: 'Helios',
          mode: 'ask',
          at: t1,
        },
        {
          id: 'msg-3',
          role: 'user',
          content: 'Why did revenue drop?',
          userId: rohan.id,
          userName: rohan.name,
          mode: 'ask',
          at: t2,
        },
        {
          id: 'msg-4',
          role: 'assistant',
          content:
            'Rohan asked this follow-up. Each question keeps the operator who typed it, so the thread is an audit log — not a single anonymous “You”.',
          userId: null,
          userName: 'Helios',
          mode: 'ask',
          at: t3,
        },
      ],
    },
  ];
}

function titleFromQuestion(question) {
  const t = String(question || '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!t) return 'New chat';
  return t.length > 56 ? `${t.slice(0, 53)}…` : t;
}

function previewOf(chat) {
  const lastUser = [...(chat.messages || [])].reverse().find((m) => m.role === 'user');
  return lastUser
    ? { lastPreview: lastUser.content.slice(0, 80), lastUserName: lastUser.userName, lastUserId: lastUser.userId }
    : { lastPreview: '', lastUserName: '', lastUserId: null };
}

function loadPersistedChats() {
  try {
    const data = JSON.parse(fs.readFileSync(CHATS_FILE(), 'utf8'));
    const list = Array.isArray(data?.chats) ? data.chats : [];
    return {
      chats: list.filter((c) => c && c.id),
      chatSeq: Number(data?.chatSeq) || 0,
    };
  } catch {
    return { chats: [], chatSeq: 0 };
  }
}

function chatSeqFrom(list, fallback) {
  let max = fallback;
  for (const c of list) {
    const m = String(c.id || '').match(/^chat-(\d+)$/);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return max + 1;
}

export function createIam() {
  const users = new Map();
  const chats = new Map();
  for (const u of seedUsers()) users.set(u.id, u);
  const persisted = loadPersistedChats();
  const initial = persisted.chats.length ? persisted.chats : seedChats([...users.values()]);
  for (const c of initial) {
    chats.set(c.id, {
      ...c,
      messages: Array.isArray(c.messages) ? c.messages : [],
      assignedTo: Array.isArray(c.assignedTo) ? c.assignedTo : [],
      pendingJob: c.pendingJob || null,
      livePackEnabled: !!c.livePackEnabled,
      livePackAt: c.livePackAt || null,
      livePackSummary: c.livePackSummary || null,
    });
  }
  let userSeq = users.size + 1;
  let chatSeq = Math.max(persisted.chatSeq || 0, chatSeqFrom(initial, chats.size));

  const persistChats = () => {
    try {
      fs.mkdirSync(CERT_DIR, { recursive: true });
      fs.writeFileSync(
        CHATS_FILE(),
        JSON.stringify({ chatSeq, chats: [...chats.values()] }, null, 2)
      );
    } catch {
      /* ignore */
    }
  };

  const iam = {
    defaultUserId: 'user-vaibhav',

    getUser(id) {
      return users.get(String(id || '').trim()) || null;
    },

    listUsers() {
      return [...users.values()].sort((a, b) => roleRank(b.role) - roleRank(a.role) || a.name.localeCompare(b.name));
    },

    catalog() {
      return { roles: ROLES, permissions: PERMISSIONS, matrix: ROLE_PERMS };
    },

    assertCanSetRole(actor, newRole, target) {
      if (!ROLES.some((r) => r.id === newRole)) throw new Error('Unknown role');
      if (roleRank(newRole) > roleRank(actor.role)) throw new Error('You cannot assign a role above yours');
      if (newRole === 'super_admin' && !can(actor, 'users.super')) {
        throw new Error('Only a super admin can assign Super admin');
      }
      if (target?.role === 'super_admin' && !can(actor, 'users.super')) {
        throw new Error('You cannot change a super admin');
      }
    },

    addUser(actor, body = {}) {
      if (!can(actor, 'users.write')) throw Object.assign(new Error('You cannot create users'), { status: 403 });
      const name = String(body.name || '').trim();
      const email = String(body.email || '').trim().toLowerCase();
      const role = String(body.role || 'member').trim();
      if (!name) throw new Error('Name is required');
      if (!email) throw new Error('Email is required');
      iam.assertCanSetRole(actor, role, null);
      if ([...users.values()].some((u) => u.email === email)) throw new Error('Email already in use');
      const rec = {
        id: String(body.id || `user-${userSeq++}`).trim(),
        name,
        email,
        role,
        tenantIds: ids(body.tenantIds),
        siteIds: ids(body.siteIds),
        createdAt: iso(),
      };
      if (users.has(rec.id)) throw new Error('User already exists');
      users.set(rec.id, rec);
      return rec;
    },

    patchUser(actor, id, body = {}) {
      if (!can(actor, 'users.write')) throw Object.assign(new Error('You cannot edit users'), { status: 403 });
      const rec = iam.getUser(id);
      if (!rec) throw Object.assign(new Error('User not found'), { status: 404 });
      const next = { ...rec };
      if (body.name != null) next.name = String(body.name).trim() || rec.name;
      if (body.email != null) {
        const email = String(body.email).trim().toLowerCase();
        if (!email) throw new Error('Email is required');
        if ([...users.values()].some((u) => u.email === email && u.id !== rec.id)) throw new Error('Email already in use');
        next.email = email;
      }
      if (body.role != null && body.role !== rec.role) {
        iam.assertCanSetRole(actor, String(body.role), rec);
        if (rec.role === 'super_admin' && body.role !== 'super_admin') {
          const supers = iam.listUsers().filter((u) => u.role === 'super_admin');
          if (supers.length <= 1) throw new Error('Keep at least one super admin');
        }
        next.role = String(body.role);
      }
      if (body.tenantIds) next.tenantIds = ids(body.tenantIds);
      if (body.siteIds) next.siteIds = ids(body.siteIds);
      users.set(rec.id, next);
      return next;
    },

    removeUser(actor, id) {
      if (!can(actor, 'users.write')) throw Object.assign(new Error('You cannot remove users'), { status: 403 });
      const rec = iam.getUser(id);
      if (!rec) throw Object.assign(new Error('User not found'), { status: 404 });
      if (rec.id === actor.id) throw new Error('You cannot remove yourself');
      if (rec.role === 'super_admin' && !can(actor, 'users.super')) throw new Error('You cannot remove a super admin');
      if (rec.role === 'super_admin') {
        const supers = iam.listUsers().filter((u) => u.role === 'super_admin');
        if (supers.length <= 1) throw new Error('Keep at least one super admin');
      }
      users.delete(rec.id);
      return rec;
    },

    canSeeChat(user, chat) {
      if (!chat) return false;
      if (can(user, 'chats.all')) return true;
      if (chat.createdBy === user.id) return true;
      return (chat.assignedTo || []).includes(user.id);
    },

    listChats(user) {
      return [...chats.values()]
        .filter((c) => iam.canSeeChat(user, c))
        .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)))
        .map((c) => iam.publicChat(c, false));
    },

    getChat(id) {
      return chats.get(String(id || '').trim()) || null;
    },

    publicChat(chat, withMessages = true) {
      if (!chat) return null;
      const assigned = (chat.assignedTo || []).map((id) => iam.getUser(id)).filter(Boolean);
      const extra = previewOf(chat);
      return {
        id: chat.id,
        title: chat.title,
        createdBy: chat.createdBy,
        createdByName: chat.createdByName,
        assignedTo: [...(chat.assignedTo || [])],
        assignedNames: assigned.map((u) => u.name),
        createdAt: chat.createdAt,
        updatedAt: chat.updatedAt,
        messageCount: (chat.messages || []).filter((m) => m.role === 'user').length,
        livePackEnabled: !!chat.livePackEnabled,
        livePackAt: chat.livePackAt || null,
        livePackSummary: chat.livePackSummary || null,
        ...extra,
        messages: withMessages ? (chat.messages || []).map((m) => ({ ...m })) : undefined,
      };
    },

    createChat(actor, body = {}) {
      const assignedTo = ids(body.assignedTo);
      if (!assignedTo.includes(actor.id)) assignedTo.unshift(actor.id);
      const rec = {
        id: `chat-${chatSeq++}`,
        title: String(body.title || 'New chat').trim() || 'New chat',
        createdBy: actor.id,
        createdByName: actor.name,
        assignedTo,
        createdAt: iso(),
        updatedAt: iso(),
        messages: [],
        pendingJob: null,
        livePackEnabled: false,
        livePackAt: null,
        livePackSummary: null,
      };
      chats.set(rec.id, rec);
      persistChats();
      return rec;
    },

    patchChat(actor, id, body = {}) {
      const chat = iam.getChat(id);
      if (!chat) throw Object.assign(new Error('Chat not found'), { status: 404 });
      if (!iam.canSeeChat(actor, chat)) throw Object.assign(new Error('Chat not found'), { status: 404 });
      const canAssign = can(actor, 'chats.all') || chat.createdBy === actor.id;
      if (body.title != null) chat.title = String(body.title).trim() || chat.title;
      if (body.assignedTo && canAssign) {
        const next = ids(body.assignedTo);
        if (!next.includes(chat.createdBy)) next.unshift(chat.createdBy);
        chat.assignedTo = next;
      } else if (body.assignedTo && !canAssign) {
        throw Object.assign(new Error('You cannot assign this chat'), { status: 403 });
      }
      chat.updatedAt = iso();
      persistChats();
      return chat;
    },

    removeChat(actor, id) {
      const chat = iam.getChat(id);
      if (!chat) throw Object.assign(new Error('Chat not found'), { status: 404 });
      if (!iam.canSeeChat(actor, chat)) throw Object.assign(new Error('Chat not found'), { status: 404 });
      if (!(can(actor, 'chats.all') || chat.createdBy === actor.id)) {
        throw Object.assign(new Error('You cannot delete this chat'), { status: 403 });
      }
      chats.delete(chat.id);
      persistChats();
      return chat;
    },

    setLivePack(chat, summary) {
      if (!chat) return null;
      chat.livePackEnabled = true;
      chat.livePackAt = iso();
      chat.livePackSummary = summary || null;
      chat.updatedAt = chat.livePackAt;
      if (chat.title === 'New chat' || !chat.title) chat.title = 'Live CMS';
      persistChats();
      return chat;
    },

    appendMessage(chat, msg) {
      if (!Array.isArray(chat.messages)) chat.messages = [];
      const rec = {
        id: msg.id || randomUUID(),
        role: msg.role,
        content: String(msg.content || ''),
        userId: msg.userId ?? null,
        userName: msg.userName || (msg.role === 'assistant' ? 'Helios' : 'Unknown'),
        mode: msg.mode || null,
        source: msg.source || null,
        model: msg.model || null,
        plan: msg.plan || [],
        proposedActions: msg.proposedActions || [],
        executedActions: msg.executedActions || [],
        pending: msg.pending || null,
        needsInput: !!msg.needsInput,
        suggestions: Array.isArray(msg.suggestions) ? msg.suggestions.filter(Boolean).slice(0, 6) : [],
        at: msg.at || iso(),
      };
      chat.messages.push(rec);
      chat.updatedAt = rec.at;
      if (msg.role === 'user' && (chat.title === 'New chat' || !chat.title)) {
        chat.title = titleFromQuestion(rec.content);
      }
      persistChats();
      return rec;
    },
  };

  persistChats();
  return iam;
}

export function attachUser(iam) {
  return (req, _res, next) => {
    const id = String(req.headers['x-cms-user'] || iam.defaultUserId).trim();
    const user = iam.getUser(id) || iam.getUser(iam.defaultUserId);
    req.cmsUser = publicUser(user);
    next();
  };
}

export function requirePerm(perm) {
  return (req, res, next) => {
    if (!can(req.cmsUser, perm)) {
      return res.status(403).json({
        error: `${req.cmsUser?.name || 'This user'} (${req.cmsUser?.roleLabel || req.cmsUser?.role}) cannot ${perm}`,
      });
    }
    next();
  };
}

export function denyStatus(err, res) {
  const status = err.status || (/not found/i.test(err.message) ? 404 : /cannot|not assigned|keep at least/i.test(err.message) ? 403 : 400);
  return res.status(status).json({ error: err.message });
}
