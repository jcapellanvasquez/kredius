import { ImportStatus, StatementAccountKind } from './budget.enums';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Every user-facing label on the budget screen. */
export const BUDGET_TEXT = {
  title:            'Presupuesto',
  navLabel:         'Presupuesto',
  update:           'Actualizar',
  process:          'Procesar',
  processing:       'Procesando…',
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
  usePrevious:      'Usar',
  usePreviousLabel: 'Usar el presupuesto del mes anterior',
  saved:            'Guardado',
  saveFailed:       'No se pudo guardar',
  other:            'Otra',
  searchCategory:   'Buscar categoría',
  loans:            'Préstamos',
  noMatches:        'Sin resultados',

  saveChanges:      'Guardar cambios',
  saving:           'Guardando…',
  unsavedConfirm:   'Tienes cambios de presupuesto sin guardar. ¿Salir y descartarlos?',

  income:           'Ingreso',
  charges:          'Consumos',
  payments:         'Pagos',
  monthResult:      'Resultado del mes',

  loadError:        'No se pudo cargar el presupuesto.',
  retry:            'Reintentar',

  importLines:      'Líneas del corte',
  importNotFound:   'No se encontró el corte.',

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
  previousBudget: (amount: string) => `${amount} (mes anterior)`,
  transactions: (n: number) => `${n} ${n === 1 ? 'transacción' : 'transacciones'}`,
  lines:        (n: number) => `${n} ${n === 1 ? 'línea' : 'líneas'}`,
  unresolved:   (n: number) => `${n} sin categorizar`,
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
