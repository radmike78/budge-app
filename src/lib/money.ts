/**
 * Currency formatting without relying on Intl (which is uneven across Hermes
 * versions). Symbols for common currencies; everything else uses the code.
 * Separators and symbol placement follow the active locale.
 */
export interface CurrencyInfo {
  code: string;
  symbol: string;
  name: string;
  /** Number of decimals (JPY has 0). */
  decimals: number;
}

export const CURRENCIES: CurrencyInfo[] = [
  { code: 'USD', symbol: '$', name: 'US Dollar', decimals: 2 },
  { code: 'EUR', symbol: '€', name: 'Euro', decimals: 2 },
  { code: 'GBP', symbol: '£', name: 'British Pound', decimals: 2 },
  { code: 'CAD', symbol: 'CA$', name: 'Canadian Dollar', decimals: 2 },
  { code: 'AUD', symbol: 'A$', name: 'Australian Dollar', decimals: 2 },
  { code: 'NZD', symbol: 'NZ$', name: 'New Zealand Dollar', decimals: 2 },
  { code: 'JPY', symbol: '¥', name: 'Japanese Yen', decimals: 0 },
  { code: 'CNY', symbol: '¥', name: 'Chinese Yuan', decimals: 2 },
  { code: 'KRW', symbol: '₩', name: 'South Korean Won', decimals: 0 },
  { code: 'INR', symbol: '₹', name: 'Indian Rupee', decimals: 2 },
  { code: 'CHF', symbol: 'CHF ', name: 'Swiss Franc', decimals: 2 },
  { code: 'SEK', symbol: 'kr ', name: 'Swedish Krona', decimals: 2 },
  { code: 'NOK', symbol: 'kr ', name: 'Norwegian Krone', decimals: 2 },
  { code: 'DKK', symbol: 'kr ', name: 'Danish Krone', decimals: 2 },
  { code: 'PLN', symbol: 'zł ', name: 'Polish Złoty', decimals: 2 },
  { code: 'BRL', symbol: 'R$', name: 'Brazilian Real', decimals: 2 },
  { code: 'MXN', symbol: 'MX$', name: 'Mexican Peso', decimals: 2 },
  { code: 'ARS', symbol: 'AR$', name: 'Argentine Peso', decimals: 2 },
  { code: 'COP', symbol: 'CO$', name: 'Colombian Peso', decimals: 0 },
  { code: 'CLP', symbol: 'CL$', name: 'Chilean Peso', decimals: 0 },
  { code: 'ZAR', symbol: 'R ', name: 'South African Rand', decimals: 2 },
  { code: 'SGD', symbol: 'S$', name: 'Singapore Dollar', decimals: 2 },
  { code: 'HKD', symbol: 'HK$', name: 'Hong Kong Dollar', decimals: 2 },
  { code: 'TWD', symbol: 'NT$', name: 'New Taiwan Dollar', decimals: 0 },
  { code: 'PHP', symbol: '₱', name: 'Philippine Peso', decimals: 2 },
];

export function currencyInfo(code: string): CurrencyInfo {
  return CURRENCIES.find((c) => c.code === code) ?? { code, symbol: `${code} `, name: code, decimals: 2 };
}

export interface MoneyFormat {
  decimal: string;
  group: string;
  symbolAfter: boolean;
}

export const DEFAULT_MONEY_FORMAT: MoneyFormat = { decimal: '.', group: ',', symbolAfter: false };

function groupThousands(intPart: string, sep: string): string {
  return intPart.replace(/\B(?=(\d{3})+(?!\d))/g, sep);
}

/**
 * formatMoney(1234.5, 'USD') -> "$1,234.50"; negative -> "-$12.00".
 * With a German format: "1.234,50 €". `compact` drops ".00" on whole numbers.
 */
export function formatMoney(amount: number, code: string, opts: { compact?: boolean; format?: MoneyFormat } = {}): string {
  const info = currencyInfo(code);
  const fmt = opts.format ?? DEFAULT_MONEY_FORMAT;
  const negative = amount < 0;
  const abs = Math.abs(amount);
  const rounded = Math.round(abs * 10 ** info.decimals) / 10 ** info.decimals;
  let numberText: string;
  if (opts.compact && Number.isInteger(rounded)) {
    numberText = groupThousands(String(rounded), fmt.group);
  } else {
    const fixed = rounded.toFixed(info.decimals);
    const [intPart, frac] = fixed.split('.');
    numberText = frac ? `${groupThousands(intPart, fmt.group)}${fmt.decimal}${frac}` : groupThousands(intPart, fmt.group);
  }
  const sign = negative ? '-' : '';
  if (fmt.symbolAfter) return `${sign}${numberText} ${info.symbol.trim()}`;
  return `${sign}${info.symbol}${numberText}`;
}

/** Parses user-typed money ("1,234.50", "$12", "12", "12,50") into a number or null. */
export function parseMoneyInput(text: string, decimalComma = false): number | null {
  let cleaned = text.trim();
  if (decimalComma) {
    cleaned = cleaned.replace(/\.(?=\d{3}\b)/g, '').replace(',', '.');
  } else {
    cleaned = cleaned.replace(/,(?=\d{3}\b)/g, '');
    if (/^\d+,\d{1,2}$/.test(cleaned)) cleaned = cleaned.replace(',', '.');
  }
  cleaned = cleaned.replace(/[^0-9.\-]/g, '');
  if (!cleaned || cleaned === '.' || cleaned === '-') return null;
  const n = Number(cleaned);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100) / 100;
}
