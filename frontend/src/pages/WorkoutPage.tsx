import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { plansApi, sessionsApi } from '../api/client';
import { useWorkoutStore } from '../store/store';
import { useRestTimer } from '../hooks/useRestTimer';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { TrainingPlan } from '../types';

function useWorkoutClock(startedAt: string | null) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!startedAt) return;
    const iv = setInterval(() =>
      setElapsed(Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000)), 1000);
    return () => clearInterval(iv);
  }, [startedAt]);
  const m = Math.floor(elapsed / 60);
  const s = elapsed % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

// Simple SVG icons inline
const Chk = () => (
  <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 12l5 5L20 6"/>
  </svg>
);

export default function WorkoutPage() {
  const { planId } = useParams<{ planId: string }>();
  const navigate   = useNavigate();

  const {
    sessionId, planName, exercises, startedAt, syncPending,
    startWorkout, updateSet, markSetDone, addSet, removeSet, clearWorkout, setSyncPending,
  } = useWorkoutStore();

  const timer        = useRestTimer();
  const isOnline     = useOnlineStatus();
  const elapsedClock = useWorkoutClock(startedAt);

  const [customSeconds,   setCustomSeconds]   = useState(() => timer.initialSeconds);
  const [showCustomTimer, setShowCustomTimer] = useState(false);
  const [loading,      setLoading]      = useState(false);
  const [completing,   setCompleting]   = useState(false);
  const [error,        setError]        = useState('');
  const [showConfirm,  setShowConfirm]  = useState(false);
  const [showAbandon,  setShowAbandon]  = useState(false);
  const [lastSet,      setLastSet]      = useState<string>('');

  // ── Timer "Done" animation + auto-reset ──────────────────────────────────
  const [timerJustDone,    setTimerJustDone]    = useState(false);
  const timerDoneRef   = useRef(false); // prevents double-trigger per completion
  const timerResetRef  = useRef(timer.reset);
  useEffect(() => { timerResetRef.current = timer.reset; });

  useEffect(() => {
    if (timer.isDone && !timerDoneRef.current) {
      timerDoneRef.current = true;
      setTimerJustDone(true);
      const id = setTimeout(() => {
        timerResetRef.current();
        setTimerJustDone(false);
        timerDoneRef.current = false;
      }, 2500);
      return () => clearTimeout(id);
    }
    if (!timer.isDone) {
      // Timer was restarted/reset externally — clear done UI immediately
      timerDoneRef.current = false;
      setTimerJustDone(false);
    }
  }, [timer.isDone]);

  // If the workout was finished offline and is now pending sync, redirect to dashboard
  // so the sync banner there can handle it — don't show workout UI again
  useEffect(() => {
    if (syncPending) { navigate('/dashboard', { replace: true }); }
  }, [syncPending]);

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
  }, [planId]);

  function handleSetDone(exIdx: number, setIdx: number) {
    const s = exercises[exIdx]?.sets[setIdx];
    if (!s) return;
    const wasDone = s.done;
    const isWarmup = exercises[exIdx].exercise.exercise_type === 'warmup';

    if (!wasDone) {
      // Auto-fill: if the user left a field blank, use the grey placeholder value
      // (= last workout value) so we always save something meaningful.
      if (!s.weight.trim() && s.lastWeight) updateSet(exIdx, setIdx, 'weight', s.lastWeight);
      if (!s.reps.trim()   && s.lastReps)   updateSet(exIdx, setIdx, 'reps',   s.lastReps);
    }

    markSetDone(exIdx, setIdx);

    if (!wasDone) {
      // Warmup completion doesn't start the rest timer
      if (!isWarmup) {
        timer.startFrom(timer.initialSeconds);
      }
      setLastSet(
        isWarmup
          ? `${exercises[exIdx].exercise.name} · Done`
          : `${exercises[exIdx].exercise.name} · Set ${setIdx + 1}`
      );
      // If this was the last unchecked set, the exercise moves to the end → scroll to top
      const otherSets = exercises[exIdx].sets.filter((_, j) => j !== setIdx);
      if (otherSets.every((st) => st.done)) {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    }
  }

  async function confirmComplete() {
    if (!sessionId || !startedAt) return;

    // Offline: save locally and let dashboard auto-sync when back online
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

  if (loading) {
    return (
      <div style={{ minHeight: '100dvh', background: 'var(--paper)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span className="mono-tag">Starting workout…</span>
      </div>
    );
  }

  return (
    <div className="ft-screen" style={{ paddingBottom: 220 }}>

      {/* Offline banner */}
      {!isOnline && (
        <div style={{
          background: 'oklch(0.55 0.18 60)', color: 'white',
          padding: '7px 20px', display: 'flex', alignItems: 'center', gap: 8,
          fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.06em',
        }}>
          <svg width={10} height={10} viewBox="0 0 24 24" fill="currentColor">
            <path d="M1 1l22 22M16.72 11.06A10.94 10.94 0 0 1 19 12.55M5 12.55a10.94 10.94 0 0 1 5.17-2.39M10.71 5.05A16 16 0 0 1 22.56 9M1.42 9a15.91 15.91 0 0 1 4.7-2.88M8.53 16.11a6 6 0 0 1 6.95 0M12 20h.01"/>
          </svg>
          OFFLINE — PROGRESS SAVED LOCALLY
        </div>
      )}

      {/* Header */}
      <div style={{ padding: '8px 20px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <button className="icon-btn" onClick={() => navigate('/dashboard')}>
          <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M11 6l-6 6 6 6"/>
          </svg>
        </button>
        <div className="mono-tag" style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {planName}
        </div>
        <button onClick={() => setShowConfirm(true)} disabled={completing} style={{
          display: 'flex', alignItems: 'center', gap: 6, height: 32, padding: '0 12px',
          background: doneCount === totalSets && totalSets > 0 ? 'var(--lime)' : 'var(--ink)',
          color: doneCount === totalSets && totalSets > 0 ? 'var(--lime-ink)' : 'var(--paper)',
          border: 'none', borderRadius: 6,
          fontFamily: 'var(--sans)', fontSize: 12, fontWeight: 600, cursor: 'pointer',
        }}>
          <Chk /> Finish
        </button>
      </div>

      {/* Clock + Progress */}
      <div style={{ padding: '0 20px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
          <div>
            <div className="mono-tag">Elapsed</div>
            <div className="bignum" style={{ fontSize: 48, lineHeight: 1, marginTop: 4 }}>
              {elapsedClock}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div className="mono-tag">Sets</div>
            <div style={{ marginTop: 4 }}>
              <span className="bignum" style={{ fontSize: 48, lineHeight: 1 }}>{doneCount}</span>
              <span className="bignum" style={{ fontSize: 20, color: 'var(--ink-3)' }}>/{totalSets}</span>
            </div>
          </div>
        </div>
        <div style={{ height: 3, background: 'var(--paper-3)', marginTop: 12, borderRadius: 2, overflow: 'hidden' }}>
          <div style={{ width: `${progress * 100}%`, height: '100%', background: 'var(--ink)', transition: 'width 0.4s' }} />
        </div>
      </div>

      {error && (
        <div style={{ margin: '0 20px 14px', fontFamily: 'var(--mono)', fontSize: 12, color: 'oklch(0.45 0.12 30)' }}>
          {error}
        </div>
      )}

      {/* Exercises — render helper */}
      {(() => {
        // Split into active (incomplete) and completed, keeping the original store index
        // so all dispatch calls (markSetDone, updateSet, …) use the correct index.
        const withIdx = exercises.map((ex, i) => ({ ex, i }));
        const activeGroup    = withIdx.filter(({ ex }) => ex.sets.some((s) => !s.done));
        const completedGroup = withIdx.filter(({ ex }) => ex.sets.every((s) => s.done));

        const renderCard = ({ ex: activeEx, i: exIdx }: { ex: typeof exercises[0]; i: number }) => {
          const { exercise, sets } = activeEx;
          const doneSets  = sets.filter((s) => s.done).length;
          const isCurrent = doneSets < sets.length;
          const isWarmup  = exercise.exercise_type === 'warmup';

          // ── Warmup card ──────────────────────────────────────────────────────
          if (isWarmup) {
            const s = sets[0]; // warmup always has exactly 1 set
            const isActive   = !s?.done;
            const inputClass = s?.done ? 'workout-input done-set' : 'workout-input active-set';
            const accentColor = 'oklch(0.68 0.16 55)'; // amber warmup colour

            return (
              <div key={exercise.id} className={isActive ? 'surface' : 'card'} style={{
                overflow: 'hidden', transition: 'box-shadow var(--duration) var(--ease)',
                ...(isActive ? { border: `1.5px solid ${accentColor}`, boxShadow: 'var(--shadow)' } : {}),
              }}>
                {/* Warmup header */}
                <div style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '13px 16px',
                  background: isActive ? accentColor : 'transparent',
                  color: isActive ? 'white' : 'var(--ink)',
                }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
                        strokeLinecap="round" strokeLinejoin="round"
                        style={{ opacity: isActive ? 0.7 : 0.4 }}>
                        <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                      </svg>
                      <span className="mono-tag" style={{ color: isActive ? 'rgba(255,255,255,0.7)' : 'var(--ink-3)' }}>
                        WARMUP
                      </span>
                      {isActive && (
                        <span style={{ width: 5, height: 5, borderRadius: 5, background: 'white', opacity: 0.7, display: 'inline-block' }} />
                      )}
                    </div>
                    <div style={{ fontSize: 15, fontWeight: 600, marginTop: 2, letterSpacing: '-0.01em' }}>
                      {exercise.name}
                    </div>
                    {exercise.seat_position && (
                      <div style={{ marginTop: 3, display: 'flex', alignItems: 'center', gap: 5 }}>
                        <span style={{ fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.06em', opacity: 0.6, textTransform: 'uppercase' }}>Setting</span>
                        <span style={{ fontFamily: 'var(--mono)', fontSize: 10, opacity: 0.8 }}>{exercise.seat_position}</span>
                      </div>
                    )}
                    {exercise.notes && (
                      <div style={{ marginTop: 2, fontFamily: 'var(--mono)', fontSize: 9, opacity: 0.6, fontStyle: 'italic' }}>
                        {exercise.notes}
                      </div>
                    )}
                  </div>
                  {exercise.planned_duration_minutes ? (
                    <div style={{ textAlign: 'right' }}>
                      <div className="mono-tag" style={{ color: isActive ? 'rgba(255,255,255,0.6)' : 'var(--ink-3)' }}>Target</div>
                      <div className="bignum" style={{ fontSize: 13, marginTop: 2 }}>
                        {exercise.planned_duration_minutes} min
                      </div>
                    </div>
                  ) : null}
                </div>

                {/* BPM / MIN inputs */}
                <div style={{
                  display: 'grid', gridTemplateColumns: '1fr 1fr 48px',
                  padding: '8px 14px 5px 16px', borderBottom: '1px solid var(--hair)',
                }}>
                  <span className="mono-tag" style={{ textAlign: 'center' }}>BPM</span>
                  <span className="mono-tag" style={{ textAlign: 'center' }}>MIN</span>
                  <span />
                </div>

                <div style={{
                  display: 'grid', gridTemplateColumns: '1fr 1fr 48px',
                  alignItems: 'center', padding: '8px 14px 8px 16px',
                  background: isActive ? 'var(--paper-2)' : 'transparent',
                  minHeight: 56,
                }}>
                  <input
                    type="number" inputMode="numeric" value={s?.weight ?? ''}
                    onChange={(e) => updateSet(exIdx, 0, 'weight', e.target.value)}
                    placeholder={s?.lastWeight || '—'}
                    className={inputClass}
                    style={{ textDecoration: isActive ? 'underline' : 'none', textUnderlineOffset: 4 }}
                  />
                  <input
                    type="number" inputMode="decimal" value={s?.reps ?? ''}
                    onChange={(e) => updateSet(exIdx, 0, 'reps', e.target.value)}
                    placeholder={s?.lastReps || (exercise.planned_duration_minutes ? String(exercise.planned_duration_minutes) : '—')}
                    className={inputClass}
                    step="0.5"
                  />
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <button
                      onClick={() => handleSetDone(exIdx, 0)}
                      className={`set-check${s?.done ? ' done' : ''}`}
                    >
                      {s?.done && <Chk />}
                    </button>
                  </div>
                </div>
              </div>
            );
          }

          // ── Strength card (original) ─────────────────────────────────────────
          // Compute display number skipping warmup exercises
          const strengthNumber = exercises.slice(0, exIdx).filter((e) => e.exercise.exercise_type !== 'warmup').length + 1;

          return (
            <div key={exercise.id} className={isCurrent ? 'surface' : 'card'} style={{
              overflow: 'hidden', transition: 'box-shadow var(--duration) var(--ease)',
              ...(isCurrent ? { border: '1.5px solid var(--ink)', boxShadow: 'var(--shadow)' } : {}),
            }}>
              {/* Exercise header */}
              <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '13px 16px',
                background: isCurrent ? 'var(--ink)' : 'transparent',
                color: isCurrent ? 'var(--paper)' : 'var(--ink)',
              }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span className="mono-tag" style={{ color: isCurrent ? 'rgba(255,255,255,0.5)' : 'var(--ink-3)' }}>
                      EX {String(strengthNumber).padStart(2, '0')}
                    </span>
                    {isCurrent && doneSets < sets.length && (
                      <span style={{ width: 5, height: 5, borderRadius: 5, background: 'var(--lime)', display: 'inline-block' }} />
                    )}
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 600, marginTop: 2, letterSpacing: '-0.01em' }}>
                    {exercise.name}
                  </div>
                  {exercise.seat_position && (
                    <div style={{ marginTop: 3, display: 'flex', alignItems: 'center', gap: 5 }}>
                      <span style={{ fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.06em', opacity: 0.55, textTransform: 'uppercase' }}>Seat</span>
                      <span style={{ fontFamily: 'var(--mono)', fontSize: 10, opacity: 0.75 }}>{exercise.seat_position}</span>
                    </div>
                  )}
                  {exercise.notes && (
                    <div style={{ marginTop: 2, fontFamily: 'var(--mono)', fontSize: 9, opacity: 0.55, fontStyle: 'italic' }}>
                      {exercise.notes}
                    </div>
                  )}
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div className="mono-tag" style={{ color: isCurrent ? 'rgba(255,255,255,0.5)' : 'var(--ink-3)' }}>Target</div>
                  <div className="bignum" style={{ fontSize: 13, marginTop: 2 }}>
                    {exercise.sets} × {exercise.target_reps}
                  </div>
                </div>
              </div>

              {/* Table head */}
              <div style={{
                display: 'grid', gridTemplateColumns: '28px 1fr 1fr 48px',
                padding: '8px 14px 5px 16px', borderBottom: '1px solid var(--hair)',
              }}>
                <span className="mono-tag">SET</span>
                <span className="mono-tag" style={{ textAlign: 'center' }}>KG</span>
                <span className="mono-tag" style={{ textAlign: 'center' }}>REPS</span>
                <span />
              </div>

              {sets.map((s, setIdx) => {
                const isActiveRow = !s.done && setIdx === doneSets;
                const inputClass = s.done
                  ? 'workout-input done-set'
                  : isActiveRow ? 'workout-input active-set' : 'workout-input';
                return (
                  <div key={setIdx} style={{
                    display: 'grid', gridTemplateColumns: '28px 1fr 1fr 48px',
                    alignItems: 'center', padding: '5px 14px 5px 16px',
                    borderBottom: setIdx < sets.length - 1 ? '1px solid var(--hair)' : 'none',
                    background: isActiveRow ? 'var(--paper-2)' : 'transparent',
                    transition: 'background var(--duration-fast) var(--ease)',
                    minHeight: 48,
                  }}>
                    <span className="bignum" style={{
                      fontSize: 12,
                      color: s.done ? 'var(--ink-3)' : isActiveRow ? 'var(--ink-2)' : 'var(--ink-4)',
                    }}>
                      {String(setIdx + 1).padStart(2, '0')}
                    </span>

                    <input type="number" inputMode="decimal" value={s.weight}
                      onChange={(e) => updateSet(exIdx, setIdx, 'weight', e.target.value)}
                      placeholder={s.lastWeight || '—'} step="2.5"
                      className={inputClass}
                      style={{ textDecoration: isActiveRow ? 'underline' : 'none', textUnderlineOffset: 4 }}
                    />

                    <input
                      type="number" inputMode="numeric" value={s.reps}
                      onChange={(e) => {
                        const v = e.target.value;
                        if (v === '' || /^\d*$/.test(v)) updateSet(exIdx, setIdx, 'reps', v);
                      }}
                      placeholder={s.lastReps || (exercise.target_reps !== 'max' ? exercise.target_reps : '')}
                      className={inputClass}
                    />

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <button
                        onClick={() => handleSetDone(exIdx, setIdx)}
                        className={`set-check${s.done ? ' done' : ''}`}
                      >
                        {s.done && <Chk />}
                      </button>
                    </div>
                  </div>
                );
              })}

              {/* Add/remove set */}
              <div style={{ display: 'flex', gap: 6, padding: '8px 16px 12px' }}>
                <button onClick={() => removeSet(exIdx)} disabled={sets.length <= 1}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 4, height: 30, padding: '0 11px',
                    background: 'transparent', border: '1px solid var(--border)', borderRadius: 'var(--r-1)',
                    fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.05em', cursor: 'pointer',
                    color: 'var(--ink-3)', textTransform: 'uppercase',
                    opacity: sets.length <= 1 ? 0.3 : 1,
                  }}>
                  − Set
                </button>
                <button onClick={() => addSet(exIdx)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 4, height: 30, padding: '0 11px',
                    background: 'transparent', border: '1px solid var(--border)', borderRadius: 'var(--r-1)',
                    fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.05em', cursor: 'pointer',
                    color: 'var(--ink-3)', textTransform: 'uppercase',
                  }}>
                  + Set
                </button>
              </div>
            </div>
          );
        };

        return (
          <div style={{ padding: '0 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>

            {/* 1. Active (incomplete) exercises */}
            {activeGroup.map(renderCard)}

            {/* 2. Finish Workout button — always above completed exercises */}
            <button className="block-btn" onClick={() => setShowConfirm(true)} disabled={completing}
              style={{ marginTop: 4, background: doneCount === totalSets && totalSets > 0 ? 'var(--lime)' : 'var(--ink)', color: doneCount === totalSets && totalSets > 0 ? 'var(--lime-ink)' : 'var(--paper)' }}>
              <span>{completing ? 'Saving…' : doneCount === totalSets && totalSets > 0 ? 'Save & Finish 🎉' : 'Finish Workout'}</span>
              <Chk />
            </button>

            {/* 3. Completed exercises (dimmed, below the button) */}
            {completedGroup.length > 0 && (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ flex: 1, height: 1, background: 'var(--hair)' }} />
                  <span className="mono-tag" style={{ fontSize: 9 }}>DONE ({completedGroup.length})</span>
                  <div style={{ flex: 1, height: 1, background: 'var(--hair)' }} />
                </div>
                {completedGroup.map(renderCard)}
              </>
            )}

            {/* 4. Abandon */}
            <button onClick={() => setShowAbandon(true)} style={{
              width: '100%', marginTop: 10, padding: '10px 0',
              background: 'none', border: 'none', cursor: 'pointer',
              fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.08em',
              textTransform: 'uppercase', color: 'var(--ink-3)',
            }}>
              Exit without saving
            </button>
          </div>
        );
      })()}

      {/* Sticky rest timer */}
      <div style={{
        position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)',
        width: '100%', maxWidth: 430,
        background: 'var(--ink)', color: 'var(--paper)',
        borderTopLeftRadius: 16, borderTopRightRadius: 16,
        padding: '14px 20px 20px',
      }}>
        {/* Presets row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
          <span className="mono-tag" style={{ color: 'rgba(255,255,255,0.4)', marginRight: 2 }}>REST</span>
          {[60, 90, 120, 180].map((secs) => {
            const label = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;
            const active = timer.initialSeconds === secs && timer.isRunning;
            return (
              <button key={secs} onClick={() => { timer.startFrom(secs); setShowCustomTimer(false); }} style={{
                fontFamily: 'var(--mono)', fontSize: 10, fontWeight: 600,
                height: 26, padding: '0 8px', borderRadius: 'var(--r-1)',
                background: active ? 'var(--lime)' : 'rgba(255,255,255,0.08)',
                color: active ? 'var(--lime-ink)' : 'rgba(255,255,255,0.55)',
                border: 'none', cursor: 'pointer',
                transition: 'background var(--duration-fast) var(--ease)',
              }}>{label}</button>
            );
          })}
          {/* Custom toggle */}
          {(() => {
            const customActive = ![60,90,120,180].includes(timer.initialSeconds) && timer.isRunning;
            return (
              <button onClick={() => setShowCustomTimer((v) => !v)} style={{
                fontFamily: 'var(--mono)', fontSize: 10, fontWeight: 600,
                height: 26, padding: '0 8px', borderRadius: 'var(--r-1)',
                background: customActive ? 'var(--lime)' : showCustomTimer ? 'rgba(255,255,255,0.16)' : 'rgba(255,255,255,0.08)',
                color: customActive ? 'var(--lime-ink)' : 'rgba(255,255,255,0.55)',
                border: 'none', cursor: 'pointer', marginLeft: 'auto',
              }}>···</button>
            );
          })()}
        </div>

        {/* Custom timer picker */}
        {showCustomTimer && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, padding: '4px 0' }}>
            <button
              onClick={() => setCustomSeconds((s) => Math.max(30, s - 30))}
              style={{ width: 32, height: 32, borderRadius: 'var(--r-1)', background: 'rgba(255,255,255,0.1)', border: 'none', color: 'var(--paper)', fontFamily: 'var(--mono)', fontSize: 16, cursor: 'pointer' }}
            >−</button>
            <span className="bignum" style={{ flex: 1, textAlign: 'center', fontSize: 20, color: 'var(--lime)' }}>
              {`${Math.floor(customSeconds / 60)}:${String(customSeconds % 60).padStart(2, '0')}`}
            </span>
            <button
              onClick={() => setCustomSeconds((s) => Math.min(600, s + 30))}
              style={{ width: 32, height: 32, borderRadius: 'var(--r-1)', background: 'rgba(255,255,255,0.1)', border: 'none', color: 'var(--paper)', fontFamily: 'var(--mono)', fontSize: 16, cursor: 'pointer' }}
            >+</button>
            <button
              onClick={() => { timer.startFrom(customSeconds); setShowCustomTimer(false); }}
              style={{ height: 32, padding: '0 14px', borderRadius: 'var(--r-1)', background: 'var(--lime)', border: 'none', color: 'var(--lime-ink)', fontFamily: 'var(--sans)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
            >Set</button>
          </div>
        )}

        {/* Timer display */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 10 }}>
          {timerJustDone ? (
            <div className="bignum" style={{
              fontSize: 46, lineHeight: 1, color: 'var(--lime)',
              animation: 'timer-done-pop 0.38s var(--ease-spring) both',
              whiteSpace: 'nowrap', minWidth: 82,
            }}>
              Done!
            </div>
          ) : (
            <div className="bignum" style={{
              fontSize: 52, lineHeight: 1,
              color: timer.isLow ? 'oklch(0.75 0.15 30)' : 'var(--lime)',
            }}>
              {timer.formatTime(timer.seconds)}
            </div>
          )}
          <div style={{ flex: 1 }}>
            <div style={{ height: 3, background: 'rgba(255,255,255,0.12)', borderRadius: 2 }}>
              <div style={{
                width: timerJustDone ? '100%' : `${timer.progress * 100}%`,
                height: '100%',
                background: 'var(--lime)', borderRadius: 2,
                transition: timerJustDone ? 'width 0.3s var(--ease-spring)' : 'width 1s linear',
              }} />
            </div>
            {lastSet && <div className="mono-tag" style={{ color: 'rgba(255,255,255,0.4)', marginTop: 5, textTransform: 'none' }}>{lastSet}</div>}
          </div>
        </div>

        {/* Controls */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
          {[
            {
              label: timer.isRunning ? 'Pause' : 'Start',
              onClick: timer.isRunning ? timer.pause : timer.start,
              white: true,
            },
            { label: 'Reset',  onClick: timer.reset },
            { label: 'Skip',   onClick: timer.skip  },
          ].map(({ label, onClick, white }) => (
            <button key={label} onClick={onClick} style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              height: 38,
              background: white ? 'var(--paper)' : 'transparent',
              color: white ? 'var(--ink)' : 'var(--paper)',
              border: white ? 'none' : '1px solid rgba(255,255,255,0.15)',
              borderRadius: 6, fontFamily: 'var(--sans)', fontSize: 12, fontWeight: 500, cursor: 'pointer',
            }}>{label}</button>
          ))}
        </div>
      </div>

      {/* Confirm modal */}
      {showConfirm && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 30,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'flex-end', justifyContent: 'center', padding: '0 0 0',
        }}>
          <div style={{
            background: 'var(--paper)', borderTopLeftRadius: 20, borderTopRightRadius: 20,
            padding: '24px 20px 32px', width: '100%', maxWidth: 430,
          }}>
            <h2 style={{ margin: '0 0 8px', fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em' }}>
              Finish Workout?
            </h2>
            <p style={{ margin: '0 0 24px', color: 'var(--ink-2)', fontSize: 14, lineHeight: 1.4 }}>
              {doneCount}/{totalSets} sets completed.
              {doneCount < totalSets ? ' Incomplete sets will be saved as empty.' : ' Great work!'}
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <button onClick={() => setShowConfirm(false)} style={{
                height: 48, border: '1px solid var(--hair)', borderRadius: 'var(--r-2)',
                background: 'transparent', fontFamily: 'var(--sans)', fontSize: 15, fontWeight: 600,
                color: 'var(--ink)', cursor: 'pointer',
              }}>Keep Going</button>
              <button onClick={confirmComplete} disabled={completing} className="block-btn" style={{ height: 48 }}>
                <span>{completing ? 'Saving…' : 'Save & Finish'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Abandon confirm */}
      {showAbandon && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 30,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
        }}>
          <div style={{
            background: 'var(--paper)', borderTopLeftRadius: 20, borderTopRightRadius: 20,
            padding: '24px 20px 32px', width: '100%', maxWidth: 430,
          }}>
            <h2 style={{ margin: '0 0 8px', fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em' }}>
              Exit without saving?
            </h2>
            <p style={{ margin: '0 0 24px', color: 'var(--ink-2)', fontSize: 14, lineHeight: 1.4 }}>
              Your progress will be lost and this session won't be recorded.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <button onClick={() => setShowAbandon(false)} style={{
                height: 48, border: '1px solid var(--hair)', borderRadius: 'var(--r-2)',
                background: 'transparent', fontFamily: 'var(--sans)', fontSize: 15, fontWeight: 600,
                color: 'var(--ink)', cursor: 'pointer',
              }}>Keep Going</button>
              <button
                onClick={() => { clearWorkout(); navigate('/dashboard', { replace: true }); }}
                style={{
                  height: 48, border: 'none', borderRadius: 'var(--r-2)',
                  background: 'oklch(0.55 0.22 25)', color: 'white',
                  fontFamily: 'var(--sans)', fontSize: 15, fontWeight: 600, cursor: 'pointer',
                }}
              >Exit</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
