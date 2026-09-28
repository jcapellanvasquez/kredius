export enum ProgressLevel {
  Neutral = 'neutral',
  Warning = 'warning',
  Danger  = 'danger',
}

export interface ProgressThresholds {
  /** Percentage at which the bar turns amber (inclusive). */
  warning: number;
  /** Percentage above which the bar turns red (exclusive). */
  danger: number;
}

export const DEFAULT_PROGRESS_THRESHOLDS: ProgressThresholds = { warning: 90, danger: 100 };

export const PROGRESS_FILL_CLASS: Record<ProgressLevel, string> = {
  [ProgressLevel.Neutral]: 'bg-bar-neutral',
  [ProgressLevel.Warning]: 'bg-bar-warning',
  [ProgressLevel.Danger]:  'bg-bar-danger',
};

export const PROGRESS_STROKE_CLASS: Record<ProgressLevel, string> = {
  [ProgressLevel.Neutral]: 'stroke-bar-neutral',
  [ProgressLevel.Warning]: 'stroke-bar-warning',
  [ProgressLevel.Danger]:  'stroke-bar-danger',
};

/** Whole-number percentage of `actual` over `total`, or null when there is no total to compare against. */
export function percentOf(actual: number, total: number | null | undefined): number | null {
  if (total == null || total <= 0) return null;
  return Math.round((actual / total) * 100);
}

export function progressLevel(
  pct: number | null,
  thresholds: ProgressThresholds = DEFAULT_PROGRESS_THRESHOLDS,
): ProgressLevel {
  if (pct == null) return ProgressLevel.Neutral;
  if (pct > thresholds.danger) return ProgressLevel.Danger;
  if (pct >= thresholds.warning) return ProgressLevel.Warning;
  return ProgressLevel.Neutral;
}
