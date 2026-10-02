import { ImportStatus, LineEffect, StatementAccountKind } from './budget.enums';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Every user-facing label on the budget screen. */
export const BUDGET_TEXT = {
  title:            'Presupuesto',
  navLabel:         'Presupuesto',
  update:           'Actualizar',
  process:          'Procesar',
  processing:       'Procesando…',
  /** Upload progress (loading system §5): bytes being sent, then the server working on the statement. */
  sending:          'Subiendo…',
  processingStatement: 'Procesando estado…',
  uploadHint:       'Puedes subir uno, el otro, o ambos.',
  statementDate:    'Fecha del corte',
  uploadError:      'No se pudo procesar el archivo. Intenta de nuevo.',
  history:          'Ver cortes anteriores',
  historyTitle:     'Cortes anteriores',
  historyEmpty:     'Aún no has subido cortes.',
  close:            'Cerrar',
  back:             'Volver',

  summary:          'Resumen',
  quickCompare:     'Comparativo rápido',
  quickCompareEmpty:'Sin movimientos ni presupuesto este mes.',
  detail:           'Detalle por categoría',
  uncategorized:    'Sin categorizar',
  budget:           'Presupuesto',
  noBudget:         'sin presupuesto',
  noPct:            '—',
  percent:          '%',
  of:               'de',
  unsaved:          'sin guardar',
  saved:            'Guardado',
  saveFailed:       'No se pudo guardar',
  other:            'Otra',
  searchCategory:   'Buscar categoría',
  loans:            'Préstamos',
  incomes:          'Ingresos',
  noMatches:        'Sin resultados',

  saveChanges:      'Guardar cambios',
  saving:           'Guardando…',
  unsavedConfirm:   'Tienes cambios de presupuesto sin guardar. ¿Salir y descartarlos?',

  income:           'Ingreso',
  bankBalanceAt:    'Banco al',
  ledgerBalanceAt:  'Kredius al',
  balanceMatches:   'Cuadra con el banco',
  balanceDifference:'Diferencia',
  balanceDifferenceHint: 'Movimientos en Kredius que no aparecen en el banco (p. ej. un préstamo), o líneas sin categorizar.',
  cardPayments:     'Pagos a tarjeta',
  charges:          'Consumos',
  credits:          'Pagos y créditos',
  previousBalance:  'Saldo anterior',
  statementBalance: 'Saldo al corte',
  minimumPayment:   'Pago mínimo',
  cutOff:           'Corte',
  statement:        'Estado',
  dueDate:          'vence',
  cardGapExplained: 'Diferencia explicada',
  cardUnexplained:  'Sin explicar',
  cardPaymentsToReconcile: 'Pagos por conciliar',
  cardPaymentsHint: 'Pagos desde ahorros que el banco aplica en otra fecha o al saldo en US$, o pagos de un estado de ahorros no subido.',
  usdNeedsRate:     'falta la tasa',
  /** Tag on a US$ card line while the card has no rate: categorizing it would fail. */
  rateMissing:      'Tasa sin asignar',
  rateMissingError: 'Tasa sin asignar. Guarda la tasa del dólar para registrar compras en US$.',
  setRate:          'Poner tasa',
  lineChanged:      'Esta línea ya cambió.',
  reloadMonth:      'Recargar el mes',
  usdRate:          'Tasa US$',
  usdRateHint:      'Las compras en US$ se registran al guardar la tasa.',
  saveRate:         'Guardar',
  changeRate:       'cambiar',
  confirmRate:      'Sí, guardar',
  fixRate:          'Corregir',

  cardBudget:       'Presupuesto de la tarjeta',
  editCardBudget:   'Cambiar el presupuesto de la tarjeta',
  setCardBudgetHint:'toca ✎ para poner uno',
  done:             'listo',
  /** The phone's keyboard typed something the number field can't read (e.g. "1.500,50"); nothing was saved. */
  unreadableNumber: 'No se pudo leer el número. Usa solo dígitos y un punto para los decimales.',
  showDetails:      'Ver detalles',
  hideDetails:      'Ocultar detalles',
  cardDetails:      'Detalles de la tarjeta',
  savingsDetails:   'Detalles de ahorros',
  /** Savings card: money that moved but isn't in any budget category. */
  outsideCategories:'Fuera de categorías',
  monthIncome:      'Ingreso del mes',
  noChange:         'sin cambio',
  chargesHelp:      'Qué incluye Consumos',
  chargesIn:        'En',
  chargesTotal:     'Total para el presupuesto',
  chargesNotPosted: 'Aún sin registrar',

  loadError:        'No se pudo cargar el presupuesto.',
  loadingMonth:     'Cargando el mes',
  retry:            'Reintentar',

  importLines:      'Líneas del corte',
  importNotFound:   'No se encontró el corte.',

  /** Help tags on each transaction: a short label, and one line of explanation on tap. */
  effect: {
    [LineEffect.DebtUp]:     { tag: 'Sube tu deuda',   help: 'Compra con la tarjeta: aumenta lo que le debes al banco.' },
    [LineEffect.DebtDown]:   { tag: 'Baja tu deuda',   help: 'Pago o crédito a la tarjeta: disminuye lo que le debes al banco.' },
    [LineEffect.SavingsOut]: { tag: 'Sale de ahorros', help: 'Dinero que salió de tu cuenta de ahorros.' },
    [LineEffect.SavingsIn]:  { tag: 'Entra a ahorros', help: 'Dinero que entró a tu cuenta de ahorros.' },
  } satisfies Record<LineEffect, { tag: string; help: string }>,

  kind: {
    [StatementAccountKind.CreditCard]: 'Tarjeta',
    [StatementAccountKind.Savings]:    'Ahorros',
  } satisfies Record<StatementAccountKind, string>,

  kindLong: {
    [StatementAccountKind.CreditCard]: 'Tarjeta de crédito',
    [StatementAccountKind.Savings]:    'Ahorros',
  } satisfies Record<StatementAccountKind, string>,

  importStatus: {
    [ImportStatus.Uploaded]:      'Subido',
    [ImportStatus.PendingReview]: 'Pendiente',
    [ImportStatus.Confirmed]:     'Confirmado',
    [ImportStatus.Reversed]:      'Reversado',
    [ImportStatus.Failed]:        'Fallido',
  } satisfies Record<ImportStatus, string>,

  installment: (n: number, total: number | null) => (total ? `Cuota ${n}/${total}` : `Cuota ${n}`),
  loanInterest: (n: number, total: number | null, loan: string) =>
    `Interés ${total ? `cuota ${n}/${total}` : `cuota ${n}`} – ${loan}`,
  transactions: (n: number) => `${n} ${n === 1 ? 'transacción' : 'transacciones'}`,
  lines:        (n: number) => `${n} ${n === 1 ? 'línea' : 'líneas'}`,
  unresolved:   (n: number) => `${n} sin categorizar`,
  cardPending:  (n: number) => `Sin registrar (${n})`,
  usdPosted:    (posted: number, total: number) =>
    `US$: ${posted} de ${total} ${total === 1 ? 'compra registrada' : 'compras registradas'}`,
  versus:       (month: string) => `vs ${month}`,
  /** The rate typed is far from the last one (or unusual when there's none): confirm before saving. */
  rateLooksWrong: (rate: string, last: string | null) => last
    ? `¿Seguro? ${rate} es muy distinto de la tasa anterior, ${last}.`
    : `¿Seguro? Una tasa de ${rate} RD$ por US$ no es lo usual.`,
  sameAs:       (month: string) => `igual que ${month}`,
  /** Screen-reader wording of the savings arrow. */
  savingsTrend: (direction: 'up' | 'down', month: string) => `${direction === 'up' ? 'Subió' : 'Bajó'} desde ${month}:`,
  uploadStep:   (index: number, total: number, kind: string) => `Estado ${index} de ${total} · ${kind}`,
  chargesTitle: (from: string, to: string) => `Compras del estado ${from} – ${to}`,
  chargesExclude: (credits: string) => `No incluye pagos ni créditos (${credits}).`,
  saveCountSuffix: (n: number) => (n > 0 ? `(${n})` : ''),
  pendingChanges:  (n: number) => `${n} ${n === 1 ? 'cambio sin guardar' : 'cambios sin guardar'}`,
  uploadResult: (newCount: number, uncategorized: number) =>
    newCount === 0
      ? 'Sin transacciones nuevas'
      : `${newCount} ${newCount === 1 ? 'nueva' : 'nuevas'} · ${uncategorized} sin categorizar`,
  lastUpload: (iso: string | null, now: Date = new Date()) => {
    if (!iso) return 'último: nunca';
    const days = Math.floor((now.getTime() - new Date(iso).getTime()) / DAY_MS);
    if (days <= 0) return 'último: hoy';
    if (days === 1) return 'último: ayer';
    return `último: hace ${days} días`;
  },
} as const;
