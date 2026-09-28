import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { IconComponent } from '../icon/icon';

export enum AccountIconSize {
  Sm = 'sm',
  Md = 'md',
  Lg = 'lg',
  Xl = 'xl',
}

const TILE_CLASS: Record<AccountIconSize, string> = {
  [AccountIconSize.Sm]: 'w-[22px] h-[22px] rounded-md',
  [AccountIconSize.Md]: 'w-8 h-8 rounded-[9px]',
  [AccountIconSize.Lg]: 'w-9 h-9 rounded-[10px]',
  [AccountIconSize.Xl]: 'w-10 h-10 rounded-[10px]',
};

const GLYPH_PX: Record<AccountIconSize, number> = {
  [AccountIconSize.Sm]: 12,
  [AccountIconSize.Md]: 16,
  [AccountIconSize.Lg]: 16,
  [AccountIconSize.Xl]: 18,
};

/** Square tile with an account's icon. Neutral by default; `highlight` tints it with the brand accent. */
@Component({
  selector: 'app-account-icon',
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'contents' },
  template: `
    <span [class]="tileClass()">
      <app-icon [name]="icon()" [size]="glyphPx()" />
    </span>
  `,
})
export class AccountIconComponent {
  readonly icon = input.required<string>();
  readonly size = input(AccountIconSize.Md);
  readonly highlight = input(false);

  protected readonly glyphPx = computed(() => GLYPH_PX[this.size()]);
  protected readonly tileClass = computed(() => [
    'flex items-center justify-center shrink-0',
    TILE_CLASS[this.size()],
    this.highlight() ? 'bg-brand-50 text-brand-800' : 'bg-gray-50 text-gray-500',
  ].join(' '));
}
