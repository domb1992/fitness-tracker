import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { supabase } from '../lib/supabase';
import { User, TrainingPlan, ActiveExercise } from '../types';

// ─── Theme Store ──────────────────────────────────────────────────────────────

export type ThemeChoice = 'light' | 'dark' | 'system';

interface ThemeState {
  theme: ThemeChoice;
  setTheme: (t: ThemeChoice) => void;
  applyTheme: () => void;
}

function resolveTheme(choice: ThemeChoice): 'light' | 'dark' {
  if (choice === 'system') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return choice;
}

function applyThemeToDOM(choice: ThemeChoice) {
  document.documentElement.setAttribute('data-theme', resolveTheme(choice));
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      theme: 'system',

      setTheme: (t) => {
        set({ theme: t });
        applyThemeToDOM(t);
      },

      applyTheme: () => {
        applyThemeToDOM(get().theme);
      },
    }),
    {
      name: 'fittrack-theme',
      onRehydrateStorage: () => (state) => {
        if (state) applyThemeToDOM(state.theme);
      },
    }
  )
);

// ─── Auth Store ───────────────────────────────────────────────────────────────

interface AuthState {
  user:        User | null;
  initialized: boolean;
  init:        () => () => void;   // returns unsubscribe for useEffect cleanup
  signOut:     () => Promise<void>;
  updateName:  (name: string) => Promise<void>;
}

function mapUser(u: any): User {
  return {
    id:    u.id,
    email: u.email ?? '',
    name:  u.user_metadata?.name ?? u.email ?? 'User',
  };
}

export const useAuthStore = create<AuthState>((set) => ({
  user:        null,
  initialized: false,

  init: () => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      set({ user: session?.user ? mapUser(session.user) : null, initialized: true });
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      set({ user: session?.user ? mapUser(session.user) : null, initialized: true });
    });
    return () => subscription.unsubscribe();
  },

  signOut: async () => {
    await supabase.auth.signOut();
    set({ user: null });
  },

  updateName: async (name: string) => {
    const { data, error } = await supabase.auth.updateUser({ data: { name } });
    if (error) throw error;
    if (data.user) set({ user: mapUser(data.user) });
  },
}));

// ─── Workout Store ────────────────────────────────────────────────────────────

interface WorkoutState {
  sessionId:   string | null;
  planId:      string | null;
  planName:    string;
  planColor:   string;
  exercises:   ActiveExercise[];
  startedAt:   string | null;
  /** true when the user finished the workout while offline; waiting to sync to server */
  syncPending: boolean;
  startWorkout:    (sessionId: string, plan: TrainingPlan, lastWeights?: Record<string, Array<{ weight_kg: number | null; reps_completed: string | null }>>) => void;
  updateSet:       (exIdx: number, setIdx: number, field: 'weight' | 'reps' | 'notes', value: string) => void;
  markSetDone:     (exIdx: number, setIdx: number) => void;
  addSet:          (exIdx: number) => void;
  removeSet:       (exIdx: number) => void;
  setSyncPending:  (v: boolean) => void;
  clearWorkout:    () => void;
}

const emptyWorkout = {
  sessionId: null, planId: null, planName: '', planColor: '', exercises: [], startedAt: null, syncPending: false,
};

export const useWorkoutStore = create<WorkoutState>()(
  persist(
    (set) => ({
      ...emptyWorkout,

      startWorkout: (sessionId, plan, lastWeights) =>
        set({
          sessionId,
          planId:    plan.id,
          planName:  plan.name,
          planColor: plan.color,
          startedAt: new Date().toISOString(),
          exercises: plan.exercises.map((ex) => ({
            exercise: ex,
            sets: Array.from({ length: ex.sets }, (_, i) => ({
              weight:     '',   // always start empty — user must actively enter a value
              lastWeight: lastWeights?.[ex.id]?.[i]?.weight_kg != null
                ? String(lastWeights[ex.id][i].weight_kg)
                : '',
              reps:     '',   // always start empty
              lastReps: lastWeights?.[ex.id]?.[i]?.reps_completed
                ? String(lastWeights[ex.id][i].reps_completed)
                : '',
              notes: '',
              done:  false,
            })),
          })),
        }),

      updateSet: (exIdx, setIdx, field, value) =>
        set((s) => ({
          exercises: s.exercises.map((ex, i) =>
            i !== exIdx ? ex : {
              ...ex,
              sets: ex.sets.map((st, j) => j !== setIdx ? st : { ...st, [field]: value }),
            }
          ),
        })),

      markSetDone: (exIdx, setIdx) =>
        set((s) => {
          const updated = s.exercises.map((ex, i) =>
            i !== exIdx ? ex : {
              ...ex,
              sets: ex.sets.map((st, j) => j !== setIdx ? st : { ...st, done: !st.done }),
            }
          );
          const wasAllDone = s.exercises[exIdx].sets.every((st) => st.done);
          const isNowAllDone = updated[exIdx].sets.every((st) => st.done);
          // Exercise just became fully done → move to end so the next active exercise floats up
          if (!wasAllDone && isNowAllDone) {
            const without = updated.filter((_, i) => i !== exIdx);
            return { exercises: [...without, updated[exIdx]] };
          }
          return { exercises: updated };
        }),

      addSet: (exIdx) =>
        set((s) => ({
          exercises: s.exercises.map((ex, i) =>
            i !== exIdx ? ex : { ...ex, sets: [...ex.sets, { weight: '', lastWeight: '', reps: '', lastReps: '', notes: '', done: false }] }
          ),
        })),

      removeSet: (exIdx) =>
        set((s) => ({
          exercises: s.exercises.map((ex, i) =>
            i !== exIdx || ex.sets.length <= 1 ? ex : { ...ex, sets: ex.sets.slice(0, -1) }
          ),
        })),

      setSyncPending: (v) => set({ syncPending: v }),

      clearWorkout: () => set(emptyWorkout),
    }),
    { name: 'fittrack-workout' }
  )
);
