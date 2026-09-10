import { create } from 'zustand';
import type { Category, Goal, KeywordMapping, MonthStats, RecurringRule, Settings, Transaction } from '@/types';
import { getDb } from '@/db/database';
import * as repo from '@/db/repositories';
import { currentMonthKey, nowIso, today } from '@/lib/dates';
import { newId } from '@/lib/ids';
import { dueOccurrences } from '@/lib/recurring';
import { learnableWords } from '@/parser';

interface AppState {
  ready: boolean;
  settings: Settings | null;
  categories: Category[];
  goals: Goal[];
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
  },

  refresh: async () => {
    const db = await getDb();
    const month = get().month;
    const [settings, categories, goals, rules, keywords, recent, stats, lifetime] = await Promise.all([
      repo.getSettings(db),
      repo.allCategories(db),
      repo.allGoals(db),
      repo.allRules(db),
      repo.allKeywords(db),
      repo.recentTransactions(db, 10),
      repo.monthStats(db, month),
      repo.lifetimeTotals(db),
    ]);
    const keywordMap: Record<string, string> = {};
    for (const k of keywords) keywordMap[k.word] = k.categoryId;
    set({ settings, categories, goals, rules, keywords, keywordMap, recent, stats, lifetime });
  },

  setMonth: async (month) => {
    set({ month });
    const db = await getDb();
    set({ stats: await repo.monthStats(db, month) });
  },

  addTransaction: async (input) => {
    const db = await getDb();
    const t: Transaction = { ...input, id: newId(), createdAt: nowIso(), isRecurringInstance: false, recurringRuleId: null };
    await repo.insertTransaction(db, t);
    await get().refresh();
    return t;
  },

  updateTransaction: async (t) => {
    const db = await getDb();
    await repo.updateTransaction(db, t);
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
    await repo.upsertGoal(db, g);
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
      const savings = get().categories.find((c) => c.id === 'savings' && !c.archived);
      await repo.insertTransaction(db, {
        id: newId(),
        amount,
        type: 'expense',
        categoryId: savings?.id ?? null,
        note: `Toward ${goal.name}`,
        rawInput: opts.rawInput ?? null,
        occurredAt: opts.occurredAt,
        createdAt: nowIso(),
        isRecurringInstance: false,
        recurringRuleId: null,
      });
    }
    await get().refresh();
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
      await db.withExclusiveTransactionAsync(async () => {
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
    const words = learnableWords(rawInput);
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
