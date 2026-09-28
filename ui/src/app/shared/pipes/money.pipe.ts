import { Pipe, PipeTransform } from '@angular/core';
import { APP_LOCALE, CURRENCY_PREFIX, NEGATIVE_SIGN } from '../constants/locale';

/** Formats RD$ amounts: `12800 | money` → "RD$12,800", `-100 | money:2` → "−RD$100.00". */
@Pipe({ name: 'money' })
export class MoneyPipe implements PipeTransform {
  transform(value: number | null | undefined, decimals = 0, withPrefix = true): string {
    if (value == null) return '';
    const formatted = Math.abs(value).toLocaleString(APP_LOCALE, {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
    const sign = value < 0 ? NEGATIVE_SIGN : '';
    return `${sign}${withPrefix ? CURRENCY_PREFIX : ''}${formatted}`;
  }
}
