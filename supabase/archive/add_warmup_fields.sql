-- ============================================================
-- FitTrack – Warmup Exercise Migration
-- Run this after schema.sql and add_exercise_fields.sql
-- ============================================================

-- 1. Add exercise_type and planned_duration_minutes to exercises
ALTER TABLE exercises
  ADD COLUMN IF NOT EXISTS exercise_type            TEXT NOT NULL DEFAULT 'strength',
  ADD COLUMN IF NOT EXISTS planned_duration_minutes INT  NOT NULL DEFAULT 0;

-- 2. Replace get_workout_stats to exclude warmup exercises from bestWeights
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
          e.id::TEXT          AS exercise_id,
          e.name              AS exercise_name,
          tp.id::TEXT         AS plan_id,
          tp.name             AS plan_name,
          MAX(sl.weight_kg)   AS best_weight,
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
        JOIN set_logs sl      ON sl.exercise_id = e.id
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
