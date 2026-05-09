-- ============================================================
-- FitTrack – Muscle Assignment Migration
-- Run this after add_warmup_fields.sql
-- ============================================================

ALTER TABLE exercises
  ADD COLUMN IF NOT EXISTS primary_muscles   TEXT[]  NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS secondary_muscles TEXT[]  NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS movement_pattern  TEXT    NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS equipment         TEXT    NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS muscle_source     TEXT    NOT NULL DEFAULT 'none';

-- Index for future muscle-volume queries
CREATE INDEX IF NOT EXISTS idx_exercises_muscle_source ON exercises(muscle_source);
