# Antigravity implementation brief

## Mission

Implement FinTrack as a secure, offline-first React Native application. Deliver each roadmap phase independently, with tests and a short change note. Do not introduce capabilities outside the approved scope merely because a library makes them easy.

## Non-negotiable invariants

1. Write locally first; the user must be able to record transactions without a network.
2. Generate UUIDs on the device before inserting any domain record.
3. Treat transactions as immutable ledger facts after the correction window; corrections after seven days require a future product decision, not a silent bypass.
4. Never derive actual balance from a cached account field. Derive it from active ledger rows.
5. Income and expense require one or more category splits totalling the transaction amount. Transfers and opening balances have none.
6. Money is stored as positive numeric values; direction is encoded by type. Client calculations must use a decimal-safe money value, never JavaScript floating point.
7. Savings allocations only reserve visibility of money. They do not alter account balance or create a ledger row.
8. Call privileged database RPCs for financial writes once online. Do not grant direct client insert/update/delete on financial tables.
9. Preserve tombstones (`deleted_at`) during sync. Never physically delete synced domain records in the MVP.
10. Keep AI, investment tracking, gamification, payment/bank integrations, and predictive recommendations out of MVP.

## Delivery rules

- Read the relevant numbered document before changing that layer.
- Work one roadmap phase at a time. Do not build later screens as placeholders that leak unfinished behavior.
- Validate all input at the UI boundary and again in the domain use case; database RPC is the final authority.
- Use migrations; never change production schema manually in the Supabase dashboard.
- Avoid logging transaction notes, amounts, tokens, email addresses, or storage signed URLs.
- Record any deviation, library substitution, or unresolved ambiguity in `docs/11-open-decisions.md` and `CHANGELOG.md`.

## Definition of done per increment

- User-visible behavior and error/empty/loading states work offline.
- Tests cover new domain rules and critical user paths.
- RLS remains enabled and tested with two distinct users.
- Sync remains retry-safe and does not duplicate operations.
- Lint, typecheck, unit tests, and relevant device smoke tests pass.

