import { Component } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { DecimalPipe } from '@angular/common';

interface ExpenseBudget {
  id: string; name: string; lastDate: string; lastDesc: string;
  budget: number; suggestion: number; actual: number; threshold: number;
}

const MONTHLY_INCOME = 85_000;

@Component({
  selector: 'app-accounts',
  imports: [RouterOutlet, RouterLink, FormsModule, DecimalPipe],
  templateUrl: './accounts.html',
  styleUrl: './accounts.css',
})
export class AccountsComponent {
  showBudgetMode  = false;
  showLoanPicker  = false;

  expenseBudgets: ExpenseBudget[] = [
    { id: '3010', name: '3010 Alimentación',   lastDate: '12 oct', lastDesc: 'La Sirena',    budget: 12300, suggestion: 11500, actual: 10355, threshold: 15 },
    { id: '3020', name: '3020 Transporte',     lastDate: '13 oct', lastDesc: 'Uber',          budget: 3100,  suggestion: 2900,  actual: 620,   threshold: 5  },
    { id: '3070', name: '3070 Ropa y calzado', lastDate: '8 oct',  lastDesc: 'Tienda Online', budget: 2000,  suggestion: 1800,  actual: 3450,  threshold: 3  },
    { id: '3080', name: '3080 Restaurantes',   lastDate: '5 oct',  lastDesc: 'El Mesón',      budget: 1800,  suggestion: 1600,  actual: 1920,  threshold: 2  },
  ];

  isOverThreshold(a: ExpenseBudget): boolean {
    return a.actual > MONTHLY_INCOME * (a.threshold / 100);
  }

  saveBudget(): void {
    this.showBudgetMode = false;
  }

  cancelBudget(): void {
    this.showBudgetMode = false;
  }
}
