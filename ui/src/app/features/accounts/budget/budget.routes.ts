import { Routes } from '@angular/router';
import { BUDGET_ROUTES } from './budget.constants';
import { BudgetPageComponent } from './components/budget-page/budget-page';
import { ImportDetailComponent } from './components/import-detail/import-detail';
import { BudgetApi } from './data/budget-api';
import { BudgetHttpApi } from './data/budget-http-api';
import { unsavedBudgetGuard } from './guards/unsaved-budget.guard';

/** Mounted under the accounts shell at `accounts/budget`. */
export const budgetRoutes: Routes = [
  {
    path: '',
    providers: [{ provide: BudgetApi, useClass: BudgetHttpApi }],
    children: [
      { path: '', component: BudgetPageComponent, canDeactivate: [unsavedBudgetGuard] },
      { path: `${BUDGET_ROUTES.importDetail}/:id`, component: ImportDetailComponent },
    ],
  },
];
