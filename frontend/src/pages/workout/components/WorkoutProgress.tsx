import React from 'react';
import { Typography } from '../../../components/ui';
import { cn } from '../../../lib/utils';

interface WorkoutProgressProps {
  elapsedClock: string;
  doneCount: number;
  totalSets: number;
  progress: number;
  isAllDone: boolean;
}

export const WorkoutProgress: React.FC<WorkoutProgressProps> = ({
  elapsedClock,
  doneCount,
  totalSets,
  progress,
  isAllDone,
}) => {
  return (
    <div className="px-5 pb-3">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="text-[var(--ink-3)]" aria-hidden="true">
            <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
          </svg>
          <Typography variant="mono" className="text-[13px] tabular-nums text-[var(--ink-2)]">
            {elapsedClock}
          </Typography>
        </div>
        <Typography variant="mono" className="text-[13px]">
          <span className="text-[var(--ink-2)] font-semibold">{doneCount}</span>
          <span className="text-[var(--ink-4)]"> / {totalSets} sets</span>
        </Typography>
      </div>
      <div className="h-1.5 bg-[var(--paper-3)] rounded-full overflow-hidden">
        <div
          className={cn(
            'h-full rounded-full transition-all duration-500 ease-out',
            isAllDone ? 'bg-[var(--lime)]' : 'bg-[var(--ink)]'
          )}
          style={{ width: `${progress * 100}%` }}
        />
      </div>
    </div>
  );
};
