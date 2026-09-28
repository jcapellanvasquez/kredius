import { ChangeDetectionStrategy, Component, input, output, signal } from '@angular/core';
import { AccountIconComponent } from '../../../../../shared/components/account-icon/account-icon';
import { IconComponent } from '../../../../../shared/components/icon/icon';
import { ProgressBarComponent } from '../../../../../shared/components/progress-bar/progress-bar';
import { UiIcon } from '../../../../../shared/constants/ui-icons';
import { MoneyPipe } from '../../../../../shared/pipes/money.pipe';
import { BUDGET_TEXT } from '../../budget.texts';
import { CategoryOption, CategoryRowView, ChipSelection, LineUiState } from '../../models/budget.models';
import { BudgetInputComponent } from '../budget-input/budget-input';
import { TransactionRowComponent } from '../transaction-row/transaction-row';

let nextId = 0;

@Component({
  selector: 'app-category-row',
  imports: [AccountIconComponent, IconComponent, ProgressBarComponent, MoneyPipe, BudgetInputComponent, TransactionRowComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block p-3.5 border-b border-gray-100 last:border-b-0' },
  templateUrl: './category-row.html',
})
export class CategoryRowComponent {
  readonly row = input.required<CategoryRowView>();
  readonly options = input<CategoryOption[]>([]);
  readonly lineStates = input<ReadonlyMap<number, LineUiState>>(new Map());
  readonly highlight = input(false);

  readonly budgetChange = output<number | null>();
  readonly choose = output<ChipSelection>();

  protected readonly text = BUDGET_TEXT;
  protected readonly icons = UiIcon;
  protected readonly expanded = signal(false);
  protected readonly listId = `category-transactions-${nextId++}`;
}
