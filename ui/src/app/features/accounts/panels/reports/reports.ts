import { Component, OnInit, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { combineLatest, timer } from 'rxjs';
import { map } from 'rxjs/operators';

const MIN_SPINNER_MS = 700;
import { ApiConfiguration } from '../../../../api/api-configuration';
import { getBudgetReport } from '../../../../api/fn/reports/get-budget-report';
import { batchUpdateBudgets } from '../../../../api/fn/reports/batch-update-budgets';
import { BudgetReportResponse } from '../../../../api/models/budget-report-response';

function firstDayOfMonth(offset = 0): string {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() + offset);
  return d.toISOString().slice(0, 7) + '-01';
}

@Component({
  selector: 'app-reports',
  imports: [FormsModule],
  host: { class: 'block' },
  template: `
    <div class="flex flex-col gap-4">

      <!-- Title row -->
      <div class="flex items-center justify-between">
        <span class="text-base font-semibold text-gray-900">Reportes</span>
        @if (!isEditMode && report()) {
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
      @if (lastSalaryFormatted) {
        <p class="text-xs text-gray-400 text-center -mt-2">
          % calculado sobre el último sueldo registrado: {{ lastSalaryFormatted }} ({{ lastPayrollDateFormatted }})
        </p>
      }

      <!-- Loading -->
      @if (loading()) {
        <div class="flex items-center justify-center py-16 gap-2">
          <div class="w-5 h-5 border-2 border-brand-200 border-t-brand-500 rounded-full animate-spin"></div>
          <p class="text-sm text-gray-400">Cargando reporte...</p>
        </div>
      }

      <!-- Error -->
      @if (error() && !loading()) {
        <div class="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">
          {{ error() }}
        </div>
      }

      <!-- Report card -->
      @if (report() && !loading()) {
        <div class="rounded-xl border border-gray-200 bg-white overflow-hidden">

          <!-- Violet header with period navigation -->
          <div class="bg-brand-500 px-4 py-4">
            <p class="text-[11px] font-semibold text-brand-200 uppercase tracking-wider mb-0.5">Presupuesto mensual</p>
            <div class="flex items-center gap-2">
              <button type="button" (click)="shiftPeriod(-1)"
                class="text-brand-200 hover:text-white transition-colors p-0.5 rounded">
                <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path stroke="none" d="M0 0h24v24H0z" fill="none"/>
                  <path d="M15 6l-6 6l6 6" />
                </svg>
              </button>
              <p class="text-lg font-bold text-white">{{ periodLabel }}</p>
              <button type="button" (click)="shiftPeriod(1)"
                class="text-brand-200 hover:text-white transition-colors p-0.5 rounded">
                <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path stroke="none" d="M0 0h24v24H0z" fill="none"/>
                  <path d="M9 6l6 6l-6 6" />
                </svg>
              </button>
            </div>
          </div>

          <!-- Summary cells -->
          <div class="grid grid-cols-3 divide-x divide-gray-100 border-b border-gray-100 text-center">
            <div class="px-3 py-2.5">
              <p class="text-[10px] text-gray-400 mb-0.5">Ingresos</p>
              <p class="text-[13px] font-semibold text-gray-900">{{ fmtRD(report()!.income ?? 0) }}</p>
            </div>
            <div class="px-3 py-2.5">
              <p class="text-[10px] text-gray-400 mb-0.5">Gastos</p>
              <p class="text-[13px] font-semibold text-gray-900">{{ fmtRD(report()!.expenses ?? 0) }}</p>
            </div>
            <div class="px-3 py-2.5">
              <p class="text-[10px] text-gray-400 mb-0.5">Utilidad neta</p>
              <p class="text-[13px] font-semibold"
                [class.text-income]="(report()!.netProfit ?? 0) >= 0"
                [class.text-expense]="(report()!.netProfit ?? 0) < 0">
                {{ fmtRD(report()!.netProfit ?? 0) }}
              </p>
            </div>
          </div>

          <!-- Expense accounts -->
          @if ((report()!.accounts ?? []).length > 0) {

            <!-- Group label -->
            <div class="px-4 pt-3 pb-1.5">
              <p class="text-[11px] font-semibold text-brand-800 uppercase tracking-wide">Gastos</p>
            </div>

            <!-- Column headers -->
            <div class="grid grid-cols-3 px-4 py-1.5 bg-gray-50">
              <span class="text-[11px] font-medium text-gray-500">Cuenta</span>
              <span class="text-[11px] font-medium text-gray-500 text-right pr-3">Presup.</span>
              <span class="text-[11px] font-medium text-gray-500 text-right">Real</span>
            </div>

            @for (row of report()!.accounts ?? []; track row.accountId) {
              <div class="grid grid-cols-3 px-4 py-2 border-b border-gray-50 last:border-b-0"
                [class.bg-red-50]="row.isOverThreshold">

                <!-- Name -->
                <div class="flex items-start gap-1 min-w-0 pr-1">
                  @if (row.isOverThreshold) {
                    <span class="text-expense font-bold text-sm leading-none mt-0.5 shrink-0">⚠</span>
                  }
                  <span class="text-xs text-gray-900 leading-snug">
                    {{ row.name }}
                    @if (row.budgetedAmount === null && !isEditMode) {
                      <span class="text-[10px] text-gray-400"> (sin datos)</span>
                    }
                  </span>
                </div>

                <!-- Budgeted -->
                <div class="text-right pr-3">
                  @if (isEditMode) {
                    <input type="number"
                      [ngModel]="budgetDrafts[row.accountId ?? 0] ?? 0"
                      (ngModelChange)="budgetDrafts[row.accountId ?? 0] = $event"
                      class="w-20 text-right text-xs text-gray-900 border border-brand-400 rounded px-1.5 py-0.5 focus:outline-none focus:ring-1 focus:ring-brand-300"
                      placeholder="0" min="0" />
                    <div class="text-[10px] text-gray-400 mt-0.5">{{ draftPct(row.accountId ?? 0) }}%</div>
                  } @else {
                    @if (row.budgetedAmount !== null && row.budgetedAmount !== undefined) {
                      <span class="text-xs text-gray-900">{{ fmtNum(row.budgetedAmount) }}</span>
                      @if (row.budgetedPct !== null && row.budgetedPct !== undefined) {
                        <div class="text-[10px] text-gray-400 mt-0.5">{{ row.budgetedPct }}%</div>
                      }
                    } @else {
                      <span class="text-xs text-gray-400">—</span>
                    }
                  }
                </div>

                <!-- Actual -->
                <div class="text-right">
                  <span class="text-xs"
                    [class.text-expense]="row.isOverThreshold"
                    [class.font-semibold]="row.isOverThreshold"
                    [class.text-gray-900]="!row.isOverThreshold">
                    {{ fmtNum(row.actualAmount ?? 0) }}
                  </span>
                  @if ((row.actualAmount ?? 0) > 0 && row.actualPct !== null && row.actualPct !== undefined) {
                    <div class="text-[10px] mt-0.5"
                      [class.text-expense]="row.isOverThreshold"
                      [class.font-medium]="row.isOverThreshold"
                      [class.text-gray-400]="!row.isOverThreshold">
                      {{ row.actualPct }}%
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
            <button type="button" (click)="saveEdit()" [disabled]="saving()"
              class="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-brand-500 rounded-lg hover:bg-brand-600 disabled:opacity-60 transition-colors">
              @if (saving()) {
                <div class="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin"></div>
              }
              Guardar cambios
            </button>
            <button type="button" (click)="cancelEdit()" [disabled]="saving()"
              class="px-4 py-2 text-sm font-medium text-brand-800 bg-brand-50 rounded-lg hover:bg-brand-100 disabled:opacity-60 transition-colors">
              Cancelar
            </button>
          </div>
        }
      }

    </div>
  `,
})
export class ReportsComponent implements OnInit {
  private readonly http    = inject(HttpClient);
  private readonly rootUrl = inject(ApiConfiguration).rootUrl;

  readonly period  = signal<string>(firstDayOfMonth());
  readonly report  = signal<BudgetReportResponse | null>(null);
  readonly loading = signal(false);
  readonly saving  = signal(false);
  readonly error   = signal<string | null>(null);

  isEditMode  = false;
  pdfExported = false;
  budgetDrafts:    Record<number, number> = {};
  originalValues:  Record<number, number> = {};

  ngOnInit(): void {
    this.loadReport();
  }

  private loadReport(): void {
    this.loading.set(true);
    this.error.set(null);
    getBudgetReport(this.http, this.rootUrl, { period: this.period() }).pipe(
      map(r => r.body!),
    ).subscribe({
      next:  r  => { this.report.set(r); this.loading.set(false); },
      error: () => { this.error.set('Error al cargar el reporte.'); this.loading.set(false); },
    });
  }

  shiftPeriod(delta: number): void {
    if (this.isEditMode) return;
    const d = new Date(this.period() + 'T00:00:00');
    d.setMonth(d.getMonth() + delta);
    this.period.set(d.toISOString().slice(0, 7) + '-01');
    this.loadReport();
  }

  get periodLabel(): string {
    const d = new Date(this.period() + 'T00:00:00');
    const label = d.toLocaleDateString('es-DO', { month: 'long', year: 'numeric' });
    return label.charAt(0).toUpperCase() + label.slice(1);
  }

  get lastSalaryFormatted(): string {
    const amt = this.report()?.lastPayrollAmount;
    return amt != null ? 'RD$' + this.fmtNum(amt) : '';
  }

  get lastPayrollDateFormatted(): string {
    const d = this.report()?.lastPayrollDate;
    if (!d) return '';
    const date = new Date(d + 'T00:00:00');
    return date.toLocaleDateString('es-DO', { day: '2-digit', month: 'short' });
  }

  startEdit(): void {
    this.originalValues = {};
    this.budgetDrafts   = {};
    for (const row of this.report()?.accounts ?? []) {
      const id  = row.accountId ?? 0;
      const val = row.budgetedAmount ?? 0;
      this.originalValues[id] = val;
      this.budgetDrafts[id]   = val;
    }
    this.isEditMode = true;
  }

  cancelEdit(): void {
    this.budgetDrafts  = {};
    this.originalValues = {};
    this.isEditMode    = false;
  }

  saveEdit(): void {
    const updates = (this.report()?.accounts ?? [])
      .filter(r => {
        const id = r.accountId ?? 0;
        return this.budgetDrafts[id] !== this.originalValues[id];
      })
      .map(r => ({ accountId: r.accountId!, amount: this.budgetDrafts[r.accountId ?? 0] ?? 0 }));

    if (updates.length === 0) { this.cancelEdit(); return; }

    this.saving.set(true);
    combineLatest([
      batchUpdateBudgets(this.http, this.rootUrl, { body: { period: this.period(), updates } }).pipe(map(r => r.body!)),
      timer(MIN_SPINNER_MS),
    ]).subscribe({
      next: ([r]) => {
        this.report.set(r);
        this.budgetDrafts   = {};
        this.originalValues = {};
        this.isEditMode     = false;
        this.saving.set(false);
      },
      error: () => { this.saving.set(false); },
    });
  }

  draftPct(id: number): number {
    const salary = this.report()?.lastPayrollAmount ?? 0;
    if (!salary) return 0;
    return Math.round(((this.budgetDrafts[id] ?? 0) / salary) * 100);
  }

  fmtRD(v: number): string { return 'RD$' + this.fmtNum(v); }
  fmtNum(v: number): string { return Math.round(v).toLocaleString('en-US'); }

  print(): void { window.print(); }

  exportPdf(): void {
    this.pdfExported = true;
    setTimeout(() => { this.pdfExported = false; }, 3_500);
  }
}
