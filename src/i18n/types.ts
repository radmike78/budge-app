import type { en } from './locales/en';

/** Every locale must provide exactly the shape of the English reference. */
export type LocaleDef = typeof en;
export type Strings = LocaleDef['s'];
export type Sentences = LocaleDef['sentences'];
export type LocaleFormat = LocaleDef['format'];
