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

const CheckIcon = () => (
  <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
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

  // Timer done animation
  const [timerJustDone, setTimerJustDone]   = useState(false);
  const timerDoneRef   = useRef(false);
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
      timerDoneRef.current = false;
      setTimerJustDone(false);
    }
  }, [timer.isDone]);

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

  return (
    <div className="ft-screen" style={{ paddingBottom: 240 }}>

      {/* Offline banner */}
      {!isOnline && (
        <div className="banner banner-warning">
          <svg width={11} height={11} viewBox="0 0 24 24" fill="currentColor">
            <path d="M1 1l22 22M16.72 11.06A10.94 10.94 0 0 1 19 12.55M5 12.55a10.94 10.94 0 0 1 5.17-2.39M10.71 5.05A16 16 0 0 1 22.56 9M1.42 9a15.91 15.91 0 0 1 4.7-2.88M8.53 16.11a6 6 0 0 1 6.95 0M12 20h.01"/>
          </svg>
          OFFLINE — PROGRESS SAVED LOCALLY
        </div>
      )}

      {/* Header */}
      <div style={{ padding: '10px 20px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
        <button className="icon-btn" onClick={() => navigate('/dashboard')}>
          <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M11 6l-6 6 6 6"/>
          </svg>
        </button>
        <div className="mono-tag" style={{
          flex: 1, textAlign: 'center',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {planName}
        </div>
        <button
          onClick={() => setShowConfirm(true)}
          disabled={completing}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            height: 36, padding: '0 14px',
            background: allDone ? 'var(--lime)' : 'var(--ink)',
            color: allDone ? 'var(--lime-ink)' : 'var(--paper)',
            border: 'none', borderRadius: 'var(--r-1)',
            fontFamily: 'var(--sans)', fontSize: 13, fontWeight: 600, cursor: 'pointer',
            transition: 'background var(--duration-fast) var(--ease)',
            boxShadow: 'var(--shadow-xs)',
          }}>
          <CheckIcon /> Finish
        </button>
      </div>

      {/* Clock + Progress */}
      <div style={{ padding: '0 20px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
          <div>
            <div className="mono-tag">Elapsed</div>
            <div className="bignum" style={{ fontSize: 50, lineHeight: 1.05, marginTop: 2 }}>
              {elapsedClock}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div className="mono-tag">Sets</div>
            <div style={{ marginTop: 2 }}>
              <span className="bignum" style={{ fontSize: 50, lineHeight: 1.05 }}>{doneCount}</span>
              <span className="bignum" style={{ fontSize: 22, color: 'var(--ink-3)' }}>/{totalSets}</span>
            </div>
          </div>
        </div>
        {/* Progress bar */}
        <div style={{ height: 4, background: 'var(--paper-3)', marginTop: 12, borderRadius: 'var(--r-full)', overflow: 'hidden' }}>
          <div style={{
            width: `${progress * 100}%`, height: '100%',
            background: allDone ? 'var(--lime)' : 'var(--ink)',
            borderRadius: 'var(--r-full)',
            transition: 'width 0.5s var(--ease-out)',
          }} />
        </div>
      </div>

      {error && (
        <div style={{ margin: '0 20px 14px', fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--danger)' }}>
          {error}
        </div>
      )}

      {/* Exercise cards */}
      {(() => {
        const withIdx    = exercises.map((ex, i) => ({ ex, i }));
        const activeGroup    = withIdx.filter(({ ex }) => ex.sets.some((s) => !s.done));
        const completedGroup = withIdx.filter(({ ex }) => ex.sets.every((s) => s.done));

        const renderCard = ({ ex: activeEx, i: exIdx }: { ex: typeof exercises[0]; i: number }) => {
          const { exercise, sets } = activeEx;
          const doneSets  = sets.filter((s) => s.done).length;
          const isCurrent = doneSets < sets.length;
          const isWarmup  = exercise.exercise_type === 'warmup';

          // ── Warmup card ──────────────────────────────────────────────────
          if (isWarmup) {
            const s          = sets[0];
            const isActive   = !s?.done;
            const warmupColor = 'oklch(0.68 0.16 55)';
            const inputClass  = s?.done ? 'workout-input done-set' : 'workout-input active-set';

            return (
              <div key={exercise.id} className={isActive ? 'surface' : 'card'} style={{
                overflow: 'hidden',
                ...(isActive ? { border: `1.5px solid ${warmupColor}`, boxShadow: `0 0 0 3px oklch(0.68 0.16 55 / 0.12), var(--shadow)` } : {}),
              }}>
                {/* Header */}
                <div style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '14px 16px',
                  background: isActive ? warmupColor : 'transparent',
                  color: isActive ? 'white' : 'var(--ink)',
                }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                      <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.7 }}>
                        <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                      </svg>
                      <span className="mono-tag" style={{ color: isActive ? 'rgba(255,255,255,0.75)' : 'var(--ink-3)' }}>WARMUP</span>
                      {isActive && <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'white', opacity: 0.75, display: 'inline-block' }} />}
                    </div>
                    <div style={{ fontSize: 16, fontWeight: 700, marginTop: 3, letterSpacing: '-0.02em' }}>
                      {exercise.name}
                    </div>
                    {exercise.seat_position && (
                      <div style={{ marginTop: 3, fontFamily: 'var(--mono)', fontSize: 9, opacity: 0.7, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        Setting: {exercise.seat_position}
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
                      <div className="bignum" style={{ fontSize: 15, marginTop: 2 }}>
                        {exercise.planned_duration_minutes} min
                      </div>
                    </div>
                  ) : null}
                </div>

                {/* Input row */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 60px', padding: '8px 14px 5px 16px', borderBottom: '1px solid var(--hair)' }}>
                  <span className="mono-tag" style={{ textAlign: 'center' }}>BPM</span>
                  <span className="mono-tag" style={{ textAlign: 'center' }}>MIN</span>
                  <span />
                </div>
                <div style={{
                  display: 'grid', gridTemplateColumns: '1fr 1fr 60px',
                  alignItems: 'center', padding: '10px 14px 10px 16px',
                  background: isActive ? 'var(--paper-2)' : 'transparent',
                  minHeight: 60,
                }}>
                  <input type="number" inputMode="numeric" value={s?.weight ?? ''}
                    onChange={(e) => updateSet(exIdx, 0, 'weight', e.target.value)}
                    placeholder={s?.lastWeight || '—'} className={inputClass}
                    style={{ textDecoration: isActive ? 'underline' : 'none', textUnderlineOffset: 4 }}
                  />
                  <input type="number" inputMode="decimal" value={s?.reps ?? ''}
                    onChange={(e) => updateSet(exIdx, 0, 'reps', e.target.value)}
                    placeholder={s?.lastReps || (exercise.planned_duration_minutes ? String(exercise.planned_duration_minutes) : '—')}
                    className={inputClass} step="0.5"
                  />
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <button onClick={() => handleSetDone(exIdx, 0)} className={`set-check${s?.done ? ' done' : ''}`}>
                      {s?.done && <CheckIcon />}
                    </button>
                  </div>
                </div>
              </div>
            );
          }

          // ── Strength card ────────────────────────────────────────────────
          const strengthNumber = exercises.slice(0, exIdx).filter((e) => e.exercise.exercise_type !== 'warmup').length + 1;

          return (
            <div key={exercise.id} className={isCurrent ? 'surface' : 'card'} style={{
              overflow: 'hidden',
              ...(isCurrent ? { border: '1.5px solid var(--ink)', boxShadow: '0 0 0 3px oklch(0.13 0.015 75 / 0.08), var(--shadow)' } : {}),
            }}>
              {/* Exercise header — uses .ex-header-active for proper dark mode theming */}
              <div className={isCurrent ? 'ex-header-active' : ''} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '14px 16px',
                ...(!isCurrent ? { color: 'var(--ink)' } : {}),
              }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span className="mono-tag" style={{
                      color: isCurrent ? 'oklch(0.95 0.006 75 / 0.50)' : 'var(--ink-3)',
                    }}>
                      EX {String(strengthNumber).padStart(2, '0')}
                    </span>
                    {isCurrent && doneSets < sets.length && (
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--lime)', display: 'inline-block', boxShadow: '0 0 0 2px var(--lime-glow)' }} />
                    )}
                  </div>
                  <div style={{ fontSize: 16, fontWeight: 700, marginTop: 3, letterSpacing: '-0.02em' }}>
                    {exercise.name}
                  </div>
                  {exercise.seat_position && (
                    <div style={{ marginTop: 3, fontFamily: 'var(--mono)', fontSize: 9, opacity: 0.6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Seat: {exercise.seat_position}
                    </div>
                  )}
                  {exercise.notes && (
                    <div style={{ marginTop: 2, fontFamily: 'var(--mono)', fontSize: 9, opacity: 0.55, fontStyle: 'italic' }}>
                      {exercise.notes}
                    </div>
                  )}
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div className="mono-tag" style={{
                    color: isCurrent ? 'oklch(0.95 0.006 75 / 0.50)' : 'var(--ink-3)',
                  }}>Target</div>
                  <div className="bignum" style={{ fontSize: 14, marginTop: 2 }}>
                    {exercise.sets} × {exercise.target_reps}
                  </div>
                </div>
              </div>

              {/* Table head */}
              <div style={{ display: 'grid', gridTemplateColumns: '32px 1fr 1fr 60px', padding: '8px 14px 6px 16px', borderBottom: '1px solid var(--hair)' }}>
                <span className="mono-tag">SET</span>
                <span className="mono-tag" style={{ textAlign: 'center' }}>KG</span>
                <span className="mono-tag" style={{ textAlign: 'center' }}>REPS</span>
                <span />
              </div>

              {sets.map((s, setIdx) => {
                const isActiveRow = !s.done && setIdx === doneSets;
                const inputClass  = s.done ? 'workout-input done-set' : isActiveRow ? 'workout-input active-set' : 'workout-input';
                return (
                  <div key={setIdx} style={{
                    display: 'grid', gridTemplateColumns: '32px 1fr 1fr 60px',
                    alignItems: 'center', padding: '6px 14px 6px 16px',
                    borderBottom: setIdx < sets.length - 1 ? '1px solid var(--hair)' : 'none',
                    background: isActiveRow ? 'var(--paper-2)' : 'transparent',
                    transition: 'background var(--duration-fast) var(--ease)',
                    minHeight: 52,
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

                    <input type="number" inputMode="numeric" value={s.reps}
                      onChange={(e) => {
                        const v = e.target.value;
                        if (v === '' || /^\d*$/.test(v)) updateSet(exIdx, setIdx, 'reps', v);
                      }}
                      placeholder={s.lastReps || (exercise.target_reps !== 'max' ? exercise.target_reps : '')}
                      className={inputClass}
                    />

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <button onClick={() => handleSetDone(exIdx, setIdx)} className={`set-check${s.done ? ' done' : ''}`}>
                        {s.done && <CheckIcon />}
                      </button>
                    </div>
                  </div>
                );
              })}

              {/* Add/Remove set */}
              <div style={{ display: 'flex', gap: 6, padding: '9px 16px 13px' }}>
                {[
                  { label: '− Set', onClick: () => removeSet(exIdx), disabled: sets.length <= 1 },
                  { label: '+ Set', onClick: () => addSet(exIdx),    disabled: false },
                ].map(({ label, onClick, disabled }) => (
                  <button key={label} onClick={onClick} disabled={disabled}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 4,
                      height: 32, padding: '0 13px',
                      background: 'transparent', border: '1px solid var(--border)',
                      borderRadius: 'var(--r-1)', fontFamily: 'var(--mono)', fontSize: 10,
                      letterSpacing: '0.05em', cursor: disabled ? 'default' : 'pointer',
                      color: 'var(--ink-3)', textTransform: 'uppercase',
                      opacity: disabled ? 0.30 : 1,
                      transition: 'background var(--duration-fast) var(--ease)',
                    }}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
          );
        };

        return (
          <div style={{ padding: '0 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            {activeGroup.map(renderCard)}

            {/* Finish workout button */}
            <button
              className={`block-btn${allDone ? ' lime' : ''}`}
              onClick={() => setShowConfirm(true)}
              disabled={completing}
              style={{ marginTop: 4 }}
            >
              <span>{completing ? 'Saving…' : allDone ? 'Save & Finish 🎉' : 'Finish Workout'}</span>
              <CheckIcon />
            </button>

            {/* Completed exercises divider + cards */}
            {completedGroup.length > 0 && (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '2px 0' }}>
                  <div style={{ flex: 1, height: 1, background: 'var(--hair)' }} />
                  <span className="mono-tag" style={{ fontSize: 9, color: 'var(--ink-4)' }}>
                    DONE ({completedGroup.length})
                  </span>
                  <div style={{ flex: 1, height: 1, background: 'var(--hair)' }} />
                </div>
                {completedGroup.map(renderCard)}
              </>
            )}

            {/* Exit without saving */}
            <button onClick={() => setShowAbandon(true)} style={{
              width: '100%', marginTop: 8, padding: '12px 0',
              background: 'none', border: 'none', cursor: 'pointer',
              fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.08em',
              textTransform: 'uppercase', color: 'var(--ink-4)',
            }}>
              Exit without saving
            </button>
          </div>
        );
      })()}

      {/* ── Sticky Rest Timer ─────────────────────────────────────────────── */}
      <div className="ft-timer-panel" style={{
        position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)',
        width: '100%', maxWidth: 430,
      }}>
        {/* Preset buttons row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 10 }}>
          <span className="mono-tag" style={{ color: 'oklch(0.95 0.006 75 / 0.40)', marginRight: 3, flexShrink: 0 }}>REST</span>
          {[60, 90, 120, 180].map((secs) => {
            const label  = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;
            const active = timer.initialSeconds === secs && timer.isRunning;
            return (
              <button key={secs} onClick={() => { timer.startFrom(secs); setShowCustomTimer(false); }} style={{
                fontFamily: 'var(--mono)', fontSize: 10, fontWeight: 600,
                height: 30, padding: '0 10px', borderRadius: 'var(--r-1)',
                background: active ? 'var(--lime)' : 'oklch(0.95 0.006 75 / 0.10)',
                color: active ? 'var(--lime-ink)' : 'oklch(0.95 0.006 75 / 0.60)',
                border: 'none', cursor: 'pointer',
                transition: 'background var(--duration-fast) var(--ease), color var(--duration-fast) var(--ease)',
                letterSpacing: '0.03em',
              }}>
                {label}
              </button>
            );
          })}
          {(() => {
            const customActive = ![60, 90, 120, 180].includes(timer.initialSeconds) && timer.isRunning;
            return (
              <button onClick={() => setShowCustomTimer((v) => !v)} style={{
                fontFamily: 'var(--mono)', fontSize: 10, fontWeight: 700,
                height: 30, padding: '0 10px', borderRadius: 'var(--r-1)',
                background: customActive ? 'var(--lime)' : showCustomTimer ? 'oklch(0.95 0.006 75 / 0.18)' : 'oklch(0.95 0.006 75 / 0.10)',
                color: customActive ? 'var(--lime-ink)' : 'oklch(0.95 0.006 75 / 0.60)',
                border: 'none', cursor: 'pointer', marginLeft: 'auto',
                letterSpacing: '0.1em',
              }}>···</button>
            );
          })()}
        </div>

        {/* Custom timer picker */}
        {showCustomTimer && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, padding: '4px 0' }}>
            <button onClick={() => setCustomSeconds((s) => Math.max(30, s - 30))} style={{
              width: 36, height: 36, borderRadius: 'var(--r-1)',
              background: 'oklch(0.95 0.006 75 / 0.12)', border: 'none',
              color: 'oklch(0.95 0.006 75 / 0.80)', fontFamily: 'var(--mono)', fontSize: 18, cursor: 'pointer',
            }}>−</button>
            <span className="bignum" style={{ flex: 1, textAlign: 'center', fontSize: 22, color: 'var(--lime)' }}>
              {`${Math.floor(customSeconds / 60)}:${String(customSeconds % 60).padStart(2, '0')}`}
            </span>
            <button onClick={() => setCustomSeconds((s) => Math.min(600, s + 30))} style={{
              width: 36, height: 36, borderRadius: 'var(--r-1)',
              background: 'oklch(0.95 0.006 75 / 0.12)', border: 'none',
              color: 'oklch(0.95 0.006 75 / 0.80)', fontFamily: 'var(--mono)', fontSize: 18, cursor: 'pointer',
            }}>+</button>
            <button onClick={() => { timer.startFrom(customSeconds); setShowCustomTimer(false); }} style={{
              height: 36, padding: '0 16px', borderRadius: 'var(--r-1)',
              background: 'var(--lime)', border: 'none',
              color: 'var(--lime-ink)', fontFamily: 'var(--sans)', fontSize: 13, fontWeight: 700, cursor: 'pointer',
            }}>Set</button>
          </div>
        )}

        {/* Timer display + progress bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 10 }}>
          {timerJustDone ? (
            <div className="bignum" style={{
              fontSize: 50, lineHeight: 1, color: 'var(--lime)',
              animation: 'timer-done-pop 0.38s var(--ease-spring) both',
              whiteSpace: 'nowrap', minWidth: 90,
            }}>
              Done!
            </div>
          ) : (
            <div className="bignum" style={{
              fontSize: 56, lineHeight: 1,
              color: timer.isLow ? 'oklch(0.75 0.18 30)' : 'var(--lime)',
              minWidth: 90,
              transition: 'color 0.3s ease',
            }}>
              {timer.formatTime(timer.seconds)}
            </div>
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ height: 4, background: 'oklch(0.95 0.006 75 / 0.12)', borderRadius: 'var(--r-full)' }}>
              <div style={{
                width: timerJustDone ? '100%' : `${timer.progress * 100}%`,
                height: '100%',
                background: 'var(--lime)', borderRadius: 'var(--r-full)',
                transition: timerJustDone ? 'width 0.3s var(--ease-spring)' : 'width 1s linear',
              }} />
            </div>
            {lastSet && (
              <div className="mono-tag" style={{
                color: 'oklch(0.95 0.006 75 / 0.40)', marginTop: 6,
                textTransform: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {lastSet}
              </div>
            )}
          </div>
        </div>

        {/* Controls */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
          {[
            { label: timer.isRunning ? 'Pause' : 'Start', onClick: timer.isRunning ? timer.pause : timer.start, primary: true },
            { label: 'Reset', onClick: timer.reset,  primary: false },
            { label: 'Skip',  onClick: timer.skip,   primary: false },
          ].map(({ label, onClick, primary }) => (
            <button key={label} onClick={onClick} style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              height: 42,
              background: primary ? 'oklch(0.95 0.006 75 / 0.95)' : 'transparent',
              color: primary ? 'var(--surface-hi)' : 'oklch(0.95 0.006 75 / 0.75)',
              border: primary ? 'none' : '1px solid oklch(0.95 0.006 75 / 0.14)',
              borderRadius: 'var(--r-1)', fontFamily: 'var(--sans)', fontSize: 13, fontWeight: 600, cursor: 'pointer',
              transition: 'opacity var(--duration-fast) var(--ease)',
            }}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Finish Workout Sheet ──────────────────────────────────────────── */}
      {showConfirm && (
        <div className="ft-sheet-overlay" onClick={() => setShowConfirm(false)}>
          <div className="ft-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="ft-sheet-handle" />
            <h2 style={{ margin: '0 0 6px', fontSize: 22, fontWeight: 700, letterSpacing: '-0.03em' }}>
              Finish Workout?
            </h2>
            <p style={{ margin: '0 0 22px', color: 'var(--ink-2)', fontSize: 14, lineHeight: 1.5 }}>
              {doneCount}/{totalSets} sets completed.
              {doneCount < totalSets ? ' Incomplete sets will be saved as empty.' : ' Amazing work!'}
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <button onClick={() => setShowConfirm(false)} className="ghost-btn">Keep Going</button>
              <button onClick={confirmComplete} disabled={completing} className="block-btn" style={{ height: 48 }}>
                <span>{completing ? 'Saving…' : 'Save & Finish'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Abandon Sheet ─────────────────────────────────────────────────── */}
      {showAbandon && (
        <div className="ft-sheet-overlay" onClick={() => setShowAbandon(false)}>
          <div className="ft-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="ft-sheet-handle" />
            <h2 style={{ margin: '0 0 6px', fontSize: 22, fontWeight: 700, letterSpacing: '-0.03em' }}>
              Exit without saving?
            </h2>
            <p style={{ margin: '0 0 22px', color: 'var(--ink-2)', fontSize: 14, lineHeight: 1.5 }}>
              Your progress will be lost and this session won't be recorded.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <button onClick={() => setShowAbandon(false)} className="ghost-btn">Keep Going</button>
              <button
                onClick={() => { clearWorkout(); navigate('/dashboard', { replace: true }); }}
                className="block-btn danger"
                style={{ height: 48 }}
              >
                <span>Exit</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
