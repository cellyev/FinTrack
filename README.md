# FinTrack — Mobile Finance Tracker

FinTrack is an offline-first personal-finance mobile app for students and young adults. It makes daily recording quick, then turns that ledger into budgets, savings progress, debt tracking, analytics, and exports.

## Product decisions that must not change

- Mobile-first: React Native, Expo, TypeScript.
- Local SQLite is the first write target; Supabase is the authenticated cloud replica.
- The transaction ledger is the source of truth for actual balances. Never persist `current_balance` as authoritative data.
- A transaction may contain multiple category splits. The split total equals the transaction amount.
- Supported ledger types are `income`, `expense`, `transfer`, and `opening_balance`.
- Accounts represent cash, bank, and e-wallet holdings. Savings goals are virtual allocations, never accounts or balance-moving transactions.
- IDs are UUIDs generated on-device. Deletions are soft deletes. Financial transactions may be edited or deleted only within seven calendar days.
- No AI features in the MVP.

## Documentation map

Start with [docs/00-agent-brief.md](docs/00-agent-brief.md), then follow [docs/12-roadmap.md](docs/12-roadmap.md). The full index is in [docs/README.md](docs/README.md).

## Intended stack

React Native + Expo + TypeScript, Expo SQLite, Zustand, TanStack Query, Zod, Supabase Auth/PostgreSQL/Storage/RLS/RPC, and Expo SecureStore/LocalAuthentication.

## Status

Documentation and database migration specification only. Application code has not been generated.

