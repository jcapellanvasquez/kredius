import { Component, OnInit, computed, inject } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { DatePipe, DecimalPipe, NgTemplateOutlet } from '@angular/common';
import { AccountApiService } from './account-api.service';
import { AccountSummaryResponse } from '../../api/models/account-summary-response';

@Component({
  selector: 'app-accounts',
  imports: [RouterOutlet, RouterLink, FormsModule, DecimalPipe, DatePipe, NgTemplateOutlet],
  templateUrl: './accounts.html',
  styleUrl: './accounts.css',
})
export class AccountsComponent implements OnInit {
  readonly accountSvc = inject(AccountApiService);

  showBudgetMode = false;
  showLoanPicker = false;
  showNavMenu    = false;

  budgetDrafts: Partial<Record<number, number>> = {};

  readonly loading         = this.accountSvc.loading;
  readonly loanAccounts    = computed(() => this.accountSvc.loanAccounts());
  readonly assetAccounts   = computed(() => this.accountSvc.byType('ASSET'));
  readonly liabilAccounts  = computed(() => this.accountSvc.byType('LIABILITY'));
  readonly expenseAccounts = computed(() => this.accountSvc.byType('EXPENSE'));
  readonly incomeAccounts  = computed(() => this.accountSvc.byType('INCOME'));
  readonly equityAccounts  = computed(() => this.accountSvc.byType('EQUITY'));

  ngOnInit() {
    this.accountSvc.load().subscribe();
  }

  accountLabel(a: AccountSummaryResponse): string {
    const name = a.name ?? '';
    return a.code ? `${a.code} ${name}` : name;
  }

  saveBudget(): void   { this.budgetDrafts = {}; this.showBudgetMode = false; }
  cancelBudget(): void { this.budgetDrafts = {}; this.showBudgetMode = false; }
}
