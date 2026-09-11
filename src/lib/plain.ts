/**
 * Plain-language sentences for the Home, Budget and Goals screens.
 * Tone: calm, factual, no guilt. Wording comes from the active locale.
 */
import type { Category, CategoryTotal, Goal, GoalKind, MonthStats, Reminder } from '@/types';
import type { LocaleDef } from '@/i18n/types';
import { en } from '@/i18n/locales/en';
import { addDays, daysBetween, friendlyDate, longDate, monthName, type DateFormat } from './dates';
import { formatMoney } from './money';

function moneyFn(currency: string, locale: LocaleDef) {
  return (n: number) => formatMoney(n, currency, { compact: true, format: locale.format });
}

function dateFmt(locale: LocaleDef): DateFormat {
  return { ...locale.format, today: locale.s.today, yesterday: locale.s.yesterday };
}

export function monthSummarySentence(stats: MonthStats, currency: string, isCurrentMonth: boolean, locale: LocaleDef = en): string {
  return locale.sentences.monthSummary(stats, moneyFn(currency, locale), monthName(stats.month, dateFmt(locale)), isCurrentMonth);
}

export function topCategorySentence(stats: MonthStats, categories: Category[], currency: string, locale: LocaleDef = en, nameOf: (c: Category) => string = (c) => c.name): string | null {
  const expenseCats = new Map(categories.filter((c) => c.kind === 'expense').map((c) => [c.id, c]));
  const spend = stats.byCategory.filter((b) => b.categoryId && expenseCats.has(b.categoryId)).sort((a, b) => b.total - a.total);
  if (spend.length === 0 || stats.expenses === 0) return null;
  const top = spend[0];
  const cat = expenseCats.get(top.categoryId!)!;
  return locale.sentences.topCategory(nameOf(cat), moneyFn(currency, locale)(top.total), top.total / stats.expenses, spend.length === 1);
}

export function categoryLineSentence(cat: Category, spent: number, currency: string, locale: LocaleDef = en): string {
  return locale.sentences.categoryLine(cat, spent, moneyFn(currency, locale));
}

export interface GoalProgress {
  remaining: number;
  /** 0..1 */
  fraction: number;
  sentence: string;
  status: 'ahead' | 'behind' | 'on_track' | 'done' | 'no_date';
}

/**
 * "You're $180 away, on pace to hit it 2 weeks early."
 * Pace is the average saved per day since the goal was created.
 */
export function goalProgress(goal: Goal, currency: string, todayStr: string, locale: LocaleDef = en): GoalProgress {
  const money = moneyFn(currency, locale);
  const S = locale.sentences;
  const fmt = dateFmt(locale);
  const remaining = Math.max(0, goal.targetAmount - goal.currentAmount);
  const fraction = goal.targetAmount > 0 ? Math.min(1, goal.currentAmount / goal.targetAmount) : 0;

  if (goal.completed || remaining === 0) return { remaining: 0, fraction: 1, status: 'done', sentence: goal.kind === 'debt' ? S.goalDoneDebt(goal, money) : S.goalDone(goal, money) };

  const createdDay = goal.createdAt.slice(0, 10);
  const elapsedDays = Math.max(1, daysBetween(createdDay, todayStr));
  const perDay = goal.currentAmount / elapsedDays;

  if (!goal.targetDate) {
    if (goal.currentAmount === 0) return { remaining, fraction, status: 'no_date', sentence: S.goalNoDateEmpty(money(goal.targetAmount)) };
    return { remaining, fraction, status: 'no_date', sentence: S.goalNoDate(money(remaining)) };
  }

  const daysLeft = daysBetween(todayStr, goal.targetDate);
  const dateText = longDate(goal.targetDate, todayStr, fmt);
  if (daysLeft < 0) return { remaining, fraction, status: 'behind', sentence: S.goalDatePassed(money(remaining), dateText) };
  const neededPerWeek = daysLeft > 0 ? (remaining / daysLeft) * 7 : remaining;

  if (perDay <= 0) {
    if (daysLeft === 0) return { remaining, fraction, status: 'behind', sentence: S.goalDueToday(money(remaining)) };
    return { remaining, fraction, status: 'on_track', sentence: S.goalNoPace(money(remaining), money(Math.ceil(neededPerWeek)), dateText) };
  }

  const daysToFinish = Math.ceil(remaining / perDay);
  const projected = addDays(todayStr, daysToFinish);
  const delta = daysBetween(projected, goal.targetDate);
  if (Math.abs(delta) <= 3) return { remaining, fraction, status: 'on_track', sentence: S.goalOnTrack(money(remaining), dateText) };
  if (delta > 0) return { remaining, fraction, status: 'ahead', sentence: S.goalAhead(money(remaining), S.duration(delta)) };
  return { remaining, fraction, status: 'behind', sentence: S.goalBehind(money(remaining), S.duration(delta), dateText, money(Math.ceil(neededPerWeek))) };
}

export function balanceSentence(startingBalance: number | null, allIncome: number, allExpenses: number, currency: string, locale: LocaleDef = en): string | null {
  if (startingBalance == null) return null;
  const balance = startingBalance + allIncome - allExpenses;
  return locale.sentences.balance(formatMoney(balance, currency, { format: locale.format }));
}

/** Ordered list of {category, total} for the expense breakdown. */
export function expenseBreakdown(stats: MonthStats, categories: Category[]): { category: Category | null; total: number; share: number }[] {
  const byId = new Map(categories.map((c) => [c.id, c]));
  return stats.byCategory
    .filter((b) => (b.categoryId ? byId.get(b.categoryId)?.kind !== 'income' : true))
    .map((b: CategoryTotal) => ({ category: b.categoryId ? byId.get(b.categoryId) ?? null : null, total: b.total, share: stats.expenses > 0 ? b.total / stats.expenses : 0 }))
    .sort((a, b) => b.total - a.total);
}

/**
 * "The plan: set aside about $417 a month ($97 a week) until Sep 2027."
 * Shown before a goal is saved so the user sees what they are signing up for.
 */
export function goalPlanSentence(targetAmount: number, currentAmount: number, targetDate: string | null, kind: GoalKind, currency: string, todayStr: string, locale: LocaleDef = en): string {
  const money = moneyFn(currency, locale);
  const S = locale.sentences;
  const remaining = Math.max(0, targetAmount - currentAmount);
  const debt = kind === 'debt';
  if (!targetDate || remaining === 0) return S.goalPlanNoDate(money(remaining), debt);
  const daysLeft = Math.max(1, daysBetween(todayStr, targetDate));
  const months = Math.max(1, Math.round(daysLeft / 30.44));
  const weeks = Math.max(1, Math.round(daysLeft / 7));
  return S.goalPlan(money(Math.ceil(remaining / months)), money(Math.ceil(remaining / weeks)), longDate(targetDate, todayStr, dateFmt(locale)), debt);
}

/** "Every day at 20:00", "Fri, Sep 18 at 09:00", "On the 15th of every month at 12:00". */
export function reminderSentence(rem: Reminder, todayStr: string, locale: LocaleDef = en): string {
  const fmt = dateFmt(locale);
  const [y, m, d] = rem.date.split('-').map((n) => Number(n));
  const weekday = fmt.weekdaysShort[new Date(y, m - 1, d).getDay()] ?? '';
  const dateLabel = friendlyDate(rem.date, todayStr, fmt);
  return locale.s.reminderSchedule(rem.repeat, dateLabel, rem.time, weekday, d);
}

export function goalDeadlineLabel(goal: Goal, todayStr: string, locale: LocaleDef = en): string | null {
  if (!goal.targetDate) return null;
  return locale.s.by(longDate(goal.targetDate, todayStr, dateFmt(locale)));
}
