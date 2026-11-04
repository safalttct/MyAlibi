import { holidaysOn, isPublicHoliday, PUBLIC_HOLIDAYS } from './public-holidays';

describe('public holidays', () => {
  it('includes the 2026 office calendar', () => {
    expect(PUBLIC_HOLIDAYS.length).toBeGreaterThanOrEqual(13);
    expect(holidaysOn('2026-01-26').map((h) => h.name)).toEqual(['Republic Day']);
    expect(holidaysOn('2026-08-25')[0]?.name).toBe('Onam');
    expect(holidaysOn('2026-08-26')[0]?.name).toBe('Onam');
    expect(isPublicHoliday('2026-10-20')).toBe(true);
    expect(isPublicHoliday('2026-10-21')).toBe(false);
    expect(isPublicHoliday('2026-12-25')).toBe(true);
    expect(isPublicHoliday('2026-07-01')).toBe(false);
  });
});
