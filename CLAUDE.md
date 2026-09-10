# OnlyBudget — notes for future sessions

Read README.md first. The five product principles there are non-negotiable and every change must respect them: no bank linking, voice and text equal, no dark patterns, local-first with backup, calm not gamified.

- Pure logic (parser, plain-language sentences, recurring schedule, export, crypto) lives in `src/parser` and `src/lib` and must stay free of React Native imports so `npm test` covers it.
- The parser never saves anything on its own. Every path ends at `ConfirmationCard`.
- Copy in the UI is plain sentences. No "over budget!", no red states, no streaks.
- Every user-facing string comes from `useT()` / the locale tables in `src/i18n/locales`. Adding a key means adding it to all eight locale files (the `LocaleDef` type enforces it). Parser behavior per language lives in `src/parser/packs`.
- Schema changes go in a new entry of `MIGRATIONS` in `src/db/database.ts`. Never edit an existing migration.
- The web build must keep working: `npm run build:web` (Metro config adds the SQLite wasm asset; nginx/dev server send COOP/COEP headers). Use `confirmDialog`/`notify` from `src/lib/dialogs.ts` instead of `Alert`, which is a no-op on web.
- Run `npm test` and `npm run typecheck` before committing. `npx expo export --platform android` is a good smoke test for bundling.
