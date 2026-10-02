import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { IconComponent } from '../../../../../shared/components/icon/icon';
import { UiIcon } from '../../../../../shared/constants/ui-icons';
import { MoneyPipe } from '../../../../../shared/pipes/money.pipe';
import { Period, monthName, shiftPeriod } from '../../../../../shared/utils/period';
import { BALANCE_TOLERANCE } from '../../budget.constants';
import { StatementAccountKind } from '../../budget.enums';
import { BUDGET_TEXT } from '../../budget.texts';
import { SavingsSummary } from '../../models/budget.models';

/**
 * Savings, collapsed: the balance and the month's money outside the budget categories (income, card
 * and loan payments), plus whether it matches the bank. Lists and the bank figures are in "Ver detalles".
 */
@Component({
  selector: 'app-savings-summary',
  imports: [IconComponent, MoneyPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <div class="card p-3 h-full flex flex-col">
      <p class="flex items-center gap-1 text-meta text-gray-500">
        <app-icon [name]="savings().icon" [size]="12" /> {{ text.kind[kind] }}
      </p>
      <p class="text-body font-medium text-gray-900 tabular-nums">{{ savings().balance | money }}</p>
      @if (trend(); as t) {
        <p class="text-meta tabular-nums">
          @switch (t.direction) {
            @case ('up') {
              <span class="sr-only">{{ text.savingsTrend('up', previousMonth()) }}</span>
              <span class="font-medium text-income" aria-hidden="true">↑</span>
              <span class="font-medium text-income">{{ t.change | money: 2 : false }}</span>
            }
            @case ('down') {
              <span class="sr-only">{{ text.savingsTrend('down', previousMonth()) }}</span>
              <span class="font-medium text-bar-warning" aria-hidden="true">↓</span>
              <span class="font-medium text-bar-warning">{{ t.change | money: 2 : false }}</span>
            }
            @default {
              <span class="text-gray-400">= {{ text.noChange }}</span>
            }
          }
          <span class="text-gray-400">{{ text.versus(previousMonth()) }}</span>
        </p>
      }

      <div class="mt-3 pt-2 border-t border-gray-100 flex flex-col gap-1 flex-1 text-meta tabular-nums">
        <p class="text-gray-500">{{ text.outsideCategories }}</p>
        <div class="flex justify-between gap-2">
          <span class="text-gray-500">{{ text.monthIncome }}</span>
          <span class="whitespace-nowrap text-gray-700">{{ savings().income | money }}</span>
        </div>
        <div class="flex justify-between gap-2">
          <span class="text-gray-500">{{ text.cardPayments }}</span>
          <span class="whitespace-nowrap text-gray-700">{{ cardPaid() | money }}</span>
        </div>
        <div class="flex justify-between gap-2">
          <span class="text-gray-500">{{ text.loans }}</span>
          <span class="whitespace-nowrap text-gray-700">{{ loansPaid() | money }}</span>
        </div>
        @if (savings().bankBalance) {
          <div role="status">
            @if (difference() === null) {
              <p class="flex items-center gap-0.5 text-gray-500">
                <app-icon [name]="icons.Check" [size]="12" /> {{ text.balanceMatches }}
              </p>
            } @else {
              <div class="flex flex-wrap justify-between gap-x-2 font-medium text-gray-900">
                <span>{{ text.balanceDifference }}</span>
                <span class="ml-auto whitespace-nowrap">{{ difference() | money }}</span>
              </div>
            }
          </div>
        }

        @if (hasDetails()) {
          <button type="button" (click)="toggleDetails.emit()" [attr.aria-expanded]="detailsOpen()" [attr.aria-controls]="detailsId()"
            class="mt-auto pt-1 self-end inline-flex items-center gap-0.5 hover:text-gray-900 transition-colors"
            [class.text-gray-900]="detailsOpen()" [class.text-gray-500]="!detailsOpen()">
            {{ detailsOpen() ? text.hideDetails : text.showDetails }}
            <app-icon [name]="icons.ChevronDown" [size]="12" class="transition-transform" [class.rotate-180]="detailsOpen()" />
          </button>
        }
      </div>
    </div>
  `,
})
export class SavingsSummaryComponent {
  readonly savings = input.required<SavingsSummary>();
  /** The month shown, for the "vs <previous month>" label. */
  readonly period = input.required<Period>();
  /** Whether the shared details panel shows the savings details. */
  readonly detailsOpen = input(false);
  /** Id of the details panel, for `aria-controls`. */
  readonly detailsId = input<string | null>(null);
  readonly toggleDetails = output<void>();

  /** Ledger − bank at the statement date, or null when they match. */
  protected readonly difference = computed(() => {
    const bb = this.savings().bankBalance;
    if (!bb) return null;
    const diff = bb.ledger - bb.bank;
    return Math.abs(diff) < BALANCE_TOLERANCE ? null : diff;
  });

  /** The details panel has the bank check or a payment list to show. */
  protected readonly hasDetails = computed(() => {
    const s = this.savings();
    return !!s.bankBalance || s.loanPayments.length > 0 || s.cardPayments.length > 0;
  });

  /** Change against the previous month's closing balance; null in the account's first month. */
  protected readonly trend = computed(() => {
    const { balance, previousBalance } = this.savings();
    if (previousBalance === null) return null;
    const diff = balance - previousBalance;
    const direction = Math.abs(diff) < BALANCE_TOLERANCE ? 'flat' : diff > 0 ? 'up' : 'down';
    return { direction, change: Math.abs(diff) } as const;
  });
  protected readonly previousMonth = computed(() => monthName(shiftPeriod(this.period(), -1)));

  protected readonly cardPaid = computed(() => this.savings().cardPayments.reduce((sum, p) => sum + p.amount, 0));
  protected readonly loansPaid = computed(() => this.savings().loanPayments.reduce((sum, p) => sum + p.amount, 0));

  protected readonly text = BUDGET_TEXT;
  protected readonly icons = UiIcon;
  protected readonly kind = StatementAccountKind.Savings;
}
