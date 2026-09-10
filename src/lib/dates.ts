/**
 * Small, dependency-free date helpers. All "date strings" are local calendar
 * dates formatted YYYY-MM-DD, which is what the database stores.
 */

export const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** Locale-specific names and layouts for human dates. Defaults to English. */
export interface DateFormat {
  months: string[];
  monthsShort: string[];
  weekdaysShort: string[];
  longDate: (day: number, month: string, year: number | null) => string;
  shortDate: (day: number, monthShort: string, weekdayShort: string | null, year: number | null) => string;
  monthYear: (month: string, year: number) => string;
  today?: string;
  yesterday?: string;
}

export const EN_DATE_FORMAT: DateFormat = {
  months: MONTH_NAMES,
  monthsShort: MONTH_NAMES.map((m) => m.slice(0, 3)),
  weekdaysShort: DAY_NAMES.map((d) => d.slice(0, 3)),
  longDate: (day, month, year) => (year ? `${month} ${day}, ${year}` : `${month} ${day}`),
  shortDate: (day, monthShort, weekdayShort, year) => (year ? `${monthShort} ${day}, ${year}` : `${weekdayShort}, ${monthShort} ${day}`),
  monthYear: (month, year) => `${month} ${year}`,
};

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

export function toDateString(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function fromDateString(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

export function isValidDateString(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = fromDateString(s);
  return toDateString(d) === s;
}

export function today(): string {
  return toDateString(new Date());
}

export function addDays(dateStr: string, days: number): string {
  const d = fromDateString(dateStr);
  d.setDate(d.getDate() + days);
  return toDateString(d);
}

export function daysInMonth(year: number, monthIndex: number): number {
  return new Date(year, monthIndex + 1, 0).getDate();
}

/** Adds calendar months, clamping the day to the target month's length (Jan 31 + 1 month = Feb 28/29). */
export function addMonths(dateStr: string, months: number, anchorDay?: number): string {
  const d = fromDateString(dateStr);
  const day = anchorDay ?? d.getDate();
  const target = new Date(d.getFullYear(), d.getMonth() + months, 1);
  const clamped = Math.min(day, daysInMonth(target.getFullYear(), target.getMonth()));
  target.setDate(clamped);
  return toDateString(target);
}

export function addYears(dateStr: string, years: number): string {
  const d = fromDateString(dateStr);
  const target = new Date(d.getFullYear() + years, d.getMonth(), 1);
  target.setDate(Math.min(d.getDate(), daysInMonth(target.getFullYear(), target.getMonth())));
  return toDateString(target);
}

/** YYYY-MM for the given date string. */
export function monthKey(dateStr: string): string {
  return dateStr.slice(0, 7);
}

export function currentMonthKey(): string {
  return monthKey(today());
}

export function monthRange(monthKeyStr: string): { start: string; end: string } {
  const [y, m] = monthKeyStr.split('-').map(Number);
  const start = `${y}-${pad(m)}-01`;
  const end = `${y}-${pad(m)}-${pad(daysInMonth(y, m - 1))}`;
  return { start, end };
}

export function shiftMonthKey(monthKeyStr: string, delta: number): string {
  const [y, m] = monthKeyStr.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}

export function monthLabel(monthKeyStr: string, fmt: DateFormat = EN_DATE_FORMAT): string {
  const [y, m] = monthKeyStr.split('-').map(Number);
  return fmt.monthYear(fmt.months[m - 1], y);
}

export function monthName(monthKeyStr: string, fmt: DateFormat = EN_DATE_FORMAT): string {
  const m = Number(monthKeyStr.split('-')[1]);
  return fmt.months[m - 1];
}

export function daysBetween(fromStr: string, toStr: string): number {
  const a = fromDateString(fromStr);
  const b = fromDateString(toStr);
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

/** "Today", "Yesterday", "Mon, Sep 3", or "Sep 3, 2025" for other years. */
export function friendlyDate(dateStr: string, todayStr: string = today(), fmt: DateFormat = EN_DATE_FORMAT): string {
  if (dateStr === todayStr) return fmt.today ?? 'Today';
  if (dateStr === addDays(todayStr, -1)) return fmt.yesterday ?? 'Yesterday';
  const d = fromDateString(dateStr);
  const otherYear = d.getFullYear() !== fromDateString(todayStr).getFullYear();
  return fmt.shortDate(d.getDate(), fmt.monthsShort[d.getMonth()], otherYear ? null : fmt.weekdaysShort[d.getDay()], otherYear ? d.getFullYear() : null);
}

/** "September 3" or "September 3, 2027" if not this year. */
export function longDate(dateStr: string, todayStr: string = today(), fmt: DateFormat = EN_DATE_FORMAT): string {
  const d = fromDateString(dateStr);
  const otherYear = d.getFullYear() !== fromDateString(todayStr).getFullYear();
  return fmt.longDate(d.getDate(), fmt.months[d.getMonth()], otherYear ? d.getFullYear() : null);
}

export function nowIso(): string {
  return new Date().toISOString();
}
