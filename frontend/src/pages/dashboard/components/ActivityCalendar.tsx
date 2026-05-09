import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Typography } from '../../../components/ui';
import { cn } from '../../../lib/utils';
import { WorkoutSession } from '../../../types';

interface ActivityCalendarProps {
  sessions: WorkoutSession[];
}

export const ActivityCalendar: React.FC<ActivityCalendarProps> = ({ sessions }) => {
  const navigate = useNavigate();

  const buildWeekStrip = (sessions: WorkoutSession[]) => {
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
  };

  const week = buildWeekStrip(sessions);
  const doneDays = week.filter((d) => d.on).length;

  return (
    <div className="px-5 pb-[22px]">
      <div className="flex justify-between mb-2.5">
        <Typography variant="mono">Last 7 days</Typography>
        <Typography variant="mono">{doneDays}/7 sessions</Typography>
      </div>
      <div className="grid grid-cols-7 gap-1.5">
        {week.map((d, i) => (
          <div
            key={i}
            onClick={() => d.sessionId && navigate(`/session/${d.sessionId}`)}
            className={cn(
              'rounded-[var(--r-1)] py-2 text-center relative transition-all active:scale-95',
              d.today ? 'border-[1.5px] border-[var(--ink)]' : 'border border-[var(--border)]',
              d.on ? 'bg-[var(--ink)] text-[var(--paper)] shadow-sm' : d.today ? 'bg-[var(--paper-2)]' : 'bg-transparent',
              d.sessionId ? 'cursor-pointer hover:shadow-md' : 'cursor-default'
            )}
          >
            <div className={cn(
              'font-mono text-[9px] tracking-wider',
              d.on ? 'opacity-60' : d.today ? 'opacity-80' : 'opacity-40'
            )}>
              {d.letter}
            </div>
            <Typography variant="bignum" className="text-base mt-0.5 leading-none">
              {d.num}
            </Typography>
            {d.on && (
              <div className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-[var(--lime)]" />
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
