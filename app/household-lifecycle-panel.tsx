"use client";

import { useCallback, useEffect, useState } from 'react';

type Role = 'owner' | 'admin' | 'viewer';
type Member = { email: string; display_name: string | null; role: Role; status: string };
type Data = { inbox: { id: string; household_name: string; role: string; expires_at: number }[]; invitations: { id: string; email: string; role: string; expires_at: number }[]; requests: { id: string; kind: string }[]; canCreate: boolean; legacyInvitation: boolean; member: { household_id: string } | null };
export default function HouseholdLifecyclePanel({ identity, householdId, role, members = [], setup = false }: { identity: string; householdId?: string; role?: Role; members?: Member[]; setup?: boolean }) {
  const [data, setData] = useState<Data | null>(null);
  const [email, setEmail] = useState('');
  const [access, setAccess] = useState<'admin' | 'viewer'>('admin');
  const [name, setName] = useState('');
  const [message, setMessage] = useState('');
  const [working, setWorking] = useState(false);
  const load = useCallback(async () => {
    const response = await fetch('/api/household/lifecycle', { cache: 'no-store' });
    const result = await response.json() as Data & { error?: string };
    if (!response.ok) throw new Error(result.error ?? 'Could not load household setup.');
    setData(result);
  }, []);
  useEffect(() => { const controller = new AbortController(); void fetch('/api/household/lifecycle', { cache: 'no-store', signal: controller.signal }).then(async response => { const result = await response.json() as Data & { error?: string }; if (!response.ok) throw new Error(result.error ?? 'Could not load household setup.'); setData(result); }).catch(error => { if (!controller.signal.aborted) setMessage(error.message); }); return () => controller.abort(); }, []);
  async function act(body: Record<string, string>, reopen = false) {
    setWorking(true); setMessage('');
    try {
      const response = await fetch('/api/household/lifecycle', { method: 'POST', headers: { 'content-type': 'application/json', 'x-debtfree-identity': identity, 'x-debtfree-household': householdId ?? data?.member?.household_id ?? '' }, body: JSON.stringify(body) });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error ?? 'Could not complete this action.');
      if (reopen) { window.location.assign(new URL('/', window.location.origin).href); return; }
      await load();
      setMessage(body.action === 'invite' ? 'Invitation ready. Share the setup link with your partner. It expires in 7 days.' : body.action === 'request_deletion' ? 'Deletion request saved. Nothing has been deleted; processing is manual during private testing.' : 'Saved.');
      if (body.action === 'invite') setEmail('');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Try again.'); }
    finally { setWorking(false); }
  }
  return <article className="roles-card household-card lifecycle-panel">
    <div className="card-head"><div><span>Household access</span><strong>{setup ? 'Set up your household' : 'Household members'}</strong></div></div>
    {message && <p role="status" className="share-message">{message}</p>}
    {!data && !message && <p role="status">Loading household access…</p>}
    {setup && data && <>
      {data.legacyInvitation && <div><p>Your account has been invited to a shared household. Members can view its financial data.</p><button className="primary" disabled={working} onClick={() => void act({ action: 'accept_legacy' }, true)}>Accept household invitation</button></div>}
      {data.inbox.map(invitation => <div className="lifecycle-invitation" key={invitation.id}><strong>{invitation.household_name}</strong><p>{invitation.role === 'admin' ? 'View and edit shared finances' : 'View shared finances'} · Expires {new Date(invitation.expires_at).toLocaleDateString()}</p><button className="primary" disabled={working} onClick={() => void act({ action: 'accept', id: invitation.id }, true)}>Accept invitation</button></div>)}
      {data.canCreate && <form onSubmit={event => { event.preventDefault(); void act({ action: 'create', name }, true); }}><label>Household name<input value={name} maxLength={80} required onChange={event => setName(event.target.value)}/></label><button className="primary" disabled={working}>Create household</button></form>}
      {!data.canCreate && !data.legacyInvitation && !data.inbox.length && <p>No pending invitations. New household registration is closed.</p>}
      {Boolean(data.requests.length) && <div><p>Pending deletion request: {data.requests[0].id}</p><button disabled={working} onClick={() => void act({ action: 'cancel_deletion' })}>Cancel deletion request</button></div>}
      {/* Shared static client cannot import Next Link; ordinary navigation preserves the web destination. */}
      {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
      {data.member && !data.legacyInvitation && <a className="account-link" href="/">Open your household</a>}
    </>}
    {!setup && <>
      {role === 'owner' && <form onSubmit={event => { event.preventDefault(); void act({ action: 'rename', name }, true); }}><label>Household name<input aria-label="New household name" value={name} maxLength={80} required onChange={event => setName(event.target.value)}/></label><button className="secondary" disabled={working}>Save household name</button></form>}

      {role === 'owner' && <form className="invite-admin" onSubmit={event => { event.preventDefault(); void act({ action: 'invite', email, role: access }); }}><label>Partner email<input type="email" value={email} required maxLength={254} onChange={event => setEmail(event.target.value)}/></label><label>Access<select aria-label="Invitation access" value={access} onChange={event => setAccess(event.target.value as 'admin' | 'viewer')}><option value="admin">Admin — view and edit</option><option value="viewer">Viewer — read only</option></select></label><button className="primary" disabled={working}>Create invitation</button></form>}
      <div className="member-list">{members.map(member => <div className="member-row" key={member.email}><div><strong>{member.display_name || member.email}</strong><small>{member.email}</small></div><span>{member.role}</span>{role === 'owner' && member.role !== 'owner' && <div className="lifecycle-member-actions"><button disabled={working} onClick={() => void act({ action: 'role', email: member.email, role: member.role === 'viewer' ? 'admin' : 'viewer' }, true)}>{member.role === 'viewer' ? 'Make admin' : 'Make viewer'}</button><button disabled={working} onClick={() => { if (confirm('Remove ' + member.email + '? Shared financial records stay in this household.')) void act({ action: 'remove', email: member.email }, true); }}>Remove</button></div>}</div>)}</div>
      {Boolean(data?.invitations.length) && <section aria-label="Pending invitations"><h3>Pending invitations</h3>{data?.invitations.map(invitation => <div className="lifecycle-invitation" key={invitation.id}><strong>{invitation.email}</strong><p>{invitation.role} · Expires {new Date(invitation.expires_at).toLocaleDateString()}</p><button disabled={working} onClick={() => { void navigator.clipboard.writeText(window.location.origin + '/household').then(() => setMessage('Setup link copied. Your partner must sign in with the invited email.')).catch(() => setMessage('Open /household on this site with the invited account.')); }}>Copy setup link</button><button disabled={working} onClick={() => void act({ action: 'revoke', id: invitation.id })}>Revoke</button></div>)}</section>}
      {role !== 'owner' && <button className="secondary" disabled={working} onClick={() => { const confirmation = prompt('Shared records stay with this household. Type LEAVE to leave.'); if (confirmation) void act({ action: 'leave', confirmation }, true); }}>Leave household</button>}
      <details><summary>Account deletion</summary><p>{role === 'owner' ? 'Owner deletion requests include the household and its shared financial records. Export your data first. Other members will lose access when deletion is processed.' : 'Deleting your account removes your access. Shared debts, payments and history remain with the household.'}</p><p>Requests are reviewed manually during private testing. Nothing is deleted automatically.</p>{data?.requests.length ? <><p>Request reference: {data.requests[0].id}</p><button disabled={working} onClick={() => void act({ action: 'cancel_deletion' })}>Cancel deletion request</button></> : <button className="danger" disabled={working} onClick={() => { const confirmation = prompt('Type DELETE to request deletion.'); if (confirmation) void act({ action: 'request_deletion', confirmation }); }}>Request deletion</button>}</details>
    </>}
    <p><a href="/support">Help and support</a></p>
  </article>;
}
