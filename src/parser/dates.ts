/** Compatibility wrappers around the table-driven rules; default to English. */
import { applyRules, type DateExtraction } from './dateRules';
import { getPack } from './packs';

export type { DateExtraction };

export function extractPastDate(text: string, todayStr: string, language?: string): DateExtraction {
  return applyRules(getPack(language).pastDateRules, text, todayStr);
}

export function extractFutureDate(text: string, todayStr: string, language?: string): DateExtraction {
  return applyRules(getPack(language).futureDateRules, text, todayStr);
}
