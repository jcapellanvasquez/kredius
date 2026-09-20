import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { DatePipe, DecimalPipe, NgClass, NgTemplateOutlet } from '@angular/common';
import { AccountApiService } from './account-api.service';
import { AccountSummaryResponse } from '../../api/models/account-summary-response';

@Component({
  selector: 'app-accounts',
  imports: [RouterOutlet, RouterLink, FormsModule, DecimalPipe, DatePipe, NgClass, NgTemplateOutlet],
  templateUrl: './accounts.html',
  styleUrl: './accounts.css',
})
export class AccountsComponent implements OnInit {
  readonly accountSvc = inject(AccountApiService);

  showBudgetMode = false;
  showLoanPicker = false;
  showNavMenu    = false;

  readonly selectedKey  = signal<string | null>(null);
  readonly searchQuery  = signal('');

  selectAccount(id: number | undefined): void { this.selectedKey.set('a-' + id); }

  budgetDrafts: Partial<Record<number, number>> = {};

  readonly loading         = this.accountSvc.loading;
  readonly loanAccounts    = computed(() => this.accountSvc.loanAccounts());
  readonly assetAccounts   = computed(() => this.accountSvc.byType('ASSET'));
  readonly liabilAccounts  = computed(() => this.accountSvc.byType('LIABILITY'));
  readonly expenseAccounts = computed(() => this.accountSvc.byType('EXPENSE'));
  readonly incomeAccounts  = computed(() => this.accountSvc.byType('INCOME'));
  readonly equityAccounts  = computed(() => this.accountSvc.byType('EQUITY'));

  readonly hasAnyAccounts = computed(() =>
    this.assetAccounts().length > 0  ||
    this.liabilAccounts().length > 0  ||
    this.equityAccounts().length > 0  ||
    this.loanAccounts().length > 0    ||
    this.expenseAccounts().length > 0 ||
    this.incomeAccounts().length > 0
  );

  readonly filteredAsset   = computed(() => this.filter(this.assetAccounts()));
  readonly filteredLiabil  = computed(() => this.filter(this.liabilAccounts()));
  readonly filteredEquity  = computed(() => this.filter(this.equityAccounts()));
  readonly filteredExpense = computed(() => this.filter(this.expenseAccounts()));
  readonly filteredIncome  = computed(() => this.filter(this.incomeAccounts()));
  readonly filteredLoans   = computed(() => this.filterLoans(this.loanAccounts()));

  readonly hasSearchResults = computed(() =>
    this.filteredAsset().length > 0   ||
    this.filteredLiabil().length > 0  ||
    this.filteredEquity().length > 0  ||
    this.filteredLoans().length > 0   ||
    this.filteredExpense().length > 0 ||
    this.filteredIncome().length > 0
  );

  ngOnInit() {
    this.accountSvc.load().subscribe();
  }

  accountLabel(a: AccountSummaryResponse): string {
    const name = a.name ?? '';
    return a.code ? `${a.code} ${name}` : name;
  }

  private matches(a: AccountSummaryResponse, q: string): boolean {
    return this.accountLabel(a).toLowerCase().includes(q);
  }

  private filter(list: AccountSummaryResponse[]): AccountSummaryResponse[] {
    const q = this.searchQuery().trim().toLowerCase();
    return q ? list.filter(a => this.matches(a, q)) : list;
  }

  private filterLoans(list: AccountSummaryResponse[]): AccountSummaryResponse[] {
    const q = this.searchQuery().trim().toLowerCase();
    if (!q) return list;
    return list.filter(a =>
      this.matches(a, q) ||
      (a.loanCounterpartyName?.toLowerCase().includes(q) ?? false)
    );
  }

  saveBudget(): void   { this.budgetDrafts = {}; this.showBudgetMode = false; }
  cancelBudget(): void { this.budgetDrafts = {}; this.showBudgetMode = false; }
}
