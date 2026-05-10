import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { plansApi, sessionsApi } from '../api/client';
import { TrainingPlan, WorkoutSession } from '../types';
import { fmtDuration } from '../lib/utils';

function fmtDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en', { month: 'short', day: 'numeric' });
}

function avgMinutes(sessions: WorkoutSession[]): number | null {
  if (sessions.length === 0) return null;
  const total = sessions.reduce((a, s) => a + (s.duration_seconds || 0), 0);
  return Math.round(total / sessions.length / 60);
}

export default function PlanDetailPage() {
  const { planId } = useParams<{ planId: string }>();
  const navigate   = useNavigate();

  const [plan,     setPlan]     = useState<TrainingPlan | null>(null);
  const [sessions, setSessions] = useState<WorkoutSession[]>([]);
  const [loading,  setLoading]  = useState(true);

  useEffect(() => {
    if (!planId) { navigate('/dashboard', { replace: true }); return; }
    Promise.all([plansApi.getAll(), sessionsApi.getAll(20)])
      .then(([plans, allSessions]) => {
        const p = plans.find((x) => x.id === planId);
        if (!p) { navigate('/dashboard', { replace: true }); return; }
        setPlan(p);
        setSessions(allSessions.filter((s) => s.plan_id === planId && s.completed_at).slice(0, 5));
      })
      .catch(() => navigate('/dashboard', { replace: true }))
      .finally(() => setLoading(false));
  }, [planId, navigate]);

  if (loading || !plan) {
    return (
      <div className="ft-loader">
        <div className="ft-loader-dot" />
        <span className="mono-tag">Loading…</span>
      </div>
    );
  }

  const avgMins    = avgMinutes(sessions);
  const strengthEx = plan.exercises.filter((e) => e.exercise_type !== 'warmup');
  const warmupEx   = plan.exercises.filter((e) => e.exercise_type === 'warmup');
  const orderedEx  = [...warmupEx, ...strengthEx];

  const stats = [
    { label: 'Exercises', value: strengthEx.length.toString() },
    { label: 'Avg time',  value: avgMins != null ? `${avgMins}` : '—', unit: avgMins != null ? 'min' : undefined },
    { label: 'Sessions',  value: plan.session_count.toString() },
  ];

  return (
    <div className="ft-screen" style={{ paddingBottom: 'calc(100px + env(safe-area-inset-bottom, 0px))' }}>

      {/* Header bar */}
      <div style={{
        padding: '10px 20px 12px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <button className="icon-btn" onClick={() => navigate('/dashboard')} aria-label="Back">
          <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M11 6l-6 6 6 6"/>
          </svg>
        </button>
        <span className="mono-tag">PLAN {plan.plan_order}</span>
        <button className="icon-btn" onClick={() => navigate(`/plan/${planId}/edit`)} aria-label="Edit plan">
          <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
          </svg>
        </button>
      </div>

      {/* Plan title */}
      <div style={{ padding: '0 20px 20px' }}>
        <p style={{
          margin: '0 0 4px', fontFamily: 'var(--mono)', fontSize: 9,
          letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ink-4)',
        }}>
          Program
        </p>
        <h1 style={{
          margin: 0, fontSize: 32, fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1.05,
          color: 'var(--ink)',
        }}>
          {plan.name}
        </h1>
        {plan.color && (
          <div style={{
            width: 32, height: 3, borderRadius: 99, background: plan.color,
            marginTop: 10,
          }} />
        )}
        {plan.description && (
          <p style={{
            margin: '12px 0 0', fontSize: 13, color: 'var(--ink-2)',
            maxWidth: 300, lineHeight: 1.5,
          }}>
            {plan.description}
          </p>
        )}
      </div>

      {/* Stat strip */}
      <div style={{ padding: '0 20px 24px' }}>
        <div className="surface" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', overflow: 'hidden' }}>
          {stats.map((s, i) => (
            <div key={i} style={{
              padding: '14px 14px',
              borderRight: i < 2 ? '1px solid var(--border)' : 'none',
              textAlign: i === 2 ? 'right' : 'left',
            }}>
              <p style={{
                margin: '0 0 6px', fontFamily: 'var(--mono)', fontSize: 9,
                letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--ink-4)',
              }}>
                {s.label}
              </p>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 3 }}>
                <span className="bignum" style={{ fontSize: 26 }}>{s.value}</span>
                {s.unit && (
                  <span style={{
                    fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--ink-3)',
                  }}>
                    {s.unit}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Exercise list */}
      <div style={{ padding: '0 20px 24px' }}>
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12,
        }}>
          <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, letterSpacing: '-0.02em' }}>Exercises</h3>
          <span className="mono-tag">In order</span>
        </div>
        <div className="surface" style={{ overflow: 'hidden' }}>
          {orderedEx.length === 0 ? (
            <div style={{ padding: '24px 16px', textAlign: 'center' }}>
              <p className="mono-tag">No exercises — edit plan to add some</p>
            </div>
          ) : orderedEx.map((ex, i) => {
            const isWarmup = ex.exercise_type === 'warmup';
            const strengthIdx = orderedEx.slice(0, i).filter((e) => e.exercise_type !== 'warmup').length;
            return (
              <div key={ex.id} style={{
                display: 'grid', gridTemplateColumns: '32px 1fr',
                alignItems: 'start', gap: 10, padding: '13px 14px',
                borderBottom: i < orderedEx.length - 1 ? '1px solid var(--border)' : 'none',
              }}>
                {isWarmup ? (
                  <div style={{
                    width: 24, height: 24, borderRadius: '50%',
                    background: 'oklch(0.96 0.06 60)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 1,
                    flexShrink: 0,
                  }}>
                    <svg width={12} height={12} viewBox="0 0 24 24" fill="none"
                      stroke="oklch(0.60 0.16 55)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                    </svg>
                  </div>
                ) : (
                  <span className="bignum" style={{
                    fontSize: 13, color: 'var(--ink-4)', paddingTop: 3,
                    textAlign: 'center',
                  }}>
                    {String(strengthIdx + 1).padStart(2, '0')}
                  </span>
                )}
                <div>
                  <div style={{
                    fontSize: 14, fontWeight: 600, letterSpacing: '-0.01em', lineHeight: 1.2,
                  }}>
                    {ex.name}
                  </div>
                  {isWarmup ? (
                    <div style={{
                      marginTop: 3, fontFamily: 'var(--mono)', fontSize: 10,
                      color: 'oklch(0.60 0.16 55)',
                    }}>
                      {ex.planned_duration_minutes ? `${ex.planned_duration_minutes} min warmup` : 'Warmup'}
                    </div>
                  ) : (
                    <div style={{
                      marginTop: 3, fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink-3)',
                    }}>
                      {ex.sets} × {ex.target_reps}
                    </div>
                  )}
                  {ex.seat_position && (
                    <div style={{
                      marginTop: 2, fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--ink-4)',
                    }}>
                      {isWarmup ? ex.seat_position : `Seat ${ex.seat_position}`}
                    </div>
                  )}
                  {ex.notes && (
                    <div style={{
                      marginTop: 2, fontFamily: 'var(--mono)', fontSize: 9,
                      color: 'var(--ink-3)', fontStyle: 'italic',
                    }}>
                      {ex.notes}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Recent runs */}
      {sessions.length > 0 && (
        <div style={{ padding: '0 20px 24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
            <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, letterSpacing: '-0.02em' }}>
              Recent Runs
            </h3>
            <span className="mono-tag">{sessions.length} last</span>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            {sessions.map((s) => (
              <button key={s.id} onClick={() => navigate(`/session/${s.id}`)}
                className="card card-interactive"
                style={{
                  flex: 1, background: 'none', padding: '12px 10px',
                  textAlign: 'left', cursor: 'pointer',
                }}>
                <div className="mono-tag" style={{ fontSize: 9, color: 'var(--ink-4)' }}>
                  {fmtDate(s.completed_at!)}
                </div>
                <div className="bignum" style={{ fontSize: 19, marginTop: 4 }}>
                  {s.total_sets ?? 0}
                </div>
                <div className="mono-tag" style={{ marginTop: 2, textTransform: 'none', color: 'var(--ink-3)' }}>
                  sets · {fmtDuration(s.duration_seconds)}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Sticky start button */}
      <div style={{
        position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)',
        width: '100%', maxWidth: 430,
        padding: '14px 20px calc(22px + env(safe-area-inset-bottom, 0px))',
        background: 'linear-gradient(to top, var(--paper) 65%, transparent)',
        pointerEvents: 'none',
      }}>
        <button
          className="block-btn lime"
          onClick={() => navigate(`/workout/${plan.id}`)}
          style={{ pointerEvents: 'auto', height: 54 }}
        >
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
            <svg width={14} height={14} viewBox="0 0 24 24" fill="currentColor" stroke="none" aria-hidden>
              <path d="M7 4.5v15l13-7.5z"/>
            </svg>
            Start Workout
          </span>
          {avgMins != null && (
            <span className="mono-tag" style={{ color: 'var(--lime-ink)', opacity: 0.65 }}>
              EST {avgMins} MIN
            </span>
          )}
        </button>
      </div>
    </div>
  );
}
