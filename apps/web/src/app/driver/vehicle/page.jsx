'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/useAuth';
import { SectionHeader, EmptyState, StatusBadge } from '@/components/dashboard/DashboardUI';
import { vehiclesApi, complianceApi } from '@/lib/api';
import VehiclePhotos from '@/components/vehicles/VehiclePhotos';

const COMPLIANCE_STATUS_COLORS = {
  VALID: 'text-green-400',
  EXPIRING_SOON: 'text-yellow-400',
  EXPIRED: 'text-red-400',
  PENDING_RENEWAL: 'text-orange-400',
};

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function DriverVehiclePage() {
  const { user, loading, logout } = useAuth({ requiredRoles: ['DRIVER'] });
  const [vehicle, setVehicle]       = useState(null);
  const [compliance, setCompliance] = useState([]);
  const [fetching, setFetching]     = useState(true);

  useEffect(() => {
    if (!user) return;
    Promise.all([
      vehiclesApi.list({ assignedToMe: true, limit: 1 }).catch(() => null),
      complianceApi.list({ limit: 20 }).catch(() => null),
    ]).then(([vRes, cRes]) => {
      const vehicles = vRes?.data?.data?.vehicles || [];
      setVehicle(vehicles[0] || null);
      setCompliance(cRes?.data?.data?.records || []);
    }).finally(() => setFetching(false));
  }, [user]);

  if (loading) return <div className="min-h-screen bg-chalk flex items-center justify-center"><div className="text-neutral-500 text-sm">Loading…</div></div>;

  return (
    <>
      {fetching ? (
        <div className="text-neutral-500 text-sm py-8 text-center">Loading vehicle info…</div>
      ) : !vehicle ? (
        <EmptyState icon="🚗" title="No vehicle assigned" description="You will see your assigned vehicle details here once an owner or company assigns a vehicle to you." />
      ) : (
        <>
          {/* Vehicle card */}
          <div className="bg-neutral-50 dark:bg-dark-card border border-neutral-200 dark:border-dark-border rounded-card p-5 mb-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="text-lg font-bold text-neutral-900 dark:text-white">{vehicle.registrationNumber}</h2>
                <p className="text-sm text-neutral-400 mt-0.5">{vehicle.make} {vehicle.model} {vehicle.year && `(${vehicle.year})`}</p>
              </div>
              <StatusBadge status={vehicle.status} />
            </div>
            <div className="mb-4"><VehiclePhotos vehicle={vehicle} /></div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-xs">
              <div>
                <p className="text-neutral-500">VIN / Chassis</p>
                <p className="text-neutral-900 dark:text-white mt-0.5">{vehicle.vin || '—'}</p>
              </div>
              <div>
                <p className="text-neutral-500">Type</p>
                <p className="text-neutral-900 dark:text-white mt-0.5">{vehicle.type || '—'}</p>
              </div>
              <div>
                <p className="text-neutral-500">Colour</p>
                <p className="text-neutral-900 dark:text-white mt-0.5">{vehicle.color || '—'}</p>
              </div>
              <div>
                <p className="text-neutral-500">Fuel</p>
                <p className="text-neutral-900 dark:text-white mt-0.5">{vehicle.fuelType || '—'}</p>
              </div>
              <div>
                <p className="text-neutral-500">Verified</p>
                <p className="text-neutral-900 dark:text-white mt-0.5">{vehicle.verified ? 'Yes' : 'Pending'}</p>
              </div>
            </div>
          </div>

          {/* Compliance documents */}
          <SectionHeader title="Compliance Documents" description="Insurance, roadworthiness and other document status" />
          {compliance.length === 0 ? (
            <EmptyState icon="🗂" title="No compliance records" description="Vehicle compliance and insurance records will appear here." />
          ) : (
            <div className="bg-neutral-50 dark:bg-dark-card border border-neutral-200 dark:border-dark-border rounded-card overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-neutral-200 dark:border-dark-border text-left">
                    <th className="px-4 py-3 text-xs text-neutral-500 font-medium">Document</th>
                    <th className="px-4 py-3 text-xs text-neutral-500 font-medium">Expires</th>
                    <th className="px-4 py-3 text-xs text-neutral-500 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {compliance.map((c, i) => (
                    <tr key={c.id} className={i !== compliance.length - 1 ? 'border-b border-neutral-200 dark:border-dark-border' : ''}>
                      <td className="px-4 py-3 text-white">{c.documentType?.replace(/_/g, ' ') || '—'}</td>
                      <td className="px-4 py-3 text-neutral-400">{fmtDate(c.expiryDate)}</td>
                      <td className={`px-4 py-3 text-xs font-medium ${COMPLIANCE_STATUS_COLORS[c.status] || 'text-neutral-400'}`}>{c.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </>
  );
}
