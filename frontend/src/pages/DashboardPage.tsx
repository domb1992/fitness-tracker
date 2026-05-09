import { useState, useEffect, useCallback, useRef } from 'react';
import { plansApi, sessionsApi } from '../api/client';
import ConfirmDialog from '../components/ConfirmDialog';
import { useAuthStore, useWorkoutStore } from '../store/store';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { TrainingPlan, WorkoutSession, Stats } from '../types';
import { Badge } from '../components/ui';

// Components
import { SyncBanner } from './dashboard/components/SyncBanner';
import { DashboardHeader } from './dashboard/components/DashboardHeader';
import { ActivityCalendar } from './dashboard/components/ActivityCalendar';
import { ProgramList } from './dashboard/components/ProgramList';
import { RecentWorkoutList } from './dashboard/components/RecentWorkoutList';
import { AllSessionsSheet } from './dashboard/components/AllSessionsSheet';

export default function DashboardPage() {
  const { user } = useAuthStore();
  const isOnline = useOnlineStatus();

  const {
    syncPending, sessionId, startedAt, exercises,
    clearWorkout, setSyncPending,
  } = useWorkoutStore();

  const [plans,           setPlans]           = useState<TrainingPlan[]>([]);
  const [sessions,        setSessions]        = useState<WorkoutSession[]>([]);
  const [stats,           setStats]           = useState<Stats | null>(null);
  const [loading,         setLoading]         = useState(true);
  const [showAllSessions, setShowAllSessions] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleting,        setDeleting]        = useState(false);
  const [syncing,         setSyncing]         = useState(false);
  const [syncError,       setSyncError]       = useState('');
  const syncingRef = useRef(false);

  const load = useCallback(async () => {
    try {
      const [planList, sessionList, statsData] = await Promise.all([
        plansApi.getAll(),
        sessionsApi.getAll(50),
        sessionsApi.getStats(),
      ]);
      setPlans(planList);
      setSessions(sessionList);
      setStats(statsData);
    } catch (err) {
      if (import.meta.env.DEV) console.error('[Dashboard] load error:', err);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const doSync = useCallback(async () => {
    if (!syncPending || !sessionId || !startedAt || syncingRef.current) return;
    syncingRef.current = true;
    setSyncing(true); setSyncError('');
    const durationSeconds = Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000);
    const setLogs = exercises.flatMap(({ exercise, sets }) =>
      sets.map((s, idx) => ({
        exercise_id:    exercise.id,
        set_number:     idx + 1,
        weight_kg:      s.weight ? parseFloat(s.weight) : null,
        reps_completed: s.reps.trim() || null,
        notes:          s.notes,
      }))
    );
    try {
      await sessionsApi.complete(sessionId, { durationSeconds, setLogs });
      clearWorkout();
      await load();
    } catch (err: any) {
      setSyncError(err.message || 'Sync failed — will retry when online');
      setSyncPending(true);
    } finally {
      setSyncing(false);
      syncingRef.current = false;
    }
  }, [syncPending, sessionId, startedAt, exercises, load, clearWorkout, setSyncPending]);

  useEffect(() => {
    if (isOnline && syncPending) { doSync(); }
  }, [isOnline, syncPending, doSync]);

  async function handleDeleteSession(sid: string) {
    setDeleting(true);
    try {
      await sessionsApi.delete(sid);
      setSessions((prev) => prev.filter((s) => s.id !== sid));
      setStats((prev) => prev ? { ...prev, totalWorkouts: Math.max(0, prev.totalWorkouts - 1) } : prev);
    } finally {
      setDeleting(false);
      setDeleteConfirmId(null);
    }
  }

  if (loading) {
    return (
      <div className="ft-loader">
        <div className="ft-loader-dot" />
        <span className="mono-tag">Loading…</span>
      </div>
    );
  }

  return (
    <div className="ft-screen animate-fade-in" style={{ paddingBottom: 'var(--nav-safe)' }}>

      <SyncBanner
        isOnline={isOnline}
        syncPending={syncPending}
        syncing={syncing}
        onSync={doSync}
      />

      {syncError && (
        <Badge variant="danger" className="rounded-none border-0 px-5 py-2 block">
          {syncError}
        </Badge>
      )}

      <DashboardHeader name={user?.name ?? null} />

      <ActivityCalendar sessions={sessions} />

      <ProgramList plans={plans} />

      <RecentWorkoutList
        sessions={sessions}
        onShowAll={() => setShowAllSessions(true)}
        onDelete={setDeleteConfirmId}
      />

      {/* Empty state for sessions */}
      {sessions.length === 0 && plans.length > 0 && (
        <div className="px-5 pb-6">
          <div className="empty-state border border-dashed border-[var(--border)] rounded-[var(--r-2)]">
            <div className="empty-state-icon">
              <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M7 4.5v15l13-7.5z"/>
              </svg>
            </div>
            <p className="mono-tag text-[var(--ink-4)] m-0">
              No workouts yet — start your first session above
            </p>
          </div>
        </div>
      )}

      <AllSessionsSheet
        isOpen={showAllSessions}
        onClose={() => setShowAllSessions(false)}
        sessions={sessions}
      />

      {deleteConfirmId && (
        <ConfirmDialog
          title="Delete workout?"
          message="This workout will be permanently removed and won't count toward your stats."
          confirmLabel={deleting ? 'Deleting…' : 'Delete'}
          cancelLabel="Cancel"
          dangerous
          onConfirm={() => handleDeleteSession(deleteConfirmId)}
          onCancel={() => setDeleteConfirmId(null)}
        />
      )}
    </div>
  );
}
