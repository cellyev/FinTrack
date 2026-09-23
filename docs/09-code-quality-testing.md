# Coding conventions and test strategy

## Conventions

Use TypeScript strict mode. Prefer explicit domain types and discriminated unions over optional-field bags. Names: `camelCase` variables/functions, `PascalCase` types/components, `kebab-case` files, `SCREAMING_SNAKE_CASE` environment constants. One component/use case per file when practical. No `any`, unsafe casts, direct fetch/Supabase in screens, or floating-point money arithmetic.

Validate form and RPC DTOs with Zod. Throw/carry typed errors (`ValidationError`, `ConflictError`, `UnauthorizedError`, `SyncError`) and map them to user-safe messages in presentation. Use formatter/linter/import ordering in CI. Document public interfaces; comments explain why, not syntax.

## Test pyramid

- Unit: money arithmetic, date/edit-window policy, transaction validation, balance/budget/allocation formulas, recurring schedule/idempotency.
- Repository/integration: SQLite migrations and atomic writes; Supabase RPC constraints, RLS, trigger behavior, and Storage policies.
- Component: forms, accessibility labels, validation, pending/offline states.
- E2E/device: sign in; offline expense then reconnect; transfer; split mismatch; edit/delete eligibility; budget display; lock/unlock; receipt upload; CSV export.

Use fixed clocks/time zones, factories with non-sensitive data, and two-user RLS fixtures. Critical acceptance cases: duplicate sync retry creates one ledger entry, deleted remote transaction does not reappear, and account balance always equals active ledger calculation.

