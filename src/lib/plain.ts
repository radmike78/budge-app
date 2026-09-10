/**
 * Plain-language sentences for the Home, Budget and Goals screens.
 * Tone: calm, factual, no guilt. Numbers are formatted with the user's currency.
 */
import type { Category, CategoryTotal, Goal, MonthStats } from '@/types';
import { addDays, daysBetween, fromDateString, longDate, monthName } from './dates';
import { formatMoney } from './money';

export function monthSummarySentence(stats: MonthStats, currency: string, isCurrentMonth: boolean): string {
  const name = monthName(stats.month);
  const money = (n: number) => formatMoney(n, currency, { compact: true });
  const sofar = isCurrentMonth ? 'so far' : '';
  const inMonth = isCurrentMonth ? `${sofar} in ${name}` : `in ${name}`;
  const net = stats.income - stats.expenses;

  if (stats.income === 0 && stats.expenses === 0) {
    return isCurrentMonth
      ? `Nothing logged yet in ${name}. Tap the mic or type to add your first entry.`
      : `Nothing was logged in ${name}.`;
  }
  if (stats.income === 0) {
    return `You've spent ${money(stats.expenses)} ${inMonth}. No income logged yet.`.replace('  ', ' ');
  }
  if (stats.expenses === 0) {
    return `You've brought in ${money(stats.income)} ${inMonth} and haven't logged any spending yet.`.replace('  ', ' ');
  }
  const lead = `${inMonth.charAt(0).toUpperCase()}${inMonth.slice(1)} you've brought in ${money(stats.income)} and spent ${money(stats.expenses)}.`.replace('  ', ' ');
  if (net > 0) return `${lead} That leaves ${money(net)}.`;
  if (net === 0) return `${lead} That comes out even.`;
  return `${lead} That's ${money(-net)} more out than in.`;
}

export function topCategorySentence(stats: MonthStats, categories: Category[], currency: string): string | null {
  const expenseCats = new Map(categories.filter((c) => c.kind === 'expense').map((c) => [c.id, c]));
  const spend = stats.byCategory.filter((b) => b.categoryId && expenseCats.has(b.categoryId)).sort((a, b) => b.total - a.total);
  if (spend.length === 0 || stats.expenses === 0) return null;
  const top = spend[0];
  const cat = expenseCats.get(top.categoryId!)!;
  const share = Math.round((top.total / stats.expenses) * 100);
  const money = formatMoney(top.total, currency, { compact: true });
  if (spend.length === 1) return `All of it went to ${cat.name}.`;
  if (share >= 50) return `Most of it went to ${cat.name} (${money}).`;
  return `The biggest slice was ${cat.name} at ${money}.`;
}

export function categoryLineSentence(cat: Category, spent: number, currency: string): string {
  const money = (n: number) => formatMoney(n, currency, { compact: true });
  if (cat.monthlyLimit == null || cat.monthlyLimit <= 0) {
    return spent === 0 ? 'Nothing yet this month.' : `${money(spent)} this month.`;
  }
  const remaining = cat.monthlyLimit - spent;
  if (spent === 0) return `Nothing yet of your ${money(cat.monthlyLimit)} plan.`;
  if (remaining > 0) return `${money(spent)} of your ${money(cat.monthlyLimit)} plan. ${money(remaining)} left.`;
  if (remaining === 0) return `Exactly at your ${money(cat.monthlyLimit)} plan.`;
  return `${money(spent)} so far, ${money(-remaining)} past your ${money(cat.monthlyLimit)} plan.`;
}

export interface GoalProgress {
  remaining: number;
  /** 0..1 */
  fraction: number;
  sentence: string;
  /** 'ahead' | 'behind' | 'on_track' | 'done' | 'no_date' */
  status: 'ahead' | 'behind' | 'on_track' | 'done' | 'no_date';
}

function weeksText(days: number): string {
  const abs = Math.abs(days);
  if (abs < 7) return abs === 1 ? '1 day' : `${abs} days`;
  const weeks = Math.round(abs / 7);
  if (weeks < 9) return weeks === 1 ? '1 week' : `${weeks} weeks`;
  const months = Math.round(abs / 30);
  return months === 1 ? 'about a month' : `about ${months} months`;
}

/**
 * "You're $180 away, on pace to hit it 2 weeks early."
 * Pace is the average saved per day since the goal was created.
 */
export function goalProgress(goal: Goal, currency: string, todayStr: string): GoalProgress {
  const money = (n: number) => formatMoney(n, currency, { compact: true });
  const remaining = Math.max(0, goal.targetAmount - goal.currentAmount);
  const fraction = goal.targetAmount > 0 ? Math.min(1, goal.currentAmount / goal.targetAmount) : 0;

  if (goal.completed || remaining === 0) {
    return { remaining: 0, fraction: 1, status: 'done', sentence: `Done. You saved ${money(goal.targetAmount)} for ${goal.name}.` };
  }

  const createdDay = goal.createdAt.slice(0, 10);
  const elapsedDays = Math.max(1, daysBetween(createdDay, todayStr));
  const perDay = goal.currentAmount / elapsedDays;

  if (!goal.targetDate) {
    if (goal.currentAmount === 0) {
      return { remaining, fraction, status: 'no_date', sentence: `${money(goal.targetAmount)} to go. Add to it whenever you can.` };
    }
    return { remaining, fraction, status: 'no_date', sentence: `You're ${money(remaining)} away. No deadline on this one.` };
  }

  const daysLeft = daysBetween(todayStr, goal.targetDate);
  if (daysLeft < 0) {
    return { remaining, fraction, status: 'behind', sentence: `You're ${money(remaining)} away. The target date (${longDate(goal.targetDate, todayStr)}) has passed, but the goal is still yours.` };
  }
  const neededPerWeek = daysLeft > 0 ? (remaining / daysLeft) * 7 : remaining;

  if (perDay <= 0) {
    if (daysLeft === 0) return { remaining, fraction, status: 'behind', sentence: `${money(remaining)} to go, and today is the target date.` };
    return { remaining, fraction, status: 'on_track', sentence: `You're ${money(remaining)} away. Setting aside ${money(Math.ceil(neededPerWeek))} a week gets you there by ${longDate(goal.targetDate, todayStr)}.` };
  }

  const daysToFinish = Math.ceil(remaining / perDay);
  const projected = addDays(todayStr, daysToFinish);
  const delta = daysBetween(projected, goal.targetDate); // positive = early
  if (Math.abs(delta) <= 3) {
    return { remaining, fraction, status: 'on_track', sentence: `You're ${money(remaining)} away and right on pace for ${longDate(goal.targetDate, todayStr)}.` };
  }
  if (delta > 0) {
    return { remaining, fraction, status: 'ahead', sentence: `You're ${money(remaining)} away, on pace to hit it ${weeksText(delta)} early.` };
  }
  return { remaining, fraction, status: 'behind', sentence: `You're ${money(remaining)} away. At the current pace you'd land ${weeksText(delta)} after ${longDate(goal.targetDate, todayStr)}. ${money(Math.ceil(neededPerWeek))} a week would keep it on time.` };
}

export function balanceSentence(startingBalance: number | null, allIncome: number, allExpenses: number, currency: string): string | null {
  if (startingBalance == null) return null;
  const balance = startingBalance + allIncome - allExpenses;
  return `Overall balance: ${formatMoney(balance, currency)}.`;
}

/** Ordered list of {category, total} for the expense breakdown. */
export function expenseBreakdown(stats: MonthStats, categories: Category[]): { category: Category | null; total: number; share: number }[] {
  const byId = new Map(categories.map((c) => [c.id, c]));
  const rows = stats.byCategory
    .filter((b) => (b.categoryId ? byId.get(b.categoryId)?.kind !== 'income' : true))
    .map((b: CategoryTotal) => ({ category: b.categoryId ? byId.get(b.categoryId) ?? null : null, total: b.total, share: stats.expenses > 0 ? b.total / stats.expenses : 0 }))
    .sort((a, b) => b.total - a.total);
  return rows;
}

export function relativeDayCount(dateStr: string, todayStr: string): string {
  const d = daysBetween(dateStr, todayStr);
  if (d <= 0) return 'today';
  if (d === 1) return 'yesterday';
  return `${d} days ago`;
}

export function goalDeadlineLabel(goal: Goal, todayStr: string): string | null {
  if (!goal.targetDate) return null;
  const d = fromDateString(goal.targetDate);
  return `by ${longDate(goal.targetDate, todayStr)}${d.getFullYear() !== fromDateString(todayStr).getFullYear() ? '' : ''}`;
}
