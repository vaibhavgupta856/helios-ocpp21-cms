/** Product tour. Each step names a `data-tour` target and a CMS view to open. */

export const TOUR_VOICE_REV = 'andrew-plain-1';

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
    id: 'pills',
    view: 'dashboard',
    target: 'pills',
    title: 'Live network counts',
    body: ['Hubs, charge points, and how many are online. They update as the fleet moves.'],
    voice:
      "These pills just sit here so you always know the score. How many hubs, how many charge points, how many are actually online. They twitch when something boots or drops. This lab is 2.1 only. No 1.6.",
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
      "Here's the menu. Operate is the live network. Plan is demand, sites, load. Setup is security and people. There's more in the app that isn't on this list. Firmware, diagnostics, that kind of thing. We'll open those in a bit.",
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
    id: 'dash-cps',
    view: 'dashboard',
    target: 'dash-cps',
    title: 'Dashboard charge points',
    body: ['Glance list. Commissioning and Reset live on Stations.'],
    voice:
      "Same org, in a table. Tenant, station, ID, whether it's online, model from boot. It's just a glance list. Commissioning and the WSS URLs live on Stations.",
  },
  {
    id: 'dash-live',
    view: 'dashboard',
    target: 'dash-live',
    title: 'Dashboard live sessions',
    body: ['A few open transactions. Full history is on Sessions.'],
    voice:
      "Last few open sessions. ID, charge point, token, kilowatt hours. Full history, or stopping one, that's the Sessions page.",
  },
  {
    id: 'dash-trace',
    view: 'dashboard',
    target: 'dash-trace',
    title: 'Recent messages',
    body: ['A short OCPP strip. The full stream is Live Trace.'],
    voice:
      "Tiny strip of recent OCPP calls. The full filterable stream is Live Trace, off the sidebar. We'll get there.",
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
    id: 'twin-detail',
    view: 'twin',
    target: 'twin-detail',
    title: 'Charger card',
    body: ['Click a pin for the card. Alarms under the map list unhappy pins.'],
    voice:
      "Click a pin and you get this card. Utilization, a mock temperature, sessions, the technician. Open in Stations jumps to that charger. Alarms under the map are every offline or faulted pin.",
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
    id: 'stations-wss',
    view: 'stations',
    target: 'stations-wss',
    title: 'Charge point WebSocket',
    body: ['Copy the WSS base into Voltforge. Do not append the station I D. Subprotocol ocpp2.1.'],
    voice:
      "Charge points connect out to us. Copy this WSS base into Voltforge, and stop there. Don't append the station ID. Subprotocol is ocpp 2.1. Hosted is just public HTTPS, no extra port. Local lab is port 9443.",
  },
  {
    id: 'stations-enroll',
    view: 'stations',
    target: 'stations-enroll',
    title: 'Enroll a charge point',
    body: ['Enroll an I D here. Connect from Voltforge. Simulate charge point is virtual, no socket.'],
    voice:
      "We don't dial the charger. You enroll an ID here, paste the WSS base into Voltforge, hit Connect EVSE over there, then watch BootNotification on the trace. Simulate charge point on this page is a fake one inside the CSMS. No WebSocket.",
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
    id: 'stations-detail',
    view: 'stations',
    target: 'stations-detail',
    title: 'Charge point detail',
    body: ['Identity, EVSE status, URLs, remote ops. Prefer Approve for queued live calls.'],
    voice:
      "Pick a charger and you get boot identity, EVSE status, the plain and secure URLs, and remote ops like Reset. Those calls from this page go out as the operator. If you're testing the queue, prefer Approve on the dashboard.",
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
    id: 'tokens-list',
    view: 'tokens',
    target: 'tokens-list',
    title: 'Authorization list',
    body: ['Every idToken the CSMS will accept, block, or reject.'],
    voice:
      "Every token we'll accept, block, or reject. A connected charger still needs send local list before its cache matches this table.",
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
    id: 'tariffs-create',
    view: 'tariffs',
    target: 'tariffs-create',
    require: 'tariffs.write',
    title: 'Create tariff',
    body: ['Save an id, currency, and rate. Does not change a live charger by itself.'],
    voice:
      "Save an ID, a currency, a rate, a description. That just goes in the book. It doesn't magically change a live charger.",
  },
  {
    id: 'tariffs-push',
    view: 'tariffs',
    target: 'tariffs-push',
    require: 'ocpp.call',
    title: 'Push to station',
    body: ['Get, set, clear, change, cost updated. Live CPs still go through Approve when queued.'],
    voice:
      "Get tariffs, set default, clear, change the transaction tariff, cost updated. That's against the selected charger. A simulated one can apply in the lab. A live one still goes through Approve when the advisor queues it.",
  },
  {
    id: 'tariffs-book',
    view: 'tariffs',
    target: 'tariffs-book',
    title: 'Tariff book and settlements',
    body: ['The book is saved tariffs. Settlements are lab payment rows, not real invoices.'],
    voice:
      "The book is every saved tariff. Settlements are lab payment rows, not real invoices.",
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
    id: 'demand-stations',
    view: 'demand',
    target: 'demand-stations',
    title: 'Station forecast cards',
    body: ['Each hub: kWh range, mix, weather, sparkline. Click to fill the hourly table.'],
    voice:
      "Each hub gets a card. Kilowatt-hour range, mix, weather, a little sparkline. Click one and the hourly table below fills in.",
  },
  {
    id: 'demand-hourly',
    view: 'demand',
    target: 'demand-hourly',
    title: 'Hourly estimate',
    body: ['72 hours for the selected station. Peak hours highlighted. Ops can queue a Reset.'],
    voice:
      "The next three days of estimated sessions and energy for that station. Peak hours are highlighted. Proposed ops under it can queue a Reset for Approve.",
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
    id: 'sites-grid',
    view: 'sites',
    target: 'sites-grid',
    title: 'Candidate cities',
    body: ['Expected sessions, revenue, payback. Recommend stores a candidate only.'],
    voice:
      "Each card is a city we like. Sessions, revenue, that kind of thing. Recommend this site just stores a candidate. Real charger still gets enrolled on Stations.",
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
    id: 'smart-profiles',
    view: 'smart-charging',
    target: 'smart-profiles',
    title: 'Profiles and limits',
    body: ['Profiles we stored. Limits the station reported back.'],
    voice:
      "Profiles stored here are set-charging-profile payloads we kept. Limits reported by station are notify charging limit and EV schedule messages coming back.",
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
    id: 'security-certs',
    view: 'security',
    target: 'security-certs',
    title: 'Lab certificates',
    body: ['Download CA, server, client cert and key. Profile 2 is local TLS, not hosted HTTPS.'],
    voice:
      "Download the lab CA, server cert, client cert, client key. Trust the CA on a real charger. Voltforge can skip verification if you want. Profile two is local lab TLS, not the hosted HTTPS URL.",
  },
  {
    id: 'security-ops',
    view: 'security',
    target: 'security-ops',
    title: 'Certificate operations',
    body: ['Install, list, delete certs on the selected CP. Events sit beside this panel.'],
    voice:
      "Get installed certificate IDs, install, delete, against the selected charger. Installed IDs and security events sit beside this panel.",
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
    id: 'roles-users',
    view: 'roles',
    target: 'roles-users',
    title: 'Users',
    body: ['Create users, change role, scope them to tenants or sites.'],
    voice:
      "Create users, change their role, scope them to tenants or sites. Assignment is what limits which hubs they see.",
  },
  {
    id: 'roles-matrix',
    view: 'roles',
    target: 'roles-matrix',
    title: 'Permission matrix',
    body: ['Nav, org writes, OCPP, Approve, Ask. Lab IAM — not OCPP itself.'],
    voice:
      "What each role can do. Pages, org writes, OCPP calls, Approve, Ask and Agent. That's the lab permissions table. It is not OCPP.",
  },
  {
    id: 'firmware',
    view: 'firmware',
    target: 'firmware-page',
    require: 'ocpp.call',
    title: 'Firmware and logs',
    body: ['Off the sidebar. Update, publish, get log. Advisor pushes still need Approve.'],
    voice:
      "This one's off the sidebar. Update firmware, publish firmware, get log, against the selected charger. Jobs and notify event rows collect status. A live firmware push from the advisor still needs Approve.",
  },
  {
    id: 'diagnostics',
    view: 'diagnostics',
    target: 'diagnostics-page',
    require: 'ocpp.call',
    title: 'Diagnostics',
    body: ['Base report, monitoring, customer info, periodic events. Tickets land below.'],
    voice:
      "Also off the sidebar. Get base report, monitoring, customer information, periodic event streams. Tickets and inventory variables land in the cards below.",
  },
  {
    id: 'display',
    view: 'display',
    target: 'display-page',
    require: 'ocpp.call',
    title: 'Display and reservations',
    body: ['Set or get display messages. ReserveNow and cancel for a token on an EVSE.'],
    voice:
      "Set display message, get display messages. That's the charger screen. Reserve now and cancel reservation for a token on an EVSE.",
  },
  {
    id: 'der',
    view: 'der',
    target: 'der-page',
    require: 'ocpp.call',
    title: 'DER and V2X',
    body: ['DER control, AFRR, energy transfer, battery swap. Event lists are lab records.'],
    voice:
      "Set DER control, AFRR signal, allowed energy transfer, battery swap, against the selected charger. The event lists are lab records.",
  },
  {
    id: 'catalog',
    view: 'catalog',
    target: 'catalog-page',
    require: 'ocpp.call',
    title: 'Message catalog',
    body: ['Every OCPP 2.1 action this CSMS knows. Pick one and send a CALL.'],
    voice:
      "Every OCPP 2.1 action this CSMS knows, grouped by block. Pick an action and send a call toward the charger with a JSON payload. Power-user stuff.",
  },
  {
    id: 'trace',
    view: 'trace',
    target: 'trace-page',
    require: 'ocpp.call',
    title: 'Live trace',
    body: ['The full CALL / RESULT / ERROR stream. This is the wire.'],
    voice:
      "The full stream. Call, call result, call error. Filter by station and message type. This is the wire, not a pretty dashboard.",
  },
  {
    id: 'end',
    view: 'dashboard',
    target: 'tour-btn',
    title: 'Replay any time',
    body: ['Tutorial in the header replays. Live Reset and firmware still need Approve.'],
    voice:
      "That's the walkthrough. Skip or Escape dismisses until the next reload. Tutorial in the header plays it again. Ask Helios can open a page if you say the name. This is a lab, not a certified CSMS. Live Reset and firmware always need Approve.",
  },
];
