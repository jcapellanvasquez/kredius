import {
  Component,
  ElementRef,
  ViewChild,
  AfterViewInit,
  OnDestroy,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { DecimalPipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
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
import { forkJoin, timer } from 'rxjs';
import { ApiConfiguration } from '../../../../api/api-configuration';
import { getAccountDetail } from '../../../../api/fn/accounts/get-account-detail';
import { getAccountTransactions } from '../../../../api/fn/accounts/get-account-transactions';
import { AccountDetailResponse } from '../../../../api/models/account-detail-response';
import { LoanData } from '../../../../api/models/loan-data';
import { TransactionItem } from '../../../../api/models/transaction-item';

Chart.register(LineController, LineElement, PointElement, LinearScale, CategoryScale, Tooltip, Filler);

type LocalAccountType = 'asset' | 'liability' | 'expense' | 'income' | 'equity';
interface Movement { id: number; date: string; description: string; amount: string; inflow: boolean }

@Component({
  selector: 'app-detail',
  imports: [FormsModule, RouterLink, DecimalPipe],
  host: { class: 'block' },
  templateUrl: './detail.html',
})
export class DetailComponent implements OnInit, AfterViewInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly http = inject(HttpClient);
  private readonly rootUrl = inject(ApiConfiguration).rootUrl;

  @ViewChild('trendChart') private canvasRef!: ElementRef<HTMLCanvasElement>;
  private chart?: Chart;
  private viewReady = false;
  private accountId = 0;
  private currentPage = 0;

  private readonly _detail = signal<AccountDetailResponse | null>(null);
  private readonly _movements = signal<Movement[]>([]);
  private readonly _totalTransactions = signal(0);
  readonly loading = signal(true);
  readonly errorCode = signal<number | null>(null);

  threshold = 15;
  showInAlerts = false;
  readonly isMultiCurrency = false;

  get balance(): number { return this._detail()?.balance ?? 0; }

  get accountType(): LocalAccountType {
    return ((this._detail()?.type ?? 'ASSET').toLowerCase()) as LocalAccountType;
  }

  get accountName(): string {
    const d = this._detail();
    if (!d) return '';
    return d.code ? d.code + ' ' + (d.name ?? '') : (d.name ?? '');
  }

  get hasLoan(): boolean { return this._detail()?.loanAccount ?? false; }
  get loanData(): LoanData | null { return this._detail()?.loanData ?? null; }

  get typeLabel(): string {
    const labels: Record<LocalAccountType, string> = {
      asset: 'Activo', liability: 'Pasivo', expense: 'Gasto', income: 'Ingreso', equity: 'Patrimonio',
    };
    return labels[this.accountType];
  }

  isNegativeTrend(): boolean {
    const trend = this._detail()?.trend ?? [];
    if (trend.length < 2) return this.accountType === 'liability' || this.accountType === 'expense';
    const wentUp = (trend[trend.length - 1].balance ?? 0) > (trend[0].balance ?? 0);
    return (this.accountType === 'liability' || this.accountType === 'expense') ? wentUp : !wentUp;
  }

  get trendBadgeText(): string {
    const trend = this._detail()?.trend ?? [];
    const wentUp = trend.length >= 2 && (trend[trend.length - 1].balance ?? 0) > (trend[0].balance ?? 0);
    const type = this.accountType;
    if (type === 'liability') return wentUp ? 'Deuda subió' : 'Deuda bajó';
    if (type === 'expense')   return wentUp ? 'Gasto subió' : 'Gasto bajó';
    if (type === 'income')    return wentUp ? 'Ingreso subió' : 'Ingreso bajó';
    return wentUp ? 'Saldo subió' : 'Saldo bajó';
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

  get visibleMovements(): Movement[] { return this._movements(); }

  get hasMore(): boolean { return this._movements().length < this._totalTransactions(); }

  ngOnInit(): void {
    this.route.queryParamMap.subscribe(params => {
      const id = Number(params.get('id'));
      if (!id) { this.loading.set(false); return; }
      this.accountId = id;
      this.currentPage = 0;
      this._movements.set([]);
      this._detail.set(null);
      this.errorCode.set(null);
      this.loading.set(true);
      this.loadDetail(id);
    });
  }

  private loadDetail(id: number): void {
    forkJoin([getAccountDetail(this.http, this.rootUrl, { id }), timer(300)]).subscribe({
      next: ([res]) => {
        const d = (res as (typeof res)).body!;
        this._detail.set(d);
        this._totalTransactions.set(d.totalTransactions ?? 0);
        this._movements.set((d.transactions ?? []).map(t => this.toMovement(t)));
        this.threshold = d.thresholdPct ?? 15;
        this.showInAlerts = d.showInAlerts ?? false;
        this.loading.set(false);
        if (this.viewReady) setTimeout(() => this.buildChart(d));
      },
      error: err => {
        this.errorCode.set(err?.status ?? 0);
        this.loading.set(false);
      },
    });
  }

  ngAfterViewInit(): void {
    this.viewReady = true;
    const d = this._detail();
    if (d && !this.isMultiCurrency) this.buildChart(d);
  }

  loadMore(): void {
    this.currentPage++;
    getAccountTransactions(this.http, this.rootUrl, {
      id: this.accountId,
      page: this.currentPage,
      size: 5,
    }).subscribe({
      next: res => {
        const items = res.body?.items ?? [];
        this._movements.update(prev => [...prev, ...items.map(t => this.toMovement(t))]);
      },
      error: () => {
        this.currentPage--;
      },
    });
  }

  private buildChart(d: AccountDetailResponse): void {
    this.chart?.destroy();
    if (!this.canvasRef) return;

    const trend = d.trend ?? [];
    const labels = trend.map(t => t.month ?? '');
    const values = trend.map(t => t.balance ?? 0);
    const lastIdx = values.length - 1;

    const dataMin = Math.min(...values, 0);
    const dataMax = Math.max(...values);
    const range = dataMax - dataMin || 1;
    const padding = range * 0.2;
    const yMin = Math.max(0, Math.floor((dataMin - padding) / 1000) * 1000);
    const yMax = Math.ceil((dataMax + padding) / 1000) * 1000;
    const stepSize = Math.max(1000, Math.ceil((yMax - yMin) / 3 / 1000) * 1000);

    const isNeg = this.isNegativeTrend();
    const lastColor = isNeg ? '#ef4444' : '#22c55e';

    const monthNames: Record<string, string> = {
      ene: 'Enero', feb: 'Febrero', mar: 'Marzo', abr: 'Abril',
      may: 'Mayo', jun: 'Junio', jul: 'Julio', ago: 'Agosto',
      sep: 'Septiembre', sept: 'Septiembre', oct: 'Octubre', nov: 'Noviembre', dic: 'Diciembre',
    };

    const pointBg     = values.map((_, i) => i === lastIdx ? lastColor : '#ffffff');
    const pointBorder = values.map((_, i) => i === lastIdx ? lastColor : '#9ca3af');
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
            min: yMin,
            max: yMax,
            grid: { color: '#e5e7eb' },
            border: { display: false },
            ticks: {
              color: '#9ca3af',
              font: { size: 11, family: 'inherit' },
              stepSize,
              callback: v => {
                const n = v as number;
                if (n === 0) return '0';
                if (n < 1000) return Math.round(n).toLocaleString('es-DO');
                return Math.round(n / 1000) + 'k';
              },
            },
          },
        },
      },
    };

    this.chart = new Chart(this.canvasRef.nativeElement, config);
  }

  private toMovement(t: TransactionItem): Movement {
    return {
      id: t.id ?? 0,
      date: this.formatDate(t.date ?? ''),
      description: t.description ?? '',
      amount: (t.inflow ? '+' : '-') + 'RD$' + Math.abs(t.amountRd ?? 0).toLocaleString('es-DO', { maximumFractionDigits: 0 }),
      inflow: t.inflow ?? false,
    };
  }

  private formatDate(dateStr: string): string {
    if (!dateStr) return '';
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('es-DO', { day: 'numeric', month: 'short' }).replace('.', '');
  }

  ngOnDestroy(): void { this.chart?.destroy(); }
}
