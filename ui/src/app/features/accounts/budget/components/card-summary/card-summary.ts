import { NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy, Component, ElementRef, Injector, afterNextRender, computed, effect, inject, input, output, signal,
  untracked, viewChild,
} from '@angular/core';
import { IconComponent } from '../../../../../shared/components/icon/icon';
import { ProgressRingComponent } from '../../../../../shared/components/progress-ring/progress-ring';
import { MoneyPipe } from '../../../../../shared/pipes/money.pipe';
import { ShortDatePipe } from '../../../../../shared/pipes/short-date.pipe';
import { ProgressLevel, percentOf } from '../../../../../shared/utils/progress-level';
import { UiIcon } from '../../../../../shared/constants/ui-icons';
import { BALANCE_TOLERANCE, CARD_RING_BANDS } from '../../budget.constants';
import { StatementAccountKind } from '../../budget.enums';
import { BUDGET_TEXT } from '../../budget.texts';
import { CardSummary } from '../../models/budget.models';

/**
 * Credit card, collapsed: % of its budget consumed and the statement's key RD$ figures.
 * The full statement (RD$/US$ table, balance check) is in the shared details panel ("Ver detalles").
 */
@Component({
  selector: 'app-card-summary',
  imports: [IconComponent, NgTemplateOutlet, ProgressRingComponent, MoneyPipe, ShortDatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <div class="card p-3 h-full flex flex-col">
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
        <div class="mt-3 pt-2 border-t border-gray-100 flex flex-col gap-1 flex-1 text-xs tabular-nums">
          <p class="text-gray-500">{{ text.statement }} {{ st.cycleStart | shortDate }} – {{ st.cutOffDate | shortDate }}</p>
          @if (st.rd.previousBalance !== null) {
            <div class="flex justify-between gap-2">
              <span class="text-gray-500">{{ text.previousBalance }}</span>
              <span class="whitespace-nowrap text-gray-700">{{ st.rd.previousBalance | money }}</span>
            </div>
          }
          <div class="flex justify-between gap-2">
            <span class="text-gray-500">{{ text.charges }}</span>
            <span class="whitespace-nowrap text-gray-700">{{ st.rd.charges | money }}</span>
          </div>
          @if (st.rd.balance !== null) {
            <div class="flex justify-between gap-2 font-medium text-gray-900">
              <span>{{ text.statementBalance }}</span>
              <span class="whitespace-nowrap">{{ st.rd.balance | money }}</span>
            </div>
          }
          <div role="status">
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
          </div>

          @if (st.usd || editingRate()) {
            <ng-container *ngTemplateOutlet="rateEditor" />
          }

          <button type="button" (click)="toggleDetails.emit()" [attr.aria-expanded]="detailsOpen()" [attr.aria-controls]="detailsId()"
            class="mt-auto pt-1 self-end inline-flex items-center gap-0.5 hover:text-gray-900 transition-colors"
            [class.text-gray-900]="detailsOpen()" [class.text-gray-500]="!detailsOpen()">
            {{ detailsOpen() ? text.hideDetails : text.showDetails }}
            <app-icon [name]="icons.ChevronDown" [size]="12" class="transition-transform" [class.rotate-180]="detailsOpen()" />
          </button>
        </div>
      } @else if (editingRate()) {
        <!-- "Poner tasa" with no card statement this month: the rate field alone -->
        <div class="mt-3 pt-2 border-t border-gray-100 text-xs tabular-nums">
          <ng-container *ngTemplateOutlet="rateEditor" />
        </div>
      }
    </div>

    <ng-template #rateEditor>
      <div class="flex flex-wrap items-center gap-1.5 text-gray-500">
        @if (card().usdRate !== null && !editingRate()) {
          <span>{{ text.usdRate }} {{ card().usdRate | money: 2 : false }} ·</span>
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
            <span class="inline-flex items-center px-2 py-0.5 rounded-full border border-warning-border bg-warning-bg text-warning-text">
              {{ text.rateMissing }}
            </span>
            <p class="basis-full text-gray-400">{{ text.usdRateHint }}</p>
          }
        }
      </div>
    </ng-template>
  `,
})
export class CardSummaryComponent {
  readonly card = input.required<CardSummary>();
  readonly savingRate = input(false);
  /** Bumped by "Poner tasa" (store.rateRequest): open the rate field, scroll to it and focus it. */
  readonly rateRequest = input(0);
  /** Whether the shared details panel shows this card's details. */
  readonly detailsOpen = input(false);
  /** Id of the details panel, for `aria-controls`. */
  readonly detailsId = input<string | null>(null);
  readonly saveRate = output<number>();
  readonly toggleDetails = output<void>();

  protected readonly text = BUDGET_TEXT;
  protected readonly kind = StatementAccountKind.CreditCard;
  protected readonly editingRate = signal(false);
  protected readonly rateId = 'card-usd-rate';
  protected readonly icons = UiIcon;

  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly injector = inject(Injector);
  private readonly rateInput = viewChild<ElementRef<HTMLInputElement>>('rate');

  constructor() {
    // The first run only records the current value, so a request made before this card existed doesn't reopen it.
    let handled: number | null = null;
    effect(() => {
      const request = this.rateRequest();
      if (handled !== null && request !== handled) untracked(() => this.openRateEditor());
      handled = request;
    });
  }

  /** `matches`: bank = ledger; `explained`: the gap is pending lines and payments; else something's missing. */
  protected readonly gapState = computed(() => {
    const st = this.card().statement;
    if (!st) return null;
    if (Math.abs((st.rd.balance ?? 0) - st.check.ledger) < BALANCE_TOLERANCE) return 'matches';
    return Math.abs(st.check.difference) < BALANCE_TOLERANCE ? 'explained' : 'unexplained';
  });

  /** Ring-specific bands (green / amber / red); category bars keep the gray / amber / red rule. */
  protected readonly pct = computed(() => percentOf(this.card().spent, this.card().budget));
  protected readonly level = computed(() => {
    const pct = this.pct() ?? 0;
    if (pct >= CARD_RING_BANDS.dangerFrom) return ProgressLevel.Danger;
    if (pct >= CARD_RING_BANDS.warningFrom) return ProgressLevel.Warning;
    return ProgressLevel.Good;
  });

  private openRateEditor(): void {
    const reveal = () => {
      this.host.nativeElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      this.rateInput()?.nativeElement.focus({ preventScroll: true });
    };
    // Already open: nothing re-renders, so reveal now; otherwise wait for the field to exist.
    if (this.editingRate() && this.rateInput()) return reveal();
    this.editingRate.set(true);
    afterNextRender(reveal, { injector: this.injector });
  }

  protected submitRate(raw: string): void {
    const value = Number(raw);
    if (!raw || Number.isNaN(value) || value <= 0) return;
    this.editingRate.set(false);
    this.saveRate.emit(value);
  }
}
