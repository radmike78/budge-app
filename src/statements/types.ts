/**
 * Types for statement import: bank and credit-card statements and credit
 * reports that the user chooses as PDF files. Everything here is data only.
 */

/** One piece of text with its position on a page, as PDF text extraction returns it. */
export interface TextItem {
  str: string;
  x: number;
  y: number;
  /** Width in the same units as x; optional. */
  w?: number;
  page: number;
}

/** A visual row of text: cells left to right, joined text, and the page/line it came from. */
export interface Row {
  page: number;
  y: number;
  cells: { x: number; str: string }[];
  text: string;
}

export type StatementKind = 'bank' | 'card' | 'credit_report' | 'unknown';

/**
 * What a line means from the user's point of view.
 *  income / expense: real money in or out
 *  transfer: between the user's own accounts (excluded by default)
 *  payment: a payment onto a credit card as seen on the card statement (excluded; the bank side records it)
 *  refund: money back on a card (imported as income)
 *  fee / interest: charges by the bank or card (imported as expense, category Debt or Other)
 */
export type LineKind = 'income' | 'expense' | 'transfer' | 'payment' | 'refund' | 'fee' | 'interest';

export interface StatementLine {
  /** Stable fingerprint of date + amount + direction + description, used to skip duplicates. */
  fingerprint: string;
  /** YYYY-MM-DD after year inference. */
  date: string;
  /** YYYY-MM, the month this line belongs to. */
  month: string;
  rawDate: string;
  description: string;
  amount: number;
  /** 'in' = money arrived in this account, 'out' = money left it. */
  direction: 'in' | 'out';
  kind: LineKind;
  balance: number | null;
  categoryId: string | null;
  categoryConfidence: number;
  /** Suggested default for the review screen. */
  include: boolean;
  /** Already in the app's history (same fingerprint). */
  duplicate: boolean;
  page: number;
}

export interface StatementPeriod {
  start: string;
  end: string;
}

export type DebtType = 'credit_card' | 'personal_loan' | 'student_loan' | 'auto_loan' | 'mortgage' | 'line_of_credit' | 'other';

/** One account on a credit report, or the account a card statement is for. */
export interface Tradeline {
  id: string;
  creditor: string;
  type: DebtType;
  balance: number | null;
  monthlyPayment: number | null;
  creditLimit: number | null;
  /** Percent, e.g. 24.99 */
  apr: number | null;
  status: 'open' | 'closed' | 'unknown';
  /** True for debts the pay-off planner considers (no mortgages, no car loans). */
  consumer: boolean;
  source: 'credit_report' | 'card_statement' | 'manual';
}

export interface MonthSummary {
  month: string;
  income: number;
  expenses: number;
  count: number;
  /** True when the statement only covers part of this month. */
  partial: boolean;
}

export interface ParsedStatement {
  kind: StatementKind;
  period: StatementPeriod | null;
  lines: StatementLine[];
  tradelines: Tradeline[];
  months: MonthSummary[];
  /** Keys for the UI to translate (see locale `importWarnings`). */
  warnings: string[];
}

export interface ParseOptions {
  /** Locale hints: 'en', 'es', ... Controls month names, day-first dates and decimal comma. */
  language: string;
  /** YYYY-MM-DD, for year inference when the statement gives none. */
  today: string;
  /** Fingerprints already in the app, to flag duplicates. */
  knownFingerprints?: Set<string>;
}
