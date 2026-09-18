import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', redirectTo: 'accounts', pathMatch: 'full' },
  {
    path: 'accounts',
    loadChildren: () => import('./features/cuentas/cuentas.routes').then((m) => m.cuentasRoutes),
  },
  { path: '**', redirectTo: 'accounts' },
];
