-- ============================================================
-- FitTrack – Supabase Schema
-- Run this entire file in your Supabase SQL editor once.
-- ============================================================

-- Tables
CREATE TABLE IF NOT EXISTS training_plans (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name        TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  color       TEXT NOT NULL DEFAULT '#6366F1',
  plan_order  INTEGER NOT NULL DEFAULT 1,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS exercises (
  id             UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  plan_id        UUID REFERENCES training_plans(id) ON DELETE CASCADE NOT NULL,
  name           TEXT NOT NULL,
  sets           INTEGER NOT NULL DEFAULT 3,
  target_reps    TEXT NOT NULL DEFAULT '10',
  exercise_order INTEGER NOT NULL DEFAULT 1,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS workout_sessions (
  id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id          UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  plan_id          UUID REFERENCES training_plans(id) NOT NULL,
  started_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at     TIMESTAMPTZ,
  duration_seconds INTEGER,
  notes            TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS set_logs (
  id             UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id     UUID REFERENCES workout_sessions(id) ON DELETE CASCADE NOT NULL,
  exercise_id    UUID REFERENCES exercises(id) NOT NULL,
  set_number     INTEGER NOT NULL,
  weight_kg      REAL,
  reps_completed TEXT,
  notes          TEXT NOT NULL DEFAULT '',
  logged_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_training_plans_user ON training_plans(user_id);
CREATE INDEX IF NOT EXISTS idx_exercises_plan ON exercises(plan_id);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON workout_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_plan ON workout_sessions(plan_id);
CREATE INDEX IF NOT EXISTS idx_set_logs_session ON set_logs(session_id);
CREATE INDEX IF NOT EXISTS idx_set_logs_exercise ON set_logs(exercise_id);

-- ============================================================
-- Row Level Security
-- ============================================================

ALTER TABLE training_plans   ENABLE ROW LEVEL SECURITY;
ALTER TABLE exercises         ENABLE ROW LEVEL SECURITY;
ALTER TABLE workout_sessions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE set_logs          ENABLE ROW LEVEL SECURITY;

-- Training plans: owned by user
CREATE POLICY "users_own_plans" ON training_plans
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Exercises: access via plan ownership
CREATE POLICY "users_own_exercises" ON exercises
  FOR ALL TO authenticated
  USING (
    plan_id IN (SELECT id FROM training_plans WHERE user_id = auth.uid())
  )
  WITH CHECK (
    plan_id IN (SELECT id FROM training_plans WHERE user_id = auth.uid())
  );

-- Workout sessions: owned by user
CREATE POLICY "users_own_sessions" ON workout_sessions
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Set logs: access via session ownership
CREATE POLICY "users_own_set_logs" ON set_logs
  FOR ALL TO authenticated
  USING (
    session_id IN (SELECT id FROM workout_sessions WHERE user_id = auth.uid())
  )
  WITH CHECK (
    session_id IN (SELECT id FROM workout_sessions WHERE user_id = auth.uid())
  );

-- ============================================================
-- RPC: Complete Workout (atomic – inserts set_logs + marks session done)
-- ============================================================

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
  -- Verify caller owns this session
  IF NOT EXISTS (
    SELECT 1 FROM workout_sessions
    WHERE id = p_session_id AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Session not found or access denied';
  END IF;

  -- Insert all set logs
  FOR v_log IN SELECT * FROM jsonb_array_elements(p_set_logs) LOOP
    INSERT INTO set_logs (session_id, exercise_id, set_number, weight_kg, reps_completed, notes)
    VALUES (
      p_session_id,
      (v_log->>'exercise_id')::UUID,
      (v_log->>'set_number')::INTEGER,
      NULLIF(TRIM(COALESCE(v_log->>'weight_kg', '')), '')::REAL,
      NULLIF(TRIM(COALESCE(v_log->>'reps_completed', '')), ''),
      COALESCE(v_log->>'notes', '')
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

-- ============================================================
-- RPC: Get Workout Stats for the authenticated user
-- ============================================================

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

-- ============================================================
-- RPC: Get Exercise History (weight/reps progression per session)
-- ============================================================

CREATE OR REPLACE FUNCTION get_exercise_history(p_exercise_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  result JSON;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM exercises e
    JOIN training_plans tp ON e.plan_id = tp.id
    WHERE e.id = p_exercise_id AND tp.user_id = v_uid
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
      FROM exercises e
      JOIN training_plans tp ON e.plan_id = tp.id
      WHERE e.id = p_exercise_id
    ),
    'sessions', COALESCE((
      SELECT json_agg(sess ORDER BY sess.completed_at)
      FROM (
        SELECT
          ws.id::TEXT   AS session_id,
          ws.completed_at,
          MAX(sl.weight_kg) AS best_weight,
          (
            SELECT sl2.reps_completed
            FROM set_logs sl2
            WHERE sl2.session_id = ws.id
              AND sl2.exercise_id = p_exercise_id
              AND sl2.reps_completed IS NOT NULL
            ORDER BY
              CASE WHEN sl2.reps_completed ~ '^\d+$'
                THEN sl2.reps_completed::integer
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
        FROM workout_sessions ws
        JOIN set_logs sl ON sl.session_id = ws.id
        WHERE sl.exercise_id = p_exercise_id
          AND ws.user_id = v_uid
          AND ws.completed_at IS NOT NULL
        GROUP BY ws.id, ws.completed_at
        ORDER BY ws.completed_at
      ) sess
    ), '[]'::JSON)
  ) INTO result;

  RETURN result;
END;
$$;
