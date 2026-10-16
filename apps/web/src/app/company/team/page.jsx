'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/lib/useAuth';
import DashboardShell from '@/components/dashboard/DashboardShell';
import { SectionHeader, EmptyState, StatusBadge } from '@/components/dashboard/DashboardUI';
import { companiesApi, resolveVehiclePhoto } from '@/lib/api';
import { COMPANY_NAV, COMPANY_ROLES } from '@/lib/companyNav';

const MEMBER_ROLES = [
  { value: 'COMPANY_ADMIN', label: 'Company Admin', hint: 'Full control, including user management' },
  { value: 'FLEET_MANAGER', label: 'Fleet Manager', hint: 'Vehicles, documents, maintenance, tracking & remote control' },
  { value: 'COMPANY_MEMBER', label: 'Company Member', hint: 'View fleet, contracts and payments' },
  { value: 'LEGAL_PROFESSIONAL', label: 'Lawyer / Legal', hint: 'Facilitates and manages contracts & disputes' },
];
const ROLE_LABEL = Object.fromEntries(MEMBER_ROLES.map((r) => [r.value, r.label]));

function fmtDate(d, withTime = false) {
  if (!d) return '—';
  return new Date(d).toLocaleString('en-GB', withTime
    ? { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }
    : { day: '2-digit', month: 'short', year: 'numeric' });
}

function MemberAvatar({ user, size = 'w-10 h-10 text-xs' }) {
  if (user?.profilePhotoUrl) {
    return <img src={resolveVehiclePhoto(user.profilePhotoUrl)} alt="" className={`${size} rounded-full object-cover border border-neutral-300 dark:border-dark-border shrink-0`} />;
  }
  return (
    <div className={`${size} rounded-full bg-neutral-200 dark:bg-dark-border flex items-center justify-center font-bold text-neutral-500 shrink-0`}>
      {(user?.firstName || '?')[0]}{(user?.lastName || '')[0]}
    </div>
  );
}

function Detail({ label, children }) {
  return (
    <div>
      <p className="text-neutral-500">{label}</p>
      <p className="text-neutral-900 dark:text-white mt-0.5 break-words">{children}</p>
    </div>
  );
}

export default function CompanyTeamPage() {
  const { user, loading, logout } = useAuth({ requiredRoles: COMPANY_ROLES });
  const isAdmin = user?.primaryRole === 'COMPANY_ADMIN';
  const [company, setCompany] = useState(null);
  const [members, setMembers] = useState([]);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ contact: '', role: 'FLEET_MANAGER', title: '' });
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [lastLink, setLastLink] = useState('');
  const [invites, setInvites] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [titleDraft, setTitleDraft] = useState('');

  const load = useCallback(async () => {
    if (!user) return;
    try {
      const mine = (await companiesApi.mine()).data?.data || [];
      const co = mine[0];
      setCompany(co || null);
      if (co) {
        const res = await companiesApi.listMembers(co.id);
        setMembers(res.data?.data?.members || []);
        if (user.primaryRole === 'COMPANY_ADMIN') {
          const inv = await companiesApi.listInvites(co.id).catch(() => null);
          setInvites(inv?.data?.data?.invites || []);
        }
      }
    } catch { setError('Could not load your company team.'); }
    setFetching(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const add = async (e) => {
    e.preventDefault();
    if (!company) return;
    setBusy(true); setError(''); setNotice(''); setLastLink('');
    try {
      const res = await companiesApi.createInvite(company.id, form);
      const data = res.data?.data || {};
      if (data.status === 'added') {
        setNotice('That person already had an account, so they have been added to your company right away.');
      } else {
        setNotice('Invitation created. We sent the setup link by SMS (for phone numbers) and logged it for email — you can also copy the link below and share it yourself (WhatsApp, email, …).');
        setLastLink(data.inviteLink || '');
      }
      setForm({ contact: '', role: 'FLEET_MANAGER', title: '' });
      await load();
    } catch (err) {
      const msg = err.response?.data?.message;
      setError(Array.isArray(msg) ? msg.join(', ') : msg || 'Could not invite member.');
    } finally { setBusy(false); }
  };

  const inviteAction = async (inv, action) => {
    setError(''); setNotice(''); setLastLink('');
    try {
      if (action === 'resend') {
        const res = await companiesApi.resendInvite(company.id, inv.id);
        setNotice('A fresh invitation link was sent.');
        setLastLink(res.data?.data?.inviteLink || '');
      } else {
        await companiesApi.revokeInvite(company.id, inv.id);
        setNotice('Invitation revoked.');
      }
      await load();
    } catch (err) { setError(err.response?.data?.message || 'Could not update invite.'); }
  };

  const changeRole = async (m, role) => {
    setError('');
    try { await companiesApi.updateMemberRole(company.id, m.id, { role, title: m.title || undefined }); await load(); }
    catch (err) { setError(err.response?.data?.message || 'Could not change role.'); }
  };

  const setActive = async (m) => {
    setError('');
    try { await companiesApi.setMemberActive(company.id, m.id, !m.isActive); await load(); }
    catch (err) { setError(err.response?.data?.message || 'Could not update member.'); }
  };

  const saveTitle = async (m) => {
    setError('');
    try { await companiesApi.updateMemberRole(company.id, m.id, { role: m.role, title: titleDraft }); await load(); }
    catch (err) { setError(err.response?.data?.message || 'Could not save title.'); }
  };

  if (loading) return <div className="min-h-screen bg-chalk flex items-center justify-center"><div className="text-neutral-500 text-sm">Loading…</div></div>;

  return (
    <DashboardShell user={user} loading={loading} logout={logout} navItems={COMPANY_NAV} title="Team">
      <SectionHeader title={company ? `${company.name} — Team` : 'Team'} description="People who run this company: admins, fleet managers, members and legal" />
      {error && <div className="bg-danger/10 border border-danger/20 text-danger text-sm px-4 py-3 rounded-lg mb-4">{error}</div>}

      {fetching ? (
        <div className="text-neutral-500 text-sm py-8 text-center">Loading team…</div>
      ) : !company ? (
        <EmptyState icon="🏢" title="No company yet" description="Your company will be created automatically when your company admin account is provisioned." />
      ) : (
        <>
          {isAdmin && (
            <form onSubmit={add} className="bg-neutral-50 dark:bg-dark-card border border-neutral-200 dark:border-dark-border rounded-card p-4 mb-5">
              <p className="text-sm font-semibold text-neutral-900 dark:text-white mb-1">Invite a user</p>
              <p className="text-xs text-neutral-500 mb-3">Enter their email or phone number — no account needed. If they already have a +Motive account they are added right away; otherwise they receive a link (SMS for phone numbers) to set up their account, already tied to {company.name} with the role you pick. The link expires in 7 days.</p>
              <div className="grid sm:grid-cols-4 gap-3">
                <input required placeholder="person@example.com or +233…" className="input sm:col-span-2" value={form.contact} onChange={(e) => setForm({ ...form, contact: e.target.value })} />
                <select className="input" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                  {MEMBER_ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
                <input placeholder="Title (optional)" className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
              </div>
              <p className="text-xs text-neutral-400 mt-2">{MEMBER_ROLES.find((r) => r.value === form.role)?.hint}</p>
              <button disabled={busy} className="mt-3 text-xs font-medium px-4 py-2 rounded-lg bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 disabled:opacity-40">{busy ? 'Sending…' : 'Invite to company'}</button>
              {notice && <p className="text-xs text-green-600 mt-3">{notice}</p>}
              {lastLink && (
                <div className="flex gap-2 mt-2">
                  <input readOnly className="input flex-1 text-xs" value={lastLink} onFocus={(e) => e.target.select()} />
                  <button type="button" className="text-xs px-3 py-2 rounded-lg border border-neutral-300 dark:border-dark-border" onClick={() => navigator.clipboard?.writeText(lastLink)}>Copy link</button>
                </div>
              )}
            </form>
          )}

          {isAdmin && invites.filter((i) => i.status === 'PENDING').length > 0 && (
            <div className="mb-5">
              <p className="text-xs text-neutral-500 mb-2">Pending invitations</p>
              <div className="space-y-2">
                {invites.filter((i) => i.status === 'PENDING').map((inv) => (
                  <div key={inv.id} className="bg-neutral-50 dark:bg-dark-card border border-neutral-200 dark:border-dark-border rounded-card px-4 py-3 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm text-neutral-900 dark:text-white">{inv.email || inv.phone}</p>
                      <p className="text-xs text-neutral-400">{ROLE_LABEL[inv.role] || inv.role} · expires {new Date(inv.expiresAt).toLocaleDateString('en-GB')}</p>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => inviteAction(inv, 'resend')} className="text-xs px-3 py-1.5 rounded-lg border border-neutral-300 dark:border-dark-border">Resend</button>
                      <button onClick={() => inviteAction(inv, 'revoke')} className="text-xs px-3 py-1.5 rounded-lg border border-red-300 text-red-500">Revoke</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {!isAdmin && <p className="text-xs text-neutral-500 mb-4">Only a company admin can add users or change roles.</p>}

          {members.length === 0 ? (
            <EmptyState icon="👥" title="No members yet" description="Added users will appear here." />
          ) : (
            <div className="space-y-3">
              {members.map((m) => {
                const expanded = selectedId === m.id;
                return (
                <div key={m.id} className="bg-neutral-50 dark:bg-dark-card border border-neutral-200 dark:border-dark-border rounded-card p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3 cursor-pointer" onClick={() => { setSelectedId(expanded ? null : m.id); setTitleDraft(m.title || ''); }}>
                    <div className="flex items-center gap-3 min-w-0">
                      <MemberAvatar user={m.user} />
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-neutral-900 dark:text-white">{m.user?.firstName} {m.user?.otherNames ? `${m.user.otherNames} ` : ''}{m.user?.lastName} {!m.isActive && <span className="text-xs text-red-400 font-normal">(deactivated)</span>}</p>
                        <p className="text-xs text-neutral-400 mt-0.5 truncate">{m.user?.email || m.user?.phone || '—'}{m.title ? ` · ${m.title}` : ''}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                      <StatusBadge status={m.user?.status || 'ACTIVE'} />
                      {isAdmin ? (
                        <select className="input !w-auto text-xs" value={m.role} onChange={(e) => changeRole(m, e.target.value)}>
                          {MEMBER_ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                        </select>
                      ) : (
                        <span className="text-xs font-medium text-neutral-600 dark:text-neutral-300">{ROLE_LABEL[m.role] || m.role}</span>
                      )}
                      {isAdmin && (
                        <button onClick={() => setActive(m)} className={`text-xs px-3 py-1.5 rounded-lg border ${m.isActive ? 'border-red-300 text-red-500' : 'border-green-300 text-green-600'}`}>
                          {m.isActive ? 'Deactivate' : 'Reactivate'}
                        </button>
                      )}
                      <button type="button" className="text-xs font-medium px-3 py-1.5 rounded-lg border border-neutral-300 dark:border-dark-border" onClick={(e) => { e.stopPropagation(); setSelectedId(expanded ? null : m.id); setTitleDraft(m.title || ''); }}>
                        {expanded ? 'Hide details' : 'View details'}
                      </button>
                    </div>
                  </div>

                  {expanded && (
                    <div className="mt-4 pt-4 border-t border-neutral-200 dark:border-dark-border">
                      <div className="flex items-center gap-4 mb-4">
                        <MemberAvatar user={m.user} size="w-14 h-14 text-sm" />
                        <div>
                          <p className="text-sm font-semibold text-neutral-900 dark:text-white">{m.user?.firstName} {m.user?.otherNames ? `${m.user.otherNames} ` : ''}{m.user?.lastName}</p>
                          <p className="text-xs text-neutral-500">{ROLE_LABEL[m.role] || m.role}{m.title ? ` · ${m.title}` : ''} · Joined {company?.name} on {fmtDate(m.joinedAt)}</p>
                        </div>
                      </div>

                      <p className="text-xs font-semibold text-neutral-500 mb-2">Profile & account details</p>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-xs mb-4">
                        <Detail label="Email">{m.user?.email || '—'}</Detail>
                        <Detail label="Phone">{m.user?.phone || '—'}</Detail>
                        <Detail label="Account role">{(m.user?.primaryRole || '—').replace(/_/g, ' ')}</Detail>
                        <Detail label="Account status">{m.user?.status || '—'}</Detail>
                        <Detail label="Email verified">{m.user?.emailVerifiedAt ? fmtDate(m.user.emailVerifiedAt) : 'Not verified'}</Detail>
                        <Detail label="Phone verified">{m.user?.phoneVerifiedAt ? fmtDate(m.user.phoneVerifiedAt) : 'Not verified'}</Detail>
                        <Detail label="Account created">{fmtDate(m.user?.createdAt)}</Detail>
                        <Detail label="Last sign-in">{fmtDate(m.user?.lastLoginAt, true)}</Detail>
                        <Detail label="Gender / Date of birth">{m.user?.gender || '—'}{m.user?.dateOfBirth ? ` · ${fmtDate(m.user.dateOfBirth)}` : ''}</Detail>
                        <Detail label="Membership">{m.isActive ? 'Active in this company' : `Deactivated${m.leftAt ? ` · ${fmtDate(m.leftAt)}` : ''}`}</Detail>
                        <Detail label="Company role">{ROLE_LABEL[m.role] || m.role}</Detail>
                        <Detail label="User ID">{m.user?.id || '—'}</Detail>
                      </div>

                      {isAdmin ? (
                        <div className="bg-white dark:bg-dark-surface border border-neutral-200 dark:border-dark-border rounded-lg p-3">
                          <p className="text-xs font-semibold text-neutral-500 mb-2">Manage this user in {company?.name}</p>
                          <div className="flex flex-wrap gap-2 items-center">
                            <select className="input !w-auto text-xs" value={m.role} onChange={(e) => changeRole(m, e.target.value)}>
                              {MEMBER_ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                            </select>
                            <input className="input !w-auto text-xs" placeholder="Title in company" value={expanded ? titleDraft : (m.title || '')} onChange={(e) => setTitleDraft(e.target.value)} />
                            <button onClick={() => saveTitle(m)} className="text-xs px-3 py-1.5 rounded-lg border border-neutral-300 dark:border-dark-border">Save title</button>
                            <button onClick={() => setActive(m)} className={`text-xs px-3 py-1.5 rounded-lg border ${m.isActive ? 'border-red-300 text-red-500' : 'border-green-300 text-green-600'}`}>
                              {m.isActive ? 'Deactivate membership' : 'Reactivate membership'}
                            </button>
                          </div>
                          <p className="text-xs text-neutral-400 mt-2">Personal profile details (name, phone, picture, password) belong to the user and are changed by them in their own Settings. Here you control their company role, title and membership.</p>
                        </div>
                      ) : (
                        <p className="text-xs text-neutral-400">Only a company admin can change roles, titles or membership for this user.</p>
                      )}
                    </div>
                  )}
                </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </DashboardShell>
  );
}
