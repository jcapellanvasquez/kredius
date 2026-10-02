import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { AccountIconComponent, AccountIconSize } from '../../../../../shared/components/account-icon/account-icon';
import { ProgressBarComponent } from '../../../../../shared/components/progress-bar/progress-bar';
import { MoneyPipe } from '../../../../../shared/pipes/money.pipe';
import { BUDGET_TEXT } from '../../budget.texts';
import { CategoryRowView } from '../../models/budget.models';

/** One compact bar per category, both accounts mixed. Values are always shown next to the %. */
@Component({
  selector: 'app-quick-compare',
  imports: [AccountIconComponent, ProgressBarComponent, MoneyPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <div class="card p-3.5">
      @for (row of rows(); track row.accountId) {
        <div class="mb-3 last:mb-0">
          <div class="flex items-center justify-between gap-2 mb-1.5">
            <span class="flex items-center gap-1.5 min-w-0 text-sm font-medium text-gray-900">
              <app-account-icon [icon]="row.icon" [size]="iconSize" />
              <span class="line-clamp-2 break-words">{{ row.name }}</span>
            </span>
            <span class="text-xs text-gray-500 tabular-nums shrink-0">
              {{ row.actual | money: 0 }}
              @if (row.budgetInput !== null) {
                / {{ row.budgetInput | money: 0 : false }} · {{ row.pct }}{{ text.percent }}
              } @else {
                · {{ text.noBudget }}
              }
            </span>
          </div>
          <app-progress-bar [pct]="row.pct" [level]="row.level" />
        </div>
      } @empty {
        <p class="text-sm text-gray-400">{{ text.quickCompareEmpty }}</p>
      }
    </div>
  `,
})
export class QuickCompareComponent {
  readonly rows = input<CategoryRowView[]>([]);

  protected readonly text = BUDGET_TEXT;
  protected readonly iconSize = AccountIconSize.Sm;
}
