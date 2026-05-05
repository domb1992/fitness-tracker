import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useWorkoutStore } from '../store/store';

function useClock(startedAt: string | null) {
  const [elapsed, setElapsed] = useState(() =>
    startedAt ? Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000) : 0
  );
  useEffect(() => {
    if (!startedAt) return;
    const iv = setInterval(() =>
      setElapsed(Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000)), 1000
    );
    return () => clearInterval(iv);
  }, [startedAt]);
  const m = Math.floor(elapsed / 60);
  const s = elapsed % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export default function ActiveWorkoutBar() {
  const { sessionId, planId, planName, startedAt, exercises, syncPending } = useWorkoutStore();
  const navigate = useNavigate();
  const location = useLocation();
  const clock = useClock(startedAt);

  const doneCount = exercises.reduce((a, ex) => a + (ex.sets?.filter((s) => s.done).length ?? 0), 0);
  const totalSets = exercises.reduce((a, ex) => a + (ex.sets?.length ?? 0), 0);

  // Hide on the workout page itself; also hide when syncPending (dashboard shows its own banner)
  if (!sessionId || location.pathname.startsWith('/workout') || syncPending) return null;

  return (
    <div style={{
      position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)',
      width: '100%', maxWidth: 430, zIndex: 40,
      padding: '12px 16px 20px',
      background: 'linear-gradient(to top, var(--paper) 65%, transparent)',
      pointerEvents: 'none',
    }}>
      <button
        onClick={() => navigate(`/workout/${planId}`)}
        style={{
          width: '100%', pointerEvents: 'auto',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: 'var(--ink)', color: 'var(--paper)',
          border: 'none', borderRadius: 14, padding: '13px 18px',
          cursor: 'pointer', fontFamily: 'var(--sans)',
          boxShadow: '0 4px 24px oklch(0.18 0.012 80 / 0.18)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 9, height: 9, borderRadius: '50%',
            background: 'var(--lime)', flexShrink: 0,
            boxShadow: '0 0 0 3px oklch(0.86 0.18 125 / 0.25)',
          }} />
          <div style={{ textAlign: 'left' }}>
            <div style={{ fontSize: 14, fontWeight: 600, letterSpacing: '-0.01em' }}>{planName}</div>
            <div className="mono-tag" style={{ color: 'rgba(255,255,255,0.45)', marginTop: 2, textTransform: 'none' }}>
              {doneCount}/{totalSets} sets · tap to resume
            </div>
          </div>
        </div>
        <div className="bignum" style={{ fontSize: 26, color: 'var(--lime)', letterSpacing: '-0.04em' }}>
          {clock}
        </div>
      </button>
    </div>
  );
}
