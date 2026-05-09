import React from 'react';
import { Typography, Card } from '../../../components/ui';
import { cn } from '../../../lib/utils';
import { ActiveExercise } from '../../../types';

interface WarmupExerciseCardProps {
  exIdx: number;
  activeEx: ActiveExercise;
  onUpdateSet: (exIdx: number, setIdx: number, field: 'weight' | 'reps' | 'notes', value: string) => void;
  onSetDone: (exIdx: number, setIdx: number) => void;
}

const CheckIcon = () => (
  <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 6L9 17l-5-5"/>
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

  return (
    <Card
      className={cn(
        'overflow-hidden transition-all duration-500 rounded-[var(--r-3)]',
        isActive ? 'shadow-xl border-[1.5px] border-[oklch(0.68_0.16_55)]' : 'opacity-60 shadow-none border-[var(--hair)]'
      )}
    >
      {/* Header */}
      <div
        className={cn(
          'flex justify-between items-center p-6 transition-colors',
          isActive ? 'bg-[oklch(0.68_0.16_55)] text-white' : 'bg-[var(--paper-2)] text-[var(--ink)]'
        )}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Typography variant="mono" className={cn('text-[9px] font-bold tracking-widest', isActive ? 'text-white/70' : 'text-[var(--ink-4)]')}>
              WARMUP
            </Typography>
            {isActive && <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />}
          </div>
          <div className="text-lg font-extrabold tracking-tight leading-tight truncate">
            {exercise.name}
          </div>
          {(exercise.seat_position || exercise.notes) && (
            <div className={cn('flex flex-wrap gap-2 mt-2', isActive ? 'text-white/60' : 'text-[var(--ink-4)]')}>
              {exercise.seat_position && <span className="font-mono text-[9px] uppercase font-bold px-1.5 py-0.5 rounded border border-current">Pos: {exercise.seat_position}</span>}
              {exercise.notes && <span className="font-sans text-[10px] italic font-medium leading-tight line-clamp-1">{exercise.notes}</span>}
            </div>
          )}
        </div>
        {exercise.planned_duration_minutes ? (
          <div className="text-right ml-4">
            <Typography variant="mono" className={cn('block text-[9px] font-bold tracking-widest uppercase mb-0.5', isActive ? 'text-white/60' : 'text-[var(--ink-4)]')}>
              Target
            </Typography>
            <Typography variant="bignum" className="text-lg leading-none font-bold">
              {exercise.planned_duration_minutes}m
            </Typography>
          </div>
        ) : null}
      </div>

      {/* Input row */}
      <div className={cn(
        'grid grid-cols-[1fr_1fr_80px] items-center p-4 min-h-[80px] gap-4',
        isActive ? 'bg-[var(--paper)]' : 'bg-[var(--paper-2)]/50'
      )}>
        <div className="flex flex-col items-center gap-1.5">
          <Typography variant="mono" className="text-[9px] font-bold opacity-40 uppercase tracking-widest">BPM</Typography>
          <input
            type="number"
            inputMode="numeric"
            value={s?.weight ?? ''}
            onChange={(e) => onUpdateSet(exIdx, 0, 'weight', e.target.value)}
            placeholder={s?.lastWeight || '—'}
            className="w-full bg-transparent border-none text-center font-mono text-2xl font-bold focus:outline-none placeholder:text-[var(--ink-4)]"
            disabled={!isActive}
          />
        </div>
        <div className="flex flex-col items-center gap-1.5 border-x border-[var(--hair)] px-4">
          <Typography variant="mono" className="text-[9px] font-bold opacity-40 uppercase tracking-widest">MIN</Typography>
          <input
            type="number"
            inputMode="decimal"
            value={s?.reps ?? ''}
            onChange={(e) => onUpdateSet(exIdx, 0, 'reps', e.target.value)}
            placeholder={s?.lastReps || (exercise.planned_duration_minutes ? String(exercise.planned_duration_minutes) : '—')}
            className="w-full bg-transparent border-none text-center font-mono text-2xl font-bold focus:outline-none placeholder:text-[var(--ink-4)]"
            step="0.5"
            disabled={!isActive}
          />
        </div>
        <div className="flex items-center justify-center">
          <button
            onClick={() => onSetDone(exIdx, 0)}
            className={cn(
              'set-check flex items-center justify-center h-14 w-14 rounded-2xl border-2 transition-all duration-300 active:scale-90',
              s?.done ? 'bg-[var(--success)] border-[var(--success)] text-white shadow-lg' : 'border-[var(--border)] bg-transparent text-[var(--ink-4)]'
            )}
          >
            {s?.done ? <CheckIcon /> : <div className="w-2.5 h-2.5 rounded-full bg-current opacity-30" />}
          </button>
        </div>
      </div>
    </Card>
  );
};
