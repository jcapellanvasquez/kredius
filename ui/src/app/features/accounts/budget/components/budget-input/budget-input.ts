import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
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
      <label [for]="inputId" class="text-body text-gray-500 shrink-0 w-24">{{ text.budget }}</label>
      <div class="relative flex-1">
        <span class="absolute inset-y-0 left-3 flex items-center text-body text-gray-400 pointer-events-none">{{ prefix }}</span>
        <input #field [id]="inputId" type="number" inputmode="decimal" enterkeyhint="done" min="0" step="100"
          [value]="value() ?? ''" [disabled]="state() === states.Saving" (input)="onInput(field)"
          (blur)="unreadable.set(field.validity.badInput)" (keydown.enter)="field.blur()"
          class="w-full pl-10 pr-3 py-1.5 text-body text-gray-900 tabular-nums bg-white rounded-lg border focus:outline-none focus:ring-2 focus:ring-brand-300 disabled:bg-gray-50 transition-colors"
          [class.border-gray-900]="edited()" [class.border-gray-200]="!edited()" />
      </div>
    </div>
    @if (unreadable()) {
      <p class="mt-1 text-right text-meta text-gray-900" role="alert">{{ text.unreadableNumber }}</p>
    }
    @switch (state()) {
      @case (states.Saved) {
        <p class="mt-1 flex items-center justify-end gap-0.5 text-meta text-gray-500" role="status">
          <app-icon [name]="icons.Check" [size]="12" /> {{ text.saved }}
        </p>
      }
      @case (states.Idle) {
        @if (carriedMonth()) {
          <p class="mt-1 text-right text-meta text-gray-400">{{ text.sameAs(carriedMonth()) }}</p>
        }
      }
      @default {
        <p class="mt-1 text-right text-meta text-gray-900">• {{ text.unsaved }}</p>
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
  /** What's typed can't be read as a number (shown on blur, so a half-typed "12." doesn't flash it). */
  protected readonly unreadable = signal(false);

  protected readonly carriedMonth = computed(() => {
    const from = this.carriedFrom();
    return from ? monthName(from) : '';
  });

  protected readonly edited = computed(() =>
    this.state() === SaveState.Dirty || this.state() === SaveState.Saving || this.state() === SaveState.Error);

  protected onInput(field: HTMLInputElement): void {
    // Unreadable input reads as '': keep the last value instead of emitting null, which would clear the budget.
    if (field.validity.badInput) return;
    this.unreadable.set(false);
    const raw = field.value;
    const parsed = raw === '' ? null : Number(raw);
    this.valueChange.emit(parsed == null || Number.isNaN(parsed) ? null : Math.max(0, parsed));
  }
}
