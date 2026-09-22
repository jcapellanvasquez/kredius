import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { combineLatest, map, timer } from 'rxjs';
import { ApiConfiguration } from '../../../../api/api-configuration';
import { createReceivedLoan } from '../../../../api/fn/loans/create-received-loan';
import { AccountApiService } from '../../account-api.service';

const MIN_SPINNER_MS = 700;

interface PreviewRow {
  num:       number;
  date:      string;
  interest:  number;
  principal: number;
  balance:   number;
}

@Component({
  selector: 'app-new-loan-received',
  imports: [FormsModule, RouterLink],
  host: { class: 'block' },
  template: `
    @if (created()) {

      <div class="flex flex-col items-center justify-center gap-3 py-16 text-center">
        <svg class="w-10 h-10 text-income" viewBox="0 0 24 24" fill="currentColor">
          <path stroke="none" d="M0 0h24v24H0z" fill="none"/>
          <path d="M17 3.34a10 10 0 1 1 -14.995 8.984l-.005 -.324l.005 -.324a10 10 0 0 1 14.995 -8.336zm-1.293 5.953a1 1 0 0 0 -1.32 -.083l-.094 .083l-3.293 3.292l-1.293 -1.292l-.094 -.083a1 1 0 0 0 -1.403 1.403l.083 .094l2 2l.094 .083a1 1 0 0 0 1.226 0l.094 -.083l4 -4l.083 -.094a1 1 0 0 0 -.083 -1.32z" fill="currentColor"/>
        </svg>
        <p class="text-base font-semibold text-gray-900">Préstamo registrado</p>
        <p class="text-sm text-gray-400">{{ lender }} · {{ formatRD(principal) }} · {{ n }} cuotas de {{ formatRD(pmt) }}</p>
        <button type="button" (click)="reset()"
          class="mt-2 px-4 py-2 text-sm font-medium text-brand-600 hover:text-brand-700 transition-colors">
          Registrar otro
        </button>
      </div>

    } @else {

      <!-- Header -->
      <div class="flex items-center gap-2 mb-5">
        <button type="button" [routerLink]="['/accounts']"
          class="p-1 rounded-lg hover:bg-gray-100 transition-colors text-gray-700">
          <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75">
            <path stroke="none" d="M0 0h24v24H0z" fill="none"/>
            <path d="M5 12l14 0" /><path d="M5 12l6 6" /><path d="M5 12l6 -6" />
          </svg>
        </button>
        <h1 class="text-base font-semibold text-gray-900">Nuevo préstamo recibido</h1>
      </div>

      <div class="flex flex-col gap-5">

        <!-- Form card -->
        <div class="rounded-xl border border-gray-200 bg-white p-5 flex flex-col gap-4">

          <!-- Lender name -->
          <div class="flex flex-col gap-1.5">
            <label class="text-xs font-medium text-gray-500">Nombre del prestamista</label>
            <input type="text" [(ngModel)]="lender" placeholder="Ej. Banco BHD"
              class="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-200 focus:border-brand-400 transition-colors" />
          </div>

          <!-- Principal + Monthly rate -->
          <div class="grid grid-cols-2 gap-3">
            <div class="flex flex-col gap-1.5">
              <label class="text-xs font-medium text-gray-500">Capital recibido</label>
              <div class="relative">
                <span class="absolute inset-y-0 left-3 flex items-center text-xs text-gray-400 pointer-events-none">RD$</span>
                <input type="number" [(ngModel)]="principal" min="1"
                  class="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-200 focus:border-brand-400 transition-colors" />
              </div>
            </div>
            <div class="flex flex-col gap-1.5">
              <label class="text-xs font-medium text-gray-500">Tasa mensual (%)</label>
              <div class="relative">
                <input type="number" [(ngModel)]="monthlyRate" min="0" step="0.1"
                  class="w-full pl-3 pr-7 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-200 focus:border-brand-400 transition-colors" />
                <span class="absolute inset-y-0 right-3 flex items-center text-xs text-gray-400 pointer-events-none">%</span>
              </div>
            </div>
          </div>

          <!-- Installments + Start date -->
          <div class="grid grid-cols-2 gap-3">
            <div class="flex flex-col gap-1.5">
              <label class="text-xs font-medium text-gray-500">Número de cuotas</label>
              <input type="number" [(ngModel)]="n" min="1"
                class="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-200 focus:border-brand-400 transition-colors" />
            </div>
            <div class="flex flex-col gap-1.5">
              <label class="text-xs font-medium text-gray-500">Fecha de inicio</label>
              <input type="date" [(ngModel)]="startDate"
                class="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-200 focus:border-brand-400 transition-colors" />
            </div>
          </div>

        </div>

        <!-- Summary box -->
        <div class="rounded-xl bg-brand-50 px-4 py-3.5 flex flex-col gap-2">
          <div class="flex justify-between text-sm">
            <span class="text-brand-800">Cuota mensual</span>
            <span class="font-semibold text-brand-800">{{ formatRD(pmt) }}</span>
          </div>
          <div class="flex justify-between text-sm">
            <span class="text-brand-800">Total a pagar</span>
            <span class="font-semibold text-brand-800">{{ formatRD(totalPayable) }}</span>
          </div>
          <div class="flex justify-between text-sm">
            <span class="text-brand-800">Interés total</span>
            <span class="font-semibold text-brand-800">{{ formatRD(totalPayable - principal) }}</span>
          </div>
        </div>

        <!-- Schedule preview -->
        <div class="flex flex-col gap-2">
          <p class="text-sm font-medium text-gray-700">Vista previa del cronograma</p>
          <div class="rounded-xl border border-gray-200 bg-white overflow-hidden divide-y divide-gray-100">

            <!-- Column headers -->
            <div class="grid grid-cols-4 px-3 py-2 text-[11px] font-medium text-gray-400 bg-gray-50">
              <span>#</span>
              <span class="text-right">Interés</span>
              <span class="text-right">Capital</span>
              <span class="text-right">Saldo</span>
            </div>

            @for (row of previewRows; track row.num) {
              <div class="grid grid-cols-4 px-3 py-2.5 text-xs">
                <span class="text-gray-400">{{ row.num }} · {{ row.date }}</span>
                <span class="text-right text-expense">{{ formatRD(row.interest) }}</span>
                <span class="text-right text-income">{{ formatRD(row.principal) }}</span>
                <span class="text-right text-gray-700">{{ formatRD(row.balance) }}</span>
              </div>
            }

            @if (hiddenCount > 0) {
              <div class="flex justify-between items-center px-3 py-2.5 text-xs text-gray-400">
                <span>+ {{ hiddenCount }} cuota{{ hiddenCount !== 1 ? 's' : '' }} más…</span>
                <span>última: {{ formatRD(pmt) }}</span>
              </div>
            }

          </div>
        </div>

        <!-- Create button -->
        <button type="button" (click)="create()"
          [disabled]="!isValid || saving()"
          class="w-full py-2.5 text-sm font-medium text-white bg-brand-600 rounded-xl hover:bg-brand-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
          @if (saving()) {
            <span class="inline-flex items-center gap-2">
              <svg class="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
              </svg>
              Registrando…
            </span>
          } @else {
            Registrar préstamo
          }
        </button>

      </div>

    }
  `,
})
export class NewLoanReceivedComponent {
  private readonly http       = inject(HttpClient);
  private readonly rootUrl    = inject(ApiConfiguration).rootUrl;
  private readonly accountSvc = inject(AccountApiService);

  lender      = '';
  principal   = 0;
  monthlyRate = 0;
  n           = 0;
  startDate   = new Date().toISOString().substring(0, 10);

  readonly saving  = signal(false);
  readonly created = signal(false);

  get r(): number { return this.monthlyRate / 100; }

  get pmt(): number {
    if (this.r === 0) return Math.round(this.principal / this.n);
    const r = this.r;
    return Math.round((this.principal * r * Math.pow(1 + r, this.n)) / (Math.pow(1 + r, this.n) - 1));
  }

  get totalPayable(): number { return this.pmt * this.n; }

  get previewRows(): PreviewRow[] {
    if (this.n <= 0 || this.principal <= 0) return [];
    const start = this.parseDate(this.startDate);
    const show  = Math.min(3, this.n);
    const rows: PreviewRow[] = [];
    let balance = this.principal;
    for (let i = 1; i <= this.n; i++) {
      const interest  = Math.round(balance * this.r);
      const principal = Math.round(this.pmt - interest);
      balance = Math.max(0, Math.round(balance - principal));
      if (i <= show) {
        const d = new Date(start);
        d.setMonth(d.getMonth() + (i - 1));
        rows.push({ num: i, date: this.formatMonth(d), interest, principal, balance });
      }
    }
    return rows;
  }

  get hiddenCount(): number { return Math.max(0, this.n - 3); }

  get isValid(): boolean {
    return this.lender.trim().length > 0 && this.principal > 0 && this.monthlyRate > 0 && this.n > 0;
  }

  formatRD(n: number): string { return 'RD$' + n.toLocaleString(); }

  formatMonth(d: Date): string {
    const months = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
    return `${months[d.getMonth()]} ${d.getFullYear()}`;
  }

  private parseDate(s: string): Date {
    const [y, m, d] = s.split('-').map(Number);
    return new Date(y, m - 1, d);
  }

  create(): void {
    if (!this.isValid || this.saving()) return;
    this.saving.set(true);
    combineLatest([
      createReceivedLoan(this.http, this.rootUrl, {
        body: {
          counterpartyName: this.lender,
          principal:        this.principal,
          monthlyRate:      this.monthlyRate,
          numInstallments:  this.n,
          startDate:        this.startDate,
        },
      }).pipe(map(r => r.body!)),
      timer(MIN_SPINNER_MS),
    ]).subscribe({
      next:  () => { this.saving.set(false); this.created.set(true); this.accountSvc.load().subscribe(); },
      error: () => { this.saving.set(false); },
    });
  }

  reset(): void {
    this.lender      = '';
    this.principal   = 350_000;
    this.monthlyRate = 3;
    this.n           = 24;
    this.startDate   = new Date().toISOString().substring(0, 10);
    this.saving.set(false);
    this.created.set(false);
  }
}
