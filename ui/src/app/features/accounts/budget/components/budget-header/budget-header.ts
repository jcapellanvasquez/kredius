import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { IconComponent } from '../../../../../shared/components/icon/icon';
import { MonthPickerComponent } from '../../../../../shared/components/month-picker/month-picker';
import { UiIcon } from '../../../../../shared/constants/ui-icons';
import { Period } from '../../../../../shared/utils/period';
import { MonthStatusTone } from '../../budget.enums';
import { BUDGET_TEXT } from '../../budget.texts';
import { MonthStatusView } from '../../models/budget.models';

const PILL = 'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-caption font-medium ' +
  'before:size-1.5 before:rounded-full before:bg-current';
const PILL_TONE: Record<MonthStatusTone, string> = {
  [MonthStatusTone.Pending]:   'bg-amber-100 text-amber-700',
  [MonthStatusTone.Confirmed]: 'bg-green-100 text-income',
  [MonthStatusTone.Missing]:   'bg-gray-100 text-gray-500',
  [MonthStatusTone.Planning]:  'bg-brand-50 text-brand-800',
};

@Component({
  selector: 'app-budget-header',
  imports: [IconComponent, MonthPickerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <!-- Phones: title + Actualizar, then the month card on its own row (the wrapper is display:contents
         so both are items of this row). From sm: picker and button grouped next to the title. -->
    <div class="flex flex-wrap items-center gap-2 sm:justify-between">
      <h1 class="flex-1 text-lg font-semibold text-gray-900 sm:flex-none">{{ text.title }}</h1>
      <div class="contents sm:flex sm:items-center sm:gap-2">
        <app-month-picker class="order-last w-full sm:order-none sm:w-auto"
          [value]="period()" [max]="max()" [disabled]="busy()" (valueChange)="periodChange.emit($event)">
          @if (status(); as s) {
            @if (s.tone === tones.Pending) {
              <button type="button" [class]="pillClass(s.tone)" (click)="showPending.emit()">{{ s.text }}</button>
            } @else {
              <span [class]="pillClass(s.tone)">{{ s.text }}</span>
            }
          }
        </app-month-picker>
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
  /** The last period › can reach. */
  readonly max = input<Period | null>(null);
  /** Shown under the month on phones; null while the month loads. */
  readonly status = input<MonthStatusView | null>(null);
  readonly busy = input(false);
  readonly uploadOpen = input(false);
  /** Result of the last "Procesar", e.g. "12 nuevas · 3 sin categorizar". */
  readonly summary = input<string | null>(null);

  readonly periodChange = output<Period>();
  readonly toggleUpload = output<void>();
  /** The "N sin categorizar" status was tapped. */
  readonly showPending = output<void>();

  protected readonly text = BUDGET_TEXT;
  protected readonly icons = UiIcon;
  protected readonly tones = MonthStatusTone;

  protected pillClass(tone: MonthStatusTone): string {
    return `${PILL} ${PILL_TONE[tone]}`;
  }
}
