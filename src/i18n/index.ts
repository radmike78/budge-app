import { getLocales } from 'expo-localization';
import { useAppStore } from '@/store/useAppStore';
import { formatMoney } from '@/lib/money';
import type { DateFormat } from '@/lib/dates';
import { de } from './locales/de';
import { en } from './locales/en';
import { es } from './locales/es';
import { fr } from './locales/fr';
import { it } from './locales/it';
import { ja } from './locales/ja';
import { ko } from './locales/ko';
import { zh } from './locales/zh';
import type { LocaleDef, Strings } from './types';

export type { LocaleDef, Strings } from './types';

/** Registered locales. Add a new locale file and list it here. */
export const LOCALES: Record<string, LocaleDef> = { en };

export const LANGUAGE_OPTIONS: { code: string; name: string }[] = [];

export function registerLocale(def: LocaleDef): void {
  LOCALES[def.code] = def;
  if (!LANGUAGE_OPTIONS.some((o) => o.code === def.code)) LANGUAGE_OPTIONS.push({ code: def.code, name: def.name });
}
for (const def of [en, es, fr, it, de, zh, ja, ko]) registerLocale(def);

/** Best supported language for the phone's settings ("es-MX" -> "es", "zh-Hant-TW" -> "zh"). */
export function deviceLanguage(): string {
  try {
    for (const l of getLocales()) {
      const code = (l.languageCode ?? l.languageTag.split('-')[0]).toLowerCase();
      if (LOCALES[code]) return code;
    }
  } catch {
    // no native module (tests, web without polyfill)
  }
  return 'en';
}

export function resolveLanguage(setting: string | null | undefined): string {
  if (setting && setting !== 'system' && LOCALES[setting]) return setting;
  return deviceLanguage();
}

export function getLocale(code: string | null | undefined): LocaleDef {
  return LOCALES[resolveLanguage(code)] ?? en;
}

/** The active locale definition (strings, sentences, formats). */
export function useLocale(): LocaleDef {
  const setting = useAppStore((s) => s.settings?.language ?? 'system');
  return getLocale(setting);
}

/** Shorthand for the UI string table. */
export function useT(): Strings {
  return useLocale().s;
}

export function useLanguageCode(): string {
  const setting = useAppStore((s) => s.settings?.language ?? 'system');
  return resolveLanguage(setting);
}

/** Display name for a category: default categories are translated, custom ones keep their name. */
export function categoryName(cat: { id: string; name: string; isDefault: boolean } | null | undefined, s: Strings): string {
  if (!cat) return s.uncategorized;
  if (cat.isDefault && s.categoryNames[cat.id]) return s.categoryNames[cat.id];
  return cat.name;
}

/** Money formatter bound to the user's currency and locale. */
export function useMoney(): (amount: number, opts?: { compact?: boolean }) => string {
  const currency = useAppStore((s) => s.settings?.currency ?? 'USD');
  const locale = useLocale();
  return (amount, opts) => formatMoney(amount, currency, { compact: opts?.compact, format: locale.format });
}

/** Date format for friendlyDate/longDate/monthLabel in the active locale. */
export function useDateFormat(): DateFormat {
  const locale = useLocale();
  return { ...locale.format, today: locale.s.today, yesterday: locale.s.yesterday };
}

export function dateFormatFor(locale: LocaleDef): DateFormat {
  return { ...locale.format, today: locale.s.today, yesterday: locale.s.yesterday };
}

/** Translates a parser hint key; unknown keys pass through. */
export function hintText(key: string, s: Strings): string {
  return s.hints[key] ?? key;
}
