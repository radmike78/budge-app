import type { Category, Goal, TxType } from '@/types';
import { FALLBACK_EXPENSE_CATEGORY_ID, FALLBACK_INCOME_CATEGORY_ID } from '@/lib/defaultCategories';
import { applyRules } from './dateRules';
import { normalizeDecimalComma } from './numbers';
import { getPack } from './packs';
import type { LanguagePack } from './types';

export type ParseKind = 'transaction' | 'goal' | 'contribution' | 'unknown';

export interface ParseResult {
  kind: ParseKind;
  raw: string;
  amount: number | null;
  type: TxType;
  typeConfidence: number;
  categoryId: string | null;
  categoryConfidence: number;
  note: string | null;
  /** YYYY-MM-DD */
  occurredAt: string;
  dateExplicit: boolean;
  /** Goal creation */
  goalName: string | null;
  targetDate: string | null;
  /** Contribution to an existing goal */
  goalId: string | null;
  /** 0..1 overall confidence in the parse */
  confidence: number;
  /** True when the app should ask the user to check the result more carefully (or escalate to Tier 2). */
  needsReview: boolean;
  /** Hint keys shown on the confirmation card (translated by the UI). */
  hints: string[];
}

export interface ParseContext {
  categories: Category[];
  goals: Goal[];
  /** Learned word -> categoryId mappings (user corrections). */
  keywordMap: Record<string, string>;
  /** YYYY-MM-DD */
  today: string;
  /** Language code ('en', 'es', ...). Defaults to English. */
  language?: string;
}

/** Hint identifiers; the UI maps these to translated sentences. */
export const HINT = {
  noAmount: 'hint.noAmount',
  multipleNumbers: 'hint.multipleNumbers',
  unsureCategory: 'hint.unsureCategory',
  assumedExpense: 'hint.assumedExpense',
  assumedIncome: 'hint.assumedIncome',
  goalAmount: 'hint.goalAmount',
  goalName: 'hint.goalName',
  goalNoDate: 'hint.goalNoDate',
  contributionAmount: 'hint.contributionAmount',
  stillNoAmount: 'hint.stillNoAmount',
  assistUnavailable: 'hint.assistUnavailable',
} as const;

const WB_START = '(?<![\\p{L}\\p{N}])';
const WB_END = '(?![\\p{L}\\p{N}])';

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Longest alternatives first so "got paid" beats "paid". */
function altRegex(list: string[], boundaries: boolean): RegExp {
  const sorted = [...list].sort((a, b) => b.length - a.length).map(escapeRegex);
  const body = `(?:${sorted.join('|')})`;
  return new RegExp(boundaries ? `${WB_START}${body}${WB_END}` : body, 'iu');
}

interface Compiled {
  pack: LanguagePack;
  incomeRe: RegExp;
  expenseRe: RegExp;
  keywordIndex: Map<string, { categoryId: string; kind: TxType }>;
  keywordPhrases: string[]; // sorted longest first (for cjk)
  maxPhraseWords: number;
  stopwords: Set<string>;
}

const INCOME_IDS = new Set(['salary', 'freelance', 'gift_income', 'other_income']);
const cache = new Map<string, Compiled>();

function compile(pack: LanguagePack): Compiled {
  const cached = cache.get(pack.code);
  if (cached) return cached;
  const boundaries = pack.tokenizer === 'space';
  const keywordIndex = new Map<string, { categoryId: string; kind: TxType }>();
  let maxPhraseWords = 1;
  for (const [categoryId, words] of Object.entries(pack.keywords)) {
    const kind: TxType = INCOME_IDS.has(categoryId) ? 'income' : 'expense';
    for (const raw of words) {
      const w = pack.tokenizer === 'cjk' ? raw.replace(/\s+/g, '') : raw;
      if (!keywordIndex.has(w)) keywordIndex.set(w, { categoryId, kind });
      maxPhraseWords = Math.max(maxPhraseWords, w.split(' ').length);
    }
  }
  const c: Compiled = {
    pack,
    incomeRe: altRegex(pack.incomeVerbs, boundaries),
    expenseRe: altRegex(pack.expenseVerbs, boundaries),
    keywordIndex,
    keywordPhrases: [...keywordIndex.keys()].sort((a, b) => b.length - a.length),
    maxPhraseWords,
    stopwords: new Set(pack.stopwords),
  };
  cache.set(pack.code, c);
  return c;
}

export function normalize(text: string, pack: LanguagePack): string {
  let t = text
    .toLowerCase()
    .replace(/[０-９]/g, (d) => String(d.charCodeAt(0) - 0xff10))
    .replace(/：/g, ':')
    .replace(/[“”"]/g, '')
    .replace(/’/g, "'")
    .replace(/[!?！？]+/g, ' ')
    .replace(/[，、]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (pack.decimalComma) t = normalizeDecimalComma(t);
  return t;
}

interface AmountExtraction {
  amount: number | null;
  text: string;
  confidence: number;
  multiple: boolean;
}

/**
 * Finds the money amount. Prefers numbers with a currency marker ($12, 12 dollars, 12块),
 * then the first bare number. Ordinals, times and percentages are ignored.
 */
interface AmountCandidate { value: number; start: number; end: number; marked: boolean }

/** Every money-looking number in the text, in order, with its span. */
export function findAmounts(text: string, pack: LanguagePack): AmountCandidate[] {
  const candidates: AmountCandidate[] = [];
  const marker = pack.currencyMarkers.source;
  const re = new RegExp(`(?:(${marker})\\s?)?(\\d+(?:\\.\\d+)?)(?:\\s?(${marker}))?`, 'giu');
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const full = m[0];
    const after = text.slice(m.index + full.length, m.index + full.length + 8);
    const before = text.slice(Math.max(0, m.index - 3), m.index);
    const marked = Boolean(m[1] || m[3]);
    if (!marked) {
      if (/^(st|nd|rd|th|º|ª|°|\.|%|\s?%|\s?(am|pm)\b|:\d|\s?o'clock|\s?x\b|\s?uhr\b|\s?h\b|時|点|시|月|日|월|일|年|년)/iu.test(after) && !/^\.\s/.test(after)) continue;
      if (/\d[.\-/]$/.test(before)) continue;
      if (/^[.\-/]\d/.test(after)) continue;
      if (/^\s?(people|persons|items?|tickets?|days?|weeks?|months?|years?|hours?|minutes?|miles?|km|kg|lbs?|oz|packs?|of|personas|personnes|persone|personen|个人|名|人|명)\b/iu.test(after)) continue;
    }
    const value = Number(m[2]);
    if (!Number.isFinite(value)) continue;
    candidates.push({ value, start: m.index, end: m.index + full.length, marked });
  }
  return candidates;
}

export function extractAmount(text: string, pack: LanguagePack): AmountExtraction {
  const candidates = findAmounts(text, pack);
  if (candidates.length === 0) return { amount: null, text, confidence: 0, multiple: false };
  const markedOnes = candidates.filter((c) => c.marked);
  const chosen = markedOnes[0] ?? candidates[0];
  const multiple = candidates.length > 1;
  const cleaned = (text.slice(0, chosen.start) + ' ' + text.slice(chosen.end)).replace(/\s+/g, ' ').trim();
  let confidence = chosen.marked ? 0.95 : 0.85;
  if (multiple && markedOnes.length !== 1) confidence -= 0.25;
  return { amount: Math.round(chosen.value * 100) / 100, text: cleaned, confidence, multiple };
}

function tokenize(text: string): string[] {
  return text
    .replace(/[^\p{L}\p{N}'&+\-\s]/gu, ' ')
    .split(/\s+/)
    .map((t) => t.replace(/^'+|'+$/g, ''))
    .filter(Boolean);
}

interface CategoryMatch {
  categoryId: string;
  kind: TxType;
  confidence: number;
  matched: string | null;
}

/**
 * Category detection. Priority: learned keywords > custom category names >
 * built-in dictionary (longer phrases first). Returns null when nothing matched.
 */
export function detectCategory(text: string, ctx: ParseContext, pack: LanguagePack = getPack(ctx.language)): CategoryMatch | null {
  const c = compile(pack);
  const active = ctx.categories.filter((cat) => !cat.archived);
  const byId = new Map(active.map((cat) => [cat.id, cat]));

  const customNameIndex = new Map<string, Category>();
  for (const cat of active) {
    if (cat.isDefault) continue;
    const name = cat.name.toLowerCase().trim();
    if (name) customNameIndex.set(name, cat);
    if (pack.tokenizer === 'space') {
      const words = tokenize(name).filter((w) => !c.stopwords.has(w));
      if (words.length) customNameIndex.set(words.join(' '), cat);
      for (const w of words) if (w.length > 2 && !customNameIndex.has(w)) customNameIndex.set(w, cat);
    }
  }

  const lookup = (phrase: string, len: number): CategoryMatch | null => {
    const learned = ctx.keywordMap[phrase];
    if (learned && byId.has(learned)) return { categoryId: learned, kind: byId.get(learned)!.kind, confidence: 0.95, matched: phrase };
    const custom = customNameIndex.get(phrase);
    if (custom) return { categoryId: custom.id, kind: custom.kind, confidence: 0.9, matched: phrase };
    const entry = c.keywordIndex.get(phrase);
    if (entry && byId.has(entry.categoryId)) return { categoryId: entry.categoryId, kind: entry.kind, confidence: len > 1 ? 0.9 : 0.8, matched: phrase };
    return null;
  };

  if (pack.tokenizer === 'cjk') {
    const compact = text.replace(/\s+/g, '');
    // Learned and custom phrases first (longest first), then the dictionary.
    const learnedPhrases = Object.keys(ctx.keywordMap).sort((a, b) => b.length - a.length);
    for (const p of learnedPhrases) if (p && compact.includes(p.replace(/\s+/g, ''))) { const r = lookup(p, 2); if (r) return r; }
    const customPhrases = [...customNameIndex.keys()].sort((a, b) => b.length - a.length);
    for (const p of customPhrases) if (p && compact.includes(p.replace(/\s+/g, ''))) { const r = lookup(p, 2); if (r) return r; }
    for (const p of c.keywordPhrases) if (compact.includes(p)) { const r = lookup(p, p.length > 1 ? 2 : 1); if (r) return r; }
    return null;
  }

  const tokens = tokenize(text);
  for (let len = Math.max(c.maxPhraseWords, 3); len >= 1; len -= 1) {
    for (let i = 0; i + len <= tokens.length; i += 1) {
      const phrase = tokens.slice(i, i + len).join(' ');
      const variants = len === 1 && pack.singularForms ? [phrase, ...pack.singularForms(phrase)] : [phrase];
      for (const v of variants) {
        const r = lookup(v, len);
        if (r) return r;
      }
    }
  }
  return null;
}

function detectType(text: string, c: Compiled): { type: TxType | null; confidence: number; verb: string | null } {
  const income = text.match(c.incomeRe);
  if (income) return { type: 'income', confidence: 0.9, verb: income[0] };
  const expense = text.match(c.expenseRe);
  if (expense) return { type: 'expense', confidence: 0.9, verb: expense[0] };
  return { type: null, confidence: 0, verb: null };
}

/** Turns the leftover words into a short human note. */
export function deriveNote(leftover: string, pack: LanguagePack): string | null {
  let s = leftover
    .replace(pack.currencyWords, ' ')
    .replace(/[,;:，、。]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  for (const re of pack.noteStrip) s = s.replace(re, ' ').replace(/\s+/g, ' ').trim();
  s = s.replace(pack.leadingFiller, '').replace(pack.trailingFiller, '').trim();
  s = s.replace(/^[\-–—.]+|[\-–—.]+$/g, '').trim();
  if (!s) return null;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Notes are derived from lowercased text. When the same words appear in what
 * the user actually typed or said, keep their casing ("Fleming's Steakhouse",
 * not "Fleming's steakhouse") so the place reads back the way they said it.
 */
export function restoreCase(note: string | null, raw: string): string | null {
  if (!note) return note;
  const source = raw.replace(/’/g, "'").replace(/[“”"]/g, '').replace(/\s+/g, ' ');
  const idx = source.toLowerCase().indexOf(note.toLowerCase());
  if (idx < 0) return note;
  const found = source.slice(idx, idx + note.length);
  return found.charAt(0).toUpperCase() + found.slice(1);
}

function findGoal(name: string, goals: Goal[], c: Compiled): Goal | null {
  const needle = name.toLowerCase().replace(/\s+/g, c.pack.tokenizer === 'cjk' ? '' : ' ').trim();
  if (!needle) return null;
  const open = goals.filter((g) => !g.completed);
  const norm = (s: string) => s.toLowerCase().replace(/\s+/g, c.pack.tokenizer === 'cjk' ? '' : ' ').trim();
  const exact = open.find((g) => norm(g.name) === needle);
  if (exact) return exact;
  const contains = open.find((g) => needle.includes(norm(g.name)) || norm(g.name).includes(needle));
  if (contains) return contains;
  if (c.pack.tokenizer === 'cjk') return null;
  const needleWords = new Set(tokenize(needle).filter((w) => !c.stopwords.has(w)));
  let best: { goal: Goal; score: number } | null = null;
  for (const g of open) {
    const words = tokenize(g.name.toLowerCase()).filter((w) => !c.stopwords.has(w));
    const overlap = words.filter((w) => needleWords.has(w) || (c.pack.singularForms?.(w) ?? []).some((f) => needleWords.has(f))).length;
    if (overlap > 0 && (!best || overlap > best.score)) best = { goal: g, score: overlap };
  }
  return best?.goal ?? null;
}

function cleanGoalName(s: string, pack: LanguagePack): string | null {
  const goalWordRe = new RegExp(`${WB_START}(?:${pack.goalWords})${WB_END}`, 'giu');
  let name = s.replace(goalWordRe, ' ').replace(pack.currencyWords, ' ').replace(/\s+/g, ' ').trim();
  for (const re of pack.noteStrip) name = name.replace(re, ' ').replace(/\s+/g, ' ').trim();
  name = name.replace(pack.trailingFiller, '').replace(pack.articles, '').replace(/[.,;:!。]+$/g, '').trim();
  name = name.replace(new RegExp(`^(?:${pack.forWords})\\s+`, 'iu'), '').trim();
  if (!name) return null;
  return name.charAt(0).toUpperCase() + name.slice(1);
}

function baseResult(raw: string, today: string): ParseResult {
  return {
    kind: 'unknown', raw, amount: null, type: 'expense', typeConfidence: 0, categoryId: null, categoryConfidence: 0,
    note: null, occurredAt: today, dateExplicit: false, goalName: null, targetDate: null, goalId: null,
    confidence: 0, needsReview: true, hints: [],
  };
}

function parseGoal(afterLead: string, raw: string, ctx: ParseContext, pack: LanguagePack): ParseResult {
  const r = baseResult(raw, ctx.today);
  r.kind = 'goal';
  const future = applyRules(pack.futureDateRules, afterLead, ctx.today);
  r.targetDate = future.date;
  const amt = extractAmount(future.text, pack);
  r.amount = amt.amount;
  let rest = amt.text.replace(new RegExp(pack.goalIntent.source, 'giu'), ' ').replace(/\s+/g, ' ').trim();
  const forWord = pack.tokenizer === 'cjk'
    ? new RegExp(`^(.+?)(?:${pack.forWords})`, 'u')
    : new RegExp(`${WB_START}(?:${pack.forWords})\\s+(.+)$`, 'iu');
  let namePart: string;
  if (pack.tokenizer === 'cjk') {
    namePart = rest.replace(new RegExp(`(?:${pack.forWords})`, 'gu'), ' ');
  } else {
    const forMatch = rest.match(forWord);
    namePart = forMatch ? forMatch[1] : rest.replace(new RegExp(`^(?:${pack.forWords})\\s+`, 'iu'), '');
  }
  r.goalName = cleanGoalName(namePart, pack);
  r.confidence = (r.amount ? 0.6 : 0.2) + (r.goalName ? 0.3 : 0) + (r.targetDate ? 0.1 : 0);
  if (!r.amount) r.hints.push(HINT.goalAmount);
  if (!r.goalName) r.hints.push(HINT.goalName);
  if (!r.targetDate) r.hints.push(HINT.goalNoDate);
  r.needsReview = !r.amount || !r.goalName;
  return r;
}

/**
 * Tier 1 parser: rule-based, instant, offline. Handles the common phrasings
 * in the selected language. Returns a ParseResult the confirmation card can
 * show and the user can edit.
 */
export function parseInput(input: string, ctx: ParseContext): ParseResult {
  const pack = getPack(ctx.language);
  const c = compile(pack);
  const raw = input.trim();
  if (!raw) return baseResult(raw, ctx.today);
  let text = pack.numberWords(normalize(raw, pack));

  // ---- Goal creation ----
  const lead = text.match(pack.goalLead);
  if (lead) return parseGoal(text.slice(lead[0].length), raw, ctx, pack);
  const intent = text.match(pack.goalIntent);
  if (intent && !pack.goalPastVerbs.test(text)) {
    const forRe = new RegExp(pack.tokenizer === 'cjk' ? `(?:${pack.forWords})` : `${WB_START}(?:${pack.forWords})${WB_END}`, 'iu');
    const hasDate = applyRules(pack.futureDateRules, text, ctx.today).date != null;
    const bare = pack.tokenizer === 'space' && intent[0].trim().split(' ').length === 1;
    const looksLikeGoal = forRe.test(text) || hasDate || !bare;
    if (looksLikeGoal) return parseGoal(text, raw, ctx, pack);
  }

  // ---- Contribution to an existing goal ----
  if (ctx.goals.some((g) => !g.completed) && pack.contributionVerbs.test(text)) {
    const m = pack.tokenizer === 'cjk'
      ? text.match(new RegExp(`(.+?)(?:${pack.contributionPreps})`, 'u'))
      : text.match(new RegExp(`${WB_START}(?:${pack.contributionPreps})\\s+(?:${pack.articles.source.replace(/^\^|\+$/g, '')})?(.+?)(?:\\s+(?:${pack.goalWords}))?$`, 'iu'));
    const goal = m ? findGoal(m[1].replace(pack.currencyWords, ' ').replace(/\d+(?:\.\d+)?/g, ' ').replace(new RegExp(pack.contributionVerbs.source, 'gu'), ' ').trim(), ctx.goals, c) : null;
    if (goal) {
      const r = baseResult(raw, ctx.today);
      const dated = applyRules(pack.pastDateRules, text, ctx.today);
      if (dated.date) { r.occurredAt = dated.date; r.dateExplicit = true; }
      const amt = extractAmount(dated.text, pack);
      r.kind = 'contribution';
      r.goalId = goal.id;
      r.goalName = goal.name;
      r.amount = amt.amount;
      r.type = 'expense';
      r.typeConfidence = 0.9;
      r.categoryId = ctx.categories.find((cat) => cat.id === 'savings' && !cat.archived)?.id ?? null;
      r.categoryConfidence = 0.9;
      r.note = null;
      r.confidence = r.amount ? 0.9 : 0.3;
      r.needsReview = !r.amount;
      if (!r.amount) r.hints.push(HINT.contributionAmount);
      return r;
    }
  }

  // ---- Regular transaction ----
  const r = baseResult(raw, ctx.today);
  r.kind = 'transaction';

  const dated = applyRules(pack.pastDateRules, text, ctx.today);
  if (dated.date) { r.occurredAt = dated.date; r.dateExplicit = true; }
  text = dated.text;

  const amt = extractAmount(text, pack);
  r.amount = amt.amount;
  text = amt.text;

  const typeGuess = detectType(text, c);
  const cat = detectCategory(text, ctx, pack);

  let type: TxType;
  let typeConfidence: number;
  if (typeGuess.type) {
    type = typeGuess.type;
    typeConfidence = typeGuess.confidence;
    if (cat && cat.kind !== type && cat.confidence >= 0.9) typeConfidence = 0.7;
  } else if (cat) {
    type = cat.kind;
    typeConfidence = 0.8;
  } else {
    type = 'expense';
    typeConfidence = 0.6;
  }
  r.type = type;
  r.typeConfidence = typeConfidence;

  const has = (id: string) => ctx.categories.some((cat2) => cat2.id === id && !cat2.archived);
  if (cat && cat.kind === type) {
    r.categoryId = cat.categoryId;
    r.categoryConfidence = cat.confidence;
  } else if (cat && cat.kind !== type) {
    const remapped = cat.categoryId === 'gift_income' ? 'shopping' : null;
    const fallback = type === 'income' ? FALLBACK_INCOME_CATEGORY_ID : FALLBACK_EXPENSE_CATEGORY_ID;
    const target = remapped && has(remapped) ? remapped : fallback;
    r.categoryId = has(target) ? target : null;
    r.categoryConfidence = remapped ? 0.7 : 0.35;
  } else {
    const fallback = type === 'income' ? FALLBACK_INCOME_CATEGORY_ID : FALLBACK_EXPENSE_CATEGORY_ID;
    r.categoryId = has(fallback) ? fallback : null;
    r.categoryConfidence = 0.35;
  }

  let leftover = text;
  if (typeGuess.verb) leftover = leftover.replace(typeGuess.verb, ' ');
  r.note = restoreCase(deriveNote(leftover, pack), raw);

  if (!r.amount) {
    r.confidence = 0;
    r.hints.push(HINT.noAmount);
  } else {
    r.confidence = Math.min(amt.confidence, 0.5 * typeConfidence + 0.5 * Math.max(r.categoryConfidence, 0.35) + 0.15);
    if (amt.multiple && amt.confidence < 0.8) r.hints.push(HINT.multipleNumbers);
    if (r.categoryConfidence < 0.5) r.hints.push(HINT.unsureCategory);
    if (typeConfidence < 0.7) r.hints.push(type === 'expense' ? HINT.assumedExpense : HINT.assumedIncome);
  }
  r.confidence = Math.max(0, Math.min(1, r.confidence));
  r.needsReview = !r.amount || r.confidence < 0.55;
  return r;
}

/**
 * Splits "spent $67.99 at Macy's and $121.53 at Fleming's" into one segment per
 * amount, cutting at a list separator between two amounts. Space-separated
 * languages cut at the last separator before the next amount; CJK languages
 * (where whitespace itself separates phrases) cut at the first one. Returns
 * the whole text as a single segment when there is nothing to split.
 */
export function splitEntries(text: string, pack: LanguagePack): string[] {
  const all = findAmounts(text, pack);
  const marked = all.filter((a) => a.marked);
  const amounts = marked.length >= 2 ? marked : all;
  if (amounts.length < 2) return [text];
  const alt = [...pack.listSeparators].sort((a, b) => b.length - a.length).map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  const cjk = pack.tokenizer === 'cjk';
  const sepRe = cjk
    ? new RegExp(`(?:${alt}|\\s+)`, 'gu')
    : new RegExp(`(?:\\s*[,;]\\s*|\\s+(?:${alt})\\s+)`, 'giu');
  const cuts: { start: number; end: number }[] = [];
  for (let i = 0; i + 1 < amounts.length; i += 1) {
    const from = amounts[i].end;
    const to = amounts[i + 1].start;
    const between = text.slice(from, to);
    let chosen: RegExpExecArray | null = null;
    let m: RegExpExecArray | null;
    sepRe.lastIndex = 0;
    while ((m = sepRe.exec(between)) !== null) {
      if (m[0].length === 0) { sepRe.lastIndex += 1; continue; }
      chosen = m;
      if (cjk) break;
    }
    if (chosen) cuts.push({ start: from + chosen.index, end: from + chosen.index + chosen[0].length });
  }
  if (cuts.length === 0) return [text];
  const out: string[] = [];
  let pos = 0;
  for (const c of cuts) { out.push(text.slice(pos, c.start).trim()); pos = c.end; }
  out.push(text.slice(pos).trim());
  return out.filter(Boolean);
}

const ABBREV = /(?:\b(?:jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec|mr|mrs|ms|dr|st|vs|approx|ca|etc|ene|abr|ago|dic|janv|févr|fevr|juil|déc|gen|mag|giu|lug|set|sett|ott|okt|dez|nr|ca|bzw|z\.b|u\.a)|\b\p{L})\.$/iu;

/** Splits free text into sentences on . ! ? and CJK equivalents, keeping decimals and abbreviations intact. */
export function splitSentences(raw: string): string[] {
  const parts: string[] = [];
  let buf = '';
  const chars = [...raw];
  for (let i = 0; i < chars.length; i += 1) {
    const ch = chars[i];
    buf += ch;
    const next = chars[i + 1] ?? '';
    if (ch === '\n') { parts.push(buf); buf = ''; continue; }
    if (ch === '。' || ch === '！' || ch === '？') { parts.push(buf); buf = ''; continue; }
    if ((ch === '.' || ch === '!' || ch === '?') && (next === '' || /\s/.test(next))) {
      const prev = chars[i - 1] ?? '';
      if (ch === '.' && (/\d/.test(prev) && /\d/.test(chars[i + 2] ?? '') || ABBREV.test(buf.trim()))) continue;
      parts.push(buf);
      buf = '';
    }
  }
  if (buf.trim()) parts.push(buf);
  return parts.map((p) => p.trim()).filter(Boolean);
}

/**
 * Parses free text that may describe several entries, in one sentence or
 * many. Goals and contributions are never split. A date phrase and an
 * income/expense verb carry forward to later entries that have none
 * ("yesterday I spent 12 on lunch and 40 on gas. Then $9 at Zizzle.").
 */
export function parseEntries(input: string, ctx: ParseContext): ParseResult[] {
  const pack = getPack(ctx.language);
  const raw = input.trim();
  if (!raw) return [baseResult(raw, ctx.today)];
  const sentences = splitSentences(raw);
  const results: ParseResult[] = [];
  let sharedDate: string | null = null;
  let sharedType: { type: TxType; confidence: number } | null = null;
  let multi = false;

  for (const sentence of sentences) {
    const text = pack.numberWords(normalize(sentence, pack));
    if (!text) continue;
    const isGoal = pack.goalLead.test(text) || (pack.goalIntent.test(text) && !pack.goalPastVerbs.test(text));
    const isContribution = ctx.goals.some((g) => !g.completed) && pack.contributionVerbs.test(text);
    if (isGoal || isContribution) { results.push(parseInput(sentence, ctx)); continue; }

    const dated = applyRules(pack.pastDateRules, text, ctx.today);
    const segments = splitEntries(dated.text, pack);
    if (segments.length > 1 || sentences.length > 1) multi = true;
    const group = segments.length > 1
      ? segments.map((seg) => { const r = parseInput(seg, ctx); r.note = restoreCase(r.note, sentence); return r; })
      : [parseInput(sentence, ctx)];
    if (dated.date) sharedDate = dated.date;
    const lead = group[0];
    if (lead.typeConfidence >= 0.8) sharedType = { type: lead.type, confidence: lead.typeConfidence };

    for (const r of group) {
      if (sharedDate && !r.dateExplicit) { r.occurredAt = sharedDate; r.dateExplicit = true; }
      if (sharedType && r.typeConfidence <= 0.6) {
        if (r.type !== sharedType.type) {
          r.type = sharedType.type;
          const fallback = r.type === 'income' ? FALLBACK_INCOME_CATEGORY_ID : FALLBACK_EXPENSE_CATEGORY_ID;
          if (r.categoryConfidence < 0.5) r.categoryId = ctx.categories.some((c) => c.id === fallback && !c.archived) ? fallback : null;
        }
        r.typeConfidence = 0.8;
        r.hints = r.hints.filter((h) => h !== HINT.assumedExpense && h !== HINT.assumedIncome);
      }
      if (segments.length > 1) r.hints = r.hints.filter((h) => h !== HINT.multipleNumbers);
      if (r.amount != null) {
        r.confidence = Math.min(0.95, 0.5 * r.typeConfidence + 0.5 * Math.max(r.categoryConfidence, 0.35) + 0.15);
        r.needsReview = r.confidence < 0.55;
      }
      results.push(r);
    }
  }
  if (!multi && results.length === 1) return [parseInput(raw, ctx)];
  return results.length ? results : [baseResult(raw, ctx.today)];
}

/**
 * Words from a phrase worth remembering when the user corrects the category.
 * Skips stopwords, numbers and anything shorter than three letters. For CJK
 * languages the whole leftover phrase is remembered as one key.
 */
export function learnableWords(rawInput: string, language?: string): string[] {
  const pack = getPack(language);
  const c = compile(pack);
  const text = pack.numberWords(normalize(rawInput, pack));
  const dated = applyRules(pack.pastDateRules, text, '2000-01-01');
  const amt = extractAmount(dated.text, pack);
  let leftover = amt.text.replace(pack.currencyWords, ' ');
  leftover = leftover.replace(c.incomeRe, ' ').replace(c.expenseRe, ' ');
  if (pack.tokenizer === 'cjk') {
    const note = deriveNote(leftover, pack);
    const key = note?.toLowerCase().replace(/\s+/g, '') ?? '';
    return key.length >= 1 && key.length <= 12 ? [key] : [];
  }
  const words = tokenize(leftover);
  const out: string[] = [];
  for (const w of words) {
    if (w.length < 3 || c.stopwords.has(w) || /^\d+$/.test(w)) continue;
    if (c.incomeRe.test(w) || c.expenseRe.test(w)) continue;
    if (!out.includes(w)) out.push(w);
  }
  return out;
}
