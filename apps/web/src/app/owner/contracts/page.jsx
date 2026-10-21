'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/useAuth';
import DashboardShell from '@/components/dashboard/DashboardShell';
import { OWNER_NAV } from '@/lib/ownerNav';
import { SectionHeader, EmptyState, StatusBadge } from '@/components/dashboard/DashboardUI';
import Link from 'next/link';
import { Modal } from '@/components/dashboard/DashboardUI';
import { contractsApi, marketplaceApi } from '@/lib/api';

const NAV = OWNER_NAV;

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}
function fmtGHS(n) {
  if (n == null) return '—';
  return `GHS ${Number(n).toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const TYPE_LABEL = { WORK_AND_PAY: 'Work & Pay', RENTAL: 'Rental', DRIVING_ON: 'Driving On' };

export default function OwnerContractsPage() {
  const { user, loading, logout } = useAuth({ requiredRoles: ['OWNER'] });
  const [contracts, setContracts]   = useState([]);
  const [fetching, setFetching]     = useState(true);
  const [selected, setSelected]     = useState(null);
  const [approvedThreads, setApprovedThreads] = useState([]);
  const [startFor, setStartFor] = useState(null);
  const [terms, setTerms] = useState({ vehicleValue: '', depositAmount: '', totalPayable: '', installmentAmount: '', totalInstallments: '52', dailySalesAmount: '', frequency: 'WEEKLY' });
  const [startBusy, setStartBusy] = useState(false);
  const [codes, setCodes] = useState({});
  const [codeBusy, setCodeBusy] = useState('');
  const [notice, setNotice] = useState('');

  const loadContracts = () => contractsApi.list({ limit: 50 })
    .then((r) => setContracts(r.data?.data?.contracts || []))
    .catch(() => {})
    .finally(() => setFetching(false));

  useEffect(() => {
    if (!user) return;
    loadContracts();
    marketplaceApi.threads()
      .then((r) => setApprovedThreads((r.data?.data || []).filter((t) => t.interest?.status === 'APPROVED')))
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const set = (k, v) => setTerms((p) => ({ ...p, [k]: v }));
  const num = (v) => { const n = Number(v); return Number.isFinite(n) && n > 0 ? n : null; };

  const startContract = async () => {
    if (!startFor) return;
    const type = startFor.vehicle?.operatingModel || 'DRIVING_ON';
    const payload = {
      type,
      vehicleId: startFor.vehicleId,
      parties: [{ userId: startFor.otherParty?.id, role: 'DRIVER' }],
    };
    if (type === 'WORK_AND_PAY') {
      if (![terms.vehicleValue, terms.depositAmount, terms.totalPayable, terms.installmentAmount, terms.totalInstallments].every((v) => num(v))) { setNotice('Fill in the vehicle value, deposit, total payable, installment amount and number of installments.'); return; }
      payload.workAndPayTerms = { vehicleValue: num(terms.vehicleValue), depositAmount: num(terms.depositAmount), totalPayable: num(terms.totalPayable), installmentAmount: num(terms.installmentAmount), installmentFrequency: terms.frequency, totalInstallments: Math.round(num(terms.totalInstallments)) };
    } else if (type === 'RENTAL') {
      payload.rentalTerms = { paymentFrequency: terms.frequency === 'DAILY' ? 'WEEKLY' : terms.frequency };
    } else {
      if (!num(terms.dailySalesAmount)) { setNotice('Enter the daily sales amount for this DriveOn contract.'); return; }
      payload.drivingOnTerms = { dailySalesAmount: num(terms.dailySalesAmount), paymentFrequency: 'DAILY' };
    }
    setStartBusy(true);
    try {
      await contractsApi.create(payload);
      setStartFor(null);
      setNotice(`Contract created for ${startFor.otherParty?.firstName || 'the driver'}. Open it below and generate the driver's access code, then share it in your chat.`);
      loadContracts();
    } catch (e) {
      setNotice(e.response?.data?.message || 'Could not create the contract.');
    } finally { setStartBusy(false); }
  };

  const generateCode = async (contract) => {
    setCodeBusy(contract.id);
    try {
      const r = await marketplaceApi.generateAccessCode(contract.id);
      const code = r.data?.data?.code;
      if (code) setCodes((p) => ({ ...p, [contract.id]: code }));
      setNotice('Access code generated. Share it with the driver in your chat — they enter it on their Contracts page to confirm the contract.');
    } catch (e) {
      setNotice(e.response?.data?.message || 'Could not generate a code. The driver must be the approved driver for this vehicle.');
    } finally { setCodeBusy(''); }
  };

  const sendCodeInChat = async (contract) => {
    const code = codes[contract.id];
    if (!code) return;
    try {
      const r = await marketplaceApi.vehicleInterests(contract.vehicleId);
      const approved = (r.data?.data || []).find((i) => i.status === 'APPROVED' && i.threadId);
      if (!approved) { setNotice('No chat thread found for the approved driver.'); return; }
      await marketplaceApi.sendMessage(approved.threadId, { body: `Here is your contract access code: ${code}\nOpen Contracts on +Motive and enter this code to confirm your contract for ${contract.vehicle?.registrationNumber || 'your vehicle'}.` });
      setNotice('Code sent to the driver in chat.');
    } catch (e) {
      setNotice(e.response?.data?.message || 'Could not send the code in chat. You can copy it and paste it into the chat yourself.');
    }
  };

  if (loading) return <div className="min-h-screen bg-chalk flex items-center justify-center"><div className="text-neutral-500 text-sm">Loading…</div></div>;

  return (
    <DashboardShell user={user} loading={loading} logout={logout} navItems={NAV} title="Contracts">
      <SectionHeader title="My Contracts" description="All vehicle contracts you are party to" />
      {notice && <div className="mb-4 rounded-btn bg-brand-50 dark:bg-dark-card border border-brand-100 dark:border-dark-border px-4 py-3 text-sm text-brand-800 dark:text-brand-300 flex items-start justify-between gap-4"><span>{notice}</span><button onClick={() => setNotice('')} className="font-semibold">×</button></div>}

      {approvedThreads.length > 0 && (
        <div className="mb-6 bg-white dark:bg-dark-surface border border-brand-200 dark:border-dark-border rounded-card p-4">
          <p className="text-sm font-semibold text-neutral-900 dark:text-neutral-50">Approved drivers waiting for a contract</p>
          <p className="text-xs text-neutral-500 mt-0.5">These drivers showed interest on Explore and you approved them. Start the contract here, then generate their access code and share it in chat.</p>
          <div className="mt-3 space-y-2">
            {approvedThreads.map((t) => (
              <div key={t.id} className="flex items-center gap-3 flex-wrap border border-neutral-200 dark:border-dark-border rounded-lg px-3 py-2.5">
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-neutral-800 dark:text-neutral-100 font-medium">{t.otherParty ? `${t.otherParty.firstName || ''} ${t.otherParty.lastName || ''}`.trim() : 'Driver'} — {t.vehicle?.make} {t.vehicle?.model} ({t.vehicle?.registrationNumber})</p>
                  <p className="text-xs text-neutral-400">{(t.vehicle?.operatingModel || '').replace(/_/g, ' ')}</p>
                </div>
                <button onClick={() => setStartFor(t)} className="btn-primary text-xs">Start contract</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {fetching ? (
        <div className="text-neutral-500 text-sm py-8 text-center">Loading contracts…</div>
      ) : contracts.length === 0 ? (
        <EmptyState icon="📄" title="No contracts yet" description="Contracts appear once a vehicle is assigned and an agreement is created with a driver." />
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
                <StatusBadge status={c.status} />
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
                    <p className="text-neutral-500">Frequency</p>
                    <p className="text-neutral-900 dark:text-white mt-0.5">{c.paymentFrequency || '—'}</p>
                  </div>
                  <div>
                    <p className="text-neutral-500">Deposit</p>
                    <p className="text-neutral-900 dark:text-white mt-0.5">{fmtGHS(c.depositAmount)}</p>
                  </div>
                  {c.terms && (
                    <div className="col-span-2">
                      <p className="text-neutral-500">Terms summary</p>
                      <p className="text-white mt-0.5 leading-relaxed">{c.terms}</p>
                    </div>
                  )}
                  {['DRAFT', 'PENDING_SIGNATURES', 'PENDING_APPROVAL'].includes(c.status) && (c.parties || []).some((p) => p.role === 'DRIVER') && (
                    <div className="col-span-2 border-t border-neutral-200 dark:border-dark-border pt-3" onClick={(e) => e.stopPropagation()}>
                      <p className="text-neutral-500">Driver access code</p>
                      <p className="text-neutral-400 mt-0.5">Generate the unique code for the approved driver of this vehicle and share it in your chat. The driver enters it on their Contracts page to confirm and sign this contract. Generating a new code replaces the old one.</p>
                      {codes[c.id] ? (
                        <div className="mt-2 flex items-center gap-3 flex-wrap">
                          <span className="text-lg font-bold tracking-[0.3em] text-neutral-900 dark:text-white bg-neutral-100 dark:bg-dark-bg px-3 py-1.5 rounded-lg">{codes[c.id]}</span>
                          <button onClick={() => sendCodeInChat(c)} className="btn-primary text-xs">Send code in chat</button>
                          <button onClick={() => generateCode(c)} disabled={codeBusy === c.id} className="btn-graphite text-xs disabled:opacity-40">Regenerate</button>
                        </div>
                      ) : (
                        <button onClick={() => generateCode(c)} disabled={codeBusy === c.id} className="btn-primary text-xs mt-2 disabled:opacity-40">{codeBusy === c.id ? 'Generating…' : 'Generate access code'}</button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <Modal open={!!startFor} onClose={() => setStartFor(null)} title={startFor ? `Contract for ${startFor.vehicle?.make} ${startFor.vehicle?.model}` : ''}>
        {startFor && (
          <div className="space-y-3">
            <p className="text-sm text-neutral-600 dark:text-neutral-300">
              Driver: <b>{startFor.otherParty ? `${startFor.otherParty.firstName || ''} ${startFor.otherParty.lastName || ''}`.trim() : 'Driver'}</b> · {startFor.vehicle?.registrationNumber} · {(startFor.vehicle?.operatingModel || '').replace(/_/g, ' ')}
            </p>
            {startFor.vehicle?.operatingModel === 'WORK_AND_PAY' && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <label className="text-xs text-neutral-500">Vehicle value (GHS)<input className="input mt-1" inputMode="decimal" value={terms.vehicleValue} onChange={(e) => set('vehicleValue', e.target.value)} /></label>
                  <label className="text-xs text-neutral-500">Deposit (GHS)<input className="input mt-1" inputMode="decimal" value={terms.depositAmount} onChange={(e) => set('depositAmount', e.target.value)} /></label>
                  <label className="text-xs text-neutral-500">Total payable (GHS)<input className="input mt-1" inputMode="decimal" value={terms.totalPayable} onChange={(e) => set('totalPayable', e.target.value)} /></label>
                  <label className="text-xs text-neutral-500">Installment (GHS)<input className="input mt-1" inputMode="decimal" value={terms.installmentAmount} onChange={(e) => set('installmentAmount', e.target.value)} /></label>
                  <label className="text-xs text-neutral-500">Frequency
                    <select className="input mt-1" value={terms.frequency} onChange={(e) => set('frequency', e.target.value)}>
                      <option value="DAILY">Daily</option><option value="WEEKLY">Weekly</option><option value="MONTHLY">Monthly</option>
                    </select>
                  </label>
                  <label className="text-xs text-neutral-500">Number of installments<input className="input mt-1" inputMode="numeric" value={terms.totalInstallments} onChange={(e) => set('totalInstallments', e.target.value)} /></label>
                </div>
              </>
            )}
            {startFor.vehicle?.operatingModel === 'DRIVING_ON' && (
              <label className="text-xs text-neutral-500 block">Daily sales amount (GHS)<input className="input mt-1" inputMode="decimal" value={terms.dailySalesAmount} onChange={(e) => set('dailySalesAmount', e.target.value)} /></label>
            )}
            {startFor.vehicle?.operatingModel === 'RENTAL' && (
              <label className="text-xs text-neutral-500 block">Payment frequency
                <select className="input mt-1" value={terms.frequency} onChange={(e) => set('frequency', e.target.value)}>
                  <option value="WEEKLY">Weekly</option><option value="MONTHLY">Monthly</option>
                </select>
              </label>
            )}
            <p className="text-xs text-neutral-400">After creating the contract, generate the driver&apos;s access code on the contract and send it in your chat. The driver confirms the contract by entering that code.</p>
            <div className="flex gap-3 pt-1">
              <button onClick={() => setStartFor(null)} className="btn-graphite flex-1 justify-center">Cancel</button>
              <button onClick={startContract} disabled={startBusy} className="btn-primary flex-1 justify-center disabled:opacity-40">{startBusy ? 'Creating…' : 'Create contract'}</button>
            </div>
          </div>
        )}
      </Modal>
    </DashboardShell>
  );
}
