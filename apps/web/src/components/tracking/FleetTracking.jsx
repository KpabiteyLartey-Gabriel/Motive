'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/lib/useAuth';
import { SectionHeader, EmptyState } from '@/components/dashboard/DashboardUI';
import { vehiclesApi, trackingApi } from '@/lib/api';
import { FLEET_MANAGER_ROLES } from '@/lib/companyNav';

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export default function FleetTracking() {
  const { user } = useAuth();
  const canManage = FLEET_MANAGER_ROLES.includes(user?.primaryRole || '');
  const [vehicles, setVehicles] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [device, setDevice] = useState(null);
  const [location, setLocation] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [commands, setCommands] = useState([]);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [deviceForm, setDeviceForm] = useState({ deviceSerial: '', deviceModel: '', simNumber: '' });

  useEffect(() => {
    if (!user) return;
    vehiclesApi.list({ limit: 100 })
      .then((r) => {
        const vs = r.data?.data?.vehicles || [];
        setVehicles(vs);
        if (vs[0]) setSelectedId(vs[0].id);
      })
      .catch(() => {})
      .finally(() => setFetching(false));
  }, [user]);

  const loadVehicle = useCallback(async () => {
    if (!selectedId) return;
    setError('');
    const [d, l, a, c] = await Promise.all([
      trackingApi.getDevice(selectedId).catch(() => null),
      trackingApi.getLastLocation(selectedId).catch(() => null),
      trackingApi.listAlerts({ vehicleId: selectedId, limit: 20 }).catch(() => null),
      trackingApi.listCommands(selectedId).catch(() => null),
    ]);
    setDevice(d?.data?.data || null);
    setLocation(l?.data?.data?.lastLocation || null);
    setAlerts(a?.data?.data?.alerts || []);
    setCommands(c?.data?.data?.commands || []);
  }, [selectedId]);

  useEffect(() => { loadVehicle(); }, [loadVehicle]);

  const selected = vehicles.find((v) => v.id === selectedId);

  const registerDevice = async (e) => {
    e.preventDefault();
    setBusy(true); setError('');
    try {
      await trackingApi.registerDevice({ vehicleId: selectedId, ...deviceForm });
      setDeviceForm({ deviceSerial: '', deviceModel: '', simNumber: '' });
      await loadVehicle();
    } catch (err) { setError(err.response?.data?.message || 'Could not register device.'); }
    finally { setBusy(false); }
  };

  const command = async (type) => {
    const label = type === 'ENGINE_OFF' ? 'turn the engine OFF' : 'turn the engine ON';
    if (!window.confirm(`Send remote command to ${label} for ${selected?.registrationNumber}? The tracker executes it when it next connects.`)) return;
    setBusy(true); setError('');
    try { await trackingApi.issueCommand(selectedId, { type }); await loadVehicle(); }
    catch (err) { setError(err.response?.data?.message || 'Could not send command.'); }
    finally { setBusy(false); }
  };

  return (
    <>
      <SectionHeader title="Fleet Tracking" description="Live location, speed monitoring, tracker devices and remote engine control" />
      {error && <div className="bg-danger/10 border border-danger/20 text-danger text-sm px-4 py-3 rounded-lg mb-4">{Array.isArray(error) ? error.join(', ') : error}</div>}

      {fetching ? (
        <div className="text-neutral-500 text-sm py-8 text-center">Loading fleet…</div>
      ) : vehicles.length === 0 ? (
        <EmptyState icon="🛰" title="No fleet vehicles" description="Vehicles managed by your company will appear here." />
      ) : (
        <>
          <select className="input max-w-md mb-5" value={selectedId} onChange={(e) => setSelectedId(e.target.value)}>
            {vehicles.map((v) => <option key={v.id} value={v.id}>{v.registrationNumber} — {v.make} {v.model}</option>)}
          </select>

          <div className="grid md:grid-cols-2 gap-4 mb-5">
            <div className="bg-neutral-50 dark:bg-dark-card border border-neutral-200 dark:border-dark-border rounded-card p-4">
              <p className="text-xs text-neutral-500 mb-2">Last known location</p>
              {location ? (
                <div className="text-sm space-y-1 text-neutral-800 dark:text-neutral-200">
                  <p>{Number(location.latitude).toFixed(5)}, {Number(location.longitude).toFixed(5)}{location.address ? ` · ${location.address}` : ''}</p>
                  <p className="text-xs text-neutral-500">Speed: <span className={Number(location.speed) > 100 ? 'text-red-500 font-semibold' : ''}>{location.speed != null ? `${Number(location.speed)} km/h` : '—'} · {location.isMoving ? 'Moving' : 'Stationary'} · {fmtDate(location.recordedAt)}</span></p>
                  <a className="text-xs underline" target="_blank" rel="noreferrer" href={`https://www.google.com/maps?q=${location.latitude},${location.longitude}`}>Open in Google Maps</a>
                </div>
              ) : <p className="text-sm text-neutral-500">No location reported yet. The tracker sends locations to the platform automatically.</p>}
            </div>

            <div className="bg-neutral-50 dark:bg-dark-card border border-neutral-200 dark:border-dark-border rounded-card p-4">
              <p className="text-xs text-neutral-500 mb-2">Tracker device</p>
              {device ? (
                <div className="text-sm space-y-1 text-neutral-800 dark:text-neutral-200">
                  <p className="font-mono text-xs">{device.deviceSerial}</p>
                  <p className="text-xs text-neutral-500">Status: {device.status} · Last seen {fmtDate(device.lastSeenAt)}</p>
                  {canManage && device.status !== 'ACTIVE' && (
                    <button disabled={busy} onClick={async () => { setBusy(true); try { await trackingApi.updateDeviceStatus(device.id, 'ACTIVE'); await loadVehicle(); } catch (e) { setError(e.response?.data?.message || 'Could not activate device.'); } finally { setBusy(false); } }}
                      className="mt-2 text-xs font-medium px-3 py-2 rounded-lg bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 disabled:opacity-40">Activate tracker</button>
                  )}
                  {canManage && (
                    <div className="flex gap-2 pt-2">
                      <button disabled={busy} onClick={() => command('ENGINE_OFF')} className="text-xs font-medium px-3 py-2 rounded-lg border border-red-300 text-red-600 disabled:opacity-40">Engine OFF (immobilise)</button>
                      <button disabled={busy} onClick={() => command('ENGINE_ON')} className="text-xs font-medium px-3 py-2 rounded-lg border border-green-300 text-green-600 disabled:opacity-40">Engine ON (restore)</button>
                    </div>
                  )}
                </div>
              ) : canManage ? (
                <form onSubmit={registerDevice} className="space-y-2">
                  <input required className="input" placeholder="Device serial (e.g. TRK-2026-001)" value={deviceForm.deviceSerial} onChange={(e) => setDeviceForm({ ...deviceForm, deviceSerial: e.target.value })} />
                  <div className="grid grid-cols-2 gap-2">
                    <input className="input" placeholder="Model (optional)" value={deviceForm.deviceModel} onChange={(e) => setDeviceForm({ ...deviceForm, deviceModel: e.target.value })} />
                    <input className="input" placeholder="SIM number (optional)" value={deviceForm.simNumber} onChange={(e) => setDeviceForm({ ...deviceForm, simNumber: e.target.value })} />
                  </div>
                  <button disabled={busy} className="text-xs font-medium px-4 py-2 rounded-lg bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 disabled:opacity-40">{busy ? 'Registering…' : 'Register tracker'}</button>
                </form>
              ) : <p className="text-sm text-neutral-500">No tracker registered for this vehicle.</p>}
            </div>
          </div>

          {commands.length > 0 && (
            <div className="mb-5">
              <p className="text-xs text-neutral-500 mb-2">Remote commands</p>
              <div className="bg-neutral-50 dark:bg-dark-card border border-neutral-200 dark:border-dark-border rounded-card divide-y divide-neutral-200 dark:divide-dark-border">
                {commands.map((c) => (
                  <div key={c.id} className="flex justify-between px-4 py-3 text-xs">
                    <span className="text-neutral-800 dark:text-neutral-200">{c.type.replace('_', ' ')}{c.reason ? ` — ${c.reason}` : ''}</span>
                    <span className="text-neutral-500">{c.status} · {fmtDate(c.createdAt)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <p className="text-xs text-neutral-500 mb-2">Alerts (speeding over 100 km/h, geofence, device offline)</p>
          {alerts.length === 0 ? (
            <EmptyState icon="🔔" title="No alerts" description="Speeding and other tracker alerts for this vehicle will appear here." />
          ) : (
            <div className="bg-neutral-50 dark:bg-dark-card border border-neutral-200 dark:border-dark-border rounded-card divide-y divide-neutral-200 dark:divide-dark-border">
              {alerts.map((a) => (
                <div key={a.id} className="flex justify-between px-4 py-3 text-xs">
                  <span className={a.type === 'SPEEDING' ? 'text-red-500 font-medium' : 'text-neutral-800 dark:text-neutral-200'}>{a.type.replace(/_/g, ' ')} — {a.description}</span>
                  <span className="text-neutral-500">{fmtDate(a.triggeredAt)}</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </>
  );
}
