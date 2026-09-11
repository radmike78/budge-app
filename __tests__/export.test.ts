import { DEFAULT_CATEGORIES } from '@/lib/defaultCategories';
import { buildBackup, isBackupPayload, summaryText, transactionsToCsv } from '@/lib/export';
import { base64ToBytes, bytesToBase64, decryptBackup, encryptBackup } from '@/lib/backupCrypto';
import type { Settings, Transaction } from '@/types';

const tx: Transaction[] = [
  { id: 't1', amount: 12, type: 'expense', categoryId: 'dining', note: 'Lunch, with "Sam"', rawInput: 'spent 12 on lunch', occurredAt: '2026-09-02', createdAt: '2026-09-02T12:00:00.000Z', isRecurringInstance: false, recurringRuleId: null },
  { id: 't2', amount: 2400, type: 'income', categoryId: 'salary', note: null, rawInput: 'got paid 2400', occurredAt: '2026-09-01', createdAt: '2026-09-01T09:00:00.000Z', isRecurringInstance: true, recurringRuleId: 'r1' },
];

describe('transactionsToCsv', () => {
  it('quotes fields and sorts by date', () => {
    const csv = transactionsToCsv(tx, DEFAULT_CATEGORIES);
    const lines = csv.trim().split('\n');
    expect(lines[0]).toBe('date,type,amount,category,note,recurring,original_input,id');
    expect(lines[1]).toBe('2026-09-01,income,2400.00,Salary,,yes,got paid 2400,t2');
    expect(lines[2]).toBe('2026-09-02,expense,12.00,Dining out,"Lunch, with ""Sam""",no,spent 12 on lunch,t1');
  });
});

describe('summaryText', () => {
  it('lists months and categories', () => {
    const text = summaryText(tx, DEFAULT_CATEGORIES, [], 'USD', '2026-09-10T00:00:00.000Z');
    expect(text).toContain('September 2026');
    expect(text).toContain('In: $2,400.00   Out: $12.00   Net: $2,388.00');
    expect(text).toContain('Dining out: $12.00');
  });
});

describe('backup round trip', () => {
  const settings: Settings = { currency: 'USD', theme: 'system', lastBackupAt: null, startingBalance: null, onboardingDone: true, reminderEnabled: false, reminderHour: 20, smartParseEnabled: false, appLockEnabled: false, language: 'system' };
  const payload = buildBackup({ settings, categories: DEFAULT_CATEGORIES, transactions: tx, recurringRules: [], goals: [], keywords: [] }, '2026-09-10T00:00:00.000Z');

  it('validates payloads', () => {
    expect(isBackupPayload(payload)).toBe(true);
    expect(isBackupPayload({ app: 'other' })).toBe(false);
  });

  it('base64 helpers round trip', () => {
    const bytes = new Uint8Array([0, 1, 2, 250, 251, 252, 253, 254, 255]);
    expect(base64ToBytes(bytesToBase64(bytes))).toEqual(bytes);
    expect(bytesToBase64(new Uint8Array([104, 105]))).toBe('aGk=');
  });

  it('encrypts and decrypts with the right passphrase', () => {
    let seed = 1;
    const random = (n: number) => new Uint8Array(Array.from({ length: n }, () => (seed = (seed * 16807) % 2147483647) & 255));
    const json = JSON.stringify(payload);
    const file = encryptBackup(json, 'correct horse', random);
    expect(file.ciphertext).not.toContain('onlybudget');
    expect(decryptBackup(file, 'correct horse')).toBe(json);
    expect(() => decryptBackup(file, 'wrong')).toThrow();
  });
});
