import { DEFAULT_CATEGORIES } from '@/lib/defaultCategories';
import { goalPlanSentence } from '@/lib/plain';
import { parseEntries, parseInput, type ParseContext } from '@/parser';
import { en } from '@/i18n/locales/en';
import type { Goal } from '@/types';

const TODAY = '2026-09-11';
const ctx = (language = 'en', goals: Goal[] = []): ParseContext => ({ categories: DEFAULT_CATEGORIES, goals, keywordMap: {}, today: TODAY, language });

describe('spoken goals', () => {
  it('sets a savings goal with a name and a month-year deadline', () => {
    const r = parseInput('Set a goal of $10,000 for a trip to Hawaii in Oct 2027.', ctx());
    expect(r.kind).toBe('goal');
    expect(r.goalKind).toBe('saving');
    expect(r.amount).toBe(10000);
    expect(r.goalName).toBe('Trip to Hawaii');
    expect(r.targetDate).toBe('2027-10-31');
    expect(r.hints).toEqual([]);
  });
  it('makes a pay-down plan from "within 12 months"', () => {
    const r = parseInput('Make a plan to pay down $5,000 of debt within 12 months.', ctx());
    expect(r.kind).toBe('goal');
    expect(r.goalKind).toBe('debt');
    expect(r.amount).toBe(5000);
    expect(r.goalName).toBe('Debt');
    expect(r.targetDate).toBe('2027-09-11');
  });
  it('understands paying off a card by a deadline without a goal word', () => {
    const r = parseInput('Pay off my $2,500 credit card in 6 months', ctx());
    expect(r).toMatchObject({ kind: 'goal', goalKind: 'debt', amount: 2500, goalName: 'Credit card', targetDate: '2027-03-11' });
  });
  it('keeps a debt goal without a date open and names the debt', () => {
    const r = parseInput('I want to pay down 8000 of student loans', ctx());
    expect(r).toMatchObject({ kind: 'goal', goalKind: 'debt', amount: 8000, goalName: 'Student loans', targetDate: null });
    expect(r.hints).toEqual(['hint.goalNoDate']);
  });
  it('reads "by next June" and "by end of 2027"', () => {
    expect(parseInput('I want to save 3000 for a new laptop by next June', ctx())).toMatchObject({ kind: 'goal', goalName: 'Laptop', targetDate: '2027-06-30' });
    expect(parseInput('Goal: emergency fund 5k by end of 2027', ctx())).toMatchObject({ kind: 'goal', amount: 5000, goalName: 'Emergency fund', targetDate: '2027-12-31' });
  });
  it('still treats a past payment as an expense, not a goal', () => {
    const r = parseInput('paid 200 on my credit card', ctx());
    expect(r.kind).toBe('transaction');
    expect(r.categoryId).toBe('debt');
  });
  it('logs a payment toward an existing debt goal under Debt', () => {
    const goals: Goal[] = [{ id: 'g1', name: 'Credit card', kind: 'debt', targetAmount: 2500, currentAmount: 0, targetDate: null, createdAt: '2026-08-01T00:00:00Z', completed: false }];
    const r = parseInput('paid 300 toward the credit card', ctx('en', goals));
    expect(r.kind).toBe('contribution');
    expect(r.goalId).toBe('g1');
    expect(r.categoryId).toBe('debt');
  });
  it('does not split a debt goal into several entries', () => {
    const rows = parseEntries('Make a plan to pay down $5,000 of debt within 12 months.', ctx());
    expect(rows).toHaveLength(1);
    expect(rows[0].kind).toBe('goal');
  });
  it.each([
    ['es', 'Quiero pagar 5000 de deuda en 12 meses', 'Deuda'],
    ['es', 'Haz un plan para liquidar la tarjeta de crédito, 3000 en 6 meses', 'Tarjeta de crédito'],
    ['fr', 'Je veux rembourser 5000 de dettes dans 12 mois', 'Dettes'],
    ['it', 'Voglio estinguere 5000 di debiti in 12 mesi', 'Debiti'],
    ['de', 'Ich will 5000 Schulden in 12 Monaten abbezahlen', 'Schulden'],
    ['zh', '计划12个月内还清5000的信用卡', '信用卡'],
    ['ja', '12ヶ月以内に借金を50万円返済したい', '借金'],
    ['ko', '12개월 안에 대출 500만원 갚고 싶어', '대출'],
  ])('%s: "%s" is a pay-down goal', (lang, text, name) => {
    const r = parseInput(text, ctx(lang));
    expect(r.kind).toBe('goal');
    expect(r.goalKind).toBe('debt');
    expect(r.goalName).toBe(name);
    expect(r.amount).toBeGreaterThan(0);
    expect(r.targetDate).not.toBeNull();
  });
});

describe('goal plan sentence', () => {
  it('spells out a monthly and weekly amount until the date', () => {
    const s = goalPlanSentence(5000, 0, '2027-09-11', 'debt', 'USD', TODAY, en);
    expect(s).toBe('The plan: about $417 a month ($97 a week) until September 11, 2027.');
  });
  it('says so when there is no deadline', () => {
    expect(goalPlanSentence(3000, 500, null, 'saving', 'USD', TODAY, en)).toBe('$2,500 to save. No deadline, so any amount counts.');
  });
});
