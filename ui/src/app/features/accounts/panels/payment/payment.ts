import { Component } from '@angular/core';

@Component({
  selector: 'app-payment',
  template: `
    <div class="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
      <h1 class="text-lg font-semibold text-gray-900">Abono a capital</h1>
      <p class="mt-1 text-sm text-gray-400">Registrar un pago adicional al capital del préstamo.</p>
    </div>
  `,
})
export class PaymentComponent {}
