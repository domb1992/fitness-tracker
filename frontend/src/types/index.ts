// All IDs are UUIDs (strings) in Supabase

export interface User {
  id: string;
  email: string;
  name: string;
}

export interface Exercise {
  id: string;
  plan_id: string;
  name: string;
  sets: number;
  target_reps: string;
  exercise_order: number;
  seat_position: string;             // optional machine/seat setup info
  notes: string;                     // optional exercise-level notes/tips
  exercise_type?: string;            // 'strength' (default) | 'warmup'
  planned_duration_minutes?: number; // warmup only: planned duration in minutes
  primary_muscles?: string[];        // e.g. ['Chest', 'Front Delts']
  secondary_muscles?: string[];      // e.g. ['Triceps']
  movement_pattern?: string;         // e.g. 'horizontal_push'
  equipment?: string;                // e.g. 'barbell' | 'dumbbell' | 'cable' | 'machine' | 'bodyweight'
  muscle_source?: string;            // 'auto' | 'manual' | 'none'
}

export interface TrainingPlan {
  id: string;
  user_id: string;
  name: string;
  description: string;
  color: string;
  plan_order: number;
  exercise_count: number;
  session_count: number;
  last_used: string | null;
  exercises: Exercise[];
}

export interface SetLog {
  exercise_id: string;
  set_number: number;
  weight_kg: number | null;
  reps_completed: string | null;
  notes: string;
}

export interface WorkoutSession {
  id: string;
  user_id: string;
  plan_id: string;
  plan_name: string;
  plan_color: string;
  started_at: string;
  completed_at: string | null;
  duration_seconds: number | null;
  notes: string;
  total_sets?: number;
}

export interface ExerciseStats {
  exercise_id: string;
  exercise_name: string;
  plan_id: string;
  plan_name: string;
  best_weight: number | null;
  last_weight: number | null;
  last_reps: string | null;
  start_weight: number | null;
  first_logged_at?: string | null;
  last_logged_at?: string | null;
}

export interface MuscleVolume {
  muscle: string;
  weighted_sets: number;
}

export interface LiftProgressionEntry {
  exercise_id: string;
  exercise_name: string;
  plan_name: string;
  start_weight: number;        // avg weight from first valid session
  last_weight: number;         // avg weight from most recent valid session
  best_weight: number | null;  // highest avg weight ever recorded
  diff: number;                // last_weight - start_weight
  pct_change: number;          // percentage change (0 if no valid start)
  first_logged_at: string;     // ISO date of first valid session
  last_logged_at: string;      // ISO date of most recent valid session
  session_count: number;       // number of sessions with valid weight data
  sparkline: number[];         // ordered array of per-session avg weights
}

export interface ExerciseSessionLog {
  set_number: number;
  weight_kg: number | null;
  reps_completed: string | null;
}

export interface ExerciseSession {
  session_id: string;
  completed_at: string;
  best_weight: number | null;
  best_reps: string | null;
  sets: ExerciseSessionLog[];
}

export interface ExerciseHistory {
  exercise: { id: string; name: string; plan_name: string };
  sessions: ExerciseSession[];
}

export interface Stats {
  totalWorkouts: number;
  thisWeek: number;
  bestWeights: ExerciseStats[];
  weeklyData: { week: string; count: number }[];
}

export interface ActiveSetLog {
  weight:     string;   // what the user typed this session
  lastWeight: string;   // previous session's weight, shown as placeholder
  reps:       string;   // what the user typed this session
  lastReps:   string;   // previous session's reps, shown as placeholder
  notes:      string;
  done:       boolean;
}

export interface ActiveExercise {
  exercise: Exercise;
  sets: ActiveSetLog[];
}
