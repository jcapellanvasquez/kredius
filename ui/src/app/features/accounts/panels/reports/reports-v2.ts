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
  selector: 'app-reports-v2',
  imports: [FormsModule],
  host: { class: 'block' },
  template: `
    <div class="flex flex-col gap-4">

      <!-- ── STEP 1: Configuration ──────────────────────────────────── -->
      @if (step() === 1) {

        <!-- Header -->
        <div class="flex items-center justify-between">
          <span class="text-base font-semibold text-gray-900">Configurar presupuesto</span>
          <button type="button" (click)="goToReport()"
            [disabled]="loading() || saving()"
            class="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-brand-500 rounded-lg hover:bg-brand-600 disabled:opacity-50 transition-colors">
            Ver reporte
            <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path stroke="none" d="M0 0h24v24H0z" fill="none"/>
              <path d="M9 6l6 6l-6 6" />
            </svg>
          </button>
        </div>

        <!-- Period picker -->
        <div class="flex items-center gap-2">
          <button type="button" (click)="shiftPeriod(-1)" [disabled]="loading()"
            class="p-1 text-gray-400 hover:text-gray-700 disabled:opacity-40 transition-colors rounded">
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path stroke="none" d="M0 0h24v24H0z" fill="none"/>
              <path d="M15 6l-6 6l6 6" />
            </svg>
          </button>
          <span class="text-sm font-medium text-gray-800">{{ periodLabel }}</span>
          <button type="button" (click)="shiftPeriod(1)" [disabled]="loading()"
            class="p-1 text-gray-400 hover:text-gray-700 disabled:opacity-40 transition-colors rounded">
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path stroke="none" d="M0 0h24v24H0z" fill="none"/>
              <path d="M9 6l6 6l-6 6" />
            </svg>
          </button>
        </div>

        <!-- Salary reference -->
        @if (lastSalaryFormatted) {
          <p class="text-xs text-gray-400 -mt-2">
            % de sueldo · último registrado: <span class="font-medium text-gray-600">{{ lastSalaryFormatted }}</span>
            ({{ lastPayrollDateFormatted }})
          </p>
        }

        <!-- Loading -->
        @if (loading()) {
          <div class="flex items-center justify-center py-12 gap-2">
            <div class="w-5 h-5 border-2 border-brand-200 border-t-brand-500 rounded-full animate-spin"></div>
            <p class="text-sm text-gray-400">Cargando...</p>
          </div>
        }

        <!-- Error -->
        @if (error() && !loading()) {
          <div class="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">
            {{ error() }}
          </div>
        }

        <!-- Budget table -->
        @if (report() && !loading()) {
          <div class="rounded-xl border border-gray-200 bg-white overflow-hidden">

            <!-- Column headers -->
            <div class="grid grid-cols-[1fr_auto_auto] px-4 py-2 bg-gray-50 border-b border-gray-100">
              <span class="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Cuenta</span>
              <span class="text-[11px] font-semibold text-gray-500 uppercase tracking-wide text-right pr-4 w-36">Presupuesto</span>
              <span class="text-[11px] font-semibold text-gray-500 uppercase tracking-wide text-right w-24">Real</span>
            </div>

            @for (row of report()!.accounts ?? []; track row.accountId) {
              <div class="grid grid-cols-[1fr_auto_auto] items-center px-4 py-2.5 border-b border-gray-50 last:border-b-0"
                [class.bg-red-50]="row.isOverThreshold">
                <!-- Name + alert -->
                <div class="flex items-center gap-1.5 min-w-0 pr-2">
                  @if (row.isOverThreshold) {
                    <span class="text-expense font-bold text-sm shrink-0">⚠</span>
                  }
                  <div class="min-w-0">
                    <p class="text-xs text-gray-900 truncate">{{ row.name }}</p>
                    @if (budgetDrafts[row.accountId ?? 0] != null) {
                      <p class="text-[10px] text-gray-400">{{ draftPct(row.accountId ?? 0) }}% del sueldo</p>
                    }
                  </div>
                </div>
                <!-- Budget input -->
                <div class="w-36 text-right pr-4">
                  <input type="number"
                    [ngModel]="budgetDrafts[row.accountId ?? 0] ?? 0"
                    (ngModelChange)="onDraftChange(row.accountId ?? 0, $event)"
                    class="w-full text-right text-xs text-gray-900 bg-gray-50 border border-gray-200 rounded-md px-2 py-1 focus:outline-none focus:ring-2 focus:ring-brand-300 focus:border-brand-400 focus:bg-white transition-colors"
                    placeholder="0" min="0" />
                </div>
                <!-- Actual -->
                <div class="w-24 text-right">
                  <span class="text-xs"
                    [class.text-expense]="row.isOverThreshold"
                    [class.font-semibold]="row.isOverThreshold"
                    [class.text-gray-700]="!row.isOverThreshold">
                    {{ fmtNum(row.actualAmount ?? 0) }}
                  </span>
                  @if ((row.actualAmount ?? 0) > 0 && row.actualPct !== null && row.actualPct !== undefined) {
                    <p class="text-[10px] text-gray-400">{{ row.actualPct }}%</p>
                  }
                </div>
              </div>
            }

          </div>

          <!-- Save actions -->
          <div class="flex justify-between items-center">
            <p class="text-[11px] text-gray-400">
              @if (hasPendingChanges()) {
                <span class="text-brand-600 font-medium">Cambios sin guardar</span>
              } @else {
                Presupuesto guardado
              }
            </p>
            <div class="flex gap-2">
              @if (hasPendingChanges()) {
                <button type="button" (click)="discardChanges()"
                  class="px-3 py-1.5 text-xs text-gray-500 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                  Descartar
                </button>
              }
              <button type="button" (click)="saveEdit()" [disabled]="saving() || !hasPendingChanges()"
                class="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-brand-500 rounded-lg hover:bg-brand-600 disabled:opacity-40 transition-colors">
                @if (saving()) {
                  <div class="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin"></div>
                }
                Guardar
              </button>
            </div>
          </div>
        }
      }

      <!-- ── STEP 2: Report ──────────────────────────────────────────── -->
      @if (step() === 2) {

        <!-- Nav row -->
        <div class="flex items-center justify-between">
          <button type="button" (click)="step.set(1)"
            class="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors">
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path stroke="none" d="M0 0h24v24H0z" fill="none"/>
              <path d="M15 6l-6 6l6 6" />
            </svg>
            Editar presupuesto
          </button>
          <div class="flex gap-2">
            <button type="button" (click)="print()"
              class="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-brand-500 rounded-lg hover:bg-brand-600 transition-colors">
              <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path stroke="none" d="M0 0h24v24H0z" fill="none"/>
                <path d="M17 17h2a2 2 0 0 0 2 -2v-4a2 2 0 0 0 -2 -2h-14a2 2 0 0 0 -2 2v4a2 2 0 0 0 2 2h2" />
                <path d="M17 9v-4a1 1 0 0 0 -1 -1h-8a1 1 0 0 0 -1 1v4" />
                <path d="M7 13m0 2a2 2 0 0 1 2 -2h6a2 2 0 0 1 2 2v4a2 2 0 0 1 -2 2h-6a2 2 0 0 1 -2 -2z" />
              </svg>
              Imprimir
            </button>
          </div>
        </div>

        <!-- Report card -->
        @if (report()) {
          <div id="report-card" class="rounded-xl border border-gray-200 bg-white overflow-hidden">

            <!-- Report header -->
            <div class="px-6 pt-6 pb-4 border-b border-gray-100">
              <p class="text-[11px] font-semibold text-brand-500 uppercase tracking-widest mb-1">Reporte de presupuesto</p>
              <h2 class="text-xl font-bold text-gray-900">{{ periodLabel }}</h2>
              @if (lastSalaryFormatted) {
                <p class="text-xs text-gray-400 mt-1">
                  Referencia salarial: {{ lastSalaryFormatted }} · {{ lastPayrollDateFormatted }}
                </p>
              }
            </div>

            <!-- Summary -->
            <div class="grid grid-cols-3 divide-x divide-gray-100 border-b border-gray-100">
              <div class="px-6 py-4">
                <p class="text-[11px] text-gray-400 uppercase tracking-wide mb-1">Ingresos</p>
                <p class="text-lg font-bold text-gray-900">{{ fmtRD(report()!.income ?? 0) }}</p>
              </div>
              <div class="px-6 py-4">
                <p class="text-[11px] text-gray-400 uppercase tracking-wide mb-1">Gastos</p>
                <p class="text-lg font-bold text-gray-900">{{ fmtRD(report()!.expenses ?? 0) }}</p>
              </div>
              <div class="px-6 py-4">
                <p class="text-[11px] text-gray-400 uppercase tracking-wide mb-1">Utilidad neta</p>
                <p class="text-lg font-bold"
                  [class.text-income]="(report()!.netProfit ?? 0) >= 0"
                  [class.text-expense]="(report()!.netProfit ?? 0) < 0">
                  {{ fmtRD(report()!.netProfit ?? 0) }}
                </p>
              </div>
            </div>

            <!-- Expense table -->
            @if ((report()!.accounts ?? []).length > 0) {
              <div class="px-6 pt-4 pb-1">
                <p class="text-[11px] font-semibold text-brand-800 uppercase tracking-widest mb-3">Desglose de gastos</p>
              </div>

              <!-- Table header -->
              <div class="grid grid-cols-[1fr_auto_auto_auto] px-6 py-2 bg-gray-50 border-y border-gray-100 text-[11px] font-semibold text-gray-500 uppercase tracking-wide">
                <span>Cuenta</span>
                <span class="w-24 text-right pr-4">Presupuesto</span>
                <span class="w-24 text-right pr-4">Real</span>
                <span class="w-16 text-right">% real</span>
              </div>

              @for (row of report()!.accounts ?? []; track row.accountId) {
                <div class="grid grid-cols-[1fr_auto_auto_auto] px-6 py-2.5 border-b border-gray-50 last:border-b-0 items-center"
                  [class.bg-red-50]="row.isOverThreshold">
                  <!-- Name -->
                  <div class="flex items-center gap-1.5">
                    @if (row.isOverThreshold) {
                      <span class="text-expense text-sm font-bold shrink-0">⚠</span>
                    }
                    <span class="text-sm text-gray-900">{{ row.name }}</span>
                  </div>
                  <!-- Budgeted -->
                  <div class="w-24 text-right pr-4">
                    @if (row.budgetedAmount !== null && row.budgetedAmount !== undefined) {
                      <span class="text-sm text-gray-700">{{ fmtNum(row.budgetedAmount) }}</span>
                      @if (row.budgetedPct !== null && row.budgetedPct !== undefined) {
                        <p class="text-[10px] text-gray-400">{{ row.budgetedPct }}%</p>
                      }
                    } @else {
                      <span class="text-sm text-gray-300">—</span>
                    }
                  </div>
                  <!-- Actual -->
                  <div class="w-24 text-right pr-4">
                    <span class="text-sm"
                      [class.text-expense]="row.isOverThreshold"
                      [class.font-semibold]="row.isOverThreshold"
                      [class.text-gray-900]="!row.isOverThreshold">
                      {{ fmtNum(row.actualAmount ?? 0) }}
                    </span>
                  </div>
                  <!-- % actual -->
                  <div class="w-16 text-right">
                    @if ((row.actualAmount ?? 0) > 0 && row.actualPct !== null && row.actualPct !== undefined) {
                      <span class="text-sm"
                        [class.text-expense]="row.isOverThreshold"
                        [class.font-semibold]="row.isOverThreshold"
                        [class.text-gray-500]="!row.isOverThreshold">
                        {{ row.actualPct }}%
                      </span>
                    } @else {
                      <span class="text-sm text-gray-300">—</span>
                    }
                  </div>
                </div>
              }
            }

            <!-- Footer -->
            <div class="px-6 py-3 border-t border-gray-100 bg-gray-50 flex items-center justify-between">
              <div class="flex items-center gap-1.5 text-[11px] text-gray-400">
                <span class="text-expense font-bold text-sm">⚠</span>
                superó umbral configurado
              </div>
              <p class="text-[10px] text-gray-400">Generado automáticamente · Kredius</p>
            </div>

          </div>
        }
      }

    </div>
  `,
})
export class ReportsV2Component implements OnInit {
  private readonly http    = inject(HttpClient);
  private readonly rootUrl = inject(ApiConfiguration).rootUrl;

  readonly step    = signal<1 | 2>(1);
  readonly period  = signal<string>(firstDayOfMonth());
  readonly report  = signal<BudgetReportResponse | null>(null);
  readonly loading = signal(false);
  readonly saving  = signal(false);
  readonly error   = signal<string | null>(null);

  budgetDrafts:   Partial<Record<number, number>> = {};
  originalValues: Partial<Record<number, number>> = {};

  ngOnInit(): void {
    this.loadReport();
  }

  private loadReport(): void {
    this.loading.set(true);
    this.error.set(null);
    getBudgetReport(this.http, this.rootUrl, { period: this.period() }).pipe(
      map(r => r.body!),
    ).subscribe({
      next: r => {
        this.report.set(r);
        this.syncDrafts(r);
        this.loading.set(false);
      },
      error: () => { this.error.set('Error al cargar el reporte.'); this.loading.set(false); },
    });
  }

  private syncDrafts(r: BudgetReportResponse): void {
    this.budgetDrafts   = {};
    this.originalValues = {};
    for (const row of r.accounts ?? []) {
      const id  = row.accountId ?? 0;
      const val = row.budgetedAmount ?? 0;
      this.originalValues[id] = val;
      this.budgetDrafts[id]   = val;
    }
  }

  shiftPeriod(delta: number): void {
    const d = new Date(this.period() + 'T00:00:00');
    d.setMonth(d.getMonth() + delta);
    this.period.set(d.toISOString().slice(0, 7) + '-01');
    this.loadReport();
  }

  onDraftChange(id: number, value: number): void {
    this.budgetDrafts[id] = value;
  }

  hasPendingChanges(): boolean {
    return Object.keys(this.budgetDrafts).some(
      id => this.budgetDrafts[+id] !== this.originalValues[+id],
    );
  }

  discardChanges(): void {
    this.budgetDrafts = { ...this.originalValues };
  }

  saveEdit(): void {
    const updates = (this.report()?.accounts ?? [])
      .filter(r => {
        const id = r.accountId ?? 0;
        return this.budgetDrafts[id] !== this.originalValues[id];
      })
      .map(r => ({ accountId: r.accountId!, amount: this.budgetDrafts[r.accountId ?? 0] ?? 0 }));

    if (updates.length === 0) return;

    this.saving.set(true);
    combineLatest([
      batchUpdateBudgets(this.http, this.rootUrl, { body: { period: this.period(), updates } }).pipe(map(r => r.body!)),
      timer(MIN_SPINNER_MS),
    ]).subscribe({
      next: ([r]) => {
        this.report.set(r);
        this.syncDrafts(r);
        this.saving.set(false);
      },
      error: () => { this.saving.set(false); },
    });
  }

  goToReport(): void {
    if (this.hasPendingChanges()) {
      this.saveEdit();
    }
    this.step.set(2);
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

  draftPct(id: number): number {
    const salary = this.report()?.lastPayrollAmount ?? 0;
    if (!salary) return 0;
    return Math.round(((this.budgetDrafts[id] ?? 0) / salary) * 100);
  }

  fmtRD(v: number): string { return 'RD$' + this.fmtNum(v); }
  fmtNum(v: number): string { return Math.round(v).toLocaleString('en-US'); }

  print(): void { window.print(); }
}
