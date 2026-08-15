/**
 * Optional LLM for Ask Helios. Stored in certs/llm.json (gitignored).
 * Env vars still work as fallback: CMS_LLM_API_KEY / OPENAI_API_KEY / GROQ_API_KEY / ANTHROPIC_API_KEY / OPENROUTER_API_KEY.
 */

import fs from 'fs';
import path from 'path';
import { CERT_DIR } from './tls.js';

const FILE = () => path.join(CERT_DIR, 'llm.json');

export const LLM_PROVIDERS = {
  openai: {
    id: 'openai',
    label: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-4o-mini',
  },
  groq: {
    id: 'groq',
    label: 'Groq',
    baseUrl: 'https://api.groq.com/openai/v1',
    model: 'llama-3.3-70b-versatile',
  },
  claude: {
    id: 'claude',
    label: 'Claude (Anthropic)',
    baseUrl: 'https://api.anthropic.com/v1',
    model: 'claude-sonnet-5',
  },
  openrouter: {
    id: 'openrouter',
    label: 'OpenRouter (Nemotron free)',
    baseUrl: 'https://openrouter.ai/api/v1',
    model: 'nvidia/nemotron-3.5-lightning:free',
  },
  ollama: {
    id: 'ollama',
    label: 'Ollama (local)',
    baseUrl: 'http://127.0.0.1:11434/v1',
    model: 'qwen2.5:7b',
  },
  custom: {
    id: 'custom',
    label: 'Custom OpenAI-compatible',
    baseUrl: 'http://127.0.0.1:11434/v1',
    model: 'llama3.1',
  },
};

let cached = null;
/** Last cloud 401/403 (or probe unauthorized). Cleared on save, clear, or a successful call. */
let authRejected = null;

function emptyFile() {
  return { provider: 'openai', apiKey: '', model: '', baseUrl: '' };
}

export function loadLlm() {
  if (cached) return cached;
  try {
    const file = JSON.parse(fs.readFileSync(FILE(), 'utf8'));
    cached = {
      provider: LLM_PROVIDERS[file.provider] ? file.provider : 'openai',
      apiKey: String(file.apiKey || '').trim(),
      model: String(file.model || '').trim(),
      baseUrl: String(file.baseUrl || '').trim().replace(/\/$/, ''),
    };
  } catch {
    cached = emptyFile();
  }
  return cached;
}

function envKey() {
  return (
    process.env.CMS_LLM_API_KEY ||
    process.env.OPENAI_API_KEY ||
    process.env.GROQ_API_KEY ||
    process.env.ANTHROPIC_API_KEY ||
    process.env.OPENROUTER_API_KEY ||
    ''
  ).trim();
}

function inferEnvProvider() {
  if (process.env.CMS_LLM_BASE_URL) return 'custom';
  if (process.env.OPENROUTER_API_KEY && !process.env.OPENAI_API_KEY && !process.env.CMS_LLM_API_KEY && !process.env.GROQ_API_KEY && !process.env.ANTHROPIC_API_KEY) {
    return 'openrouter';
  }
  if (process.env.ANTHROPIC_API_KEY && !process.env.OPENAI_API_KEY && !process.env.CMS_LLM_API_KEY && !process.env.GROQ_API_KEY) {
    return 'claude';
  }
  if (process.env.GROQ_API_KEY && !process.env.OPENAI_API_KEY && !process.env.CMS_LLM_API_KEY) return 'groq';
  if (process.env.OPENAI_API_KEY || process.env.CMS_LLM_API_KEY) return 'openai';
  return 'openai';
}

export function isClaudeRuntime(rt) {
  return rt?.provider === 'claude' || /anthropic\.com/i.test(rt?.baseUrl || '');
}

export function isOpenRouterRuntime(rt) {
  return rt?.provider === 'openrouter' || /openrouter\.ai/i.test(rt?.baseUrl || '');
}

export function isLocalProvider(provider) {
  return provider === 'ollama' || provider === 'custom';
}

export function isOllamaRuntime(rt) {
  return rt?.provider === 'ollama' || /:11434\b/.test(rt?.baseUrl || '');
}

export function keyMatchesProvider(provider, key) {
  const k = String(key || '').trim();
  if (!k) return true;
  if (provider === 'openrouter') return /^sk-or-/i.test(k);
  if (provider === 'claude') return /^sk-ant-/i.test(k);
  if (provider === 'groq') return /^gsk_/i.test(k);
  if (provider === 'openai') return /^sk-(proj-)?/.test(k) && !/^sk-or-/i.test(k) && !/^sk-ant-/i.test(k);
  return true;
}

export function keyMismatchHint(provider, key) {
  if (!key || keyMatchesProvider(provider, key)) return '';
  if (provider === 'openrouter') {
    return 'OpenRouter needs a key that starts with sk-or-v1-…. The saved key is from another provider (OpenAI sk-proj- / sk- will not work on openrouter.ai). Paste the key from openrouter.ai → Keys.';
  }
  return `The saved API key does not match provider “${provider}”. Paste a new key after switching provider.`;
}

export function llmRuntime() {
  const file = loadLlm();
  const localFile = isLocalProvider(file.provider) || isOllamaRuntime({ provider: file.provider, baseUrl: file.baseUrl });
  const fromFile = !!file.apiKey || localFile;
  const fromEnv = !fromFile && !!envKey();
  const provider = fromFile ? file.provider : inferEnvProvider();
  const preset = LLM_PROVIDERS[provider] || LLM_PROVIDERS.openai;
  const local = isLocalProvider(provider) || isOllamaRuntime({ provider, baseUrl: file.baseUrl || preset.baseUrl });
  const key = local ? file.apiKey || 'ollama' : file.apiKey || envKey();
  const baseUrl = (
    file.baseUrl ||
    process.env.CMS_LLM_BASE_URL ||
    preset.baseUrl
  ).replace(/\/$/, '');
  const model = file.model || process.env.CMS_LLM_MODEL || preset.model;
  return {
    provider,
    key,
    baseUrl,
    model,
    fromFile,
    fromEnv,
    local,
    llm: local || !!file.apiKey || !!envKey(),
  };
}

export function markLlmUnauthorized(message) {
  authRejected = { at: Date.now(), error: String(message || 'unauthorized').slice(0, 240) };
}

export function clearLlmUnauthorized() {
  authRejected = null;
}

function looksUnauthorized(status, message) {
  if (status === 401 || status === 403) return true;
  return /unauthorized|invalid api key|incorrect api key|no auth credentials|missing authentication|invalid_api_key/i.test(
    String(message || '')
  );
}

function maybeMarkUnauthorized(rt, status, message) {
  if (rt?.local) return;
  if (looksUnauthorized(status, message)) markLlmUnauthorized(message);
}

/** Whether the OpenAI-compatible (or Claude) API may be called this turn. */
export function llmAccess() {
  const rt = llmRuntime();
  if (!rt.llm) return { ok: false, code: 'no-key', local: false };
  if (rt.local) return { ok: true, code: 'ok', local: true };
  const mismatch = keyMismatchHint(rt.provider, rt.key);
  if (mismatch) return { ok: false, code: 'mismatch', hint: mismatch, local: false };
  if (authRejected) return { ok: false, code: 'unauthorized', local: false };
  return { ok: true, code: 'ok', local: false };
}

export function publicLlm() {
  const rt = llmRuntime();
  const cloudKey = rt.local ? '' : rt.key;
  const access = llmAccess();
  const mismatch = !!(cloudKey && !keyMatchesProvider(rt.provider, cloudKey));
  return {
    llm: rt.llm,
    provider: rt.provider,
    model: rt.llm ? rt.model : 'live-cms-analyst',
    baseUrl: rt.llm ? rt.baseUrl : 'local',
    source: rt.local ? 'ollama' : rt.fromFile ? 'panel' : rt.fromEnv ? 'env' : 'local',
    keyHint: rt.local ? 'local Ollama' : cloudKey ? `••••${cloudKey.slice(-4)}` : '',
    keyMismatch: mismatch,
    keyMismatchHint: keyMismatchHint(rt.provider, cloudKey),
    needsKey: !rt.llm,
    unauthorized: access.code === 'unauthorized',
    llmStatus: access.code === 'ok' ? (rt.llm ? 'ok' : 'no-key') : access.code,
    local: !!rt.local,
    providers: Object.values(LLM_PROVIDERS).map((p) => ({
      id: p.id,
      label: p.label,
      baseUrl: p.baseUrl,
      model: p.model,
    })),
  };
}

export function saveLlm(patch = {}) {
  const cur = loadLlm();
  const provider = LLM_PROVIDERS[patch.provider] ? patch.provider : cur.provider || 'openai';
  const preset = LLM_PROVIDERS[provider];
  const nextKey =
    patch.clearKey || patch.apiKey === ''
      ? ''
      : patch.apiKey != null && String(patch.apiKey).trim() !== ''
        ? String(patch.apiKey).trim()
        : cur.apiKey;
  const next = {
    provider,
    apiKey: nextKey,
    model: (() => {
      const raw = patch.model != null ? String(patch.model).trim() : cur.model || preset.model;
      if (isLocalProvider(provider) && (!raw || raw.includes('/'))) return preset.model;
      return raw;
    })(),
    baseUrl: (patch.baseUrl != null ? String(patch.baseUrl).trim() : cur.baseUrl || preset.baseUrl).replace(/\/$/, ''),
  };
  if (!next.apiKey && !envKey() && !isLocalProvider(provider)) {
    throw new Error('Paste an API key (OpenRouter sk-or-v1-…, OpenAI sk-…, Groq gsk-…, Claude sk-ant-…), or choose Ollama (local)');
  }
  const mismatch = keyMismatchHint(provider, next.apiKey);
  if (mismatch) throw new Error(mismatch);
  fs.mkdirSync(CERT_DIR, { recursive: true });
  fs.writeFileSync(FILE(), JSON.stringify(next, null, 2));
  cached = next;
  clearLlmUnauthorized();
  return publicLlm();
}

export function clearLlm() {
  cached = emptyFile();
  try {
    if (fs.existsSync(FILE())) fs.unlinkSync(FILE());
  } catch {
    /* ignore */
  }
  clearLlmUnauthorized();
  return publicLlm();
}

function llmHttpError(data, status) {
  const err = data?.error;
  if (!err) return `LLM HTTP ${status}`;
  if (typeof err === 'string') return err;
  return err.message || JSON.stringify(err);
}

export function capMaxTokens(rt, requested) {
  let n = Number(requested) || 800;
  if (!Number.isFinite(n) || n <= 0) n = 800;
  if (isOpenRouterRuntime(rt) && /:free\b/i.test(rt.model || '')) n = Math.min(n, 800);
  return Math.max(64, Math.min(Math.floor(n), 4096));
}

function cheaperMaxTokens(message, requested) {
  const msg = String(message || '');
  const m = msg.match(/can only afford (\d+)/i);
  if (m) return Math.max(64, Math.min(Number(m[1]), requested - 1));
  if (/fewer max_tokens|requires more credits/i.test(msg)) {
    return Math.max(64, Math.min(512, Math.floor(requested / 2) || 256));
  }
  return null;
}

export const OPENROUTER_FREE_FALLBACKS = [
  'openai/gpt-oss-20b:free',
  'google/gemma-4-31b-it:free',
  'google/gemma-4-26b-a4b-it:free',
  'nvidia/nemotron-nano-9b-v2:free',
];

let freeLimitUntil = 0;

export function isOpenRouterLimited() {
  return Date.now() < freeLimitUntil;
}

function markOpenRouterLimited(status, message) {
  if (status === 429 || /free-models-per-day|rate limit exceeded/i.test(String(message || ''))) {
    freeLimitUntil = Date.now() + 15 * 60 * 1000;
    return true;
  }
  return false;
}

function modelQueue(rt, requested) {
  const primary = String(requested || rt.model || '').trim();
  if (!primary) return [];
  if (isOllamaRuntime(rt) || !isOpenRouterRuntime(rt)) return [primary];
  const extra = OPENROUTER_FREE_FALLBACKS.filter((m) => m && m !== primary);
  return [primary, ...extra];
}

function canFallbackModel(status, message) {
  if (status === 401 || status === 403) return false;
  if (status === 429 || /free-models-per-day|rate limit exceeded/i.test(String(message || ''))) return false;
  if (status === 402 || status === 404 || status === 502 || status === 503) return true;
  return /no endpoints|not a valid model|quota|credits|afford|unavailable|overloaded/i.test(String(message || ''));
}

export function abortError(message = 'Stopped') {
  const err = new Error(message);
  err.name = 'AbortError';
  err.aborted = true;
  return err;
}

export function isAbortError(err) {
  return !!err && (err.name === 'AbortError' || err.aborted === true);
}

export function throwIfAborted(signal) {
  if (signal?.aborted) throw abortError();
}

export async function postOpenAiChat(rt, body, signal) {
  throwIfAborted(signal);
  if (isOpenRouterRuntime(rt) && isOpenRouterLimited()) {
    throw new Error('Rate limit exceeded: free-models-per-day. Add 10 credits to unlock 1000 free model requests per day.');
  }
  const headers = {
    Authorization: `Bearer ${rt.key || 'ollama'}`,
    'Content-Type': 'application/json',
  };
  if (isOpenRouterRuntime(rt)) {
    headers['HTTP-Referer'] = 'http://localhost:5174';
    headers['X-Title'] = 'Helios CSMS';
  }
  const url = `${rt.baseUrl}/chat/completions`;
  const send = (part) =>
    fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(part),
      signal,
    });

  const models = modelQueue(rt, body.model);
  let lastError = 'LLM request failed';
  for (const model of models) {
    const payload = { ...body, model, max_tokens: capMaxTokens({ ...rt, model }, body.max_tokens) };
    let res = await send(payload);
    let data = await res.json().catch(() => ({}));
    if (!res.ok && res.status === 402) {
      const next = cheaperMaxTokens(llmHttpError(data, res.status), payload.max_tokens);
      if (next && next < payload.max_tokens) {
        payload.max_tokens = next;
        res = await send(payload);
        data = await res.json().catch(() => ({}));
      }
    }
    if (res.ok) {
      clearLlmUnauthorized();
      if (!data.model) data.model = model;
      return data;
    }
    lastError = llmHttpError(data, res.status);
    maybeMarkUnauthorized(rt, res.status, lastError);
    markOpenRouterLimited(res.status, lastError);
    throwIfAborted(signal);
    if (!canFallbackModel(res.status, lastError)) throw new Error(lastError);
  }
  throw new Error(lastError);
}

export async function probeLlm() {
  const rt = llmRuntime();
  if (!rt.llm) return { ok: false, error: 'No language model configured', model: rt.model };
  const mismatch = rt.local ? '' : keyMismatchHint(rt.provider, rt.key);
  if (mismatch) return { ok: false, error: mismatch, model: rt.model };
  if (isClaudeRuntime(rt)) return { ok: true, model: rt.model, skipped: true };
  try {
    const data = await postOpenAiChat(rt, {
      model: rt.model,
      temperature: 0,
      max_tokens: 64,
      messages: [{ role: 'user', content: 'Reply with the single word pong.' }],
    });
    clearLlmUnauthorized();
    return { ok: true, model: data.model || rt.model, local: !!rt.local };
  } catch (err) {
    const msg = String(err.message || err).slice(0, 240);
    maybeMarkUnauthorized(rt, 0, msg);
    if (rt.local && /fetch|ECONNREFUSED|connect/i.test(msg)) {
      return {
        ok: false,
        local: true,
        model: rt.model,
        error: 'Ollama is not running. Install it, then run: ollama pull qwen2.5:7b',
      };
    }
    return { ok: false, error: msg, model: rt.model, local: !!rt.local, unauthorized: looksUnauthorized(0, msg) };
  }
}

const OLLAMA_TAGS = 'http://127.0.0.1:11434/api/tags';
export const OLLAMA_RECOMMENDED = 'qwen2.5:7b';

function pickBestOllamaModel(names) {
  const list = (names || []).map(String);
  const rank = [
    /^qwen2\.5:7b\b/,
    /^qwen2\.5:14b\b/,
    /^llama3\.1:8b\b/,
    /^qwen2\.5:3b\b/,
    /^llama3\.2:3b\b/,
    /qwen2\.5/,
    /llama3\.1/,
    /mistral/,
    /qwen/,
    /llama/,
  ];
  for (const re of rank) {
    const hit = list.find((n) => re.test(n));
    if (hit) return hit;
  }
  return list[0] || '';
}

export async function discoverOllama() {
  try {
    const res = await fetch(OLLAMA_TAGS, { signal: AbortSignal.timeout(2000) });
    if (!res.ok) {
      return { up: false, models: [], recommended: OLLAMA_RECOMMENDED, baseUrl: 'http://127.0.0.1:11434/v1' };
    }
    const data = await res.json().catch(() => ({}));
    const models = (data.models || []).map((m) => m.name).filter(Boolean);
    return {
      up: true,
      models,
      recommended: pickBestOllamaModel(models) || OLLAMA_RECOMMENDED,
      baseUrl: 'http://127.0.0.1:11434/v1',
    };
  } catch {
    return {
      up: false,
      models: [],
      recommended: OLLAMA_RECOMMENDED,
      baseUrl: 'http://127.0.0.1:11434/v1',
      hint: 'Install Ollama from https://ollama.com/download then run: ollama pull qwen2.5:7b',
    };
  }
}

export async function useOllama(preferred) {
  const info = await discoverOllama();
  const model = String(preferred || info.recommended || OLLAMA_RECOMMENDED).trim() || OLLAMA_RECOMMENDED;
  if (!info.up) {
    throw Object.assign(
      new Error('Ollama is not running. Install from https://ollama.com/download, start it, then run: ollama pull qwen2.5:7b'),
      { status: 400 }
    );
  }
  return saveLlm({
    provider: 'ollama',
    model,
    baseUrl: info.baseUrl,
  });
}

/** One OpenAI-compatible chat turn. Returns the raw assistant message (content + tool_calls). */
export async function completeChat({ messages, tools, temperature = 0.2, max_tokens = 1600, signal } = {}) {
  const access = llmAccess();
  if (!access.ok) {
    if (access.code === 'mismatch') throw new Error(access.hint);
    if (access.code === 'unauthorized') throw new Error('Saved API key was rejected (unauthorized)');
    throw new Error('No language model configured');
  }
  const rt = llmRuntime();
  const mismatch = rt.local ? '' : keyMismatchHint(rt.provider, rt.key);
  if (mismatch) throw new Error(mismatch);
  if (isClaudeRuntime(rt)) {
    throw new Error('Copilot loop uses the OpenAI-compatible chat API. Switch provider to OpenRouter or OpenAI.');
  }

  const body = {
    model: rt.model,
    temperature,
    max_tokens,
    messages,
  };
  if (tools?.length) {
    body.tools = tools;
    body.tool_choice = 'auto';
    if (rt.provider === 'openai') body.parallel_tool_calls = true;
  }

  let toolsStripped = false;
  let data;
  try {
    data = await postOpenAiChat(rt, body, signal);
  } catch (err) {
    if (isAbortError(err) || !tools?.length) throw err;
    delete body.tools;
    delete body.tool_choice;
    delete body.parallel_tool_calls;
    toolsStripped = true;
    data = await postOpenAiChat(rt, body, signal);
  }
  return { message: data.choices?.[0]?.message || {}, toolsStripped, model: data.model || rt.model };
}
