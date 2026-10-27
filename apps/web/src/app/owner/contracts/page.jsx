'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/useAuth';
import { SectionHeader, EmptyState, StatusBadge } from '@/components/dashboard/DashboardUI';
import { contractsApi } from '@/lib/api';
import OffDaysPicker from '@/components/contracts/OffDaysPicker';
import { emptyOffDays, formatOffDays, hasOffDays } from '@/lib/offDays';

const TYPE_LABEL = { WORK_AND_PAY: 'Work & Pay', DRIVING_ON: 'DriveOn', RENTAL: 'Rental' };
const FREQ_LABEL = { DAILY: 'day', WEEKLY: 'week', MONTHLY: 'month', BIWEEKLY: '2 weeks' };

function fmtGHS(n) {
  if (n == null) return '—';
  return `GHS ${Number(n).toLocaleString('en-GH')}`;
}

function addPeriods(from, frequency, periods) {
  const d = new Date(from);
  if (frequency === 'DAILY') d.setDate(d.getDate() + periods);
  else if (frequency === 'MONTHLY') d.setMonth(d.getMonth() + periods);
  else d.setDate(d.getDate() + periods * 7);
  return d;
}

export function termsSummary(c) {
  const agreed = c.terms || {};
  const off = hasOffDays(agreed.offDays) ? ` · Off days: ${agreed.offDaysLabel || formatOffDays(agreed.offDays)}` : '';
  if (c.type === 'WORK_AND_PAY' && c.workAndPayTerms) {
    const w = c.workAndPayTerms;
    const finish = addPeriods(new Date(), w.installmentFrequency, Number(w.totalInstallments) || 0);
    return `${fmtGHS(w.depositAmount)} deposit, then ${fmtGHS(w.installmentAmount)} every ${FREQ_LABEL[w.installmentFrequency] || 'week'} × ${w.totalInstallments} — ${fmtGHS(w.totalPayable)} total. Grace ${w.gracePeriodDays ?? 0} days${off}. If signed today, the driver finishes around ${finish.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}.`;
  }
  if (c.type === 'DRIVING_ON' && c.drivingOnTerms) {
    const d = c.drivingOnTerms;
    const dur = agreed.duration?.value ? `${agreed.duration.value} ${String(agreed.duration.unit || '').toLowerCase()}` : 'open-ended';
    return `${fmtGHS(d.dailySalesAmount)} sales, paid ${String(d.paymentFrequency || 'DAILY').toLowerCase()} · Runs ${dur} · Grace ${agreed.gracePeriodDays ?? 0} days${off}. The driver sets the renewal date when signing.`;
  }
  if (c.type === 'RENTAL' && c.rentalTerms) {
    const r = c.rentalTerms;
    const dur = agreed.duration?.value ? `${agreed.duration.value} ${String(agreed.duration.unit || '').toLowerCase()}` : 'open-ended';
    return `${r.salaryAmount != null ? `${fmtGHS(r.salaryAmount)} ` : ''}paid ${String(r.paymentFrequency || 'WEEKLY').toLowerCase()} · Runs ${dur} · Grace ${agreed.gracePeriodDays ?? 0} days${off}.`;
  }
  return c.description || 'No terms set.';
}

export function contractState(c) {
  if (c.status === 'ACTIVE') return { label: 'Active contract', tone: 'ACTIVE' };
  const driverParty = (c.parties || []).find((p) => p.role === 'DRIVER');
  if (driverParty && !driverParty.signedAt) return { label: 'Awarded — waiting for the driver to sign', tone: 'PENDING' };
  if (driverParty?.signedAt) return { label: 'Signed', tone: 'ACTIVE' };
  if (c.vehicleId) return { label: 'Attached to a vehicle', tone: 'PENDING' };
  return { label: 'Template — not attached', tone: 'DRAFT' };
}

const EMPTY = {
  type: 'WORK_AND_PAY', title: '', description: '',
  totalPayable: '', depositAmount: '', installmentAmount: '', installmentFrequency: 'WEEKLY', totalInstallments: '',
  dailySalesAmount: '', paymentFrequency: 'DAILY', rentalAmount: '', rentalFrequency: 'WEEKLY',
  durationValue: '', durationUnit: 'MONTHS', gracePeriodDays: '3', offDays: emptyOffDays(),
  driverPaysFuel: true, driverPaysMaintenance: false, driverPaysInsurance: false,
};

// Owner Contracts: reusable contract templates. The owner creates as many
// as they like (Work & Pay, DriveOn, Rental), each with a caption, then
// attaches one to a vehicle from My Vehicles and awards it to a driver.
export default function OwnerContractsPage() {
  const { user } = useAuth({ requiredRoles: ['OWNER'] });
  const [contracts, setContracts] = useState([]);
  const [fetching, setFetching] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    setFetching(true);
    try {
      const res = await contractsApi.list({ limit: 100 });
      setContracts(res.data?.data?.contracts || []);
    } catch { setError('Could not load your contracts.'); }
    finally { setFetching(false); }
  }, []);

  useEffect(() => { if (user) load(); }, [user, load]);

  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  // Work & Pay: suggest the installment count from the money fields.
  useEffect(() => {
    if (form.type !== 'WORK_AND_PAY') return;
    const total = Number(form.totalPayable), dep = Number(form.depositAmount), inst = Number(form.installmentAmount);
    if (total > 0 && inst > 0 && total > dep) {
      setForm((p) => ({ ...p, totalInstallments: String(Math.ceil((total - dep) / inst)) }));
    }
  }, [form.type, form.totalPayable, form.depositAmount, form.installmentAmount]);

  const create = async () => {
    setError(''); setNotice('');
    if (!form.title.trim()) { setError('Give the contract a caption — that is the name you and the driver will see in lists.'); return; }
    const payload = {
      type: form.type,
      title: form.title.trim(),
      description: form.description.trim() || undefined,
      terms: {
        offDays: hasOffDays(form.offDays) ? form.offDays : undefined,
        offDaysLabel: hasOffDays(form.offDays) ? formatOffDays(form.offDays) : undefined,
        gracePeriodDays: Number(form.gracePeriodDays) || 0,
        ...(form.type !== 'WORK_AND_PAY' && form.durationValue
          ? { duration: { value: Number(form.durationValue), unit: form.durationUnit } }
          : {}),
      },
    };
    if (form.type === 'WORK_AND_PAY') {
      const total = Number(form.totalPayable), dep = Number(form.depositAmount), inst = Number(form.installmentAmount), count = Number(form.totalInstallments);
      if (!(total > 0 && inst > 0 && count > 0)) { setError('Enter the total the driver pays, the installment amount, and how many installments.'); return; }
      payload.workAndPayTerms = {
        depositAmount: dep || 0, totalPayable: total, installmentAmount: inst,
        installmentFrequency: form.installmentFrequency, totalInstallments: count,
        gracePeriodDays: Number(form.gracePeriodDays) || 0,
      };
    } else if (form.type === 'DRIVING_ON') {
      if (!(Number(form.dailySalesAmount) > 0)) { setError('Enter the daily sales amount the driver brings.'); return; }
      payload.drivingOnTerms = {
        dailySalesAmount: Number(form.dailySalesAmount), paymentFrequency: form.paymentFrequency,
        driverPaysFuel: form.driverPaysFuel, driverPaysMaintenance: form.driverPaysMaintenance, driverPaysInsurance: form.driverPaysInsurance,
      };
    } else {
      if (!(Number(form.rentalAmount) > 0)) { setError('Enter the rental amount.'); return; }
      payload.rentalTerms = {
        salaryAmount: Number(form.rentalAmount), paymentFrequency: form.rentalFrequency,
        driverPaysFuel: form.driverPaysFuel, driverPaysMaintenance: form.driverPaysMaintenance, driverPaysInsurance: form.driverPaysInsurance,
      };
    }
    setSaving(true);
    try {
      await contractsApi.create(payload);
      setForm(EMPTY);
      setShowForm(false);
      setNotice('Contract created. Attach it to a vehicle in My Vehicles, then award it to a driver.');
      load();
    } catch (e) {
      const m = e.response?.data?.message || 'Could not create the contract.';
      setError(Array.isArray(m) ? m.join(' ') : m);
    } finally { setSaving(false); }
  };

  return (
    <>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-ink dark:text-white">Your contracts</h2>
          <p className="mt-0.5 max-w-xl text-sm text-steel dark:text-neutral-400">
            Create contracts with your financial terms — total, how it is paid, grace period and off days. Attach one to a vehicle, then award it to a driver. The terms transfer to the driver&apos;s account when they sign.
          </p>
        </div>
        <button type="button" onClick={() => setShowForm((v) => !v)} className="btn-primary text-sm">{showForm ? 'Close' : '+ New contract'}</button>
      </div>

      {error && <div role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">{error}</div>}
      {notice && <div className="mb-4 rounded-xl border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm font-medium text-green-700 dark:text-green-400">{notice}</div>}

      {showForm && (
        <section className="mb-6 rounded-card border border-line bg-white p-6 shadow-card dark:border-dark-border dark:bg-dark-card dark:shadow-none">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="c-type" className="label">Contract type</label>
              <select id="c-type" className="input" value={form.type} onChange={(e) => set('type', e.target.value)}>
                <option value="WORK_AND_PAY">Work &amp; Pay</option>
                <option value="DRIVING_ON">DriveOn</option>
                <option value="RENTAL">Rental</option>
              </select>
            </div>
            <div>
              <label htmlFor="c-title" className="label">Caption — what this contract is called</label>
              <input id="c-title" className="input" placeholder="e.g. Hiace Work & Pay — Accra route" value={form.title} onChange={(e) => set('title', e.target.value)} />
            </div>
          </div>
          <div className="mt-4">
            <label htmlFor="c-desc" className="label">Description (optional)</label>
            <input id="c-desc" className="input" placeholder="Anything you want the driver to know about this deal" value={form.description} onChange={(e) => set('description', e.target.value)} />
          </div>

          {form.type === 'WORK_AND_PAY' && (
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div><label htmlFor="w-total" className="label">Total the driver pays (GHS)</label><input id="w-total" type="number" min="0" className="input" value={form.totalPayable} onChange={(e) => set('totalPayable', e.target.value)} /></div>
              <div><label htmlFor="w-dep" className="label">Deposit upfront (GHS)</label><input id="w-dep" type="number" min="0" className="input" value={form.depositAmount} onChange={(e) => set('depositAmount', e.target.value)} /></div>
              <div><label htmlFor="w-inst" className="label">Each installment (GHS)</label><input id="w-inst" type="number" min="0" className="input" value={form.installmentAmount} onChange={(e) => set('installmentAmount', e.target.value)} /></div>
              <div>
                <label htmlFor="w-freq" className="label">How often he pays</label>
                <select id="w-freq" className="input" value={form.installmentFrequency} onChange={(e) => set('installmentFrequency', e.target.value)}>
                  <option value="DAILY">Daily</option><option value="WEEKLY">Weekly</option><option value="MONTHLY">Monthly</option>
                </select>
              </div>
              <div><label htmlFor="w-count" className="label">Number of installments (sets the finish date)</label><input id="w-count" type="number" min="1" className="input" value={form.totalInstallments} onChange={(e) => set('totalInstallments', e.target.value)} /></div>
            </div>
          )}

          {form.type === 'DRIVING_ON' && (
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div><label htmlFor="d-sales" className="label">Daily sales the driver brings (GHS)</label><input id="d-sales" type="number" min="0" className="input" value={form.dailySalesAmount} onChange={(e) => set('dailySalesAmount', e.target.value)} /></div>
              <div>
                <label htmlFor="d-freq" className="label">How often he pays it over</label>
                <select id="d-freq" className="input" value={form.paymentFrequency} onChange={(e) => set('paymentFrequency', e.target.value)}>
                  <option value="DAILY">Daily</option><option value="WEEKLY">Weekly</option>
                </select>
              </div>
            </div>
          )}

          {form.type === 'RENTAL' && (
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div><label htmlFor="r-amt" className="label">Rental amount (GHS)</label><input id="r-amt" type="number" min="0" className="input" value={form.rentalAmount} onChange={(e) => set('rentalAmount', e.target.value)} /></div>
              <div>
                <label htmlFor="r-freq" className="label">How often he pays</label>
                <select id="r-freq" className="input" value={form.rentalFrequency} onChange={(e) => set('rentalFrequency', e.target.value)}>
                  <option value="DAILY">Daily</option><option value="WEEKLY">Weekly</option><option value="MONTHLY">Monthly</option>
                </select>
              </div>
            </div>
          )}

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div><label htmlFor="c-grace" className="label">Grace period (days)</label><input id="c-grace" type="number" min="0" className="input" value={form.gracePeriodDays} onChange={(e) => set('gracePeriodDays', e.target.value)} /></div>
            <div className="sm:col-span-2"><OffDaysPicker value={form.offDays} onChange={(v) => set('offDays', v)} /></div>
            {form.type !== 'WORK_AND_PAY' && (
              <>
                <div><label htmlFor="c-dur" className="label">How long it runs</label><input id="c-dur" type="number" min="1" className="input" placeholder="e.g. 6" value={form.durationValue} onChange={(e) => set('durationValue', e.target.value)} /></div>
                <div>
                  <label htmlFor="c-dur-unit" className="label">Period</label>
                  <select id="c-dur-unit" className="input" value={form.durationUnit} onChange={(e) => set('durationUnit', e.target.value)}>
                    <option value="DAYS">Days</option><option value="WEEKS">Weeks</option><option value="MONTHS">Months</option><option value="YEARS">Years</option>
                  </select>
                </div>
              </>
            )}
          </div>

          {form.type !== 'WORK_AND_PAY' && (
            <div className="mt-4 flex flex-wrap gap-5 text-sm text-steel dark:text-neutral-300">
              <label className="flex items-center gap-2"><input type="checkbox" checked={form.driverPaysFuel} onChange={(e) => set('driverPaysFuel', e.target.checked)} /> Driver pays fuel</label>
              <label className="flex items-center gap-2"><input type="checkbox" checked={form.driverPaysMaintenance} onChange={(e) => set('driverPaysMaintenance', e.target.checked)} /> Driver pays maintenance</label>
              <label className="flex items-center gap-2"><input type="checkbox" checked={form.driverPaysInsurance} onChange={(e) => set('driverPaysInsurance', e.target.checked)} /> Driver pays insurance</label>
            </div>
          )}

          <button type="button" disabled={saving} onClick={create} className="btn-primary mt-6 disabled:opacity-50">{saving ? 'Creating…' : 'Create contract'}</button>
        </section>
      )}

      <SectionHeader title="Created contracts" />
      {fetching ? (
        <div className="space-y-3">{[1, 2].map((i) => <div key={i} className="skeleton h-28" />)}</div>
      ) : contracts.length === 0 ? (
        <EmptyState icon="contract" title="No contracts yet" description="Create your first contract above. You can create as many as you like and attach each to a vehicle when you are ready." />
      ) : (
        <div className="grid gap-5 md:grid-cols-2">
          {contracts.map((c) => {
            const state = contractState(c);
            return (
              <article key={c.id} className="rounded-card border border-line bg-white p-5 shadow-card dark:border-dark-border dark:bg-dark-card dark:shadow-none">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-[15px] font-semibold text-ink dark:text-white">{c.title || 'Untitled contract'}</h3>
                    <p className="mt-0.5 text-xs text-steel dark:text-neutral-400">{c.contractNumber} · {TYPE_LABEL[c.type] || c.type}</p>
                  </div>
                  <StatusBadge status={state.tone === 'ACTIVE' ? 'ACTIVE' : state.tone === 'PENDING' ? 'PENDING' : 'DRAFT'} />
                </div>
                <p className="mt-3 text-sm leading-relaxed text-steel dark:text-neutral-300">{termsSummary(c)}</p>
                <p className="mt-3 text-xs font-medium text-steel dark:text-neutral-400">{state.label}</p>
                {c.vehicle ? (
                  <p className="mt-1 text-xs text-steel dark:text-neutral-400">Vehicle: {c.vehicle.make} {c.vehicle.model} ({c.vehicle.registrationNumber})</p>
                ) : (
                  <Link href="/owner/vehicles" className="mt-2 inline-block text-sm font-semibold text-brand-700 hover:underline dark:text-brand-300">Attach to a vehicle →</Link>
                )}
              </article>
            );
          })}
        </div>
      )}
    </>
  );
}
