import { replaceNumberWords } from '../numberWords';
import { ISO_RULE, byMonthRule, byYearRule, dayMonthRule, dayOfMonthRule, monthDayRule, relativeFutureRules, relativePastRules, slashRule, weekdayRule } from '../dateRules';
import type { LanguagePack } from '../types';
import { normalizeDecimalPoint } from '../numbers';

const MONTHS = {
  names: {
    january: 0, jan: 0, february: 1, feb: 1, march: 2, mar: 2, april: 3, apr: 3, may: 4, june: 5, jun: 5,
    july: 6, jul: 6, august: 7, aug: 7, september: 8, sept: 8, sep: 8, october: 9, oct: 9,
    november: 10, nov: 10, december: 11, dec: 11,
  },
};

const WEEKDAYS = {
  names: {
    sunday: 0, sun: 0, monday: 1, mon: 1, tuesday: 2, tue: 2, tues: 2, wednesday: 3, wed: 3,
    thursday: 4, thu: 4, thur: 4, thurs: 4, friday: 5, fri: 5, saturday: 6, sat: 6,
  },
  lastBefore: ['last', 'past'],
  prefixes: ['on', 'this'],
};

const KEYWORDS: Record<string, string[]> = {
  salary: ['salary', 'paycheck', 'pay check', 'payday', 'wages', 'wage', 'got paid', 'get paid', 'was paid', 'direct deposit', 'payroll', 'pay day', 'pay cheque', 'paycheque'],
  freelance: ['freelance', 'freelancing', 'side income', 'side gig', 'gig', 'client', 'invoice', 'contract work', 'consulting', 'commission', 'etsy', 'upwork', 'fiverr', 'tutoring', 'side hustle', 'sold', 'selling', 'resold', 'ebay sale', 'tips', 'tip money'],
  gift_income: ['gift from', 'birthday money', 'gift money', 'gave me', 'sent me', 'money from mom', 'money from dad', 'from grandma', 'from grandpa', 'christmas money'],
  other_income: ['refund', 'refunded', 'reimbursed', 'reimbursement', 'cashback', 'cash back', 'rebate', 'interest', 'dividend', 'dividends', 'bonus', 'tax return', 'tax refund', 'won', 'winnings', 'lottery', 'pension', 'stipend', 'allowance', 'benefit', 'benefits', 'unemployment', 'paid back', 'paid me back', 'repaid', 'venmo from', 'zelle from', 'settlement'],
  groceries: ['groceries', 'grocery', 'grocery store', 'supermarket', 'market', 'food shopping', 'produce', 'vegetables', 'fruit', 'milk', 'eggs', 'bread', 'costco', 'trader joes', "trader joe's", 'whole foods', 'aldi', 'kroger', 'safeway', 'walmart grocery', 'lidl', 'tesco', 'sainsburys', "sainsbury's", 'woolworths', 'coles', 'loblaws', 'wegmans', 'publix', 'heb', 'h-e-b', 'meijer', 'food lion', 'giant', 'stop and shop', 'sprouts', 'meat', 'butcher', 'farmers market', 'bakery'],
  dining: ['lunch', 'dinner', 'breakfast', 'brunch', 'coffee', 'latte', 'cappuccino', 'espresso', 'cafe', 'café', 'restaurant', 'takeout', 'take out', 'takeaway', 'take away', 'delivery', 'doordash', 'door dash', 'ubereats', 'uber eats', 'grubhub', 'deliveroo', 'postmates', 'seamless', 'pizza', 'burger', 'burgers', 'sushi', 'tacos', 'taco', 'sandwich', 'snack', 'snacks', 'drinks', 'beer', 'beers', 'wine', 'cocktail', 'cocktails', 'bar', 'pub', 'starbucks', 'dunkin', 'mcdonalds', "mcdonald's", 'chipotle', 'subway', 'wendys', "wendy's", 'chick fil a', 'chick-fil-a', 'taco bell', 'panera', 'boba', 'bubble tea', 'tea', 'smoothie', 'juice', 'ice cream', 'dessert', 'donut', 'donuts', 'bagel', 'food', 'ate', 'eat', 'eating out', 'meal', 'ramen', 'pho', 'kebab', 'curry', 'noodles', 'happy hour', 'tip', 'steakhouse', 'steak house', 'steak', 'grill', 'bistro', 'diner', 'eatery', 'brasserie', 'trattoria', 'taqueria', 'cantina', 'bakery cafe', 'chili\'s', 'chilis', 'applebee\'s', 'applebees', 'olive garden', 'outback', 'cheesecake factory', 'panda express', 'five guys', 'shake shack', 'in-n-out', 'in n out', 'dominos', 'domino\'s', 'papa johns', 'papa john\'s', 'pizza hut', 'tim hortons', 'whataburger', 'sonic', 'arby\'s', 'arbys', 'kfc', 'popeyes', 'wingstop', 'waffle house', 'ihop', 'denny\'s', 'dennys', 'cracker barrel', 'texas roadhouse', 'red lobster', 'buffalo wild wings', 'wendy\'s', 'jack in the box', 'carl\'s jr', 'del taco', 'qdoba', 'sweetgreen', 'noodles & company', 'raising cane\'s', 'canes', 'zaxby\'s', 'culver\'s', 'steak n shake', 'longhorn', 'ruth\'s chris', 'fleming\'s', 'morton\'s', 'capital grille', 'p.f. chang\'s', 'pf changs', 'benihana', 'nando\'s', 'wagamama', 'pret', 'greggs', 'caffe nero', 'tim horton\'s'],
  rent: ['rent', 'mortgage', 'landlord', 'lease', 'housing', 'hoa', 'hoa fee', 'property tax', 'home insurance', 'renters insurance', "renter's insurance", 'apartment', 'security deposit'],
  utilities: ['utilities', 'utility', 'electric', 'electricity', 'electric bill', 'power bill', 'gas bill', 'water bill', 'water', 'sewer', 'trash', 'garbage', 'internet', 'wifi', 'wi-fi', 'broadband', 'phone bill', 'cell phone', 'cellphone', 'mobile bill', 'phone plan', 'verizon', 'at&t', 'att', 't-mobile', 'tmobile', 'comcast', 'xfinity', 'spectrum', 'heating', 'heat', 'energy', 'utility bill', 'council tax', 'cable'],
  transport: ['gas', 'gasoline', 'fuel', 'petrol', 'diesel', 'uber', 'lyft', 'taxi', 'cab', 'train', 'subway fare', 'metro', 'bus', 'bus fare', 'transit', 'parking', 'toll', 'tolls', 'car', 'car payment', 'car insurance', 'auto insurance', 'oil change', 'car wash', 'mechanic', 'repair', 'tires', 'tire', 'registration', 'dmv', 'flight', 'flights', 'plane ticket', 'airfare', 'airline', 'rental car', 'car rental', 'scooter', 'bike', 'bicycle', 'e-bike', 'train ticket', 'amtrak', 'commute', 'commuting', 'ride', 'rideshare', 'ev charging', 'charging', 'shell', 'exxon', 'chevron', 'bp', 'mobil', 'wawa', 'sheetz', 'speedway', 'circle k', 'quiktrip', 'racetrac', 'gas station', 'petrol station', 'esso', 'texaco', 'sunoco', 'valero', 'love\'s', 'buc-ee\'s', 'bucees', 'supercharger', 'jiffy lube', 'valvoline', 'autozone', 'o\'reilly', 'pep boys', 'greyhound', 'megabus', 'american airlines', 'southwest', 'jetblue', 'alaska airlines', 'hertz', 'avis', 'enterprise', 'turo'],
  health: ['doctor', 'dentist', 'dental', 'pharmacy', 'prescription', 'medicine', 'meds', 'medication', 'copay', 'co-pay', 'hospital', 'clinic', 'urgent care', 'health insurance', 'therapy', 'therapist', 'counseling', 'gym', 'gym membership', 'fitness', 'yoga', 'pilates', 'vitamins', 'supplements', 'glasses', 'contacts', 'optometrist', 'eye exam', 'chiropractor', 'physio', 'physical therapy', 'vet', 'veterinarian', 'massage', 'health', 'medical', 'cvs', 'walgreens', 'boots', 'chemist', 'rite aid', 'planet fitness', 'la fitness', 'equinox', 'orangetheory', 'crossfit', 'anytime fitness', 'kaiser', 'quest', 'labcorp', 'petsmart vet', 'banfield'],
  entertainment: ['movie', 'movies', 'cinema', 'theater', 'theatre', 'concert', 'show', 'tickets', 'ticket', 'game', 'games', 'video game', 'video games', 'steam', 'playstation', 'xbox', 'nintendo', 'bowling', 'golf', 'museum', 'zoo', 'park', 'amusement park', 'festival', 'club', 'nightclub', 'karaoke', 'arcade', 'books', 'book', 'kindle', 'audible', 'hobby', 'hobbies', 'crafts', 'fun', 'night out', 'date night', 'entertainment', 'sports', 'match', 'streaming'],
  shopping: ['amazon', 'target', 'walmart', 'clothes', 'clothing', 'shoes', 'sneakers', 'shirt', 'pants', 'jeans', 'dress', 'jacket', 'coat', 'shopping', 'store', 'mall', 'ikea', 'furniture', 'decor', 'home depot', 'lowes', "lowe's", 'hardware', 'tools', 'electronics', 'best buy', 'apple store', 'headphones', 'phone', 'laptop', 'charger', 'cable', 'gift', 'gifts', 'present', 'presents', 'birthday gift', 'toys', 'toy', 'makeup', 'cosmetics', 'skincare', 'haircut', 'hair', 'salon', 'barber', 'nails', 'beauty', 'sephora', 'ulta', 'etsy order', 'online order', 'order', 'purchase', 'stationery', 'office supplies', 'supplies', 'household', 'cleaning supplies', 'toiletries', 'laundry', 'dry cleaning', 'flowers', 'plants', 'pet food', 'dog food', 'cat food', 'pet', 'pets', 'dog', 'cat', 'kids', 'baby', 'diapers', 'school supplies', 'textbook', 'textbooks', 'tuition', 'course', 'class', 'macy\'s', 'macys', 'nordstrom', 'kohl\'s', 'kohls', 'tj maxx', 'tjmaxx', 'marshalls', 'old navy', 'gap', 'h&m', 'uniqlo', 'forever 21', 'department store', 'boutique', 'costco membership', 'dollar tree', 'dollar general', 'five below', 'bed bath', 'wayfair', 'etsy', 'ebay', 'temu', 'shein', 'aliexpress', 'foot locker', 'nike', 'adidas', 'lululemon', 'dick\'s', 'dicks sporting', 'rei', 'bass pro', 'michaels', 'hobby lobby', 'joann', 'staples', 'office depot', 'ace hardware', 'harbor freight', 'menards', 'costco shopping', 'sam\'s club', 'bj\'s', 'john lewis', 'argos', 'debenhams', 'selfridges', 'ikea order', 'best buy'],
  subscriptions: ['subscription', 'subscriptions', 'netflix', 'spotify', 'hulu', 'disney plus', 'disney+', 'hbo', 'max', 'apple music', 'apple tv', 'youtube premium', 'youtube', 'prime', 'amazon prime', 'icloud', 'google one', 'dropbox', 'chatgpt', 'claude', 'adobe', 'membership', 'patreon', 'substack', 'newspaper', 'nyt', 'new york times', 'paramount', 'peacock', 'crunchyroll', 'twitch', 'app subscription', 'monthly plan', 'annual plan', 'renewal', 'renewed', 'xbox live', 'game pass', 'ps plus', 'playstation plus', 'nintendo online', 'audible subscription', 'kindle unlimited', 'duolingo', 'headspace', 'calm', 'strava', 'peloton'],
  debt: ['credit card', 'credit card payment', 'card payment', 'loan', 'loan payment', 'student loan', 'student loans', 'debt', 'paid off', 'minimum payment', 'interest payment', 'late fee', 'overdraft', 'affirm', 'klarna', 'afterpay', 'personal loan', 'line of credit', 'paying back', 'paid back', 'owed', 'repayment', 'installment', 'instalment'],
  savings: ['savings', 'saving', 'transfer', 'transferred', 'moved to savings', 'emergency fund', 'investment', 'invested', 'investing', 'retirement', '401k', 'ira', 'roth', 'brokerage', 'stocks', 'crypto', 'bitcoin', 'vanguard', 'fidelity', 'schwab', 'robinhood', 'acorns', 'wealthfront', 'betterment', 'set aside', 'put away', 'deposit to savings', 'high yield', 'hysa', 'sinking fund'],
  other_expense: ['fee', 'fees', 'bank fee', 'atm', 'atm fee', 'cash', 'withdrawal', 'withdrew', 'donation', 'donated', 'charity', 'church', 'tithe', 'taxes', 'tax', 'irs', 'fine', 'parking ticket', 'speeding ticket', 'postage', 'stamps', 'shipping', 'ups', 'fedex', 'usps', 'post office', 'misc', 'miscellaneous', 'other', 'stuff', 'things', 'lent', 'loaned', 'venmo', 'zelle', 'paypal', 'cash app', 'sent', 'paid someone', 'insurance', 'life insurance', 'childcare', 'daycare', 'babysitter', 'nanny', 'school', 'education', 'legal', 'lawyer', 'accountant', 'wedding', 'vacation', 'trip', 'travel', 'hotel', 'airbnb', 'hostel', 'lodging'],
};

const STOPWORDS = [
  'a', 'an', 'the', 'and', 'or', 'but', 'of', 'on', 'in', 'at', 'to', 'for', 'from', 'with', 'by', 'about',
  'i', 'me', 'my', 'we', 'our', 'you', 'your', 'it', 'its', 'this', 'that', 'these', 'those', 'some', 'any',
  'is', 'was', 'were', 'be', 'been', 'am', 'are', 'do', 'did', 'does', 'have', 'has', 'had', 'got', 'get',
  'just', 'today', 'yesterday', 'tonight', 'morning', 'afternoon', 'evening', 'night', 'week', 'month', 'year',
  'spent', 'spend', 'paid', 'pay', 'bought', 'buy', 'purchased', 'cost', 'costs', 'charged', 'received', 'earned',
  'dollars', 'dollar', 'bucks', 'buck', 'usd', 'euros', 'euro', 'pounds', 'pound', 'quid', 'cents', 'cent',
  'each', 'total', 'again', 'also', 'then', 'so', 'very', 'really', 'new', 'more', 'less', 'last', 'next',
  'goal', 'save', 'saved', 'saving', 'add', 'added', 'put', 'toward', 'towards', 'into', 'up', 'out', 'off',
  'went', 'go', 'going', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
  'entry', 'expense', 'income', 'money', 'something', 'thing', 'like', 'ago',
];

function singularForms(word: string): string[] {
  const out: string[] = [];
  if (word.length > 4 && word.endsWith('ies')) out.push(word.slice(0, -3) + 'y');
  if (word.length > 3 && word.endsWith('s') && !word.endsWith('ss')) out.push(word.slice(0, -1));
  if (word.length > 4 && word.endsWith('es')) out.push(word.slice(0, -2));
  return out;
}

const relPast = relativePastRules({
  today: ['today', 'tonight', 'this morning', 'this afternoon', 'this evening', 'earlier today'],
  yesterday: ['yesterday', 'yesterday morning', 'yesterday afternoon', 'yesterday evening', 'yesterday night', 'last night'],
  dayBeforeYesterday: ['day before yesterday', 'the day before yesterday'],
  lastWeek: ['last week'],
  lastMonth: ['last month'],
  daysAgo: /\b(\d+|a|one) days? ago\b/,
  weeksAgo: /\b(\d+|a|one) weeks? ago\b/,
  monthsAgo: /\b(\d+|a|one) months? ago\b/,
  oneWords: ['a', 'one'],
});

const relFuture = relativeFutureRules({
  endOfYear: ['by end of year', 'by the end of the year', 'by the end of this year', 'end of year', 'end of the year', 'end of this year', 'by year end'],
  endOfNextYear: ['by the end of next year', 'end of next year'],
  endOfMonth: ['by end of month', 'by the end of the month', 'by the end of this month', 'end of month', 'end of the month'],
  nextYear: ['by next year', 'next year'],
  nextMonth: ['by next month', 'next month'],
  christmas: ['by christmas', 'before christmas', 'christmas'],
  inDays: /\bin (\d+|a|one) days?\b/,
  inWeeks: /\bin (\d+|a|one) weeks?\b/,
  inMonths: /\bin (\d+|a|one) months?\b/,
  inYears: /\bin (\d+|a|one) years?\b/,
  oneWords: ['a', 'one'],
  seasons: { spring: ['by spring', 'by next spring'], summer: ['by summer', 'by next summer'], fall: ['by fall', 'by autumn', 'by next fall', 'by next autumn'], winter: ['by winter', 'by next winter'] },
});

export const en: LanguagePack = {
  code: 'en',
  speechTag: 'en-US',
  tokenizer: 'space',
  decimalComma: false,
  numberWords: (t) => replaceNumberWords(normalizeDecimalPoint(t)),
  currencyMarkers: /\$|€|£|¥|₹|dollars?|bucks?|usd|euros?|eur|pounds?|gbp|quid|cad|aud|yen|rupees?|inr|pesos?|kr|chf/i,
  currencyWords: /\b(dollars?|bucks?|usd|euros?|eur|pounds?|gbp|quid|cad|aud|yen|rupees?|inr|pesos?|kr|chf|cents?)\b/giu,
  incomeVerbs: [
    'got paid', 'get paid', 'was paid', 'were paid', 'been paid', 'paid me', 'paid us', 'paycheck', 'pay check', 'payday', 'pay day',
    'salary', 'wages', 'wage', 'earned', 'earning', 'earn', 'received', 'receive', 'refund', 'refunded', 'reimbursed', 'reimbursement',
    'income', 'deposited', 'deposit from', 'bonus', 'commission', 'sold', 'made', 'won', 'cashback', 'cash back', 'dividend',
    'dividends', 'pension', 'stipend', 'allowance', 'gift from', 'gave me', 'sent me', 'paid back', 'paid me back', 'repaid',
    'tips', 'tip money', 'tax refund', 'tax return', 'freelance', 'invoice paid', 'client paid', 'payout', 'cashed',
  ],
  expenseVerbs: [
    'spent', 'spend', 'paid', 'pay', 'paying', 'bought', 'buy', 'buying', 'purchased', 'purchase', 'cost', 'costs', 'charged', 'owe',
    'ordered', 'picked up', 'grabbed', 'went to', 'went for', 'got', 'expense', 'bill', 'renewed', 'donated', 'tipped', 'lent',
    'loaned', 'withdrew', 'sent', 'transferred', 'dropped', 'blew', 'splurged', 'treated',
  ],
  keywords: KEYWORDS,
  stopwords: STOPWORDS,
  pastDateRules: [
    ISO_RULE,
    ...relPast,
    monthDayRule(MONTHS, { pre: ['on', 'back on'], ordinal: '(?:st|nd|rd|th)?' }),
    dayMonthRule(MONTHS, { pre: ['on', 'on the', 'the'], between: ['of'], ordinal: '(?:st|nd|rd|th)?' }),
    dayOfMonthRule(/\bon the (\d{1,2})(?:st|nd|rd|th)\b/),
    weekdayRule(WEEKDAYS),
    slashRule(false),
  ],
  futureDateRules: [
    ISO_RULE,
    ...relFuture,
    monthDayRule(MONTHS, { pre: ['by', 'before', 'until', 'due'], ordinal: '(?:st|nd|rd|th)?', future: true }),
    dayMonthRule(MONTHS, { pre: ['by', 'before', 'until', 'by the', 'before the', 'the'], between: ['of'], ordinal: '(?:st|nd|rd|th)?', future: true }),
    byMonthRule(MONTHS, ['by', 'before', 'until', 'in']),
    byYearRule(['by', 'before']),
  ],
  goalLead: /^(?:goal|new goal|savings goal|saving goal|set (?:a )?goal|create (?:a )?goal)\s*:?\s*/,
  goalIntent: /\b(?:i(?:'d| would)? (?:want|like|need|plan|am trying|'m trying) to (?:save|put away|set aside|have)|want to save|save up|saving up|trying to save|need to save|save)\b/,
  goalPastVerbs: /\b(?:saved|stashed|moved|added|put|transferred|deposited)\b/,
  contributionVerbs: /\b(?:add(?:ed)?|put|moved?|saved?|set aside|transfer(?:red)?|deposit(?:ed)?|contribut(?:ed|e)|stashed|stash|tucked away|threw)\b/,
  contributionPreps: 'to|toward|towards|into|for|in',
  forWords: 'for',
  goalWords: 'goal',
  articles: /^(?:(?:a|an|the|my|our|some|new)\s+)+/,
  leadingFiller: /^(?:(?:i|we|just|then|and|so|also|today|ok|okay|um|uh|please|note|log|add|record|entry|new|expense|income|spent|spend|paid|pay|bought|buy|purchased|got|get|received|earned|made|cost|for|on|at|of|to|in|from|the|a|an|some|my|our|about|around|roughly|another)\s+)+/,
  trailingFiller: /(?:\s+(?:today|yesterday|for|on|at|of|to|in|from|the|a|an|and|with|each|total|again|please|thanks|it|that|this))+$/,
  noteStrip: [],
  singularForms,
  listSeparators: [',', ';', 'and', 'plus', 'also', 'then', 'and then', 'and also'],
  contextualStrings: ['dollars', 'bucks', 'groceries', 'rent', 'paycheck', 'goal', 'Netflix', 'Uber'],
};
