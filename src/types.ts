export type TxType = 'income' | 'expense';
export type Frequency = 'weekly' | 'biweekly' | 'monthly' | 'yearly';
export type ThemeSetting = 'system' | 'light' | 'dark';

export interface Transaction {
  id: string;
  amount: number;
  type: TxType;
  categoryId: string | null;
  note: string | null;
  rawInput: string | null;
  /** YYYY-MM-DD (local calendar date) */
  occurredAt: string;
  /** ISO timestamp */
  createdAt: string;
  isRecurringInstance: boolean;
  recurringRuleId: string | null;
}

export interface Category {
  id: string;
  name: string;
  icon: string | null;
  kind: TxType;
  monthlyLimit: number | null;
  isDefault: boolean;
  archived: boolean;
  sortOrder: number;
}

export interface RecurringRule {
  id: string;
  amount: number;
  type: TxType;
  categoryId: string | null;
  frequency: Frequency;
  /** YYYY-MM-DD */
  nextOccurrence: string;
  note: string | null;
  active: boolean;
}

export interface Goal {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  /** YYYY-MM-DD or null */
  targetDate: string | null;
  createdAt: string;
  completed: boolean;
}

export interface Settings {
  currency: string;
  theme: ThemeSetting;
  lastBackupAt: string | null;
  startingBalance: number | null;
  onboardingDone: boolean;
  reminderEnabled: boolean;
  /** 0-23, local time */
  reminderHour: number;
  /** Tier 2 parsing assist (off by default; needs the user's own API key). */
  smartParseEnabled: boolean;
  /** 'system' or a language code ('en', 'es', ...). */
  language: string;
}

/** A learned word -> category mapping, created when the user corrects a parsed category. */
export interface KeywordMapping {
  word: string;
  categoryId: string;
}

export interface CategoryTotal {
  categoryId: string | null;
  total: number;
  count: number;
}

export interface MonthStats {
  /** YYYY-MM */
  month: string;
  income: number;
  expenses: number;
  byCategory: CategoryTotal[];
}
