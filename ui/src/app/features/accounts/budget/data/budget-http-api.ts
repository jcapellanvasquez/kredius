import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map, switchMap, throwError } from 'rxjs';
import { ApiConfiguration } from '../../../../api/api-configuration';
import { getAccounts } from '../../../../api/fn/accounts/get-accounts';
import { getBudgetScreen } from '../../../../api/fn/budget-screen/get-budget-screen';
import { saveExchangeRate } from '../../../../api/fn/exchange-rates/save-exchange-rate';
import { batchUpdateBudgets } from '../../../../api/fn/reports/batch-update-budgets';
import { getStatementImport } from '../../../../api/fn/statements/get-statement-import';
import { listStatementImports } from '../../../../api/fn/statements/list-statement-imports';
import { patchStatementLine } from '../../../../api/fn/statements/patch-statement-line';
import { recategorizeStatementLine } from '../../../../api/fn/statements/recategorize-statement-line';
import { uploadStatement } from '../../../../api/fn/statements/upload-statement';
import { AccountType } from '../../../../api/models/account-type';
import { BudgetCategoryOption } from '../../../../api/models/budget-category-option';
import { BudgetCategoryRow } from '../../../../api/models/budget-category-row';
import { BudgetLoanPayment } from '../../../../api/models/budget-loan-payment';
import { BudgetScreenResponse } from '../../../../api/models/budget-screen-response';
import { BudgetStatementTotals } from '../../../../api/models/budget-statement-totals';
import { BudgetTransactionLine } from '../../../../api/models/budget-transaction-line';
import { StatementImportSummaryResponse } from '../../../../api/models/statement-import-summary-response';
import { StatementLineDto } from '../../../../api/models/statement-line-dto';
import { StatementType } from '../../../../api/models/statement-type';
import { AccountIcon } from '../../../../shared/constants/account-icons';
import { Period } from '../../../../shared/utils/period';
import { KIND_ICON } from '../budget.constants';
import { CurrencyCode, ImportStatus, LineStatus, LoanKind, StatementAccountKind } from '../budget.enums';
import {
  BudgetScreen, BudgetUpdate, CategoryOption, CategoryRow, ImportDetail, ImportSummary, LoanPayment,
  StatementTotals, TransactionLine, UploadResult,
} from '../models/budget.models';
import { BudgetApi } from './budget-api';

const FAILED_IMPORT = 'FAILED';
const EXPENSE: AccountType = 'EXPENSE';
const INITIAL_BALANCE = 'INITIAL_BALANCE';
const CREDIT = 'CREDIT';

/**
 * `BudgetApi` over the real backend. Maps the generated DTOs to the screen's models: fills missing
 * icons with per-kind defaults, and treats a budget of 0 as "no budget" (clearing the input saves 0).
 */
@Injectable()
export class BudgetHttpApi extends BudgetApi {
  private readonly http = inject(HttpClient);
  private readonly rootUrl = inject(ApiConfiguration).rootUrl;

  getScreen(period: Period): Observable<BudgetScreen> {
    return getBudgetScreen(this.http, this.rootUrl, { period }).pipe(map(res => this.toScreen(res.body)));
  }

  getCategoryOptions(): Observable<CategoryOption[]> {
    return getAccounts(this.http, this.rootUrl, { type: EXPENSE }).pipe(
      map(res => res.body
        .filter(a => a.active !== false && !a.loanAccount && a.id != null)
        .map(a => ({ accountId: a.id as number, name: a.name ?? '', icon: a.icon ?? AccountIcon.Category }))),
    );
  }

  upload(kind: StatementAccountKind, file: File, statementDate: string): Observable<UploadResult> {
    return getAccounts(this.http, this.rootUrl).pipe(
      map(res => res.body.find(a => a.statementType === kind && a.active !== false)?.id),
      switchMap(accountId => accountId == null
        ? throwError(() => new Error(`No account for ${kind} statements`))
        : uploadStatement(this.http, this.rootUrl, {
          body: { file, accountId, type: kind as StatementType, statementDate },
        })),
      switchMap(res => {
        const imp = res.body;
        if (imp.status === FAILED_IMPORT) return throwError(() => new Error(imp.errorMessage ?? FAILED_IMPORT));
        return [{
          kind,
          newCount: imp.newCount ?? 0,
          autoPostedCount: imp.autoPostedCount ?? 0,
          uncategorizedCount: imp.uncategorizedCount ?? 0,
          uploadedAt: imp.uploadedAt ?? new Date().toISOString(),
        }];
      }),
    );
  }

  categorize(lineId: number, categoryId: number): Observable<void> {
    return patchStatementLine(this.http, this.rootUrl, { id: lineId, body: { categoryAccountId: categoryId } })
      .pipe(map(() => undefined));
  }

  recategorize(lineId: number, categoryId: number): Observable<void> {
    return recategorizeStatementLine(this.http, this.rootUrl, { id: lineId, body: { categoryAccountId: categoryId } })
      .pipe(map(() => undefined));
  }

  saveUsdRate(value: number): Observable<void> {
    return saveExchangeRate(this.http, this.rootUrl, { body: { value } }).pipe(map(() => undefined));
  }

  saveBudgets(period: Period, updates: BudgetUpdate[]): Observable<void> {
    return batchUpdateBudgets(this.http, this.rootUrl, { body: { period, updates } }).pipe(map(() => undefined));
  }

  listImports(): Observable<ImportSummary[]> {
    return listStatementImports(this.http, this.rootUrl).pipe(
      map(res => res.body
        .map(i => this.toImportSummary(i))
        .sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt))),
    );
  }

  getImport(id: number): Observable<ImportDetail> {
    return getStatementImport(this.http, this.rootUrl, { id }).pipe(
      map(res => {
        const imp = res.body;
        const kind = imp.type as StatementAccountKind;
        const lines = imp.lines ?? [];
        return {
          id: imp.id ?? id,
          kind,
          accountName: imp.accountName ?? '',
          statementDate: imp.statementDate ?? '',
          uploadedAt: imp.uploadedAt ?? '',
          fileName: imp.fileName ?? '',
          status: imp.status as ImportStatus,
          lineCount: lines.filter(l => l.lineType !== INITIAL_BALANCE).length,
          unresolvedCount: imp.uncategorizedCount ?? 0,
          lines: lines.map(l => this.toImportLine(l, kind)),
        };
      }),
    );
  }

  // ── Mapping ───────────────────────────────────────────────────────────────

  private toScreen(dto: BudgetScreenResponse): BudgetScreen {
    // The seed always has both statement accounts; without them the screen can't render.
    if (!dto.card || !dto.savings) throw new Error('No credit card or savings account (Account.statementType)');
    const { card, savings } = dto;
    return {
      period: dto.period,
      card: {
        accountId: card.accountId,
        name: card.name,
        icon: card.icon ?? KIND_ICON[StatementAccountKind.CreditCard],
        spent: card.spent,
        budget: positiveOrNull(card.budget),
        statement: card.statement ? {
          cutOffDate: card.statement.cutOffDate,
          paymentDueDate: card.statement.paymentDueDate ?? null,
          rd: toTotals(card.statement.rd),
          usd: card.statement.usd ? toTotals(card.statement.usd) : null,
        } : null,
        usdRate: card.usdRate ?? null,
      },
      savings: {
        accountId: savings.accountId,
        name: savings.name,
        icon: savings.icon ?? KIND_ICON[StatementAccountKind.Savings],
        balance: savings.balance,
        income: savings.income,
        loanPayments: (savings.loanPayments ?? []).map(toLoanPayment),
        bankBalance: savings.bankBalance ?? null,
      },
      lastUploads: dto.lastUploads.map(u => ({
        kind: u.kind as StatementAccountKind,
        accountId: u.accountId,
        uploadedAt: u.uploadedAt ?? null,
      })),
      uncategorized: dto.uncategorized.map(toTransaction),
      categories: dto.categories.map(toCategoryRow),
      loanOptions: (dto.loanOptions ?? []).map(toOption),
      incomeOptions: (dto.incomeOptions ?? []).map(toOption),
    };
  }

  private toImportSummary(i: StatementImportSummaryResponse): ImportSummary {
    return {
      id: i.id ?? 0,
      kind: i.type as StatementAccountKind,
      accountName: i.accountName ?? '',
      statementDate: i.statementDate ?? '',
      uploadedAt: i.uploadedAt ?? '',
      fileName: i.fileName ?? '',
      status: i.status as ImportStatus,
      lineCount: i.lineCount ?? 0,
      unresolvedCount: i.unresolvedCount ?? 0,
    };
  }

  /** Import detail lines are read-only: no suggestions. Payments and refunds show as negative. */
  private toImportLine(l: StatementLineDto, kind: StatementAccountKind): TransactionLine {
    const amount = l.lineType === CREDIT ? -(l.amount ?? 0) : (l.amount ?? 0);
    return {
      lineId: l.id ?? 0,
      date: l.lineDate ?? '',
      description: l.description ?? '',
      amount,
      currency: (l.currency ?? CurrencyCode.Rd) as CurrencyCode,
      originalAmount: amount,
      source: kind,
      sourceIcon: KIND_ICON[kind],
      status: l.posted ? LineStatus.Posted : LineStatus.Pending,
      categoryId: l.categoryAccountId ?? null,
      categoryName: l.categoryAccountName ?? null,
      suggestions: [],
    };
  }
}

function positiveOrNull(value: number | null | undefined): number | null {
  return value != null && value > 0 ? value : null;
}

function toTotals(t: BudgetStatementTotals): StatementTotals {
  return {
    charges: t.charges,
    credits: t.credits,
    previousBalance: t.previousBalance ?? null,
    balance: t.balance ?? null,
    minimumPayment: t.minimumPayment ?? null,
  };
}

function toOption(o: BudgetCategoryOption): CategoryOption {
  return { accountId: o.accountId, name: o.name, icon: o.icon ?? AccountIcon.Category };
}

function toLoanPayment(p: BudgetLoanPayment): LoanPayment {
  return {
    date: p.date,
    loanAccountId: p.loanAccountId,
    loanName: p.loanName,
    loanType: p.loanType as LoanKind,
    installmentNumber: p.installmentNumber,
    totalInstallments: p.totalInstallments ?? null,
    amount: p.amount,
    interest: p.interest,
  };
}

function toTransaction(t: BudgetTransactionLine): TransactionLine {
  const source = t.source as StatementAccountKind;
  return {
    lineId: t.lineId,
    date: t.date,
    description: t.description,
    amount: t.amount,
    currency: t.currency as CurrencyCode,
    originalAmount: t.originalAmount,
    source,
    sourceIcon: t.sourceIcon ?? KIND_ICON[source],
    status: t.status as LineStatus,
    categoryId: t.categoryId ?? null,
    categoryName: t.categoryName ?? null,
    suggestions: t.suggestions.map(toOption),
  };
}

function toCategoryRow(r: BudgetCategoryRow): CategoryRow {
  const budget = positiveOrNull(r.budget);
  return {
    accountId: r.accountId,
    name: r.name,
    icon: r.icon ?? AccountIcon.Category,
    actual: r.actual,
    budget,
    previousBudget: budget === null ? positiveOrNull(r.previousBudget) : null,
    origins: r.origins.map(o => o as StatementAccountKind),
    transactions: r.transactions.map(toTransaction),
    loanInterest: (r.loanInterest ?? []).map(toLoanPayment),
  };
}
