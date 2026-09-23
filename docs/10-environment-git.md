# Environment, configuration, and Git

## Prerequisites and packages

Use a current Expo SDK compatible with the selected React Native version, Node LTS, TypeScript, Supabase CLI, and a physical device/emulator. Core packages: `expo-sqlite`, `expo-secure-store`, `expo-local-authentication`, `expo-image-manipulator`, `expo-file-system`, `@supabase/supabase-js`, `zod`, `zustand`, TanStack Query, and a decimal-safe money library or integer-minor-unit module. Verify current compatibility before installing; pin lockfile versions.

## Configuration

```dotenv
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_ANON_KEY=
EXPO_PUBLIC_APP_ENV=development
EXPO_PUBLIC_SENTRY_DSN= # optional; scrub financial data
```

Only `EXPO_PUBLIC_*` values may enter the client bundle; they are not secrets. Keep `.env` untracked, provide `.env.example` without values, and store deployment secrets in the CI/hosting secret manager. Never expose `SUPABASE_SERVICE_ROLE_KEY` to Expo.

## Supabase setup

1. Create a Supabase project; configure Auth redirect/deep-link URLs and email templates.
2. Create migration from [06-supabase-schema.sql](06-supabase-schema.sql), apply with Supabase CLI, then seed system categories through a controlled function or onboarding use case.
3. Create private `receipts` bucket and its policies from migration.
4. Run RLS/RPC tests against local Supabase and a staging project before production.

## Git workflow

Protect `main`. Branch names: `feat/transaction-splits`, `fix/sync-tombstone`, `docs/agent-brief`. Make small conventional commits (`feat:`, `fix:`, `test:`, `docs:`, `chore:`). Each pull request states scope, tests, migration impact, security/RLS impact, screenshots for UI, and rollback notes. Do not mix schema migrations with unrelated refactors. Update `CHANGELOG.md` for user-visible changes.

