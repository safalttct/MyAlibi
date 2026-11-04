import { parseLeaveCsv, parseLongDate } from './csv-parse-leave';

const ORDER_A = [
  'Entry,Date,Category,Month,Type,Notes',
  '"Casual Leave ","June 24, 2026",Casual Leave,Jun 2026,Half Day,',
  '" home renovation work","April 1, 2026",Work From Home,Apr 2026,Full Day,renovation',
].join('\n');

const ORDER_B = [
  'Entry,Category,Date,Month,Notes,Type',
  '"Casual Leave ",Casual Leave,"June 24, 2026",Jun 2026,,Half Day',
  '" home renovation work",Work From Home,"April 1, 2026",Apr 2026,renovation,Full Day',
].join('\n');

describe('parseLongDate', () => {
  it('parses without timezone shift', () => {
    expect(parseLongDate('April 1, 2026')).toBe('2026-04-01');
    expect(parseLongDate('December 31, 2026')).toBe('2026-12-31');
    expect(parseLongDate('Sept 3, 2026')).toBe('2026-09-03');
    expect(parseLongDate('2026-04-01')).toBe('2026-04-01');
  });

  it('rejects impossible dates', () => {
    expect(parseLongDate('February 30, 2026')).toBeNull();
    expect(parseLongDate('Smarch 1, 2026')).toBeNull();
    expect(parseLongDate('')).toBeNull();
  });
});

describe('parseLeaveCsv', () => {
  it('is independent of column order', () => {
    const a = parseLeaveCsv(ORDER_A, 'a.csv');
    const b = parseLeaveCsv(ORDER_B, 'b.csv');
    expect(a.errors).toEqual([]);
    expect(b.errors).toEqual([]);
    const strip = (r: ReturnType<typeof parseLeaveCsv>) =>
      r.rows.map((row) => ({ ...row, rowNumber: 0, sourceFile: '' }));
    expect(strip(a)).toEqual(strip(b));
  });

  it('trims, normalizes category and maps durations', () => {
    const { rows } = parseLeaveCsv(ORDER_A);
    expect(rows[0]).toMatchObject({
      title: 'Casual Leave',
      category: 'Annual Leave',
      date: '2026-06-24',
      duration: 'Half Day',
      status: 'complete',
      valid: true,
    });
    expect(rows[1].title).toBe('home renovation work');
    expect(rows[1].notes).toBe('renovation');
  });

  it('marks rows without duration as needs_review', () => {
    const csv = 'Entry,Category,Date,Month,Notes,Type\nCompensatory Leave,Compensatory Leave,"August 24, 2027",,,';
    const { rows } = parseLeaveCsv(csv);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      status: 'needs_review',
      duration: null,
      date: '2027-08-24',
      valid: true,
    });
    expect(rows[0].issues).toContain('Missing duration');
  });

  it('flags invalid category/date and missing headers', () => {
    const bad = parseLeaveCsv('Entry,Category,Date,Type\nx,Nonsense,"Foo 1, 2026",Full Day');
    expect(bad.rows[0].valid).toBe(false);
    expect(bad.rows[0].issues).toHaveLength(2);

    const missing = parseLeaveCsv('Entry,Type\nx,Full Day');
    expect(missing.errors.length).toBeGreaterThan(0);
  });
});
