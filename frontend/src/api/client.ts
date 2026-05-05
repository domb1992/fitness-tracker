import { supabase } from '../lib/supabase';
import { TrainingPlan, WorkoutSession, Stats, Exercise, ExerciseHistory, MuscleVolume, LiftProgressionEntry } from '../types';

// ─── Auth ─────────────────────────────────────────────────────────────────────

export const authApi = {
  register: async (email: string, password: string, name: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name } },
    });
    if (error) throw error;
    return data; // caller checks data.session (null = email confirmation pending)
  },

  login: async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  },

  logout: () => supabase.auth.signOut(),
};

// ─── Plans ────────────────────────────────────────────────────────────────────

export const plansApi = {
  getAll: async (): Promise<TrainingPlan[]> => {
    const [{ data: plans, error: planErr }, { data: sessions, error: sessErr }] = await Promise.all([
      supabase.from('training_plans').select('*, exercises(*)').order('plan_order'),
      supabase
        .from('workout_sessions')
        .select('id, plan_id, completed_at')
        .not('completed_at', 'is', null)
        .order('completed_at', { ascending: false }),
    ]);
    if (planErr) throw planErr;
    if (sessErr) throw sessErr;

    return ((plans as any[]) ?? []).map((p) => {
      const exs: Exercise[] = [...((p.exercises ?? []) as Exercise[])].sort(
        (a, b) => a.exercise_order - b.exercise_order
      );
      const ps = ((sessions as any[]) ?? []).filter((s) => s.plan_id === p.id);
      return {
        ...p,
        exercises:      exs,
        exercise_count: exs.length,
        session_count:  ps.length,
        last_used:      ps[0]?.completed_at ?? null,
      } as TrainingPlan;
    });
  },

  create: async (d: { name: string; description?: string; color?: string; plan_order?: number }) => {
    const { data: { user } } = await supabase.auth.getUser();
    const { data: plan, error } = await supabase
      .from('training_plans')
      .insert({ ...d, user_id: user!.id })
      .select()
      .single();
    if (error) throw error;
    return { ...(plan as any), exercises: [], exercise_count: 0, session_count: 0, last_used: null } as TrainingPlan;
  },

  update: async (id: string, d: { name: string; description: string; color: string }) => {
    const { data: plan, error } = await supabase
      .from('training_plans').update(d).eq('id', id).select().single();
    if (error) throw error;
    return plan as any as TrainingPlan;
  },

  getLastWeightsForExercises: async (
    exerciseIds: string[],
  ): Promise<Record<string, Array<{ weight_kg: number | null; reps_completed: string | null }>>> => {
    if (exerciseIds.length === 0) return {};
    const { data, error } = await supabase
      .from('set_logs')
      .select('exercise_id, set_number, weight_kg, reps_completed, workout_sessions!inner(completed_at)')
      .in('exercise_id', exerciseIds)
      .not('workout_sessions.completed_at', 'is', null);
    if (error) throw error;
    const rows = (data as any[]) ?? [];
    // Find the most recent completed_at per exercise
    const maxDate: Record<string, string> = {};
    for (const r of rows) {
      const ca: string = r.workout_sessions?.completed_at ?? '';
      if (!maxDate[r.exercise_id] || ca > maxDate[r.exercise_id]) maxDate[r.exercise_id] = ca;
    }
    // Collect sets from that most-recent session, sorted by set_number
    const result: Record<string, Array<{ weight_kg: number | null; reps_completed: string | null; set_number: number }>> = {};
    for (const r of rows) {
      const ca: string = r.workout_sessions?.completed_at ?? '';
      if (ca !== maxDate[r.exercise_id]) continue;
      if (!result[r.exercise_id]) result[r.exercise_id] = [];
      result[r.exercise_id].push({ weight_kg: r.weight_kg, reps_completed: r.reps_completed ?? null, set_number: r.set_number });
    }
    for (const exId of Object.keys(result)) {
      result[exId].sort((a, b) => a.set_number - b.set_number);
    }
    return result;
  },

  delete: async (id: string) => {
    const { error } = await supabase.from('training_plans').delete().eq('id', id);
    if (error) throw error;
  },

  addExercise: async (planId: string, d: {
    name: string; sets: number; target_reps: string; exercise_order: number;
    seat_position?: string; notes?: string;
    exercise_type?: string; planned_duration_minutes?: number;
    primary_muscles?: string[]; secondary_muscles?: string[];
    movement_pattern?: string; equipment?: string; muscle_source?: string;
  }): Promise<Exercise> => {
    const { data: ex, error } = await supabase
      .from('exercises')
      .insert({ ...d, plan_id: planId })
      .select()
      .single();
    if (error) throw error;
    return ex as Exercise;
  },

  updateExercise: async (_planId: string, exerciseId: string, d: {
    name: string; sets: number; target_reps: string; exercise_order: number;
    seat_position?: string; notes?: string;
    exercise_type?: string; planned_duration_minutes?: number;
    primary_muscles?: string[]; secondary_muscles?: string[];
    movement_pattern?: string; equipment?: string; muscle_source?: string;
  }) => {
    const { data: ex, error } = await supabase
      .from('exercises').update(d).eq('id', exerciseId).select().single();
    if (error) throw error;
    return ex as Exercise;
  },

  deleteExercise: async (_planId: string, exerciseId: string) => {
    const { error } = await supabase.from('exercises').delete().eq('id', exerciseId);
    if (error) throw error;
  },
};

// ─── Exercises ────────────────────────────────────────────────────────────────

export const exercisesApi = {
  getHistory: async (exerciseId: string): Promise<ExerciseHistory> => {
    const { data, error } = await supabase.rpc('get_exercise_history', { p_exercise_id: exerciseId });
    if (error) throw error;
    return data as ExerciseHistory;
  },

  getMonthlyMuscleVolume: async (year: number, month: number): Promise<MuscleVolume[]> => {
    const { data, error } = await supabase.rpc('get_monthly_muscle_volume', { p_year: year, p_month: month });
    if (error) throw error;
    return (data as MuscleVolume[]) ?? [];
  },

  getLiftProgression: async (): Promise<LiftProgressionEntry[]> => {
    const { data, error } = await supabase.rpc('get_lift_progression');
    if (error) throw error;
    return (data as LiftProgressionEntry[]) ?? [];
  },
};

// ─── Sessions ─────────────────────────────────────────────────────────────────

export const sessionsApi = {
  getAll: async (limit = 20): Promise<WorkoutSession[]> => {
    const { data, error } = await supabase
      .from('workout_sessions')
      .select('*, training_plans!inner(name, color), set_logs(id)')
      .not('completed_at', 'is', null)
      .order('completed_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return ((data as any[]) ?? []).map((s) => ({
      ...s,
      plan_name:  s.training_plans.name,
      plan_color: s.training_plans.color,
      total_sets: (s.set_logs as any[]).length,
    })) as WorkoutSession[];
  },

  getStats: async (): Promise<Stats> => {
    const { data, error } = await supabase.rpc('get_workout_stats');
    if (error) throw error;
    return data as Stats;
  },

  start: async (planId: string): Promise<{ id: string; started_at: string }> => {
    const { data: { user } } = await supabase.auth.getUser();
    const { data, error } = await supabase
      .from('workout_sessions')
      .insert({ plan_id: planId, user_id: user!.id })
      .select('id, started_at')
      .single();
    if (error) throw error;
    return data as { id: string; started_at: string };
  },

  delete: async (sessionId: string) => {
    const { error } = await supabase.from('workout_sessions').delete().eq('id', sessionId);
    if (error) throw error;
  },

  getWithLogs: async (sessionId: string) => {
    const { data, error } = await supabase
      .from('workout_sessions')
      .select('*, training_plans!inner(name, color, exercises(*)), set_logs(*)')
      .eq('id', sessionId)
      .single();
    if (error) throw error;
    return data as any;
  },

  updateSetLog: async (logId: string, d: { weight_kg: number | null; reps_completed: string | null }) => {
    const { error } = await supabase.from('set_logs').update(d).eq('id', logId);
    if (error) throw error;
  },

  updateSession: async (sessionId: string, d: { completed_at: string }) => {
    const { error } = await supabase.from('workout_sessions').update(d).eq('id', sessionId);
    if (error) throw error;
  },

  complete: async (sessionId: string, params: {
    notes?: string;
    durationSeconds: number;
    setLogs: Array<{
      exercise_id: string;
      set_number: number;
      weight_kg: number | null;
      reps_completed: string | null;
      notes: string;
    }>;
  }) => {
    const { error } = await supabase.rpc('complete_workout', {
      p_session_id:    sessionId,
      p_notes:         params.notes ?? '',
      p_duration_secs: params.durationSeconds,
      p_set_logs:      params.setLogs,
    });
    if (error) throw error;
  },
};
