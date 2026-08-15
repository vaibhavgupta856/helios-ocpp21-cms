import { getCurrentUserId } from './auth.js';

export function isAbortError(err) {
  return !!err && (err.name === 'AbortError' || err.aborted === true);
}

export async function api(path, options = {}) {
  const { headers: extraHeaders, ...rest } = options;
  let res;
  try {
    res = await fetch(path, {
      headers: {
        'Content-Type': 'application/json',
        'x-cms-user': getCurrentUserId(),
        ...(extraHeaders || {}),
      },
      ...rest,
    });
  } catch (err) {
    if (err?.name === 'AbortError' || rest.signal?.aborted) {
      const e = new Error('Stopped');
      e.name = 'AbortError';
      e.aborted = true;
      throw e;
    }
    throw err;
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 499 || data.aborted) {
      const e = new Error('Stopped');
      e.name = 'AbortError';
      e.aborted = true;
      e.chat = data.chat;
      throw e;
    }
    throw new Error(data.error || res.statusText);
  }
  return data;
}

export function pretty(value) {
  try {
    return JSON.stringify(value ?? {}, null, 2);
  } catch {
    return String(value);
  }
}

export function tokenLabel(idToken) {
  if (!idToken) return '—';
  if (typeof idToken === 'string') return idToken;
  return idToken.idToken || '—';
}
