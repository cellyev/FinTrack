# Implementation roadmap

## Phase 0 — Foundation

Create Expo TypeScript app, lint/typecheck/test tooling, tokens, environment validation, Supabase local setup, migrations, Auth shell, SecureStore session handling, and SQLite migration framework. Gate: two-user RLS tests and clean empty/auth states pass.

## Phase 1 — Ledger core

Implement accounts/categories/onboarding opening balances, transaction domain, local atomic repository, add/history/detail, derived balances, and local outbox. Gate: offline income/expense/transfer/opening balance behave correctly; split sum and seven-day rules tested.

## Phase 2 — Cloud synchronization

Implement schema/RPC migration, pull/push cursor sync, idempotency, tombstones, conflicts, retry UX, and attachment two-phase sync. Gate: airplane-mode record then reconnect converges without duplicate entries; cross-user access is rejected.

## Phase 3 — Planning and obligations

Implement manual budgets + transparent recommendations, savings virtual allocations, debt/receivable flow after decision approval, and recurring templates/generation. Gate: calculations agree with test ledger fixtures and never affect actual balance incorrectly.

## Phase 4 — Insight, privacy, and export

Implement dashboard/analytics, alerts, receipt compression/private upload, CSV export, PIN/biometric app lock, accessibility audit, and tablet responsive layout. Gate: end-to-end critical paths and accessibility/security checklist pass.

## Phase 5 — Release hardening

Performance profiling with realistic local data, migration/backup recovery rehearsal, error monitoring with redaction, store metadata/privacy disclosure, staged release, and feedback triage. AI remains out of scope.

At each gate, update README, CHANGELOG, test evidence, and any new decision before moving forward.

