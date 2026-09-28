import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { PROGRESS_FILL_CLASS, ProgressLevel } from '../../utils/progress-level';

/** Thin progress track; fill width is capped at 100% while the level can still signal overflow. */
@Component({
  selector: 'app-progress-bar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <div class="h-1.5 rounded bg-bar-track overflow-hidden">
      <div class="h-full rounded transition-[width] duration-300" [class]="fillClass()" [style.width.%]="width()"></div>
    </div>
  `,
})
export class ProgressBarComponent {
  readonly pct = input<number | null>(null);
  readonly level = input(ProgressLevel.Neutral);

  protected readonly width = computed(() => Math.max(0, Math.min(this.pct() ?? 0, 100)));
  protected readonly fillClass = computed(() => PROGRESS_FILL_CLASS[this.level()]);
}
