import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { IconComponent } from '../../../../../shared/components/icon/icon';
import { UiIcon } from '../../../../../shared/constants/ui-icons';
import { MoneyPipe } from '../../../../../shared/pipes/money.pipe';
import { ShortDatePipe } from '../../../../../shared/pipes/short-date.pipe';
import { BALANCE_TOLERANCE } from '../../budget.constants';
import { StatementAccountKind } from '../../budget.enums';
import { BUDGET_TEXT } from '../../budget.texts';
import { SavingsSummary } from '../../models/budget.models';

@Component({
  selector: 'app-savings-summary',
  imports: [IconComponent, MoneyPipe, ShortDatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <div class="card p-3 h-full">
      <p class="flex items-center gap-1 text-xs text-gray-500">
        <app-icon [name]="savings().icon" [size]="12" /> {{ text.kind[kind] }}
      </p>
      <p class="text-base font-medium text-gray-900 tabular-nums">{{ savings().balance | money }}</p>
      <p class="mt-1 text-xs text-gray-400 tabular-nums">{{ text.income }}: {{ savings().income | money }}</p>

      @if (savings().bankBalance; as bb) {
        <div class="mt-2 flex flex-col gap-0.5 text-xs tabular-nums" role="status">
          <div class="flex flex-wrap justify-between gap-x-2">
            <span class="text-gray-500">{{ text.ledgerBalanceAt }} {{ bb.date | shortDate }}</span>
            <span class="ml-auto whitespace-nowrap text-gray-700">{{ bb.ledger | money }}</span>
          </div>
          <div class="flex flex-wrap justify-between gap-x-2">
            <span class="text-gray-500">{{ text.bankBalanceAt }} {{ bb.date | shortDate }}</span>
            <span class="ml-auto whitespace-nowrap text-gray-700">{{ bb.bank | money }}</span>
          </div>
          @if (difference() === null) {
            <p class="flex items-center gap-0.5 text-gray-500">
              <app-icon [name]="icons.Check" [size]="12" /> {{ text.balanceMatches }}
            </p>
          } @else {
            <div class="flex flex-wrap justify-between gap-x-2 font-medium text-gray-900">
              <span>{{ text.balanceDifference }}</span>
              <span class="ml-auto whitespace-nowrap">{{ difference() | money }}</span>
            </div>
            <p class="text-gray-400">{{ text.balanceDifferenceHint }}</p>
          }
        </div>
      }

      @if (savings().loanPayments.length > 0) {
        <ul class="mt-3 pt-2 border-t border-gray-100 flex flex-col gap-1.5 text-xs tabular-nums" [attr.aria-label]="text.loans">
          @for (p of savings().loanPayments; track p.loanAccountId + '-' + p.installmentNumber) {
            <li>
              <p class="text-gray-700 truncate">{{ p.loanName }}</p>
              <p class="flex justify-between gap-2">
                <span class="text-gray-500">{{ text.installment(p.installmentNumber, p.totalInstallments) }}</span>
                <span class="whitespace-nowrap text-gray-700">{{ p.amount | money }}</span>
              </p>
            </li>
          }
        </ul>
      }

      @if (savings().cardPayments.length > 0) {
        <div class="mt-3 pt-2 border-t border-gray-100 text-xs tabular-nums">
          <p class="text-gray-700 mb-0.5">{{ text.cardPayments }}</p>
          <ul class="flex flex-col gap-0.5" [attr.aria-label]="text.cardPayments">
            @for (p of savings().cardPayments; track p.lineId) {
              <li class="flex justify-between gap-2">
                <span class="text-gray-500">{{ p.date | shortDate }}</span>
                <span class="whitespace-nowrap text-gray-700">{{ p.amount | money }}</span>
              </li>
            }
          </ul>
        </div>
      }
    </div>
  `,
})
export class SavingsSummaryComponent {
  readonly savings = input.required<SavingsSummary>();

  /** Ledger − bank at the statement date, or null when they match. */
  protected readonly difference = computed(() => {
    const bb = this.savings().bankBalance;
    if (!bb) return null;
    const diff = bb.ledger - bb.bank;
    return Math.abs(diff) < BALANCE_TOLERANCE ? null : diff;
  });

  protected readonly text = BUDGET_TEXT;
  protected readonly icons = UiIcon;
  protected readonly kind = StatementAccountKind.Savings;
}
