/** Shared Markdown helpers so local + LLM replies look like a real copilot. */

export const REPLY_FORMAT = `Format the operator-facing reply in GitHub-flavored Markdown (the UI renders it):
- Lead with a short ## heading or a bold headline when the answer is more than one sentence.
- Use bullet or numbered lists for steps and evidence.
- When listing or comparing hubs, stations, sessions, KPIs, tokens, or tariffs, use a Markdown table: header row, then a |---| separator, then data rows.
- Use \`inline code\` for IDs, URLs, and OCPP actions. Use fenced code blocks only for real code.
- Use **bold** for names and verdicts.
- Do not wrap the whole reply in one code fence. Do not dump raw JSON as the answer.`;

const SCRATCHPAD =
  /LOCAL CMS NOTES|the user'?s actual request|live briefing data is provided|I need to use that|Let'?s (look at|draft|structure|think)|So I need to answer|without inventing numbers|following the formatting rules|keyword matcher missed|here'?s a thinking process|analyze user input|identify core task|extract facts from provided|chain of thought|I should provide|I'll follow the CMS/i;

export function looksLikeScratchpad(text) {
  const t = String(text || '');
  if (SCRATCHPAD.test(t)) return true;
  const meta = (t.match(/\b(the user|live briefing|formatting rules|operator-facing)\b/gi) || []).length;
  return meta >= 4 && /I need to|Let's /i.test(t);
}

export function stripLlmReply(text) {
  let t = String(text || '').trim();
  if (!t) return '';
  t = t.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
  t = t.replace(/<think>[\s\S]*$/i, '').trim();

  const cut = t.split(
    /\n(?:Let'?s draft|Draft(?:ed)?(?: answer)?|Final (?:answer|response)|Operator[- ]facing(?: answer| reply)?)\s*:?\s*\n/i
  );
  if (cut.length > 1) {
    const rest = cut.slice(1).join('\n').trim();
    if (rest.length > 40 && !looksLikeScratchpad(rest)) return rest;
    if (rest.length > 40) t = rest;
  }

  if (looksLikeScratchpad(t)) {
    const headings = [...t.matchAll(/^#{1,3}\s+.+$/gm)];
    if (headings.length) {
      const last = headings[headings.length - 1];
      const fromHead = t.slice(last.index).trim();
      if (fromHead.length > 40 && !looksLikeScratchpad(fromHead)) return fromHead;
    }
    return '';
  }
  return t;
}

export function isUselessReply(text) {
  const t = String(text || '')
    .replace(/\s+/g, ' ')
    .trim();
  if (t.length < 28) return true;
  return /^(done\.?|ok\.?|okay\.?|sure\.?|completed\.?|i (have )?(done|finished) that\.?)$/i.test(t);
}

/** LLM may rewrite. It must never ship an empty, thinking-only, stub, or fact-breaking reply. */
export function pickOperatorReply(llmText, fallback) {
  const local = String(fallback || '').trim();
  const llm = stripLlmReply(llmText);
  if (!llm || isUselessReply(llm) || looksLikeScratchpad(llm)) {
    return { text: local, source: 'local' };
  }
  if (local && local.length >= 80 && llm.length < 40) {
    return { text: local, source: 'local' };
  }
  if (local && factsDiverge(llm, local)) {
    return { text: local, source: 'local' };
  }
  return { text: llm, source: 'llm' };
}

function factsDiverge(llm, local) {
  const moneyRe = /(?:EUR|USD|INR|GBP)\s*[\d,]+(?:\.\d+)?/gi;
  const localMoney = [...String(local).matchAll(moneyRe)].map((m) => m[0].replace(/\s+/g, ' '));
  if (!localMoney.length) return false;
  const llmMoney = [...String(llm).matchAll(moneyRe)].map((m) => m[0].replace(/\s+/g, ' '));
  const unknown = llmMoney.filter((v) => !localMoney.includes(v));
  if (unknown.length >= 2) return true;
  const pct = [...String(llm).matchAll(/(\d+(?:\.\d+)?)%/g)].map((m) => m[1]);
  const localPct = [...String(local).matchAll(/(\d+(?:\.\d+)?)%/g)].map((m) => m[1]);
  return pct.some((p) => localPct.length && !localPct.includes(p));
}

export function mdTable(headers, rows) {
  if (!rows?.length) return '';
  const cell = (v) => {
    const s = String(v ?? '—').replace(/\|/g, '\\|').replace(/\n/g, ' ').trim();
    return s || '—';
  };
  const head = `| ${headers.map(cell).join(' | ')} |`;
  const sep = `| ${headers.map(() => '---').join(' | ')} |`;
  const body = rows.map((r) => `| ${(Array.isArray(r) ? r : [r]).map(cell).join(' | ')} |`).join('\n');
  return `${head}\n${sep}\n${body}`;
}
