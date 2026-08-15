export default function JsonEditor({ value, onChange, rows = 12 }) {
  const format = () => {
    try {
      onChange(JSON.stringify(JSON.parse(value || '{}'), null, 2));
    } catch {
      /* keep invalid JSON so the operator can fix it */
    }
  };
  return (
    <div className="json-editor">
      <div className="bar">
        <button type="button" className="btn" onClick={format}>
          Format JSON
        </button>
      </div>
      <textarea
        className="mono"
        rows={rows}
        spellCheck={false}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
