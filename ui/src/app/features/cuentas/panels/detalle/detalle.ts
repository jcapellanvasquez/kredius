import { Component } from '@angular/core';

@Component({
  selector: 'app-detalle',
  template: `
    <div class="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
      <h1 class="text-lg font-semibold text-gray-900">Detalle de cuenta</h1>
      <p class="mt-1 text-sm text-gray-400">Movimientos y resumen de la cuenta seleccionada.</p>
    </div>
  `,
})
export class DetalleComponent {}
