import { describe, expect, it } from 'vitest';
import { isOpenAt } from './hours';

// Anchored in the first week of 2026. Jan 1 2026 is a Thursday, so:
const mon = (h: number, m = 0): Date => new Date(2026, 0, 5, h, m); // Mon 2026-01-05
const tue = (h: number, m = 0): Date => new Date(2026, 0, 6, h, m);
const wed = (h: number, m = 0): Date => new Date(2026, 0, 7, h, m);
const sat = (h: number, m = 0): Date => new Date(2026, 0, 10, h, m);
const sun = (h: number, m = 0): Date => new Date(2026, 0, 11, h, m);

describe('isOpenAt — weekday calendar sanity', () => {
  it('uses the expected weekdays for the fixture dates', () => {
    expect(mon(0).getDay()).toBe(1);
    expect(sat(0).getDay()).toBe(6);
    expect(sun(0).getDay()).toBe(0);
  });
});

describe('isOpenAt — always open / closed', () => {
  it('treats 24/7 as always open with no next change', () => {
    expect(isOpenAt('24/7', mon(3)).state).toBe('open');
    expect(isOpenAt('24/7', sun(23, 59)).state).toBe('open');
    expect(isOpenAt('24/7', mon(3)).nextChange).toBeUndefined();
  });

  it('treats off / closed as closed', () => {
    expect(isOpenAt('off', mon(12)).state).toBe('closed');
    expect(isOpenAt('closed', mon(12)).state).toBe('closed');
  });
});

describe('isOpenAt — basic weekday + time ranges', () => {
  const oh = 'Mo-Fr 09:00-17:00';

  it('is open during hours on a covered day', () => {
    expect(isOpenAt(oh, mon(10)).state).toBe('open');
  });

  it('is closed before/after hours and on uncovered days', () => {
    expect(isOpenAt(oh, mon(8)).state).toBe('closed');
    expect(isOpenAt(oh, mon(17)).state).toBe('closed'); // end is exclusive
    expect(isOpenAt(oh, sat(10)).state).toBe('closed');
  });

  it('reports the next change at the closing time when open', () => {
    const result = isOpenAt(oh, mon(10));
    expect(result.nextChange).toBeDefined();
    const change = new Date(result.nextChange!);
    expect(change.getDay()).toBe(1);
    expect(change.getHours()).toBe(17);
  });

  it('reports the next change at the opening time when closed', () => {
    const result = isOpenAt(oh, mon(8));
    const change = new Date(result.nextChange!);
    expect(change.getDay()).toBe(1);
    expect(change.getHours()).toBe(9);
  });
});

describe('isOpenAt — overnight (midnight-wrapping) ranges', () => {
  const oh = 'Tu 22:00-02:00';

  it('is open late on the start day', () => {
    expect(isOpenAt(oh, tue(23)).state).toBe('open');
  });

  it('spills into the early hours of the next day', () => {
    expect(isOpenAt(oh, wed(1)).state).toBe('open');
    expect(isOpenAt(oh, wed(3)).state).toBe('closed');
  });

  it('is closed before opening', () => {
    expect(isOpenAt(oh, tue(21)).state).toBe('closed');
  });
});

describe('isOpenAt — breaks and lists', () => {
  it('honours a midday break', () => {
    const oh = 'Mo 08:00-12:00,13:00-18:00';
    expect(isOpenAt(oh, mon(9)).state).toBe('open');
    expect(isOpenAt(oh, mon(12, 30)).state).toBe('closed');
    expect(isOpenAt(oh, mon(13)).state).toBe('open');
  });

  it('handles weekday lists', () => {
    const oh = 'Mo,We,Fr 09:00-12:00';
    expect(isOpenAt(oh, wed(10)).state).toBe('open');
    expect(isOpenAt(oh, tue(10)).state).toBe('closed');
  });

  it('handles wrapping weekday ranges (Fr-Mo)', () => {
    const oh = 'Fr-Mo 10:00-14:00';
    expect(isOpenAt(oh, sun(12)).state).toBe('open');
    expect(isOpenAt(oh, wed(12)).state).toBe('closed');
  });

  it('treats 00:00-24:00 as open all day', () => {
    expect(isOpenAt('Mo 00:00-24:00', mon(23, 59)).state).toBe('open');
  });
});

describe('isOpenAt — public holidays', () => {
  it('skips PH rules and evaluates the regular schedule', () => {
    const oh = 'Mo-Su 10:00-20:00; PH off';
    expect(isOpenAt(oh, mon(11)).state).toBe('open');
  });

  it('returns unknown for holiday-only strings (no regular schedule to justify)', () => {
    // PH/SH rules are skipped (no holiday calendar); with nothing else, there is
    // no schedule we can justify a state from — must be unknown, not closed.
    expect(isOpenAt('PH off', mon(12)).state).toBe('unknown');
    expect(isOpenAt('SH closed', mon(12)).state).toBe('unknown');
    expect(isOpenAt('PH 09:00-12:00', mon(12)).state).toBe('unknown');
  });
});

describe('isOpenAt — unknown / unsupported', () => {
  it('returns unknown for empty or missing values', () => {
    expect(isOpenAt('', mon(12)).state).toBe('unknown');
    expect(isOpenAt(undefined, mon(12)).state).toBe('unknown');
  });

  it('returns unknown (never a guess) for grammar it cannot evaluate', () => {
    expect(isOpenAt('sunrise-sunset', mon(12)).state).toBe('unknown');
    expect(isOpenAt('dawn-dusk', mon(12)).state).toBe('unknown');
    expect(isOpenAt('Mo 08:00+', mon(12)).state).toBe('unknown');
    expect(isOpenAt('Apr-Sep 10:00-18:00', mon(12)).state).toBe('unknown');
    expect(isOpenAt('2026 Jan 01 off', mon(12)).state).toBe('unknown');
    expect(isOpenAt('week 1-20 Mo 09:00-17:00', mon(12)).state).toBe('unknown');
  });
});
