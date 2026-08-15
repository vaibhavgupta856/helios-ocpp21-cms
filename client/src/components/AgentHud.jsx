export default function AgentHud({ hud, onBack, onDismiss }) {
  if (!hud) return null;
  const status = hud.status === 'error' ? 'error' : hud.status === 'done' ? 'done' : 'working';
  return (
    <div className={`agent-hud ${status}`} role="status" aria-live="polite">
      <div className="agent-hud-mark" aria-hidden>
        {status === 'working' ? '●' : status === 'error' ? '!' : '✓'}
      </div>
      <div className="agent-hud-body">
        <div className="agent-hud-kicker">
          Helios
          {hud.view ? ` · ${hud.view.replace(/-/g, ' ')}` : ''}
          {hud.stepCount ? ` · ${Math.min((hud.stepIndex || 0) + 1, hud.stepCount)}/${hud.stepCount}` : ''}
        </div>
        <div className="agent-hud-caption">{hud.caption}</div>
        {status === 'done' && hud.answer ? <div className="agent-hud-answer">{hud.answer}</div> : null}
      </div>
      <div className="agent-hud-ops">
        <button type="button" className="btn primary" onClick={onBack}>
          Back to chat
        </button>
        <button type="button" className="btn" onClick={onDismiss}>
          Stay here
        </button>
      </div>
    </div>
  );
}
