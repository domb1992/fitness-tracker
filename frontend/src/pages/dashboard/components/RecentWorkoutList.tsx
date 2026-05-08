import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Typography, Card, Button } from '../../../components/ui';
import { WorkoutSession } from '../../../types';
import { fmtDuration, timeAgo } from '../../../lib/utils';

interface RecentWorkoutListProps {
  sessions: WorkoutSession[];
  onShowAll: () => void;
  onDelete: (id: string) => void;
}

export const RecentWorkoutList: React.FC<RecentWorkoutListProps> = ({
  sessions,
  onShowAll,
  onDelete,
}) => {
  const navigate = useNavigate();
  const recentSess = sessions.slice(0, 5);

  if (recentSess.length === 0) return null;

  return (
    <div className="px-5 pb-6">
      <div className="flex justify-between items-baseline mb-3">
        <Typography variant="h3">Recent Workouts</Typography>
        {sessions.length > 5 && (
          <button
            onClick={onShowAll}
            className="bg-transparent border-none cursor-pointer p-0 font-mono text-[10px] tracking-wider text-[var(--ink-2)] underline underline-offset-[3px] hover:text-[var(--ink)] transition-colors"
          >
            See all
          </button>
        )}
      </div>

      <div className="flex flex-col gap-2">
        {recentSess.map((s) => (
          <Card
            key={s.id}
            className="flex items-center overflow-hidden border-l-[3.5px]"
            style={{ borderLeftColor: s.plan_color || 'var(--ink)' }}
          >
            <button
              onClick={() => navigate(`/session/${s.id}`)}
              className="flex-1 min-w-0 bg-transparent border-none cursor-pointer text-left p-[13px_10px_13px_14px] hover:bg-[var(--paper-2)] transition-colors"
            >
              <div className="text-[13px] font-bold tracking-tight text-[var(--ink)] leading-tight truncate">
                {s.plan_name}
              </div>
              <Typography variant="mono" className="mt-1 normal-case text-[9px] opacity-70 block">
                {timeAgo(s.completed_at!)} · {fmtDuration(s.duration_seconds)} · {s.total_sets ?? 0} sets
              </Typography>
            </button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onDelete(s.id)}
              className="h-8 w-8 min-w-[32px] p-0 mr-3 text-[var(--ink-4)] border-[var(--border)] rounded-[var(--r-1)] hover:text-[var(--danger)] hover:border-[var(--danger)] active:scale-90"
            >
              <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round">
                <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/>
              </svg>
            </Button>
          </Card>
        ))}
      </div>
    </div>
  );
};
