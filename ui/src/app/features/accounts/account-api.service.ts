import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { tap } from 'rxjs';
import { ApiConfiguration } from '../../api/api-configuration';
import { getAccountsSummary } from '../../api/fn/accounts/get-accounts-summary';
import { createAccount } from '../../api/fn/accounts/create-account';
import { AccountSummaryResponse } from '../../api/models/account-summary-response';
import { CreateAccountRequest } from '../../api/models/create-account-request';
import { AccountType } from '../../api/models/account-type';

@Injectable({ providedIn: 'root' })
export class AccountApiService {
  private readonly http = inject(HttpClient);
  private readonly rootUrl = inject(ApiConfiguration).rootUrl;

  readonly accounts = signal<AccountSummaryResponse[]>([]);
  readonly loading  = signal(false);

  load() {
    this.loading.set(true);
    return getAccountsSummary(this.http, this.rootUrl).pipe(
      tap({
        next: res => { this.accounts.set(res.body ?? []); this.loading.set(false); },
        error: () => this.loading.set(false),
      }),
    );
  }

  create(req: CreateAccountRequest) {
    return createAccount(this.http, this.rootUrl, { body: req }).pipe(
      tap(() => this.load().subscribe()),
    );
  }

  byType(type: AccountType): AccountSummaryResponse[] {
    return this.accounts().filter(a => a.type === type && !a.loanAccount);
  }

  loanAccounts(): AccountSummaryResponse[] {
    return this.accounts().filter(a => a.loanAccount);
  }
}
