'use client';

import { useRef, useState } from 'react';
import { vehiclesApi, resolveVehiclePhoto } from '@/lib/api';

export default function VehiclePhotos({ vehicle, editable = false, onPhotosChange }) {
  const photos = vehicle?.imageUrls || [];
  const [active, setActive] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef(null);

  const apply = (res) => {
    const updated = res.data?.data || res.data;
    if (updated && onPhotosChange) onPhotosChange(updated);
    setActive(0);
  };

  const upload = async (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (!files.length) return;
    setBusy(true); setError('');
    try { apply(await vehiclesApi.uploadPhotos(vehicle.id, files)); }
    catch (err) { setError(err.response?.data?.message || 'Photo upload failed.'); }
    finally { setBusy(false); }
  };

  const remove = async (url) => {
    setBusy(true); setError('');
    try { apply(await vehiclesApi.setPhotos(vehicle.id, photos.filter((p) => p !== url))); }
    catch (err) { setError(err.response?.data?.message || 'Could not remove photo.'); }
    finally { setBusy(false); }
  };

  return (
    <div className="col-span-2">
      <div className="flex items-center justify-between mb-2">
        <p className="text-neutral-500 text-xs">Photos{photos.length ? ` (${photos.length})` : ''}</p>
        {editable && (
          <>
            <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={upload} />
            <button type="button" disabled={busy} onClick={() => fileRef.current?.click()}
              className="text-xs font-medium px-3 py-1.5 rounded-lg border border-neutral-300 dark:border-dark-border text-neutral-800 dark:text-white disabled:opacity-40">
              {busy ? 'Uploading…' : 'Add photos'}
            </button>
          </>
        )}
      </div>

      {error && <p className="text-xs text-red-500 mb-2">{Array.isArray(error) ? error.join(', ') : error}</p>}

      {photos.length === 0 ? (
        <div className="border border-dashed border-neutral-300 dark:border-dark-border rounded-lg py-8 px-4 text-center">
          <p className="text-sm text-neutral-500">No photos of this vehicle yet</p>
          {editable && <p className="text-xs text-neutral-400 mt-1">Use “Add photos” to upload images (max 10, 5MB each).</p>}
        </div>
      ) : (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={resolveVehiclePhoto(photos[Math.min(active, photos.length - 1)])} alt={`${vehicle.make || ''} ${vehicle.model || ''} photo`}
            className="w-full aspect-video object-cover rounded-lg border border-neutral-200 dark:border-dark-border bg-neutral-100 dark:bg-dark-card" />
          {photos.length > 1 && (
            <div className="flex gap-2 mt-2 flex-wrap">
              {photos.map((p, i) => (
                <button key={p + i} type="button" onClick={() => setActive(i)}
                  className={`relative w-16 h-12 rounded overflow-hidden border ${i === active ? 'border-neutral-800 dark:border-white' : 'border-neutral-200 dark:border-dark-border opacity-70'}`}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={resolveVehiclePhoto(p)} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
          {editable && (
            <button type="button" disabled={busy} onClick={() => remove(photos[Math.min(active, photos.length - 1)])}
              className="text-xs text-red-500 mt-2 disabled:opacity-40">Remove selected photo</button>
          )}
        </>
      )}
    </div>
  );
}
