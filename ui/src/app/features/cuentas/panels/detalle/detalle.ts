import { Component, ElementRef, ViewChild, AfterViewInit, OnDestroy } from '@angular/core';
import { FormsModule } from '@angular/forms';
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

@Component({
  selector: 'app-detalle',
  imports: [FormsModule],
  host: { class: 'block' },
  template: `
    <div class="flex flex-col gap-5">

      <!-- Header -->
      <div class="flex items-start justify-between">
        <div>
          <p class="text-xs font-medium text-gray-400 uppercase tracking-wide">Pasivo</p>
          <h1 class="text-2xl font-bold text-gray-900 mt-0.5">2010 Tarjeta de crédito</h1>
        </div>
        <span class="text-3xl font-bold text-expense">RD$60,000</span>
      </div>

      <!-- Trend chart -->
      <div class="rounded-xl border border-gray-200 bg-white p-4">
        <div class="flex items-center justify-between mb-3">
          <h2 class="text-sm font-semibold text-gray-700">Tendencia (6 meses)</h2>
          <span class="inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-1 text-xs font-medium text-expense">
            <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" d="M2.25 18 9 11.25l4.306 4.306a11.95 11.95 0 0 1 5.814-5.518l2.74-1.22m0 0-5.94-2.281m5.94 2.28-2.28 5.941" />
            </svg>
            Deuda subió
          </span>
        </div>

        <div class="h-40">
          <canvas #trendChart></canvas>
        </div>

        <p class="text-xs text-gray-400 mt-2 leading-relaxed">
          En una cuenta de pasivo, subir significa que la deuda creció; bajar significa que se está pagando.
        </p>
      </div>

      <!-- Concentration alerts card -->
      <div class="rounded-xl border border-gray-200 bg-white p-4">
        <div class="flex items-center gap-1.5 mb-4">
          <h2 class="text-sm font-semibold text-gray-800">Alertas de concentración</h2>
          <button type="button" class="text-gray-400 hover:text-gray-500" title="Más información">
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" d="m11.25 11.25.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z" />
            </svg>
          </button>
        </div>

        <div class="flex items-center justify-between py-3 border-t border-gray-100">
          <span class="text-sm text-gray-600">Umbral del ingreso mensual</span>
          <input
            type="number"
            [(ngModel)]="threshold"
            class="w-16 rounded-md border border-gray-300 px-2 py-1 text-sm text-right text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
          />
        </div>

        <div class="flex items-center justify-between py-3 border-t border-gray-100">
          <span class="text-sm text-gray-600">Mostrar en alertas</span>
          <label class="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              class="sr-only peer"
              [(ngModel)]="showInAlerts"
            />
            <div class="w-11 h-6 bg-gray-200 rounded-full peer
                        peer-checked:bg-brand-600
                        after:content-[''] after:absolute after:top-0.5 after:left-0.5
                        after:bg-white after:rounded-full after:h-5 after:w-5
                        after:transition-all peer-checked:after:translate-x-5">
            </div>
          </label>
        </div>
      </div>

      <!-- Movements -->
      <div>
        <h2 class="text-sm font-semibold text-gray-800 mb-2">Movimientos</h2>
        <div class="rounded-xl border border-gray-200 bg-white overflow-hidden divide-y divide-gray-100">

          @for (mov of visibleMovements; track mov.id) {
            <div class="flex items-center justify-between px-4 py-3">
              <span class="text-sm text-gray-600">{{ mov.date }} · {{ mov.description }}</span>
              <span class="text-sm font-medium text-expense">{{ mov.amount }}</span>
            </div>
          }

          <div class="px-4 py-3 text-center">
            @if (hasMore) {
              <button
                type="button"
                class="text-sm font-medium text-brand-600 hover:text-brand-700"
                (click)="loadMore()"
              >
                Ver más movimientos
              </button>
            } @else {
              <p class="text-xs text-gray-400">No hay más movimientos</p>
            }
          </div>
        </div>
      </div>

    </div>
  `,
})
export class DetalleComponent implements AfterViewInit, OnDestroy {
  @ViewChild('trendChart') private canvasRef!: ElementRef<HTMLCanvasElement>;
  private chart?: Chart;

  threshold = 15;
  showInAlerts = true;

  private readonly allMovements = [
    { id:  1, date: '14 oct', description: 'Ocho santos - brugal',       amount: '-RD$795' },
    { id:  2, date: '13 oct', description: 'Comida y limpieza',           amount: '-RD$1,762' },
    { id:  3, date: '10 oct', description: 'Plaza Valerio',               amount: '-RD$346' },
    { id:  4, date: '9 oct',  description: 'Gasolina Texaco',             amount: '-RD$2,100' },
    { id:  5, date: '8 oct',  description: 'Netflix',                     amount: '-RD$599' },
    { id:  6, date: '7 oct',  description: 'Supermercado Nacional',       amount: '-RD$3,480' },
    { id:  7, date: '6 oct',  description: 'Farmacia Carol',              amount: '-RD$890' },
    { id:  8, date: '5 oct',  description: 'Restaurante El Mesón',        amount: '-RD$1,240' },
    { id:  9, date: '4 oct',  description: 'Agua y luz',                  amount: '-RD$4,200' },
    { id: 10, date: '3 oct',  description: 'Uber Eats',                   amount: '-RD$680' },
    { id: 11, date: '2 oct',  description: 'Tienda Giga',                 amount: '-RD$5,300' },
    { id: 12, date: '1 oct',  description: 'Spotify',                     amount: '-RD$349' },
    { id: 13, date: '30 sep', description: 'La Sirena',                   amount: '-RD$2,875' },
    { id: 14, date: '29 sep', description: 'Claro móvil',                 amount: '-RD$1,500' },
    { id: 15, date: '28 sep', description: 'Gasolina Sunix',              amount: '-RD$1,950' },
    { id: 16, date: '27 sep', description: 'Colmado Don Ramón',           amount: '-RD$430' },
    { id: 17, date: '26 sep', description: 'Amazon',                      amount: '-RD$3,120' },
    { id: 18, date: '25 sep', description: 'Peluquería Moderna',          amount: '-RD$600' },
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
    const labels   = ['abr', 'may', 'jun', 'jul', 'ago', 'sep',];
    const values   = [40000, 42000, 47000, 45000, 43000, 60000,];
    const lastIdx  = values.length - 1;

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
              label: ctx => `RD$${(ctx.raw as number).toLocaleString()}`,
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
              callback: v => v === 0 ? '0' : `${(v as number) / 1000}k`,
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
