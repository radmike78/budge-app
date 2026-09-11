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
  /** Set on lines imported from a statement: used to skip the same line twice. */
  fingerprint?: string | null;
  importId?: string | null;
}

export type DebtType = 'credit_card' | 'personal_loan' | 'student_loan' | 'auto_loan' | 'mortgage' | 'line_of_credit' | 'other';

/** A debt the user owes, from a credit report, a card statement, or typed in. */
export interface Debt {
  id: string;
  creditor: string;
  type: DebtType;
  balance: number;
  monthlyPayment: number | null;
  creditLimit: number | null;
  /** Percent per year */
  apr: number | null;
  source: 'credit_report' | 'card_statement' | 'manual';
  updatedAt: string;
}

/** A statement the user imported, for the history list. */
export interface ImportRecord {
  id: string;
  kind: 'bank' | 'card' | 'credit_report';
  fileName: string;
  periodStart: string | null;
  periodEnd: string | null;
  count: number;
  importedAt: string;
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
