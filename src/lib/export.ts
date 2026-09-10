/**
 * Builders for the export formats. Pure functions; file writing lives in files.ts.
 */
import type { Category, Goal, KeywordMapping, RecurringRule, Settings, Transaction } from '@/types';
import { monthLabel, monthKey } from './dates';
import { formatMoney } from './money';

export const BACKUP_VERSION = 1;

export interface BackupPayload {
  app: 'plainly';
  version: number;
  exportedAt: string;
  settings: Settings;
  categories: Category[];
  transactions: Transaction[];
  recurringRules: RecurringRule[];
  goals: Goal[];
  keywords: KeywordMapping[];
}

function csvCell(v: string | number | null | undefined): string {
  if (v == null) return '';
  const s = String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function transactionsToCsv(transactions: Transaction[], categories: Category[]): string {
  const byId = new Map(categories.map((c) => [c.id, c.name]));
  const header = ['date', 'type', 'amount', 'category', 'note', 'recurring', 'original_input', 'id'];
  const rows = [...transactions]
    .sort((a, b) => (a.occurredAt < b.occurredAt ? -1 : a.occurredAt > b.occurredAt ? 1 : a.createdAt.localeCompare(b.createdAt)))
    .map((t) => [
      t.occurredAt,
      t.type,
      t.amount.toFixed(2),
      t.categoryId ? byId.get(t.categoryId) ?? '' : '',
      t.note ?? '',
      t.isRecurringInstance ? 'yes' : 'no',
      t.rawInput ?? '',
      t.id,
    ].map(csvCell).join(','));
  return [header.join(','), ...rows].join('\n') + '\n';
}

/** A human-readable summary: totals per month, then per category. */
export function summaryText(transactions: Transaction[], categories: Category[], goals: Goal[], currency: string, generatedAt: string): string {
  const byId = new Map(categories.map((c) => [c.id, c]));
  const money = (n: number) => formatMoney(n, currency);
  const months = new Map<string, Transaction[]>();
  for (const t of transactions) {
    const k = monthKey(t.occurredAt);
    if (!months.has(k)) months.set(k, []);
    months.get(k)!.push(t);
  }
  const lines: string[] = [];
  lines.push('Plainly summary');
  lines.push(`Generated ${generatedAt.slice(0, 10)}`);
  lines.push('');
  if (months.size === 0) lines.push('No entries yet.');
  for (const k of [...months.keys()].sort().reverse()) {
    const list = months.get(k)!;
    const income = list.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0);
    const expenses = list.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
    lines.push(monthLabel(k));
    lines.push(`  In: ${money(income)}   Out: ${money(expenses)}   Net: ${money(income - expenses)}`);
    const perCat = new Map<string, number>();
    for (const t of list) {
      if (t.type !== 'expense') continue;
      const name = t.categoryId ? byId.get(t.categoryId)?.name ?? 'Uncategorized' : 'Uncategorized';
      perCat.set(name, (perCat.get(name) ?? 0) + t.amount);
    }
    for (const [name, total] of [...perCat.entries()].sort((a, b) => b[1] - a[1])) {
      lines.push(`  ${name}: ${money(total)}`);
    }
    lines.push('');
  }
  const openGoals = goals.filter((g) => !g.completed);
  if (openGoals.length) {
    lines.push('Goals');
    for (const g of openGoals) {
      lines.push(`  ${g.name}: ${money(g.currentAmount)} of ${money(g.targetAmount)}${g.targetDate ? ` by ${g.targetDate}` : ''}`);
    }
    lines.push('');
  }
  lines.push('Made with Plainly. No bank linking, no ads, no tracking.');
  return lines.join('\n');
}

export function buildBackup(data: Omit<BackupPayload, 'app' | 'version' | 'exportedAt'>, exportedAt: string): BackupPayload {
  return { app: 'plainly', version: BACKUP_VERSION, exportedAt, ...data };
}

export function isBackupPayload(x: unknown): x is BackupPayload {
  if (!x || typeof x !== 'object') return false;
  const o = x as Record<string, unknown>;
  return o.app === 'plainly' && typeof o.version === 'number' && Array.isArray(o.categories) && Array.isArray(o.transactions) && Array.isArray(o.goals);
}
