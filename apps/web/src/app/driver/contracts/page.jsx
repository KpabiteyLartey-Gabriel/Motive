'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/useAuth';
import { SectionHeader, EmptyState, StatusBadge } from '@/components/dashboard/DashboardUI';
import { contractsApi, resolveVehiclePhoto } from '@/lib/api';
import { formatOffDays, hasOffDays } from '@/lib/offDays';

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}
function fmtGHS(n) {
  if (n == null) return '—';
  return `GHS ${Number(n).toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const TYPE_LABEL = { WORK_AND_PAY: 'Work & Pay', RENTAL: 'Rental', DRIVING_ON: 'Driving On' };

/** Plain-words Work & Pay summary a driver can understand before signing. */
function plainSummary(c) {
  const w = c.workAndPayTerms;
  if (!w) return null;
  const freqWord = { DAILY: 'day', WEEKLY: 'week', MONTHLY: 'month' }[w.installmentFrequency] || 'week';
  const total = Number(w.totalPayable); const inst = Number(w.installmentAmount); const count = Number(w.totalInstallments);
  const last = (total - (Number(w.depositAmount) || 0)) - inst * (count - 1);
  const grace = Math.max(0, Math.round(Number(w.gracePeriodDays) || 0));
  const countingStart = new Date(); countingStart.setDate(countingStart.getDate() + grace);
  const firstDue = new Date(countingStart);
  const finish = new Date(countingStart);
  if (w.installmentFrequency === 'MONTHLY') { firstDue.setMonth(firstDue.getMonth() + 1); finish.setMonth(finish.getMonth() + count); }
  else if (w.installmentFrequency === 'DAILY') { firstDue.setDate(firstDue.getDate() + 1); finish.setDate(finish.getDate() + count); }
  else { firstDue.setDate(firstDue.getDate() + 7); finish.setDate(finish.getDate() + count * 7); }
  const started = c.status === 'ACTIVE' && c.startDate;
  return `You pay ${fmtGHS(w.depositAmount)} deposit upfront, then ${fmtGHS(inst)} every ${freqWord} for ${count} payments — ${fmtGHS(total)} in total${last !== inst ? `, with the last payment ${fmtGHS(last)}` : ''}. Grace period: ${grace} day${grace === 1 ? '' : 's'}. ${started ? `Counting started on ${fmtDate(c.startDate)} (after your grace period), and the last payment is due around ${fmtDate(c.endDate || finish)}.` : `When you confirm with your access code, your ${grace}-day grace period runs first. Counting starts on ${fmtDate(countingStart)} if you confirm today, your first payment is due ${fmtDate(firstDue)}, and the last around ${fmtDate(finish)}.`}`;
}

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
  const [seenVehicle, setSeenVehicle] = useState({});

  // A shared link (/driver/contracts?contract=<id>) opens that contract.
  useEffect(() => {
    if (!contracts.length) return;
    const wanted = new URLSearchParams(window.location.search).get('contract');
    if (!wanted) return;
    const found = contracts.find((c) => c.id === wanted);
    if (found) setSelected(found);
  }, [contracts]);
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
    <>
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
                  <p className="text-base font-bold text-neutral-900 dark:text-white">{c.vehicle ? [c.vehicle.year, c.vehicle.make, c.vehicle.model].filter(Boolean).join(' ') : 'Vehicle not specified'}</p>
                  <p className="text-xs text-neutral-400 mt-0.5">
                    {TYPE_LABEL[c.type] || c.type}{c.title ? ` · ${c.title}` : ''}{c.contractNumber ? ` · ${c.contractNumber}` : ''}<br />{c.vehicle?.registrationNumber ? `Registration ${c.vehicle.registrationNumber}` : 'No registration number'} &middot; {c.startDate ? `${fmtDate(c.startDate)} – ${fmtDate(c.endDate)}` : 'Starts when you sign'}
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

              {selected?.id === c.id && (<div>
                <div className="mt-4 overflow-hidden rounded-lg border border-neutral-200 bg-white dark:border-dark-border dark:bg-dark-surface">{c.vehicle?.imageUrls?.[0] ? (
                    <img src={resolveVehiclePhoto(c.vehicle.imageUrls[0])} alt={[c.vehicle.year, c.vehicle.make, c.vehicle.model].filter(Boolean).join(' ')} className="h-44 w-full object-cover" />
                  ) : (
                    <div className="flex h-28 items-center justify-center bg-neutral-100 px-4 text-center dark:bg-dark-card">
                      <div>
                        <p className="text-sm font-bold text-neutral-800 dark:text-neutral-100">{c.vehicle ? [c.vehicle.year, c.vehicle.make, c.vehicle.model].filter(Boolean).join(' ') : 'Vehicle not specified'}</p>
                        <p className="mt-1 text-xs text-neutral-500">No vehicle photo provided</p>
                      </div>
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-x-4 gap-y-3 p-3 text-xs sm:grid-cols-3">
                    <div><p className="text-neutral-500">Vehicle</p><p className="mt-0.5 font-semibold text-neutral-900 dark:text-white">{c.vehicle ? [c.vehicle.year, c.vehicle.make, c.vehicle.model].filter(Boolean).join(' ') : '—'}</p></div>
                    <div><p className="text-neutral-500">Registration</p><p className="mt-0.5 font-semibold text-neutral-900 dark:text-white">{c.vehicle?.registrationNumber || '—'}</p></div>
                    <div><p className="text-neutral-500">Vehicle type</p><p className="mt-0.5 font-semibold text-neutral-900 dark:text-white">{c.vehicle?.type ? String(c.vehicle.type).replace(/_/g, ' ') : '—'}</p></div>
                    <div><p className="text-neutral-500">Colour</p><p className="mt-0.5 font-semibold text-neutral-900 dark:text-white">{c.vehicle?.color || '—'}</p></div>
                    <div><p className="text-neutral-500">Mileage</p><p className="mt-0.5 font-semibold text-neutral-900 dark:text-white">{c.vehicle?.mileage != null ? `${Number(c.vehicle.mileage).toLocaleString()} km` : '—'}</p></div>
                    <div><p className="text-neutral-500">Location</p><p className="mt-0.5 font-semibold text-neutral-900 dark:text-white">{[c.vehicle?.location, c.vehicle?.region].filter(Boolean).join(', ') || '—'}</p></div>
                  </div></div><div className="mt-4 pt-4 border-t border-neutral-200 dark:border-dark-border grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <div>
                    <p className="text-neutral-500">Total Amount</p>
                    <p className="text-neutral-900 dark:text-white mt-0.5">{fmtGHS(c.workAndPayTerms?.totalPayable ?? c.totalAmount)}</p></div>
                  </div>
                  <div>
                    <p className="text-neutral-500">Amount Paid</p>
                    <p className="text-neutral-900 dark:text-white mt-0.5">{fmtGHS(c.workAndPayTerms?.totalPaid ?? c.amountPaid)}</p>
                  </div>
                  <div>
                    <p className="text-neutral-500">Remaining</p>
                    <p className="text-neutral-900 dark:text-white mt-0.5">{fmtGHS(c.workAndPayTerms?.remainingBalance ?? ((c.totalAmount || 0) - (c.amountPaid || 0)))}</p>
                  </div>
                  <div>
                    <p className="text-neutral-500">Installment</p>
                    <p className="text-neutral-900 dark:text-white mt-0.5">{fmtGHS(c.workAndPayTerms?.installmentAmount ?? c.drivingOnTerms?.dailySalesAmount ?? c.installmentAmount)}</p>
                  </div>
                  <div>
                    <p className="text-neutral-500">Deposit</p>
                    <p className="text-neutral-900 dark:text-white mt-0.5">{fmtGHS(c.workAndPayTerms?.depositAmount ?? c.depositAmount)}</p>
                  </div>
                  <div>
                    <p className="text-neutral-500">Frequency</p>
                    <p className="text-neutral-900 dark:text-white mt-0.5">{c.workAndPayTerms?.installmentFrequency || c.drivingOnTerms?.paymentFrequency || c.paymentFrequency || '—'}</p>
                  </div>
                  {plainSummary(c) && (
                    <div className="col-span-2 rounded-lg bg-brand-50 dark:bg-dark-bg border border-brand-100 dark:border-dark-border px-3 py-2.5">
                      <p className="text-neutral-500">Your contract in plain words</p>
                      {c.vehicle?.imageUrls?.[0] && <img src={resolveVehiclePhoto(c.vehicle.imageUrls[0])} alt={`${c.vehicle.make || ''} ${c.vehicle.model || ''}`} className="w-full max-h-44 object-cover rounded-lg mt-2" />}
                      {(c.vehicle?.color || c.vehicle?.region || c.vehicle?.location) && (
                        <p className="text-neutral-800 dark:text-neutral-100 mt-2 leading-relaxed">
                          {[c.vehicle.color, c.vehicle.region, c.vehicle.location].filter(Boolean).join(' · ')}
                        </p>
                      )}
                      <p className="text-neutral-800 dark:text-neutral-100 mt-1 leading-relaxed">{plainSummary(c)}</p>
                      {(hasOffDays(c.terms?.offDays) || c.responsibilityMatrix?.maintenance) && (
                        <p className="text-neutral-800 dark:text-neutral-100 mt-1.5 leading-relaxed">
                          {hasOffDays(c.terms?.offDays) ? `Off days: ${c.terms.offDaysLabel || formatOffDays(c.terms.offDays)}. ` : ''}
                          {c.responsibilityMatrix?.maintenance ? `Maintenance: ${String(c.responsibilityMatrix.maintenance).toLowerCase()} takes care of it.` : ''}
                        </p>
                      )}
                      <p className="text-neutral-500 mt-1.5 leading-relaxed">+Motive records your agreement and processes your payments. It does not verify the vehicle — confirm the vehicle's documents in person before accepting.</p>
                    </div>
                  )}
                  {c.drivingOnTerms && (
                    <div className="col-span-2 rounded-lg bg-brand-50 dark:bg-dark-bg border border-brand-100 dark:border-dark-border px-3 py-2.5">
                      <p className="text-neutral-500">Your DriveOn contract in plain words</p>
                      {c.vehicle?.imageUrls?.[0] && <img src={resolveVehiclePhoto(c.vehicle.imageUrls[0])} alt={`${c.vehicle.make || ''} ${c.vehicle.model || ''}`} className="w-full max-h-44 object-cover rounded-lg mt-2" />}
                      {(c.vehicle?.color || c.vehicle?.region || c.vehicle?.location) && (
                        <p className="text-neutral-800 dark:text-neutral-100 mt-2 leading-relaxed">
                          {[c.vehicle.color, c.vehicle.region, c.vehicle.location].filter(Boolean).join(' · ')}
                        </p>
                      )}
                      <p className="text-neutral-800 dark:text-neutral-100 mt-1 leading-relaxed">
                        You bring {fmtGHS(c.drivingOnTerms.dailySalesAmount)} sales every day, paid {String(c.drivingOnTerms.paymentFrequency || 'DAILY').toLowerCase()}
                        {c.terms?.duration?.value ? `, for ${c.terms.duration.value} ${String(c.terms.duration.unit || '').toLowerCase()}` : ''}.
                        You keep everything you make above the sales amount. Grace period: {c.terms?.gracePeriodDays ?? 0} days from the day you confirm.
                        {hasOffDays(c.terms?.offDays) ? ` Off days: ${c.terms.offDaysLabel || formatOffDays(c.terms.offDays)}.` : ''}
                        {c.responsibilityMatrix?.maintenance ? ` Maintenance: ${String(c.responsibilityMatrix.maintenance).toLowerCase()} takes care of it.` : ''}
                        {c.responsibilityMatrix?.fuel ? ` Fuel: ${String(c.responsibilityMatrix.fuel).toLowerCase()} pays.` : ''}
                      </p>
                      <p className="text-neutral-500 mt-1.5 leading-relaxed">+Motive records your agreement and processes your payments. It does not verify the vehicle — confirm the vehicle's documents in person before accepting.</p>
                    </div>
                  )}
                  {c.requiresCode && (
                    <div className="col-span-2 border-t border-neutral-200 dark:border-dark-border pt-3" onClick={(e) => e.stopPropagation()}>
                      <p className="text-neutral-800 dark:text-neutral-100 font-semibold text-sm">Confirm this contract with your access code</p>
                      <p className="text-neutral-500 mt-1 leading-relaxed">The owner approved you for this vehicle and sent a unique code in your chat. Paste it here to confirm and sign your contract. This code box only appears for approved drivers who have been issued a code.</p>
                      <label className="flex items-start gap-2 mt-3 text-neutral-700 dark:text-neutral-200 leading-relaxed cursor-pointer">
                        <input
                          type="checkbox"
                          className="mt-0.5"
                          checked={!!seenVehicle[c.id]}
                          onChange={(e) => setSeenVehicle((p) => ({ ...p, [c.id]: e.target.checked }))}
                        />
                        <span>I have physically seen this vehicle, and I have confirmed its documents are in the owner's name.</span>
                      </label>
                      <div className="flex items-center gap-2 mt-3 flex-wrap">
                        <input
                          className="input !w-44 text-center tracking-[0.35em] font-bold"
                          placeholder="••••••"
                          inputMode="numeric"
                          maxLength={6}
                          value={codeInputs[c.id] || ''}
                          onChange={(e) => setCodeInputs((p) => ({ ...p, [c.id]: e.target.value.replace(/[^0-9]/g, '') }))}
                        />
                        <button onClick={() => confirmWithCode(c.id)} disabled={confirming === c.id || !seenVehicle[c.id]} className="btn-primary text-xs disabled:opacity-40">{confirming === c.id ? 'Confirming…' : 'Confirm contract'}</button>
                      </div>
                      {codeMsg && <p className="mt-2 text-neutral-600 dark:text-neutral-300">{codeMsg}</p>}
                    </div>
                  )}
                </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </>
  );
}
