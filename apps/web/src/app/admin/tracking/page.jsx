'use client';

import { useEffect, useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { useAuth } from '@/lib/useAuth';
import DashboardShell from '@/components/dashboard/DashboardShell';
import { StatusBadge } from '@/components/dashboard/DashboardUI';
import { ADMIN_NAV, AdminTable, AdminPagination, fmt } from '@/components/dashboard/AdminHelpers';
import { adminApi, trackingApi } from '@/lib/api';

// Dynamic import — Leaflet requires window
const VehicleTrackingMap = dynamic(
  () => import('@/components/tracking/VehicleTrackingMap'),
  { ssr: false, loading: () => <div className="flex items-center justify-center h-96 text-neutral-500 text-sm">Loading map…</div> },
);

const DEVICE_STATUSES = ['ACTIVE', 'INACTIVE', 'OFFLINE', 'FAULT'];
const REFRESH_INTERVAL_MS = 30_000;

function DeviceDrawer({ device, onClose }) {
  return (
    <>
      <div className="fixed inset-0 bg-black/60 z-40" onClick={onClose} />
      <div className="fixed right-0 top-0 h-full w-full max-w-md bg-chalk dark:bg-paper dark:bg-dark-surface border-l border-concrete dark:border-dark-border z-50 flex flex-col overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-concrete dark:border-dark-border">
          <h2 className="text-base font-medium text-graphite dark:text-paper">Tracking Device</h2>
          <button onClick={onClose} className="text-fog hover:text-graphite dark:hover:text-paper transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="flex-1 px-6 py-6 space-y-6">
          <div>
            <p className="text-xs text-neutral-500 font-mono mb-2">{device.id}</p>
            <StatusBadge status={device.status} />
          </div>
          <div className="bg-neutral-50 dark:bg-dark-card border border-neutral-200 dark:border-dark-border rounded-xl divide-y divide-neutral-200 dark:divide-dark-border">
            {[
              { label: 'Vehicle',       value: device.vehicle ? `${device.vehicle.make} ${device.vehicle.model} (${device.vehicle.registrationNumber})` : '—' },
              { label: 'Serial Number', value: device.deviceSerial },
              { label: 'Device Model',  value: device.deviceModel || '—' },
              { label: 'SIM Number',    value: device.simNumber || '—' },
              { label: 'Firmware',      value: device.firmwareVersion || '—' },
              { label: 'Last Seen',     value: device.lastSeenAt ? fmt(device.lastSeenAt) : 'Never' },
              { label: 'Installed',     value: device.installedAt ? fmt(device.installedAt) : '—' },
              { label: 'Notes',         value: device.notes || '—' },
            ].map(({ label, value }) => (
              <div key={label} className="flex items-start justify-between px-4 py-3 gap-4">
                <span className="text-xs text-fog flex-shrink-0">{label}</span>
                <span className="text-xs text-steel dark:text-neutral-300 text-right break-all">{value}</span>
              </div>
            ))}
          </div>
          {/* Last known location */}
          {device.vehicle?.id && (
            <VehicleLocationMini vehicleId={device.vehicle.id} />
          )}
        </div>
      </div>
    </>
  );
}

function VehicleLocationMini({ vehicleId }) {
  const [loc, setLoc] = useState(null);

  useEffect(() => {
    trackingApi.getLastLocation(vehicleId)
      .then((r) => setLoc(r.data?.data?.location || null))
      .catch(() => {});
  }, [vehicleId]);

  if (!loc) return null;

  return (
    <div className="bg-neutral-50 dark:bg-dark-card border border-neutral-200 dark:border-dark-border rounded-card p-4">
      <p className="text-xs font-semibold text-neutral-500 uppercase tracking-widest mb-3">Last Known Position</p>
      <div className="space-y-1.5">
        <p className="text-xs text-neutral-300">Lat: <span className="font-mono">{loc.latitude?.toFixed(6)}</span></p>
        <p className="text-xs text-neutral-300">Lng: <span className="font-mono">{loc.longitude?.toFixed(6)}</span></p>
        {loc.speed !== undefined && <p className="text-xs text-neutral-300">Speed: <span className="font-mono">{loc.speed} km/h</span></p>}
        {loc.heading !== undefined && <p className="text-xs text-neutral-300">Heading: <span className="font-mono">{loc.heading}°</span></p>}
        <p className="text-xs text-neutral-500">{loc.recordedAt ? fmt(loc.recordedAt) : ''}</p>
      </div>
    </div>
  );
}

export default function AdminTrackingPage() {
  const { user, loading, logout } = useAuth({ requiredRoles: ['ADMIN', 'SUPER_ADMIN'] });
  const [tab, setTab]               = useState('map'); // 'map' | 'list'
  const [devices, setDevices]       = useState([]);
  const [pagination, setPagination] = useState(null);
  const [fetching, setFetching]     = useState(false);
  const [statusFilter, setStatus]   = useState('');
  const [page, setPage]             = useState(1);
  const [selected, setSelected]     = useState(null);
  const [mapVehicles, setMapVehicles] = useState([]);
  const [mapLoading, setMapLoading]   = useState(true);

  // Load device list
  const load = useCallback(() => {
    if (!user) return;
    setFetching(true);
    adminApi
      .listTrackingDevices({ page, limit: 20, status: statusFilter || undefined })
      .then((res) => {
        setDevices(res.data.data.devices);
        setPagination(res.data.data.pagination);
      })
      .catch(() => {})
      .finally(() => setFetching(false));
  }, [user, page, statusFilter]);

  // Load live locations for the map
  const loadMapLocations = useCallback(async () => {
    if (!user) return;
    try {
      // Get all active devices and their last locations
      const devRes = await adminApi.listTrackingDevices({ limit: 200, status: 'ACTIVE' });
      const activeDevices = devRes.data?.data?.devices || [];

      const locationResults = await Promise.allSettled(
        activeDevices
          .filter((d) => d.vehicle?.id)
          .map((d) =>
            trackingApi.getLastLocation(d.vehicle.id).then((r) => ({
              device: d,
              location: r.data?.data?.location || null,
            }))
          )
      );

      const markers = locationResults
        .filter((r) => r.status === 'fulfilled' && r.value.location)
        .map((r) => {
          const { device, location } = r.value;
          return {
            id:                 device.id,
            make:               device.vehicle?.make || '',
            model:              device.vehicle?.model || '',
            registrationNumber: device.vehicle?.registrationNumber || device.vehicle?.licensePlate || '',
            lat:                location.latitude,
            lng:                location.longitude,
            status:             device.status,
            speed:              location.speed,
            heading:            location.heading,
          };
        });

      setMapVehicles(markers);
    } catch {}
    finally {
      setMapLoading(false);
    }
  }, [user]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    loadMapLocations();
    const interval = setInterval(loadMapLocations, REFRESH_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [loadMapLocations]);

  const COLS = [
    {
      key: 'vehicle', label: 'Vehicle',
      render: (d) => (
        <span className="text-graphite dark:text-paper font-medium text-xs">
          {d.vehicle ? `${d.vehicle.make} ${d.vehicle.model}` : '—'}
          {d.vehicle?.registrationNumber && <span className="ml-1 text-neutral-500 font-mono">({d.vehicle.registrationNumber})</span>}
        </span>
      ),
    },
    {
      key: 'deviceSerial', label: 'Serial',
      render: (d) => <span className="text-neutral-400 text-xs font-mono">{d.deviceSerial}</span>,
    },
    {
      key: 'status', label: 'Status',
      render: (d) => <StatusBadge status={d.status} />,
    },
    {
      key: 'lastSeenAt', label: 'Last Seen', hidden: 'hidden md:table-cell',
      render: (d) => <span className="text-neutral-500 text-xs">{d.lastSeenAt ? fmt(d.lastSeenAt) : 'Never'}</span>,
    },
    {
      key: 'deviceModel', label: 'Model', hidden: 'hidden lg:table-cell',
      render: (d) => <span className="text-neutral-400 text-xs">{d.deviceModel || '—'}</span>,
    },
  ];

  return (
    <DashboardShell user={user} loading={loading} logout={logout} navItems={ADMIN_NAV} title="Tracking">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-medium text-graphite dark:text-paper mb-1" style={{ letterSpacing: "-0.02em" }}>Vehicle Tracking</h2>
          <p className="text-sm text-steel dark:text-neutral-500">
            {mapVehicles.length} vehicle{mapVehicles.length !== 1 ? 's' : ''} with live location &middot; auto-refreshes every 30s
          </p>
        </div>
        {/* Tab toggle */}
        <div className="flex gap-1 bg-neutral-50 dark:bg-dark-card border border-neutral-200 dark:border-dark-border rounded-lg p-1">
          <button
            onClick={() => setTab('map')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${tab === 'map' ? 'bg-white text-black' : 'text-neutral-400 hover:text-white'}`}
          >
            Map
          </button>
          <button
            onClick={() => setTab('list')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${tab === 'list' ? 'bg-white text-black' : 'text-neutral-400 hover:text-white'}`}
          >
            Devices
          </button>
        </div>
      </div>

      {tab === 'map' ? (
        /* ── MAP VIEW ───────────────────────────────────── */
        <div className="bg-neutral-50 dark:bg-dark-card border border-neutral-200 dark:border-dark-border rounded-card overflow-hidden" style={{ height: '600px' }}>
          {mapLoading ? (
            <div className="flex items-center justify-center h-full text-neutral-500 text-sm">Loading live positions…</div>
          ) : mapVehicles.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-3">
              <p className="text-neutral-400 text-sm">No active vehicles with live location data</p>
              <p className="text-neutral-600 text-xs">Vehicles will appear here once tracking devices are online and reporting positions</p>
            </div>
          ) : (
            <VehicleTrackingMap
              vehicles={mapVehicles}
              onVehicleClick={(v) => {
                const device = devices.find((d) => d.id === v.id);
                if (device) setSelected(device);
              }}
              className="w-full h-full"
            />
          )}
        </div>
      ) : (
        /* ── LIST VIEW ──────────────────────────────────── */
        <>
          <div className="flex flex-col sm:flex-row gap-3 mb-5">
            <select className="input w-52" value={statusFilter} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
              <option value="">All statuses</option>
              {DEVICE_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="bg-neutral-50 dark:bg-dark-card border border-neutral-200 dark:border-dark-border rounded-card overflow-hidden">
            <AdminTable columns={COLS} rows={devices} loading={fetching} onRowClick={setSelected} />
          </div>
          <AdminPagination pagination={pagination} page={page} setPage={setPage} />
        </>
      )}

      {selected && <DeviceDrawer device={selected} onClose={() => setSelected(null)} />}
    </DashboardShell>
  );
}
