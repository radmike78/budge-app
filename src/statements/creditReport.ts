/**
 * Credit reports (Experian, Equifax, TransUnion, annualcreditreport.com PDFs,
 * and similar) list one block per account. This finds each creditor, its
 * balance, monthly payment, limit and type, so the pay-off planner can rank
 * consumer debts. Mortgages and car loans are kept but flagged non-consumer.
 */
import { findMoney, findPercent } from './money';
import type { DebtType, Row, Tradeline } from './types';

const LABELS: { re: RegExp; field: 'balance' | 'payment' | 'limit' | 'type' | 'status' | 'apr' | 'name' | 'opened' | 'skip' }[] = [
  { re: /^(?:current |recent |account )?balance(?: amount| owed| due)?$/i, field: 'balance' },
  { re: /^(?:scheduled |monthly |minimum |regular |actual )?(?:monthly )?payment(?: amount)?(?: due)?$|^terms?$|^payment terms$|^pmt$|^monthly pmt$/i, field: 'payment' },
  { re: /^(?:credit )?limit$|^high(?: credit| balance)?$|^credit line$|^original (?:amount|balance|loan amount)$|^loan amount$/i, field: 'limit' },
  { re: /^(?:account |loan |credit )?type$|^type of account$|^account type\/loan type$|^portfolio type$|^kind of business$/i, field: 'type' },
  { re: /^(?:account |current |pay )?status$|^condition$|^account condition$/i, field: 'status' },
  { re: /^(?:interest rate|apr|rate)$/i, field: 'apr' },
  { re: /^(?:creditor|account name|company|lender|subscriber|furnisher|creditor name|name)$/i, field: 'name' },
  { re: /^(?:date )?opened$|^open date$|^date opened$/i, field: 'opened' },
  { re: /^(?:account (?:number|no\.?|#)|acct|responsibility|ownership|date reported|last reported|date updated|last payment|date of last payment|past due|amount past due|months reviewed|payment history|remarks|comments|closed|date closed|worst delinquency|loan term|term)$/i, field: 'skip' },
];

const TYPE_WORDS: { re: RegExp; type: DebtType }[] = [
  { re: /\b(mortgage|home loan|home equity|heloc|real estate|fha|va loan|conventional|hypothèque|hipoteca|mutuo|hypothek)\b/i, type: 'mortgage' },
  { re: /\b(auto|automobile|vehicle|car loan|motor|lease|toyota|honda|ford credit|gm financial|nissan|hyundai|kia|subaru|bmw|mercedes|ally financial|santander consumer|carmax|capital one auto|chrysler capital|volkswagen|vw credit|westlake|exeter)\b/i, type: 'auto_loan' },
  { re: /\b(student|education|educational|navient|nelnet|mohela|sallie|great lakes|aidvantage|fedloan|dept of ed|department of education|edfinancial|firstmark|earnest|college ave)\b/i, type: 'student_loan' },
  { re: /\b(line of credit|revolving line|overdraft line|heloc)\b/i, type: 'line_of_credit' },
  { re: /\b(credit card|revolving|charge account|charge card|bank card|bankcard|flexible spending|visa|mastercard|amex|american express|discover|capital one|synchrony|comenity|barclays|citi|chase|credit one|merrick|first premier|store card|retail)\b/i, type: 'credit_card' },
  { re: /\b(installment|personal loan|signature loan|unsecured|consumer loan|sofi|upstart|lending club|lendingclub|prosper|onemain|one main|marcus|best egg|avant|upgrade|affirm|klarna)\b/i, type: 'personal_loan' },
];

function typeFrom(text: string, fallback: DebtType = 'other'): DebtType {
  for (const t of TYPE_WORDS) if (t.re.test(text)) return t.type;
  return fallback;
}

function isConsumer(type: DebtType): boolean {
  return type === 'credit_card' || type === 'personal_loan' || type === 'student_loan' || type === 'line_of_credit' || type === 'other';
}

function statusFrom(text: string): Tradeline['status'] {
  if (/\b(closed|paid(?: in full)?|paid off|settled|transferred|sold|charge[- ]?off|charged off|refinanced|zero balance)\b/i.test(text)) return 'closed';
  if (/\b(open|current|pays as agreed|paid as agreed|ok|good standing|active|in repayment|deferred|forbearance|late|past due|delinquent|collection)\b/i.test(text)) return 'open';
  return 'unknown';
}

/** A heading row: a creditor name in caps or a known lender, no colon, no money, not a label. */
function looksLikeCreditor(text: string): boolean {
  const t = text.trim();
  if (!t || t.length > 60 || t.includes(':')) return false;
  if (findMoney(t).length) return false;
  if (LABELS.some((l) => l.re.test(t))) return false;
  if (/^(page|account|accounts|summary|revolving|installment|mortgage|open accounts|closed accounts|personal information|inquiries|public records|collections|potentially negative|satisfactory|credit report|report|payment history|balance|status|type|date|\d)/i.test(t)) return false;
  const letters = (t.match(/\p{L}/gu) ?? []).length;
  if (letters < 3) return false;
  const words = t.split(/\s+/);
  if (words.length > 7) return false;
  const upper = t === t.toUpperCase();
  const knownLender = TYPE_WORDS.some((w) => w.type !== 'other' && w.re.test(t)) || /\b(bank|credit union|financial|finance|fin svcs|services|card|cards|lending|loans?|capital|trust|fcu|cu|n\.?a\.?|llc|inc|corp)\b/i.test(t);
  return upper || knownLender;
}

function money(text: string): number | null {
  const m = findMoney(text);
  return m.length ? m[m.length - 1].value : null;
}

function monthlyFromTerms(text: string): number | null {
  // "Terms: 60 months, $312/mo", "$312 monthly", "312.00 per month"
  const m = text.match(/(\$?\s?\d[\d,]*(?:\.\d{2})?)\s*(?:\/\s*mo(?:nth)?|per month|monthly|a month|mensual|par mois|al mese|monatlich)/i);
  if (m) return money(m[1]);
  return null;
}

/**
 * Parses tradelines from report rows. Handles "Label: value" blocks, label rows
 * followed by value rows, and column tables with a header row.
 */
export function parseCreditReport(rows: Row[]): Tradeline[] {
  const out: Tradeline[] = [];
  let current: Tradeline | null = null;
  let pendingLabel: (typeof LABELS)[number]['field'] | null = null;
  let table: { x: number; field: (typeof LABELS)[number]['field'] }[] | null = null;

  const finish = () => {
    if (current && (current.balance != null || current.monthlyPayment != null || current.creditLimit != null)) {
      current.consumer = isConsumer(current.type);
      out.push(current);
    }
    current = null;
  };
  const start = (creditor: string) => {
    finish();
    const name = creditor.trim().replace(/\s{2,}/g, ' ');
    current = { id: `tl-${out.length + 1}-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 24)}`, creditor: name, type: typeFrom(name), balance: null, monthlyPayment: null, creditLimit: null, apr: null, status: 'unknown', consumer: true, source: 'credit_report' };
  };
  const assign = (field: (typeof LABELS)[number]['field'], value: string) => {
    if (!current || field === 'skip' || field === 'opened') return;
    const v = value.trim();
    if (!v) return;
    if (field === 'balance') current.balance = money(v) ?? current.balance;
    else if (field === 'payment') current.monthlyPayment = monthlyFromTerms(v) ?? money(v) ?? current.monthlyPayment;
    else if (field === 'limit') current.creditLimit = money(v) ?? current.creditLimit;
    else if (field === 'apr') current.apr = findPercent(v) ?? current.apr;
    else if (field === 'type') { const t = typeFrom(v, current.type); if (t !== 'other' || current.type === 'other') current.type = t; }
    else if (field === 'status') { const s = statusFrom(v); if (s !== 'unknown') current.status = s; }
    else if (field === 'name') current.creditor = v.slice(0, 60);
  };

  for (const row of rows) {
    const text = row.text.trim();
    if (!text) continue;

    // Column table: a header row with at least a name-ish column and a balance column.
    if (row.cells.length >= 3) {
      const cols = row.cells.map((c) => ({ x: c.x, field: LABELS.find((l) => l.re.test(c.str.trim()))?.field ?? null }));
      const fields = cols.map((c) => c.field).filter(Boolean);
      if (fields.includes('balance') && (fields.includes('name') || fields.includes('payment') || fields.includes('type'))) {
        table = cols.filter((c): c is { x: number; field: (typeof LABELS)[number]['field'] } => !!c.field);
        continue;
      }
    }
    if (table && row.cells.length >= 2 && findMoney(text).length) {
      const nameCol = table.find((c) => c.field === 'name');
      const nameCell = nameCol ? row.cells.reduce((best, c) => (Math.abs(c.x - nameCol.x) < Math.abs(best.x - nameCol.x) ? c : best)) : row.cells[0];
      start(nameCell.str);
      for (const cell of row.cells) {
        if (cell === nameCell) continue;
        const col = table.reduce((best, c) => (Math.abs(c.x - cell.x) < Math.abs(best.x - cell.x) ? c : best));
        if (Math.abs(col.x - cell.x) <= 120) assign(col.field, cell.str);
      }
      finish();
      continue;
    }
    if (table && !findMoney(text).length && row.cells.length <= 1) table = null;

    // "Label: value" pairs, possibly several per row.
    const pairs = [...text.matchAll(/([A-Za-z][A-Za-z /#.]{1,30}?):\s*([^:]+?)(?=\s{2,}[A-Za-z][A-Za-z /#.]{1,30}?:|$)/g)];
    if (pairs.length) {
      if (!current) start('Account');
      for (const p of pairs) {
        const label = LABELS.find((l) => l.re.test(p[1].trim()));
        if (label) assign(label.field, p[2]);
      }
      continue;
    }

    // A label on its own row, value on the next row.
    const soloLabel = LABELS.find((l) => l.re.test(text));
    if (soloLabel) { pendingLabel = soloLabel.field; continue; }
    if (pendingLabel) {
      if (!current) start('Account');
      assign(pendingLabel, text);
      pendingLabel = null;
      continue;
    }

    if (looksLikeCreditor(text)) start(text);
  }
  finish();
  return out;
}
