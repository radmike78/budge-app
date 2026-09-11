import { DEFAULT_CATEGORIES } from '@/lib/defaultCategories';
import { reminderSentence } from '@/lib/plain';
import { parseEntries, parseInput, type ParseContext } from '@/parser';
import { en } from '@/i18n/locales/en';
import { es } from '@/i18n/locales/es';

const TODAY = '2026-09-11'; // a Friday
const ctx = (language = 'en', nowTime = '14:00'): ParseContext => ({ categories: DEFAULT_CATEGORIES, goals: [], keywordMap: {}, today: TODAY, nowTime, language });

describe('spoken reminders', () => {
  it('reads a day of month and a clock time', () => {
    const r = parseInput('Remind me to pay rent on the 1st at 9am', ctx());
    expect(r).toMatchObject({ kind: 'reminder', reminderText: 'Pay rent', occurredAt: '2026-10-01', reminderTime: '09:00', reminderRepeat: 'none' });
    expect(r.hints).toEqual([]);
  });
  it('reads "every evening at 8" as daily at 20:00', () => {
    const r = parseInput('remind me to log my receipts every evening at 8', ctx());
    expect(r).toMatchObject({ kind: 'reminder', reminderText: 'Log my receipts', reminderTime: '20:00', reminderRepeat: 'daily' });
  });
  it('reads tomorrow with minutes', () => {
    expect(parseInput('Set a reminder to call the bank tomorrow at 10:30', ctx())).toMatchObject({ reminderText: 'Call the bank', occurredAt: '2026-09-12', reminderTime: '10:30' });
  });
  it('"next Friday" said on a Friday means a week from now', () => {
    expect(parseInput('Remind me next Friday to transfer 200 to savings', ctx())).toMatchObject({ reminderText: 'Transfer 200 to savings', occurredAt: '2026-09-18' });
  });
  it('reads weekly and monthly repeats with their day', () => {
    expect(parseInput('Remind me to check the budget every Monday morning', ctx())).toMatchObject({ reminderRepeat: 'weekly', occurredAt: '2026-09-14', reminderTime: '08:00', reminderText: 'Check the budget' });
    expect(parseInput('Remind me to pay the credit card on the 15th of every month at noon', ctx())).toMatchObject({ reminderRepeat: 'monthly', occurredAt: '2026-09-15', reminderTime: '12:00', reminderText: 'Pay the credit card' });
  });
  it('reads a month and day, and "in 3 days"', () => {
    expect(parseInput('remind me to cancel the gym on October 3rd', ctx())).toMatchObject({ occurredAt: '2026-10-03', reminderText: 'Cancel the gym' });
    expect(parseInput('remind me in 3 days to return the shoes', ctx())).toMatchObject({ occurredAt: '2026-09-14', reminderText: 'Return the shoes' });
  });
  it('picks tomorrow morning when nothing was said and it is already afternoon', () => {
    const r = parseInput('remind me to buy milk', ctx('en', '14:00'));
    expect(r).toMatchObject({ reminderText: 'Buy milk', occurredAt: '2026-09-12', reminderTime: '09:00' });
    expect(r.hints).toEqual(['hint.reminderTime', 'hint.reminderDate']);
    expect(parseInput('remind me to buy milk', ctx('en', '07:00')).occurredAt).toBe(TODAY);
  });
  it('asks for the text when only a time was said', () => {
    const r = parseInput('remind me at 5pm', ctx());
    expect(r.reminderText).toBeNull();
    expect(r.needsReview).toBe(true);
    expect(r.hints).toContain('hint.reminderText');
  });
  it('is never split into several entries', () => {
    const rows = parseEntries('Remind me to pay rent and the electric bill on the 1st at 9am', ctx());
    expect(rows).toHaveLength(1);
    expect(rows[0].kind).toBe('reminder');
  });
  it.each([
    ['es', 'Recuérdame pagar el alquiler el día 1 a las 9 de la mañana', 'Pagar el alquiler', '2026-10-01', '09:00', 'none'],
    ['es', 'Recuérdame mañana a las 10 llamar al banco', 'Llamar al banco', '2026-09-12', '10:00', 'none'],
    ['fr', 'Rappelle-moi de payer le loyer le 1er à 9h', 'Payer le loyer', '2026-10-01', '09:00', 'none'],
    ['fr', 'Rappelle-moi chaque soir à 20h de noter mes dépenses', 'Noter mes dépenses', TODAY, '20:00', 'daily'],
    ['it', 'Ricordami di pagare l’affitto il primo alle 9', "Pagare l'affitto", '2026-10-01', '09:00', 'none'],
    ['de', 'Erinnere mich morgen um 8 Uhr daran, die Miete zu zahlen', 'Die Miete zu zahlen', '2026-09-12', '08:00', 'none'],
    ['de', 'Erinnere mich jeden Montag an den Wochenbericht', 'Wochenbericht', '2026-09-14', '09:00', 'weekly'],
    ['zh', '明天早上8点提醒我交房租', '交房租', '2026-09-12', '08:00', 'none'],
    ['zh', '每天晚上9点提醒我记账', '记账', TODAY, '21:00', 'daily'],
    ['ja', '明日の朝8時に家賃を払うようリマインドして', '家賃を払う', '2026-09-12', '08:00', 'none'],
    ['ja', '毎晩9時に家計簿をつけるように教えて', '家計簿をつける', TODAY, '21:00', 'daily'],
    ['ko', '내일 아침 8시에 월세 내라고 알려줘', '월세 내', '2026-09-12', '08:00', 'none'],
    ['ko', '매주 월요일에 예산 확인하라고 알려줘', '예산 확인', '2026-09-14', '09:00', 'weekly'],
  ])('%s: "%s"', (lang, text, body, date, time, repeat) => {
    const r = parseInput(text, ctx(lang));
    expect(r.kind).toBe('reminder');
    expect(r.reminderText).toBe(body);
    expect(r.occurredAt).toBe(date);
    expect(r.reminderTime).toBe(time);
    expect(r.reminderRepeat).toBe(repeat);
  });
});

describe('reminder sentence', () => {
  const base = { id: 'r', text: 'Pay rent', notificationId: null, createdAt: '' };
  it('describes each repeat in plain words', () => {
    expect(reminderSentence({ ...base, date: '2026-10-01', time: '09:00', repeat: 'none' }, TODAY, en)).toBe('Thu, Oct 1 at 09:00');
    expect(reminderSentence({ ...base, date: '2026-09-11', time: '20:00', repeat: 'daily' }, TODAY, en)).toBe('Every day at 20:00');
    expect(reminderSentence({ ...base, date: '2026-09-14', time: '08:00', repeat: 'weekly' }, TODAY, en)).toBe('Every Mon at 08:00');
    expect(reminderSentence({ ...base, date: '2026-09-15', time: '12:00', repeat: 'monthly' }, TODAY, en)).toBe('On the 15th of every month at 12:00');
    expect(reminderSentence({ ...base, date: '2026-09-15', time: '12:00', repeat: 'monthly' }, TODAY, es)).toBe('El día 15 de cada mes a las 12:00');
  });
});
