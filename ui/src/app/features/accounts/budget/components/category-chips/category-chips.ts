import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { IconComponent } from '../../../../../shared/components/icon/icon';
import { SpinnerComponent } from '../../../../../shared/components/spinner/spinner';
import { UiIcon } from '../../../../../shared/constants/ui-icons';
import { AccountOptionKind, SaveState } from '../../budget.enums';
import { BUDGET_TEXT } from '../../budget.texts';
import { AccountOption, CategoryOption, OptionGroup } from '../../models/budget.models';

/**
 * The "Otra" panel. Phones (below Tailwind's `sm`): as wide as the chips, under them. Desktop: a `w-[340px]`
 * popover under "Otra", capped at `100vw - 3rem` and kept this far from the screen's edges.
 */
const DESKTOP_QUERY = '(min-width: 640px)';
const PANEL_WIDTH_PX = 340;
const PANEL_MAX_GUTTERS_PX = 48;
const PANEL_EDGE_PX = 16;

/** Options that get a short line under the name ("Pago de tarjeta"): money moving between your accounts. */
const TRANSFER_KINDS: ReadonlySet<AccountOptionKind> = new Set([AccountOptionKind.Card, AccountOptionKind.Loan]);

/** Lower case without accents, so "prestamo" finds "Préstamo". */
const normalize = (text: string) => text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();

const CHIP_BASE = 'inline-flex items-center gap-1 px-2.5 py-1 rounded-full border text-meta transition-colors disabled:opacity-40';

/**
 * Current category + suggestions + "Otra" (searchable list of the line's groups).
 * Outline-only chips: selected = dark border + check; no fill colour anywhere.
 */
@Component({
  selector: 'app-category-chips',
  imports: [IconComponent, NgTemplateOutlet, SpinnerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block relative', '(keydown.escape)': 'close()' },
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
  /** Accounts outside the groups: listed under "Otras cuentas" only while searching. */
  readonly others = input<AccountOption[]>([]);
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
  /** Desktop: the panel's left, relative to "Otra", shifted so it stays on screen. Null on phones (full width). */
  protected readonly panelLeft = signal<number | null>(null);

  protected readonly saving = computed(() => this.state() === SaveState.Saving);
  /** Typing turns the groups into one flat list, each result labelled with its kind. */
  protected readonly searching = computed(() => this.query().trim() !== '');

  /** Selected chip first (even if it came from "Otra"), then suggestions. */
  protected readonly chips = computed(() => {
    const id = this.selectedId();
    const selected = id == null ? null
      : this.options().find(o => o.accountId === id)
        ?? this.suggestions().find(o => o.accountId === id) ?? null;
    const rest = this.suggestions().filter(o => o.accountId !== id);
    return selected ? [selected, ...rest] : rest;
  });

  protected readonly results = computed(() => this.matching(this.groups().flatMap(g => g.options)));
  protected readonly otherResults = computed(() => this.matching(this.others()));

  protected pick(accountId: number): void {
    this.close();
    if (!this.saving()) this.choose.emit(accountId);
  }

  protected toggle(trigger: HTMLElement): void {
    if (!this.open()) {
      const desktop = window.matchMedia(DESKTOP_QUERY).matches;
      this.panelLeft.set(desktop ? this.fitOnScreen(trigger.getBoundingClientRect().left) : null);
    }
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

  protected kindLabel(option: AccountOption): string {
    return this.text.optionKind[option.kind];
  }

  protected isTransfer(option: AccountOption): boolean {
    return TRANSFER_KINDS.has(option.kind);
  }

  /** Matches the name or the kind ("pago" finds the card), ignoring case and accents. */
  private matching(options: AccountOption[]): AccountOption[] {
    const q = normalize(this.query().trim());
    return options.filter(o => normalize(o.name).includes(q) || normalize(this.kindLabel(o)).includes(q));
  }
}
