# Offline-first data and synchronization

## Local persistence

Mirror relevant Supabase entities in Expo SQLite, adding device-only columns: `sync_state` (`synced|pending|failed|conflict`), `base_updated_at`, `last_error`, and an outbox table. Create all UUIDs locally. A user action executes one SQLite transaction: validate, write parent/children/tombstone, update local projection, enqueue an idempotent operation. UI then returns success as `Saved on this device` when offline/pending.

Attachments follow a two-phase outbox flow: compress locally, create transaction locally, enqueue metadata and file upload. Never block recording while an attachment upload waits.

## Sync protocol

1. On authenticated startup, network restoration, foreground, or manual retry, acquire a single sync mutex.
2. Pull remote changes newer than saved cursor, including tombstones; apply each in a SQLite transaction.
3. Push outbox records in causal order: masters/accounts/categories → transactions/splits → attachments → dependent records.
4. Financial operations call RPC with operation UUID/idempotency key. Retry of the same key must return the original outcome, not insert again.
5. Mark acknowledged records synced; retain failures with actionable error. Pull again to converge.

Use cursor pagination, bounded batches, exponential backoff with jitter, and a visible sync status. Do not rely solely on Realtime for correctness; it is an optimization for an online foreground session.

## Conflicts

- Create collision: UUID uniqueness makes it effectively impossible; report rather than regenerate silently.
- Remote tombstone wins over a pending local edit; preserve local draft and ask the user to recreate if appropriate.
- Same record edited on two devices: compare `base_updated_at` with remote revision. Mark conflict and show local/remote values. For financial transaction conflicts, do not auto-merge splits.
- Master-data conflict: remote state is safe default, with explicit local copy/retry option for a custom category.

## Local schema principles

SQLite tables mirror server IDs and typed fields, but can store money as integer minor units for exact calculations. Keep a `schema_version` migration system. Encrypting the entire SQLite database is an open decision; secrets must never be stored there unencrypted.

