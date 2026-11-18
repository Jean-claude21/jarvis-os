import { useNavigate } from '@tanstack/react-router';
import { useEffect, useRef } from 'react';
import 'leaflet/dist/leaflet.css';
import { Empty, colorOf } from '../../ui';
import type { Shaped } from '../apply';

// La carte (v3 D5, the « place » facet; D10): every entry that says where it is, a dot tinted by
// its kind on OpenStreetMap; a dot opens the entry beside the map. The map library is served by
// Jarvis; only the map tiles come from OpenStreetMap, as in the v2.

export function MapRender({ shaped }: { shaped: Shaped }) {
  const box = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const placed = shaped.rows.filter((row) => row.place);
  const without = shaped.rows.length - placed.length;
  const key = placed.map((row) => `${row.id}:${row.place!.lat},${row.place!.lng}`).join('|');
  useEffect(() => {
    if (!box.current || !placed.length) return;
    let gone = false;
    let map: import('leaflet').Map | null = null;
    void import('leaflet').then((L) => {
      if (gone || !box.current) return;
      map = L.map(box.current, { scrollWheelZoom: false });
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 18,
        attribution: '© OpenStreetMap',
      }).addTo(map);
      const bounds = L.latLngBounds([]);
      for (const row of placed) {
        const at = L.latLng(row.place!.lat, row.place!.lng);
        bounds.extend(at);
        L.circleMarker(at, {
          radius: 8,
          color: colorOf(row.kind),
          weight: 2,
          fillColor: colorOf(row.kind),
          fillOpacity: 0.55,
        })
          .bindTooltip(`${row.title}${row.place!.address ? ` — ${row.place!.address}` : ''}`)
          .on(
            'click',
            () =>
              void navigate({
                to: '.',
                search: ((was: Record<string, unknown>) => ({ ...was, fiche: row.id })) as never,
              }),
          )
          .addTo(map);
      }
      if (placed.length === 1) map.setView(bounds.getCenter(), 14);
      else map.fitBounds(bounds, { padding: [32, 32] });
    });
    return () => {
      gone = true;
      map?.remove();
    };
  }, [key]);
  if (!placed.length)
    return (
      <Empty
        title="Aucun lieu"
        lead="Ces entrées ne disent pas encore où elles sont : un champ « lieu » (adresse et coordonnées) les met sur la carte."
      />
    );
  return (
    <div>
      <div ref={box} className="h-[min(62vh,560px)] w-full bg-sand" />
      {without > 0 && (
        <p className="border-t border-rule px-4 py-2 text-[12.5px] text-bark">
          {without} entrée(s) sans lieu ne sont pas sur la carte.
        </p>
      )}
    </div>
  );
}
