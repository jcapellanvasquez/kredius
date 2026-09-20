import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AccountApiService } from '../../account-api.service';
import { AccountType } from '../../../../api/models/account-type';

type LocalAccountType = 'expense' | 'income' | 'asset' | 'liability';

interface TypeOption {
  value: LocalAccountType;
  label: string;
}

@Component({
  selector: 'app-new-account',
  imports: [FormsModule, RouterLink],
  host: { class: 'block' },
  template: `
    <div class="flex flex-col gap-5">

      <!-- Header -->
      <div class="flex items-start justify-between">
        <div>
          <h1 class="text-2xl font-bold text-gray-900">Nueva cuenta</h1>
          <p class="text-sm text-gray-400 mt-0.5">Completa los campos para registrar la cuenta en el sistema.</p>
        </div>
        <a [routerLink]="['/accounts']" class="text-gray-400 hover:text-gray-600 transition-colors p-1">
          <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path stroke="none" d="M0 0h24v24H0z" fill="none"/>
            <path d="M18 6l-12 12" />
            <path d="M6 6l12 12" />
          </svg>
        </a>
      </div>

      <div class="rounded-xl border border-gray-200 bg-white p-5 flex flex-col gap-5">

        <!-- Account name -->
        <div class="flex flex-col gap-1.5">
          <label class="text-sm font-medium text-gray-700">Nombre</label>
          <input
            type="text"
            [(ngModel)]="name"
            placeholder="Ej. Cuenta ahorros BHD"
            class="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-300 focus:border-brand-400 transition-colors"
          />
        </div>

        <!-- Account type chips -->
        <div class="flex flex-col gap-1.5">
          <label class="text-sm font-medium text-gray-700">Tipo de cuenta</label>
          <div class="flex gap-2 flex-wrap">
            @for (opt of typeOptions; track opt.value) {
              <button
                type="button"
                (click)="selectType(opt.value)"
                class="px-4 py-1.5 rounded-full text-sm font-medium transition-colors"
                [class.bg-brand-600]="selectedType === opt.value"
                [class.text-white]="selectedType === opt.value"
                [class.bg-brand-50]="selectedType !== opt.value"
                [class.text-brand-800]="selectedType !== opt.value"
              >
                {{ opt.label }}
              </button>
            }
          </div>
        </div>

        <!-- Opening balance (Asset / Liability only) -->
        @if (showOpeningBalance) {
          <div class="flex flex-col gap-1.5">
            <label class="text-sm font-medium text-gray-700">Saldo inicial</label>
            <div class="relative">
              <span class="absolute inset-y-0 left-3 flex items-center text-sm text-gray-400 pointer-events-none">RD&#36;</span>
              <input
                type="number"
                [(ngModel)]="openingBalance"
                min="0"
                placeholder="0"
                class="w-full pl-10 pr-3 py-2 text-sm border border-gray-300 rounded-lg placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-300 focus:border-brand-400 transition-colors"
              />
            </div>
            <p class="text-xs text-gray-400">{{ openingBalanceHelper }}</p>
          </div>

          <!-- Journal entry preview -->
          @if (openingBalance > 0) {
            <div class="rounded-lg border border-gray-100 bg-gray-50 px-4 py-3">
              <p class="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Asiento de apertura</p>
              <div class="flex flex-col gap-1">
                <div class="flex items-center justify-between text-xs">
                  <span class="text-gray-500">Debe</span>
                  <span class="font-medium text-gray-800">{{ journalDebitAccount }}</span>
                </div>
                <div class="flex items-center justify-between text-xs pl-4">
                  <span class="text-gray-500">Haber</span>
                  <span class="font-medium text-gray-800">{{ journalCreditAccount }}</span>
                </div>
              </div>
            </div>
          }
        }

        <!-- Alerts block (Expense only) -->
        @if (selectedType === 'expense') {
          <div class="flex flex-col gap-3 pt-1 border-t border-gray-100">
            <p class="text-sm font-medium text-gray-700">Alertas de concentracion</p>

            <div class="flex items-center justify-between">
              <div>
                <span class="text-sm text-gray-600">Umbral del ingreso mensual</span>
                <p class="text-xs text-gray-400 mt-0.5">{{ thresholdHint }}</p>
              </div>
              <div class="flex items-center gap-1 shrink-0">
                <input
                  type="number"
                  [(ngModel)]="threshold"
                  min="1"
                  max="100"
                  class="w-16 rounded-md border border-gray-300 px-2 py-1 text-sm text-right text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                />
                <span class="text-sm text-gray-400">%</span>
              </div>
            </div>

            <div class="flex items-center justify-between">
              <span class="text-sm text-gray-600">Mostrar en alertas</span>
              <label class="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" class="sr-only peer" [(ngModel)]="showInAlerts" />
                <div class="w-11 h-6 bg-gray-200 rounded-full peer
                            peer-checked:bg-brand-600
                            after:content-[''] after:absolute after:top-0.5 after:left-0.5
                            after:bg-white after:rounded-full after:h-5 after:w-5
                            after:transition-all peer-checked:after:translate-x-5">
                </div>
              </label>
            </div>
          </div>
        }

        <!-- Loan notice (Liability only) -->
        @if (selectedType === 'liability') {
          <div class="flex items-start gap-2.5 rounded-lg bg-amber-50 border border-amber-100 px-4 py-3">
            <svg class="w-4 h-4 text-amber-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
            </svg>
            <p class="text-xs text-amber-700 leading-relaxed">
              <span class="font-semibold">Es un prestamo a cuotas?</span>
              Usa "Nuevo prestamo" en cambio — ese flujo calcula la tabla de amortizacion automaticamente y lleva el control de cuotas.
            </p>
          </div>
        }

      </div>

      <!-- Actions -->
      <div class="flex items-center justify-end gap-2">
        <button
          type="button"
          [routerLink]="['/accounts']"
          class="px-4 py-2 text-sm text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
        >
          Cancelar
        </button>
        <button
          type="button"
          (click)="createAccount()"
          [disabled]="!isValid || saving"
          class="px-4 py-2 text-sm font-medium text-white bg-brand-600 rounded-lg hover:bg-brand-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {{ saving ? 'Guardando...' : 'Crear cuenta' }}
        </button>
      </div>

    </div>
  `,
})
export class NewAccountComponent {
  private readonly accountSvc = inject(AccountApiService);
  private readonly router = inject(Router);

  name = '';
  selectedType: LocalAccountType | null = null;
  openingBalance = 0;
  threshold = 15;
  showInAlerts = true;
  saving = false;

  readonly typeOptions: TypeOption[] = [
    { value: 'expense',   label: 'Gasto'   },
    { value: 'income',    label: 'Ingreso'  },
    { value: 'asset',     label: 'Activo'   },
    { value: 'liability', label: 'Pasivo'   },
  ];

  selectType(type: LocalAccountType): void {
    this.selectedType = type;
    this.openingBalance = 0;
  }

  get showOpeningBalance(): boolean {
    return this.selectedType === 'asset' || this.selectedType === 'liability';
  }

  get openingBalanceHelper(): string {
    if (this.selectedType === 'asset')     return 'Lo que ya tienes en esta cuenta hoy.';
    if (this.selectedType === 'liability') return 'Lo que ya debes en esta cuenta hoy.';
    return '';
  }

  get journalDebitAccount(): string {
    const acct = this.name || 'nueva cuenta';
    return this.selectedType === 'asset' ? acct : 'Patrimonio (apertura)';
  }

  get journalCreditAccount(): string {
    const acct = this.name || 'nueva cuenta';
    return this.selectedType === 'asset' ? 'Patrimonio (apertura)' : acct;
  }

  get thresholdHint(): string {
    const amount = Math.round(85000 * (this.threshold / 100)).toLocaleString();
    return '≈ RD$' + amount + ' (basado en ingresos de oct: RD$85,000)';
  }

  get isValid(): boolean {
    return this.name.trim().length > 0 && this.selectedType !== null;
  }

  createAccount(): void {
    if (!this.isValid || this.saving) return;
    this.saving = true;

    const typeMap: Record<LocalAccountType, AccountType> = {
      asset:     'ASSET',
      liability: 'LIABILITY',
      income:    'INCOME',
      expense:   'EXPENSE',
    };

    this.accountSvc.create({
      name: this.name.trim(),
      type: typeMap[this.selectedType!],
      thresholdPct: this.selectedType === 'expense' ? this.threshold : undefined,
      showInAlerts: this.selectedType === 'expense' ? this.showInAlerts : false,
    }).subscribe({
      next: () => this.router.navigate(['/accounts']),
      error: () => { this.saving = false; },
    });
  }
}
