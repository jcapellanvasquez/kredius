import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { IconComponent } from '../../../../../shared/components/icon/icon';
import { UiIcon } from '../../../../../shared/constants/ui-icons';
import { BUDGET_TEXT } from '../../budget.texts';
import {
  AccountOption, CategoryRowView, ChipSelection, LineUiState, TransactionLine,
} from '../../models/budget.models';
import { CategoryRowComponent } from '../category-row/category-row';
import { TransactionRowComponent } from '../transaction-row/transaction-row';

export interface BudgetEdit {
  accountId: number;
  value: number | null;
}

/** "Sin categorizar" (always first, hidden when empty) followed by the server-sorted categories. */
@Component({
  selector: 'app-category-list',
  imports: [IconComponent, CategoryRowComponent, TransactionRowComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex flex-col gap-2' },
  template: `
    @if (uncategorized().length > 0) {
      <div class="rounded-lg bg-white border border-dashed border-gray-300 p-3.5">
        <p class="flex items-center gap-1.5 mb-1.5 text-base font-medium text-gray-900">
          <app-icon [name]="icons.Alert" [size]="16" class="text-gray-500" />
          {{ text.uncategorized }}
          <span class="text-body font-normal text-gray-500">({{ pendingCount() }})</span>
        </p>
        @for (line of uncategorized(); track line.lineId) {
          <app-transaction-row animate.leave="line-leave" [line]="line" [options]="options()" [uiState]="lineStates().get(line.lineId)"
            [noCardRate]="noCardRate()" [done]="doneLineIds().has(line.lineId)"
            (choose)="choose.emit({ line, categoryId: $event })" (setRate)="setRate.emit()" (reload)="reload.emit()" />
        }
      </div>
    }

    <div class="card">
      @for (row of rows(); track row.accountId) {
        <app-category-row
          [row]="row"
          [options]="options()"
         
          [lineStates]="lineStates()"
          [highlight]="row.accountId === highlightId()"
          (budgetChange)="budgetChange.emit({ accountId: row.accountId, value: $event })"
          (choose)="choose.emit($event)"
          (setRate)="setRate.emit()"
          (reload)="reload.emit()" />
      }
    </div>
  `,
})
export class CategoryListComponent {
  readonly uncategorized = input<TransactionLine[]>([]);
  readonly rows = input<CategoryRowView[]>([]);
  readonly options = input<AccountOption[]>([]);
  readonly lineStates = input<ReadonlyMap<number, LineUiState>>(new Map());
  readonly highlightId = input<number | null>(null);
  /** The card has no US$ rate yet (US$ card lines show a tag). */
  readonly noCardRate = input(false);
  /** Lines categorized here, shown as confirmation rows; the count leaves them out. */
  readonly doneLineIds = input<ReadonlySet<number>>(new Set());

  readonly budgetChange = output<BudgetEdit>();
  readonly choose = output<ChipSelection>();
  readonly setRate = output<void>();
  readonly reload = output<void>();

  protected readonly text = BUDGET_TEXT;
  protected readonly icons = UiIcon;
  protected readonly pendingCount = computed(() =>
    this.uncategorized().filter(l => !this.doneLineIds().has(l.lineId)).length);
}
