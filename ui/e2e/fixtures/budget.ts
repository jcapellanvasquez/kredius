import { AccountResponse } from '../../src/app/api/models/account-response';
import { AccountSummaryResponse } from '../../src/app/api/models/account-summary-response';
import { BudgetAccountOption } from '../../src/app/api/models/budget-account-option';
import { BudgetScreenResponse } from '../../src/app/api/models/budget-screen-response';
import { BudgetTransactionLine } from '../../src/app/api/models/budget-transaction-line';

/**
 * Sample data for the budget screen, typed with the generated API models (`npm run e2e:typecheck` fails
 * when the spec changes). Made-up amounts and merchants, shaped like the BHD August statements.
 */

export const PERIOD = '2026-08-01';
export const MONTH_PARAM = '2026-08';

export const CARD_ID = 2;
export const SAVINGS_ID = 1;
export const SUPERMERCADO = 10;
export const HOGAR = 11;
export const COMISIONES = 12;
export const RECARGAS = 13;
export const SUSCRIPCIONES = 14;
export const DIVERSION = 15;
export const CASHBACK = 40;
export const SALARIO = 41;
export const PRESTAMO = 50;

const option = (accountId: number, name: string, icon: string) => ({ accountId, name, icon });

function pending(lineId: number, date: string, description: string, amount: number,
                 suggestions: ReturnType<typeof option>[], extra: Partial<BudgetTransactionLine> = {}): BudgetTransactionLine {
  return {
    lineId, date, description, amount, originalAmount: amount, currency: 'RD', source: 'SAVINGS',
    sourceIcon: 'building-bank', status: 'PENDING', suggestions, ...extra,
  };
}

/** "Sin categorizar", in the order the screen shows it. Long descriptions on purpose (2-line wrap). */
export const UNCATEGORIZED: BudgetTransactionLine[] = [
  pending(101, '2026-08-31', 'Pago Intereses CA', -1.64,
    [option(CASHBACK, 'Cashback y reembolsos', 'refresh'), option(SALARIO, 'Salario', 'briefcase')]),
  pending(102, '2026-08-28', 'SUPERMERCADO PLAZA CENTRAL SANTO DOMINGO-DO', 2340,
    [option(SUPERMERCADO, 'Supermercado', 'shopping-cart'), option(HOGAR, 'Hogar', 'home')]),
  pending(103, '2026-08-27', 'Imp. transferencia Pago al Instante Transf. # 818700000', 23.79,
    [option(COMISIONES, 'Comisiones bancarias', 'receipt'), option(RECARGAS, 'Recargas', 'device-mobile')]),
  pending(104, '2026-08-27', 'Imp. transferencia Pago al Instante Transf. # 818700001', 23.79,
    [option(COMISIONES, 'Comisiones bancarias', 'receipt'), option(RECARGAS, 'Recargas', 'device-mobile')]),
  pending(105, '2026-08-26', 'Google YouTube 650-2530000-US', 521.29,
    [option(SUSCRIPCIONES, 'Suscripciones', 'device-mobile'), option(DIVERSION, 'Diversión', 'confetti')],
    { source: 'CREDIT_CARD', sourceIcon: 'credit-card', currency: 'USD', originalAmount: 8.49 }),
  pending(106, '2026-08-25', 'PAGO DE TC 4000-XXXX-XXXX-0000', 25000, []),
];

export function budgetScreen(uncategorized: BudgetTransactionLine[]): BudgetScreenResponse {
  return {
    period: PERIOD,
    lastUploads: [
      { kind: 'CREDIT_CARD', accountId: CARD_ID, uploadedAt: '2026-09-01T14:00:00Z' },
      { kind: 'SAVINGS', accountId: SAVINGS_ID, uploadedAt: '2026-09-01T14:01:00Z' },
    ],
    uncategorized,
    categories: [
      {
        accountId: SUPERMERCADO, name: 'Supermercados y colmados del barrio', icon: 'shopping-cart', actual: 12480,
        budget: 15000, budgetFromMonth: '2026-07-01', origins: ['CREDIT_CARD', 'SAVINGS'], loanInterest: [],
        transactions: [{
          lineId: 201, date: '2026-08-12', description: 'SUPERMERCADO NACIONAL', amount: 12480, originalAmount: 12480,
          currency: 'RD', source: 'CREDIT_CARD', sourceIcon: 'credit-card', status: 'POSTED',
          categoryId: SUPERMERCADO, categoryName: 'Supermercados y colmados del barrio', suggestions: [],
        }],
      },
      {
        accountId: HOGAR, name: 'Hogar', icon: 'home', actual: 0, budget: null, budgetFromMonth: null,
        origins: [], loanInterest: [], transactions: [],
      },
    ],
    card: {
      accountId: CARD_ID, name: 'Tarjeta', icon: 'credit-card', spent: 59819.79, budget: 55000,
      budgetFromMonth: '2026-07-01', usdRate: 61.4,
      statement: {
        cycleStart: '2026-07-27', cutOffDate: '2026-08-26', paymentDueDate: '2026-09-21',
        rd: { previousBalance: 62637.94, charges: 76951.06, credits: 72748.79, balance: 66840.21, minimumPayment: 1858.16 },
        usd: { previousBalance: 567.44, charges: 198.93, credits: 567.44, balance: 198.93, minimumPayment: 5.53 },
        check: {
          ledger: 66840.21, pending: 0, pendingCount: 0, paymentsToReconcile: 0, difference: 0,
          usdCharges: 6, usdPosted: 3,
        },
      },
    },
    savings: {
      accountId: SAVINGS_ID, name: 'Ahorros', icon: 'building-bank', balance: 96762.17, previousBalance: 90100,
      income: 1.64, loanPayments: [], cardPayments: [],
      bankBalance: { date: '2026-08-31', bank: 96762.17, ledger: 96356.2 },
    },
    loanOptions: [option(PRESTAMO, 'Préstamo vehículo', 'car')],
    incomeOptions: [option(CASHBACK, 'Cashback y reembolsos', 'refresh'), option(SALARIO, 'Salario', 'briefcase')],
    accountOptions: ACCOUNT_OPTIONS,
  };
}

/** `GET /accounts?type=EXPENSE`: the categories in "Otra". */
export const EXPENSE_ACCOUNTS: AccountResponse[] = [
  [SUPERMERCADO, 'Supermercado', 'shopping-cart'], [HOGAR, 'Hogar', 'home'],
  [COMISIONES, 'Comisiones bancarias', 'receipt'], [RECARGAS, 'Recargas', 'device-mobile'],
  [SUSCRIPCIONES, 'Suscripciones', 'device-mobile'], [DIVERSION, 'Diversión', 'confetti'],
  [16, 'Compras online', 'shopping-cart'], [17, 'Gasolina', 'gas-station'], [18, 'Mantenimiento del vehículo', 'car'],
  [19, 'Personales', 'user'], [20, 'Gastos financieros', 'coins'],
].map(([id, name, icon]) => ({ id: id as number, name: name as string, icon: icon as string, type: 'EXPENSE', active: true }));

/** `accountOptions` of the budget screen: everything "Otra" can offer, with its kind. */
export const ACCOUNT_OPTIONS: BudgetAccountOption[] = [
  ...EXPENSE_ACCOUNTS.map(a => ({ accountId: a.id!, name: a.name!, icon: a.icon, kind: 'EXPENSE' as const })),
  { accountId: CASHBACK, name: 'Cashback y reembolsos', icon: 'refresh', kind: 'INCOME' },
  { accountId: SALARIO, name: 'Salario', icon: 'briefcase', kind: 'INCOME' },
  { accountId: CARD_ID, name: 'Tarjeta', icon: 'credit-card', kind: 'CARD' },
  { accountId: PRESTAMO, name: 'Préstamo vehículo', icon: 'car', kind: 'LOAN' },
];

/** `GET /accounts`: every account (the upload panel looks up the statement accounts here). */
export const ALL_ACCOUNTS: AccountResponse[] = [
  { id: SAVINGS_ID, name: 'Ahorros', type: 'ASSET', statementType: 'SAVINGS', active: true, icon: 'building-bank' },
  { id: CARD_ID, name: 'Tarjeta', type: 'LIABILITY', statementType: 'CREDIT_CARD', active: true, icon: 'credit-card' },
  ...EXPENSE_ACCOUNTS,
];

/** `GET /accounts/summary`: the sidebar. */
export const ACCOUNTS_SUMMARY: AccountSummaryResponse[] = [
  { id: SAVINGS_ID, name: 'Ahorros', type: 'ASSET', balance: 96762.17, statementType: 'SAVINGS', icon: 'building-bank' },
  { id: CARD_ID, name: 'Tarjeta', type: 'LIABILITY', balance: 66840.21, statementType: 'CREDIT_CARD', icon: 'credit-card' },
];
