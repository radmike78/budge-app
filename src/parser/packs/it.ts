import { ISO_RULE, byMonthRule, byYearRule, endOfYearRule, dayMonthRule, relativeFutureRules, relativePastRules, slashRule, weekdayRule } from '../dateRules';
import { makeNumberWords } from '../numbers';
import type { LanguagePack } from '../types';
import { clockRule, dayWords, futureDayOfMonthRule, futureWeekdayRule, monthlyOnRule, repeatWords, weeklyOnRule, wordTimeRules } from '../reminderRules';

const MONTHS = { names: { gennaio: 0, gen: 0, febbraio: 1, feb: 1, marzo: 2, mar: 2, aprile: 3, apr: 3, maggio: 4, mag: 4, giugno: 5, giu: 5, luglio: 6, lug: 6, agosto: 7, ago: 7, settembre: 8, set: 8, sett: 8, ottobre: 9, ott: 9, novembre: 10, nov: 10, dicembre: 11, dic: 11 } };
const WEEKDAYS = { names: { domenica: 0, lunedì: 1, lunedi: 1, martedì: 2, martedi: 2, mercoledì: 3, mercoledi: 3, giovedì: 4, giovedi: 4, venerdì: 5, venerdi: 5, sabato: 6 }, lastAfter: ['scorso', 'scorsa'], prefixes: ['il', 'la', 'questo', 'questa'] };

// Italian glues tens and units together ("venticinque"); build the table programmatically.
const TENS: [string, number][] = [['venti', 20], ['trenta', 30], ['quaranta', 40], ['cinquanta', 50], ['sessanta', 60], ['settanta', 70], ['ottanta', 80], ['novanta', 90]];
const UNITS_G: [string, number][] = [['uno', 1], ['due', 2], ['tre', 3], ['tré', 3], ['quattro', 4], ['cinque', 5], ['sei', 6], ['sette', 7], ['otto', 8], ['nove', 9]];
const units: Record<string, number> = { zero: 0, uno: 1, un: 1, una: 1, due: 2, tre: 3, quattro: 4, cinque: 5, sei: 6, sette: 7, otto: 8, nove: 9, dieci: 10, undici: 11, dodici: 12, tredici: 13, quattordici: 14, quindici: 15, sedici: 16, diciassette: 17, diciotto: 18, diciannove: 19 };
for (const [t, tv] of TENS) {
  for (const [u, uv] of UNITS_G) {
    const stem = uv === 1 || uv === 8 ? t.slice(0, -1) : t; // ventuno, ventotto
    units[stem + u] = tv + uv;
  }
}
const hundreds: Record<string, number> = { duecento: 200, trecento: 300, quattrocento: 400, cinquecento: 500, seicento: 600, settecento: 700, ottocento: 800, novecento: 900 };

const numberWords = makeNumberWords({
  units,
  tens: Object.fromEntries(TENS),
  hundred: ['cento'],
  hundreds,
  thousand: ['mille', 'mila'],
  million: ['milione', 'milioni'],
  connectors: ['e'],
  one: ['un', 'uno', 'una'],
  pre: (t) => t.replace(/(\p{L})(cento|mille|mila)(?=\p{L})/gu, '$1 $2 ').replace(/(\p{L}+)(cento|mille|mila)\b/gu, (m, a: string, b: string) => (a in units || a in hundreds ? `${a} ${b}` : m)).replace(/\b(cento|mille|mila)(?=\p{L})/gu, '$1 '),
});

export const it: LanguagePack = {
  code: 'it',
  speechTag: 'it-IT',
  tokenizer: 'space',
  decimalComma: true,
  numberWords,
  currencyMarkers: /€|\$|euro|euri|dollari|dollaro|usd|eur|chf|franchi/i,
  currencyWords: /(?<![\p{L}])(?:euro|euri|dollari|dollaro|usd|eur|chf|franchi|centesimi|centesimo)(?![\p{L}])/giu,
  incomeVerbs: ['ho ricevuto', 'ricevuto', 'ricevuti', 'stipendio', 'busta paga', 'mi hanno pagato', 'mi ha pagato', 'sono stato pagato', 'guadagnato', 'guadagnati', 'incassato', 'incassati', 'rimborso', 'rimborsato', 'rimborsati', 'entrata', 'entrate', 'bonus', 'premio', 'commissione', 'venduto', 'venduti', 'mance', 'mancia', 'regalo da', 'mi ha dato', 'mi hanno dato', 'mi ha mandato', 'mi hanno mandato', 'bonifico ricevuto', 'pensione', 'accredito', 'accreditato', 'mi ha restituito', 'mi hanno restituito', 'restituito', 'tredicesima', 'quattordicesima', 'borsa di studio', 'dividendi'],
  expenseVerbs: ['ho speso', 'speso', 'spesi', 'ho pagato', 'pagato', 'pagati', 'ho comprato', 'comprato', 'comprati', 'spesa', 'acquisto', 'acquistato', 'costato', 'costa', 'costati', 'ordinato', 'preso', 'presi', 'donato', 'prestato', 'prelevato', 'mandato', 'inviato', 'bolletta', 'ho dato', 'dato', 'messo', 'speso per', 'pago', 'compro', 'spendo', 'offerto', 'versato'],
  keywords: {
    salary: ['stipendio', 'busta paga', 'paga', 'salario', 'mensilità', 'tredicesima', 'quattordicesima'],
    freelance: ['freelance', 'partita iva', 'cliente', 'fattura pagata', 'fattura incassata', 'lavoretto', 'lavoro extra', 'consulenza', 'commissione', 'ripetizioni', 'venduto', 'vendita', 'vinted', 'subito', 'mance', 'mancia', 'upwork', 'fiverr'],
    gift_income: ['regalo da', 'mi ha regalato', 'mi hanno regalato', 'mi ha dato', 'mi hanno dato', 'soldi di compleanno', 'da mia madre', 'da mio padre', 'da mamma', 'da papà', 'dalla nonna', 'dal nonno', 'paghetta'],
    other_income: ['rimborso', 'rimborsato', 'cashback', 'interessi', 'dividendi', 'bonus', 'premio', 'rimborso 730', 'rimborso tasse', 'vinto', 'lotteria', 'gratta e vinci', 'pensione', 'borsa di studio', 'sussidio', 'naspi', 'disoccupazione', 'assegno unico', 'mi ha restituito', 'restituito', 'bonifico da', 'satispay da', 'paypal da'],
    groceries: ['spesa', 'supermercato', 'supermarket', 'mercato', 'alimentari', 'esselunga', 'coop', 'conad', 'carrefour', 'lidl', 'eurospin', 'pam', 'despar', 'md', 'iper', 'ipercoop', 'penny', 'frutta', 'verdura', 'pane', 'latte', 'uova', 'carne', 'pesce', 'formaggio', 'macellaio', 'macelleria', 'panificio', 'panetteria', 'fruttivendolo', 'pescheria', 'salumeria', 'cibo per casa', 'generi alimentari'],
    dining: ['pranzo', 'cena', 'colazione', 'merenda', 'brunch', 'caffè', 'caffe', 'bar', 'ristorante', 'trattoria', 'osteria', 'pizzeria', 'pizza', 'aperitivo', 'aperitivi', 'apericena', 'birra', 'birre', 'vino', 'drink', 'cocktail', 'panino', 'gelato', 'dolce', 'sushi', 'kebab', 'hamburger', 'mangiato', 'mangiare fuori', 'delivery', 'glovo', 'deliveroo', 'just eat', 'uber eats', 'mcdonald', 'mcdonalds', 'burger king', 'starbucks', 'tavola calda', 'cornetto', 'brioche', 'spuntino', 'pausa pranzo', 'mensa', 'bevande', 'spritz', 'pizzata', 'cena fuori'],
    rent: ['affitto', 'mutuo', 'padrone di casa', 'proprietario', 'condominio', 'spese condominiali', 'appartamento', 'assicurazione casa', 'caparra', 'canone di locazione', 'imu', 'agenzia immobiliare'],
    utilities: ['bolletta', 'bollette', 'luce', 'elettricità', 'enel', 'gas', 'acqua', 'internet', 'wifi', 'fibra', 'telefono', 'cellulare', 'tim', 'vodafone', 'wind', 'windtre', 'iliad', 'fastweb', 'ho mobile', 'riscaldamento', 'energia', 'tari', 'rifiuti', 'canone rai', 'utenze', 'bolletta della luce', 'bolletta del gas', 'bolletta dell\'acqua', 'ricarica telefonica'],
    transport: ['benzina', 'carburante', 'gasolio', 'diesel', 'pieno', 'uber', 'taxi', 'treno', 'trenitalia', 'italo', 'metro', 'metropolitana', 'autobus', 'bus', 'pullman', 'tram', 'biglietto', 'biglietti', 'abbonamento trasporti', 'abbonamento atm', 'pedaggio', 'autostrada', 'telepass', 'parcheggio', 'macchina', 'auto', 'assicurazione auto', 'bollo', 'bollo auto', 'meccanico', 'gomme', 'tagliando', 'revisione', 'volo', 'aereo', 'ryanair', 'easyjet', 'biglietto aereo', 'noleggio auto', 'bici', 'bicicletta', 'monopattino', 'blablacar', 'viaggio in treno', 'autolavaggio', 'multa parcheggio', 'car sharing', 'enjoy', 'share now'],
    health: ['medico', 'dottore', 'dottoressa', 'dentista', 'farmacia', 'ricetta', 'medicine', 'medicina', 'farmaci', 'farmaco', 'ospedale', 'clinica', 'visita', 'visita medica', 'ticket sanitario', 'ticket', 'terapia', 'psicologo', 'psicologa', 'palestra', 'sport', 'yoga', 'pilates', 'vitamine', 'integratori', 'occhiali', 'ottico', 'lenti', 'osteopata', 'fisioterapia', 'fisioterapista', 'veterinario', 'massaggio', 'salute', 'analisi', 'esami', 'nutrizionista'],
    entertainment: ['cinema', 'film', 'concerto', 'biglietti concerto', 'teatro', 'spettacolo', 'gioco', 'giochi', 'videogioco', 'videogiochi', 'steam', 'playstation', 'xbox', 'nintendo', 'bowling', 'museo', 'mostra', 'parco', 'parco divertimenti', 'gardaland', 'serata', 'discoteca', 'karaoke', 'libro', 'libri', 'fumetti', 'hobby', 'uscita', 'partita', 'calcio', 'stadio', 'escape room', 'divertimento', 'sagra', 'festival', 'biliardo', 'calcetto'],
    shopping: ['amazon', 'vestiti', 'abbigliamento', 'scarpe', 'sneakers', 'camicia', 'maglietta', 'pantaloni', 'jeans', 'vestito', 'giacca', 'cappotto', 'shopping', 'negozio', 'centro commerciale', 'ikea', 'mobili', 'arredamento', 'decorazioni', 'leroy merlin', 'brico', 'bricolage', 'ferramenta', 'elettronica', 'mediaworld', 'unieuro', 'cuffie', 'auricolari', 'telefono nuovo', 'computer', 'caricatore', 'caricabatterie', 'regalo', 'regali', 'giocattoli', 'giocattolo', 'trucco', 'trucchi', 'cosmetici', 'parrucchiere', 'parrucchiera', 'taglio', 'barbiere', 'unghie', 'estetista', 'sephora', 'zara', 'h&m', 'oviesse', 'ordine', 'ordine online', 'cartoleria', 'casa', 'pulizie', 'detersivi', 'lavanderia', 'tintoria', 'fiori', 'piante', 'animale', 'animali', 'cane', 'gatto', 'crocchette', 'bambini', 'bimbo', 'bimba', 'pannolini', 'scuola', 'università', 'tasse universitarie', 'corso', 'lezione', 'libri di testo', 'decathlon', 'tiger', 'zalando'],
    subscriptions: ['abbonamento', 'abbonamenti', 'netflix', 'spotify', 'dazn', 'sky', 'now tv', 'now', 'disney', 'disney plus', 'amazon prime', 'prime', 'apple music', 'youtube premium', 'icloud', 'google one', 'dropbox', 'chatgpt', 'claude', 'adobe', 'iscrizione', 'patreon', 'giornale', 'corriere', 'repubblica', 'crunchyroll', 'twitch', 'rinnovo', 'canone mensile', 'piano mensile', 'piano annuale', 'duolingo', 'game pass', 'ps plus', 'tessera', 'quota'],
    debt: ['carta di credito', 'carta', 'prestito', 'finanziamento', 'rata', 'rate', 'debito', 'debiti', 'interessi', 'scoperto', 'klarna', 'scalapay', 'rata del prestito', 'rata dell\'auto', 'cessione del quinto', 'prestito personale'],
    savings: ['risparmio', 'risparmi', 'bonifico', 'conto deposito', 'fondo emergenza', 'fondo di emergenza', 'investimento', 'investito', 'investimenti', 'pensione integrativa', 'fondo pensione', 'azioni', 'borsa', 'crypto', 'bitcoin', 'messo da parte', 'conto risparmio', 'etf', 'pac', 'buoni postali', 'salvadanaio', 'trade republic', 'moneyfarm'],
    other_expense: ['commissione', 'commissioni', 'bancomat', 'prelievo', 'contanti', 'donazione', 'beneficenza', 'chiesa', 'offerta', 'tasse', 'imposta', 'imposte', 'f24', 'multa', 'francobolli', 'poste', 'spedizione', 'pacco', 'varie', 'altro', 'altre', 'roba', 'prestato', 'satispay', 'paypal', 'assicurazione', 'assicurazione vita', 'asilo', 'nido', 'babysitter', 'istruzione', 'avvocato', 'notaio', 'commercialista', 'matrimonio', 'vacanza', 'vacanze', 'viaggio', 'hotel', 'albergo', 'airbnb', 'ostello', 'b&b', 'alloggio', 'regalo di nozze', 'mancia'],
  },
  stopwords: ['il', 'lo', 'la', 'i', 'gli', 'le', 'un', 'uno', 'una', 'di', 'del', 'della', 'dei', 'delle', 'degli', 'dello', 'a', 'al', 'alla', 'ai', 'alle', 'in', 'nel', 'nella', 'per', 'con', 'senza', 'e', 'o', 'ma', 'che', 'chi', 'io', 'mi', 'me', 'tu', 'ti', 'noi', 'ci', 'voi', 'vi', 'mio', 'mia', 'miei', 'mie', 'tuo', 'tua', 'suo', 'sua', 'nostro', 'nostra', 'questo', 'questa', 'questi', 'queste', 'oggi', 'ieri', 'domani', 'sera', 'mattina', 'settimana', 'mese', 'anno', 'speso', 'pagato', 'comprato', 'acquisto', 'euro', 'euri', 'dollari', 'ogni', 'totale', 'ancora', 'anche', 'allora', 'molto', 'nuovo', 'nuova', 'più', 'meno', 'ultimo', 'ultima', 'prossimo', 'prossima', 'obiettivo', 'meta', 'risparmiare', 'risparmiato', 'messo', 'aggiunto', 'verso', 'dentro', 'andato', 'andare', 'due', 'tre', 'quattro', 'cinque', 'sei', 'sette', 'otto', 'nove', 'dieci', 'voce', 'uscita', 'entrata', 'soldi', 'qualcosa', 'cosa', 'come', 'fa', 'ho', 'hai', 'ha', 'circa'],
  pastDateRules: [
    ISO_RULE,
    ...relativePastRules({
      today: ['oggi', 'stamattina', 'stasera', 'stanotte', 'oggi pomeriggio', 'questa mattina', 'questa sera', 'a pranzo oggi'],
      yesterday: ['ieri', 'ieri sera', 'ieri mattina', 'ieri pomeriggio', 'ieri notte', 'ierisera'],
      dayBeforeYesterday: ["l'altro ieri", "l'altroieri", 'altro ieri', "ieri l'altro"],
      lastWeek: ['la settimana scorsa', 'settimana scorsa', 'la scorsa settimana'],
      lastMonth: ['il mese scorso', 'mese scorso', 'lo scorso mese'],
      daysAgo: /\b(\d+|un) giorn[oi] fa\b/,
      weeksAgo: /\b(\d+|una) settiman[ae] fa\b/,
      monthsAgo: /\b(\d+|un) mes[ei] fa\b/,
      oneWords: ['un', 'una'],
    }),
    dayMonthRule(MONTHS, { pre: ['il', "l'", 'lo scorso'] }),
    weekdayRule(WEEKDAYS),
    slashRule(true),
  ],
  futureDateRules: [
    ISO_RULE,
    ...relativeFutureRules({
      endOfYear: ['entro fine anno', "entro la fine dell'anno", 'per fine anno', 'fine anno', 'a fine anno', "entro l'anno", "fine dell'anno"],
      endOfNextYear: ["entro la fine dell'anno prossimo", "fine dell'anno prossimo", 'entro fine anno prossimo'],
      endOfMonth: ['entro fine mese', 'fine mese', 'a fine mese', 'per fine mese', 'entro la fine del mese', 'entro il mese'],
      nextYear: ["l'anno prossimo", "entro l'anno prossimo", "per l'anno prossimo", "il prossimo anno", "entro il prossimo anno"],
      nextMonth: ['il mese prossimo', 'entro il mese prossimo', 'per il mese prossimo', 'il prossimo mese', 'entro il prossimo mese'],
      christmas: ['per natale', 'entro natale', 'prima di natale', 'natale'],
      inDays: /\b(?:tra|fra|in|entro|nei prossimi|durante i prossimi) (\d+|un) giorn[oi]\b/,
      inWeeks: /\b(?:tra|fra|in|entro|nelle prossime|durante le prossime) (\d+|una) settiman[ae]\b/,
      inMonths: /\b(?:tra|fra|in|entro|nei prossimi|durante i prossimi) (\d+|un) mes[ei]\b/,
      inYears: /\b(?:tra|fra|in|entro|nei prossimi|durante i prossimi) (\d+|un) ann[oi]\b/,
      oneWords: ['un', 'una'],
      seasons: { spring: ['per la primavera', 'entro la primavera', 'prima della primavera'], summer: ["per l'estate", "entro l'estate", "prima dell'estate", "quest'estate"], fall: ["per l'autunno", "entro l'autunno", "prima dell'autunno"], winter: ["per l'inverno", "entro l'inverno", "prima dell'inverno"] },
    }),
    dayMonthRule(MONTHS, { pre: ['entro il', 'per il', 'prima del', 'il', 'entro', 'per', "entro l'", "l'"], future: true }),
    endOfYearRule(['entro fine', 'entro la fine del', 'per fine', 'a fine', 'entro il']),
    byMonthRule(MONTHS, ['entro', 'per', 'prima di', 'a', 'entro fine', 'per fine', 'entro il prossimo', 'il prossimo', 'per il prossimo']),
    byYearRule(['entro', 'per', 'prima del', 'nel']),
  ],
  goalLead: /^(?:obiettivo|meta|nuovo obiettivo|obiettivo di risparmio|(?:fai|fare|crea|creare|voglio|vorrei|fissa|fissare|imposta|impostare)(?: un| una)?(?: nuovo| nuova)? (?:piano|obiettivo|meta)(?: per| di)?)\s*:?\s*/iu,
  goalIntent: /(?<![\p{L}])(?:voglio risparmiare|vorrei risparmiare|devo risparmiare|voglio mettere da parte|voglio mettere via|vorrei mettere da parte|risparmiare|mettere da parte|mettere via|accantonare)(?![\p{L}])/iu,
  goalPastVerbs: /(?<![\p{L}])(?:risparmiato|risparmiati|messo|messi|aggiunto|aggiunti|trasferito|trasferiti|versato|versati|spostato|spostati|depositato|depositati|accantonato|pagato|estinto|ripagato)(?![\p{L}])/iu,
  debtIntent: /(?<![\p{L}])(?:(?:voglio |vorrei |devo |ho intenzione di |vogliamo |dobbiamo |intendo )?(?:estinguere|ripagare|saldare|ridurre|azzerare|liberarmi d[ai]|uscire d[ai]|finire di pagare|senza debiti))(?![\p{L}])/iu,
  debtWords: /(?<![\p{L}])(?:debit[oi]|carta di credito|prestit[oi]|mutuo|finanziamento|scoperto|rate)(?![\p{L}])/iu,
  contributionVerbs: /(?<![\p{L}])(?:aggiung(?:i|o|ere)|aggiunt[oi]|mess[oi]|metto|metti|mettere|risparmiat[oi]|trasferit[oi]|trasferisco|trasferisci|versat[oi]|verso|versa|spostat[oi]|sposto|deposit(?:o|a|ato|ati)|accantonat[oi])(?![\p{L}])/iu,
  contributionPreps: 'a|al|alla|allo|per|verso|in|nel|nella|nello|su|sul|sulla|sullo|per il|per la|per lo',
  forWords: 'per|per il|per la|per un|per una|per lo|per le|per i|per gli|per mio|per mia|per i miei',
  goalWords: 'obiettivo|meta',
  articles: /^(?:(?:il|lo|la|i|gli|le|un|uno|una|mio|mia|nostro|nostra|nuovo|nuova)\s+|l'|un')+/,
  leadingFiller: /^(?:(?:ho|hai|ha|oggi|ieri|beh|anche|ancora|speso|pagato|comprato|spesa|acquisto|preso|in|di|del|della|dei|delle|per|con|a|al|alla|il|lo|la|i|gli|le|un|uno|una|mio|mia|mi|ci|circa|più o meno|tipo|quasi|un altro|un'altra)\s+|(?:l'|d'|un'|dell'|all')(?=\p{L}))+/u,
  trailingFiller: /(?:\s+(?:oggi|ieri|in|di|del|della|per|con|a|al|alla|il|lo|la|i|gli|le|un|uno|una|e|ogni|totale|ancora|anche|per favore|grazie|questo|questa|quello|circa|più o meno))+$/u,
  noteStrip: [],
  listSeparators: [',', ';', 'e', 'ed', 'più', 'poi', 'e poi', 'e anche', 'anche'],
  reminder: {
    lead: /(?<![\p{L}])(?:(?:puoi |potresti |per favore )?(?:ricordami|ricordarmi|ricordaci|mi ricordi|metti un promemoria|mettere un promemoria|mettimi un promemoria|crea un promemoria|aggiungi un promemoria|voglio un promemoria|ho bisogno di un promemoria|promemoria|avvisami|avvisarmi|non farmi dimenticare|fammi ricordare))(?![\p{L}])(?:\s+(?:di|che|per|a|su))?\s*:?/iu,
    time: [
      clockRule(['alle', 'alle ore', "all'", 'verso le', 'per le', 'entro le'], { dayParts: { 'di mattina': 0, 'del mattino': 0, 'di pomeriggio': 12, 'del pomeriggio': 12, 'di sera': 12, 'della sera': 12, 'di notte': 12 } }),
      ...wordTimeRules({ morning: ['di mattina', 'la mattina', 'in mattinata', 'stamattina', 'appena sveglio'], noon: ['a mezzogiorno', 'mezzogiorno', 'a pranzo', "all'ora di pranzo"], afternoon: ['nel pomeriggio', 'di pomeriggio', 'oggi pomeriggio', 'il pomeriggio'], evening: ['stasera', 'di sera', 'la sera', 'in serata', 'stanotte', 'prima di dormire'] }, { morning: 8, noon: 12, afternoon: 15, evening: 19 }),
    ],
    repeat: [
      weeklyOnRule(['ogni', 'tutti i', 'il', 'tutte le', 'la'], WEEKDAYS.names),
      monthlyOnRule(/(?<![\p{L}])(?:il |ogni )?(\d{1,2}|primo) di ogni mese(?![\p{L}])/iu, { primo: 1 }),
      repeatWords(['ogni mattina', 'tutte le mattine'], 'daily', 8),
      repeatWords(['ogni sera', 'tutte le sere', 'ogni notte', 'tutte le notti'], 'daily', 20),
      repeatWords(['ogni pomeriggio', 'tutti i pomeriggi'], 'daily', 15),
      repeatWords(['ogni giorno', 'tutti i giorni', 'giornalmente', 'quotidianamente'], 'daily'),
      repeatWords(['ogni settimana', 'tutte le settimane', 'settimanalmente', 'una volta a settimana'], 'weekly'),
      repeatWords(['ogni mese', 'tutti i mesi', 'mensilmente', 'una volta al mese', 'a inizio mese', "all'inizio di ogni mese"], 'monthly'),
    ],
    day: [
      ISO_RULE,
      dayWords(['dopodomani', 'dopo domani'], 2),
      dayWords(['domani'], 1),
      dayWords(['oggi', 'stasera', 'stamattina', 'oggi pomeriggio', 'stanotte'], 0),
      futureWeekdayRule(WEEKDAYS.names, { pre: ['il prossimo', 'prossimo', 'questo', 'il', 'la prossima', 'la'], suffix: ['prossimo', 'prossima'], nextWords: ['prossimo', 'prossima'] }),
      dayMonthRule(MONTHS, { pre: ['il', 'per il', 'entro il', "l'"], future: true }),
    ],
    dayLate: [futureDayOfMonthRule(/(?<![\p{L}])(?:il|per il|entro il) (\d{1,2}|primo)(?![\p{L}\p{N}:])/iu, { primo: 1 })],
    strip: [/^(?:(?:di|che|per|a|su|e|per favore|devo|dovrei|bisogna|che devo)\s+)+/iu, /(?:\s+(?:per favore|grazie))+$/iu],
  },
  contextualStrings: ['euro', 'spesa', 'affitto', 'stipendio', 'obiettivo', 'Netflix', 'Uber', 'pranzo'],
};
