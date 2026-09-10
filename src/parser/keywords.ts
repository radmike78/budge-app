import type { TxType } from '@/types';

export interface KeywordEntry {
  categoryId: string;
  kind: TxType;
}

/**
 * Keyword -> default category dictionary. Multi-word phrases are matched before
 * single words, so "gas bill" wins over "gas". Keys must be lowercase.
 */
const RAW: Record<string, string[]> = {
  // ---- income ----
  salary: ['salary', 'paycheck', 'pay check', 'payday', 'wages', 'wage', 'got paid', 'get paid', 'was paid', 'direct deposit', 'payroll', 'pay day', 'pay cheque', 'paycheque'],
  freelance: ['freelance', 'freelancing', 'side income', 'side gig', 'gig', 'client', 'invoice', 'contract work', 'consulting', 'commission', 'etsy', 'upwork', 'fiverr', 'tutoring', 'side hustle', 'sold', 'selling', 'resold', 'ebay sale', 'tips', 'tip money'],
  gift_income: ['gift from', 'birthday money', 'gift money', 'gave me', 'sent me', 'money from mom', 'money from dad', 'from grandma', 'from grandpa', 'christmas money'],
  other_income: ['refund', 'refunded', 'reimbursed', 'reimbursement', 'cashback', 'cash back', 'rebate', 'interest', 'dividend', 'dividends', 'bonus', 'tax return', 'tax refund', 'won', 'winnings', 'lottery', 'pension', 'stipend', 'allowance', 'benefit', 'benefits', 'unemployment', 'paid back', 'paid me back', 'repaid', 'venmo from', 'zelle from', 'settlement'],

  // ---- expenses ----
  groceries: ['groceries', 'grocery', 'grocery store', 'supermarket', 'market', 'food shopping', 'produce', 'vegetables', 'fruit', 'milk', 'eggs', 'bread', 'costco', 'trader joes', "trader joe's", 'whole foods', 'aldi', 'kroger', 'safeway', 'walmart grocery', 'lidl', 'tesco', 'sainsburys', "sainsbury's", 'woolworths', 'coles', 'loblaws', 'wegmans', 'publix', 'heb', 'h-e-b', 'meijer', 'food lion', 'giant', 'stop and shop', 'sprouts', 'meat', 'butcher', 'farmers market', 'bakery'],
  dining: ['lunch', 'dinner', 'breakfast', 'brunch', 'coffee', 'latte', 'cappuccino', 'espresso', 'cafe', 'café', 'restaurant', 'takeout', 'take out', 'takeaway', 'take away', 'delivery', 'doordash', 'door dash', 'ubereats', 'uber eats', 'grubhub', 'deliveroo', 'postmates', 'seamless', 'pizza', 'burger', 'burgers', 'sushi', 'tacos', 'taco', 'sandwich', 'snack', 'snacks', 'drinks', 'beer', 'beers', 'wine', 'cocktail', 'cocktails', 'bar', 'pub', 'starbucks', 'dunkin', 'mcdonalds', "mcdonald's", 'chipotle', 'subway', 'wendys', "wendy's", 'chick fil a', 'chick-fil-a', 'taco bell', 'panera', 'boba', 'bubble tea', 'tea', 'smoothie', 'juice', 'ice cream', 'dessert', 'donut', 'donuts', 'bagel', 'food', 'ate', 'eat', 'eating out', 'meal', 'ramen', 'pho', 'kebab', 'curry', 'noodles', 'happy hour', 'tip'],
  rent: ['rent', 'mortgage', 'landlord', 'lease', 'housing', 'hoa', 'hoa fee', 'property tax', 'home insurance', 'renters insurance', "renter's insurance", 'apartment', 'security deposit'],
  utilities: ['utilities', 'utility', 'electric', 'electricity', 'electric bill', 'power bill', 'gas bill', 'water bill', 'water', 'sewer', 'trash', 'garbage', 'internet', 'wifi', 'wi-fi', 'broadband', 'phone bill', 'cell phone', 'cellphone', 'mobile bill', 'phone plan', 'verizon', 'at&t', 'att', 't-mobile', 'tmobile', 'comcast', 'xfinity', 'spectrum', 'heating', 'heat', 'energy', 'utility bill', 'council tax', 'cable'],
  transport: ['gas', 'gasoline', 'fuel', 'petrol', 'diesel', 'uber', 'lyft', 'taxi', 'cab', 'train', 'subway fare', 'metro', 'bus', 'bus fare', 'transit', 'parking', 'toll', 'tolls', 'car', 'car payment', 'car insurance', 'auto insurance', 'oil change', 'car wash', 'mechanic', 'repair', 'tires', 'tire', 'registration', 'dmv', 'flight', 'flights', 'plane ticket', 'airfare', 'airline', 'rental car', 'car rental', 'scooter', 'bike', 'bicycle', 'e-bike', 'train ticket', 'amtrak', 'commute', 'commuting', 'ride', 'rideshare', 'ev charging', 'charging'],
  health: ['doctor', 'dentist', 'dental', 'pharmacy', 'prescription', 'medicine', 'meds', 'medication', 'copay', 'co-pay', 'hospital', 'clinic', 'urgent care', 'health insurance', 'therapy', 'therapist', 'counseling', 'gym', 'gym membership', 'fitness', 'yoga', 'pilates', 'vitamins', 'supplements', 'glasses', 'contacts', 'optometrist', 'eye exam', 'chiropractor', 'physio', 'physical therapy', 'vet', 'veterinarian', 'massage', 'health', 'medical', 'cvs', 'walgreens', 'boots', 'chemist'],
  entertainment: ['movie', 'movies', 'cinema', 'theater', 'theatre', 'concert', 'show', 'tickets', 'ticket', 'game', 'games', 'video game', 'video games', 'steam', 'playstation', 'xbox', 'nintendo', 'bowling', 'golf', 'museum', 'zoo', 'park', 'amusement park', 'festival', 'club', 'nightclub', 'karaoke', 'arcade', 'books', 'book', 'kindle', 'audible', 'hobby', 'hobbies', 'crafts', 'fun', 'night out', 'date night', 'entertainment', 'sports', 'match', 'streaming'],
  shopping: ['amazon', 'target', 'walmart', 'clothes', 'clothing', 'shoes', 'sneakers', 'shirt', 'pants', 'jeans', 'dress', 'jacket', 'coat', 'shopping', 'store', 'mall', 'ikea', 'furniture', 'decor', 'home depot', 'lowes', "lowe's", 'hardware', 'tools', 'electronics', 'best buy', 'apple store', 'headphones', 'phone', 'laptop', 'charger', 'cable', 'gift', 'gifts', 'present', 'presents', 'birthday gift', 'toys', 'toy', 'makeup', 'cosmetics', 'skincare', 'haircut', 'hair', 'salon', 'barber', 'nails', 'beauty', 'sephora', 'ulta', 'etsy order', 'online order', 'order', 'purchase', 'stationery', 'office supplies', 'supplies', 'household', 'cleaning supplies', 'toiletries', 'laundry', 'dry cleaning', 'flowers', 'plants', 'pet food', 'dog food', 'cat food', 'pet', 'pets', 'dog', 'cat', 'kids', 'baby', 'diapers', 'school supplies', 'textbook', 'textbooks', 'tuition', 'course', 'class'],
  subscriptions: ['subscription', 'subscriptions', 'netflix', 'spotify', 'hulu', 'disney plus', 'disney+', 'hbo', 'max', 'apple music', 'apple tv', 'youtube premium', 'youtube', 'prime', 'amazon prime', 'icloud', 'google one', 'dropbox', 'chatgpt', 'claude', 'adobe', 'membership', 'patreon', 'substack', 'newspaper', 'nyt', 'new york times', 'paramount', 'peacock', 'crunchyroll', 'twitch', 'onlyfans', 'app subscription', 'monthly plan', 'annual plan', 'renewal', 'renewed', 'xbox live', 'game pass', 'ps plus', 'playstation plus', 'nintendo online', 'audible subscription', 'kindle unlimited', 'duolingo', 'headspace', 'calm', 'strava', 'peloton'],
  debt: ['credit card', 'credit card payment', 'card payment', 'loan', 'loan payment', 'student loan', 'student loans', 'debt', 'paid off', 'minimum payment', 'interest payment', 'late fee', 'overdraft', 'affirm', 'klarna', 'afterpay', 'personal loan', 'line of credit', 'paying back', 'paid back', 'owed', 'repayment', 'installment', 'instalment'],
  savings: ['savings', 'saving', 'transfer', 'transferred', 'moved to savings', 'emergency fund', 'investment', 'invested', 'investing', 'retirement', '401k', 'ira', 'roth', 'brokerage', 'stocks', 'crypto', 'bitcoin', 'vanguard', 'fidelity', 'schwab', 'robinhood', 'acorns', 'wealthfront', 'betterment', 'set aside', 'put away', 'deposit to savings', 'high yield', 'hysa', 'sinking fund'],
  other_expense: ['fee', 'fees', 'bank fee', 'atm', 'atm fee', 'cash', 'withdrawal', 'withdrew', 'donation', 'donated', 'charity', 'church', 'tithe', 'taxes', 'tax', 'irs', 'fine', 'parking ticket', 'speeding ticket', 'postage', 'stamps', 'shipping', 'ups', 'fedex', 'usps', 'post office', 'misc', 'miscellaneous', 'other', 'stuff', 'things', 'lent', 'loaned', 'venmo', 'zelle', 'paypal', 'cash app', 'sent', 'paid someone', 'insurance', 'life insurance', 'childcare', 'daycare', 'babysitter', 'nanny', 'school', 'education', 'legal', 'lawyer', 'accountant', 'wedding', 'vacation', 'trip', 'travel', 'hotel', 'airbnb', 'hostel', 'lodging'],
};

const INCOME_CATEGORY_IDS = new Set(['salary', 'freelance', 'gift_income', 'other_income']);

export const KEYWORDS: Map<string, KeywordEntry> = new Map();
for (const [categoryId, words] of Object.entries(RAW)) {
  const kind: TxType = INCOME_CATEGORY_IDS.has(categoryId) ? 'income' : 'expense';
  for (const w of words) {
    // First definition wins on conflict (income entries are listed first on purpose).
    if (!KEYWORDS.has(w)) KEYWORDS.set(w, { categoryId, kind });
  }
}

/** Longest phrase length in the dictionary (in words). */
export const MAX_PHRASE_WORDS = 3;

/** Words that carry no category signal and should never be learned as keywords. */
export const STOPWORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'of', 'on', 'in', 'at', 'to', 'for', 'from', 'with', 'by', 'about',
  'i', 'me', 'my', 'we', 'our', 'you', 'your', 'it', 'its', 'this', 'that', 'these', 'those', 'some', 'any',
  'is', 'was', 'were', 'be', 'been', 'am', 'are', 'do', 'did', 'does', 'have', 'has', 'had', 'got', 'get',
  'just', 'today', 'yesterday', 'tonight', 'morning', 'afternoon', 'evening', 'night', 'week', 'month', 'year',
  'spent', 'spend', 'paid', 'pay', 'bought', 'buy', 'purchased', 'cost', 'costs', 'charged', 'received', 'earned',
  'dollars', 'dollar', 'bucks', 'buck', 'usd', 'euros', 'euro', 'pounds', 'pound', 'quid', 'cents', 'cent',
  'each', 'total', 'again', 'also', 'then', 'so', 'very', 'really', 'new', 'more', 'less', 'last', 'next',
  'goal', 'save', 'saved', 'saving', 'add', 'added', 'put', 'toward', 'towards', 'into', 'up', 'out', 'off',
  'went', 'go', 'going', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
  'entry', 'expense', 'income', 'money', 'something', 'thing', 'like', 'ago', 'on',
]);

const INCOME_VERBS = [
  'got paid', 'get paid', 'was paid', 'were paid', 'been paid', 'paid me', 'paid us', 'paycheck', 'pay check', 'payday', 'pay day',
  'salary', 'wages', 'wage', 'earned', 'earning', 'earn', 'received', 'receive', 'refund', 'refunded', 'reimbursed', 'reimbursement',
  'income', 'deposited', 'deposit from', 'bonus', 'commission', 'sold', 'made', 'won', 'cashback', 'cash back', 'dividend',
  'dividends', 'pension', 'stipend', 'allowance', 'gift from', 'gave me', 'sent me', 'paid back', 'paid me back', 'repaid',
  'tips', 'tip money', 'tax refund', 'tax return', 'freelance', 'invoice paid', 'client paid', 'payout', 'cashed',
];
const EXPENSE_VERBS = [
  'spent', 'spend', 'paid', 'pay', 'paying', 'bought', 'buy', 'buying', 'purchased', 'purchase', 'cost', 'costs', 'charged', 'owe',
  'ordered', 'picked up', 'grabbed', 'went to', 'went for', 'got', 'expense', 'bill', 'renewed', 'donated', 'tipped', 'lent',
  'loaned', 'withdrew', 'sent', 'transferred', 'dropped', 'blew', 'splurged', 'treated',
];

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Longest alternatives first so "got paid" beats "paid". */
function altRegex(list: string[]): RegExp {
  const sorted = [...list].sort((a, b) => b.length - a.length).map(escapeRegex);
  return new RegExp(`(?<![a-z])(?:${sorted.join('|')})(?![a-z])`, 'i');
}

export const INCOME_VERB_RE = altRegex(INCOME_VERBS);
export const EXPENSE_VERB_RE = altRegex(EXPENSE_VERBS);
