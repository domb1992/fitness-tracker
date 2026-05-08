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
    <div className="p-[10px_20px_12px] flex justify-between items-center gap-3">
      <Button
        variant="ghost"
        size="sm"
        className="icon-btn h-9 w-9 min-w-[36px]"
        onClick={onBack}
        aria-label="Back"
      >
        <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
          <path d="M19 12H5M11 6l-6 6 6 6"/>
        </svg>
      </Button>

      <Typography variant="mono" className="flex-1 text-center truncate px-2">
        {planName}
      </Typography>

      <Button
        onClick={onFinish}
        disabled={isCompleting}
        variant={isAllDone ? 'lime' : 'primary'}
        size="sm"
        className="h-9 px-3.5 font-bold shadow-sm"
        leftIcon={(
          <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 12l5 5L20 6"/>
          </svg>
        )}
      >
        Finish
      </Button>
    </div>
  );
};
