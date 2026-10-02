import { NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy, Component, ElementRef, Injector, afterNextRender, computed, effect, inject, input, output, signal,
  untracked, viewChild,
} from '@angular/core';
import { IconComponent } from '../../../../../shared/components/icon/icon';
import { ProgressRingComponent } from '../../../../../shared/components/progress-ring/progress-ring';
import { CURRENCY_PREFIX, USD_PREFIX } from '../../../../../shared/constants/locale';
import { MoneyPipe } from '../../../../../shared/pipes/money.pipe';
import { ShortDatePipe } from '../../../../../shared/pipes/short-date.pipe';
import { monthName } from '../../../../../shared/utils/period';
import { ProgressLevel, percentOf } from '../../../../../shared/utils/progress-level';
import { UiIcon } from '../../../../../shared/constants/ui-icons';
import { BALANCE_TOLERANCE, CARD_RING_BANDS } from '../../budget.constants';
import { SaveState, StatementAccountKind } from '../../budget.enums';
import { BUDGET_TEXT } from '../../budget.texts';
import { CardBudgetView, CardSummary } from '../../models/budget.models';

/**
 * Credit card, collapsed: % of its budget consumed and the statement's key RD$ figures.
 * The full statement (RD$/US$ table, balance check) is in the shared details panel ("Ver detalles").
 */
@Component({
  selector: 'app-card-summary',
  imports: [IconComponent, NgTemplateOutlet, ProgressRingComponent, MoneyPipe, ShortDatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block', '(document:click)': 'chargesHelpOpen.set(false)', '(keydown.escape)': 'chargesHelpOpen.set(false)' },
  template: `
    <div class="card p-3 h-full flex flex-col">
      <div class="flex items-center gap-2.5">
        <app-progress-ring [pct]="pct()" [level]="level()" [size]="40" />
        <div class="min-w-0">
          <p class="flex items-center gap-1 text-xs text-gray-500">
            <app-icon [name]="card().icon" [size]="12" /> {{ text.kind[kind] }}
          </p>
          <p class="text-sm font-medium text-gray-900 tabular-nums whitespace-nowrap">{{ card().spent | money }}</p>
          @if (!editingBudget()) {
            <button type="button" (click)="startBudgetEdit()" [attr.aria-label]="text.editCardBudget"
              class="group inline-flex items-center gap-1 text-xs text-gray-400 tabular-nums whitespace-nowrap hover:text-gray-900 transition-colors">
              @if (budgetValue() !== null) {
                {{ text.of }} {{ budgetValue() | money }}
              } @else {
                {{ text.noBudget }}
              }
              <app-icon [name]="icons.Pencil" [size]="12" class="opacity-60 group-hover:opacity-100" />
            </button>
            @switch (budgetHint()) {
              @case ('carried') {
                <p class="text-[11px] text-gray-400">{{ text.sameAs(carriedMonth()) }}</p>
              }
              @case ('unsaved') {
                <p class="text-[11px] text-gray-900">• {{ text.unsaved }}</p>
              }
              @case ('saved') {
                <p class="flex items-center gap-0.5 text-[11px] text-gray-500" role="status">
                  <app-icon [name]="icons.Check" [size]="12" /> {{ text.saved }}
                </p>
              }
              @case ('none') {
                <p class="text-[11px] text-gray-400">{{ text.setCardBudgetHint }}</p>
              }
            }
          } @else {
            <div class="mt-0.5 flex items-center gap-1">
              <input #budgetField type="number" inputmode="decimal" min="0" step="100" [value]="budgetValue() ?? ''"
                [attr.aria-label]="text.cardBudget" (keydown.enter)="finishBudgetEdit(budgetField.value)"
                (keydown.escape)="$event.stopPropagation(); editingBudget.set(false)"
                class="w-24 px-1.5 py-0.5 text-xs text-gray-900 tabular-nums bg-white rounded-md border border-gray-200 focus:outline-none focus:ring-2 focus:ring-brand-300" />
              <button type="button" (click)="finishBudgetEdit(budgetField.value)"
                class="text-xs text-gray-700 underline underline-offset-2 hover:text-gray-900">
                {{ text.done }}
              </button>
            </div>
          }
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
            <span class="group relative inline-flex items-center gap-1 text-gray-500">
              {{ text.charges }}
              <button type="button" (click)="toggleChargesHelp($event)" [attr.aria-expanded]="chargesHelpOpen()"
                [attr.aria-describedby]="chargesHelpId" [attr.aria-label]="text.chargesHelp"
                class="text-gray-400 hover:text-gray-900 transition-colors">
                <app-icon [name]="icons.Info" [size]="12" />
              </button>
              <span [id]="chargesHelpId" role="tooltip"
                class="absolute left-0 top-full mt-1 z-20 w-64 max-w-[calc(100vw-3rem)] rounded-lg border border-gray-200 bg-white shadow-lg p-3 text-gray-600 group-hover:block"
                [class.hidden]="!chargesHelpOpen()">
                <span class="block mb-1.5 font-medium text-gray-900">
                  {{ text.chargesTitle(shortDate(st.cycleStart), shortDate(st.cutOffDate)) }}
                </span>
                <span class="flex justify-between gap-2">
                  <span>{{ text.chargesIn }} {{ prefix.rd }}</span>
                  <span class="whitespace-nowrap">{{ st.rd.charges | money: 2 : false }}</span>
                </span>
                @if (st.usd && st.usd.charges > 0) {
                  @let rate = card().usdRate;
                  <span class="flex justify-between gap-2">
                    <span>
                      {{ text.chargesIn }} {{ prefix.usd }} · {{ st.usd.charges | money: 2 : false }}
                      @if (rate !== null) { × {{ rate | money: 2 : false }} }
                    </span>
                    <span class="whitespace-nowrap">
                      @if (rate !== null) { {{ st.usd.charges * rate | money: 2 : false }} } @else { {{ text.rateMissing }} }
                    </span>
                  </span>
                }
                @if (notPosted() > 0) {
                  <span class="flex justify-between gap-2">
                    <span>{{ text.chargesNotPosted }}</span>
                    <span class="whitespace-nowrap">−{{ notPosted() | money: 2 : false }}</span>
                  </span>
                }
                <span class="flex justify-between gap-2 mt-1 pt-1 border-t border-gray-100 font-medium text-gray-900">
                  <span>{{ text.chargesTotal }}</span>
                  <span class="whitespace-nowrap">{{ card().spent | money: 2 : false }}</span>
                </span>
                @if (st.rd.credits > 0) {
                  <span class="block mt-1.5 text-gray-400">{{ text.chargesExclude(negative(st.rd.credits)) }}</span>
                }
              </span>
            </span>
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
  /** The card budget with its draft; null falls back to the saved one on `card`. */
  readonly budget = input<CardBudgetView | null>(null);
  readonly saveRate = output<number>();
  readonly toggleDetails = output<void>();
  /** A new card budget draft (null clears it); saved with "Guardar cambios". */
  readonly budgetChange = output<number | null>();

  protected readonly text = BUDGET_TEXT;
  protected readonly kind = StatementAccountKind.CreditCard;
  protected readonly editingRate = signal(false);
  protected readonly rateId = 'card-usd-rate';
  protected readonly chargesHelpId = 'card-charges-help';
  protected readonly editingBudget = signal(false);
  /** The Consumos tooltip, opened by tap/click (hover also shows it). */
  protected readonly chargesHelpOpen = signal(false);
  protected readonly prefix = { rd: CURRENCY_PREFIX, usd: USD_PREFIX };
  protected readonly icons = UiIcon;

  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly injector = inject(Injector);
  private readonly rateInput = viewChild<ElementRef<HTMLInputElement>>('rate');
  private readonly budgetField = viewChild<ElementRef<HTMLInputElement>>('budgetField');
  private readonly dates = new ShortDatePipe();
  private readonly money = new MoneyPipe();

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

  /**
   * Statement charges (RD$ + US$ at the rate) not counted in `spent` yet: lines still unposted.
   * 0 when they add up or there's no rate to convert the US$ ones.
   */
  protected readonly notPosted = computed(() => {
    const card = this.card();
    const st = card.statement;
    if (!st) return 0;
    const usd = st.usd?.charges ?? 0;
    if (usd > 0 && card.usdRate === null) return 0;
    const gap = st.rd.charges + usd * (card.usdRate ?? 0) - card.spent;
    return gap >= BALANCE_TOLERANCE ? gap : 0;
  });

  /** Ring-specific bands (green / amber / red); category bars keep the gray / amber / red rule. */
  protected readonly budgetValue = computed(() => {
    const budget = this.budget();
    return budget ? budget.value : this.card().budget;
  });
  /** The line under the amount: where the budget comes from, or its save state. */
  protected readonly budgetHint = computed(() => {
    const budget = this.budget();
    if (!budget) return null;
    if (budget.saveState === SaveState.Saved) return 'saved';
    if (budget.dirty) return 'unsaved';
    if (budget.carriedFrom) return 'carried';
    return budget.value === null ? 'none' : null;
  });
  protected readonly carriedMonth = computed(() => {
    const from = this.budget()?.carriedFrom;
    return from ? monthName(from) : '';
  });
  protected readonly pct = computed(() => percentOf(this.card().spent, this.budgetValue()));
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

  protected startBudgetEdit(): void {
    this.editingBudget.set(true);
    afterNextRender(() => this.budgetField()?.nativeElement.select(), { injector: this.injector });
  }

  protected finishBudgetEdit(raw: string): void {
    this.editingBudget.set(false);
    const value = raw.trim() === '' ? null : Number(raw);
    if (value !== null && (Number.isNaN(value) || value < 0)) return;
    this.budgetChange.emit(value === 0 ? null : value);
  }

  protected toggleChargesHelp(event: Event): void {
    event.stopPropagation(); // the document click would close it right away
    this.chargesHelpOpen.update(open => !open);
  }

  protected shortDate(iso: string): string {
    return this.dates.transform(iso);
  }

  protected negative(amount: number): string {
    return this.money.transform(-amount);
  }

  protected submitRate(raw: string): void {
    const value = Number(raw);
    if (!raw || Number.isNaN(value) || value <= 0) return;
    this.editingRate.set(false);
    this.saveRate.emit(value);
  }
}
