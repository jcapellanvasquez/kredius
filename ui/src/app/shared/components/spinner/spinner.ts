import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

export enum SpinnerSize {
  /** 13px: inside chips and next to small text. */
  Sm = 'sm',
  /** 15px: inside buttons. */
  Md = 'md',
}

export enum SpinnerTone {
  /** Violet on a light background. */
  OnLight = 'on-light',
  /** White on the violet primary button. */
  OnAccent = 'on-accent',
}

const SIZE_CLASS: Record<SpinnerSize, string> = {
  [SpinnerSize.Sm]: 'w-[13px] h-[13px]',
  [SpinnerSize.Md]: 'w-[15px] h-[15px]',
};

const TONE_CLASS: Record<SpinnerTone, string> = {
  [SpinnerTone.OnLight]: 'border-brand-50 border-t-brand-500',
  [SpinnerTone.OnAccent]: 'border-white/35 border-t-white',
};

/**
 * Loading system §2/§4: a ring spinner. Decorative (`aria-hidden`): put the state in text next to it
 * ("Guardando…") or `aria-busy` on the region.
 */
@Component({
  selector: 'app-spinner',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'inline-flex shrink-0', 'aria-hidden': 'true' },
  template: `<span [class]="ringClass()"></span>`,
})
export class SpinnerComponent {
  readonly size = input(SpinnerSize.Sm);
  readonly tone = input(SpinnerTone.OnLight);

  protected readonly ringClass = computed(
    () => `block rounded-full border-2 animate-spin [animation-duration:700ms] ${SIZE_CLASS[this.size()]} ${TONE_CLASS[this.tone()]}`,
  );
}
