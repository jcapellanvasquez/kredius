import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { PROGRESS_STROKE_CLASS, ProgressLevel } from '../../utils/progress-level';

const RADIUS = 15;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

@Component({
  selector: 'app-progress-ring',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'inline-block shrink-0' },
  template: `
    <svg [attr.width]="size()" [attr.height]="size()" viewBox="0 0 38 38" role="img" [attr.aria-label]="label()">
      <circle cx="19" cy="19" [attr.r]="radius" fill="none" class="stroke-bar-track" stroke-width="4" />
      <circle cx="19" cy="19" [attr.r]="radius" fill="none" [class]="strokeClass()" stroke-width="4"
        stroke-linecap="round" transform="rotate(-90 19 19)"
        [attr.stroke-dasharray]="circumference" [attr.stroke-dashoffset]="offset()" />
      <text x="19" y="22" font-size="9" text-anchor="middle" class="fill-gray-900" font-weight="600">{{ label() }}</text>
    </svg>
  `,
})
export class ProgressRingComponent {
  readonly pct = input<number | null>(null);
  readonly level = input(ProgressLevel.Neutral);
  readonly size = input(40);

  protected readonly radius = RADIUS;
  protected readonly circumference = CIRCUMFERENCE;
  protected readonly offset = computed(() => CIRCUMFERENCE * (1 - Math.max(0, Math.min(this.pct() ?? 0, 100)) / 100));
  protected readonly strokeClass = computed(() => PROGRESS_STROKE_CLASS[this.level()]);
  protected readonly label = computed(() => `${this.pct() ?? 0}%`);
}
