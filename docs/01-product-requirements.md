# Product overview and requirements

## Vision

FinTrack helps students and young adults record daily money movement in seconds, understand spending, plan manual budgets, and build savings habits without requiring an internet connection.

## Target users and jobs

Primary users are ages 18–25, comfortable with smartphones and digital wallets, but prone to forgotten entries, overspending, and weak savings awareness.

| Job | Success outcome |
|---|---|
| Record a purchase | an expense is saved in under 10 seconds, even offline |
| Know available money | see real account total and separately see money reserved for goals |
| Stay within a plan | see monthly/category budget usage before and after spending |
| Understand patterns | inspect category and time-period spending from ledger data |
| Track obligations | see outstanding lent/borrowed balances and register repayments |

## MVP scope

- Email/password authentication and session recovery.
- Multiple cash, bank, and e-wallet accounts; opening balances.
- Master categories plus user-created categories.
- Income, expense, transfer, and opening-balance entries; multi-category splits for income/expense.
- History, search/filter, detail, and edits/deletes within seven days.
- Manual budgets and transparent, deterministic recommendations based on prior spending.
- Virtual savings goals and allocations.
- Debt/receivable records and repayment-linked transactions.
- Recurring income/expense templates and generated occurrences.
- Optional compressed receipt attachment.
- Dashboard, basic analytics, notifications/in-app alerts, CSV export (PDF is an open decision).
- Offline-first sync and app re-entry PIN/biometric lock.

## Explicitly out of MVP

- AI assistant/insights, prediction, chat.
- Investment or asset-market tracking.
- Gamification, bank aggregation, payment initiation, shared accounts, multi-currency conversion, web dashboard.

## Non-functional requirements

- Core recording works without connectivity.
- User A cannot read or mutate User B data, including receipts.
- Financial writes are idempotent under retries.
- Common local screens render quickly with a few thousand transactions; paginate history and aggregate locally.
- Indonesian rupiah is the default display currency; profile currency is stored. Cross-currency behavior is not yet approved.
- All screens expose loading, empty, error, success/confirmation, and offline/pending-sync states where applicable.

