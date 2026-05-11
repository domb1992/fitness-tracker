import React from 'react';
import { useNavigate } from 'react-router-dom';
import { cn } from '../../../lib/utils';
import { WorkoutSession } from '../../../types';

interface ActivityCalendarProps {
  sessions: WorkoutSession[];
}

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export const ActivityCalendar: React.FC<ActivityCalendarProps> = ({ sessions }) => {
  const navigate = useNavigate();

  const byDate: Record<string, string> = {};
  for (const s of sessions) {
    if (s.completed_at) {
      const key = new Date(s.completed_at).toDateString();
      if (!byDate[key]) byDate[key] = s.id;
    }
  }

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    const key = d.toDateString();
    return {
      label: DAY_LABELS[d.getDay()].slice(0, 1),
      num:   d.getDate(),
      on:    !!byDate[key],
      today: i === 6,
      sessionId: byDate[key] ?? null,
    };
  });

  const doneDays = days.filter((d) => d.on).length;

  // Calculate running streak
  let streak = 0;
  for (let i = 6; i >= 0; i--) {
    if (days[i].on) streak++;
    else break;
  }

  return (
    <div className="px-5 pb-[22px]">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <span style={{
          fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.07em',
          textTransform: 'uppercase', color: 'var(--ink-3)', fontWeight: 500,
        }}>
          Last 7 days
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {streak >= 3 && (
            <span style={{
              fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.05em',
              color: 'oklch(0.60 0.18 55)', background: 'oklch(0.97 0.06 60)',
              padding: '2px 8px', borderRadius: 'var(--r-full)',
              border: '1px solid oklch(0.85 0.12 55)',
              fontWeight: 700,
            }}>
              🔥 {streak} STREAK
            </span>
          )}
          <span style={{
            fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.05em',
            color: doneDays > 0 ? 'var(--ink-2)' : 'var(--ink-4)',
          }}>
            {doneDays}/7
          </span>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6 }}>
        {days.map((d, i) => (
          <button
            key={i}
            onClick={() => d.sessionId && navigate(`/session/${d.sessionId}`)}
            disabled={!d.sessionId}
            style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              padding: '9px 4px 8px',
              borderRadius: 'var(--r-1)',
              border: d.today
                ? '1.5px solid var(--ink)'
                : d.on
                  ? 'none'
                  : '1px solid var(--border)',
              background: d.on
                ? (d.today ? 'var(--ink)' : 'var(--ink)')
                : d.today
                  ? 'var(--paper-2)'
                  : 'transparent',
              cursor: d.sessionId ? 'pointer' : 'default',
              transition: 'transform var(--duration-fast) var(--ease-spring), box-shadow var(--duration-fast) var(--ease)',
              boxShadow: d.on ? 'var(--shadow-sm)' : 'none',
            }}
            className={cn(d.sessionId && 'hover:shadow-md active:scale-95')}
          >
            <span style={{
              fontFamily: 'var(--mono)', fontSize: 8,
              letterSpacing: '0.06em', textTransform: 'uppercase',
              color: d.on ? 'var(--paper)' : d.today ? 'var(--ink-3)' : 'var(--ink-4)',
              opacity: d.on ? 0.65 : 1,
              marginBottom: 4, lineHeight: 1,
            }}>
              {d.label}
            </span>
            <span style={{
              fontFamily: 'var(--mono)', fontSize: 15, fontWeight: 700,
              letterSpacing: '-0.03em', lineHeight: 1,
              color: d.on ? 'var(--paper)' : d.today ? 'var(--ink)' : 'var(--ink-3)',
            }}>
              {d.num}
            </span>
            {d.on && (
              <span style={{
                width: 4, height: 4, borderRadius: '50%',
                background: 'var(--lime)', marginTop: 5, display: 'block',
              }} />
            )}
          </button>
        ))}
      </div>
    </div>
  );
};
