'use client';

import { useEffect, useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { useAuth } from '@/lib/useAuth';
import DashboardShell from '@/components/dashboard/DashboardShell';
import { OWNER_NAV } from '@/lib/ownerNav';
import { SectionHeader, EmptyState, StatusBadge } from '@/components/dashboard/DashboardUI';
import { vehiclesApi, trackingApi, locationShareApi } from '@/lib/api';

const VehicleTrackingMap = dynamic(
  () => import('@/components/tracking/VehicleTrackingMap'),
  { ssr: false, loading: () => <div className="flex items-center justify-center h-80 text-neutral-500 text-sm">Loading map…</div> },
);

const NAV = OWNER_NAV;

const DURATION_OPTIONS = [
  { label: '1 hour',   value: 1 },
  { label: '6 hours',  value: 6 },
  { label: '24 hours', value: 24 },
  { label: '3 days',   value: 72 },
  { label: '7 days',   value: 168 },
];

function fmtExpiry(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  const now = new Date();
  if (d < now) return 'Expired';
  const diffMs = d - now;
  const h = Math.floor(diffMs / 3600000);
  const m = Math.floor((diffMs % 3600000) / 60000);
  if (h >= 24) return `${Math.floor(h / 24)}d ${h % 24}h left`;
  if (h > 0) return `${h}h ${m}m left`;
  return `${m}m left`;
}

function ShareModal({ vehicle, onClose, onCreated }) {
  const [duration, setDuration] = useState(24);
  const [label, setLabel] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await locationShareApi.create({
        vehicleId: vehicle.id,
        durationHours: duration,
        label: label || undefined,
      });
      onCreated(res.data.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create share link');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/60 z-40" onClick={onClose} />
      <div className="fixed inset-0 flex items-center justify-center z-50 px-4">
        <div className="w-full max-w-md bg-paper dark:bg-dark-surface border border-concrete dark:border-dark-border rounded-xl p-6">
          <h3 className="text-base font-semibold text-graphite dark:text-paper mb-1">Share live location</h3>
          <p className="text-xs text-steel dark:text-neutral-500 mb-5">
            {vehicle.make} {vehicle.model} · {vehicle.registrationNumber}
          </p>

          {error && (
            <div className="mb-4 px-4 py-3 bg-danger/10 border border-danger/20 rounded-lg text-xs text-danger">{error}</div>
          )}

          <div className="space-y-4">
            <div>
              <label className="label">Link valid for</label>
              <select className="input" value={duration} onChange={(e) => setDuration(Number(e.target.value))}>
                {DURATION_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Note for recipient <span className="text-fog">(optional)</span></label>
              <input
                type="text"
                className="input"
                placeholder="e.g. Track my Sprinter today"
                value={label}
                maxLength={80}
                onChange={(e) => setLabel(e.target.value)}
              />
            </div>
          </div>

          <div className="flex gap-3 mt-6">
            <button onClick={onClose} className="btn-ghost-dark flex-1 py-2.5 text-sm">Cancel</button>
            <button onClick={submit} disabled={loading} className="btn-solar flex-1 py-2.5 text-sm disabled:opacity-60">
              {loading ? 'Creating…' : 'Create link'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

function ShareResultModal({ share, onClose }) {
  const shareUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/track/${share.token}`;
  const [copied, setCopied] = useState(false);

  const copy = () => {
    navigator.clipboard.writeText(shareUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/60 z-40" onClick={onClose} />
      <div className="fixed inset-0 flex items-center justify-center z-50 px-4">
        <div className="w-full max-w-md bg-paper dark:bg-dark-surface border border-concrete dark:border-dark-border rounded-xl p-6">
          <h3 className="text-base font-semibold text-graphite dark:text-paper mb-1">Share link created</h3>
          <p className="text-xs text-steel dark:text-neutral-500 mb-5">
            Valid for {fmtExpiry(share.expiresAt)}. Anyone with this link can see the live location.
          </p>

          <div className="bg-chalk dark:bg-dark-card border border-concrete dark:border-dark-border rounded-lg px-4 py-3 mb-4 flex items-center gap-3">
            <span className="text-xs text-steel dark:text-neutral-400 font-mono flex-1 break-all">{shareUrl}</span>
            <button
              onClick={copy}
              className="text-xs font-medium text-graphite dark:text-paper hover:text-steel transition-colors flex-shrink-0"
            >
              {copied ? '✓ Copied' : 'Copy'}
            </button>
          </div>

          <p className="text-xs text-fog mb-5">
            Recipients with the +Motive app will be prompted to open it. Others will see the location in their browser.
          </p>

          <button onClick={onClose} className="btn-solar w-full py-2.5 text-sm">Done</button>
        </div>
      </div>
    </>
  );
}

export default function OwnerTrackingPage() {
  const { user, loading, logout } = useAuth({ requiredRoles: ['OWNER'] });

  const [vehicles, setVehicles]       = useState([]);
  const [selected, setSelected]       = useState(null);       // selected vehicle
  const [location, setLocation]       = useState(null);       // last location for selected
  const [shares, setShares]           = useState([]);
  const [fetching, setFetching]       = useState(true);
  const [locLoading, setLocLoading]   = useState(false);
  const [showModal, setShowModal]     = useState(false);
  const [shareResult, setShareResult] = useState(null);

  // Load owner's vehicles
  const loadVehicles = useCallback(async () => {
    if (!user) return;
    try {
      const res = await vehiclesApi.list({ limit: 50 });
      const list = res.data?.data?.vehicles || [];
      setVehicles(list);
      if (list.length && !selected) setSelected(list[0]);
    } catch {} finally { setFetching(false); }
  }, [user, selected]);

  // Load location for selected vehicle
  const loadLocation = useCallback(async () => {
    if (!selected) return;
    setLocLoading(true);
    try {
      const res = await trackingApi.getLastLocation(selected.id);
      setLocation(res.data?.data?.lastLocation || null);
    } catch { setLocation(null); } finally { setLocLoading(false); }
  }, [selected]);

  // Load owner's share links
  const loadShares = useCallback(async () => {
    if (!user) return;
    try {
      const res = await locationShareApi.list();
      setShares(res.data?.data || []);
    } catch {}
  }, [user]);

  useEffect(() => { loadVehicles(); }, [loadVehicles]);
  useEffect(() => { loadLocation(); }, [loadLocation]);
  useEffect(() => { loadShares(); }, [loadShares]);

  // Auto-refresh location every 30 s
  useEffect(() => {
    const t = setInterval(loadLocation, 30_000);
    return () => clearInterval(t);
  }, [loadLocation]);

  const revokeShare = async (id) => {
    try {
      await locationShareApi.revoke(id);
      setShares((prev) => prev.map((s) => s.id === id ? { ...s, revokedAt: new Date().toISOString() } : s));
    } catch {}
  };

  const mapVehicles = location
    ? [{ id: selected.id, make: selected.make, model: selected.model,
         registrationNumber: selected.registrationNumber,
         lat: parseFloat(location.latitude), lng: parseFloat(location.longitude),
         status: selected.status, speed: location.speed, heading: location.heading }]
    : [];

  const activeShares = shares.filter((s) => !s.revokedAt && new Date(s.expiresAt) > new Date());

  return (
    <DashboardShell user={user} loading={loading} logout={logout} navItems={NAV} title="Vehicle Tracking">
      <div className="mb-6">
        <h2 className="text-xl font-medium text-graphite dark:text-paper mb-1" style={{ letterSpacing: '-0.02em' }}>
          Vehicle Tracking
        </h2>
        <p className="text-sm text-steel dark:text-neutral-500">
          Live location of your vehicles. Share a temporary link with drivers or others.
        </p>
      </div>

      {/* Vehicle selector */}
      {vehicles.length > 1 && (
        <div className="flex gap-2 mb-5 flex-wrap">
          {vehicles.map((v) => (
            <button
              key={v.id}
              onClick={() => setSelected(v)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
                selected?.id === v.id
                  ? 'bg-graphite dark:bg-paper text-paper dark:text-graphite border-transparent'
                  : 'border-concrete dark:border-dark-border text-steel dark:text-neutral-400 hover:border-graphite dark:hover:border-neutral-500'
              }`}
            >
              {v.make} {v.model} · {v.registrationNumber}
            </button>
          ))}
        </div>
      )}

      {fetching ? null : !selected ? (
        <EmptyState icon="🗺️" title="No vehicles yet" description="Add a vehicle to start tracking its location." action={null} />
      ) : (
        <>
          {/* Map */}
          <div className="bg-neutral-50 dark:bg-dark-card border border-neutral-200 dark:border-dark-border rounded-card overflow-hidden mb-6" style={{ height: 400 }}>
            {locLoading && !location ? (
              <div className="flex items-center justify-center h-full text-neutral-500 text-sm">Loading live position…</div>
            ) : !location ? (
              <div className="flex flex-col items-center justify-center h-full gap-2">
                <p className="text-neutral-400 text-sm">No location data yet</p>
                <p className="text-neutral-600 text-xs">Make sure a tracking device is installed and active</p>
              </div>
            ) : (
              <VehicleTrackingMap vehicles={mapVehicles} className="w-full h-full" />
            )}
          </div>

          {/* Share button */}
          <div className="flex items-center justify-between mb-4">
            <SectionHeader title="Share Location" description="Create a temporary link to share live location" />
            <button onClick={() => setShowModal(true)} className="btn-solar text-xs px-4 py-2">
              + Share link
            </button>
          </div>

          {/* Active share links */}
          {activeShares.length === 0 ? (
            <p className="text-xs text-neutral-500 mb-8">No active share links for this vehicle.</p>
          ) : (
            <div className="space-y-2 mb-8">
              {activeShares.filter((s) => s.vehicleId === selected.id).map((s) => (
                <div key={s.id} className="flex items-center justify-between gap-4 px-4 py-3 bg-chalk dark:bg-dark-card border border-concrete dark:border-dark-border rounded-xl">
                  <div>
                    <p className="text-xs font-medium text-graphite dark:text-paper">{s.label || 'Untitled share'}</p>
                    <p className="text-[10px] text-neutral-500 mt-0.5">{fmtExpiry(s.expiresAt)}</p>
                  </div>
                  <button
                    onClick={() => revokeShare(s.id)}
                    className="text-[10px] text-danger hover:text-danger/80 transition-colors font-medium"
                  >
                    Revoke
                  </button>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Modals */}
      {showModal && selected && (
        <ShareModal
          vehicle={selected}
          onClose={() => setShowModal(false)}
          onCreated={(share) => {
            setShowModal(false);
            setShareResult(share);
            loadShares();
          }}
        />
      )}
      {shareResult && (
        <ShareResultModal share={shareResult} onClose={() => setShareResult(null)} />
      )}
    </DashboardShell>
  );
}
