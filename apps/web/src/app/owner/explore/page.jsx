'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/useAuth';
import { SectionHeader, EmptyState } from '@/components/dashboard/DashboardUI';
import { marketplaceApi, resolveVehiclePhoto } from '@/lib/api';

const MODEL_LABEL = { WORK_AND_PAY: 'Work & Pay', DRIVING_ON: 'DriveOn', RENTAL: 'Rental' };

export default function OwnerExplorePage() {
  const { user } = useAuth({ requiredRoles: ['OWNER'] });
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    marketplaceApi.explore()
      .then((r) => setVehicles(r.data?.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user]);

  return (
    <>
      <SectionHeader title="Explore" action={<span className="text-xs text-neutral-500">Vehicles verified by +Motive and listed for hiring by companies.</span>} />
      {loading ? (
        <p className="text-sm text-neutral-500">Loading vehicles…</p>
      ) : vehicles.length === 0 ? (
        <EmptyState icon="explore" title="No vehicles on Explore right now" description="When companies list verified vehicles for Work & Pay, DriveOn or Rental, they will appear here." />
      ) : (
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-5">
          {vehicles.map((v) => {
            const cover = v.imageUrls?.[0];
            return (
              <article key={v.id} className="bg-white dark:bg-dark-surface border border-neutral-200 dark:border-dark-border rounded-card overflow-hidden flex flex-col">
                <div className="relative aspect-[16/9] bg-neutral-100 dark:bg-dark-card">
                  {cover ? <img src={resolveVehiclePhoto(cover)} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-xs text-neutral-400">No photo yet</div>}
                  <span className="absolute top-3 left-3 text-[11px] font-semibold bg-brand-600 text-white px-2.5 py-1 rounded-full">{MODEL_LABEL[v.operatingModel] || 'Available'}</span>
                </div>
                <div className="p-4 flex flex-col flex-1">
                  <h3 className="text-[15px] font-semibold text-neutral-900 dark:text-neutral-50">{v.make} {v.model} <span className="text-neutral-400 font-normal">· {v.year}</span></h3>
                  <p className="text-xs text-neutral-500 mt-0.5">{v.registrationNumber} · {v.color || ''} · {(v.type || '').replace(/_/g, ' ')} · {(v.fuelType || '').replace(/_/g, ' ')} · {v.location || v.region || ''}</p>
                  <div className="mt-3 space-y-1.5 text-xs text-neutral-600 dark:text-neutral-300">
                    <p className="flex justify-between"><span>Contract type</span><span className="font-semibold text-neutral-900 dark:text-neutral-50">{MODEL_LABEL[v.operatingModel] || 'To be agreed'}</span></p>
                    {v.estimatedValue != null && <p className="flex justify-between"><span>Vehicle value</span><span className="font-semibold text-neutral-900 dark:text-neutral-50">GHS {Number(v.estimatedValue).toLocaleString()}</span></p>}
                    <p className="flex justify-between"><span>Listed by</span><span className="font-medium">{v.managingCompany?.name || 'Company'}</span></p>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </>
  );
}
