import { useState, useEffect, useRef, useCallback } from 'react';

const DEFAULT_SECONDS = 90;
const STORAGE_KEY = 'fittrack-timer-default';

function loadSavedSeconds(): number {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const n = parseInt(raw, 10);
      if (!isNaN(n) && n >= 10 && n <= 600) return n;
    }
  } catch { /* ignore */ }
  return DEFAULT_SECONDS;
}

export function useRestTimer() {
  const saved = loadSavedSeconds();
  const [seconds, setSeconds] = useState(saved);
  const [isRunning, setIsRunning] = useState(false);
  const [initialSeconds, setInitialSeconds] = useState(saved);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clear = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
  };

  useEffect(() => {
    if (isRunning && seconds > 0) {
      intervalRef.current = setInterval(() => setSeconds((s) => s - 1), 1000);
    } else if (seconds === 0) {
      setIsRunning(false);
    }
    return clear;
  }, [isRunning, seconds]);

  const start = useCallback(() => setIsRunning(true), []);
  const pause = useCallback(() => { setIsRunning(false); clear(); }, []);

  const reset = useCallback(() => {
    clear();
    setIsRunning(false);
    setSeconds(initialSeconds);
  }, [initialSeconds]);

  const skip = useCallback(() => {
    clear();
    setIsRunning(false);
    setSeconds(0);
  }, []);

  const startFrom = useCallback((secs: number) => {
    clear();
    setInitialSeconds(secs);
    setSeconds(secs);
    setIsRunning(true);
    try { localStorage.setItem(STORAGE_KEY, String(secs)); } catch { /* ignore */ }
  }, []);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const rem = s % 60;
    return `${m}:${rem.toString().padStart(2, '0')}`;
  };

  const progress = seconds / initialSeconds;
  const isLow = seconds <= 30 && seconds > 0;
  const isDone = seconds === 0;

  return { seconds, initialSeconds, isRunning, start, pause, reset, skip, startFrom, formatTime, progress, isLow, isDone };
}
