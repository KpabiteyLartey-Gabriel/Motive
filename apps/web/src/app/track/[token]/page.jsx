'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { locationShareApi } from '@/lib/api';

const VehicleTrackingMap = dynamic(
  () => import('@/components/tracking/VehicleTrackingMap'),
  { ssr: false, loading: () => <div className="flex items-center justify-center h-full text-neutral-500 text-sm">Loading map…</div> },
);

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export default function PublicSharePage() {
  const { token } = useParams();
  const [data, setData]     = useState(null);
  const [error, setError]   = useState('');
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!token) return;
    try {
      const res = await locationShareApi.resolve(token);
      setData(res.data.data);
    } catch (err) {
      setError(err.response?.data?.message || 'This share link is invalid, expired, or has been revoked.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [token]);

  // Auto-refresh every 30 s
  useEffect(() => {
    if (!data) return;
    const t = setInterval(load, 30_000);
    return () => clearInterval(t);
  }, [data]);

  const loc = data?.lastLocation;
  const v   = data?.vehicle;

  const mapVehicles = loc ? [{
    id: 'shared',
    make: v?.make || '',
    model: v?.model || '',
    registrationNumber: v?.registrationNumber || '',
    lat: parseFloat(loc.latitude),
    lng: parseFloat(loc.longitude),
    speed: loc.speed,
    heading: loc.heading,
    status: 'ACTIVE',
  }] : [];

  return (
    <div className="min-h-screen bg-chalk dark:bg-dark-bg flex flex-col">
      {/* Minimal header */}
      <header className="h-[56px] bg-paper dark:bg-dark-surface border-b border-concrete dark:border-dark-border flex items-center px-5 gap-3">
        <Link href="/" className="flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/images/motive-logo.png" alt="+Motive logo" width={24} height={24} className="h-6 w-6 rounded-md" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/images/motive-name-dark.png" alt="Motive" className="h-[18px] w-auto dark:hidden" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/images/motive-name-white.png" alt="" aria-hidden="true" className="hidden h-[18px] w-auto dark:block" />
        </Link>
        <span className="text-xs text-fog">· Live Location</span>
      </header>

      <main className="flex-1 flex flex-col max-w-xl w-full mx-auto px-4 py-6 gap-4">
        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-sm text-neutral-500">Loading location…</div>
          </div>
        ) : error ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center">
            <div className="w-12 h-12 rounded-full bg-danger/10 flex items-center justify-center">
              <span className="text-danger text-xl">!</span>
            </div>
            <p className="text-sm font-medium text-graphite dark:text-paper">{error}</p>
            <Link href="/" className="text-xs text-steel underline">Go to +Motive</Link>
          </div>
        ) : (
          <>
            {/* Vehicle info */}
            <div className="bg-paper dark:bg-dark-surface border border-concrete dark:border-dark-border rounded-xl px-5 py-4">
              <p className="text-xs text-steel dark:text-neutral-500 mb-1">Sharing live location of</p>
              <p className="text-base font-semibold text-graphite dark:text-paper">
                {v?.make} {v?.model}
                {v?.year && <span className="font-normal text-steel dark:text-neutral-400"> ({v.year})</span>}
              </p>
              {v?.registrationNumber && (
                <p className="text-xs font-mono text-fog mt-0.5">{v.registrationNumber}</p>
              )}
              {data.label && (
                <p className="text-xs text-steel dark:text-neutral-400 mt-2 italic">"{data.label}"</p>
              )}
            </div>

            {/* Map */}
            <div
              className="bg-paper dark:bg-dark-surface border border-concrete dark:border-dark-border rounded-xl overflow-hidden"
              style={{ height: 380 }}
            >
              {!loc ? (
                <div className="flex flex-col items-center justify-center h-full gap-2">
                  <p className="text-neutral-400 text-sm">No position data yet</p>
                  <p className="text-neutral-600 text-xs">This page refreshes automatically every 30 seconds</p>
                </div>
              ) : (
                <VehicleTrackingMap vehicles={mapVehicles} className="w-full h-full" />
              )}
            </div>

            {/* Last update + speed */}
            {loc && (
              <div className="flex items-center justify-between px-5 py-3 bg-paper dark:bg-dark-surface border border-concrete dark:border-dark-border rounded-xl">
                <div>
                  <p className="text-[10px] text-fog uppercase tracking-wider mb-0.5">Last updated</p>
                  <p className="text-xs font-medium text-graphite dark:text-paper">{fmtDate(loc.recordedAt)}</p>
                </div>
                {loc.speed != null && (
                  <div className="text-right">
                    <p className="text-[10px] text-fog uppercase tracking-wider mb-0.5">Speed</p>
                    <p className="text-xs font-medium text-graphite dark:text-paper">
                      {parseFloat(loc.speed).toFixed(0)} km/h
                    </p>
                  </div>
                )}
                <div className="text-right">
                  <p className="text-[10px] text-fog uppercase tracking-wider mb-0.5">Status</p>
                  <span className={`text-xs font-medium ${loc.isMoving ? 'text-success' : 'text-steel'}`}>
                    {loc.isMoving ? 'Moving' : 'Parked'}
                  </span>
                </div>
              </div>
            )}

            {/* Expiry notice */}
            <p className="text-[10px] text-neutral-500 text-center">
              Link valid until {fmtDate(data.expiresAt)} · Auto-refreshes every 30 s
            </p>

            {/* CTA to download app */}
            <div className="bg-paper dark:bg-dark-surface border border-concrete dark:border-dark-border rounded-xl px-5 py-4 text-center">
              <p className="text-xs font-medium text-graphite dark:text-paper mb-1">Get +Motive</p>
              <p className="text-[10px] text-steel dark:text-neutral-500 mb-3">
                Download the app for full vehicle operations, contracts and payments.
              </p>
              <Link href="/register" className="btn-solar text-xs px-5 py-2">
                Create account
              </Link>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
