import React from 'react';
import { Typography, Card, Button } from '../../../components/ui';
import { cn } from '../../../lib/utils';
import { ActiveExercise } from '../../../types';

interface StrengthExerciseCardProps {
  exIdx: number;
  activeEx: ActiveExercise;
  strengthNumber: number;
  onUpdateSet: (exIdx: number, setIdx: number, field: 'weight' | 'reps' | 'notes', value: string) => void;
  onSetDone: (exIdx: number, setIdx: number) => void;
  onAddSet: (exIdx: number) => void;
  onRemoveSet: (exIdx: number) => void;
}

const CheckIcon = () => (
  <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 6L9 17l-5-5"/>
  </svg>
);

export const StrengthExerciseCard: React.FC<StrengthExerciseCardProps> = ({
  exIdx,
  activeEx,
  strengthNumber,
  onUpdateSet,
  onSetDone,
  onAddSet,
  onRemoveSet,
}) => {
  const { exercise, sets } = activeEx;
  const doneSets = sets.filter((s) => s.done).length;
  const isCurrent = doneSets < sets.length;

  return (
    <Card
      className={cn(
        'overflow-hidden transition-all duration-500 rounded-[var(--r-3)]',
        isCurrent ? 'shadow-xl border-[1.5px] border-[var(--ink)]' : 'opacity-60 shadow-none border-[var(--hair)]'
      )}
    >
      {/* Exercise header */}
      <div className={cn(
        'flex justify-between items-center p-6 transition-colors',
        isCurrent ? 'bg-[var(--ink)] text-[var(--paper)]' : 'bg-[var(--paper-2)] text-[var(--ink)]'
      )}>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Typography
              variant="mono"
              className={cn('text-[9px] font-bold tracking-widest', isCurrent ? 'text-[var(--paper)]/50' : 'text-[var(--ink-4)]')}
            >
              EXERCISE {String(strengthNumber).padStart(2, '0')}
            </Typography>
            {isCurrent && doneSets < sets.length && (
              <div className="w-1.5 h-1.5 rounded-full bg-[var(--lime)] shadow-[0_0_0_4px_oklch(var(--lime)_/_0.2)]" />
            )}
          </div>
          <div className="text-lg font-extrabold tracking-tight leading-tight truncate">
            {exercise.name}
          </div>
          {(exercise.seat_position || exercise.notes) && (
            <div className={cn('flex flex-wrap gap-2 mt-2', isCurrent ? 'text-[var(--paper)]/60' : 'text-[var(--ink-4)]')}>
              {exercise.seat_position && <span className="font-mono text-[9px] uppercase font-bold px-1.5 py-0.5 rounded border border-current">Pos: {exercise.seat_position}</span>}
              {exercise.notes && <span className="font-sans text-[10px] italic font-medium leading-tight line-clamp-1">{exercise.notes}</span>}
            </div>
          )}
        </div>
        <div className="text-right ml-4">
          <Typography
            variant="mono"
            className={cn('block text-[9px] font-bold tracking-widest uppercase mb-0.5', isCurrent ? 'text-[var(--paper)]/50' : 'text-[var(--ink-4)]')}
          >
            Target
          </Typography>
          <Typography variant="bignum" className="text-lg leading-none font-bold">
            {exercise.sets}×{exercise.target_reps}
          </Typography>
        </div>
      </div>

      {/* Table head */}
      <div className="grid grid-cols-[40px_1fr_1fr_80px] px-6 py-3 border-b border-[var(--hair)] bg-[var(--paper-2)]/30">
        <Typography variant="mono" className="text-[9px] font-bold opacity-40">SET</Typography>
        <Typography variant="mono" className="text-center text-[9px] font-bold opacity-40">WEIGHT (KG)</Typography>
        <Typography variant="mono" className="text-center text-[9px] font-bold opacity-40">REPS</Typography>
        <span />
      </div>

      <div className="divide-y divide-[var(--hair)]">
        {sets.map((s, setIdx) => {
          const isActiveRow = !s.done && setIdx === doneSets;

          return (
            <div key={setIdx} className={cn(
              'grid grid-cols-[40px_1fr_1fr_80px] items-center px-6 min-h-[72px] transition-all duration-300',
              isActiveRow ? 'bg-[var(--paper)] scale-[1.02] z-10 shadow-sm' : 'bg-transparent'
            )}>
              <Typography
                variant="bignum"
                className={cn(
                  'text-xs font-bold block',
                  s.done ? 'text-[var(--success)]' : isActiveRow ? 'text-[var(--ink)]' : 'text-[var(--ink-4)]'
                )}
              >
                {String(setIdx + 1).padStart(2, '0')}
              </Typography>

              <div className="flex justify-center border-x border-[var(--hair)]/50 px-2 h-full items-center">
                <input
                  type="number"
                  inputMode="decimal"
                  value={s.weight}
                  onChange={(e) => onUpdateSet(exIdx, setIdx, 'weight', e.target.value)}
                  placeholder={s.lastWeight || '—'}
                  step="2.5"
                  disabled={!isActiveRow && !s.done}
                  className={cn(
                    "w-full bg-transparent border-none text-center font-mono text-xl font-bold focus:outline-none transition-all",
                    isActiveRow ? "text-[var(--ink)]" : s.done ? "text-[var(--ink-2)]" : "text-[var(--ink-4)] opacity-30"
                  )}
                />
              </div>

              <div className="flex justify-center px-2 h-full items-center">
                <input
                  type="number"
                  inputMode="numeric"
                  value={s.reps}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v === '' || /^\d*$/.test(v)) onUpdateSet(exIdx, setIdx, 'reps', v);
                  }}
                  placeholder={s.lastReps || (exercise.target_reps !== 'max' ? exercise.target_reps : '')}
                  disabled={!isActiveRow && !s.done}
                  className={cn(
                    "w-full bg-transparent border-none text-center font-mono text-xl font-bold focus:outline-none transition-all",
                    isActiveRow ? "text-[var(--ink)]" : s.done ? "text-[var(--ink-2)]" : "text-[var(--ink-4)] opacity-30"
                  )}
                />
              </div>

              <div className="flex items-center justify-center pl-4 border-l border-[var(--hair)]/50 h-full">
                <button
                  onClick={() => onSetDone(exIdx, setIdx)}
                  className={cn(
                    'set-check flex items-center justify-center h-11 w-11 rounded-xl border-2 transition-all duration-300 active:scale-90',
                    s.done ? 'bg-[var(--success)] border-[var(--success)] text-white shadow-md' : isActiveRow ? 'border-[var(--ink-3)] bg-transparent text-[var(--ink-3)]' : 'border-[var(--border)] bg-transparent text-[var(--ink-4)]'
                  )}
                >
                  {s.done ? <CheckIcon /> : <div className="w-2 h-2 rounded-full bg-current opacity-20" />}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add/Remove set */}
      <div className="flex items-center justify-between p-4 px-6 bg-[var(--paper-2)]/30 border-t border-[var(--hair)]">
        <div className="flex gap-4">
          <button
            onClick={() => onRemoveSet(exIdx)}
            disabled={sets.length <= 1}
            className="flex items-center gap-1.5 font-mono text-[9px] font-bold uppercase tracking-widest text-[var(--ink-3)] disabled:opacity-20 transition-opacity"
          >
            <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}><path d="M5 12h14"/></svg>
            Remove Set
          </button>
          <button
            onClick={() => onAddSet(exIdx)}
            className="flex items-center gap-1.5 font-mono text-[9px] font-bold uppercase tracking-widest text-[var(--ink)] hover:text-[var(--lime-ink)] transition-colors"
          >
            <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}><path d="M12 5v14M5 12h14"/></svg>
            Add Set
          </button>
        </div>
        <Typography variant="mono" className="text-[9px] opacity-30 font-bold">{sets.length} total sets</Typography>
      </div>
    </Card>
  );
};
