'use client';

import { useEffect, useRef } from 'react';

/**
 * VehicleTrackingMap
 *
 * Client-only Leaflet map component. Must be imported with dynamic() + ssr:false.
 *
 * Props:
 *   vehicles — array of { id, make, model, registrationNumber, lat, lng, status, speed?, heading? }
 *   onVehicleClick — called with a vehicle object when a marker is clicked
 *   className — optional Tailwind class string for the wrapper div
 */
export default function VehicleTrackingMap({ vehicles = [], onVehicleClick, className = '' }) {
  const containerRef = useRef(null);
  const mapRef       = useRef(null);
  const markersRef   = useRef({});

  // Initialise the map once
  useEffect(() => {
    if (mapRef.current || !containerRef.current) return;

    // Dynamic import at runtime to prevent SSR evaluation
    import('leaflet').then((L) => {
      // Fix default icon URLs broken by webpack
      delete L.Icon.Default.prototype._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      });

      // Ghana — centred on Accra
      const map = L.map(containerRef.current, {
        center:  [5.6037, -0.1870],
        zoom:    12,
        zoomControl: true,
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
      }).addTo(map);

      mapRef.current = map;

      // Add initial markers
      renderMarkers(L, map, vehicles, onVehicleClick);
    });

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        markersRef.current = {};
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update markers when vehicles prop changes
  useEffect(() => {
    if (!mapRef.current) return;
    import('leaflet').then((L) => {
      renderMarkers(L, mapRef.current, vehicles, onVehicleClick);
    });
  }, [vehicles, onVehicleClick]);

  function renderMarkers(L, map, vehicleList, clickHandler) {
    const seen = new Set();

    vehicleList.forEach((v) => {
      if (!v.lat || !v.lng) return;
      seen.add(v.id);

      const statusColor = v.status === 'ACTIVE' ? '#22c55e' : v.status === 'OFFLINE' ? '#ef4444' : '#f59e0b';
      const icon = L.divIcon({
        className: '',
        html: `
          <div style="
            width:32px;height:32px;border-radius:50%;
            background:${statusColor};
            border:3px solid white;
            box-shadow:0 1px 4px rgba(0,0,0,0.4);
            display:flex;align-items:center;justify-content:center;
            font-size:13px;
          ">🚗</div>`,
        iconSize:   [32, 32],
        iconAnchor: [16, 32],
        popupAnchor:[0, -32],
      });

      const popupHtml = `
        <div style="font-family:system-ui,sans-serif;min-width:160px">
          <p style="margin:0 0 4px;font-weight:700;font-size:13px">${v.make || ''} ${v.model || ''}</p>
          <p style="margin:0 0 2px;font-size:11px;color:#6b7280">${v.registrationNumber || v.licensePlate || 'No plate'}</p>
          ${v.speed !== undefined ? `<p style="margin:4px 0 0;font-size:11px">Speed: <strong>${v.speed} km/h</strong></p>` : ''}
          ${v.heading !== undefined ? `<p style="margin:2px 0 0;font-size:11px">Heading: ${v.heading}°</p>` : ''}
        </div>`;

      if (markersRef.current[v.id]) {
        markersRef.current[v.id].setLatLng([v.lat, v.lng]);
      } else {
        const marker = L.marker([v.lat, v.lng], { icon })
          .bindPopup(popupHtml);

        if (clickHandler) {
          marker.on('click', () => {
            clickHandler(v);
            marker.openPopup();
          });
        } else {
          marker.on('click', () => marker.openPopup());
        }

        marker.addTo(map);
        markersRef.current[v.id] = marker;
      }
    });

    // Remove stale markers
    Object.keys(markersRef.current).forEach((id) => {
      if (!seen.has(id)) {
        markersRef.current[id].remove();
        delete markersRef.current[id];
      }
    });

    // Fit bounds if there are markers
    if (seen.size > 0) {
      const coords = vehicleList.filter((v) => v.lat && v.lng).map((v) => [v.lat, v.lng]);
      if (coords.length > 0) {
        try { map.fitBounds(coords, { padding: [40, 40], maxZoom: 15 }); } catch {}
      }
    }
  }

  return (
    <div className={className}>
      {/* Leaflet CSS — loaded inline to avoid layout.jsx changes */}
      {/* eslint-disable-next-line @next/next/no-css-tags */}
      <link
        rel="stylesheet"
        href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
        crossOrigin=""
      />
      <div ref={containerRef} style={{ width: '100%', height: '100%', minHeight: '400px' }} />
    </div>
  );
}
