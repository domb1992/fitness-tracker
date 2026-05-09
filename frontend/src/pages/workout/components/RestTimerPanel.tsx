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
    <div className="ft-timer-panel fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[430px] z-40 bg-[var(--surface-hi)] shadow-[0_-12px_40px_rgba(0,0,0,0.3)]">
      {/* Preset buttons row */}
      <div className="flex items-center gap-1.5 mb-5 overflow-x-auto no-scrollbar pb-1">
        <Typography variant="mono" className="text-white/30 mr-2 flex-shrink-0 text-[9px] font-bold">REST TIMER</Typography>
        {PRESETS.map((secs) => {
          const label = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;
          const active = timer.initialSeconds === secs && timer.isRunning;
          return (
            <button
              key={secs}
              onClick={() => { timer.startFrom(secs); setShowCustomTimer(false); }}
              className={cn(
                'font-mono text-[11px] font-bold h-[34px] px-3.5 rounded-xl border-none cursor-pointer transition-all tracking-tight flex-shrink-0',
                active ? 'bg-[var(--lime)] text-[var(--lime-ink)] scale-105 shadow-lg' : 'bg-white/10 text-white/60 hover:bg-white/20'
              )}
            >
              {label}
            </button>
          );
        })}
        <button
          onClick={() => setShowCustomTimer((v) => !v)}
          className={cn(
            'font-mono text-[11px] font-bold h-[34px] px-3.5 rounded-xl border-none cursor-pointer ml-auto tracking-widest flex-shrink-0 transition-all',
            showCustomTimer ? 'bg-white/30 text-white' : 'bg-white/10 text-white/60 hover:bg-white/20'
          )}
        >
          •••
        </button>
      </div>

      {/* Custom timer picker */}
      {showCustomTimer && (
        <Card className="flex items-center gap-3 mb-6 p-1.5 bg-white/5 border-white/10 rounded-[var(--r-2)]">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setCustomSeconds((s: number) => Math.max(30, s - 30))}
            className="w-10 h-10 border-none bg-white/10 text-white text-xl rounded-xl hover:bg-white/20"
          >
            −
          </Button>
          <Typography variant="bignum" className="flex-1 text-center text-3xl text-[var(--lime)] font-bold">
            {`${Math.floor(customSeconds / 60)}:${String(customSeconds % 60).padStart(2, '0')}`}
          </Typography>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setCustomSeconds((s: number) => Math.min(600, s + 30))}
            className="w-10 h-10 border-none bg-white/10 text-white text-xl rounded-xl hover:bg-white/20"
          >
            +
          </Button>
          <Button
            variant="lime"
            size="sm"
            onClick={() => { timer.startFrom(customSeconds); setShowCustomTimer(false); }}
            className="h-10 px-5 font-black uppercase text-[11px] tracking-widest"
          >
            Set
          </Button>
        </Card>
      )}

      {/* Timer display + progress bar */}
      <div className="flex items-center gap-6 mb-6">
        <div className="min-w-[100px]">
          {timerJustDone ? (
            <Typography
              variant="bignum"
              className="text-[48px] leading-none text-[var(--lime)] animate-[timer-done-pop_0.4s_var(--ease-spring)_both] whitespace-nowrap block font-black"
            >
              Done!
            </Typography>
          ) : (
            <Typography
              variant="bignum"
              className={cn(
                'text-[64px] leading-none block transition-colors duration-300 font-medium tracking-tighter',
                timer.isLow ? 'text-[oklch(0.75_0.18_30)]' : 'text-white'
              )}
            >
              {timer.formatTime(timer.seconds)}
            </Typography>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="h-2.5 bg-white/10 rounded-full relative overflow-hidden shadow-inner">
            <div
              className={cn(
                'h-full bg-[var(--lime)] rounded-full transition-all shadow-[0_0_12px_oklch(var(--lime)_/_0.5)]',
                timerJustDone ? 'duration-300 ease-[var(--ease-spring)]' : 'duration-1000 linear'
              )}
              style={{ width: timerJustDone ? '100%' : `${timer.progress * 100}%` }}
            />
          </div>
          {lastSet && (
            <div className="flex items-center gap-2 mt-3 opacity-40 overflow-hidden">
              <span className="w-1 h-1 rounded-full bg-white flex-shrink-0" />
              <Typography variant="mono" className="text-white normal-case truncate block text-[10px] font-medium tracking-tight">
                {lastSet}
              </Typography>
            </div>
          )}
        </div>
      </div>

      {/* Controls */}
      <div className="grid grid-cols-3 gap-3">
        <Button
          onClick={timer.isRunning ? timer.pause : timer.start}
          className={cn(
            "h-[52px] border-none font-black uppercase text-[12px] tracking-[0.1em] transition-all",
            timer.isRunning ? "bg-white/10 text-white hover:bg-white/20" : "bg-white text-black hover:scale-[1.02] shadow-xl"
          )}
        >
          {timer.isRunning ? 'Pause' : 'Start'}
        </Button>
        <Button
          variant="ghost"
          onClick={timer.reset}
          className="h-[52px] border-white/10 text-white/60 hover:bg-white/10 hover:text-white uppercase text-[11px] font-bold tracking-widest"
        >
          Reset
        </Button>
        <Button
          variant="ghost"
          onClick={timer.skip}
          className="h-[52px] border-white/10 text-white/60 hover:bg-white/10 hover:text-white uppercase text-[11px] font-bold tracking-widest"
        >
          Skip
        </Button>
      </div>
    </div>
  );
};
