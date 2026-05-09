import React from 'react';
import { Button, Typography } from '../../../components/ui';

interface WorkoutHeaderProps {
  planName: string;
  onBack: () => void;
  onFinish: () => void;
  isCompleting: boolean;
  isAllDone: boolean;
}

export const WorkoutHeader: React.FC<WorkoutHeaderProps> = ({
  planName,
  onBack,
  onFinish,
  isCompleting,
  isAllDone,
}) => {
  return (
    <div className="p-4 px-6 flex justify-between items-center gap-4 bg-[var(--paper)]/80 backdrop-blur-md sticky top-0 z-30 border-b border-[var(--hair)]">
      <Button
        variant="secondary"
        size="icon"
        className="h-10 w-10 bg-[var(--paper-2)] border-none"
        onClick={onBack}
        aria-label="Back"
      >
        <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
          <path d="M19 12H5M11 6l-6 6 6 6"/>
        </svg>
      </Button>

      <div className="flex-1 min-w-0">
        <Typography variant="mono" className="block text-center text-[10px] opacity-40 mb-0.5 truncate uppercase font-bold tracking-widest">
          Current Workout
        </Typography>
        <Typography variant="h2" className="text-[15px] block text-center font-extrabold truncate px-2 text-[var(--ink)]">
          {planName}
        </Typography>
      </div>

      <Button
        onClick={onFinish}
        disabled={isCompleting}
        variant={isAllDone ? 'lime' : 'primary'}
        size="sm"
        className="h-10 px-4 font-extrabold shadow-md active:scale-95 transition-all"
        leftIcon={(
          <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 6L9 17l-5-5"/>
          </svg>
        )}
      >
        Finish
      </Button>
    </div>
  );
};
