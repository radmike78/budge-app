import type { Category } from '@/types';

/**
 * Default category set. IDs are stable strings so the parser dictionary and
 * backups can reference them. Users can rename, archive, or add categories.
 */
export const DEFAULT_CATEGORIES: Category[] = [
  // Income
  { id: 'salary', name: 'Salary', icon: '💼', kind: 'income', monthlyLimit: null, isDefault: true, archived: false, sortOrder: 0 },
  { id: 'freelance', name: 'Freelance / Side income', icon: '🛠️', kind: 'income', monthlyLimit: null, isDefault: true, archived: false, sortOrder: 1 },
  { id: 'gift_income', name: 'Gift', icon: '🎁', kind: 'income', monthlyLimit: null, isDefault: true, archived: false, sortOrder: 2 },
  { id: 'other_income', name: 'Other income', icon: '➕', kind: 'income', monthlyLimit: null, isDefault: true, archived: false, sortOrder: 3 },
  // Expenses
  { id: 'groceries', name: 'Groceries', icon: '🥦', kind: 'expense', monthlyLimit: null, isDefault: true, archived: false, sortOrder: 10 },
  { id: 'dining', name: 'Dining out', icon: '🍽️', kind: 'expense', monthlyLimit: null, isDefault: true, archived: false, sortOrder: 11 },
  { id: 'rent', name: 'Rent / Mortgage', icon: '🏠', kind: 'expense', monthlyLimit: null, isDefault: true, archived: false, sortOrder: 12 },
  { id: 'utilities', name: 'Utilities', icon: '💡', kind: 'expense', monthlyLimit: null, isDefault: true, archived: false, sortOrder: 13 },
  { id: 'transport', name: 'Transportation', icon: '🚌', kind: 'expense', monthlyLimit: null, isDefault: true, archived: false, sortOrder: 14 },
  { id: 'health', name: 'Health', icon: '🩺', kind: 'expense', monthlyLimit: null, isDefault: true, archived: false, sortOrder: 15 },
  { id: 'entertainment', name: 'Entertainment', icon: '🎬', kind: 'expense', monthlyLimit: null, isDefault: true, archived: false, sortOrder: 16 },
  { id: 'shopping', name: 'Shopping', icon: '🛍️', kind: 'expense', monthlyLimit: null, isDefault: true, archived: false, sortOrder: 17 },
  { id: 'subscriptions', name: 'Subscriptions', icon: '🔁', kind: 'expense', monthlyLimit: null, isDefault: true, archived: false, sortOrder: 18 },
  { id: 'debt', name: 'Debt payment', icon: '🏦', kind: 'expense', monthlyLimit: null, isDefault: true, archived: false, sortOrder: 19 },
  { id: 'savings', name: 'Savings / Transfer', icon: '🐖', kind: 'expense', monthlyLimit: null, isDefault: true, archived: false, sortOrder: 20 },
  { id: 'other_expense', name: 'Other', icon: '🧾', kind: 'expense', monthlyLimit: null, isDefault: true, archived: false, sortOrder: 21 },
];

export const FALLBACK_EXPENSE_CATEGORY_ID = 'other_expense';
export const FALLBACK_INCOME_CATEGORY_ID = 'other_income';
