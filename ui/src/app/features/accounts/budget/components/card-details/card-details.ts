import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { CURRENCY_PREFIX, USD_PREFIX } from '../../../../../shared/constants/locale';
import { MoneyPipe } from '../../../../../shared/pipes/money.pipe';
import { ShortDatePipe } from '../../../../../shared/pipes/short-date.pipe';
import { BALANCE_TOLERANCE } from '../../budget.constants';
import { BUDGET_TEXT } from '../../budget.texts';
import { CardStatement } from '../../models/budget.models';

/** The card statement in full, inside the shared details panel: RD$/US$ figures and the balance check. */
@Component({
  selector: 'app-card-details',
  imports: [MoneyPipe, ShortDatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    @let st = statement();
    <div class="max-w-md text-xs tabular-nums">
      <table class="w-full">
        @if (st.usd) {
          <thead>
            <tr class="text-gray-400">
              <th class="sr-only">{{ text.cutOff }}</th>
              <th class="text-right font-normal">{{ prefix.rd }}</th>
              <th class="text-right font-normal pl-3">{{ prefix.usd }}</th>
            </tr>
          </thead>
        }
        <tbody>
          @for (row of rows(); track row.label) {
            <tr [class.font-medium]="row.strong" [class.text-gray-900]="row.strong">
              <th scope="row" class="text-left font-normal text-gray-500 pr-2">{{ row.label }}</th>
              <td class="text-right whitespace-nowrap">{{ row.rd | money: 2 : !st.usd }}</td>
              @if (st.usd) {
                <td class="text-right whitespace-nowrap pl-3">{{ row.usd | money: 2 : false }}</td>
              }
            </tr>
          }
        </tbody>
      </table>

      <div class="mt-3 pt-2 border-t border-gray-100 flex flex-col gap-0.5">
        <div class="flex flex-wrap justify-between gap-x-2">
          <span class="text-gray-500">{{ text.ledgerBalanceAt }} {{ st.cutOffDate | shortDate }}</span>
          <span class="ml-auto whitespace-nowrap text-gray-700">{{ st.check.ledger | money }}</span>
        </div>
        <div class="flex flex-wrap justify-between gap-x-2">
          <span class="text-gray-500">{{ text.bankBalanceAt }} {{ st.cutOffDate | shortDate }}</span>
          <span class="ml-auto whitespace-nowrap text-gray-700">{{ st.rd.balance | money }}</span>
        </div>
        @if (st.check.pendingCount > 0) {
          <div class="flex flex-wrap justify-between gap-x-2 pl-2">
            <span class="text-gray-500">{{ text.cardPending(st.check.pendingCount) }}</span>
            <span class="ml-auto whitespace-nowrap text-gray-700">{{ st.check.pending | money }}</span>
          </div>
        }
        @if (hasPaymentsToReconcile()) {
          <div class="flex flex-wrap justify-between gap-x-2 pl-2">
            <span class="text-gray-500">{{ text.cardPaymentsToReconcile }}</span>
            <span class="ml-auto whitespace-nowrap text-gray-700">{{ st.check.paymentsToReconcile | money }}</span>
          </div>
          <p class="pl-2 text-gray-400">{{ text.cardPaymentsHint }}</p>
        }
        @if (st.check.usdCharges > 0) {
          <p class="text-gray-500">
            {{ text.usdPosted(st.check.usdPosted, st.check.usdCharges) }}
            @if (usdRate() === null) { · {{ text.usdNeedsRate }} }
          </p>
        }
      </div>
    </div>
  `,
})
export class CardDetailsComponent {
  readonly statement = input.required<CardStatement>();
  readonly usdRate = input<number | null>(null);

  protected readonly text = BUDGET_TEXT;
  protected readonly prefix = { rd: CURRENCY_PREFIX, usd: USD_PREFIX };

  protected readonly hasPaymentsToReconcile = computed(
    () => Math.abs(this.statement().check.paymentsToReconcile) >= BALANCE_TOLERANCE,
  );

  /** Previous balance, charges, credits (negative), balance and minimum payment (with its due date); empty rows are left out. */
  protected readonly rows = computed(() => {
    const st = this.statement();
    const t = this.text;
    const minimumLabel = st.paymentDueDate
      ? `${t.minimumPayment} · ${t.dueDate} ${this.shortDate.transform(st.paymentDueDate)}`
      : t.minimumPayment;
    const rows = [
      { label: t.previousBalance, rd: st.rd.previousBalance, usd: st.usd?.previousBalance ?? null, strong: false },
      { label: t.charges, rd: st.rd.charges, usd: st.usd?.charges ?? null, strong: false },
      { label: t.credits, rd: -st.rd.credits, usd: st.usd ? -st.usd.credits : null, strong: false },
      { label: t.statementBalance, rd: st.rd.balance, usd: st.usd?.balance ?? null, strong: true },
      { label: minimumLabel, rd: st.rd.minimumPayment, usd: st.usd?.minimumPayment ?? null, strong: false },
    ];
    return rows.filter(r => r.rd !== null || r.usd !== null);
  });

  private readonly shortDate = new ShortDatePipe();
}
