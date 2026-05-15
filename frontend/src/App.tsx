import { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore, useThemeStore } from './store/store';
import { supabase } from './lib/supabase';
import ActiveWorkoutBar  from './components/ActiveWorkoutBar';
import BottomNav         from './components/BottomNav';
import ErrorBoundary     from './components/ErrorBoundary';
import { PWAUpdatePrompt } from './components/PWAUpdatePrompt';

// Route-based code splitting — each page loads only when first visited
const AuthPage           = lazy(() => import('./pages/AuthPage'));
const SetupPage          = lazy(() => import('./pages/SetupPage'));
const DashboardPage      = lazy(() => import('./pages/DashboardPage'));
const PlanDetailPage     = lazy(() => import('./pages/PlanDetailPage'));
const EditPlanPage       = lazy(() => import('./pages/EditPlanPage'));
const WorkoutPage        = lazy(() => import('./pages/WorkoutPage'));
const ProgressPage       = lazy(() => import('./pages/ProgressPage'));
const SettingsPage       = lazy(() => import('./pages/SettingsPage'));
const SessionPage        = lazy(() => import('./pages/SessionPage'));
const UpdatePasswordPage = lazy(() => import('./pages/UpdatePasswordPage'));
const ExerciseDetailPage = lazy(() => import('./pages/ExerciseDetailPage'));
const CoachPage          = lazy(() => import('./pages/CoachPage'));

function AuthEventHandler() {
  const navigate = useNavigate();
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') navigate('/update-password');
    });
    return () => subscription.unsubscribe();
  }, [navigate]);
  return null;
}

function Spinner() {
  return (
    <div className="ft-loader">
      <div className="ft-loader-dot" />
      <span className="mono-tag">Loading…</span>
    </div>
  );
}

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, initialized } = useAuthStore();
  const location = useLocation();
  if (!initialized) return <Spinner />;
  if (!user) return <Navigate to="/auth" state={{ from: location }} replace />;
  return <>{children}</>;
}

export default function App() {
  const init       = useAuthStore((s) => s.init);
  const applyTheme = useThemeStore((s) => s.applyTheme);

  useEffect(() => init(), [init]);  // init() returns the unsubscribe cleanup fn
  useEffect(() => {
    applyTheme();
    // Re-apply when system preference changes
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => applyTheme();
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [applyTheme]);

  return (
    <ErrorBoundary>
    <div className="ft-app">
      <BrowserRouter>
        <Suspense fallback={<div className="ft-loader"><div className="ft-loader-dot" /></div>}>
        <Routes>
          <Route path="/auth"            element={<AuthPage />} />
          <Route path="/"                element={<Navigate to="/dashboard" replace />} />
          <Route path="/setup"           element={<RequireAuth><SetupPage /></RequireAuth>} />
          <Route path="/dashboard"       element={<RequireAuth><DashboardPage /></RequireAuth>} />
          <Route path="/plan/:planId"        element={<RequireAuth><PlanDetailPage /></RequireAuth>} />
          <Route path="/plan/:planId/edit"   element={<RequireAuth><EditPlanPage /></RequireAuth>} />
          <Route path="/workout/:planId"     element={<RequireAuth><WorkoutPage /></RequireAuth>} />
          <Route path="/progress"            element={<RequireAuth><ProgressPage /></RequireAuth>} />
          <Route path="/coach"               element={<RequireAuth><CoachPage /></RequireAuth>} />
          <Route path="/settings"            element={<RequireAuth><SettingsPage /></RequireAuth>} />
          <Route path="/session/:sessionId"    element={<RequireAuth><SessionPage /></RequireAuth>} />
          <Route path="/exercise/:exerciseId"  element={<RequireAuth><ExerciseDetailPage /></RequireAuth>} />
          <Route path="/update-password"       element={<UpdatePasswordPage />} />
          <Route path="*"                element={<Navigate to="/dashboard" replace />} />
        </Routes>
        </Suspense>
        <ActiveWorkoutBar />
        <BottomNav />
        <AuthEventHandler />
      </BrowserRouter>
      <PWAUpdatePrompt />
    </div>
    </ErrorBoundary>
  );
}
