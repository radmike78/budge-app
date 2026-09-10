/**
 * Small, dependency-free date helpers. All "date strings" are local calendar
 * dates formatted YYYY-MM-DD, which is what the database stores.
 */

export const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

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

export function monthLabel(monthKeyStr: string): string {
  const [y, m] = monthKeyStr.split('-').map(Number);
  return `${MONTH_NAMES[m - 1]} ${y}`;
}

export function monthName(monthKeyStr: string): string {
  const m = Number(monthKeyStr.split('-')[1]);
  return MONTH_NAMES[m - 1];
}

export function daysBetween(fromStr: string, toStr: string): number {
  const a = fromDateString(fromStr);
  const b = fromDateString(toStr);
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

/** "Today", "Yesterday", "Mon, Sep 3", or "Sep 3, 2025" for other years. */
export function friendlyDate(dateStr: string, todayStr: string = today()): string {
  if (dateStr === todayStr) return 'Today';
  if (dateStr === addDays(todayStr, -1)) return 'Yesterday';
  const d = fromDateString(dateStr);
  const short = `${MONTH_NAMES[d.getMonth()].slice(0, 3)} ${d.getDate()}`;
  if (d.getFullYear() !== fromDateString(todayStr).getFullYear()) return `${short}, ${d.getFullYear()}`;
  return `${DAY_NAMES[d.getDay()].slice(0, 3)}, ${short}`;
}

/** "September 3" or "September 3, 2027" if not this year. */
export function longDate(dateStr: string, todayStr: string = today()): string {
  const d = fromDateString(dateStr);
  const base = `${MONTH_NAMES[d.getMonth()]} ${d.getDate()}`;
  if (d.getFullYear() !== fromDateString(todayStr).getFullYear()) return `${base}, ${d.getFullYear()}`;
  return base;
}

export function nowIso(): string {
  return new Date().toISOString();
}
