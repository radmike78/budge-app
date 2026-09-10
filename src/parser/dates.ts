import { addDays, addMonths, addYears, daysInMonth, fromDateString, isValidDateString, toDateString } from '@/lib/dates';

const MONTHS: Record<string, number> = {
  january: 0, jan: 0, february: 1, feb: 1, march: 2, mar: 2, april: 3, apr: 3, may: 4, june: 5, jun: 5,
  july: 6, jul: 6, august: 7, aug: 7, september: 8, sept: 8, sep: 8, october: 9, oct: 9,
  november: 10, nov: 10, december: 11, dec: 11,
};
const MONTH_ALT = Object.keys(MONTHS).sort((a, b) => b.length - a.length).join('|');

const WEEKDAYS: Record<string, number> = {
  sunday: 0, sun: 0, monday: 1, mon: 1, tuesday: 2, tue: 2, tues: 2, wednesday: 3, wed: 3,
  thursday: 4, thu: 4, thur: 4, thurs: 4, friday: 5, fri: 5, saturday: 6, sat: 6,
};
const WEEKDAY_ALT = Object.keys(WEEKDAYS).sort((a, b) => b.length - a.length).join('|');

export interface DateExtraction {
  /** Text with the date phrase removed. */
  text: string;
  /** YYYY-MM-DD or null if nothing was found. */
  date: string | null;
  /** The phrase that was matched (for debugging). */
  phrase: string | null;
}

function lastYearIfFuture(y: number, m: number, d: number, todayStr: string): string {
  let candidate = new Date(y, m, Math.min(d, daysInMonth(y, m)));
  if (toDateString(candidate) > todayStr) candidate = new Date(y - 1, m, Math.min(d, daysInMonth(y - 1, m)));
  return toDateString(candidate);
}

function mostRecentWeekday(weekday: number, todayStr: string, strictlyPast: boolean): string {
  const t = fromDateString(todayStr);
  let diff = (t.getDay() - weekday + 7) % 7;
  if (diff === 0 && strictlyPast) diff = 7;
  return addDays(todayStr, -diff);
}

type Rule = { re: RegExp; resolve: (m: RegExpMatchArray, todayStr: string) => string | null };

/** Past-leaning rules used for transactions ("when did this happen?"). */
const PAST_RULES: Rule[] = [
  { re: /\b(\d{4})-(\d{2})-(\d{2})\b/, resolve: (m) => (isValidDateString(m[0]) ? m[0] : null) },
  { re: /\b(?:the )?day before yesterday\b/, resolve: (_m, t) => addDays(t, -2) },
  { re: /\byesterday(?: morning| afternoon| evening| night)?\b/, resolve: (_m, t) => addDays(t, -1) },
  { re: /\blast night\b/, resolve: (_m, t) => addDays(t, -1) },
  { re: /\b(?:earlier )?(?:today|tonight|this morning|this afternoon|this evening)\b/, resolve: (_m, t) => t },
  { re: /\b(\d+) days? ago\b/, resolve: (m, t) => addDays(t, -Number(m[1])) },
  { re: /\b(?:a|1|one) week ago\b/, resolve: (_m, t) => addDays(t, -7) },
  { re: /\b(\d+) weeks? ago\b/, resolve: (m, t) => addDays(t, -7 * Number(m[1])) },
  { re: /\b(?:a|1|one) month ago\b/, resolve: (_m, t) => addMonths(t, -1) },
  { re: /\b(\d+) months? ago\b/, resolve: (m, t) => addMonths(t, -Number(m[1])) },
  { re: /\blast week\b/, resolve: (_m, t) => addDays(t, -7) },
  { re: /\blast month\b/, resolve: (_m, t) => addMonths(t, -1) },
  // "on september 3rd", "sept 3", "september 3, 2025"
  {
    re: new RegExp(`\\b(?:on |back on )?(${MONTH_ALT})\\.? (\\d{1,2})(?:st|nd|rd|th)?(?:,? (\\d{4}))?\\b`),
    resolve: (m, t) => {
      const month = MONTHS[m[1]];
      const day = Number(m[2]);
      if (day < 1 || day > 31) return null;
      if (m[3]) return toDateString(new Date(Number(m[3]), month, Math.min(day, daysInMonth(Number(m[3]), month))));
      return lastYearIfFuture(fromDateString(t).getFullYear(), month, day, t);
    },
  },
  // "the 3rd of september", "3 september"
  {
    re: new RegExp(`\\b(?:on )?(?:the )?(\\d{1,2})(?:st|nd|rd|th)? (?:of )?(${MONTH_ALT})\\b(?:,? (\\d{4}))?`),
    resolve: (m, t) => {
      const month = MONTHS[m[2]];
      const day = Number(m[1]);
      if (day < 1 || day > 31) return null;
      if (m[3]) return toDateString(new Date(Number(m[3]), month, Math.min(day, daysInMonth(Number(m[3]), month))));
      return lastYearIfFuture(fromDateString(t).getFullYear(), month, day, t);
    },
  },
  // "on the 3rd" -> this month, or previous month if that day hasn't happened yet
  {
    re: /\bon the (\d{1,2})(?:st|nd|rd|th)\b/,
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
  },
  // "last monday", "on monday", "this monday", "monday"
  {
    re: new RegExp(`\\b(last |on |this |past )?(${WEEKDAY_ALT})\\b`),
    resolve: (m, t) => mostRecentWeekday(WEEKDAYS[m[2]], t, (m[1] ?? '').trim() === 'last' || (m[1] ?? '').trim() === 'past'),
  },
  // "9/3", "9/3/2025", "09/03/25" -> month/day (US), falling back to day/month when needed
  {
    re: /\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/,
    resolve: (m, t) => {
      let a = Number(m[1]);
      let b = Number(m[2]);
      let y = m[3] ? Number(m[3]) : fromDateString(t).getFullYear();
      if (m[3] && m[3].length === 2) y += 2000;
      if (a > 12 && b <= 12) [a, b] = [b, a];
      if (a < 1 || a > 12 || b < 1 || b > 31) return null;
      if (m[3]) return toDateString(new Date(y, a - 1, Math.min(b, daysInMonth(y, a - 1))));
      return lastYearIfFuture(y, a - 1, b, t);
    },
  },
];

/** Future-leaning rules used for goal target dates ("by when?"). */
const FUTURE_RULES: Rule[] = [
  { re: /\b(\d{4})-(\d{2})-(\d{2})\b/, resolve: (m) => (isValidDateString(m[0]) ? m[0] : null) },
  { re: /\b(?:by |before )?(?:the )?end of (?:the |this )?year\b/, resolve: (_m, t) => `${fromDateString(t).getFullYear()}-12-31` },
  { re: /\b(?:by |before )?(?:the )?end of next year\b/, resolve: (_m, t) => `${fromDateString(t).getFullYear() + 1}-12-31` },
  { re: /\b(?:by |before )?(?:the )?end of (?:the |this )?month\b/, resolve: (_m, t) => { const d = fromDateString(t); return toDateString(new Date(d.getFullYear(), d.getMonth(), daysInMonth(d.getFullYear(), d.getMonth()))); } },
  { re: /\b(?:by |before )?next year\b/, resolve: (_m, t) => `${fromDateString(t).getFullYear() + 1}-01-01` },
  { re: /\b(?:by |before )?next month\b/, resolve: (_m, t) => { const n = addMonths(t, 1); const d = fromDateString(n); return toDateString(new Date(d.getFullYear(), d.getMonth(), daysInMonth(d.getFullYear(), d.getMonth()))); } },
  { re: /\b(?:by |before )?christmas\b/, resolve: (_m, t) => { const y = fromDateString(t).getFullYear(); const c = `${y}-12-25`; return c >= t ? c : `${y + 1}-12-25`; } },
  { re: /\bin (\d+) (?:days?)\b/, resolve: (m, t) => addDays(t, Number(m[1])) },
  { re: /\bin (?:a|1|one) week\b/, resolve: (_m, t) => addDays(t, 7) },
  { re: /\bin (\d+) weeks?\b/, resolve: (m, t) => addDays(t, 7 * Number(m[1])) },
  { re: /\bin (?:a|1|one) month\b/, resolve: (_m, t) => addMonths(t, 1) },
  { re: /\bin (\d+) months?\b/, resolve: (m, t) => addMonths(t, Number(m[1])) },
  { re: /\bin (?:a|1|one) year\b/, resolve: (_m, t) => addYears(t, 1) },
  { re: /\bin (\d+) years?\b/, resolve: (m, t) => addYears(t, Number(m[1])) },
  // "by december 15", "by dec 15 2027"
  {
    re: new RegExp(`\\b(?:by |before |until |due )?(${MONTH_ALT})\\.? (\\d{1,2})(?:st|nd|rd|th)?(?:,? (\\d{4}))?\\b`),
    resolve: (m, t) => {
      const month = MONTHS[m[1]];
      const day = Number(m[2]);
      if (day < 1 || day > 31) return null;
      const y = m[3] ? Number(m[3]) : fromDateString(t).getFullYear();
      let candidate = toDateString(new Date(y, month, Math.min(day, daysInMonth(y, month))));
      if (!m[3] && candidate < t) candidate = toDateString(new Date(y + 1, month, Math.min(day, daysInMonth(y + 1, month))));
      return candidate;
    },
  },
  // "by the 15th of december"
  {
    re: new RegExp(`\\b(?:by |before |until )?(?:the )?(\\d{1,2})(?:st|nd|rd|th)? (?:of )?(${MONTH_ALT})\\b(?:,? (\\d{4}))?`),
    resolve: (m, t) => {
      const month = MONTHS[m[2]];
      const day = Number(m[1]);
      if (day < 1 || day > 31) return null;
      const y = m[3] ? Number(m[3]) : fromDateString(t).getFullYear();
      let candidate = toDateString(new Date(y, month, Math.min(day, daysInMonth(y, month))));
      if (!m[3] && candidate < t) candidate = toDateString(new Date(y + 1, month, Math.min(day, daysInMonth(y + 1, month))));
      return candidate;
    },
  },
  // "by december" / "by december 2027" -> last day of that month
  {
    re: new RegExp(`\\b(?:by |before |until |in )(${MONTH_ALT})\\b(?: (\\d{4}))?`),
    resolve: (m, t) => {
      const month = MONTHS[m[1]];
      const y = m[2] ? Number(m[2]) : fromDateString(t).getFullYear();
      let candidate = toDateString(new Date(y, month, daysInMonth(y, month)));
      if (!m[2] && candidate < t) candidate = toDateString(new Date(y + 1, month, daysInMonth(y + 1, month)));
      return candidate;
    },
  },
  // "by 2027"
  { re: /\b(?:by |before )(20\d{2})\b/, resolve: (m) => `${m[1]}-01-01` },
  // "by summer" / "by next summer" -> rough anchors
  { re: /\b(?:by |before )(?:next )?spring\b/, resolve: (_m, t) => { const y = fromDateString(t).getFullYear(); const c = `${y}-03-20`; return c >= t ? c : `${y + 1}-03-20`; } },
  { re: /\b(?:by |before )(?:next )?summer\b/, resolve: (_m, t) => { const y = fromDateString(t).getFullYear(); const c = `${y}-06-21`; return c >= t ? c : `${y + 1}-06-21`; } },
  { re: /\b(?:by |before )(?:next )?(?:fall|autumn)\b/, resolve: (_m, t) => { const y = fromDateString(t).getFullYear(); const c = `${y}-09-22`; return c >= t ? c : `${y + 1}-09-22`; } },
  { re: /\b(?:by |before )(?:next )?winter\b/, resolve: (_m, t) => { const y = fromDateString(t).getFullYear(); const c = `${y}-12-21`; return c >= t ? c : `${y + 1}-12-21`; } },
];

function apply(rules: Rule[], text: string, todayStr: string): DateExtraction {
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

/** Finds when a transaction happened. Defaults to nothing (caller uses today). */
export function extractPastDate(text: string, todayStr: string): DateExtraction {
  return apply(PAST_RULES, text, todayStr);
}

/** Finds a goal deadline. */
export function extractFutureDate(text: string, todayStr: string): DateExtraction {
  return apply(FUTURE_RULES, text, todayStr);
}
