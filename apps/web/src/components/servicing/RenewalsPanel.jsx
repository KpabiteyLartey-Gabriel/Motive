'use client';

import { useEffect, useState } from 'react';
import { vehiclesApi } from '@/lib/api';

// Servicing renewal tracker — insurance & roadworthiness expiry for every
// vehicle linked to the signed-in person (owned, driven, or under an active
// contract with them). The owner edits the dates — and so does the driver
// on a Work & Pay contract for that vehicle. Everyone else sees the status.

const STATUS_STYLE = {
  EXPIRED: 'bg-red-500/15 text-red-600 dark:text-red-400',
  DUE_SOON: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
  VALID: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
  NOT_SET: 'bg-neutral-500/10 text-neutral-500 dark:text-neutral-400',
};

function fmtDate(d) {
  if (!d) return 'Not set';
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function statusText(r) {
  if (r.status === 'EXPIRED') return `Expired ${Math.abs(r.daysLeft)}d ago — renew now`;
  if (r.status === 'DUE_SOON') return r.daysLeft === 0 ? 'Expires today' : `${r.daysLeft} days left`;
  if (r.status === 'VALID') return `${r.daysLeft} days left`;
  return 'No date set';
}

export default function RenewalsPanel({ editHref = null }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [drafts, setDrafts] = useState({}); // `${vehicleId}:${key}` → yyyy-mm-dd
  const [saving, setSaving] = useState('');

  const load = () => vehiclesApi.myRenewals()
    .then((r) => setData(r.data?.data || r.data))
    .catch((e) => setError(e?.response?.data?.message || 'Could not load renewal dates.'));
  useEffect(() => { load(); }, []);

  const save = async (vehicleId, key, field) => {
    const draftKey = `${vehicleId}:${key}`;
    const value = drafts[draftKey];
    setSaving(draftKey);
    try {
      const res = await vehiclesApi.updateRenewals(vehicleId, { [field]: value || null });
      const updated = res.data?.data || res.data;
      setData((prev) => prev && ({
        ...prev,
        vehicles: prev.vehicles.map((v) => (v.vehicle.id === vehicleId ? updated : v)),
      }));
      setDrafts((prev) => { const next = { ...prev }; delete next[draftKey]; return next; });
    } catch (e) {
      setError(e?.response?.data?.message || 'Could not save the date.');
    } finally { setSaving(''); }
  };

  return (
    <section className="border border-neutral-200 dark:border-white/10 bg-white dark:bg-transparent rounded-2xl shadow-sm dark:shadow-none p-5 mb-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="font-semibold text-neutral-900 dark:text-chalk">Renewals — insurance & roadworthiness</h2>
          <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
            The dates everyone forgets. Tracked for every vehicle linked to you — the owner is
            notified in-app and by email before each one runs out.
          </p>
        </div>
        {data && (data.counts.expired > 0 || data.counts.dueSoon > 0) && (
          <span className="text-xs px-3 py-1.5 rounded-full bg-red-500/15 text-red-600 dark:text-red-300">
            {data.counts.expired} expired · {data.counts.dueSoon} due soon
          </span>
        )}
      </div>

      {error && <p className="text-sm text-red-600 dark:text-red-400 mt-3">{error}</p>}
      {!data && !error && <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-4">Loading renewals…</p>}
      {data && data.vehicles.length === 0 && (
        <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-4">
          No vehicles are linked to you yet. Renewals appear here for vehicles you own, drive,
          or hold an active contract on.
        </p>
      )}

      <div className="grid gap-4 md:grid-cols-2 mt-4">
        {data?.vehicles.map(({ vehicle, renewals, canEdit }) => (
          <article key={vehicle.id} className="border border-neutral-200 dark:border-white/10 bg-white dark:bg-transparent rounded-xl overflow-hidden">
            <div className="flex items-center gap-3 p-3 border-b border-neutral-200 dark:border-white/10">
              {vehicle.imageUrl
                ? <img src={vehicle.imageUrl} alt="" className="w-14 h-11 object-cover rounded-lg" />
                : <div className="w-14 h-11 rounded-lg bg-neutral-500/10 flex items-center justify-center text-lg">🚗</div>}
              <div className="min-w-0">
                <p className="font-medium text-neutral-900 dark:text-chalk truncate">{vehicle.year} {vehicle.make} {vehicle.model}</p>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">{vehicle.registrationNumber} · {vehicle.type}</p>
              </div>
            </div>
            {!canEdit && (
              <p className="px-3 pt-2 text-[11px] text-neutral-500 dark:text-neutral-400">Read-only — renewal dates are set by the owner, or by the driver on a Work & Pay contract.</p>
            )}
            <div className="divide-y divide-neutral-100 dark:divide-white/5">
              {renewals.map((r) => {
                const draftKey = `${vehicle.id}:${r.key}`;
                const current = r.expiryDate ? String(r.expiryDate).slice(0, 10) : '';
                const draft = drafts[draftKey] ?? current;
                const dirty = draft !== current;
                return (
                  <div key={r.key} className="p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium text-neutral-900 dark:text-chalk">{r.label}</span>
                      <span className={`text-[11px] px-2 py-1 rounded-full ${STATUS_STYLE[r.status]}`}>{statusText(r)}</span>
                    </div>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">Expires {fmtDate(r.expiryDate)}</p>
                    {canEdit && (
                      <div className="flex items-center gap-2 mt-2">
                        <input
                          type="date"
                          value={draft}
                          onChange={(e) => setDrafts((prev) => ({ ...prev, [draftKey]: e.target.value }))}
                          className="bg-white dark:bg-white/5 border border-neutral-300 dark:border-white/10 rounded-lg px-2 py-1.5 text-sm text-neutral-900 dark:text-chalk [color-scheme:light] dark:[color-scheme:dark]"
                        />
                        {dirty && (
                          <button
                            onClick={() => save(vehicle.id, r.key, r.field)}
                            disabled={saving === draftKey}
                            className="text-xs px-3 py-1.5 rounded-lg bg-emerald-500 text-black font-medium disabled:opacity-60"
                          >
                            {saving === draftKey ? 'Saving…' : 'Save'}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
