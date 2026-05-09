-- =============================================================================
-- FitTrack — Migration 004: RPC Functions (authoritative final versions)
-- =============================================================================
-- Must run AFTER 001_schema.sql.
-- Replaces every function version from the legacy files.
--
-- All functions use:
--   SECURITY DEFINER  — run as the function owner (postgres role), bypassing
--                        RLS so we can perform cross-table atomic writes.
--   SET search_path = public — prevents search-path-injection attacks.
--   auth.uid()        — supplied by Supabase; identifies the calling user.
-- =============================================================================

-- =============================================================================
-- 1. complete_workout
-- =============================================================================
-- Atomically saves a finished workout session.
--
-- Improvements over legacy version:
--   • Clears any partial set_logs from a previous crashed attempt BEFORE
--     re-inserting.  The old code only guarded completed sessions; a
--     mid-flight network failure could leave orphaned rows that would then
--     be duplicated on retry (the UNIQUE constraint in 001_schema.sql also
--     catches this, but cleaning up first is cleaner).
--   • weight_kg cast changed from ::REAL to ::NUMERIC to match the column type
--     and avoid precision drift.
-- =============================================================================

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
  -- Ownership check: only the session owner may complete it
  IF NOT EXISTS (
    SELECT 1 FROM workout_sessions
    WHERE  id      = p_session_id
      AND  user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Session not found or access denied';
  END IF;

  -- Idempotency guard: already completed → safe no-op (offline retry scenario)
  IF EXISTS (
    SELECT 1 FROM workout_sessions
    WHERE id = p_session_id AND completed_at IS NOT NULL
  ) THEN
    RETURN;
  END IF;

  -- Clean up any partial set_logs from a previous failed attempt.
  -- This runs inside the same transaction so if anything below fails
  -- this DELETE is also rolled back — no data is permanently lost.
  DELETE FROM set_logs WHERE session_id = p_session_id;

  -- Insert all set logs from the JSONB array
  FOR v_log IN SELECT * FROM jsonb_array_elements(p_set_logs) LOOP
    INSERT INTO set_logs (
      session_id, exercise_id, set_number,
      weight_kg, reps_completed, notes
    )
    VALUES (
      p_session_id,
      (v_log ->> 'exercise_id')::UUID,
      (v_log ->> 'set_number')::INTEGER,
      -- Cast to NUMERIC; NULLIF turns empty/null into SQL NULL
      NULLIF(TRIM(COALESCE(v_log ->> 'weight_kg', '')), '')::NUMERIC,
      NULLIF(TRIM(COALESCE(v_log ->> 'reps_completed', '')), ''),
      COALESCE(v_log ->> 'notes', '')
    );
  END LOOP;

  -- Mark session complete
  UPDATE workout_sessions
  SET
    completed_at     = NOW(),
    duration_seconds = p_duration_secs,
    notes            = COALESCE(p_notes, '')
  WHERE id = p_session_id;
END;
$$;


-- =============================================================================
-- 2. get_workout_stats
-- =============================================================================
-- Returns aggregate stats for the authenticated user.
--
-- Improvements over legacy version:
--   • Replaces 3 correlated sub-selects per exercise (last_weight, last_reps,
--     start_weight) with two DISTINCT ON CTEs.  DISTINCT ON is a single
--     index-ordered scan that stops reading once each partition has a winner —
--     O(n log n) instead of O(n * m) for n exercises × m sessions.
--   • exercise_type = 'strength' used directly (CHECK + NOT NULL makes
--     COALESCE(e.exercise_type, 'strength') redundant).
-- =============================================================================

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

    -- ── Totals ──────────────────────────────────────────────────────────────
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

    -- ── Per-exercise bests (strength exercises only) ─────────────────────
    'bestWeights', COALESCE((
      WITH
      -- All strength set logs for this user's completed sessions
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

      -- Most recent weight + reps per exercise
      -- DISTINCT ON with ORDER BY completed_at DESC gives the last session's
      -- top set in a single sorted scan.
      last_log AS (
        SELECT DISTINCT ON (exercise_id)
          exercise_id,
          weight_kg      AS last_weight,
          reps_completed AS last_reps
        FROM   base
        ORDER  BY exercise_id, completed_at DESC, weight_kg DESC NULLS LAST
      ),

      -- Earliest session that has a non-null weight (= starting point)
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

    -- ── Weekly activity (last 8 weeks) ───────────────────────────────────
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


-- =============================================================================
-- 3. get_exercise_history
-- =============================================================================
-- Returns full session-by-session weight/reps history for one exercise.
-- Used by ExerciseDetailPage.
-- Unchanged in logic but cleaned up: COALESCE on exercise_type removed.
-- =============================================================================

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
  -- Ownership check: exercise must belong to a plan owned by the caller
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
          -- Best reps: numeric strings sort numerically; non-numeric go last
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


-- =============================================================================
-- 4. get_monthly_muscle_volume
-- =============================================================================
-- Returns weighted muscle volume for a given year/month.
--   Primary muscles  → 1.0 per set
--   Secondary muscles → 0.5 per set
-- Warmup exercises are excluded.
-- Used by ProgressPage muscle volume chart.
-- =============================================================================

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
      -- Primary muscles: 1.0 per set
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

      -- Secondary muscles: 0.5 per set
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


-- =============================================================================
-- 5. get_lift_progression
-- =============================================================================
-- Returns all strength exercises that have ≥1 session with a valid weight.
-- Uses per-session average weight so multi-set sessions are summarised to
-- one data point.  Includes a sparkline array for the chart in ProgressPage.
-- Ordered by diff (last_weight − start_weight) descending.
-- =============================================================================

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
  -- One row per (exercise, session): average of all valid sets that session
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
  -- First and last valid session per exercise + count
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
    -- Weight at the first valid session
    JOIN   session_avgs  fw  ON fw.exercise_id = b.exercise_id
                             AND fw.completed_at = b.first_at
    -- Weight at the most recent valid session
    JOIN   session_avgs  lw  ON lw.exercise_id = b.exercise_id
                             AND lw.completed_at = b.last_at
    -- Best-ever weight across all sessions
    JOIN LATERAL (
      SELECT MAX(avg_weight) AS best_weight
      FROM   session_avgs
      WHERE  exercise_id = b.exercise_id
    ) bw ON TRUE
    -- Sparkline: ordered array of average weights
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
