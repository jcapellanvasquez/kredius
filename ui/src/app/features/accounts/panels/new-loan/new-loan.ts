import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

interface PreviewRow {
  num:    number;
  date:   string;
  amount: number;
}

@Component({
  selector: 'app-new-loan',
  imports: [FormsModule, RouterLink],
  host: { class: 'block' },
  template: `
    @if (created) {

      <div class="flex flex-col items-center justify-center gap-3 py-16 text-center">
        <svg class="w-10 h-10 text-income" viewBox="0 0 24 24" fill="currentColor">
          <path stroke="none" d="M0 0h24v24H0z" fill="none"/>
          <path d="M17 3.34a10 10 0 1 1 -14.995 8.984l-.005 -.324l.005 -.324a10 10 0 0 1 14.995 -8.336zm-1.293 5.953a1 1 0 0 0 -1.32 -.083l-.094 .083l-3.293 3.292l-1.293 -1.292l-.094 -.083a1 1 0 0 0 -1.403 1.403l.083 .094l2 2l.094 .083a1 1 0 0 0 1.226 0l.094 -.083l4 -4l.083 -.094a1 1 0 0 0 -.083 -1.32z" fill="currentColor"/>
        </svg>
        <p class="text-base font-semibold text-gray-900">Préstamo creado</p>
        <p class="text-sm text-gray-400">{{ borrower }} · {{ formatRD(total) }} en {{ numInstallments }} cuotas</p>
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
            <path d="M5 12l14 0" />
            <path d="M5 12l6 6" />
            <path d="M5 12l6 -6" />
          </svg>
        </button>
        <h1 class="text-base font-semibold text-gray-900">Nuevo préstamo dado</h1>
      </div>

      <div class="flex flex-col gap-5">

        <!-- Form card -->
        <div class="rounded-xl border border-gray-200 bg-white p-5 flex flex-col gap-4">

          <!-- Borrower name -->
          <div class="flex flex-col gap-1.5">
            <label class="text-xs font-medium text-gray-500">Nombre del prestatario</label>
            <input type="text" [(ngModel)]="borrower" placeholder="Ej. Ana Pérez"
              class="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-200 focus:border-brand-400 transition-colors" />
          </div>

          <!-- Capital + Rate -->
          <div class="grid grid-cols-2 gap-3">
            <div class="flex flex-col gap-1.5">
              <label class="text-xs font-medium text-gray-500">Capital prestado</label>
              <div class="relative">
                <span class="absolute inset-y-0 left-3 flex items-center text-xs text-gray-400 pointer-events-none">RD$</span>
                <input type="number" [(ngModel)]="capital" min="1"
                  class="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-200 focus:border-brand-400 transition-colors" />
              </div>
            </div>
            <div class="flex flex-col gap-1.5">
              <label class="text-xs font-medium text-gray-500">Tasa total (%)</label>
              <div class="relative">
                <input type="number" [(ngModel)]="rate" min="0"
                  class="w-full pl-3 pr-7 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-200 focus:border-brand-400 transition-colors" />
                <span class="absolute inset-y-0 right-3 flex items-center text-xs text-gray-400 pointer-events-none">%</span>
              </div>
            </div>
          </div>

          <!-- Installment + Start date -->
          <div class="grid grid-cols-2 gap-3">
            <div class="flex flex-col gap-1.5">
              <label class="text-xs font-medium text-gray-500">Cuota semanal deseada</label>
              <div class="relative">
                <span class="absolute inset-y-0 left-3 flex items-center text-xs text-gray-400 pointer-events-none">RD$</span>
                <input type="number" [(ngModel)]="installment" min="1"
                  class="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-200 focus:border-brand-400 transition-colors" />
              </div>
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
            <span class="text-brand-800">Total a cobrar</span>
            <span class="font-semibold text-brand-800">{{ formatRD(total) }}</span>
          </div>
          <div class="flex justify-between text-sm">
            <span class="text-brand-800">Cronograma</span>
            <span class="font-semibold text-brand-800">{{ numInstallments }} semana{{ numInstallments !== 1 ? 's' : '' }}</span>
          </div>
        </div>

        <!-- Schedule preview -->
        <div class="flex flex-col gap-2">
          <p class="text-sm font-medium text-gray-700">Vista previa del cronograma</p>
          <div class="rounded-xl border border-gray-200 bg-white overflow-hidden divide-y divide-gray-100">

            @for (row of previewRows; track row.num) {
              <div class="flex justify-between items-center px-3 py-2.5 text-xs">
                <span class="text-gray-400">{{ row.num }} · {{ row.date }}</span>
                <span class="text-gray-900 font-medium">{{ formatRD(row.amount) }}</span>
              </div>
            }

            @if (hiddenCount > 0) {
              <div class="flex justify-between items-center px-3 py-2.5 text-xs text-gray-400">
                <span>+ {{ hiddenCount }} semana{{ hiddenCount !== 1 ? 's' : '' }} más…</span>
                <span>última: {{ formatRD(lastAmount) }}</span>
              </div>
            }

          </div>
        </div>

        <!-- Create button -->
        <button type="button" (click)="create()"
          [disabled]="!isValid"
          class="w-full py-2.5 text-sm font-medium text-white bg-brand-600 rounded-xl hover:bg-brand-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
          Crear préstamo
        </button>

      </div>

    }
  `,
})
export class NewLoanComponent {
  borrower    = '';
  capital     = 10_000;
  rate        = 15;
  installment = 2_000;
  startDate   = new Date().toISOString().substring(0, 10);
  created     = false;

  get total(): number {
    return Math.round(this.capital * (1 + this.rate / 100));
  }

  get remainder(): number {
    if (this.installment <= 0) return 0;
    return this.total % this.installment;
  }

  get numInstallments(): number {
    if (this.installment <= 0) return 0;
    return Math.ceil(this.total / this.installment);
  }

  get lastAmount(): number {
    return this.remainder > 0 ? this.remainder : this.installment;
  }

  get previewRows(): PreviewRow[] {
    if (this.installment <= 0 || this.numInstallments === 0) return [];
    const start = this.parseDate(this.startDate);
    const show  = Math.min(3, this.numInstallments);
    const rows: PreviewRow[] = [];
    for (let i = 1; i <= show; i++) {
      const d = new Date(start);
      d.setDate(d.getDate() + (i - 1) * 7);
      const isLast = i === this.numInstallments;
      rows.push({ num: i, date: this.formatDate(d), amount: isLast && this.remainder > 0 ? this.remainder : this.installment });
    }
    return rows;
  }

  get hiddenCount(): number {
    return Math.max(0, this.numInstallments - 3);
  }

  get isValid(): boolean {
    return this.borrower.trim().length > 0 && this.capital > 0 && this.rate > 0 && this.installment > 0;
  }

  formatRD(n: number): string {
    return 'RD$' + n.toLocaleString();
  }

  formatDate(d: Date): string {
    const days   = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
    const months = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
    return `${days[d.getDay()]} ${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
  }

  private parseDate(s: string): Date {
    const [y, m, d] = s.split('-').map(Number);
    return new Date(y, m - 1, d);
  }

  create(): void {
    if (!this.isValid) return;
    this.created = true;
  }

  reset(): void {
    this.borrower    = '';
    this.capital     = 10_000;
    this.rate        = 15;
    this.installment = 2_000;
    this.startDate   = new Date().toISOString().substring(0, 10);
    this.created     = false;
  }
}
