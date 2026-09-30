import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { AccountIconComponent, AccountIconSize } from '../../../../../shared/components/account-icon/account-icon';
import { IconComponent } from '../../../../../shared/components/icon/icon';
import { UiIcon } from '../../../../../shared/constants/ui-icons';
import { MoneyPipe } from '../../../../../shared/pipes/money.pipe';
import { ShortDatePipe } from '../../../../../shared/pipes/short-date.pipe';
import { CurrencyCode, LineEffect, SaveState, StatementAccountKind } from '../../budget.enums';
import { BUDGET_TEXT } from '../../budget.texts';
import { CategoryOption, CategoryOptionGroup, LineUiState, TransactionLine } from '../../models/budget.models';
import { CategoryChipsComponent } from '../category-chips/category-chips';

@Component({
  selector: 'app-transaction-row',
  imports: [AccountIconComponent, CategoryChipsComponent, IconComponent, MoneyPipe, ShortDatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'relative block py-2.5 border-t border-gray-100 first:border-t-0' },
  template: `
    <div class="flex items-center justify-between gap-2 mb-2">
      <div class="flex items-center gap-2 min-w-0">
        <app-account-icon [icon]="line().sourceIcon" [size]="iconSize" />
        <span class="sr-only">{{ text.kind[line().source] }}</span>
        <span class="text-sm text-gray-700 truncate">
          {{ line().date | shortDate }} · {{ line().description }}
        </span>
      </div>
      <span class="text-sm text-gray-900 tabular-nums shrink-0">
        @if (isUsd()) {
          {{ line().originalAmount | money: 2 : true : true }}
        } @else {
          {{ line().amount | money }}
        }
      </span>
    </div>
    <div class="mb-2">
      <button type="button" (click)="helpOpen.set(!helpOpen())" [attr.aria-expanded]="helpOpen()"
        class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-50 text-xs text-gray-500 hover:text-gray-900 transition-colors">
        <app-icon [name]="icons.Info" [size]="12" />
        {{ effectText().tag }}
      </button>
      @if (helpOpen()) {
        <p animate.enter="fade-in" class="mt-1 text-xs text-gray-500">{{ effectText().help }}</p>
      }
    </div>
    <app-category-chips
      [selectedId]="selectedId()"
      [suggestions]="line().suggestions"
      [options]="options()"
      [groups]="optionGroups()"
      [state]="uiState()?.state ?? idle"
      (choose)="choose.emit($event)" />
  `,
})
export class TransactionRowComponent {
  readonly line = input.required<TransactionLine>();
  readonly options = input<CategoryOption[]>([]);
  readonly optionGroups = input<CategoryOptionGroup[]>([]);
  readonly uiState = input<LineUiState | undefined>(undefined);
  readonly choose = output<number>();

  protected readonly text = BUDGET_TEXT;
  protected readonly iconSize = AccountIconSize.Sm;
  protected readonly idle = SaveState.Idle;
  protected readonly isUsd = computed(() => this.line().currency === CurrencyCode.Usd);
  protected readonly icons = UiIcon;
  protected readonly helpOpen = signal(false);

  /** Charges are positive, payments/refunds/deposits negative; the source says card (debt) or savings. */
  protected readonly effectText = computed(() => {
    const moneyIn = this.line().originalAmount < 0;
    const effect = this.line().source === StatementAccountKind.CreditCard
      ? (moneyIn ? LineEffect.DebtDown : LineEffect.DebtUp)
      : (moneyIn ? LineEffect.SavingsIn : LineEffect.SavingsOut);
    return this.text.effect[effect];
  });

  /** Optimistic selection while saving; falls back to the line's saved category (also after an error). */
  protected readonly selectedId = computed(() => this.uiState()?.pendingCategoryId ?? this.line().categoryId);
}
