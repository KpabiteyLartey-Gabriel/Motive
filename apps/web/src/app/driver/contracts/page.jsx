'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/useAuth';
import DashboardShell from '@/components/dashboard/DashboardShell';
import { SectionHeader, EmptyState, StatusBadge } from '@/components/dashboard/DashboardUI';
import { contractsApi } from '@/lib/api';

const NAV = [
  { href: '/driver/dashboard', icon: 'dashboard', label: 'Dashboard' },
  { href: '/driver/explore',   icon: 'explore', label: 'Explore' },
  { href: '/driver/vehicle',   icon: 'vehicle', label: 'My Vehicle' },
  { href: '/driver/contracts', icon: 'contract', label: 'Contracts' },
  { href: '/driver/messages',  icon: 'messages', label: 'Messages' },
  { href: '/driver/payments',  icon: 'payments', label: 'Payments' },
  { href: '/driver/earnings',  icon: 'earnings', label: 'Earnings' },
  { href: '/driver/documents', icon: 'documents', label: 'Documents' },
  { href: '/driver/disputes',  icon: 'disputes', label: 'Disputes' },
];

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}
function fmtGHS(n) {
  if (n == null) return '—';
  return `GHS ${Number(n).toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const TYPE_LABEL = { WORK_AND_PAY: 'Work & Pay', RENTAL: 'Rental', DRIVING_ON: 'Driving On' };

export default function DriverContractsPage() {
  const { user, loading, logout } = useAuth({ requiredRoles: ['DRIVER'] });
  const [contracts, setContracts]   = useState([]);
  const [fetching, setFetching]     = useState(true);
  const [accepting, setAccepting]   = useState(null);
  const [selected, setSelected]     = useState(null);

  const load = () => {
    contractsApi.list({ limit: 20 })
      .then((r) => setContracts(r.data?.data?.contracts || []))
      .catch(() => {})
      .finally(() => setFetching(false));
  };

  useEffect(() => { if (user) load(); }, [user]);

  const accept = async (id) => {
    setAccepting(id);
    try {
      await contractsApi.accept(id);
      setContracts((prev) => prev.map((c) => c.id === id ? { ...c, status: 'ACTIVE' } : c));
    } catch {}
    setAccepting(null);
  };

  const [codeInputs, setCodeInputs] = useState({});
  const [confirming, setConfirming] = useState(null);
  const [codeMsg, setCodeMsg] = useState('');
  const confirmWithCode = async (id) => {
    const code = (codeInputs[id] || '').trim();
    if (!code) { setCodeMsg('Enter the access code the owner sent you in chat.'); return; }
    setConfirming(id);
    setCodeMsg('');
    try {
      await contractsApi.confirmCode(id, code);
      setCodeMsg('Contract confirmed and signed. Welcome aboard!');
      load();
    } catch (e) {
      setCodeMsg(e.response?.data?.message || 'That code did not work. Check it and try again.');
    } finally { setConfirming(null); }
  };

  if (loading) return <div className="min-h-screen bg-chalk flex items-center justify-center"><div className="text-neutral-500 text-sm">Loading…</div></div>;

  return (
    <DashboardShell user={user} loading={loading} logout={logout} navItems={NAV} title="My Contracts">
      <SectionHeader title="Contracts" description="Your current and past vehicle arrangements" />

      {fetching ? (
        <div className="text-neutral-500 text-sm py-8 text-center">Loading contracts…</div>
      ) : contracts.length === 0 ? (
        <EmptyState icon="📄" title="No contracts yet" description="A contract will appear here once an owner or company assigns a vehicle to you." />
      ) : (
        <div className="space-y-3">
          {contracts.map((c) => (
            <div
              key={c.id}
              className="bg-neutral-50 dark:bg-dark-card border border-neutral-200 dark:border-dark-border rounded-card p-4 cursor-pointer hover:border-neutral-600 transition-colors"
              onClick={() => setSelected(selected?.id === c.id ? null : c)}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-neutral-900 dark:text-white">{TYPE_LABEL[c.type] || c.type}</p>
                  <p className="text-xs text-neutral-400 mt-0.5">
                    {c.vehicle?.registrationNumber || c.vehicleId || '—'} &middot; {fmtDate(c.startDate)} – {fmtDate(c.endDate)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {c.requiresCode ? (
                    <span className="text-[11px] font-semibold text-amber-600 bg-amber-50 dark:bg-dark-card border border-amber-200 dark:border-dark-border rounded-full px-2.5 py-1">Access code required — open to confirm</span>
                  ) : c.status === 'PENDING_ACCEPTANCE' && (
                    <button
                      onClick={(e) => { e.stopPropagation(); accept(c.id); }}
                      disabled={accepting === c.id}
                      className="btn-graphite text-xs disabled:opacity-60"
                    >
                      {accepting === c.id ? 'Accepting…' : 'Accept'}
                    </button>
                  )}
                  <StatusBadge status={c.status} />
                </div>
              </div>

              {selected?.id === c.id && (
                <div className="mt-4 pt-4 border-t border-neutral-200 dark:border-dark-border grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <p className="text-neutral-500">Total Amount</p>
                    <p className="text-neutral-900 dark:text-white mt-0.5">{fmtGHS(c.totalAmount)}</p>
                  </div>
                  <div>
                    <p className="text-neutral-500">Amount Paid</p>
                    <p className="text-neutral-900 dark:text-white mt-0.5">{fmtGHS(c.amountPaid)}</p>
                  </div>
                  <div>
                    <p className="text-neutral-500">Remaining</p>
                    <p className="text-neutral-900 dark:text-white mt-0.5">{fmtGHS((c.totalAmount || 0) - (c.amountPaid || 0))}</p>
                  </div>
                  <div>
                    <p className="text-neutral-500">Installment</p>
                    <p className="text-neutral-900 dark:text-white mt-0.5">{fmtGHS(c.installmentAmount)}</p>
                  </div>
                  <div>
                    <p className="text-neutral-500">Deposit</p>
                    <p className="text-neutral-900 dark:text-white mt-0.5">{fmtGHS(c.depositAmount)}</p>
                  </div>
                  <div>
                    <p className="text-neutral-500">Frequency</p>
                    <p className="text-neutral-900 dark:text-white mt-0.5">{c.paymentFrequency || '—'}</p>
                  </div>
                  {c.requiresCode && (
                    <div className="col-span-2 border-t border-neutral-200 dark:border-dark-border pt-3" onClick={(e) => e.stopPropagation()}>
                      <p className="text-neutral-800 dark:text-neutral-100 font-semibold text-sm">Confirm this contract with your access code</p>
                      <p className="text-neutral-500 mt-1 leading-relaxed">The owner approved you for this vehicle and sent a unique code in your chat. Paste it here to confirm and sign your contract. This code box only appears for approved drivers who have been issued a code.</p>
                      <div className="flex items-center gap-2 mt-3 flex-wrap">
                        <input
                          className="input !w-44 text-center tracking-[0.35em] font-bold"
                          placeholder="••••••"
                          inputMode="numeric"
                          maxLength={6}
                          value={codeInputs[c.id] || ''}
                          onChange={(e) => setCodeInputs((p) => ({ ...p, [c.id]: e.target.value.replace(/[^0-9]/g, '') }))}
                        />
                        <button onClick={() => confirmWithCode(c.id)} disabled={confirming === c.id} className="btn-primary text-xs disabled:opacity-40">{confirming === c.id ? 'Confirming…' : 'Confirm contract'}</button>
                      </div>
                      {codeMsg && <p className="mt-2 text-neutral-600 dark:text-neutral-300">{codeMsg}</p>}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </DashboardShell>
  );
}
