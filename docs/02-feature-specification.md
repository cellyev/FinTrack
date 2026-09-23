# Feature specification

## Accounts and categories

Users create active accounts of `cash`, `bank`, or `ewallet`. Account balance is calculated from active transactions: destinations add; sources subtract. Deactivating an account preserves history and forbids new entries. An opening balance is a `opening_balance` transaction into an account, never a separate `initial_balance` field.

System categories are seeded per user and may be used but not renamed/deleted. Custom categories belong to one user and have a type (`income` or `expense`), name, icon, color, active state, and ordering. Existing transactions retain their category link when a category is deactivated.

## Transactions

| Type | Accounts | Splits | Balance effect |
|---|---|---|---|
| Income | destination required; source null | 1+ income splits | destination increases |
| Expense | source required; destination null | 1+ expense splits | source decreases |
| Transfer | both required and different | none | source decreases, destination increases |
| Opening balance | destination required; source null | none | destination increases |

Every record includes client UUID, owner, positive amount, date, optional note, creation/update timestamps, optional soft-delete timestamp, and sync metadata locally. For income/expense, split amounts must exactly equal the transaction amount. A receipt is optional and may be attached only after the parent transaction exists locally.

Transaction detail shows type, accounts, splits, amount, date, note, attachments, related debt/recurring source, and sync state. Edits/deletes are allowed only before `transaction_date + 7 calendar days`; server time/RPC makes the final decision. A delete is a soft delete and immediately updates derived UI locally.

## Budgets and recommendations

A budget has a date range, optional overall cap, and unique per-category caps. Spending is derived only from non-deleted expense splits dated in range; transfers, opening balances, and income are excluded. Display spent, remaining, percent, and warning state. Manual entry is always available. Recommendation is explanatory only: propose a category cap from a documented past-period aggregate; it never changes a budget until user accepts it.

## Savings goals

A goal has a name, target amount, optional target date/icon/color, and active/completed/archived status. Allocation adds a positive virtual reservation tied to a goal and account; it does not move money. Available money is `sum(actual active account balances) - sum(active allocations)`. The app must warn when allocations exceed available money; the exact enforcement policy remains open.

## Debt and receivable

`lent` means another person owes the user; `borrowed` means the user owes another person. A debt stores principal, remaining amount, person, optional due date and note. Creating the debt and cash movement must be coordinated through a later approved flow/RPC (see open decisions). Repayments create a linked transaction and reduce remaining amount; the database calculates/revalidates remaining value.

## Recurring transactions

Templates support income/expense only, account, category, amount, note, schedule frequency, start/end date, next occurrence, and active state. A local job generates each due occurrence once with an idempotency key, then syncs it. The user can edit or deactivate the template; generated transactions retain their provenance and obey the normal seven-day correction rule.

## Attachments, export, and alerts

Receipts are optional images. Compress and strip EXIF location metadata before upload, keep metadata and storage path, and use a private per-user bucket path. Export uses only active ledger data for a selected range and filters; CSV is MVP. In-app alerts cover budget thresholds and upcoming recurring/debt dates; push scheduling policy is open.

