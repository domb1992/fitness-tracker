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
    <div className="px-6 pb-8">
      <div className="flex justify-between items-center mb-4">
        <Typography variant="mono" className="opacity-60">Consistency</Typography>
        <Typography variant="mono" className="text-[var(--ink)] font-bold">{doneDays}/7 days</Typography>
      </div>
      <div className="grid grid-cols-7 gap-2">
        {week.map((d, i) => (
          <div
            key={i}
            onClick={() => d.sessionId && navigate(`/session/${d.sessionId}`)}
            className={cn(
              'rounded-[var(--r-1)] py-2.5 text-center relative transition-all active:scale-90 select-none',
              d.today ? 'bg-[var(--paper-2)] border-[1.5px] border-[var(--ink)]' : 'border border-transparent',
              d.on ? 'bg-[var(--ink)] text-[var(--paper)] shadow-md' : 'bg-[var(--paper-2)]',
              d.sessionId ? 'cursor-pointer hover:border-[var(--ink-4)]' : 'cursor-default'
            )}
          >
            <div className={cn(
              'font-mono text-[9px] font-bold tracking-widest mb-0.5',
              d.on ? 'opacity-50' : 'opacity-40'
            )}>
              {d.letter}
            </div>
            <Typography variant="bignum" className="text-base leading-none">
              {d.num}
            </Typography>
            {d.on && (
              <div className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-[var(--lime)]" />
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
