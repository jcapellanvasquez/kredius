import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { IconComponent } from '../../../../../shared/components/icon/icon';
import { UiIcon } from '../../../../../shared/constants/ui-icons';
import { SaveState } from '../../budget.enums';
import { BUDGET_TEXT } from '../../budget.texts';
import { CategoryOption } from '../../models/budget.models';

const CHIP_BASE = 'inline-flex items-center gap-1 px-2.5 py-1 rounded-full border text-xs transition-colors disabled:opacity-40';

/**
 * Current category + suggestions + "Otra" (searchable list of every category).
 * Outline-only chips: selected = dark border + check; no fill colour anywhere.
 */
@Component({
  selector: 'app-category-chips',
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block', '(keydown.escape)': 'close()' },
  templateUrl: './category-chips.html',
})
export class CategoryChipsComponent {
  /** Category shown as selected (optimistic while saving). */
  readonly selectedId = input<number | null>(null);
  readonly suggestions = input<CategoryOption[]>([]);
  readonly options = input<CategoryOption[]>([]);
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

  protected readonly saving = computed(() => this.state() === SaveState.Saving);

  /** Selected chip first (even if it came from "Otra"), then suggestions. */
  protected readonly chips = computed(() => {
    const id = this.selectedId();
    const selected = id == null ? null
      : this.options().find(o => o.accountId === id) ?? this.suggestions().find(o => o.accountId === id) ?? null;
    const rest = this.suggestions().filter(o => o.accountId !== id);
    return selected ? [selected, ...rest] : rest;
  });

  protected readonly filtered = computed(() => {
    const q = this.query().trim().toLowerCase();
    return q ? this.options().filter(o => o.name.toLowerCase().includes(q)) : this.options();
  });

  protected pick(accountId: number): void {
    this.close();
    if (!this.saving()) this.choose.emit(accountId);
  }

  protected toggle(): void {
    this.open.update(v => !v);
    this.query.set('');
  }

  protected close(): void {
    this.open.set(false);
  }

  protected onSearch(event: Event): void {
    this.query.set((event.target as HTMLInputElement).value);
  }
}
