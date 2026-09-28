import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { IconComponent } from '../../../../../shared/components/icon/icon';
import { UiIcon } from '../../../../../shared/constants/ui-icons';
import { SaveState } from '../../budget.enums';
import { BUDGET_TEXT } from '../../budget.texts';

/**
 * One batched save for every edited budget.
 * - Mobile/tablet: full-width sticky button, always visible (spec §2.5).
 * - `xl`+: compact floating bar (status left, button right), shown only while there is something to save or report.
 */
const HOST_CLASS =
  'block sticky bottom-0 z-[5] pt-4 pb-1 bg-gradient-to-t from-gray-50 from-60% to-transparent ' +
  'xl:bg-none xl:pt-2 xl:pb-4';

const BUTTON_BASE =
  'inline-flex items-center justify-center gap-1.5 text-sm font-medium text-white bg-brand-500 rounded-lg ' +
  'hover:bg-brand-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors';

@Component({
  selector: 'app-save-bar',
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class]': 'hostClass()' },
  template: `
    <div class="xl:flex xl:items-center xl:gap-3 xl:rounded-lg xl:border xl:border-gray-200 xl:bg-white xl:shadow-lg xl:pl-4 xl:pr-2 xl:py-2">
      <p class="hidden xl:flex items-center gap-1.5 flex-1 min-w-0 text-sm text-gray-600" role="status">
        @switch (state()) {
          @case (states.Saving) { {{ text.saving }} }
          @case (states.Saved) {
            <app-icon [name]="icons.Check" [size]="16" /> {{ text.saved }}
          }
          @case (states.Error) {
            <app-icon [name]="icons.Alert" [size]="16" class="text-gray-900" /> {{ text.saveFailed }}
          }
          @default {
            <span class="w-1.5 h-1.5 rounded-full bg-gray-900 shrink-0"></span> {{ text.pendingChanges(count()) }}
          }
        }
      </p>

      <button type="button" (click)="save.emit()" [disabled]="disabled()" [class]="buttonClass">
        @switch (state()) {
          @case (states.Saving) {
            <app-icon [name]="icons.Loader" [size]="16" class="animate-spin" /> {{ text.saving }}
          }
          @case (states.Saved) {
            <app-icon [name]="icons.Check" [size]="16" /> {{ text.saved }}
          }
          @case (states.Error) {
            <app-icon [name]="icons.Refresh" [size]="16" /> {{ text.retry }}
          }
          @default {
            {{ text.saveChanges }}
            <span class="xl:hidden">{{ text.saveCountSuffix(count()) }}</span>
          }
        }
      </button>
    </div>
  `,
})
export class SaveBarComponent {
  readonly count = input(0);
  readonly state = input(SaveState.Idle);
  readonly save = output<void>();

  protected readonly text = BUDGET_TEXT;
  protected readonly icons = UiIcon;
  protected readonly states = SaveState;
  protected readonly buttonClass = `${BUTTON_BASE} w-full py-2.5 xl:w-auto xl:px-4 xl:py-2 xl:shrink-0`;

  protected readonly disabled = computed(() => this.count() === 0 || this.state() === SaveState.Saving);

  /** On desktop the bar disappears when there is nothing pending, saving, saved or failed. */
  protected readonly hostClass = computed(() =>
    this.count() === 0 && this.state() === SaveState.Idle ? `${HOST_CLASS} xl:hidden` : HOST_CLASS);
}
