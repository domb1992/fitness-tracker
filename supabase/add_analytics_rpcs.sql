-- ============================================================
-- FitTrack – Analytics RPCs Migration
-- Run this after all previous migration files.
-- ============================================================

-- 1. New RPC: get_monthly_muscle_volume
--    Returns weighted muscle volume for a given year/month.
--    Primary muscles: weight 1.0 per set.
--    Secondary muscles: weight 0.5 per set.
--    Warmup exercises are excluded.

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
  INTO result
  FROM (
    SELECT
      muscle_name                       AS muscle,
      ROUND(SUM(weight)::NUMERIC, 2)   AS weighted_sets
    FROM (
      -- Primary muscles: count 1.0 per set
      SELECT
        UNNEST(e.primary_muscles) AS muscle_name,
        1.0                       AS weight
      FROM set_logs sl
      JOIN workout_sessions ws ON sl.session_id = ws.id
      JOIN exercises e          ON sl.exercise_id = e.id
      WHERE ws.user_id = v_uid
        AND ws.completed_at IS NOT NULL
        AND EXTRACT(YEAR  FROM ws.completed_at) = p_year
        AND EXTRACT(MONTH FROM ws.completed_at) = p_month
        AND COALESCE(e.exercise_type, 'strength') = 'strength'
        AND array_length(e.primary_muscles, 1) > 0

      UNION ALL

      -- Secondary muscles: count 0.5 per set
      SELECT
        UNNEST(e.secondary_muscles) AS muscle_name,
        0.5                         AS weight
      FROM set_logs sl
      JOIN workout_sessions ws ON sl.session_id = ws.id
      JOIN exercises e          ON sl.exercise_id = e.id
      WHERE ws.user_id = v_uid
        AND ws.completed_at IS NOT NULL
        AND EXTRACT(YEAR  FROM ws.completed_at) = p_year
        AND EXTRACT(MONTH FROM ws.completed_at) = p_month
        AND COALESCE(e.exercise_type, 'strength') = 'strength'
        AND array_length(e.secondary_muscles, 1) > 0
    ) muscle_rows
    WHERE muscle_name IS NOT NULL
      AND muscle_name <> ''
    GROUP BY muscle_name
    HAVING SUM(weight) > 0
  ) mv;

  RETURN result;
END;
$$;


-- 2. New RPC: get_lift_progression
--    Returns all strength exercises that have ≥1 session with a valid weight (> 0).
--    Uses per-session average weight so multi-set sessions are summarised to one point.
--    Includes a sparkline array (ordered avg weights) for real chart rendering.
--    Ordered by diff (last_weight – start_weight) descending.

CREATE OR REPLACE FUNCTION get_lift_progression()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  result JSON;
BEGIN
  WITH
  -- One row per (exercise, session date): average of all valid sets that session
  session_avgs AS (
    SELECT
      sl.exercise_id,
      ws.completed_at,
      ROUND(AVG(sl.weight_kg)::NUMERIC, 2) AS avg_weight
    FROM set_logs sl
    JOIN workout_sessions ws ON sl.session_id = ws.id
    JOIN exercises e          ON sl.exercise_id = e.id
    JOIN training_plans tp    ON e.plan_id = tp.id
    WHERE ws.user_id        = v_uid
      AND tp.user_id        = v_uid
      AND ws.completed_at   IS NOT NULL
      AND sl.weight_kg      IS NOT NULL
      AND sl.weight_kg      > 0
      AND COALESCE(e.exercise_type, 'strength') = 'strength'
    GROUP BY sl.exercise_id, ws.completed_at
  ),
  -- First and last valid session date per exercise, plus session count
  bounds AS (
    SELECT
      exercise_id,
      MIN(completed_at) AS first_at,
      MAX(completed_at) AS last_at,
      COUNT(*)::INT     AS valid_sessions
    FROM session_avgs
    GROUP BY exercise_id
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
        'pct_change',      CASE WHEN fw.avg_weight > 0
                             THEN ROUND(((lw.avg_weight - fw.avg_weight) / fw.avg_weight * 100)::NUMERIC, 1)
                             ELSE 0
                           END,
        'first_logged_at', b.first_at,
        'last_logged_at',  b.last_at,
        'session_count',   b.valid_sessions,
        'sparkline',       sp.weights
      ) AS obj
    FROM bounds b
    JOIN exercises e       ON e.id = b.exercise_id
    JOIN training_plans tp ON e.plan_id = tp.id
    -- Weight at first valid session
    JOIN session_avgs fw   ON fw.exercise_id = b.exercise_id
                          AND fw.completed_at = b.first_at
    -- Weight at last valid session
    JOIN session_avgs lw   ON lw.exercise_id = b.exercise_id
                          AND lw.completed_at = b.last_at
    -- Best ever weight
    JOIN LATERAL (
      SELECT MAX(avg_weight) AS best_weight
      FROM session_avgs WHERE exercise_id = b.exercise_id
    ) bw ON true
    -- Sparkline: ordered array of avg weights
    JOIN LATERAL (
      SELECT json_agg(sa.avg_weight ORDER BY sa.completed_at) AS weights
      FROM session_avgs sa WHERE sa.exercise_id = b.exercise_id
    ) sp ON true
    WHERE tp.user_id = v_uid
  ) lp;

  RETURN result;
END;
$$;


-- 3. Replace get_workout_stats to add first_logged_at / last_logged_at
--    per exercise, used by the Lift Progression section on the dashboard.

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
      FROM workout_sessions
      WHERE user_id = v_uid AND completed_at IS NOT NULL
    ),
    'thisWeek', (
      SELECT COUNT(*)::INT
      FROM workout_sessions
      WHERE user_id = v_uid
        AND completed_at IS NOT NULL
        AND completed_at >= NOW() - INTERVAL '7 days'
    ),
    'bestWeights', COALESCE((
      SELECT json_agg(bw ORDER BY bw.exercise_name)
      FROM (
        SELECT
          e.id::TEXT            AS exercise_id,
          e.name                AS exercise_name,
          tp.id::TEXT           AS plan_id,
          tp.name               AS plan_name,
          MAX(sl.weight_kg)     AS best_weight,
          MIN(ws.completed_at)  AS first_logged_at,
          MAX(ws.completed_at)  AS last_logged_at,
          (
            SELECT sl2.weight_kg
            FROM set_logs sl2
            JOIN workout_sessions ws2 ON sl2.session_id = ws2.id
            WHERE sl2.exercise_id = e.id
              AND ws2.user_id = v_uid
              AND ws2.completed_at IS NOT NULL
            ORDER BY ws2.completed_at DESC, sl2.weight_kg DESC NULLS LAST
            LIMIT 1
          ) AS last_weight,
          (
            SELECT sl2.reps_completed
            FROM set_logs sl2
            JOIN workout_sessions ws2 ON sl2.session_id = ws2.id
            WHERE sl2.exercise_id = e.id
              AND ws2.user_id = v_uid
              AND ws2.completed_at IS NOT NULL
            ORDER BY ws2.completed_at DESC
            LIMIT 1
          ) AS last_reps,
          (
            SELECT sl2.weight_kg
            FROM set_logs sl2
            JOIN workout_sessions ws2 ON sl2.session_id = ws2.id
            WHERE sl2.exercise_id = e.id
              AND ws2.user_id = v_uid
              AND ws2.completed_at IS NOT NULL
              AND sl2.weight_kg IS NOT NULL
            ORDER BY ws2.completed_at ASC
            LIMIT 1
          ) AS start_weight
        FROM exercises e
        JOIN training_plans tp ON e.plan_id = tp.id
        JOIN set_logs sl       ON sl.exercise_id = e.id
        JOIN workout_sessions ws ON sl.session_id = ws.id
        WHERE tp.user_id = v_uid
          AND ws.user_id = v_uid
          AND ws.completed_at IS NOT NULL
          AND COALESCE(e.exercise_type, 'strength') = 'strength'
        GROUP BY e.id, e.name, tp.id, tp.name
      ) bw
    ), '[]'::JSON),
    'weeklyData', COALESCE((
      SELECT json_agg(wd ORDER BY wd.week)
      FROM (
        SELECT
          TO_CHAR(DATE_TRUNC('week', completed_at), 'IYYY-IW') AS week,
          COUNT(*)::INT AS count
        FROM workout_sessions
        WHERE user_id = v_uid
          AND completed_at IS NOT NULL
          AND completed_at >= NOW() - INTERVAL '56 days'
        GROUP BY DATE_TRUNC('week', completed_at)
        ORDER BY 1
      ) wd
    ), '[]'::JSON)
  ) INTO result;

  RETURN result;
END;
$$;
