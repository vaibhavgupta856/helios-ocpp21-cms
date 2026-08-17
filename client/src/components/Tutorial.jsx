import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { TUTORIAL_STEPS, tourCardLines } from '../tutorial.js';
import { NAV, HIDDEN_VIEWS } from '../nav.js';
import { startThemeTourCycle } from '../theme.js';
import { useTourVoice } from '../hooks/useTourVoice.js';

const GAP = 18;
const PAD = 14;
const CARD_W = 392;
const CARET = 12;
const CARET_INSET = 22;
const SHEET_MQ = 720;
const SIDE_NEED = 260;
const VIEW_GUTTER = 24;

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

function cardWidth() {
  return Math.min(CARD_W, Math.max(220, window.innerWidth - VIEW_GUTTER));
}

function shouldDockSheet(target) {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  if (vw <= SHEET_MQ) return true;
  if (!target) return false;
  const rightSpace = vw - target.right - GAP - PAD;
  const leftSpace = target.left - GAP - PAD;
  const bottomSpace = vh - target.bottom - GAP - PAD;
  const topSpace = target.top - GAP - PAD;
  const sideOk = rightSpace >= SIDE_NEED || leftSpace >= SIDE_NEED;
  const vertOk = bottomSpace >= 140 || topSpace >= 140;
  return !sideOk && !vertOk;
}

function clampSpot(r, sheet, radius) {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const pad = 8;
  let left = r.left - pad;
  let top = r.top - pad;
  let width = r.width + pad * 2;
  let height = r.height + pad * 2;
  const sheetH = sheet ? Math.round(vh * 0.46) : 0;
  const maxW = Math.min(vw - 16, sheet ? Math.max(120, vw * 0.84) : vw - 16);
  const maxH = Math.min(vh - 16, sheet ? Math.max(64, vh - sheetH - 28) : vh - 16);
  if (width > maxW) {
    left += (width - maxW) / 2;
    width = maxW;
  }
  if (height > maxH) height = maxH;
  left = Math.min(Math.max(8, left), Math.max(8, vw - width - 8));
  top = Math.min(Math.max(8, top), Math.max(8, vh - height - 8 - (sheet ? 12 : 0)));
  if (sheet && top + height > vh - sheetH - 10) {
    top = Math.max(8, vh - sheetH - height - 12);
  }
  return { left, top, width, height, radius };
}

function setSheetVar(px) {
  document.documentElement.style.setProperty('--tour-sheet-h', `${Math.max(0, Math.round(px))}px`);
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
  const [started, setStarted] = useState(false);
  const [index, setIndex] = useState(0);
  const [spot, setSpot] = useState(null);
  const [cardPos, setCardPos] = useState({ left: 24, top: 88, side: 'right' });
  const [readyId, setReadyId] = useState(null);
  const [muted, setMuted] = useState(false);
  const cardRef = useRef(null);
  const enteredIdRef = useRef(null);
  const indexRef = useRef(0);
  const stepsRef = useRef(steps);
  const navigateRef = useRef(navigate);
  const onOpenNavRef = useRef(onOpenNav);
  const onCloseRef = useRef(onClose);
  stepsRef.current = steps;
  navigateRef.current = navigate;
  onOpenNavRef.current = onOpenNav;
  onCloseRef.current = onClose;
  indexRef.current = index;

  const step = started ? steps[index] || steps[0] : null;
  const stepId = step?.id || null;
  const last = started && index >= steps.length - 1;
  const ready = Boolean(started && stepId && readyId === stepId);

  const goNext = useCallback(() => {
    const list = stepsRef.current;
    const n = indexRef.current;
    if (n >= list.length - 1) {
      onCloseRef.current();
      return;
    }
    setIndex(n + 1);
  }, []);

  const goBack = useCallback(() => {
    setIndex(Math.max(0, indexRef.current - 1));
  }, []);

  const skip = useCallback(() => {
    onCloseRef.current();
  }, []);

  const goNextRef = useRef(goNext);
  goNextRef.current = goNext;

  const { audioRef, unlock, stop } = useTourVoice({
    enabled: Boolean(open && started),
    stepId,
    ready,
    muted,
    onAutoNext: () => goNextRef.current(),
  });

  const measure = useCallback(() => {
    if (!open || !started || !step) return false;
    const el = findTarget(step.target);
    const cardW = cardWidth();
    const sheet = shouldDockSheet(el ? el.getBoundingClientRect() : null);
    const cardH = Math.min(cardRef.current?.offsetHeight || 280, window.innerHeight * (sheet ? 0.5 : 0.7));
    if (sheet) setSheetVar(cardRef.current?.offsetHeight || Math.min(280, window.innerHeight * 0.5));
    else setSheetVar(0);
    if (!el) {
      setSpot((prev) => (prev ? null : prev));
      setCardPos((prev) => {
        const next = sheet
          ? { left: 12, top: 0, side: 'sheet', sheet: true, caretLeft: 0, caretTop: 0 }
          : {
              left: Math.max(PAD, (window.innerWidth - cardW) / 2),
              top: Math.max(88, (window.innerHeight - cardH) / 3),
              side: 'bottom',
              sheet: false,
              caretLeft: cardW / 2 - CARET / 2,
              caretTop: -CARET / 2,
            };
        if (
          prev.left === next.left &&
          prev.top === next.top &&
          prev.side === next.side &&
          prev.sheet === next.sheet &&
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
    const radius = Math.min(16, Math.max(10, parseFloat(getComputedStyle(el).borderRadius) || 12));
    const nextSpot = clampSpot(r, sheet, radius);
    setSpot((prev) =>
      prev &&
      prev.left === nextSpot.left &&
      prev.top === nextSpot.top &&
      prev.width === nextSpot.width &&
      prev.height === nextSpot.height
        ? prev
        : nextSpot
    );
    const placed = sheet
      ? { left: 12, top: 0, side: 'sheet', sheet: true, caretLeft: 0, caretTop: 0 }
      : { ...placeCard(r, cardW, cardH), sheet: false };
    setCardPos((prev) =>
      prev.left === placed.left &&
      prev.top === placed.top &&
      prev.side === placed.side &&
      prev.sheet === placed.sheet &&
      prev.caretLeft === placed.caretLeft &&
      prev.caretTop === placed.caretTop
        ? prev
        : placed
    );
    return true;
  }, [open, started, stepId, step]);

  const measureRef = useRef(measure);
  measureRef.current = measure;

  useEffect(() => {
    if (!open) {
      setStarted(false);
      setIndex(0);
      setSpot(null);
      setReadyId(null);
      setMuted(false);
      enteredIdRef.current = null;
      setSheetVar(0);
      window.dispatchEvent(new CustomEvent('massive-tutorial', { detail: { llmOpen: false, step: null } }));
      return undefined;
    }
    setStarted(false);
    setIndex(0);
    setReadyId(null);
    enteredIdRef.current = null;
    return undefined;
  }, [open]);

  useLayoutEffect(() => {
    if (!open || !started || !stepId) {
      setReadyId(null);
      return;
    }
    if (enteredIdRef.current !== stepId) setReadyId(null);
  }, [open, started, stepId]);

  useEffect(() => {
    if (!open || !started || !stepId) return undefined;
    const current = stepsRef.current.find((s) => s.id === stepId);
    if (!current) return undefined;
    enteredIdRef.current = stepId;
    setReadyId(null);
    window.dispatchEvent(
      new CustomEvent('massive-tutorial', {
        detail: { llmOpen: false, step: current.id },
      })
    );
    let cancelled = false;
    (async () => {
      if (current.view) navigateRef.current(current.view);
      await wait(current.openNav ? 220 : 400);
      if (cancelled) return;
      onOpenNavRef.current?.(!!current.openNav);
      const el = findTarget(current.target);
      const sheet = shouldDockSheet(el ? el.getBoundingClientRect() : null);
      el?.scrollIntoView({ block: sheet ? 'center' : 'nearest', inline: 'nearest', behavior: 'smooth' });
      await wait(el ? 300 : 50);
      if (cancelled) return;
      for (const delay of [0, 180, 400, 700]) {
        if (delay) await wait(delay);
        if (cancelled) return;
        if (measureRef.current()) break;
      }
      if (!cancelled) {
        measureRef.current();
        setReadyId(stepId);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, started, stepId]);

  useLayoutEffect(() => {
    if (!open || !started) return undefined;
    let raf = 0;
    const onWin = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        measureRef.current();
      });
    };
    window.addEventListener('resize', onWin);
    window.addEventListener('scroll', onWin, true);
    window.visualViewport?.addEventListener('resize', onWin);
    window.visualViewport?.addEventListener('scroll', onWin);
    const root = document.querySelector('main.cms-main') || document.body;
    const mo = new MutationObserver(onWin);
    mo.observe(root, { childList: true, subtree: true });
    const t = requestAnimationFrame(() => measureRef.current());
    return () => {
      cancelAnimationFrame(t);
      if (raf) cancelAnimationFrame(raf);
      mo.disconnect();
      window.removeEventListener('resize', onWin);
      window.removeEventListener('scroll', onWin, true);
      window.visualViewport?.removeEventListener('resize', onWin);
      window.visualViewport?.removeEventListener('scroll', onWin);
    };
  }, [open, started, stepId]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        stop();
        skip();
      }
      if (!started) return;
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        stop();
        goNext();
      }
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        stop();
        goBack();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, started, skip, goNext, goBack, stop]);

  useEffect(() => {
    if (!open || !started || !step?.cycleThemes) return undefined;
    return startThemeTourCycle();
  }, [open, started, stepId, step?.cycleThemes]);

  const startTour = async () => {
    await unlock();
    setStarted(true);
  };

  if (!open) return null;

  const sheet = Boolean(started && cardPos.sheet);
  const cardW = cardWidth();
  const cardVisible = !started || ready;

  return (
    <div
      className={`tour${cardVisible ? ' is-ready' : ''}${sheet ? ' is-sheet' : ''}${started ? '' : ' is-start'}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="tour-title"
    >
      <audio ref={audioRef} preload="auto" playsInline />
      <div className="tour-dim" />
      {started && spot ? (
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
        className={`tour-card side-${started ? cardPos.side : 'bottom'}${sheet ? ' is-sheet' : ''}${started ? '' : ' is-start'}`}
        style={started ? (sheet ? undefined : { left: cardPos.left, top: cardPos.top, width: cardW }) : undefined}
      >
        {started && !sheet ? (
          <span
            className="tour-caret"
            aria-hidden
            style={{ left: cardPos.caretLeft ?? CARET_INSET, top: cardPos.caretTop ?? -CARET / 2 }}
          />
        ) : null}
        {started ? (
          <div className="tour-progress" aria-hidden>
            <span style={{ width: `${((index + 1) / steps.length) * 100}%` }} />
          </div>
        ) : null}
        <p className="tour-kicker">{started ? `Tutorial · ${index + 1} of ${steps.length}` : 'Helios tour'}</p>
        <h2 id="tour-title">{started ? step.title : "Hey — let's look around"}</h2>
        <div className="tour-body">
          {started ? (
            tourCardLines(step).map((p) => (
              <p key={p}>{p}</p>
            ))
          ) : (
            <p>I'll walk you through the operator console. Hit Start tour — that also turns the sound on.</p>
          )}
        </div>
        <div className="tour-nav">
          {started ? (
            <>
              <div className="tour-nav-start">
                <button
                  type="button"
                  className="btn"
                  onClick={() => {
                    stop();
                    skip();
                  }}
                >
                  Skip
                </button>
                <button
                  type="button"
                  className={`btn${muted ? ' is-muted' : ''}`}
                  aria-pressed={muted}
                  onClick={() => setMuted((m) => !m)}
                >
                  {muted ? 'Unmute' : 'Mute'}
                </button>
              </div>
              <div className="tour-nav-end">
                <button
                  type="button"
                  className="btn"
                  disabled={index === 0}
                  onClick={() => {
                    stop();
                    goBack();
                  }}
                >
                  Back
                </button>
                <button
                  type="button"
                  className="btn primary"
                  onClick={() => {
                    stop();
                    goNext();
                  }}
                >
                  {last ? 'Finish' : 'Next'}
                </button>
              </div>
            </>
          ) : (
            <>
              <button type="button" className="btn" onClick={skip}>
                Skip
              </button>
              <button type="button" className="btn primary" onClick={startTour}>
                Start tour
              </button>
            </>
          )}
        </div>
      </aside>
    </div>
  );
}
