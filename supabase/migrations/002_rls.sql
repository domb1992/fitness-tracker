-- =============================================================================
-- FitTrack — Migration 002: Row Level Security
-- =============================================================================
-- Must run AFTER 001_schema.sql.
--
-- Security model
-- ─────────────────────────────────────────────────────────────────────────────
-- All tables use the authenticated role.  Unauthenticated access is blocked
-- entirely because no policy grants access to the anon role.
--
-- Ownership chain:
--   training_plans   → owned directly by user_id
--   exercises        → owned via training_plans.user_id
--   workout_sessions → owned directly by user_id
--   set_logs         → owned via workout_sessions.user_id
--
-- Indirect ownership (exercises, set_logs) uses EXISTS rather than IN so that
-- the query planner can use the primary-key index on the parent table and stop
-- at the first matching row instead of collecting the full subquery result.
-- =============================================================================

-- Enable RLS (idempotent — safe to run on an existing database too)
ALTER TABLE training_plans   ENABLE ROW LEVEL SECURITY;
ALTER TABLE exercises         ENABLE ROW LEVEL SECURITY;
ALTER TABLE workout_sessions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE set_logs          ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- training_plans: user owns rows directly via user_id
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "users_own_plans" ON training_plans;

CREATE POLICY "users_own_plans" ON training_plans
  FOR ALL
  TO authenticated
  USING     (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- exercises: user owns rows via the parent plan
--
-- EXISTS (point-lookup on training_plans PK) is faster than
-- plan_id IN (SELECT id FROM training_plans WHERE user_id = ...) because:
--   • It uses the training_plans primary-key index directly
--   • It short-circuits on the first match
--   • It avoids materialising the full subquery result set
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "users_own_exercises" ON exercises;

CREATE POLICY "users_own_exercises" ON exercises
  FOR ALL
  TO authenticated
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

-- ---------------------------------------------------------------------------
-- workout_sessions: user owns rows directly via user_id
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "users_own_sessions" ON workout_sessions;

CREATE POLICY "users_own_sessions" ON workout_sessions
  FOR ALL
  TO authenticated
  USING     (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- set_logs: user owns rows via the parent session
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "users_own_set_logs" ON set_logs;

CREATE POLICY "users_own_set_logs" ON set_logs
  FOR ALL
  TO authenticated
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
