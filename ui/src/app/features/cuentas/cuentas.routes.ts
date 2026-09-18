import { Routes } from '@angular/router';
import { CuentasComponent } from './cuentas';
import { DetalleComponent } from './panels/detalle/detalle';
import { FinanciamientoComponent } from './panels/financiamiento/financiamiento';
import { AbonoComponent } from './panels/abono/abono';
import { AltaCuentaComponent } from './panels/alta-cuenta/alta-cuenta';
import { DiccionarioComponent } from './panels/diccionario/diccionario';
import { IngresosComponent } from './panels/ingresos/ingresos';
import { SubirCorteComponent } from './panels/subir-corte/subir-corte';
import { ReportesComponent } from './panels/reportes/reportes';

export const cuentasRoutes: Routes = [
  {
    path: '',
    component: CuentasComponent,
    children: [
      { path: 'detail', component: DetalleComponent },
      { path: 'financing', component: FinanciamientoComponent },
      { path: 'payment', component: AbonoComponent },
      { path: 'new-account', component: AltaCuentaComponent },
      { path: 'dictionary', component: DiccionarioComponent },
      { path: 'income', component: IngresosComponent },
      { path: 'upload-statement', component: SubirCorteComponent },
      { path: 'reports', component: ReportesComponent },
    ],
  },
];
