import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { IconComponent } from '../../../../../shared/components/icon/icon';
import { SpinnerComponent } from '../../../../../shared/components/spinner/spinner';
import { UiIcon } from '../../../../../shared/constants/ui-icons';
import { SaveState } from '../../budget.enums';
import { BUDGET_TEXT } from '../../budget.texts';
import { CategoryOption, OptionGroup } from '../../models/budget.models';

/** The "Otra" panel: `w-56`, capped at `100vw - 3rem`; kept this far from the screen's edges. */
const PANEL_WIDTH_PX = 224;
const PANEL_MAX_GUTTERS_PX = 48;
const PANEL_EDGE_PX = 16;

const CHIP_BASE = 'inline-flex items-center gap-1 px-2.5 py-1 rounded-full border text-meta transition-colors disabled:opacity-40';

/**
 * Current category + suggestions + "Otra" (searchable list of the line's groups).
 * Outline-only chips: selected = dark border + check; no fill colour anywhere.
 */
@Component({
  selector: 'app-category-chips',
  imports: [IconComponent, NgTemplateOutlet, SpinnerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block', '(keydown.escape)': 'close()' },
  templateUrl: './category-chips.html',
})
export class CategoryChipsComponent {
  /** Category shown as selected (optimistic while saving). */
  readonly selectedId = input<number | null>(null);
  readonly suggestions = input<CategoryOption[]>([]);
  /** Every account "Otra" can offer: names the selected chip when it isn't in the row's groups. */
  readonly options = input<CategoryOption[]>([]);
  /** The groups "Otra" lists for this line, in order (`optionsForLine`). */
  readonly groups = input<OptionGroup[]>([]);
  readonly state = input(SaveState.Idle);
  readonly choose = output<number>();

  protected readonly text = BUDGET_TEXT;
  protected readonly icons = UiIcon;
  protected readonly states = SaveState;
  protected readonly chipClass = {
    selected: `${CHIP_BASE} border-gray-900 text-gray-900 font-medium`,
    idle:     `${CHIP_BASE} border-gray-200 text-gray-500 hover:border-gray-400`,
  };
  protected readonly open = signal(false);
  protected readonly query = signal('');
  /** The panel's left, relative to the button: 0, or shifted left so it doesn't run off the screen (phones). */
  protected readonly panelLeft = signal(0);

  protected readonly saving = computed(() => this.state() === SaveState.Saving);

  /** Selected chip first (even if it came from "Otra"), then suggestions. */
  protected readonly chips = computed(() => {
    const id = this.selectedId();
    const selected = id == null ? null
      : this.options().find(o => o.accountId === id)
        ?? this.suggestions().find(o => o.accountId === id) ?? null;
    const rest = this.suggestions().filter(o => o.accountId !== id);
    return selected ? [selected, ...rest] : rest;
  });

  protected readonly filteredGroups = computed(() =>
    this.groups()
      .map(g => ({ label: g.label, options: this.matching(g.options) }))
      .filter(g => g.options.length > 0));

  protected pick(accountId: number): void {
    this.close();
    if (!this.saving()) this.choose.emit(accountId);
  }

  protected toggle(trigger: HTMLElement): void {
    if (!this.open()) this.panelLeft.set(this.fitOnScreen(trigger.getBoundingClientRect().left));
    this.open.update(v => !v);
    this.query.set('');
  }

  protected close(): void {
    this.open.set(false);
  }

  protected onSearch(event: Event): void {
    this.query.set((event.target as HTMLInputElement).value);
  }

  /** How far left to shift a panel opened at `buttonLeft` so it ends before the screen's right edge. */
  private fitOnScreen(buttonLeft: number): number {
    const viewport = window.innerWidth;
    const width = Math.min(PANEL_WIDTH_PX, viewport - PANEL_MAX_GUTTERS_PX);
    const left = Math.max(PANEL_EDGE_PX, Math.min(buttonLeft, viewport - PANEL_EDGE_PX - width));
    return left - buttonLeft;
  }

  private matching(options: CategoryOption[]): CategoryOption[] {
    const q = this.query().trim().toLowerCase();
    return q ? options.filter(o => o.name.toLowerCase().includes(q)) : options;
  }
}
