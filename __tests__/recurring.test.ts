import { advance, dueOccurrences, monthlyEquivalent } from '@/lib/recurring';

describe('advance', () => {
  it('keeps the day-of-month anchor across short months', () => {
    expect(advance('2026-01-31', 'monthly', 31)).toBe('2026-02-28');
    expect(advance('2026-02-28', 'monthly', 31)).toBe('2026-03-31');
  });
  it('handles weekly and biweekly', () => {
    expect(advance('2026-09-01', 'weekly')).toBe('2026-09-08');
    expect(advance('2026-09-01', 'biweekly')).toBe('2026-09-15');
  });
  it('handles yearly across leap day', () => {
    expect(advance('2028-02-29', 'yearly')).toBe('2029-02-28');
  });
});

describe('dueOccurrences', () => {
  it('returns nothing when the next occurrence is in the future', () => {
    const r = dueOccurrences({ nextOccurrence: '2026-10-01', frequency: 'monthly' }, '2026-09-10');
    expect(r.due).toEqual([]);
    expect(r.nextOccurrence).toBe('2026-10-01');
  });
  it('catches up multiple missed periods', () => {
    const r = dueOccurrences({ nextOccurrence: '2026-08-15', frequency: 'weekly' }, '2026-09-10');
    expect(r.due).toEqual(['2026-08-15', '2026-08-22', '2026-08-29', '2026-09-05']);
    expect(r.nextOccurrence).toBe('2026-09-12');
  });
  it('includes today', () => {
    const r = dueOccurrences({ nextOccurrence: '2026-09-10', frequency: 'monthly' }, '2026-09-10');
    expect(r.due).toEqual(['2026-09-10']);
    expect(r.nextOccurrence).toBe('2026-10-10');
  });
});

describe('monthlyEquivalent', () => {
  it('converts frequencies', () => {
    expect(monthlyEquivalent({ amount: 12, frequency: 'monthly' })).toBe(12);
    expect(monthlyEquivalent({ amount: 120, frequency: 'yearly' })).toBe(10);
    expect(monthlyEquivalent({ amount: 10, frequency: 'weekly' })).toBeCloseTo(43.33, 1);
  });
});
