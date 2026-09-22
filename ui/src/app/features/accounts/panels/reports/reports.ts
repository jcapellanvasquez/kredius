import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';

interface ReportRow {
  id:           string;
  name:         string;
  budgeted:     number | null;
  actual:       number;
  showInAlerts: boolean;
  thresholdPct: number;
}

interface ReportGroup {
  label: string;
  rows:  ReportRow[];
}

const LAST_SALARY      = 197_890;
const LAST_SALARY_DATE = '03 sep';
const PERIOD_INCOME    = 207_972;

const GROUPS: ReportGroup[] = [
  {
    label: 'HOGAR',
    rows: [
      { id: 'alquiler',     name: 'Alquiler',      budgeted: 30_000, actual: 30_000, showInAlerts: false, thresholdPct: 20 },
      { id: 'electricidad', name: 'Electricidad',  budgeted:  4_000, actual:  3_486, showInAlerts: false, thresholdPct:  5 },
      { id: 'mascota',      name: 'Mascota',       budgeted:   null, actual:      0, showInAlerts: false, thresholdPct:  2 },
    ],
  },
  {
    label: 'PASIVOS',
    rows: [
      { id: 'tarjeta', name: 'Tarjeta de crédito', budgeted: 70_000, actual: 88_927, showInAlerts: true, thresholdPct: 30 },
    ],
  },
];

@Component({
  selector: 'app-reports',
  imports: [FormsModule],
  host: { class: 'block' },
  template: `
    <div class="flex flex-col gap-4">

      <!-- Title row -->
      <div class="flex items-center justify-between">
        <span class="text-base font-semibold text-gray-900">Reportes</span>
        @if (!isEditMode) {
          <button type="button" (click)="startEdit()"
            class="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
            <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path stroke="none" d="M0 0h24v24H0z" fill="none"/>
              <path d="M7 7h-1a2 2 0 0 0 -2 2v9a2 2 0 0 0 2 2h9a2 2 0 0 0 2 -2v-1" />
              <path d="M20.385 6.585a2.1 2.1 0 0 0 -2.97 -2.97l-8.415 8.385v3h3l8.385 -8.415z" />
              <path d="M16 5l3 3" />
            </svg>
            Editar
          </button>
        }
      </div>

      <!-- Salary caption -->
      <p class="text-xs text-gray-400 text-center -mt-2">
        % calculado sobre el último sueldo registrado: {{ lastSalaryFormatted }} ({{ lastSalaryDate }})
      </p>

      <!-- Report card -->
      <div class="rounded-xl border border-gray-200 bg-white overflow-hidden">

        <!-- Violet header -->
        <div class="bg-brand-500 px-4 py-4">
          <p class="text-[11px] font-semibold text-brand-200 uppercase tracking-wider mb-0.5">Presupuesto mensual</p>
          <p class="text-lg font-bold text-white">Octubre 2026</p>
        </div>

        <!-- Summary cells -->
        <div class="grid grid-cols-3 divide-x divide-gray-100 border-b border-gray-100 text-center">
          <div class="px-3 py-2.5">
            <p class="text-[10px] text-gray-400 mb-0.5">Ingresos</p>
            <p class="text-[13px] font-semibold text-gray-900">{{ periodIncomeFormatted }}</p>
          </div>
          <div class="px-3 py-2.5">
            <p class="text-[10px] text-gray-400 mb-0.5">Gastos</p>
            <p class="text-[13px] font-semibold text-gray-900">{{ totalActualFormatted }}</p>
          </div>
          <div class="px-3 py-2.5">
            <p class="text-[10px] text-gray-400 mb-0.5">Utilidad neta</p>
            <p class="text-[13px] font-semibold"
              [class.text-income]="netSavings >= 0"
              [class.text-expense]="netSavings < 0">
              {{ netSavingsFormatted }}
            </p>
          </div>
        </div>

        <!-- Groups -->
        @for (group of groups; track group.label) {

          <!-- Group label -->
          <div class="px-4 pt-3 pb-1.5">
            <p class="text-[11px] font-semibold text-brand-800 uppercase tracking-wide">{{ group.label }}</p>
          </div>

          <!-- Column headers -->
          <div class="grid grid-cols-3 px-4 py-1.5 bg-gray-50">
            <span class="text-[11px] font-medium text-gray-500">Cuenta</span>
            <span class="text-[11px] font-medium text-gray-500 text-right pr-3">Presup.</span>
            <span class="text-[11px] font-medium text-gray-500 text-right">Real</span>
          </div>

          <!-- Rows -->
          @for (row of group.rows; track row.id) {
            <div class="grid grid-cols-3 px-4 py-2 border-b border-gray-50 last:border-b-0"
              [class.bg-red-50]="isOverAlert(row)">

              <!-- Name -->
              <div class="flex items-start gap-1 min-w-0 pr-1">
                @if (isOverAlert(row)) {
                  <span class="text-expense font-bold text-sm leading-none mt-0.5 shrink-0">⚠</span>
                }
                <span class="text-xs text-gray-900 leading-snug">
                  {{ row.name }}
                  @if (row.budgeted === null) {
                    <span class="text-[10px] text-gray-400"> (sin datos)</span>
                  }
                </span>
              </div>

              <!-- Budgeted -->
              <div class="text-right pr-3">
                @if (isEditMode) {
                  <input type="number"
                    [ngModel]="budgetDrafts[row.id] ?? 0"
                    (ngModelChange)="budgetDrafts[row.id] = $event"
                    class="w-20 text-right text-xs text-gray-900 border border-brand-400 rounded px-1.5 py-0.5 focus:outline-none focus:ring-1 focus:ring-brand-300"
                    placeholder="0" />
                  <div class="text-[10px] text-gray-400 mt-0.5">{{ draftPct(row.id) }}%</div>
                } @else {
                  @if (row.budgeted !== null) {
                    <span class="text-xs text-gray-900">{{ fmtNum(row.budgeted) }}</span>
                    <div class="text-[10px] text-gray-400 mt-0.5">{{ pct(row.budgeted) }}%</div>
                  } @else {
                    <span class="text-xs text-gray-400">—</span>
                  }
                }
              </div>

              <!-- Actual -->
              <div class="text-right">
                <span class="text-xs"
                  [class.text-expense]="isOverAlert(row)"
                  [class.font-semibold]="isOverAlert(row)"
                  [class.text-gray-900]="!isOverAlert(row)">
                  {{ fmtNum(row.actual) }}
                </span>
                @if (row.actual > 0) {
                  <div class="text-[10px] mt-0.5"
                    [class.text-expense]="isOverAlert(row)"
                    [class.font-medium]="isOverAlert(row)"
                    [class.text-gray-400]="!isOverAlert(row)">
                    {{ pct(row.actual) }}%
                  </div>
                }
              </div>

            </div>
          }

        }

        <!-- Legend -->
        <div class="flex items-center gap-2 px-4 py-3 bg-gray-50 border-t border-gray-100 mt-1.5">
          <span class="text-expense font-bold text-sm shrink-0">⚠</span>
          <p class="text-[11px] text-gray-400">cuenta activa que superó su umbral configurado</p>
        </div>

        <!-- Auto-generated -->
        <div class="py-3 text-center border-t border-gray-50">
          <p class="text-[10px] text-gray-400">Generado automáticamente</p>
        </div>

      </div>

      <!-- Actions -->
      @if (!isEditMode) {
        <div class="flex justify-center gap-2">
          <button type="button" (click)="print()"
            class="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-brand-500 rounded-lg hover:bg-brand-600 transition-colors">
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path stroke="none" d="M0 0h24v24H0z" fill="none"/>
              <path d="M17 17h2a2 2 0 0 0 2 -2v-4a2 2 0 0 0 -2 -2h-14a2 2 0 0 0 -2 2v4a2 2 0 0 0 2 2h2" />
              <path d="M17 9v-4a1 1 0 0 0 -1 -1h-8a1 1 0 0 0 -1 1v4" />
              <path d="M7 13m0 2a2 2 0 0 1 2 -2h6a2 2 0 0 1 2 2v4a2 2 0 0 1 -2 2h-6a2 2 0 0 1 -2 -2z" />
            </svg>
            Imprimir
          </button>
          <button type="button" (click)="exportPdf()"
            class="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-brand-800 bg-brand-50 rounded-lg hover:bg-brand-100 transition-colors">
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
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

        @if (pdfExported) {
          <div class="flex items-center gap-3 rounded-xl border border-brand-200 bg-brand-50 px-4 py-3">
            <svg class="w-5 h-5 text-brand-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"/>
            </svg>
            <p class="text-sm text-brand-800">PDF generado — revisa tu carpeta de descargas.</p>
          </div>
        }
      } @else {
        <div class="flex justify-center gap-2">
          <button type="button" (click)="saveEdit()"
            class="px-4 py-2 text-sm font-medium text-white bg-brand-500 rounded-lg hover:bg-brand-600 transition-colors">
            Guardar cambios
          </button>
          <button type="button" (click)="cancelEdit()"
            class="px-4 py-2 text-sm font-medium text-brand-800 bg-brand-50 rounded-lg hover:bg-brand-100 transition-colors">
            Cancelar
          </button>
        </div>
      }

    </div>
  `,
})
export class ReportsComponent {
  readonly lastSalary     = LAST_SALARY;
  readonly lastSalaryDate = LAST_SALARY_DATE;
  readonly periodIncome   = PERIOD_INCOME;

  isEditMode  = false;
  pdfExported = false;
  budgetDrafts: Record<string, number> = {};

  readonly groups = GROUPS;

  get totalActual(): number {
    return this.groups.flatMap(g => g.rows).reduce((s, r) => s + r.actual, 0);
  }

  get netSavings(): number {
    return this.periodIncome - this.totalActual;
  }

  get lastSalaryFormatted():  string { return 'RD$' + this.fmtNum(this.lastSalary); }
  get periodIncomeFormatted(): string { return 'RD$' + this.fmtNum(this.periodIncome); }
  get totalActualFormatted():  string { return 'RD$' + this.fmtNum(this.totalActual); }
  get netSavingsFormatted():   string { return 'RD$' + this.fmtNum(Math.abs(this.netSavings)); }

  pct(amount: number): number {
    return Math.round(amount / this.lastSalary * 100);
  }

  draftPct(id: string): number {
    return Math.round((this.budgetDrafts[id] ?? 0) / this.lastSalary * 100);
  }

  isOverAlert(row: ReportRow): boolean {
    if (!row.showInAlerts) return false;
    return row.actual > this.lastSalary * (row.thresholdPct / 100);
  }

  startEdit(): void {
    this.budgetDrafts = {};
    for (const g of this.groups) {
      for (const r of g.rows) {
        this.budgetDrafts[r.id] = r.budgeted ?? 0;
      }
    }
    this.isEditMode = true;
  }

  saveEdit(): void {
    for (const g of this.groups) {
      for (const r of g.rows) {
        const v = this.budgetDrafts[r.id];
        r.budgeted = v > 0 ? v : null;
      }
    }
    this.budgetDrafts = {};
    this.isEditMode   = false;
  }

  cancelEdit(): void {
    this.budgetDrafts = {};
    this.isEditMode   = false;
  }

  fmtNum(v: number): string {
    return Math.round(v).toLocaleString('en-US');
  }

  print(): void { window.print(); }

  exportPdf(): void {
    this.pdfExported = true;
    setTimeout(() => { this.pdfExported = false; }, 3_500);
  }
}
