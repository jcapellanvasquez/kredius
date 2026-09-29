/* Seed data for BudgetMockApi. Covers every visual case listed in the UI plan §4. */
import { AccountIcon } from '../../../../shared/constants/account-icons';
import { Period, currentPeriod, shiftPeriod } from '../../../../shared/utils/period';
import { ImportStatus, MockScenario, StatementAccountKind } from '../budget.enums';
import { CategoryOption } from '../models/budget.models';

export interface MockLine {
  lineId: number;
  importId: number;
  date: string;
  description: string;
  amount: number;
  source: StatementAccountKind;
  categoryId: number | null;
  posted: boolean;
  /** Card payments are transfers, not spend: excluded from categories and "Sin categorizar". */
  isPayment?: boolean;
  suggestionIds?: number[];
}

export interface MockImport {
  id: number;
  kind: StatementAccountKind;
  statementDate: string;
  uploadedAt: string;
  fileName: string;
  status: ImportStatus;
}

export interface MockAccount {
  accountId: number;
  name: string;
  icon: string;
}

export interface MockDb {
  card: MockAccount;
  savings: MockAccount & { balance: number; incomeByPeriod: Record<Period, number> };
  categories: CategoryOption[];
  budgets: Record<Period, Record<number, number>>;
  lines: MockLine[];
  imports: MockImport[];
  nextLineId: number;
  nextImportId: number;
}

/** Lines appended by a mock upload: two known merchants and one unknown. */
export interface MockUploadTemplate {
  description: string;
  amount: number;
  categoryId: number | null;
  suggestionIds?: number[];
}

// Category (expense account) ids
export const CAT = {
  Supermercado:  9,
  Diversion:     10,
  Suscripciones: 11,
  Personal:      12,
  Hogar:         13,
  Transporte:    14,
  Retiro:        15,
  Restaurantes:  16,
  Salud:         17,
} as const;

const CATEGORIES: CategoryOption[] = [
  { accountId: CAT.Supermercado,  name: 'Supermercado',       icon: AccountIcon.ShoppingCart },
  { accountId: CAT.Diversion,     name: 'Diversión',          icon: AccountIcon.Confetti },
  { accountId: CAT.Suscripciones, name: 'Suscripciones',      icon: AccountIcon.Refresh },
  { accountId: CAT.Personal,      name: 'Personal',           icon: AccountIcon.User },
  { accountId: CAT.Hogar,         name: 'Hogar',              icon: AccountIcon.Home },
  { accountId: CAT.Transporte,    name: 'Transporte',         icon: AccountIcon.Car },
  { accountId: CAT.Retiro,        name: 'Retiro en efectivo', icon: AccountIcon.Cash },
  { accountId: CAT.Restaurantes,  name: 'Restaurantes',       icon: AccountIcon.Kitchen },
  { accountId: CAT.Salud,         name: 'Salud',              icon: AccountIcon.Heartbeat },
];

const CARD: MockAccount = { accountId: 3, name: 'Tarjeta de crédito', icon: AccountIcon.CreditCard };
const SAVINGS_ACCOUNT: MockAccount = { accountId: 2, name: 'Ahorros BHD', icon: AccountIcon.BuildingBank };

// Restaurantes intentionally has no budget (the "sin presupuesto" case).
const BUDGETS: Record<number, number> = {
  [CAT.Supermercado]:  20000,
  [CAT.Diversion]:     10000,
  [CAT.Suscripciones]: 5000,
  [CAT.Personal]:      8000,
  [CAT.Hogar]:         12000,
  [CAT.Transporte]:    6000,
  [CAT.Retiro]:        15000,
  [CAT.Salud]:         4000,
};

export const MOCK_UPLOAD_TEMPLATES: Record<StatementAccountKind, MockUploadTemplate[]> = {
  [StatementAccountKind.CreditCard]: [
    { description: 'SUPERMERCADOS BRAVO #4410', amount: 3150, categoryId: CAT.Supermercado },
    { description: 'STARBUCKS BLUE MALL',       amount: 420,  categoryId: CAT.Restaurantes },
    { description: 'MERCADOLIBRE*ORD 88213',    amount: 2890, categoryId: null, suggestionIds: [CAT.Hogar, CAT.Personal] },
  ],
  [StatementAccountKind.Savings]: [
    { description: 'PAGO EDENORTE',             amount: 3200, categoryId: CAT.Hogar },
    { description: 'RETIRO ATM SAN ISIDRO',     amount: 2000, categoryId: CAT.Retiro },
    { description: 'DEBITO APP 55120',          amount: 1100, categoryId: null, suggestionIds: [CAT.Suscripciones, CAT.Personal] },
  ],
};

function day(period: Period, d: number): string {
  return `${period.slice(0, 8)}${String(d).padStart(2, '0')}`;
}

function daysAgo(n: number, now: Date): string {
  return new Date(now.getTime() - n * 24 * 60 * 60 * 1000).toISOString();
}

export function buildMockDb(scenario: MockScenario, now: Date = new Date()): MockDb {
  const cur = currentPeriod(now);
  const prev = shiftPeriod(cur, -1);
  const Card = StatementAccountKind.CreditCard;
  const Sav = StatementAccountKind.Savings;

  const db: MockDb = {
    card: { ...CARD },
    savings: { ...SAVINGS_ACCOUNT, balance: 62300, incomeByPeriod: { [cur]: 197890, [prev]: 195400 } },
    categories: CATEGORIES.map(c => ({ ...c })),
    // Restaurantes had a budget last month only, so it shows the "mes anterior" hint.
    budgets: { [cur]: { ...BUDGETS }, [prev]: { ...BUDGETS, [CAT.Restaurantes]: 5000 } },
    lines: [],
    imports: [],
    nextLineId: 1000,
    nextImportId: 100,
  };

  if (scenario === MockScenario.Empty) {
    db.budgets = {};
    db.savings.incomeByPeriod = {};
    db.savings.balance = 0;
    return db;
  }

  db.imports = [
    { id: 11, kind: Card, statementDate: day(prev, 15), uploadedAt: daysAgo(34, now), fileName: 'corte-tarjeta-anterior.pdf', status: ImportStatus.Confirmed },
    { id: 12, kind: Sav,  statementDate: day(prev, 28), uploadedAt: daysAgo(31, now), fileName: 'ahorros-anterior.pdf',       status: ImportStatus.Reversed },
    { id: 13, kind: Sav,  statementDate: day(cur, 20),  uploadedAt: daysAgo(5, now),  fileName: 'ahorros-actual.pdf',         status: ImportStatus.Confirmed },
    { id: 14, kind: Card, statementDate: day(cur, 25),  uploadedAt: daysAgo(3, now),  fileName: 'corte-tarjeta-actual.pdf',   status: ImportStatus.PendingReview },
  ];

  const L = (lineId: number, importId: number, date: string, description: string, amount: number,
             source: StatementAccountKind, categoryId: number | null, extra: Partial<MockLine> = {}): MockLine =>
    ({ lineId, importId, date, description, amount, source, categoryId, posted: categoryId != null, ...extra });

  db.lines = [
    // ── Current month ─────────────────────────────────────────────
    // Diversión 12,800 / 10,000 → 128% (danger)
    L(501, 14, day(cur, 12), 'FIT REPUBLIC',          1600, Card, CAT.Diversion, { suggestionIds: [CAT.Personal, CAT.Salud] }),
    L(502, 14, day(cur, 8),  'OCHO SANTOS',            795, Card, CAT.Diversion),
    L(503, 14, day(cur, 6),  'CARIBBEAN CINEMAS',     2405, Card, CAT.Diversion),
    L(504, 14, day(cur, 3),  'BAR PUNTO Y COMA',      8000, Card, CAT.Diversion),
    // Supermercado 18,400 / 20,000 → 92% (warning), both origins
    L(511, 14, day(cur, 18), 'SM NACIONAL #221',      5213, Card, CAT.Supermercado, { suggestionIds: [CAT.Hogar, CAT.Restaurantes] }),
    L(512, 14, day(cur, 10), 'JUMBO LUPERON',         6787, Card, CAT.Supermercado),
    L(513, 13, day(cur, 14), 'LA SIRENA DEBITO',      6400, Sav,  CAT.Supermercado),
    // Suscripciones 3,200 / 5,000 → 64% (neutral)
    L(521, 14, day(cur, 1),  'NETFLIX.COM',            650, Card, CAT.Suscripciones),
    L(522, 14, day(cur, 2),  'SPOTIFY',                350, Card, CAT.Suscripciones),
    L(523, 14, day(cur, 4),  'APPLE.COM/BILL',         200, Card, CAT.Suscripciones),
    L(524, 14, day(cur, 5),  'AMAZON*PRIME',          2000, Card, CAT.Suscripciones),
    // Retiro en efectivo 8,500 / 15,000 → 57% (savings only)
    L(531, 13, day(cur, 7),  'RETIRO ATM PIANTINI',   5000, Sav,  CAT.Retiro),
    L(532, 13, day(cur, 16), 'RETIRO ATM NACO',       3500, Sav,  CAT.Retiro),
    // Hogar 9,400 / 12,000 → 78%
    L(541, 13, day(cur, 9),  'PAGO EDEESTE',          9400, Sav,  CAT.Hogar),
    // Transporte 2,300 / 6,000 → 38%
    L(551, 14, day(cur, 11), 'UBER *TRIP HELP.UBER',  2300, Card, CAT.Transporte),
    // Restaurantes 1,850, no budget
    L(561, 14, day(cur, 13), 'POLLO REY',             1850, Card, CAT.Restaurantes),
    // Card payment (statement result: charges − payments)
    L(571, 14, day(cur, 15), 'PAGO RECIBIDO GRACIAS', -15000, Card, null, { isPayment: true, posted: true }),
    // Uncategorized
    L(901, 14, day(cur, 19), 'UBER *TRIP 7XK2',        450, Card, null, { suggestionIds: [CAT.Transporte, CAT.Personal] }),
    L(902, 13, day(cur, 17), 'FARMACIA CAROL',        1275, Sav,  null, { suggestionIds: [CAT.Salud, CAT.Personal] }),
    L(903, 14, day(cur, 20), 'PAYPAL *XYZSERVICES',    999, Card, null, { suggestionIds: [CAT.Suscripciones, CAT.Diversion] }),

    // ── Previous month ────────────────────────────────────────────
    L(401, 11, day(prev, 24), 'SM NACIONAL #221',     5213, Card, CAT.Supermercado),
    L(402, 11, day(prev, 20), 'JUMBO LUPERON',       14100, Card, CAT.Supermercado),
    L(403, 11, day(prev, 9),  'NETFLIX.COM',           650, Card, CAT.Suscripciones),
    L(404, 11, day(prev, 12), 'CARIBBEAN CINEMAS',    3100, Card, CAT.Diversion),
    L(405, 11, day(prev, 18), 'PAGO RECIBIDO GRACIAS', -20000, Card, null, { isPayment: true, posted: true }),
    L(406, 12, day(prev, 5),  'RETIRO ATM PIANTINI',  6000, Sav,  CAT.Retiro),
    L(407, 12, day(prev, 7),  'PAGO EDEESTE',        11800, Sav,  CAT.Hogar),
  ];

  if (scenario === MockScenario.AllCategorized) {
    db.lines = db.lines.filter(l => l.isPayment || l.categoryId != null);
  }

  return db;
}
