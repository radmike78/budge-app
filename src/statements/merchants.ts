/**
 * Cleaning and classifying the description column of a statement line.
 * Statement descriptions look like "POS PURCHASE SQ *BLUE BOTTLE COF SEATTLE WA 01/05"
 * or "AMZN Mktp US*2K4R83 AMZN.COM/BILL WA". This turns them into "Blue Bottle Coffee"-ish
 * text and decides whether the line is an ordinary expense, income, a transfer,
 * a card payment, a refund, a fee or interest.
 */
import type { LineKind, StatementKind } from './types';

/** Merchant and bank vocabulary as it appears on statements, mapped to default category ids. */
export const STATEMENT_MERCHANTS: Record<string, string[]> = {
  salary: ['payroll', 'direct dep', 'direct deposit', 'dir dep', 'salary', 'wages', 'adp', 'paychex', 'gusto', 'intuit payroll', 'employer', 'des:payroll', 'ppd', 'pay period', 'net pay', 'ssa treas', 'social security', 'pension', 'gehalt', 'lohn', 'nómina', 'nomina', 'salaire', 'stipendio', '给与', '給与', '급여', '월급'],
  freelance: ['stripe transfer', 'stripe payout', 'paypal transfer', 'upwork', 'fiverr', 'etsy deposit', 'shopify payout', 'square inc', 'doordash dasher', 'uber driver', 'instacart shopper', 'invoice', 'freelance', 'consulting'],
  other_income: ['interest paid', 'interest earned', 'interest credit', 'dividend', 'tax refund', 'irs treas', 'refund', 'cashback', 'cash back', 'reward', 'rebate', 'reimbursement', 'zelle from', 'venmo from', 'cash app from', 'deposit'],
  groceries: ['grocery', 'supermarket', 'market', 'walmart', 'wm supercenter', 'wal-mart', 'target', 'costco', 'costco whse', 'kroger', 'safeway', 'albertsons', 'trader joe', 'whole foods', 'wholefds', 'aldi', 'publix', 'h-e-b', 'heb ', 'wegmans', 'sprouts', 'food lion', 'giant', 'stop & shop', 'stop and shop', 'shoprite', 'meijer', 'winco', 'fred meyer', 'ralphs', 'vons', 'harris teeter', 'piggly', 'lidl', 'sams club', "sam's club", 'bj\'s', 'instacart', 'mercadona', 'carrefour', 'lidl', 'aldi', 'edeka', 'rewe', 'tesco', 'sainsbury', 'coop', 'conad', 'esselunga', 'monoprix', 'leclerc', 'intermarche', '超市', 'スーパー', '마트'],
  dining: ['restaurant', 'cafe', 'coffee', 'starbucks', 'sbux', 'dunkin', 'mcdonald', 'mcd ', 'chick-fil-a', 'chipotle', 'panera', 'taco bell', 'wendy', 'burger king', 'subway', 'domino', 'pizza hut', 'papa john', 'sonic drive', 'dutch bros', 'peet', 'five guys', 'shake shack', 'in-n-out', 'jack in the box', 'popeyes', 'kfc', 'arby', 'chili\'s', 'applebee', 'olive garden', 'outback', 'ihop', 'denny', 'waffle house', 'doordash', 'grubhub', 'uber eats', 'ubereats', 'postmates', 'seamless', 'deliveroo', 'just eat', 'toast', 'tst*', 'sq *', 'bar ', 'grill', 'bistro', 'diner', 'pizza', 'sushi', 'taqueria', 'bakery', 'brewing', 'brewery', 'steakhouse', 'kitchen', 'eatery', 'ristorante', 'trattoria', 'brasserie', 'boulangerie', 'gastst', 'imbiss', '餐厅', '饭店', 'レストラン', '식당'],
  rent: ['rent', 'mortgage', 'mtg', 'property mgmt', 'property management', 'apartments', 'apts', 'realty', 'hoa', 'landlord', 'lease', 'quicken loans', 'rocket mortgage', 'wells fargo home', 'mr cooper', 'alquiler', 'loyer', 'affitto', 'miete', '房租', '家賃', '월세'],
  utilities: ['electric', 'energy', 'power', 'gas co', 'gas company', 'water', 'sewer', 'utility', 'utilities', 'pg&e', 'pge', 'con ed', 'coned', 'duke energy', 'dominion', 'xcel', 'sce ', 'socal gas', 'socalgas', 'national grid', 'comcast', 'xfinity', 'spectrum', 'cox comm', 'verizon', 'at&t', 'att*', 'att ', 't-mobile', 'tmobile', 'sprint', 'cricket', 'mint mobile', 'google fi', 'internet', 'wireless', 'telecom', 'edf', 'engie', 'enel', 'iberdrola', 'endesa', 'vodafone', 'orange', 'telefonica', 'movistar', 'stadtwerke', 'vattenfall', '电费', '水费', '電気', '가스'],
  transport: ['shell', 'chevron', 'exxon', 'mobil', 'bp ', 'arco', 'texaco', 'sunoco', 'marathon', 'speedway', 'circle k', 'wawa', '7-eleven', '7 eleven', 'quiktrip', 'qt ', 'racetrac', 'sheetz', 'valero', 'phillips 66', 'conoco', 'citgo', 'gas station', 'fuel', 'petrol', 'uber', 'lyft', 'taxi', 'cab', 'transit', 'metro', 'mta', 'bart', 'amtrak', 'greyhound', 'parking', 'parkmobile', 'toll', 'ez pass', 'ezpass', 'fastrak', 'dmv', 'jiffy lube', 'autozone', 'o\'reilly', 'pep boys', 'car wash', 'repsol', 'cepsa', 'total energies', 'totalenergies', 'aral', 'esso', 'sncf', 'ratp', 'renfe', 'trenitalia', 'deutsche bahn', 'db bahn', 'bvg', '加油', '地铁', 'ガソリン', '주유', '지하철'],
  health: ['pharmacy', 'cvs', 'walgreens', 'rite aid', 'clinic', 'medical', 'hospital', 'dental', 'dentist', 'doctor', 'md ', 'health', 'kaiser', 'labcorp', 'quest diag', 'optum', 'urgent care', 'physician', 'vision', 'optical', 'lenscrafters', 'gym', 'fitness', 'planet fitness', 'la fitness', '24 hour fitness', 'equinox', 'crunch', 'peloton', 'therapy', 'chiropr', 'vet ', 'veterinary', 'farmacia', 'pharmacie', 'apotheke', '药店', '薬局', '약국', '병원'],
  entertainment: ['cinema', 'theater', 'theatre', 'amc ', 'regal', 'cinemark', 'ticketmaster', 'stubhub', 'eventbrite', 'steam games', 'steampowered', 'playstation', 'xbox', 'nintendo', 'blizzard', 'epic games', 'bowling', 'golf', 'museum', 'zoo', 'concert', 'fandango', 'topgolf', 'dave & buster', 'kindle', 'audible', 'books', 'barnes', 'bookstore', 'fnac', '电影', '映画', '영화'],
  shopping: ['amazon', 'amzn', 'amz*', 'ebay', 'etsy', 'best buy', 'bestbuy', 'apple store', 'apple.com', 'home depot', 'lowes', "lowe's", 'ikea', 'wayfair', 'macy', 'nordstrom', 'kohl', 'tj maxx', 'tjmaxx', 'marshalls', 'ross ', 'old navy', 'gap ', 'h&m', 'zara', 'uniqlo', 'nike', 'adidas', 'foot locker', 'dick\'s', 'rei ', 'ulta', 'sephora', 'bath & body', 'michaels', 'hobby lobby', 'dollar tree', 'dollar general', 'five below', 'staples', 'office depot', 'petco', 'petsmart', 'chewy', 'shein', 'temu', 'aliexpress', 'wish.com', 'walmart.com', 'target.com', 'el corte ingles', 'decathlon', 'mediamarkt', 'saturn', 'otto', 'zalando', '淘宝', '京东', '拼多多', 'ユニクロ', '楽天', '쿠팡'],
  subscriptions: ['netflix', 'spotify', 'hulu', 'disney plus', 'disney+', 'hbo', 'max ', 'paramount', 'peacock', 'apple.com/bill', 'apple music', 'itunes', 'google *', 'google storage', 'google one', 'youtube', 'prime video', 'amazon prime', 'prime membership', 'icloud', 'dropbox', 'microsoft', 'adobe', 'openai', 'chatgpt', 'anthropic', 'claude.ai', 'github', 'patreon', 'substack', 'nytimes', 'new york times', 'wsj', 'washington post', 'sirius', 'siriusxm', 'ring ', 'nest ', 'membership', 'subscription', 'monthly fee', 'canva', 'notion', 'zoom', 'slack', 'linkedin', 'tinder', 'bumble', 'duolingo', 'headspace', 'calm.com', 'strava', 'dashlane', '1password', 'nordvpn', 'expressvpn'],
  debt: ['credit card payment', 'card payment', 'cardmember', 'chase card', 'chase credit crd', 'capital one', 'cap one', 'capone', 'discover', 'amex', 'american express', 'citi card', 'citicard', 'citibank', 'barclays', 'synchrony', 'synchb', 'comenity', 'credit one', 'wells fargo card', 'bank of america card', 'bofa card', 'us bank card', 'usbank', 'affirm', 'klarna', 'afterpay', 'sezzle', 'zip pay', 'navient', 'nelnet', 'mohela', 'sallie mae', 'great lakes', 'aidvantage', 'fedloan', 'dept of ed', 'department of education', 'student loan', 'loan payment', 'loan pmt', 'lending club', 'lendingclub', 'sofi', 'upstart', 'prosper', 'onemain', 'one main', 'toyota financial', 'honda finance', 'ford credit', 'gm financial', 'ally financial', 'nissan motor acceptance', 'carmax auto', 'capital one auto', 'santander consumer', 'auto loan', 'car loan', 'car payment', 'interest charge', 'finance charge', 'late fee', 'annual fee'],
  savings: ['transfer to savings', 'transfer to sav', 'savings transfer', 'online transfer', 'xfer', 'internal transfer', 'transfer to', 'transfer from', 'wealthfront', 'betterment', 'vanguard', 'fidelity', 'schwab', 'robinhood', 'acorns', 'coinbase', 'e*trade', 'etrade', 'ira contribution', '401k', 'roth', 'brokerage', 'ally bank', 'marcus', 'capital one 360', 'sofi bank', 'chime'],
};

/** Words that mean the line is a payment onto the card (on a card statement) or a transfer. */
const PAYMENT_RE = /\b(payment\s*[-–]?\s*thank you|thank you for your payment|autopay(?:ment)?|auto\s*pay|online payment|mobile payment|payment received|electronic payment|epayment|e-payment|pmt|paiement|pago|pagamento|zahlung)\b/i;
const TRANSFER_RE = /\b(transfer|xfer|tfr|zelle to|venmo payment|venmo to|cash app payment|paypal instant|wire out|wire in|between accounts|to savings|from savings|to checking|from checking|traspaso|virement|bonifico|überweisung|umbuchung)\b/i;
const REFUND_RE = /\b(refund|return|reversal|credit adj|adjustment|chargeback|dispute credit|credit voucher|rembours|reembolso|rimborso|erstattung|gutschrift)\b/i;
const INTEREST_RE = /\b(interest charge|interest charged|finance charge|purchase interest|cash advance interest|intereses|intérêts|interessi|zinsen)\b/i;
const FEE_RE = /\b(fee|fees|service charge|overdraft|nsf|late charge|penalty|annual membership|maintenance charge|comisión|comision|frais|commissione|gebühr|gebuehr)\b/i;
const INCOME_RE = /\b(payroll|direct dep|dir dep|salary|wages|deposit|interest paid|interest earned|dividend|refund|cashback|reward|pension|ssa treas|irs treas|gehalt|lohn|nómina|nomina|salaire|stipendio|virement reçu|ingreso|abono)\b/i;
const ATM_RE = /\b(atm|cash withdrawal|withdrawal|retiro|retrait|prelievo|abhebung|bargeld)\b/i;

const NOISE = [
  /\b(pos|purchase|debit card purchase|debit purchase|checkcard|check card|visa purchase|mastercard purchase|card purchase|pos purchase|pos debit|dbt purchase|purchase authorized on|recurring payment authorized on|authorized on|electronic withdrawal|electronic deposit|ach debit|ach credit|ach|web|ppd|ccd|tel|des:|id:|indn:|co id:|type:|trace#|conf#|ref#|ref no|sec:)\b/gi,
  /\b(?:x{2,}|\*{2,})\d{2,6}\b/gi,
  /\bcard\s*(?:ending|ending in|#)?\s*\d{4}\b/gi,
  /#\s?\d{2,}/g,
  /\b\d{1,2}[/.-]\d{1,2}(?:[/.-]\d{2,4})?\b/g,
  /\b[a-z0-9]*\d{5,}[a-z0-9]*\b/gi,
  /\b(?=[a-z0-9]*\d)(?=[a-z0-9]*[a-z])[a-z0-9]{5,}\b/gi,
  /\b(?:sq|tst|sp|py|pp|paypal|ppl|dd|amzn mktp|amazon\.com)\s?\*\s?/gi,
  /\b(us|usa|ca|wa|ny|tx|fl|il|az|co|ga|ma|or|pa|nj|nc|va|mi|oh|mn|wi|tn|md|ut|nv|mo|in|ky|la|sc|al|ok|ct|ia|ms|ar|ks|ne|nm|id|hi|me|nh|ri|mt|de|sd|nd|ak|vt|wy|wv|dc)\b\s*$/i,
  /\b\d{3}[-. ]\d{3}[-. ]\d{4}\b/g,
  // Account and card fragments: masked groups, "ending in 1234", and any number of 3+ digits.
  /\b(?:ending(?: in)?|last four|acct|account|card)\s*(?:number|#|no\.?)?\s*:?\s*[x*•·]*\s?\d{2,}\b/gi,
  /\b\d{3,}\b/g,
  // A bare MMDD like "0105" that some banks print after CHECKCARD.
  /\b(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\d|3[01])\b/g,
  /\b(direct dep(?:osit)?|dir dep)\b/gi,
];
/** "netflix.com/bill" -> "netflix": keep the name, drop the domain. */
const DOMAIN_RE = /\b(?:www\.)?([a-z0-9-]+)\.(?:com|net|org|co|io|us|uk|de|fr|es|it|jp|kr|cn)\b(?:\/[a-z0-9]*)?/gi;

/** "AMZN Mktp US*2K4R83 AMZN.COM/BILL WA" -> "Amzn Mktp". Keeps letters and apostrophes; drops ids and noise. */
export function cleanDescription(raw: string): string {
  let s = raw.replace(/\s+/g, ' ').trim().replace(DOMAIN_RE, '$1');
  for (const re of NOISE) s = s.replace(re, ' ');
  s = s.replace(/[|_=~^]+/g, ' ').replace(/[*]+/g, ' ').replace(/\s{2,}/g, ' ').replace(/^[\s\-:.,/]+|[\s\-:.,/]+$/g, '').trim();
  if (!s) s = raw.trim();
  // Title-case shouty statement text; leave mixed case alone.
  if (s === s.toUpperCase()) s = s.toLowerCase().replace(/(^|[\s(\/-])([a-zà-ÿ])/g, (m0, pre, ch) => pre + ch.toUpperCase());
  return s.slice(0, 80);
}

export interface KindGuess {
  kind: LineKind;
  /** Category id from the statement vocabulary, if any. */
  categoryId: string | null;
  confidence: number;
}

/** The dictionary lookup on the raw (lowercased) description; longest phrase wins. */
export function lookupMerchant(rawLower: string): { categoryId: string; phrase: string } | null {
  let best: { categoryId: string; phrase: string } | null = null;
  for (const [categoryId, phrases] of Object.entries(STATEMENT_MERCHANTS)) {
    for (const phrase of phrases) {
      if (rawLower.includes(phrase) && (!best || phrase.length > best.phrase.length)) best = { categoryId, phrase };
    }
  }
  return best;
}

/**
 * Decides what the line is. `direction` is money in/out of this account;
 * `statement` tells us whether a credit on the account is a refund (card) or income (bank).
 */
export function guessKind(rawDescription: string, direction: 'in' | 'out', statement: StatementKind): KindGuess {
  const text = rawDescription.toLowerCase();
  const merchant = lookupMerchant(text);
  if (statement === 'card') {
    if (direction === 'in') {
      if (PAYMENT_RE.test(text) && !REFUND_RE.test(text)) return { kind: 'payment', categoryId: null, confidence: 0.9 };
      return { kind: 'refund', categoryId: 'other_income', confidence: 0.7 };
    }
    if (INTEREST_RE.test(text)) return { kind: 'interest', categoryId: 'debt', confidence: 0.9 };
    if (FEE_RE.test(text)) return { kind: 'fee', categoryId: 'debt', confidence: 0.85 };
    return { kind: 'expense', categoryId: merchant?.categoryId ?? null, confidence: merchant ? 0.8 : 0.3 };
  }
  // Bank account.
  if (TRANSFER_RE.test(text) && !PAYMENT_RE.test(text) && !INCOME_RE.test(text)) return { kind: 'transfer', categoryId: 'savings', confidence: 0.8 };
  if (direction === 'in') {
    if (INTEREST_RE.test(text) || FEE_RE.test(text)) return { kind: 'income', categoryId: 'other_income', confidence: 0.6 };
    return { kind: 'income', categoryId: merchant && merchant.categoryId !== 'debt' && merchant.categoryId !== 'savings' ? merchant.categoryId : 'other_income', confidence: merchant ? 0.8 : 0.5 };
  }
  if (INTEREST_RE.test(text) || FEE_RE.test(text)) return { kind: 'fee', categoryId: 'other_expense', confidence: 0.8 };
  if (PAYMENT_RE.test(text) && (merchant?.categoryId === 'debt' || /card|loan|visa|mastercard|amex/.test(text))) return { kind: 'expense', categoryId: 'debt', confidence: 0.85 };
  if (ATM_RE.test(text)) return { kind: 'expense', categoryId: 'other_expense', confidence: 0.6 };
  if (merchant?.categoryId === 'savings') return { kind: 'transfer', categoryId: 'savings', confidence: 0.75 };
  const cat = merchant?.categoryId ?? null;
  const incomeOnly = cat === 'salary' || cat === 'freelance' || cat === 'other_income';
  return { kind: 'expense', categoryId: incomeOnly ? null : cat, confidence: cat && !incomeOnly ? 0.8 : 0.3 };
}
