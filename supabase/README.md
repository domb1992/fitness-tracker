# FitTrack — Supabase SQL Reference

## Directory layout

```
supabase/
├── migrations/
│   ├── 001_schema.sql        ← Tables, constraints, indexes
│   ├── 002_rls.sql           ← Row Level Security policies
│   ├── 003_triggers.sql      ← updated_at auto-stamp triggers
│   └── 004_functions.sql     ← RPC functions (SECURITY DEFINER)
├── upgrade_existing_db.sql   ← Safe ALTER TABLE upgrade for existing databases
├── archive/                  ← Legacy files (superseded, do not run)
│   ├── schema.sql
│   ├── add_exercise_fields.sql
│   ├── add_warmup_fields.sql
│   ├── add_muscle_fields.sql
│   ├── add_analytics_rpcs.sql
│   └── fix_zero_duration.sql
└── README.md                 ← This file
```

---

## How to apply

### Fresh database
Run the four migration files **in order** in the Supabase SQL editor:

1. `migrations/001_schema.sql`
2. `migrations/002_rls.sql`
3. `migrations/003_triggers.sql`
4. `migrations/004_functions.sql`

### Existing database (already set up with the legacy files)
Run **only** `upgrade_existing_db.sql`. It is safe to re-run — every statement
is guarded with `IF NOT EXISTS` / `IF EXISTS` / `CREATE OR REPLACE`.

---

## Schema overview

### Tables

| Table | Purpose |
|-------|---------|
| `training_plans` | One row per program owned by a user |
| `exercises` | Exercises belonging to a plan |
| `workout_sessions` | One row per workout attempt (in-progress or complete) |
| `set_logs` | Individual set recordings inside a session |

### Key design decisions

**`ON DELETE CASCADE` throughout the ownership chain**
Deleting a `training_plan` cascades to its `exercises`, `workout_sessions`,
and `set_logs`. This keeps deletion simple and avoids FK violations. If you
need to retain history after plan deletion, archive the plan instead.

**`weight_kg NUMERIC(7,2)` not `REAL`**
`REAL` is a 32-bit float that stores 100.1 kg as 100.09999847412109. `NUMERIC`
stores exact decimal values. Max representable weight: 99999.99 kg.

**`set_logs.exercise_id` nullable**
The column is nullable so that set_logs can survive the deletion of their
exercise (the exercise history page becomes unreachable anyway, but the data
is preserved). The UNIQUE constraint covers the non-null case only.

**`UNIQUE (session_id, exercise_id, set_number)` on `set_logs`**
Prevents duplicate rows from offline-sync retry storms.

---

## Security model

All tables use **Row Level Security**. Unauthenticated requests are blocked —
no policy grants access to the `anon` role.

```
training_plans   → user owns via user_id
exercises        → user owns via training_plans.user_id  (EXISTS lookup)
workout_sessions → user owns via user_id
set_logs         → user owns via workout_sessions.user_id (EXISTS lookup)
```

`EXISTS` is used for indirect ownership (exercises, set_logs) rather than
`IN (SELECT ...)` because EXISTS uses the primary-key index and short-circuits
on the first matching row, whereas `IN` materialises the full subquery result.

### RPC functions

All five RPCs use `SECURITY DEFINER` + `SET search_path = public`:

- `SECURITY DEFINER` lets the function run as the owner (postgres role),
  bypassing RLS for cross-table atomic writes. Each function enforces its own
  ownership check using `auth.uid()` before touching any data.
- `SET search_path = public` prevents search-path injection attacks where a
  malicious schema could shadow trusted functions.

---

## RPC functions

| Function | Purpose |
|----------|---------|
| `complete_workout(session_id, notes, duration_secs, set_logs)` | Atomically save a finished session. Idempotent — safe to retry offline. |
| `get_workout_stats()` | Totals, this-week count, per-exercise bests, 8-week activity chart. |
| `get_exercise_history(exercise_id)` | Full session-by-session weight/reps history for one exercise. |
| `get_monthly_muscle_volume(year, month)` | Weighted muscle volume (primary ×1.0, secondary ×0.5) for a calendar month. |
| `get_lift_progression()` | All strength exercises with ≥1 valid session: start/last/best weight, diff, sparkline. |

---

## Performance indexes

| Index | Why |
|-------|-----|
| `idx_plans_user` on `training_plans(user_id)` | Dashboard plan list |
| `idx_exercises_plan` on `exercises(plan_id)` | Plan detail page |
| `idx_exercises_type` on `exercises(exercise_type)` | Filter warmup vs strength |
| `idx_sessions_user` on `workout_sessions(user_id)` | Cascade lookups |
| `idx_sessions_plan` on `workout_sessions(plan_id)` | Plan → sessions join |
| `idx_sessions_user_completed` on `workout_sessions(user_id, completed_at DESC) WHERE completed_at IS NOT NULL` | All analytics queries — partial index skips in-progress sessions |
| `idx_set_logs_session` on `set_logs(session_id)` | Session detail joins |
| `idx_set_logs_exercise` on `set_logs(exercise_id)` | Exercise history |
| `idx_set_logs_exercise_session` on `set_logs(exercise_id, session_id)` | Lift progression + exercise history joins |
