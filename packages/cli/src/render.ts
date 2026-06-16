import {
  CATEGORY_LABELS,
  formatDistance,
  formatDuration,
  type ComparisonReport,
  type GapReport,
  type NearbyResult,
  type OpenState,
  type Place,
  type RankedPoi,
  type WalkabilityReport,
} from '@proximap/core';
import pc from 'picocolors';

const MODE_WORDS: Record<string, string> = { walk: 'walking', bike: 'cycling', drive: 'driving' };

function coordString(lat: number, lng: number): string {
  return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
}

/** Render a nearby-search result as a numbered list (by distance, or travel time). */
export function renderNearby(result: NearbyResult): string {
  const { origin, results, total, routing } = result;
  const lines: string[] = [
    pc.bold(origin.displayName),
    pc.dim(
      `${coordString(origin.location.lat, origin.location.lng)} · ${total} found, showing ${results.length}`,
    ),
  ];
  if (routing) {
    const word = MODE_WORDS[routing.mode] ?? routing.mode;
    lines.push(
      pc.dim(
        routing.fellBack
          ? `ranked by ${word} time (straight-line estimate — routing engine unavailable)`
          : `ranked by ${word} time via ${routing.provider}`,
      ),
    );
  }
  lines.push('');

  if (results.length === 0) {
    lines.push(pc.dim('No amenities found within the search radius.'));
    return lines.join('\n');
  }

  const rankWidth = String(results.length).length;
  for (const poi of results) {
    const rank = String(poi.rank).padStart(rankWidth);
    const label = CATEGORY_LABELS[poi.category];
    const name = poi.name ?? poi.kind ?? label;
    const distance = formatDistance(poi.distanceMeters);
    const metric =
      poi.travelSeconds !== undefined
        ? `${formatDuration(poi.travelSeconds)} · ${distance}`
        : distance;
    const meta = pc.dim(`${label} · ${metric}`);
    const tags = `${accessibilityMark(poi.tags.wheelchair)}${openMark(poi)}`;
    lines.push(`${pc.dim(`${rank}.`)} ${name}  ${meta}${tags}`);
  }
  return lines.join('\n');
}

/** A compact step-free indicator for the nearby list, shown only when tagged. */
function accessibilityMark(wheelchair: string | undefined): string {
  if (wheelchair === 'yes') return `  ${pc.green('♿')}`;
  if (wheelchair === 'limited') return `  ${pc.yellow('♿ limited')}`;
  return '';
}

const localHhmm = (iso: string): string => {
  const date = new Date(iso);
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
};

/** An open/closed indicator, shown only when an `open` query was made. */
function openMark(poi: RankedPoi): string {
  const state: OpenState | undefined = poi.openState;
  if (state === 'open') {
    const till = poi.nextChange ? ` ${pc.dim(`till ${localHhmm(poi.nextChange)}`)}` : '';
    return `  ${pc.green('open')}${till}`;
  }
  if (state === 'unknown') return `  ${pc.dim('hours?')}`;
  return '';
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

function titleCase(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

/** Render an amenity-gap report as a checklist with distances. */
export function renderGaps(report: GapReport): string {
  const { origin, gaps, missing, searchRadiusMeters, thresholdMeters } = report;
  const lines: string[] = [
    pc.bold(origin.displayName),
    pc.dim(
      `${coordString(origin.location.lat, origin.location.lng)} · searched ${formatDistance(searchRadiusMeters)}, gap if > ${formatDistance(thresholdMeters)}`,
    ),
    '',
  ];
  for (const gap of gaps) {
    const mark = gap.isGap ? pc.red('✗') : pc.green('✓');
    const detail =
      gap.nearestMeters === null
        ? pc.dim(`none within ${formatDistance(searchRadiusMeters)}`)
        : pc.dim(formatDistance(gap.nearestMeters));
    lines.push(`${mark} ${titleCase(gap.category)}  ${detail}`);
  }
  lines.push('');
  lines.push(
    missing.length === 0
      ? pc.green('No gaps — all requested categories are nearby.')
      : pc.dim(`Missing (not found in OSM): ${missing.join(', ')}`),
  );
  return lines.join('\n');
}

/** Render a walkability report: headline score, per-category breakdown, gaps. */
export function renderScore(report: WalkabilityReport): string {
  const { origin, score, confidence, breakdown, missing, decay } = report;
  const lines: string[] = [
    pc.bold(origin.displayName),
    pc.dim(
      `${coordString(origin.location.lat, origin.location.lng)} · ` +
        `walkability ${pc.bold(String(score))}/100 · confidence ${Math.round(confidence * 100)}%`,
    ),
    pc.dim(
      `full credit ≤ ${formatDistance(decay.idealMeters)}, none ≥ ${formatDistance(decay.maxMeters)}`,
    ),
    '',
  ];

  const nameWidth = Math.max(...breakdown.map((b) => titleCase(b.category).length));
  for (const entry of breakdown) {
    const mark =
      entry.subScore >= 0.67 ? pc.green('✓') : entry.subScore > 0 ? pc.yellow('~') : pc.red('✗');
    const name = titleCase(entry.category).padEnd(nameWidth);
    const detail =
      entry.nearestMeters === null
        ? pc.dim('none in range')
        : pc.dim(formatDistance(entry.nearestMeters));
    const pct = pc.dim(`${Math.round(entry.subScore * 100)}%`.padStart(4));
    lines.push(`${mark} ${name}  ${pct}  ${detail}`);
  }

  lines.push('');
  lines.push(
    missing.length === 0
      ? pc.green('All daily needs reachable within range.')
      : pc.dim(`Not found in OSM within range: ${missing.join(', ')}`),
  );
  if (confidence < 0.5) {
    lines.push(
      pc.yellow('Low confidence — OSM coverage here looks sparse; treat the score as a floor.'),
    );
  }
  return lines.join('\n');
}

/** Render a location-comparison scorecard: ranked locations + per-dimension winners. */
export function renderComparison(report: ComparisonReport): string {
  const weightStr = report.weights.map((w) => `${titleCase(w.term)}×${w.weight}`).join(', ');
  const lines: string[] = [pc.bold('Location comparison'), pc.dim(`weights: ${weightStr}`), ''];

  const rankWidth = String(report.ranked.length).length;
  report.ranked.forEach((entry, position) => {
    const location = report.locations[entry.index]!;
    const marker = position === 0 ? pc.green('★') : ' ';
    const rank = String(position + 1).padStart(rankWidth);
    lines.push(`${marker} ${pc.dim(`${rank}.`)} ${pc.bold(entry.origin.displayName)}`);
    lines.push(
      `     ${pc.dim(`${entry.score}/100 · confidence ${Math.round(location.confidence * 100)}%`)}`,
    );
  });

  lines.push('');
  lines.push(pc.bold('Best per category:'));
  const nameWidth = Math.max(...report.dimensions.map((d) => titleCase(d.category).length));
  for (const dimension of report.dimensions) {
    const name = titleCase(dimension.category).padEnd(nameWidth);
    let detail: string;
    if (dimension.bestIndex === null) {
      detail = pc.dim('none found');
    } else {
      const location = report.locations[dimension.bestIndex]!;
      const entry = location.breakdown.find((b) => b.category === dimension.category);
      const distance =
        entry && entry.nearestMeters !== null
          ? pc.dim(` (${formatDistance(entry.nearestMeters)})`)
          : '';
      detail = `${location.origin.name}${distance}`;
    }
    lines.push(`  ${name}  ${detail}`);
  }
  return lines.join('\n');
}
