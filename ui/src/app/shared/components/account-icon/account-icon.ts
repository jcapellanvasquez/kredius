import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { IconComponent } from '../icon/icon';

export enum AccountIconSize {
  Sm = 'sm',
  Md = 'md',
  Lg = 'lg',
  Xl = 'xl',
}

const TILE_CLASS: Record<AccountIconSize, string> = {
  [AccountIconSize.Sm]: 'w-[22px] h-[22px]',
  [AccountIconSize.Md]: 'w-8 h-8',
  [AccountIconSize.Lg]: 'w-9 h-9',
  [AccountIconSize.Xl]: 'w-10 h-10',
};

/** Brand violet only (never financial meaning): a soft gradient, stronger for the highlighted account. */
const TONE_CLASS = {
  normal:    'bg-gradient-to-br from-brand-50 to-brand-200 text-brand-800',
  highlight: 'bg-gradient-to-br from-brand-300 to-brand-500 text-white',
} as const;

const GLYPH_PX: Record<AccountIconSize, number> = {
  [AccountIconSize.Sm]: 12,
  [AccountIconSize.Md]: 16,
  [AccountIconSize.Lg]: 16,
  [AccountIconSize.Xl]: 18,
};

/** Round tile with an account's icon on a soft violet gradient; `highlight` uses a stronger one. */
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
    'flex items-center justify-center shrink-0 rounded-full',
    TILE_CLASS[this.size()],
    this.highlight() ? TONE_CLASS.highlight : TONE_CLASS.normal,
  ].join(' '));
}
