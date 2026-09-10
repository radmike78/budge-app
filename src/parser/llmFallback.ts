/**
 * Tier 2 parsing assist. OFF by default. Only runs when:
 *   - the user turned it on in Settings and pasted their own API key,
 *   - the Tier 1 parser was not confident,
 *   - the device has a connection (an 8s timeout guards against hanging offline).
 * The phrase (and category names) are the only things sent. If anything fails,
 * the caller falls back to "review manually" with the Tier 1 result.
 */
import Anthropic from '@anthropic-ai/sdk';
import type { Category, TxType } from '@/types';
import type { ParseResult } from './index';

export const LLM_MODEL = 'claude-opus-5';

interface LlmParsed {
  amount: number | null;
  type: TxType;
  category: string | null;
  note: string | null;
  kind: 'transaction' | 'goal';
  goal_name: string | null;
  target_date: string | null;
}

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['amount', 'type', 'category', 'note', 'kind', 'goal_name', 'target_date'],
  properties: {
    amount: { type: ['number', 'null'], description: 'Money amount as a positive number, or null if none is present.' },
    type: { type: 'string', enum: ['income', 'expense'] },
    category: { type: ['string', 'null'], description: 'Exactly one of the provided category names, or null.' },
    note: { type: ['string', 'null'], description: 'Short human note (2-5 words) describing the entry, or null.' },
    kind: { type: 'string', enum: ['transaction', 'goal'] },
    goal_name: { type: ['string', 'null'] },
    target_date: { type: ['string', 'null'], description: 'YYYY-MM-DD if the phrase names a deadline, else null.' },
  },
} as const;

export async function llmParse(
  raw: string,
  categories: Category[],
  apiKey: string,
  today: string,
  timeoutMs = 8000,
): Promise<Partial<ParseResult> | null> {
  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true, maxRetries: 0, timeout: timeoutMs });
  const active = categories.filter((c) => !c.archived);
  const names = active.map((c) => `${c.name} (${c.kind})`).join(', ');
  try {
    const response = await client.messages.create({
      model: LLM_MODEL,
      max_tokens: 1024,
      output_config: { effort: 'low', format: { type: 'json_schema', schema: SCHEMA } },
      system:
        'You turn one short budgeting phrase into a structured entry. Categories available: ' +
        names +
        `. Today is ${today}. Pick the closest category; use null only when nothing fits. Amounts are always positive. ` +
        'A phrase about wanting to save a target amount for something is kind "goal". Do not invent an amount.',
      messages: [{ role: 'user', content: raw }],
    });
    if (response.stop_reason === 'refusal') return null;
    const text = response.content.find((b) => b.type === 'text')?.text;
    if (!text) return null;
    const parsed = JSON.parse(text) as LlmParsed;
    const category = parsed.category ? active.find((c) => c.name.toLowerCase() === parsed.category!.toLowerCase()) : undefined;
    const out: Partial<ParseResult> = {
      amount: parsed.amount != null && Number.isFinite(parsed.amount) ? Math.round(Math.abs(parsed.amount) * 100) / 100 : null,
      type: parsed.type,
      typeConfidence: 0.8,
      categoryId: category?.id ?? null,
      categoryConfidence: category ? 0.8 : 0.3,
      note: parsed.note,
      confidence: 0.75,
    };
    if (parsed.kind === 'goal') {
      out.kind = 'goal';
      out.goalName = parsed.goal_name;
      out.targetDate = parsed.target_date && /^\d{4}-\d{2}-\d{2}$/.test(parsed.target_date) ? parsed.target_date : null;
    }
    return out;
  } catch {
    // Offline, bad key, rate limit, malformed JSON: all lead to "review manually".
    return null;
  }
}
