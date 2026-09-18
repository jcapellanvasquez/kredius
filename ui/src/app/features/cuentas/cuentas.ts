import { Component } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-cuentas',
  imports: [RouterOutlet, RouterLink],
  templateUrl: './cuentas.html',
  styleUrl: './cuentas.css',
})
export class CuentasComponent {}
