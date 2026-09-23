# Open decisions

These are deliberately unresolved. Antigravity must not choose silently when implementation reaches them.

| Decision | Options / impact |
|---|---|
| Currency scope | Single display currency only vs multi-currency accounts and FX rates. MVP schema stores currency but does not convert. |
| Future-dated transactions | Allow scheduled future entries, or restrict dates to today/past. This changes balance/dashboard semantics. |
| Seven-day window anchor | Recommended: transaction date in user profile timezone. Alternative: created-at. Confirm final policy. |
| Debt creation flow | Whether lending/borrowing principal must automatically create a paired expense/income ledger transaction and category, or starts as a tracking record only. |
| Debt remaining storage | Derive fully from linked repayments (stronger auditability) vs maintained value with RPC reconciliation (faster UI). |
| Savings over-allocation | Block it, allow with warning, or allow only when accounts are not overdrawn. |
| Budget recommendation formula | Recommended: median of prior 3 comparable calendar periods with transparent source. Confirm minimum history and rounding. |
| Recurrence schedules | Exact supported rules: monthly day handling, weekly selections, timezone, catch-up behavior. Start simple. |
| Notifications | In-app only in MVP vs local push reminders; threshold values and opt-in controls. |
| Export formats | CSV is baseline. Decide whether PDF/XLSX is MVP or post-MVP. |
| Receipt limits | Recommended: JPEG/WebP, max 1600px longest edge, 1–2 MB, maximum attachment count. |
| App-lock grace period | Recommended: lock immediately on background; decide if 30–60 second grace is desired. |
| Offline database encryption | Decide SQLCipher/secure encrypted database approach based on device/privacy requirements and Expo support. |

