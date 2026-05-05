-- ============================================================
-- Migration: add seat_position + notes to exercises
--            make complete_workout idempotent (safe to retry
--            on network errors / offline sync)
-- Run once in your Supabase SQL editor.
-- ============================================================

ALTER TABLE exercises
  ADD COLUMN IF NOT EXISTS seat_position TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS notes         TEXT NOT NULL DEFAULT '';

-- ============================================================
-- Replace complete_workout with idempotent version.
-- If the session is already completed (offline retry scenario)
-- the function returns early without inserting duplicate set_logs.
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

  -- Idempotency guard: already completed → skip (safe for offline retries)
  IF EXISTS (
    SELECT 1 FROM workout_sessions
    WHERE id = p_session_id AND completed_at IS NOT NULL
  ) THEN
    RETURN;
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
