import React from 'react';
import { Typography, Card, Input } from '../../../components/ui';
import { cn } from '../../../lib/utils';
import { ActiveExercise } from '../../../types';

interface WarmupExerciseCardProps {
  exIdx: number;
  activeEx: ActiveExercise;
  onUpdateSet: (exIdx: number, setIdx: number, field: 'weight' | 'reps' | 'notes', value: string) => void;
  onSetDone: (exIdx: number, setIdx: number) => void;
}

const CheckIcon = () => (
  <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 12l5 5L20 6"/>
  </svg>
);

export const WarmupExerciseCard: React.FC<WarmupExerciseCardProps> = ({
  exIdx,
  activeEx,
  onUpdateSet,
  onSetDone,
}) => {
  const { exercise, sets } = activeEx;
  const s = sets[0];
  const isActive = !s?.done;
  const warmupColor = 'oklch(0.68 0.16 55)';
  const inputClass = s?.done ? 'workout-input done-set' : 'workout-input active-set';

  return (
    <Card
      className={cn(
        'overflow-hidden transition-all duration-300',
        isActive ? 'surface border-[1.5px] border-[oklch(0.68_0.16_55)] shadow-[0_0_0_3px_oklch(0.68_0.16_55_/_0.12),_var(--shadow)]' : 'card'
      )}
    >
      {/* Header */}
      <div
        className={cn(
          'flex justify-between items-center p-[14px_16px] transition-colors',
          isActive ? 'bg-[oklch(0.68_0.16_55)] text-white' : 'transparent text-[var(--ink)]'
        )}
      >
        <div>
          <div className="flex items-center gap-[7px]">
            <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="opacity-70">
              <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
            </svg>
            <Typography variant="mono" className={isActive ? 'text-[rgba(255,255,255,0.75)]' : 'text-[var(--ink-3)]'}>
              WARMUP
            </Typography>
            {isActive && <span className="w-1.5 h-1.5 rounded-full bg-white opacity-75 shadow-sm" />}
          </div>
          <div className="text-base font-bold mt-1 tracking-tight leading-tight">
            {exercise.name}
          </div>
          {exercise.seat_position && (
            <div className="mt-1 font-mono text-[9px] opacity-70 uppercase tracking-wider">
              Setting: {exercise.seat_position}
            </div>
          )}
          {exercise.notes && (
            <div className="mt-1 font-mono text-[9px] opacity-60 italic leading-relaxed">
              {exercise.notes}
            </div>
          )}
        </div>
        {exercise.planned_duration_minutes ? (
          <div className="text-right">
            <Typography variant="mono" className={isActive ? 'text-[rgba(255,255,255,0.6)]' : 'text-[var(--ink-3)]'}>
              Target
            </Typography>
            <Typography variant="bignum" className="text-sm mt-0.5 block">
              {exercise.planned_duration_minutes} min
            </Typography>
          </div>
        ) : null}
      </div>

      {/* Input row */}
      <div className="grid grid-cols-[1fr_1fr_60px] p-[8px_14px_5px_16px] border-b border-[var(--hair)]">
        <Typography variant="mono" className="text-center text-[9px]">BPM</Typography>
        <Typography variant="mono" className="text-center text-[9px]">MIN</Typography>
        <span />
      </div>
      <div className={cn(
        'grid grid-cols-[1fr_1fr_60px] items-center p-[10px_14px_10px_16px] min-height-[60px]',
        isActive ? 'bg-[var(--paper-2)]' : 'transparent'
      )}>
        <input
          type="number"
          inputMode="numeric"
          value={s?.weight ?? ''}
          onChange={(e) => onUpdateSet(exIdx, 0, 'weight', e.target.value)}
          placeholder={s?.lastWeight || '—'}
          className={cn(inputClass, isActive && 'underline underline-offset-4')}
        />
        <input
          type="number"
          inputMode="decimal"
          value={s?.reps ?? ''}
          onChange={(e) => onUpdateSet(exIdx, 0, 'reps', e.target.value)}
          placeholder={s?.lastReps || (exercise.planned_duration_minutes ? String(exercise.planned_duration_minutes) : '—')}
          className={inputClass}
          step="0.5"
        />
        <div className="flex items-center justify-center">
          <button
            onClick={() => onSetDone(exIdx, 0)}
            className={cn('set-check', s?.done && 'done')}
          >
            {s?.done && <CheckIcon />}
          </button>
        </div>
      </div>
    </Card>
  );
};
