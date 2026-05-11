-- =============================================================================
-- FitTrack — Upgrade Script for Existing Production Databases
-- =============================================================================
-- Run this if you have an existing database set up with the legacy files
-- (schema.sql + the add_*.sql patches).  For a fresh database, run
-- migrations/001 → 004 in order instead.
--
-- SAFE TO RE-RUN: every statement uses IF NOT EXISTS / IF EXISTS guards,
-- or is a CREATE OR REPLACE / DROP … IF EXISTS.
--
-- ORDER OF SECTIONS
--   1. training_plans  — add updated_at, add CHECK constraint
--   2. exercises       — add updated_at, add missing CHECK constraints
--   3. workout_sessions — plan_id → ON DELETE CASCADE, nullable, add CHECK
--   4. set_logs        — exercise_id → ON DELETE CASCADE, REAL→NUMERIC,
--                        add CHECK constraints, add UNIQUE constraint
--   5. Indexes         — three new performance indexes
--   6. RLS policies    — replace IN (...) with EXISTS for exercises + set_logs
--   7. Triggers        — shared set_updated_at() trigger
--   8. RPC functions   — replace all 5 functions with final versions
-- =============================================================================

-- =============================================================================
-- 1. training_plans
-- =============================================================================

-- Add updated_at if the column doesn't exist yet
ALTER TABLE training_plans
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Add CHECK on plan_order (guard against accidental 0 or negative values)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'training_plans'::REGCLASS
      AND conname   = 'training_plans_plan_order_ck'
  ) THEN
    ALTER TABLE training_plans
      ADD CONSTRAINT training_plans_plan_order_ck CHECK (plan_order > 0);
  END IF;
END $$;


-- =============================================================================
-- 2. exercises
-- =============================================================================

-- Add updated_at if missing
ALTER TABLE exercises
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- These columns were added by add_exercise_fields.sql / add_warmup_fields.sql /
-- add_muscle_fields.sql.  ADD COLUMN IF NOT EXISTS is idempotent.
ALTER TABLE exercises
  ADD COLUMN IF NOT EXISTS seat_position            TEXT    NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS notes                    TEXT    NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS exercise_type            TEXT    NOT NULL DEFAULT 'strength',
  ADD COLUMN IF NOT EXISTS planned_duration_minutes INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS primary_muscles          TEXT[]  NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS secondary_muscles        TEXT[]  NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS movement_pattern         TEXT    NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS equipment                TEXT    NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS muscle_source            TEXT    NOT NULL DEFAULT 'none';

-- CHECK constraints (each guarded so re-runs are safe)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'exercises'::REGCLASS AND conname = 'exercises_sets_ck') THEN
    ALTER TABLE exercises ADD CONSTRAINT exercises_sets_ck CHECK (sets > 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'exercises'::REGCLASS AND conname = 'exercises_order_ck') THEN
    ALTER TABLE exercises ADD CONSTRAINT exercises_order_ck CHECK (exercise_order > 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'exercises'::REGCLASS AND conname = 'exercises_duration_ck') THEN
    ALTER TABLE exercises ADD CONSTRAINT exercises_duration_ck CHECK (planned_duration_minutes >= 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'exercises'::REGCLASS AND conname = 'exercises_type_ck') THEN
    ALTER TABLE exercises ADD CONSTRAINT exercises_type_ck CHECK (exercise_type IN ('strength', 'warmup'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'exercises'::REGCLASS AND conname = 'exercises_muscle_source_ck') THEN
    ALTER TABLE exercises ADD CONSTRAINT exercises_muscle_source_ck CHECK (muscle_source IN ('auto', 'manual', 'none'));
  END IF;
END $$;


-- =============================================================================
-- 3. workout_sessions
-- =============================================================================
-- Change plan_id FK from implicit RESTRICT to ON DELETE CASCADE, and make it
-- nullable.  Deleting a plan now cascades to its sessions (and their set_logs).
-- Without CASCADE, plan deletion fails if any sessions reference the plan.

DO $$
BEGIN
  -- Drop the old FK (auto-named by PostgreSQL)
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'workout_sessions'::REGCLASS
      AND conname   = 'workout_sessions_plan_id_fkey'
  ) THEN
    ALTER TABLE workout_sessions DROP CONSTRAINT workout_sessions_plan_id_fkey;
  END IF;

  -- Re-add with ON DELETE CASCADE (nullable so orphaned sessions are possible
  -- if a plan is deleted independently of sessions in future)
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'workout_sessions'::REGCLASS
      AND conname   = 'workout_sessions_plan_id_fk'
  ) THEN
    ALTER TABLE workout_sessions
      ADD CONSTRAINT workout_sessions_plan_id_fk
      FOREIGN KEY (plan_id) REFERENCES training_plans (id) ON DELETE CASCADE;
  END IF;
END $$;

-- Drop NOT NULL on plan_id (was NOT NULL in schema.sql; new design allows NULL
-- so a session can survive plan deletion if the FK is later changed to SET NULL)
ALTER TABLE workout_sessions ALTER COLUMN plan_id DROP NOT NULL;

-- Add duration_seconds CHECK
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'workout_sessions'::REGCLASS
      AND conname   = 'workout_sessions_duration_ck'
  ) THEN
    ALTER TABLE workout_sessions
      ADD CONSTRAINT workout_sessions_duration_ck
      CHECK (duration_seconds IS NULL OR duration_seconds >= 0);
  END IF;
END $$;


-- =============================================================================
-- 4. set_logs
-- =============================================================================

-- 4a. exercise_id FK: change from implicit RESTRICT (NOT NULL) to ON DELETE CASCADE
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'set_logs'::REGCLASS
      AND conname   = 'set_logs_exercise_id_fkey'
  ) THEN
    ALTER TABLE set_logs DROP CONSTRAINT set_logs_exercise_id_fkey;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'set_logs'::REGCLASS
      AND conname   = 'set_logs_exercise_id_fk'
  ) THEN
    ALTER TABLE set_logs
      ADD CONSTRAINT set_logs_exercise_id_fk
      FOREIGN KEY (exercise_id) REFERENCES exercises (id) ON DELETE CASCADE;
  END IF;
END $$;

-- exercise_id was NOT NULL in legacy schema; new design makes it nullable so
-- set_logs survive if their exercise is deleted (history is kept).
ALTER TABLE set_logs ALTER COLUMN exercise_id DROP NOT NULL;

-- 4b. weight_kg: REAL → NUMERIC(7,2)
--   USING clause converts existing float values; the cast rounds to 2dp.
--   This is safe: REAL values fit easily inside NUMERIC(7,2) (max 99999.99).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name  = 'set_logs'
      AND column_name = 'weight_kg'
      AND data_type   = 'real'
  ) THEN
    ALTER TABLE set_logs
      ALTER COLUMN weight_kg TYPE NUMERIC(7,2)
      USING weight_kg::NUMERIC(7,2);
  END IF;
END $$;

-- 4c. logged_at: ensure NOT NULL (was DEFAULT NOW() but not NOT NULL in legacy)
ALTER TABLE set_logs ALTER COLUMN logged_at SET NOT NULL;

-- 4d. CHECK constraints
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'set_logs'::REGCLASS AND conname = 'set_logs_set_num_ck') THEN
    ALTER TABLE set_logs ADD CONSTRAINT set_logs_set_num_ck CHECK (set_number > 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'set_logs'::REGCLASS AND conname = 'set_logs_weight_ck') THEN
    ALTER TABLE set_logs ADD CONSTRAINT set_logs_weight_ck  CHECK (weight_kg IS NULL OR weight_kg >= 0);
  END IF;
END $$;

-- 4e. UNIQUE constraint: prevents duplicate set inserts from retry storms
--   Before adding, remove any existing duplicate rows (keep the latest by logged_at).
--   This is safe because duplicate rows are always a data integrity bug.
DELETE FROM set_logs
WHERE exercise_id IS NOT NULL
  AND id NOT IN (
    SELECT DISTINCT ON (session_id, exercise_id, set_number) id
    FROM   set_logs
    WHERE  exercise_id IS NOT NULL
    ORDER  BY session_id, exercise_id, set_number, logged_at DESC
  );

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'set_logs'::REGCLASS
      AND conname   = 'set_logs_unique'
  ) THEN
    ALTER TABLE set_logs
      ADD CONSTRAINT set_logs_unique UNIQUE (session_id, exercise_id, set_number);
  END IF;
END $$;


-- =============================================================================
-- 5. Indexes
-- =============================================================================

-- Rename legacy idx_training_plans_user if it exists under the old name
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_training_plans_user') THEN
    ALTER INDEX idx_training_plans_user RENAME TO idx_plans_user;
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_plans_user ON training_plans (user_id);

-- exercise_type index (new — not in legacy schema)
CREATE INDEX IF NOT EXISTS idx_exercises_type ON exercises (exercise_type);

-- Composite partial index: hottest read pattern (all analytics queries)
CREATE INDEX IF NOT EXISTS idx_sessions_user_completed
  ON workout_sessions (user_id, completed_at DESC)
  WHERE completed_at IS NOT NULL;

-- Composite index for exercise-history and lift-progression joins
CREATE INDEX IF NOT EXISTS idx_set_logs_exercise_session
  ON set_logs (exercise_id, session_id);

-- Remove the old muscle_source index (low-value, not used in any query)
DROP INDEX IF EXISTS idx_exercises_muscle_source;


-- =============================================================================
-- 6. RLS policies
-- =============================================================================
-- Replace the IN (subquery) policies with EXISTS (point-lookup) versions.
-- EXISTS stops at the first matching row; IN materialises the full subquery.

-- exercises
DROP POLICY IF EXISTS "users_own_exercises" ON exercises;
CREATE POLICY "users_own_exercises" ON exercises
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM training_plans
      WHERE  id      = exercises.plan_id
        AND  user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM training_plans
      WHERE  id      = exercises.plan_id
        AND  user_id = auth.uid()
    )
  );

-- set_logs
DROP POLICY IF EXISTS "users_own_set_logs" ON set_logs;
CREATE POLICY "users_own_set_logs" ON set_logs
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM workout_sessions
      WHERE  id      = set_logs.session_id
        AND  user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM workout_sessions
      WHERE  id      = set_logs.session_id
        AND  user_id = auth.uid()
    )
  );


-- =============================================================================
-- 7. Triggers  (shared updated_at stamper)
-- =============================================================================

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_training_plans_updated_at ON training_plans;
CREATE TRIGGER trg_training_plans_updated_at
  BEFORE UPDATE ON training_plans
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_exercises_updated_at ON exercises;
CREATE TRIGGER trg_exercises_updated_at
  BEFORE UPDATE ON exercises
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

-- Auto-assign plan_order on INSERT (replaces frontend Date.now() which overflows INTEGER)
CREATE OR REPLACE FUNCTION set_plan_order()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.plan_order := COALESCE(
    (SELECT MAX(plan_order) FROM training_plans WHERE user_id = NEW.user_id),
    0
  ) + 1;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_training_plans_plan_order ON training_plans;
CREATE TRIGGER trg_training_plans_plan_order
  BEFORE INSERT ON training_plans
  FOR EACH ROW
  EXECUTE FUNCTION set_plan_order();


-- =============================================================================
-- 8. RPC functions  (final authoritative versions — same as 004_functions.sql)
-- =============================================================================

-- complete_workout ─────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION complete_workout(
  p_session_id     UUID,
  p_notes          TEXT,
  p_duration_secs  INTEGER,
  p_set_logs       JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_log JSONB;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM workout_sessions
    WHERE  id      = p_session_id
      AND  user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Session not found or access denied';
  END IF;

  IF EXISTS (
    SELECT 1 FROM workout_sessions
    WHERE id = p_session_id AND completed_at IS NOT NULL
  ) THEN
    RETURN;
  END IF;

  DELETE FROM set_logs WHERE session_id = p_session_id;

  FOR v_log IN SELECT * FROM jsonb_array_elements(p_set_logs) LOOP
    INSERT INTO set_logs (
      session_id, exercise_id, set_number,
      weight_kg, reps_completed, notes
    )
    VALUES (
      p_session_id,
      (v_log ->> 'exercise_id')::UUID,
      (v_log ->> 'set_number')::INTEGER,
      NULLIF(TRIM(COALESCE(v_log ->> 'weight_kg', '')), '')::NUMERIC,
      NULLIF(TRIM(COALESCE(v_log ->> 'reps_completed', '')), ''),
      COALESCE(v_log ->> 'notes', '')
    );
  END LOOP;

  UPDATE workout_sessions
  SET
    completed_at     = NOW(),
    duration_seconds = p_duration_secs,
    notes            = COALESCE(p_notes, '')
  WHERE id = p_session_id;
END;
$$;


-- get_workout_stats ─────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION get_workout_stats()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid  UUID := auth.uid();
  result JSON;
BEGIN
  SELECT json_build_object(

    'totalWorkouts', (
      SELECT COUNT(*)::INT
      FROM   workout_sessions
      WHERE  user_id      = v_uid
        AND  completed_at IS NOT NULL
    ),

    'thisWeek', (
      SELECT COUNT(*)::INT
      FROM   workout_sessions
      WHERE  user_id      = v_uid
        AND  completed_at IS NOT NULL
        AND  completed_at >= NOW() - INTERVAL '7 days'
    ),

    'bestWeights', COALESCE((
      WITH
      base AS (
        SELECT
          sl.exercise_id,
          sl.weight_kg,
          sl.reps_completed,
          ws.completed_at
        FROM   set_logs         sl
        JOIN   workout_sessions ws ON sl.session_id  = ws.id
        JOIN   exercises        e  ON sl.exercise_id = e.id
        JOIN   training_plans   tp ON e.plan_id      = tp.id
        WHERE  tp.user_id       = v_uid
          AND  ws.user_id       = v_uid
          AND  ws.completed_at  IS NOT NULL
          AND  e.exercise_type  = 'strength'
      ),
      last_log AS (
        SELECT DISTINCT ON (exercise_id)
          exercise_id,
          weight_kg      AS last_weight,
          reps_completed AS last_reps
        FROM   base
        ORDER  BY exercise_id, completed_at DESC, weight_kg DESC NULLS LAST
      ),
      start_log AS (
        SELECT DISTINCT ON (exercise_id)
          exercise_id,
          weight_kg AS start_weight
        FROM   base
        WHERE  weight_kg IS NOT NULL
        ORDER  BY exercise_id, completed_at ASC
      )
      SELECT json_agg(bw ORDER BY bw.exercise_name)
      FROM (
        SELECT
          e.id::TEXT          AS exercise_id,
          e.name              AS exercise_name,
          tp.id::TEXT         AS plan_id,
          tp.name             AS plan_name,
          MAX(b.weight_kg)    AS best_weight,
          MIN(b.completed_at) AS first_logged_at,
          MAX(b.completed_at) AS last_logged_at,
          ll.last_weight,
          ll.last_reps,
          sl.start_weight
        FROM   base           b
        JOIN   exercises      e  ON e.id       = b.exercise_id
        JOIN   training_plans tp ON tp.id      = e.plan_id
        LEFT   JOIN last_log  ll ON ll.exercise_id = b.exercise_id
        LEFT   JOIN start_log sl ON sl.exercise_id = b.exercise_id
        GROUP  BY
          e.id, e.name, tp.id, tp.name,
          ll.last_weight, ll.last_reps, sl.start_weight
      ) bw
    ), '[]'::JSON),

    'weeklyData', COALESCE((
      SELECT json_agg(wd ORDER BY wd.week)
      FROM (
        SELECT
          TO_CHAR(DATE_TRUNC('week', completed_at), 'IYYY-IW') AS week,
          COUNT(*)::INT                                         AS count
        FROM   workout_sessions
        WHERE  user_id      = v_uid
          AND  completed_at IS NOT NULL
          AND  completed_at >= NOW() - INTERVAL '56 days'
        GROUP  BY DATE_TRUNC('week', completed_at)
      ) wd
    ), '[]'::JSON)

  ) INTO result;

  RETURN result;
END;
$$;


-- get_exercise_history ──────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION get_exercise_history(p_exercise_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid  UUID := auth.uid();
  result JSON;
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM   exercises      e
    JOIN   training_plans tp ON e.plan_id = tp.id
    WHERE  e.id       = p_exercise_id
      AND  tp.user_id = v_uid
  ) THEN
    RAISE EXCEPTION 'Exercise not found or access denied';
  END IF;

  SELECT json_build_object(

    'exercise', (
      SELECT json_build_object(
        'id',        e.id::TEXT,
        'name',      e.name,
        'plan_name', tp.name
      )
      FROM   exercises      e
      JOIN   training_plans tp ON e.plan_id = tp.id
      WHERE  e.id = p_exercise_id
    ),

    'sessions', COALESCE((
      SELECT json_agg(sess ORDER BY sess.completed_at)
      FROM (
        SELECT
          ws.id::TEXT         AS session_id,
          ws.completed_at,
          MAX(sl.weight_kg)   AS best_weight,
          (
            SELECT sl2.reps_completed
            FROM   set_logs sl2
            WHERE  sl2.session_id  = ws.id
              AND  sl2.exercise_id = p_exercise_id
              AND  sl2.reps_completed IS NOT NULL
            ORDER  BY
              CASE WHEN sl2.reps_completed ~ '^\d+$'
                THEN sl2.reps_completed::INTEGER
                ELSE 2147483647
              END DESC
            LIMIT 1
          ) AS best_reps,
          json_agg(
            json_build_object(
              'set_number',     sl.set_number,
              'weight_kg',      sl.weight_kg,
              'reps_completed', sl.reps_completed
            )
            ORDER BY sl.set_number
          ) AS sets
        FROM   workout_sessions ws
        JOIN   set_logs         sl ON sl.session_id  = ws.id
        WHERE  sl.exercise_id  = p_exercise_id
          AND  ws.user_id      = v_uid
          AND  ws.completed_at IS NOT NULL
        GROUP  BY ws.id, ws.completed_at
        ORDER  BY ws.completed_at
      ) sess
    ), '[]'::JSON)

  ) INTO result;

  RETURN result;
END;
$$;


-- get_monthly_muscle_volume ─────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION get_monthly_muscle_volume(p_year INT, p_month INT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid  UUID := auth.uid();
  result JSON;
BEGIN
  SELECT COALESCE(json_agg(mv ORDER BY mv.weighted_sets DESC), '[]'::JSON)
  INTO   result
  FROM (
    SELECT
      muscle_name                     AS muscle,
      ROUND(SUM(weight)::NUMERIC, 2) AS weighted_sets
    FROM (
      SELECT
        UNNEST(e.primary_muscles) AS muscle_name,
        1.0                       AS weight
      FROM   set_logs         sl
      JOIN   workout_sessions ws ON sl.session_id  = ws.id
      JOIN   exercises        e  ON sl.exercise_id = e.id
      WHERE  ws.user_id       = v_uid
        AND  ws.completed_at  IS NOT NULL
        AND  EXTRACT(YEAR  FROM ws.completed_at) = p_year
        AND  EXTRACT(MONTH FROM ws.completed_at) = p_month
        AND  e.exercise_type  = 'strength'
        AND  array_length(e.primary_muscles, 1) > 0

      UNION ALL

      SELECT
        UNNEST(e.secondary_muscles) AS muscle_name,
        0.5                         AS weight
      FROM   set_logs         sl
      JOIN   workout_sessions ws ON sl.session_id  = ws.id
      JOIN   exercises        e  ON sl.exercise_id = e.id
      WHERE  ws.user_id       = v_uid
        AND  ws.completed_at  IS NOT NULL
        AND  EXTRACT(YEAR  FROM ws.completed_at) = p_year
        AND  EXTRACT(MONTH FROM ws.completed_at) = p_month
        AND  e.exercise_type  = 'strength'
        AND  array_length(e.secondary_muscles, 1) > 0
    ) muscle_rows
    WHERE  muscle_name IS NOT NULL
      AND  muscle_name <> ''
    GROUP  BY muscle_name
    HAVING SUM(weight) > 0
  ) mv;

  RETURN result;
END;
$$;


-- get_lift_progression ──────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION get_lift_progression()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid  UUID := auth.uid();
  result JSON;
BEGIN
  WITH
  session_avgs AS (
    SELECT
      sl.exercise_id,
      ws.completed_at,
      ROUND(AVG(sl.weight_kg)::NUMERIC, 2) AS avg_weight
    FROM   set_logs         sl
    JOIN   workout_sessions ws ON sl.session_id  = ws.id
    JOIN   exercises        e  ON sl.exercise_id = e.id
    JOIN   training_plans   tp ON e.plan_id      = tp.id
    WHERE  ws.user_id      = v_uid
      AND  tp.user_id      = v_uid
      AND  ws.completed_at IS NOT NULL
      AND  sl.weight_kg    IS NOT NULL
      AND  sl.weight_kg    > 0
      AND  e.exercise_type = 'strength'
    GROUP  BY sl.exercise_id, ws.completed_at
  ),
  bounds AS (
    SELECT
      exercise_id,
      MIN(completed_at) AS first_at,
      MAX(completed_at) AS last_at,
      COUNT(*)::INT     AS valid_sessions
    FROM   session_avgs
    GROUP  BY exercise_id
  )
  SELECT COALESCE(
    json_agg(lp.obj ORDER BY lp.diff DESC NULLS LAST),
    '[]'::JSON
  )
  INTO result
  FROM (
    SELECT
      ROUND((lw.avg_weight - fw.avg_weight)::NUMERIC, 2) AS diff,
      json_build_object(
        'exercise_id',     e.id::TEXT,
        'exercise_name',   e.name,
        'plan_name',       tp.name,
        'start_weight',    fw.avg_weight,
        'last_weight',     lw.avg_weight,
        'best_weight',     bw.best_weight,
        'diff',            ROUND((lw.avg_weight - fw.avg_weight)::NUMERIC, 2),
        'pct_change',      CASE
                             WHEN fw.avg_weight > 0
                               THEN ROUND(
                                 ((lw.avg_weight - fw.avg_weight) / fw.avg_weight * 100)::NUMERIC,
                                 1
                               )
                             ELSE 0
                           END,
        'first_logged_at', b.first_at,
        'last_logged_at',  b.last_at,
        'session_count',   b.valid_sessions,
        'sparkline',       sp.weights
      ) AS obj
    FROM   bounds b
    JOIN   exercises      e  ON e.id          = b.exercise_id
    JOIN   training_plans tp ON e.plan_id     = tp.id
    JOIN   session_avgs  fw  ON fw.exercise_id = b.exercise_id
                             AND fw.completed_at = b.first_at
    JOIN   session_avgs  lw  ON lw.exercise_id = b.exercise_id
                             AND lw.completed_at = b.last_at
    JOIN LATERAL (
      SELECT MAX(avg_weight) AS best_weight
      FROM   session_avgs
      WHERE  exercise_id = b.exercise_id
    ) bw ON TRUE
    JOIN LATERAL (
      SELECT json_agg(sa.avg_weight ORDER BY sa.completed_at) AS weights
      FROM   session_avgs sa
      WHERE  sa.exercise_id = b.exercise_id
    ) sp ON TRUE
    WHERE tp.user_id = v_uid
  ) lp;

  RETURN result;
END;
$$;
