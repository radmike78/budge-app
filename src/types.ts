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

export type GoalKind = 'saving' | 'debt';

export type ReminderRepeat = 'none' | 'daily' | 'weekly' | 'monthly';

/** A spoken or typed reminder, delivered as a local notification. */
export interface Reminder {
  id: string;
  text: string;
  /** YYYY-MM-DD of the first (or only) time it fires */
  date: string;
  /** HH:MM, 24-hour, local time */
  time: string;
  repeat: ReminderRepeat;
  /** Id of the scheduled notification; null when notifications are not allowed. */
  notificationId: string | null;
  createdAt: string;
}

export interface Goal {
  id: string;
  name: string;
  /** Save up toward something, or pay down a debt. */
  kind: GoalKind;
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
  /** Ask for the phone's biometrics or passcode when the app opens. */
  appLockEnabled: boolean;
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
