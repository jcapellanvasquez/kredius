import { Component } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { DecimalPipe } from '@angular/common';

@Component({
  selector: 'app-accounts',
  imports: [RouterOutlet, RouterLink, FormsModule, DecimalPipe],
  templateUrl: './accounts.html',
  styleUrl: './accounts.css',
})
export class AccountsComponent {
  showBudgetMode = false;

  expenseBudgets = [
    { id: '3010', name: '3010 Alimentación', lastDate: '12 oct', lastDesc: 'La Sirena',  budget: 12300, suggestion: 11500 },
    { id: '3020', name: '3020 Transporte',   lastDate: '13 oct', lastDesc: 'Uber',       budget: 3100,  suggestion: 2900  },
  ];

  saveBudget(): void {
    this.showBudgetMode = false;
  }

  cancelBudget(): void {
    this.showBudgetMode = false;
  }
}
