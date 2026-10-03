import { AccountOptionKind, CurrencyCode, LineStatus, StatementAccountKind } from '../budget.enums';
import { AccountOption, TransactionLine } from '../models/budget.models';
import { optionsForLine } from './line-options';

const option = (accountId: number, name: string, kind: AccountOptionKind): AccountOption =>
  ({ accountId, name, icon: 'category', kind });

const OPTIONS: AccountOption[] = [
  option(1, 'Supermercado', AccountOptionKind.Expense),
  option(2, 'Comisiones', AccountOptionKind.Expense),
  option(3, 'Salario', AccountOptionKind.Income),
  option(4, 'Préstamo vehículo', AccountOptionKind.Loan),
  option(5, 'Tarjeta', AccountOptionKind.Card),
];

function line(source: StatementAccountKind, amount: number): TransactionLine {
  return {
    lineId: 1, description: 'x', date: '2026-08-28', amount, currency: CurrencyCode.Rd, originalAmount: amount,
    source, sourceIcon: 'x', status: LineStatus.Pending, categoryId: null, categoryName: null, suggestions: [],
  };
}

/** Each group as `label: names`, to read the expectations at a glance. */
const shape = (l: TransactionLine, options = OPTIONS) =>
  optionsForLine(l, options).map(g => `${g.label}: ${g.options.map(o => o.name).join(', ')}`);

describe('optionsForLine: which groups "Otra" offers on a line', () => {
  it('a card purchase gets Gastos only, sorted by name', () => {
    expect(shape(line(StatementAccountKind.CreditCard, 500))).toEqual(['Gastos: Comisiones, Supermercado']);
  });

  it('a card credit (refund, cashback) gets Ingresos, then Gastos', () => {
    expect(shape(line(StatementAccountKind.CreditCard, -500)))
      .toEqual(['Ingresos: Salario', 'Gastos: Comisiones, Supermercado']);
  });

  it('savings money out gets "Entre mis cuentas" (card first, then loans), then Gastos', () => {
    expect(shape(line(StatementAccountKind.Savings, 25000)))
      .toEqual(['Entre mis cuentas: Tarjeta, Préstamo vehículo', 'Gastos: Comisiones, Supermercado']);
  });

  it('savings money in gets Ingresos only', () => {
    expect(shape(line(StatementAccountKind.Savings, -1.64))).toEqual(['Ingresos: Salario']);
  });

  it('never offers the card on a card line', () => {
    for (const amount of [500, -500]) {
      const ids = optionsForLine(line(StatementAccountKind.CreditCard, amount), OPTIONS).flatMap(g => g.options);
      expect(ids.some(o => o.kind === AccountOptionKind.Card)).withContext(`amount ${amount}`).toBeFalse();
    }
  });

  it('leaves empty groups out', () => {
    const expensesOnly = OPTIONS.filter(o => o.kind === AccountOptionKind.Expense);
    expect(shape(line(StatementAccountKind.Savings, 25000), expensesOnly)).toEqual(['Gastos: Comisiones, Supermercado']);
  });
});
