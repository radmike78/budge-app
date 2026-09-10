import { formatMoney, parseMoneyInput } from '@/lib/money';
import { friendlyDate, longDate, monthLabel } from '@/lib/dates';
import { de } from '@/i18n/locales/de';
import { en } from '@/i18n/locales/en';
import { es } from '@/i18n/locales/es';
import { fr } from '@/i18n/locales/fr';
import { it as itLocale } from '@/i18n/locales/it';
import { ja } from '@/i18n/locales/ja';
import { ko } from '@/i18n/locales/ko';
import { zh } from '@/i18n/locales/zh';
import { monthSummarySentence, goalProgress } from '@/lib/plain';
import type { MonthStats } from '@/types';

const ALL = [en, es, fr, itLocale, de, zh, ja, ko];

describe('money formatting per locale', () => {
  it('uses locale separators and symbol placement', () => {
    expect(formatMoney(1234.5, 'EUR', { format: de.format })).toBe('1.234,50 €');
    expect(formatMoney(1234.5, 'EUR', { format: fr.format })).toBe('1 234,50 €');
    expect(formatMoney(1234.5, 'EUR', { format: es.format, compact: true })).toBe('1.234,50 €');
    expect(formatMoney(1200, 'JPY', { format: ja.format })).toBe('¥1,200');
    expect(formatMoney(25000, 'KRW', { format: ko.format })).toBe('₩25,000');
    expect(formatMoney(12, 'CNY', { format: zh.format })).toBe('¥12.00');
    expect(formatMoney(-12, 'EUR', { format: itLocale.format })).toBe('-12,00 €');
  });
  it('parses typed amounts with decimal commas', () => {
    expect(parseMoneyInput('12,50', true)).toBe(12.5);
    expect(parseMoneyInput('1.200,50', true)).toBe(1200.5);
    expect(parseMoneyInput('1,200.50', false)).toBe(1200.5);
    expect(parseMoneyInput('12,50', false)).toBe(12.5);
  });
});

describe('date formatting per locale', () => {
  const T = '2026-09-10';
  it('formats long and short dates', () => {
    expect(longDate('2026-09-03', T, es.format)).toBe('3 de septiembre');
    expect(longDate('2027-01-01', T, fr.format)).toBe('1er janvier 2027');
    expect(longDate('2026-09-03', T, de.format)).toBe('3. September');
    expect(longDate('2026-09-03', T, ja.format)).toBe('9月3日');
    expect(longDate('2026-09-03', T, ko.format)).toBe('9월 3일');
    expect(friendlyDate('2026-09-07', T, { ...zh.format, today: zh.s.today, yesterday: zh.s.yesterday })).toBe('9月7日 周一');
    expect(friendlyDate(T, T, { ...itLocale.format, today: itLocale.s.today, yesterday: itLocale.s.yesterday })).toBe('Oggi');
    expect(monthLabel('2026-09', de.format)).toBe('September 2026');
    expect(monthLabel('2026-09', ko.format)).toBe('2026년 9월');
  });
});

describe('plain-language sentences exist in every locale', () => {
  const stats: MonthStats = { month: '2026-09', income: 2400, expenses: 1180, byCategory: [] };
  it.each(ALL.map((l) => [l.code, l] as const))('%s month summary and goal pace are non-empty', (_code, locale) => {
    const sentence = monthSummarySentence(stats, locale.defaultCurrency, true, locale);
    expect(sentence.length).toBeGreaterThan(10);
    const p = goalProgress({ id: 'g', name: 'X', targetAmount: 500, currentAmount: 320, targetDate: '2026-12-01', createdAt: '2026-08-01T00:00:00.000Z', completed: false }, locale.defaultCurrency, '2026-09-10', locale);
    expect(p.status).toBe('ahead');
    expect(p.sentence.length).toBeGreaterThan(5);
  });
  it('translates every default category in every locale', () => {
    for (const l of ALL) {
      for (const id of ['salary', 'freelance', 'gift_income', 'other_income', 'groceries', 'dining', 'rent', 'utilities', 'transport', 'health', 'entertainment', 'shopping', 'subscriptions', 'debt', 'savings', 'other_expense']) {
        expect(l.s.categoryNames[id]).toBeTruthy();
      }
      expect(Object.keys(l.s.hints).length).toBe(Object.keys(en.s.hints).length);
    }
  });
});
