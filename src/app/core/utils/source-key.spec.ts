import { durationToDays } from '../models/leave.models';
import { buildSourceKey } from './source-key';

describe('buildSourceKey', () => {
  it('normalizes whitespace and case', () => {
    const a = buildSourceKey({ title: 'Sick Leave ', date: '2026-07-20', category: 'Sick Leave', duration: 'Full Day' });
    const b = buildSourceKey({ title: '  sick   leave', date: '2026-07-20', category: 'sick leave', duration: 'full day' });
    expect(a).toBe(b);
    expect(a).toBe('sick leave|2026-07-20|sick leave|full day');
  });

  it('differs by duration, date and category', () => {
    const base = { title: 'x', date: '2026-01-01', category: 'Casual Leave', duration: 'Full Day' } as const;
    expect(buildSourceKey(base)).not.toBe(buildSourceKey({ ...base, duration: 'Half Day' }));
    expect(buildSourceKey(base)).not.toBe(buildSourceKey({ ...base, date: '2026-01-02' }));
    expect(buildSourceKey(base)).not.toBe(buildSourceKey({ ...base, category: 'Sick Leave' }));
  });

  it('handles missing duration', () => {
    expect(buildSourceKey({ title: 'a', date: '2027-08-24', category: 'Compensatory Leave', duration: null })).toBe(
      'a|2027-08-24|compensatory leave|',
    );
  });
});

describe('durationToDays', () => {
  it('maps durations to days', () => {
    expect(durationToDays('Full Day')).toBe(1);
    expect(durationToDays('Half Day')).toBe(0.5);
    expect(durationToDays(null)).toBe(0);
    expect(durationToDays(undefined)).toBe(0);
  });
});
