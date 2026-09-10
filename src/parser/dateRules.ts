/**
 * Table-driven date rule builders shared by every language pack.
 * All dates are local calendar strings YYYY-MM-DD.
 */
import { addDays, addMonths, addYears, daysInMonth, fromDateString, isValidDateString, toDateString } from '@/lib/dates';
import type { DateRule } from './types';

export const ISO_RULE: DateRule = { re: /\b(\d{4})-(\d{2})-(\d{2})\b/, resolve: (m) => (isValidDateString(m[0]) ? m[0] : null) };

export function alt(words: string[]): string {
  return [...words].sort((a, b) => b.length - a.length).map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
}

/** Word-boundary that also works for accented and CJK text. */
export const WB_START = '(?<![\\p{L}\\p{N}])';
export const WB_END = '(?![\\p{L}\\p{N}])';

export function wordRule(words: string[], resolve: DateRule['resolve'], boundaries = true): DateRule {
  const body = `(?:${alt(words)})`;
  return { re: new RegExp(boundaries ? `${WB_START}${body}${WB_END}` : body, 'iu'), resolve };
}

export function lastYearIfFuture(y: number, m: number, d: number, todayStr: string): string {
  let candidate = new Date(y, m, Math.min(d, daysInMonth(y, m)));
  if (toDateString(candidate) > todayStr) candidate = new Date(y - 1, m, Math.min(d, daysInMonth(y - 1, m)));
  return toDateString(candidate);
}

export function nextYearIfPast(y: number, m: number, d: number, todayStr: string, explicitYear: boolean): string {
  let candidate = toDateString(new Date(y, m, Math.min(d, daysInMonth(y, m))));
  if (!explicitYear && candidate < todayStr) candidate = toDateString(new Date(y + 1, m, Math.min(d, daysInMonth(y + 1, m))));
  return candidate;
}

export function mostRecentWeekday(weekday: number, todayStr: string, strictlyPast: boolean): string {
  const t = fromDateString(todayStr);
  let diff = (t.getDay() - weekday + 7) % 7;
  if (diff === 0 && strictlyPast) diff = 7;
  return addDays(todayStr, -diff);
}

export function endOfMonth(dateStr: string): string {
  const d = fromDateString(dateStr);
  return toDateString(new Date(d.getFullYear(), d.getMonth(), daysInMonth(d.getFullYear(), d.getMonth())));
}

// ---------- relative past ----------

export interface RelativePastWords {
  today: string[];
  yesterday: string[];
  dayBeforeYesterday: string[];
  lastWeek: string[];
  lastMonth: string[];
  /** Regex with group 1 = number of days ("(\\d+) days ago"). */
  daysAgo: RegExp;
  weeksAgo: RegExp;
  monthsAgo: RegExp;
  /** Words meaning one ("a", "un", "une") accepted in place of a digit in *Ago rules. */
  oneWords?: string[];
  boundaries?: boolean;
}

function count(m: RegExpMatchArray, oneWords: string[] = []): number {
  const raw = (m[1] ?? '').toLowerCase();
  if (!raw || oneWords.includes(raw)) return 1;
  const n = Number(raw);
  return Number.isFinite(n) ? n : 1;
}

export function relativePastRules(w: RelativePastWords): DateRule[] {
  const b = w.boundaries ?? true;
  return [
    wordRule(w.dayBeforeYesterday, (_m, t) => addDays(t, -2), b),
    wordRule(w.yesterday, (_m, t) => addDays(t, -1), b),
    wordRule(w.today, (_m, t) => t, b),
    { re: w.daysAgo, resolve: (m, t) => addDays(t, -count(m, w.oneWords)) },
    { re: w.weeksAgo, resolve: (m, t) => addDays(t, -7 * count(m, w.oneWords)) },
    { re: w.monthsAgo, resolve: (m, t) => addMonths(t, -count(m, w.oneWords)) },
    wordRule(w.lastWeek, (_m, t) => addDays(t, -7), b),
    wordRule(w.lastMonth, (_m, t) => addMonths(t, -1), b),
  ];
}

// ---------- weekdays ----------

export interface WeekdayWords {
  /** name -> 0 (Sunday) .. 6 */
  names: Record<string, number>;
  /** Prefix words meaning "last" (English "last monday"). */
  lastBefore?: string[];
  /** Suffix words meaning "last" (Spanish "lunes pasado"). */
  lastAfter?: string[];
  /** Optional neutral prefixes ("on", "this", "el", "le"). */
  prefixes?: string[];
  boundaries?: boolean;
  /** CJK: no whitespace between the "last" marker and the day name. */
  noSpace?: boolean;
}

export function weekdayRule(w: WeekdayWords): DateRule {
  const names = alt(Object.keys(w.names));
  const sp = w.noSpace ? '\\s*' : '\\s+';
  const before = w.lastBefore?.length ? `(${alt(w.lastBefore)})${sp}` : '()';
  const after = w.lastAfter?.length ? `(?:${sp}(${alt(w.lastAfter)}))?` : '()';
  const prefix = w.prefixes?.length ? `(?:(?:${alt(w.prefixes)})${sp})?` : '';
  const b = w.boundaries ?? true;
  const body = `${prefix}(?:${before})?(${names})${after}`;
  return {
    re: new RegExp(b ? `${WB_START}${body}${WB_END}` : body, 'iu'),
    resolve: (m, t) => {
      const name = m[2].toLowerCase();
      const strictly = Boolean((m[1] && m[1].trim()) || (m[3] && m[3].trim()));
      const day = w.names[name];
      return day == null ? null : mostRecentWeekday(day, t, strictly);
    },
  };
}

// ---------- month + day ----------

export interface MonthWords {
  /** name -> 0..11 */
  names: Record<string, number>;
}

/** English order: "september 3", "sept 3rd, 2025". `pre` = optional words before ("on"). */
export function monthDayRule(months: MonthWords, opts: { pre?: string[]; ordinal?: string; future?: boolean } = {}): DateRule {
  const pre = opts.pre?.length ? `(?:(?:${alt(opts.pre)})\\s+)?` : '';
  const ord = opts.ordinal ?? '';
  const re = new RegExp(`${WB_START}${pre}(${alt(Object.keys(months.names))})\\.?\\s+(\\d{1,2})${ord}(?:,?\\s+(\\d{4}))?${WB_END}`, 'iu');
  return {
    re,
    resolve: (m, t) => {
      const month = months.names[m[1].toLowerCase()];
      const day = Number(m[2]);
      if (month == null || day < 1 || day > 31) return null;
      const explicit = Boolean(m[3]);
      const y = explicit ? Number(m[3]) : fromDateString(t).getFullYear();
      if (opts.future) return nextYearIfPast(y, month, day, t, explicit);
      if (explicit) return toDateString(new Date(y, month, Math.min(day, daysInMonth(y, month))));
      return lastYearIfFuture(y, month, day, t);
    },
  };
}

/** Day-first order: "3 de septiembre", "3 septembre", "3. September", "the 3rd of september". */
export function dayMonthRule(months: MonthWords, opts: { pre?: string[]; between?: string[]; ordinal?: string; future?: boolean } = {}): DateRule {
  const pre = opts.pre?.length ? `(?:(?:${alt(opts.pre)})\\s+)?` : '';
  const between = opts.between?.length ? `(?:(?:${alt(opts.between)})\\s+)?` : '';
  const ord = opts.ordinal ?? '';
  const re = new RegExp(`${WB_START}${pre}(\\d{1,2})${ord}\\s+${between}(${alt(Object.keys(months.names))})${WB_END}(?:,?\\s+(\\d{4}))?`, 'iu');
  return {
    re,
    resolve: (m, t) => {
      const month = months.names[m[2].toLowerCase()];
      const day = Number(m[1]);
      if (month == null || day < 1 || day > 31) return null;
      const explicit = Boolean(m[3]);
      const y = explicit ? Number(m[3]) : fromDateString(t).getFullYear();
      if (opts.future) return nextYearIfPast(y, month, day, t, explicit);
      if (explicit) return toDateString(new Date(y, month, Math.min(day, daysInMonth(y, month))));
      return lastYearIfFuture(y, month, day, t);
    },
  };
}

/** CJK numeric: "9月3日", "9월 3일", optionally "2026年9月3日". */
export function cjkMonthDayRule(monthChar: string, dayChar: string, yearChar: string, future = false): DateRule {
  const re = new RegExp(`(?:(\\d{4})\\s*${yearChar}\\s*)?(\\d{1,2})\\s*${monthChar}\\s*(\\d{1,2})\\s*${dayChar}?`, 'u');
  return {
    re,
    resolve: (m, t) => {
      const month = Number(m[2]) - 1;
      const day = Number(m[3]);
      if (month < 0 || month > 11 || day < 1 || day > 31) return null;
      const explicit = Boolean(m[1]);
      const y = explicit ? Number(m[1]) : fromDateString(t).getFullYear();
      if (future) return nextYearIfPast(y, month, day, t, explicit);
      if (explicit) return toDateString(new Date(y, month, Math.min(day, daysInMonth(y, month))));
      return lastYearIfFuture(y, month, day, t);
    },
  };
}

/** "on the 3rd" -> this month, or the previous month if that day has not happened yet. */
export function dayOfMonthRule(re: RegExp): DateRule {
  return {
    re,
    resolve: (m, t) => {
      const day = Number(m[1]);
      const td = fromDateString(t);
      if (day < 1 || day > 31) return null;
      let y = td.getFullYear();
      let mo = td.getMonth();
      if (day > td.getDate()) {
        mo -= 1;
        if (mo < 0) { mo = 11; y -= 1; }
      }
      return toDateString(new Date(y, mo, Math.min(day, daysInMonth(y, mo))));
    },
  };
}

/** "9/3", "9/3/2025" (month/day by default; dayFirst for European locales). */
export function slashRule(dayFirst: boolean): DateRule {
  return {
    re: /(?<![\d/])(\d{1,2})[/.](\d{1,2})(?:[/.](\d{2,4}))?(?![\d/])/,
    resolve: (m, t) => {
      let a = Number(m[1]);
      let b = Number(m[2]);
      if (dayFirst) [a, b] = [b, a];
      let y = m[3] ? Number(m[3]) : fromDateString(t).getFullYear();
      if (m[3] && m[3].length === 2) y += 2000;
      if (a > 12 && b <= 12) [a, b] = [b, a];
      if (a < 1 || a > 12 || b < 1 || b > 31) return null;
      if (m[3]) return toDateString(new Date(y, a - 1, Math.min(b, daysInMonth(y, a - 1))));
      return lastYearIfFuture(y, a - 1, b, t);
    },
  };
}

// ---------- relative future (goal deadlines) ----------

export interface RelativeFutureWords {
  endOfYear: string[];
  endOfNextYear: string[];
  endOfMonth: string[];
  nextYear: string[];
  nextMonth: string[];
  christmas?: string[];
  /** group 1 = number */
  inDays: RegExp;
  inWeeks: RegExp;
  inMonths: RegExp;
  inYears: RegExp;
  oneWords?: string[];
  /** "by december" -> last day of that month. group 1 = month name, group 2 = optional year. */
  byMonth?: DateRule;
  seasons?: { spring?: string[]; summer?: string[]; fall?: string[]; winter?: string[] };
  boundaries?: boolean;
}

function seasonRule(words: string[] | undefined, mmdd: string, b: boolean): DateRule[] {
  if (!words?.length) return [];
  return [wordRule(words, (_m, t) => { const y = fromDateString(t).getFullYear(); const c = `${y}-${mmdd}`; return c >= t ? c : `${y + 1}-${mmdd}`; }, b)];
}

export function relativeFutureRules(w: RelativeFutureWords): DateRule[] {
  const b = w.boundaries ?? true;
  return [
    wordRule(w.endOfNextYear, (_m, t) => `${fromDateString(t).getFullYear() + 1}-12-31`, b),
    wordRule(w.endOfYear, (_m, t) => `${fromDateString(t).getFullYear()}-12-31`, b),
    wordRule(w.endOfMonth, (_m, t) => endOfMonth(t), b),
    wordRule(w.nextYear, (_m, t) => `${fromDateString(t).getFullYear() + 1}-01-01`, b),
    wordRule(w.nextMonth, (_m, t) => endOfMonth(addMonths(t, 1)), b),
    ...(w.christmas?.length ? [wordRule(w.christmas, (_m, t) => { const y = fromDateString(t).getFullYear(); const c = `${y}-12-25`; return c >= t ? c : `${y + 1}-12-25`; }, b)] : []),
    { re: w.inDays, resolve: (m, t) => addDays(t, count(m, w.oneWords)) },
    { re: w.inWeeks, resolve: (m, t) => addDays(t, 7 * count(m, w.oneWords)) },
    { re: w.inMonths, resolve: (m, t) => addMonths(t, count(m, w.oneWords)) },
    { re: w.inYears, resolve: (m, t) => addYears(t, count(m, w.oneWords)) },
    ...seasonRule(w.seasons?.spring, '03-20', b),
    ...seasonRule(w.seasons?.summer, '06-21', b),
    ...seasonRule(w.seasons?.fall, '09-22', b),
    ...seasonRule(w.seasons?.winter, '12-21', b),
  ];
}

/** "by december", "para diciembre", "bis dezember": last day of the named month, next year if already past. */
export function byMonthRule(months: MonthWords, pre: string[]): DateRule {
  const re = new RegExp(`${WB_START}(?:${alt(pre)})\\s+(${alt(Object.keys(months.names))})${WB_END}(?:\\s+(\\d{4}))?`, 'iu');
  return {
    re,
    resolve: (m, t) => {
      const month = months.names[m[1].toLowerCase()];
      if (month == null) return null;
      const explicit = Boolean(m[2]);
      const y = explicit ? Number(m[2]) : fromDateString(t).getFullYear();
      let candidate = toDateString(new Date(y, month, daysInMonth(y, month)));
      if (!explicit && candidate < t) candidate = toDateString(new Date(y + 1, month, daysInMonth(y + 1, month)));
      return candidate;
    },
  };
}

/** "by 2027" */
export function byYearRule(pre: string[]): DateRule {
  return { re: new RegExp(`${WB_START}(?:${alt(pre)})\\s+(20\\d{2})${WB_END}`, 'iu'), resolve: (m) => `${m[1]}-01-01` };
}

/** CJK "12月まで" / "12月前" / "12월까지": last day of that month. */
export function cjkByMonthRule(monthChar: string, suffix: string[]): DateRule {
  const re = new RegExp(`(?:(\\d{4})\\s*年)?(\\d{1,2})\\s*${monthChar}\\s*(?:${alt(suffix)})`, 'u');
  return {
    re,
    resolve: (m, t) => {
      const month = Number(m[2]) - 1;
      if (month < 0 || month > 11) return null;
      const explicit = Boolean(m[1]);
      const y = explicit ? Number(m[1]) : fromDateString(t).getFullYear();
      let candidate = toDateString(new Date(y, month, daysInMonth(y, month)));
      if (!explicit && candidate < t) candidate = toDateString(new Date(y + 1, month, daysInMonth(y + 1, month)));
      return candidate;
    },
  };
}

export interface DateExtraction {
  text: string;
  date: string | null;
  phrase: string | null;
}

export function applyRules(rules: DateRule[], text: string, todayStr: string): DateExtraction {
  for (const rule of rules) {
    const m = text.match(rule.re);
    if (!m) continue;
    const date = rule.resolve(m, todayStr);
    if (!date) continue;
    const cleaned = (text.slice(0, m.index) + ' ' + text.slice((m.index ?? 0) + m[0].length)).replace(/\s+/g, ' ').trim();
    return { text: cleaned, date, phrase: m[0] };
  }
  return { text, date: null, phrase: null };
}
