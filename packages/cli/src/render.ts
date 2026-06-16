import { CATEGORY_LABELS, formatDistance, type NearbyResult, type Place } from '@proximap/core';
import pc from 'picocolors';

function coordString(lat: number, lng: number): string {
  return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
}

/** Render a nearby-search result as a numbered, distance-ordered list. */
export function renderNearby(result: NearbyResult): string {
  const { origin, results, total } = result;
  const lines: string[] = [
    pc.bold(origin.displayName),
    pc.dim(
      `${coordString(origin.location.lat, origin.location.lng)} · ${total} found, showing ${results.length}`,
    ),
    '',
  ];

  if (results.length === 0) {
    lines.push(pc.dim('No amenities found within the search radius.'));
    return lines.join('\n');
  }

  const rankWidth = String(results.length).length;
  for (const poi of results) {
    const rank = String(poi.rank).padStart(rankWidth);
    const label = CATEGORY_LABELS[poi.category];
    const name = poi.name ?? poi.kind ?? label;
    const meta = pc.dim(`${label} · ${formatDistance(poi.distanceMeters)}`);
    lines.push(`${pc.dim(`${rank}.`)} ${name}  ${meta}`);
  }
  return lines.join('\n');
}

/** Render geocoding candidates with their addresses and coordinates. */
export function renderGeocode(places: Place[]): string {
  if (places.length === 0) return 'No matches found.';

  const rankWidth = String(places.length).length;
  const lines: string[] = [];
  places.forEach((place, index) => {
    const rank = String(index + 1).padStart(rankWidth);
    lines.push(`${pc.dim(`${rank}.`)} ${pc.bold(place.name)}`);
    lines.push(`   ${pc.dim(place.displayName)}`);
    lines.push(`   ${pc.dim(coordString(place.location.lat, place.location.lng))}`);
  });
  return lines.join('\n');
}
