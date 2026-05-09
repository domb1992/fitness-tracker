# Archived SQL Files

These files are **superseded** by the numbered migrations in `../migrations/`.
Do not run them on any database. They are kept for reference only.

| File | Replaced by |
|------|-------------|
| `schema.sql` | `migrations/001_schema.sql` (+ `002_rls.sql`) |
| `add_exercise_fields.sql` | `migrations/001_schema.sql` (columns consolidated) |
| `add_warmup_fields.sql` | `migrations/001_schema.sql` (columns consolidated) |
| `add_muscle_fields.sql` | `migrations/001_schema.sql` (columns consolidated) |
| `add_analytics_rpcs.sql` | `migrations/004_functions.sql` |
| `fix_zero_duration.sql` | `migrations/001_schema.sql` (`duration_seconds >= 0` CHECK) |
