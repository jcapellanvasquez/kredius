import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { IconComponent } from '../../../../../shared/components/icon/icon';
import { ProgressRingComponent } from '../../../../../shared/components/progress-ring/progress-ring';
import { MoneyPipe } from '../../../../../shared/pipes/money.pipe';
import { progressLevel } from '../../../../../shared/utils/progress-level';
import { BUDGET_THRESHOLDS } from '../../budget.constants';
import { StatementAccountKind } from '../../budget.enums';
import { BUDGET_TEXT } from '../../budget.texts';
import { CardSummary } from '../../models/budget.models';

/** Credit card: % of its budget consumed, plus the month's statement result (charges − payments). */
@Component({
  selector: 'app-card-summary',
  imports: [IconComponent, ProgressRingComponent, MoneyPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <div class="card p-3 h-full">
      <div class="flex items-center gap-2.5">
        <app-progress-ring [pct]="card().pct" [level]="level()" [size]="40" />
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
        <dl class="mt-3 pt-2 border-t border-gray-100 flex flex-col gap-0.5 text-xs tabular-nums">
          <div [class]="rowClass">
            <dt class="text-gray-500">{{ text.charges }}</dt>
            <dd class="ml-auto whitespace-nowrap text-gray-700">{{ st.charges | money: 2 }}</dd>
          </div>
          <div [class]="rowClass">
            <dt class="text-gray-500">{{ text.payments }}</dt>
            <dd class="ml-auto whitespace-nowrap text-gray-700">{{ -st.payments | money: 2 }}</dd>
          </div>
          <div [class]="rowClass + ' pt-0.5'">
            <dt class="font-medium text-gray-700">{{ text.monthResult }}</dt>
            <dd class="ml-auto whitespace-nowrap font-medium text-gray-900">{{ st.net | money: 2 }}</dd>
          </div>
        </dl>
      }
    </div>
  `,
})
export class CardSummaryComponent {
  readonly card = input.required<CardSummary>();

  protected readonly text = BUDGET_TEXT;
  protected readonly kind = StatementAccountKind.CreditCard;
  /** Label left, amount right; the amount drops under the label when the card is too narrow. */
  protected readonly rowClass = 'flex flex-wrap justify-between gap-x-2';
  protected readonly level = computed(() => progressLevel(this.card().pct, BUDGET_THRESHOLDS));
}
