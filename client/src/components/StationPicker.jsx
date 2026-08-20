import { useMemo } from 'react';
import { sortChargePoints, stationLabel } from '../org.js';

export default function StationPicker({ stations, value, onChange }) {
  const groups = useMemo(() => {
    const map = new Map();
    for (const s of sortChargePoints(stations)) {
      const key = stationLabel(s) || 'Unassigned';
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(s);
    }
    return [...map.entries()];
  }, [stations]);

  return (
    <label className="field">
      Charge point
      <select value={value || ''} onChange={(e) => onChange(e.target.value)}>
        <option value="">Select charge point…</option>
        {groups.map(([label, cps]) => (
          <optgroup key={label} label={label}>
            {cps.map((s) => (
              <option key={s.stationId} value={s.stationId}>
                {s.stationId}{' '}
                {s.simulated ? '(sim)' : s.online && s.transport !== 'sim' ? '(live)' : '(offline)'}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
    </label>
  );
}
