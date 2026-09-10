import type { TxType } from '@/types';

/** A date rule: regex over normalized text, resolver returns YYYY-MM-DD or null. */
export interface DateRule {
  re: RegExp;
  resolve: (m: RegExpMatchArray, todayStr: string) => string | null;
}

/**
 * Everything the parser needs to understand one language. Packs are plain
 * data plus a few small functions, so adding a language is one file.
 */
export interface LanguagePack {
  code: string;
  /** BCP-47 tag handed to the speech recognizer. */
  speechTag: string;
  /** 'space' languages split on whitespace; 'cjk' languages are matched by substring. */
  tokenizer: 'space' | 'cjk';
  /** True when "12,50" means twelve and a half. */
  decimalComma: boolean;
  /** Turns spoken number words into digits ("twelve" -> "12"). Runs after normalize(). */
  numberWords: (text: string) => string;
  /** Currency symbols/words that mark a number as money. */
  currencyMarkers: RegExp;
  /** Words that should be dropped from notes. */
  currencyWords: RegExp;
  incomeVerbs: string[];
  expenseVerbs: string[];
  /** category id -> keywords/phrases (lowercase). */
  keywords: Record<string, string[]>;
  stopwords: string[];
  pastDateRules: DateRule[];
  futureDateRules: DateRule[];
  /** "goal:" style lead-ins at the start of the phrase. */
  goalLead: RegExp;
  /** "I want to save", "save up" ... */
  goalIntent: RegExp;
  /** Past-tense saving verbs that turn a phrase into a contribution rather than a new goal. */
  goalPastVerbs: RegExp;
  /** Verbs that mean "add money to a goal". */
  contributionVerbs: RegExp;
  /** Prepositions that introduce the goal name: "to|toward|into|for". Must be a capturing-friendly alternation without groups. */
  contributionPreps: string;
  /** Word(s) meaning "for" that introduce a goal's name. */
  forWords: string;
  /** Words meaning "goal" that may trail a name. */
  goalWords: string;
  /** Words stripped from the start of a goal name. */
  articles: RegExp;
  /** Filler stripped from the start / end of a note. */
  leadingFiller: RegExp;
  trailingFiller: RegExp;
  /** Extra patterns removed from notes (CJK particles, etc.). */
  noteStrip: RegExp[];
  /** Words that flag a plural/singular variant lookup (space tokenizer only). */
  singularForms?: (word: string) => string[];
  /** Short phrases the recognizer should bias toward. */
  contextualStrings: string[];
}

export type KeywordEntry = { categoryId: string; kind: TxType };
