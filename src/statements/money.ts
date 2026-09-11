/**
 * Money tokens as they appear on statements: 1,234.56  $1,234.56  -12.00
 * (12.00)  12.00-  12.00 CR  1.234,56  1 234,56  €12,00  12.00DR
 */
export interface MoneyToken {
  value: number;
  /** Sign from a minus, parentheses, trailing minus or DR marker. */
  negative: boolean;
  /** A CR marker (credit) was present. */
  credit: boolean;
  start: number;
  end: number;
  raw: string;
}

const CURRENCY = '(?:[$€£¥₹]|USD|EUR|GBP|CAD|AUD|CHF|MXN|BRL|JPY|CNY|KRW|R\\$|C\\$|A\\$)?';
// Number with optional thousands separators and an optional 2-digit decimal part.
const NUMBER = '(?:\\d{1,3}(?:[,.\\s ]\\d{3})+|\\d+)(?:[.,]\\d{2})?';
const MONEY_RE = new RegExp(
  `(?<![\\w.,])(\\(?)\\s?(-|−|–)?\\s?${CURRENCY}\\s?(-|−|–)?(${NUMBER})\\s?${CURRENCY}\\s?(\\)?)\\s?(-|−|–|CR|DR|Cr|Dr|cr|dr)?(?![\\w.,])`,
  'gu',
);

/**
 * Reads a number string that may use a decimal comma or a decimal point. Two
 * digits after the last separator are decimals; three are a thousands group,
 * so "1,234" is 1234 and "1.234,56" is 1234.56 in every locale.
 */
export function toNumber(numeric: string): number | null {
  const s = numeric.replace(/[\s\u00a0]/g, '');
  const m = s.match(/^(.*?)([.,])(\d{2})$/);
  const intPart = (m ? m[1] : s).replace(/[.,]/g, '');
  const n = Number(m ? `${intPart}.${m[3]}` : intPart);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
}

/** Every money-looking token in a row, in order. Years (2026) and long ids are skipped. */
export function findMoney(text: string): MoneyToken[] {
  const out: MoneyToken[] = [];
  MONEY_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = MONEY_RE.exec(text)) !== null) {
    const [raw, open, minusBefore, minusMid, numeric, close, suffix] = m;
    if (!numeric) continue;
    const hasDecimals = /[.,]\d{2}$/.test(numeric);
    const digitsOnly = numeric.replace(/\D/g, '');
    // Bare integers are only money when they have separators or a currency sign; otherwise
    // "2026", account numbers and check numbers would all look like amounts.
    const hasSeparators = /[,.\s ]/.test(numeric);
    const hasCurrency = /[$€£¥₹]|USD|EUR|GBP/.test(raw);
    if (!hasDecimals && !hasSeparators && !hasCurrency) continue;
    if (digitsOnly.length > 13) continue;
    const value = toNumber(numeric);
    if (value == null) continue;
    const suffixNorm = (suffix ?? '').toUpperCase();
    const negative = Boolean(minusBefore || minusMid || (open === '(' && close === ')') || suffixNorm === '-' || suffixNorm === '−' || suffixNorm === '–' || suffixNorm === 'DR');
    out.push({ value, negative, credit: suffixNorm === 'CR', start: m.index, end: m.index + raw.length, raw });
  }
  return out;
}

/** Reads a percentage like "24.99%" or "APR 19,9 %". */
export function findPercent(text: string): number | null {
  const m = text.match(/(\d{1,2}(?:[.,]\d{1,3})?)\s?%/);
  if (!m) return null;
  const n = Number(m[1].replace(',', '.'));
  return Number.isFinite(n) && n >= 0 && n <= 100 ? n : null;
}
