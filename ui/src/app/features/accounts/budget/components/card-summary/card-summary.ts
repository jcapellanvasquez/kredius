import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { IconComponent } from '../../../../../shared/components/icon/icon';
import { ProgressRingComponent } from '../../../../../shared/components/progress-ring/progress-ring';
import { CURRENCY_PREFIX, USD_PREFIX } from '../../../../../shared/constants/locale';
import { MoneyPipe } from '../../../../../shared/pipes/money.pipe';
import { ShortDatePipe } from '../../../../../shared/pipes/short-date.pipe';
import { ProgressLevel, percentOf } from '../../../../../shared/utils/progress-level';
import { UiIcon } from '../../../../../shared/constants/ui-icons';
import { BALANCE_TOLERANCE, CARD_RING_BANDS } from '../../budget.constants';
import { StatementAccountKind } from '../../budget.enums';
import { BUDGET_TEXT } from '../../budget.texts';
import { CardSummary } from '../../models/budget.models';

/** Credit card: % of its budget consumed, plus the month's statement result (charges − payments). */
@Component({
  selector: 'app-card-summary',
  imports: [IconComponent, ProgressRingComponent, MoneyPipe, ShortDatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <div class="card p-3 h-full">
      <div class="flex items-center gap-2.5">
        <app-progress-ring [pct]="pct()" [level]="level()" [size]="40" />
        <div class="min-w-0">
          <p class="flex items-center gap-1 text-xs text-gray-500">
            <app-icon [name]="card().icon" [size]="12" /> {{ text.kind[kind] }}
          </p>
          <p class="text-sm font-medium text-gray-900 tabular-nums whitespace-nowrap">{{ card().spent | money }}</p>
          <p class="text-xs text-gray-400 tabular-nums whitespace-nowrap">
            @if (card().budget !== null) {
              {{ text.of }} {{ card().budget | money }}
            } @else {
              {{ text.noBudget }}
            }
          </p>
        </div>
      </div>

      @if (card().statement; as st) {
        <div class="mt-3 pt-2 border-t border-gray-100 text-xs tabular-nums">
          <p class="text-gray-500 mb-1">
            {{ text.statement }} {{ st.cycleStart | shortDate }} – {{ st.cutOffDate | shortDate }}
            @if (st.paymentDueDate) { · {{ text.dueDate }} {{ st.paymentDueDate | shortDate }} }
          </p>
          <table class="w-full">
            @if (st.usd) {
              <thead>
                <tr class="text-gray-400">
                  <th class="sr-only">{{ text.cutOff }}</th>
                  <th class="text-right font-normal">{{ prefix.rd }}</th>
                  <th class="text-right font-normal pl-2">{{ prefix.usd }}</th>
                </tr>
              </thead>
            }
            <tbody>
              @for (row of statementRows(); track row.label) {
                <tr [class.font-medium]="row.strong" [class.text-gray-900]="row.strong">
                  <th scope="row" class="text-left font-normal text-gray-500 pr-2">{{ row.label }}</th>
                  <td class="text-right whitespace-nowrap">{{ row.rd | money: 2 : !st.usd }}</td>
                  @if (st.usd) {
                    <td class="text-right whitespace-nowrap pl-2">{{ row.usd | money: 2 : false }}</td>
                  }
                </tr>
              }
            </tbody>
          </table>

          <div class="mt-2 flex flex-col gap-0.5" role="status">
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
            @switch (gapState()) {
              @case ('matches') {
                <p class="flex items-center gap-0.5 text-gray-500">
                  <app-icon [name]="icons.Check" [size]="12" /> {{ text.balanceMatches }}
                </p>
              }
              @case ('explained') {
                <p class="flex items-center gap-0.5 text-gray-500">
                  <app-icon [name]="icons.Check" [size]="12" /> {{ text.cardGapExplained }}
                </p>
              }
              @default {
                <div class="flex flex-wrap justify-between gap-x-2 font-medium text-gray-900">
                  <span>{{ text.cardUnexplained }}</span>
                  <span class="ml-auto whitespace-nowrap">{{ st.check.difference | money }}</span>
                </div>
              }
            }
            @if (st.check.usdCharges > 0) {
              <p class="text-gray-500">
                {{ text.usdPosted(st.check.usdPosted, st.check.usdCharges) }}
                @if (card().usdRate === null) { · {{ text.usdNeedsRate }} }
              </p>
            }
          </div>

          @if (st.usd) {
            <div class="mt-2 flex flex-wrap items-center gap-1.5 text-gray-500">
              @if (card().usdRate !== null && !editingRate()) {
                <span>{{ text.usdRate }}: {{ card().usdRate | money: 2 : false }}</span>
                <button type="button" (click)="editingRate.set(true)" class="underline underline-offset-2 hover:text-gray-900">
                  {{ text.changeRate }}
                </button>
              } @else {
                <label [for]="rateId" class="shrink-0">{{ text.usdRate }}</label>
                <input [id]="rateId" #rate type="number" inputmode="decimal" min="0" step="0.01"
                  [value]="card().usdRate ?? ''" [disabled]="savingRate()"
                  class="w-20 px-2 py-1 text-xs text-gray-900 tabular-nums bg-white rounded-md border border-gray-200 focus:outline-none focus:ring-2 focus:ring-brand-300" />
                <button type="button" (click)="submitRate(rate.value)" [disabled]="savingRate()"
                  class="px-2 py-1 rounded-md border border-gray-200 text-gray-700 hover:border-gray-400 disabled:opacity-40">
                  {{ text.saveRate }}
                </button>
                @if (card().usdRate === null) {
                  <p class="basis-full text-gray-400">{{ text.usdRateHint }}</p>
                }
              }
            </div>
          }
        </div>
      }
    </div>
  `,
})
export class CardSummaryComponent {
  readonly card = input.required<CardSummary>();
  readonly savingRate = input(false);
  readonly saveRate = output<number>();

  protected readonly text = BUDGET_TEXT;
  protected readonly kind = StatementAccountKind.CreditCard;
  protected readonly editingRate = signal(false);
  protected readonly rateId = 'card-usd-rate';
  protected readonly prefix = { rd: CURRENCY_PREFIX, usd: USD_PREFIX };
  protected readonly icons = UiIcon;

  protected readonly hasPaymentsToReconcile = computed(
    () => Math.abs(this.card().statement?.check.paymentsToReconcile ?? 0) >= BALANCE_TOLERANCE,
  );

  /** `matches`: bank = ledger; `explained`: the gap is pending lines and payments; else something's missing. */
  protected readonly gapState = computed(() => {
    const st = this.card().statement;
    if (!st) return null;
    if (Math.abs((st.rd.balance ?? 0) - st.check.ledger) < BALANCE_TOLERANCE) return 'matches';
    return Math.abs(st.check.difference) < BALANCE_TOLERANCE ? 'explained' : 'unexplained';
  });

  /** Previous balance, charges, credits (negative), balance and minimum payment; empty rows are left out. */
  protected readonly statementRows = computed(() => {
    const st = this.card().statement;
    if (!st) return [];
    const t = this.text;
    const rows = [
      { label: t.previousBalance, rd: st.rd.previousBalance, usd: st.usd?.previousBalance ?? null, strong: false },
      { label: t.charges, rd: st.rd.charges, usd: st.usd?.charges ?? null, strong: false },
      { label: t.credits, rd: -st.rd.credits, usd: st.usd ? -st.usd.credits : null, strong: false },
      { label: t.statementBalance, rd: st.rd.balance, usd: st.usd?.balance ?? null, strong: true },
      { label: t.minimumPayment, rd: st.rd.minimumPayment, usd: st.usd?.minimumPayment ?? null, strong: false },
    ];
    return rows.filter(r => r.rd !== null || r.usd !== null);
  });

  /** Ring-specific bands (green / amber / red); category bars keep the gray / amber / red rule. */
  protected readonly pct = computed(() => percentOf(this.card().spent, this.card().budget));
  protected readonly level = computed(() => {
    const pct = this.pct() ?? 0;
    if (pct >= CARD_RING_BANDS.dangerFrom) return ProgressLevel.Danger;
    if (pct >= CARD_RING_BANDS.warningFrom) return ProgressLevel.Warning;
    return ProgressLevel.Good;
  });

  protected submitRate(raw: string): void {
    const value = Number(raw);
    if (!raw || Number.isNaN(value) || value <= 0) return;
    this.editingRate.set(false);
    this.saveRate.emit(value);
  }
}
