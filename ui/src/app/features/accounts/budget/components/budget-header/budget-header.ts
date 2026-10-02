import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { IconComponent } from '../../../../../shared/components/icon/icon';
import { MonthPickerComponent } from '../../../../../shared/components/month-picker/month-picker';
import { UiIcon } from '../../../../../shared/constants/ui-icons';
import { Period } from '../../../../../shared/utils/period';
import { BUDGET_TEXT } from '../../budget.texts';

@Component({
  selector: 'app-budget-header',
  imports: [IconComponent, MonthPickerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <div class="flex flex-wrap items-center justify-between gap-2">
      <h1 class="text-lg font-semibold text-gray-900">{{ text.title }}</h1>
      <!-- Mobile: own row, picker left / button right. From sm: grouped next to the title. -->
      <div class="flex w-full items-center justify-between gap-2 sm:w-auto sm:justify-start">
        <app-month-picker [value]="period()" [disabled]="busy()" (valueChange)="periodChange.emit($event)" />
        <button type="button" (click)="toggleUpload.emit()" [attr.aria-expanded]="uploadOpen()"
          class="inline-flex items-center gap-1 px-2.5 py-1.5 text-meta text-gray-600 bg-white border border-gray-200 rounded-lg hover:border-gray-400 transition-colors"
          [class.border-gray-900]="uploadOpen()">
          <app-icon [name]="icons.Refresh" [size]="14" />
          {{ text.update }}
        </button>
      </div>
    </div>
    @if (summary(); as s) {
      <p animate.enter="fade-in" class="mt-1 text-meta text-gray-500" role="status">{{ s }}</p>
    }
  `,
})
export class BudgetHeaderComponent {
  readonly period = input.required<Period>();
  readonly busy = input(false);
  readonly uploadOpen = input(false);
  /** Result of the last "Procesar", e.g. "12 nuevas · 3 sin categorizar". */
  readonly summary = input<string | null>(null);

  readonly periodChange = output<Period>();
  readonly toggleUpload = output<void>();

  protected readonly text = BUDGET_TEXT;
  protected readonly icons = UiIcon;
}
