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

// ─── Performance Coach / Analytics ───────────────────────────────────────────

export interface CoachSession {
  id: string;
  completed_at: string;
  duration_seconds: number | null;
  plan_id: string | null;
  muscles: string[];
}

export interface CoachExerciseSession {
  exercise_id: string;
  exercise_name: string;
  primary_muscles: string[];
  secondary_muscles: string[];
  movement_pattern: string;
  completed_at: string;
  avg_weight: number | null;
  max_weight: number | null;
  total_sets: number;
  total_volume: number;
}

export interface CoachData {
  sessions: CoachSession[];
  exercise_sessions: CoachExerciseSession[];
}

export type InsightType       = 'positive' | 'warning' | 'info' | 'pr';
export type InsightCategory   = 'progression' | 'consistency' | 'volume' | 'recovery' | 'balance' | 'pr' | 'coaching';
export type InsightTrend      = 'up' | 'down' | 'neutral';
export type InsightConfidence = 'high' | 'medium' | 'low';

export interface Insight {
  id: string;
  type: InsightType;
  category: InsightCategory;
  title: string;
  body: string;
  signals?: string[];           // data points that triggered this insight
  causes?: string[];            // possible reasons (for warnings)
  suggestions?: string[];       // actionable next steps
  confidenceReason?: string;    // why this confidence level
  metric?: string;
  trend: InsightTrend;
  confidence: InsightConfidence;
  timeframe?: string;
  exerciseId?: string;
  priority: number;
}

// ─── Score breakdown ──────────────────────────────────────────────────────────

export interface ScoreFactor {
  label: string;
  description: string;  // current value as human-readable sentence
  earned: number;       // points earned for this factor
  max: number;          // max possible points
  positive: boolean;    // is this factor currently working in user's favour
}

export interface ScoreBreakdown {
  score: number;
  summary: string;      // one-liner shown collapsed
  factors: ScoreFactor[];
  positives: string[];
  negatives: string[];
  suggestions: string[];
  trendDirection: InsightTrend;
  trendText: string;
  dataNote: string;
}

export interface AnalyticsScores {
  consistency: number;
  volume:      number;
  balance:     number;
}

export interface AnalyticsBreakdowns {
  consistency: ScoreBreakdown;
  volume:      ScoreBreakdown;
  balance:     ScoreBreakdown;
}

export type DataQuality = 'insufficient' | 'limited' | 'good' | 'excellent';

// ─── AI Export ────────────────────────────────────────────────────────────────

/** One logged set, enriched with computed volume + estimated 1RM */
export interface ExportSetLog {
  set_number: number;
  weight_kg: number | null;
  reps: string | null;
  volume_kg: number | null;      // weight_kg × reps (numeric only)
  estimated_1rm: number | null;  // Epley: weight × (1 + reps/30), reps 1–20
  notes: string;
}

export interface ExportExercise {
  name: string;
  exercise_type: 'strength' | 'warmup';
  primary_muscles: string[];
  secondary_muscles: string[];
  movement_pattern: string;
  equipment: string;
  sets: ExportSetLog[];
  total_sets: number;
  total_volume_kg: number | null;
  best_weight_kg: number | null;
  best_estimated_1rm: number | null;
}

export interface ExportWorkout {
  date: string;               // ISO timestamp of completion
  workout_name: string;
  duration_minutes: number | null;
  total_strength_sets: number;
  total_volume_kg: number | null;
  notes: string;
  exercises: ExportExercise[];
}

export interface ExportExerciseProgression {
  exercise_name: string;
  plan_name: string;
  start_weight_kg: number;
  current_weight_kg: number;
  best_weight_kg: number | null;
  total_gain_kg: number;
  pct_change: number;
  session_count: number;
  first_logged: string;
  last_logged: string;
  weight_history: number[];   // per-session avg weights, chronological
  plateau_detected: boolean;
  trend: 'up' | 'down' | 'neutral';
}

export interface ExportAnalytics {
  weekly_volume_sets: Record<string, number>;   // ISO week (Mon) → strength sets
  weekly_workouts: Record<string, number>;      // ISO week (Mon) → session count
  muscle_group_volume_sets: Record<string, number>;  // muscle → weighted sets (all-time)
  avg_workouts_per_week_all_time: number;
  avg_workouts_per_week_last_4w: number;
  consistency_score: number;    // 0–100
  volume_score: number;         // 0–100
  balance_score: number;        // 0–100
  push_sets_30d: number;
  pull_sets_30d: number;
  leg_sets_30d: number;
  push_pct_30d: number;
  pull_pct_30d: number;
  leg_pct_30d: number;
  push_pull_ratio_30d: number;
  plateaus_detected: Array<{
    exercise_name: string;
    stuck_at_kg: number;
    session_count: number;
    last_logged: string;
  }>;
  strongest_progressions: Array<{
    exercise_name: string;
    total_gain_kg: number;
    pct_change: number;
    session_count: number;
  }>;
  weakest_progressions: Array<{
    exercise_name: string;
    pct_change: number;
    trend: string;
    note: string;
  }>;
  avg_days_between_workouts: number;
  max_gap_days: number;
  longest_streak_days: number;
  muscle_imbalances: string[];
}

export interface ExportStatistics {
  total_workouts: number;
  total_volume_kg: number;
  total_sets: number;
  avg_workout_duration_minutes: number | null;
  avg_workouts_per_week: number;
  training_days_total: number;
  first_workout: string | null;
  last_workout: string | null;
  consistency_score: number;
  volume_score: number;
  balance_score: number;
  data_quality: DataQuality;
}

export interface FitTrackExport {
  export_version: '1.0';
  export_created_at: string;
  date_range: { from: string | null; to: string | null };
  profile: { name: string };
  statistics: ExportStatistics;
  workouts: ExportWorkout[];
  exercise_progression: ExportExerciseProgression[];
  analytics: ExportAnalytics;
}

export interface AnalyticsResult {
  scores:      AnalyticsScores;
  breakdowns:  AnalyticsBreakdowns;
  insights:    Insight[];
  lastUpdated: Date;
  dataQuality: DataQuality;
}
