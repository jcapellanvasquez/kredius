import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink, ActivatedRoute } from '@angular/router';

type LoanType     = 'received' | 'given';
type PrincipalMode = 'reduce-term' | 'reduce-installment';

interface AmortizationRow {
  num:      number;
  interest: number;
  principal: number;
  balance:  number;
  current:  boolean;
}

interface ScheduleRow {
  num:    number;
  date:   string;
  amount: number;
  paid:   boolean;
  next:   boolean;
}

// Loan parameters (received — "2020 Préstamo carro")
const RECV = {
  P:          350_000,
  r:          0.03,
  n:          24,
  pmt:        20_667,
  currentNum: 9,
  balance:    246_727,
  totalPaid:  186_003,
  interestPaid: 82_730,
  principalPaid: 103_273,
};

// Loan parameters (given — "Emeli Espinal")
const GIVEN = {
  principal:    30_000,
  rate:         20,
  total:        36_000,
  installment:  3_000,
  totalRows:    12,
  paidCount:    4,
  collected:    12_000,
  remaining:    24_000,
};

@Component({
  selector: 'app-financing',
  imports: [FormsModule, RouterLink],
  host: { class: 'block' },
  template: `
    <div class="flex flex-col gap-5">

      <!-- Back to detail -->
      <a [routerLink]="['../detail']"
        class="inline-flex items-center gap-1.5 text-sm text-brand-600 hover:text-brand-700 w-fit">
        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5"/>
        </svg>
        Detalle de cuenta
      </a>

      <!-- Header -->
      <div class="flex items-start justify-between gap-4">
        <div>
          <p class="text-xs font-semibold text-gray-400 uppercase tracking-wide">
            {{ loanType === 'received' ? 'Pasivo · Préstamo' : 'Activo · Préstamo otorgado' }}
          </p>
          <h1 class="text-2xl font-bold text-gray-900 mt-0.5">{{ accountName }}</h1>
        </div>
        <span class="text-2xl font-bold text-gray-900 shrink-0">{{ balanceFormatted }}</span>
      </div>

      <!-- Progress bar -->
      <div class="flex flex-col gap-1.5">
        <div class="h-2 bg-gray-100 rounded-full overflow-hidden">
          <div
            class="h-full rounded-full transition-all"
            [class.bg-brand-500]="loanType === 'received'"
            [class.bg-income]="loanType === 'given'"
            [style.width]="progressPercent + '%'"
          ></div>
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
          <p class="text-xs text-gray-400">{{ loanType === 'received' ? 'Tasa mensual' : 'Tasa' }}</p>
          <p class="text-sm font-semibold text-gray-900">{{ rateLabel }}</p>
        </div>
        <div class="rounded-xl border border-gray-200 bg-white px-3 py-3 flex flex-col gap-0.5">
          <p class="text-xs text-gray-400">{{ loanType === 'received' ? 'Cuota mensual' : 'Cuota semanal' }}</p>
          <p class="text-sm font-semibold text-gray-900">{{ installmentFormatted }}</p>
        </div>
      </div>

      <!-- Received: payment stats -->
      @if (loanType === 'received') {
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
      @if (loanType === 'given') {
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
            {{ loanType === 'received' ? 'Tabla de amortización' : 'Cronograma de cuotas' }}
          </span>
          <svg class="w-4 h-4 text-gray-400 transition-transform"
            [class.rotate-180]="showSchedule"
            fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5"/>
          </svg>
        </button>

        @if (showSchedule) {

          @if (loanType === 'received') {
            <div class="border-t border-gray-100 overflow-x-auto">
              <table class="w-full text-xs">
                <thead class="bg-gray-50">
                  <tr>
                    <th class="text-left px-4 py-2 font-medium text-gray-500">#</th>
                    <th class="text-right px-4 py-2 font-medium text-gray-500">Interés</th>
                    <th class="text-right px-4 py-2 font-medium text-gray-500">Capital</th>
                    <th class="text-right px-4 py-2 font-medium text-gray-500">Saldo</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-gray-50">
                  @for (row of visibleAmortization; track row.num) {
                    <tr [class.bg-brand-50]="row.current" [class.font-semibold]="row.current">
                      <td class="px-4 py-2 text-gray-500">
                        {{ row.num }}
                        @if (row.current) { <span class="ml-1 text-brand-500">←</span> }
                      </td>
                      <td class="px-4 py-2 text-right text-expense">{{ formatRD(row.interest) }}</td>
                      <td class="px-4 py-2 text-right text-income">{{ formatRD(row.principal) }}</td>
                      <td class="px-4 py-2 text-right text-gray-700">{{ formatRD(row.balance) }}</td>
                    </tr>
                  }
                </tbody>
              </table>
              @if (!showFullSchedule) {
                <div class="border-t border-gray-100 px-4 py-3 text-center">
                  <button type="button" (click)="showFullSchedule = true"
                    class="text-xs font-medium text-brand-600 hover:text-brand-700">
                    Ver tabla completa ({{ amortization.length }} cuotas)
                  </button>
                </div>
              }
            </div>
          }

          @if (loanType === 'given') {
            <div class="border-t border-gray-100 divide-y divide-gray-50">
              @for (row of schedule; track row.num) {
                <div class="flex items-center gap-3 px-4 py-3"
                  [class.bg-brand-50]="row.next">
                  <div class="shrink-0">
                    @if (row.paid) {
                      <svg class="w-5 h-5 text-income" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"/>
                      </svg>
                    } @else {
                      <svg class="w-5 h-5 text-gray-300" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z"/>
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

      <!-- Action buttons -->
      @if (loanType === 'received' && !showPrincipalPayment) {
        <div class="flex gap-3">
          <button type="button"
            class="flex-1 py-2.5 text-sm font-medium text-white bg-brand-600 rounded-xl hover:bg-brand-700 transition-colors">
            Registrar cuota
          </button>
          <button type="button" (click)="showPrincipalPayment = true"
            class="flex-1 py-2.5 text-sm font-medium text-brand-600 border border-brand-300 rounded-xl hover:bg-brand-50 transition-colors">
            Abono a capital
          </button>
        </div>
      }

      @if (loanType === 'given') {
        <button type="button"
          class="w-full py-2.5 text-sm font-medium text-white rounded-xl transition-colors"
          style="background-color: #25D366;"
          (click)="generateWhatsApp()">
          Generar documento WhatsApp
        </button>
      }

      <!-- Principal payment sub-step (received only) -->
      @if (loanType === 'received' && showPrincipalPayment) {
        <div class="rounded-xl border border-gray-200 bg-white p-5 flex flex-col gap-4">

          <div class="flex items-center justify-between">
            <h2 class="text-base font-semibold text-gray-900">Abono a capital</h2>
            <button type="button" (click)="showPrincipalPayment = false"
              class="text-sm text-gray-400 hover:text-gray-600">Cancelar</button>
          </div>

          <!-- Amount -->
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

          <!-- Date -->
          <div class="flex flex-col gap-1.5">
            <label class="text-sm font-medium text-gray-700">Fecha</label>
            <input type="date" [(ngModel)]="principalDate"
              class="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-300 focus:border-brand-400"/>
          </div>

          <!-- Radio: reduce term vs reduce installment -->
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

          <!-- Impact preview -->
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

          <!-- Confirm -->
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
  loanType: LoanType = 'received';

  constructor(private route: ActivatedRoute) {}

  ngOnInit(): void {
    const type = this.route.snapshot.queryParamMap.get('type');
    if (type === 'given') this.loanType = 'given';
  }

  showSchedule       = false;
  showFullSchedule   = false;
  showPrincipalPayment = false;

  principalAmount: number = 0;
  principalDate:  string  = new Date().toISOString().substring(0, 10);
  principalMode: PrincipalMode = 'reduce-term';
  impactReady = false;

  // ── Received loan data ──────────────────────────────────────────────
  get accountName(): string {
    return this.loanType === 'received' ? '2020 Préstamo carro' : 'Emeli Espinal';
  }

  get balanceFormatted(): string {
    return this.loanType === 'received'
      ? 'RD$' + RECV.balance.toLocaleString()
      : 'RD$' + GIVEN.remaining.toLocaleString();
  }

  get progressPercent(): number {
    return this.loanType === 'received'
      ? Math.round((RECV.currentNum / RECV.n) * 100)
      : Math.round((GIVEN.paidCount / GIVEN.totalRows) * 100);
  }

  get progressCaption(): string {
    if (this.loanType === 'received') {
      return this.progressPercent + '% pagado · ' + RECV.currentNum + ' de ' + RECV.n + ' cuotas';
    }
    return this.progressPercent + '% cobrado · ' + GIVEN.paidCount + ' de ' + GIVEN.totalRows + ' cuotas';
  }

  get principalFormatted(): string {
    return this.loanType === 'received'
      ? 'RD$' + RECV.P.toLocaleString()
      : 'RD$' + GIVEN.principal.toLocaleString();
  }

  get rateLabel(): string {
    return this.loanType === 'received' ? '3% mensual' : GIVEN.rate + '%';
  }

  get installmentFormatted(): string {
    return this.loanType === 'received'
      ? 'RD$' + RECV.pmt.toLocaleString()
      : 'RD$' + GIVEN.installment.toLocaleString();
  }

  get totalPaidFormatted(): string    { return 'RD$' + RECV.totalPaid.toLocaleString(); }
  get interestPaidFormatted(): string { return 'RD$' + RECV.interestPaid.toLocaleString(); }
  get principalPaidFormatted(): string { return 'RD$' + RECV.principalPaid.toLocaleString(); }
  get collectedFormatted(): string    { return 'RD$' + GIVEN.collected.toLocaleString(); }
  get remainingFormatted(): string    { return 'RD$' + GIVEN.remaining.toLocaleString(); }

  formatRD(value: number): string {
    return 'RD$' + value.toLocaleString();
  }

  // ── Amortization table ──────────────────────────────────────────────
  readonly amortization: AmortizationRow[] = this.buildAmortization();

  private buildAmortization(): AmortizationRow[] {
    const { P, r, n, pmt, currentNum } = RECV;
    const rows: AmortizationRow[] = [];
    let balance = P;

    for (let i = 1; i <= n; i++) {
      const interest  = Math.round(balance * r);
      const principal = Math.round(pmt - interest);
      balance = Math.max(0, Math.round(balance - principal));
      rows.push({ num: i, interest, principal, balance, current: i === currentNum });
    }
    return rows;
  }

  get visibleAmortization(): AmortizationRow[] {
    if (this.showFullSchedule) return this.amortization;
    const idx = RECV.currentNum - 1;
    return this.amortization.slice(idx, idx + 3);
  }

  // ── Given loan schedule ─────────────────────────────────────────────
  readonly schedule: ScheduleRow[] = this.buildSchedule();

  private buildSchedule(): ScheduleRow[] {
    const dates = [
      'vie 1 may 2026',  'vie 8 may 2026',  'vie 15 may 2026',
      'vie 22 may 2026', 'vie 29 may 2026', 'vie 5 jun 2026',
      'vie 12 jun 2026', 'vie 19 jun 2026', 'vie 26 jun 2026',
      'vie 3 jul 2026',  'vie 10 jul 2026', 'vie 17 jul 2026',
    ];
    return dates.map((date, i) => ({
      num:    i + 1,
      date,
      amount: GIVEN.installment,
      paid:   i + 1 <= GIVEN.paidCount,
      next:   i + 1 === GIVEN.paidCount + 1,
    }));
  }

  markCollected(num: number): void {
    const row = this.schedule.find(r => r.num === num);
    if (!row) return;
    row.paid = true;
    row.next = false;
    const nextRow = this.schedule.find(r => r.num === num + 1);
    if (nextRow) nextRow.next = true;
  }

  // ── Principal payment impact ────────────────────────────────────────
  impactReduceTermText        = '';
  impactReduceInstallmentText = '';

  onPrincipalAmountChange(): void {
    this.impactReady = false;
    if (!this.principalAmount || this.principalAmount <= 0) return;

    const newBalance = RECV.balance - this.principalAmount;
    if (newBalance <= 0) return;

    const r   = RECV.r;
    const pmt = RECV.pmt;
    const remainingInstallments = RECV.n - RECV.currentNum;

    if (this.principalMode === 'reduce-term') {
      const n_new   = Math.ceil(-Math.log(1 - (newBalance * r) / pmt) / Math.log(1 + r));
      const saved   = Math.max(0, remainingInstallments - n_new);
      const savedInterest = Math.max(0, Math.round(saved * pmt - this.principalAmount));
      this.impactReduceTermText =
        'Con este abono terminarías ' + saved + ' cuotas antes' +
        (savedInterest > 0 ? ' y ahorrarías aprox. RD$' + savedInterest.toLocaleString() + ' en intereses.' : '.');
    } else {
      const newPmt = Math.round(newBalance * r / (1 - Math.pow(1 + r, -remainingInstallments)));
      const saving  = Math.max(0, pmt - newPmt);
      this.impactReduceInstallmentText =
        'Tu nueva cuota mensual sería RD$' + newPmt.toLocaleString() +
        (saving > 0 ? ', ahorrando RD$' + saving.toLocaleString() + ' por mes.' : '.');
    }

    this.impactReady = true;
  }

  confirmPrincipalPayment(): void {
    if (this.principalAmount <= 0) return;
    this.showPrincipalPayment = false;
    this.principalAmount = 0;
    this.impactReady = false;
    // TODO: wire to API
  }

  generateWhatsApp(): void {
    // TODO: render loan-schedule-doc and share
  }
}
