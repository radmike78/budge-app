import { DEFAULT_CATEGORIES } from '@/lib/defaultCategories';
import { extractPastDate, extractFutureDate } from '@/parser/dates';
import { replaceNumberWords } from '@/parser/numberWords';
import { learnableWords, parseInput, type ParseContext } from '@/parser';
import type { Goal } from '@/types';

const TODAY = '2026-09-10'; // a Thursday

const goals: Goal[] = [
  { id: 'g1', name: 'Trip to Japan', kind: 'saving', targetAmount: 3000, currentAmount: 500, targetDate: '2027-04-01', createdAt: '2026-08-01T00:00:00Z', completed: false },
  { id: 'g2', name: 'Emergency fund', kind: 'saving', targetAmount: 1000, currentAmount: 0, targetDate: null, createdAt: '2026-08-01T00:00:00Z', completed: false },
];

function ctx(overrides: Partial<ParseContext> = {}): ParseContext {
  return { categories: DEFAULT_CATEGORIES, goals: [], keywordMap: {}, today: TODAY, ...overrides };
}

describe('replaceNumberWords', () => {
  it.each([
    ['twelve dollars', '12 dollars'],
    ['spent twenty five on lunch', 'spent 25 on lunch'],
    ['twenty-five bucks', '25 bucks'],
    ['two hundred and fifty', '250'],
    ['a hundred bucks', '100 bucks'],
    ['one thousand two hundred', '1200'],
    ['got paid 2.4k', 'got paid 2400'],
    ['2k for rent', '2000 for rent'],
    ['lunch for two people', 'lunch for 2 people'],
    ['no numbers here', 'no numbers here'],
    ['bought a coffee', 'bought a coffee'],
  ])('%s -> %s', (input, expected) => {
    expect(replaceNumberWords(input)).toBe(expected);
  });
});

describe('extractPastDate', () => {
  it.each([
    ['lunch yesterday', '2026-09-09'],
    ['lunch last night', '2026-09-09'],
    ['coffee 3 days ago', '2026-09-07'],
    ['gas on monday', '2026-09-07'],
    ['gas last thursday', '2026-09-03'],
    ['rent on the 1st', '2026-09-01'],
    ['rent on the 15th', '2026-08-15'],
    ['dinner on sept 3', '2026-09-03'],
    ['dinner september 3rd', '2026-09-03'],
    ['dinner dec 20', '2025-12-20'],
    ['paid 9/3', '2026-09-03'],
    ['paid on 2026-08-30', '2026-08-30'],
    ['lunch today', '2026-09-10'],
    ['lunch', null],
  ])('%s -> %s', (input, expected) => {
    expect(extractPastDate(input, TODAY).date).toBe(expected);
  });

  it('removes the phrase from the text', () => {
    expect(extractPastDate('lunch yesterday 12', TODAY).text).toBe('lunch 12');
  });
});

describe('extractFutureDate', () => {
  it.each([
    ['trip by december', '2026-12-31'],
    ['trip by march', '2027-03-31'],
    ['trip by dec 15', '2026-12-15'],
    ['trip by end of year', '2026-12-31'],
    ['trip in 6 months', '2027-03-10'],
    ['trip by 2027-06-01', '2027-06-01'],
    ['trip by next summer', '2027-06-21'],
    ['trip', null],
  ])('%s -> %s', (input, expected) => {
    expect(extractFutureDate(input, TODAY).date).toBe(expected);
  });
});

describe('parseInput: expenses', () => {
  it('parses "spent 12 dollars on lunch"', () => {
    const r = parseInput('spent 12 dollars on lunch', ctx());
    expect(r.kind).toBe('transaction');
    expect(r.amount).toBe(12);
    expect(r.type).toBe('expense');
    expect(r.categoryId).toBe('dining');
    expect(r.note).toBe('Lunch');
    expect(r.occurredAt).toBe(TODAY);
    expect(r.needsReview).toBe(false);
  });

  it('parses "$4.50 coffee"', () => {
    const r = parseInput('$4.50 coffee', ctx());
    expect(r.amount).toBe(4.5);
    expect(r.categoryId).toBe('dining');
    expect(r.type).toBe('expense');
  });

  it('parses "Coffee 4.50"', () => {
    const r = parseInput('Coffee 4.50', ctx());
    expect(r.amount).toBe(4.5);
    expect(r.categoryId).toBe('dining');
    expect(r.note).toBe('Coffee');
  });

  it('parses "paid 1200 rent"', () => {
    const r = parseInput('paid 1200 rent', ctx());
    expect(r.amount).toBe(1200);
    expect(r.categoryId).toBe('rent');
    expect(r.type).toBe('expense');
  });

  it('parses "rent 1,200"', () => {
    const r = parseInput('rent 1,200', ctx());
    expect(r.amount).toBe(1200);
    expect(r.categoryId).toBe('rent');
  });

  it('parses "uber to the airport 34"', () => {
    const r = parseInput('uber to the airport 34', ctx());
    expect(r.amount).toBe(34);
    expect(r.categoryId).toBe('transport');
    expect(r.note).toBe('Uber to the airport');
  });

  it('prefers "gas bill" (utilities) over "gas" (transport)', () => {
    expect(parseInput('paid 80 for the gas bill', ctx()).categoryId).toBe('utilities');
    expect(parseInput('40 gas', ctx()).categoryId).toBe('transport');
  });

  it('parses spoken numbers', () => {
    const r = parseInput('bought groceries for sixty five dollars', ctx());
    expect(r.amount).toBe(65);
    expect(r.categoryId).toBe('groceries');
  });

  it('parses dates inside the sentence', () => {
    const r = parseInput('spent 30 on dinner yesterday', ctx());
    expect(r.occurredAt).toBe('2026-09-09');
    expect(r.dateExplicit).toBe(true);
    expect(r.amount).toBe(30);
    expect(r.note).toBe('Dinner');
  });

  it('does not confuse a date number with the amount', () => {
    const r = parseInput('dinner on sept 3 for 42', ctx());
    expect(r.amount).toBe(42);
    expect(r.occurredAt).toBe('2026-09-03');
  });

  it('treats "gift" as shopping when spending', () => {
    const r = parseInput('spent 25 on a gift for mom', ctx());
    expect(r.type).toBe('expense');
    expect(r.categoryId).toBe('shopping');
  });

  it('falls back to Other with a hint when the category is unknown', () => {
    const r = parseInput('spent 15 on blorp', ctx());
    expect(r.categoryId).toBe('other_expense');
    expect(r.categoryConfidence).toBeLessThan(0.5);
    expect(r.hints.join(' ')).toMatch(/category/i);
  });

  it('flags missing amounts for review', () => {
    const r = parseInput('lunch with sam', ctx());
    expect(r.amount).toBeNull();
    expect(r.needsReview).toBe(true);
    expect(r.hints[0]).toMatch(/amount/i);
  });

  it('prefers the number with a currency marker when there are several', () => {
    const r = parseInput('2 coffees for $9', ctx());
    expect(r.amount).toBe(9);
    expect(r.categoryId).toBe('dining');
  });

  it('parses netflix as a subscription', () => {
    const r = parseInput('netflix 15.99', ctx());
    expect(r.categoryId).toBe('subscriptions');
    expect(r.amount).toBe(15.99);
  });

  it('uses learned keywords first', () => {
    const r = parseInput('spent 12 on blorp', ctx({ keywordMap: { blorp: 'health' } }));
    expect(r.categoryId).toBe('health');
    expect(r.categoryConfidence).toBeGreaterThan(0.9);
  });

  it('matches custom category names', () => {
    const categories = [
      ...DEFAULT_CATEGORIES,
      { id: 'c_pets', name: 'Pets', icon: '🐶', kind: 'expense' as const, monthlyLimit: null, isDefault: false, archived: false, sortOrder: 30 },
    ];
    const r = parseInput('45 for the pets', ctx({ categories }));
    expect(r.categoryId).toBe('c_pets');
  });

  it('ignores archived categories', () => {
    const categories = DEFAULT_CATEGORIES.map((c) => (c.id === 'dining' ? { ...c, archived: true } : c));
    const r = parseInput('lunch 12', ctx({ categories }));
    expect(r.categoryId).toBe('other_expense');
  });
});

describe('parseInput: income', () => {
  it('parses "got paid 2400"', () => {
    const r = parseInput('got paid 2400', ctx());
    expect(r.type).toBe('income');
    expect(r.amount).toBe(2400);
    expect(r.categoryId).toBe('salary');
    expect(r.note).toBeNull();
  });

  it('parses "received 300 from a freelance client"', () => {
    const r = parseInput('received 300 from a freelance client', ctx());
    expect(r.type).toBe('income');
    expect(r.categoryId).toBe('freelance');
    expect(r.amount).toBe(300);
  });

  it('parses "paycheck 2,400.55"', () => {
    const r = parseInput('paycheck 2,400.55', ctx());
    expect(r.type).toBe('income');
    expect(r.amount).toBe(2400.55);
  });

  it('parses "grandma gave me 50"', () => {
    const r = parseInput('grandma gave me 50', ctx());
    expect(r.type).toBe('income');
    expect(r.categoryId).toBe('gift_income');
  });

  it('parses "refund 20 from amazon" as income', () => {
    const r = parseInput('refund 20 from amazon', ctx());
    expect(r.type).toBe('income');
    expect(r.categoryId).toBe('other_income');
  });
});

describe('parseInput: goals', () => {
  it('parses "goal: save 500 for a trip by december"', () => {
    const r = parseInput('goal: save 500 for a trip by december', ctx());
    expect(r.kind).toBe('goal');
    expect(r.amount).toBe(500);
    expect(r.goalName).toBe('Trip');
    expect(r.targetDate).toBe('2026-12-31');
    expect(r.needsReview).toBe(false);
  });

  it('parses "I want to save 2000 for an emergency fund"', () => {
    const r = parseInput('I want to save 2000 for an emergency fund', ctx());
    expect(r.kind).toBe('goal');
    expect(r.amount).toBe(2000);
    expect(r.goalName).toBe('Emergency fund');
    expect(r.targetDate).toBeNull();
  });

  it('parses "save 1500 for a new laptop by march 2027"', () => {
    const r = parseInput('save 1500 for a new laptop by march 2027', ctx());
    expect(r.kind).toBe('goal');
    expect(r.goalName).toBe('Laptop');
    expect(r.targetDate).toBe('2027-03-31');
  });

  it('asks for the amount when it is missing', () => {
    const r = parseInput('goal: vacation', ctx());
    expect(r.kind).toBe('goal');
    expect(r.amount).toBeNull();
    expect(r.goalName).toBe('Vacation');
    expect(r.needsReview).toBe(true);
  });
});

describe('parseInput: goal contributions', () => {
  it('parses "add 100 to the trip goal"', () => {
    const r = parseInput('add 100 to the trip goal', ctx({ goals }));
    expect(r.kind).toBe('contribution');
    expect(r.goalId).toBe('g1');
    expect(r.amount).toBe(100);
    expect(r.categoryId).toBe('savings');
  });

  it('parses "put 50 toward japan"', () => {
    const r = parseInput('put 50 toward japan', ctx({ goals }));
    expect(r.kind).toBe('contribution');
    expect(r.goalId).toBe('g1');
  });

  it('parses "saved 200 for emergency fund"', () => {
    const r = parseInput('saved 200 for emergency fund', ctx({ goals }));
    expect(r.kind).toBe('contribution');
    expect(r.goalId).toBe('g2');
    expect(r.amount).toBe(200);
  });

  it('does not treat "saved 20 on groceries" as a contribution', () => {
    const r = parseInput('saved 20 on groceries with coupons', ctx({ goals }));
    expect(r.kind).toBe('transaction');
  });

  it('creates a goal when there is no matching goal', () => {
    const r = parseInput('save 800 for a bike', ctx({ goals }));
    expect(r.kind).toBe('goal');
    expect(r.goalName).toBe('Bike');
  });
});

describe('learnableWords', () => {
  it('keeps meaningful words only', () => {
    expect(learnableWords('spent 12 dollars on blorp yesterday')).toEqual(['blorp']);
    expect(learnableWords('$30 at the dog groomer')).toEqual(['dog', 'groomer']);
  });
});
