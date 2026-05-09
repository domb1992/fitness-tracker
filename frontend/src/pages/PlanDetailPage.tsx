import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { plansApi, sessionsApi } from '../api/client';
import { TrainingPlan, WorkoutSession } from '../types';

function fmtDuration(s: number | null) {
  if (!s) return '—';
  const m = Math.floor(s / 60);
  return `${m}m`;
}

function fmtDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en', { month: 'short', day: 'numeric' });
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

  const avgDuration = sessions.length > 0
    ? Math.round(sessions.reduce((a, s) => a + (s.duration_seconds || 0), 0) / sessions.length / 60)
    : null;

  return (
    <div className="ft-screen" style={{ paddingBottom: 'calc(100px + env(safe-area-inset-bottom, 0px))' }}>
      {/* Header */}
      <div style={{ padding: '8px 20px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <button className="icon-btn" onClick={() => navigate('/dashboard')}>
          <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M11 6l-6 6 6 6"/>
          </svg>
        </button>
        <div className="mono-tag">PLAN {plan.plan_order}</div>
        <button className="icon-btn" onClick={() => navigate(`/plan/${planId}/edit`)}>
          <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
            <circle cx="5" cy="12" r="1.5" fill="currentColor" stroke="none"/>
            <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none"/>
            <circle cx="19" cy="12" r="1.5" fill="currentColor" stroke="none"/>
          </svg>
        </button>
      </div>

      {/* Title */}
      <div style={{ padding: '0 20px 18px' }}>
        <div className="mono-tag">PROGRAM</div>
        <h1 style={{ margin: '4px 0 0', fontSize: 30, fontWeight: 700, letterSpacing: '-0.025em', lineHeight: 1.05 }}>
          {plan.name}
        </h1>
        {plan.description && (
          <p style={{ margin: '10px 0 0', fontSize: 13, color: 'var(--ink-2)', maxWidth: 280, lineHeight: 1.4 }}>
            {plan.description}
          </p>
        )}
      </div>

      {/* Stat strip */}
      <div style={{ padding: '0 20px 22px' }}>
        <div className="surface" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', overflow: 'hidden' }}>
          {[
            { l: 'Exercises', v: plan.exercises.filter((e) => e.exercise_type !== 'warmup').length.toString() },
            { l: 'Avg time',  v: avgDuration != null ? `${avgDuration}` : '—', u: avgDuration != null ? 'min' : undefined },
            { l: 'Sessions',  v: plan.session_count.toString() },
          ].map((s, i) => (
            <div key={i} style={{
              padding: '13px 14px',
              borderRight: i < 2 ? '1px solid var(--border)' : 'none',
            }}>
              <div className="mono-tag">{s.l}</div>
              <div style={{ marginTop: 5 }}>
                <span className="bignum" style={{ fontSize: 24 }}>{s.v}</span>
                {s.u && <span className="mono-tag" style={{ marginLeft: 4 }}>{s.u}</span>}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Exercise list */}
      <div style={{ padding: '0 20px 22px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
          <h3 style={{ margin: 0, fontSize: 13, fontWeight: 600 }}>Exercises</h3>
          <span className="mono-tag">In order</span>
        </div>
        <div className="surface" style={{ overflow: 'hidden' }}>
          {plan.exercises.length === 0 ? (
            <div style={{ padding: '24px 16px', textAlign: 'center' }}>
              <p className="mono-tag">No exercises — edit plan to add some</p>
            </div>
          ) : (() => {
            const warmups   = plan.exercises.filter((e) => e.exercise_type === 'warmup');
            const strength  = plan.exercises.filter((e) => e.exercise_type !== 'warmup');
            const all       = [...warmups, ...strength];
            return all.map((ex, i) => {
              const isWarmup = ex.exercise_type === 'warmup';
              const strengthIdx = all.slice(0, i).filter((e) => e.exercise_type !== 'warmup').length;
              return (
                <div key={ex.id} style={{
                  display: 'grid', gridTemplateColumns: '30px 1fr',
                  alignItems: 'start', gap: 10, padding: '13px 14px',
                  borderBottom: i < all.length - 1 ? '1px solid var(--border)' : 'none',
                }}>
                  {isWarmup ? (
                    <svg width={14} height={14} viewBox="0 0 24 24" fill="none"
                      stroke="oklch(0.68 0.16 55)" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round"
                      style={{ marginTop: 2 }}>
                      <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                    </svg>
                  ) : (
                    <span className="bignum" style={{ fontSize: 12, color: 'var(--ink-4)', paddingTop: 2 }}>
                      {String(strengthIdx + 1).padStart(2, '0')}
                    </span>
                  )}
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, letterSpacing: '-0.01em' }}>{ex.name}</div>
                    {isWarmup ? (
                      <div className="mono-tag" style={{ marginTop: 3, textTransform: 'none', color: 'oklch(0.68 0.16 55)' }}>
                        {ex.planned_duration_minutes ? `${ex.planned_duration_minutes} min planned` : 'Warmup'}
                      </div>
                    ) : (
                      <div className="mono-tag" style={{ marginTop: 3, textTransform: 'none' }}>
                        {ex.sets} × {ex.target_reps}
                      </div>
                    )}
                    {ex.seat_position && (
                      <div className="mono-tag" style={{ marginTop: 2, textTransform: 'none', color: 'var(--ink-3)' }}>
                        {isWarmup ? ex.seat_position : `Seat ${ex.seat_position}`}
                      </div>
                    )}
                    {ex.notes && (
                      <div className="mono-tag" style={{ marginTop: 1, textTransform: 'none', color: 'var(--ink-3)', fontStyle: 'italic' }}>
                        {ex.notes}
                      </div>
                    )}
                  </div>
                </div>
              );
            });
          })()}
        </div>
      </div>

      {/* Recent runs */}
      {sessions.length > 0 && (
        <div style={{ padding: '0 20px 22px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
            <h3 style={{ margin: 0, fontSize: 13, fontWeight: 600 }}>Recent runs</h3>
            <span className="mono-tag">{sessions.length} last</span>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            {sessions.map((s) => (
              <button key={s.id} onClick={() => navigate(`/session/${s.id}`)} style={{
                flex: 1, background: 'none', border: '1px solid var(--border)', borderRadius: 'var(--r-2)',
                padding: '11px 10px', textAlign: 'left', cursor: 'pointer',
                boxShadow: 'var(--shadow-xs)',
              }}>
                <div className="mono-tag" style={{ fontSize: 9 }}>{fmtDate(s.completed_at!)}</div>
                <div className="bignum" style={{ fontSize: 17, marginTop: 4 }}>
                  {s.total_sets ?? 0}
                </div>
                <div className="mono-tag" style={{ marginTop: 1, textTransform: 'none' }}>
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
        padding: '12px 20px 22px',
        background: 'linear-gradient(to top, var(--paper) 60%, transparent)',
      }}>
        <button className="block-btn lime" onClick={() => navigate(`/workout/${plan.id}`)}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
            <svg width={14} height={14} viewBox="0 0 24 24" fill="currentColor" stroke="none">
              <path d="M7 4.5v15l13-7.5z"/>
            </svg>
            Start workout
          </span>
          {avgDuration != null && (
            <span className="mono-tag" style={{ color: 'var(--lime-ink)', opacity: 0.7 }}>EST {avgDuration} MIN</span>
          )}
        </button>
      </div>
    </div>
  );
}
