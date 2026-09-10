import type { Category, Goal, TxType } from '@/types';
import { FALLBACK_EXPENSE_CATEGORY_ID, FALLBACK_INCOME_CATEGORY_ID } from '@/lib/defaultCategories';
import { extractFutureDate, extractPastDate } from './dates';
import { EXPENSE_VERB_RE, INCOME_VERB_RE, KEYWORDS, MAX_PHRASE_WORDS, STOPWORDS } from './keywords';
import { replaceNumberWords } from './numberWords';

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
  /** Plain-language hints shown on the confirmation card. */
  hints: string[];
}

export interface ParseContext {
  categories: Category[];
  goals: Goal[];
  /** Learned word -> categoryId mappings (user corrections). */
  keywordMap: Record<string, string>;
  /** YYYY-MM-DD */
  today: string;
}

const CURRENCY_WORDS = /\b(dollars?|bucks?|usd|euros?|eur|pounds?|gbp|quid|cad|aud|yen|rupees?|inr|pesos?|kr|chf)\b/g;

export function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[“”"]/g, '')
    .replace(/’/g, "'")
    .replace(/(\d),(\d{3})\b/g, '$1$2') // 2,400 -> 2400
    .replace(/[!?]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

interface AmountExtraction {
  amount: number | null;
  text: string;
  confidence: number;
  multiple: boolean;
}

/**
 * Finds the money amount. Prefers numbers with a currency marker ($12, 12 dollars),
 * then the first bare number. Numbers that look like ordinals, times or
 * percentages are ignored.
 */
export function extractAmount(text: string): AmountExtraction {
  const candidates: { value: number; start: number; end: number; marked: boolean }[] = [];
  const re = /(?:(\$|€|£|¥|₹)\s?)?(\d+(?:\.\d+)?)(?:\s?(\$|€|£|¥|₹))?(?:\s?(dollars?|bucks?|usd|euros?|eur|pounds?|gbp|quid|cad|aud|yen|rupees?|inr|pesos?|kr|chf))?/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const full = m[0];
    const after = text.slice(m.index + full.length, m.index + full.length + 6);
    const before = text.slice(Math.max(0, m.index - 3), m.index);
    const marked = Boolean(m[1] || m[3] || m[4]);
    if (!marked) {
      if (/^(st|nd|rd|th|%|\s?%|\s?(am|pm)\b|:\d|\s?o'clock|\s?x\b)/i.test(after)) continue; // ordinals, percent, times
      if (/\d[.\-/]$/.test(before)) continue; // part of a date like 9/3 or 2025-09-03
      if (/^[.\-/]\d/.test(after)) continue;
      if (/^\s?(people|persons|items?|tickets?|days?|weeks?|months?|years?|hours?|minutes?|miles?|km|kg|lbs?|oz|pack|packs|of)\b/i.test(after)) continue;
    }
    const value = Number(m[2]);
    if (!Number.isFinite(value)) continue;
    candidates.push({ value, start: m.index, end: m.index + full.length, marked });
  }
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
    .replace(/[^a-z0-9'&+\-\s]/g, ' ')
    .split(/\s+/)
    .map((t) => t.replace(/^'+|'+$/g, ''))
    .filter(Boolean);
}

/** Candidate singular forms, most likely first ("coffees" -> "coffee", "taxes" -> "tax", "berries" -> "berry"). */
function singularForms(word: string): string[] {
  const out: string[] = [];
  if (word.length > 4 && word.endsWith('ies')) out.push(word.slice(0, -3) + 'y');
  if (word.length > 3 && word.endsWith('s') && !word.endsWith('ss')) out.push(word.slice(0, -1));
  if (word.length > 4 && word.endsWith('es')) out.push(word.slice(0, -2));
  return out;
}

function singular(word: string): string {
  return singularForms(word)[0] ?? word;
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
export function detectCategory(text: string, ctx: ParseContext): CategoryMatch | null {
  const tokens = tokenize(text);
  const active = ctx.categories.filter((c) => !c.archived);
  const byId = new Map(active.map((c) => [c.id, c]));

  // Custom (non-default) category names act as keywords too.
  const customNameIndex = new Map<string, Category>();
  for (const c of active) {
    if (c.isDefault) continue;
    const words = tokenize(c.name.toLowerCase()).filter((w) => !STOPWORDS.has(w));
    if (words.length) customNameIndex.set(words.join(' '), c);
    for (const w of words) if (w.length > 2 && !customNameIndex.has(w)) customNameIndex.set(w, c);
  }

  for (let len = MAX_PHRASE_WORDS; len >= 1; len -= 1) {
    for (let i = 0; i + len <= tokens.length; i += 1) {
      const phrase = tokens.slice(i, i + len).join(' ');
      const variants = len === 1 ? [phrase, ...singularForms(phrase)] : [phrase];
      for (const v of variants) {
        const learned = ctx.keywordMap[v];
        if (learned && byId.has(learned)) {
          return { categoryId: learned, kind: byId.get(learned)!.kind, confidence: 0.95, matched: v };
        }
        const custom = customNameIndex.get(v);
        if (custom) return { categoryId: custom.id, kind: custom.kind, confidence: 0.9, matched: v };
        const entry = KEYWORDS.get(v);
        if (entry && byId.has(entry.categoryId)) {
          return { categoryId: entry.categoryId, kind: entry.kind, confidence: len > 1 ? 0.9 : 0.8, matched: v };
        }
      }
    }
  }
  return null;
}

function detectType(text: string): { type: TxType | null; confidence: number; verb: string | null } {
  const income = text.match(INCOME_VERB_RE);
  if (income) return { type: 'income', confidence: 0.9, verb: income[0] };
  const expense = text.match(EXPENSE_VERB_RE);
  if (expense) return { type: 'expense', confidence: 0.9, verb: expense[0] };
  return { type: null, confidence: 0, verb: null };
}

const LEADING_FILLER = /^(?:(?:i|we|just|then|and|so|also|today|ok|okay|um|uh|please|note|log|add|record|entry|new|expense|income|spent|spend|paid|pay|bought|buy|purchased|got|get|received|earned|made|cost|for|on|at|of|to|in|from|the|a|an|some|my|our|about|around|roughly|another)\s+)+/;
const TRAILING_FILLER = /(?:\s+(?:today|yesterday|for|on|at|of|to|in|from|the|a|an|and|with|each|total|again|please|thanks|it|that|this))+$/;

/** Turns the leftover words into a short human note. */
export function deriveNote(leftover: string): string | null {
  let s = leftover
    .replace(CURRENCY_WORDS, ' ')
    .replace(/\b(cents?)\b/g, ' ')
    .replace(/[,;:]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  s = s.replace(LEADING_FILLER, '').replace(TRAILING_FILLER, '').trim();
  s = s.replace(/^[\-–—.]+|[\-–—.]+$/g, '').trim();
  if (!s) return null;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function findGoal(name: string, goals: Goal[]): Goal | null {
  const needle = name.toLowerCase().trim();
  if (!needle) return null;
  const open = goals.filter((g) => !g.completed);
  const exact = open.find((g) => g.name.toLowerCase() === needle);
  if (exact) return exact;
  const contains = open.find((g) => needle.includes(g.name.toLowerCase()) || g.name.toLowerCase().includes(needle));
  if (contains) return contains;
  const needleWords = new Set(tokenize(needle).filter((w) => !STOPWORDS.has(w)));
  let best: { goal: Goal; score: number } | null = null;
  for (const g of open) {
    const words = tokenize(g.name.toLowerCase()).filter((w) => !STOPWORDS.has(w));
    const overlap = words.filter((w) => needleWords.has(w) || needleWords.has(singular(w))).length;
    if (overlap > 0 && (!best || overlap > best.score)) best = { goal: g, score: overlap };
  }
  return best?.goal ?? null;
}

const ARTICLES = /^(?:(?:a|an|the|my|our|some|new)\s+)+/;

function cleanGoalName(s: string): string | null {
  let name = s.replace(/\bgoal\b/g, ' ').replace(CURRENCY_WORDS, ' ').replace(/\s+/g, ' ').trim();
  name = name.replace(ARTICLES, '').replace(/[.,;:!]+$/g, '').trim();
  name = name.replace(/^(?:to|for)\s+/, '').trim();
  if (!name) return null;
  return name.charAt(0).toUpperCase() + name.slice(1);
}

function baseResult(raw: string, today: string): ParseResult {
  return {
    kind: 'unknown',
    raw,
    amount: null,
    type: 'expense',
    typeConfidence: 0,
    categoryId: null,
    categoryConfidence: 0,
    note: null,
    occurredAt: today,
    dateExplicit: false,
    goalName: null,
    targetDate: null,
    goalId: null,
    confidence: 0,
    needsReview: true,
    hints: [],
  };
}

const GOAL_LEAD = /^(?:goal|new goal|savings goal|saving goal|set (?:a )?goal|create (?:a )?goal)\s*:?\s*/;
const GOAL_INTENT = /\b(?:i(?:'d| would)? (?:want|like|need|plan|am trying|'m trying) to (?:save|put away|set aside|have)|want to save|save up|saving up|trying to save|need to save|save)\b/;
const CONTRIBUTION_RE = /\b(?:add(?:ed)?|put|moved?|saved?|set aside|transfer(?:red)?|deposit(?:ed)?|contribut(?:ed|e)|stashed|stash|tucked away|threw)\b/;

function parseGoal(afterLead: string, raw: string, ctx: ParseContext, viaLead: boolean): ParseResult {
  const r = baseResult(raw, ctx.today);
  r.kind = 'goal';
  const future = extractFutureDate(afterLead, ctx.today);
  r.targetDate = future.date;
  const amt = extractAmount(future.text);
  r.amount = amt.amount;
  let rest = amt.text;
  rest = rest.replace(GOAL_INTENT, ' ').replace(/\b(?:goal|by|before|until|deadline)\b\s*$/g, ' ').replace(/\s+/g, ' ').trim();
  // Name: prefer "for X", else the leftover.
  const forMatch = rest.match(/\bfor\s+(.+)$/);
  const namePart = forMatch ? forMatch[1] : rest.replace(/^(?:to|for)\s+/, '');
  r.goalName = cleanGoalName(namePart) ?? (viaLead ? null : null);
  r.confidence = (r.amount ? 0.6 : 0.2) + (r.goalName ? 0.3 : 0) + (r.targetDate ? 0.1 : 0);
  if (!r.amount) r.hints.push('How much do you want to save in total?');
  if (!r.goalName) r.hints.push('What is this goal for?');
  if (!r.targetDate) r.hints.push('No target date yet. You can add one, or leave it open.');
  r.needsReview = !r.amount || !r.goalName;
  return r;
}

/**
 * Tier 1 parser: rule-based, instant, offline. Handles the common phrasings.
 * Returns a ParseResult the confirmation card can show and the user can edit.
 */
export function parseInput(input: string, ctx: ParseContext): ParseResult {
  const raw = input.trim();
  if (!raw) return baseResult(raw, ctx.today);
  let text = replaceNumberWords(normalize(raw));

  // ---- Goal creation ----
  const lead = text.match(GOAL_LEAD);
  if (lead) return parseGoal(text.slice(lead[0].length), raw, ctx, true);
  const intent = text.match(GOAL_INTENT);
  if (intent && !/\b(saved|stashed|moved|added|put|transferred|deposited)\b/.test(text)) {
    // "save 500 for a trip by december", "i want to save 2000 for an emergency fund"
    const looksLikeGoal = /\bfor\b/.test(text) || /\bby\b/.test(text) || /\bgoal\b/.test(text) || intent[0] !== 'save';
    if (looksLikeGoal) return parseGoal(text, raw, ctx, false);
  }

  // ---- Contribution to an existing goal ----
  if (ctx.goals.some((g) => !g.completed) && CONTRIBUTION_RE.test(text)) {
    const m = text.match(/\b(?:to|toward|towards|into|for|in)\s+(?:my\s+|the\s+|our\s+)?(.+?)(?:\s+goal)?$/);
    const goal = m ? findGoal(m[1], ctx.goals) : null;
    if (goal) {
      const r = baseResult(raw, ctx.today);
      const dated = extractPastDate(text, ctx.today);
      if (dated.date) { r.occurredAt = dated.date; r.dateExplicit = true; }
      const amt = extractAmount(dated.text);
      r.kind = 'contribution';
      r.goalId = goal.id;
      r.goalName = goal.name;
      r.amount = amt.amount;
      r.type = 'expense';
      r.typeConfidence = 0.9;
      r.categoryId = ctx.categories.find((c) => c.id === 'savings' && !c.archived)?.id ?? null;
      r.categoryConfidence = 0.9;
      r.note = `Toward ${goal.name}`;
      r.confidence = r.amount ? 0.9 : 0.3;
      r.needsReview = !r.amount;
      if (!r.amount) r.hints.push(`How much did you add to ${goal.name}?`);
      return r;
    }
  }

  // ---- Regular transaction ----
  const r = baseResult(raw, ctx.today);
  r.kind = 'transaction';

  const dated = extractPastDate(text, ctx.today);
  if (dated.date) {
    r.occurredAt = dated.date;
    r.dateExplicit = true;
  }
  text = dated.text;

  const amt = extractAmount(text);
  r.amount = amt.amount;
  text = amt.text;

  const typeGuess = detectType(text);
  const cat = detectCategory(text, ctx);

  let type: TxType;
  let typeConfidence: number;
  if (typeGuess.type) {
    type = typeGuess.type;
    typeConfidence = typeGuess.confidence;
    // A strong income verb with an expense-only category (or vice-versa) is a mild conflict.
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

  if (cat && cat.kind === type) {
    r.categoryId = cat.categoryId;
    r.categoryConfidence = cat.confidence;
  } else if (cat && cat.kind !== type) {
    // e.g. "spent 20 on a gift": "gift" maps to income Gift but the verb says expense -> shopping/other.
    const remapped = cat.categoryId === 'gift_income' ? 'shopping' : null;
    const fallback = type === 'income' ? FALLBACK_INCOME_CATEGORY_ID : FALLBACK_EXPENSE_CATEGORY_ID;
    const target = remapped && ctx.categories.some((c) => c.id === remapped && !c.archived) ? remapped : fallback;
    r.categoryId = ctx.categories.some((c) => c.id === target && !c.archived) ? target : null;
    r.categoryConfidence = remapped ? 0.7 : 0.35;
  } else {
    const fallback = type === 'income' ? FALLBACK_INCOME_CATEGORY_ID : FALLBACK_EXPENSE_CATEGORY_ID;
    r.categoryId = ctx.categories.some((c) => c.id === fallback && !c.archived) ? fallback : null;
    r.categoryConfidence = 0.35;
  }

  // Note: leftover words minus the verb that told us the type.
  let leftover = text;
  if (typeGuess.verb) leftover = leftover.replace(typeGuess.verb, ' ');
  r.note = deriveNote(leftover);

  // Confidence and hints
  if (!r.amount) {
    r.confidence = 0;
    r.hints.push("I couldn't find an amount.");
  } else {
    r.confidence = Math.min(amt.confidence, 0.5 * typeConfidence + 0.5 * Math.max(r.categoryConfidence, 0.35) + 0.15);
    if (amt.multiple && amt.confidence < 0.8) r.hints.push('I saw more than one number. Check the amount.');
    if (r.categoryConfidence < 0.5) r.hints.push('Not sure about the category. Tap it to change.');
    if (typeConfidence < 0.7) r.hints.push(type === 'expense' ? 'I assumed this was money out.' : 'I assumed this was money in.');
  }
  r.confidence = Math.max(0, Math.min(1, r.confidence));
  r.needsReview = !r.amount || r.confidence < 0.55;
  return r;
}

/**
 * Words from a phrase worth remembering when the user corrects the category.
 * Skips stopwords, numbers and anything shorter than three letters.
 */
export function learnableWords(rawInput: string): string[] {
  const text = replaceNumberWords(normalize(rawInput));
  const dated = extractPastDate(text, '2000-01-01');
  const amt = extractAmount(dated.text);
  const words = tokenize(amt.text.replace(CURRENCY_WORDS, ' '));
  const out: string[] = [];
  for (const w of words) {
    if (w.length < 3 || STOPWORDS.has(w) || /^\d+$/.test(w)) continue;
    if (INCOME_VERB_RE.test(w) || EXPENSE_VERB_RE.test(w)) continue;
    if (!out.includes(w)) out.push(w);
  }
  return out;
}
