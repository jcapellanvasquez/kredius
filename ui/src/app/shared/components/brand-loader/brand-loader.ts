import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * Loading system §1: the K mark breathing inside a spinning ring. Only for app start, for a couple of
 * seconds at most; longer loads show a skeleton of the real content instead.
 */
@Component({
  selector: 'app-brand-loader',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex flex-col items-center justify-center', role: 'status' },
  template: `
    <div class="relative w-[72px] h-[72px]">
      <svg class="brand-pulse relative z-[1]" width="72" height="72" viewBox="0 0 72 72" aria-hidden="true">
        <path d="M28 22 L28 50 M28 36 L44 22" class="stroke-brand-500" stroke-width="4.5" stroke-linecap="round"
          stroke-linejoin="round" fill="none" />
        <path d="M32 40 L44 52" class="stroke-brand-500" stroke-width="4.5" stroke-linecap="round" fill="none" />
        <circle cx="44" cy="22" r="4.5" class="fill-brand-500" />
      </svg>
      <span class="absolute inset-0 rounded-full border-[2.5px] border-brand-50 border-t-brand-500 animate-spin [animation-duration:900ms]"></span>
    </div>
    <p class="mt-3.5 text-xs text-gray-400">{{ label() }}</p>
  `,
})
export class BrandLoaderComponent {
  readonly label = input('Cargando Kredius…');
}
