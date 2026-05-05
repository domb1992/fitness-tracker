import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { sessionsApi } from '../api/client';

function fmtDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en', {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
  });
}

function fmtDuration(s: number | null) {
  if (!s) return '—';
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  return h > 0 ? `${h}h ${m % 60}m` : `${m}m`;
}

export default function SessionPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();

  const [session,     setSession]     = useState<any>(null);
  const [loading,     setLoading]     = useState(true);
  const [editMode,    setEditMode]    = useState(false);
  const [saving,      setSaving]      = useState(false);
  const [deleting,    setDeleting]    = useState(false);
  const [showDelete,  setShowDelete]  = useState(false);
  const [error,       setError]       = useState('');
  const [dirty,       setDirty]       = useState(false);
  const [copied,      setCopied]      = useState(false);
  const [dateValue,   setDateValue]   = useState('');
  const [logs, setLogs] = useState<Record<string, { weight: string; reps: string }>>({});

  useEffect(() => {
    if (!sessionId) { navigate('/dashboard', { replace: true }); return; }
    sessionsApi.getWithLogs(sessionId)
      .then((data) => {
        setSession(data);
        const ts = data.completed_at || data.started_at;
        if (ts) setDateValue(new Date(ts).toISOString().slice(0, 10));
        const init: Record<string, { weight: string; reps: string }> = {};
        for (const log of (data.set_logs ?? [])) {
          init[log.id] = {
            weight: log.weight_kg != null ? String(log.weight_kg) : '',
            reps:   log.reps_completed != null ? String(log.reps_completed) : '',
          };
        }
        setLogs(init);
      })
      .catch(() => navigate('/dashboard', { replace: true }))
      .finally(() => setLoading(false));
  }, [sessionId, navigate]);

  function updateLog(logId: string, field: 'weight' | 'reps', value: string) {
    setLogs((prev) => ({ ...prev, [logId]: { ...prev[logId], [field]: value } }));
    setDirty(true);
  }

  async function handleSave() {
    setSaving(true); setError('');
    try {
      const origDate = (session.completed_at || session.started_at || '').slice(0, 10);
      if (dateValue && dateValue !== origDate) {
        const origTs   = new Date(session.completed_at || session.started_at);
        const newTs    = new Date(dateValue);
        newTs.setHours(origTs.getHours(), origTs.getMinutes(), origTs.getSeconds(), origTs.getMilliseconds());
        await sessionsApi.updateSession(sessionId!, { completed_at: newTs.toISOString() });
        setSession((s: any) => ({ ...s, completed_at: newTs.toISOString() }));
      }
      for (const [logId, vals] of Object.entries(logs)) {
        await sessionsApi.updateSetLog(logId, {
          weight_kg:      vals.weight !== '' ? parseFloat(vals.weight) : null,
          reps_completed: vals.reps.trim() || null,
        });
      }
      setDirty(false);
      setEditMode(false);
    } catch (err: any) {
      setError(err.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      await sessionsApi.delete(sessionId!);
      navigate('/dashboard', { replace: true });
    } catch (err: any) {
      setError(err.message || 'Failed to delete');
      setDeleting(false);
      setShowDelete(false);
    }
  }

  async function handleShare() {
    if (!session) return;
    const planName = session.training_plans?.name ?? 'Workout';
    const date     = fmtDate(session.completed_at || session.started_at);
    const dur      = fmtDuration(session.duration_seconds);
    const rawLogs: any[] = session.set_logs ?? [];
    const exercises: any[] = [...(session.training_plans?.exercises ?? [])].sort(
      (a: any, b: any) => a.exercise_order - b.exercise_order
    );
    const logsByEx: Record<string, any[]> = {};
    for (const log of rawLogs) {
      if (!logsByEx[log.exercise_id]) logsByEx[log.exercise_id] = [];
      logsByEx[log.exercise_id].push(log);
    }
    const lines: string[] = [`💪 ${planName}`, `📅 ${date}  ⏱ ${dur}  📊 ${rawLogs.length} sets`, ''];
    for (const ex of exercises) {
      const exLogs = (logsByEx[ex.id] ?? []).sort((a: any, b: any) => a.set_number - b.set_number);
      if (exLogs.length === 0) continue;
      const isWarmup = ex.exercise_type === 'warmup';
      lines.push(ex.name);
      if (isWarmup) {
        const log = exLogs[0];
        const bpm = logs[log?.id]?.weight || (log?.weight_kg != null ? String(log.weight_kg) : null);
        const min = logs[log?.id]?.reps   || (log?.reps_completed != null ? String(log.reps_completed) : null);
        const parts = [min ? `${min} min` : null, bpm ? `${bpm} bpm` : null].filter(Boolean);
        lines.push(`  ${parts.length > 0 ? parts.join(' · ') : '—'}`);
      } else {
        for (const log of exLogs) {
          const w = logs[log.id]?.weight || (log.weight_kg != null ? String(log.weight_kg) : '—');
          const r = logs[log.id]?.reps   || (log.reps_completed != null ? String(log.reps_completed) : '—');
          lines.push(`  Set ${log.set_number}: ${w} kg × ${r} reps`);
        }
      }
      lines.push('');
    }
    const text = lines.join('\n').trimEnd();
    if (navigator.share) {
      try { await navigator.share({ title: planName, text }); } catch { /* dismissed */ }
    } else {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100dvh', background: 'var(--paper)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span className="mono-tag">Loading…</span>
      </div>
    );
  }

  if (!session) return null;

  const exercises: any[] = [...(session.training_plans?.exercises ?? [])].sort(
    (a, b) => a.exercise_order - b.exercise_order
  );
  const rawLogs: any[] = session.set_logs ?? [];

  const logsByExercise: Record<string, any[]> = {};
  for (const log of rawLogs) {
    if (!logsByExercise[log.exercise_id]) logsByExercise[log.exercise_id] = [];
    logsByExercise[log.exercise_id].push(log);
  }

  // Use workout-input class + done-set for consistent styling with WorkoutPage
  const cellInputClass = 'workout-input done-set';

  return (
    <div className="ft-screen" style={{ paddingBottom: dirty ? 100 : 32 }}>
      {/* Header */}
      <div style={{ padding: '8px 20px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <button className="icon-btn" onClick={() => navigate(-1 as any)}>
          <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M11 6l-6 6 6 6"/>
          </svg>
        </button>
        <div className="mono-tag">Workout</div>
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          <button onClick={handleShare}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: copied ? 'oklch(0.5 0.18 145)' : 'var(--ink-3)', padding: 4 }}>
            {copied ? (
              <span style={{ fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.06em' }}>COPIED</span>
            ) : (
              <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
                <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
              </svg>
            )}
          </button>
          {!editMode && (
            <button onClick={() => setEditMode(true)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-3)', padding: 4 }}>
              <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
            </button>
          )}
          <button onClick={() => setShowDelete(true)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-3)', padding: 4 }}>
            <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round">
              <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/>
            </svg>
          </button>
        </div>
      </div>

      {/* Summary */}
      <div style={{ padding: '0 20px 18px' }}>
        <h1 style={{ margin: '0 0 10px', fontSize: 26, fontWeight: 700, letterSpacing: '-0.025em', lineHeight: 1.1 }}>
          {session.training_plans?.name}
        </h1>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 10 }}>
          <span className="mono-tag">{fmtDuration(session.duration_seconds)}</span>
          <span className="mono-tag">·</span>
          <span className="mono-tag">{rawLogs.length} sets</span>
        </div>
        <div>
          {editMode ? (
            <>
              <label className="ft-label">Date</label>
              <input
                type="date"
                value={dateValue}
                onChange={(e) => { setDateValue(e.target.value); setDirty(true); }}
                className="ft-input"
              />
            </>
          ) : (
            <span className="mono-tag" style={{ textTransform: 'none' }}>
              {fmtDate(session.completed_at || session.started_at)}
            </span>
          )}
        </div>
      </div>

      {/* Set logs per exercise */}
      <div style={{ padding: '0 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {exercises.map((ex) => {
          const exLogs = (logsByExercise[ex.id] ?? []).sort((a: any, b: any) => a.set_number - b.set_number);
          if (exLogs.length === 0) return null;
          const isWarmup = ex.exercise_type === 'warmup';

          // ── Warmup result card ─────────────────────────────────────────────
          if (isWarmup) {
            const log = exLogs[0]; // warmup always has 1 set
            const bpm = logs[log?.id]?.weight || (log?.weight_kg != null ? String(log.weight_kg) : null);
            const min = logs[log?.id]?.reps   || (log?.reps_completed != null ? String(log.reps_completed) : null);
            const accentColor = 'oklch(0.68 0.16 55)';
            return (
              <div key={ex.id} className="card" style={{ overflow: 'hidden' }}>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '12px 16px', borderBottom: '1px solid var(--border)',
                  background: 'var(--paper-2)',
                }}>
                  <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke={accentColor}
                    strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                  </svg>
                  <div style={{ flex: 1 }}>
                    <span style={{ fontSize: 13, fontWeight: 600 }}>{ex.name}</span>
                    {ex.seat_position && (
                      <div className="mono-tag" style={{ marginTop: 2, textTransform: 'none', color: 'var(--ink-3)' }}>
                        {ex.seat_position}
                      </div>
                    )}
                    {ex.notes && (
                      <div className="mono-tag" style={{ marginTop: 1, textTransform: 'none', color: 'var(--ink-3)', fontStyle: 'italic' }}>
                        {ex.notes}
                      </div>
                    )}
                  </div>
                  <div className="mono-tag" style={{ color: 'var(--ink-3)' }}>WARMUP</div>
                </div>
                <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 16, minHeight: 52 }}>
                  {editMode && log ? (
                    <>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1 }}>
                        <span className="mono-tag">BPM</span>
                        <input type="number" inputMode="numeric" value={logs[log.id]?.weight ?? ''}
                          onChange={(e) => updateLog(log.id, 'weight', e.target.value)}
                          placeholder="—" className={cellInputClass}
                        />
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1 }}>
                        <span className="mono-tag">MIN</span>
                        <input type="number" inputMode="decimal" value={logs[log.id]?.reps ?? ''}
                          onChange={(e) => updateLog(log.id, 'reps', e.target.value)}
                          placeholder="—" step="0.5" className={cellInputClass}
                        />
                      </div>
                    </>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {min && (
                        <span className="bignum" style={{ fontSize: 22 }}>{min}</span>
                      )}
                      {min && <span className="mono-tag">min</span>}
                      {min && bpm && <span className="mono-tag" style={{ color: 'var(--ink-4)' }}>·</span>}
                      {bpm && (
                        <>
                          <span className="bignum" style={{ fontSize: 22 }}>{bpm}</span>
                          <span className="mono-tag">bpm</span>
                        </>
                      )}
                      {!min && !bpm && <span className="mono-tag">—</span>}
                    </div>
                  )}
                </div>
              </div>
            );
          }

          // ── Strength exercise card (original) ──────────────────────────────
          return (
            <div key={ex.id} className="card" style={{ overflow: 'hidden' }}>
              <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', background: 'var(--paper-2)' }}>
                <span style={{ fontSize: 13, fontWeight: 600 }}>{ex.name}</span>
                {ex.seat_position && (
                  <div className="mono-tag" style={{ marginTop: 3, textTransform: 'none', color: 'var(--ink-3)' }}>
                    Seat: {ex.seat_position}
                  </div>
                )}
                {ex.notes && (
                  <div className="mono-tag" style={{ marginTop: 2, textTransform: 'none', color: 'var(--ink-3)', fontStyle: 'italic' }}>
                    {ex.notes}
                  </div>
                )}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '28px 1fr 1fr', padding: '7px 16px 5px', borderBottom: '1px solid var(--border)' }}>
                <span className="mono-tag">SET</span>
                <span className="mono-tag" style={{ textAlign: 'center' }}>KG</span>
                <span className="mono-tag" style={{ textAlign: 'center' }}>REPS</span>
              </div>
              {exLogs.map((log: any, i: number) => (
                <div key={log.id} style={{
                  display: 'grid', gridTemplateColumns: '28px 1fr 1fr',
                  alignItems: 'center', padding: '8px 16px', minHeight: 44,
                  borderBottom: i < exLogs.length - 1 ? '1px solid var(--border)' : 'none',
                }}>
                  <span className="bignum" style={{ fontSize: 12, color: 'var(--ink-3)' }}>
                    {String(log.set_number).padStart(2, '0')}
                  </span>
                  {editMode ? (
                    <>
                      <input type="number" inputMode="decimal" value={logs[log.id]?.weight ?? ''}
                        onChange={(e) => updateLog(log.id, 'weight', e.target.value)}
                        placeholder="—" step="2.5" className={cellInputClass}
                      />
                      <input
                        type="text" inputMode="text" value={logs[log.id]?.reps ?? ''}
                        onChange={(e) => {
                          const v = e.target.value;
                          if (v === '' || /^\d+$/.test(v) || /^max$/i.test(v)) {
                            updateLog(log.id, 'reps', v.toLowerCase() === 'max' ? 'max' : v);
                          }
                        }}
                        placeholder="—"
                        className={cellInputClass}
                      />
                    </>
                  ) : (
                    <>
                      <span className={cellInputClass} style={{ display: 'block' }}>
                        {logs[log.id]?.weight || '—'}
                      </span>
                      <span className={cellInputClass} style={{ display: 'block' }}>
                        {logs[log.id]?.reps || '—'}
                      </span>
                    </>
                  )}
                </div>
              ))}
            </div>
          );
        })}

        {error && (
          <div style={{ background: 'oklch(0.55 0.22 25 / 0.1)', border: '1px solid oklch(0.55 0.22 25 / 0.3)', borderRadius: 8, padding: '12px 14px', fontSize: 13, color: 'oklch(0.55 0.22 25)' }}>
            {error}
          </div>
        )}
      </div>

      {/* Sticky save */}
      {dirty && (
        <div style={{
          position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)',
          width: '100%', maxWidth: 430, padding: '12px 20px 22px',
          background: 'linear-gradient(to top, var(--paper) 60%, transparent)',
        }}>
          <button className="block-btn" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      )}

      {/* Delete confirm */}
      {showDelete && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 50,
          background: 'oklch(0.18 0.012 80 / 0.5)',
          display: 'flex', alignItems: 'flex-end', justifyContent: 'center', padding: 16,
        }}>
          <div className="surface" style={{ width: '100%', maxWidth: 390, padding: 24 }}>
            <h2 style={{ margin: '0 0 8px', fontSize: 16, fontWeight: 700, letterSpacing: '-0.02em' }}>Delete workout?</h2>
            <p style={{ margin: '0 0 24px', fontSize: 14, color: 'var(--ink-2)', lineHeight: 1.5 }}>
              This workout will be permanently removed and won't count toward your stats.
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setShowDelete(false)} style={{
                flex: 1, height: 48, background: 'transparent', color: 'var(--ink)',
                border: '1px solid var(--hair)', borderRadius: 8,
                fontFamily: 'var(--sans)', fontSize: 14, fontWeight: 500, cursor: 'pointer',
              }}>Cancel</button>
              <button onClick={handleDelete} disabled={deleting} style={{
                flex: 1, height: 48, background: 'oklch(0.55 0.22 25)', color: 'white',
                border: 0, borderRadius: 8,
                fontFamily: 'var(--sans)', fontSize: 14, fontWeight: 600, cursor: 'pointer',
                opacity: deleting ? 0.5 : 1,
              }}>{deleting ? 'Deleting…' : 'Delete'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
