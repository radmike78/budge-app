/**
 * Turns the rows of a bank or card statement into dated, signed, categorised
 * lines grouped by month. Works from positioned PDF text (columns known) and
 * from plain text (columns inferred from headings, signs and running balances).
 */
import type { Category } from '@/types';
import { detectCategory, type ParseContext } from '@/parser';
import { addDays, daysBetween, daysInMonth } from '@/lib/dates';
import { findDates, findPeriod, monthOf, resolveDate, type DateHit } from './dates';
import { findMoney, findPercent, type MoneyToken } from './money';
import { cleanDescription, guessKind, lookupMerchant } from './merchants';
import type { MonthSummary, ParseOptions, ParsedStatement, Row, StatementKind, StatementLine, StatementPeriod, Tradeline } from './types';

const CARD_WORDS = /\b(minimum payment due|minimum payment|payment due date|credit limit|available credit|new balance|previous balance|purchases|cash advances|apr|annual percentage rate|interest charged|cardmember|card member|rewards|statement balance|total credit line|credit line)\b/i;
const BANK_WORDS = /\b(checking|savings|deposits|withdrawals|debits|credits|beginning balance|ending balance|opening balance|closing balance|account summary|daily balance|checks paid|overdraft|routing|direct deposit|cuenta corriente|compte courant|conto corrente|girokonto|kontoauszug|relevé de compte|estado de cuenta|estratto conto)\b/i;
const REPORT_WORDS = /\b(credit report|credit file|tradeline|account type|report date|creditor|monthly payment|account history|payment history|date opened|high credit|credit score|fico|vantagescore|experian|equifax|transunion|inquiries|public records|collections|revolving accounts|installment accounts|schufa|informe de crédito)\b/i;

/** Column headings and what they mean. Position on the header row tells us which amount is which. */
const COLUMN_WORDS: { re: RegExp; role: 'in' | 'out' | 'amount' | 'balance' | 'date' | 'desc' }[] = [
  { re: /\b(deposits?|credits?|additions|money in|paid in|payments? and credits?|payments?\/credits?|haben|abonos|ingresos|crédits?|entrate|accrediti)\b/i, role: 'in' },
  { re: /\b(withdrawals?|debits?|subtractions|money out|paid out|purchases|charges|soll|cargos|retiros|débits?|uscite|addebiti)\b/i, role: 'out' },
  { re: /\b(amount|importe|montant|importo|betrag)\b/i, role: 'amount' },
  { re: /\b(balance|running balance|saldo|solde|kontostand)\b/i, role: 'balance' },
  { re: /\b(date|fecha|datum|data|trans(?:action)? date|post(?:ing)? date)\b/i, role: 'date' },
  { re: /\b(description|details|transaction|payee|memo|concepto|libellé|descrizione|verwendungszweck|buchung)\b/i, role: 'desc' },
];

/** Section headings that set the direction of the lines under them (text-only statements). */
const SECTION_IN = /^(deposits?( and (other )?(credits|additions))?|credits|additions|other credits|payments and other credits|electronic deposits|interest paid|money in|abonos|ingresos|crédits|entrate|accrediti|gutschriften)\b/i;
const SECTION_OUT = /^(withdrawals?( and (other )?(debits|subtractions))?|debits|other debits|checks( paid)?|electronic withdrawals|card purchases|purchases( and adjustments)?|fees( charged)?|interest charged|money out|cargos|retiros|débits|uscite|addebiti|lastschriften|abbuchungen|umsätze)\b/i;
const SUMMARY_ROW = /\b(total|subtotal|beginning balance|ending balance|opening balance|closing balance|previous balance|new balance|balance forward|statement balance|minimum payment|payment due|credit limit|available credit|totale|saldo (anterior|final)|solde|ancien solde|nouveau solde|anfangssaldo|endsaldo|summe)\b/i;

const ISSUER_RE = /\b(chase|capital one|american express|amex|discover|citi|bank of america|wells fargo|barclays|synchrony|u\.?s\.? bank|apple card|navy federal|usaa|pnc|td bank|truist|hsbc|santander|revolut|monzo|n26|bbva|ing|deutsche bank|commerzbank|crédit agricole|bnp|société générale|unicredit|intesa|rakuten|mufg|shinhan|hyundai card|samsung card|visa|mastercard)\b/i;

interface Column { x: number; role: 'in' | 'out' | 'amount' | 'balance' | 'date' | 'desc' }

export function detectKind(rows: Row[]): StatementKind {
  const text = rows.slice(0, 200).map((r) => r.text).join('\n');
  const score = (re: RegExp) => (text.match(new RegExp(re.source, 'gi')) ?? []).length;
  const report = score(REPORT_WORDS);
  const card = score(CARD_WORDS);
  const bank = score(BANK_WORDS);
  if (report >= 3 && report >= card && report >= bank) return 'credit_report';
  if (card >= 2 && card > bank) return 'card';
  if (bank >= 2) return 'bank';
  if (card >= 1) return 'card';
  return 'unknown';
}

function findColumns(rows: Row[]): Column[] | null {
  for (const row of rows.slice(0, 150)) {
    if (row.cells.length < 3) continue;
    const cols: Column[] = [];
    for (const cell of row.cells) {
      for (const cw of COLUMN_WORDS) {
        if (cw.re.test(cell.str)) { cols.push({ x: cell.x, role: cw.role }); break; }
      }
    }
    const roles = new Set(cols.map((c) => c.role));
    if (roles.has('date') && (roles.has('amount') || (roles.has('in') && roles.has('out')) || roles.has('balance'))) return cols;
  }
  return null;
}

function nearestColumn(x: number, cols: Column[]): Column | null {
  let best: Column | null = null;
  let bestDist = Infinity;
  for (const c of cols) {
    const d = Math.abs(c.x - x);
    if (d < bestDist) { best = c; bestDist = d; }
  }
  return bestDist <= 120 ? best : null;
}

function fnv(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(36).padStart(7, '0');
}

export function fingerprintOf(date: string, amount: number, direction: 'in' | 'out', description: string): string {
  const key = `${date}|${amount.toFixed(2)}|${direction}|${description.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim().slice(0, 40)}`;
  return `${fnv(key)}${fnv(key.split('').reverse().join(''))}`;
}

interface Candidate {
  row: Row;
  hit: DateHit;
  amounts: MoneyToken[];
  descText: string;
  amountCols: (Column | null)[];
}

function lineCandidates(rows: Row[], cols: Column[] | null, language: string): Candidate[] {
  const out: Candidate[] = [];
  for (const row of rows) {
    const text = row.text;
    if (SUMMARY_ROW.test(text) && !/\b(fee|interest charge)\b/i.test(text)) continue;
    const dates = findDates(text, language);
    if (!dates.length || dates[0].start > 3) continue;
    const money = findMoney(text);
    if (!money.length) continue;
    // Amounts sit at the end of the line; anything before the last date-free amount run is description.
    const firstDateEnd = dates.length > 1 && dates[1].start - dates[0].end <= 3 ? dates[1].end : dates[0].end;
    const amounts = money.filter((m) => m.start >= firstDateEnd);
    if (!amounts.length) continue;
    const descText = text.slice(firstDateEnd, amounts[0].start).trim();
    if (!/\p{L}/u.test(descText)) continue;
    const amountCols = amounts.map((a) => {
      if (!cols) return null;
      const cell = row.cells.find((c) => c.str.replace(/\s/g, '') === a.raw.replace(/\s/g, '') || (c.str.includes(a.raw.trim()) && findMoney(c.str).length === 1));
      return cell ? nearestColumn(cell.x, cols) : null;
    });
    out.push({ row, hit: dates[0], amounts, descText, amountCols });
  }
  return out;
}

const INCOME_HINT = new Set(['salary', 'freelance', 'other_income']);

function decideAmount(c: Candidate, kind: StatementKind, section: 'in' | 'out' | null, prevBalance: number | null): { amount: number; direction: 'in' | 'out'; balance: number | null; sure: boolean } | null {
  const { amounts, amountCols } = c;
  let balance: number | null = null;
  let amountTok: MoneyToken | null = null;
  let direction: 'in' | 'out' | null = null;
  let sure = false;

  // 1. Columns from the header row.
  for (let i = 0; i < amounts.length; i += 1) {
    const col = amountCols[i];
    if (!col) continue;
    if (col.role === 'balance') balance = amounts[i].value * (amounts[i].negative ? -1 : 1);
    else if (col.role === 'in') { amountTok = amounts[i]; direction = 'in'; sure = true; }
    else if (col.role === 'out') { amountTok = amounts[i]; direction = 'out'; sure = true; }
    else if (col.role === 'amount' && !amountTok) amountTok = amounts[i];
  }
  // 2. No columns: last number is the balance when there are two or more, unless it is tiny and the first is huge.
  if (!amountTok) {
    if (amounts.length >= 2) {
      balance = amounts[amounts.length - 1].value * (amounts[amounts.length - 1].negative ? -1 : 1);
      amountTok = amounts[amounts.length - 2];
      if (amounts.length >= 3 && amounts[0].value === 0) amountTok = amounts[1];
    } else {
      amountTok = amounts[0];
    }
  }
  if (!amountTok || amountTok.value <= 0) return null;

  // 3. Direction: explicit column > running balance change > sign markers > section heading > statement default.
  if (!direction && balance != null && prevBalance != null && Math.abs(Math.abs(balance - prevBalance) - amountTok.value) < 0.011) {
    direction = balance > prevBalance ? 'in' : 'out';
    sure = true;
  }
  if (!direction && (amountTok.negative || amountTok.credit)) {
    // On a bank statement a minus means money out; on a card statement a minus or CR means money back.
    direction = amountTok.credit ? 'in' : kind === 'card' ? 'in' : 'out';
    sure = true;
  }
  if (!direction && section) { direction = section; sure = true; }
  // Last resort on a bank statement: payroll, interest and refunds are money in; everything else is money out.
  if (!direction && kind === 'bank') {
    const hint = lookupMerchant(c.descText.toLowerCase());
    if (hint && INCOME_HINT.has(hint.categoryId)) direction = 'in';
  }
  if (!direction) direction = 'out';
  return { amount: amountTok.value, direction, balance, sure };
}

function categorize(rawDescription: string, cleaned: string, direction: 'in' | 'out', kind: StatementKind, ctx: ParseContext, categories: Category[]): { categoryId: string | null; confidence: number; lineKind: StatementLine['kind'] } {
  const guess = guessKind(rawDescription, direction, kind);
  const has = (id: string | null) => !!id && categories.some((c) => c.id === id && !c.archived);
  // The user's own learned words and custom categories beat the built-in vocabulary.
  const learned = detectCategory(cleaned.toLowerCase(), ctx);
  const wantIncome = guess.kind === 'income' || guess.kind === 'refund';
  if (learned && learned.confidence >= 0.9 && learned.kind === (wantIncome ? 'income' : 'expense')) {
    return { categoryId: learned.categoryId, confidence: learned.confidence, lineKind: guess.kind };
  }
  if (has(guess.categoryId)) return { categoryId: guess.categoryId, confidence: guess.confidence, lineKind: guess.kind };
  if (learned && learned.kind === (wantIncome ? 'income' : 'expense')) return { categoryId: learned.categoryId, confidence: Math.min(learned.confidence, 0.7), lineKind: guess.kind };
  const fallback = wantIncome ? 'other_income' : guess.kind === 'transfer' ? 'savings' : 'other_expense';
  return { categoryId: has(fallback) ? fallback : null, confidence: 0.3, lineKind: guess.kind };
}

/** Account label from the first rows: "Chase Sapphire ... ending in 1234", "Checking account ...5678". */
function findAccount(rows: Row[]): string | null {
  for (const row of rows.slice(0, 60)) {
    if (!/\b(?:account|acct|card|tarjeta|cuenta|compte|carte|konto|karte)\b/i.test(row.text)) continue;
    const groups = row.text.match(/(?<![\d.,])\d{4}(?![\d.,])/g);
    if (groups && groups.length) return `····${groups[groups.length - 1]}`;
  }
  return null;
}

/** Card statement facts that make a tradeline: new balance, minimum payment, credit limit, APR. */
function cardTradeline(rows: Row[], account: string | null): Tradeline | null {
  let balance: number | null = null;
  let minimum: number | null = null;
  let limit: number | null = null;
  let apr: number | null = null;
  let issuer: string | null = null;
  for (const row of rows.slice(0, 200)) {
    const t = row.text;
    const money = findMoney(t);
    if (balance == null && /\b(new balance|statement balance|current balance|balance due|total balance|nuevo saldo|nouveau solde|nuovo saldo|neuer saldo)\b/i.test(t) && money.length) balance = money[money.length - 1].value;
    if (minimum == null && /\b(minimum payment|min(?:imum)? (?:amount )?due|pago mínimo|pago minimo|paiement minimum|pagamento minimo|mindestzahlung)\b/i.test(t) && money.length) minimum = money[money.length - 1].value;
    if (limit == null && /\b(credit limit|credit line|total credit line|límite de crédito|limite de credito|plafond|limite di credito|kreditlimit)\b/i.test(t) && money.length) limit = money[money.length - 1].value;
    if (apr == null && /\b(purchase apr|apr for purchases|annual percentage rate|apr|tae|taeg|effektiver jahreszins|interest rate)\b/i.test(t) && !/cash advance|penalty|balance transfer|promotional/i.test(t)) apr = findPercent(t);
    if (!issuer && t.length <= 44 && ISSUER_RE.test(t) && !findMoney(t).length && !/\d{4}/.test(t)) issuer = cleanDescription(t);
  }
  if (balance == null && minimum == null && limit == null) return null;
  const creditor = `${issuer ?? 'Credit card'}${account ? ` ${account}` : ''}`;
  return { id: `card-${fnv(creditor)}`, creditor, type: 'credit_card', balance, monthlyPayment: minimum, creditLimit: limit, apr, status: 'open', consumer: true, source: 'card_statement' };
}

export function summarizeMonths(lines: StatementLine[], period: StatementPeriod | null): MonthSummary[] {
  const map = new Map<string, MonthSummary>();
  for (const l of lines) {
    if (!l.include || l.duplicate) continue;
    const m = map.get(l.month) ?? { month: l.month, income: 0, expenses: 0, count: 0, partial: false };
    if (l.direction === 'in') m.income += l.amount; else m.expenses += l.amount;
    m.count += 1;
    map.set(l.month, m);
  }
  for (const m of map.values()) {
    m.income = Math.round(m.income * 100) / 100;
    m.expenses = Math.round(m.expenses * 100) / 100;
    if (period) {
      const [y, mo] = m.month.split('-').map(Number);
      const first = `${m.month}-01`;
      const last = `${m.month}-${String(daysInMonth(y, mo - 1)).padStart(2, '0')}`;
      m.partial = period.start > first || period.end < last;
    }
  }
  return [...map.values()].sort((a, b) => a.month.localeCompare(b.month));
}

/** The whole thing: kind, period, lines with categories, months, tradeline for a card. */
export function parseStatement(rows: Row[], ctx: ParseContext, opts: ParseOptions): ParsedStatement {
  const warnings: string[] = [];
  const kind = detectKind(rows);
  if (kind === 'credit_report') return { kind, period: null, account: null, lines: [], tradelines: [], months: [], warnings: ['isCreditReport'] };
  const period = findPeriod(rows, opts.language, opts.today);
  if (!period) warnings.push('noPeriod');
  const cols = findColumns(rows);
  const account = findAccount(rows);
  const candidates = lineCandidates(rows, cols, opts.language);

  const lines: StatementLine[] = [];
  let section: 'in' | 'out' | null = null;
  let prevBalance: number | null = null;
  let unsure = 0;
  const seen = new Set<string>();
  const candidateRows = new Set(candidates.map((c) => c.row));
  let ci = 0;
  for (const row of rows) {
    if (!candidateRows.has(row)) {
      const head = row.text.trim();
      if (head.length <= 60) {
        if (SECTION_IN.test(head)) section = 'in';
        else if (SECTION_OUT.test(head)) section = 'out';
      }
      const bal = /\b(beginning|opening|previous|starting) balance\b/i.test(head) ? findMoney(head) : [];
      if (bal.length) prevBalance = bal[bal.length - 1].value * (bal[bal.length - 1].negative ? -1 : 1);
      continue;
    }
    const c = candidates[ci];
    ci += 1;
    const decided = decideAmount(c, kind, section, prevBalance);
    if (!decided) continue;
    if (decided.balance != null) prevBalance = decided.balance;
    if (!decided.sure) unsure += 1;
    const date = resolveDate(c.hit, period, opts.today);
    if (!date) continue;
    const description = cleanDescription(c.descText);
    const cat = categorize(c.descText, description, decided.direction, kind, ctx, ctx.categories);
    const fingerprint = fingerprintOf(date, decided.amount, decided.direction, c.descText);
    const duplicate = (opts.knownFingerprints?.has(fingerprint) ?? false) || seen.has(fingerprint);
    seen.add(fingerprint);
    const include = !duplicate && cat.lineKind !== 'transfer' && cat.lineKind !== 'payment';
    lines.push({
      fingerprint, date, month: monthOf(date), rawDate: c.hit.raw, description, rawText: c.row.text, amount: decided.amount, direction: decided.direction,
      kind: cat.lineKind, balance: decided.balance, categoryId: cat.categoryId, categoryConfidence: cat.confidence, include, duplicate, page: c.row.page,
    });
  }
  if (!lines.length) warnings.push('noLines');
  if (lines.length && unsure / lines.length > 0.5) warnings.push('directionGuessed');
  if (lines.some((l) => l.duplicate)) warnings.push('hasDuplicates');
  if (period && lines.some((l) => l.date < addDays(period.start, -10) || l.date > addDays(period.end, 10))) warnings.push('datesOutsidePeriod');
  const tradelines = kind === 'card' ? [cardTradeline(rows, account)].filter((t): t is Tradeline => !!t) : [];
  const months = summarizeMonths(lines, period);
  if (period && daysBetween(period.start, period.end) > 40) warnings.push('multiMonth');
  return { kind, period, account, lines, tradelines, months, warnings };
}
