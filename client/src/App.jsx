import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { api } from './api.js';
import { hashView, NAV, HIDDEN_VIEWS } from './nav.js';
import { sortChargePoints } from './org.js';
import { can as canPerm, setCurrentUserId, scopeOrg } from './auth.js';
import Header from './components/Header.jsx';
import Sidebar from './components/Sidebar.jsx';
import AgentHud from './components/AgentHud.jsx';
import Tutorial from './components/Tutorial.jsx';
import { parseNavIntent } from './navIntent.js';
import {
  planWalk,
  planWalkFromResult,
  guessFocus,
  focusFromResult,
  mergeFocus,
  enrichFocus,
  hudAnswer,
} from './agentWalk.js';
import Dashboard from './pages/Dashboard.jsx';
import Stations from './pages/Stations.jsx';
import Sessions from './pages/Sessions.jsx';
import Tokens from './pages/Tokens.jsx';
import Tariffs from './pages/Tariffs.jsx';
import SmartCharging from './pages/SmartCharging.jsx';
import DerV2x from './pages/DerV2x.jsx';
import Firmware from './pages/Firmware.jsx';
import Security from './pages/Security.jsx';
import Diagnostics from './pages/Diagnostics.jsx';
import DisplayReservations from './pages/DisplayReservations.jsx';
import Catalog from './pages/Catalog.jsx';
import Trace from './pages/Trace.jsx';
import Assistant from './pages/Assistant.jsx';
import Demand from './pages/Demand.jsx';
import Twin from './pages/Twin.jsx';
import Sites from './pages/Sites.jsx';
import Roles from './pages/Roles.jsx';

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export default function App() {
  const [view, setView] = useState(() => hashView());
  const [stations, setStations] = useState([]);
  const [messages, setMessages] = useState([]);
  const [catalog, setCatalog] = useState(null);
  const [tokens, setTokens] = useState([]);
  const [tariffs, setTariffs] = useState([]);
  const [payments, setPayments] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [reservations, setReservations] = useState([]);
  const [firmware, setFirmware] = useState([]);
  const [certificates, setCertificates] = useState([]);
  const [securityEvents, setSecurityEvents] = useState([]);
  const [diagnostics, setDiagnostics] = useState([]);
  const [derEvents, setDerEvents] = useState([]);
  const [batterySwaps, setBatterySwaps] = useState([]);
  const [streamSamples, setStreamSamples] = useState([]);
  const [selectedStationId, setSelectedStationId] = useState('');
  const [tenants, setTenants] = useState([]);
  const [sites, setSites] = useState([]);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [navOpen, setNavOpen] = useState(false);
  const [tutorialOpen, setTutorialOpen] = useState(true);
  const [security, setSecurity] = useState(null);
  const [me, setMe] = useState(null);
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [permissions, setPermissions] = useState([]);
  const [matrix, setMatrix] = useState({});
  const [hud, setHud] = useState(null);
  const walkGen = useRef(0);
  const liveRef = useRef({});

  const applyStore = useCallback((store) => {
    if (!store) return;
    if (store.tokens) setTokens(store.tokens);
    if (store.tariffs) setTariffs(store.tariffs);
    if (store.payments) setPayments(store.payments);
    if (store.transactions) setTransactions(store.transactions);
    if (store.reservations) setReservations(store.reservations);
    if (store.firmware) setFirmware(store.firmware);
    if (store.certificates) setCertificates(store.certificates);
    if (store.securityEvents) setSecurityEvents(store.securityEvents);
    if (store.diagnostics) setDiagnostics(store.diagnostics);
    if (store.derEvents) setDerEvents(store.derEvents);
    if (store.batterySwaps) setBatterySwaps(store.batterySwaps);
    if (store.streamSamples) setStreamSamples(store.streamSamples);
    if (store.tenants) setTenants(store.tenants);
    if (store.sites) setSites(store.sites);
  }, []);

  const loadMe = useCallback(async () => {
    const data = await api('/api/me');
    setMe(data.user);
    setUsers(data.users || []);
    setRoles(data.roles || []);
    setPermissions(data.permissions || []);
    setMatrix(data.matrix || {});
    return data.user;
  }, []);

  const switchUser = async (id) => {
    setCurrentUserId(id);
    setError('');
    try {
      const user = await loadMe();
      const allowed = NAV.some((n) => n.id === view && canPerm(user, `nav.${n.id}`));
      const hiddenOk = HIDDEN_VIEWS.includes(view) && canPerm(user, 'ocpp.call');
      if (!allowed && !hiddenOk) {
        window.location.hash = '#/dashboard';
        setView('dashboard');
      }
      await refresh();
    } catch (err) {
      setError(err.message);
    }
  };

  const refresh = useCallback(async () => {
    try {
      const [snap, cat, sec] = await Promise.all([
        api('/api/snapshot'),
        api('/api/catalog'),
        api('/api/security').catch(() => null),
      ]);
      setStations(sortChargePoints(snap.stations || []));
      setMessages(snap.messages || []);
      applyStore(snap);
      if (snap.tenants) setTenants(snap.tenants);
      if (snap.sites) setSites(snap.sites);
      setCatalog(cat);
      setPayments(snap.payments || []);
      if (snap.security) setSecurity(snap.security);
      else if (sec?.security) setSecurity(sec.security);
      return snap;
    } catch (err) {
      setError(err.message);
      return null;
    }
  }, [applyStore]);

  useEffect(() => {
    refresh();
    loadMe().catch((err) => setError(err.message));
    const socket = io({ transports: ['websocket', 'polling'] });
    socket.on('cms:stations', (list) => setStations(sortChargePoints(list || [])));
    socket.on('station:state', (state) => {
      setStations((prev) => {
        const idx = prev.findIndex((s) => s.stationId === state.stationId);
        const merged = {
          ...state,
          wsUrl: state.wsUrl || prev[idx]?.wsUrl,
          wssUrl: state.wssUrl || prev[idx]?.wssUrl,
        };
        if (idx === -1) return sortChargePoints([...prev, merged]);
        const next = [...prev];
        next[idx] = { ...prev[idx], ...merged };
        return sortChargePoints(next);
      });
    });
    socket.on('cms:message', (msg) => {
      setMessages((prev) => [msg, ...prev].slice(0, 400));
    });
    socket.on('cms:messages', (list) => {
      if (Array.isArray(list)) setMessages(list);
    });
    socket.on('cms:store', applyStore);
    socket.on('cms:org', (org) => {
      if (org?.tenants) setTenants(org.tenants);
      if (org?.sites) setSites(org.sites);
    });
    socket.on('cms:security', setSecurity);
    return () => socket.disconnect();
  }, [refresh, applyStore, loadMe]);

  useEffect(() => {
    const onHash = () => {
      setView(hashView());
      setNavOpen(false);
    };
    window.addEventListener('hashchange', onHash);
    if (!window.location.hash) window.location.hash = '#/dashboard';
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  useEffect(() => {
    const onKey = (event) => {
      if (event.key === 'Escape') setNavOpen(false);
    };
    const onResize = () => {
      if (window.innerWidth > 1100) setNavOpen(false);
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', onResize);
    };
  }, []);

  const navigate = useCallback((id) => {
    window.location.hash = `#/${id}`;
    setView(id);
    setNavOpen(false);
  }, []);

  const scoped = useMemo(() => scopeOrg(me, { tenants, sites, stations }), [me, tenants, sites, stations]);
  const can = useCallback((perm) => canPerm(me, perm), [me]);

  liveRef.current = {
    tenants: scoped.tenants,
    sites: scoped.sites,
    stations: scoped.stations,
    tokens,
    tariffs,
    me,
  };

  const dismissHud = useCallback(() => {
    walkGen.current += 1;
    setHud(null);
  }, []);

  const backToChat = useCallback(() => {
    walkGen.current += 1;
    setHud(null);
    navigate('assistant');
  }, [navigate]);

  const startAgentWalk = useCallback(
    async ({ question, mode, job }) => {
      if (typeof job?.then !== 'function') return;
      const canSee = (step) => {
        if (HIDDEN_VIEWS.includes(step.view)) return canPerm(liveRef.current.me, 'ocpp.call');
        return !liveRef.current.me || canPerm(liveRef.current.me, `nav.${step.view}`);
      };

      const nav = parseNavIntent(question);
      if (nav && canSee({ view: nav.view })) {
        const gen = ++walkGen.current;
        navigate(nav.view);
        setHud({
          status: 'working',
          question,
          mode,
          caption: `Opening ${nav.label}…`,
          view: nav.view,
          focus: null,
          stepIndex: 0,
          stepCount: 1,
          answer: '',
        });
        try {
          const result = await job;
          if (walkGen.current !== gen) return;
          if (result?.needsInput) {
            navigate('assistant');
            setHud(null);
            return;
          }
          const viewId = result?.navigateTo && canSee({ view: result.navigateTo }) ? result.navigateTo : nav.view;
          const label = result?.navLabel || nav.label;
          if (viewId !== nav.view) navigate(viewId);
          setHud({
            status: 'done',
            question,
            mode,
            caption: `Opened ${label}`,
            view: viewId,
            focus: null,
            stepIndex: 0,
            stepCount: 1,
            answer: '',
          });
        } catch (err) {
          if (walkGen.current !== gen) return;
          setHud({
            status: 'error',
            question,
            mode,
            caption: err.message || `Could not open ${nav.label}`,
            view: nav.view,
            stepIndex: 0,
            stepCount: 1,
            answer: '',
          });
        }
        return;
      }

      const mutate = mode === 'agent' || mode === 'multitask';
      const gen = ++walkGen.current;
      const askedToChange = /^(add|create|enroll|simulate|move|block|set)\b/i.test(String(question || '').trim());
      const preview = mutate && askedToChange ? planWalk(question, mode).filter(canSee) : [];
      if (preview.length) {
        const first = preview[0];
        navigate(first.view);
        setHud({
          status: 'working',
          question,
          mode,
          caption: first.caption,
          view: first.view,
          focus: guessFocus(question, liveRef.current),
          stepIndex: 0,
          stepCount: preview.length,
          answer: '',
        });
      }

      let result = null;
      try {
        result = await job;
      } catch (err) {
        if (walkGen.current !== gen) return;
        if (preview.length) {
          setHud({
            status: 'error',
            question,
            mode,
            caption: err.message || 'That change did not land.',
            view: preview[0].view,
            focus: null,
            stepIndex: 0,
            stepCount: 1,
            answer: '',
          });
        }
        return;
      }
      if (walkGen.current !== gen) return;

      if (result?.needsInput) {
        navigate('assistant');
        setHud(null);
        return;
      }

      const okActs = (result?.executedActions || []).filter((a) => a.ok);
      if (mutate && okActs.length) {
        let snap = null;
        try {
          snap = await refresh();
        } catch {
          /* ignore */
        }
        if (walkGen.current !== gen) return;
        const org = {
          tenants: snap?.tenants || liveRef.current.tenants,
          sites: snap?.sites || liveRef.current.sites,
          stations: snap?.stations || liveRef.current.stations,
          tokens: snap?.tokens || liveRef.current.tokens,
          tariffs: snap?.tariffs || liveRef.current.tariffs,
        };
        const focus = enrichFocus(mergeFocus(guessFocus(question, org), focusFromResult(result)), org);
        if (focus.stationId) setSelectedStationId(focus.stationId);
        const steps = planWalkFromResult(result, mode).filter(canSee);
        if (steps.length) {
          for (let i = 0; i < steps.length; i++) {
            if (walkGen.current !== gen) return;
            const step = steps[i];
            navigate(step.view);
            setHud({
              status: 'working',
              question,
              mode,
              caption: step.caption,
              view: step.view,
              focus,
              stepIndex: i,
              stepCount: steps.length,
              answer: '',
            });
            await wait(step.ms || 1400);
          }
          if (walkGen.current !== gen) return;
          const last = steps[steps.length - 1];
          navigate(last.view);
          setHud({
            status: 'done',
            question,
            mode,
            caption: String(last.caption || '').replace(/…+$/, '.'),
            view: last.view,
            focus,
            stepIndex: steps.length - 1,
            stepCount: steps.length,
            answer: hudAnswer(result),
          });
          return;
        }
      }

      if (result?.navigateTo && canSee({ view: result.navigateTo })) {
        navigate(result.navigateTo);
        setHud({
          status: 'done',
          question,
          mode,
          caption: `Opened ${result.navLabel || result.navigateTo}`,
          view: result.navigateTo,
          focus: null,
          stepIndex: 0,
          stepCount: 1,
          answer: '',
        });
        return;
      }

      if (preview.length) navigate('assistant');
      setHud(null);
    },
    [navigate, refresh]
  );

  useEffect(() => {
    if (!me) return;
    const navOk = NAV.some((n) => n.id === view && canPerm(me, `nav.${n.id}`));
    const hiddenOk = HIDDEN_VIEWS.includes(view) && canPerm(me, 'ocpp.call');
    if (!navOk && !hiddenOk) {
      window.location.hash = '#/dashboard';
      setView('dashboard');
    }
  }, [me, view]);

  const scopedTx = useMemo(() => {
    if (!me || me.role === 'admin' || me.role === 'super_admin') return transactions;
    const ids = new Set(scoped.stations.map((s) => s.stationId));
    if ((me.tenantIds || []).length || (me.siteIds || []).length) {
      return transactions.filter((t) => ids.has(t.stationId));
    }
    return transactions;
  }, [me, scoped.stations, transactions]);

  const selected = useMemo(
    () => scoped.stations.find((s) => s.stationId === selectedStationId) || scoped.stations[0] || null,
    [scoped.stations, selectedStationId]
  );

  useEffect(() => {
    if (!selectedStationId && scoped.stations[0]) setSelectedStationId(scoped.stations[0].stationId);
  }, [scoped.stations, selectedStationId]);

  useEffect(() => {
    if (hud?.focus?.stationId) setSelectedStationId(hud.focus.stationId);
  }, [hud?.focus?.stationId]);

  const callStation = async (action, payload, stationId) => {
    const id = stationId || selected?.stationId;
    if (!id) throw new Error('Select a station first');
    setError('');
    setNotice('');
    const result = await api(`/api/stations/${encodeURIComponent(id)}/call`, {
      method: 'POST',
      body: JSON.stringify({ action, payload }),
    });
    setNotice(`${action} → ${JSON.stringify(result.result)}`);
    return result;
  };

  const simulate = async (opts = {}) => {
    setError('');
    try {
      const data = await api('/api/simulate-station', {
        method: 'POST',
        body: JSON.stringify(opts || {}),
      });
      setSelectedStationId(data.station.stationId);
      setNotice(`Simulated ${data.station.stationId}`);
      refresh();
    } catch (err) {
      setError(err.message);
    }
  };

  const ctx = {
    stations: scoped.stations,
    selected,
    selectedStationId: selected?.stationId || '',
    setSelectedStationId,
    messages,
    catalog,
    tokens,
    tariffs,
    payments,
    transactions: scopedTx,
    reservations,
    firmware,
    certificates,
    securityEvents,
    diagnostics,
    derEvents,
    batterySwaps,
    streamSamples,
    callStation,
    simulate,
    refresh,
    notice,
    error,
    setError,
    setNotice,
    navigate,
    onAgentWalk: startAgentWalk,
    walkFocus: hud?.focus || null,
    security,
    tenants: scoped.tenants,
    sites: scoped.sites,
    me,
    users,
    can,
  };

  const onlineCount = scoped.stations.filter((s) => s.online).length;

  return (
    <div className={`cms-shell${hud ? ' has-agent-hud' : ''}${tutorialOpen ? ' tour-on' : ''}${navOpen ? ' nav-open' : ''}`}>
      <Header
        stationCount={scoped.stations.length}
        siteCount={scoped.sites.length}
        onlineCount={onlineCount}
        navOpen={navOpen}
        onToggleNav={() => setNavOpen((open) => !open)}
        me={me}
        users={users}
        onUserChange={switchUser}
        tutorialOpen={tutorialOpen}
        onStartTutorial={() => setTutorialOpen(true)}
        onNavigate={navigate}
        view={view}
      />
      <div className="cms-body">
        {navOpen ? (
          <button type="button" className="nav-scrim" aria-label="Close menu" onClick={() => setNavOpen(false)} />
        ) : null}
        <Sidebar view={view} onNavigate={navigate} open={navOpen} me={me} walkingView={hud && hud.status !== 'error' ? hud.view : ''} />
        <main className="cms-main">
          {error ? <p className="error">{error}</p> : null}
          {notice ? <p className="ok-msg">{notice}</p> : null}
          <div className={view === 'assistant' ? 'page-enter assistant-host' : 'assistant-host is-hidden'}>
            <Assistant {...ctx} />
          </div>
          {view !== 'assistant' ? (
          <div className="page-enter" key={view}>
            {view === 'dashboard' && <Dashboard {...ctx} />}
            {view === 'twin' && <Twin {...ctx} />}
            {view === 'stations' && <Stations {...ctx} />}
            {view === 'sites' && <Sites {...ctx} />}
            {view === 'sessions' && <Sessions {...ctx} />}
            {view === 'tokens' && <Tokens {...ctx} />}
            {view === 'tariffs' && <Tariffs {...ctx} />}
            {view === 'demand' && <Demand {...ctx} />}
            {view === 'smart-charging' && <SmartCharging {...ctx} />}
            {view === 'der' && <DerV2x {...ctx} />}
            {view === 'firmware' && <Firmware {...ctx} />}
            {view === 'security' && <Security {...ctx} />}
            {view === 'diagnostics' && <Diagnostics {...ctx} />}
            {view === 'display' && <DisplayReservations {...ctx} />}
            {view === 'catalog' && <Catalog {...ctx} />}
            {view === 'trace' && <Trace {...ctx} />}
            {view === 'roles' && (
              <Roles
                me={me}
                users={users}
                roles={roles}
                permissions={permissions}
                matrix={matrix}
                tenants={tenants}
                sites={sites}
                onUsersChange={(next) => {
                  setUsers(next);
                  loadMe().catch(() => {});
                }}
              />
            )}
          </div>
          ) : null}
        </main>
      </div>
      <p className="product-identity">
        Helios <strong>CSMS</strong> · OCPP 2.1 · charge points connect outbound ·{' '}
        <strong>Voltforge</strong> is the separate EVSE lab
      </p>
      <AgentHud hud={hud} onBack={backToChat} onDismiss={dismissHud} />
      <Tutorial
        open={tutorialOpen}
        onClose={() => {
          setTutorialOpen(false);
          setNavOpen(false);
        }}
        navigate={navigate}
        onOpenNav={setNavOpen}
        can={can}
      />
    </div>
  );
}
