/**
 * Statement import: bank and card statements (text and positioned PDF text),
 * credit reports, month alignment with year inference, duplicates, and the
 * pay-off planner.
 */
import fs from 'fs';
import path from 'path';
import { DEFAULT_CATEGORIES } from '@/lib/defaultCategories';
import type { ParseContext } from '@/parser';
import {
  cleanDescription, debtsFromTradelines, detectKind, findDates, findMoney, findPeriod, fingerprintOf, guessKind, parseCreditReport, parseStatement,
  planPayoff, recommendStrategy, resolveDate, rowsFromItems, rowsFromText, toNumber,
} from '@/statements';

const TODAY = '2026-02-10';
const ctx = (language = 'en'): ParseContext => ({ categories: DEFAULT_CATEGORIES, goals: [], keywordMap: {}, today: TODAY, language });
const parse = (text: string, language = 'en', known?: Set<string>) => parseStatement(rowsFromText(text), ctx(language), { language, today: TODAY, knownFingerprints: known });

const BANK = `
FIRST NATIONAL BANK
Everyday Checking   Account number: XXXXXX4821
Statement Period: 12/20/2025 - 01/19/2026
Beginning Balance                                  2,410.55
Deposits and other credits
12/22   PAYROLL ACME CORP DIRECT DEP 123456          2,150.00     4,560.55
01/05   PAYROLL ACME CORP DIRECT DEP 123457          2,150.00     5,120.30
01/12   ZELLE FROM JOHN SMITH                           40.00     3,915.30
Withdrawals and other debits
12/23   POS PURCHASE WM SUPERCENTER #1234 SEATTLE WA    86.21     4,474.34
12/26   NETFLIX.COM 866-579-7172 CA                     15.49     4,458.85
12/30   ONLINE TRANSFER TO SAVINGS XXXX9911            500.00     3,958.85
01/02   CHASE CREDIT CRD AUTOPAY 4567                  340.00     2,970.30
01/03   SHELL OIL 57444 REDMOND WA                      48.10     2,922.20
01/08   SQ *BLUE BOTTLE COF SEATTLE WA                   6.75     5,113.55
01/09   PG&E WEB ONLINE PAYMENT                        132.40     4,981.15
01/10   ATM WITHDRAWAL 01/10 1234 MAIN ST              100.00     4,881.15
01/15   CVS/PHARMACY #08214 BELLEVUE WA                 24.99     3,890.31
Ending Balance                                     3,890.31
`;

const CARD = `
CHASE SAPPHIRE PREFERRED
Account Number: 4123 XXXX XXXX 9876
Opening/Closing Date   12/15/25 - 01/14/26
Previous Balance                    $1,240.10
New Balance                         $1,352.43
Minimum Payment Due                    $40.00
Payment Due Date                     02/09/26
Credit Limit                       $12,000.00
Purchase APR 24.99%
PAYMENTS AND OTHER CREDITS
12/20  Payment Thank You-Mobile                     -500.00
12/28  AMZN Mktp US Return                           -35.20
PURCHASES
12/17  UBER EATS   SAN FRANCISCO CA                   28.40
12/24  MACY'S #123 SEATTLE WA                        119.99
01/02  TRADER JOE'S #45 SEATTLE WA                    64.12
01/04  SPOTIFY USA                                    10.99
01/08  FLEMINGS STEAKHOUSE BELLEVUE WA               121.53
01/13  INTEREST CHARGE ON PURCHASES                    18.22
`;

const REPORT = `
EXPERIAN CREDIT REPORT
Report date: 02/01/2026
Accounts
CAPITAL ONE
Account Type: Credit Card
Status: Open
Balance: $3,450.00
Credit Limit: $5,000
Monthly Payment: $85
NAVIENT
Account Type: Student Loan
Balance: $14,200
Monthly Payment: $190
WELLS FARGO HOME MTG
Account Type: Mortgage
Balance: $310,000
Monthly Payment: $1,900
TOYOTA MOTOR CREDIT
Account Type: Auto Loan
Balance: $9,800
Monthly Payment: $320
SOFI LENDING
Account Type: Installment
Balance: $6,000
Monthly Payment: $210
Interest Rate: 9.5%
DISCOVER BANK
Account Type: Credit Card
Status: Closed
Balance: $0
`;

describe('money and dates on statements', () => {
  it('reads every common money format', () => {
    expect(toNumber('1,234.56')).toBe(1234.56);
    expect(toNumber('1.234,56')).toBe(1234.56);
    expect(toNumber('1 234,56')).toBe(1234.56);
    expect(toNumber('1,234')).toBe(1234);
    expect(toNumber('12.50')).toBe(12.5);
    const m = findMoney('12/05 STORE (45.00) 1,000.00 CR $-3.10 20.00-');
    expect(m.map((x) => [x.value, x.negative, x.credit])).toEqual([[45, true, false], [1000, false, true], [3.1, true, false], [20, true, false]]);
    expect(findMoney('Check 2026 posted 01/05').length).toBe(0);
  });
  it('reads dates in several formats and locales', () => {
    expect(findDates('12/22 PAYROLL', 'en')[0]).toMatchObject({ month: 11, day: 22, year: null });
    expect(findDates('22/12/2025 NOMINA', 'es')[0]).toMatchObject({ month: 11, day: 22, year: 2025 });
    expect(findDates('Jan 5, 2026', 'en')[0]).toMatchObject({ month: 0, day: 5, year: 2026 });
    expect(findDates('5 janv. 2026', 'fr')[0]).toMatchObject({ month: 0, day: 5, year: 2026 });
    expect(findDates('2026-01-05', 'en')[0]).toMatchObject({ month: 0, day: 5, year: 2026 });
    expect(findDates('2026年1月5日', 'zh')[0]).toMatchObject({ month: 0, day: 5, year: 2026 });
    expect(findDates('13/01', 'en')[0]).toMatchObject({ month: 0, day: 13 });
  });
  it('puts a December line on a January statement into the previous year', () => {
    const period = { start: '2025-12-20', end: '2026-01-19' };
    expect(resolveDate({ month: 11, day: 22, year: null, start: 0, end: 5, raw: '12/22' }, period, TODAY)).toBe('2025-12-22');
    expect(resolveDate({ month: 0, day: 5, year: null, start: 0, end: 5, raw: '01/05' }, period, TODAY)).toBe('2026-01-05');
    expect(resolveDate({ month: 5, day: 1, year: null, start: 0, end: 5, raw: '06/01' }, null, TODAY)).toBe('2025-06-01');
  });
  it('finds the statement period in several phrasings', () => {
    expect(findPeriod(rowsFromText('Statement Period: 12/20/2025 - 01/19/2026'), 'en', TODAY)).toEqual({ start: '2025-12-20', end: '2026-01-19' });
    expect(findPeriod(rowsFromText('Opening/Closing Date 12/15/25 - 01/14/26'), 'en', TODAY)).toEqual({ start: '2025-12-15', end: '2026-01-14' });
    expect(findPeriod(rowsFromText('December 5, 2025 through January 4, 2026'), 'en', TODAY)).toEqual({ start: '2025-12-05', end: '2026-01-04' });
    expect(findPeriod(rowsFromText('Statement Date: 01/31/2026'), 'en', TODAY)).toEqual({ start: '2025-12-31', end: '2026-01-31' });
  });
});

describe('bank statement', () => {
  const p = parse(BANK);
  it('is recognised with its period and account', () => {
    expect(p.kind).toBe('bank');
    expect(p.period).toEqual({ start: '2025-12-20', end: '2026-01-19' });
    expect(p.account).toBe('····4821');
  });
  it('separates deposits from withdrawals using the section headings and balances', () => {
    const byDesc = Object.fromEntries([...p.lines].reverse().map((l) => [l.description, l]));
    expect(byDesc['Payroll Acme Corp']).toMatchObject({ direction: 'in', kind: 'income', categoryId: 'salary', amount: 2150, date: '2025-12-22', month: '2025-12' });
    expect(byDesc['Wm Supercenter Seattle']).toMatchObject({ direction: 'out', categoryId: 'groceries', amount: 86.21 });
    expect(byDesc['Netflix']).toMatchObject({ categoryId: 'subscriptions' });
    expect(byDesc['Online Transfer To Savings']).toMatchObject({ kind: 'transfer', include: false });
    expect(byDesc['Chase Credit Crd Autopay 4567']).toMatchObject({ categoryId: 'debt' });
    expect(byDesc['Shell Oil Redmond']).toMatchObject({ categoryId: 'transport' });
    expect(byDesc['Blue Bottle Cof Seattle']).toMatchObject({ categoryId: 'dining' });
    expect(byDesc['Pg&e Online Payment']).toMatchObject({ categoryId: 'utilities' });
    expect(byDesc['Cvs/Pharmacy Bellevue']).toMatchObject({ categoryId: 'health' });
    expect(byDesc['Zelle From John Smith']).toMatchObject({ direction: 'in', categoryId: 'other_income' });
  });
  it('aligns every line to the right month and marks partial months', () => {
    expect(p.months.map((m) => [m.month, m.income, m.expenses, m.partial])).toEqual([['2025-12', 2150, 101.7, true], ['2026-01', 2190, 652.24, true]]);
  });
  it('flags lines that are already in the history', () => {
    const known = new Set([fingerprintOf('2026-01-03', 48.1, 'out', 'SHELL OIL 57444 REDMOND WA')]);
    const again = parse(BANK, 'en', known);
    const shell = again.lines.find((l) => l.description === 'Shell Oil Redmond')!;
    expect(shell.duplicate).toBe(true);
    expect(shell.include).toBe(false);
    expect(again.warnings).toContain('hasDuplicates');
  });
});

describe('card statement', () => {
  const p = parse(CARD);
  it('is recognised, with the card as a tradeline', () => {
    expect(p.kind).toBe('card');
    expect(p.period).toEqual({ start: '2025-12-15', end: '2026-01-14' });
    expect(p.tradelines[0]).toMatchObject({ creditor: 'Chase Sapphire Preferred ····9876', type: 'credit_card', balance: 1352.43, monthlyPayment: 40, creditLimit: 12000, apr: 24.99, consumer: true });
  });
  it('treats payments as excluded, refunds as income, purchases and interest as expenses', () => {
    const byDesc = Object.fromEntries(p.lines.map((l) => [l.description, l]));
    expect(byDesc['Payment Thank You-Mobile']).toMatchObject({ kind: 'payment', include: false, direction: 'in' });
    expect(byDesc['AMZN Mktp US Return']).toMatchObject({ kind: 'refund', direction: 'in', categoryId: 'other_income', include: true });
    expect(byDesc['Uber Eats San Francisco']).toMatchObject({ direction: 'out', categoryId: 'dining', date: '2025-12-17' });
    expect(byDesc["Macy's Seattle"]).toMatchObject({ categoryId: 'shopping' });
    expect(byDesc["Trader Joe's Seattle"]).toMatchObject({ categoryId: 'groceries', date: '2026-01-02' });
    expect(byDesc['Spotify']).toMatchObject({ categoryId: 'subscriptions' });
    expect(byDesc['Flemings Steakhouse Bellevue']).toMatchObject({ categoryId: 'dining' });
    expect(byDesc['Interest Charge On Purchases']).toMatchObject({ kind: 'interest', categoryId: 'debt' });
    expect(p.warnings).not.toContain('directionGuessed');
  });
});

describe('positioned PDF text (real pdf.js output)', () => {
  it('uses the header row to tell deposits from withdrawals', () => {
    const items = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures/bank-items.json'), 'utf8'));
    const p = parseStatement(rowsFromItems(items), ctx(), { language: 'en', today: TODAY });
    expect(p.kind).toBe('bank');
    expect(p.lines.map((l) => [l.date, l.direction, l.amount, l.kind, l.balance])).toEqual([
      ['2025-12-22', 'in', 2150, 'income', 4560.55],
      ['2025-12-23', 'out', 86.21, 'expense', 4474.34],
      ['2025-12-30', 'out', 500, 'transfer', 3974.34],
      ['2026-01-03', 'out', 48.1, 'expense', 3926.24],
      ['2026-01-12', 'in', 40, 'income', 3966.24],
    ]);
  });
});

describe('other locales and formats', () => {
  it('reads a German statement with decimal commas and day-first dates', () => {
    const text = `
Kontoauszug Girokonto DE12 3456 7890
Abrechnungszeitraum 01.01.2026 bis 31.01.2026
Buchung  Verwendungszweck  Betrag  Saldo
03.01.2026  GEHALT MUSTER GMBH  2.500,00  3.100,00
05.01.2026  REWE SAGT DANKE  -54,30  3.045,70
09.01.2026  STADTWERKE STROM  -89,00  2.956,70
`;
    const p = parse(text, 'de');
    expect(p.kind).toBe('bank');
    expect(p.lines.map((l) => [l.date, l.direction, l.amount, l.categoryId])).toEqual([
      ['2026-01-03', 'in', 2500, 'salary'],
      ['2026-01-05', 'out', 54.3, 'groceries'],
      ['2026-01-09', 'out', 89, 'utilities'],
    ]);
  });
  it('uses parentheses and CR markers when there are no headings', () => {
    const text = `
Statement Date: 01/31/2026
Checking summary
01/04  MERCADONA 1234  (42.10)
01/06  TRANSFERENCIA NOMINA  1,800.00 CR
`;
    const p = parse(text, 'es');
    expect(p.lines.map((l) => [l.direction, l.amount])).toEqual([['out', 42.1], ['in', 1800]]);
  });
  it('cleans statement noise out of descriptions', () => {
    expect(cleanDescription('POS PURCHASE SQ *BLUE BOTTLE COF SEATTLE WA 01/05')).toBe('Blue Bottle Cof Seattle');
    expect(cleanDescription('AMZN Mktp US*2K4R83 AMZN.COM/BILL WA')).toBe('AMZN Mktp US AMZN');
    expect(cleanDescription('CHECKCARD 0105 STARBUCKS #12345 XXXXXXXXXXXX1234')).toBe('Starbucks');
    expect(guessKind('ONLINE TRANSFER TO SAVINGS', 'out', 'bank').kind).toBe('transfer');
    expect(guessKind('PAYMENT - THANK YOU', 'in', 'card').kind).toBe('payment');
  });
  it('tells a credit report from a statement', () => {
    expect(detectKind(rowsFromText(REPORT))).toBe('credit_report');
    expect(detectKind(rowsFromText(CARD))).toBe('card');
    expect(detectKind(rowsFromText(BANK))).toBe('bank');
  });
});

describe('credit report and pay-off plan', () => {
  const tl = parseCreditReport(rowsFromText(REPORT));
  it('finds every account with its type, balance and payment', () => {
    expect(tl.map((x) => [x.creditor, x.type, x.balance, x.monthlyPayment, x.consumer])).toEqual([
      ['CAPITAL ONE', 'credit_card', 3450, 85, true],
      ['NAVIENT', 'student_loan', 14200, 190, true],
      ['WELLS FARGO HOME MTG', 'mortgage', 310000, 1900, false],
      ['TOYOTA MOTOR CREDIT', 'auto_loan', 9800, 320, false],
      ['SOFI LENDING', 'personal_loan', 6000, 210, true],
      ['DISCOVER BANK', 'credit_card', 0, null, true],
    ]);
    expect(tl.find((x) => x.creditor === 'SOFI LENDING')!.apr).toBe(9.5);
    expect(tl.find((x) => x.creditor === 'DISCOVER BANK')!.status).toBe('closed');
  });
  it('plans consumer debt only, never the mortgage or the car', () => {
    const debts = debtsFromTradelines(tl);
    expect(debts.map((d) => d.name)).toEqual(['CAPITAL ONE', 'NAVIENT', 'SOFI LENDING']);
    expect(recommendStrategy(debts)).toEqual({ strategy: 'snowball', reason: 'rates_unknown' });
    const snow = planPayoff(debts, 200, 'snowball');
    expect(snow.rows.map((r) => r.name)).toEqual(['CAPITAL ONE', 'SOFI LENDING', 'NAVIENT']);
    expect(snow.monthlyTotal).toBe(685);
    expect(snow.truncated).toBe(false);
    expect(snow.totalMonths).toBeLessThan(60);
  });
  it('avalanche puts the highest rate first and costs less interest than snowball', () => {
    const debts = [
      { id: 'a', name: 'Card A', balance: 5000, apr: 27.9, minPayment: 100 },
      { id: 'b', name: 'Card B', balance: 1200, apr: 18.9, minPayment: 35 },
      { id: 'c', name: 'Loan', balance: 8000, apr: 8.5, minPayment: 250 },
    ];
    expect(recommendStrategy(debts)).toEqual({ strategy: 'avalanche', reason: 'rates_known' });
    const av = planPayoff(debts, 300, 'avalanche');
    const sn = planPayoff(debts, 300, 'snowball');
    expect(av.rows[0].name).toBe('Card A');
    expect(sn.rows[0].name).toBe('Card B');
    expect(av.totalInterest).toBeLessThan(sn.totalInterest);
    expect(av.totalMonths).toBeLessThanOrEqual(sn.totalMonths + 1);
  });
  it('never loops forever on hopeless input', () => {
    const p = planPayoff([{ id: 'x', name: 'X', balance: 100000, apr: 99, minPayment: 10 }], 0, 'avalanche');
    expect(p.truncated).toBe(true);
  });
});
