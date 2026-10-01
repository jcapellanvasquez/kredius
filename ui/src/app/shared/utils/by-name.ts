import { APP_LOCALE } from '../constants/locale';

/** Alphabetical by `name`, ignoring case and accents ("Ñame" after "Nómina", "educación" next to "Educación"). */
export function byName(a: { name: string }, b: { name: string }): number {
  return a.name.localeCompare(b.name, APP_LOCALE, { sensitivity: 'base' });
}
