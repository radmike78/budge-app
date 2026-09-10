/**
 * Converts spoken number words into digits so the amount regex can find them:
 *   "twelve dollars"            -> "12 dollars"
 *   "two hundred and fifty"     -> "250"
 *   "twenty-five fifty"         -> "25 50"  (left as two numbers; caller decides)
 *   "a hundred bucks"           -> "100 bucks"
 *   "2.4k" / "2k"               -> "2400" / "2000"
 */

const UNITS: Record<string, number> = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9,
  ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16,
  seventeen: 17, eighteen: 18, nineteen: 19,
};
const TENS: Record<string, number> = {
  twenty: 20, thirty: 30, forty: 40, fourty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90,
};
const SCALES: Record<string, number> = { hundred: 100, thousand: 1000, grand: 1000, million: 1_000_000 };

function isNumberWord(w: string): boolean {
  return w in UNITS || w in TENS || w in SCALES;
}

/** Parses a run of number words into a value. Returns null if the run is not a valid number. */
function wordsToNumber(words: string[]): number | null {
  let total = 0;
  let current = 0;
  let sawAny = false;
  for (const w of words) {
    if (w === 'and') continue;
    if (w === 'a' || w === 'an') {
      current = current === 0 ? 1 : current;
      continue;
    }
    if (w in UNITS) {
      current += UNITS[w];
      sawAny = true;
    } else if (w in TENS) {
      current += TENS[w];
      sawAny = true;
    } else if (w === 'hundred') {
      current = (current === 0 ? 1 : current) * 100;
      sawAny = true;
    } else if (w in SCALES) {
      total += (current === 0 ? 1 : current) * SCALES[w];
      current = 0;
      sawAny = true;
    } else {
      return null;
    }
  }
  return sawAny ? total + current : null;
}

export function replaceNumberWords(text: string): string {
  // "2.4k" / "2k" / "1,5k" -> thousands
  let out = text.replace(/\b(\d+(?:[.,]\d+)?)k\b/gi, (_, n: string) => String(Math.round(parseFloat(n.replace(',', '.')) * 1000)));

  const tokens = out.split(/(\s+|-)/); // keep separators so we can rebuild spacing
  const words = tokens.filter((t) => !/^(\s+|-)$/.test(t));
  // Work on word indices, then rebuild.
  const result: string[] = [];
  let i = 0;
  while (i < words.length) {
    const w = words[i].toLowerCase().replace(/[^a-z]/g, '');
    const startsRun = isNumberWord(w) || ((w === 'a' || w === 'an') && i + 1 < words.length && ['hundred', 'thousand', 'grand', 'million'].includes(words[i + 1].toLowerCase()));
    if (!startsRun) {
      result.push(words[i]);
      i += 1;
      continue;
    }
    // Extend the run as far as it stays a valid number phrase.
    let j = i;
    const run: string[] = [];
    while (j < words.length) {
      const cw = words[j].toLowerCase().replace(/[^a-z]/g, '');
      if (isNumberWord(cw) || cw === 'and' || ((cw === 'a' || cw === 'an') && run.length === 0)) {
        // "and" is only allowed inside a run that continues with a number word.
        if (cw === 'and') {
          const next = j + 1 < words.length ? words[j + 1].toLowerCase().replace(/[^a-z]/g, '') : '';
          if (!isNumberWord(next)) break;
        }
        run.push(cw);
        j += 1;
      } else {
        break;
      }
    }
    const value = wordsToNumber(run);
    if (value === null) {
      result.push(words[i]);
      i += 1;
      continue;
    }
    // Preserve trailing punctuation of the last word in the run (e.g. "twelve.")
    const trailing = words[j - 1].match(/[^a-z]+$/i)?.[0] ?? '';
    result.push(String(value) + trailing);
    i = j;
  }
  out = result.join(' ');
  return out.replace(/\s+/g, ' ').trim();
}
