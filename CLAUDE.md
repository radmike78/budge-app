# OnlyBudget — notes for future sessions

Read README.md first. The five product principles there are non-negotiable and every change must respect them: no bank linking, voice and text equal, no dark patterns, local-first with backup, calm not gamified.

- Pure logic (parser, plain-language sentences, recurring schedule, export, crypto) lives in `src/parser` and `src/lib` and must stay free of React Native imports so `npm test` covers it.
- The parser never saves anything on its own. Every path ends at `ConfirmationCard`.
- Copy in the UI is plain sentences. No "over budget!", no red states, no streaks.
- Every user-facing string comes from `useT()` / the locale tables in `src/i18n/locales`. Adding a key means adding it to all eight locale files (the `LocaleDef` type enforces it). Parser behavior per language lives in `src/parser/packs`.
- Schema changes go in a new entry of `MIGRATIONS` in `src/db/database.ts`. Never edit an existing migration.
- Parser kinds: transaction, goal (kind saving or debt), contribution, reminder. Reminder phrasing per language lives in the `reminder` block of each pack (lead words, clock times, repeat words, future days); shared helpers are in `src/parser/reminderRules.ts`. Notifications are scheduled only from `src/lib/reminders.ts`, and anything that saves a reminder must handle the permission being refused (tell the user, keep the reminder).
- The web build must keep working: `npm run build:web` (Metro config adds the SQLite wasm asset; nginx/dev server send COOP/COEP headers). Use `confirmDialog`/`notify` from `src/lib/dialogs.ts` instead of `Alert`, which is a no-op on web.
- Security rules (see docs/SECURITY.md): anything that crosses a trust boundary (user text, imported files, model replies) goes through `src/lib/validate.ts`; SQL is always parameterised; never build a RegExp from user data; no new outbound hosts; the web page has no inline scripts (CSP). `__tests__/security.test.ts` enforces these, and `npm run check:web-security` loads the web build under the real headers in headless Chromium.
- Run `npm test` and `npm run typecheck` before committing. `npx expo export --platform android` is a good smoke test for bundling.
