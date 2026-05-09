-- =============================================================================
-- FitTrack — Migration 001: Full Schema
-- =============================================================================
-- This single file replaces the following legacy files (now in /archive):
--   schema.sql, add_exercise_fields.sql, add_warmup_fields.sql,
--   add_muscle_fields.sql, add_analytics_rpcs.sql
--
-- For an EXISTING database run upgrade_existing_db.sql instead.
-- For a FRESH database run migrations 001 → 004 in order.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- TABLE: training_plans
-- ---------------------------------------------------------------------------
-- One row per training program owned by a user.
-- plan_order controls display order on the dashboard.

CREATE TABLE IF NOT EXISTS training_plans (
  id          UUID        NOT NULL DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  name        TEXT        NOT NULL,
  description TEXT        NOT NULL DEFAULT '',
  color       TEXT        NOT NULL DEFAULT '#6366F1',
  plan_order  INTEGER     NOT NULL DEFAULT 1,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT training_plans_pkey          PRIMARY KEY (id),
  CONSTRAINT training_plans_plan_order_ck CHECK (plan_order > 0)
);

-- ---------------------------------------------------------------------------
-- TABLE: exercises
-- ---------------------------------------------------------------------------
-- Exercises belonging to a plan (all columns from every legacy migration
-- are defined here from the start — no ALTER TABLE piecemeal).

CREATE TABLE IF NOT EXISTS exercises (
  id                       UUID        NOT NULL DEFAULT gen_random_uuid(),
  plan_id                  UUID        NOT NULL REFERENCES training_plans (id) ON DELETE CASCADE,
  name                     TEXT        NOT NULL,
  sets                     INTEGER     NOT NULL DEFAULT 3,
  target_reps              TEXT        NOT NULL DEFAULT '10',
  exercise_order           INTEGER     NOT NULL DEFAULT 1,

  -- Machine setup info (added in legacy add_exercise_fields.sql)
  seat_position            TEXT        NOT NULL DEFAULT '',
  notes                    TEXT        NOT NULL DEFAULT '',

  -- Warmup vs strength (added in legacy add_warmup_fields.sql)
  exercise_type            TEXT        NOT NULL DEFAULT 'strength',
  planned_duration_minutes INTEGER     NOT NULL DEFAULT 0,

  -- Muscle assignment (added in legacy add_muscle_fields.sql)
  primary_muscles          TEXT[]      NOT NULL DEFAULT '{}',
  secondary_muscles        TEXT[]      NOT NULL DEFAULT '{}',
  movement_pattern         TEXT        NOT NULL DEFAULT '',
  equipment                TEXT        NOT NULL DEFAULT '',
  muscle_source            TEXT        NOT NULL DEFAULT 'none',

  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT exercises_pkey              PRIMARY KEY (id),
  CONSTRAINT exercises_sets_ck           CHECK (sets > 0),
  CONSTRAINT exercises_order_ck          CHECK (exercise_order > 0),
  CONSTRAINT exercises_duration_ck       CHECK (planned_duration_minutes >= 0),
  CONSTRAINT exercises_type_ck           CHECK (exercise_type IN ('strength', 'warmup')),
  CONSTRAINT exercises_muscle_source_ck  CHECK (muscle_source IN ('auto', 'manual', 'none'))
);

-- ---------------------------------------------------------------------------
-- TABLE: workout_sessions
-- ---------------------------------------------------------------------------
-- One row per workout attempt (complete or in-progress).
--
-- IMPORTANT DESIGN DECISION — ON DELETE CASCADE for plan_id:
--   When a plan is deleted all of its sessions (and their set_logs) are
--   deleted too. This makes plan deletion always succeed and keeps the
--   schema clean. The alternative (SET NULL) would require the frontend
--   to handle orphaned sessions everywhere. See README for details.

CREATE TABLE IF NOT EXISTS workout_sessions (
  id               UUID        NOT NULL DEFAULT gen_random_uuid(),
  user_id          UUID        NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  plan_id          UUID                 REFERENCES training_plans (id) ON DELETE CASCADE,
  started_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at     TIMESTAMPTZ,
  duration_seconds INTEGER,
  notes            TEXT        NOT NULL DEFAULT '',

  CONSTRAINT workout_sessions_pkey        PRIMARY KEY (id),
  CONSTRAINT workout_sessions_duration_ck CHECK (duration_seconds IS NULL OR duration_seconds >= 0)
);

-- ---------------------------------------------------------------------------
-- TABLE: set_logs
-- ---------------------------------------------------------------------------
-- Individual set recordings inside a session.
--
-- weight_kg is NUMERIC(7,2) rather than REAL to avoid 32-bit floating-point
-- precision drift (e.g. 100.1 kg stored as 100.09999847412109 with REAL).
--
-- exercise_id ON DELETE CASCADE: deleting an exercise from a plan removes
-- its historical logs. The exercise history page becomes unreachable anyway
-- once the exercise is deleted, so this is the correct behaviour.
--
-- UNIQUE (session_id, exercise_id, set_number) prevents duplicate inserts
-- from retry storms or offline-sync bugs.

CREATE TABLE IF NOT EXISTS set_logs (
  id             UUID         NOT NULL DEFAULT gen_random_uuid(),
  session_id     UUID         NOT NULL REFERENCES workout_sessions (id) ON DELETE CASCADE,
  exercise_id    UUID                  REFERENCES exercises (id) ON DELETE CASCADE,
  set_number     INTEGER      NOT NULL,
  weight_kg      NUMERIC(7,2),
  reps_completed TEXT,
  notes          TEXT         NOT NULL DEFAULT '',
  logged_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

  CONSTRAINT set_logs_pkey       PRIMARY KEY (id),
  CONSTRAINT set_logs_set_num_ck CHECK (set_number > 0),
  CONSTRAINT set_logs_weight_ck  CHECK (weight_kg IS NULL OR weight_kg >= 0),
  CONSTRAINT set_logs_unique     UNIQUE (session_id, exercise_id, set_number)
);

-- =============================================================================
-- INDEXES
-- =============================================================================

-- training_plans
CREATE INDEX IF NOT EXISTS idx_plans_user
  ON training_plans (user_id);

-- exercises
CREATE INDEX IF NOT EXISTS idx_exercises_plan
  ON exercises (plan_id);

CREATE INDEX IF NOT EXISTS idx_exercises_type
  ON exercises (exercise_type);

-- workout_sessions
--   Separate user-only index for cascade lookups.
CREATE INDEX IF NOT EXISTS idx_sessions_user
  ON workout_sessions (user_id);

CREATE INDEX IF NOT EXISTS idx_sessions_plan
  ON workout_sessions (plan_id);

--   Composite partial index: this is the hottest read pattern in the app.
--   Every analytics query filters WHERE user_id = ? AND completed_at IS NOT NULL
--   and sorts/filters by completed_at. The WHERE clause skips in-progress sessions.
CREATE INDEX IF NOT EXISTS idx_sessions_user_completed
  ON workout_sessions (user_id, completed_at DESC)
  WHERE completed_at IS NOT NULL;

-- set_logs
CREATE INDEX IF NOT EXISTS idx_set_logs_session
  ON set_logs (session_id);

CREATE INDEX IF NOT EXISTS idx_set_logs_exercise
  ON set_logs (exercise_id);

--   Composite index for the exercise-history and lift-progression queries
--   which join on both exercise_id and session_id.
CREATE INDEX IF NOT EXISTS idx_set_logs_exercise_session
  ON set_logs (exercise_id, session_id);
