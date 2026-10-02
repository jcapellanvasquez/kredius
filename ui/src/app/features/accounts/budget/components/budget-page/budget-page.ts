import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { IconComponent } from '../../../../../shared/components/icon/icon';
import { UiIcon } from '../../../../../shared/constants/ui-icons';
import { BUDGET_TEXT } from '../../budget.texts';
import { HasUnsavedChanges } from '../../guards/unsaved-budget.guard';
import { BudgetStore } from '../../state/budget-store';
import { BudgetHeaderComponent } from '../budget-header/budget-header';
import { CategoryListComponent } from '../category-list/category-list';
import { QuickCompareComponent } from '../quick-compare/quick-compare';
import { SaveBarComponent } from '../save-bar/save-bar';
import { SummaryCardsComponent } from '../summary-cards/summary-cards';
import { UploadHistoryComponent } from '../upload-history/upload-history';
import { UploadPanelComponent } from '../upload-panel/upload-panel';

@Component({
  selector: 'app-budget-page',
  imports: [
    IconComponent, BudgetHeaderComponent, UploadPanelComponent, UploadHistoryComponent, SummaryCardsComponent,
    QuickCompareComponent, CategoryListComponent, SaveBarComponent,
  ],
  providers: [BudgetStore],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block', '(window:beforeunload)': 'onBeforeUnload($event)' },
  templateUrl: './budget-page.html',
})
export class BudgetPageComponent implements OnInit, HasUnsavedChanges {
  protected readonly store = inject(BudgetStore);
  protected readonly text = BUDGET_TEXT;
  protected readonly icons = UiIcon;
  protected readonly skeletonRows = [0, 1, 2, 3];
  /** Widths (%) of the summary cards' skeleton rows. */
  protected readonly skeletonSummaryLines = [100, 100, 80, 60];
  /**
   * Single column up to `xl`; from there a sticky glance column + the editable detail column.
   * `xl` (not `lg`) because the accounts sidebar takes 384px of the viewport.
   */
  protected readonly layout = {
    grid:   'grid gap-5 xl:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] xl:items-start',
    aside:  'flex flex-col gap-5 min-w-0 xl:sticky xl:top-0',
    detail: 'flex flex-col gap-5 min-w-0',
  };

  ngOnInit(): void {
    this.store.init();
  }

  hasUnsavedChanges(): boolean {
    return this.store.hasUnsavedChanges();
  }

  protected onBeforeUnload(event: BeforeUnloadEvent): void {
    if (this.store.hasUnsavedChanges()) event.preventDefault();
  }
}
