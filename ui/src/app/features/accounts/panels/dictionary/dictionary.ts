import { Component, OnInit, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { combineLatest, map } from 'rxjs';
import { ApiConfiguration } from '../../../../api/api-configuration';
import { getAccounts } from '../../../../api/fn/accounts/get-accounts';
import { listMerchantMappings } from '../../../../api/fn/dictionary/list-merchant-mappings';
import { createMerchantMapping } from '../../../../api/fn/dictionary/create-merchant-mapping';
import { updateMerchantMapping } from '../../../../api/fn/dictionary/update-merchant-mapping';
import { deleteMerchantMapping } from '../../../../api/fn/dictionary/delete-merchant-mapping';
import { MerchantMappingResponse } from '../../../../api/models/merchant-mapping-response';

interface Merchant {
  id:        number;
  pattern:   string;
  category:  string;
  accountId: number;
}

@Component({
  selector: 'app-dictionary',
  imports: [FormsModule],
  host: { class: 'block' },
  template: `
    <div class="flex flex-col gap-5">

      <!-- Header -->
      <div>
        <h1 class="text-2xl font-bold text-gray-900">Diccionario de comercios</h1>
        <p class="text-sm text-gray-400 mt-0.5">Mapeos aprendidos para categorizar automaticamente tus estados de cuenta.</p>
      </div>

      <!-- Search + count + add -->
      <div class="flex flex-col gap-2">
        <div class="flex items-center gap-2">
          <div class="relative flex-1">
            <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none"
              fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z"/>
            </svg>
            <input
              type="text"
              [(ngModel)]="searchQuery"
              placeholder="Buscar comercio..."
              class="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-300 focus:border-brand-400 transition-colors"
            />
          </div>
          <button
            type="button"
            (click)="toggleAddForm()"
            class="flex items-center gap-1 px-3 py-2 text-sm font-medium text-brand-600 border border-brand-300 rounded-lg hover:bg-brand-50 transition-colors shrink-0"
          >
            <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path stroke="none" d="M0 0h24v24H0z" fill="none"/>
              <path d="M12 5l0 14" />
              <path d="M5 12l14 0" />
            </svg>
            Agregar manual
          </button>
        </div>
        <p class="text-xs text-gray-400 px-1">{{ countLabel }}</p>
      </div>

      <!-- Add manual inline form -->
      @if (showAddForm) {
        <div class="rounded-xl border border-brand-200 bg-brand-50 p-4 flex flex-col gap-3">
          <p class="text-sm font-semibold text-brand-700">Nuevo mapeo manual</p>
          <div class="flex flex-col gap-2">
            <div class="flex flex-col gap-1">
              <label class="text-xs font-medium text-gray-600">Patron del comercio</label>
              <input
                type="text"
                [(ngModel)]="newPattern"
                placeholder="Ej. NETFLIX, UBER EATS, SUPERMERCADO"
                class="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-300 focus:border-brand-400"
              />
              <p class="text-xs text-gray-400">El texto tal como aparece en el estado de cuenta (sin distinguir mayusculas).</p>
            </div>
            <div class="flex flex-col gap-1">
              <label class="text-xs font-medium text-gray-600">Categoria</label>
              <select
                [(ngModel)]="newCategory"
                class="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-300"
              >
                @for (cat of categories; track cat) {
                  <option [value]="cat">{{ cat }}</option>
                }
              </select>
            </div>
          </div>
          <div class="flex gap-2 justify-end">
            <button type="button" (click)="cancelAdd()"
              class="px-3 py-1.5 text-sm text-gray-600 rounded-lg hover:bg-white transition-colors">
              Cancelar
            </button>
            <button type="button" (click)="addMerchant()" [disabled]="!newPattern.trim()"
              class="px-3 py-1.5 text-sm font-medium text-white bg-brand-600 rounded-lg hover:bg-brand-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
              Guardar
            </button>
          </div>
        </div>
      }

      <!-- Note -->
      <div class="flex items-start gap-2 rounded-lg bg-gray-50 border border-gray-200 px-4 py-3">
        <svg class="w-3.5 h-3.5 text-gray-400 shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path stroke="none" d="M0 0h24v24H0z" fill="none"/>
          <path d="M3 12a9 9 0 1 0 18 0a9 9 0 0 0 -18 0" />
          <path d="M12 9h.01" />
          <path d="M11 12h1v4h1" />
        </svg>
        <p class="text-xs text-gray-500 leading-relaxed">
          Editar o eliminar un mapeo solo afecta transacciones futuras. Las lineas ya categorizadas en estados anteriores no se recalculan.
        </p>
      </div>

      <!-- Merchant list -->
      <div class="rounded-xl border border-gray-200 bg-white overflow-hidden divide-y divide-gray-100">

        @if (filteredMerchants.length === 0) {
          <p class="text-xs text-gray-400 text-center px-4 py-8">
            {{ searchQuery ? 'Sin resultados para "' + searchQuery + '".' : 'No hay comercios registrados aun.' }}
          </p>
        }

        @for (merchant of filteredMerchants; track merchant.id) {
          <div class="flex items-center gap-3 px-4 py-3">

            <!-- Pattern -->
            <div class="flex-1 min-w-0">
              <p class="text-sm font-medium text-gray-900 truncate font-mono tracking-tight">{{ merchant.pattern }}</p>
            </div>

            <!-- Category dropdown (inline edit) -->
            <select
              [(ngModel)]="merchant.category"
              (change)="updateCategory(merchant)"
              class="text-sm border border-gray-200 rounded-md px-2 py-1 text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-brand-300 focus:border-brand-400 transition-colors"
            >
              @for (cat of categories; track cat) {
                <option [value]="cat">{{ cat }}</option>
              }
            </select>

            <!-- Delete -->
            <button
              type="button"
              (click)="deleteMerchant(merchant.id)"
              class="p-1.5 text-gray-300 rounded-md hover:text-expense hover:bg-red-50 transition-colors shrink-0"
              title="Eliminar mapeo"
            >
              <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path stroke="none" d="M0 0h24v24H0z" fill="none"/>
                <path d="M4 7l16 0" />
                <path d="M10 11l0 6" />
                <path d="M14 11l0 6" />
                <path d="M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2 -2l1 -12" />
                <path d="M9 7v-3a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v3" />
              </svg>
            </button>

          </div>
        }

      </div>

    </div>
  `,
})
export class DictionaryComponent implements OnInit {
  private readonly http    = inject(HttpClient);
  private readonly rootUrl = inject(ApiConfiguration).rootUrl;

  searchQuery  = '';
  showAddForm  = false;
  newPattern   = '';
  newCategory  = '';

  categories:  string[] = [];
  private categoryMap: Record<string, number> = {};

  private readonly merchantsSignal = signal<Merchant[]>([]);

  ngOnInit(): void {
    combineLatest([
      getAccounts(this.http, this.rootUrl, { type: 'EXPENSE' }).pipe(map(r => r.body!)),
      listMerchantMappings(this.http, this.rootUrl).pipe(map(r => r.body!)),
    ]).subscribe(([accounts, mappings]) => {
      this.categories  = accounts.map(a => a.name ?? '').filter(Boolean);
      this.categoryMap = Object.fromEntries(accounts.map(a => [a.name ?? '', a.id ?? 0]));
      this.newCategory = this.categories[0] ?? '';
      this.merchantsSignal.set(mappings.map(m => this.toMerchant(m)));
    });
  }

  get filteredMerchants(): Merchant[] {
    const all = this.merchantsSignal();
    if (!this.searchQuery.trim()) return all;
    const q = this.searchQuery.toLowerCase();
    return all.filter(m => m.pattern.toLowerCase().includes(q));
  }

  get countLabel(): string {
    return this.merchantsSignal().length + ' comercios aprendidos';
  }

  toggleAddForm(): void {
    this.showAddForm = !this.showAddForm;
    if (!this.showAddForm) { this.newPattern = ''; this.newCategory = this.categories[0] ?? ''; }
  }

  cancelAdd(): void {
    this.showAddForm = false;
    this.newPattern  = '';
    this.newCategory = this.categories[0] ?? '';
  }

  addMerchant(): void {
    const pattern   = this.newPattern.trim();
    const accountId = this.categoryMap[this.newCategory];
    if (!pattern || !accountId) return;

    createMerchantMapping(this.http, this.rootUrl, {
      body: { pattern, accountId },
    }).pipe(map(r => r.body!)).subscribe(m => {
      this.merchantsSignal.update(list => [this.toMerchant(m), ...list]);
      this.cancelAdd();
    });
  }

  updateCategory(merchant: Merchant): void {
    const accountId = this.categoryMap[merchant.category];
    if (!accountId || accountId === merchant.accountId) return;

    updateMerchantMapping(this.http, this.rootUrl, {
      id: merchant.id, body: { accountId },
    }).pipe(map(r => r.body!)).subscribe(m => {
      merchant.accountId = m.accountId ?? merchant.accountId;
    });
  }

  deleteMerchant(id: number): void {
    deleteMerchantMapping(this.http, this.rootUrl, { id }).subscribe(() => {
      this.merchantsSignal.update(list => list.filter(m => m.id !== id));
    });
  }

  private toMerchant(m: MerchantMappingResponse): Merchant {
    return {
      id:        m.id        ?? 0,
      pattern:   m.pattern   ?? '',
      category:  m.accountName ?? '',
      accountId: m.accountId ?? 0,
    };
  }
}
