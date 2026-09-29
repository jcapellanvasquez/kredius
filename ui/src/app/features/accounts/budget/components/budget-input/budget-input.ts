import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { IconComponent } from '../../../../../shared/components/icon/icon';
import { CURRENCY_PREFIX } from '../../../../../shared/constants/locale';
import { UiIcon } from '../../../../../shared/constants/ui-icons';
import { MoneyPipe } from '../../../../../shared/pipes/money.pipe';
import { SaveState } from '../../budget.enums';
import { BUDGET_TEXT } from '../../budget.texts';

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
          [value]="value() ?? ''" [placeholder]="placeholder()" [disabled]="state() === states.Saving" (input)="onInput($event)"
          class="w-full pl-10 pr-3 py-1.5 text-sm text-gray-900 tabular-nums bg-white rounded-lg border focus:outline-none focus:ring-2 focus:ring-brand-300 disabled:bg-gray-50 transition-colors"
          [class.border-gray-900]="edited()" [class.border-gray-200]="!edited()" />
      </div>
      @if (showHint()) {
        <button type="button" (click)="valueChange.emit(hint())" [attr.aria-label]="text.usePreviousLabel"
          class="shrink-0 text-xs text-gray-500 underline underline-offset-2 hover:text-gray-900 transition-colors">
          {{ text.usePrevious }}
        </button>
      }
    </div>
    @switch (state()) {
      @case (states.Saved) {
        <p class="mt-1 flex items-center justify-end gap-0.5 text-xs text-gray-500" role="status">
          <app-icon [name]="icons.Check" [size]="12" /> {{ text.saved }}
        </p>
      }
      @case (states.Idle) {}
      @default {
        <p class="mt-1 text-right text-xs text-gray-900">• {{ text.unsaved }}</p>
      }
    }
  `,
})
export class BudgetInputComponent {
  readonly value = input<number | null>(null);
  readonly state = input(SaveState.Idle);
  /** Last month's budget, offered while the input is empty (plan Q4). */
  readonly hint = input<number | null>(null);
  readonly valueChange = output<number | null>();

  protected readonly text = BUDGET_TEXT;
  protected readonly icons = UiIcon;
  protected readonly states = SaveState;
  protected readonly prefix = CURRENCY_PREFIX;
  protected readonly inputId = `budget-input-${nextId++}`;
  private readonly money = new MoneyPipe();

  protected readonly showHint = computed(() => this.value() === null && this.hint() !== null);
  protected readonly placeholder = computed(() => {
    const hint = this.hint();
    return this.showHint() && hint !== null ? this.text.previousBudget(this.money.transform(hint)) : '';
  });

  protected readonly edited = computed(() =>
    this.state() === SaveState.Dirty || this.state() === SaveState.Saving || this.state() === SaveState.Error);

  protected onInput(event: Event): void {
    const raw = (event.target as HTMLInputElement).value;
    const parsed = raw === '' ? null : Number(raw);
    this.valueChange.emit(parsed == null || Number.isNaN(parsed) ? null : Math.max(0, parsed));
  }
}
