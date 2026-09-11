import { useCallback, useState } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { today } from '@/lib/dates';
import { getApiKey } from '@/lib/secrets';
import { parseEntries, type ParseResult } from '@/parser';
import { llmParse } from '@/parser/llmFallback';
import { resolveLanguage } from '@/i18n';
import { HINT } from '@/parser';
import { cleanEntry } from '@/lib/validate';

/**
 * Text and voice both land here: parse (Tier 1), optionally escalate (Tier 2),
 * then hand the result to a confirmation card. One expense goes to the single
 * card; several in one utterance go to the multi-entry card. Nothing is saved silently.
 */
export function useEntryFlow() {
  const [pending, setPending] = useState<ParseResult | null>(null);
  const [pendingMany, setPendingMany] = useState<ParseResult[] | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = useCallback(async (raw: string) => {
    const text = cleanEntry(raw);
    if (!text) return;
    const { categories, goals, keywordMap, settings } = useAppStore.getState();
    const now = new Date();
    const nowTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const ctx = { categories, goals, keywordMap, today: today(), nowTime, language: resolveLanguage(settings?.language) };
    const entries = parseEntries(text, ctx);
    if (entries.length > 1) {
      // Several expenses in one go: each becomes its own row on the card.
      setPending(null);
      setPendingMany(entries.map((e) => (e.kind === 'unknown' ? { ...e, kind: 'transaction' as const } : e)));
      return;
    }
    let result = entries[0];

    if (result.needsReview && settings?.smartParseEnabled) {
      setBusy(true);
      try {
        const key = await getApiKey();
        if (key) {
          const assist = await llmParse(text, categories, key, ctx.today, ctx.language);
          if (assist) {
            result = {
              ...result,
              ...assist,
              kind: assist.kind ?? (result.kind === 'unknown' ? 'transaction' : result.kind),
              hints: [],
              needsReview: assist.amount == null,
            };
            if (result.amount == null) result.hints = [HINT.stillNoAmount];
          } else {
            result.hints = [...result.hints, HINT.assistUnavailable];
          }
        }
      } finally {
        setBusy(false);
      }
    }
    if (result.kind === 'unknown') result = { ...result, kind: 'transaction' };
    setPendingMany(null);
    setPending(result);
  }, []);

  const dismiss = useCallback(() => { setPending(null); setPendingMany(null); }, []);

  return { pending, pendingMany, busy, submit, dismiss };
}
