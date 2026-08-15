import { useState } from 'react';
import PageHeader from '../components/PageHeader.jsx';
import StationPicker from '../components/StationPicker.jsx';
import { pretty } from '../api.js';

const PROFILE = {
  evseId: 1,
  chargingProfile: {
    id: 1,
    stackLevel: 0,
    chargingProfilePurpose: 'TxDefaultProfile',
    chargingProfileKind: 'Absolute',
    chargingSchedule: [
      {
        id: 1,
        chargingRateUnit: 'W',
        chargingSchedulePeriod: [{ startPeriod: 0, limit: 11000 }],
      },
    ],
  },
};

export default function SmartCharging({ stations, selected, selectedStationId, setSelectedStationId, callStation, can = () => false }) {
  const [limit, setLimit] = useState('11000');

  const profile = {
    ...PROFILE,
    chargingProfile: {
      ...PROFILE.chargingProfile,
      chargingSchedule: [
        {
          id: 1,
          chargingRateUnit: 'W',
          chargingSchedulePeriod: [{ startPeriod: 0, limit: Number(limit) || 11000 }],
        },
      ],
    },
  };

  return (
    <>
      <PageHeader
        title="Smart Charging"
        subtitle="Set, get, and clear charging profiles, composite and dynamic schedules, priority charging"
        tour="smart-page"
      />
      {can('ocpp.call') ? (
      <div className="card">
        <div className="form-row">
          <StationPicker stations={stations} value={selectedStationId} onChange={setSelectedStationId} />
          <label className="field">
            Limit (W)
            <input value={limit} onChange={(e) => setLimit(e.target.value)} />
          </label>
        </div>
        <div className="ops">
          <button type="button" className="btn primary" onClick={() => callStation('SetChargingProfile', profile)}>
            SetChargingProfile
          </button>
          <button
            type="button"
            className="btn"
            onClick={() =>
              callStation('GetChargingProfiles', {
                requestId: 1,
                evseId: 1,
                chargingProfile: { chargingProfilePurpose: 'TxDefaultProfile' },
              })
            }
          >
            GetChargingProfiles
          </button>
          <button type="button" className="btn" onClick={() => callStation('ClearChargingProfile', { chargingProfileId: 1 })}>
            ClearChargingProfile
          </button>
          <button
            type="button"
            className="btn"
            onClick={() => callStation('GetCompositeSchedule', { duration: 3600, chargingRateUnit: 'W', evseId: 1 })}
          >
            GetCompositeSchedule
          </button>
          <button
            type="button"
            className="btn"
            onClick={() =>
              callStation('UpdateDynamicSchedule', {
                chargingProfileId: 1,
                scheduleUpdate: { limit: Number(limit) || 7000 },
              })
            }
          >
            UpdateDynamicSchedule
          </button>
          <button type="button" className="btn" onClick={() => callStation('UsePriorityCharging', { activate: true })}>
            UsePriorityCharging
          </button>
        </div>
      </div>
      ) : null}
      <div className="card" data-tour="smart-profiles">
        <h3>Profiles stored on CSMS</h3>
        {(selected?.chargingProfiles || []).length === 0 ? (
          <p className="empty">No SetChargingProfile payloads stored yet.</p>
        ) : (
          selected.chargingProfiles.map((row, i) => (
            <div key={i}>
              <strong>EVSE {row.evseId} · id {row.chargingProfile?.id}</strong>
              <pre className="payload mono">{pretty(row.chargingProfile)}</pre>
            </div>
          ))
        )}
      </div>
      <div className="card">
        <h3>Limits reported by station</h3>
        {(selected?.chargingLimits || []).length === 0 ? (
          <p className="empty">No NotifyChargingLimit / EV schedule messages yet.</p>
        ) : (
          selected.chargingLimits.map((row, i) => (
            <div key={i}>
              <strong>{row.action}</strong>
              <pre className="payload mono">{pretty(row.payload)}</pre>
            </div>
          ))
        )}
      </div>
    </>
  );
}
