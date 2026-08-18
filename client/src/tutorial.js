/** Product tour. Each step names a `data-tour` target and a CMS view to open. */

export const TOUR_VOICE_REV = 'andrew-short-1';

export function tourVoiceUrl(stepId) {
  return `/tour/voice/${encodeURIComponent(stepId)}.mp3?v=${TOUR_VOICE_REV}`;
}

/** On-screen lines must match the spoken clip. */
export function tourCardLines(step) {
  const text = String(step?.voice || '').trim();
  if (text) return text.split(/(?<=[.!?])\s+/).filter(Boolean);
  return step?.body || [];
}

export const TUTORIAL_STEPS = [
  {
    id: 'welcome',
    view: 'dashboard',
    target: 'brand',
    title: 'Helios CSMS',
    body: ['Operator console for the central system. Charge points dial in — we do not dial out.'],
    voice:
      "So this is Helios. It's the central system, the office side, not the charger in the yard. Charge points like Voltforge call in to us. We're on OCPP 2.1. I'll walk you around the header, the pages, then a few screens that sit off the menu.",
  },
  {
    id: 'theme',
    view: 'dashboard',
    target: 'theme',
    cycleThemes: true,
    title: 'Theme',
    body: ['Helios, Dark, Midnight, Forest, Sand, Violet. Pick one anytime.'],
    voice:
      "I'll flip through the looks so you can see the console change. Pick whichever you like later. It sticks in this browser.",
  },
  {
    id: 'actor',
    view: 'dashboard',
    target: 'actor',
    title: 'Act as',
    body: ['Lab identities. Changes whose permissions you are using, including tenants.'],
    voice:
      "Act as is a lab switch. Super admin, operator, member, that kind of thing. It changes whose permissions you have, including which tenants you can see. Chats remember who asked. You're not logging into a different product.",
  },
  {
    id: 'nav',
    view: 'dashboard',
    target: 'nav',
    openNav: true,
    title: 'Pages',
    body: ['Operate, Plan, Setup. Firmware, diagnostics, and the wire sit off this list.'],
    voice:
      "Here's the menu. Operate is the live network. Plan is demand, sites, load. Setup is security and people. Firmware, diagnostics, and the live trace sit off this list. Ask Helios can open any of those if you say the name.",
  },
  {
    id: 'dashboard',
    view: 'dashboard',
    target: 'dash-stats',
    title: 'Dashboard KPIs',
    body: ['Snapshot of the org. Simulate station plants a fake charger if your role allows.'],
    voice:
      "Start here for a snapshot of the org. Who's online, live sessions, that kind of thing. If your role allows it, Simulate station plants a fake charger so the rest of the CMS has something to show.",
  },
  {
    id: 'advisor',
    view: 'dashboard',
    target: 'dash-advisor',
    title: 'Advisor and Approve',
    body: ['Suggestions become cards. Live OCPP waits until someone hits Approve.'],
    voice:
      "The advisor reads the live numbers and throws up suggestions. Reset, firmware, stop session. Those are real OCPP. They don't go out until someone with Approve actually clicks Approve. Dismiss still leaves an audit row.",
  },
  {
    id: 'twin',
    view: 'twin',
    target: 'twin-map',
    title: 'Digital twin map',
    body: ['Green available, amber charging, red offline. Not a replacement for Stations.'],
    voice:
      "This is the map. Green is available, amber is charging, red is offline or unhappy, blue is a hub with no charger yet. Useful picture. Still not where you commission things. That's Stations.",
  },
  {
    id: 'ask',
    view: 'assistant',
    target: 'ask-modes',
    title: 'Ask Helios',
    body: ['Ask answers. Agent can create records. Live OCPP still needs Approve.'],
    voice:
      "Ask Helios. Ask mode just answers from the live CMS. It doesn't create records. Agent can add a tenant or a station, and it'll ask if a name is missing. Plan and Multitask are hidden on purpose. Live OCPP still waits for Approve, even in Agent.",
  },
  {
    id: 'ask-history',
    view: 'assistant',
    target: 'ask-history',
    title: 'Chat history',
    body: ['Threads on the left. Assign lets another operator open the same chat.'],
    voice:
      "Threads live on the left and they survive a restart. Assign lets another operator open the same chat. Delete is just for you.",
  },
  {
    id: 'ask-feed',
    view: 'assistant',
    target: 'ask-feed',
    title: 'Feed live CMS',
    body: ['Packs the fleet into this chat. Local Qwen does not need an API key.'],
    voice:
      "The model doesn't magically remember the fleet. Feed live CMS packs hubs, charge points, and sessions into this chat, and later questions get a fresh copy. API key is for cloud models. Local Qwen doesn't need one.",
  },
  {
    id: 'ask-composer',
    view: 'assistant',
    target: 'ask-composer',
    title: 'Send, stop, queue',
    body: ['Arrow sends. Square stops the running answer. Enter queues the next one.'],
    voice:
      "Arrow sends. While it's talking, that becomes a square. That only stops the running question. Type another and hit Enter to queue it. Remove on a queued bubble drops that one. New chat clears the queue.",
  },
  {
    id: 'ask-nav',
    view: 'assistant',
    target: 'ask-composer',
    demo: 'nav',
    demoPrompt: 'Open Stations',
    demoMode: 'ask',
    demoTarget: 'stations-tree',
    demoWait: 4200,
    preferSide: 'left',
    require: 'nav.stations',
    title: 'Ask opens a page',
    body: ['Watch Ask type Open Stations and jump there. Nothing is created.'],
    voice:
      "Watch Ask Helios actually move us. I'll type Open Stations. It reads that as a page jump, not a new charger. There. We're on Stations. That's Ask. Nothing in the CMS was created.",
  },
  {
    id: 'ask-add-cp',
    view: 'assistant',
    target: 'ask-composer',
    demo: 'add-cp',
    demoPrompt: 'Add a charge point TOUR-CP-21 at Whitefield Hub',
    demoMode: 'agent',
    demoTarget: 'stations-tree',
    demoWait: 5000,
    preferSide: 'left',
    require: 'assistant.agent',
    title: 'Agent adds a charge point',
    body: ['Watch Agent enroll TOUR-CP-21 at Whitefield Hub, then walk you to Stations.'],
    voice:
      "Now Agent. I'll type Add a charge point TOUR-CP-21 at Whitefield Hub. Agent writes the record, then walks you to Stations so you can see it in the tree. Live Reset still waits for Approve. The same I D is reused if you replay the tour.",
  },
  {
    id: 'stations-wss',
    view: 'stations',
    target: 'stations-wss',
    title: 'Charge point WebSocket',
    body: ['Copy the WSS base into Voltforge. Do not append the station I D. Subprotocol ocpp2.1.'],
    voice:
      "Charge points connect out to us. Copy this WSS base into Voltforge, and stop there. Don't append the station ID. Subprotocol is ocpp 2.1. Hosted is just public HTTPS, no extra port. Local lab is port 9443.",
  },
  {
    id: 'stations-tree',
    view: 'stations',
    target: 'stations-tree',
    title: 'Org tree',
    body: ['Tenant, then hub, then charge point. Search names, cities, OCPP I Ds.'],
    voice:
      "Tenant, then hub, then charge point. Click a station to open its chargers. Search works on names, cities, OCPP IDs.",
  },
  {
    id: 'sessions',
    view: 'sessions',
    target: 'sessions-table',
    title: 'Sessions',
    body: ['TransactionEvent, not one-point-six start/stop. Stopping live rows needs Approve.'],
    voice:
      "OCPP 2.1 uses Transaction Event. Started, updated, ended. Not the old start and stop transaction. Live rows can be stopped after Approve, or a direct request stop if your role allows calls.",
  },
  {
    id: 'tokens',
    view: 'tokens',
    target: 'tokens-page',
    title: 'Add a token',
    body: ['Authorize uses this list. ClearCache and SendLocalList are live OCPP.'],
    voice:
      "Authorize uses this list. Accepted, blocked, or invalid. Clear cache and send local list in the header push it to a connected charger. That's live OCPP, so treat it that way.",
  },
  {
    id: 'tariffs',
    view: 'tariffs',
    target: 'tariffs-page',
    title: 'Tariffs',
    body: ['Energy and parking prices. Ended sessions use the station default when one is set.'],
    voice:
      "Energy and parking prices live here. When a session ends, the station default tariff is what we use for total cost, if one is set.",
  },
  {
    id: 'demand',
    view: 'demand',
    target: 'demand-page',
    title: 'Demand',
    body: ['A 3-day load estimate per station. Use the quiet window before you queue a Reset.'],
    voice:
      "Three-day load estimate per station. Ranges, not a promise. If you're going to queue maintenance or a Reset, use the quiet window.",
  },
  {
    id: 'sites',
    view: 'sites',
    target: 'sites-page',
    title: 'Site planner',
    body: ['Suggests the next city. Saving a candidate does not enroll a charge point.'],
    voice:
      "This suggests the next city from utilization and a mock catchment. Saving a candidate does not enroll a charger. That's still Stations later.",
  },
  {
    id: 'smart',
    view: 'smart-charging',
    target: 'smart-page',
    title: 'Smart charging',
    body: ['Set, get, clear profiles. Limits in watts. Needs a connected charge point.'],
    voice:
      "Set charging profile, get, clear, that family. Limits are in watts. You need a connected charge point or you're talking to the air.",
  },
  {
    id: 'security',
    view: 'security',
    target: 'security-page',
    title: 'Security profile',
    body: ['Zero is plain WS. One is Basic Auth over WSS. Two is mTLS, local lab only.'],
    voice:
      "Profile zero is plain websocket, local lab only. One is basic auth over WSS. Two is mutual TLS on local 9443, not on Render. Hosted, you paste the HTTPS WSS base into Voltforge. Local encrypted path is that 9443 URL.",
  },
  {
    id: 'roles',
    view: 'roles',
    target: 'roles-page',
    title: 'Roles',
    body: ['Each card is a lab role. Only super admin can mint another super admin.'],
    voice:
      "Each card is a lab role. Super admin is the only one that can mint another super admin. Use Act as in the header if you want to feel a narrower role without leaving.",
  },
  {
    id: 'end',
    view: 'dashboard',
    target: 'tour-btn',
    title: 'Replay any time',
    body: ['Tutorial in the header replays. Ask opened a page. Agent added a charge point.'],
    voice:
      "That's the walkthrough. Skip or Escape dismisses until the next reload. Tutorial in the header plays it again. You just saw Ask open a page and Agent add a charge point. Live Reset and firmware always need Approve. This is a lab, not a certified CSMS.",
  },
];
