import type { Category, CategoryTotal, Goal, KeywordMapping, MonthStats, RecurringRule, Reminder, ReminderRepeat, Settings, Transaction, TxType } from '@/types';
import type { DB } from './database';
import { monthRange } from '@/lib/dates';

// ---------- row mappers ----------

type TxRow = {
  id: string; amount: number; type: TxType; category_id: string | null; note: string | null; raw_input: string | null;
  occurred_at: string; created_at: string; is_recurring_instance: number; recurring_rule_id: string | null;
};
const toTx = (r: TxRow): Transaction => ({
  id: r.id, amount: r.amount, type: r.type, categoryId: r.category_id, note: r.note, rawInput: r.raw_input,
  occurredAt: r.occurred_at, createdAt: r.created_at, isRecurringInstance: r.is_recurring_instance === 1, recurringRuleId: r.recurring_rule_id,
});

type CatRow = { id: string; name: string; icon: string | null; kind: TxType; monthly_limit: number | null; is_default: number; archived: number; sort_order: number };
const toCat = (r: CatRow): Category => ({
  id: r.id, name: r.name, icon: r.icon, kind: r.kind, monthlyLimit: r.monthly_limit, isDefault: r.is_default === 1, archived: r.archived === 1, sortOrder: r.sort_order,
});

type RuleRow = { id: string; amount: number; type: TxType; category_id: string | null; frequency: RecurringRule['frequency']; next_occurrence: string; note: string | null; active: number };
const toRule = (r: RuleRow): RecurringRule => ({
  id: r.id, amount: r.amount, type: r.type, categoryId: r.category_id, frequency: r.frequency, nextOccurrence: r.next_occurrence, note: r.note, active: r.active === 1,
});

type GoalRow = { id: string; name: string; kind: string | null; target_amount: number; current_amount: number; target_date: string | null; created_at: string; completed: number };
const toGoal = (r: GoalRow): Goal => ({
  id: r.id, name: r.name, kind: r.kind === 'debt' ? 'debt' : 'saving', targetAmount: r.target_amount, currentAmount: r.current_amount, targetDate: r.target_date, createdAt: r.created_at, completed: r.completed === 1,
});

type SettingsRow = { currency: string; theme: Settings['theme']; last_backup_at: string | null; starting_balance: number | null; onboarding_done: number; reminder_enabled: number; reminder_hour: number; smart_parse_enabled: number; language: string | null };
const toSettings = (r: SettingsRow): Settings => ({
  currency: r.currency, theme: r.theme, lastBackupAt: r.last_backup_at, startingBalance: r.starting_balance, onboardingDone: r.onboarding_done === 1,
  reminderEnabled: r.reminder_enabled === 1, reminderHour: r.reminder_hour, smartParseEnabled: r.smart_parse_enabled === 1, language: r.language ?? 'system',
});

// ---------- transactions ----------

export async function insertTransaction(db: DB, t: Transaction): Promise<void> {
  await db.runAsync(
    `INSERT INTO transactions (id, amount, type, category_id, note, raw_input, occurred_at, created_at, is_recurring_instance, recurring_rule_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [t.id, t.amount, t.type, t.categoryId, t.note, t.rawInput, t.occurredAt, t.createdAt, t.isRecurringInstance ? 1 : 0, t.recurringRuleId],
  );
}

export async function updateTransaction(db: DB, t: Transaction): Promise<void> {
  await db.runAsync(
    `UPDATE transactions SET amount = ?, type = ?, category_id = ?, note = ?, occurred_at = ? WHERE id = ?`,
    [t.amount, t.type, t.categoryId, t.note, t.occurredAt, t.id],
  );
}

export async function deleteTransaction(db: DB, id: string): Promise<void> {
  await db.runAsync('DELETE FROM transactions WHERE id = ?', [id]);
}

export async function getTransaction(db: DB, id: string): Promise<Transaction | null> {
  const row = await db.getFirstAsync<TxRow>('SELECT * FROM transactions WHERE id = ?', [id]);
  return row ? toTx(row) : null;
}

export async function recentTransactions(db: DB, limit = 10): Promise<Transaction[]> {
  const rows = await db.getAllAsync<TxRow>('SELECT * FROM transactions ORDER BY occurred_at DESC, created_at DESC LIMIT ?', [limit]);
  return rows.map(toTx);
}

export async function allTransactions(db: DB): Promise<Transaction[]> {
  const rows = await db.getAllAsync<TxRow>('SELECT * FROM transactions ORDER BY occurred_at DESC, created_at DESC');
  return rows.map(toTx);
}

export interface TransactionQuery {
  search?: string;
  type?: TxType | null;
  categoryId?: string | null;
  from?: string | null;
  to?: string | null;
  limit?: number;
  offset?: number;
}

export async function queryTransactions(db: DB, q: TransactionQuery): Promise<Transaction[]> {
  const where: string[] = [];
  const params: (string | number)[] = [];
  if (q.search && q.search.trim()) {
    where.push('(LOWER(COALESCE(note, \'\')) LIKE ? OR LOWER(COALESCE(raw_input, \'\')) LIKE ? OR CAST(amount AS TEXT) LIKE ?)');
    const like = `%${q.search.trim().toLowerCase()}%`;
    params.push(like, like, like);
  }
  if (q.type) { where.push('type = ?'); params.push(q.type); }
  if (q.categoryId) { where.push('category_id = ?'); params.push(q.categoryId); }
  if (q.from) { where.push('occurred_at >= ?'); params.push(q.from); }
  if (q.to) { where.push('occurred_at <= ?'); params.push(q.to); }
  const sql = `SELECT * FROM transactions ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY occurred_at DESC, created_at DESC LIMIT ? OFFSET ?`;
  params.push(q.limit ?? 200, q.offset ?? 0);
  const rows = await db.getAllAsync<TxRow>(sql, params);
  return rows.map(toTx);
}

export async function monthStats(db: DB, month: string): Promise<MonthStats> {
  const { start, end } = monthRange(month);
  const totals = await db.getAllAsync<{ type: TxType; total: number }>(
    'SELECT type, SUM(amount) AS total FROM transactions WHERE occurred_at BETWEEN ? AND ? GROUP BY type',
    [start, end],
  );
  const byCategoryRows = await db.getAllAsync<{ category_id: string | null; total: number; count: number }>(
    'SELECT category_id, SUM(amount) AS total, COUNT(*) AS count FROM transactions WHERE occurred_at BETWEEN ? AND ? AND type = \'expense\' GROUP BY category_id',
    [start, end],
  );
  const byCategory: CategoryTotal[] = byCategoryRows.map((r) => ({ categoryId: r.category_id, total: r.total, count: r.count }));
  return {
    month,
    income: totals.find((t) => t.type === 'income')?.total ?? 0,
    expenses: totals.find((t) => t.type === 'expense')?.total ?? 0,
    byCategory,
  };
}

export async function lifetimeTotals(db: DB): Promise<{ income: number; expenses: number }> {
  const totals = await db.getAllAsync<{ type: TxType; total: number }>('SELECT type, SUM(amount) AS total FROM transactions GROUP BY type');
  return {
    income: totals.find((t) => t.type === 'income')?.total ?? 0,
    expenses: totals.find((t) => t.type === 'expense')?.total ?? 0,
  };
}

// ---------- categories ----------

export async function allCategories(db: DB): Promise<Category[]> {
  const rows = await db.getAllAsync<CatRow>('SELECT * FROM categories ORDER BY sort_order ASC, name ASC');
  return rows.map(toCat);
}

export async function upsertCategory(db: DB, c: Category): Promise<void> {
  await db.runAsync(
    `INSERT INTO categories (id, name, icon, kind, monthly_limit, is_default, archived, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET name = excluded.name, icon = excluded.icon, kind = excluded.kind, monthly_limit = excluded.monthly_limit, archived = excluded.archived, sort_order = excluded.sort_order`,
    [c.id, c.name, c.icon, c.kind, c.monthlyLimit, c.isDefault ? 1 : 0, c.archived ? 1 : 0, c.sortOrder],
  );
}

export async function deleteCategory(db: DB, id: string): Promise<void> {
  await db.runAsync('DELETE FROM categories WHERE id = ?', [id]);
}

export async function countTransactionsInCategory(db: DB, id: string): Promise<number> {
  const row = await db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM transactions WHERE category_id = ?', [id]);
  return row?.n ?? 0;
}

// ---------- recurring rules ----------

export async function allRules(db: DB): Promise<RecurringRule[]> {
  const rows = await db.getAllAsync<RuleRow>('SELECT * FROM recurring_rules ORDER BY next_occurrence ASC');
  return rows.map(toRule);
}

export async function upsertRule(db: DB, r: RecurringRule): Promise<void> {
  await db.runAsync(
    `INSERT INTO recurring_rules (id, amount, type, category_id, frequency, next_occurrence, note, active) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET amount = excluded.amount, type = excluded.type, category_id = excluded.category_id, frequency = excluded.frequency, next_occurrence = excluded.next_occurrence, note = excluded.note, active = excluded.active`,
    [r.id, r.amount, r.type, r.categoryId, r.frequency, r.nextOccurrence, r.note, r.active ? 1 : 0],
  );
}

export async function deleteRule(db: DB, id: string): Promise<void> {
  await db.runAsync('DELETE FROM recurring_rules WHERE id = ?', [id]);
}

// ---------- goals ----------

export async function allGoals(db: DB): Promise<Goal[]> {
  const rows = await db.getAllAsync<GoalRow>('SELECT * FROM goals ORDER BY completed ASC, created_at DESC');
  return rows.map(toGoal);
}

export async function upsertGoal(db: DB, g: Goal): Promise<void> {
  await db.runAsync(
    `INSERT INTO goals (id, name, kind, target_amount, current_amount, target_date, created_at, completed) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET name = excluded.name, kind = excluded.kind, target_amount = excluded.target_amount, current_amount = excluded.current_amount, target_date = excluded.target_date, completed = excluded.completed`,
    [g.id, g.name, g.kind ?? 'saving', g.targetAmount, g.currentAmount, g.targetDate, g.createdAt, g.completed ? 1 : 0],
  );
}

export async function deleteGoal(db: DB, id: string): Promise<void> {
  await db.runAsync('DELETE FROM goals WHERE id = ?', [id]);
}

// ---------- reminders ----------

type ReminderRow = { id: string; text: string; due_at: string; repeat: string; notification_id: string | null; created_at: string };
const REPEATS: ReminderRepeat[] = ['none', 'daily', 'weekly', 'monthly'];
const toReminder = (r: ReminderRow): Reminder => ({
  id: r.id, text: r.text, date: r.due_at.slice(0, 10), time: r.due_at.slice(11, 16) || '09:00',
  repeat: (REPEATS as string[]).includes(r.repeat) ? (r.repeat as ReminderRepeat) : 'none', notificationId: r.notification_id, createdAt: r.created_at,
});

export async function allReminders(db: DB): Promise<Reminder[]> {
  const rows = await db.getAllAsync<ReminderRow>('SELECT * FROM reminders ORDER BY due_at ASC');
  return rows.map(toReminder);
}

export async function upsertReminder(db: DB, r: Reminder): Promise<void> {
  await db.runAsync(
    `INSERT INTO reminders (id, text, due_at, repeat, notification_id, created_at) VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET text = excluded.text, due_at = excluded.due_at, repeat = excluded.repeat, notification_id = excluded.notification_id`,
    [r.id, r.text, `${r.date}T${r.time}`, r.repeat, r.notificationId, r.createdAt],
  );
}

export async function deleteReminder(db: DB, id: string): Promise<void> {
  await db.runAsync('DELETE FROM reminders WHERE id = ?', [id]);
}

// ---------- settings ----------

export async function getSettings(db: DB): Promise<Settings> {
  const row = await db.getFirstAsync<SettingsRow>('SELECT * FROM settings WHERE id = 1');
  if (!row) throw new Error('settings row missing');
  return toSettings(row);
}

export async function saveSettings(db: DB, s: Settings): Promise<void> {
  await db.runAsync(
    `UPDATE settings SET currency = ?, theme = ?, last_backup_at = ?, starting_balance = ?, onboarding_done = ?, reminder_enabled = ?, reminder_hour = ?, smart_parse_enabled = ?, language = ? WHERE id = 1`,
    [s.currency, s.theme, s.lastBackupAt, s.startingBalance, s.onboardingDone ? 1 : 0, s.reminderEnabled ? 1 : 0, s.reminderHour, s.smartParseEnabled ? 1 : 0, s.language ?? 'system'],
  );
}

// ---------- learned keywords ----------

export async function allKeywords(db: DB): Promise<KeywordMapping[]> {
  return db.getAllAsync<KeywordMapping>('SELECT word, category_id AS categoryId FROM keyword_mappings');
}

export async function upsertKeyword(db: DB, word: string, categoryId: string): Promise<void> {
  await db.runAsync('INSERT INTO keyword_mappings (word, category_id) VALUES (?, ?) ON CONFLICT(word) DO UPDATE SET category_id = excluded.category_id', [word, categoryId]);
}

export async function deleteKeyword(db: DB, word: string): Promise<void> {
  await db.runAsync('DELETE FROM keyword_mappings WHERE word = ?', [word]);
}

// ---------- backup / restore ----------

export async function replaceAllData(
  db: DB,
  data: { settings: Settings; categories: Category[]; transactions: Transaction[]; recurringRules: RecurringRule[]; goals: Goal[]; keywords: KeywordMapping[] },
): Promise<void> {
  await db.withExclusiveTransactionAsync(async (txn) => {
    await txn.execAsync('DELETE FROM transactions; DELETE FROM recurring_rules; DELETE FROM goals; DELETE FROM keyword_mappings; DELETE FROM categories;');
    for (const c of data.categories) {
      await txn.runAsync('INSERT INTO categories (id, name, icon, kind, monthly_limit, is_default, archived, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [c.id, c.name, c.icon, c.kind, c.monthlyLimit, c.isDefault ? 1 : 0, c.archived ? 1 : 0, c.sortOrder]);
    }
    for (const r of data.recurringRules) {
      await txn.runAsync('INSERT INTO recurring_rules (id, amount, type, category_id, frequency, next_occurrence, note, active) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [r.id, r.amount, r.type, r.categoryId, r.frequency, r.nextOccurrence, r.note, r.active ? 1 : 0]);
    }
    for (const t of data.transactions) {
      await txn.runAsync('INSERT INTO transactions (id, amount, type, category_id, note, raw_input, occurred_at, created_at, is_recurring_instance, recurring_rule_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [t.id, t.amount, t.type, t.categoryId, t.note, t.rawInput, t.occurredAt, t.createdAt, t.isRecurringInstance ? 1 : 0, t.recurringRuleId]);
    }
    for (const g of data.goals) {
      await txn.runAsync('INSERT INTO goals (id, name, kind, target_amount, current_amount, target_date, created_at, completed) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [g.id, g.name, g.kind === 'debt' ? 'debt' : 'saving', g.targetAmount, g.currentAmount, g.targetDate, g.createdAt, g.completed ? 1 : 0]);
    }
    for (const k of data.keywords) {
      await txn.runAsync('INSERT OR IGNORE INTO keyword_mappings (word, category_id) VALUES (?, ?)', [k.word, k.categoryId]);
    }
    const s = data.settings;
    await txn.runAsync(
      'UPDATE settings SET currency = ?, theme = ?, last_backup_at = ?, starting_balance = ?, onboarding_done = 1, reminder_enabled = ?, reminder_hour = ?, smart_parse_enabled = ?, language = ? WHERE id = 1',
      [s.currency, s.theme, s.lastBackupAt, s.startingBalance, s.reminderEnabled ? 1 : 0, s.reminderHour, s.smartParseEnabled ? 1 : 0, s.language ?? 'system'],
    );
  });
}
