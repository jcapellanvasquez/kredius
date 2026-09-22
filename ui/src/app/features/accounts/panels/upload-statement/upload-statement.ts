import { Component, inject, signal, computed, ElementRef, ViewChild, OnInit } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { timeout, TimeoutError } from 'rxjs';
import { AccountApiService } from '../../account-api.service';
import { ApiConfiguration } from '../../../../api/api-configuration';
import { AccountSummaryResponse } from '../../../../api/models/account-summary-response';

type UploadState = 'idle' | 'uploading' | 'pending_review' | 'failed' | 'duplicate' | 'confirming' | 'confirmed';
type PatchState  = 'idle' | 'saving' | 'saved' | 'error';
type FlowType    = 'credit-card' | 'savings';

interface StatementLine {
  id: number;
  lineDate: string;
  description: string;
  currency: 'RD' | 'USD';
  amount: number;
  isExcluded: boolean;
  isPayment: boolean;
  categoryAccountId: number | null;
  categoryAccountName: string | null;
}

interface LineVm extends StatementLine {
  patchState: PatchState;
  highlighted: boolean;
  pendingCategoryId: number | null;
}

const TIMEOUT_MS = 15_000;

@Component({
  selector: 'app-upload-statement',
  imports: [FormsModule, DecimalPipe],
  host: { class: 'block' },
  template: `
    <div class="flex flex-col gap-5">

      <!-- Header -->
      <div>
        <h1 class="text-2xl font-bold text-gray-900">Subir corte</h1>
        <p class="text-sm text-gray-400 mt-0.5">Carga y categoriza tu estado de cuenta.</p>
      </div>

      <!-- ── IDLE / FORM ─────────────────────────────────────────── -->
      @if (uploadState() === 'idle' || uploadState() === 'duplicate') {

        <!-- Flow tabs -->
        <div class="flex gap-2">
          <button type="button" (click)="setFlow('credit-card')"
            class="flex-1 py-2.5 text-sm font-medium rounded-xl transition-colors"
            [class.bg-brand-600]="flow() === 'credit-card'" [class.text-white]="flow() === 'credit-card'"
            [class.bg-brand-50]="flow() !== 'credit-card'"  [class.text-brand-800]="flow() !== 'credit-card'">
            Tarjeta de crédito
          </button>
          <button type="button" (click)="setFlow('savings')"
            class="flex-1 py-2.5 text-sm font-medium rounded-xl transition-colors"
            [class.bg-brand-600]="flow() === 'savings'" [class.text-white]="flow() === 'savings'"
            [class.bg-brand-50]="flow() !== 'savings'"  [class.text-brand-800]="flow() !== 'savings'">
            Cuenta de ahorros
          </button>
        </div>

        <!-- Account selector -->
        <div class="flex flex-col gap-1.5">
          <label class="text-xs font-semibold text-gray-500 uppercase tracking-wide">Cuenta</label>
          <select [(ngModel)]="selectedAccountId"
            class="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-brand-300">
            <option [ngValue]="null" disabled>Selecciona una cuenta...</option>
            @for (acc of accountOptions(); track acc.id) {
              <option [ngValue]="acc.id">{{ acc.name }}</option>
            }
          </select>
        </div>

        <!-- Statement date -->
        <div class="flex flex-col gap-1.5">
          <label class="text-xs font-semibold text-gray-500 uppercase tracking-wide">Fecha del corte</label>
          <input type="date" [(ngModel)]="statementDate"
            class="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-brand-300"/>
        </div>

        <!-- Duplicate conflict notice -->
        @if (uploadState() === 'duplicate') {
          <div class="rounded-xl border border-amber-200 bg-amber-50 px-4 py-4 flex flex-col gap-2">
            <p class="text-sm font-semibold text-amber-800">Ya existe un corte confirmado para esta cuenta y fecha.</p>
            <p class="text-xs text-amber-700">Puedes continuar de todas formas — se creará un nuevo corte independiente.</p>
            <div class="flex gap-2 mt-1">
              <button type="button" (click)="uploadState.set('idle')"
                class="px-3 py-1.5 text-xs font-medium rounded-lg bg-white border border-amber-300 text-amber-800 hover:bg-amber-100 transition-colors">
                Cancelar
              </button>
              <button type="button" (click)="triggerFileInput()"
                class="px-3 py-1.5 text-xs font-medium rounded-lg bg-amber-600 text-white hover:bg-amber-700 transition-colors">
                Continuar de todas formas
              </button>
            </div>
          </div>
        }

        <!-- Upload zone -->
        @if (uploadState() === 'idle') {
          <div class="rounded-xl border-2 border-dashed border-gray-300 bg-white px-6 py-10 flex flex-col items-center gap-3 hover:border-brand-300 hover:bg-brand-50 transition-colors"
            [class.cursor-pointer]="canUpload()"
            [class.opacity-50]="!canUpload()"
            (click)="canUpload() && triggerFileInput()">
            <svg class="w-[22px] h-[22px] text-brand-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path stroke="none" d="M0 0h24v24H0z" fill="none"/>
              <path d="M14 3v4a1 1 0 0 0 1 1h4"/>
              <path d="M17 21h-10a2 2 0 0 1 -2 -2v-14a2 2 0 0 1 2 -2h7l5 5v11a2 2 0 0 1 -2 2z"/>
              <path d="M12 11v6"/><path d="M9.5 13.5l2.5 -2.5l2.5 2.5"/>
            </svg>
            <div class="text-center">
              <p class="text-sm font-medium text-gray-700">Haz clic para seleccionar el archivo</p>
              <p class="text-xs text-gray-400 mt-0.5">PDF · máx. 20 MB</p>
            </div>
            <span class="px-4 py-1.5 text-xs font-medium text-brand-800 bg-brand-50 rounded-full">
              Seleccionar archivo
            </span>
          </div>
          <input #fileInput type="file" accept=".pdf" class="hidden" (change)="onFileSelected($event)"/>
        }
      }

      <!-- ── UPLOADING SPINNER ───────────────────────────────────── -->
      @if (uploadState() === 'uploading') {
        <div class="flex flex-col items-center gap-4 py-16">
          <div class="w-10 h-10 border-4 border-brand-200 border-t-brand-600 rounded-full animate-spin"></div>
          <p class="text-sm font-medium text-gray-600">Subiendo y procesando estado de cuenta...</p>
          <p class="text-xs text-gray-400">Esto puede tardar unos segundos</p>
        </div>
      }

      <!-- ── FAILED ─────────────────────────────────────────────── -->
      @if (uploadState() === 'failed') {
        <div class="rounded-xl border border-red-200 bg-red-50 px-4 py-5 flex flex-col gap-3">
          <p class="text-sm font-semibold text-red-800">No se pudo procesar el archivo</p>
          <p class="text-xs text-red-700">{{ errorMessage() }}</p>
          <button type="button" (click)="reset()"
            class="self-start px-4 py-1.5 text-xs font-medium rounded-lg bg-white border border-red-300 text-red-700 hover:bg-red-100 transition-colors">
            Intentar con otro archivo
          </button>
        </div>
      }

      <!-- ── PENDING REVIEW ─────────────────────────────────────── -->
      @if (uploadState() === 'pending_review' || uploadState() === 'confirming') {

        <!-- Parsed notice -->
        <div class="flex items-center gap-3 rounded-xl border border-green-200 bg-green-50 px-4 py-3">
          <svg class="w-5 h-5 text-green-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"/>
          </svg>
          <div>
            <p class="text-sm font-medium text-green-800">{{ selectedFileName() }} procesado</p>
            <p class="text-xs text-green-600">{{ lines().length }} líneas detectadas</p>
          </div>
          <button type="button" (click)="reset()" class="ml-auto text-xs text-green-600 hover:text-green-800 shrink-0">
            Cambiar archivo
          </button>
        </div>

        <!-- Uncategorized lines (amber) -->
        @if (uncategorized().length > 0) {
          <div class="rounded-xl border border-amber-200 bg-amber-50 overflow-hidden">
            <div class="flex items-center gap-2 px-4 py-3 border-b border-amber-100">
              <svg class="w-4 h-4 text-amber-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"/>
              </svg>
              <span class="text-sm font-medium text-amber-800">Sin categoría</span>
              <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-200 text-amber-800">
                {{ uncategorized().length }}
              </span>
            </div>
            <div class="divide-y divide-amber-100">
              @for (line of uncategorized(); track line.id) {
                <div class="px-4 py-3 flex flex-col gap-2"
                  [class.ring-2]="line.highlighted"
                  [class.ring-red-400]="line.highlighted"
                  [class.ring-inset]="line.highlighted">
                  <div class="flex items-center justify-between gap-3">
                    <div class="flex-1 min-w-0">
                      <p class="text-sm font-medium text-gray-800 font-mono truncate">{{ line.description }}</p>
                      <p class="text-xs text-gray-500">{{ line.lineDate }} · {{ line.currency }} {{ line.amount | number:'1.2-2' }}</p>
                    </div>
                    @if (line.patchState === 'saving') {
                      <div class="w-4 h-4 border-2 border-brand-300 border-t-brand-600 rounded-full animate-spin shrink-0"></div>
                    } @else if (line.patchState === 'saved') {
                      <svg class="w-4 h-4 text-green-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"/>
                      </svg>
                    } @else if (line.patchState === 'error') {
                      <span class="text-xs text-red-500 shrink-0">Error</span>
                    }
                  </div>
                  <select [ngModel]="line.pendingCategoryId"
                    (ngModelChange)="patchCategory(line, $event)"
                    [disabled]="line.patchState === 'saving'"
                    class="w-full rounded-lg border border-amber-200 bg-white px-2 py-1.5 text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-brand-300">
                    <option [ngValue]="null" disabled>Selecciona categoría...</option>
                    @for (acc of expenseAccounts(); track acc.id) {
                      <option [ngValue]="acc.id">{{ acc.name }}</option>
                    }
                    <option [ngValue]="-1">Excluir línea</option>
                  </select>
                </div>
              }
            </div>
          </div>
        }

        <!-- Categorized (collapsible) -->
        <div class="rounded-xl border border-gray-200 bg-white overflow-hidden">
          <button type="button" (click)="showCategorized.set(!showCategorized())"
            class="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors">
            <div class="flex items-center gap-2">
              <span class="text-sm font-medium text-gray-700">Categorizadas</span>
              <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                {{ categorized().length }}
              </span>
            </div>
            <svg class="w-4 h-4 text-gray-400 transition-transform" [class.rotate-180]="showCategorized()"
              viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path stroke="none" d="M0 0h24v24H0z" fill="none"/>
              <path d="M6 9l6 6l6 -6"/>
            </svg>
          </button>
          @if (showCategorized()) {
            <div class="border-t border-gray-100 divide-y divide-gray-50">
              @for (line of categorized(); track line.id) {
                <div class="px-4 py-3 flex items-center gap-3">
                  <div class="flex-1 min-w-0">
                    <p class="text-sm text-gray-800 truncate">{{ line.description }}</p>
                    <p class="text-xs text-gray-400 mt-0.5">{{ line.lineDate }}</p>
                  </div>
                  <span class="shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-brand-50 text-brand-800">
                    {{ line.categoryAccountName }}
                  </span>
                  <span class="shrink-0 text-sm font-medium text-gray-700">
                    {{ line.currency }} {{ line.amount | number:'1.2-2' }}
                  </span>
                </div>
              }
            </div>
          }
        </div>

        <!-- Excluded (collapsible) -->
        <div class="rounded-xl border border-gray-200 bg-white overflow-hidden">
          <button type="button" (click)="showExcluded.set(!showExcluded())"
            class="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors">
            <div class="flex items-center gap-2">
              <span class="text-sm font-medium text-gray-700">Excluidas</span>
              <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500">
                {{ excluded().length }}
              </span>
            </div>
            <svg class="w-4 h-4 text-gray-400 transition-transform" [class.rotate-180]="showExcluded()"
              viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path stroke="none" d="M0 0h24v24H0z" fill="none"/>
              <path d="M6 9l6 6l6 -6"/>
            </svg>
          </button>
          @if (showExcluded()) {
            <div class="border-t border-gray-100 divide-y divide-gray-50">
              @for (line of excluded(); track line.id) {
                <div class="px-4 py-3 flex items-center justify-between gap-3">
                  <div class="flex-1 min-w-0">
                    <p class="text-sm text-gray-500 truncate">{{ line.description }}</p>
                    <p class="text-xs text-gray-400 mt-0.5">{{ line.lineDate }}</p>
                  </div>
                  <span class="text-sm text-gray-400">{{ line.currency }} {{ line.amount | number:'1.2-2' }}</span>
                </div>
              }
            </div>
          }
        </div>

        <!-- Confirm button -->
        <button type="button" (click)="confirm()"
          [disabled]="uncategorized().length > 0 || uploadState() === 'confirming'"
          class="w-full py-3 text-sm font-semibold text-white bg-brand-600 rounded-xl hover:bg-brand-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
          {{ uncategorized().length > 0
            ? 'Categoriza todas las líneas para continuar'
            : 'Confirmar y registrar corte' }}
        </button>
      }

      <!-- ── CONFIRMING OVERLAY ──────────────────────────────────── -->
      @if (uploadState() === 'confirming') {
        <div class="fixed inset-0 z-50 flex flex-col items-center justify-center bg-white/90 backdrop-blur-sm gap-4">
          <div class="w-12 h-12 border-4 border-brand-200 border-t-brand-600 rounded-full animate-spin"></div>
          <p class="text-base font-semibold text-gray-700">Registrando asientos contables...</p>
          <p class="text-sm text-gray-400">No cierres esta pantalla</p>
        </div>
      }

      <!-- ── CONFIRMED ───────────────────────────────────────────── -->
      @if (uploadState() === 'confirmed') {
        <div class="flex flex-col items-center gap-3 rounded-xl border border-green-200 bg-green-50 px-4 py-8">
          <svg class="w-10 h-10 text-green-600" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"/>
          </svg>
          <p class="text-base font-semibold text-green-800">Corte registrado</p>
          <p class="text-sm text-green-600 text-center">
            {{ postedEntries() }} transacciones importadas a la contabilidad.
          </p>
          <button type="button" (click)="reset()"
            class="mt-2 px-4 py-1.5 text-xs font-medium text-brand-800 bg-brand-50 rounded-full hover:bg-brand-100 transition-colors">
            Subir otro corte
          </button>
        </div>
      }

    </div>
  `,
})
export class UploadStatementComponent implements OnInit {
  @ViewChild('fileInput') private fileInputRef!: ElementRef<HTMLInputElement>;

  private readonly http        = inject(HttpClient);
  private readonly rootUrl     = inject(ApiConfiguration).rootUrl;
  private readonly accountsSvc = inject(AccountApiService);
  private readonly router      = inject(Router);

  // ── State ──────────────────────────────────────────────────────────
  readonly uploadState   = signal<UploadState>('idle');
  readonly flow          = signal<FlowType>('credit-card');
  readonly showCategorized = signal(false);
  readonly showExcluded    = signal(false);
  readonly errorMessage  = signal('');
  readonly postedEntries = signal(0);
  readonly selectedFileName = signal('');

  selectedAccountId: number | null = null;
  statementDate = '';

  private importId: number | null = null;
  private readonly _lines = signal<LineVm[]>([]);

  // ── Computed ───────────────────────────────────────────────────────
  readonly lines = this._lines.asReadonly();

  readonly uncategorized = computed(() =>
    this._lines().filter(l => !l.isExcluded && l.categoryAccountId === null)
  );
  readonly categorized = computed(() =>
    this._lines().filter(l => !l.isExcluded && l.categoryAccountId !== null)
  );
  readonly excluded = computed(() =>
    this._lines().filter(l => l.isExcluded)
  );

  readonly accountOptions = computed(() => {
    const type = this.flow() === 'credit-card' ? 'LIABILITY' : 'ASSET';
    return this.accountsSvc.accounts().filter(a => a.type === type && !a.loanAccount);
  });

  readonly expenseAccounts = computed(() =>
    this.accountsSvc.accounts().filter(a => a.type === 'EXPENSE')
  );

  readonly canUpload = computed(() =>
    this.selectedAccountId !== null && this.statementDate !== ''
  );

  // ── Lifecycle ──────────────────────────────────────────────────────
  ngOnInit(): void {
    if (this.accountsSvc.accounts().length === 0) {
      this.accountsSvc.load().subscribe();
    }
  }

  // ── Actions ────────────────────────────────────────────────────────
  setFlow(flow: FlowType): void {
    this.flow.set(flow);
    this.selectedAccountId = null;
  }

  triggerFileInput(): void {
    this.fileInputRef?.nativeElement.click();
  }

  onFileSelected(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file || !this.selectedAccountId || !this.statementDate) return;

    this.selectedFileName.set(file.name);
    this.uploadState.set('uploading');

    const form = new FormData();
    form.append('file', file);
    form.append('accountId', String(this.selectedAccountId));
    form.append('type', this.flow() === 'credit-card' ? 'CREDIT_CARD' : 'SAVINGS');
    form.append('statementDate', this.statementDate);

    this.http.post<{ id: number; status: string; errorMessage?: string; lines: any[] }>(
      `${this.rootUrl}/api/v1/statement-imports`, form
    ).pipe(timeout(TIMEOUT_MS)).subscribe({
      next: res => {
        this.importId = res.id;
        if (res.status === 'FAILED') {
          this.errorMessage.set(res.errorMessage ?? 'Error desconocido al procesar el archivo.');
          this.uploadState.set('failed');
        } else {
          this._lines.set(res.lines.map(l => ({ ...l, patchState: 'idle', highlighted: false, pendingCategoryId: l.categoryAccountId })));
          this.uploadState.set('pending_review');
        }
      },
      error: (err: HttpErrorResponse) => {
        if (err.status === 409) {
          this.uploadState.set('duplicate');
        } else if (err instanceof TimeoutError) {
          this.errorMessage.set('La solicitud tardó demasiado. Verifica tu conexión e inténtalo de nuevo.');
          this.uploadState.set('failed');
        } else {
          this.errorMessage.set(err.error?.message ?? 'Error al subir el archivo.');
          this.uploadState.set('failed');
        }
      },
    });
  }

  patchCategory(line: LineVm, categoryId: number | null): void {
    if (categoryId === null) return;

    const exclude  = categoryId === -1;
    const body     = exclude ? { isExcluded: true } : { categoryAccountId: categoryId };

    this._lines.update(lines =>
      lines.map(l => l.id === line.id ? { ...l, patchState: 'saving' } : l)
    );

    this.http.patch<any>(`${this.rootUrl}/api/v1/statement-lines/${line.id}`, body)
      .pipe(timeout(TIMEOUT_MS))
      .subscribe({
        next: updated => {
          this._lines.update(lines =>
            lines.map(l => l.id === line.id
              ? { ...l, ...updated, patchState: 'saved', highlighted: false, pendingCategoryId: updated.categoryAccountId }
              : l
            )
          );
        },
        error: () => {
          this._lines.update(lines =>
            lines.map(l => l.id === line.id ? { ...l, patchState: 'error' } : l)
          );
        },
      });
  }

  confirm(): void {
    if (!this.importId) return;
    this.uploadState.set('confirming');

    this.http.post<{ id: number; status: string; postedEntries: number }>(
      `${this.rootUrl}/api/v1/statement-imports/${this.importId}/confirm`, {}
    ).pipe(timeout(TIMEOUT_MS)).subscribe({
      next: res => {
        this.postedEntries.set(res.postedEntries ?? 0);
        this.uploadState.set('confirmed');
      },
      error: (err: HttpErrorResponse) => {
        this.uploadState.set('pending_review');
        if (err.status === 422 && err.error?.lineIds) {
          const ids = new Set<number>(err.error.lineIds);
          this._lines.update(lines =>
            lines.map(l => ({ ...l, highlighted: ids.has(l.id) }))
          );
        } else if (err instanceof TimeoutError) {
          this.errorMessage.set('La confirmación tardó demasiado. Intenta de nuevo.');
        }
      },
    });
  }

  reset(): void {
    this.uploadState.set('idle');
    this.importId = null;
    this._lines.set([]);
    this.selectedFileName.set('');
    this.errorMessage.set('');
    this.postedEntries.set(0);
    this.showCategorized.set(false);
    this.showExcluded.set(false);
    if (this.fileInputRef) this.fileInputRef.nativeElement.value = '';
  }
}
