# Clean Architecture and project structure

## Layers and dependency rule

```text
Presentation (Expo screens, components, navigation)
        ↓
Application (use cases, DTOs, ports)
        ↓
Domain (entities, money, policies, repository interfaces)
        ↓
Infrastructure (SQLite, Supabase, storage, device APIs)
```

Dependencies point inward only. Domain code imports neither React, Expo, Supabase, nor SQLite. Screens invoke use cases through feature hooks; they never call Supabase directly.

## Recommended structure

```text
src/
  app/                         # Expo Router route definitions only
  features/
    transactions/{presentation,application,domain,data}/
    accounts/{presentation,application,domain,data}/
    budgets/{presentation,application,domain,data}/
    savings/{presentation,application,domain,data}/
    debts/{presentation,application,domain,data}/
    recurring/{presentation,application,domain,data}/
    analytics/{presentation,application,domain,data}/
    auth/{presentation,application,domain,data}/
  core/
    domain/{money,result,clock,uuid,repository.ts}
    sync/{outbox,sync-engine,conflicts,network}
    database/{sqlite,migrations,models}
    supabase/{client,rpc,storage,auth}
    security/{session-lock,secure-store}
    ui/{components,theme,tokens,feedback}
    config/{env,constants}
  test/{factories,mocks,helpers}
supabase/migrations/
docs/
```

Repository interfaces live in domain/application; `Sqlite*Repository` and `Supabase*Gateway` implement ports in infrastructure. Use cases: `CreateTransaction`, `UpdateTransaction`, `SoftDeleteTransaction`, `SyncOutbox`, `CreateBudget`, `AllocateSavings`, and so on. Keep each use case small, deterministic, and testable with a fake repository/clock.

## State ownership

Zustand holds ephemeral UI/session/sync state. SQLite repositories are the authoritative app read model. TanStack Query may manage remote/auth requests but must not become a second financial source of truth. Observed SQLite queries drive offline screens; sync invalidates/reloads projections.

