-- =============================================================================
-- FitTrack — Complete Fresh-Start Schema
-- =============================================================================
-- Run this file once on a brand-new Supabase project.
-- It is the consolidated result of migrations 001–009.
--
-- Sections:
--   1. Tables
--   2. Indexes
--   3. Row Level Security
--   4. Trigger functions + triggers
--   5. RPC functions
--   6. Permission grants / revokes
--   7. Autovacuum tuning
-- =============================================================================


-- =============================================================================
-- 1. TABLES
-- =============================================================================

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

CREATE TABLE IF NOT EXISTS exercises (
  id                       UUID        NOT NULL DEFAULT gen_random_uuid(),
  plan_id                  UUID        NOT NULL REFERENCES training_plans (id) ON DELETE CASCADE,
  name                     TEXT        NOT NULL,
  sets                     INTEGER     NOT NULL DEFAULT 3,
  target_reps              TEXT        NOT NULL DEFAULT '10',
  exercise_order           INTEGER     NOT NULL DEFAULT 1,
  seat_position            TEXT        NOT NULL DEFAULT '',
  notes                    TEXT        NOT NULL DEFAULT '',
  exercise_type            TEXT        NOT NULL DEFAULT 'strength',
  planned_duration_minutes INTEGER     NOT NULL DEFAULT 0,
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

-- plan_id ON DELETE CASCADE: deleting a plan removes all its sessions + logs.
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

-- NUMERIC(7,2) avoids float precision drift; UNIQUE prevents duplicate inserts on retry.
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
-- 2. INDEXES
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_plans_user
  ON training_plans (user_id);

CREATE INDEX IF NOT EXISTS idx_exercises_plan
  ON exercises (plan_id);

CREATE INDEX IF NOT EXISTS idx_sessions_user
  ON workout_sessions (user_id);

CREATE INDEX IF NOT EXISTS idx_sessions_plan
  ON workout_sessions (plan_id);

-- Partial index: covers the hottest read path — completed sessions per user.
CREATE INDEX IF NOT EXISTS idx_sessions_user_completed
  ON workout_sessions (user_id, completed_at DESC)
  WHERE completed_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_set_logs_session
  ON set_logs (session_id);

CREATE INDEX IF NOT EXISTS idx_set_logs_exercise
  ON set_logs (exercise_id);


-- =============================================================================
-- 3. ROW LEVEL SECURITY
-- =============================================================================

ALTER TABLE training_plans   ENABLE ROW LEVEL SECURITY;
ALTER TABLE exercises         ENABLE ROW LEVEL SECURITY;
ALTER TABLE workout_sessions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE set_logs          ENABLE ROW LEVEL SECURITY;

-- (SELECT auth.uid()) is evaluated once per query (InitPlan), not per row.
CREATE POLICY "plans_all" ON training_plans
  FOR ALL TO authenticated
  USING     (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

-- EXISTS on the PK is a single-row index seek.
CREATE POLICY "exercises_all" ON exercises
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM training_plans
      WHERE  id      = exercises.plan_id
        AND  user_id = (SELECT auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM training_plans
      WHERE  id      = exercises.plan_id
        AND  user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "sessions_all" ON workout_sessions
  FOR ALL TO authenticated
  USING     (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "set_logs_all" ON set_logs
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM workout_sessions
      WHERE  id      = set_logs.session_id
        AND  user_id = (SELECT auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM workout_sessions
      WHERE  id      = set_logs.session_id
        AND  user_id = (SELECT auth.uid())
    )
  );


-- =============================================================================
-- 4. TRIGGER FUNCTIONS + TRIGGERS
-- =============================================================================

-- Stamps updated_at = NOW() on every UPDATE.
-- SECURITY INVOKER: runs as the calling user; no elevated privilege needed.
-- search_path pinned to prevent search-path injection.
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_training_plans_updated_at ON training_plans;
CREATE TRIGGER trg_training_plans_updated_at
  BEFORE UPDATE ON training_plans
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_exercises_updated_at ON exercises;
CREATE TRIGGER trg_exercises_updated_at
  BEFORE UPDATE ON exercises
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Auto-assigns sequential plan_order on INSERT so the frontend never needs to send it.
CREATE OR REPLACE FUNCTION set_plan_order()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = pg_catalog, public
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
  FOR EACH ROW EXECUTE FUNCTION set_plan_order();


-- =============================================================================
-- 5. RPC FUNCTIONS
-- =============================================================================

-- -----------------------------------------------------------------------------
-- complete_workout
-- Atomically saves a finished workout session.
-- Cleans up any partial set_logs from a previous failed attempt before
-- re-inserting, so retries are always safe.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION complete_workout(
  p_session_id     UUID,
  p_notes          TEXT,
  p_duration_secs  INTEGER,
  p_set_logs       JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY INVOKER
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


-- -----------------------------------------------------------------------------
-- get_workout_stats
-- Returns aggregate stats for the authenticated user.
-- STABLE: read-only; planner can cache results within a query.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_workout_stats()
RETURNS JSON
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
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


-- -----------------------------------------------------------------------------
-- get_exercise_history
-- Returns full session-by-session weight/reps history for one exercise.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_exercise_history(p_exercise_id UUID)
RETURNS JSON
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
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


-- -----------------------------------------------------------------------------
-- get_monthly_muscle_volume
-- Weighted muscle volume for a given year/month.
-- Primary muscles → 1.0 per set; secondary → 0.5 per set.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_monthly_muscle_volume(p_year INT, p_month INT)
RETURNS JSON
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
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


-- -----------------------------------------------------------------------------
-- get_lift_progression
-- All strength exercises with ≥1 valid session weight, ordered by improvement.
-- Includes sparkline array for the progress chart.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_lift_progression()
RETURNS JSON
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
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


-- -----------------------------------------------------------------------------
-- get_coach_data
-- Returns comprehensive analytics data for the Performance Coach feature.
-- Two result sets:
--   sessions         → every completed session + distinct primary muscles
--   exercise_sessions → per-exercise per-session aggregates (last 6 months)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_coach_data()
RETURNS JSON
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_uid  UUID := auth.uid();
  result JSON;
BEGIN
  SELECT json_build_object(

    -- All completed sessions with their primary muscles list
    'sessions', COALESCE((
      SELECT json_agg(row_data ORDER BY (row_data ->> 'completed_at') DESC)
      FROM (
        SELECT json_build_object(
          'id',               ws.id::TEXT,
          'completed_at',     ws.completed_at,
          'duration_seconds', ws.duration_seconds,
          'plan_id',          ws.plan_id::TEXT,
          'muscles', COALESCE(
            (
              SELECT array_agg(DISTINCT m ORDER BY m)
              FROM (
                SELECT UNNEST(e.primary_muscles) AS m
                FROM   set_logs sl2
                JOIN   exercises e ON sl2.exercise_id = e.id
                WHERE  sl2.session_id     = ws.id
                  AND  e.exercise_type    = 'strength'
                  AND  sl2.weight_kg      IS NOT NULL
              ) msub
              WHERE m IS NOT NULL AND m <> ''
            ),
            ARRAY[]::TEXT[]
          )
        ) AS row_data
        FROM workout_sessions ws
        WHERE ws.user_id      = v_uid
          AND ws.completed_at IS NOT NULL
        ORDER BY ws.completed_at DESC
        LIMIT 200
      ) t
    ), '[]'::JSON),

    -- Per-exercise per-session aggregates for volume & balance analysis
    'exercise_sessions', COALESCE((
      SELECT json_agg(row_data ORDER BY (row_data ->> 'completed_at') DESC)
      FROM (
        SELECT json_build_object(
          'exercise_id',       e.id::TEXT,
          'exercise_name',     e.name,
          'primary_muscles',   e.primary_muscles,
          'secondary_muscles', e.secondary_muscles,
          'movement_pattern',  e.movement_pattern,
          'completed_at',      ws.completed_at,
          'avg_weight',        ROUND(AVG(sl.weight_kg)::NUMERIC, 2),
          'max_weight',        MAX(sl.weight_kg),
          'total_sets',        COUNT(sl.id)::INT,
          'total_volume',      ROUND(SUM(
            COALESCE(sl.weight_kg, 0) *
            CASE WHEN sl.reps_completed ~ '^[0-9]+(\.[0-9]+)?$'
                 THEN sl.reps_completed::NUMERIC
                 ELSE 0
            END
          )::NUMERIC, 1)
        ) AS row_data
        FROM   set_logs         sl
        JOIN   workout_sessions ws ON sl.session_id  = ws.id
        JOIN   exercises        e  ON sl.exercise_id = e.id
        JOIN   training_plans   tp ON e.plan_id      = tp.id
        WHERE  tp.user_id       = v_uid
          AND  ws.user_id       = v_uid
          AND  ws.completed_at  IS NOT NULL
          AND  e.exercise_type  = 'strength'
          AND  ws.completed_at  >= NOW() - INTERVAL '6 months'
        GROUP  BY e.id, e.name, e.primary_muscles, e.secondary_muscles,
                  e.movement_pattern, ws.id, ws.completed_at
        ORDER  BY ws.completed_at DESC
        LIMIT  3000
      ) t
    ), '[]'::JSON)

  ) INTO result;

  RETURN result;
END;
$$;


-- =============================================================================
-- 6. PERMISSION GRANTS / REVOKES
-- =============================================================================
-- No function in this app is callable without a valid JWT.
-- Trigger functions are internal and should never be called via RPC.

REVOKE EXECUTE ON FUNCTION public.set_updated_at()                              FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_plan_order()                              FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.complete_workout(UUID, TEXT, INTEGER, JSONB)  FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_workout_stats()                           FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_exercise_history(UUID)                    FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_monthly_muscle_volume(INTEGER, INTEGER)   FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_lift_progression()                        FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_coach_data()                               FROM anon;


-- =============================================================================
-- 7. AUTOVACUUM TUNING
-- =============================================================================
-- Default threshold (50 + 0.2 * live_rows) is too high for small tables —
-- training_plans with 3 live rows would need 50+ dead rows before autovacuum
-- fires. Lower to 5% / min 10 rows so cleanup happens promptly.

ALTER TABLE public.training_plans
  SET (
    autovacuum_vacuum_scale_factor   = 0.05,
    autovacuum_vacuum_threshold      = 10,
    autovacuum_analyze_scale_factor  = 0.05,
    autovacuum_analyze_threshold     = 10
  );

ALTER TABLE public.exercises
  SET (
    autovacuum_vacuum_scale_factor   = 0.05,
    autovacuum_vacuum_threshold      = 10,
    autovacuum_analyze_scale_factor  = 0.05,
    autovacuum_analyze_threshold     = 10
  );

ALTER TABLE public.workout_sessions
  SET (
    autovacuum_vacuum_scale_factor   = 0.05,
    autovacuum_vacuum_threshold      = 10,
    autovacuum_analyze_scale_factor  = 0.05,
    autovacuum_analyze_threshold     = 10
  );

ALTER TABLE public.set_logs
  SET (
    autovacuum_vacuum_scale_factor   = 0.05,
    autovacuum_vacuum_threshold      = 10,
    autovacuum_analyze_scale_factor  = 0.05,
    autovacuum_analyze_threshold     = 10
  );
