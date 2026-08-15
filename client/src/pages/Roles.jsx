import { useMemo, useState } from 'react';
import PageHeader from '../components/PageHeader.jsx';
import { api } from '../api.js';
import { can } from '../auth.js';

function RoleBadge({ role, label }) {
  return <span className={`badge role-${role}`}>{label || role}</span>;
}

function ChipGroup({ label, items, selected, onToggle, disabled, nameOf }) {
  if (!items.length) return <p className="muted">No {label.toLowerCase()} yet.</p>;
  return (
    <div className="chip-group">
      <span className="chip-group-label">{label}</span>
      <div className="chip-picks">
        {items.map((item) => (
          <label key={item.id} className={`chip-pick ${selected.includes(item.id) ? 'on' : ''}`}>
            <input
              type="checkbox"
              checked={selected.includes(item.id)}
              disabled={disabled}
              onChange={() => onToggle(item.id)}
            />
            {nameOf(item)}
          </label>
        ))}
      </div>
    </div>
  );
}

export default function Roles({
  me,
  users = [],
  roles = [],
  permissions = [],
  matrix = {},
  tenants = [],
  sites = [],
  onUsersChange,
}) {
  const catalogRoles = roles.length ? roles : [];
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('member');
  const [tenantIds, setTenantIds] = useState([]);
  const [siteIds, setSiteIds] = useState([]);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const canWrite = can(me, 'users.write');
  const canSuper = can(me, 'users.super');

  const assignableRoles = useMemo(() => {
    const mine = catalogRoles.find((r) => r.id === me?.role)?.rank || 0;
    return catalogRoles.filter((r) => {
      if (r.id === 'super_admin' && !canSuper) return false;
      return (r.rank || 0) <= mine;
    });
  }, [catalogRoles, me, canSuper]);

  const groups = useMemo(() => {
    const map = new Map();
    for (const p of permissions) {
      if (!map.has(p.group)) map.set(p.group, []);
      map.get(p.group).push(p);
    }
    return [...map.entries()];
  }, [permissions]);

  const toggle = (list, setList, id) => {
    setList(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
  };

  const refreshUsers = async (next) => {
    onUsersChange?.(next);
  };

  const add = async (e) => {
    e.preventDefault();
    setBusy('add');
    setError('');
    setNotice('');
    try {
      const data = await api('/api/users', {
        method: 'POST',
        body: JSON.stringify({ name, email, role, tenantIds, siteIds }),
      });
      await refreshUsers(data.users);
      setName('');
      setEmail('');
      setRole('member');
      setTenantIds([]);
      setSiteIds([]);
      setNotice(`Added ${data.user.name} as ${data.user.roleLabel}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy('');
    }
  };

  const patch = async (id, body) => {
    setBusy(id);
    setError('');
    try {
      const data = await api(`/api/users/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      });
      await refreshUsers(data.users);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy('');
    }
  };

  const remove = async (user) => {
    if (!window.confirm(`Remove ${user.name}?`)) return;
    setBusy(user.id);
    setError('');
    try {
      const data = await api(`/api/users/${encodeURIComponent(user.id)}`, { method: 'DELETE' });
      await refreshUsers(data.users);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy('');
    }
  };

  const tenantName = (id) => tenants.find((t) => t.id === id)?.name || id;
  const siteName = (id) => {
    const s = sites.find((x) => x.id === id);
    return s ? `${s.name}${s.city ? ` · ${s.city}` : ''}` : id;
  };

  const flipList = (list, id) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);

  return (
    <div className="roles-page">
      <PageHeader
        title="Roles & users"
        subtitle="Directory of lab users and what each role may do. Switching identity is Act as in the header — this page does not change your session."
      />
      {error ? <p className="error">{error}</p> : null}
      {notice ? <p className="ok-msg">{notice}</p> : null}

      <div className="card advisor-card role-actor">
        <p className="advisor-headline">
          Acting as {me?.name || '—'} <RoleBadge role={me?.role} label={me?.roleLabel} />
        </p>
        <p className="muted">
          Use <strong>Act as</strong> in the header to try another identity. The cards and matrix below are the
          permission catalog — they do not switch who you are acting as. Chats still record who created them and who
          asked each question.
        </p>
      </div>

      <div className="role-cards" data-tour="roles-page">
        {catalogRoles.map((r) => (
          <div className={`card role-card ${me?.role === r.id ? 'mine' : ''}`} key={r.id}>
            <h3>
              {r.label}
              {me?.role === r.id ? <span className="badge Accepted">You</span> : null}
            </h3>
            <p className="muted">{r.blurb}</p>
          </div>
        ))}
      </div>

      <div className="card" data-tour="roles-users">
        <h3>Users</h3>
        <div className="table-wrap">
          <table className="data roles-users">
            <thead>
              <tr>
                <th>Name</th>
                <th>Role</th>
                <th>Assignment</th>
                {canWrite ? <th>Actions</th> : null}
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className={u.id === me?.id ? 'selected' : ''}>
                  <td>
                    <strong>{u.name}</strong>
                    <div className="muted">{u.email}</div>
                  </td>
                  <td>
                    {canWrite ? (
                      <select
                        className="role-select"
                        value={u.role}
                        disabled={!!busy || (u.role === 'super_admin' && !canSuper)}
                        onChange={(e) => patch(u.id, { role: e.target.value })}
                      >
                        {(assignableRoles.some((r) => r.id === u.role)
                          ? assignableRoles
                          : [...assignableRoles, { id: u.role, label: u.roleLabel }]
                        ).map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.label}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <RoleBadge role={u.role} label={u.roleLabel} />
                    )}
                  </td>
                  <td>
                    {u.role === 'super_admin' || u.role === 'admin' ? (
                      <span className="muted">All tenants &amp; stations</span>
                    ) : canWrite ? (
                      <div className="assign-cell">
                        <ChipGroup
                          label="Tenants"
                          items={tenants}
                          selected={u.tenantIds || []}
                          disabled={!!busy}
                          nameOf={(t) => t.name}
                          onToggle={(id) => patch(u.id, { tenantIds: flipList(u.tenantIds || [], id) })}
                        />
                        <ChipGroup
                          label="Stations"
                          items={sites}
                          selected={u.siteIds || []}
                          disabled={!!busy}
                          nameOf={(s) => s.name}
                          onToggle={(id) => patch(u.id, { siteIds: flipList(u.siteIds || [], id) })}
                        />
                      </div>
                    ) : (
                      <span className="muted">
                        {(u.tenantIds || []).map(tenantName).join(', ') || '—'}
                        {(u.siteIds || []).length ? ` · ${(u.siteIds || []).map(siteName).join(', ')}` : ''}
                      </span>
                    )}
                  </td>
                  {canWrite ? (
                    <td className="roles-actions">
                      <button
                        type="button"
                        className="btn"
                        disabled={!!busy || u.id === me?.id}
                        onClick={() => remove(u)}
                      >
                        Remove
                      </button>
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {canWrite ? (
        <div className="card">
          <h3>Add user</h3>
          <form className="form-row role-add-form" onSubmit={add}>
            <label className="field">
              Name
              <input value={name} onChange={(e) => setName(e.target.value)} required />
            </label>
            <label className="field">
              Email
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </label>
            <label className="field">
              Role
              <select value={role} onChange={(e) => setRole(e.target.value)}>
                {assignableRoles.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.label}
                  </option>
                ))}
              </select>
            </label>
            <button className="btn primary" type="submit" disabled={!!busy || !name.trim() || !email.trim()}>
              {busy === 'add' ? 'Adding…' : 'Add user'}
            </button>
          </form>
          {role === 'user' || role === 'member' ? (
            <div className="role-scope">
              <ChipGroup
                label="Tenants"
                items={tenants}
                selected={tenantIds}
                nameOf={(t) => t.name}
                onToggle={(id) => toggle(tenantIds, setTenantIds, id)}
              />
              <ChipGroup
                label="Stations"
                items={sites.filter((s) => !tenantIds.length || tenantIds.includes(s.tenantId))}
                selected={siteIds}
                nameOf={(s) => s.name}
                onToggle={(id) => toggle(siteIds, setSiteIds, id)}
              />
            </div>
          ) : (
            <p className="muted">Admins and super admins see the full org.</p>
          )}
        </div>
      ) : null}

      <div className="card" data-tour="roles-matrix">
        <h3>What each role can do</h3>
        <p className="muted role-matrix-note">
          Catalog of permissions by role. Your current session still follows <strong>Act as</strong> in the header.
        </p>
        <div className="table-wrap perm-wrap">
          <table className="data perm-matrix">
            <thead>
              <tr>
                <th>Action</th>
                {catalogRoles.map((r) => (
                  <th key={r.id}>{r.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {groups.flatMap(([group, perms]) => [
                <tr key={`g-${group}`} className="perm-group">
                  <td colSpan={1 + catalogRoles.length}>{group}</td>
                </tr>,
                ...perms.map((p) => (
                  <tr key={p.id}>
                    <td>{p.label}</td>
                    {catalogRoles.map((r) => {
                      const list = matrix[r.id] || [];
                      const allowed = list.includes('*') || list.includes(p.id);
                      return (
                        <td key={r.id} className={allowed ? 'perm-yes' : 'perm-no'}>
                          {allowed ? 'Yes' : '—'}
                        </td>
                      );
                    })}
                  </tr>
                )),
              ])}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
