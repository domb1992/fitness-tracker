import { useState, useEffect } from 'react';

/**
 * Returns a live MM:SS string counting up from `startedAt`.
 * Initialises instantly from the stored timestamp so resuming
 * an existing session shows the correct elapsed time immediately.
 */
export function useWorkoutClock(startedAt: string | null): string {
  const [elapsed, setElapsed] = useState(() =>
    startedAt ? Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000) : 0
  );

  useEffect(() => {
    if (!startedAt) return;
    const iv = setInterval(
      () => setElapsed(Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000)),
      1000
    );
    return () => clearInterval(iv);
  }, [startedAt]);

  const m = Math.floor(elapsed / 60);
  const s = elapsed % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}
