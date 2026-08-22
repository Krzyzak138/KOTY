import { describe, expect, it } from 'vitest';
import { buildHistory, CareEvent, Feeding, groupHistory, latestCareFor, latestFor, localDate, millisecondsUntilNextReset, trackingDate } from './domain';

const base: Feeding = {
  id: '1', cat: 'Angela', meal: 'morning', fedAt: '2026-08-22T05:31:00.000Z',
  fedBy: 'Marek', localDate: '2026-08-22', batchId: null,
};

describe('feeding domain', () => {
  it('uses a local calendar date', () => {
    expect(localDate(new Date(2026, 7, 22, 23, 59))).toBe('2026-08-22');
  });

  it('keeps the previous app day until 01:59 and resets at 02:00', () => {
    expect(trackingDate(new Date(2026, 7, 23, 1, 59))).toBe('2026-08-22');
    expect(trackingDate(new Date(2026, 7, 23, 2, 0))).toBe('2026-08-23');
  });

  it('schedules the next refresh exactly at 02:00', () => {
    expect(millisecondsUntilNextReset(new Date(2026, 7, 23, 1, 59, 30))).toBe(30_000);
    expect(millisecondsUntilNextReset(new Date(2026, 7, 23, 2, 0))).toBe(24 * 60 * 60 * 1000);
  });

  it('returns the newest matching feeding', () => {
    const newer = { ...base, id: '2', fedAt: '2026-08-22T06:00:00.000Z' };
    expect(latestFor([base, newer], '2026-08-22', 'Angela', 'morning')?.id).toBe('2');
    expect(latestFor([base], '2026-08-23', 'Angela', 'morning')).toBeUndefined();
  });

  it('groups both cats saved by one action', () => {
    const pair = [
      { ...base, batchId: 'pair' },
      { ...base, id: '2', cat: 'Basta' as const, batchId: 'pair' },
    ];
    expect(groupHistory(pair)).toHaveLength(1);
    expect(groupHistory(pair)[0]).toHaveLength(2);
  });

  it('returns the latest care event for the selected cat', () => {
    const event: CareEvent = {
      id: 'care-1', activity: 'play', cat: 'Angela', doneAt: '2026-08-22T10:00:00.000Z',
      doneBy: 'Laura', localDate: '2026-08-22',
    };
    expect(latestCareFor([event], '2026-08-22', 'play', 'Angela')?.id).toBe('care-1');
    expect(latestCareFor([event], '2026-08-22', 'play', 'Basta')).toBeUndefined();
  });

  it('combines feeding and care in chronological history', () => {
    const event: CareEvent = {
      id: 'care-1', activity: 'litter', cat: null, doneAt: '2026-08-22T20:00:00.000Z',
      doneBy: 'Karolina', localDate: '2026-08-22',
    };
    const history = buildHistory([base], [event]);
    expect(history[0]?.title).toBe('Angela + Basta · kuweta');
    expect(history[1]?.title).toContain('Angela');
  });
});
