import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Typography, Card, Sheet } from '../../../components/ui';
import { WorkoutSession } from '../../../types';
import { fmtDuration, timeAgo } from '../../../lib/utils';

interface AllSessionsSheetProps {
  isOpen: boolean;
  onClose: () => void;
  sessions: WorkoutSession[];
}

export const AllSessionsSheet: React.FC<AllSessionsSheetProps> = ({
  isOpen,
  onClose,
  sessions,
}) => {
  const navigate = useNavigate();

  return (
    <Sheet
      isOpen={isOpen}
      onClose={onClose}
      title="All Workouts"
      className="ft-sheet"
    >
      <div className="flex flex-col gap-2 mt-2">
        {sessions.map((s) => (
          <Card
            key={s.id}
            interactive
            onClick={() => {
              onClose();
              navigate(`/session/${s.id}`);
            }}
            className="flex items-center overflow-hidden border-l-[3.5px] p-0"
            style={{ borderLeftColor: s.plan_color || 'var(--ink)' }}
          >
            <div className="flex-1 min-w-0 p-[13px_10px_13px_14px]">
              <div className="text-[13px] font-bold text-[var(--ink)] truncate leading-tight">
                {s.plan_name}
              </div>
              <Typography variant="mono" className="mt-1 normal-case text-[9px] opacity-70 block">
                {timeAgo(s.completed_at!)} · {fmtDuration(s.duration_seconds)} · {s.total_sets ?? 0} sets
              </Typography>
            </div>
            <svg
              width={12}
              height={12}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-[var(--ink-4)] mr-4 flex-shrink-0"
            >
              <path d="M9 18l6-6-6-6" />
            </svg>
          </Card>
        ))}
      </div>
    </Sheet>
  );
};
