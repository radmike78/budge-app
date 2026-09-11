/**
 * Pay-off planning for consumer debt (cards and loans; never mortgages or car
 * loans). Two standard orders: avalanche (highest interest rate first, least
 * interest paid) and snowball (smallest balance first, quickest first win).
 * Pure arithmetic; the UI turns the result into plain sentences.
 */
import type { Tradeline } from './types';

export type Strategy = 'avalanche' | 'snowball';

export interface DebtInput {
  id: string;
  name: string;
  balance: number;
  /** Percent per year; null when unknown. */
  apr: number | null;
  /** Required monthly payment; null when unknown (a floor is assumed). */
  minPayment: number | null;
}

export interface DebtPlanRow {
  id: string;
  name: string;
  balance: number;
  apr: number | null;
  minPayment: number;
  /** 1-based position in the pay-off order. */
  order: number;
  /** Months until this debt reaches zero under the plan. */
  monthsToPayoff: number;
  interestPaid: number;
}

export interface PayoffPlan {
  strategy: Strategy;
  rows: DebtPlanRow[];
  totalMonths: number;
  totalInterest: number;
  /** Sum of minimums plus the extra: what the plan needs each month. */
  monthlyTotal: number;
  /** True when the extra could not reach every debt within the cap. */
  truncated: boolean;
}

const MAX_MONTHS = 600;

/** A required payment when the statement or report did not say: 2% of the balance, at least 25. */
export function assumedMinimum(balance: number): number {
  return Math.max(25, Math.round(balance * 0.02 * 100) / 100);
}

export function orderDebts(debts: DebtInput[], strategy: Strategy): DebtInput[] {
  const list = debts.filter((d) => d.balance > 0);
  if (strategy === 'avalanche') {
    return [...list].sort((a, b) => (b.apr ?? -1) - (a.apr ?? -1) || a.balance - b.balance);
  }
  return [...list].sort((a, b) => a.balance - b.balance || (b.apr ?? 0) - (a.apr ?? 0));
}

/**
 * Simulates month by month: every debt gets its minimum, the extra (plus every
 * freed-up minimum) goes to the debt at the front of the order.
 */
export function planPayoff(debts: DebtInput[], extraPerMonth: number, strategy: Strategy): PayoffPlan {
  const ordered = orderDebts(debts, strategy);
  const state = ordered.map((d) => ({ ...d, remaining: d.balance, minPayment: d.minPayment ?? assumedMinimum(d.balance), interest: 0, paidOffMonth: 0 }));
  const extra = Math.max(0, extraPerMonth);
  let month = 0;
  while (state.some((s) => s.remaining > 0.005) && month < MAX_MONTHS) {
    month += 1;
    // Interest first.
    for (const s of state) {
      if (s.remaining <= 0.005) continue;
      const i = s.apr ? (s.remaining * s.apr) / 100 / 12 : 0;
      s.interest += i;
      s.remaining += i;
    }
    // Minimums, collecting anything a finished debt no longer needs.
    let pool = extra;
    for (const s of state) {
      if (s.remaining <= 0.005) { pool += s.minPayment; continue; }
      const pay = Math.min(s.minPayment, s.remaining);
      s.remaining -= pay;
      pool += s.minPayment - pay;
    }
    // The pool goes to the front of the line, then the next, and so on.
    for (const s of state) {
      if (pool <= 0) break;
      if (s.remaining <= 0.005) continue;
      const pay = Math.min(pool, s.remaining);
      s.remaining -= pay;
      pool -= pay;
    }
    for (const s of state) if (s.remaining <= 0.005 && !s.paidOffMonth) s.paidOffMonth = month;
  }
  const truncated = state.some((s) => s.remaining > 0.005);
  const rows: DebtPlanRow[] = state.map((s, i) => ({
    id: s.id,
    name: s.name,
    balance: s.balance,
    apr: s.apr,
    minPayment: s.minPayment,
    order: i + 1,
    monthsToPayoff: s.paidOffMonth || MAX_MONTHS,
    interestPaid: Math.round(s.interest * 100) / 100,
  }));
  return {
    strategy,
    rows,
    totalMonths: truncated ? MAX_MONTHS : Math.max(0, ...rows.map((r) => r.monthsToPayoff)),
    totalInterest: Math.round(rows.reduce((a, r) => a + r.interestPaid, 0) * 100) / 100,
    monthlyTotal: Math.round((state.reduce((a, s) => a + s.minPayment, 0) + extra) * 100) / 100,
    truncated,
  };
}

/**
 * Which order to suggest: avalanche when the rates are known and differ enough
 * to matter, otherwise snowball (a quick first win keeps people going).
 */
export function recommendStrategy(debts: DebtInput[]): { strategy: Strategy; reason: 'rates_known' | 'rates_unknown' | 'rates_similar' | 'single' } {
  const live = debts.filter((d) => d.balance > 0);
  if (live.length <= 1) return { strategy: 'avalanche', reason: 'single' };
  const rates = live.map((d) => d.apr).filter((a): a is number => a != null);
  if (rates.length < live.length) return { strategy: 'snowball', reason: 'rates_unknown' };
  const spread = Math.max(...rates) - Math.min(...rates);
  if (spread < 3) return { strategy: 'snowball', reason: 'rates_similar' };
  return { strategy: 'avalanche', reason: 'rates_known' };
}

/** Consumer debts from tradelines: cards, personal and student loans, lines of credit. */
export function debtsFromTradelines(lines: Tradeline[]): DebtInput[] {
  return lines
    .filter((t) => t.consumer && t.status !== 'closed' && (t.balance ?? 0) > 0)
    .map((t) => ({ id: t.id, name: t.creditor, balance: t.balance ?? 0, apr: t.apr, minPayment: t.monthlyPayment }));
}
