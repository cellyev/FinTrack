# UI/UX, navigation, and HCI

## Navigation

Bottom tabs: **Home**, **History**, central **Add**, **Plan** (Budget/Goals), **Profile**. Add opens a focused type picker: Expense, Income, Transfer; Opening Balance is available only in account setup/detail. Nested stacks host account/category management, analytics, debts, recurring, export, settings, and help.

```text
Launch → session restore → app lock (if due) → onboarding/auth or Home
Home → Add → type → form → review/save → success → Home/History
History → detail → edit/delete (only when eligible)
Plan → Budget | Savings Goal | Debt | Recurring
Profile → Accounts | Categories | Export | Settings
```

## Primary flows

**Expense:** choose account → enter amount → select one or more expense categories/split amounts → date/note/receipt optional → review → save. Show split-total mismatch inline and disable confirmation until valid.

**Transfer:** choose different source/destination → amount/date/note → confirm. Never show categories.

**Budget:** choose period/name → optionally overall limit → add category limits → review. Dashboard alerts link to filtered spending.

**Savings:** create goal → select account and allocation amount → confirm virtual reservation; show actual balance and available-after-allocation distinctly.

## HCI rules

| Principle | Applied decision |
|---|---|
| Fitts’ Law | Large, thumb-reachable central Add action and ≥44×44 pt targets |
| Hick’s Law | Show 3 common transaction types first; put rarer actions in contextual screens |
| Recognition over recall | Icon/name category grid with recent selections and search |
| Cognitive load | Home prioritizes balance, add action, budget status, and recent transactions; progressive disclosure for analytics |
| Nielsen: visibility | Pending sync, save, validation, and budget feedback are explicit |
| Nielsen: error prevention | Account/type-specific forms; preview transfer direction; confirm destructive action |
| Gestalt/hierarchy | Group account, amount, category splits, and optional details in distinct sections |

## Accessibility and states

Use semantic labels, dynamic type, screen-reader order, contrast meeting WCAG AA, non-color status signals, and large touch targets. Respect reduced motion. Every data surface defines loading skeleton, empty explanation + action, retryable error, offline/pending indicator, and confirmation feedback. Never rely on hover; use pressed/disabled/focus states appropriate to touch and tablet/keyboard use.

