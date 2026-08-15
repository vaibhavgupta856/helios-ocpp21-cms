/** Product tour. Each step names a `data-tour` target and a CMS view to open. */

export const TUTORIAL_STEPS = [
  {
    id: 'welcome',
    view: 'dashboard',
    target: 'brand',
    title: 'Helios CSMS',
    body: [
      'This is the operator console for the Helios OCPP 2.1 CSMS (central system) — not OCA-certified, and not a charge point.',
      'Charge points such as Voltforge connect out to this CSMS on WebSocket. You will walk the header, every sidebar page, then extra screens off the menu.',
    ],
  },
  {
    id: 'pills',
    view: 'dashboard',
    target: 'pills',
    title: 'Live network counts',
    body: [
      'These pills are always on: how many stations (hubs), how many charge points, and how many are online right now.',
      'They update as charge points boot, drop, or start sessions. This lab speaks OCPP 2.1 only (no 1.6).',
    ],
  },
  {
    id: 'theme',
    view: 'dashboard',
    target: 'theme',
    cycleThemes: true,
    title: 'Theme',
    body: [
      'We will cycle every look — Helios, Dark, Midnight, Forest, Sand, and Violet — so you can see them all. Pick one anytime in the header. The choice stays in this browser.',
    ],
  },
  {
    id: 'actor',
    view: 'dashboard',
    target: 'actor',
    title: 'Act as',
    body: [
      'This lab has several identities (super admin, operator, member). Act as changes whose permissions you use — including which tenants you can see.',
      'Chats record who asked. It does not log you into a different product; it is a lab IAM switch.',
    ],
  },
  {
    id: 'nav',
    view: 'dashboard',
    target: 'nav',
    openNav: true,
    title: 'Pages',
    body: [
      'Operate is the live network. Plan is demand, site recommendations, and load. Setup is WSS security and people.',
      'Firmware, diagnostics, display, DER, catalog, and the OCPP trace are in the app but off this list — the tour opens them later.',
    ],
  },
  {
    id: 'dashboard',
    view: 'dashboard',
    target: 'dash-stats',
    title: 'Dashboard KPIs',
    body: [
      'Start here for a snapshot: tenants, stations, charge points, online count, live sessions, connectors, and tokens.',
      'Simulate station (if your role allows) plants a fake charger so the rest of the CMS has something to show.',
    ],
  },
  {
    id: 'advisor',
    view: 'dashboard',
    target: 'dash-advisor',
    title: 'Advisor and Approve',
    body: [
      'The advisor reads live KPIs and outage estimates. Recommendations become action cards.',
      'Reset, firmware, and stop-session are live OCPP. They are not sent until someone with Approve clicks Approve. Dismiss keeps an audit row.',
    ],
  },
  {
    id: 'dash-cps',
    view: 'dashboard',
    target: 'dash-cps',
    title: 'Dashboard charge points',
    body: [
      'A searchable table of the same org: tenant, station, charge point ID, online/offline, and model from BootNotification.',
      'This is a glance list. Commissioning, WSS URLs, and Reset live on Stations.',
    ],
  },
  {
    id: 'dash-live',
    view: 'dashboard',
    target: 'dash-live',
    title: 'Dashboard live sessions',
    body: [
      'The last few open transactions: id, charge point, token, kWh. Full history and stop-session are on Sessions.',
    ],
  },
  {
    id: 'dash-trace',
    view: 'dashboard',
    target: 'dash-trace',
    title: 'Recent messages',
    body: [
      'A short OCPP CALL / CALLRESULT strip. The full filterable stream is Live Trace (off the sidebar).',
    ],
  },
  {
    id: 'twin',
    view: 'twin',
    target: 'twin-map',
    title: 'Digital twin map',
    body: [
      'A map of the lab network. Green is available, amber is charging, red is offline or alarm, blue is a hub with no CP yet.',
      'It does not replace Stations for commissioning.',
    ],
  },
  {
    id: 'twin-detail',
    view: 'twin',
    target: 'twin-detail',
    title: 'Charger card',
    body: [
      'Click a pin for utilization, a mock temperature, live sessions, technician, queue, and EVSE pills.',
      'Open in Stations jumps to that charge point. Alarms under the map list every offline or faulted pin.',
    ],
  },
  {
    id: 'ask',
    view: 'assistant',
    target: 'ask-modes',
    title: 'Ask Helios',
    body: [
      'Ask answers from the live CMS and does not create records. Agent can add a tenant, station, or charge point — it will ask if a name or ID is missing.',
      'Plan and Multitask are hidden on purpose. Live OCPP still waits for Approve even in Agent.',
    ],
  },
  {
    id: 'ask-history',
    view: 'assistant',
    target: 'ask-history',
    title: 'Chat history',
    body: [
      'Threads stay on the left and survive a server restart (saved under the lab certs folder).',
      'Assign on the thread lets another operator open the same chat. Delete removes it for you.',
    ],
  },
  {
    id: 'ask-feed',
    view: 'assistant',
    target: 'ask-feed',
    title: 'Feed live CMS',
    body: [
      'Ollama does not remember the fleet. Feed live CMS packs hubs, charge points, and live sessions into this chat. Every later question pulls a fresh copy.',
      'API key is for cloud models (OpenRouter and others). Local Qwen does not need a key.',
    ],
  },
  {
    id: 'ask-composer',
    view: 'assistant',
    target: 'ask-composer',
    title: 'Send, stop, queue',
    body: [
      'The arrow sends. While Helios is answering it becomes a square — that stops only the running question.',
      'Type another and press Enter to queue it. Remove on a queued bubble drops that item. New chat clears the queue.',
    ],
  },
  {
    id: 'stations-wss',
    view: 'stations',
    target: 'stations-wss',
    title: 'Charge point WebSocket (OCPP 2.1)',
    body: [
      'Charge points (Voltforge) connect outbound. Copy the WSS base — no station ID — into Voltforge. Subprotocol is ocpp2.1.',
      'Hosted: public HTTPS (no :9443). Local lab WSS is wss://127.0.0.1:9443/ocpp/2.1. The example full URL already appends the selected ID or VF-CP-21.',
    ],
  },
  {
    id: 'stations-enroll',
    view: 'stations',
    target: 'stations-enroll',
    title: 'Enroll a charge point',
    body: [
      'Charge points dial the CSMS — the CSMS does not dial them. Enroll an ID, copy the WSS base (shown on this page, no station ID) into Voltforge. Connect EVSE there, then confirm BootNotification on Live Trace.',
      'Hosted base looks like wss://YOUR-HOST/ocpp/2.1. Subprotocol must be ocpp2.1. Simulate charge point on this page is a virtual CP inside the CSMS (no WebSocket).',
    ],
  },
  {
    id: 'stations-tree',
    view: 'stations',
    target: 'stations-tree',
    title: 'Org tree',
    body: [
      'Tenant → station (hub) → charge point. Click a station to open its CPs. Search filters names, cities, and OCPP IDs.',
    ],
  },
  {
    id: 'stations-detail',
    view: 'stations',
    target: 'stations-detail',
    title: 'Charge point detail',
    body: [
      'Select a CP for BootNotification identity, EVSE status, plain WS and WSS URLs, and Remote operations (Reset, TriggerMessage, and similar).',
      'Those calls from this page are operator-sent. Prefer Approve on the Dashboard when you are testing the action queue.',
    ],
  },
  {
    id: 'sessions',
    view: 'sessions',
    target: 'sessions-table',
    title: 'Sessions',
    body: [
      'OCPP 2.1 uses TransactionEvent (Started / Updated / Ended), not 1.6 Start/StopTransaction.',
      'Live rows can be stopped only after Approve (or a direct RequestStopTransaction if your role allows calls). If a CP is selected, a second table shows its event stream.',
    ],
  },
  {
    id: 'tokens',
    view: 'tokens',
    target: 'tokens-page',
    title: 'Add a token',
    body: [
      'Authorize uses this list. Status is Accepted, Blocked, or Invalid.',
      'ClearCache and SendLocalList in the header push the list to a connected charge point. That is live OCPP.',
    ],
  },
  {
    id: 'tokens-list',
    view: 'tokens',
    target: 'tokens-list',
    title: 'Authorization list',
    body: [
      'Every idToken the CSMS will accept, block, or reject. A connected CP still needs SendLocalList before its local cache matches this table.',
    ],
  },
  {
    id: 'tariffs',
    view: 'tariffs',
    target: 'tariffs-page',
    title: 'Tariffs',
    body: [
      'Energy and parking prices live here. Ended sessions use the station default tariff for totalCost when one is set.',
    ],
  },
  {
    id: 'tariffs-create',
    view: 'tariffs',
    target: 'tariffs-create',
    require: 'tariffs.write',
    title: 'Create tariff',
    body: [
      'Save an id, currency, €/kWh, and description into the CSMS book. This does not yet change a live charger.',
    ],
  },
  {
    id: 'tariffs-push',
    view: 'tariffs',
    target: 'tariffs-push',
    require: 'ocpp.call',
    title: 'Push to station',
    body: [
      'GetTariffs, SetDefaultTariff, ClearTariffs, ChangeTransactionTariff, and CostUpdated against the selected CP.',
      'A simulated CP can apply in the lab. A live CP still goes through Approve when the advisor queues it.',
    ],
  },
  {
    id: 'tariffs-book',
    view: 'tariffs',
    target: 'tariffs-book',
    title: 'Tariff book and settlements',
    body: [
      'The book is every saved tariff. Settlements / payments are lab payment rows, not real invoices.',
    ],
  },
  {
    id: 'demand',
    view: 'demand',
    target: 'demand-page',
    title: 'Demand',
    body: [
      'A 3-day load estimate per station — ranges, not a promise of future sessions.',
      'Use the low-load window before you queue maintenance or a Reset.',
    ],
  },
  {
    id: 'demand-stations',
    view: 'demand',
    target: 'demand-stations',
    title: 'Station forecast cards',
    body: [
      'Each hub shows a 3-day kWh range, mix, weather, and a sparkline. Click a card to fill the hourly table below.',
    ],
  },
  {
    id: 'demand-hourly',
    view: 'demand',
    target: 'demand-hourly',
    title: 'Hourly estimate',
    body: [
      '72 hours of estimated sessions and kWh for the selected station. Peak hours are highlighted. Proposed ops under it can queue a Reset for Approve.',
    ],
  },
  {
    id: 'sites',
    view: 'sites',
    target: 'sites-page',
    title: 'Site planner',
    body: [
      'Recommends the next city from utilization and mock catchment. Saving a candidate does not enroll a charge point.',
    ],
  },
  {
    id: 'sites-grid',
    view: 'sites',
    target: 'sites-grid',
    title: 'Candidate cities',
    body: [
      'Each card is a recommended city: expected sessions, revenue, utilization, payback, traffic, and competitors.',
      'Recommend this site stores a candidate. Enroll the real CP later on Stations.',
    ],
  },
  {
    id: 'smart',
    view: 'smart-charging',
    target: 'smart-page',
    title: 'Smart charging',
    body: [
      'SetChargingProfile, GetChargingProfiles, ClearChargingProfile, and related calls against the selected CP.',
      'Limits are in watts. These calls need a connected charge point.',
    ],
  },
  {
    id: 'smart-profiles',
    view: 'smart-charging',
    target: 'smart-profiles',
    title: 'Profiles and limits',
    body: [
      'Profiles stored on CSMS are SetChargingProfile payloads this lab kept. Limits reported by station are NotifyChargingLimit / EV schedule messages.',
    ],
  },
  {
    id: 'security',
    view: 'security',
    target: 'security-page',
    title: 'Security profile',
    body: [
      'Profile 0 is plain WS (local lab only). Profile 1 is Basic Auth over WSS. Profile 2 is mTLS on local 9443 — not available on Render.',
      'Local encrypted path: wss://127.0.0.1:9443/ocpp/2.1/{id}. Hosted: wss://YOUR-HOST/ocpp/2.1/{id}. Paste only the base into Voltforge.',
    ],
  },
  {
    id: 'security-certs',
    view: 'security',
    target: 'security-certs',
    title: 'Lab certificates',
    body: [
      'Download the lab CA, server cert, client cert, and client key. Trust the CA on a real CP. Voltforge can skip verification. Profile 2 is local lab TLS, not the hosted HTTPS URL.',
    ],
  },
  {
    id: 'security-ops',
    view: 'security',
    target: 'security-ops',
    title: 'Certificate operations',
    body: [
      'GetInstalledCertificateIds, InstallCertificate, and DeleteCertificate against the selected CP. Installed IDs and SecurityEventNotification rows sit beside this panel.',
    ],
  },
  {
    id: 'roles',
    view: 'roles',
    target: 'roles-page',
    title: 'Roles',
    body: [
      'Each card is a lab role. Super admin is the only role that can mint another super admin.',
      'Use Act as in the header to feel a narrower role without leaving the lab.',
    ],
  },
  {
    id: 'roles-users',
    view: 'roles',
    target: 'roles-users',
    title: 'Users',
    body: [
      'Create users, change role, and scope them to tenants or sites. Assignment limits which hubs they see.',
    ],
  },
  {
    id: 'roles-matrix',
    view: 'roles',
    target: 'roles-matrix',
    title: 'Permission matrix',
    body: [
      'What each role can do: nav pages, org writes, OCPP calls, Approve, and Ask/Agent. This is the lab IAM table, not OCPP.',
    ],
  },
  {
    id: 'firmware',
    view: 'firmware',
    target: 'firmware-page',
    require: 'ocpp.call',
    title: 'Firmware and logs',
    body: [
      'Off the sidebar. UpdateFirmware, PublishFirmware, and GetLog against the selected CP. Jobs and NotifyEvent rows collect status.',
      'A live firmware push still needs Approve when it comes from the advisor.',
    ],
  },
  {
    id: 'diagnostics',
    view: 'diagnostics',
    target: 'diagnostics-page',
    require: 'ocpp.call',
    title: 'Diagnostics',
    body: [
      'Off the sidebar. GetBaseReport, monitoring, customer information, and periodic event streams. Tickets and inventory variables land in the cards below.',
    ],
  },
  {
    id: 'display',
    view: 'display',
    target: 'display-page',
    require: 'ocpp.call',
    title: 'Display and reservations',
    body: [
      'Off the sidebar. SetDisplayMessage / GetDisplayMessages on the charger screen. ReserveNow and CancelReservation for a token on an EVSE.',
    ],
  },
  {
    id: 'der',
    view: 'der',
    target: 'der-page',
    require: 'ocpp.call',
    title: 'DER and V2X',
    body: [
      'Off the sidebar. SetDERControl, AFRR signal, allowed energy transfer, and battery swap against the selected CP. Event lists are lab records.',
    ],
  },
  {
    id: 'catalog',
    view: 'catalog',
    target: 'catalog-page',
    require: 'ocpp.call',
    title: 'Message catalog',
    body: [
      'Off the sidebar. Every OCPP 2.1 action this CSMS knows, grouped by functional block. Pick an action to send a CSMS → CP CALL with a JSON payload.',
    ],
  },
  {
    id: 'trace',
    view: 'trace',
    target: 'trace-page',
    require: 'ocpp.call',
    title: 'Live trace',
    body: [
      'Off the sidebar. The full CALL / CALLRESULT / CALLERROR stream. Filter by station and message type. This is the wire, not a pretty dashboard.',
    ],
  },
  {
    id: 'end',
    view: 'dashboard',
    target: 'tour-btn',
    title: 'You can replay this any time',
    body: [
      'Skip or Escape dismisses until the next reload. Tutorial in the header replays without reloading. Ask Helios can also open any of these screens if you say the page name.',
      'This is a lab. Do not treat it as a certified CSMS. Live Reset and firmware always need Approve.',
    ],
  },
];
