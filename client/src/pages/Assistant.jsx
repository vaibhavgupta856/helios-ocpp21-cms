import { useEffect, useMemo, useRef, useState } from 'react';
import PageHeader from '../components/PageHeader.jsx';
import ActionQueue from '../components/ActionQueue.jsx';
import Markdown from '../components/Markdown.jsx';
import { api, isAbortError } from '../api.js';
import { allowedModes, can } from '../auth.js';

const MODES = [
  { id: 'ask', label: 'Ask' },
  { id: 'agent', label: 'Agent' },
];

const SUGGESTIONS = {
  ask: [
    'What is online right now?',
    'Status of Whitefield Hub',
    'How do I add RFID?',
    'How do I connect a charge point on WSS?',
    'Should we keep Whitefield Hub?',
    'How do I approve a Reset?',
  ],
  agent: [
    'Add a charge point',
    'Add RFID CARD-LAB-21',
    'Add tenant FleetCo with a station Indiranagar Hub in Bengaluru and a charge point CP-01',
    'Simulate a charger at Cyber Hub',
  ],
};

const COPY = {
  ask: {
    subtitle: 'Ask — live CMS answers. No API key needed for operator work.',
    banner: 'Ask reads the live network. Say “Add a charge point …” and Helios will switch to Agent for that write (no API key). Or open Agent yourself.',
    empty: 'Ask about a hub, what is online, WSS pairing, RFID, Demand, or Approve. I will not change the CMS here.',
    placeholder: 'Status of Whitefield Hub, how do I add RFID, pair Voltforge on WSS…',
    button: 'Ask',
    busy: 'Reading the live CMS…',
    hint: 'Ask only answers. Switch to Agent when you want a tenant, station, RFID, or charge point created.',
  },
  agent: {
    subtitle: 'Agent — does the CMS work. Live OCPP still waits for Approve.',
    banner: 'Agent is on. Say what to add. If a tenant, station, or name is missing, I will ask before changing anything.',
    empty: 'Tell me what to create — tenant, hub, charge point, RFID, tariff, or a simulated charger. Restart and firmware still come back as proposals to Approve.',
    placeholder: 'Add tenant FleetCo with a station Indiranagar Hub in Bengaluru and a charge point CP-01',
    button: 'Do it',
    busy: 'Working in the live CMS…',
    hint: 'If a tenant, station, or OCPP ID is missing, type it in the reply box under my question — or tap a chip.',
  },
};

const MODE_KEY = 'helios-cms-mode';

function readMode(user) {
  const allowed = allowedModes(user);
  try {
    const raw = sessionStorage.getItem(MODE_KEY);
    if (raw === 'plan' || raw === 'multitask') return allowed.includes('ask') ? 'ask' : allowed[0] || 'ask';
    if (allowed.includes(raw)) return raw;
  } catch {
    /* ignore */
  }
  return allowed[0] || 'ask';
}

function chatKey(userId) {
  return `helios-cms-chat:${userId || 'anon'}`;
}

function readPreferredChat(userId) {
  try {
    return localStorage.getItem(chatKey(userId)) || sessionStorage.getItem(chatKey(userId)) || '';
  } catch {
    return '';
  }
}

function writePreferredChat(userId, id) {
  try {
    localStorage.setItem(chatKey(userId), id);
    sessionStorage.setItem(chatKey(userId), id);
  } catch {
    /* ignore */
  }
}

function SendStopButton({ busy, disabled, onStop, label }) {
  if (busy) {
    return (
      <button type="button" className="icon-btn stop" aria-label="Stop" title="Stop" onClick={onStop}>
        <span className="icon-stop" aria-hidden="true" />
      </button>
    );
  }
  return (
    <button type="submit" className="icon-btn send" disabled={disabled} aria-label={label} title={label}>
      <span className="icon-send" aria-hidden="true" />
    </button>
  );
}

function when(at) {
  if (!at) return '';
  const d = new Date(at);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString();
}

function SlotReply({ pending, onSend, disabled }) {
  const [val, setVal] = useState('');
  const ref = useRef(null);
  useEffect(() => {
    const t = setTimeout(() => ref.current?.focus(), 50);
    return () => clearTimeout(t);
  }, [pending?.slot]);
  return (
    <form
      className="slot-reply"
      onSubmit={(e) => {
        e.preventDefault();
        const text = val.trim();
        if (!text || disabled) return;
        onSend(text);
        setVal('');
      }}
    >
      <input
        ref={ref}
        value={val}
        onChange={(e) => setVal(e.target.value)}
        placeholder={pending?.prompt || 'Type the missing name or ID…'}
        disabled={disabled}
        autoComplete="off"
      />
      <button className="btn primary" type="submit" disabled={disabled || !val.trim()}>
        Reply
      </button>
    </form>
  );
}

export default function Assistant({ me, users = [], onAgentWalk }) {
  const modes = useMemo(() => allowedModes(me), [me]);
  const [mode, setMode] = useState(() => readMode(me));
  const [chats, setChats] = useState([]);
  const [chatId, setChatId] = useState('');
  const [chat, setChat] = useState(null);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState(null);
  const [error, setError] = useState('');
  const [assignOpen, setAssignOpen] = useState(false);
  const [llmOpen, setLlmOpen] = useState(false);
  const [llmBusy, setLlmBusy] = useState('');
  const [llmNotice, setLlmNotice] = useState('');
  const [provider, setProvider] = useState('openai');
  const [apiKey, setApiKey] = useState('');
  const [llmModel, setLlmModel] = useState('gpt-4o-mini');
  const [baseUrl, setBaseUrl] = useState('https://api.openai.com/v1');
  const [ollama, setOllama] = useState({ up: false, models: [], recommended: 'qwen2.5:7b' });
  const [feedBusy, setFeedBusy] = useState(false);
  const [queue, setQueue] = useState([]);
  const localLlm = provider === 'ollama' || provider === 'custom';
  const canLlm = can(me, 'security.write');
  const bottomRef = useRef(null);
  const mounted = useRef(true);
  const busyRef = useRef(false);
  const chatIdRef = useRef('');
  const queueRef = useRef([]);
  const abortRef = useRef(null);
  const runningRef = useRef(false);
  const jobGen = useRef(0);
  const sendRef = useRef(() => {});
  const tourDemoGen = useRef(0);
  const copy = COPY[mode] || COPY.ask;
  const messages = chat?.messages || [];
  const lastMsg = messages[messages.length - 1];
  const waiting = lastMsg?.role === 'assistant' && lastMsg.needsInput ? lastMsg : null;
  const canApprove = can(me, 'actions.approve');
  const canAssign = can(me, 'chats.all') || chat?.createdBy === me?.id;
  busyRef.current = busy;
  chatIdRef.current = chatId;
  queueRef.current = queue;

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    const next = readMode(me);
    setMode(next);
  }, [me?.id]);

  useEffect(() => {
    if (mode === 'plan' || mode === 'multitask' || (modes.length && !modes.includes(mode))) {
      setMode(readMode(me));
    }
  }, [mode, modes, me]);

  const loadStatus = () =>
    api('/api/assistant')
      .then((data) => {
        const a = { ...(data.llm || {}), ...(data.assistant || {}) };
        setStatus(a);
        if (data.ollama) setOllama(data.ollama);
        if (a.provider && a.provider !== 'local') setProvider(a.provider);
        if (a.llm && a.model && a.model !== 'live-cms-analyst') setLlmModel(a.model);
        if (a.llm && a.baseUrl && a.baseUrl !== 'local') setBaseUrl(a.baseUrl);
        return a;
      })
      .catch(() => {});

  useEffect(() => {
    loadStatus();
  }, []);

  useEffect(() => {
    const onTour = (e) => {
      const d = e.detail || {};
      if (d.llmOpen === true) setLlmOpen(true);
      else if (d.llmOpen === false) setLlmOpen(false);
      if (!d.demo || !d.prompt) {
        tourDemoGen.current += 1;
        return;
      }
      const gen = ++tourDemoGen.current;
      const prompt = String(d.prompt).trim();
      const nextMode = d.mode || 'ask';
      (async () => {
        if (modes.includes(nextMode)) setMode(nextMode);
        setDraft('');
        await new Promise((r) => setTimeout(r, 550));
        if (tourDemoGen.current !== gen) return;
        for (let i = 1; i <= prompt.length; i++) {
          if (tourDemoGen.current !== gen) return;
          setDraft(prompt.slice(0, i));
          const ch = prompt[i - 1];
          const delay = ch === ' ' ? 280 : /[-.]/.test(ch) ? 200 : 115;
          await new Promise((r) => setTimeout(r, delay));
        }
        if (tourDemoGen.current !== gen) return;
        await new Promise((r) => setTimeout(r, 900));
        if (tourDemoGen.current !== gen) return;
        sendRef.current(prompt, { mode: nextMode });
      })();
    };
    window.addEventListener('massive-tutorial', onTour);
    return () => {
      tourDemoGen.current += 1;
      window.removeEventListener('massive-tutorial', onTour);
    };
  }, [modes]);

  useEffect(() => {
    sessionStorage.setItem(MODE_KEY, mode);
  }, [mode]);

  const loadList = async () => {
    const data = await api('/api/chats');
    setChats(data.chats || []);
    return data.chats || [];
  };

  const discardRun = (clearQueue) => {
    jobGen.current += 1;
    abortRef.current?.abort();
    if (clearQueue) {
      queueRef.current = [];
      setQueue([]);
    }
  };

  const refreshChat = async (id) => {
    if (!id) return null;
    const data = await api(`/api/chats/${encodeURIComponent(id)}`);
    if (!data?.chat) throw new Error('Chat not found');
    setChat(data.chat);
    setChatId(data.chat.id);
    chatIdRef.current = data.chat.id;
    writePreferredChat(me?.id, data.chat.id);
    return data.chat;
  };

  const openChat = async (id) => {
    if (id && id !== chatIdRef.current) discardRun(true);
    if (!id) {
      setChat(null);
      setChatId('');
      chatIdRef.current = '';
      return;
    }
    await refreshChat(id);
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await loadList();
        if (cancelled) return;
        if (busyRef.current && chatIdRef.current) return;
        const preferred = readPreferredChat(me?.id);
        const pick =
          list.find((c) => c.id === chatIdRef.current) ||
          list.find((c) => c.id === preferred) ||
          list[0];
        if (pick) await openChat(pick.id);
        else {
          setChat(null);
          setChatId('');
        }
      } catch (err) {
        if (!cancelled) setError(err.message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [me?.id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, busy, chatId, waiting, queue]);

  const newChat = async () => {
    discardRun(true);
    setError('');
    const data = await api('/api/chats', { method: 'POST', body: JSON.stringify({ title: 'New chat' }) });
    await loadList();
    await openChat(data.chat.id);
    setAssignOpen(false);
  };

  const runJob = async (job) => {
    const gen = ++jobGen.current;
    runningRef.current = true;
    setBusy(true);
    const ac = new AbortController();
    abortRef.current = ac;
    const question = String(job.question || '').trim();
    const nextMode = job.mode || mode;
    const optimistic = {
      id: job.id || `local-${Date.now()}`,
      role: 'user',
      content: question,
      userId: me?.id || null,
      userName: me?.name || 'Operator',
      mode: nextMode,
      at: new Date().toISOString(),
      optimistic: true,
    };
    setChat((prev) => ({
      ...(prev || { title: 'New chat', createdBy: me?.id }),
      messages: [...(prev?.messages || []), optimistic],
    }));
    let id = chatIdRef.current;
    try {
      if (!id) {
        const created = await api('/api/chats', { method: 'POST', body: JSON.stringify({ title: 'New chat' }) });
        id = created.chat.id;
        chatIdRef.current = id;
        if (mounted.current) {
          setChatId(id);
          writePreferredChat(me?.id, id);
          setChat((prev) => ({
            ...created.chat,
            messages: prev?.messages?.length ? prev.messages : created.chat.messages || [],
          }));
        }
      }
      const resultPromise = api(`/api/chats/${encodeURIComponent(id)}/messages`, {
        method: 'POST',
        body: JSON.stringify({
          question,
          mode: nextMode,
          tools: job.tools || undefined,
        }),
        signal: ac.signal,
      });
      onAgentWalk?.({ question, mode: nextMode, job: resultPromise });
      const result = await resultPromise;
      if (!mounted.current || jobGen.current !== gen) return;
      if (result?.chat) {
        setChat(result.chat);
        setChatId(result.chat.id);
        chatIdRef.current = result.chat.id;
        writePreferredChat(me?.id, result.chat.id);
      } else if (id) {
        await refreshChat(id);
      }
      await loadList();
    } catch (err) {
      if (!mounted.current || jobGen.current !== gen) return;
      if (isAbortError(err)) {
        if (err.chat) {
          setChat(err.chat);
          setChatId(err.chat.id || id);
          if (err.chat.id) chatIdRef.current = err.chat.id;
        } else if (id) {
          try {
            await refreshChat(id);
          } catch {
            setChat((prev) => ({
              ...(prev || {}),
              messages: (prev?.messages || []).filter((m) => !m.optimistic),
            }));
          }
        }
      } else {
        setError(err.message);
        if (id) {
          try {
            await refreshChat(id);
          } catch {
            /* ignore */
          }
        }
      }
    } finally {
      if (abortRef.current === ac) abortRef.current = null;
      if (jobGen.current !== gen) {
        runningRef.current = false;
        if (mounted.current) setBusy(false);
        return;
      }
      runningRef.current = false;
      if (mounted.current) setBusy(false);
      const next = queueRef.current[0];
      if (next && mounted.current) {
        queueRef.current = queueRef.current.slice(1);
        setQueue(queueRef.current);
        await runJob(next);
      }
    }
  };

  const send = (text, override = {}) => {
    const question = String(text || draft).trim();
    if (!question || feedBusy) return;
    const nextMode = override.mode || mode;
    if (!can(me, `assistant.${nextMode}`)) {
      setError(`${me?.roleLabel || 'This role'} cannot use ${nextMode} mode`);
      return;
    }
    setDraft('');
    setError('');
    const job = {
      id: `q-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      question,
      mode: nextMode,
      tools: override.tools || undefined,
    };
    if (runningRef.current) {
      const next = [...queueRef.current, job];
      queueRef.current = next;
      setQueue(next);
      return;
    }
    runJob(job);
  };
  sendRef.current = send;

  const cancelInflight = () => {
    abortRef.current?.abort();
  };

  const dropQueued = (id) => {
    const next = queueRef.current.filter((j) => j.id !== id);
    queueRef.current = next;
    setQueue(next);
  };

  const feedLive = async () => {
    if (busy || feedBusy) return;
    if (!can(me, 'assistant.ask')) {
      setError(`${me?.roleLabel || 'This role'} cannot feed live CMS into Ask`);
      return;
    }
    setError('');
    setFeedBusy(true);
    try {
      let id = chatId;
      if (!id) {
        const created = await api('/api/chats', { method: 'POST', body: JSON.stringify({ title: 'Live CMS' }) });
        id = created.chat?.id;
        if (mounted.current) {
          setChatId(id);
          writePreferredChat(me?.id, id);
          setChat(created.chat);
        }
      }
      const data = await api(`/api/chats/${encodeURIComponent(id)}/live-pack`, {
        method: 'POST',
        body: '{}',
      });
      if (!mounted.current) return;
      if (data?.chat) {
        setChat(data.chat);
        setChatId(data.chat.id);
        writePreferredChat(me?.id, data.chat.id);
      }
      await loadList();
    } catch (err) {
      if (mounted.current) setError(err.message);
    } finally {
      if (mounted.current) setFeedBusy(false);
    }
  };

  const runPlan = (plan, as) => {
    if (!can(me, `assistant.${as}`)) {
      setError(`${me?.roleLabel || 'This role'} cannot run this plan in ${as} mode`);
      return;
    }
    setMode(as);
    const tools = (plan || []).filter((s) => s.tool).map((s) => ({ tool: s.tool, args: s.args || {}, title: s.title }));
    send('Run the agreed plan', { mode: as, tools });
  };

  const saveAssign = async (assignedTo) => {
    if (!chatId) return;
    try {
      const data = await api(`/api/chats/${encodeURIComponent(chatId)}`, {
        method: 'PATCH',
        body: JSON.stringify({ assignedTo }),
      });
      setChat(data.chat);
      await loadList();
    } catch (err) {
      setError(err.message);
    }
  };

  const removeChat = async (id) => {
    if (!window.confirm('Delete this chat?')) return;
    try {
      if (id === chatIdRef.current) discardRun(true);
      const data = await api(`/api/chats/${encodeURIComponent(id)}`, { method: 'DELETE' });
      setChats(data.chats || []);
      if (id === chatId) {
        const next = (data.chats || [])[0];
        if (next) await openChat(next.id);
        else {
          setChat(null);
          setChatId('');
        }
      }
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="assistant-page">
      <aside className="chat-rail" aria-label="Chat history" data-tour="ask-history">
        <div className="chat-rail-head">History</div>
        {chats.length === 0 ? <p className="muted">No chats yet.</p> : null}
        {chats.map((c) => (
          <button
            type="button"
            key={c.id}
            className={`chat-item ${c.id === chatId ? 'active' : ''}`}
            onClick={() => openChat(c.id)}
          >
            <div className="id">{c.title}</div>
            {c.lastPreview ? <div className="preview">{c.lastPreview}</div> : null}
            <div className="sub">
              Created by {c.createdByName}
              {c.lastUserName ? ` · last: ${c.lastUserName}` : ''}
            </div>
            <div className="sub">
              {c.messageCount || 0} question{c.messageCount === 1 ? '' : 's'}
              {c.updatedAt ? ` · ${when(c.updatedAt)}` : ''}
            </div>
          </button>
        ))}
      </aside>
      <div className="assistant-main">
      <PageHeader
        title="Ask Helios"
        subtitle={copy.subtitle}
        actions={
          <>
            <div className="mode-switch" role="group" aria-label="Assistant mode" data-tour="ask-modes">
              {MODES.filter((m) => modes.includes(m.id)).map((m) => (
                <button
                  type="button"
                  key={m.id}
                  className={mode === m.id ? 'active' : ''}
                  onClick={() => setMode(m.id)}
                >
                  {m.label}
                </button>
              ))}
            </div>
            <span className="ask-tour-feed" data-tour="ask-feed">
              <button type="button" className="btn" onClick={() => setLlmOpen((v) => !v)}>
                API key
              </button>
              {can(me, 'assistant.ask') ? (
                <button type="button" className="btn" disabled={busy || feedBusy} onClick={feedLive}>
                  {feedBusy ? 'Packing live CMS…' : chat?.livePackEnabled ? 'Refresh live CMS' : 'Feed live CMS'}
                </button>
              ) : null}
            </span>
            <button type="button" className="btn" onClick={newChat}>
              New chat
            </button>
          </>
        }
      />
      <p className={`assistant-banner ${mode}`}>{copy.banner}</p>
      {status?.unauthorized || status?.keyMismatch ? (
        <p className="assistant-banner llm-key">
          {status?.unauthorized
            ? 'The saved API key was rejected. Paste a new one under API key — off-topic write-ups will not call the model until it works. Live CMS Ask and Agent still work.'
            : 'Saved API key does not match this provider. Paste a matching key under API key. Live CMS Ask and Agent still work.'}
        </p>
      ) : null}
      <p className="muted assistant-meta">
        {status?.unauthorized ? (
          <>
            <span className="llm-chip bad">API key rejected</span>
            Paste a new key under API key, or set CMS_LLM_API_KEY. Live CMS answers still work.
          </>
        ) : status?.keyMismatch ? (
          <>
            <span className="llm-chip bad">Key mismatch</span>
            {status.keyMismatchHint || 'Saved API key does not match this provider. For OpenRouter paste sk-or-v1-…'}
          </>
        ) : status?.llm ? (
          <>
            <span className="llm-chip ok">{status.local ? 'Local model' : 'API key'}</span>
            {`${status.model} is answering from the live CMS${
              status.local ? ' · local Ollama' : status.keyHint ? ` · ${status.keyHint}` : ''
            }${mode === 'agent' || mode === 'multitask' ? ' · then recaps what landed' : ''}`}
          </>
        ) : (
          <>
            <span className="llm-chip none">No API key</span>
            Live CMS Ask and Agent work without a key. Adding a charge point, tenant, hub, or RFID is always local — no API key. Optional key (or Ollama) is only for jokes, poems, and off-topic write-ups.
          </>
        )}
        {me ? ` · asking as ${me.name}` : ''}
        {chat?.livePackEnabled
          ? ` · full live org in this chat${chat.livePackAt ? ` · packed ${when(chat.livePackAt)}` : ''}`
          : ''}
      </p>
      {llmOpen ? (
        <div className="card llm-panel">
          <h3>Language model</h3>
          <p className="muted">
            For this lab you do <strong>not</strong> need a key for Ask or Agent — they already read and write the live CMS.
            Optional: <strong>Ollama (local)</strong> with <code>qwen2.5:7b</code> for off-topic write-ups, or a cloud key.
            OpenRouter <code>:free</code> models share a daily cap. Cloud keys stay in <code>certs/llm.json</code> if you switch back.
          </p>
          {ollama?.up ? (
            <p className="ok-msg">Ollama is running{ollama.models?.length ? ` · ${ollama.models.join(', ')}` : ''}.</p>
          ) : (
            <p className="error">
              Ollama is not running yet. Install it, then <code>ollama pull qwen2.5:7b</code>.
            </p>
          )}
          {status?.keyMismatch ? <p className="error">{status.keyMismatchHint}</p> : null}
          {canLlm ? (
            <form
              className="form-row"
              onSubmit={async (e) => {
                e.preventDefault();
                setLlmBusy('save');
                setError('');
                setLlmNotice('');
                try {
                  const preset = (status?.providers || []).find((p) => p.id === provider);
                  const data = await api('/api/assistant/llm', {
                    method: 'PUT',
                    body: JSON.stringify({
                      provider,
                      apiKey: localLlm ? undefined : apiKey.trim() || undefined,
                      model: llmModel.trim() || (localLlm ? 'qwen2.5:7b' : undefined),
                      baseUrl: (baseUrl.trim() || preset?.baseUrl || '').replace(/\/$/, ''),
                    }),
                  });
                  setStatus({ ...(data.llm || {}), ...(data.assistant || {}) });
                  if (data.ollama) setOllama(data.ollama);
                  setApiKey('');
                  if (data.probe?.ok) {
                    setLlmNotice(
                      data.probe.local
                        ? `Local Ollama is answering as ${data.probe.model}. Ask and Agent use this model.`
                        : `OpenRouter accepted the key. Ask Helios is using ${data.probe.model || data.assistant?.model}.`
                    );
                  } else if (data.assistant?.llm || data.assistant?.local) {
                    setLlmNotice(data.probe?.error || 'Saved, but the model did not respond.');
                  } else {
                    setLlmNotice('Saved. Still on the keyword CMS analyst.');
                  }
                } catch (err) {
                  setError(err.message);
                } finally {
                  setLlmBusy('');
                }
              }}
            >
              <label className="field">
                Provider
                <select
                  value={provider}
                  onChange={(e) => {
                    const id = e.target.value;
                    setProvider(id);
                    const preset = (status?.providers || []).find((p) => p.id === id);
                    if (preset) {
                      setLlmModel(id === 'ollama' && ollama.recommended ? ollama.recommended : preset.model);
                      setBaseUrl(preset.baseUrl);
                    }
                  }}
                >
                  {(status?.providers || [
                    { id: 'ollama', label: 'Ollama (local)' },
                    { id: 'openai', label: 'OpenAI' },
                    { id: 'groq', label: 'Groq' },
                    { id: 'claude', label: 'Claude (Anthropic)' },
                    { id: 'openrouter', label: 'OpenRouter (Nemotron free)' },
                    { id: 'custom', label: 'Custom OpenAI-compatible' },
                  ]).map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </label>
              {localLlm ? null : (
              <label className="field">
                API key
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  autoComplete="off"
                  placeholder={
                    status?.keyHint && !status?.local
                      ? `Saved ${status.keyHint} — paste to replace`
                      : provider === 'openrouter'
                        ? 'sk-or-v1-…'
                        : provider === 'claude'
                        ? 'sk-ant-…'
                        : provider === 'groq'
                          ? 'gsk-…'
                          : 'sk-…'
                  }
                />
              </label>
              )}
              <label className="field">
                Model
                {provider === 'ollama' && ollama.models?.length ? (
                  <select value={llmModel} onChange={(e) => setLlmModel(e.target.value)}>
                    {ollama.models.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                    {ollama.models.includes(llmModel) ? null : <option value={llmModel}>{llmModel}</option>}
                  </select>
                ) : (
                  <input
                    value={llmModel}
                    onChange={(e) => setLlmModel(e.target.value)}
                    placeholder={provider === 'ollama' ? 'qwen2.5:7b' : provider === 'openrouter' ? 'nvidia/nemotron-3.5-lightning:free' : 'gpt-4o-mini'}
                  />
                )}
              </label>
              {localLlm ? (
                <label className="field">
                  Base URL
                  <input
                    value={baseUrl}
                    onChange={(e) => setBaseUrl(e.target.value)}
                    placeholder="http://127.0.0.1:11434/v1"
                  />
                </label>
              ) : null}
              <button className="btn primary" type="submit" disabled={!!llmBusy}>
                {llmBusy === 'save' ? 'Saving…' : localLlm ? 'Use this model' : 'Save key'}
              </button>
              {provider === 'ollama' ? (
                <button
                  type="button"
                  className="btn"
                  disabled={!!llmBusy}
                  onClick={async () => {
                    setLlmBusy('ollama');
                    setError('');
                    setLlmNotice('');
                    try {
                      const data = await api('/api/assistant/llm/ollama', {
                        method: 'POST',
                        body: JSON.stringify({ model: llmModel.trim() || 'qwen2.5:7b' }),
                      });
                      setStatus({ ...(data.llm || {}), ...(data.assistant || {}) });
                      if (data.ollama) setOllama(data.ollama);
                      setProvider('ollama');
                      if (data.probe?.ok) setLlmNotice(`Local Ollama is answering as ${data.probe.model}.`);
                      else setLlmNotice(data.probe?.error || 'Ollama did not respond yet. Pull qwen2.5:7b first.');
                    } catch (err) {
                      setError(err.message);
                    } finally {
                      setLlmBusy('');
                    }
                  }}
                >
                  {llmBusy === 'ollama' ? 'Connecting…' : 'Use Ollama'}
                </button>
              ) : null}
              {status?.llm ? (
                <button
                  type="button"
                  className="btn"
                  disabled={!!llmBusy}
                  onClick={async () => {
                    setLlmBusy('clear');
                    setError('');
                    setLlmNotice('');
                    try {
                      const data = await api('/api/assistant/llm', { method: 'DELETE' });
                      setStatus({ ...(data.llm || {}), ...(data.assistant || {}) });
                      setApiKey('');
                      setLlmNotice('Key cleared. Back to the local CMS analyst.');
                    } catch (err) {
                      setError(err.message);
                    } finally {
                      setLlmBusy('');
                    }
                  }}
                >
                  {llmBusy === 'clear' ? 'Clearing…' : 'Clear'}
                </button>
              ) : null}
            </form>
          ) : (
            <p className="muted">Only admin and super admin can save a key. Switch Act as in the header.</p>
          )}
          {llmNotice ? <p className="ok-msg">{llmNotice}</p> : null}
        </div>
      ) : null}
      {error ? <p className="error">{error}</p> : null}
          {chat ? (
            <div className="chat-meta">
              <div>
                <strong>{chat.title}</strong>
                <p className="muted">
                  Created by {chat.createdByName}
                  {chat.assignedNames?.length ? ` · assigned to ${chat.assignedNames.join(', ')}` : ''}
                </p>
              </div>
              <div className="ops">
                {canAssign ? (
                  <button type="button" className="btn" onClick={() => setAssignOpen((v) => !v)}>
                    Assign
                  </button>
                ) : null}
                {canAssign ? (
                  <button type="button" className="btn" onClick={() => removeChat(chat.id)}>
                    Delete
                  </button>
                ) : null}
              </div>
            </div>
          ) : null}
          {assignOpen && chat && canAssign ? (
            <div className="card assign-panel">
              <h3>Assign this chat</h3>
              <p className="muted">People you assign can open the thread and see who asked each question.</p>
              <div className="chip-picks">
                {users.map((u) => {
                  const checked = (chat.assignedTo || []).includes(u.id);
                  const locked = u.id === chat.createdBy;
                  return (
                    <label key={u.id} className="chip-pick">
                      <input
                        type="checkbox"
                        checked={checked || locked}
                        disabled={locked}
                        onChange={() => {
                          const next = new Set(chat.assignedTo || []);
                          if (next.has(u.id)) next.delete(u.id);
                          else next.add(u.id);
                          next.add(chat.createdBy);
                          saveAssign([...next]);
                        }}
                      />
                      {u.name}
                      <span className="muted"> · {u.roleLabel}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          ) : null}
          <div className="assistant-thread">
            {messages.length === 0 && (
              <div className="assistant-empty">
                <p>{copy.empty}</p>
                <div className="assistant-chips">
                  {(SUGGESTIONS[mode] || SUGGESTIONS.ask).map((s) => (
                    <button type="button" key={s} className="btn" onClick={() => send(s)}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {messages.map((m, i) => (
              <div
                key={m.id || `${m.at}-${m.content}`}
                className={`assistant-bubble ${m.role}${m.optimistic ? ' optimistic' : ''}${
                  m.source === 'live-pack' ? ' live-pack' : ''
                }`}
              >
                <div className="assistant-who">
                  {m.role === 'user'
                    ? `${m.userName || 'Operator'}${m.mode ? ` · ${String(m.mode).replace(/^./, (c) => c.toUpperCase())}` : ''}`
                    : `Helios · ${
                        m.source === 'live-pack'
                          ? 'Live CMS'
                          : m.source === 'cancelled'
                            ? 'Stopped'
                            : (m.mode || 'ask').replace(/^./, (c) => c.toUpperCase())
                      }${m.source === 'llm' && m.model ? ` · ${m.model}` : ''}`}
                  {m.at ? <span className="muted"> · {when(m.at)}</span> : null}
                </div>
                <div className="assistant-body">
                  <Markdown text={m.content} />
                </div>
                {m.role === 'assistant' && m.needsInput && i === messages.length - 1 && !busy ? (
                  <div className="slot-ask">
                    {(m.pending?.choices || []).length ? (
                      <div className="assistant-chips slot-chips">
                        {m.pending.choices.map((c) => (
                          <button type="button" key={c.id || c.label} className="btn" onClick={() => send(c.label)}>
                            {c.label}
                            {c.sub ? ` · ${c.sub}` : ''}
                          </button>
                        ))}
                      </div>
                    ) : null}
                    <SlotReply pending={m.pending || waiting?.pending} onSend={send} disabled={busy} />
                    <div className="assistant-chips slot-ops">
                      {m.pending?.optional ? (
                        <button type="button" className="btn" onClick={() => send('auto')}>
                          Auto
                        </button>
                      ) : null}
                      <button type="button" className="btn" onClick={() => send('cancel')}>
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : null}
                {m.role === 'assistant' && m.plan?.length && !m.needsInput ? (
                  <div className="plan-card">
                    <ol>
                      {m.plan.map((step) => (
                        <li key={step.id}>
                          <div>
                            {step.title}
                            {step.tool ? <span className="muted"> · {step.tool}</span> : null}
                          </div>
                          {step.note ? <div className="plan-note">{step.note}</div> : null}
                          {step.risk ? <div className="plan-risk">Risk: {step.risk}</div> : null}
                        </li>
                      ))}
                    </ol>
                    {m.mode === 'agent' || m.mode === 'multitask' ? null : (
                      <div className="ops">
                        {can(me, 'assistant.agent') ? (
                          <button type="button" className="btn primary" onClick={() => runPlan(m.plan, 'agent')}>
                            Run in Agent
                          </button>
                        ) : null}
                      </div>
                    )}
                  </div>
                ) : null}
                {m.role === 'assistant' && m.executedActions?.length ? (
                  <div className="assistant-done">
                    {m.executedActions.map((a, idx) => (
                      <span key={`${a.tool}-${idx}`} className={a.ok ? 'ok' : 'fail'}>
                        {a.ok ? `Done: ${a.summary}` : `Failed: ${a.summary}`}
                      </span>
                    ))}
                  </div>
                ) : null}
                {m.role === 'assistant' && m.proposedActions?.length ? (
                  <ActionQueue
                    actions={m.proposedActions}
                    canApprove={canApprove}
                    onDone={async () => {
                      const data = await api('/api/actions').catch(() => ({ actions: [] }));
                      const byId = Object.fromEntries((data.actions || []).map((a) => [a.id, a]));
                      setChat((prev) =>
                        prev
                          ? {
                              ...prev,
                              messages: (prev.messages || []).map((msg) => ({
                                ...msg,
                                proposedActions: (msg.proposedActions || []).map((a) => byId[a.id] || a),
                              })),
                            }
                          : prev
                      );
                    }}
                  />
                ) : null}
                {m.role === 'assistant' &&
                !m.needsInput &&
                !busy &&
                i === messages.length - 1 &&
                (m.suggestions || []).length ? (
                  <div className="assistant-chips assistant-followups">
                    {(m.suggestions || []).map((s) => (
                      <button type="button" key={s} className="btn" onClick={() => send(s)}>
                        {s}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            ))}
            {busy ? (
              <div className="assistant-bubble assistant thinking">
                <div className="assistant-who">Helios</div>
                <div className="assistant-body muted thinking-line">
                  <span className="thinking-dots" aria-hidden="true">
                    <i />
                    <i />
                    <i />
                  </span>
                  <span>
                    {status?.llm
                      ? mode === 'agent' || mode === 'multitask'
                        ? `Working with ${status.model}…`
                        : `Asking ${status.model}…`
                      : copy.busy}
                    {queue.length ? ` · ${queue.length} waiting` : ''}
                  </span>
                  <SendStopButton busy onStop={cancelInflight} />
                </div>
              </div>
            ) : null}
            {queue.map((j, i) => (
              <div key={j.id} className="assistant-bubble user queued">
                <div className="assistant-who">
                  Queued · {String(j.mode || 'ask').replace(/^./, (c) => c.toUpperCase())} · #{i + 1}
                </div>
                <div className="assistant-body queued-row">
                  <span>{j.question}</span>
                  <button type="button" className="btn" onClick={() => dropQueued(j.id)}>
                    Remove
                  </button>
                </div>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>
          <form
            className={`assistant-composer${waiting ? ' waiting' : ''}`}
            data-tour="ask-composer"
            onSubmit={(e) => {
              e.preventDefault();
              send();
            }}
          >
            <textarea
              rows={2}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              placeholder={
                waiting
                  ? 'Or type the missing name / OCPP ID here…'
                  : busy
                    ? 'Next question waits in the queue…'
                    : copy.placeholder
              }
              disabled={feedBusy}
            />
            <SendStopButton
              busy={busy}
              disabled={feedBusy || !draft.trim()}
              onStop={cancelInflight}
              label={waiting ? 'Reply' : copy.button}
            />
          </form>
          <p className="muted assistant-hint">
            {waiting
              ? 'Stay on this chat and answer in the box under my last message. I will not change the CMS until that detail is in.'
              : busy
                ? 'The square stops only the question that is running. Queued items stay and run next.'
                : copy.hint}
          </p>
      </div>
    </div>
  );
}
