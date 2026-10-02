import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { IconComponent } from '../../../../../shared/components/icon/icon';
import { UiIcon } from '../../../../../shared/constants/ui-icons';
import { MoneyPipe } from '../../../../../shared/pipes/money.pipe';
import { ShortDatePipe } from '../../../../../shared/pipes/short-date.pipe';
import { BALANCE_TOLERANCE } from '../../budget.constants';
import { BUDGET_TEXT } from '../../budget.texts';
import { SavingsSummary } from '../../models/budget.models';

/** Savings in full, inside the shared details panel: the bank check, loan payments and card payments. */
@Component({
  selector: 'app-savings-details',
  imports: [IconComponent, MoneyPipe, ShortDatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <div class="max-w-md flex flex-col gap-3 text-xs tabular-nums">
      @if (savings().bankBalance; as bb) {
        <div class="flex flex-col gap-0.5">
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
        <div class="pt-2 border-t border-gray-100 first:pt-0 first:border-t-0">
          <p class="text-gray-700 mb-0.5">{{ text.loans }}</p>
          <ul class="flex flex-col gap-1" [attr.aria-label]="text.loans">
            @for (p of savings().loanPayments; track p.loanAccountId + '-' + p.installmentNumber) {
              <li class="flex justify-between gap-2">
                <span class="text-gray-500 truncate">{{ p.loanName }} · {{ text.installment(p.installmentNumber, p.totalInstallments) }}</span>
                <span class="whitespace-nowrap text-gray-700">{{ p.amount | money }}</span>
              </li>
            }
          </ul>
        </div>
      }

      @if (savings().cardPayments.length > 0) {
        <div class="pt-2 border-t border-gray-100 first:pt-0 first:border-t-0">
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
export class SavingsDetailsComponent {
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
}
