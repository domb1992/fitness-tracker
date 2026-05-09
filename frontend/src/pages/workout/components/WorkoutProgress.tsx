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
    <div className="px-6 py-8">
      <div className="flex items-end justify-between mb-6">
        <div>
          <Typography variant="mono" className="block text-[10px] opacity-40 font-bold tracking-widest mb-1 uppercase">Elapsed Time</Typography>
          <Typography variant="bignum" className="text-[54px] leading-none block font-medium tracking-tight text-[var(--ink)]">
            {elapsedClock}
          </Typography>
        </div>
        <div className="text-right">
          <Typography variant="mono" className="block text-[10px] opacity-40 font-bold tracking-widest mb-1 uppercase">Sets Completed</Typography>
          <div className="flex items-baseline justify-end leading-none">
            <Typography variant="bignum" className="text-[54px] font-medium text-[var(--ink)]">{doneCount}</Typography>
            <Typography variant="bignum" className="text-[24px] text-[var(--ink-4)] ml-1">/ {totalSets}</Typography>
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="relative h-2 bg-[var(--paper-2)] rounded-full overflow-hidden shadow-inner">
        <div
          className={cn(
            'absolute inset-y-0 left-0 rounded-full transition-all duration-700 ease-[var(--ease-spring)] shadow-sm',
            isAllDone ? 'bg-[var(--lime)]' : 'bg-[var(--ink)]'
          )}
          style={{ width: `${progress * 100}%` }}
        />
      </div>
    </div>
  );
};
