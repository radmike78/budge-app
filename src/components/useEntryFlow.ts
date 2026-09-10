import { useCallback, useState } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { today } from '@/lib/dates';
import { getApiKey } from '@/lib/secrets';
import { parseInput, type ParseResult } from '@/parser';
import { llmParse } from '@/parser/llmFallback';

/**
 * Text and voice both land here: parse (Tier 1), optionally escalate (Tier 2),
 * then hand the result to the confirmation card. Nothing is saved silently.
 */
export function useEntryFlow() {
  const [pending, setPending] = useState<ParseResult | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = useCallback(async (raw: string) => {
    const text = raw.trim();
    if (!text) return;
    const { categories, goals, keywordMap, settings } = useAppStore.getState();
    const ctx = { categories, goals, keywordMap, today: today() };
    let result = parseInput(text, ctx);

    if (result.needsReview && settings?.smartParseEnabled) {
      setBusy(true);
      try {
        const key = await getApiKey();
        if (key) {
          const assist = await llmParse(text, categories, key, ctx.today);
          if (assist) {
            result = {
              ...result,
              ...assist,
              kind: assist.kind ?? (result.kind === 'unknown' ? 'transaction' : result.kind),
              hints: [],
              needsReview: assist.amount == null,
            };
            if (result.amount == null) result.hints = ["I still couldn't find an amount."];
          } else {
            result.hints = [...result.hints, 'Smart assist is unavailable right now, so please check the fields.'];
          }
        }
      } finally {
        setBusy(false);
      }
    }
    if (result.kind === 'unknown') result = { ...result, kind: 'transaction' };
    setPending(result);
  }, []);

  const dismiss = useCallback(() => setPending(null), []);

  return { pending, busy, submit, dismiss };
}
