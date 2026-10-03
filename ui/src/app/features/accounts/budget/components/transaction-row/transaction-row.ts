import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { AccountIconComponent, AccountIconSize } from '../../../../../shared/components/account-icon/account-icon';
import { IconComponent } from '../../../../../shared/components/icon/icon';
import { UiIcon } from '../../../../../shared/constants/ui-icons';
import { MoneyPipe } from '../../../../../shared/pipes/money.pipe';
import { ShortDatePipe } from '../../../../../shared/pipes/short-date.pipe';
import { CurrencyCode, LineEffect, LineError, SaveState, StatementAccountKind } from '../../budget.enums';
import { BUDGET_TEXT } from '../../budget.texts';
import { AccountOption, LineUiState, TransactionLine } from '../../models/budget.models';
import { optionsForLine } from '../../state/line-options';
import { CategoryChipsComponent } from '../category-chips/category-chips';

@Component({
  selector: 'app-transaction-row',
  imports: [AccountIconComponent, CategoryChipsComponent, IconComponent, MoneyPipe, ShortDatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'relative block py-2.5 border-t border-gray-100 first:border-t-0 transition-opacity',
    // The line being saved dims, so it's clear which one is busy (loading system §4).
    '[class.opacity-70]': 'saving()',
    '[attr.aria-busy]': 'saving()',
  },
  template: `
    @if (showDone()) {
      <!-- Categorized here: one confirmation line in place of the row, so nothing below moves up. -->
      <div animate.enter="done-tint" class="-mx-2 px-2 py-0.5 rounded-md" role="status">
        <div class="flex items-center justify-between gap-2 text-body text-gray-500">
          <span class="flex items-center gap-1.5 min-w-0">
            <app-icon [name]="icons.Check" [size]="14" class="shrink-0 text-brand-700" />
            <span class="truncate">{{ line().description }}</span>
          </span>
          <span class="shrink-0 tabular-nums">
            @if (isUsd()) {
              {{ line().originalAmount | money: 2 : true : true }}
            } @else {
              {{ line().amount | money }}
            }
          </span>
        </div>
        <div class="flex items-center justify-between gap-2 mt-0.5 pl-5 text-body">
          <span class="min-w-0 text-gray-700">→ <span class="font-medium text-gray-900">{{ categoryName() }}</span></span>
          <button type="button" (click)="changingFrom.set(line().categoryId)"
            class="shrink-0 text-gray-600 underline underline-offset-2 hover:text-gray-900">
            {{ text.changeCategory }}
          </button>
        </div>
      </div>
    } @else {
      <div class="flex items-start justify-between gap-2 mb-1">
        <div class="flex items-start gap-2 min-w-0">
          <app-account-icon [icon]="line().sourceIcon" [size]="iconSize" />
          <span class="sr-only">{{ text.kind[line().source] }}</span>
          <!-- Up to 2 lines; tap to show the rest (A3 in mobile-fixes-plan.md). -->
          <button type="button" (click)="expanded.set(!expanded())" [attr.aria-expanded]="expanded()"
            class="min-w-0 text-left text-body text-gray-700 break-words" [class.line-clamp-2]="!expanded()">
            {{ line().description }}
          </button>
        </div>
        <span class="text-body text-gray-900 tabular-nums shrink-0">
          @if (isUsd()) {
            {{ line().originalAmount | money: 2 : true : true }}
          } @else {
            {{ line().amount | money }}
          }
        </span>
      </div>
      <div class="mb-2">
        <div class="flex flex-wrap items-center gap-1.5">
          <span class="text-meta text-gray-500">{{ line().date | shortDate }} ·</span>
          <button type="button" (click)="helpOpen.set(!helpOpen())" [attr.aria-expanded]="helpOpen()"
            class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-50 text-meta text-gray-500 hover:text-gray-900 transition-colors">
            <app-icon [name]="icons.Info" [size]="12" />
            {{ effectText().tag }}
          </button>
          @if (rateMissing()) {
            <span class="inline-flex items-center px-2 py-0.5 rounded-full border border-warning-border bg-warning-bg text-meta text-warning-text">
              {{ text.rateMissing }}
            </span>
          }
        </div>
        @if (helpOpen()) {
          <p animate.enter="fade-in" class="mt-1 text-meta text-gray-500">{{ effectText().help }}</p>
        }
      </div>
      <app-category-chips
        [selectedId]="selectedId()"
        [suggestions]="line().suggestions"
        [options]="options()"
        [groups]="groups()"
        [state]="chipState()"
        (choose)="onChoose($event)" />
      @switch (knownError()) {
        @case (errors.NoRate) {
          <p animate.enter="fade-in" class="mt-2 flex items-start gap-1 text-meta text-gray-900" role="alert">
            <app-icon [name]="icons.Alert" [size]="12" class="mt-0.5 shrink-0" />
            <span>
              {{ text.rateMissingError }}
              <button type="button" (click)="setRate.emit()" class="font-medium underline underline-offset-2 hover:text-brand-800">
                {{ text.setRate }}
              </button>
            </span>
          </p>
        }
        @case (errors.Changed) {
          <p animate.enter="fade-in" class="mt-2 flex items-start gap-1 text-meta text-gray-900" role="alert">
            <app-icon [name]="icons.Alert" [size]="12" class="mt-0.5 shrink-0" />
            <span>
              {{ text.lineChanged }}
              <button type="button" (click)="reload.emit()" class="font-medium underline underline-offset-2 hover:text-brand-800">
                {{ text.reloadMonth }}
              </button>
            </span>
          </p>
        }
      }
    }
  `,
})
export class TransactionRowComponent {
  readonly line = input.required<TransactionLine>();
  /** Every account "Otra" can offer; the line gets its groups from `optionsForLine`. */
  readonly options = input<AccountOption[]>([]);
  readonly uiState = input<LineUiState | undefined>(undefined);
  /** The card has no US$ rate yet. */
  readonly noCardRate = input(false);
  /** Categorized here this visit: shown as a confirmation line until "Cambiar". */
  readonly done = input(false);
  readonly choose = output<number>();
  /** "Poner tasa" under a NO_EXCHANGE_RATE error. */
  readonly setRate = output<void>();
  /** "Recargar el mes" under a conflict error. */
  readonly reload = output<void>();

  protected readonly text = BUDGET_TEXT;
  protected readonly iconSize = AccountIconSize.Sm;
  protected readonly isUsd = computed(() => this.line().currency === CurrencyCode.Usd);
  /** A US$ card line can't be categorized until the card has a rate. */
  protected readonly rateMissing = computed(() =>
    this.noCardRate() && this.isUsd() && this.line().source === StatementAccountKind.CreditCard);
  protected readonly icons = UiIcon;
  protected readonly helpOpen = signal(false);
  /** The description shows in full instead of clamped to 2 lines. */
  protected readonly expanded = signal(false);
  /** The category the line had when "Cambiar" was tapped; the chips show until it changes. */
  protected readonly changingFrom = signal<number | null>(null);
  protected readonly errors = LineError;
  protected readonly saving = computed(() => this.uiState()?.state === SaveState.Saving);
  protected readonly groups = computed(() => optionsForLine(this.line(), this.options()));

  /** An error with its own message under the chips (the generic one stays inside the chips). */
  protected readonly knownError = computed(() => {
    const ui = this.uiState();
    return ui?.state === SaveState.Error && ui.error !== LineError.Failed ? ui.error ?? null : null;
  });
  protected readonly chipState = computed(() => (this.knownError() ? SaveState.Idle : this.uiState()?.state ?? SaveState.Idle));

  /** Charges are positive, payments/refunds/deposits negative; the source says card (debt) or savings. */
  protected readonly effectText = computed(() => {
    const moneyIn = this.line().originalAmount < 0;
    const effect = this.line().source === StatementAccountKind.CreditCard
      ? (moneyIn ? LineEffect.DebtDown : LineEffect.DebtUp)
      : (moneyIn ? LineEffect.SavingsIn : LineEffect.SavingsOut);
    return this.text.effect[effect];
  });

  /** The confirmation line, unless "Cambiar" reopened the chips or a change is saving or failed. */
  protected readonly showDone = computed(() => {
    const ui = this.uiState()?.state;
    const changing = this.changingFrom() !== null && this.changingFrom() === this.line().categoryId;
    return this.done() && !changing && ui !== SaveState.Saving && ui !== SaveState.Error;
  });

  protected readonly categoryName = computed(() => {
    const id = this.line().categoryId;
    const all = [...this.options(), ...this.line().suggestions];
    return all.find(o => o.accountId === id)?.name ?? this.text.saved;
  });

  /** Picking the category it already has just closes "Cambiar" again. */
  protected onChoose(categoryId: number): void {
    if (this.done() && categoryId === this.line().categoryId) {
      this.changingFrom.set(null);
      return;
    }
    this.choose.emit(categoryId);
  }

  /** Optimistic selection while saving; falls back to the line's saved category (also after an error). */
  protected readonly selectedId = computed(() => this.uiState()?.pendingCategoryId ?? this.line().categoryId);
}
