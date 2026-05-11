import React from 'react';
import { useTranslation } from 'react-i18next';
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
  <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 12l5 5L20 6"/>
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
  const { t } = useTranslation();
  const { exercise, sets } = activeEx;
  const doneSets = sets.filter((s) => s.done).length;
  const isCurrent = doneSets < sets.length;

  return (
    <Card
      className={cn(
        'overflow-hidden transition-all duration-300',
        isCurrent ? 'surface border-[1.5px] border-[var(--ink)] shadow-[0_0_0_3px_oklch(0.13_0.015_75_/_0.08),_var(--shadow)]' : 'card'
      )}
    >
      {/* Exercise header */}
      <div className={cn(
        'flex justify-between items-center p-[14px_16px] transition-colors',
        isCurrent ? 'ex-header-active' : 'text-[var(--ink)]'
      )}>
        <div>
          <div className="flex items-center gap-2">
            <Typography
              variant="mono"
              className={isCurrent ? 'text-[oklch(0.95_0.006_75_/_0.50)]' : 'text-[var(--ink-3)]'}
            >
              EX {String(strengthNumber).padStart(2, '0')}
            </Typography>
            {isCurrent && doneSets < sets.length && (
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--lime)] shadow-[0_0_0_2px_var(--lime-glow)]" />
            )}
          </div>
          <div className="text-base font-bold mt-1 tracking-tight leading-tight">
            {exercise.name}
          </div>
          {exercise.seat_position && (
            <div className="mt-1 font-mono text-[9px] opacity-60 uppercase tracking-wider">
              {t('workout.seatLabel', { value: exercise.seat_position })}
            </div>
          )}
          {exercise.notes && (
            <div className="mt-1 font-mono text-[9px] opacity-55 italic leading-relaxed">
              {exercise.notes}
            </div>
          )}
        </div>
        <div className="text-right">
          <Typography
            variant="mono"
            className={isCurrent ? 'text-[oklch(0.95_0.006_75_/_0.50)]' : 'text-[var(--ink-3)]'}
          >
            {t('workout.target')}
          </Typography>
          <Typography variant="bignum" className="text-sm mt-0.5 block">
            {exercise.sets} × {exercise.target_reps}
          </Typography>
        </div>
      </div>

      {/* Table head */}
      <div className="grid grid-cols-[32px_1fr_1fr_60px] p-[8px_14px_6px_16px] border-b border-[var(--hair)] bg-[var(--paper-2)]/30">
        <Typography variant="mono" className="text-[9px]">{t('workout.set')}</Typography>
        <Typography variant="mono" className="text-center text-[9px]">{t('workout.kg')}</Typography>
        <Typography variant="mono" className="text-center text-[9px]">{t('workout.reps')}</Typography>
        <span />
      </div>

      {sets.map((s, setIdx) => {
        const isActiveRow = !s.done && setIdx === doneSets;
        const inputClass = s.done ? 'workout-input done-set' : isActiveRow ? 'workout-input active-set' : 'workout-input';

        return (
          <div key={setIdx} className={cn(
            'grid grid-cols-[32px_1fr_1fr_60px] items-center p-[6px_14px_6px_16px] min-h-[52px] transition-colors',
            setIdx < sets.length - 1 && 'border-b border-[var(--hair)]',
            isActiveRow ? 'bg-[var(--paper-2)]' : 'transparent'
          )}>
            <Typography
              variant="bignum"
              className={cn(
                'text-[12px] block',
                s.done ? 'text-[var(--ink-3)]' : isActiveRow ? 'text-[var(--ink-2)]' : 'text-[var(--ink-4)]'
              )}
            >
              {String(setIdx + 1).padStart(2, '0')}
            </Typography>

            <input
              type="number"
              inputMode="decimal"
              value={s.weight}
              onChange={(e) => onUpdateSet(exIdx, setIdx, 'weight', e.target.value)}
              placeholder={s.lastWeight || '—'}
              step="2.5"
              className={cn(inputClass, isActiveRow && 'underline underline-offset-4')}
            />

            <input
              type="number"
              inputMode="numeric"
              value={s.reps}
              onChange={(e) => {
                const v = e.target.value;
                if (v === '' || /^\d*$/.test(v)) onUpdateSet(exIdx, setIdx, 'reps', v);
              }}
              placeholder={s.lastReps || (exercise.target_reps !== 'max' ? exercise.target_reps : '')}
              className={inputClass}
            />

            <div className="flex items-center justify-center">
              <button
                onClick={() => onSetDone(exIdx, setIdx)}
                className={cn('set-check', s.done && 'done')}
              >
                {s.done && <CheckIcon />}
              </button>
            </div>
          </div>
        );
      })}

      {/* Add/Remove set */}
      <div className="flex gap-2 p-[9px_16px_13px]">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onRemoveSet(exIdx)}
          disabled={sets.length <= 1}
          className="h-8 px-3 font-mono text-[9px] uppercase tracking-widest border-[var(--border)] text-[var(--ink-3)]"
        >
          {t('workout.removeSet')}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onAddSet(exIdx)}
          className="h-8 px-3 font-mono text-[9px] uppercase tracking-widest border-[var(--border)] text-[var(--ink-3)]"
        >
          {t('workout.addSet')}
        </Button>
      </div>
    </Card>
  );
};
