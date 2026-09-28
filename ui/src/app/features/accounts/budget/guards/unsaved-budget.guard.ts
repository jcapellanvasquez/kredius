import { CanDeactivateFn } from '@angular/router';
import { BUDGET_TEXT } from '../budget.texts';

export interface HasUnsavedChanges {
  hasUnsavedChanges(): boolean;
}

/** Budget edits are never autosaved (spec §5), so leaving with drafts asks first. */
export const unsavedBudgetGuard: CanDeactivateFn<HasUnsavedChanges> = component =>
  !component.hasUnsavedChanges() || confirm(BUDGET_TEXT.unsavedConfirm);
