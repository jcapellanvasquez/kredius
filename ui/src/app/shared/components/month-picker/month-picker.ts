import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { IconComponent } from '../icon/icon';
import { SHARED_TEXT } from '../../constants/shared-texts';
import { UiIcon } from '../../constants/ui-icons';
import { Period, periodLabel, shiftPeriod } from '../../utils/period';

/**
 * ‹ month year › control. Emits the requested period; the parent decides whether to accept it
 * (e.g. after confirming unsaved changes), so `value` stays the single source of truth.
 */
@Component({
  selector: 'app-month-picker',
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'inline-flex items-center gap-1' },
  template: `
    <button type="button" (click)="step(-1)" [disabled]="disabled()"
      [attr.aria-label]="text.previousMonth"
      class="p-1 text-gray-400 hover:text-gray-700 disabled:opacity-40 transition-colors rounded">
      <app-icon [name]="icons.ChevronLeft" />
    </button>
    <span class="text-sm font-medium text-gray-800 min-w-[5.5rem] text-center capitalize">{{ label() }}</span>
    <button type="button" (click)="step(1)" [disabled]="disabled()"
      [attr.aria-label]="text.nextMonth"
      class="p-1 text-gray-400 hover:text-gray-700 disabled:opacity-40 transition-colors rounded">
      <app-icon [name]="icons.ChevronRight" />
    </button>
  `,
})
export class MonthPickerComponent {
  readonly value = input.required<Period>();
  readonly disabled = input(false);
  readonly valueChange = output<Period>();

  protected readonly text = SHARED_TEXT;
  protected readonly icons = UiIcon;
  protected readonly label = computed(() => periodLabel(this.value()));

  protected step(delta: number): void {
    this.valueChange.emit(shiftPeriod(this.value(), delta));
  }
}
