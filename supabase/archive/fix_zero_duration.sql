-- Fix manually-entered workouts that show as 0 minutes.
-- Covers NULL, 0, and any duration under 60 seconds (all appear as "0m" in the UI).
-- Sets duration_seconds to 45 minutes (2700s) for every completed session
-- that has no meaningful recorded duration.

UPDATE workout_sessions
SET duration_seconds = 2700
WHERE completed_at IS NOT NULL
  AND (duration_seconds IS NULL OR duration_seconds < 60);
