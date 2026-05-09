import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { plansApi, sessionsApi } from '../api/client';
import { useWorkoutStore } from '../store/store';
import { useRestTimer } from '../hooks/useRestTimer';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { useWorkoutClock } from '../hooks/useWorkoutClock';
import { TrainingPlan } from '../types';
import { Badge, Button, Typography } from '../components/ui';

// Components
import { WorkoutHeader } from './workout/components/WorkoutHeader';
import { WorkoutProgress } from './workout/components/WorkoutProgress';
import { WarmupExerciseCard } from './workout/components/WarmupExerciseCard';
import { StrengthExerciseCard } from './workout/components/StrengthExerciseCard';
import { RestTimerPanel } from './workout/components/RestTimerPanel';
import { WorkoutDialogs } from './workout/components/WorkoutDialogs';

export default function WorkoutPage() {
  const { planId } = useParams<{ planId: string }>();
  const navigate   = useNavigate();

  const {
    sessionId, planName, exercises, startedAt, syncPending,
    startWorkout, updateSet, markSetDone, addSet, removeSet, clearWorkout, setSyncPending,
  } = useWorkoutStore();

  const timer        = useRestTimer();
  const isOnline     = useOnlineStatus();
  const elapsedClock = useWorkoutClock(startedAt);  // shared hook

  const [loading,      setLoading]      = useState(false);
  const [completing,   setCompleting]   = useState(false);
  const [error,        setError]        = useState('');
  const [showConfirm,  setShowConfirm]  = useState(false);
  const [showAbandon,  setShowAbandon]  = useState(false);
  const [lastSet,      setLastSet]      = useState<string>('');

  useEffect(() => {
    if (syncPending) { navigate('/dashboard', { replace: true }); }
  }, [syncPending, navigate]);

  useEffect(() => {
    if (sessionId && planId && exercises.length > 0) return;
    if (!planId) { navigate('/dashboard', { replace: true }); return; }
    setLoading(true);
    plansApi.getAll()
      .then(async (plans) => {
        const plan = plans.find((p: TrainingPlan) => p.id === planId);
        if (!plan) { navigate('/dashboard', { replace: true }); return; }
        const [session, lastWeights] = await Promise.all([
          sessionsApi.start(plan.id),
          plansApi.getLastWeightsForExercises(plan.exercises.map((e) => e.id)),
        ]);
        startWorkout(session.id, plan, lastWeights);
      })
      .catch(() => navigate('/dashboard', { replace: true }))
      .finally(() => setLoading(false));
  }, [planId, sessionId, exercises.length, navigate, startWorkout]);

  function handleSetDone(exIdx: number, setIdx: number) {
    const s = exercises[exIdx]?.sets[setIdx];
    if (!s) return;
    const wasDone  = s.done;
    const isWarmup = exercises[exIdx].exercise.exercise_type === 'warmup';

    if (!wasDone) {
      if (!s.weight.trim() && s.lastWeight) updateSet(exIdx, setIdx, 'weight', s.lastWeight);
      if (!s.reps.trim()   && s.lastReps)   updateSet(exIdx, setIdx, 'reps',   s.lastReps);
    }

    markSetDone(exIdx, setIdx);

    if (!wasDone) {
      if (!isWarmup) timer.startFrom(timer.initialSeconds);
      setLastSet(
        isWarmup
          ? `${exercises[exIdx].exercise.name} · Done`
          : `${exercises[exIdx].exercise.name} · Set ${setIdx + 1}`
      );
      const otherSets = exercises[exIdx].sets.filter((_, j) => j !== setIdx);
      if (otherSets.every((st) => st.done)) {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    }
  }

  async function confirmComplete() {
    if (!sessionId || !startedAt) return;

    if (!isOnline) {
      setSyncPending(true);
      setShowConfirm(false);
      navigate('/dashboard', { replace: true });
      return;
    }

    setCompleting(true); setError('');
    const durationSeconds = Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000);
    const setLogs = exercises.flatMap(({ exercise, sets }) =>
      sets.map((s, idx) => ({
        exercise_id:    exercise.id,
        set_number:     idx + 1,
        weight_kg:      s.weight ? parseFloat(s.weight) : null,
        reps_completed: s.reps.trim() || null,
        notes:          s.notes,
      }))
    );
    try {
      await sessionsApi.complete(sessionId, { durationSeconds, setLogs });
      clearWorkout();
      navigate('/dashboard', { replace: true });
    } catch (err: any) {
      setError(err.message || 'Failed to save workout');
      setCompleting(false);
      setShowConfirm(false);
    }
  }

  const doneCount = exercises.reduce((a, ex) => a + ex.sets.filter((s) => s.done).length, 0);
  const totalSets = exercises.reduce((a, ex) => a + ex.sets.length, 0);
  const progress  = totalSets > 0 ? doneCount / totalSets : 0;
  const allDone   = doneCount === totalSets && totalSets > 0;

  if (loading) {
    return (
      <div className="ft-loader">
        <div className="ft-loader-dot" />
        <span className="mono-tag">Starting workout…</span>
      </div>
    );
  }

  // Pre-compute per-exercise strength number once so we don't duplicate the slice+filter in each render branch
  const exercisesWithMeta = exercises.map((ex, i) => ({
    ex,
    i,
    strengthNumber: exercises.slice(0, i).filter((e) => e.exercise.exercise_type !== 'warmup').length + 1,
  }));
  const activeGroup    = exercisesWithMeta.filter(({ ex }) => ex.sets.some((s) => !s.done));
  const completedGroup = exercisesWithMeta.filter(({ ex }) => ex.sets.every((s) => s.done));

  return (
    <div className="ft-screen" style={{ paddingBottom: 'calc(240px + env(safe-area-inset-bottom, 0px))' }}>

      {!isOnline && (
        <Badge variant="warning" className="rounded-none border-0 px-5 py-2 block">
          <svg width={11} height={11} viewBox="0 0 24 24" fill="currentColor" className="inline-block mr-2">
            <path d="M1 1l22 22M16.72 11.06A10.94 10.94 0 0 1 19 12.55M5 12.55a10.94 10.94 0 0 1 5.17-2.39M10.71 5.05A16 16 0 0 1 22.56 9M1.42 9a15.91 15.91 0 0 1 4.7-2.88M8.53 16.11a6 6 0 0 1 6.95 0M12 20h.01"/>
          </svg>
          OFFLINE — PROGRESS SAVED LOCALLY
        </Badge>
      )}

      <WorkoutHeader
        planName={planName}
        onBack={() => navigate('/dashboard')}
        onFinish={() => setShowConfirm(true)}
        isCompleting={completing}
        isAllDone={allDone}
      />

      <WorkoutProgress
        elapsedClock={elapsedClock}
        doneCount={doneCount}
        totalSets={totalSets}
        progress={progress}
        isAllDone={allDone}
      />

      {error && (
        <div className="mx-5 mb-4 font-mono text-xs text-[var(--danger)]">
          {error}
        </div>
      )}

      <div className="px-5 flex flex-col gap-3">
        {activeGroup.map(({ ex, i, strengthNumber }) => {
          if (ex.exercise.exercise_type === 'warmup') {
            return (
              <WarmupExerciseCard
                key={ex.exercise.id}
                exIdx={i}
                activeEx={ex}
                onUpdateSet={updateSet}
                onSetDone={handleSetDone}
              />
            );
          }
          return (
            <StrengthExerciseCard
              key={ex.exercise.id}
              exIdx={i}
              activeEx={ex}
              strengthNumber={strengthNumber}
              onUpdateSet={updateSet}
              onSetDone={handleSetDone}
              onAddSet={addSet}
              onRemoveSet={removeSet}
            />
          );
        })}

        <Button
          variant={allDone ? 'lime' : 'primary'}
          className="mt-1 h-14"
          onClick={() => setShowConfirm(true)}
          disabled={completing}
          rightIcon={(
            <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 12l5 5L20 6"/>
            </svg>
          )}
        >
          {completing ? 'Saving…' : allDone ? 'Save & Finish 🎉' : 'Finish Workout'}
        </Button>

        {completedGroup.length > 0 && (
          <>
            <div className="flex items-center gap-2.5 my-0.5">
              <div className="flex-1 h-px bg-[var(--hair)]" />
              <Typography variant="mono" className="text-[9px] text-[var(--ink-4)]">
                DONE ({completedGroup.length})
              </Typography>
              <div className="flex-1 h-px bg-[var(--hair)]" />
            </div>
            {completedGroup.map(({ ex, i, strengthNumber }) => {
              if (ex.exercise.exercise_type === 'warmup') {
                return (
                  <WarmupExerciseCard
                    key={ex.exercise.id}
                    exIdx={i}
                    activeEx={ex}
                    onUpdateSet={updateSet}
                    onSetDone={handleSetDone}
                  />
                );
              }
              return (
                <StrengthExerciseCard
                  key={ex.exercise.id}
                  exIdx={i}
                  activeEx={ex}
                  strengthNumber={strengthNumber}
                  onUpdateSet={updateSet}
                  onSetDone={handleSetDone}
                  onAddSet={addSet}
                  onRemoveSet={removeSet}
                />
              );
            })}
          </>
        )}

        <button
          onClick={() => setShowAbandon(true)}
          className="w-full mt-2 py-3 bg-transparent border-none cursor-pointer font-mono text-[10px] tracking-widest uppercase text-[var(--ink-4)] hover:text-[var(--ink-3)] transition-colors"
        >
          Exit without saving
        </button>
      </div>

      <RestTimerPanel
        timer={timer}
        lastSet={lastSet}
      />

      <WorkoutDialogs
        showConfirm={showConfirm}
        onConfirmClose={() => setShowConfirm(false)}
        onConfirmSave={confirmComplete}
        showAbandon={showAbandon}
        onAbandonClose={() => setShowAbandon(false)}
        onAbandonExit={() => { clearWorkout(); navigate('/dashboard', { replace: true }); }}
        isCompleting={completing}
        doneCount={doneCount}
        totalSets={totalSets}
      />
    </div>
  );
}
