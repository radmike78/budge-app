import { create } from 'zustand';
import type { Category, Debt, Goal, ImportRecord, KeywordMapping, MonthStats, RecurringRule, Reminder, Settings, Transaction } from '@/types';
import type { StatementLine, Tradeline } from '@/statements';
import { getDb } from '@/db/database';
import * as repo from '@/db/repositories';
import { currentMonthKey, nowIso, today } from '@/lib/dates';
import { newId } from '@/lib/ids';
import { dueOccurrences } from '@/lib/recurring';
import { learnableWords } from '@/parser';
import { redactSensitive } from '@/lib/validate';
import { sweepImportCache } from '@/lib/pdfBytes';
import { cancelReminderNotification, nextOccurrence, notificationPermissionState, scheduleReminderNotification, type PermissionState } from '@/lib/reminders';
import { getLocale, resolveLanguage } from '@/i18n';

interface AppState {
  ready: boolean;
  settings: Settings | null;
  categories: Category[];
  goals: Goal[];
  reminders: Reminder[];
  debts: Debt[];
  imports: ImportRecord[];
  /** Fingerprints of every imported statement line, to flag duplicates before import. */
  fingerprints: Set<string>;
  /** Last known notification permission; null until checked. */
  notifications: PermissionState | null;
  rules: RecurringRule[];
  keywords: KeywordMapping[];
  keywordMap: Record<string, string>;
  recent: Transaction[];
  month: string;
  stats: MonthStats | null;
  lifetime: { income: number; expenses: number };

  init: () => Promise<void>;
  refresh: () => Promise<void>;
  setMonth: (month: string) => Promise<void>;

  addTransaction: (input: Omit<Transaction, 'id' | 'createdAt' | 'isRecurringInstance' | 'recurringRuleId'>) => Promise<Transaction>;
  updateTransaction: (t: Transaction) => Promise<void>;
  deleteTransaction: (id: string) => Promise<void>;

  saveCategory: (c: Category) => Promise<void>;
  removeCategory: (id: string) => Promise<void>;

  saveGoal: (g: Goal) => Promise<void>;
  removeGoal: (id: string) => Promise<void>;
  contributeToGoal: (goalId: string, amount: number, opts: { logTransfer: boolean; occurredAt: string; rawInput?: string | null }) => Promise<void>;

  /** Saves and schedules. Returns the permission state so the UI can explain when notifications are off. */
  addReminder: (input: Omit<Reminder, 'id' | 'createdAt' | 'notificationId'>) => Promise<PermissionState>;
  removeReminder: (id: string) => Promise<void>;
  /** Re-schedules what needs it (monthly reminders, ones saved while notifications were off) and drops past one-offs. */
  rearmReminders: () => Promise<void>;

  /** Saves the chosen lines from a statement as entries. Returns how many were added. */
  importStatement: (lines: StatementLine[], meta: { kind: 'bank' | 'card' | 'credit_report'; periodStart: string | null; periodEnd: string | null }) => Promise<number>;
  saveDebt: (d: Debt) => Promise<void>;
  removeDebt: (id: string) => Promise<void>;
  /** Adds or refreshes debts from a credit report or card statement (matched by creditor name). */
  mergeTradelines: (lines: Tradeline[]) => Promise<number>;

  saveRule: (r: RecurringRule) => Promise<void>;
  removeRule: (id: string) => Promise<void>;
  runRecurringCatchUp: () => Promise<number>;

  updateSettings: (patch: Partial<Settings>) => Promise<void>;
  learnCategory: (rawInput: string, categoryId: string) => Promise<void>;
  forgetKeyword: (word: string) => Promise<void>;
  restoreAll: (data: Parameters<typeof repo.replaceAllData>[1]) => Promise<void>;
  resetAll: () => Promise<void>;
}

export const useAppStore = create<AppState>((set, get) => ({
  ready: false,
  settings: null,
  categories: [],
  reminders: [],
  debts: [],
  imports: [],
  fingerprints: new Set<string>(),
  notifications: null,
  goals: [],
  rules: [],
  keywords: [],
  keywordMap: {},
  recent: [],
  month: currentMonthKey(),
  stats: null,
  lifetime: { income: 0, expenses: 0 },

  init: async () => {
    await getDb();
    await get().runRecurringCatchUp();
    await get().refresh();
    set({ ready: true });
    get().rearmReminders().catch(() => {});
    sweepImportCache().catch(() => {});
  },

  refresh: async () => {
    const db = await getDb();
    const month = get().month;
    const [settings, categories, goals, rules, keywords, recent, stats, lifetime, reminders, debts, imports, fingerprints] = await Promise.all([
      repo.getSettings(db),
      repo.allCategories(db),
      repo.allGoals(db),
      repo.allRules(db),
      repo.allKeywords(db),
      repo.recentTransactions(db, 10),
      repo.monthStats(db, month),
      repo.lifetimeTotals(db),
      repo.allReminders(db),
      repo.allDebts(db),
      repo.allImports(db),
      repo.allFingerprints(db),
    ]);
    const keywordMap: Record<string, string> = {};
    for (const k of keywords) keywordMap[k.word] = k.categoryId;
    set({ settings, categories, goals, rules, keywords, keywordMap, recent, stats, lifetime, reminders, debts, imports, fingerprints });
  },

  setMonth: async (month) => {
    set({ month });
    const db = await getDb();
    set({ stats: await repo.monthStats(db, month) });
  },

  addTransaction: async (input) => {
    const db = await getDb();
    const t: Transaction = { ...input, note: input.note ? redactSensitive(input.note) || null : null, rawInput: input.rawInput ? redactSensitive(input.rawInput) || null : null, id: newId(), createdAt: nowIso(), isRecurringInstance: false, recurringRuleId: null };
    await repo.insertTransaction(db, t);
    await get().refresh();
    return t;
  },

  updateTransaction: async (t) => {
    const db = await getDb();
    await repo.updateTransaction(db, { ...t, note: t.note ? redactSensitive(t.note) || null : null });
    await get().refresh();
  },

  deleteTransaction: async (id) => {
    const db = await getDb();
    await repo.deleteTransaction(db, id);
    await get().refresh();
  },

  saveCategory: async (c) => {
    const db = await getDb();
    await repo.upsertCategory(db, c);
    await get().refresh();
  },

  removeCategory: async (id) => {
    const db = await getDb();
    await repo.deleteCategory(db, id);
    await get().refresh();
  },

  saveGoal: async (g) => {
    const db = await getDb();
    await repo.upsertGoal(db, { ...g, name: redactSensitive(g.name) || g.name });
    await get().refresh();
  },

  removeGoal: async (id) => {
    const db = await getDb();
    await repo.deleteGoal(db, id);
    await get().refresh();
  },

  contributeToGoal: async (goalId, amount, opts) => {
    const db = await getDb();
    const goal = get().goals.find((g) => g.id === goalId);
    if (!goal) return;
    const current = Math.max(0, goal.currentAmount + amount);
    await repo.upsertGoal(db, { ...goal, currentAmount: current, completed: goal.completed || current >= goal.targetAmount });
    if (opts.logTransfer && amount > 0) {
      const savings = get().categories.find((c) => c.id === (goal.kind === 'debt' ? 'debt' : 'savings') && !c.archived);
      await repo.insertTransaction(db, {
        id: newId(),
        amount,
        type: 'expense',
        categoryId: savings?.id ?? null,
        note: getLocale(get().settings?.language).s.toward(goal.name),
        rawInput: opts.rawInput ?? null,
        occurredAt: opts.occurredAt,
        createdAt: nowIso(),
        isRecurringInstance: false,
        recurringRuleId: null,
      });
    }
    await get().refresh();
  },

  addReminder: async (input) => {
    const db = await getDb();
    const settings = get().settings;
    const title = getLocale(resolveLanguage(settings?.language)).s.reminderNotificationTitle;
    const rem: Reminder = { ...input, text: redactSensitive(input.text) || input.text, id: newId(), createdAt: nowIso(), notificationId: null };
    rem.notificationId = await scheduleReminderNotification(rem, title);
    await repo.upsertReminder(db, rem);
    const state = await notificationPermissionState();
    set({ notifications: state });
    await get().refresh();
    return state;
  },

  removeReminder: async (id) => {
    const db = await getDb();
    const rem = get().reminders.find((r) => r.id === id);
    if (rem) await cancelReminderNotification(rem.notificationId);
    await repo.deleteReminder(db, id);
    await get().refresh();
  },

  rearmReminders: async () => {
    const db = await getDb();
    const state = await notificationPermissionState();
    set({ notifications: state });
    const title = getLocale(resolveLanguage(get().settings?.language)).s.reminderNotificationTitle;
    let changed = false;
    for (const rem of get().reminders) {
      if (rem.repeat === 'none' && !nextOccurrence(rem)) {
        await cancelReminderNotification(rem.notificationId);
        await repo.deleteReminder(db, rem.id);
        changed = true;
        continue;
      }
      if (state !== 'granted') continue;
      if (rem.notificationId && rem.repeat !== 'monthly') continue;
      const id = await scheduleReminderNotification(rem, title);
      if (id !== rem.notificationId) { await repo.upsertReminder(db, { ...rem, notificationId: id }); changed = true; }
    }
    if (changed) await get().refresh();
  },

  importStatement: async (lines, meta) => {
    const db = await getDb();
    const importId = newId();
    const known = get().fingerprints;
    let count = 0;
    await db.withTransactionAsync(async () => {
      for (const l of lines) {
        if (!l.include || known.has(l.fingerprint)) continue;
        const type = l.direction === 'in' ? 'income' : 'expense';
        await repo.insertTransaction(db, {
          id: newId(), amount: l.amount, type, categoryId: l.categoryId, note: redactSensitive(l.description) || null, rawInput: null, occurredAt: l.date,
          createdAt: nowIso(), isRecurringInstance: false, recurringRuleId: null, fingerprint: l.fingerprint, importId,
        });
        known.add(l.fingerprint);
        count += 1;
      }
      // The file name is not kept either (it often carries an account number).
      await repo.insertImport(db, { id: importId, kind: meta.kind, fileName: '', periodStart: meta.periodStart, periodEnd: meta.periodEnd, count, importedAt: nowIso() });
    });
    await get().refresh();
    return count;
  },

  saveDebt: async (d) => {
    const db = await getDb();
    await repo.upsertDebt(db, { ...d, creditor: redactSensitive(d.creditor) || d.creditor, updatedAt: nowIso() });
    await get().refresh();
  },

  removeDebt: async (id) => {
    const db = await getDb();
    await repo.deleteDebt(db, id);
    await get().refresh();
  },

  mergeTradelines: async (lines) => {
    const db = await getDb();
    const existing = get().debts;
    const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    let n = 0;
    for (const t of lines) {
      if (t.balance == null && t.monthlyPayment == null) continue;
      const match = existing.find((d) => norm(d.creditor) === norm(t.creditor) || (t.source === 'card_statement' && d.source === 'card_statement' && norm(d.creditor).slice(-4) === norm(t.creditor).slice(-4)));
      await repo.upsertDebt(db, {
        id: match?.id ?? newId(),
        creditor: (redactSensitive(t.creditor) || t.creditor).slice(0, 80),
        type: t.type,
        balance: t.balance ?? match?.balance ?? 0,
        monthlyPayment: t.monthlyPayment ?? match?.monthlyPayment ?? null,
        creditLimit: t.creditLimit ?? match?.creditLimit ?? null,
        apr: t.apr ?? match?.apr ?? null,
        source: t.source,
        updatedAt: nowIso(),
      });
      n += 1;
    }
    await get().refresh();
    return n;
  },

  saveRule: async (r) => {
    const db = await getDb();
    await repo.upsertRule(db, r);
    await get().runRecurringCatchUp();
    await get().refresh();
  },

  removeRule: async (id) => {
    const db = await getDb();
    await repo.deleteRule(db, id);
    await get().refresh();
  },

  /** Logs every due occurrence of every active rule. Returns how many entries were created. */
  runRecurringCatchUp: async () => {
    const db = await getDb();
    const rules = await repo.allRules(db);
    const todayStr = today();
    let created = 0;
    for (const rule of rules) {
      if (!rule.active) continue;
      const { due, nextOccurrence } = dueOccurrences(rule, todayStr);
      if (due.length === 0) continue;
      await db.withTransactionAsync(async () => {
        for (const date of due) {
          await repo.insertTransaction(db, {
            id: newId(),
            amount: rule.amount,
            type: rule.type,
            categoryId: rule.categoryId,
            note: rule.note,
            rawInput: null,
            occurredAt: date,
            createdAt: nowIso(),
            isRecurringInstance: true,
            recurringRuleId: rule.id,
          });
          created += 1;
        }
        await repo.upsertRule(db, { ...rule, nextOccurrence });
      });
    }
    return created;
  },

  updateSettings: async (patch) => {
    const db = await getDb();
    const current = get().settings ?? (await repo.getSettings(db));
    const next = { ...current, ...patch };
    await repo.saveSettings(db, next);
    set({ settings: next });
  },

  learnCategory: async (rawInput, categoryId) => {
    const db = await getDb();
    const words = learnableWords(rawInput, resolveLanguage(get().settings?.language));
    for (const w of words) await repo.upsertKeyword(db, w, categoryId);
    if (words.length) await get().refresh();
  },

  forgetKeyword: async (word) => {
    const db = await getDb();
    await repo.deleteKeyword(db, word);
    await get().refresh();
  },

  restoreAll: async (data) => {
    const db = await getDb();
    await repo.replaceAllData(db, data);
    await get().runRecurringCatchUp();
    await get().refresh();
  },

  resetAll: async () => {
    const db = await getDb();
    const { resetDatabase } = await import('@/db/database');
    await resetDatabase(db);
    await get().refresh();
  },
}));

export function useSettings(): Settings {
  const s = useAppStore((st) => st.settings);
  if (!s) throw new Error('settings not loaded');
  return s;
}

export function useCategory(id: string | null | undefined): Category | undefined {
  return useAppStore((st) => (id ? st.categories.find((c) => c.id === id) : undefined));
}
