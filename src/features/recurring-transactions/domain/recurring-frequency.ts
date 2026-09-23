export type RecurringFrequency = 'daily' | 'weekly' | 'monthly' | 'yearly';

export function isValidRecurringFrequency(val: unknown): val is RecurringFrequency {
  return typeof val === 'string' && ['daily', 'weekly', 'monthly', 'yearly'].includes(val);
}

export function getFrequencyLabel(frequency: RecurringFrequency): string {
  switch (frequency) {
    case 'daily':
      return 'Harian';
    case 'weekly':
      return 'Mingguan';
    case 'monthly':
      return 'Bulanan';
    case 'yearly':
      return 'Tahunan';
    default:
      return frequency;
  }
}

/**
 * Returns number of days in a given year and month (1-indexed month: 1=Jan, 12=Dec).
 */
export function getDaysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/**
 * Parses YYYY-MM-DD into { year, month, day } (month 1-indexed)
 */
export function parseDateParts(dateStr: string): { year: number; month: number; day: number } {
  const parts = dateStr.split('-');
  return {
    year: parseInt(parts[0], 10),
    month: parseInt(parts[1], 10),
    day: parseInt(parts[2], 10),
  };
}

/**
 * Formats year, month, day into YYYY-MM-DD
 */
export function formatDateParts(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/**
 * Calculate the next occurrence date preserving anchor day/month to prevent month-end / leap-year drift.
 *
 * Examples:
 * - monthly from Jan 31 with anchorDay=31:
 *   -> Feb 28 (or 29) -> Mar 31 -> Apr 30 -> May 31
 * - yearly from Feb 29 2028 with anchorMonth=2, anchorDay=29:
 *   -> Feb 28 2029 -> Feb 28 2030 -> Feb 28 2031 -> Feb 29 2032
 */
export function calculateNextOccurrence(
  currentDateStr: string,
  frequency: RecurringFrequency,
  anchorDay?: number,
  anchorMonth?: number
): string {
  const { year, month, day } = parseDateParts(currentDateStr);
  const effAnchorDay = anchorDay ?? day;
  const effAnchorMonth = anchorMonth ?? month;

  switch (frequency) {
    case 'daily': {
      const d = new Date(Date.UTC(year, month - 1, day + 1));
      return d.toISOString().slice(0, 10);
    }
    case 'weekly': {
      const d = new Date(Date.UTC(year, month - 1, day + 7));
      return d.toISOString().slice(0, 10);
    }
    case 'monthly': {
      let targetYear = year;
      let targetMonth = month + 1;
      if (targetMonth > 12) {
        targetYear += 1;
        targetMonth = 1;
      }
      const maxDays = getDaysInMonth(targetYear, targetMonth);
      const effectiveDay = Math.min(effAnchorDay, maxDays);
      return formatDateParts(targetYear, targetMonth, effectiveDay);
    }
    case 'yearly': {
      const targetYear = year + 1;
      const maxDays = getDaysInMonth(targetYear, effAnchorMonth);
      const effectiveDay = Math.min(effAnchorDay, maxDays);
      return formatDateParts(targetYear, effAnchorMonth, effectiveDay);
    }
  }
}
