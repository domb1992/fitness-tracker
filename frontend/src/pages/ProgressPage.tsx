import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { sessionsApi, exercisesApi } from '../api/client';
import { Stats, MuscleVolume, LiftProgressionEntry, ExerciseStats } from '../types';

// ─── Calendar helpers ─────────────────────────────────────────────────────────

function buildMonthGrid(sessions: any[], target: Date) {
  const byDate: Record<string, string> = {};
  for (const s of sessions) {
    if (s.completed_at) {
      const key = new Date(s.completed_at).toDateString();
      if (!byDate[key]) byDate[key] = s.id;
    }
  }

  const now         = new Date();
  const year        = target.getFullYear();
  const month       = target.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDow    = (new Date(year, month, 1).getDay() + 6) % 7; // 0=Mon
  const isCurrent   = year === now.getFullYear() && month === now.getMonth();

  let streak = 0;
  let misses = 0;
  if (isCurrent) {
    for (let i = 0; ; i++) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      if (byDate[d.toDateString()]) { streak++; misses = 0; }
      else if (++misses > 2) break;
    }
  }

  const cells: Array<{ day: number | null; on: boolean; today: boolean; future: boolean; sessionId: string | null }> = [];
  for (let i = 0; i < firstDow; i++) cells.push({ day: null, on: false, today: false, future: false, sessionId: null });
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, month, d);
    const key  = date.toDateString();
    cells.push({
      day: d,
      on:     !!byDate[key],
      today:  isCurrent && d === now.getDate(),
      future: date > now,
      sessionId: byDate[key] ?? null,
    });
  }

  const monthName = target.toLocaleDateString('en', { month: 'long', year: 'numeric' });
  return { cells, streak, monthName, isCurrent };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatPeriod(first: string, last: string): string {
  const days = Math.round((new Date(last).getTime() - new Date(first).getTime()) / 86400000);
  if (days < 1) return '1d';
  if (days < 7) return `${days}d`;
  return `${Math.round(days / 7)}w`;
}

function fmtKg(v: number): string {
  return v % 1 === 0 ? `${v}` : `${v.toFixed(1)}`;
}

// ─── Trend icon ───────────────────────────────────────────────────────────────

function TrendIcon({ diff }: { diff: number }) {
  if (diff > 0) {
    return (
      <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="currentColor"
        strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 19V5M5 12l7-7 7 7"/>
      </svg>
    );
  }
  if (diff < 0) {
    return (
      <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="currentColor"
        strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 5v14M5 12l7 7 7-7"/>
      </svg>
    );
  }
  return (
    <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14"/>
    </svg>
  );
}

// ─── Sparkline (real multi-point) ─────────────────────────────────────────────

function Sparkline({ points }: { points: number[] }) {
  const W = 52, H = 28, PAD = 3;
  const n = points.length;
  if (n === 0) return null;

  const lo = Math.min(...points);
  const hi = Math.max(...points);
  const range = hi - lo || 1;

  // Horizontal: spread evenly; Vertical: invert so higher = up
  const px = (i: number) => PAD + (n > 1 ? (i / (n - 1)) : 0.5) * (W - PAD * 2);
  const py = (v: number) => PAD + (H - PAD * 2) * (1 - (v - lo) / range);

  const diff = n > 1 ? points[n - 1] - points[0] : 0;
  const color = diff > 0
    ? 'var(--positive)'
    : diff < 0
      ? 'var(--negative)'
      : 'var(--ink-3)';

  if (n === 1) {
    const cy = H / 2;
    return (
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} fill="none"
        style={{ flexShrink: 0, overflow: 'visible' }}>
        <line x1={PAD} y1={cy} x2={W - PAD} y2={cy} stroke={color} strokeWidth={1.5} strokeDasharray="2 3" opacity={0.5} />
        <circle cx={W / 2} cy={cy} r={2.5} fill={color} />
      </svg>
    );
  }

  // Build smooth bezier path through all points
  let d = `M ${px(0)} ${py(points[0])}`;
  for (let i = 1; i < n; i++) {
    const x0 = px(i - 1), y0 = py(points[i - 1]);
    const x1 = px(i),     y1 = py(points[i]);
    const cx  = (x0 + x1) / 2;
    d += ` C ${cx} ${y0} ${cx} ${y1} ${x1} ${y1}`;
  }

  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} fill="none"
      style={{ flexShrink: 0, overflow: 'visible' }}>
      <path d={d} stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={px(n - 1)} cy={py(points[n - 1])} r={2.5} fill={color} />
    </svg>
  );
}

// ─── Volume bar ───────────────────────────────────────────────────────────────

function VolumeBar({ label, value, max, isTop }: { label: string; value: number; max: number; isTop: boolean }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '90px 1fr 40px', alignItems: 'center', gap: 8 }}>
      <span style={{
        fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.03em',
        color: 'var(--ink-2)', textAlign: 'right',
        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
      }}>
        {label}
      </span>
      <div style={{ height: 6, background: 'var(--paper-2)', borderRadius: 3, overflow: 'hidden', border: '1px solid var(--hair)' }}>
        <div style={{
          height: '100%', width: `${pct}%`,
          background: isTop ? 'var(--bar-primary)' : 'var(--ink)',
          borderRadius: 3, transition: 'width 0.4s ease',
        }} />
      </div>
      <span style={{
        fontFamily: 'var(--mono)', fontSize: 10,
        color: isTop ? 'var(--bar-primary-text)' : 'var(--ink-3)',
        textAlign: 'right',
      }}>
        {value % 1 === 0 ? value : value.toFixed(1)}
      </span>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

const LIFT_PAGE_SIZE = 6;

export default function ProgressPage() {
  const navigate = useNavigate();

  const [stats,       setStats]       = useState<Stats | null>(null);
  const [sessions,    setSessions]    = useState<any[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [copied,      setCopied]      = useState(false);
  const [monthOffset, setMonthOffset] = useState(0);

  // Muscle volume
  const [muscleVolume,  setMuscleVolume]  = useState<MuscleVolume[]>([]);
  const [volumeLoading, setVolumeLoading] = useState(false);

  // Lift progression — tries the dedicated RPC first; falls back to stats.bestWeights
  const [lifts,        setLifts]        = useState<LiftProgressionEntry[]>([]);
  const [liftLoading,  setLiftLoading]  = useState(true);
  const [liftRpcReady, setLiftRpcReady] = useState(true);  // false = RPC not deployed yet
  const [showAllLifts, setShowAllLifts] = useState(false);

  const touchStartX = useRef<number | null>(null);

  // Initial: stats + sessions
  useEffect(() => {
    Promise.all([
      sessionsApi.getStats(),
      sessionsApi.getAll(500),
    ])
      .then(([s, sess]) => { setStats(s); setSessions(sess); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Load lift progression — tries new RPC, falls back to bestWeights from stats
  useEffect(() => {
    let cancelled = false;
    setLiftLoading(true);

    exercisesApi.getLiftProgression()
      .then((data) => {
        if (!cancelled) {
          setLifts(data ?? []);
          setLiftRpcReady(true);
        }
      })
      .catch((err) => {
        if (import.meta.env.DEV) console.warn('[FitTrack] get_lift_progression RPC unavailable:', err?.message ?? err);
        if (!cancelled) setLiftRpcReady(false);
        // bestWeights loads separately via stats; set lifts to [] so fallback renders
        setLifts([]);
      })
      .finally(() => { if (!cancelled) setLiftLoading(false); });

    return () => { cancelled = true; };
  }, []);

  // Muscle volume re-fetches when month changes
  useEffect(() => {
    let cancelled = false;
    const target = new Date();
    target.setDate(1);
    target.setMonth(target.getMonth() + monthOffset);
    const year  = target.getFullYear();
    const month = target.getMonth() + 1;

    setVolumeLoading(true);
    exercisesApi.getMonthlyMuscleVolume(year, month)
      .then((data) => { if (!cancelled) setMuscleVolume(data ?? []); })
      .catch(() => { if (!cancelled) setMuscleVolume([]); })
      .finally(() => { if (!cancelled) setVolumeLoading(false); });

    return () => { cancelled = true; };
  }, [monthOffset]);

  function handleTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX;
  }
  function handleTouchEnd(e: React.TouchEvent) {
    if (touchStartX.current === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(dx) < 50) return;
    if (dx < 0) setMonthOffset((o) => o - 1);
    else        setMonthOffset((o) => Math.min(0, o + 1));
  }

  if (loading) {
    return (
      <div className="ft-loader">
        <div className="ft-loader-dot" />
        <span className="mono-tag">Loading…</span>
      </div>
    );
  }

  const targetDate = new Date();
  targetDate.setDate(1);
  targetDate.setMonth(targetDate.getMonth() + monthOffset);
  const { cells, streak, monthName, isCurrent } = buildMonthGrid(sessions, targetDate);
  const daysWorkedOut = cells.filter((c) => c.on).length;

  // Lift progression: prefer exercises with 2+ sessions (real progression data)
  // Fall back to all exercises only if no exercise has 2+ sessions
  const hasMultiSession = lifts.some((e) => e.session_count >= 2);
  const filteredLifts = hasMultiSession
    ? lifts.filter((e) => e.session_count >= 2)
    : lifts;
  // filteredLifts is already sorted by diff DESC from the RPC
  const displayedLifts = showAllLifts
    ? filteredLifts
    : filteredLifts.slice(0, LIFT_PAGE_SIZE);

  // ── Fallback: convert stats.bestWeights into a display-compatible shape
  //    used when get_lift_progression RPC isn't deployed yet
  const fallbackLifts: (ExerciseStats & { diff: number })[] = !liftRpcReady
    ? (stats?.bestWeights ?? [])
        .filter((e) => e.start_weight != null && e.last_weight != null)
        .map((e) => ({ ...e, diff: (e.last_weight ?? 0) - (e.start_weight ?? 0) }))
        .sort((a, b) => b.diff - a.diff)
    : [];

  // Volume chart
  const topMuscles = muscleVolume.slice(0, 8);
  const volumeMax  = topMuscles[0]?.weighted_sets ?? 1;

  async function handleShare() {
    const lines: string[] = ['💪 My FitTrack Progress', ''];
    lines.push(`📊 Total workouts: ${stats?.totalWorkouts ?? 0}`);
    lines.push(`📅 ${monthName}: ${daysWorkedOut} workout${daysWorkedOut !== 1 ? 's' : ''}`);
    if (streak > 0) lines.push(`🔥 Current streak: ${streak} day${streak !== 1 ? 's' : ''}`);
    if (topMuscles.length > 0) {
      lines.push('');
      lines.push('Top muscles this month:');
      for (const mv of topMuscles.slice(0, 5)) {
        lines.push(`  ${mv.muscle}: ${mv.weighted_sets % 1 === 0 ? mv.weighted_sets : mv.weighted_sets.toFixed(1)} sets`);
      }
    }
    const shareLifts = liftRpcReady ? filteredLifts : fallbackLifts;
    if (shareLifts.length > 0) {
      lines.push('');
      lines.push('Lift progression:');
      for (const lift of shareLifts.slice(0, 8)) {
        const sign   = lift.diff > 0 ? '+' : '';
        const first  = (lift as LiftProgressionEntry).first_logged_at ?? (lift as ExerciseStats).first_logged_at ?? '';
        const last   = (lift as LiftProgressionEntry).last_logged_at  ?? (lift as ExerciseStats).last_logged_at  ?? '';
        const period = first && last ? formatPeriod(first, last) : '';
        const now    = lift.last_weight != null ? ` → ${fmtKg(lift.last_weight)} kg now` : '';
        lines.push(`  ${lift.exercise_name}: ${sign}${fmtKg(lift.diff)} kg${period ? ` / ${period}` : ''}${now}`);
      }
    }
    const text = lines.join('\n');
    if (navigator.share) {
      try { await navigator.share({ title: 'My FitTrack Progress', text }); } catch { /* dismissed */ }
    } else {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  return (
    <div className="ft-screen" style={{ paddingBottom: 'var(--nav-safe)' }}>

      {/* Header */}
      <div style={{ padding: '20px 20px 6px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <p style={{
            margin: '0 0 3px', fontFamily: 'var(--mono)', fontSize: 9,
            letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ink-4)',
          }}>
            Analytics
          </p>
          <h1 style={{
            margin: 0, fontSize: 28, fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1.1,
            color: 'var(--ink)',
          }}>
            Progress
          </h1>
        </div>
        <button
          onClick={handleShare}
          aria-label={copied ? 'Copied' : 'Share progress'}
          className="icon-btn"
          style={{ color: copied ? 'var(--positive)' : undefined, marginTop: 4 }}
        >
          {copied ? (
            <span style={{ fontFamily: 'var(--mono)', fontSize: 8, letterSpacing: '0.06em' }}>COPIED</span>
          ) : (
            <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
              <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
              <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
              <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
            </svg>
          )}
        </button>
      </div>

      {/* Stat cards — total workouts + last 7 days */}
      <div style={{ padding: '16px 20px 20px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <div className="surface" style={{ padding: '16px 16px 14px' }}>
          <div className="mono-tag" style={{ fontSize: 9, color: 'var(--ink-4)', marginBottom: 10 }}>All Time</div>
          <div className="bignum" style={{ fontSize: 44, lineHeight: 1 }}>
            {stats?.totalWorkouts ?? 0}
          </div>
          <div className="mono-tag" style={{ fontSize: 9, color: 'var(--ink-3)', marginTop: 6 }}>workouts</div>
        </div>
        <div className="surface" style={{ padding: '16px 16px 14px' }}>
          <div className="mono-tag" style={{ fontSize: 9, color: 'var(--ink-4)', marginBottom: 10 }}>Last 7 Days</div>
          <div className="bignum" style={{
            fontSize: 44, lineHeight: 1,
            color: (stats?.thisWeek ?? 0) > 0 ? 'var(--positive)' : undefined,
          }}>
            {stats?.thisWeek ?? 0}
          </div>
          <div className="mono-tag" style={{ fontSize: 9, color: 'var(--ink-3)', marginTop: 6 }}>sessions</div>
        </div>
      </div>

      {/* Calendar — swipe or arrow to change month */}
      <div style={{ padding: '0 20px 24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--ink)' }}>
            {isCurrent ? 'This Month' : 'Month'}
          </h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <button aria-label="Previous month" onClick={() => setMonthOffset((o) => o - 1)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-3)', padding: '2px 4px', lineHeight: 1 }}>
              <svg aria-hidden="true" width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
            </button>
            <span className="mono-tag" style={{ minWidth: 110, textAlign: 'center' }}>{monthName}</span>
            <button aria-label="Next month" onClick={() => setMonthOffset((o) => Math.min(0, o + 1))} disabled={isCurrent} style={{ background: 'none', border: 'none', cursor: isCurrent ? 'default' : 'pointer', color: isCurrent ? 'var(--paper-3)' : 'var(--ink-3)', padding: '2px 4px', lineHeight: 1 }}>
              <svg aria-hidden="true" width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6"/></svg>
            </button>
          </div>
        </div>
        <div className="surface" style={{ padding: '14px 14px 12px' }}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 4, marginBottom: 4 }}>
            {['M','T','W','T','F','S','S'].map((l, i) => (
              <div key={i} className="mono-tag" style={{ fontSize: 8, textAlign: 'center', opacity: 0.4 }}>{l}</div>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 4 }}>
            {cells.map((c, i) => (
              <div key={i}
                onClick={() => c.sessionId && navigate(`/session/${c.sessionId}`)}
                style={{
                  aspectRatio: '1', borderRadius: 4,
                  background: c.day === null || c.future ? 'transparent' : c.on ? 'var(--ink)' : 'var(--paper-3)',
                  border: c.today ? '1px solid var(--ink)' : c.day && !c.future ? '1px solid transparent' : 'none',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: c.sessionId ? 'pointer' : 'default',
                }}>
                {c.day !== null && (
                  <span style={{
                    fontFamily: 'var(--mono)', fontSize: 11,
                    color: c.on ? 'var(--paper)' : c.future ? 'var(--ink-3)' : 'var(--ink-2)',
                    fontWeight: c.today ? 700 : 400,
                  }}>{c.day}</span>
                )}
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--hair)' }}>
            <div>
              <span className="mono-tag">Workouts this month</span>
              <span className="bignum" style={{ fontSize: 20, marginLeft: 8 }}>{daysWorkedOut}</span>
            </div>
            {isCurrent && streak > 0 && (
              <div style={{ textAlign: 'right' }}>
                <span className="mono-tag">Streak </span>
                <span className="bignum" style={{ fontSize: 20 }}>{streak}</span>
                <span className="mono-tag"> days</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Volume by Muscle Group ───────────────────────────────────────────── */}
      <div style={{ padding: '0 20px 24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
          <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--ink)' }}>
            Volume by Muscle
          </h3>
          <span className="mono-tag" style={{ color: 'var(--ink-4)' }}>{monthName.split(' ')[0]}</span>
        </div>
        <div className="surface" style={{ padding: '16px 14px' }}>
          {volumeLoading ? (
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <span className="mono-tag" style={{ color: 'var(--ink-4)' }}>Loading…</span>
            </div>
          ) : topMuscles.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <span className="mono-tag" style={{ color: 'var(--ink-4)' }}>
                No strength data for {monthName.split(' ')[0]}
              </span>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
              {topMuscles.map((mv, i) => (
                <VolumeBar key={mv.muscle} label={mv.muscle} value={mv.weighted_sets} max={volumeMax} isTop={i === 0} />
              ))}
            </div>
          )}
        </div>
        {topMuscles.length > 0 && (
          <div style={{ marginTop: 5, textAlign: 'right' }}>
            <span className="mono-tag" style={{ color: 'var(--ink-4)', fontSize: 9 }}>
              weighted sets · primary ×1 · secondary ×0.5
            </span>
          </div>
        )}
      </div>

      {/* ── Lift Progression ─────────────────────────────────────────────────── */}
      <div style={{ padding: '0 20px 24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
          <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--ink)' }}>
            Lift Progression
          </h3>
          <span className="mono-tag" style={{ color: 'var(--ink-4)' }}>
            {liftLoading
              ? '…'
              : liftRpcReady
                ? `${filteredLifts.length} lifts`
                : `${fallbackLifts.length} lifts`}
          </span>
        </div>

        {liftLoading ? (
          <div className="surface" style={{ padding: '24px 14px', textAlign: 'center' }}>
            <span className="mono-tag" style={{ color: 'var(--ink-4)' }}>Loading…</span>
          </div>

        ) : liftRpcReady && filteredLifts.length === 0 ? (
          <div className="surface" style={{ padding: '24px 14px', textAlign: 'center' }}>
            <span className="mono-tag" style={{ color: 'var(--ink-4)' }}>
              Complete workouts with weights to see progression
            </span>
          </div>

        ) : liftRpcReady ? (
          /* ── Full view: real sparklines from get_lift_progression ── */
          <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {displayedLifts.map((e) => {
                const positive = e.diff > 0;
                const negative = e.diff < 0;
                const neutral  = e.diff === 0;
                const period   = formatPeriod(e.first_logged_at, e.last_logged_at);
                const badgeColor = positive
                  ? { color: 'var(--positive)', bg: 'var(--positive-bg)' }
                  : negative
                    ? { color: 'var(--negative)', bg: 'var(--negative-bg)' }
                    : { color: 'var(--ink-3)',    bg: 'var(--paper-2)' };
                const trendColor = positive ? 'var(--positive)' : negative ? 'var(--negative)' : 'var(--ink-4)';

                return (
                  <button key={e.exercise_id} onClick={() => navigate(`/exercise/${e.exercise_id}`)}
                    className="card card-interactive"
                    style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', alignItems: 'center', gap: 10, padding: '12px 14px', cursor: 'pointer', width: '100%', textAlign: 'left', boxSizing: 'border-box' }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, letterSpacing: '-0.01em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {e.exercise_name}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 5, flexWrap: 'wrap' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontFamily: 'var(--mono)', fontSize: 10, fontWeight: 700, color: badgeColor.color, background: badgeColor.bg, padding: '2px 6px', borderRadius: 3, flexShrink: 0 }}>
                          <span style={{ color: trendColor, display: 'flex', alignItems: 'center' }}>
                            <TrendIcon diff={e.diff} />
                          </span>
                          {positive ? '+' : ''}{fmtKg(e.diff)} kg
                        </span>
                        {period && <span className="mono-tag" style={{ color: 'var(--ink-4)' }}>{period}</span>}
                        <span className="mono-tag" style={{ color: 'var(--ink-3)', textTransform: 'none' }}>{fmtKg(e.last_weight)} kg</span>
                        {e.session_count > 1 && <span className="mono-tag" style={{ color: 'var(--ink-4)', textTransform: 'none' }}>{e.session_count}×</span>}
                        {neutral && e.session_count === 1 && <span className="mono-tag" style={{ color: 'var(--ink-4)', textTransform: 'none' }}>1 session</span>}
                      </div>
                    </div>
                    <Sparkline points={Array.isArray(e.sparkline) ? e.sparkline.filter((v) => typeof v === 'number' && isFinite(v)) : []} />
                    <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--ink-4)', flexShrink: 0 }}>
                      <path d="M9 18l6-6-6-6"/>
                    </svg>
                  </button>
                );
              })}
            </div>
            {filteredLifts.length > LIFT_PAGE_SIZE && (
              <button onClick={() => setShowAllLifts((v) => !v)} style={{ width: '100%', marginTop: 8, height: 38, background: 'transparent', border: '1px dashed var(--border)', borderRadius: 'var(--r-2)', fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--ink-3)', cursor: 'pointer' }}>
                {showAllLifts ? 'Show less' : `Show all ${filteredLifts.length} lifts`}
              </button>
            )}
          </>

        ) : fallbackLifts.length === 0 ? (
          <div className="surface" style={{ padding: '24px 14px', textAlign: 'center' }}>
            <span className="mono-tag" style={{ color: 'var(--ink-4)' }}>
              Complete workouts with weights to see progression
            </span>
          </div>

        ) : (
          /* ── Fallback view: uses stats.bestWeights, no sparkline ── */
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {fallbackLifts.map((e) => {
              const positive = e.diff > 0;
              const negative = e.diff < 0;
              const period   = formatPeriod(e.first_logged_at ?? '', e.last_logged_at ?? '');
              const badgeColor = positive
                ? { color: 'var(--positive)', bg: 'var(--positive-bg)' }
                : negative
                  ? { color: 'var(--negative)', bg: 'var(--negative-bg)' }
                  : { color: 'var(--ink-3)',    bg: 'var(--paper-2)' };
              const trendColor = positive ? 'var(--positive)' : negative ? 'var(--negative)' : 'var(--ink-4)';

              return (
                <button key={e.exercise_id} onClick={() => navigate(`/exercise/${e.exercise_id}`)}
                  className="card"
                  style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', alignItems: 'center', gap: 10, padding: '12px 14px', background: 'none', border: 'none', cursor: 'pointer', width: '100%', textAlign: 'left', boxSizing: 'border-box' }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, letterSpacing: '-0.01em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {e.exercise_name}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 5, flexWrap: 'wrap' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontFamily: 'var(--mono)', fontSize: 10, fontWeight: 700, color: badgeColor.color, background: badgeColor.bg, padding: '2px 6px', borderRadius: 3, flexShrink: 0 }}>
                        <span style={{ color: trendColor, display: 'flex', alignItems: 'center' }}>
                          <TrendIcon diff={e.diff} />
                        </span>
                        {positive ? '+' : ''}{fmtKg(e.diff)} kg
                      </span>
                      {period && <span className="mono-tag" style={{ color: 'var(--ink-4)' }}>{period}</span>}
                      {e.last_weight != null && <span className="mono-tag" style={{ color: 'var(--ink-3)', textTransform: 'none' }}>{fmtKg(e.last_weight)} kg</span>}
                    </div>
                  </div>
                  {/* 2-point sparkline from start→last when full history unavailable */}
                  <Sparkline points={[e.start_weight ?? 0, e.last_weight ?? 0].filter((v) => isFinite(v))} />
                  <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--ink-4)', flexShrink: 0 }}>
                    <path d="M9 18l6-6-6-6"/>
                  </svg>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Empty state */}
      {!stats?.totalWorkouts && (
        <div style={{ padding: '48px 20px', textAlign: 'center' }}>
          <p className="mono-tag">No data yet — complete workouts to see progress here</p>
        </div>
      )}
    </div>
  );
}
