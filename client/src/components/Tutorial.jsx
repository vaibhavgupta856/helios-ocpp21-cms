import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { TUTORIAL_STEPS } from '../tutorial.js';
import { NAV, HIDDEN_VIEWS } from '../nav.js';

const GAP = 18;
const PAD = 14;
const CARD_W = 392;
const CARET = 12;
const CARET_INSET = 22;

function canSeeView(can, view, require) {
  if (typeof can === 'function' && require && !can(require)) return false;
  if (!view) return true;
  if (typeof can !== 'function') return true;
  if (NAV.some((n) => n.id === view)) return can(`nav.${view}`);
  if (HIDDEN_VIEWS.includes(view)) return can('ocpp.call');
  return true;
}

function stepsFor(can) {
  const next = TUTORIAL_STEPS.filter((s) => canSeeView(can, s.view, s.require));
  return next.length ? next : TUTORIAL_STEPS;
}

function overlap(a, b, pad = 10) {
  return !(a.right + pad <= b.left || a.left - pad >= b.right || a.bottom + pad <= b.top || a.top - pad >= b.bottom);
}

function findTarget(id) {
  const nodes = [...document.querySelectorAll(`[data-tour="${id}"]`)];
  return (
    nodes.find((el) => {
      if (el.closest('.is-hidden')) return false;
      const style = getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) return false;
      const r = el.getBoundingClientRect();
      return r.width >= 8 && r.height >= 8;
    }) || null
  );
}

function along(min, value, max) {
  return Math.round(Math.min(Math.max(min, value), max));
}

function withCaret(placed, target, cardW, cardH) {
  const tx = target.left + target.width / 2;
  const ty = target.top + target.height / 2;
  const half = CARET / 2;
  const min = CARET_INSET;
  const maxX = Math.max(min, cardW - CARET_INSET);
  const maxY = Math.max(min, cardH - CARET_INSET);
  let caretLeft = 0;
  let caretTop = 0;
  if (placed.side === 'bottom') {
    caretTop = -half;
    caretLeft = along(min, tx - placed.left, maxX) - half;
  } else if (placed.side === 'top') {
    caretTop = cardH - half;
    caretLeft = along(min, tx - placed.left, maxX) - half;
  } else if (placed.side === 'right') {
    caretLeft = -half;
    caretTop = along(min, ty - placed.top, maxY) - half;
  } else {
    caretLeft = cardW - half;
    caretTop = along(min, ty - placed.top, maxY) - half;
  }
  return { ...placed, caretLeft, caretTop };
}

function placeCard(target, cardW, cardH) {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const t = {
    left: target.left,
    top: target.top,
    right: target.right,
    bottom: target.bottom,
    width: target.width,
    height: target.height,
  };

  const clamp = (x, y, side) => {
    const left = Math.min(Math.max(PAD, x), Math.max(PAD, vw - cardW - PAD));
    const top = Math.min(Math.max(PAD, y), Math.max(PAD, vh - cardH - PAD));
    const box = { left, top, right: left + cardW, bottom: top + cardH };
    if (overlap(box, t, 8)) return null;
    const cx = t.left + t.width / 2;
    const cy = t.top + t.height / 2;
    const dist = Math.hypot(left + cardW / 2 - cx, top + cardH / 2 - cy);
    const area = Math.min(cardW, vw - left) * Math.min(cardH, vh - top);
    return withCaret({ left, top, side, score: area - dist * 0.15 }, t, cardW, cardH);
  };

  const candidates = [];
  const rightSpace = vw - t.right - GAP - PAD;
  const leftSpace = t.left - GAP - PAD;
  const bottomSpace = vh - t.bottom - GAP - PAD;
  const topSpace = t.top - GAP - PAD;

  if (rightSpace >= 260) candidates.push(clamp(t.right + GAP, t.top + t.height / 2 - cardH / 2, 'right'));
  if (leftSpace >= 260) candidates.push(clamp(t.left - GAP - cardW, t.top + t.height / 2 - cardH / 2, 'left'));
  if (bottomSpace >= 140) candidates.push(clamp(t.left + t.width / 2 - cardW / 2, t.bottom + GAP, 'bottom'));
  if (topSpace >= 140) candidates.push(clamp(t.left + t.width / 2 - cardW / 2, t.top - GAP - cardH, 'top'));

  const fit = candidates.filter(Boolean).sort((a, b) => b.score - a.score)[0];
  if (fit) return fit;

  const corners = [
    { left: PAD, top: PAD, side: 'top' },
    { left: vw - cardW - PAD, top: PAD, side: 'top' },
    { left: PAD, top: vh - cardH - PAD, side: 'bottom' },
    { left: vw - cardW - PAD, top: vh - cardH - PAD, side: 'bottom' },
  ];
  for (const c of corners) {
    const box = { left: c.left, top: c.top, right: c.left + cardW, bottom: c.top + cardH };
    if (!overlap(box, t, 6)) return withCaret(c, t, cardW, cardH);
  }
  if (rightSpace >= leftSpace && rightSpace >= 120) {
    return withCaret(
      { left: Math.max(PAD, vw - cardW - PAD), top: Math.min(t.top, vh - cardH - PAD), side: 'right' },
      t,
      cardW,
      cardH
    );
  }
  return withCaret({ left: PAD, top: Math.min(t.top, vh - cardH - PAD), side: 'left' }, t, cardW, cardH);
}

function wait(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

export default function Tutorial({ open, onClose, navigate, onOpenNav, can }) {
  const steps = stepsFor(can);
  const [index, setIndex] = useState(0);
  const [spot, setSpot] = useState(null);
  const [cardPos, setCardPos] = useState({ left: 24, top: 88, side: 'right' });
  const [ready, setReady] = useState(false);
  const cardRef = useRef(null);
  const step = steps[index] || steps[0];

  const measure = useCallback(() => {
    if (!open || !step) return false;
    const el = findTarget(step.target);
    const cardW = Math.min(CARD_W, window.innerWidth - PAD * 2);
    const cardH = Math.min(cardRef.current?.offsetHeight || 280, window.innerHeight * 0.7);
    if (!el) {
      setSpot((prev) => (prev ? null : prev));
      setCardPos((prev) => {
        const next = {
          left: Math.max(PAD, (window.innerWidth - cardW) / 2),
          top: Math.max(88, (window.innerHeight - cardH) / 3),
          side: 'bottom',
          caretLeft: cardW / 2 - CARET / 2,
          caretTop: -CARET / 2,
        };
        if (
          prev.left === next.left &&
          prev.top === next.top &&
          prev.side === next.side &&
          prev.caretLeft === next.caretLeft &&
          prev.caretTop === next.caretTop
        ) {
          return prev;
        }
        return next;
      });
      return false;
    }
    const r = el.getBoundingClientRect();
    const pad = 8;
    const nextSpot = {
      left: Math.max(4, r.left - pad),
      top: Math.max(4, r.top - pad),
      width: Math.min(window.innerWidth - 8, r.width + pad * 2),
      height: Math.min(window.innerHeight - 8, r.height + pad * 2),
      radius: Math.min(16, Math.max(10, parseFloat(getComputedStyle(el).borderRadius) || 12)),
    };
    setSpot((prev) =>
      prev &&
      prev.left === nextSpot.left &&
      prev.top === nextSpot.top &&
      prev.width === nextSpot.width &&
      prev.height === nextSpot.height
        ? prev
        : nextSpot
    );
    const placed = placeCard(r, cardW, cardH);
    setCardPos((prev) =>
      prev.left === placed.left &&
      prev.top === placed.top &&
      prev.side === placed.side &&
      prev.caretLeft === placed.caretLeft &&
      prev.caretTop === placed.caretTop
        ? prev
        : placed
    );
    return true;
  }, [open, step]);

  useEffect(() => {
    if (!open) {
      setIndex(0);
      setSpot(null);
      setReady(false);
      return undefined;
    }
    setIndex(0);
    return undefined;
  }, [open]);

  useEffect(() => {
    if (!open || !step) return undefined;
    let cancelled = false;
    setReady(false);
    window.dispatchEvent(
      new CustomEvent('massive-tutorial', {
        detail: { llmOpen: false, step: step.id },
      })
    );
    (async () => {
      if (step.view) navigate(step.view);
      await wait(step.openNav ? 220 : 400);
      if (cancelled) return;
      if (step.openNav) onOpenNav?.(true);
      else if (window.innerWidth > 1100) onOpenNav?.(false);
      const el = findTarget(step.target);
      el?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
      await wait(el ? 300 : 50);
      if (cancelled) return;
      for (const delay of [0, 180, 400, 700]) {
        if (delay) await wait(delay);
        if (cancelled) return;
        if (measure()) break;
      }
      if (!cancelled) {
        measure();
        setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, index, step, navigate, onOpenNav, measure]);

  useLayoutEffect(() => {
    if (!open) return undefined;
    let raf = 0;
    const onWin = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        measure();
      });
    };
    window.addEventListener('resize', onWin);
    window.addEventListener('scroll', onWin, true);
    const root = document.querySelector('main.cms-main') || document.body;
    const mo = new MutationObserver(onWin);
    mo.observe(root, { childList: true, subtree: true });
    const t = requestAnimationFrame(measure);
    return () => {
      cancelAnimationFrame(t);
      if (raf) cancelAnimationFrame(raf);
      mo.disconnect();
      window.removeEventListener('resize', onWin);
      window.removeEventListener('scroll', onWin, true);
    };
  }, [open, measure, index]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        setIndex((n) => Math.min(steps.length - 1, n + 1));
      }
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setIndex((n) => Math.max(0, n - 1));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose, steps.length]);

  useEffect(() => {
    if (open) return undefined;
    window.dispatchEvent(new CustomEvent('massive-tutorial', { detail: { llmOpen: false, step: null } }));
    return undefined;
  }, [open]);

  if (!open || !step) return null;

  const last = index >= steps.length - 1;
  const cardW = Math.min(CARD_W, window.innerWidth - PAD * 2);

  return (
    <div className={`tour${ready ? ' is-ready' : ''}`} role="dialog" aria-modal="true" aria-labelledby="tour-title">
      <div className="tour-dim" />
      {spot ? (
        <div
          className="tour-spot"
          style={{
            left: spot.left,
            top: spot.top,
            width: spot.width,
            height: spot.height,
            borderRadius: spot.radius,
          }}
        />
      ) : null}
      <aside
        ref={cardRef}
        className={`tour-card side-${cardPos.side}`}
        style={{ left: cardPos.left, top: cardPos.top, width: cardW }}
      >
        <span
          className="tour-caret"
          aria-hidden
          style={{ left: cardPos.caretLeft ?? CARET_INSET, top: cardPos.caretTop ?? -CARET / 2 }}
        />
        <div className="tour-progress" aria-hidden>
          <span style={{ width: `${((index + 1) / steps.length) * 100}%` }} />
        </div>
        <p className="tour-kicker">
          Tutorial · {index + 1} of {steps.length}
        </p>
        <h2 id="tour-title">{step.title}</h2>
        <div className="tour-body">
          {(step.body || []).map((p) => (
            <p key={p}>{p}</p>
          ))}
        </div>
        <div className="tour-nav">
          <button type="button" className="btn" onClick={onClose}>
            Skip
          </button>
          <div className="tour-nav-end">
            <button type="button" className="btn" disabled={index === 0} onClick={() => setIndex((n) => Math.max(0, n - 1))}>
              Back
            </button>
            <button
              type="button"
              className="btn primary"
              onClick={() => {
                if (last) onClose();
                else setIndex((n) => n + 1);
              }}
            >
              {last ? 'Finish' : 'Next'}
            </button>
          </div>
        </div>
      </aside>
    </div>
  );
}
