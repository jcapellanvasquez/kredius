import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/**
 * Tabler webfont icon. Swap the template for `@tabler/icons-angular` once the app is on Angular 21+.
 */
@Component({
  selector: 'app-icon',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'inline-flex items-center justify-center leading-none' },
  template: `<i [class]="iconClass()" [style.font-size.px]="size()" aria-hidden="true"></i>`,
})
export class IconComponent {
  readonly name = input.required<string>();
  readonly size = input(16);

  protected readonly iconClass = computed(() => `ti ti-${this.name()}`);
}
