import { APP_LOCALE } from '../constants/locale';

/**
 * A period is always the first day of a month, formatted `YYYY-MM-01`.
 * Built from local date parts — never via toISOString(), which shifts to UTC.
 */
export type Period = string;

export function toPeriod(year: number, monthIndex: number): Period {
  const d = new Date(year, monthIndex, 1);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-01`;
}

/** A local calendar date as `YYYY-MM-DD` (never via toISOString(), which shifts to UTC). */
export function toIsoDate(date: Date = new Date()): string {
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${mm}-${dd}`;
}

export function currentPeriod(today: Date = new Date()): Period {
  return toPeriod(today.getFullYear(), today.getMonth());
}

export function parsePeriod(period: Period): { year: number; monthIndex: number } {
  const [year, month] = period.split('-').map(Number);
  return { year, monthIndex: month - 1 };
}

export function shiftPeriod(period: Period, deltaMonths: number): Period {
  const { year, monthIndex } = parsePeriod(period);
  return toPeriod(year, monthIndex + deltaMonths);
}

/** The period as a `YYYY-MM` URL value. */
export function toMonthParam(period: Period): string {
  return period.slice(0, 7);
}

/** A `YYYY-MM` URL value as a period, or null when it isn't one. */
export function fromMonthParam(value: string | null | undefined): Period | null {
  return value && /^\d{4}-(0[1-9]|1[0-2])$/.test(value) ? `${value}-01` : null;
}

/** e.g. "sept 2026" */
export function periodLabel(period: Period): string {
  const { year, monthIndex } = parsePeriod(period);
  const month = new Date(year, monthIndex, 1).toLocaleDateString(APP_LOCALE, { month: 'short' });
  return `${month.replace('.', '')} ${year}`;
}

/** True when an ISO date (`YYYY-MM-DD…`) falls inside the period's month. */
export function isInPeriod(isoDate: string, period: Period): boolean {
  return isoDate.slice(0, 7) === period.slice(0, 7);
}
