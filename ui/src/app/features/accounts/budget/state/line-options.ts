import { byName } from '../../../../shared/utils/by-name';
import { AccountOptionKind, StatementAccountKind } from '../budget.enums';
import { BUDGET_TEXT } from '../budget.texts';
import { AccountOption, OptionGroup, TransactionLine } from '../models/budget.models';

/** "Entre mis cuentas" lists the card before the loans. */
const TRANSFER_ORDER: AccountOptionKind[] = [AccountOptionKind.Card, AccountOptionKind.Loan];

/**
 * The groups "Otra" offers on a line, in order (otra-dropdown-plan.md, "Rules"): a card purchase → Gastos;
 * a card credit → Ingresos, Gastos; savings money out → Entre mis cuentas, Gastos; savings money in →
 * Ingresos. The card is never offered on a card line, so a card line can't be posted against its own account.
 * Each group is sorted by name; empty groups are left out.
 */
export function optionsForLine(line: TransactionLine, options: AccountOption[]): OptionGroup[] {
  const ofKind = (...kinds: AccountOptionKind[]) => options.filter(o => kinds.includes(o.kind));
  const expenses: OptionGroup = { label: BUDGET_TEXT.expenses, options: ofKind(AccountOptionKind.Expense).sort(byName) };
  const incomes: OptionGroup = { label: BUDGET_TEXT.incomes, options: ofKind(AccountOptionKind.Income).sort(byName) };
  const transfers: OptionGroup = {
    label: BUDGET_TEXT.betweenAccounts,
    options: ofKind(...TRANSFER_ORDER)
      .sort((a, b) => TRANSFER_ORDER.indexOf(a.kind) - TRANSFER_ORDER.indexOf(b.kind) || byName(a, b)),
  };

  const moneyIn = line.amount < 0;
  const groups = line.source === StatementAccountKind.CreditCard
    ? (moneyIn ? [incomes, expenses] : [expenses])
    : (moneyIn ? [incomes] : [transfers, expenses]);
  return groups.filter(g => g.options.length > 0);
}
