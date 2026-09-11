import { ISO_RULE, byMonthRule, byYearRule, endOfYearRule, dayMonthRule, relativeFutureRules, relativePastRules, slashRule, weekdayRule } from '../dateRules';
import { makeNumberWords } from '../numbers';
import type { LanguagePack } from '../types';
import { clockRule, dayWords, futureDayOfMonthRule, futureWeekdayRule, monthlyOnRule, repeatWords, weeklyOnRule, wordTimeRules } from '../reminderRules';

const MONTHS = { names: { januar: 0, jänner: 0, jan: 0, februar: 1, feb: 1, märz: 2, maerz: 2, mär: 2, april: 3, apr: 3, mai: 4, juni: 5, jun: 5, juli: 6, jul: 6, august: 7, aug: 7, september: 8, sep: 8, sept: 8, oktober: 9, okt: 9, november: 10, nov: 10, dezember: 11, dez: 11 } };
const WEEKDAYS = { names: { sonntag: 0, montag: 1, dienstag: 2, mittwoch: 3, donnerstag: 4, freitag: 5, samstag: 6, sonnabend: 6 }, lastBefore: ['letzten', 'letzte', 'vorigen', 'am letzten', 'vergangenen'], prefixes: ['am', 'diesen', 'den'] };

const UNITS: Record<string, number> = { null: 0, eins: 1, ein: 1, eine: 1, einen: 1, einem: 1, zwei: 2, zwo: 2, drei: 3, vier: 4, fünf: 5, fuenf: 5, sechs: 6, sieben: 7, acht: 8, neun: 9, zehn: 10, elf: 11, zwölf: 12, zwoelf: 12, dreizehn: 13, vierzehn: 14, fünfzehn: 15, fuenfzehn: 15, sechzehn: 16, siebzehn: 17, achtzehn: 18, neunzehn: 19 };
const TENS: Record<string, number> = { zwanzig: 20, dreißig: 30, dreissig: 30, vierzig: 40, fünfzig: 50, fuenfzig: 50, sechzig: 60, siebzig: 70, achtzig: 80, neunzig: 90 };
const PARTS = [...Object.keys(UNITS), ...Object.keys(TENS), 'hundert', 'tausend', 'und'].sort((a, b) => b.length - a.length);

/** "zweihundertfünfundzwanzig" -> "zwei hundert fünf und zwanzig" (only when every piece is a number word). */
function splitCompound(word: string): string {
  const w = word.toLowerCase();
  if (!/(hundert|tausend|und)/.test(w) || w === 'und') return word;
  const out: string[] = [];
  let i = 0;
  while (i < w.length) {
    const part = PARTS.find((p) => w.startsWith(p, i));
    if (!part) return word;
    out.push(part);
    i += part.length;
  }
  return out.join(' ');
}

const numberWords = makeNumberWords({
  units: UNITS,
  tens: TENS,
  hundred: ['hundert'],
  thousand: ['tausend'],
  million: ['million', 'millionen'],
  connectors: ['und'],
  one: ['ein', 'eine', 'einen', 'einem'],
  pre: (t) => t.split(/\s+/).map(splitCompound).join(' '),
});

export const de: LanguagePack = {
  code: 'de',
  speechTag: 'de-DE',
  tokenizer: 'space',
  decimalComma: true,
  numberWords,
  currencyMarkers: /€|\$|euros?|dollars?|chf|franken|usd|eur|kröten|mäuse|tacken/i,
  currencyWords: /(?<![\p{L}])(?:euros?|dollars?|chf|franken|usd|eur|kröten|mäuse|tacken|cents?)(?![\p{L}])/giu,
  incomeVerbs: ['gehalt', 'lohn', 'bekommen', 'erhalten', 'verdient', 'eingenommen', 'einnahme', 'einkommen', 'rückerstattung', 'erstattet', 'zurückbekommen', 'zurück bekommen', 'bonus', 'prämie', 'provision', 'verkauft', 'trinkgeld', 'geschenk von', 'hat mir gegeben', 'haben mir gegeben', 'mir geschickt', 'mir überwiesen', 'überwiesen bekommen', 'rente', 'kindergeld', 'gutschrift', 'ausgezahlt', 'auszahlung', 'wurde bezahlt', 'bezahlt worden', 'steuererstattung', 'honorar', 'gekriegt', 'reingekommen', 'eingegangen', 'gutgeschrieben', 'cashback', 'dividende', 'zinsen erhalten', 'gewonnen'],
  expenseVerbs: ['ausgegeben', 'bezahlt', 'gezahlt', 'gekauft', 'ausgabe', 'kauf', 'gekostet', 'kostet', 'bestellt', 'geholt', 'gespendet', 'geliehen', 'verliehen', 'abgehoben', 'geschickt', 'überwiesen', 'rechnung', 'zahle', 'kaufe', 'bezahle', 'gegeben', 'verprasst', 'gebucht', 'getankt', 'gegessen', 'getrunken', 'gezockt', 'kosten', 'ausgaben', 'draufgegangen', 'hingelegt', 'gelöhnt', 'berappt'],
  keywords: {
    salary: ['gehalt', 'lohn', 'gehaltseingang', 'lohnzettel', 'monatsgehalt', 'zahltag', 'weihnachtsgeld', 'urlaubsgeld'],
    freelance: ['freelance', 'freiberuflich', 'selbstständig', 'kunde', 'kundin', 'rechnung bezahlt bekommen', 'auftrag', 'nebenjob', 'nebenverdienst', 'minijob', 'honorar', 'beratung', 'provision', 'nachhilfe', 'verkauft', 'verkauf', 'ebay', 'kleinanzeigen', 'vinted', 'trinkgeld', 'upwork', 'fiverr'],
    gift_income: ['geschenk von', 'geschenkt bekommen', 'hat mir gegeben', 'haben mir gegeben', 'geburtstagsgeld', 'taschengeld', 'von mama', 'von papa', 'von oma', 'von opa', 'weihnachtsgeld von'],
    other_income: ['rückerstattung', 'erstattung', 'erstattet', 'cashback', 'zinsen', 'dividende', 'dividenden', 'bonus', 'prämie', 'steuererstattung', 'steuerrückzahlung', 'finanzamt', 'gewonnen', 'gewinn', 'lotto', 'rente', 'pension', 'kindergeld', 'elterngeld', 'bafög', 'stipendium', 'arbeitslosengeld', 'bürgergeld', 'zurückbekommen', 'zurückgezahlt', 'paypal von', 'überweisung von', 'pfand'],
    groceries: ['einkauf', 'einkaufen', 'lebensmittel', 'supermarkt', 'markt', 'wochenmarkt', 'rewe', 'edeka', 'aldi', 'lidl', 'penny', 'netto', 'kaufland', 'norma', 'real', 'globus', 'hit', 'tegut', 'denns', 'alnatura', 'obst', 'gemüse', 'brot', 'brötchen', 'milch', 'eier', 'fleisch', 'käse', 'metzger', 'metzgerei', 'bäcker', 'bäckerei', 'bio', 'wocheneinkauf', 'getränkemarkt', 'essen für zuhause'],
    dining: ['mittagessen', 'mittag', 'abendessen', 'frühstück', 'brunch', 'kaffee', 'café', 'cafe', 'restaurant', 'imbiss', 'döner', 'kebab', 'pizza', 'burger', 'sushi', 'bier', 'biere', 'wein', 'cocktail', 'cocktails', 'bar', 'kneipe', 'essen gehen', 'essen bestellt', 'lieferando', 'uber eats', 'wolt', 'mcdonalds', "mcdonald's", 'mcdonald', 'burger king', 'starbucks', 'eis', 'kuchen', 'dessert', 'snack', 'currywurst', 'pommes', 'essen', 'mensa', 'kantine', 'bäcker frühstück', 'lieferservice', 'biergarten', 'feierabendbier', 'auswärts essen', 'getränke', 'latte'],
    rent: ['miete', 'hypothek', 'vermieter', 'nebenkosten', 'hausgeld', 'wohnung', 'kaution', 'hausratversicherung', 'wohngebäudeversicherung', 'warmmiete', 'kaltmiete', 'grundsteuer', 'baufinanzierung'],
    utilities: ['strom', 'stromrechnung', 'gas', 'gasrechnung', 'wasser', 'wasserrechnung', 'heizung', 'heizkosten', 'internet', 'wlan', 'dsl', 'telefon', 'handy', 'handyvertrag', 'handyrechnung', 'telekom', 'vodafone', 'o2', '1&1', 'congstar', 'gez', 'rundfunkbeitrag', 'müll', 'müllgebühren', 'energie', 'nebenkostenabrechnung', 'fernwärme', 'stadtwerke'],
    transport: ['benzin', 'sprit', 'tanken', 'getankt', 'diesel', 'uber', 'bolt', 'taxi', 'bahn', 'zug', 'deutsche bahn', 'db', 'ice', 's-bahn', 'u-bahn', 'bus', 'tram', 'straßenbahn', 'ticket', 'fahrkarte', 'deutschlandticket', 'monatskarte', 'maut', 'parken', 'parkplatz', 'parkticket', 'parkhaus', 'auto', 'kfz', 'kfz-versicherung', 'autoversicherung', 'werkstatt', 'reifen', 'tüv', 'ölwechsel', 'inspektion', 'flug', 'flugticket', 'flixbus', 'mietwagen', 'fahrrad', 'rad', 'roller', 'e-scooter', 'blablacar', 'fahrt', 'pendeln', 'fahrtkosten', 'waschanlage', 'autowäsche', 'carsharing', 'sixt', 'miles'],
    health: ['arzt', 'ärztin', 'zahnarzt', 'apotheke', 'rezept', 'medikamente', 'medikament', 'tabletten', 'krankenhaus', 'klinik', 'praxis', 'krankenkasse', 'krankenversicherung', 'therapie', 'therapeut', 'psychologe', 'fitnessstudio', 'fitness', 'gym', 'sport', 'yoga', 'pilates', 'vitamine', 'nahrungsergänzung', 'brille', 'optiker', 'kontaktlinsen', 'physio', 'physiotherapie', 'osteopath', 'tierarzt', 'massage', 'gesundheit', 'zuzahlung', 'heilpraktiker', 'zahnreinigung'],
    entertainment: ['kino', 'film', 'konzert', 'tickets', 'karten', 'eintritt', 'theater', 'show', 'spiel', 'spiele', 'videospiel', 'videospiele', 'steam', 'playstation', 'xbox', 'nintendo', 'bowling', 'museum', 'park', 'freizeitpark', 'party', 'club', 'disco', 'karaoke', 'buch', 'bücher', 'hobby', 'ausgehen', 'fußball', 'stadion', 'escape room', 'freizeit', 'unterhaltung', 'festival', 'schwimmbad', 'zoo', 'lasertag', 'kegeln'],
    shopping: ['amazon', 'kleidung', 'klamotten', 'schuhe', 'sneaker', 'hemd', 'hose', 'jeans', 'kleid', 'jacke', 'mantel', 'shopping', 'laden', 'geschäft', 'einkaufszentrum', 'ikea', 'möbel', 'deko', 'dekoration', 'obi', 'bauhaus', 'hornbach', 'baumarkt', 'elektronik', 'media markt', 'mediamarkt', 'saturn', 'kopfhörer', 'neues handy', 'laptop', 'ladekabel', 'geschenk', 'geschenke', 'spielzeug', 'make-up', 'kosmetik', 'drogerie', 'dm', 'rossmann', 'müller', 'friseur', 'haarschnitt', 'barbier', 'nägel', 'douglas', 'zara', 'h&m', 'primark', 'c&a', 'bestellung', 'online bestellt', 'zalando', 'otto', 'schreibwaren', 'bürobedarf', 'haushalt', 'putzmittel', 'waschmittel', 'wäsche', 'reinigung', 'blumen', 'pflanzen', 'haustier', 'hund', 'katze', 'tierfutter', 'kinder', 'baby', 'windeln', 'schule', 'uni', 'universität', 'studiengebühren', 'kurs', 'schulbuch', 'schulsachen', 'tchibo', 'action'],
    subscriptions: ['abo', 'abos', 'abonnement', 'netflix', 'spotify', 'disney', 'disney plus', 'amazon prime', 'prime', 'apple music', 'youtube premium', 'icloud', 'google one', 'dropbox', 'chatgpt', 'claude', 'adobe', 'mitgliedschaft', 'patreon', 'zeitung', 'spiegel', 'zeit', 'sky', 'dazn', 'joyn', 'rtl+', 'wow', 'crunchyroll', 'twitch', 'verlängerung', 'monatsbeitrag', 'monatsabo', 'jahresabo', 'duolingo', 'game pass', 'ps plus', 'audible', 'kindle unlimited', 'readly'],
    debt: ['kreditkarte', 'kreditkartenrechnung', 'kredit', 'darlehen', 'ratenzahlung', 'rate', 'raten', 'schulden', 'zinsen', 'dispo', 'überziehung', 'klarna', 'ratenkauf', 'tilgung', 'mahngebühr', 'bafög rückzahlung', 'autokredit', 'kreditrate'],
    savings: ['sparen', 'gespart', 'ersparnisse', 'sparkonto', 'tagesgeld', 'festgeld', 'notgroschen', 'notfallfonds', 'investition', 'investiert', 'anlage', 'geldanlage', 'altersvorsorge', 'aktien', 'etf', 'etfs', 'sparplan', 'depot', 'krypto', 'bitcoin', 'zurückgelegt', 'beiseite gelegt', 'trade republic', 'scalable', 'bausparvertrag', 'riester', 'sparbuch', 'überweisung aufs sparkonto'],
    other_expense: ['gebühr', 'gebühren', 'kontogebühr', 'kontoführung', 'geldautomat', 'automat', 'bargeld', 'bar', 'spende', 'kirche', 'kirchensteuer', 'steuern', 'steuer', 'finanzamt', 'bußgeld', 'strafzettel', 'knöllchen', 'briefmarken', 'post', 'porto', 'paket', 'versand', 'sonstiges', 'andere', 'anderes', 'zeug', 'sachen', 'paypal', 'überweisung', 'versicherung', 'haftpflicht', 'lebensversicherung', 'kita', 'kindergarten', 'babysitter', 'tagesmutter', 'bildung', 'anwalt', 'notar', 'steuerberater', 'hochzeit', 'urlaub', 'reise', 'hotel', 'airbnb', 'hostel', 'unterkunft', 'ferienwohnung', 'trinkgeld', 'geschenk für', 'pfand'],
  },
  stopwords: ['der', 'die', 'das', 'den', 'dem', 'des', 'ein', 'eine', 'einen', 'einem', 'einer', 'und', 'oder', 'aber', 'für', 'von', 'vom', 'mit', 'ohne', 'zu', 'zum', 'zur', 'in', 'im', 'an', 'am', 'auf', 'bei', 'nach', 'über', 'ich', 'mich', 'mir', 'wir', 'uns', 'du', 'dich', 'dir', 'mein', 'meine', 'meinen', 'unser', 'unsere', 'es', 'ist', 'war', 'bin', 'habe', 'hab', 'hat', 'haben', 'heute', 'gestern', 'morgen', 'abend', 'nacht', 'woche', 'monat', 'jahr', 'ausgegeben', 'bezahlt', 'gezahlt', 'gekauft', 'ausgabe', 'kauf', 'euro', 'euros', 'dollar', 'jeder', 'jede', 'jedes', 'gesamt', 'nochmal', 'auch', 'dann', 'sehr', 'neu', 'neue', 'neuen', 'mehr', 'weniger', 'letzte', 'letzten', 'nächste', 'nächsten', 'ziel', 'sparen', 'gespart', 'hinzugefügt', 'gelegt', 'ins', 'gegangen', 'gehen', 'eins', 'zwei', 'drei', 'vier', 'fünf', 'sechs', 'sieben', 'acht', 'neun', 'zehn', 'eintrag', 'einnahme', 'geld', 'etwas', 'ding', 'wie', 'vor', 'noch', 'was', 'so', 'etwa', 'ungefähr', 'circa'],
  pastDateRules: [
    ISO_RULE,
    ...relativePastRules({
      today: ['heute', 'heute morgen', 'heute früh', 'heute mittag', 'heute abend', 'heute nachmittag', 'vorhin', 'eben'],
      yesterday: ['gestern', 'gestern abend', 'gestern morgen', 'gestern früh', 'gestern mittag', 'gestern nachmittag', 'gestern nacht', 'letzte nacht'],
      dayBeforeYesterday: ['vorgestern'],
      lastWeek: ['letzte woche', 'vorige woche', 'vergangene woche', 'in der letzten woche'],
      lastMonth: ['letzten monat', 'letzter monat', 'vorigen monat', 'vergangenen monat', 'im letzten monat'],
      daysAgo: /\bvor (\d+|einem|ein) tag(?:en)?\b/,
      weeksAgo: /\bvor (\d+|einer|eine) wochen?\b/,
      monthsAgo: /\bvor (\d+|einem|ein) monat(?:en)?\b/,
      oneWords: ['einem', 'ein', 'einer', 'eine'],
    }),
    dayMonthRule(MONTHS, { pre: ['am', 'den', 'vom'], ordinal: '\\.?' }),
    weekdayRule(WEEKDAYS),
    slashRule(true),
  ],
  futureDateRules: [
    ISO_RULE,
    ...relativeFutureRules({
      endOfYear: ['bis ende des jahres', 'bis jahresende', 'bis zum jahresende', 'ende des jahres', 'jahresende', 'bis ende dieses jahres', 'bis ende jahr', 'bis silvester'],
      endOfNextYear: ['bis ende nächstes jahr', 'bis ende nächsten jahres', 'ende nächsten jahres'],
      endOfMonth: ['bis ende des monats', 'bis monatsende', 'ende des monats', 'monatsende', 'bis zum monatsende', 'bis ende monat', 'bis ende dieses monats'],
      nextYear: ['nächstes jahr', 'bis nächstes jahr', 'im nächsten jahr', 'bis zum nächsten jahr'],
      nextMonth: ['nächsten monat', 'bis nächsten monat', 'im nächsten monat', 'bis zum nächsten monat'],
      christmas: ['bis weihnachten', 'vor weihnachten', 'zu weihnachten', 'weihnachten'],
      inDays: /\b(?:in|innerhalb von|innerhalb|binnen|in den nächsten|in den naechsten) (\d+|einem|ein) tag(?:en)?\b/,
      inWeeks: /\b(?:in|innerhalb von|innerhalb|binnen|in den nächsten|in den naechsten) (\d+|einer|eine) wochen?\b/,
      inMonths: /\b(?:in|innerhalb von|innerhalb|binnen|in den nächsten|in den naechsten) (\d+|einem|ein) monat(?:en)?\b/,
      inYears: /\b(?:in|innerhalb von|innerhalb|binnen|in den nächsten|in den naechsten) (\d+|einem|ein) jahr(?:en)?\b/,
      oneWords: ['einem', 'ein', 'einer', 'eine'],
      seasons: { spring: ['bis zum frühling', 'bis frühling', 'vor dem frühling'], summer: ['bis zum sommer', 'bis sommer', 'vor dem sommer', 'diesen sommer'], fall: ['bis zum herbst', 'bis herbst', 'vor dem herbst'], winter: ['bis zum winter', 'bis winter', 'vor dem winter'] },
    }),
    dayMonthRule(MONTHS, { pre: ['bis zum', 'bis', 'vor dem', 'am', 'zum', 'spätestens am', 'spätestens'], ordinal: '\\.?', future: true }),
    endOfYearRule(['bis ende', 'bis zum ende von', 'ende', 'bis spätestens ende']),
    byMonthRule(MONTHS, ['bis', 'bis ende', 'bis zum', 'im', 'vor', 'spätestens', 'bis spätestens', 'bis nächsten', 'bis nächstes', 'nächsten', 'nächstes']),
    byYearRule(['bis', 'vor', 'im', 'in']),
  ],
  goalLead: /^(?:ziel|sparziel|neues ziel|neues sparziel|(?:mach|mache|erstelle|erstell|lege|leg|setze|setz|ich will|ich möchte)(?: mir| uns)?(?: einen| ein| eine)?(?: neuen| neues| neue)? (?:plan|ziel|sparziel)(?: um| für| zum)?)\s*:?\s*/iu,
  goalIntent: /(?<![\p{L}])(?:ich will|ich möchte|ich muss|ich werde|ich würde gerne|ich wollte|wir wollen|wir möchten|sparen|zurücklegen|ansparen|zur seite legen|beiseite legen)(?![\p{L}])/iu,
  goalPastVerbs: /(?<![\p{L}])(?:gespart|zurückgelegt|eingezahlt|überwiesen|hinzugefügt|gelegt|getan|gepackt|geschoben|gebucht|bezahlt|abbezahlt|getilgt)(?![\p{L}])/iu,
  debtIntent: /(?<![\p{L}])(?:(?:ich will |ich möchte |ich moechte |ich muss |ich werde |wir wollen |wir müssen |wir muessen )?(?:abbezahlen|abzahlen|tilgen|zurückzahlen|zurueckzahlen|abbauen|loswerden|begleichen|schuldenfrei|abstottern))(?![\p{L}])/iu,
  debtWords: /(?<![\p{L}])(?:schulden|kredit|kreditkarte|darlehen|hypothek|dispo|ratenkredit|studienkredit|autokredit)(?![\p{L}])/iu,
  contributionVerbs: /(?<![\p{L}])(?:hinzugefügt|hinzufügen|gespart|zurückgelegt|eingezahlt|einzahlen|überwiesen|überweisen|gelegt|legen|lege|getan|tun|tue|gepackt|packen|packe|dazu|geschoben|schieben|draufgelegt|drauf gelegt)(?![\p{L}])/iu,
  contributionPreps: 'zu|zum|zur|auf|aufs|in|ins|für|für die|für das|für den|für mein|für meine|für meinen|zu meinem|zu meiner|auf mein|auf meine|auf das|auf die|auf den|in mein|in meine|in meinen|in das|in die|in den',
  forWords: 'für|für die|für das|für den|für einen|für eine|für ein|für mein|für meine|für meinen|für unsere|für unser|für unseren',
  goalWords: 'ziel|sparziel',
  articles: /^(?:(?:der|die|das|den|dem|ein|eine|einen|einem|einer|mein|meine|meinen|unser|unsere|neue|neuen|neues)\s+)+/,
  leadingFiller: /^(?:(?:ich|wir|habe|hab|haben|hat|heute|gestern|also|auch|nochmal|ausgegeben|bezahlt|gezahlt|gekauft|ausgabe|kauf|für|von|vom|mit|zu|zum|zur|in|im|an|am|auf|bei|beim|der|die|das|den|dem|ein|eine|einen|einem|einer|mein|meine|meinen|mir|mich|uns|etwa|ungefähr|circa|ca|noch|einmal|so|mal|grad|gerade|eben)\s+)+/,
  trailingFiller: /(?:\s+(?:heute|gestern|für|von|mit|zu|zum|zur|in|im|an|am|auf|bei|der|die|das|den|ein|eine|und|jeder|jede|gesamt|nochmal|auch|bitte|danke|es|dies|ausgegeben|bezahlt|gezahlt|gekauft|gekostet|gegangen|gewesen|geholt|bestellt|etwa|ungefähr|circa|ca|rum|so))+$/,
  noteStrip: [],
  listSeparators: [',', ';', 'und', 'plus', 'dann', 'und dann', 'außerdem', 'und noch', 'sowie'],
  reminder: {
    lead: /(?<![\p{L}])(?:(?:kannst du |könntest du |koenntest du |bitte )?(?:erinnere mich|erinner mich|erinnere uns|erinnerung|stell eine erinnerung|stelle eine erinnerung|erstell eine erinnerung|erstelle eine erinnerung|mach eine erinnerung|leg eine erinnerung an|ich brauche eine erinnerung|ich will eine erinnerung|sag mir bescheid|lass mich nicht vergessen|denk für mich dran|erinnere mich bitte|erinner mich bitte))(?![\p{L}])(?:\s+(?:daran|dran|an|zu|dass|um|für))?\s*,?\s*:?/iu,
    time: [
      clockRule(['um', 'gegen', 'so gegen', 'ab', 'bis'], { suffix: 'uhr', dayParts: { morgens: 0, früh: 0, frueh: 0, vormittags: 0, mittags: 12, nachmittags: 12, abends: 12, nachts: 12 } }),
      ...wordTimeRules({ morning: ['morgens', 'am morgen', 'in der früh', 'in der frueh', 'früh', 'frueh', 'vormittags', 'am vormittag', 'gleich morgens'], noon: ['mittags', 'am mittag', 'zur mittagszeit', 'zum mittag'], afternoon: ['nachmittags', 'am nachmittag'], evening: ['abends', 'am abend', 'heute abend', 'nachts', 'vor dem schlafen'] }, { morning: 8, noon: 12, afternoon: 15, evening: 19 }),
    ],
    repeat: [
      weeklyOnRule(['jeden', 'jede', 'jedes', 'immer am', 'immer'], WEEKDAYS.names, { suffix: ['s'] }),
      { re: /(?<![\p{L}])(montags|dienstags|mittwochs|donnerstags|freitags|samstags|sonntags)(?![\p{L}])/iu, repeat: 'weekly', weekday: (m) => ({ montags: 1, dienstags: 2, mittwochs: 3, donnerstags: 4, freitags: 5, samstags: 6, sonntags: 0 } as Record<string, number>)[m[1].toLowerCase()] ?? null },
      monthlyOnRule(/(?<![\p{L}])(?:am |jeden |immer am )?(\d{1,2}\.?|ersten|monatsersten) (?:jeden|jedes|des|im) monats?(?![\p{L}])/iu, { ersten: 1, monatsersten: 1 }),
      repeatWords(['jeden morgen', 'jeden vormittag', 'allmorgendlich'], 'daily', 8),
      repeatWords(['jeden abend', 'jede nacht', 'allabendlich'], 'daily', 20),
      repeatWords(['jeden nachmittag'], 'daily', 15),
      repeatWords(['jeden tag', 'täglich', 'taeglich', 'tagtäglich', 'alle tage'], 'daily'),
      repeatWords(['jede woche', 'wöchentlich', 'woechentlich', 'alle wochen', 'einmal die woche', 'einmal pro woche'], 'weekly'),
      repeatWords(['jeden monat', 'monatlich', 'alle monate', 'einmal im monat', 'am monatsanfang', 'jeden monatsersten', 'am ersten jeden monats'], 'monthly'),
    ],
    day: [
      ISO_RULE,
      dayWords(['übermorgen', 'uebermorgen'], 2),
      dayWords(['morgen'], 1),
      dayWords(['heute', 'heute abend', 'heute nachmittag', 'heute nacht', 'heute früh', 'heute frueh'], 0),
      futureWeekdayRule(WEEKDAYS.names, { pre: ['nächsten', 'naechsten', 'nächste', 'naechste', 'kommenden', 'am', 'diesen', 'am nächsten', 'am naechsten', 'am kommenden', 'bis'], nextWords: ['nächst', 'naechst', 'kommend'] }),
      dayMonthRule(MONTHS, { pre: ['am', 'zum', 'bis zum', 'bis'], ordinal: '\\.?', future: true }),
    ],
    dayLate: [futureDayOfMonthRule(/(?<![\p{L}])(?:am|zum|bis zum) (\d{1,2}\.|ersten)(?![\p{N}])(?!\s*(?:uhr|jeden|jedes|des))/iu, { ersten: 1 })],
    strip: [/^(?:(?:daran|dran|an den|an die|an das|an|zu|dass|um|für|bitte|ich muss|ich soll|ich sollte|dass ich|und)\s*,?\s+)+/iu, /(?:\s+(?:bitte|danke|zu erinnern|erinnern|soll|muss|sollte))+$/iu],
  },
  contextualStrings: ['Euro', 'Einkauf', 'Miete', 'Gehalt', 'Ziel', 'Netflix', 'Uber', 'Mittagessen'],
};
