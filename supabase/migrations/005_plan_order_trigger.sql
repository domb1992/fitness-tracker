-- =============================================================================
-- Migration 005 — Auto-assign plan_order on INSERT
-- =============================================================================
-- Problem: the frontend was passing Date.now() (~1.778 trillion) as plan_order,
-- which overflows PostgreSQL's INTEGER type (max 2,147,483,647).
--
-- Fix: let the database own plan ordering. A BEFORE INSERT trigger computes
-- the next sequential value per user, so the frontend never needs to send it.
-- =============================================================================

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
