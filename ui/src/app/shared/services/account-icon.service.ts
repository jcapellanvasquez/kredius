import { Injectable, signal } from '@angular/core';
import { AccountType } from '../../api/models/account-type';
import { DEFAULT_ICON_BY_ACCOUNT_TYPE, FALLBACK_ACCOUNT_ICON } from '../constants/account-icons';

const STORAGE_KEY = 'kredius.accountIcons';

/**
 * Temporary per-browser store for account icons until the backend exposes `Account.icon`.
 * Replace reads with the API field and drop this service once it exists.
 */
@Injectable({ providedIn: 'root' })
export class AccountIconService {
  private readonly icons = signal<Record<number, string>>(this.read());

  iconFor(accountId: number | null | undefined, type?: AccountType | null): string {
    const stored = accountId != null ? this.icons()[accountId] : undefined;
    return stored ?? (type ? DEFAULT_ICON_BY_ACCOUNT_TYPE[type] : FALLBACK_ACCOUNT_ICON);
  }

  setIcon(accountId: number, icon: string): void {
    this.icons.update(map => ({ ...map, [accountId]: icon }));
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.icons()));
    } catch {
      // Storage unavailable (private mode, blocked): keep the in-memory value only.
    }
  }

  private read(): Record<number, string> {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');
    } catch {
      return {};
    }
  }
}
