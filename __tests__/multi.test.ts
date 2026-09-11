import { DEFAULT_CATEGORIES } from '@/lib/defaultCategories';
import { parseEntries, splitEntries, splitSentences, type ParseContext } from '@/parser';
import { getPack } from '@/parser/packs';
import type { Goal } from '@/types';

const TODAY = '2026-09-11';
function ctx(language = 'en', overrides: Partial<ParseContext> = {}): ParseContext {
  return { categories: DEFAULT_CATEGORIES, goals: [], keywordMap: {}, today: TODAY, language, ...overrides };
}

describe('splitEntries', () => {
  it('splits on "and" between two amounts', () => {
    expect(splitEntries("i spent $67.99 at macy's and $121.53 at fleming's steakhouse", getPack('en'))).toEqual(["i spent $67.99 at macy's", "$121.53 at fleming's steakhouse"]);
  });
  it('splits on commas and keeps a single entry whole', () => {
    expect(splitEntries('lunch 12, gas 40, coffee 4', getPack('en'))).toEqual(['lunch 12', 'gas 40', 'coffee 4']);
    expect(splitEntries('2 coffees for $9', getPack('en'))).toEqual(['2 coffees for $9']);
    expect(splitEntries('spent 12 on lunch', getPack('en'))).toEqual(['spent 12 on lunch']);
  });
});

describe('parseEntries', () => {
  it("handles: I spent $67.99 at Macy's and $121.53 at Fleming's Steakhouse", () => {
    const r = parseEntries("I spent $67.99 at Macy's and $121.53 at Fleming's Steakhouse", ctx());
    expect(r).toHaveLength(2);
    expect(r[0].amount).toBe(67.99);
    expect(r[0].type).toBe('expense');
    expect(r[0].categoryId).toBe('shopping');
    expect(r[0].note).toBe("Macy's");
    expect(r[1].amount).toBe(121.53);
    expect(r[1].type).toBe('expense');
    expect(r[1].categoryId).toBe('dining');
    expect(r[1].note).toBe("Fleming's Steakhouse");
    expect(r[1].hints).toEqual([]);
  });
  it('sends unknown places to Other with a hint to change it', () => {
    const r = parseEntries('spent $40 at Blorp Emporium and $9 at Zizzle', ctx());
    expect(r).toHaveLength(2);
    expect(r[0].categoryId).toBe('other_expense');
    expect(r[0].hints).toContain('hint.unsureCategory');
    expect(r[1].categoryId).toBe('other_expense');
    expect(r[1].note).toBe('Zizzle');
  });
  it('shares a leading date and verb across entries', () => {
    const r = parseEntries('yesterday I spent 12 on lunch and 40 on gas', ctx());
    expect(r.map((x) => x.occurredAt)).toEqual(['2026-09-10', '2026-09-10']);
    expect(r.map((x) => x.categoryId)).toEqual(['dining', 'transport']);
    expect(r[1].typeConfidence).toBeGreaterThanOrEqual(0.8);
  });
  it('shares an income verb', () => {
    const r = parseEntries('got paid 2400 and 300 from a freelance client', ctx());
    expect(r.map((x) => x.type)).toEqual(['income', 'income']);
    expect(r.map((x) => x.categoryId)).toEqual(['salary', 'freelance']);
  });
  it('does not split goals', () => {
    const r = parseEntries('goal: save 500 for a trip and 200 for a bike', ctx());
    expect(r).toHaveLength(1);
    expect(r[0].kind).toBe('goal');
  });
  it('does not split contributions', () => {
    const goals: Goal[] = [{ id: 'g1', name: 'Trip', targetAmount: 500, currentAmount: 0, targetDate: null, createdAt: '2026-08-01T00:00:00Z', completed: false }];
    const r = parseEntries('add 100 to the trip goal and 50 more', ctx('en', { goals }));
    expect(r).toHaveLength(1);
    expect(r[0].kind).toBe('contribution');
  });
  it('works in other languages', () => {
    const es = parseEntries('gasté 12 euros en el almuerzo y 40 de gasolina', ctx('es'));
    expect(es.map((x) => x.categoryId)).toEqual(['dining', 'transport']);
    const de = parseEntries('12 euro für mittagessen und 40 euro getankt', ctx('de'));
    expect(de.map((x) => x.categoryId)).toEqual(['dining', 'transport']);
    const zh = parseEntries('午饭花了12块，打车35块', ctx('zh'));
    expect(zh.map((x) => x.categoryId)).toEqual(['dining', 'transport']);
    const ja = parseEntries('ランチに1200円とタクシーに2500円使った', ctx('ja'));
    expect(ja.map((x) => x.amount)).toEqual([1200, 2500]);
    expect(ja.map((x) => x.categoryId)).toEqual(['dining', 'transport']);
    const ko = parseEntries('점심에 12000원 쓰고 택시비 25000원', ctx('ko'));
    expect(ko.map((x) => x.amount)).toEqual([12000, 25000]);
  });
});

describe('several sentences', () => {
  it('splits sentences and carries the verb and date forward', () => {
    const r = parseEntries("Yesterday I spent $67.99 at Macy's. Then I had dinner at Fleming's Steakhouse for $121.53. Also $9 at Zizzle!", ctx());
    expect(r).toHaveLength(3);
    expect(r.map((x) => x.amount)).toEqual([67.99, 121.53, 9]);
    expect(r.map((x) => x.categoryId)).toEqual(['shopping', 'dining', 'other_expense']);
    expect(r.map((x) => x.type)).toEqual(['expense', 'expense', 'expense']);
    expect(r.map((x) => x.occurredAt)).toEqual(['2026-09-10', '2026-09-10', '2026-09-10']);
    expect(r[2].hints).toContain('hint.unsureCategory');
  });
  it('keeps decimals and month abbreviations intact', () => {
    expect(splitSentences('Lunch was 12.50. Gas on Sept. 3 was 40.')).toEqual(['Lunch was 12.50.', 'Gas on Sept. 3 was 40.']);
  });
  it('mixes a goal sentence with an expense sentence', () => {
    const r = parseEntries('spent 12 on lunch. goal: save 500 for a trip by december', ctx());
    expect(r.map((x) => x.kind)).toEqual(['transaction', 'goal']);
  });
  it('a single ordinary sentence is unchanged', () => {
    const r = parseEntries('spent 12 dollars on lunch', ctx());
    expect(r).toHaveLength(1);
    expect(r[0].raw).toBe('spent 12 dollars on lunch');
  });
  it('handles Chinese and Korean sentences', () => {
    const zh = parseEntries('午饭花了12块。打车35块。', ctx('zh'));
    expect(zh.map((x) => x.categoryId)).toEqual(['dining', 'transport']);
    const ko = parseEntries('점심에 12000원 썼어. 택시비 25000원.', ctx('ko'));
    expect(ko.map((x) => x.amount)).toEqual([12000, 25000]);
    expect(ko.map((x) => x.type)).toEqual(['expense', 'expense']);
  });
});

describe('unknown places', () => {
  it("keeps the place as the note and falls back to Other when the merchant is unknown", () => {
    const [r] = parseEntries("Spent $32 at Joe's", ctx());
    expect(r.amount).toBe(32);
    expect(r.type).toBe('expense');
    expect(r.categoryId).toBe('other_expense');
    expect(r.note).toBe("Joe's");
    expect(r.hints).toContain('hint.unsureCategory');
    expect(r.needsReview).toBe(false);
  });
  it('keeps the casing the user typed for places', () => {
    const rows = parseEntries("I spent $67.99 at Macy's and $121.53 at Fleming's Steakhouse", ctx());
    expect(rows.map((r) => r.note)).toEqual(["Macy's", "Fleming's Steakhouse"]);
    const [tj] = parseEntries("$45 at Trader Joe's", ctx());
    expect(tj.note).toBe("Trader Joe's");
    expect(tj.categoryId).toBe('groceries');
  });
  it('handles a mix of known and unknown places across sentences', () => {
    const rows = parseEntries("Paid 15 at Bob's garage. Then 40 at the market and 12 at Luigi's.", ctx());
    expect(rows.map((r) => [r.amount, r.categoryId, r.note])).toEqual([
      [15, 'other_expense', "Bob's garage"],
      [40, 'groceries', 'Market'],
      [12, 'other_expense', "Luigi's"],
    ]);
  });
});
