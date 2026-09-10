/**
 * Number helpers shared by language packs.
 */

/** "1.200,50" -> "1200.50" for decimal-comma locales; "1 200" -> "1200". */
export function normalizeDecimalComma(text: string): string {
  return text
    .replace(/(\d)[\s  ](\d{3})\b/g, '$1$2')
    .replace(/(\d)\.(\d{3})(?!\d)/g, '$1$2')
    .replace(/(\d),(\d{1,2})(?!\d)/g, '$1.$2');
}

/** "2,400" -> "2400" for decimal-point locales. */
export function normalizeDecimalPoint(text: string): string {
  return text.replace(/(\d),(\d{3})\b/g, '$1$2');
}

/** "2.4k" -> "2400". */
export function expandK(text: string): string {
  return text.replace(/\b(\d+(?:[.,]\d+)?)k\b/gi, (_, n: string) => String(Math.round(parseFloat(n.replace(',', '.')) * 1000)));
}

export interface WesternNumberTable {
  /** Explicit word -> value for 0..19 and any irregular compounds (veintiuno, quatre-vingts...). */
  units: Record<string, number>;
  tens: Record<string, number>;
  /** Words meaning ×100 ("hundred", "cien", "ciento", "cent"). */
  hundred: string[];
  /** Explicit hundreds ("doscientos": 200). */
  hundreds?: Record<string, number>;
  /** Words meaning ×1000. */
  thousand: string[];
  /** Words meaning ×1,000,000. */
  million?: string[];
  /** Connectors allowed inside a number ("and", "y", "et", "e", "und"). */
  connectors: string[];
  /** Words meaning one that may precede hundred/thousand ("a", "un", "une", "ein"). */
  one: string[];
  /** Pre-processing to split compounds or fix hyphens before tokenizing. */
  pre?: (text: string) => string;
}

function strip(w: string): string {
  return w.toLowerCase().replace(/[^\p{L}]/gu, '');
}

/**
 * Generic number-word to digit converter for languages that write numbers as
 * separate words (plus a `pre` hook for compound-word languages).
 */
export function makeNumberWords(table: WesternNumberTable): (text: string) => string {
  const isNum = (w: string) => w in table.units || w in table.tens || table.hundred.includes(w) || (table.hundreds && w in table.hundreds) || table.thousand.includes(w) || (table.million?.includes(w) ?? false);
  const isScale = (w: string) => table.hundred.includes(w) || table.thousand.includes(w) || (table.million?.includes(w) ?? false) || (table.hundreds != null && w in table.hundreds);

  function evaluate(run: string[]): number | null {
    let total = 0;
    let current = 0;
    let saw = false;
    for (const w of run) {
      if (table.connectors.includes(w)) continue;
      if (table.one.includes(w)) { if (current === 0) current = 1; continue; }
      if (w in table.units) { current += table.units[w]; saw = true; }
      else if (w in table.tens) { current += table.tens[w]; saw = true; }
      else if (table.hundreds && w in table.hundreds) { current += table.hundreds[w]; saw = true; }
      else if (table.hundred.includes(w)) { current = (current === 0 ? 1 : current) * 100; saw = true; }
      else if (table.thousand.includes(w)) { total += (current === 0 ? 1 : current) * 1000; current = 0; saw = true; }
      else if (table.million?.includes(w)) { total += (current === 0 ? 1 : current) * 1_000_000; current = 0; saw = true; }
      else return null;
    }
    return saw ? total + current : null;
  }

  return (input: string) => {
    const text = expandK(table.pre ? table.pre(input) : input);
    const words = text.split(/\s+/).filter(Boolean);
    const out: string[] = [];
    let i = 0;
    while (i < words.length) {
      const w = strip(words[i]);
      const nextW = i + 1 < words.length ? strip(words[i + 1]) : '';
      const starts = isNum(w) || (table.one.includes(w) && isScale(nextW));
      if (!starts) { out.push(words[i]); i += 1; continue; }
      let j = i;
      const run: string[] = [];
      while (j < words.length) {
        const cw = strip(words[j]);
        const isConn = table.connectors.includes(cw);
        const isOne = table.one.includes(cw) && run.length === 0;
        if (isNum(cw) || isConn || isOne) {
          if (isConn) {
            const after = j + 1 < words.length ? strip(words[j + 1]) : '';
            if (!isNum(after)) break;
          }
          run.push(cw);
          j += 1;
        } else break;
      }
      const value = evaluate(run);
      if (value === null) { out.push(words[i]); i += 1; continue; }
      const trailing = words[j - 1].match(/[^\p{L}]+$/u)?.[0] ?? '';
      out.push(String(value) + trailing);
      i = j;
    }
    return out.join(' ').replace(/\s+/g, ' ').trim();
  };
}

// ---------- CJK numerals ----------

const CJK_DIGITS: Record<string, number> = { '零': 0, '〇': 0, '一': 1, '二': 2, '两': 2, '兩': 2, '三': 3, '四': 4, '五': 5, '六': 6, '七': 7, '八': 8, '九': 9 };
const CJK_SMALL: Record<string, number> = { '十': 10, '百': 100, '千': 1000 };
const CJK_BIG: Record<string, number> = { '万': 10000, '萬': 10000, '亿': 100000000, '億': 100000000 };

function cjkToNumber(s: string): number | null {
  // Handles mixed forms too: "1万2千", "三千五百", "十二", "两百", and the
  // colloquial "两百五" (250) / "一千五" (1500) where a lone trailing digit
  // means the next unit down.
  let total = 0;
  let section = 0;
  let current = 0;
  let sawAny = false;
  let digitBuf = '';
  let lastScale = 0;
  const flushDigits = () => { if (digitBuf) { current = Number(digitBuf); digitBuf = ''; } };
  for (const ch of s) {
    if (/\d/.test(ch)) { digitBuf += ch; sawAny = true; continue; }
    flushDigits();
    if (ch in CJK_DIGITS) { current = current * 10 + CJK_DIGITS[ch]; sawAny = true; }
    else if (ch in CJK_SMALL) { section += (current === 0 ? 1 : current) * CJK_SMALL[ch]; current = 0; lastScale = CJK_SMALL[ch]; sawAny = true; }
    else if (ch in CJK_BIG) { total += (section + (current === 0 && section === 0 ? 1 : current)) * CJK_BIG[ch]; section = 0; current = 0; lastScale = CJK_BIG[ch]; sawAny = true; }
    else return null;
  }
  flushDigits();
  if (!sawAny) return null;
  if (current > 0 && current < 10 && lastScale >= 100 && /[百千万萬]$/.test(s.replace(/[零〇一二两兩三四五六七八九\d]+$/, ''))) {
    current *= lastScale / 10;
  }
  return total + section + current;
}

/** Words that contain numeral characters but are not numbers (weekdays, "day before yesterday"...). */
const CJK_PROTECTED = /(?:星期[一二三四五六日天]|周[一二三四五六日天]|礼拜[一二三四五六日天]|[月火水木金土日]曜日?|一昨日|一昨年|一昨晩|十分|一下|一起|一样|一直|一些|一点|一会|第[一二三四五六七八九十]+|一日中|一日|万一|千代田|万年)/g;

/** Replaces runs of CJK numerals (optionally mixed with digits) with digits. */
export function cjkNumeralsToDigits(text: string): string {
  const saved: string[] = [];
  const protectedText = text.replace(CJK_PROTECTED, (m) => { saved.push(m); return `\u0000${saved.length - 1}\u0000`; });
  const converted = protectedText.replace(/[\d零〇一二两兩三四五六七八九十百千万萬亿億]+/g, (run) => {
    if (/^\d+$/.test(run)) return run;
    const n = cjkToNumber(run);
    return n == null ? run : String(n);
  });
  return converted.replace(/\u0000(\d+)\u0000/g, (_m, i: string) => saved[Number(i)]);
}

// ---------- Korean numerals ----------

const KO_DIGITS: Record<string, number> = { '영': 0, '공': 0, '일': 1, '이': 2, '삼': 3, '사': 4, '오': 5, '육': 6, '칠': 7, '팔': 8, '구': 9 };
const KO_SMALL: Record<string, number> = { '십': 10, '백': 100, '천': 1000 };
const KO_BIG: Record<string, number> = { '만': 10000, '억': 100000000 };

function koToNumber(s: string): number | null {
  let total = 0;
  let section = 0;
  let current = 0;
  let saw = false;
  let digitBuf = '';
  const flush = () => { if (digitBuf) { current = Number(digitBuf); digitBuf = ''; } };
  for (const ch of s) {
    if (/\d/.test(ch)) { digitBuf += ch; saw = true; continue; }
    flush();
    if (ch in KO_DIGITS) { current = current * 10 + KO_DIGITS[ch]; saw = true; }
    else if (ch in KO_SMALL) { section += (current === 0 ? 1 : current) * KO_SMALL[ch]; current = 0; saw = true; }
    else if (ch in KO_BIG) { total += (section + (current === 0 && section === 0 ? 1 : current)) * KO_BIG[ch]; section = 0; current = 0; saw = true; }
    else return null;
  }
  flush();
  return saw ? total + section + current : null;
}

/** "2만5천" -> "25000", "만원" -> "10000원", "3천" -> "3000". Pure-digit runs are left alone. */
export function koreanNumeralsToDigits(text: string): string {
  return text.replace(/\d+(?:\s?[십백천만억]\s?\d*)+|(?<![\p{L}])[일이삼사오육칠팔구십백천만억]{1,12}(?=원|\s|$|[^\p{L}])/gu, (run) => {
    const compact = run.replace(/\s+/g, '');
    if (/^\d+$/.test(compact)) return run;
    // Avoid eating ordinary words that happen to start with 일/이/사 etc: require a scale character.
    if (!/[십백천만억]/.test(compact)) return run;
    const n = koToNumber(compact);
    return n == null ? run : String(n);
  });
}
