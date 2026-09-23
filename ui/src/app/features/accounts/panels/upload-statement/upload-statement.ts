import { Component, inject, OnInit, ElementRef, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgClass } from '@angular/common';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { timeout, TimeoutError } from 'rxjs';
import { AccountApiService } from '../../account-api.service';
import { ApiConfiguration } from '../../../../api/api-configuration';
import { AccountSummaryResponse } from '../../../../api/models/account-summary-response';
import { StatementImportSummaryResponse } from '../../../../api/models/statement-import-summary-response';

type AccountFlow = 'credit-card' | 'savings';
type NewMerchantStatus = 'pending' | 'resolved';
type ImportStatus = 'PENDING_REVIEW' | 'CONFIRMED' | 'REVERSED' | 'FAILED';

interface ImportSummary {
  id:             number;
  accountName:    string;
  statementDate:  string;   // 'YYYY-MM'
  status:         ImportStatus;
  unresolvedCount: number;
  lineCount:      number;
}

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
  id:           number;
  merchant:     string;
  amount:       number;
  currency:     'dop' | 'usd';
  rdEquiv:      number;
  suggestions:  string[];
  selected:     string | null;
  status:       NewMerchantStatus;
  saving:       boolean;
  showDropdown: boolean;
  otherCategory: string;
}

interface ExcludedLine {
  id:       number;
  reason:   string;
  merchant: string;
  amount:   number;
}

interface ApiLine {
  id:                  number;
  lineDate:            string;
  description:         string;
  currency:            'RD' | 'USD';
  amount:              number;
  isExcluded:          boolean;
  isPayment:           boolean;
  categoryAccountId:   number | null;
  categoryAccountName: string | null;
}

const MONTHS_ES = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
const TIMEOUT_MS = 15_000;
const MIN_UPLOAD_SPINNER_MS  = 800;
const MIN_MERCHANT_SAVE_MS   = 600;

@Component({
  selector: 'app-upload-statement',
  imports: [FormsModule, NgClass],
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
      @if (!parsed && !uploading) {

        <!-- Account cards -->
        <div class="grid gap-2.5" [class.grid-cols-2]="accountOptions.length > 1" [class.grid-cols-1]="accountOptions.length <= 1">
          @for (acc of accountOptions; track acc.id) {
            <button type="button" (click)="selectedAccountId = acc.id ?? null"
              class="relative flex flex-col gap-2.5 rounded-xl border-2 p-3.5 text-left transition-all"
              [ngClass]="selectedAccountId === acc.id
                ? 'border-brand-500 bg-brand-50'
                : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'">

              @if (selectedAccountId === acc.id) {
                <span class="absolute top-2.5 right-2.5 w-4 h-4 rounded-full bg-brand-500 flex items-center justify-center">
                  <svg class="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke-width="3" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" d="m4.5 12.75 6 6 9-13.5"/>
                  </svg>
                </span>
              }

              <div class="w-8 h-8 rounded-lg flex items-center justify-center"
                [class.bg-brand-100]="selectedAccountId === acc.id"
                [class.bg-gray-100]="selectedAccountId !== acc.id">
                @if (flow === 'credit-card') {
                  <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"
                    [class.text-brand-600]="selectedAccountId === acc.id"
                    [class.text-gray-400]="selectedAccountId !== acc.id">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 0 0 2.25-2.25V6.75A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25v10.5A2.25 2.25 0 0 0 4.5 19.5Z"/>
                  </svg>
                } @else {
                  <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"
                    [class.text-brand-600]="selectedAccountId === acc.id"
                    [class.text-gray-400]="selectedAccountId !== acc.id">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M12 21v-8.25M15.75 21v-8.25M8.25 21v-8.25M3 9l9-6 9 6m-1.5 12V10.332A48.36 48.36 0 0 0 12 10a48.36 48.36 0 0 0-9.5.332V21L3 21"/>
                  </svg>
                }
              </div>

              <div class="pr-5">
                <p class="text-sm font-semibold leading-snug"
                  [class.text-brand-800]="selectedAccountId === acc.id"
                  [class.text-gray-800]="selectedAccountId !== acc.id">{{ acc.name }}</p>
                <p class="text-xs mt-0.5"
                  [class.text-brand-500]="selectedAccountId === acc.id"
                  [class.text-gray-400]="selectedAccountId !== acc.id">#{{ acc.code }}</p>
              </div>
            </button>
          }
          @if (accountOptions.length === 0) {
            <div class="rounded-xl border border-dashed border-gray-200 px-4 py-6 text-center">
              <p class="text-sm text-gray-400">No hay cuentas para este tipo.</p>
            </div>
          }
        </div>

        <!-- Date picker -->
        <input type="date" [(ngModel)]="statementDate"
          class="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-brand-300"/>

        <!-- Upload error -->
        @if (uploadError) {
          <div class="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
            <div class="flex-1">
              <p class="text-sm font-medium text-red-800">No se pudo procesar el archivo</p>
              <p class="text-xs text-red-600 mt-0.5">{{ uploadError }}</p>
            </div>
            <button type="button" (click)="uploadError = ''" class="text-xs text-red-600 hover:text-red-800 shrink-0">
              Cerrar
            </button>
          </div>
        }

        <div
          class="rounded-xl border-2 border-dashed border-gray-300 bg-white px-6 py-10 flex flex-col items-center gap-3 hover:border-brand-300 hover:bg-brand-50 transition-colors cursor-pointer"
          [class.opacity-40]="!canUpload"
          (click)="triggerFileInput()">
          <svg class="w-[22px] h-[22px] text-brand-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path stroke="none" d="M0 0h24v24H0z" fill="none"/>
            <path d="M14 3v4a1 1 0 0 0 1 1h4" />
            <path d="M17 21h-10a2 2 0 0 1 -2 -2v-14a2 2 0 0 1 2 -2h7l5 5v11a2 2 0 0 1 -2 2z" />
            <path d="M12 11v6" />
            <path d="M9.5 13.5l2.5 -2.5l2.5 2.5" />
          </svg>
          <div class="text-center">
            <p class="text-sm font-medium text-gray-700">Haz clic para seleccionar el archivo</p>
            <p class="text-xs text-gray-400 mt-0.5">PDF o CSV · máx. 10 MB</p>
          </div>
          <span class="px-4 py-1.5 text-xs font-medium text-brand-800 bg-brand-50 rounded-full">
            Seleccionar archivo
          </span>
        </div>
        <input #fileInput type="file" accept=".pdf" class="hidden" (change)="onFileSelected($event)"/>

        <!-- ── En proceso ──────────────────────────────────────────── -->
        @if (pendingImports.length > 0) {
          <div class="flex flex-col gap-2">
            <p class="text-xs font-semibold text-gray-400 uppercase tracking-widest px-0.5">En proceso</p>
            @for (imp of pendingImports; track imp.id) {
              <div class="rounded-xl border border-amber-200 bg-white px-4 py-3 flex items-center gap-3">
                <span class="w-2 h-2 rounded-full bg-amber-400 shrink-0"></span>
                <div class="flex-1 min-w-0">
                  <p class="text-sm font-medium text-gray-800 truncate">{{ imp.accountName }}</p>
                  <p class="text-xs text-gray-400 mt-0.5">
                    {{ formatImportDate(imp.statementDate) }}
                    <span class="mx-1">·</span>
                    <span class="text-amber-600 font-medium">{{ imp.unresolvedCount }} sin categorizar</span>
                    <span class="text-gray-300 mx-1">/</span>
                    {{ imp.lineCount }} líneas
                  </p>
                </div>
                <button type="button" (click)="resumeImport(imp)"
                  class="shrink-0 flex items-center gap-1 text-xs font-semibold text-brand-700 hover:text-brand-900 transition-colors">
                  Reanudar
                  <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3"/>
                  </svg>
                </button>
              </div>
            }
          </div>
        }

        <!-- ── Historial ─────────────────────────────────────────── -->
        @if (historyImports.length > 0) {
          <div class="rounded-xl border border-gray-200 bg-white overflow-hidden">
            <button type="button" (click)="showHistory = !showHistory"
              class="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors">
              <div class="flex items-center gap-2">
                <span class="text-sm font-medium text-gray-600">Historial</span>
                <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500">
                  {{ historyImports.length }}
                </span>
              </div>
              <svg class="w-4 h-4 text-gray-400 transition-transform duration-200"
                [class.rotate-180]="showHistory"
                viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path stroke="none" d="M0 0h24v24H0z" fill="none"/>
                <path d="M6 9l6 6l6 -6" />
              </svg>
            </button>
            @if (showHistory) {
              <div class="border-t border-gray-100 divide-y divide-gray-50">
                @for (imp of historyImports; track imp.id) {
                  <div class="px-4 py-2.5 flex items-center gap-3">
                    <div class="flex-1 min-w-0">
                      <p class="text-sm text-gray-700">{{ formatImportDate(imp.statementDate) }}</p>
                      <p class="text-xs text-gray-400 truncate mt-0.5">{{ imp.accountName }}</p>
                    </div>
                    <span class="shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
                      [ngClass]="statusChipClass(imp.status)">
                      {{ statusLabel(imp.status) }}
                    </span>
                  </div>
                }
              </div>
            }
          </div>
        }
      }

      <!-- Uploading spinner -->
      @if (uploading) {
        <div class="flex flex-col items-center gap-4 py-16">
          <div class="w-10 h-10 border-4 border-brand-200 border-t-brand-600 rounded-full animate-spin"></div>
          <p class="text-sm font-medium text-gray-600">Procesando estado de cuenta...</p>
        </div>
      }

      <!-- ────────────────── PARSED FLOW ────────────────── -->
      @if (parsed) {

        <!-- File parsed notice -->
        <div class="flex items-center gap-3 rounded-xl border border-green-200 bg-green-50 px-4 py-3">
          <svg class="w-5 h-5 text-income shrink-0" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"/>
          </svg>
          <div>
            <p class="text-sm font-medium text-green-800">{{ parsedNoticeTitle }}</p>
            <p class="text-xs text-green-600">{{ parsedNoticeSubtitle }}</p>
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
              <p class="text-xs text-gray-400 mb-0.5">Cargos del período RD$</p>
              <p class="text-base font-bold text-gray-900">{{ rdTotalFormatted }}</p>
            </div>
            <div class="rounded-lg bg-gray-50 px-3 py-3">
              <p class="text-xs text-gray-400 mb-0.5">Cargos del período US$</p>
              <p class="text-base font-bold text-gray-900">{{ usdTotalFormatted }}</p>
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
            <span class="text-gray-600">Pagos excluidos del período (RD$)</span>
            <span class="font-medium text-income">− {{ ccTotalFeesFormatted }}</span>
          </div>

          <!-- Balance al corte note -->
          @if (ccTotalFees > 0) {
            <div class="flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-100 px-3 py-2.5">
              <svg class="w-3.5 h-3.5 text-amber-500 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"/>
              </svg>
              <p class="text-xs text-amber-700 leading-snug">
                El <strong>Balance al corte</strong> del estado también incluye el saldo anterior del período previo,
                por eso puede diferir de los cargos mostrados aquí.
              </p>
            </div>
          }

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
              viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path stroke="none" d="M0 0h24v24H0z" fill="none"/>
              <path d="M6 9l6 6l6 -6" />
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
                      @if (m.saving) {
                        <div class="flex items-center gap-1.5 shrink-0">
                          <div class="w-3 h-3 border-2 border-gray-200 border-t-brand-500 rounded-full animate-spin"></div>
                          <span class="text-xs text-gray-400">Guardando...</span>
                        </div>
                      } @else {
                        <span class="text-xs text-income font-medium shrink-0">Guardado ✓</span>
                      }
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
                      <button type="button" (click)="excludeLine(m.id)"
                        class="ml-auto px-3 py-1 text-xs font-medium rounded-full bg-red-50 text-red-600 hover:bg-red-100 transition-colors">
                        Excluir
                      </button>
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
              viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path stroke="none" d="M0 0h24v24H0z" fill="none"/>
              <path d="M6 9l6 6l6 -6" />
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
          @if (confirmError) {
            <div class="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
              <p class="flex-1 text-sm text-red-700">{{ confirmError }}</p>
              <button type="button" (click)="confirmError = ''" class="text-xs text-red-500 shrink-0">Cerrar</button>
            </div>
          }
          <button type="button" (click)="confirm()"
            [disabled]="pendingNewMerchants > 0 || confirming"
            class="w-full py-3 text-sm font-semibold text-white bg-brand-600 rounded-xl hover:bg-brand-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
            {{ confirming ? 'Registrando...' : pendingNewMerchants > 0 ? 'Resuelve los comercios nuevos para continuar' : flow === 'savings' ? 'Confirmar y registrar movimientos' : 'Confirmar y registrar corte' }}
          </button>
        } @else {
          <div class="flex flex-col items-center gap-2 rounded-xl border border-green-200 bg-green-50 px-4 py-6">
            <svg class="w-8 h-8 text-income" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"/>
            </svg>
            <p class="text-base font-semibold text-green-800">{{ flow === 'savings' ? 'Movimientos registrados' : 'Corte registrado' }}</p>
            <p class="text-sm text-green-600 text-center">{{ postedEntries }} transacciones importadas a la contabilidad.</p>
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
export class UploadStatementComponent implements OnInit {
  @ViewChild('fileInput') private fileInputRef!: ElementRef<HTMLInputElement>;

  private readonly http    = inject(HttpClient);
  private readonly rootUrl = inject(ApiConfiguration).rootUrl;
  private readonly acctSvc = inject(AccountApiService);

  flow: AccountFlow   = 'credit-card';
  parsed              = false;
  confirmed           = false;
  uploading           = false;
  confirming          = false;
  uploadError         = '';
  confirmError        = '';
  consolidationRate   = 59.00;
  postedEntries       = 0;
  showCategorized = false;
  showExcluded    = false;
  showHistory     = false;

  pendingImports: ImportSummary[] = [];
  historyImports: ImportSummary[] = [];

  selectedAccountId: number | null = null;
  statementDate                    = '';

  private importId: number | null             = null;
  private _rawLines: ApiLine[]                = [];
  private _uploadStart                        = 0;
  private _merchantSaveStart                  = new Map<number, number>();

  // ── Credit card data ────────────────────────────────────────────────
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
      saving: false, showDropdown: false, otherCategory: '',
    },
    {
      id: 2, merchant: 'COLMADO DON RAMON', amount: 430, currency: 'dop', rdEquiv: 430,
      suggestions: ['Alimentación', 'Restaurantes'], selected: null, status: 'pending',
      saving: false, showDropdown: false, otherCategory: '',
    },
  ];

  excluded: ExcludedLine[] = [
    { id: 1, reason: 'Pago a tarjeta',   merchant: 'PAGO BHD',              amount: 15000 },
    { id: 2, reason: 'Puntos / rewards', merchant: 'BONO PUNTOS MASTERCARD', amount:    0 },
  ];

  budgetComparison = [
    { name: '3010 Alimentación',    budget: 12300, actual: 7035  },
    { name: '3020 Transporte',      budget:  3100, actual:  620  },
    { name: '3030 Entretenimiento', budget:  2500, actual: 1652  },
    { name: '3040 Gasolina',        budget:  3000, actual: 2100  },
  ];

  // ── Credit card computed ────────────────────────────────────────────
  get rdTotal(): number {
    return this._rawLines.filter(l => !l.isExcluded && l.currency === 'RD').reduce((s, l) => s + l.amount, 0);
  }
  get usdTotal(): number {
    return this._rawLines.filter(l => !l.isExcluded && l.currency === 'USD').reduce((s, l) => s + l.amount, 0);
  }
  get ccTotalFees(): number {
    return this._rawLines.filter(l => l.isPayment && l.currency === 'RD').reduce((s, l) => s + l.amount, 0);
  }
  get usdRdEquiv(): number {
    return Math.round(this.usdTotal * this.consolidationRate);
  }

  private fmt(v: number, prefix: string): string {
    return prefix + v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  get rdTotalFormatted():           string { return this.fmt(this.rdTotal, 'RD$'); }
  get usdTotalFormatted():          string { return this.fmt(this.usdTotal, 'US$'); }
  get ccTotalFeesFormatted():       string { return this.fmt(this.ccTotalFees, 'RD$'); }
  get usdRdEquivFormatted():        string { return 'RD$' + this.usdRdEquiv.toLocaleString(); }
  get consolidatedTotalFormatted(): string { return this.fmt(this.rdTotal + this.usdRdEquiv, 'RD$'); }

  // ── Parsed notice ───────────────────────────────────────────────────
  get parsedNoticeTitle(): string {
    if (!this.statementDate) return 'Corte procesado';
    const [y, m] = this.statementDate.split('-');
    return `Corte ${MONTHS_ES[+m - 1]} ${y} procesado`;
  }
  get parsedNoticeSubtitle(): string {
    const blocks = new Set(this._rawLines.map(l => l.currency)).size || 2;
    const total  = this._rawLines.length || 24;
    return `Se detectaron ${blocks} ${blocks === 1 ? 'bloque' : 'bloques'} de moneda · ${total} líneas`;
  }
  // ── Pending count ───────────────────────────────────────────────────
  get pendingNewMerchants(): number {
    return this.newMerchants.filter(m => m.status === 'pending').length;
  }

  // ── Account options and category names from API ─────────────────────
  get accountOptions(): AccountSummaryResponse[] {
    const type = this.flow === 'credit-card' ? 'LIABILITY' : 'ASSET';
    return this.acctSvc.accounts().filter(a => a.type === type && !a.loanAccount);
  }

  get categories(): string[] {
    const names = this.acctSvc.accounts().filter(a => a.type === 'EXPENSE').map(a => a.name ?? '').filter(Boolean);
    return names.length > 0 ? names : ['Alimentación', 'Transporte', 'Entretenimiento', 'Salud',
      'Servicios del hogar', 'Ropa y calzado', 'Tecnología', 'Educación', 'Gasolina', 'Farmacia', 'Restaurantes', 'Otro'];
  }

  private get expenseAccountsByName(): Map<string, number> {
    const map = new Map<string, number>();
    for (const a of this.acctSvc.accounts().filter(a => a.type === 'EXPENSE')) {
      if (a.name && a.id) map.set(a.name, a.id);
    }
    return map;
  }

  get canUpload(): boolean {
    return this.selectedAccountId !== null && this.statementDate !== '';
  }


  // ── Lifecycle ───────────────────────────────────────────────────────
  ngOnInit(): void {
    if (this.acctSvc.accounts().length === 0) {
      this.acctSvc.load().subscribe();
    }
    this.loadHistory();
  }

  private loadHistory(): void {
    this.http.get<StatementImportSummaryResponse[]>(`${this.rootUrl}/api/v1/statement-imports`)
      .pipe(timeout(TIMEOUT_MS))
      .subscribe({
        next: list => {
          const toSummary = (i: StatementImportSummaryResponse): ImportSummary => ({
            id:              i.id!,
            accountName:     i.accountName ?? '',
            statementDate:   i.statementDate ?? '',
            status:          i.status as ImportStatus,
            unresolvedCount: i.unresolvedCount ?? 0,
            lineCount:       i.lineCount ?? 0,
          });
          this.pendingImports = list
            .filter(i => i.status === 'PENDING_REVIEW')
            .map(toSummary);
          this.historyImports = list
            .filter(i => i.status === 'CONFIRMED' || i.status === 'REVERSED' || i.status === 'FAILED')
            .map(toSummary);
        },
      });
  }

  // ── Actions ─────────────────────────────────────────────────────────
  triggerFileInput(): void {
    if (!this.canUpload) return;
    this.fileInputRef?.nativeElement.click();
  }

  onFileSelected(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file || !this.selectedAccountId || !this.statementDate) return;

    this.uploading    = true;
    this.uploadError  = '';
    this._uploadStart = Date.now();

    const form = new FormData();
    form.append('file', file);
    form.append('accountId', String(this.selectedAccountId));
    form.append('type', this.flow === 'credit-card' ? 'CREDIT_CARD' : 'SAVINGS');
    form.append('statementDate', this.statementDate);

    this.http.post<any>(`${this.rootUrl}/api/v1/statement-imports`, form)
      .pipe(timeout(TIMEOUT_MS))
      .subscribe({
        next: res => {
          this._afterMinSpinner(() => {
            this.importId = res.id;
            if (res.status === 'FAILED') {
              this.uploadError = res.errorMessage ?? 'No se pudo procesar el archivo.';
              this.loadHistory();
            } else {
              this._rawLines = res.lines ?? [];
              this._populateLists();
              this.parsed = true;
              this.loadHistory();
            }
          });
        },
        error: (err: HttpErrorResponse | TimeoutError) => {
          this._afterMinSpinner(() => {
            if (err instanceof TimeoutError) {
              this.uploadError = 'La solicitud tardó demasiado. Verifica tu conexión.';
            } else if ((err as HttpErrorResponse).status === 409) {
              this.uploadError = 'Ya existe un corte confirmado para esta cuenta y fecha.';
            } else {
              this.uploadError = (err as HttpErrorResponse).error?.message ?? 'Error al subir el archivo.';
            }
          });
        },
      });
  }

  private _afterMinSpinner(then: () => void): void {
    const remaining = MIN_UPLOAD_SPINNER_MS - (Date.now() - this._uploadStart);
    const finish = () => { this.uploading = false; then(); };
    if (remaining <= 0) finish();
    else setTimeout(finish, remaining);
  }

  private _afterMinSave(id: number, then: () => void): void {
    const remaining = MIN_MERCHANT_SAVE_MS - (Date.now() - (this._merchantSaveStart.get(id) ?? 0));
    if (remaining <= 0) then();
    else setTimeout(then, remaining);
  }

  private _populateLists(): void {
    const rate = this.consolidationRate;
    const expNames = this.categories;
    const suggestions = expNames.slice(0, 2);

    this.categorized = this._rawLines
      .filter(l => !l.isExcluded && l.categoryAccountId != null)
      .map(l => ({
        id:       l.id,
        merchant: l.description,
        category: l.categoryAccountName ?? '',
        currency: l.currency === 'RD' ? 'dop' as const : 'usd' as const,
        amount:   l.amount,
        rate:     l.currency === 'USD' ? rate : null,
        rdEquiv:  l.currency === 'RD' ? l.amount : Math.round(l.amount * rate),
      }));

    this.newMerchants = this._rawLines
      .filter(l => !l.isExcluded && l.categoryAccountId == null)
      .map(l => ({
        id:           l.id,
        merchant:     l.description,
        amount:       l.amount,
        currency:     l.currency === 'RD' ? 'dop' as const : 'usd' as const,
        rdEquiv:      l.currency === 'RD' ? l.amount : Math.round(l.amount * rate),
        suggestions,
        selected:     null,
        status:       'pending' as const,
        saving:       false,
        showDropdown: false,
        otherCategory: expNames[0] ?? '',
      }));

    this.excluded = this._rawLines
      .filter(l => l.isExcluded)
      .map(l => ({
        id:       l.id,
        reason:   l.isPayment ? 'Pago detectado automáticamente' : 'Excluida manualmente',
        merchant: l.description,
        amount:   l.amount,
      }));
  }

  resolveNewMerchant(id: number, categoryName: string): void {
    const m = this.newMerchants.find(x => x.id === id);
    if (!m || !categoryName) return;

    m.selected     = categoryName;
    m.status       = 'resolved';
    m.saving       = true;
    m.showDropdown = false;
    this._merchantSaveStart.set(id, Date.now());

    const categoryAccountId = this.expenseAccountsByName.get(categoryName);
    if (!categoryAccountId) { this._afterMinSave(id, () => { m.saving = false; }); return; }

    this.http.patch<any>(`${this.rootUrl}/api/v1/statement-lines/${id}`, { categoryAccountId })
      .pipe(timeout(TIMEOUT_MS))
      .subscribe({
        next:  () => { this._afterMinSave(id, () => { m.saving = false; }); },
        error: () => {
          this._afterMinSave(id, () => {
            m.saving   = false;
            m.status   = 'pending';
            m.selected = null;
          });
        },
      });
  }

  excludeLine(id: number): void {
    const idx = this.newMerchants.findIndex(m => m.id === id);
    if (idx === -1) return;
    const [m] = this.newMerchants.splice(idx, 1);
    this.excluded.push({ id: m.id, reason: 'Excluida manualmente', merchant: m.merchant, amount: m.rdEquiv });

    this.http.patch<any>(`${this.rootUrl}/api/v1/statement-lines/${id}`, { isExcluded: true })
      .pipe(timeout(TIMEOUT_MS))
      .subscribe({
        error: () => {
          this.excluded.pop();
          this.newMerchants.splice(idx, 0, m);
        },
      });
  }

  confirm(): void {
    if (!this.importId) {
      this.confirmed = true;
      return;
    }

    this.confirming = true;
    this.http.post<any>(`${this.rootUrl}/api/v1/statement-imports/${this.importId}/confirm`, {})
      .pipe(timeout(TIMEOUT_MS))
      .subscribe({
        next: res => {
          this.confirming    = false;
          this.postedEntries = res.postedEntries ?? 0;
          this.confirmed     = true;
          this.loadHistory();
        },
        error: (err: HttpErrorResponse | TimeoutError) => {
          this.confirming = false;
          if (err instanceof TimeoutError) {
            this.confirmError = 'La solicitud tardó demasiado. Verifica tu conexión.';
          } else if ((err as HttpErrorResponse).status === 422) {
            const unresolvedIds = new Set<number>((err as HttpErrorResponse).error?.lineIds ?? []);
            this.newMerchants
              .filter(m => unresolvedIds.has(m.id))
              .forEach(m => { m.status = 'pending'; });
            this.confirmError = 'Hay líneas sin categorizar. Resuélvelas antes de confirmar.';
          } else {
            this.confirmError = (err as HttpErrorResponse).error?.message ?? 'Error al registrar el corte. Intenta de nuevo.';
          }
        },
      });
  }

  // ── History helpers ─────────────────────────────────────────────────
  formatImportDate(yearMonth: string): string {
    const [y, m] = yearMonth.split('-');
    return `${MONTHS_ES[+m - 1]} ${y}`;
  }

  statusLabel(status: ImportStatus): string {
    const labels: Record<ImportStatus, string> = {
      PENDING_REVIEW: 'En proceso',
      CONFIRMED:      'Confirmado',
      REVERSED:       'Revertido',
      FAILED:         'Fallido',
    };
    return labels[status];
  }

  statusChipClass(status: ImportStatus): string {
    const classes: Record<ImportStatus, string> = {
      PENDING_REVIEW: 'bg-amber-100 text-amber-700',
      CONFIRMED:      'bg-green-100 text-income',
      REVERSED:       'bg-gray-100 text-gray-500',
      FAILED:         'bg-red-100 text-red-600',
    };
    return classes[status];
  }

  resumeImport(imp: ImportSummary): void {
    this.uploading = true;
    this.uploadError = '';
    this._uploadStart = Date.now();

    this.http.get<any>(`${this.rootUrl}/api/v1/statement-imports/${imp.id}`)
      .pipe(timeout(TIMEOUT_MS))
      .subscribe({
        next: res => {
          this._afterMinSpinner(() => {
            this.flow             = res.type === 'CREDIT_CARD' ? 'credit-card' : 'savings';
            this.importId         = res.id;
            this.statementDate    = res.statementDate ?? '';
            this.selectedAccountId = res.accountId ?? null;
            this._rawLines        = res.lines ?? [];
            this._populateLists();
            this.parsed = true;
          });
        },
        error: () => {
          this._afterMinSpinner(() => {
            this.uploadError = 'No se pudo cargar el corte. Intenta de nuevo.';
          });
        },
      });
  }

  // ── Shared ──────────────────────────────────────────────────────────
  formatRD(v: number): string { return 'RD$' + v.toLocaleString(); }

  usdConversionLabel(line: CategorizedLine): string {
    return 'US$' + line.amount + ' × ' + line.rate + ' = ' + this.formatRD(line.rdEquiv);
  }

  reset(): void {
    this.parsed        = false;
    this.confirmed     = false;
    this.uploading     = false;
    this.confirming    = false;
    this.uploadError   = '';
    this.confirmError  = '';
    this.importId      = null;
    this._rawLines     = [];
    this.postedEntries = 0;
    this.newMerchants.forEach(m => {
      m.status       = 'pending';
      m.selected     = null;
      m.saving       = false;
      m.showDropdown = false;
    });
    this.showCategorized = false;
    this.showExcluded    = false;
    this.showHistory     = false;
  }
}
