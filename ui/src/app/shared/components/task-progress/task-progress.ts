import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/**
 * Loading system §5: a long task's progress. With `value` (0–100) the bar fills for real and shows the %;
 * with `value` null the work can't be measured and the bar slides (indeterminate).
 */
@Component({
  selector: 'app-task-progress',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    @if (step()) {
      <p class="mb-1 text-xs text-gray-500">{{ step() }}</p>
    }
    <div class="flex items-baseline justify-between gap-2 mb-1.5 text-sm">
      <span class="font-medium text-gray-900" aria-live="polite">{{ status() }}</span>
      @if (percent() !== null) {
        <span class="text-xs text-gray-500 tabular-nums">{{ percent() }}%</span>
      }
    </div>
    <div class="h-1.5 rounded bg-bar-track overflow-hidden" role="progressbar" [attr.aria-label]="status()"
      [attr.aria-valuemin]="percent() === null ? null : 0" [attr.aria-valuemax]="percent() === null ? null : 100"
      [attr.aria-valuenow]="percent()">
      @if (percent() === null) {
        <div class="progress-indeterminate h-full w-1/3 rounded bg-brand-400"></div>
      } @else {
        <div class="h-full rounded bg-brand-500 transition-[width] duration-300" [style.width.%]="percent()"></div>
      }
    </div>
  `,
})
export class TaskProgressComponent {
  /** What's happening now, e.g. "Subiendo…" or "Procesando estado…". */
  readonly status = input.required<string>();
  /** Small line above, e.g. "Estado 1 de 2 · Tarjeta". */
  readonly step = input<string | null>(null);
  /** 0–100, or null when the progress can't be measured. */
  readonly value = input<number | null>(null);

  protected readonly percent = computed(() => {
    const value = this.value();
    return value === null ? null : Math.round(Math.max(0, Math.min(value, 100)));
  });
}
