import * as SQLite from 'expo-sqlite';
import { DEFAULT_CATEGORIES } from '@/lib/defaultCategories';

export type DB = SQLite.SQLiteDatabase;

let dbPromise: Promise<DB> | null = null;

export function getDb(): Promise<DB> {
  if (!dbPromise) {
    dbPromise = (async () => {
      const db = await SQLite.openDatabaseAsync('onlybudget.db');
      await db.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
      await migrate(db);
      return db;
    })();
  }
  return dbPromise;
}

/**
 * Schema versions. Add a new entry to MIGRATIONS for every change; never edit
 * an existing one, since users' databases may be at any version.
 */
const MIGRATIONS: string[] = [
  // v1: initial schema (mirrors the product spec, plus a category `kind` and a
  // learned-keywords table for the parser).
  `
  CREATE TABLE IF NOT EXISTS categories (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    icon TEXT,
    kind TEXT NOT NULL CHECK (kind IN ('income', 'expense')),
    monthly_limit REAL,
    is_default INTEGER DEFAULT 0,
    archived INTEGER DEFAULT 0,
    sort_order INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS recurring_rules (
    id TEXT PRIMARY KEY,
    amount REAL NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
    category_id TEXT REFERENCES categories(id) ON DELETE SET NULL,
    frequency TEXT NOT NULL CHECK (frequency IN ('weekly','biweekly','monthly','yearly')),
    next_occurrence TEXT NOT NULL,
    note TEXT,
    active INTEGER DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS transactions (
    id TEXT PRIMARY KEY,
    amount REAL NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
    category_id TEXT REFERENCES categories(id) ON DELETE SET NULL,
    note TEXT,
    raw_input TEXT,
    occurred_at TEXT NOT NULL,
    created_at TEXT NOT NULL,
    is_recurring_instance INTEGER DEFAULT 0,
    recurring_rule_id TEXT REFERENCES recurring_rules(id) ON DELETE SET NULL
  );
  CREATE INDEX IF NOT EXISTS idx_transactions_occurred ON transactions(occurred_at);
  CREATE INDEX IF NOT EXISTS idx_transactions_category ON transactions(category_id);

  CREATE TABLE IF NOT EXISTS goals (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    target_amount REAL NOT NULL,
    current_amount REAL DEFAULT 0,
    target_date TEXT,
    created_at TEXT NOT NULL,
    completed INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS settings (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    currency TEXT DEFAULT 'USD',
    theme TEXT DEFAULT 'system',
    last_backup_at TEXT,
    starting_balance REAL,
    onboarding_done INTEGER DEFAULT 0,
    reminder_enabled INTEGER DEFAULT 0,
    reminder_hour INTEGER DEFAULT 20,
    smart_parse_enabled INTEGER DEFAULT 0
  );
  INSERT OR IGNORE INTO settings (id) VALUES (1);

  CREATE TABLE IF NOT EXISTS keyword_mappings (
    word TEXT PRIMARY KEY,
    category_id TEXT NOT NULL REFERENCES categories(id) ON DELETE CASCADE
  );
  `,
];

async function migrate(db: DB): Promise<void> {
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  let version = row?.user_version ?? 0;
  for (let i = version; i < MIGRATIONS.length; i += 1) {
    await db.withExclusiveTransactionAsync(async (txn) => {
      await txn.execAsync(MIGRATIONS[i]);
      await txn.execAsync(`PRAGMA user_version = ${i + 1}`);
    });
    version = i + 1;
  }
  await seedDefaultCategories(db);
}

async function seedDefaultCategories(db: DB): Promise<void> {
  const count = await db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM categories');
  if ((count?.n ?? 0) > 0) return;
  for (const c of DEFAULT_CATEGORIES) {
    await db.runAsync(
      'INSERT OR IGNORE INTO categories (id, name, icon, kind, monthly_limit, is_default, archived, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [c.id, c.name, c.icon, c.kind, c.monthlyLimit, c.isDefault ? 1 : 0, c.archived ? 1 : 0, c.sortOrder],
    );
  }
}

/** Test/reset helper: wipes every table and re-seeds defaults. */
export async function resetDatabase(db: DB): Promise<void> {
  await db.withExclusiveTransactionAsync(async (txn) => {
    await txn.execAsync('DELETE FROM transactions; DELETE FROM recurring_rules; DELETE FROM goals; DELETE FROM keyword_mappings; DELETE FROM categories;');
    await txn.execAsync("UPDATE settings SET currency='USD', theme='system', last_backup_at=NULL, starting_balance=NULL, reminder_enabled=0, reminder_hour=20, smart_parse_enabled=0 WHERE id=1");
  });
  await seedDefaultCategories(db);
}
