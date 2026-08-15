export default function StatusBadge({ value, online }) {
  if (typeof online === 'boolean') {
    return <span className={`badge ${online ? 'online' : 'offline'}`}>{online ? 'Online' : 'Offline'}</span>;
  }
  const cls = String(value || '').replace(/\s/g, '');
  return <span className={`badge ${cls}`}>{value || '—'}</span>;
}
