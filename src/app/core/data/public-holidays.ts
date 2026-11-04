/**
 * Workspace public holidays — shared by every user (single-company app).
 *
 * Maintained by the developer: add each year’s dates before that leave year starts.
 * Dates are ISO `yyyy-MM-dd`. Same calendar day can appear once with one name.
 */

export interface PublicHoliday {
  readonly date: string;
  readonly name: string;
}

/**
 * 2026 public holidays (office calendar).
 * Source “20/21 Oct” for Vijaya Dasami means either date — office observes 20 Oct 2026.
 */
export const PUBLIC_HOLIDAYS: readonly PublicHoliday[] = [
  { date: '2026-01-26', name: 'Republic Day' },
  { date: '2026-03-20', name: 'Ramzan / Eid ul Fitr' },
  { date: '2026-04-03', name: 'Good Friday' },
  { date: '2026-04-15', name: 'Vishu' },
  { date: '2026-05-01', name: 'May Day' },
  { date: '2026-05-27', name: 'Eid Al Adha / Bakrid' },
  { date: '2026-08-12', name: 'Karkidaka Vavu' },
  { date: '2026-08-25', name: 'Onam' },
  { date: '2026-08-26', name: 'Onam' },
  { date: '2026-10-02', name: 'Gandhi Jayanti' },
  { date: '2026-10-20', name: 'Vijaya Dasami' },
  { date: '2026-12-24', name: 'Christmas' },
  { date: '2026-12-25', name: 'Christmas' },
];

const byDate = new Map<string, PublicHoliday[]>();
for (const h of PUBLIC_HOLIDAYS) {
  const list = byDate.get(h.date);
  if (list) {
    list.push(h);
  } else {
    byDate.set(h.date, [h]);
  }
}

/** Holidays on a given ISO date (empty if none). */
export function holidaysOn(iso: string): readonly PublicHoliday[] {
  return byDate.get(iso) ?? [];
}

export function isPublicHoliday(iso: string): boolean {
  return byDate.has(iso);
}
