import React from 'react';
import { Typography, Button, Sheet } from '../../../components/ui';

interface WorkoutDialogsProps {
  showConfirm: boolean;
  onConfirmClose: () => void;
  onConfirmSave: () => void;
  showAbandon: boolean;
  onAbandonClose: () => void;
  onAbandonExit: () => void;
  isCompleting: boolean;
  doneCount: number;
  totalSets: number;
}

export const WorkoutDialogs: React.FC<WorkoutDialogsProps> = ({
  showConfirm,
  onConfirmClose,
  onConfirmSave,
  showAbandon,
  onAbandonClose,
  onAbandonExit,
  isCompleting,
  doneCount,
  totalSets,
}) => {
  return (
    <>
      {/* Finish Workout Sheet */}
      <Sheet
        isOpen={showConfirm}
        onClose={onConfirmClose}
        title="Finish Workout?"
      >
        <p className="m-0 text-[var(--ink-2)] text-sm leading-relaxed mb-6">
          {doneCount}/{totalSets} sets completed.
          {doneCount < totalSets ? ' Incomplete sets will be saved as empty.' : ' Amazing work!'}
        </p>
        <div className="grid grid-cols-2 gap-2.5">
          <Button variant="ghost" onClick={onConfirmClose} className="h-12">
            Keep Going
          </Button>
          <Button onClick={onConfirmSave} disabled={isCompleting} className="h-12 bg-[var(--ink)] text-[var(--paper)]">
            {isCompleting ? 'Saving…' : 'Save & Finish'}
          </Button>
        </div>
      </Sheet>

      {/* Abandon Sheet */}
      <Sheet
        isOpen={showAbandon}
        onClose={onAbandonClose}
        title="Exit without saving?"
      >
        <p className="m-0 text-[var(--ink-2)] text-sm leading-relaxed mb-6">
          Your progress will be lost and this session won't be recorded.
        </p>
        <div className="grid grid-cols-2 gap-2.5">
          <Button variant="ghost" onClick={onAbandonClose} className="h-12">
            Keep Going
          </Button>
          <Button variant="danger" onClick={onAbandonExit} className="h-12 font-bold shadow-sm">
            Exit
          </Button>
        </div>
      </Sheet>
    </>
  );
};
