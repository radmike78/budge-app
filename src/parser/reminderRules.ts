/**
 * Building blocks for spoken reminders: "remind me to pay rent on the 1st at 9am",
 * "recuérdame llamar al banco mañana a las 10", "毎朝8時に家計簿をつけるようリマインドして".
 * Pure functions, no React Native imports.
 */
import type { ReminderRepeat } from '@/types';
import { addDays, daysInMonth, fromDateString, toDateString } from '@/lib/dates';
import { alt, WB_END, WB_START } from './dateRules';
import type { DateRule } from './types';

export interface ClockTime { hour: number; minute: number; /** true when am/pm or a part of day was said */ explicit?: boolean }

export interface TimeRule {
  re: RegExp;
  resolve: (m: RegExpMatchArray) => ClockTime | null;
}

export interface RepeatRule {
  re: RegExp;
  repeat: ReminderRepeat;
  /** 0 (Sunday) .. 6 for "every monday". */
  weekday?: (m: RegExpMatchArray) => number | null;
  /** 1..31 for "on the 15th of every month". */
  dayOfMonth?: (m: RegExpMatchArray) => number | null;
  /** Implied time of day ("every morning" -> 8). */
  hour?: number;
}

export interface ReminderPack {
  /** Words that make the sentence a reminder. Matched anywhere; removed from the text. */
  lead: RegExp;
  time: TimeRule[];
  repeat: RepeatRule[];
  /** Future day phrases tried first: tomorrow, next friday, june 3. The pack's futureDateRules run next. */
  day: DateRule[];
  /** Tried last, after the deadline rules: bare day-of-month ("on the 1st", "15日"). */
  dayLate: DateRule[];
  /** Leftover words to drop from the reminder text ("to", "that", "please"). */
  strip: RegExp[];
}

const clamp = (h: number, m: number): ClockTime | null => (h >= 0 && h <= 23 && m >= 0 && m <= 59 ? { hour: h, minute: m } : null);

/** "9am", "9:30 pm", "at 9 a.m." — 12-hour clock with a meridiem. */
export function meridiemRule(pre: string[] = []): TimeRule {
  const p = pre.length ? `(?:(?:${alt(pre)})\\s+)?` : '';
  return {
    re: new RegExp(`${WB_START}${p}(\\d{1,2})(?::(\\d{2}))?\\s?(a\\.?m\\.?|p\\.?m\\.?)${WB_END}`, 'iu'),
    resolve: (m) => {
      let h = Number(m[1]);
      const min = m[2] ? Number(m[2]) : 0;
      const pm = /^p/i.test(m[3]);
      if (h === 12) h = pm ? 12 : 0;
      else if (pm) h += 12;
      const t = clamp(h, min);
      return t ? { ...t, explicit: true } : null;
    },
  };
}

/**
 * "at 8", "at 20:30", "a las 8", "um 8 uhr", "à 8h30". Bare hours 1–6 are read as afternoon/evening
 * (people rarely set 3 a.m. reminders); the card lets them change it.
 */
export function clockRule(pre: string[], opts: { suffix?: string; hourSep?: string; dayParts?: Record<string, number> } = {}): TimeRule {
  const p = `(?:${alt(pre)})\\s*`;
  const parts = opts.dayParts ? `(?:(${alt(Object.keys(opts.dayParts))})\\s*)?` : '()';
  const sep = opts.hourSep ?? ':';
  const suffix = opts.suffix ? `(?:\\s*(?:${opts.suffix}))?` : '';
  const partsAfter = opts.dayParts ? `(?:\\s*(?:de la |du |del |am |in der |di |da )?(${alt(Object.keys(opts.dayParts))}))?` : '()';
  return {
    re: new RegExp(`${WB_START}${parts}${p}(\\d{1,2})(?:${sep}(\\d{2}))?${suffix}${partsAfter}${WB_END}`, 'iu'),
    resolve: (m) => {
      let h = Number(m[2]);
      const min = m[3] ? Number(m[3]) : 0;
      const part = (m[1] || m[4] || '').toLowerCase();
      const base = part && opts.dayParts ? opts.dayParts[part] : undefined;
      if (base != null) {
        if (base >= 12 && h < 12) h += 12;
        if (base < 12 && h === 12) h = 0;
      } else if (h >= 1 && h <= 6) h += 12;
      const t = clamp(h, min);
      return t ? { ...t, explicit: base != null } : null;
    },
  };
}

/** CJK "早上8点半", "午後3時15分", "저녁 8시 반". */
export function cjkClockRule(parts: Record<string, number>, hourChar: string, minuteChar: string, halfWord: string): TimeRule {
  return {
    re: new RegExp(`(?:(${alt(Object.keys(parts))})\\s*)?(\\d{1,2})\\s*${hourChar}\\s*(?:(${halfWord})|(\\d{1,2})\\s*${minuteChar}?)?`, 'u'),
    resolve: (m) => {
      let h = Number(m[2]);
      const min = m[3] ? 30 : m[4] ? Number(m[4]) : 0;
      const base = m[1] ? parts[m[1]] : undefined;
      if (base != null) {
        if (base >= 12 && h < 12) h += 12;
        if (base < 12 && h === 12) h = 0;
      } else if (h >= 1 && h <= 6) h += 12;
      const t = clamp(h, min);
      return t ? { ...t, explicit: base != null } : null;
    },
  };
}

/** "in the morning" -> 8:00, "noon" -> 12:00, "tonight" -> 20:00. */
export function wordTimeRules(words: Record<string, string[]>, hours: Record<string, number>, boundaries = true): TimeRule[] {
  return Object.entries(words).filter(([, w]) => w.length).map(([key, w]) => ({
    re: new RegExp(boundaries ? `${WB_START}(?:${alt(w)})${WB_END}` : `(?:${alt(w)})`, 'iu'),
    resolve: () => ({ hour: hours[key] ?? 9, minute: 0, explicit: true }),
  }));
}

export function repeatWords(words: string[], repeat: ReminderRepeat, hour?: number, boundaries = true): RepeatRule {
  return { re: new RegExp(boundaries ? `${WB_START}(?:${alt(words)})${WB_END}` : `(?:${alt(words)})`, 'iu'), repeat, hour };
}

/** "every monday", "tous les lundis", "毎週月曜". */
export function weeklyOnRule(pre: string[], names: Record<string, number>, opts: { suffix?: string[]; boundaries?: boolean; noSpace?: boolean } = {}): RepeatRule {
  const sp = opts.noSpace ? '\\s*' : '\\s+';
  const suffix = opts.suffix?.length ? `(?:\\s*(?:${alt(opts.suffix)}))?` : '';
  const body = `(?:${alt(pre)})${sp}(${alt(Object.keys(names))})${suffix}`;
  return {
    re: new RegExp(opts.boundaries === false ? body : `${WB_START}${body}${WB_END}`, 'iu'),
    repeat: 'weekly',
    weekday: (m) => names[m[1].toLowerCase()] ?? null,
  };
}

/** "on the 15th of every month", "el 15 de cada mes", "毎月15日". */
export function monthlyOnRule(re: RegExp, words: Record<string, number> = {}): RepeatRule {
  return { re, repeat: 'monthly', dayOfMonth: (m) => { const raw = (m[1] ?? '').toLowerCase(); const d = words[raw] ?? Number(raw.replace(/\D/g, '')); return d >= 1 && d <= 31 ? d : null; } };
}

// ---------- future day rules ----------

export function nextWeekday(weekday: number, todayStr: string, allowToday: boolean): string {
  const t = fromDateString(todayStr);
  let delta = (weekday - t.getDay() + 7) % 7;
  if (delta === 0 && !allowToday) delta = 7;
  return addDays(todayStr, delta);
}

/** "next friday", "on friday", "this friday", "el viernes", "来週の金曜": the next such day. */
export function futureWeekdayRule(names: Record<string, number>, opts: { pre?: string[]; suffix?: string[]; boundaries?: boolean; noSpace?: boolean; nextWords?: string[] } = {}): DateRule {
  const sp = opts.noSpace ? '\\s*' : '\\s+';
  const pre = opts.pre?.length ? `(?:(${alt(opts.pre)})${sp})?` : '()';
  const suffix = opts.suffix?.length ? `(?:\\s*(${alt(opts.suffix)}))?` : '()';
  const body = `${pre}(${alt(Object.keys(names))})${suffix}`;
  const next = new Set((opts.nextWords ?? []).map((w) => w.toLowerCase()));
  return {
    re: new RegExp(opts.boundaries === false ? body : `${WB_START}${body}${WB_END}`, 'iu'),
    resolve: (m, t) => {
      const day = names[m[2].toLowerCase()];
      const said = [m[1], m[3]].filter(Boolean).map((w) => w.toLowerCase());
      const strictly = said.some((w) => next.has(w) || [...next].some((n) => w.includes(n)));
      return day == null ? null : nextWeekday(day, t, !strictly);
    },
  };
}

/** "on the 1st", "el día 15", "15日に": the next such day of the month (this month if still ahead). */
export function futureDayOfMonthRule(re: RegExp, words: Record<string, number> = {}): DateRule {
  return {
    re,
    resolve: (m, t) => {
      const raw = (m[1] ?? '').toLowerCase();
      const day = words[raw] ?? Number(raw.replace(/\D/g, ''));
      if (!Number.isFinite(day) || day < 1 || day > 31) return null;
      const td = fromDateString(t);
      let y = td.getFullYear();
      let mo = td.getMonth();
      if (day < td.getDate()) { mo += 1; if (mo > 11) { mo = 0; y += 1; } }
      return toDateString(new Date(y, mo, Math.min(day, daysInMonth(y, mo))));
    },
  };
}

export function dayWords(words: string[], offset: number, boundaries = true): DateRule {
  return { re: new RegExp(boundaries ? `${WB_START}(?:${alt(words)})${WB_END}` : `(?:${alt(words)})`, 'iu'), resolve: (_m, t) => addDays(t, offset) };
}

export function nextMonthDay(day: number, todayStr: string): string {
  return futureDayOfMonthRule(/x/).resolve([String(day), String(day)] as unknown as RegExpMatchArray, todayStr) ?? todayStr;
}

export const ORDINAL_WORDS_EN: Record<string, number> = {
  first: 1, second: 2, third: 3, fourth: 4, fifth: 5, sixth: 6, seventh: 7, eighth: 8, ninth: 9, tenth: 10,
  eleventh: 11, twelfth: 12, thirteenth: 13, fourteenth: 14, fifteenth: 15, sixteenth: 16, seventeenth: 17, eighteenth: 18,
  nineteenth: 19, twentieth: 20, 'twenty-first': 21, 'twenty first': 21, 'twenty-fifth': 25, 'twenty fifth': 25, thirtieth: 30, 'thirty-first': 31, 'thirty first': 31,
};

export function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}
