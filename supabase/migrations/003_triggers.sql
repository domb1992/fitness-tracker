-- =============================================================================
-- FitTrack — Migration 003: Triggers
-- =============================================================================
-- Must run AFTER 001_schema.sql.
--
-- Creates a shared trigger function that stamps updated_at = NOW() on any
-- UPDATE, then attaches it to every table that has an updated_at column.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Shared trigger function
-- ---------------------------------------------------------------------------
-- SECURITY DEFINER is not needed here — the trigger runs in the context of
-- the statement that fired it, which is already authenticated.

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- training_plans
-- ---------------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_training_plans_updated_at ON training_plans;

CREATE TRIGGER trg_training_plans_updated_at
  BEFORE UPDATE ON training_plans
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- exercises
-- ---------------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_exercises_updated_at ON exercises;

CREATE TRIGGER trg_exercises_updated_at
  BEFORE UPDATE ON exercises
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();
