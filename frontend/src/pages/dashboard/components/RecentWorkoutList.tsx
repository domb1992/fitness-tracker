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
    <div className="px-6 pb-12">
      <div className="flex justify-between items-center mb-4">
        <Typography variant="h3" className="text-lg">Recent History</Typography>
        {sessions.length > 5 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onShowAll}
            className="h-7 px-2.5 text-[10px] uppercase font-bold tracking-wider rounded-full border-none bg-[var(--paper-2)] hover:bg-[var(--paper-3)]"
          >
            See all
          </Button>
        )}
      </div>

      <div className="flex flex-col gap-2.5">
        {recentSess.map((s) => (
          <Card
            key={s.id}
            className="flex items-center overflow-hidden p-0"
          >
            <button
              onClick={() => navigate(`/session/${s.id}`)}
              className="flex-1 min-w-0 bg-transparent border-none cursor-pointer text-left p-[18px_10px_18px_18px] hover:bg-[var(--paper-2)] transition-colors"
            >
              <div className="flex items-center gap-2.5 mb-1.5">
                <div className="w-1.5 h-1.5 rounded-full" style={{ background: s.plan_color || 'var(--ink)' }} />
                <div className="text-[14px] font-bold tracking-tight text-[var(--ink)] leading-tight truncate">
                  {s.plan_name}
                </div>
              </div>
              <Typography variant="mono" className="normal-case text-[10px] opacity-50 block font-medium">
                {timeAgo(s.completed_at!)} • {fmtDuration(s.duration_seconds)} • {s.total_sets ?? 0} sets
              </Typography>
            </button>
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(s.id);
              }}
              className="h-9 w-9 p-0 mr-4 text-[var(--ink-4)] border-none rounded-full bg-[var(--paper-2)] hover:text-[var(--danger)] hover:bg-[var(--danger)]/10 active:scale-90"
            >
              <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
                <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/>
              </svg>
            </Button>
          </Card>
        ))}
      </div>
    </div>
  );
};
