import { Fragment } from 'react';

function Inline({ text }) {
  const s = String(text || '');
  const re = /(`[^`]+`|\*\*[^*]+\*\*|__[^_]+__|\*[^*]+\*|_[^_]+_|\[([^\]]+)\]\((https?:[^)\s]+)\))/g;
  const out = [];
  let last = 0;
  let m;
  let i = 0;
  while ((m = re.exec(s))) {
    if (m.index > last) out.push(s.slice(last, m.index));
    const tok = m[0];
    if (tok.startsWith('`')) {
      out.push(<code key={i++}>{tok.slice(1, -1)}</code>);
    } else if (tok.startsWith('**') || tok.startsWith('__')) {
      out.push(<strong key={i++}>{tok.slice(2, -2)}</strong>);
    } else if (tok.startsWith('[')) {
      out.push(
        <a key={i++} href={m[3]} target="_blank" rel="noreferrer">
          {m[2]}
        </a>
      );
    } else {
      out.push(<em key={i++}>{tok.slice(1, -1)}</em>);
    }
    last = m.index + tok.length;
  }
  if (last < s.length) out.push(s.slice(last));
  return out;
}

function isSep(line) {
  const t = String(line || '').trim();
  return /^\|?[\s:|-]*-[\s:|-]*\|?$/.test(t) && t.includes('-') && /\|/.test(t);
}

function isRow(line) {
  return /\|/.test(line) && !String(line).trim().startsWith('```');
}

function cells(line) {
  let s = String(line || '').trim();
  if (s.startsWith('|')) s = s.slice(1);
  if (s.endsWith('|')) s = s.slice(0, -1);
  return s.split('|').map((c) => c.trim());
}

function parse(raw) {
  const text = String(raw || '').replace(/\r\n/g, '\n');
  const lines = text.split('\n');
  const blocks = [];
  let i = 0;

  const flushPara = (buf) => {
    const body = buf.join('\n').trim();
    if (body) blocks.push({ type: 'p', text: body });
    buf.length = 0;
  };

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      i += 1;
      continue;
    }

    if (trimmed.startsWith('```')) {
      const lang = trimmed.slice(3).trim();
      const body = [];
      i += 1;
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        body.push(lines[i]);
        i += 1;
      }
      if (i < lines.length) i += 1;
      blocks.push({ type: 'code', lang, text: body.join('\n') });
      continue;
    }

    const heading = trimmed.match(/^(#{1,3})\s+(.+)$/);
    if (heading) {
      blocks.push({ type: 'h', level: heading[1].length, text: heading[2] });
      i += 1;
      continue;
    }

    if (/^(\*\*\*|---|___)\s*$/.test(trimmed)) {
      blocks.push({ type: 'hr' });
      i += 1;
      continue;
    }

    if (isRow(line) && i + 1 < lines.length && isSep(lines[i + 1])) {
      const headers = cells(line);
      i += 2;
      const rows = [];
      while (i < lines.length && isRow(lines[i]) && !isSep(lines[i])) {
        rows.push(cells(lines[i]));
        i += 1;
      }
      blocks.push({ type: 'table', headers, rows });
      continue;
    }

    if (/^>\s?/.test(trimmed)) {
      const buf = [];
      while (i < lines.length && /^>\s?/.test(lines[i].trim())) {
        buf.push(lines[i].trim().replace(/^>\s?/, ''));
        i += 1;
      }
      blocks.push({ type: 'quote', text: buf.join('\n') });
      continue;
    }

    if (/^[-*]\s+/.test(trimmed)) {
      const items = [];
      while (i < lines.length && /^[-*]\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^[-*]\s+/, ''));
        i += 1;
      }
      blocks.push({ type: 'ul', items });
      continue;
    }

    if (/^\d+[.)]\s+/.test(trimmed)) {
      const items = [];
      while (i < lines.length && /^\d+[.)]\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^\d+[.)]\s+/, ''));
        i += 1;
      }
      blocks.push({ type: 'ol', items });
      continue;
    }

    const buf = [line];
    i += 1;
    while (
      i < lines.length &&
      lines[i].trim() &&
      !lines[i].trim().startsWith('```') &&
      !/^(#{1,3})\s+/.test(lines[i].trim()) &&
      !/^[-*]\s+/.test(lines[i].trim()) &&
      !/^\d+[.)]\s+/.test(lines[i].trim()) &&
      !/^>\s?/.test(lines[i].trim()) &&
      !(isRow(lines[i]) && i + 1 < lines.length && isSep(lines[i + 1]))
    ) {
      buf.push(lines[i]);
      i += 1;
    }
    flushPara(buf);
  }

  return blocks;
}

export default function Markdown({ text }) {
  let blocks;
  try {
    blocks = parse(text);
  } catch {
    const fallback = String(text || '').trim();
    if (!fallback) return null;
    return (
      <div className="md">
        <p className="md-p">{fallback}</p>
      </div>
    );
  }
  if (!blocks.length) {
    const fallback = String(text || '').trim();
    if (!fallback) return null;
    return (
      <div className="md">
        <p className="md-p">{fallback}</p>
      </div>
    );
  }
  return (
    <div className="md">
      {blocks.map((b, i) => {
        if (b.type === 'h') {
          const Tag = b.level === 1 ? 'h2' : b.level === 2 ? 'h3' : 'h4';
          return (
            <Tag key={i} className={`md-h md-h${b.level}`}>
              <Inline text={b.text} />
            </Tag>
          );
        }
        if (b.type === 'hr') return <hr key={i} className="md-hr" />;
        if (b.type === 'code') {
          return (
            <pre key={i} className="md-pre">
              <code>{b.text}</code>
            </pre>
          );
        }
        if (b.type === 'quote') {
          return (
            <blockquote key={i} className="md-quote">
              <Inline text={b.text} />
            </blockquote>
          );
        }
        if (b.type === 'ul') {
          return (
            <ul key={i} className="md-ul">
              {b.items.map((item, j) => (
                <li key={j}>
                  <Inline text={item} />
                </li>
              ))}
            </ul>
          );
        }
        if (b.type === 'ol') {
          return (
            <ol key={i} className="md-ol">
              {b.items.map((item, j) => (
                <li key={j}>
                  <Inline text={item} />
                </li>
              ))}
            </ol>
          );
        }
        if (b.type === 'table') {
          const cols = b.headers.length;
          return (
            <div key={i} className="md-table-wrap">
              <table className="md-table">
                <thead>
                  <tr>
                    {b.headers.map((h, j) => (
                      <th key={j}>
                        <Inline text={h} />
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {b.rows.map((row, r) => (
                    <tr key={r}>
                      {Array.from({ length: cols }, (_, c) => (
                        <td key={c}>
                          <Inline text={row[c] || ''} />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        }
        const bits = String(b.text || '').split('\n');
        return (
          <p key={i} className="md-p">
            {bits.map((line, j) => (
              <Fragment key={j}>
                {j ? <br /> : null}
                <Inline text={line} />
              </Fragment>
            ))}
          </p>
        );
      })}
    </div>
  );
}
