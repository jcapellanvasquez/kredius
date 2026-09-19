import { Component } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-accounts',
  imports: [RouterOutlet, RouterLink],
  templateUrl: './accounts.html',
  styleUrl: './accounts.css',
})
export class AccountsComponent {}
