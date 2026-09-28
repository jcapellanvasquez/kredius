import { Routes } from '@angular/router';
import { BUDGET_ROUTES } from './budget.constants';
import { BudgetPageComponent } from './components/budget-page/budget-page';
import { ImportDetailComponent } from './components/import-detail/import-detail';
import { BudgetApi } from './data/budget-api';
import { BudgetMockApi } from './data/budget-mock-api';
import { unsavedBudgetGuard } from './guards/unsaved-budget.guard';

/** Mounted under the accounts shell at `accounts/budget`. */
export const budgetRoutes: Routes = [
  {
    path: '',
    // Swap for the HTTP implementation once the backend endpoints exist (UI plan §9).
    providers: [{ provide: BudgetApi, useClass: BudgetMockApi }],
    children: [
      { path: '', component: BudgetPageComponent, canDeactivate: [unsavedBudgetGuard] },
      { path: `${BUDGET_ROUTES.importDetail}/:id`, component: ImportDetailComponent },
    ],
  },
];
