import React, { useState, useEffect, useRef } from 'react';
import { Button, Typography, Card } from '../../../components/ui';
import { cn } from '../../../lib/utils';

interface RestTimerPanelProps {
  timer: any;
  lastSet: string;
}

export const RestTimerPanel: React.FC<RestTimerPanelProps> = ({
  timer,
  lastSet,
}) => {
  const [customSeconds, setCustomSeconds] = useState(() => timer.initialSeconds);
  const [showCustomTimer, setShowCustomTimer] = useState(false);
  const [timerJustDone, setTimerJustDone] = useState(false);

  const timerDoneRef = useRef(false);
  const timerResetRef = useRef(timer.reset);

  useEffect(() => {
    timerResetRef.current = timer.reset;
  }, [timer.reset]);

  useEffect(() => {
    if (timer.isDone && !timerDoneRef.current) {
      timerDoneRef.current = true;
      setTimerJustDone(true);
      const id = setTimeout(() => {
        timerResetRef.current();
        setTimerJustDone(false);
        timerDoneRef.current = false;
      }, 2500);
      return () => clearTimeout(id);
    }
    if (!timer.isDone) {
      timerDoneRef.current = false;
      setTimerJustDone(false);
    }
  }, [timer.isDone]);

  const PRESETS = [60, 90, 120, 180];

  return (
    <div className="ft-timer-panel fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[430px] z-40">
      {/* Preset buttons row */}
      <div className="flex items-center gap-1.5 mb-2.5">
        <Typography variant="mono" className="text-[oklch(0.95_0.006_75_/_0.40)] mr-1 flex-shrink-0">REST</Typography>
        {PRESETS.map((secs) => {
          const label = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;
          const active = timer.initialSeconds === secs && timer.isRunning;
          return (
            <button
              key={secs}
              onClick={() => { timer.startFrom(secs); setShowCustomTimer(false); }}
              className={cn(
                'font-mono text-[10px] font-semibold h-[30px] px-2.5 rounded-[var(--r-1)] border-none cursor-pointer transition-all tracking-tight',
                active ? 'bg-[var(--lime)] text-[var(--lime-ink)]' : 'bg-[oklch(0.95_0.006_75_/_0.10)] text-[oklch(0.95_0.006_75_/_0.60)]'
              )}
            >
              {label}
            </button>
          );
        })}
        <button
          onClick={() => setShowCustomTimer((v) => !v)}
          className={cn(
            'font-mono text-[10px] font-bold h-[30px] px-2.5 rounded-[var(--r-1)] border-none cursor-pointer ml-auto tracking-widest',
            showCustomTimer ? 'bg-[oklch(0.95_0.006_75_/_0.18)]' : 'bg-[oklch(0.95_0.006_75_/_0.10)]',
            'text-[oklch(0.95_0.006_75_/_0.60)]'
          )}
        >
          ···
        </button>
      </div>

      {/* Custom timer picker */}
      {showCustomTimer && (
        <Card variant="surface" className="flex items-center gap-2 mb-2.5 p-1 bg-[oklch(0.95_0.006_75_/_0.05)] border-none">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setCustomSeconds((s: number) => Math.max(30, s - 30))}
            className="w-9 h-9 border-none bg-[oklch(0.95_0.006_75_/_0.12)] text-white text-lg"
          >
            −
          </Button>
          <Typography variant="bignum" className="flex-1 text-center text-2xl text-[var(--lime)]">
            {`${Math.floor(customSeconds / 60)}:${String(customSeconds % 60).padStart(2, '0')}`}
          </Typography>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setCustomSeconds((s: number) => Math.min(600, s + 30))}
            className="w-9 h-9 border-none bg-[oklch(0.95_0.006_75_/_0.12)] text-white text-lg"
          >
            +
          </Button>
          <Button
            variant="lime"
            size="sm"
            onClick={() => { timer.startFrom(customSeconds); setShowCustomTimer(false); }}
            className="h-9 px-4 font-bold"
          >
            Set
          </Button>
        </Card>
      )}

      {/* Timer display + progress bar */}
      <div className="flex items-center gap-4 mb-2.5">
        <div className="min-w-[90px]">
          {timerJustDone ? (
            <Typography
              variant="bignum"
              className="text-[50px] leading-none text-[var(--lime)] animate-[timer-done-pop_0.38s_var(--ease-spring)_both] whitespace-nowrap block"
            >
              Done!
            </Typography>
          ) : (
            <Typography
              variant="bignum"
              className={cn(
                'text-[56px] leading-none block transition-colors duration-300',
                timer.isLow ? 'text-[oklch(0.75_0.18_30)]' : 'text-[var(--lime)]'
              )}
            >
              {timer.formatTime(timer.seconds)}
            </Typography>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="h-1 bg-[oklch(0.95_0.006_75_/_0.12)] rounded-full">
            <div
              className={cn(
                'h-full bg-[var(--lime)] rounded-full transition-all',
                timerJustDone ? 'duration-300 ease-[var(--ease-spring)]' : 'duration-1000 linear'
              )}
              style={{ width: timerJustDone ? '100%' : `${timer.progress * 100}%` }}
            />
          </div>
          {lastSet && (
            <Typography variant="mono" className="text-[oklch(0.95_0.006_75_/_0.40)] mt-1.5 normal-case truncate block text-[9px]">
              {lastSet}
            </Typography>
          )}
        </div>
      </div>

      {/* Controls */}
      <div className="grid grid-cols-3 gap-2">
        <Button
          onClick={timer.isRunning ? timer.pause : timer.start}
          className="h-[42px] bg-[oklch(0.95_0.006_75_/_0.95)] text-[var(--surface-hi)] border-none font-bold active:scale-95"
        >
          {timer.isRunning ? 'Pause' : 'Start'}
        </Button>
        <Button
          variant="ghost"
          onClick={timer.reset}
          className="h-[42px] border-[oklch(0.95_0.006_75_/_0.14)] text-[oklch(0.95_0.006_75_/_0.75)] hover:bg-white/5"
        >
          Reset
        </Button>
        <Button
          variant="ghost"
          onClick={timer.skip}
          className="h-[42px] border-[oklch(0.95_0.006_75_/_0.14)] text-[oklch(0.95_0.006_75_/_0.75)] hover:bg-white/5"
        >
          Skip
        </Button>
      </div>
    </div>
  );
};
