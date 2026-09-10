import type { Frequency, RecurringRule } from '@/types';
import { addDays, addMonths, addYears, fromDateString } from './dates';

export const FREQUENCY_LABELS: Record<Frequency, string> = {
  weekly: 'Every week',
  biweekly: 'Every 2 weeks',
  monthly: 'Every month',
  yearly: 'Every year',
};

/**
 * Next occurrence after `date`. Monthly rules keep the original day-of-month
 * (anchorDay), so a rule on the 31st lands on the 28th in February and back on
 * the 31st in March.
 */
export function advance(date: string, frequency: Frequency, anchorDay?: number): string {
  switch (frequency) {
    case 'weekly':
      return addDays(date, 7);
    case 'biweekly':
      return addDays(date, 14);
    case 'monthly':
      return addMonths(date, 1, anchorDay);
    case 'yearly':
      return addYears(date, 1);
  }
}

export interface DueResult {
  /** Dates (YYYY-MM-DD) that should be logged now. */
  due: string[];
  /** The rule's new next_occurrence after logging. */
  nextOccurrence: string;
}

/**
 * Every occurrence from the rule's next_occurrence up to and including today.
 * Capped so a rule left untouched for years cannot generate thousands of rows.
 */
export function dueOccurrences(rule: Pick<RecurringRule, 'nextOccurrence' | 'frequency'>, todayStr: string, cap = 120): DueResult {
  const due: string[] = [];
  let next = rule.nextOccurrence;
  const anchorDay = fromDateString(rule.nextOccurrence).getDate();
  while (next <= todayStr && due.length < cap) {
    due.push(next);
    next = advance(next, rule.frequency, anchorDay);
  }
  return { due, nextOccurrence: next };
}

/** Approximate monthly cost of a rule, for the Budget screen. */
export function monthlyEquivalent(rule: Pick<RecurringRule, 'amount' | 'frequency'>): number {
  switch (rule.frequency) {
    case 'weekly':
      return (rule.amount * 52) / 12;
    case 'biweekly':
      return (rule.amount * 26) / 12;
    case 'monthly':
      return rule.amount;
    case 'yearly':
      return rule.amount / 12;
  }
}
