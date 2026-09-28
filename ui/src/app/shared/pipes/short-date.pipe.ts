import { Pipe, PipeTransform } from '@angular/core';
import { APP_LOCALE } from '../constants/locale';

/** `2026-10-12` → "12 oct". Parses the date part as local time to avoid UTC day shifts. */
@Pipe({ name: 'shortDate' })
export class ShortDatePipe implements PipeTransform {
  transform(iso: string | null | undefined, withYear = false): string {
    if (!iso) return '';
    const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
    return new Date(y, m - 1, d)
      .toLocaleDateString(APP_LOCALE, { day: 'numeric', month: 'short', ...(withYear ? { year: 'numeric' } : {}) })
      .replace('.', '');
  }
}
