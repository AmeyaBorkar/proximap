import type { OpenState } from './types';

export interface OpeningEvaluation {
  state: OpenState;
  /** ISO 8601 timestamp of the next open/closed transition, when computable. */
  nextChange?: string;
}

/**
 * A small, dependency-free evaluator for the common subset of the OSM
 * `opening_hours` grammar: weekday ranges/lists, multiple time ranges,
 * overnight (midnight-wrapping) ranges, `24/7`, and `off`/`closed`. Public- and
 * school-holiday rules (`PH`/`SH`) are skipped (no holiday calendar), so a
 * normal day still evaluates from the regular rules.
 *
 * Anything outside this subset — `sunrise`/`sunset`, month/date/week selectors,
 * open-ended `08:00+`, etc. — yields `unknown` rather than a guess. A missing or
 * empty value is `unknown` too. We never assert a state we can't justify.
 *
 * Times are read from the local-time fields of `when`; to evaluate a POI in
 * another timezone, pass a `when` already shifted into that zone.
 */
export function isOpenAt(openingHours: string | undefined, when: Date): OpeningEvaluation {
  const raw = (openingHours ?? '').trim();
  if (!raw) return { state: 'unknown' };

  const lower = raw.toLowerCase();
  if (/^24\s*\/\s*7$/.test(lower) || lower === '24/7') return { state: 'open' };
  if (lower === 'off' || lower === 'closed') return { state: 'closed' };
  if (hasUnsupported(lower)) return { state: 'unknown' };

  const segments = buildSegments(lower);
  if (!segments) return { state: 'unknown' };

  const day = when.getDay();
  const minute = when.getHours() * 60 + when.getMinutes();
  const open = isOpenInSegments(segments, day, minute);

  const evaluation: OpeningEvaluation = { state: open ? 'open' : 'closed' };
  const next = nextChange(segments, when, open);
  if (next) evaluation.nextChange = next;
  return evaluation;
}

// getDay(): 0 = Sunday … 6 = Saturday. OSM weeks run Mo…Su.
const DAY_INDEX: Record<string, number> = { su: 0, mo: 1, tu: 2, we: 3, th: 4, fr: 5, sa: 6 };
const WEEK_ORDER = ['mo', 'tu', 'we', 'th', 'fr', 'sa', 'su'];
const MONTHS = /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\b/;

/** Grammar we deliberately don't evaluate; presence ⇒ `unknown` (never a guess). */
function hasUnsupported(s: string): boolean {
  return (
    /sunrise|sunset|dawn|dusk|easter|\bweek\b/.test(s) ||
    /\+/.test(s) || // open-ended times like 08:00+
    /\b\d{4}\b/.test(s) || // explicit years
    MONTHS.test(s)
  );
}

type Interval = [number, number]; // [start, end) in minutes within a day
type Segments = Interval[][]; // [dayIndex 0..6] -> that day's open intervals

function buildSegments(input: string): Segments | null {
  // Each day's own intervals, last matching rule wins (OSM `;` override).
  const own: (Interval[] | undefined)[] = new Array(7).fill(undefined);

  for (const rulePart of input.split(';')) {
    const rule = rulePart.trim();
    if (!rule) continue;
    const parsed = parseRule(rule.replace(/\s*([,:\-])\s*/g, '$1'));
    if (parsed === 'unknown') return null;
    if (parsed === null) continue; // holiday-only rule: skip
    for (const day of parsed.days) own[day] = parsed.intervals;
  }

  // Expand into per-day segments, spilling overnight ranges into the next day.
  const segments: Segments = Array.from({ length: 7 }, () => [] as Interval[]);
  for (let day = 0; day < 7; day++) {
    const intervals = own[day];
    if (!intervals) continue;
    for (const [start, end] of intervals) {
      if (start === end)
        segments[day]!.push([0, 1440]); // full day (e.g. 00:00-00:00)
      else if (end > start) segments[day]!.push([start, end]);
      else {
        segments[day]!.push([start, 1440]); // head: until midnight
        segments[(day + 1) % 7]!.push([0, end]); // tail: early next day
      }
    }
  }
  return segments;
}

type ParsedRule = { days: number[]; intervals: Interval[] };

function parseRule(rule: string): ParsedRule | 'unknown' | null {
  let dayPart: string;
  let timePart: string;
  const space = rule.indexOf(' ');
  if (space === -1) {
    if (/\d/.test(rule)) {
      dayPart = '';
      timePart = rule;
    } else if (rule === 'off' || rule === 'closed') {
      dayPart = '';
      timePart = rule;
    } else {
      dayPart = rule;
      timePart = '';
    }
  } else {
    dayPart = rule.slice(0, space);
    timePart = rule.slice(space + 1).trim();
  }

  const days = parseDays(dayPart);
  if (days === 'unknown') return 'unknown';
  if (days === null) return null;

  if (timePart === '') return { days, intervals: [[0, 1440]] as Interval[] };
  if (timePart === 'off' || timePart === 'closed') return { days, intervals: [] };

  const intervals = parseTimes(timePart);
  if (!intervals) return 'unknown';
  return { days, intervals };
}

function parseDays(part: string): number[] | 'unknown' | null {
  if (part === '') return [0, 1, 2, 3, 4, 5, 6];

  const days = new Set<number>();
  let sawReal = false;
  let sawHoliday = false;
  for (const token of part.split(',')) {
    if (token === 'ph' || token === 'sh') {
      sawHoliday = true;
      continue;
    }
    const match = token.match(/^([a-z]{2})(?:-([a-z]{2}))?$/);
    if (!match) return 'unknown';
    const from = match[1]!;
    if (!(from in DAY_INDEX)) return 'unknown';
    if (match[2] === undefined) {
      days.add(DAY_INDEX[from]!);
      sawReal = true;
    } else {
      const to = match[2];
      if (!(to in DAY_INDEX)) return 'unknown';
      addWeekdayRange(days, from, to);
      sawReal = true;
    }
  }
  if (!sawReal) return sawHoliday ? null : 'unknown';
  return [...days];
}

/** Add an OSM weekday range (Mo…Su order, wrapping, e.g. Fr-Mo). */
function addWeekdayRange(set: Set<number>, from: string, to: string): void {
  let i = WEEK_ORDER.indexOf(from);
  const end = WEEK_ORDER.indexOf(to);
  for (;;) {
    set.add(DAY_INDEX[WEEK_ORDER[i]!]!);
    if (i === end) break;
    i = (i + 1) % 7;
  }
}

function parseTimes(part: string): Interval[] | null {
  const intervals: Interval[] = [];
  for (const piece of part.split(',')) {
    const match = piece.match(/^(\d{1,2}):(\d{2})-(\d{1,2}):(\d{2})$/);
    if (!match) return null;
    const h1 = Number(match[1]);
    const m1 = Number(match[2]);
    const h2 = Number(match[3]);
    const m2 = Number(match[4]);
    if (h1 > 24 || h2 > 24 || m1 > 59 || m2 > 59) return null;
    intervals.push([h1 * 60 + m1, h2 * 60 + m2]);
  }
  return intervals;
}

function isOpenInSegments(segments: Segments, day: number, minute: number): boolean {
  return segments[day]!.some(([start, end]) => minute >= start && minute < end);
}

/**
 * The next instant the open/closed state flips, searching up to 8 days ahead.
 * Returns undefined when nothing changes in that window (e.g. always closed).
 */
function nextChange(segments: Segments, when: Date, currentlyOpen: boolean): string | undefined {
  const nowMinute = when.getHours() * 60 + when.getMinutes();
  const baseDay = when.getDay();

  const candidates: number[] = [];
  for (let offset = 0; offset <= 8; offset++) {
    const day = (baseDay + offset) % 7;
    for (const [start, end] of segments[day]!) {
      candidates.push(offset * 1440 + start, offset * 1440 + end);
    }
  }

  candidates.sort((a, b) => a - b);
  for (const candidate of candidates) {
    if (candidate <= nowMinute) continue;
    const day = (baseDay + Math.floor(candidate / 1440)) % 7;
    const open = isOpenInSegments(segments, day, candidate % 1440);
    if (open !== currentlyOpen) {
      const midnight = new Date(when.getFullYear(), when.getMonth(), when.getDate(), 0, 0, 0, 0);
      return new Date(midnight.getTime() + candidate * 60_000).toISOString();
    }
  }
  return undefined;
}
