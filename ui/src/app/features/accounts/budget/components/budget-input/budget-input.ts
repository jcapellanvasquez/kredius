import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { IconComponent } from '../../../../../shared/components/icon/icon';
import { CURRENCY_PREFIX } from '../../../../../shared/constants/locale';
import { UiIcon } from '../../../../../shared/constants/ui-icons';
import { SaveState } from '../../budget.enums';
import { BUDGET_TEXT } from '../../budget.texts';
import { monthName } from '../../../../../shared/utils/period';

let nextId = 0;

/** Always-editable budget amount. Emits on every keystroke; saving is batched by the page. */
@Component({
  selector: 'app-budget-input',
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <div class="flex items-center gap-2">
      <label [for]="inputId" class="text-sm text-gray-500 shrink-0 w-24">{{ text.budget }}</label>
      <div class="relative flex-1">
        <span class="absolute inset-y-0 left-3 flex items-center text-sm text-gray-400 pointer-events-none">{{ prefix }}</span>
        <input [id]="inputId" type="number" inputmode="decimal" min="0" step="100"
          [value]="value() ?? ''" [disabled]="state() === states.Saving" (input)="onInput($event)"
          class="w-full pl-10 pr-3 py-1.5 text-sm text-gray-900 tabular-nums bg-white rounded-lg border focus:outline-none focus:ring-2 focus:ring-brand-300 disabled:bg-gray-50 transition-colors"
          [class.border-gray-900]="edited()" [class.border-gray-200]="!edited()" />
      </div>
    </div>
    @switch (state()) {
      @case (states.Saved) {
        <p class="mt-1 flex items-center justify-end gap-0.5 text-xs text-gray-500" role="status">
          <app-icon [name]="icons.Check" [size]="12" /> {{ text.saved }}
        </p>
      }
      @case (states.Idle) {
        @if (carriedMonth()) {
          <p class="mt-1 text-right text-xs text-gray-400">{{ text.sameAs(carriedMonth()) }}</p>
        }
      }
      @default {
        <p class="mt-1 text-right text-xs text-gray-900">• {{ text.unsaved }}</p>
      }
    }
  `,
})
export class BudgetInputComponent {
  readonly value = input<number | null>(null);
  readonly state = input(SaveState.Idle);
  /** Month the budget was saved for, when earlier than the one shown (it carries forward). */
  readonly carriedFrom = input<string | null>(null);
  readonly valueChange = output<number | null>();

  protected readonly text = BUDGET_TEXT;
  protected readonly icons = UiIcon;
  protected readonly states = SaveState;
  protected readonly prefix = CURRENCY_PREFIX;
  protected readonly inputId = `budget-input-${nextId++}`;

  protected readonly carriedMonth = computed(() => {
    const from = this.carriedFrom();
    return from ? monthName(from) : '';
  });

  protected readonly edited = computed(() =>
    this.state() === SaveState.Dirty || this.state() === SaveState.Saving || this.state() === SaveState.Error);

  protected onInput(event: Event): void {
    const raw = (event.target as HTMLInputElement).value;
    const parsed = raw === '' ? null : Number(raw);
    this.valueChange.emit(parsed == null || Number.isNaN(parsed) ? null : Math.max(0, parsed));
  }
}
