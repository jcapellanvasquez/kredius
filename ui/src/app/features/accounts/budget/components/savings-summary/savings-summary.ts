import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { IconComponent } from '../../../../../shared/components/icon/icon';
import { MoneyPipe } from '../../../../../shared/pipes/money.pipe';
import { StatementAccountKind } from '../../budget.enums';
import { BUDGET_TEXT } from '../../budget.texts';
import { SavingsSummary } from '../../models/budget.models';

@Component({
  selector: 'app-savings-summary',
  imports: [IconComponent, MoneyPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <div class="card p-3 h-full">
      <p class="flex items-center gap-1 text-xs text-gray-500">
        <app-icon [name]="savings().icon" [size]="12" /> {{ text.kind[kind] }}
      </p>
      <p class="text-base font-medium text-gray-900 tabular-nums">{{ savings().balance | money }}</p>
      <p class="mt-1 text-xs text-gray-400 tabular-nums">{{ text.income }}: {{ savings().income | money }}</p>
    </div>
  `,
})
export class SavingsSummaryComponent {
  readonly savings = input.required<SavingsSummary>();

  protected readonly text = BUDGET_TEXT;
  protected readonly kind = StatementAccountKind.Savings;
}
