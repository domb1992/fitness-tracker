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
    <div className="px-5 pb-4">
      <div className="flex items-baseline justify-between">
        <div>
          <Typography variant="mono" className="block text-[10px]">Elapsed</Typography>
          <Typography variant="bignum" className="text-[50px] leading-[1.05] mt-0.5 block">
            {elapsedClock}
          </Typography>
        </div>
        <div className="text-right">
          <Typography variant="mono" className="block text-[10px]">Sets</Typography>
          <div className="mt-0.5">
            <Typography variant="bignum" className="text-[50px] leading-[1.05]">{doneCount}</Typography>
            <Typography variant="bignum" className="text-[22px] text-[var(--ink-3)]">/{totalSets}</Typography>
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1 bg-[var(--paper-3)] mt-3 rounded-full overflow-hidden">
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
