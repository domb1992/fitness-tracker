import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { exercisesApi } from '../api/client';
import { ExerciseHistory, ExerciseSession } from '../types';

function fmtDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' });
}
function fmtShort(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en', { month: 'numeric', day: 'numeric' });
}

export default function ExerciseDetailPage() {
  const { exerciseId } = useParams<{ exerciseId: string }>();
  const navigate = useNavigate();
  const [data,    setData]    = useState<ExerciseHistory | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!exerciseId) { navigate(-1 as any); return; }
    exercisesApi.getHistory(exerciseId)
      .then(setData)
      .catch(() => navigate(-1 as any))
      .finally(() => setLoading(false));
  }, [exerciseId]);

  if (loading) {
    return (
      <div style={{ minHeight: '100dvh', background: 'var(--paper)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span className="mono-tag">Loading…</span>
      </div>
    );
  }

  if (!data) return null;

  const sessions: ExerciseSession[] = data.sessions ?? [];
  const maxW = Math.max(...sessions.map((s) => s.best_weight ?? 0), 1);
  const startW = sessions.find((s) => s.best_weight != null)?.best_weight ?? null;
  const lastW  = [...sessions].reverse().find((s) => s.best_weight != null)?.best_weight ?? null;
  const diff   = startW != null && lastW != null ? lastW - startW : null;
  const BAR_H  = 80;

  const cellStyle: React.CSSProperties = {
    fontFamily: 'var(--mono)', fontSize: 13, textAlign: 'center', color: 'var(--ink-2)',
  };

  return (
    <div className="ft-screen" style={{ paddingBottom: 32 }}>
      {/* Header */}
      <div style={{ padding: '8px 20px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <button className="icon-btn" onClick={() => navigate(-1 as any)}>
          <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M11 6l-6 6 6 6"/>
          </svg>
        </button>
        <div className="mono-tag">Exercise</div>
        <div style={{ width: 32 }} />
      </div>

      {/* Title */}
      <div style={{ padding: '0 20px 20px' }}>
        <div className="mono-tag">{data.exercise.plan_name}</div>
        <h1 style={{ margin: '4px 0 0', fontSize: 26, fontWeight: 700, letterSpacing: '-0.025em', lineHeight: 1.1 }}>
          {data.exercise.name}
        </h1>
      </div>

      {sessions.length === 0 ? (
        <div style={{ padding: '48px 20px', textAlign: 'center' }}>
          <p className="mono-tag">No data yet — complete a workout to see progress</p>
        </div>
      ) : (
        <>
          {/* Summary stats */}
          <div style={{ padding: '0 20px 20px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
              {[
                { label: 'Start', value: startW != null ? `${startW} kg` : '—' },
                { label: 'Now',   value: lastW  != null ? `${lastW} kg`  : '—' },
                { label: 'Total', value: `${sessions.length} sessions` },
              ].map(({ label, value }) => (
                <div key={label} className="surface" style={{ padding: '12px 14px' }}>
                  <div className="mono-tag" style={{ marginBottom: 4 }}>{label}</div>
                  <div style={{ fontFamily: 'var(--mono)', fontSize: 16, fontWeight: 600 }}>{value}</div>
                </div>
              ))}
            </div>
            {diff != null && (
              <div style={{ marginTop: 8 }} className="surface">
                <div style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: 4,
                    background: diff >= 0 ? 'var(--lime)' : 'oklch(0.55 0.22 25 / 0.1)',
                    color: diff >= 0 ? 'var(--lime-ink)' : 'oklch(0.55 0.22 25)',
                    padding: '3px 10px', borderRadius: 4,
                    fontFamily: 'var(--mono)', fontSize: 13, fontWeight: 700,
                  }}>
                    {diff >= 0 ? '↑' : '↓'} {diff >= 0 ? '+' : ''}{diff.toFixed(1)} kg progress
                  </span>
                  <span className="mono-tag" style={{ textTransform: 'none' }}>since first session</span>
                </div>
              </div>
            )}
          </div>

          {/* Weight chart */}
          {sessions.some((s) => s.best_weight != null) && (
            <div style={{ padding: '0 20px 20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                <span className="mono-tag">Weight progression</span>
                <span className="mono-tag">{sessions.length} sessions</span>
              </div>
              <div className="surface" style={{ padding: '16px 14px 10px' }}>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: `repeat(${sessions.length}, 1fr)`,
                  gap: 3, alignItems: 'flex-end', height: BAR_H,
                }}>
                  {sessions.map((s, i) => {
                    const h = s.best_weight != null ? (s.best_weight / maxW) * BAR_H : 4;
                    const isLast = i === sessions.length - 1;
                    return (
                      <div key={s.session_id} style={{
                        width: '100%', height: `${Math.max(h, 4)}px`,
                        background: isLast ? 'var(--ink)' : 'var(--paper-3)',
                        borderRadius: '2px 2px 0 0',
                        minHeight: 4,
                      }} />
                    );
                  })}
                </div>
                {sessions.length <= 12 && (
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: `repeat(${sessions.length}, 1fr)`,
                    gap: 3, marginTop: 6,
                  }}>
                    {sessions.map((s) => (
                      <div key={s.session_id} className="mono-tag" style={{ fontSize: 7, textAlign: 'center' }}>
                        {fmtShort(s.completed_at)}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Session history */}
          <div style={{ padding: '0 20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
              <span className="mono-tag">Session history</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[...sessions].reverse().map((s) => (
                <div key={s.session_id} style={{ border: '1px solid var(--hair)', borderRadius: 10, overflow: 'hidden' }}>
                  {/* Session header */}
                  <div style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '11px 16px', borderBottom: '1px solid var(--hair)',
                    background: 'var(--paper-2)',
                  }}>
                    <span style={{ fontSize: 13, fontWeight: 600 }}>{fmtDate(s.completed_at)}</span>
                    <div style={{ textAlign: 'right' }}>
                      {s.best_weight != null ? (
                        <>
                          <span className="bignum" style={{ fontSize: 18 }}>{s.best_weight}</span>
                          <span className="mono-tag" style={{ marginLeft: 2 }}>kg best</span>
                        </>
                      ) : (
                        <span className="mono-tag">No weight</span>
                      )}
                    </div>
                  </div>
                  {/* Column headers */}
                  <div style={{ display: 'grid', gridTemplateColumns: '30px 1fr 1fr', padding: '6px 16px 4px', borderBottom: '1px solid var(--hair)' }}>
                    <span className="mono-tag">SET</span>
                    <span className="mono-tag" style={{ textAlign: 'center' }}>KG</span>
                    <span className="mono-tag" style={{ textAlign: 'center' }}>REPS</span>
                  </div>
                  {/* Sets */}
                  {s.sets.map((set, si) => (
                    <div key={set.set_number} style={{
                      display: 'grid', gridTemplateColumns: '30px 1fr 1fr',
                      alignItems: 'center', padding: '7px 16px',
                      borderBottom: si < s.sets.length - 1 ? '1px solid var(--hair)' : 'none',
                    }}>
                      <span className="bignum" style={{ fontSize: 11, color: 'var(--ink-3)' }}>
                        {String(set.set_number).padStart(2, '0')}
                      </span>
                      <span style={cellStyle}>{set.weight_kg ?? '—'}</span>
                      <span style={cellStyle}>{set.reps_completed ?? '—'}</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
