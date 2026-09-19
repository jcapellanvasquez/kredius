import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';

type AccountFlow = 'credit-card' | 'savings';
type NewMerchantStatus = 'pending' | 'resolved';

interface CategorizedLine {
  id:          number;
  merchant:    string;
  category:    string;
  currency:    'dop' | 'usd';
  amount:      number;
  rate:        number | null;
  rdEquiv:     number;
}

interface NewMerchantLine {
  id:          number;
  merchant:    string;
  amount:      number;
  currency:    'dop' | 'usd';
  rdEquiv:     number;
  suggestions: string[];
  selected:    string | null;
  status:      NewMerchantStatus;
  showDropdown: boolean;
  otherCategory: string;
}

interface ExcludedLine {
  id:       number;
  reason:   string;
  merchant: string;
  amount:   number;
}

interface SavingsDeposit {
  id:      number;
  date:    string;
  desc:    string;
  amount:  number;
  fee:     number;
}

interface SavingsMovement {
  id:      number;
  date:    string;
  desc:    string;
  amount:  number;
  inflow:  boolean;
}

const CATEGORIES = [
  'Alimentación', 'Transporte', 'Entretenimiento', 'Salud',
  'Servicios del hogar', 'Ropa y calzado', 'Tecnología',
  'Educación', 'Gasolina', 'Farmacia', 'Restaurantes', 'Otro',
];

@Component({
  selector: 'app-upload-statement',
  imports: [FormsModule],
  host: { class: 'block' },
  template: `
    <div class="flex flex-col gap-5">

      <!-- Header -->
      <div>
        <h1 class="text-2xl font-bold text-gray-900">Subir corte</h1>
        <p class="text-sm text-gray-400 mt-0.5">Carga y categoriza tu estado de cuenta.</p>
      </div>

      <!-- Account type selector -->
      <div class="flex gap-2">
        <button type="button" (click)="flow = 'credit-card'; reset()"
          class="flex-1 py-2.5 text-sm font-medium rounded-xl transition-colors"
          [class.bg-brand-600]="flow === 'credit-card'"
          [class.text-white]="flow === 'credit-card'"
          [class.bg-brand-50]="flow !== 'credit-card'"
          [class.text-brand-800]="flow !== 'credit-card'">
          Tarjeta de crédito
        </button>
        <button type="button" (click)="flow = 'savings'; reset()"
          class="flex-1 py-2.5 text-sm font-medium rounded-xl transition-colors"
          [class.bg-brand-600]="flow === 'savings'"
          [class.text-white]="flow === 'savings'"
          [class.bg-brand-50]="flow !== 'savings'"
          [class.text-brand-800]="flow !== 'savings'">
          Cuenta de ahorros
        </button>
      </div>

      <!-- ────────────────── UPLOAD ZONE ────────────────── -->
      @if (!parsed) {
        <div
          class="rounded-xl border-2 border-dashed border-gray-300 bg-white px-6 py-10 flex flex-col items-center gap-3 hover:border-brand-300 hover:bg-brand-50 transition-colors cursor-pointer"
          (click)="simulateParse()">
          <svg class="w-10 h-10 text-gray-300" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5"/>
          </svg>
          <div class="text-center">
            <p class="text-sm font-medium text-gray-700">Haz clic para seleccionar el archivo</p>
            <p class="text-xs text-gray-400 mt-0.5">PDF o CSV · máx. 10 MB</p>
          </div>
          <span class="px-4 py-1.5 text-xs font-medium text-brand-800 bg-brand-50 rounded-full">
            Seleccionar archivo
          </span>
        </div>
      }

      <!-- ────────────────── CREDIT CARD FLOW ────────────────── -->
      @if (parsed && flow === 'credit-card') {

        <!-- File parsed notice -->
        <div class="flex items-center gap-3 rounded-xl border border-green-200 bg-green-50 px-4 py-3">
          <svg class="w-5 h-5 text-income shrink-0" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"/>
          </svg>
          <div>
            <p class="text-sm font-medium text-green-800">Corte oct 2026 procesado</p>
            <p class="text-xs text-green-600">Se detectaron 2 bloques de moneda · 24 líneas</p>
          </div>
          <button type="button" (click)="reset()" class="ml-auto text-xs text-green-600 hover:text-green-800 shrink-0">
            Cambiar archivo
          </button>
        </div>

        <!-- Consolidation box -->
        <div class="rounded-xl border border-gray-200 bg-white p-4 flex flex-col gap-4">
          <p class="text-xs font-semibold text-gray-500 uppercase tracking-wide">Consolidación de monedas</p>

          <div class="grid grid-cols-2 gap-3">
            <div class="rounded-lg bg-gray-50 px-3 py-3">
              <p class="text-xs text-gray-400 mb-0.5">Subtotal RD$</p>
              <p class="text-base font-bold text-gray-900">RD$52,340</p>
            </div>
            <div class="rounded-lg bg-gray-50 px-3 py-3">
              <p class="text-xs text-gray-400 mb-0.5">Subtotal US$</p>
              <p class="text-base font-bold text-gray-900">US$1,240</p>
            </div>
          </div>

          <!-- Rate row -->
          <div class="flex items-center justify-between gap-3">
            <div class="flex items-center gap-1.5">
              <span class="text-sm text-gray-600">Tasa de cambio</span>
              <span class="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-brand-50 text-brand-600 border border-brand-200">auto</span>
            </div>
            <div class="flex items-center gap-1 shrink-0">
              <span class="text-sm text-gray-400">RD$</span>
              <input type="number" [(ngModel)]="consolidationRate" min="1" step="0.01"
                class="w-20 rounded-md border border-gray-300 px-2 py-1 text-sm text-right text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-300"/>
            </div>
          </div>

          <div class="flex items-center justify-between text-sm">
            <span class="text-gray-600">Equivalente en pesos (US$)</span>
            <span class="font-medium text-gray-900">{{ usdRdEquivFormatted }}</span>
          </div>

          <div class="flex items-center justify-between text-sm">
            <span class="text-gray-600">Total comisiones bancarias</span>
            <span class="font-medium text-expense">{{ ccTotalFeesFormatted }}</span>
          </div>

          <div class="flex items-center justify-between pt-3 border-t border-gray-100">
            <span class="text-sm font-semibold text-gray-700">Total consolidado</span>
            <span class="text-lg font-bold text-gray-900">{{ consolidatedTotalFormatted }}</span>
          </div>
        </div>

        <!-- Budget comparison -->
        <div class="rounded-xl border border-gray-200 bg-white p-4 flex flex-col gap-3">
          <p class="text-xs font-semibold text-gray-500 uppercase tracking-wide">Presupuesto vs. real (oct)</p>
          @for (row of budgetComparison; track row.name) {
            <div class="flex items-center justify-between py-2 border-t border-gray-100 first:border-t-0 first:pt-0">
              <span class="text-sm text-gray-600">{{ row.name }}</span>
              <div class="flex items-center gap-3 shrink-0 text-sm">
                <span class="text-gray-400">{{ formatRD(row.budget) }}</span>
                <span class="font-medium"
                  [class.text-expense]="row.actual > row.budget"
                  [class.text-income]="row.actual <= row.budget">
                  {{ formatRD(row.actual) }}
                </span>
                @if (row.actual > row.budget) {
                  <span class="text-xs text-expense">+{{ formatRD(row.actual - row.budget) }}</span>
                }
              </div>
            </div>
          }
        </div>

        <!-- Auto-categorized -->
        <div class="rounded-xl border border-gray-200 bg-white overflow-hidden">
          <button type="button" (click)="showCategorized = !showCategorized"
            class="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors">
            <div class="flex items-center gap-2">
              <span class="text-sm font-medium text-gray-700">Categorizadas automáticamente</span>
              <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-income">
                {{ categorized.length }}
              </span>
            </div>
            <svg class="w-4 h-4 text-gray-400 transition-transform"
              [class.rotate-180]="showCategorized"
              fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5"/>
            </svg>
          </button>
          @if (showCategorized) {
            <div class="border-t border-gray-100 divide-y divide-gray-50">
              @for (line of categorized; track line.id) {
                <div class="px-4 py-3 flex items-start gap-3">
                  <div class="flex-1 min-w-0">
                    <p class="text-sm font-medium text-gray-800 truncate">{{ line.merchant }}</p>
                    @if (line.currency === 'usd' && line.rate) {
                      <p class="text-xs text-gray-400 mt-0.5">{{ usdConversionLabel(line) }}</p>
                    }
                  </div>
                  <span class="shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-brand-50 text-brand-800">
                    {{ line.category }}
                  </span>
                  <span class="shrink-0 text-sm font-medium text-expense">{{ formatRD(line.rdEquiv) }}</span>
                </div>
              }
            </div>
          }
        </div>

        <!-- New merchants -->
        @if (newMerchants.length > 0) {
          <div class="rounded-xl border border-amber-200 bg-amber-50 overflow-hidden">
            <div class="flex items-center gap-2 px-4 py-3 border-b border-amber-100">
              <svg class="w-4 h-4 text-amber-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"/>
              </svg>
              <span class="text-sm font-medium text-amber-800">Comercios nuevos</span>
              <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-200 text-amber-800">
                {{ pendingNewMerchants }} sin resolver
              </span>
            </div>
            <div class="divide-y divide-amber-100">
              @for (m of newMerchants; track m.id) {
                <div class="px-4 py-3 flex flex-col gap-2"
                  [class.opacity-50]="m.status === 'resolved'">
                  <div class="flex items-center justify-between gap-3">
                    <div class="flex-1 min-w-0">
                      <p class="text-sm font-medium text-gray-800 font-mono truncate">{{ m.merchant }}</p>
                      <p class="text-xs text-gray-500">{{ formatRD(m.rdEquiv) }}</p>
                    </div>
                    @if (m.status === 'resolved') {
                      <span class="text-xs text-income font-medium shrink-0">Guardado ✓</span>
                    }
                  </div>
                  @if (m.status === 'pending') {
                    <div class="flex flex-wrap gap-2">
                      @for (sug of m.suggestions; track sug) {
                        <button type="button" (click)="resolveNewMerchant(m.id, sug)"
                          class="px-3 py-1 text-xs font-medium rounded-full bg-brand-50 text-brand-800 hover:bg-brand-100 transition-colors">
                          {{ sug }}
                        </button>
                      }
                      @if (!m.showDropdown) {
                        <button type="button" (click)="m.showDropdown = true"
                          class="px-3 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors">
                          Otra categoría ▾
                        </button>
                      } @else {
                        <select [(ngModel)]="m.otherCategory" (ngModelChange)="resolveNewMerchant(m.id, m.otherCategory)"
                          class="text-xs border border-gray-300 rounded-lg px-2 py-1 text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-brand-300">
                          @for (cat of categories; track cat) {
                            <option [value]="cat">{{ cat }}</option>
                          }
                        </select>
                      }
                    </div>
                  }
                </div>
              }
            </div>
          </div>
        }

        <!-- Excluded lines -->
        <div class="rounded-xl border border-gray-200 bg-white overflow-hidden">
          <button type="button" (click)="showExcluded = !showExcluded"
            class="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors">
            <div class="flex items-center gap-2">
              <span class="text-sm font-medium text-gray-700">Líneas excluidas</span>
              <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500">
                {{ excluded.length }}
              </span>
            </div>
            <svg class="w-4 h-4 text-gray-400 transition-transform"
              [class.rotate-180]="showExcluded"
              fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5"/>
            </svg>
          </button>
          @if (showExcluded) {
            <div class="border-t border-gray-100 divide-y divide-gray-50">
              @for (line of excluded; track line.id) {
                <div class="px-4 py-3 flex items-center justify-between gap-3">
                  <div class="flex-1 min-w-0">
                    <p class="text-sm text-gray-500 truncate">{{ line.merchant }}</p>
                    <p class="text-xs text-gray-400 mt-0.5">{{ line.reason }}</p>
                  </div>
                  <span class="text-sm text-gray-400">{{ formatRD(line.amount) }}</span>
                </div>
              }
            </div>
          }
        </div>

        <!-- Confirm -->
        @if (!confirmed) {
          <button type="button" (click)="confirm()"
            [disabled]="pendingNewMerchants > 0"
            class="w-full py-3 text-sm font-semibold text-white bg-brand-600 rounded-xl hover:bg-brand-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
            {{ pendingNewMerchants > 0 ? 'Resuelve los comercios nuevos para continuar' : 'Confirmar y registrar corte' }}
          </button>
        } @else {
          <div class="flex flex-col items-center gap-2 rounded-xl border border-green-200 bg-green-50 px-4 py-6">
            <svg class="w-8 h-8 text-income" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"/>
            </svg>
            <p class="text-base font-semibold text-green-800">Corte registrado</p>
            <p class="text-sm text-green-600 text-center">{{ categorized.length + newMerchants.length }} transacciones importadas · {{ newMerchants.length }} comercios nuevos guardados en el diccionario.</p>
            <button type="button" (click)="reset()"
              class="mt-2 px-4 py-1.5 text-xs font-medium text-brand-800 bg-brand-50 rounded-full hover:bg-brand-100 transition-colors">
              Subir otro corte
            </button>
          </div>
        }

      }

      <!-- ────────────────── SAVINGS FLOW ────────────────── -->
      @if (parsed && flow === 'savings') {

        <!-- File parsed notice -->
        <div class="flex items-center gap-3 rounded-xl border border-green-200 bg-green-50 px-4 py-3">
          <svg class="w-5 h-5 text-income shrink-0" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"/>
          </svg>
          <div>
            <p class="text-sm font-medium text-green-800">Estado de cuenta oct 2026 procesado</p>
            <p class="text-xs text-green-600">{{ savingsDeposits.length }} depósitos · {{ savingsMovements.length }} movimientos</p>
          </div>
          <button type="button" (click)="reset()" class="ml-auto text-xs text-green-600 hover:text-green-800 shrink-0">
            Cambiar archivo
          </button>
        </div>

        <!-- Consolidation box -->
        <div class="rounded-xl border border-gray-200 bg-white p-4 flex flex-col gap-4">
          <p class="text-xs font-semibold text-gray-500 uppercase tracking-wide">Resumen del período</p>

          <div class="grid grid-cols-2 gap-3">
            <div class="rounded-lg bg-gray-50 px-3 py-3">
              <p class="text-xs text-gray-400 mb-0.5">Total depósitos</p>
              <p class="text-base font-bold text-income">{{ savingsTotalDepositsFormatted }}</p>
            </div>
            <div class="rounded-lg bg-gray-50 px-3 py-3">
              <p class="text-xs text-gray-400 mb-0.5">Total retiros</p>
              <p class="text-base font-bold text-expense">{{ savingsTotalWithdrawalsFormatted }}</p>
            </div>
          </div>

          <div class="flex items-center justify-between text-sm">
            <span class="text-gray-600">Total comisiones bancarias</span>
            <span class="font-medium text-expense">{{ savingsTotalFeesFormatted }}</span>
          </div>

          <div class="flex items-center justify-between pt-3 border-t border-gray-100">
            <span class="text-sm font-semibold text-gray-700">Balance resultante</span>
            <span class="text-lg font-bold text-gray-900">{{ savingsBalanceFormatted }}</span>
          </div>
        </div>

        <!-- Deposits with paired fees (expandable) -->
        <div class="rounded-xl border border-gray-200 bg-white overflow-hidden">
          <button type="button" (click)="showSavingsDeposits = !showSavingsDeposits"
            class="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors">
            <div class="flex items-center gap-2">
              <span class="text-sm font-medium text-gray-700">Depósitos</span>
              <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-income">
                {{ savingsDeposits.length }}
              </span>
            </div>
            <svg class="w-4 h-4 text-gray-400 transition-transform"
              [class.rotate-180]="showSavingsDeposits"
              fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5"/>
            </svg>
          </button>
          @if (showSavingsDeposits) {
            <div class="border-t border-gray-100 divide-y divide-gray-50">
              @for (dep of savingsDeposits; track dep.id) {
                <div class="px-4 pt-3 pb-2">
                  <div class="flex items-center justify-between">
                    <p class="text-sm text-gray-800">{{ dep.date }} &middot; {{ dep.desc }}</p>
                    <span class="text-sm font-medium text-income">{{ formatRD(dep.amount) }}</span>
                  </div>
                  @if (dep.fee > 0) {
                    <div class="ml-4 mt-1 flex items-center justify-between text-xs text-gray-400 pl-3 border-l-2 border-gray-100">
                      <span>Comisión de transferencia</span>
                      <span class="text-expense">-{{ formatRD(dep.fee) }}</span>
                    </div>
                    <div class="mt-1 flex items-center justify-between text-xs font-semibold text-gray-600 pt-1 border-t border-gray-100">
                      <span>Neto recibido</span>
                      <span>{{ formatRD(dep.amount - dep.fee) }}</span>
                    </div>
                  }
                </div>
              }
            </div>
          }
        </div>

        <!-- Other movements (expandable) -->
        <div class="rounded-xl border border-gray-200 bg-white overflow-hidden">
          <button type="button" (click)="showSavingsMovements = !showSavingsMovements"
            class="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors">
            <div class="flex items-center gap-2">
              <span class="text-sm font-medium text-gray-700">Otros movimientos</span>
              <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500">
                {{ savingsMovements.length }}
              </span>
            </div>
            <svg class="w-4 h-4 text-gray-400 transition-transform"
              [class.rotate-180]="showSavingsMovements"
              fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5"/>
            </svg>
          </button>
          @if (showSavingsMovements) {
            <div class="border-t border-gray-100 divide-y divide-gray-50">
              @for (mov of savingsMovements; track mov.id) {
                <div class="px-4 py-3 flex items-center justify-between">
                  <span class="text-sm text-gray-700">{{ mov.date }} &middot; {{ mov.desc }}</span>
                  <span class="text-sm font-medium"
                    [class.text-income]="mov.inflow"
                    [class.text-expense]="!mov.inflow">
                    {{ mov.inflow ? '+' : '-' }}{{ formatRD(mov.amount) }}
                  </span>
                </div>
              }
            </div>
          }
        </div>

        <!-- Confirm -->
        @if (!confirmed) {
          <button type="button" (click)="confirm()"
            class="w-full py-3 text-sm font-semibold text-white bg-brand-600 rounded-xl hover:bg-brand-700 transition-colors">
            Confirmar y registrar movimientos
          </button>
        } @else {
          <div class="flex flex-col items-center gap-2 rounded-xl border border-green-200 bg-green-50 px-4 py-6">
            <svg class="w-8 h-8 text-income" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"/>
            </svg>
            <p class="text-base font-semibold text-green-800">Movimientos registrados</p>
            <p class="text-sm text-green-600 text-center">{{ savingsDeposits.length + savingsMovements.length }} líneas importadas a tu cuenta de ahorros.</p>
            <button type="button" (click)="reset()"
              class="mt-2 px-4 py-1.5 text-xs font-medium text-brand-800 bg-brand-50 rounded-full hover:bg-brand-100 transition-colors">
              Subir otro corte
            </button>
          </div>
        }

      }

    </div>
  `,
})
export class UploadStatementComponent {
  flow: AccountFlow   = 'credit-card';
  parsed              = false;
  confirmed           = false;
  consolidationRate   = 59.00;
  showCategorized      = false;
  showExcluded         = false;
  showSavingsDeposits  = false;
  showSavingsMovements = false;

  readonly categories = CATEGORIES;

  // ── Credit card mock data ───────────────────────────────────────────
  categorized: CategorizedLine[] = [
    { id:  1, merchant: 'NETFLIX',              category: 'Entretenimiento',    currency: 'usd', amount:  17,   rate: 59.00, rdEquiv: 1003  },
    { id:  2, merchant: 'SUPERMERCADO NACIONAL', category: 'Alimentación',      currency: 'dop', amount: 3480,  rate: null,  rdEquiv: 3480  },
    { id:  3, merchant: 'UBER',                 category: 'Transporte',         currency: 'dop', amount:  620,  rate: null,  rdEquiv:  620  },
    { id:  4, merchant: 'LA SIRENA',            category: 'Alimentación',       currency: 'dop', amount: 2875,  rate: null,  rdEquiv: 2875  },
    { id:  5, merchant: 'CLARO',                category: 'Servicios del hogar',currency: 'dop', amount: 1500,  rate: null,  rdEquiv: 1500  },
    { id:  6, merchant: 'SPOTIFY',              category: 'Entretenimiento',    currency: 'usd', amount:  11,   rate: 59.00, rdEquiv:  649  },
    { id:  7, merchant: 'TEXACO',               category: 'Gasolina',           currency: 'dop', amount: 2100,  rate: null,  rdEquiv: 2100  },
    { id:  8, merchant: 'FARMACIA CAROL',       category: 'Farmacia',           currency: 'dop', amount:  890,  rate: null,  rdEquiv:  890  },
    { id:  9, merchant: 'AMAZON',               category: 'Tecnología',         currency: 'usd', amount:  45,   rate: 59.00, rdEquiv: 2655  },
    { id: 10, merchant: 'UBER EATS',            category: 'Restaurantes',       currency: 'dop', amount:  680,  rate: null,  rdEquiv:  680  },
  ];

  newMerchants: NewMerchantLine[] = [
    {
      id: 1, merchant: 'PLAZA VALERIO', amount: 346, currency: 'dop', rdEquiv: 346,
      suggestions: ['Entretenimiento', 'Restaurantes'], selected: null, status: 'pending',
      showDropdown: false, otherCategory: CATEGORIES[0],
    },
    {
      id: 2, merchant: 'COLMADO DON RAMON', amount: 430, currency: 'dop', rdEquiv: 430,
      suggestions: ['Alimentación', 'Restaurantes'], selected: null, status: 'pending',
      showDropdown: false, otherCategory: CATEGORIES[0],
    },
  ];

  excluded: ExcludedLine[] = [
    { id: 1, reason: 'Pago a tarjeta',    merchant: 'PAGO BHD',              amount: 15000 },
    { id: 2, reason: 'Puntos / rewards',  merchant: 'BONO PUNTOS MASTERCARD', amount:    0 },
  ];

  budgetComparison = [
    { name: '3010 Alimentación', budget: 12300, actual: 7035  },
    { name: '3020 Transporte',   budget:  3100, actual:  620  },
    { name: '3030 Entretenimiento', budget: 2500, actual: 1652 },
    { name: '3040 Gasolina',     budget:  3000, actual: 2100  },
  ];

  get pendingNewMerchants(): number {
    return this.newMerchants.filter(m => m.status === 'pending').length;
  }

  readonly ccTotalFees = 890;
  get ccTotalFeesFormatted(): string { return 'RD$' + this.ccTotalFees.toLocaleString(); }

  get usdRdEquiv(): number {
    return Math.round(1240 * this.consolidationRate);
  }

  get usdRdEquivFormatted(): string {
    return 'RD$' + this.usdRdEquiv.toLocaleString();
  }

  get consolidatedTotalFormatted(): string {
    return 'RD$' + (52340 + this.usdRdEquiv).toLocaleString();
  }

  resolveNewMerchant(id: number, category: string): void {
    const m = this.newMerchants.find(x => x.id === id);
    if (!m) return;
    m.selected     = category;
    m.status       = 'resolved';
    m.showDropdown = false;
  }

  // ── Savings mock data ──────────────────────────────────────────────
  savingsDeposits: SavingsDeposit[] = [
    { id: 1, date: '1 oct',  desc: 'Nómina octubre',          amount: 85000, fee: 0   },
    { id: 2, date: '5 oct',  desc: 'Transferencia de ahorro', amount: 10000, fee: 350 },
    { id: 3, date: '15 oct', desc: 'Freelance proyecto web',  amount: 12000, fee: 200 },
  ];

  savingsMovements: SavingsMovement[] = [
    { id: 1, date: '3 oct',  desc: 'Pago tarjeta de crédito', amount: 15000, inflow: false },
    { id: 2, date: '7 oct',  desc: 'Pago alquiler',           amount: 18000, inflow: false },
    { id: 3, date: '10 oct', desc: 'Cuota préstamo carro',    amount: 20667, inflow: false },
    { id: 4, date: '12 oct', desc: 'Compra supermercado',     amount:  3480, inflow: false },
  ];

  get savingsTotalDeposits(): number {
    return this.savingsDeposits.reduce((s, d) => s + d.amount, 0);
  }

  get savingsTotalWithdrawals(): number {
    return this.savingsMovements.filter(m => !m.inflow).reduce((s, m) => s + m.amount, 0);
  }

  get savingsBalance(): number {
    return this.savingsTotalDeposits - this.savingsTotalWithdrawals;
  }

  get savingsTotalFees(): number {
    return this.savingsDeposits.reduce((s, d) => s + d.fee, 0);
  }

  get savingsTotalDepositsFormatted():    string { return 'RD$' + this.savingsTotalDeposits.toLocaleString(); }
  get savingsTotalWithdrawalsFormatted(): string { return 'RD$' + this.savingsTotalWithdrawals.toLocaleString(); }
  get savingsBalanceFormatted():          string { return 'RD$' + this.savingsBalance.toLocaleString(); }
  get savingsTotalFeesFormatted():        string { return 'RD$' + this.savingsTotalFees.toLocaleString(); }

  // ── Shared ─────────────────────────────────────────────────────────
  formatRD(v: number): string { return 'RD$' + v.toLocaleString(); }

  usdConversionLabel(line: CategorizedLine): string {
    return 'US$' + line.amount + ' × ' + line.rate + ' = ' + this.formatRD(line.rdEquiv);
  }

  simulateParse(): void {
    this.parsed    = false;
    this.confirmed = false;
    setTimeout(() => { this.parsed = true; }, 400);
  }

  confirm(): void {
    this.confirmed = true;
  }

  reset(): void {
    this.parsed    = false;
    this.confirmed = false;
    this.newMerchants.forEach(m => {
      m.status       = 'pending';
      m.selected     = null;
      m.showDropdown = false;
    });
    this.showCategorized      = false;
    this.showExcluded         = false;
    this.showSavingsDeposits  = false;
    this.showSavingsMovements = false;
  }
}
