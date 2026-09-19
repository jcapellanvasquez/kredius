import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';

interface ReportRow {
  id:           string;
  name:         string;
  budgeted:     number;
  actual:       number;
  showInAlerts: boolean;
  threshold:    number;
  income:       number;
}

interface ReportGroup {
  label:  string;
  rows:   ReportRow[];
}

const MONTHLY_INCOME = 85_000;

const GROUPS: ReportGroup[] = [
  {
    label: 'GASTOS DEL HOGAR',
    rows: [
      { id: '3010', name: '3010 Alimentación',       budgeted: 12_300, actual: 10_355, showInAlerts: true,  threshold: 15, income: MONTHLY_INCOME },
      { id: '3020', name: '3020 Transporte',          budgeted:  3_100, actual:    620, showInAlerts: true,  threshold: 5,  income: MONTHLY_INCOME },
      { id: '3030', name: '3030 Entretenimiento',     budgeted:  2_500, actual:  1_652, showInAlerts: false, threshold: 5,  income: MONTHLY_INCOME },
      { id: '3040', name: '3040 Servicios del hogar', budgeted:  4_200, actual:  4_200, showInAlerts: false, threshold: 5,  income: MONTHLY_INCOME },
      { id: '3050', name: '3050 Gasolina',            budgeted:  3_000, actual:  2_100, showInAlerts: false, threshold: 4,  income: MONTHLY_INCOME },
      { id: '3060', name: '3060 Farmacia',            budgeted:  1_500, actual:    890, showInAlerts: false, threshold: 2,  income: MONTHLY_INCOME },
    ],
  },
  {
    label: 'PASIVOS',
    rows: [
      { id: '2010', name: '2010 Tarjeta de crédito', budgeted: 15_000, actual: 18_230, showInAlerts: true,  threshold: 20, income: MONTHLY_INCOME },
      { id: '2020', name: '2020 Préstamo carro',     budgeted: 20_667, actual: 20_667, showInAlerts: false, threshold: 25, income: MONTHLY_INCOME },
    ],
  },
  {
    label: 'OTROS',
    rows: [
      { id: '3070', name: '3070 Ropa y calzado', budgeted: 2_000, actual: 3_450, showInAlerts: true,  threshold: 3, income: MONTHLY_INCOME },
      { id: '3080', name: '3080 Restaurantes',   budgeted: 1_800, actual: 1_920, showInAlerts: true,  threshold: 2, income: MONTHLY_INCOME },
    ],
  },
];

@Component({
  selector: 'app-reports',
  imports: [FormsModule],
  host: { class: 'block' },
  template: `
    <div class="flex flex-col gap-5">

      <!-- Period selector -->
      <div class="flex items-center justify-between gap-4">
        <select [(ngModel)]="period"
          class="text-sm border border-gray-300 rounded-lg px-3 py-2 text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-brand-300 focus:border-brand-400 transition-colors">
          <option value="oct-2026">Octubre 2026</option>
          <option value="sep-2026">Septiembre 2026</option>
          <option value="aug-2026">Agosto 2026</option>
        </select>
        <div class="flex gap-2">
          <button type="button" (click)="print()"
            class="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-brand-800 bg-brand-50 rounded-lg hover:bg-brand-100 transition-colors">
            <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path stroke="none" d="M0 0h24v24H0z" fill="none"/>
              <path d="M17 17h2a2 2 0 0 0 2 -2v-4a2 2 0 0 0 -2 -2h-14a2 2 0 0 0 -2 2v4a2 2 0 0 0 2 2h2" />
              <path d="M17 9v-4a1 1 0 0 0 -1 -1h-8a1 1 0 0 0 -1 1v4" />
              <path d="M7 13m0 2a2 2 0 0 1 2 -2h6a2 2 0 0 1 2 2v4a2 2 0 0 1 -2 2h-6a2 2 0 0 1 -2 -2z" />
            </svg>
            Imprimir
          </button>
          <button type="button" (click)="exportPdf()"
            class="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-white bg-brand-600 rounded-lg hover:bg-brand-700 transition-colors">
            <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path stroke="none" d="M0 0h24v24H0z" fill="none"/>
              <path d="M14 3v4a1 1 0 0 0 1 1h4" />
              <path d="M5 12v-7a2 2 0 0 1 2 -2h7l5 5v4" />
              <path d="M5 18h1.5a1.5 1.5 0 0 0 0 -3h-1.5v6" />
              <path d="M17 18h2" />
              <path d="M20 15h-3v6" />
              <path d="M11 15a2 2 0 0 1 2 2v2a2 2 0 0 1 -2 2h-1v-6h1z" />
            </svg>
            Exportar PDF
          </button>
        </div>
      </div>

      <!-- Report card -->
      <div class="rounded-2xl border border-gray-200 bg-white overflow-hidden shadow-sm">

        <!-- Violet header -->
        <div class="bg-brand-600 px-5 py-4">
          <p class="text-xs font-semibold text-brand-200 uppercase tracking-widest mb-0.5">Presupuesto mensual</p>
          <p class="text-xl font-bold text-white">{{ periodLabel }}</p>
        </div>

        <!-- Summary cells -->
        <div class="grid grid-cols-3 divide-x divide-gray-100 border-b border-gray-100">
          <div class="px-4 py-3">
            <p class="text-xs text-gray-400 mb-0.5">Ingresos</p>
            <p class="text-base font-bold text-income">{{ incomeFormatted }}</p>
          </div>
          <div class="px-4 py-3">
            <p class="text-xs text-gray-400 mb-0.5">Gastos reales</p>
            <p class="text-base font-bold text-expense">{{ totalActualFormatted }}</p>
          </div>
          <div class="px-4 py-3">
            <p class="text-xs text-gray-400 mb-0.5">Ahorro neto</p>
            <p class="text-base font-bold"
              [class.text-income]="netSavings >= 0"
              [class.text-expense]="netSavings < 0">
              {{ netSavingsFormatted }}
            </p>
          </div>
        </div>

        <!-- Grouped tables -->
        @for (group of groups; track group.label) {
          <div class="border-b border-gray-100 last:border-b-0">

            <!-- Group header -->
            <div class="px-4 py-2 bg-gray-50">
              <p class="text-xs font-semibold text-gray-400 uppercase tracking-widest">{{ group.label }}</p>
            </div>

            <!-- Column headers -->
            <div class="grid grid-cols-3 px-4 py-1.5 border-b border-gray-50">
              <span class="text-xs font-medium text-gray-400">Cuenta</span>
              <span class="text-xs font-medium text-gray-400 text-right">Presupuesto</span>
              <span class="text-xs font-medium text-gray-400 text-right">Real</span>
            </div>

            <!-- Rows -->
            @for (row of group.rows; track row.id) {
              <div class="grid grid-cols-3 items-center px-4 py-2.5 border-b border-gray-50 last:border-b-0"
                [class.bg-red-50]="isOverAlert(row)">
                <div class="flex items-center gap-1.5 min-w-0">
                  @if (isOverAlert(row)) {
                    <svg class="w-3.5 h-3.5 text-expense shrink-0" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"/>
                    </svg>
                  }
                  <span class="text-xs text-gray-700 truncate">{{ row.name }}</span>
                </div>
                <span class="text-xs text-gray-400 text-right">{{ formatRD(row.budgeted) }}</span>
                <span class="text-xs font-medium text-right"
                  [class.text-expense]="isOverAlert(row)"
                  [class.text-gray-700]="!isOverAlert(row)">
                  {{ formatRD(row.actual) }}
                </span>
              </div>
            }

            <!-- Group subtotal -->
            <div class="grid grid-cols-3 px-4 py-2 bg-gray-50 border-t border-gray-100">
              <span class="text-xs font-semibold text-gray-500">Subtotal</span>
              <span class="text-xs font-semibold text-gray-500 text-right">{{ formatRD(groupBudget(group)) }}</span>
              <span class="text-xs font-semibold text-right"
                [class.text-expense]="groupActual(group) > groupBudget(group)"
                [class.text-gray-700]="groupActual(group) <= groupBudget(group)">
                {{ formatRD(groupActual(group)) }}
              </span>
            </div>

          </div>
        }

        <!-- Footer legend -->
        <div class="flex items-center gap-2 px-4 py-3 bg-gray-50 border-t border-gray-100">
          <svg class="w-3.5 h-3.5 text-expense shrink-0" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"/>
          </svg>
          <p class="text-xs text-gray-400">Cuenta con alerta activa que superó su umbral del ingreso mensual.</p>
        </div>

      </div>

      <!-- PDF exported toast -->
      @if (pdfExported) {
        <div class="flex items-center gap-3 rounded-xl border border-brand-200 bg-brand-50 px-4 py-3">
          <svg class="w-5 h-5 text-brand-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"/>
          </svg>
          <p class="text-sm text-brand-800">PDF generado — revisa tu carpeta de descargas.</p>
        </div>
      }

    </div>
  `,
})
export class ReportsComponent {
  period = 'oct-2026';
  pdfExported = false;

  readonly groups = GROUPS;

  get periodLabel(): string {
    const labels: Record<string, string> = {
      'oct-2026': 'Octubre 2026',
      'sep-2026': 'Septiembre 2026',
      'aug-2026': 'Agosto 2026',
    };
    return labels[this.period] ?? this.period;
  }

  get totalActual(): number {
    return this.groups.flatMap(g => g.rows).reduce((s, r) => s + r.actual, 0);
  }

  get netSavings(): number {
    return MONTHLY_INCOME - this.totalActual;
  }

  get incomeFormatted():      string { return 'RD$' + MONTHLY_INCOME.toLocaleString(); }
  get totalActualFormatted(): string { return 'RD$' + this.totalActual.toLocaleString(); }
  get netSavingsFormatted():  string {
    const abs = Math.abs(this.netSavings).toLocaleString();
    return (this.netSavings < 0 ? '-' : '') + 'RD$' + abs;
  }

  isOverAlert(row: ReportRow): boolean {
    if (!row.showInAlerts) return false;
    const threshold = row.income * (row.threshold / 100);
    return row.actual > threshold;
  }

  groupBudget(group: ReportGroup): number {
    return group.rows.reduce((s, r) => s + r.budgeted, 0);
  }

  groupActual(group: ReportGroup): number {
    return group.rows.reduce((s, r) => s + r.actual, 0);
  }

  formatRD(v: number): string { return 'RD$' + v.toLocaleString(); }

  print(): void {
    window.print();
  }

  exportPdf(): void {
    this.pdfExported = true;
    setTimeout(() => { this.pdfExported = false; }, 3500);
  }
}
