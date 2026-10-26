'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/lib/useAuth';
import { StatusBadge } from '@/components/dashboard/DashboardUI';
import { adminApi, resolveVehiclePhoto } from '@/lib/api';

const FILTERS = [
  { value: 'all', label: 'All users' },
  { value: 'PENDING_REVIEW', label: 'Pending review' },
  { value: 'NEEDS_LICENCE', label: 'Licence in review' },
  { value: 'NOT_SUBMITTED', label: 'No ID submitted' },
  { value: 'VERIFIED', label: 'Fully verified' },
];

const PAGE_SIZE = 10;

const fmt = (d) => (d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');

function StatPill({ label, value, tone }) {
  const tones = {
    amber: 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400',
    blue: 'border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-400',
    green: 'border-green-500/30 bg-green-500/10 text-green-700 dark:text-green-400',
  };
  return (
    <div className={`rounded-xl border px-3.5 py-2 ${tones[tone] || tones.amber}`}>
      <p className="text-base font-bold leading-none">{value ?? '—'}</p>
      <p className="mt-1 text-[11px] font-medium leading-none">{label}</p>
    </div>
  );
}

function DocChip({ label, status }) {
  const map = {
    VERIFIED: 'bg-green-500/10 text-green-600 border-green-500/30',
    PENDING_REVIEW: 'bg-amber-500/10 text-amber-600 border-amber-500/30',
    REJECTED: 'bg-red-500/10 text-red-600 border-red-500/30',
    NOT_SUBMITTED: 'bg-neutral-500/10 text-neutral-500 border-neutral-500/30',
  };
  const text = { VERIFIED: 'Verified', PENDING_REVIEW: 'In review', REJECTED: 'Resubmit asked', NOT_SUBMITTED: 'Not submitted' }[status] || status;
  return <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${map[status] || map.NOT_SUBMITTED}`}>{label}: {text}</span>;
}

function imagesOf(row) {
  if (!row) return [];
  const imgs = [];
  if (row.identityVerification?.idFrontUrl) imgs.push({ label: 'Ghana Card — front', url: row.identityVerification.idFrontUrl });
  if (row.identityVerification?.idBackUrl) imgs.push({ label: 'Ghana Card — back', url: row.identityVerification.idBackUrl });
  if (row.identityVerification?.livenessSelfieUrl) imgs.push({
    label: 'Live face capture',
    url: row.identityVerification.livenessSelfieUrl,
    badge: row.identityVerification.livenessPassed ? 'Live check passed' : 'Manual review',
  });
  if (row.licenceVerification?.licenceFrontUrl) imgs.push({ label: 'Licence — front', url: row.licenceVerification.licenceFrontUrl });
  if (row.licenceVerification?.licenceBackUrl) imgs.push({ label: 'Licence — back', url: row.licenceVerification.licenceBackUrl });
  return imgs;
}

export default function AdminVerificationsPage() {
  const { user } = useAuth({ requiredRoles: ['SUPER_ADMIN'] });
  const [rows, setRows] = useState([]);
  const [counts, setCounts] = useState(null);
  const [fetching, setFetching] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const [preview, setPreview] = useState(null);
  const [page, setPage] = useState(1);
  const [resubmitTarget, setResubmitTarget] = useState('ALL');
  const [resubmitReason, setResubmitReason] = useState('');

  const load = useCallback(async () => {
    setFetching(true);
    try {
      const res = await adminApi.listVerifications({ search: search || undefined, status: filter !== 'all' ? filter : undefined });
      const data = res.data?.data || {};
      setRows(data.verifications || []);
      setCounts(data.counts || null);
      setPage(1);
    } catch (e) {
      const msg = e.response?.data?.message;
      setError(Array.isArray(msg) ? msg.join(' ') : msg || e.message || 'Failed to load verifications.');
    } finally {
      setFetching(false);
    }
  }, [search, filter]);

  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [load]);

  const selected = useMemo(
    () => rows.find((r) => r.userId === selectedId) || rows[0] || null,
    [rows, selectedId],
  );

  const selectedImages = useMemo(() => imagesOf(selected), [selected]);

  useEffect(() => {
    if (!selected) { setPreview(null); return; }
    const imgs = imagesOf(selected);
    setPreview((p) => {
      if (p && imgs.some((i) => i.url === p.url)) return p;
      const live = imgs.find((i) => i.label === 'Live face capture');
      return live || imgs[0] || null;
    });
  }, [selected]);

  const pageRows = useMemo(
    () => rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [rows, page],
  );
  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));

  const act = async (row, target, verified) => {
    const key = `${row.userId}-${target}-${verified}`;
    setBusy(key);
    setMessage('');
    setError('');
    try {
      const res = await adminApi.manualVerify(row.userId, target, verified);
      const updated = res.data?.data;
      setRows((prev) => prev.map((r) => (r.userId === row.userId && updated ? { ...r, ...updated } : r)));
      setMessage(verified ? `${row.firstName} ${row.lastName} — ${target === 'ALL' ? 'fully verified.' : `${target.toLowerCase()} verified.`}` : `${row.firstName} ${row.lastName} — verification removed.`);
      load();
    } catch (e) {
      setError(e.response?.data?.message || 'Verification failed.');
    } finally {
      setBusy('');
    }
  };

  const requestResubmit = async (row) => {
    if (!resubmitReason.trim()) { setError('Write what is wrong first — the user will see that reason.'); return; }
    const key = `${row.userId}-RESUBMIT`;
    setBusy(key);
    setMessage('');
    setError('');
    try {
      const res = await adminApi.requestResubmission(row.userId, resubmitTarget, resubmitReason.trim());
      const updated = res.data?.data;
      if (updated?.userId) setRows((prev) => prev.map((r) => (r.userId === row.userId ? { ...r, ...updated } : r)));
      setMessage(`Resubmission requested from ${row.firstName} ${row.lastName}. They have been emailed and notified in the app with your reason.`);
      setResubmitReason('');
      load();
    } catch (e) {
      setError(e.response?.data?.message || 'Could not request resubmission.');
    } finally {
      setBusy('');
    }
  };

  const btn = 'px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors disabled:opacity-40';

  return (
    <>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-medium text-graphite dark:text-paper mb-1" style={{ letterSpacing: '-0.02em' }}>Verification queue</h2>
          <p className="max-w-xl text-sm text-steel dark:text-neutral-500">Pick a person on the left, compare their live face to the Ghana Card in the workspace, then verify.</p>
        </div>
        <div className="flex gap-2">
          <StatPill label="Waiting on National ID" value={counts?.pendingIdentity} tone="amber" />
          <StatPill label="Waiting on licence" value={counts?.pendingLicence} tone="blue" />
          <StatPill label="Fully verified" value={counts?.verified} tone="green" />
        </div>
      </div>

      {message && <div className="mb-4 rounded-lg border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm text-green-700 dark:text-green-400">{message}</div>}
      {error && <div className="mb-4 rounded-lg border border-danger/20 bg-danger/10 px-4 py-3 text-sm text-danger">{error}</div>}

      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <input type="text" placeholder="Search name, email, phone, Ghana Card or licence…" className="input flex-1" value={search} onChange={(e) => setSearch(e.target.value)} />
        <select className="input w-56" value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="Filter verifications">
          {FILTERS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
        </select>
      </div>

      <div className="flex items-start gap-5">
        {/* Compact queue */}
        <div className="min-w-0 flex-1">
          <div className="overflow-hidden rounded-card border border-neutral-200 dark:border-dark-border">
            {fetching ? <div className="py-16 text-center text-sm text-fog bg-neutral-50 dark:bg-dark-card">Loading…</div>
              : rows.length === 0 ? <div className="py-16 text-center text-sm text-fog bg-neutral-50 dark:bg-dark-card">No users match this filter.</div>
              : pageRows.map((row) => {
                const isSelected = selected?.userId === row.userId;
                const docs = imagesOf(row).length;
                return (
                  <button
                    key={row.userId}
                    type="button"
                    onClick={() => setSelectedId(row.userId)}
                    className={`flex w-full items-center gap-3 border-b border-neutral-200 px-4 py-3 text-left transition-colors last:border-b-0 dark:border-dark-border ${isSelected ? 'bg-brand-600/10 dark:bg-brand-600/15' : 'bg-neutral-50 hover:bg-neutral-100 dark:bg-dark-card dark:hover:bg-dark-border/40'}`}
                  >
                    <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold ${isSelected ? 'bg-brand-600 text-white' : 'bg-neutral-200 text-steel dark:bg-dark-border dark:text-neutral-300'}`}>
                      {(row.firstName?.[0] || '?')}{(row.lastName?.[0] || '')}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-neutral-900 dark:text-paper">
                        {row.firstName} {row.lastName}
                        <span className="ml-1.5 text-[11px] font-medium text-steel dark:text-neutral-400">{row.accountType || 'No account type'}{row.authProvider === 'GOOGLE' ? ' · Google' : ''}</span>
                      </span>
                      <span className="mt-1 flex flex-wrap items-center gap-1.5">
                        <DocChip label="ID" status={row.identityStatus} />
                        {row.accountType === 'DRIVER' && <DocChip label="Licence" status={row.licenceStatus} />}
                        {docs > 0 && <span className="text-[11px] text-neutral-400">{docs} image{docs === 1 ? '' : 's'} submitted</span>}
                      </span>
                    </span>
                    <span className="shrink-0 text-right">
                      <StatusBadge status={row.fullyVerified ? 'VERIFIED' : row.profileStatus || row.accountStatus} />
                      <span className="mt-1 block text-[11px] text-neutral-400">{fmt(row.identityVerification?.submittedAt || row.createdAt)}</span>
                    </span>
                  </button>
                );
              })}
          </div>
          {rows.length > PAGE_SIZE && (
            <div className="mt-3 flex items-center justify-between text-xs text-steel dark:text-neutral-400">
              <span>Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, rows.length)} of {rows.length}</span>
              <span className="flex gap-2">
                <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className={`${btn} border-neutral-300 dark:border-dark-border`}>← Previous</button>
                <button type="button" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} className={`${btn} border-neutral-300 dark:border-dark-border`}>Next →</button>
              </span>
            </div>
          )}
        </div>

        {/* Review workspace */}
        <aside className="sticky top-4 hidden w-[400px] shrink-0 lg:block" aria-label="Review workspace">
          {selected ? (
            <div className="rounded-card border border-neutral-200 bg-neutral-50 dark:border-dark-border dark:bg-dark-card">
              <div className="border-b border-neutral-200 p-4 dark:border-dark-border">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-neutral-900 dark:text-paper">{selected.firstName} {selected.lastName}</p>
                    <p className="truncate text-xs text-neutral-400">{selected.email || selected.phone || '—'} · {selected.accountType || 'No account type yet'} · Joined {fmt(selected.createdAt)}</p>
                  </div>
                  <StatusBadge status={selected.fullyVerified ? 'VERIFIED' : selected.profileStatus || selected.accountStatus} />
                </div>
                <div className="mt-3 space-y-1.5 text-xs">
                  <p className="flex justify-between gap-3"><span className="text-neutral-400">National ID</span><span className="font-medium text-neutral-800 dark:text-neutral-100">{selected.ghanaCardNumber || '—'}</span></p>
                  {selected.accountType === 'DRIVER' && <p className="flex justify-between gap-3"><span className="text-neutral-400">Driver's Licence</span><span className="font-medium text-neutral-800 dark:text-neutral-100">{selected.licenseNumber || '—'}</span></p>}
                  <p className="flex justify-between gap-3"><span className="text-neutral-400">Live face check</span><span className="font-medium text-neutral-800 dark:text-neutral-100">{selected.identityVerification ? (selected.identityVerification.livenessPassed ? 'Passed' : 'Manual review') : 'Not submitted'}</span></p>
                </div>
                {selected.identityVerification?.livenessChallenge && (
                  <p className="mt-2 text-[11px] leading-relaxed text-neutral-400">Actions performed: {selected.identityVerification.livenessChallenge}</p>
                )}
              </div>

              <div className="p-4">
                {preview ? (
                  <>
                    <img src={resolveVehiclePhoto(preview.url)} alt={preview.label} className="max-h-[46vh] w-full rounded-lg border border-neutral-200 object-contain dark:border-dark-border" />
                    <p className="mt-2 text-center text-xs font-medium text-steel dark:text-neutral-400">
                      {preview.label}
                      {preview.badge ? <span className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${preview.badge === 'Live check passed' ? 'bg-green-500/10 text-green-600' : 'bg-amber-500/10 text-amber-600'}`}>{preview.badge}</span> : null}
                    </p>
                  </>
                ) : (
                  <div className="flex h-44 items-center justify-center rounded-lg border border-dashed border-neutral-300 text-center text-xs text-neutral-400 dark:border-dark-border">
                    No ID images submitted yet.<br />This user has only typed a number, or was added manually.
                  </div>
                )}

                {selectedImages.length > 0 && (
                  <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
                    {selectedImages.map((img) => (
                      <button
                        key={img.label}
                        type="button"
                        onClick={() => setPreview(img)}
                        title={img.label}
                        className={`shrink-0 overflow-hidden rounded-lg border-2 ${preview?.url === img.url ? 'border-brand-500' : 'border-transparent'}`}
                      >
                        <img src={resolveVehiclePhoto(img.url)} alt={img.label} className="h-16 w-20 object-cover" />
                      </button>
                    ))}
                  </div>
                )}
                <p className="mt-2 text-[11px] leading-relaxed text-neutral-400">Compare the live face capture to the photo on the Ghana Card, then decide below.</p>
              </div>

              {selected.accountType ? (
                <div className="flex flex-wrap gap-2 border-t border-neutral-200 p-4 dark:border-dark-border">
                  {selected.identityStatus !== 'VERIFIED'
                    ? <button disabled={!!busy} onClick={() => act(selected, 'IDENTITY', true)} className={`${btn} border-success/40 text-success hover:bg-success/10`}>{busy === `${selected.userId}-IDENTITY-true` ? '…' : 'Verify National ID'}</button>
                    : <button disabled={!!busy} onClick={() => act(selected, 'IDENTITY', false)} className={`${btn} border-danger/40 text-danger hover:bg-danger/10`}>Un-verify ID</button>}
                  {selected.accountType === 'DRIVER' && (selected.licenceStatus !== 'VERIFIED'
                    ? <button disabled={!!busy} onClick={() => act(selected, 'LICENCE', true)} className={`${btn} border-success/40 text-success hover:bg-success/10`}>{busy === `${selected.userId}-LICENCE-true` ? '…' : 'Verify licence'}</button>
                    : <button disabled={!!busy} onClick={() => act(selected, 'LICENCE', false)} className={`${btn} border-danger/40 text-danger hover:bg-danger/10`}>Un-verify licence</button>)}
                  {!selected.fullyVerified && <button disabled={!!busy} onClick={() => act(selected, 'ALL', true)} className={`${btn} border-brand-600 bg-brand-600 font-semibold text-white hover:bg-brand-700`}>{busy === `${selected.userId}-ALL-true` ? '…' : 'Verify all'}</button>}
                </div>
              ) : (
                <p className="border-t border-neutral-200 p-4 text-xs text-steel dark:border-dark-border dark:text-neutral-400">Ask this user to choose a Driver or Owner account before verifying.</p>
              )}

              {selected.accountType && (
                <div className="border-t border-neutral-200 p-4 dark:border-dark-border">
                  <p className="text-xs font-semibold text-neutral-800 dark:text-neutral-100">Something wrong? Ask them to resubmit</p>
                  <p className="mt-0.5 text-[11px] leading-relaxed text-neutral-400">They receive your reason by email and in-app notification, and the document reopens for resubmission.</p>
                  {(selected.identityVerification?.reviewNote || selected.licenceVerification?.reviewNote) && (
                    <p className="mt-2 rounded-lg bg-red-500/10 px-3 py-2 text-[11px] text-red-700 dark:text-red-300">
                      Last reason sent: {selected.identityVerification?.reviewNote || selected.licenceVerification?.reviewNote}
                    </p>
                  )}
                  <div className="mt-2.5 flex gap-2">
                    <select className="input !w-auto text-xs" value={resubmitTarget} onChange={(e) => setResubmitTarget(e.target.value)} aria-label="What should be resubmitted">
                      <option value="IDENTITY">National ID</option>
                      {selected.accountType === 'DRIVER' && <option value="LICENCE">Licence</option>}
                      {selected.accountType === 'DRIVER' && <option value="ALL">ID + Licence</option>}
                    </select>
                  </div>
                  <textarea
                    className="input mt-2 min-h-[72px] text-xs"
                    placeholder="Tell them what is wrong — e.g. Back of the Ghana Card is blurry, retake it in good light with all corners visible."
                    value={resubmitReason}
                    onChange={(e) => setResubmitReason(e.target.value)}
                  />
                  <button
                    type="button"
                    disabled={!!busy || !resubmitReason.trim()}
                    onClick={() => requestResubmit(selected)}
                    className={`${btn} mt-2 border-danger/40 font-semibold text-danger hover:bg-danger/10`}
                  >
                    {busy === `${selected.userId}-RESUBMIT` ? 'Sending…' : 'Request resubmission'}
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-card border border-dashed border-neutral-300 p-8 text-center text-sm text-neutral-400 dark:border-dark-border">Select a person from the queue to review them here.</div>
          )}
        </aside>
      </div>

      {/* Small screens: workspace stacks under the queue */}
      {selected && (
        <div className="mt-4 rounded-card border border-neutral-200 bg-neutral-50 p-4 dark:border-dark-border dark:bg-dark-card lg:hidden">
          <p className="text-sm font-semibold text-neutral-900 dark:text-paper">{selected.firstName} {selected.lastName} — review</p>
          {preview && <img src={resolveVehiclePhoto(preview.url)} alt={preview.label} className="mt-3 max-h-[50vh] w-full rounded-lg border border-neutral-200 object-contain dark:border-dark-border" />}
          {preview && <p className="mt-2 text-center text-xs font-medium text-steel dark:text-neutral-400">{preview.label}</p>}
          {selectedImages.length > 0 && (
            <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
              {selectedImages.map((img) => (
                <button key={img.label} type="button" onClick={() => setPreview(img)} className={`shrink-0 overflow-hidden rounded-lg border-2 ${preview?.url === img.url ? 'border-brand-500' : 'border-transparent'}`}>
                  <img src={resolveVehiclePhoto(img.url)} alt={img.label} className="h-16 w-20 object-cover" />
                </button>
              ))}
            </div>
          )}
          {selected.accountType && (
            <div className="mt-4 flex flex-wrap gap-2">
              {selected.identityStatus !== 'VERIFIED'
                ? <button disabled={!!busy} onClick={() => act(selected, 'IDENTITY', true)} className={`${btn} border-success/40 text-success hover:bg-success/10`}>Verify National ID</button>
                : <button disabled={!!busy} onClick={() => act(selected, 'IDENTITY', false)} className={`${btn} border-danger/40 text-danger hover:bg-danger/10`}>Un-verify ID</button>}
              {selected.accountType === 'DRIVER' && (selected.licenceStatus !== 'VERIFIED'
                ? <button disabled={!!busy} onClick={() => act(selected, 'LICENCE', true)} className={`${btn} border-success/40 text-success hover:bg-success/10`}>Verify licence</button>
                : <button disabled={!!busy} onClick={() => act(selected, 'LICENCE', false)} className={`${btn} border-danger/40 text-danger hover:bg-danger/10`}>Un-verify licence</button>)}
              {!selected.fullyVerified && <button disabled={!!busy} onClick={() => act(selected, 'ALL', true)} className={`${btn} border-brand-600 bg-brand-600 font-semibold text-white hover:bg-brand-700`}>Verify all</button>}
            </div>
          )}
          {selected.accountType && (
            <div className="mt-4 border-t border-neutral-200 pt-4 dark:border-dark-border">
              <p className="text-xs font-semibold text-neutral-800 dark:text-neutral-100">Something wrong? Ask them to resubmit</p>
              <select className="input mt-2 !w-auto text-xs" value={resubmitTarget} onChange={(e) => setResubmitTarget(e.target.value)} aria-label="What should be resubmitted">
                <option value="IDENTITY">National ID</option>
                {selected.accountType === 'DRIVER' && <option value="LICENCE">Licence</option>}
                {selected.accountType === 'DRIVER' && <option value="ALL">ID + Licence</option>}
              </select>
              <textarea className="input mt-2 min-h-[72px] text-xs" placeholder="Tell them what is wrong…" value={resubmitReason} onChange={(e) => setResubmitReason(e.target.value)} />
              <button type="button" disabled={!!busy || !resubmitReason.trim()} onClick={() => requestResubmit(selected)} className={`${btn} mt-2 border-danger/40 font-semibold text-danger hover:bg-danger/10`}>
                {busy === `${selected.userId}-RESUBMIT` ? 'Sending…' : 'Request resubmission'}
              </button>
            </div>
          )}
        </div>
      )}

      <p className="mt-5 text-xs leading-relaxed text-steel dark:text-neutral-400">
        Every manual change is written to the audit log. Approving also marks the person's submitted ID and licence records as reviewed.
      </p>
    </>
  );
}
