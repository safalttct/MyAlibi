import { anomalyHints, yearNarrative } from './insights';

const FY = { start: '2026-04-01', end: '2027-03-31' };

describe('anomalyHints', () => {
  it('flags a sick streak longer than 2 days without a certificate note', () => {
    const hints = anomalyHints(
      [
        { category: 'Sick Leave', date: '2026-05-04', duration: 'Full Day', status: 'complete', notes: null },
        { category: 'Sick Leave', date: '2026-05-05', duration: 'Full Day', status: 'complete', notes: '' },
        { category: 'Sick Leave', date: '2026-05-06', duration: 'Full Day', status: 'complete', notes: 'fever' },
      ],
      '2026-05-10',
      FY,
    );
    expect(hints.map((h) => h.id)).toContain('sick-certificate');
  });

  it('skips the certificate hint when a note mentions a doctor', () => {
    const hints = anomalyHints(
      [
        { category: 'Sick Leave', date: '2026-05-04', duration: 'Full Day', status: 'complete', notes: null },
        { category: 'Sick Leave', date: '2026-05-05', duration: 'Full Day', status: 'complete', notes: 'Doctor certificate uploaded' },
        { category: 'Sick Leave', date: '2026-05-06', duration: 'Full Day', status: 'complete', notes: null },
      ],
      '2026-05-10',
      FY,
    );
    expect(hints.map((h) => h.id)).not.toContain('sick-certificate');
  });

  it('flags casual leave longer than 2 consecutive days', () => {
    const hints = anomalyHints(
      [
        { category: 'Casual Leave', date: '2026-06-01', duration: 'Full Day', status: 'complete', notes: null },
        { category: 'Casual Leave', date: '2026-06-02', duration: 'Half Day', status: 'complete', notes: null },
        { category: 'Casual Leave', date: '2026-06-03', duration: 'Full Day', status: 'complete', notes: null },
      ],
      '2026-06-10',
      FY,
    );
    expect(hints.find((h) => h.id === 'casual-advance')?.detail).toContain('2.5');
  });

  it('flags records that still need a duration', () => {
    const hints = anomalyHints(
      [{ category: 'Work From Home', date: '2026-07-01', duration: null, status: 'needs_review', notes: null }],
      '2026-07-02',
      FY,
    );
    expect(hints.map((h) => h.id)).toEqual(['needs-review']);
  });
});

describe('yearNarrative', () => {
  it('marks the last 90 days as year-end and lists remaining balances', () => {
    const story = yearNarrative({
      periodStart: FY.start,
      periodEnd: FY.end,
      asOf: '2027-02-01',
      balances: [
        { category: 'Casual Leave', label: 'Casual Leave', remaining: 4, used: 8, total: 12 },
        { category: 'Sick Leave', label: 'Sick Leave', remaining: 0, used: 12, total: 12 },
      ],
      compOffExpiring: [{ days: 1, expiry: '2027-03-12' }],
    });
    expect(story.closing).toBe(true);
    expect(story.headline).toBe('Heading into year-end');
    expect(story.lines.some((l) => l.includes('Casual Leave') && l.includes('4'))).toBe(true);
    expect(story.lines.some((l) => l.includes('fully used'))).toBe(true);
    expect(story.lines.some((l) => l.includes('Comp Off') && l.includes('12 Mar 2027'))).toBe(true);
  });

  it('uses a quieter headline earlier in the year', () => {
    const story = yearNarrative({
      periodStart: FY.start,
      periodEnd: FY.end,
      asOf: '2026-06-01',
      balances: [],
    });
    expect(story.closing).toBe(false);
    expect(story.headline).toBe('Where this year stands');
    expect(story.daysLeft).toBeGreaterThan(90);
  });
});
