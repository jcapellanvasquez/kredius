import { Component, ElementRef, ViewChild, AfterViewInit, OnDestroy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  Chart,
  LineController,
  LineElement,
  PointElement,
  LinearScale,
  CategoryScale,
  Tooltip,
  Filler,
  type ChartConfiguration,
} from 'chart.js';

Chart.register(LineController, LineElement, PointElement, LinearScale, CategoryScale, Tooltip, Filler);

type AccountType = 'asset' | 'liability' | 'expense' | 'income';

@Component({
  selector: 'app-detail',
  imports: [FormsModule, RouterLink],
  host: { class: 'block' },
  template: `
    <div class="flex flex-col gap-5">

      <!-- Header -->
      @if (isMultiCurrency) {
        <div>
          <p class="text-xs font-semibold text-gray-400 uppercase tracking-wide">{{ typeLabel }}</p>
          <h1 class="text-2xl font-bold text-gray-900 mt-0.5">{{ accountName }}</h1>
          <div class="flex gap-3 mt-3">
            <div class="flex-1 rounded-xl border border-gray-200 bg-white px-4 py-3">
              <p class="text-xs text-gray-400 mb-1">Balance en pesos</p>
              <p class="text-xl font-bold text-gray-900">RD$60,000</p>
            </div>
            <div class="flex-1 rounded-xl border border-gray-200 bg-white px-4 py-3">
              <p class="text-xs text-gray-400 mb-1">Balance en dólares</p>
              <p class="text-xl font-bold text-gray-900">US$1,200</p>
            </div>
          </div>
          <p class="text-xs text-gray-400 mt-2">
            &asymp; RD$127,200 estimado (tasa: 59.00) &mdash; cada balance solo se mueve con transacciones en su propia moneda.
          </p>
        </div>
      } @else {
        <div class="flex items-start justify-between">
          <div>
            <p class="text-xs font-semibold text-gray-400 uppercase tracking-wide">{{ typeLabel }}</p>
            <h1 class="text-2xl font-bold text-gray-900 mt-0.5">{{ accountName }}</h1>
          </div>
          <span class="text-3xl font-bold text-gray-900">RD$60,000</span>
        </div>
      }

      <!-- Trend chart (single-currency accounts only) -->
      @if (!isMultiCurrency) {
        <div class="rounded-xl border border-gray-200 bg-white p-4">
          <div class="flex items-center justify-between mb-3">
            <h2 class="text-sm font-semibold text-gray-700">Tendencia (6 meses)</h2>
            <span class="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium"
              [class.bg-red-50]="isNegativeTrend()"
              [class.text-expense]="isNegativeTrend()"
              [class.bg-green-50]="!isNegativeTrend()"
              [class.text-income]="!isNegativeTrend()"
            >
              <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" d="M2.25 18 9 11.25l4.306 4.306a11.95 11.95 0 0 1 5.814-5.518l2.74-1.22m0 0-5.94-2.281m5.94 2.28-2.28 5.941" />
              </svg>
              {{ trendBadgeText }}
            </span>
          </div>

          <div class="h-40">
            <canvas #trendChart></canvas>
          </div>

          <p class="text-xs text-gray-400 mt-2 leading-relaxed">{{ trendCaption }}</p>
        </div>
      }

      <!-- Alerts / Concentration (Expense accounts only) -->
      @if (accountType === 'expense') {
        <div class="rounded-xl border border-gray-200 bg-white p-4">
          <div class="flex items-center gap-1.5 mb-4">
            <h2 class="text-sm font-semibold text-gray-800">Alertas de concentraci&oacute;n</h2>
            <button type="button" class="text-gray-400 hover:text-gray-500"
              title="El porcentaje siempre se calcula. Este switch solo controla si la cuenta aparece resaltada en el panel de alertas cuando supera el umbral.">
              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" d="m11.25 11.25.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z" />
              </svg>
            </button>
          </div>

          <div class="flex items-center justify-between py-3 border-t border-gray-100">
            <div>
              <span class="text-sm text-gray-600">Umbral del ingreso mensual</span>
              <p class="text-xs text-gray-400 mt-0.5">{{ thresholdHint }}</p>
            </div>
            <div class="flex items-center gap-1">
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

          <div class="flex items-center justify-between py-3 border-t border-gray-100">
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

      <!-- Financing entry point (loan accounts only) -->
      @if (hasLoan) {
        <a [routerLink]="['../financing']"
          class="flex items-center justify-between px-4 py-3 rounded-xl border border-brand-200 bg-brand-50 hover:bg-brand-100 transition-colors cursor-pointer">
          <div class="flex items-center gap-3">
            <div class="w-8 h-8 rounded-lg bg-brand-100 flex items-center justify-center shrink-0">
              <svg class="w-4 h-4 text-brand-600" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" d="M2.25 18.75a60.07 60.07 0 0 1 15.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 0 1 3 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 0 0-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 0 1-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 0 0 3 15h-.75M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm3 0h.008v.008H18V10.5Zm-12 0h.008v.008H6V10.5Z" />
              </svg>
            </div>
            <div>
              <p class="text-sm font-medium text-brand-700">Ver amortizaci&oacute;n y realizar pagos</p>
              <p class="text-xs text-brand-500">Tabla de cuotas, abonos a capital y m&aacute;s</p>
            </div>
          </div>
          <svg class="w-4 h-4 text-brand-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" d="m9 18 6-6-6-6"/>
          </svg>
        </a>
      }

      <!-- Movements -->
      <div>
        <h2 class="text-sm font-semibold text-gray-800 mb-2">Movimientos</h2>
        <div class="rounded-xl border border-gray-200 bg-white overflow-hidden divide-y divide-gray-100">

          @for (mov of visibleMovements; track mov.id) {
            <div class="flex items-center justify-between px-4 py-3">
              <span class="text-sm text-gray-600">{{ mov.date }} &middot; {{ mov.description }}</span>
              <span class="text-sm font-medium" [class.text-income]="mov.inflow" [class.text-expense]="!mov.inflow">
                {{ mov.amount }}
              </span>
            </div>
          }

          <div class="px-4 py-3 text-center">
            @if (hasMore) {
              <button type="button" class="text-sm font-medium text-brand-600 hover:text-brand-700" (click)="loadMore()">
                Ver m&aacute;s movimientos
              </button>
            } @else {
              <p class="text-xs text-gray-400">No hay m&aacute;s movimientos</p>
            }
          </div>
        </div>
      </div>

    </div>
  `,
})
export class DetailComponent implements AfterViewInit, OnDestroy {
  @ViewChild('trendChart') private canvasRef!: ElementRef<HTMLCanvasElement>;
  private chart?: Chart;

  readonly accountType: AccountType = 'liability';
  readonly accountName = '2010 Tarjeta de crédito';
  readonly isMultiCurrency = false;
  readonly hasLoan = true;

  threshold = 15;
  showInAlerts = true;

  get typeLabel(): string {
    const labels: Record<AccountType, string> = {
      asset: 'Activo', liability: 'Pasivo', expense: 'Gasto', income: 'Ingreso',
    };
    return labels[this.accountType];
  }

  isNegativeTrend(): boolean {
    return this.accountType === 'liability' || this.accountType === 'expense';
  }

  get trendBadgeText(): string {
    return this.isNegativeTrend() ? 'Deuda subió' : 'Ahorros subieron';
  }

  get trendCaption(): string {
    if (this.accountType === 'liability') {
      return 'En una cuenta de pasivo, subir significa que la deuda creció; bajar significa que se está pagando.';
    }
    if (this.accountType === 'expense') {
      return 'En una cuenta de gasto, subir significa que el gasto aumentó respecto al mes anterior.';
    }
    return 'En una cuenta de activo, subir significa que el saldo creció; bajar significa retiros o pagos.';
  }

  get thresholdHint(): string {
    const amount = Math.round(85000 * (this.threshold / 100)).toLocaleString();
    return '≈ RD$' + amount + ' (basado en ingresos de oct: RD$85,000)';
  }

  private readonly allMovements = [
    { id:  1, date: '14 oct', description: 'Ocho santos - brugal',   amount: '-RD$795',   inflow: false },
    { id:  2, date: '13 oct', description: 'Comida y limpieza',       amount: '-RD$1,762', inflow: false },
    { id:  3, date: '10 oct', description: 'Plaza Valerio',           amount: '-RD$346',   inflow: false },
    { id:  4, date: '9 oct',  description: 'Gasolina Texaco',         amount: '-RD$2,100', inflow: false },
    { id:  5, date: '8 oct',  description: 'Netflix',                 amount: '-RD$599',   inflow: false },
    { id:  6, date: '7 oct',  description: 'Supermercado Nacional',   amount: '-RD$3,480', inflow: false },
    { id:  7, date: '6 oct',  description: 'Farmacia Carol',          amount: '-RD$890',   inflow: false },
    { id:  8, date: '5 oct',  description: 'Restaurante El Mesón',    amount: '-RD$1,240', inflow: false },
    { id:  9, date: '4 oct',  description: 'Agua y luz',              amount: '-RD$4,200', inflow: false },
    { id: 10, date: '3 oct',  description: 'Uber Eats',               amount: '-RD$680',   inflow: false },
    { id: 11, date: '2 oct',  description: 'Tienda Giga',             amount: '-RD$5,300', inflow: false },
    { id: 12, date: '1 oct',  description: 'Spotify',                 amount: '-RD$349',   inflow: false },
    { id: 13, date: '30 sep', description: 'La Sirena',               amount: '-RD$2,875', inflow: false },
    { id: 14, date: '29 sep', description: 'Claro móvil',             amount: '-RD$1,500', inflow: false },
    { id: 15, date: '28 sep', description: 'Gasolina Sunix',          amount: '-RD$1,950', inflow: false },
    { id: 16, date: '27 sep', description: 'Colmado Don Ramón',       amount: '-RD$430',   inflow: false },
    { id: 17, date: '26 sep', description: 'Amazon',                  amount: '-RD$3,120', inflow: false },
    { id: 18, date: '25 sep', description: 'Peluquería Moderna',      amount: '-RD$600',   inflow: false },
  ];

  private visibleCount = 5;
  private readonly loadMoreSize = 10;

  get visibleMovements() {
    return this.allMovements.slice(0, this.visibleCount);
  }

  get hasMore(): boolean {
    return this.visibleCount < this.allMovements.length;
  }

  loadMore(): void {
    this.visibleCount = Math.min(this.visibleCount + this.loadMoreSize, this.allMovements.length);
  }

  ngAfterViewInit(): void {
    if (this.isMultiCurrency || !this.canvasRef) return;

    const labels  = ['abr', 'may', 'jun', 'jul', 'ago', 'sep'];
    const values  = [40000, 42000, 47000, 45000, 43000, 60000];
    const lastIdx = values.length - 1;

    const monthNames: Record<string, string> = {
      abr: 'Abril', may: 'Mayo', jun: 'Junio',
      jul: 'Julio', ago: 'Agosto', sep: 'Septiembre',
    };

    const pointBg     = values.map((_, i) => i === lastIdx ? '#ef4444' : '#ffffff');
    const pointBorder = values.map((_, i) => i === lastIdx ? '#ef4444' : '#9ca3af');
    const pointRadius = values.map((_, i) => i === lastIdx ? 5 : 4);

    const config: ChartConfiguration<'line'> = {
      type: 'line',
      data: {
        labels,
        datasets: [{
          data: values,
          borderColor: '#9ca3af',
          borderWidth: 2,
          pointBackgroundColor: pointBg,
          pointBorderColor: pointBorder,
          pointBorderWidth: 2,
          pointRadius,
          pointHoverRadius: pointRadius,
          tension: 0,
          fill: false,
          clip: false,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        layout: { padding: { top: 8 } },
        plugins: {
          legend: { display: false },
          tooltip: {
            displayColors: false,
            callbacks: {
              title: ctx => monthNames[ctx[0].label] ?? ctx[0].label,
              label: ctx => 'RD$' + (ctx.raw as number).toLocaleString(),
            },
          },
        },
        scales: {
          x: {
            grid: { display: false },
            border: { display: false },
            ticks: { color: '#9ca3af', font: { size: 11, family: 'inherit' } },
          },
          y: {
            min: 0,
            max: 60000,
            grid: { color: '#e5e7eb' },
            border: { display: false },
            ticks: {
              color: '#9ca3af',
              font: { size: 11, family: 'inherit' },
              stepSize: 20000,
              callback: v => v === 0 ? '0' : ((v as number) / 1000) + 'k',
            },
          },
        },
      },
    };

    this.chart = new Chart(this.canvasRef.nativeElement, config);
  }

  ngOnDestroy(): void {
    this.chart?.destroy();
  }
}
