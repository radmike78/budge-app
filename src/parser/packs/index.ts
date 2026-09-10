import type { LanguagePack } from '../types';
import { de } from './de';
import { en } from './en';
import { es } from './es';
import { fr } from './fr';
import { it } from './it';
import { ja } from './ja';
import { ko } from './ko';
import { zh } from './zh';

export const PACKS: Record<string, LanguagePack> = { en, es, fr, it, de, zh, ja, ko };

export function getPack(code: string | null | undefined): LanguagePack {
  if (code && PACKS[code]) return PACKS[code];
  return en;
}

export const SUPPORTED_LANGUAGES = Object.keys(PACKS);
