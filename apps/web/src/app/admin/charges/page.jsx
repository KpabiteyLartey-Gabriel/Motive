'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/useAuth';
import { adminApi } from '@/lib/api';

// Charges: what it costs to create a Driver or Owner account. Changes
// apply to the next account creation started — orders already in
// progress keep the amount they started with.
export default function AdminChargesPage() {
  const { user } = useAuth({ requiredRoles: ['ADMIN', 'SUPER_ADMIN'] });
  const [charges, setCharges] = useState([]);
  const [drafts, setDrafts] = useState({});
  const [fetching, setFetching] = useState(true);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const load = () => {
    adminApi.getCharges()
      .then((res) => {
        const list = (res.data?.data || res.data)?.charges || [];
        setCharges(list);
        setDrafts(Object.fromEntries(list.map((c) => [c.kind, String(c.amountGhs)])));
      })
      .catch(() => setError('Could not load charges.'))
      .finally(() => setFetching(false));
  };

  useEffect(() => { if (user) load(); }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = async (kind) => {
    const amount = Number(drafts[kind]);
    if (!Number.isFinite(amount) || amount <= 0) { setError('Enter a charge above GHS 0.'); return; }
    setBusy(kind); setError(''); setSuccess('');
    try {
      const res = await adminApi.updateCharge(kind, amount);
      const list = (res.data?.data || res.data)?.charges || [];
      setCharges(list);
      setDrafts(Object.fromEntries(list.map((c) => [c.kind, String(c.amountGhs)])));
      setSuccess(`${kind === 'DRIVER' ? 'Driver' : 'Owner'} account creation charge is now GHS ${amount}.`);
    } catch (e) {
      setError(e.response?.data?.message || 'Could not save the charge.');
    } finally { setBusy(''); }
  };

  return (
    <>
      <div className="mb-8">
        <h2 className="text-xl font-semibold tracking-tight text-ink dark:text-white">Charges</h2>
        <p className="mt-1 text-sm text-steel dark:text-neutral-400">
          One-time charges a user pays to create an account. A creation already in progress keeps the amount it started with.
        </p>
      </div>

      {error && <div role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">{error}</div>}
      {success && <div className="mb-4 rounded-xl border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm font-medium text-green-700 dark:text-green-400">{success}</div>}

      {fetching ? (
        <div className="space-y-3">{[1, 2].map((i) => <div key={i} className="skeleton h-28" />)}</div>
      ) : (
        <div className="grid gap-5 md:grid-cols-2">
          {charges.map((c) => (
            <section key={c.kind} className="rounded-card border border-line bg-white p-6 shadow-card dark:border-dark-border dark:bg-dark-card dark:shadow-none">
              <h3 className="text-base font-semibold text-ink dark:text-white">{c.label}</h3>
              <p className="mt-1 text-sm text-steel dark:text-neutral-400">
                Paid once by the user after they confirm their interest with the code we send them. The account is created only when payment is confirmed.
              </p>
              <label htmlFor={`charge-${c.kind}`} className="label mt-5">Charge (GHS)</label>
              <div className="flex gap-3">
                <input
                  id={`charge-${c.kind}`}
                  type="number"
                  min="1"
                  step="1"
                  className="input"
                  value={drafts[c.kind] ?? ''}
                  onChange={(e) => setDrafts((d) => ({ ...d, [c.kind]: e.target.value }))}
                />
                <button
                  type="button"
                  disabled={busy === c.kind || String(c.amountGhs) === String(drafts[c.kind] ?? '')}
                  onClick={() => save(c.kind)}
                  className="btn-primary shrink-0 disabled:opacity-50"
                >
                  {busy === c.kind ? 'Saving…' : 'Save'}
                </button>
              </div>
              <p className="mt-2 text-xs text-steel dark:text-neutral-500">Currently GHS {Number(c.amountGhs).toLocaleString('en-GH')} per new {c.kind === 'DRIVER' ? 'Driver' : 'Owner'} account.</p>
            </section>
          ))}
        </div>
      )}
    </>
  );
}
