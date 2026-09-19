import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';

type Currency = 'dop' | 'usd';
type Source   = 'payroll' | 'other';

interface HistoryEntry {
  id:          number;
  date:        string;
  source:      Source;
  currency:    Currency;
  amount:      number;
  rate:        number | null;
  fee:         number;
  net:         number;
  expanded:    boolean;
}

@Component({
  selector: 'app-income',
  imports: [FormsModule],
  host: { class: 'block' },
  template: `
    <div class="flex flex-col gap-5">

      <!-- Header -->
      <div>
        <h1 class="text-2xl font-bold text-gray-900">Registrar ingreso</h1>
        <p class="text-sm text-gray-400 mt-0.5">Registra un deposito o entrada de dinero.</p>
      </div>

      <!-- Form card -->
      <div class="rounded-xl border border-gray-200 bg-white p-5 flex flex-col gap-4">

        <!-- Source -->
        <div class="flex flex-col gap-1.5">
          <label class="text-sm font-medium text-gray-700">Fuente</label>
          <select
            [(ngModel)]="source"
            class="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-brand-300 focus:border-brand-400 transition-colors"
          >
            <option value="payroll">Nomina</option>
            <option value="other">Otro ingreso</option>
          </select>
        </div>

        <!-- Amount + Currency toggle -->
        <div class="flex flex-col gap-1.5">
          <label class="text-sm font-medium text-gray-700">Monto</label>
          <div class="flex gap-2">
            <div class="relative flex-1">
              <span class="absolute inset-y-0 left-3 flex items-center text-sm text-gray-400 pointer-events-none">
                {{ currency === 'usd' ? 'US$' : 'RD$' }}
              </span>
              <input
                type="number"
                [(ngModel)]="amount"
                min="0"
                placeholder="0"
                class="w-full pl-10 pr-3 py-2 text-sm border border-gray-300 rounded-lg placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-300 focus:border-brand-400 transition-colors"
              />
            </div>
            <!-- Currency toggle chips -->
            <div class="flex rounded-lg border border-gray-300 overflow-hidden shrink-0">
              <button
                type="button"
                (click)="setCurrency('dop')"
                class="px-3 py-2 text-sm font-medium transition-colors"
                [class.bg-brand-600]="currency === 'dop'"
                [class.text-white]="currency === 'dop'"
                [class.bg-white]="currency !== 'dop'"
                [class.text-gray-600]="currency !== 'dop'"
              >RD$</button>
              <button
                type="button"
                (click)="setCurrency('usd')"
                class="px-3 py-2 text-sm font-medium border-l border-gray-300 transition-colors"
                [class.bg-brand-600]="currency === 'usd'"
                [class.text-white]="currency === 'usd'"
                [class.bg-white]="currency !== 'usd'"
                [class.text-gray-600]="currency !== 'usd'"
              >US$</button>
            </div>
          </div>
        </div>

        <!-- Date -->
        <div class="flex flex-col gap-1.5">
          <label class="text-sm font-medium text-gray-700">Fecha</label>
          <input
            type="date"
            [(ngModel)]="date"
            class="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-300 focus:border-brand-400 transition-colors"
          />
        </div>

        <!-- USD conversion block -->
        @if (currency === 'usd') {
          <div class="flex flex-col gap-3 pt-3 border-t border-gray-100">
            <p class="text-xs font-semibold text-gray-500 uppercase tracking-wide">Conversion</p>

            <!-- Exchange rate -->
            <div class="flex items-center justify-between gap-3">
              <div class="flex items-center gap-1.5">
                <span class="text-sm text-gray-600">Tasa de cambio</span>
                <span class="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-brand-50 text-brand-600 border border-brand-200">auto</span>
              </div>
              <div class="flex items-center gap-1 shrink-0">
                <span class="text-sm text-gray-400">RD$</span>
                <input
                  type="number"
                  [(ngModel)]="rate"
                  (ngModelChange)="rateIsAuto = false"
                  min="1"
                  step="0.01"
                  class="w-20 rounded-md border border-gray-300 px-2 py-1 text-sm text-right text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-300"
                />
              </div>
            </div>

            <!-- RD$ equivalent -->
            <div class="flex items-center justify-between text-sm">
              <span class="text-gray-600">Equivalente en pesos</span>
              <span class="font-medium text-gray-900">{{ rdEquivalentFormatted }}</span>
            </div>

            <!-- Bank fee -->
            <div class="flex items-center justify-between gap-3">
              <span class="text-sm text-gray-600">Comision bancaria</span>
              <div class="flex items-center gap-1 shrink-0">
                <span class="text-sm text-gray-400">RD$</span>
                <input
                  type="number"
                  [(ngModel)]="fee"
                  min="0"
                  class="w-20 rounded-md border border-gray-300 px-2 py-1 text-sm text-right text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-300"
                />
              </div>
            </div>

            <!-- Net to receive -->
            <div class="flex items-center justify-between py-2 border-t border-gray-100">
              <span class="text-sm font-semibold text-gray-700">Neto a recibir</span>
              <span class="text-base font-bold text-income">{{ netFormatted }}</span>
            </div>
          </div>
        }

        <!-- DOP block: optional fee + net -->
        @if (currency === 'dop') {
          <div class="flex flex-col gap-3 pt-3 border-t border-gray-100">
            <!-- Optional fee -->
            <div class="flex items-center justify-between gap-3">
              <span class="text-sm text-gray-600">Comision bancaria (opcional)</span>
              <div class="flex items-center gap-1 shrink-0">
                <span class="text-sm text-gray-400">RD$</span>
                <input
                  type="number"
                  [(ngModel)]="fee"
                  min="0"
                  class="w-20 rounded-md border border-gray-300 px-2 py-1 text-sm text-right text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-300"
                />
              </div>
            </div>

            <!-- Net -->
            @if (fee > 0) {
              <div class="flex items-center justify-between py-2 border-t border-gray-100">
                <span class="text-sm font-semibold text-gray-700">Neto a recibir</span>
                <span class="text-base font-bold text-income">{{ netFormatted }}</span>
              </div>
            }
          </div>
        }

      </div>

      <!-- Register button -->
      <button
        type="button"
        (click)="register()"
        [disabled]="!isValid"
        class="w-full py-2.5 text-sm font-medium text-white bg-brand-600 rounded-xl hover:bg-brand-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        Registrar ingreso
      </button>

      <!-- History -->
      <div>
        <h2 class="text-sm font-semibold text-gray-800 mb-2">Historial</h2>
        <div class="rounded-xl border border-gray-200 bg-white overflow-hidden divide-y divide-gray-100">

          @for (entry of history; track entry.id) {
            <!-- Collapsed row -->
            <button
              type="button"
              (click)="toggleEntry(entry.id)"
              class="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors text-left"
            >
              <div>
                <p class="text-sm text-gray-700">{{ entry.date }} &middot; {{ sourceLabel(entry.source) }}</p>
                @if (entry.expanded) {
                  <div class="mt-2 flex flex-col gap-1 text-xs text-gray-500">
                    @if (entry.currency === 'usd' && entry.rate) {
                      <p>{{ rateLabel(entry) }}</p>
                    }
                    @if (entry.fee > 0) {
                      <p>Comision: {{ feeFormatted(entry) }}</p>
                    }
                  </div>
                }
              </div>
              <div class="flex items-center gap-2 shrink-0">
                <span class="text-sm font-medium text-income">{{ entryNetFormatted(entry) }}</span>
                <svg
                  class="w-3.5 h-3.5 text-gray-300 transition-transform shrink-0"
                  [class.rotate-90]="entry.expanded"
                  viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"
                >
                  <path d="m9 18 6-6-6-6"/>
                </svg>
              </div>
            </button>
          }

          @if (history.length === 0) {
            <p class="text-xs text-gray-400 text-center px-4 py-6">No hay ingresos registrados aun.</p>
          }

        </div>
      </div>

    </div>
  `,
})
export class IncomeComponent {
  source: Source   = 'payroll';
  currency: Currency = 'dop';
  amount  = 0;
  date    = new Date().toISOString().substring(0, 10);
  rate    = 59.00;
  fee     = 0;
  rateIsAuto = true;

  setCurrency(c: Currency): void {
    this.currency = c;
    this.fee = 0;
  }

  get rdEquivalent(): number {
    return Math.round(this.amount * this.rate);
  }

  get rdEquivalentFormatted(): string {
    return 'RD$' + this.rdEquivalent.toLocaleString();
  }

  get net(): number {
    if (this.currency === 'usd') {
      return this.rdEquivalent - this.fee;
    }
    return this.amount - this.fee;
  }

  get netFormatted(): string {
    return 'RD$' + Math.max(0, this.net).toLocaleString();
  }

  get isValid(): boolean {
    return this.amount > 0 && this.date.length > 0;
  }

  sourceLabel(s: Source): string {
    return s === 'payroll' ? 'Nomina' : 'Otro ingreso';
  }

  entryNetFormatted(entry: HistoryEntry): string {
    return 'RD$' + entry.net.toLocaleString();
  }

  feeFormatted(entry: HistoryEntry): string {
    return 'RD$' + entry.fee.toLocaleString();
  }

  rateLabel(entry: HistoryEntry): string {
    return 'Tasa aplicada: RD$' + entry.rate;
  }

  toggleEntry(id: number): void {
    const entry = this.history.find(e => e.id === id);
    if (entry) entry.expanded = !entry.expanded;
  }

  register(): void {
    if (!this.isValid) return;
    // TODO: wire to API
  }

  history: HistoryEntry[] = [
    {
      id: 1, date: '1 oct 2026', source: 'payroll', currency: 'usd',
      amount: 1500, rate: 58.50, fee: 350, net: 87400, expanded: false,
    },
    {
      id: 2, date: '1 sep 2026', source: 'payroll', currency: 'usd',
      amount: 1500, rate: 58.20, fee: 350, net: 86950, expanded: false,
    },
    {
      id: 3, date: '15 ago 2026', source: 'other', currency: 'dop',
      amount: 12000, rate: null, fee: 0, net: 12000, expanded: false,
    },
  ];
}
