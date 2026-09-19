import { Routes } from '@angular/router';
import { AccountsComponent } from './accounts';
import { DetailComponent } from './panels/detail/detail';
import { FinancingComponent } from './panels/financing/financing';
import { PaymentComponent } from './panels/payment/payment';
import { NewAccountComponent } from './panels/new-account/new-account';
import { DictionaryComponent } from './panels/dictionary/dictionary';
import { IncomeComponent } from './panels/income/income';
import { UploadStatementComponent } from './panels/upload-statement/upload-statement';
import { ReportsComponent } from './panels/reports/reports';

export const accountsRoutes: Routes = [
  {
    path: '',
    component: AccountsComponent,
    children: [
      { path: 'detail', component: DetailComponent },
      { path: 'financing', component: FinancingComponent },
      { path: 'payment', component: PaymentComponent },
      { path: 'new-account', component: NewAccountComponent },
      { path: 'dictionary', component: DictionaryComponent },
      { path: 'income', component: IncomeComponent },
      { path: 'upload-statement', component: UploadStatementComponent },
      { path: 'reports', component: ReportsComponent },
    ],
  },
];
