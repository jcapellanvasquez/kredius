import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { IconComponent } from '../icon/icon';
import { SHARED_TEXT } from '../../constants/shared-texts';
import { UiIcon } from '../../constants/ui-icons';
import { Period, periodLabel, periodLongLabel, shiftPeriod } from '../../utils/period';

/**
 * ‹ month year › control. Emits the requested period; the parent decides whether to accept it
 * (e.g. after confirming unsaved changes), so `value` stays the single source of truth.
 * On phones it's a full-width card with the full month name, 44px arrows and the projected content
 * (a status) under the month; from `sm` up it's the compact inline control and the content is hidden.
 */
@Component({
  selector: 'app-month-picker',
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'grid grid-cols-[2.75rem_1fr_2.75rem] items-center px-1 py-2 bg-white border border-gray-200 rounded-2xl ' +
      'sm:inline-flex sm:gap-1 sm:p-0 sm:bg-transparent sm:border-0 sm:rounded-none',
  },
  template: `
    <button type="button" (click)="step(-1)" [disabled]="disabled()"
      [attr.aria-label]="text.previousMonth" [class]="arrowClass">
      <app-icon [name]="icons.ChevronLeft" [class]="arrowIconClass" />
    </button>
    <div class="flex flex-col items-center min-w-0 text-center">
      <span class="text-xl font-bold text-gray-900 capitalize sm:hidden">{{ longLabel() }}</span>
      <span class="hidden sm:inline text-sm font-medium text-gray-800 min-w-[5.5rem] capitalize">{{ label() }}</span>
      <div class="mt-1 empty:hidden sm:hidden"><ng-content /></div>
    </div>
    <button type="button" (click)="step(1)" [disabled]="disabled() || atMax()"
      [attr.aria-label]="text.nextMonth" [class]="arrowClass">
      <app-icon [name]="icons.ChevronRight" [class]="arrowIconClass" />
    </button>
  `,
})
export class MonthPickerComponent {
  readonly value = input.required<Period>();
  readonly disabled = input(false);
  /** The last period › can reach; null for no limit. */
  readonly max = input<Period | null>(null);
  readonly valueChange = output<Period>();

  protected readonly text = SHARED_TEXT;
  protected readonly icons = UiIcon;
  protected readonly label = computed(() => periodLabel(this.value()));
  protected readonly longLabel = computed(() => periodLongLabel(this.value()));
  /** Periods are `YYYY-MM-01`, so they compare as strings. */
  protected readonly atMax = computed(() => this.max() !== null && this.value() >= this.max()!);

  protected readonly arrowClass =
    'grid place-items-center size-11 rounded-xl text-gray-800 enabled:hover:bg-gray-100 disabled:text-gray-300 transition-colors ' +
    'sm:size-auto sm:p-1 sm:rounded sm:text-gray-400 sm:enabled:hover:bg-transparent sm:hover:text-gray-700 sm:disabled:opacity-40';
  /** app-icon sets its size inline, so the phone/desktop sizes override it. */
  protected readonly arrowIconClass = '[&_i]:!text-[22px] sm:[&_i]:!text-base';

  protected step(delta: number): void {
    this.valueChange.emit(shiftPeriod(this.value(), delta));
  }
}
