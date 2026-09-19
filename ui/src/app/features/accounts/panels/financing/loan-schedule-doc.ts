import { Component, Input, Output, EventEmitter } from '@angular/core';

export interface ScheduleDocRow {
  num:    number;
  date:   string;
  amount: number;
  paid:   boolean;
}

@Component({
  selector: 'app-loan-schedule-doc',
  imports: [],
  host: { class: 'block' },
  template: `
    <div class="flex flex-col gap-5">

      <!-- Back -->
      <button type="button" (click)="close.emit()"
        class="inline-flex items-center gap-1.5 text-sm text-gray-900 hover:text-gray-700 w-fit">
        <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path stroke="none" d="M0 0h24v24H0z" fill="none"/>
          <path d="M5 12l14 0" />
          <path d="M5 12l6 6" />
          <path d="M5 12l6 -6" />
        </svg>
        Volver al préstamo
      </button>

      <!-- Print card -->
      <div class="rounded-2xl border border-gray-200 bg-white overflow-hidden shadow-sm" id="schedule-card">

        <!-- Violet header -->
        <div class="bg-brand-600 px-5 py-4">
          <p class="text-xs font-semibold text-brand-200 uppercase tracking-widest mb-0.5">Cronograma de pago</p>
          <p class="text-xl font-bold text-white">{{ borrowerName }}</p>
        </div>

        <!-- Summary cells -->
        <div class="grid grid-cols-2 divide-x divide-gray-100 border-b border-gray-100">
          <div class="px-4 py-3">
            <p class="text-xs text-gray-400 mb-0.5">Monto prestado</p>
            <p class="text-base font-bold text-gray-900">{{ principalFormatted }}</p>
          </div>
          <div class="px-4 py-3">
            <p class="text-xs text-gray-400 mb-0.5">Total a pagar</p>
            <p class="text-base font-bold text-gray-900">{{ totalFormatted }}</p>
          </div>
        </div>

        <!-- Schedule table -->
        <table class="w-full text-sm">
          <thead class="bg-gray-50 border-b border-gray-100">
            <tr>
              <th class="text-left px-4 py-2.5 text-xs font-semibold text-gray-400 uppercase tracking-wide">Semana</th>
              <th class="text-left px-4 py-2.5 text-xs font-semibold text-gray-400 uppercase tracking-wide">Fecha</th>
              <th class="text-right px-4 py-2.5 text-xs font-semibold text-gray-400 uppercase tracking-wide">Pago</th>
              <th class="text-center px-4 py-2.5 text-xs font-semibold text-gray-400 uppercase tracking-wide">Estado</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-50">
            @for (row of rows; track row.num) {
              <tr [class.bg-gray-50]="row.paid">
                <td class="px-4 py-2.5 text-gray-500 text-xs">{{ row.num }}</td>
                <td class="px-4 py-2.5 text-gray-700 text-xs">{{ row.date }}</td>
                <td class="px-4 py-2.5 text-right font-medium text-gray-900 text-xs">{{ formatRD(row.amount) }}</td>
                <td class="px-4 py-2.5 text-center">
                  @if (row.paid) {
                    <svg class="w-4 h-4 text-income inline-block" viewBox="0 0 24 24" fill="currentColor">
                      <path stroke="none" d="M0 0h24v24H0z" fill="none"/>
                      <path d="M17 3.34a10 10 0 1 1 -14.995 8.984l-.005 -.324l.005 -.324a10 10 0 0 1 14.995 -8.336zm-1.293 5.953a1 1 0 0 0 -1.32 -.083l-.094 .083l-3.293 3.292l-1.293 -1.292l-.094 -.083a1 1 0 0 0 -1.403 1.403l.083 .094l2 2l.094 .083a1 1 0 0 0 1.226 0l.094 -.083l4 -4l.083 -.094a1 1 0 0 0 -.083 -1.32z" fill="currentColor" />
                    </svg>
                  } @else {
                    <svg class="w-4 h-4 text-gray-300 inline-block" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                      <path stroke="none" d="M0 0h24v24H0z" fill="none"/>
                      <path d="M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0 -18 0" />
                    </svg>
                  }
                </td>
              </tr>
            }
          </tbody>
        </table>

        <!-- Footer strip -->
        <div class="bg-gray-50 border-t border-gray-100 px-4 py-3 flex items-center justify-between gap-4 text-xs">
          <span class="text-gray-500">Cobrado a la fecha: <strong class="text-income">{{ collectedFormatted }}</strong></span>
          <span class="text-gray-400">|</span>
          <span class="text-gray-500">Por cobrar: <strong class="text-gray-900">{{ remainingFormatted }}</strong></span>
        </div>

      </div>

      <!-- Actions -->
      <div class="flex flex-col gap-3">

        <!-- WhatsApp -->
        <button type="button" (click)="sendWhatsApp()"
          class="w-full py-3 text-sm font-semibold text-white rounded-xl flex items-center justify-center gap-2 transition-opacity hover:opacity-90"
          style="background-color: #25D366;">
          <svg class="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z"/>
          </svg>
          Enviar por WhatsApp
        </button>

        <!-- Print -->
        <button type="button" (click)="print()"
          class="w-full py-2.5 text-sm font-medium text-gray-600 border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors flex items-center justify-center gap-2">
          <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path stroke="none" d="M0 0h24v24H0z" fill="none"/>
            <path d="M17 17h2a2 2 0 0 0 2 -2v-4a2 2 0 0 0 -2 -2h-14a2 2 0 0 0 -2 2v4a2 2 0 0 0 2 2h2" />
            <path d="M17 9v-4a1 1 0 0 0 -1 -1h-8a1 1 0 0 0 -1 1v4" />
            <path d="M7 13m0 2a2 2 0 0 1 2 -2h6a2 2 0 0 1 2 2v4a2 2 0 0 1 -2 2h-6a2 2 0 0 1 -2 -2z" />
          </svg>
          Imprimir / Guardar PDF
        </button>

      </div>

      <!-- Sent confirmation toast -->
      @if (sent) {
        <div class="flex items-center gap-3 rounded-xl border border-green-200 bg-green-50 px-4 py-3">
          <svg class="w-5 h-5 text-income shrink-0" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"/>
          </svg>
          <p class="text-sm text-green-800">Cronograma enviado por WhatsApp.</p>
        </div>
      }

    </div>
  `,
})
export class LoanScheduleDocComponent {
  @Input() borrowerName = 'Emeli Espinal';
  @Input() principal    = 30_000;
  @Input() total        = 36_000;
  @Input() rows: ScheduleDocRow[] = [];
  @Output() close = new EventEmitter<void>();

  sent = false;

  get principalFormatted(): string { return 'RD$' + this.principal.toLocaleString(); }
  get totalFormatted():     string { return 'RD$' + this.total.toLocaleString(); }

  get collected(): number {
    return this.rows.filter(r => r.paid).reduce((s, r) => s + r.amount, 0);
  }
  get remaining(): number { return Math.max(0, this.total - this.collected); }

  get collectedFormatted(): string { return 'RD$' + this.collected.toLocaleString(); }
  get remainingFormatted(): string { return 'RD$' + this.remaining.toLocaleString(); }

  formatRD(v: number): string { return 'RD$' + v.toLocaleString(); }

  sendWhatsApp(): void {
    this.sent = true;
    setTimeout(() => { this.sent = false; }, 3000);
  }

  print(): void {
    window.print();
  }
}
