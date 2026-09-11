/**
 * Input validation at the app's trust boundaries: what the user types or says,
 * what a backup file claims to contain, and what the optional Smart Assist
 * model replies. Everything here is pure so `npm test` can throw hostile
 * input at it. Covers OWASP MASVS-CODE-4 (input validation) and the storage
 * side of MASVS-STORAGE (nothing untrusted reaches SQLite unchecked).
 */
import type { Category, Frequency, Goal, KeywordMapping, RecurringRule, Settings, Transaction, TxType } from '@/types';
import { isValidDateString } from './dates';

/** A spoken entry is a sentence or two; anything longer is not an entry. */
export const MAX_ENTRY_LENGTH = 400;
export const MAX_TEXT_FIELD = 200;
export const MAX_NOTE_LENGTH = 500;
export const MAX_ROWS = 200_000;
export const MAX_AMOUNT = 1_000_000_000_000;
/** Backup files above this are refused before JSON.parse runs. */
export const MAX_BACKUP_BYTES = 50 * 1024 * 1024;
export const MIN_PASSPHRASE_LENGTH = 8;

// C0/C1 controls, zero-width and bidi-override characters (Trojan Source), BOM.
const CONTROL_CHARS = new RegExp('[\\u0000-\\u0008\\u000B\\u000C\\u000E-\\u001F\\u007F-\\u009F\\u200B-\\u200F\\u202A-\\u202E\\u2066-\\u2069\\uFEFF]', 'g');
const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})?$/;
const FREQUENCIES: Frequency[] = ['weekly', 'biweekly', 'monthly', 'yearly'];

/**
 * Trims, caps and strips control and bidi-override characters from free text.
 * Letters, digits, punctuation and emoji in every script pass through untouched.
 */
export function cleanText(input: unknown, max = MAX_TEXT_FIELD): string {
  if (typeof input !== 'string') return '';
  return input.replace(CONTROL_CHARS, '').replace(/\s+/g, ' ').trim().slice(0, max);
}

/** Same for a typed or spoken entry: newlines are kept (they separate sentences). */
export function cleanEntry(input: unknown): string {
  if (typeof input !== 'string') return '';
  return input.replace(CONTROL_CHARS, '').trim().slice(0, MAX_ENTRY_LENGTH);
}

// Card numbers (13-19 digits, plain or in groups of 4 / 4-6-5), account and routing numbers
// (8+ contiguous digits), IBANs, and masked forms like "XXXX1234" or "ending in 1234".
const CARD_GROUPED_RE = /\b\d{4}(?:[ -]\d{4}){2,4}\b|\b\d{4}[ -]\d{6}[ -]\d{5}\b/g;
const LONG_DIGITS_RE = /\b\d{8,19}\b/g;
const IBAN_RE = /\b[A-Z]{2}\d{2}(?:[ -]?[A-Z0-9]{4}){2,7}(?:[ -]?[A-Z0-9]{1,4})?\b/gi;
const MASKED_RE = /(?:[xX*•·#]{2,}\s?[-]?\s?\d{2,6}\b)|(?:\b(?:ending(?: in)?|last four|acct|account|card|a\/c|iban|routing|no\.?)\s*(?:number|#|no\.?)?\s*:?\s*[xX*•·]*\s?\d{4,}\b)/gi;

/**
 * Removes bank account, card, routing and IBAN numbers from free text so they
 * are never stored. Amounts, dates and short numbers ("Phillips 66", "2 coffees") stay.
 */
export function redactSensitive(input: unknown): string {
  if (typeof input !== 'string') return '';
  return input
    .replace(IBAN_RE, ' ')
    .replace(CARD_GROUPED_RE, ' ')
    .replace(LONG_DIGITS_RE, ' ')
    .replace(MASKED_RE, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

export class BackupValidationError extends Error {
  constructor(public readonly reason: string) {
    super(`Invalid backup: ${reason}`);
    this.name = 'BackupValidationError';
  }
}

export interface ValidBackupData {
  settings: Settings;
  categories: Category[];
  transactions: Transaction[];
  recurringRules: RecurringRule[];
  goals: Goal[];
  keywords: KeywordMapping[];
}

const fail = (reason: string): never => { throw new BackupValidationError(reason); };
const isObj = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x);
function assertObj(x: unknown, what: string): asserts x is Record<string, unknown> {
  if (!isObj(x)) fail(what);
}
const id = (v: unknown, what: string): string => (typeof v === 'string' && ID_RE.test(v) ? v : fail(`${what} id`));
const optId = (v: unknown, what: string): string | null => (v == null || v === '' ? null : id(v, what));
const money = (v: unknown, what: string): number => {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN;
  if (!Number.isFinite(n) || n < 0 || n > MAX_AMOUNT) fail(`${what} amount`);
  return Math.round(n * 100) / 100;
};
const bool = (v: unknown): boolean => v === true || v === 1 || v === '1' || v === 'true';
const day = (v: unknown, what: string): string => (typeof v === 'string' && DATE_RE.test(v) && isValidDateString(v) ? v : fail(`${what} date`));
const optDay = (v: unknown, what: string): string | null => (v == null || v === '' ? null : day(v, what));
const stamp = (v: unknown, fallback: string): string => (typeof v === 'string' && ISO_RE.test(v) ? v : fallback);
const txType = (v: unknown, what: string): TxType => (v === 'income' || v === 'expense' ? v : fail(`${what} type`));
const text = (v: unknown, max: number, what: string, required = false): string => {
  const s = cleanText(v, max);
  if (required && !s) fail(what);
  return s;
};
const list = (v: unknown, what: string): unknown[] => {
  if (v == null) return [];
  if (!Array.isArray(v)) fail(`${what} list`);
  const arr = v as unknown[];
  if (arr.length > MAX_ROWS) fail(`${what} too many rows`);
  return arr;
};

/**
 * Turns an untrusted parsed JSON value into clean, typed backup data, or throws
 * BackupValidationError naming the first problem. Every row is rebuilt from
 * scratch, so unknown fields, prototype keys and wrong types never reach SQLite.
 */
export function validateBackup(payload: unknown, now: string): ValidBackupData {
  assertObj(payload, 'not an object');
  const o = payload;
  if (o.app !== 'onlybudget') fail('app');
  if (typeof o.version !== 'number' || !Number.isInteger(o.version) || o.version < 1 || o.version > 10) fail('version');
  const s = o.settings;
  assertObj(s, 'settings');

  const categories: Category[] = [];
  const seenCat = new Set<string>();
  for (const raw of list(o.categories, 'categories')) {
    assertObj(raw, 'category');
    const cid = id(raw.id, 'category');
    if (seenCat.has(cid)) fail('duplicate category id');
    seenCat.add(cid);
    const limit = raw.monthlyLimit == null ? null : money(raw.monthlyLimit, 'category limit');
    categories.push({
      id: cid,
      name: text(raw.name, 60, 'category name', true),
      icon: raw.icon == null ? null : text(raw.icon, 8, 'category icon') || null,
      kind: txType(raw.kind, 'category'),
      monthlyLimit: limit,
      isDefault: bool(raw.isDefault),
      archived: bool(raw.archived),
      sortOrder: typeof raw.sortOrder === 'number' && Number.isFinite(raw.sortOrder) ? Math.trunc(raw.sortOrder) : categories.length,
    });
  }
  if (categories.length === 0) fail('no categories');
  const catRef = (v: unknown, what: string): string | null => {
    const c = optId(v, what);
    return c && seenCat.has(c) ? c : null;
  };

  const recurringRules: RecurringRule[] = [];
  const seenRule = new Set<string>();
  for (const raw of list(o.recurringRules, 'recurring rules')) {
    assertObj(raw, 'recurring rule');
    const rid = id(raw.id, 'recurring rule');
    if (seenRule.has(rid)) fail('duplicate rule id');
    seenRule.add(rid);
    const frequency = FREQUENCIES.find((f) => f === raw.frequency);
    if (!frequency) fail('rule frequency');
    recurringRules.push({
      id: rid,
      amount: money(raw.amount, 'rule'),
      type: txType(raw.type, 'rule'),
      categoryId: catRef(raw.categoryId, 'rule category'),
      frequency: frequency as Frequency,
      nextOccurrence: day(raw.nextOccurrence, 'rule next'),
      note: text(raw.note, MAX_NOTE_LENGTH, 'rule note') || null,
      active: raw.active == null ? true : bool(raw.active),
    });
  }

  const transactions: Transaction[] = [];
  const seenTx = new Set<string>();
  for (const raw of list(o.transactions, 'transactions')) {
    assertObj(raw, 'transaction');
    const tid = id(raw.id, 'transaction');
    if (seenTx.has(tid)) fail('duplicate transaction id');
    seenTx.add(tid);
    const ruleId = optId(raw.recurringRuleId, 'transaction rule');
    transactions.push({
      id: tid,
      amount: money(raw.amount, 'transaction'),
      type: txType(raw.type, 'transaction'),
      categoryId: catRef(raw.categoryId, 'transaction category'),
      note: text(raw.note, MAX_NOTE_LENGTH, 'note') || null,
      rawInput: text(raw.rawInput, MAX_ENTRY_LENGTH, 'raw input') || null,
      occurredAt: day(raw.occurredAt, 'transaction'),
      createdAt: stamp(raw.createdAt, now),
      isRecurringInstance: bool(raw.isRecurringInstance),
      recurringRuleId: ruleId && seenRule.has(ruleId) ? ruleId : null,
    });
  }

  const goals: Goal[] = [];
  const seenGoal = new Set<string>();
  for (const raw of list(o.goals, 'goals')) {
    assertObj(raw, 'goal');
    const gid = id(raw.id, 'goal');
    if (seenGoal.has(gid)) fail('duplicate goal id');
    seenGoal.add(gid);
    goals.push({
      id: gid,
      name: text(raw.name, 80, 'goal name', true),
      kind: raw.kind === 'debt' ? 'debt' : 'saving',
      targetAmount: money(raw.targetAmount, 'goal target'),
      currentAmount: money(raw.currentAmount ?? 0, 'goal current'),
      targetDate: optDay(raw.targetDate, 'goal'),
      createdAt: stamp(raw.createdAt, now),
      completed: bool(raw.completed),
    });
  }

  const keywords: KeywordMapping[] = [];
  const seenWord = new Set<string>();
  for (const raw of list(o.keywords, 'keywords')) {
    assertObj(raw, 'keyword');
    const word = cleanText(raw.word, 40).toLowerCase();
    const cat = catRef(raw.categoryId, 'keyword category');
    if (!word || !cat || seenWord.has(word)) continue;
    seenWord.add(word);
    keywords.push({ word, categoryId: cat });
  }

  const theme = s.theme === 'light' || s.theme === 'dark' ? s.theme : 'system';
  const hour = typeof s.reminderHour === 'number' && Number.isInteger(s.reminderHour) && s.reminderHour >= 0 && s.reminderHour <= 23 ? s.reminderHour : 20;
  const balanceRaw = s.startingBalance == null ? NaN : Number(s.startingBalance);
  const settings: Settings = {
    currency: typeof s.currency === 'string' && /^[A-Z]{3}$/.test(s.currency) ? s.currency : 'USD',
    theme,
    lastBackupAt: typeof s.lastBackupAt === 'string' && ISO_RE.test(s.lastBackupAt) ? s.lastBackupAt : null,
    startingBalance: Number.isFinite(balanceRaw) && Math.abs(balanceRaw) <= MAX_AMOUNT ? Math.round(balanceRaw * 100) / 100 : null,
    onboardingDone: true,
    reminderEnabled: bool(s.reminderEnabled),
    reminderHour: hour,
    // Security-sensitive switches never come from a file: the user turns them on by hand.
    smartParseEnabled: false,
    appLockEnabled: false,
    language: typeof s.language === 'string' && /^(?:[a-z]{2}(?:-[A-Za-z]{2,4})?|system)$/.test(s.language) ? s.language : 'system',
  };

  return { settings, categories, transactions, recurringRules, goals, keywords };
}

/** Shape the Smart Assist model is asked for; everything is re-checked here. */
export interface AssistReply {
  amount: number | null;
  type: TxType;
  category: string | null;
  note: string | null;
  kind: 'transaction' | 'goal';
  goal_name: string | null;
  goal_kind: 'saving' | 'debt' | null;
  target_date: string | null;
}

/** Returns a clean reply or null when the model's JSON is not what was asked for. */
export function validateAssistReply(raw: unknown): AssistReply | null {
  if (!isObj(raw)) return null;
  const type = raw.type === 'income' ? 'income' : raw.type === 'expense' ? 'expense' : null;
  if (!type) return null;
  const kind = raw.kind === 'goal' ? 'goal' : raw.kind === 'transaction' ? 'transaction' : null;
  if (!kind) return null;
  const n = typeof raw.amount === 'number' ? raw.amount : typeof raw.amount === 'string' ? Number(raw.amount) : NaN;
  const amount = Number.isFinite(n) && Math.abs(n) <= MAX_AMOUNT && n !== 0 ? Math.round(Math.abs(n) * 100) / 100 : null;
  const target = typeof raw.target_date === 'string' && DATE_RE.test(raw.target_date) && isValidDateString(raw.target_date) ? raw.target_date : null;
  return {
    amount,
    type,
    category: cleanText(raw.category, 60) || null,
    note: cleanText(raw.note, MAX_NOTE_LENGTH) || null,
    kind,
    goal_name: cleanText(raw.goal_name, 80) || null,
    goal_kind: raw.goal_kind === 'debt' ? 'debt' : raw.goal_kind === 'saving' ? 'saving' : null,
    target_date: target,
  };
}
