import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { map } from 'rxjs';
import { ApiConfiguration } from '../../../../api/api-configuration';
import { getLoan } from '../../../../api/fn/loans/get-loan';
import { collectInstallment } from '../../../../api/fn/loans/collect-installment';
import { LoanDetailResponse } from '../../../../api/models/loan-detail-response';
import { LoanScheduleDocComponent, ScheduleDocRow } from './loan-schedule-doc';

type PrincipalMode = 'reduce-term' | 'reduce-installment';

interface AmortizationRow {
  num:      number;
  interest: number;
  principal: number;
  balance:  number;
  current:  boolean;
}

// Received loan mock data ("2020 Préstamo carro")
const RECV = {
  P:          350_000,
  r:          0.03,
  n:          24,
  pmt:        20_667,
  currentNum: 9,
};

@Component({
  selector: 'app-financing',
  imports: [FormsModule, LoanScheduleDocComponent],
  host: { class: 'block' },
  template: `
    <div class="flex flex-col gap-5">

      <!-- Header -->
      <div class="flex items-start justify-between gap-4">
        <div>
          <p class="text-xs font-semibold text-gray-400 uppercase tracking-wide">
            {{ isGiven ? 'Activo · Préstamo otorgado' : 'Pasivo · Préstamo' }}
          </p>
          <h1 class="text-2xl font-bold text-gray-900 mt-0.5">{{ accountName }}</h1>
        </div>
        <span class="text-2xl font-bold text-gray-900 shrink-0">{{ balanceFormatted }}</span>
      </div>

      <!-- Progress bar -->
      <div class="flex flex-col gap-1.5">
        <div class="h-2 bg-gray-100 rounded-full overflow-hidden">
          <div class="h-full rounded-full bg-income transition-all" [style.width]="progressPercent + '%'"></div>
        </div>
        <p class="text-xs text-gray-500">{{ progressCaption }}</p>
      </div>

      <!-- Stat cards -->
      <div class="grid grid-cols-3 gap-3">
        <div class="rounded-xl border border-gray-200 bg-white px-3 py-3 flex flex-col gap-0.5">
          <p class="text-xs text-gray-400">Capital original</p>
          <p class="text-sm font-semibold text-gray-900">{{ principalFormatted }}</p>
        </div>
        <div class="rounded-xl border border-gray-200 bg-white px-3 py-3 flex flex-col gap-0.5">
          <p class="text-xs text-gray-400">{{ isGiven ? 'Tasa' : 'Tasa mensual' }}</p>
          <p class="text-sm font-semibold text-gray-900">{{ rateLabel }}</p>
        </div>
        <div class="rounded-xl border border-gray-200 bg-white px-3 py-3 flex flex-col gap-0.5">
          <p class="text-xs text-gray-400">{{ isGiven ? 'Cuota semanal' : 'Cuota mensual' }}</p>
          <p class="text-sm font-semibold text-gray-900">{{ installmentFormatted }}</p>
        </div>
      </div>

      <!-- Received: payment stats -->
      @if (!isGiven) {
        <div class="rounded-xl border border-gray-200 bg-white px-4 py-4 flex flex-col gap-3">
          <div class="flex items-center justify-between">
            <span class="text-sm text-gray-600">Total pagado</span>
            <span class="text-sm font-semibold text-gray-900">{{ totalPaidFormatted }}</span>
          </div>
          <div class="flex gap-4 pt-2 border-t border-gray-100">
            <div class="flex-1">
              <p class="text-xs text-gray-400 mb-0.5">Intereses pagados</p>
              <p class="text-sm font-semibold text-expense">{{ interestPaidFormatted }}</p>
            </div>
            <div class="w-px bg-gray-100"></div>
            <div class="flex-1">
              <p class="text-xs text-gray-400 mb-0.5">Capital amortizado</p>
              <p class="text-sm font-semibold text-income">{{ principalPaidFormatted }}</p>
            </div>
          </div>
        </div>
      }

      <!-- Given: collected stats -->
      @if (isGiven && loan) {
        <div class="rounded-xl border border-gray-200 bg-white px-4 py-4 flex gap-4">
          <div class="flex-1">
            <p class="text-xs text-gray-400 mb-0.5">Cobrado a la fecha</p>
            <p class="text-sm font-semibold text-income">{{ collectedFormatted }}</p>
          </div>
          <div class="w-px bg-gray-100"></div>
          <div class="flex-1">
            <p class="text-xs text-gray-400 mb-0.5">Por cobrar</p>
            <p class="text-sm font-semibold text-gray-900">{{ remainingFormatted }}</p>
          </div>
        </div>
      }

      <!-- Expandable schedule/amortization -->
      <div class="rounded-xl border border-gray-200 bg-white overflow-hidden">
        <button type="button" (click)="showSchedule = !showSchedule"
          class="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors">
          <span class="text-sm font-medium text-gray-700">
            {{ isGiven ? 'Cronograma de cuotas' : 'Tabla de amortización' }}
          </span>
          <svg class="w-4 h-4 text-gray-400 transition-transform" [class.rotate-180]="showSchedule"
            viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path stroke="none" d="M0 0h24v24H0z" fill="none"/>
            <path d="M6 9l6 6l6 -6" />
          </svg>
        </button>

        @if (showSchedule) {

          @if (!isGiven) {
            <div class="border-t border-gray-100 divide-y divide-gray-50">
              @for (row of visibleAmortization; track row.num) {
                <div class="flex items-center gap-3 px-4 py-3" [class.bg-brand-50]="row.current">
                  <div class="shrink-0">
                    @if (row.num < currentNum) {
                      <svg class="w-4 h-4 text-income" viewBox="0 0 24 24" fill="currentColor">
                        <path stroke="none" d="M0 0h24v24H0z" fill="none"/>
                        <path d="M17 3.34a10 10 0 1 1 -14.995 8.984l-.005 -.324l.005 -.324a10 10 0 0 1 14.995 -8.336zm-1.293 5.953a1 1 0 0 0 -1.32 -.083l-.094 .083l-3.293 3.292l-1.293 -1.292l-.094 -.083a1 1 0 0 0 -1.403 1.403l.083 .094l2 2l.094 .083a1 1 0 0 0 1.226 0l.094 -.083l4 -4l.083 -.094a1 1 0 0 0 -.083 -1.32z" fill="currentColor" />
                      </svg>
                    } @else {
                      <svg class="w-4 h-4 text-gray-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                        <path stroke="none" d="M0 0h24v24H0z" fill="none"/>
                        <path d="M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0 -18 0" />
                      </svg>
                    }
                  </div>
                  <div class="flex-1 min-w-0">
                    <p class="text-sm text-gray-700">Cuota {{ row.num }}</p>
                    <p class="text-xs text-gray-400">{{ formatRD(row.interest) }} interés · {{ formatRD(row.principal) }} capital</p>
                  </div>
                  <span class="text-sm font-medium shrink-0"
                    [class.text-income]="row.num < currentNum"
                    [class.text-gray-400]="row.num > currentNum"
                    [class.text-gray-900]="row.num === currentNum">
                    {{ formatRD(row.interest + row.principal) }}
                  </span>
                  @if (row.current) {
                    <button type="button" (click)="registerPayment()"
                      class="shrink-0 px-2.5 py-1 text-xs font-medium text-white bg-brand-600 rounded-lg hover:bg-brand-700 transition-colors">
                      Pagar
                    </button>
                  }
                </div>
              }
              <div class="px-4 py-3 flex items-center justify-between">
                @if (!showFullSchedule) {
                  <button type="button" (click)="showFullSchedule = true"
                    class="text-xs font-medium text-brand-600 hover:text-brand-700">
                    Ver todas las cuotas ({{ amortization.length }})
                  </button>
                } @else {
                  <span></span>
                }
                <button type="button" (click)="showSchedule = false; showPrincipalPayment = true"
                  class="text-xs text-gray-400 hover:text-gray-600 transition-colors">
                  Abono a capital
                </button>
              </div>
            </div>
          }

          @if (isGiven) {
            <div class="border-t border-gray-100 divide-y divide-gray-50">
              @for (row of scheduleRows; track row.num) {
                <div class="flex items-center gap-3 px-4 py-3" [class.bg-brand-50]="row.next">
                  <div class="shrink-0">
                    @if (row.paid) {
                      <svg class="w-4 h-4 text-income" viewBox="0 0 24 24" fill="currentColor">
                        <path stroke="none" d="M0 0h24v24H0z" fill="none"/>
                        <path d="M17 3.34a10 10 0 1 1 -14.995 8.984l-.005 -.324l.005 -.324a10 10 0 0 1 14.995 -8.336zm-1.293 5.953a1 1 0 0 0 -1.32 -.083l-.094 .083l-3.293 3.292l-1.293 -1.292l-.094 -.083a1 1 0 0 0 -1.403 1.403l.083 .094l2 2l.094 .083a1 1 0 0 0 1.226 0l.094 -.083l4 -4l.083 -.094a1 1 0 0 0 -.083 -1.32z" fill="currentColor" />
                      </svg>
                    } @else {
                      <svg class="w-4 h-4 text-gray-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                        <path stroke="none" d="M0 0h24v24H0z" fill="none"/>
                        <path d="M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0 -18 0" />
                      </svg>
                    }
                  </div>
                  <div class="flex-1 min-w-0">
                    <p class="text-sm text-gray-700">Cuota {{ row.num }} &middot; {{ row.date }}</p>
                  </div>
                  <span class="text-sm font-medium shrink-0"
                    [class.text-income]="row.paid"
                    [class.text-gray-400]="!row.paid && !row.next"
                    [class.text-gray-900]="row.next">
                    {{ formatRD(row.amount) }}
                  </span>
                  @if (row.next) {
                    <button type="button" (click)="markCollected(row.num)"
                      class="shrink-0 px-2.5 py-1 text-xs font-medium text-white bg-income rounded-lg hover:opacity-90 transition-opacity">
                      Cobrar
                    </button>
                  }
                </div>
              }
            </div>
          }

        }
      </div>

      @if (isGiven && loan) {
        <button type="button"
          class="w-full py-2.5 text-sm font-medium text-white rounded-xl transition-colors flex items-center justify-center gap-2 hover:opacity-90"
          style="background-color: #25D366;"
          (click)="showScheduleDoc = true">
          <svg class="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z"/>
          </svg>
          Generar documento WhatsApp
        </button>
      }

      <!-- Loan schedule doc (given loan) -->
      @if (isGiven && showScheduleDoc && loan) {
        <app-loan-schedule-doc
          [borrowerName]="loan.counterpartyName ?? ''"
          [principal]="loan.principal ?? 0"
          [total]="loan.totalAmount ?? 0"
          [rows]="scheduleDocRows"
          (close)="showScheduleDoc = false"
        />
      }

      <!-- Principal payment sub-step (received only) -->
      @if (!isGiven && showPrincipalPayment) {
        <div class="rounded-xl border border-gray-200 bg-white p-5 flex flex-col gap-4">

          <div class="flex items-center justify-between">
            <h2 class="text-base font-semibold text-gray-900">Abono a capital</h2>
            <button type="button" (click)="showPrincipalPayment = false"
              class="text-sm text-gray-400 hover:text-gray-600">Cancelar</button>
          </div>

          <div class="flex flex-col gap-1.5">
            <label class="text-sm font-medium text-gray-700">Monto del abono</label>
            <div class="relative">
              <span class="absolute inset-y-0 left-3 flex items-center text-sm text-gray-400 pointer-events-none">RD&#36;</span>
              <input type="number" [(ngModel)]="principalAmount" min="0"
                (ngModelChange)="onPrincipalAmountChange()"
                placeholder="0"
                class="w-full pl-10 pr-3 py-2 text-sm border border-gray-300 rounded-lg placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-300 focus:border-brand-400"/>
            </div>
          </div>

          <div class="flex flex-col gap-1.5">
            <label class="text-sm font-medium text-gray-700">Fecha</label>
            <input type="date" [(ngModel)]="principalDate"
              class="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-300 focus:border-brand-400"/>
          </div>

          <div class="flex flex-col gap-2">
            <label class="text-sm font-medium text-gray-700">Efecto del abono</label>
            <label class="flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors"
              [class.border-brand-400]="principalMode === 'reduce-term'"
              [class.bg-brand-50]="principalMode === 'reduce-term'"
              [class.border-gray-200]="principalMode !== 'reduce-term'">
              <input type="radio" name="principalMode" value="reduce-term"
                [(ngModel)]="principalMode" (ngModelChange)="onPrincipalAmountChange()"
                class="mt-0.5 accent-brand-600"/>
              <div>
                <p class="text-sm font-medium text-gray-800">Reducir plazo</p>
                <p class="text-xs text-gray-500">Misma cuota mensual, terminas antes.</p>
              </div>
            </label>
            <label class="flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors"
              [class.border-brand-400]="principalMode === 'reduce-installment'"
              [class.bg-brand-50]="principalMode === 'reduce-installment'"
              [class.border-gray-200]="principalMode !== 'reduce-installment'">
              <input type="radio" name="principalMode" value="reduce-installment"
                [(ngModel)]="principalMode" (ngModelChange)="onPrincipalAmountChange()"
                class="mt-0.5 accent-brand-600"/>
              <div>
                <p class="text-sm font-medium text-gray-800">Reducir cuota</p>
                <p class="text-xs text-gray-500">Mismo plazo restante, cuota mensual mas baja.</p>
              </div>
            </label>
          </div>

          @if (principalAmount > 0 && impactReady) {
            <div class="rounded-lg bg-gray-50 border border-gray-100 px-4 py-3">
              <p class="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Impacto estimado</p>
              @if (principalMode === 'reduce-term') {
                <p class="text-sm text-gray-700">{{ impactReduceTermText }}</p>
              } @else {
                <p class="text-sm text-gray-700">{{ impactReduceInstallmentText }}</p>
              }
            </div>
          }

          <button type="button" (click)="confirmPrincipalPayment()"
            [disabled]="principalAmount <= 0"
            class="w-full py-2.5 text-sm font-medium text-white bg-brand-600 rounded-xl hover:bg-brand-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
            Confirmar abono
          </button>

        </div>
      }

    </div>
  `,
})
export class FinancingComponent implements OnInit {
  private readonly http    = inject(HttpClient);
  private readonly rootUrl = inject(ApiConfiguration).rootUrl;

  constructor(private route: ActivatedRoute) {}

  loan: LoanDetailResponse | null = null;
  isGiven = false;
  private accountId = 0;

  currentNum           = RECV.currentNum;
  showSchedule         = false;
  showFullSchedule     = false;
  showPrincipalPayment = false;
  showScheduleDoc      = false;

  principalAmount: number = 0;
  principalDate:  string  = new Date().toISOString().substring(0, 10);
  principalMode: PrincipalMode = 'reduce-term';
  impactReady = false;
  impactReduceTermText        = '';
  impactReduceInstallmentText = '';

  ngOnInit(): void {
    const id = this.route.snapshot.queryParamMap.get('id');
    const type = this.route.snapshot.queryParamMap.get('type');
    if (id && type !== 'received') {
      this.isGiven = true;
      this.accountId = +id;
      this.loadLoan();
    } else {
      this.isGiven = false;
      this.showSchedule = true;
    }
  }

  private loadLoan(): void {
    getLoan(this.http, this.rootUrl, { accountId: this.accountId }).pipe(map(r => r.body!)).subscribe(loan => {
      this.loan = loan;
    });
  }

  markCollected(num: number): void {
    collectInstallment(this.http, this.rootUrl, { accountId: this.accountId, num }).pipe(map(r => r.body!)).subscribe(loan => {
      this.loan = loan;
    });
  }

  // ── Given loan derived data ─────────────────────────────────────────
  get scheduleRows(): Array<{ num: number; date: string; amount: number; paid: boolean; next: boolean }> {
    if (!this.loan?.installments) return [];
    const paidCount = this.loan.paidInstallments ?? 0;
    return (this.loan.installments).map((inst, idx) => ({
      num:    inst.number ?? idx + 1,
      date:   this.formatScheduleDate(inst.scheduledDate ?? ''),
      amount: inst.scheduledAmount ?? 0,
      paid:   inst.status === 'PAID',
      next:   idx === paidCount,
    }));
  }

  get scheduleDocRows(): ScheduleDocRow[] {
    return this.scheduleRows.map(r => ({
      num:    r.num,
      date:   r.date,
      amount: r.amount,
      paid:   r.paid,
    }));
  }

  get accountName(): string {
    return this.isGiven ? (this.loan?.counterpartyName ?? '…') : '2020 Préstamo carro';
  }

  get balanceFormatted(): string {
    if (this.isGiven) return 'RD$' + ((this.loan?.remainingBalance ?? 0)).toLocaleString();
    const balance = this.currentNum <= 1 ? RECV.P : (this.amortization[this.currentNum - 2]?.balance ?? RECV.P);
    return 'RD$' + balance.toLocaleString();
  }

  get progressPercent(): number {
    if (this.isGiven && this.loan) {
      const total = this.loan.totalInstallments ?? 1;
      return Math.round(((this.loan.paidInstallments ?? 0) / total) * 100);
    }
    return Math.round((this.currentNum / RECV.n) * 100);
  }

  get progressCaption(): string {
    if (this.isGiven && this.loan) {
      return this.progressPercent + '% cobrado · ' + (this.loan.paidInstallments ?? 0) + ' de ' + (this.loan.totalInstallments ?? 0) + ' cuotas';
    }
    return this.progressPercent + '% pagado · ' + this.currentNum + ' de ' + RECV.n + ' cuotas';
  }

  get principalFormatted(): string {
    if (this.isGiven) return 'RD$' + ((this.loan?.principal ?? 0)).toLocaleString();
    return 'RD$' + RECV.P.toLocaleString();
  }

  get rateLabel(): string {
    if (this.isGiven && this.loan) return (this.loan.frequency === 'WEEKLY' ? '' : '') + '% plana';
    return '3% mensual';
  }

  get installmentFormatted(): string {
    if (this.isGiven) return 'RD$' + ((this.loan?.installmentAmount ?? 0)).toLocaleString();
    return 'RD$' + RECV.pmt.toLocaleString();
  }

  get collectedFormatted(): string {
    if (!this.loan) return 'RD$0';
    const collected = (this.loan.totalAmount ?? 0) - (this.loan.remainingBalance ?? 0);
    return 'RD$' + Math.max(0, collected).toLocaleString();
  }

  get remainingFormatted(): string {
    return 'RD$' + ((this.loan?.remainingBalance ?? 0)).toLocaleString();
  }

  formatRD(value: number): string { return 'RD$' + value.toLocaleString(); }

  private formatScheduleDate(iso: string): string {
    if (!iso) return '';
    const [y, m, d] = iso.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    const days   = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
    const months = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
    return `${days[date.getDay()]} ${d}/${months[m - 1]}/${y}`;
  }

  // ── Received loan amortization ──────────────────────────────────────
  amortization: AmortizationRow[] = this.buildAmortization();

  private buildAmortization(): AmortizationRow[] {
    const { P, r, n, pmt } = RECV;
    const rows: AmortizationRow[] = [];
    let balance = P;
    for (let i = 1; i <= n; i++) {
      const interest  = Math.round(balance * r);
      const principal = Math.round(pmt - interest);
      balance = Math.max(0, Math.round(balance - principal));
      rows.push({ num: i, interest, principal, balance, current: i === this.currentNum });
    }
    return rows;
  }

  get visibleAmortization(): AmortizationRow[] {
    if (this.showFullSchedule) return this.amortization;
    const start = Math.max(0, this.currentNum - 3);
    const end   = Math.min(this.amortization.length, this.currentNum + 3);
    return this.amortization.slice(start, end);
  }

  get totalPaid(): number    { return this.amortization.slice(0, this.currentNum - 1).reduce((s, r) => s + r.interest + r.principal, 0); }
  get interestPaid(): number { return this.amortization.slice(0, this.currentNum - 1).reduce((s, r) => s + r.interest, 0); }
  get principalPaid(): number{ return this.amortization.slice(0, this.currentNum - 1).reduce((s, r) => s + r.principal, 0); }

  get totalPaidFormatted():     string { return 'RD$' + this.totalPaid.toLocaleString(); }
  get interestPaidFormatted():  string { return 'RD$' + this.interestPaid.toLocaleString(); }
  get principalPaidFormatted(): string { return 'RD$' + this.principalPaid.toLocaleString(); }

  registerPayment(): void {
    if (this.currentNum >= RECV.n) return;
    const cur = this.amortization.find(r => r.num === this.currentNum);
    if (cur) cur.current = false;
    this.currentNum++;
    const next = this.amortization.find(r => r.num === this.currentNum);
    if (next) next.current = true;
  }

  // ── Principal payment impact ────────────────────────────────────────
  onPrincipalAmountChange(): void {
    this.impactReady = false;
    if (!this.principalAmount || this.principalAmount <= 0) return;
    const balance = this.currentNum <= 1 ? RECV.P : (this.amortization[this.currentNum - 2]?.balance ?? RECV.P);
    const newBalance = balance - this.principalAmount;
    if (newBalance <= 0) return;
    const r   = RECV.r;
    const pmt = RECV.pmt;
    const remainingInstallments = RECV.n - this.currentNum;
    if (this.principalMode === 'reduce-term') {
      const n_new       = Math.ceil(-Math.log(1 - (newBalance * r) / pmt) / Math.log(1 + r));
      const saved       = Math.max(0, remainingInstallments - n_new);
      const savedInterest = Math.max(0, Math.round(saved * pmt - this.principalAmount));
      this.impactReduceTermText = 'Con este abono terminarías ' + saved + ' cuotas antes' +
        (savedInterest > 0 ? ' y ahorrarías aprox. RD$' + savedInterest.toLocaleString() + ' en intereses.' : '.');
    } else {
      const newPmt = Math.round(newBalance * r / (1 - Math.pow(1 + r, -remainingInstallments)));
      const saving = Math.max(0, pmt - newPmt);
      this.impactReduceInstallmentText = 'Tu nueva cuota mensual sería RD$' + newPmt.toLocaleString() +
        (saving > 0 ? ', ahorrando RD$' + saving.toLocaleString() + ' por mes.' : '.');
    }
    this.impactReady = true;
  }

  confirmPrincipalPayment(): void {
    if (this.principalAmount <= 0) return;
    this.showPrincipalPayment = false;
    this.principalAmount = 0;
    this.impactReady = false;
  }
}
