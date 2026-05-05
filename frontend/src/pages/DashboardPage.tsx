import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { plansApi, sessionsApi } from '../api/client';
import ConfirmDialog from '../components/ConfirmDialog';
import { useAuthStore, useWorkoutStore } from '../store/store';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { TrainingPlan, WorkoutSession, Stats } from '../types';

function fmtDuration(s: number | null) {
  if (!s) return '—';
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  return h > 0 ? `${h}h ${m % 60}m` : `${m}m`;
}

function timeAgo(dateStr: string) {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60)     return 'Just now';
  if (diff < 3600)   return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400)  return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(dateStr).toLocaleDateString('en', { month: 'short', day: 'numeric' });
}

const QUOTES = [
  "The only bad workout is the one that didn't happen.",
  'Push yourself — no one else is going to do it for you.',
  'The pain you feel today is the strength you feel tomorrow.',
  'Every rep counts. Every day counts.',
  "Your body can stand almost anything. It's your mind you have to convince.",
  'Discipline is doing it even when you don\'t feel like it.',
  'Champions are made in the moments they want to quit.',
  'Be stronger than your excuses.',
  'Train hard. Recover smart. Repeat.',
  'Progress, not perfection.',
  'The iron never lies.',
  'One more rep. One more set. One more day.',
  'Earn your rest day.',
  'Results happen over time, not overnight.',
  'Wake up. Work out. Be better.',
  'Fall in love with taking care of your body.',
  'No excuses. No shortcuts. No regrets.',
  'Strength is built outside the comfort zone.',
  'Show up. Even on the hard days.',
  "You're one workout away from a better mood.",
];

function dailyQuote() {
  const now = new Date();
  const dayOfYear = Math.floor((now.getTime() - new Date(now.getFullYear(), 0, 0).getTime()) / 86400000);
  return QUOTES[dayOfYear % QUOTES.length];
}

function buildWeekStrip(sessions: WorkoutSession[]) {
  const byDate: Record<string, string> = {};
  for (const s of sessions) {
    if (s.completed_at) {
      const key = new Date(s.completed_at).toDateString();
      if (!byDate[key]) byDate[key] = s.id;
    }
  }
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toDateString();
    days.push({
      letter: ['S', 'M', 'T', 'W', 'T', 'F', 'S'][d.getDay()],
      num: d.getDate(),
      on: !!byDate[key],
      today: i === 0,
      sessionId: byDate[key] ?? null,
    });
  }
  return days;
}

export default function DashboardPage() {
  const navigate  = useNavigate();
  const { user }  = useAuthStore();
  const isOnline  = useOnlineStatus();

  const {
    syncPending, sessionId, startedAt, exercises,
    clearWorkout, setSyncPending,
  } = useWorkoutStore();

  const [plans,           setPlans]           = useState<TrainingPlan[]>([]);
  const [sessions,        setSessions]        = useState<WorkoutSession[]>([]);
  const [stats,           setStats]           = useState<Stats | null>(null);
  const [loading,         setLoading]         = useState(true);
  const [showAllSessions, setShowAllSessions] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleting,        setDeleting]        = useState(false);
  const [syncing,         setSyncing]         = useState(false);
  const [syncError,       setSyncError]       = useState('');
  const syncingRef = useRef(false);

  const load = useCallback(async () => {
    try {
      const [planList, sessionList, statsData] = await Promise.all([
        plansApi.getAll(),
        sessionsApi.getAll(50),
        sessionsApi.getStats(),
      ]);
      setPlans(planList);
      setSessions(sessionList);
      setStats(statsData);
    } catch { /* auth error handled by RequireAuth */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const doSync = useCallback(async () => {
    if (!syncPending || !sessionId || !startedAt || syncingRef.current) return;
    syncingRef.current = true;
    setSyncing(true); setSyncError('');
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
      await load();
    } catch (err: any) {
      setSyncError(err.message || 'Sync failed — will retry when online');
      setSyncPending(true);
    } finally {
      setSyncing(false);
      syncingRef.current = false;
    }
  }, [syncPending, sessionId, startedAt, exercises]);

  useEffect(() => {
    if (isOnline && syncPending) { doSync(); }
  }, [isOnline, syncPending]);

  async function handleDeleteSession(sid: string) {
    setDeleting(true);
    try {
      await sessionsApi.delete(sid);
      setSessions((prev) => prev.filter((s) => s.id !== sid));
      setStats((prev) => prev ? { ...prev, totalWorkouts: Math.max(0, prev.totalWorkouts - 1) } : prev);
    } finally {
      setDeleting(false);
      setDeleteConfirmId(null);
    }
  }

  if (loading) {
    return (
      <div className="ft-loader">
        <div className="ft-loader-dot" />
        <span className="mono-tag">Loading…</span>
      </div>
    );
  }

  const week       = buildWeekStrip(sessions);
  const doneDays   = week.filter((d) => d.on).length;
  const recentSess = sessions.slice(0, 5);

  const firstName = user?.name ? user.name.split(' ')[0] : null;

  return (
    <div className="ft-screen animate-fade-in" style={{ paddingBottom: 'var(--nav-safe)' }}>

      {/* Offline / sync banner */}
      {(syncPending || !isOnline) && (
        <div className={`banner ${syncPending && isOnline ? 'banner-success' : 'banner-warning'}`}>
          {syncing ? (
            <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
              style={{ animation: 'spin 1s linear infinite', flexShrink: 0 }}>
              <path d="M21 12a9 9 0 1 1-6.22-8.56"/>
            </svg>
          ) : (
            <svg width={12} height={12} viewBox="0 0 24 24" fill="currentColor" style={{ flexShrink: 0 }}>
              <path d="M1 1l22 22M16.72 11.06A10.94 10.94 0 0 1 19 12.55M5 12.55a10.94 10.94 0 0 1 5.17-2.39M10.71 5.05A16 16 0 0 1 22.56 9M1.42 9a15.91 15.91 0 0 1 4.7-2.88M8.53 16.11a6 6 0 0 1 6.95 0M12 20h.01"/>
            </svg>
          )}
          <span style={{ flex: 1 }}>
            {syncing
              ? 'SYNCING WORKOUT…'
              : syncPending && isOnline ? 'WORKOUT SAVED — SYNCING'
              : syncPending ? 'OFFLINE — WORKOUT SAVED LOCALLY'
              : 'OFFLINE'}
          </span>
          {syncPending && !syncing && isOnline && (
            <button onClick={doSync} style={{
              background: 'rgba(255,255,255,0.22)', border: 'none', borderRadius: 5,
              color: 'white', fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.06em',
              padding: '4px 9px', cursor: 'pointer', flexShrink: 0,
            }}>
              SYNC NOW
            </button>
          )}
        </div>
      )}
      {syncError && (
        <div style={{ padding: '7px 20px', background: 'var(--danger-soft)', fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--danger)' }}>
          {syncError}
        </div>
      )}

      {/* Greeting */}
      <div style={{ padding: '18px 20px 16px' }}>
        <div className="mono-tag" style={{ marginBottom: 4 }}>
          {firstName ? `Hey, ${firstName}` : 'Hey'}
        </div>

        {/* Daily quote card */}
        <div className="surface" style={{
          padding: '13px 15px',
          display: 'flex', gap: 11, alignItems: 'flex-start',
        }}>
          <svg width={17} height={13} viewBox="0 0 18 14" fill="currentColor"
            style={{ color: 'var(--ink-4)', flexShrink: 0, marginTop: 1 }}>
            <path d="M0 14V8.4C0 3.6 3 1 9 0l1.35 1.8C7.2 2.6 5.55 4 5.1 6H8V14H0zm10 0V8.4C10 3.6 13 1 19 0l1.35 1.8C17.2 2.6 15.55 4 15.1 6H18V14h-8z"/>
          </svg>
          <p style={{
            margin: 0, fontFamily: 'var(--sans)', fontSize: 13,
            fontStyle: 'italic', color: 'var(--ink-2)', lineHeight: 1.55,
          }}>
            {dailyQuote()}
          </p>
        </div>
      </div>

      {/* Week strip */}
      <div style={{ padding: '0 20px 22px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
          <span className="mono-tag">Last 7 days</span>
          <span className="mono-tag">{doneDays}/7 sessions</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 5 }}>
          {week.map((d, i) => (
            <div key={i}
              onClick={() => d.sessionId && navigate(`/session/${d.sessionId}`)}
              style={{
                border: d.today ? '1.5px solid var(--ink)' : '1px solid var(--border)',
                background: d.on ? 'var(--ink)' : d.today ? 'var(--paper-2)' : 'transparent',
                color: d.on ? 'var(--paper)' : 'var(--ink)',
                borderRadius: 'var(--r-1)', padding: '8px 0 7px',
                textAlign: 'center', position: 'relative',
                cursor: d.sessionId ? 'pointer' : 'default',
                boxShadow: d.on ? 'var(--shadow-sm)' : 'none',
                transition: 'transform 100ms ease, box-shadow 100ms ease',
              }}>
              <div style={{
                fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.04em',
                opacity: d.on ? 0.55 : d.today ? 0.7 : 0.45,
              }}>{d.letter}</div>
              <div className="bignum" style={{ fontSize: 16, marginTop: 2 }}>{d.num}</div>
              {d.on && (
                <div style={{
                  position: 'absolute', bottom: 5, left: '50%', transform: 'translateX(-50%)',
                  width: 4, height: 4, borderRadius: '50%', background: 'var(--lime)',
                }} />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Plans */}
      <div style={{ padding: '0 20px 22px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
          <h3 className="section-title">Programs</h3>
          <span className="mono-tag">{plans.length} active</span>
        </div>

        {plans.length === 0 ? (
          <div className="empty-state" style={{
            border: '1px dashed var(--border)', borderRadius: 'var(--r-2)',
            padding: '36px 20px',
          }}>
            <div className="empty-state-icon">
              <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 5v14M5 12h14"/>
              </svg>
            </div>
            <p className="mono-tag" style={{ margin: 0 }}>No plans yet</p>
            <button onClick={() => navigate('/setup')} className="block-btn" style={{ maxWidth: 180, margin: '0 auto' }}>
              <span>Create first plan</span>
            </button>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {plans.map((plan) => (
                <div key={plan.id} className="card" style={{
                  display: 'flex', alignItems: 'center', overflow: 'hidden',
                  borderLeft: `3px solid ${plan.color || 'var(--ink)'}`,
                }}>
                  <button onClick={() => navigate(`/plan/${plan.id}`)} style={{
                    flex: 1, minWidth: 0, background: 'none', border: 'none', cursor: 'pointer',
                    textAlign: 'left', padding: '14px 12px 14px 14px',
                  }}>
                    <div style={{ fontSize: 14, fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--ink)' }}>
                      {plan.name}
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px 8px', marginTop: 5 }}>
                      <span className="mono-tag">{plan.exercise_count} exercises</span>
                      <span className="mono-tag" style={{ color: 'var(--ink-4)' }}>·</span>
                      <span className="mono-tag">{plan.session_count} sessions</span>
                      <span className="mono-tag" style={{ color: 'var(--ink-4)' }}>·</span>
                      <span className="mono-tag" style={{ textTransform: 'none' }}>
                        {plan.last_used ? timeAgo(plan.last_used) : 'Never done'}
                      </span>
                    </div>
                  </button>
                  <div style={{ padding: '0 12px 0 4px', flexShrink: 0 }}>
                    <button onClick={() => navigate(`/workout/${plan.id}`)} style={{
                      display: 'flex', alignItems: 'center', gap: 5,
                      background: 'var(--ink)', color: 'var(--paper)',
                      border: 'none', borderRadius: 'var(--r-1)',
                      padding: '9px 14px', fontFamily: 'var(--sans)',
                      fontSize: 12, fontWeight: 700, cursor: 'pointer',
                      boxShadow: 'var(--shadow-xs)',
                      transition: 'box-shadow var(--duration-fast) var(--ease), transform var(--duration-fast) var(--ease-spring)',
                    }}>
                      Start
                      <svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                        <path d="M5 12h14M13 6l6 6-6 6"/>
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <button onClick={() => navigate('/setup')} style={{
              width: '100%', marginTop: 8, height: 42,
              background: 'transparent', border: '1px dashed var(--border)', borderRadius: 'var(--r-2)',
              fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.06em',
              textTransform: 'uppercase', color: 'var(--ink-3)', cursor: 'pointer',
              transition: 'background var(--duration-fast) var(--ease)',
            }}>
              + Add New Plan
            </button>
          </>
        )}
      </div>

      {/* Recent Workouts */}
      {recentSess.length > 0 && (
        <div style={{ padding: '0 20px 24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
            <h3 className="section-title">Recent Workouts</h3>
            {sessions.length > 5 && (
              <button onClick={() => setShowAllSessions(true)} className="mono-tag" style={{
                background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-2)',
                textDecoration: 'underline', textUnderlineOffset: 3, padding: 0,
              }}>See all</button>
            )}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {recentSess.map((s) => (
              <div key={s.id} className="card" style={{
                display: 'flex', alignItems: 'center', overflow: 'hidden',
                borderLeft: `3px solid ${s.plan_color || 'var(--ink)'}`,
              }}>
                <button onClick={() => navigate(`/session/${s.id}`)} style={{
                  flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column',
                  background: 'none', border: 'none', cursor: 'pointer',
                  padding: '13px 10px 13px 14px', textAlign: 'left',
                }}>
                  <div style={{
                    fontSize: 13, fontWeight: 700, letterSpacing: '-0.01em',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    color: 'var(--ink)',
                  }}>
                    {s.plan_name}
                  </div>
                  <div className="mono-tag" style={{ marginTop: 3, textTransform: 'none' }}>
                    {timeAgo(s.completed_at!)} · {fmtDuration(s.duration_seconds)} · {s.total_sets ?? 0} sets
                  </div>
                </button>
                <button onClick={() => setDeleteConfirmId(s.id)} style={{
                  flexShrink: 0, height: 30, width: 30, background: 'transparent',
                  color: 'var(--ink-4)', border: '1px solid var(--border)',
                  borderRadius: 'var(--r-1)', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: 12,
                  transition: 'background var(--duration-fast) var(--ease), color var(--duration-fast) var(--ease)',
                }}>
                  <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round">
                    <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/>
                  </svg>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {recentSess.length === 0 && plans.length > 0 && (
        <div style={{ padding: '0 20px 24px' }}>
          <div style={{ border: '1px dashed var(--border)', borderRadius: 'var(--r-2)', padding: '28px 20px', textAlign: 'center' }}>
            <p className="mono-tag" style={{ color: 'var(--ink-4)', margin: 0 }}>
              No workouts yet — start your first session above
            </p>
          </div>
        </div>
      )}

      {/* All sessions sheet */}
      {showAllSessions && (
        <div className="ft-sheet-overlay" onClick={() => setShowAllSessions(false)}>
          <div
            className="ft-sheet"
            style={{ maxHeight: '80dvh', display: 'flex', flexDirection: 'column', padding: 0 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 20px 14px', flexShrink: 0 }}>
              <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, letterSpacing: '-0.03em' }}>
                All Workouts
              </h2>
              <button onClick={() => setShowAllSessions(false)} className="icon-btn" style={{ width: 32, height: 32 }}>
                <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
              </button>
            </div>
            <div style={{ overflowY: 'auto', padding: '0 20px 32px', flex: 1 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {sessions.map((s) => (
                  <div
                    key={s.id}
                    onClick={() => { setShowAllSessions(false); navigate(`/session/${s.id}`); }}
                    className="card card-interactive"
                    style={{
                      display: 'flex', alignItems: 'center', overflow: 'hidden',
                      borderLeft: `3px solid ${s.plan_color || 'var(--ink)'}`,
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0, padding: '13px 10px 13px 14px' }}>
                      <div style={{ fontSize: 13, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--ink)' }}>
                        {s.plan_name}
                      </div>
                      <div className="mono-tag" style={{ marginTop: 3, textTransform: 'none' }}>
                        {timeAgo(s.completed_at!)} · {fmtDuration(s.duration_seconds)} · {s.total_sets ?? 0} sets
                      </div>
                    </div>
                    <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--ink-4)', flexShrink: 0, marginRight: 14 }}>
                      <path d="M9 18l6-6-6-6"/>
                    </svg>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {deleteConfirmId && (
        <ConfirmDialog
          title="Delete workout?"
          message="This workout will be permanently removed and won't count toward your stats."
          confirmLabel={deleting ? 'Deleting…' : 'Delete'}
          cancelLabel="Cancel"
          dangerous
          onConfirm={() => handleDeleteSession(deleteConfirmId)}
          onCancel={() => setDeleteConfirmId(null)}
        />
      )}
    </div>
  );
}
