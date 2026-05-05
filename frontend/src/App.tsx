import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from './store/store';
import { supabase } from './lib/supabase';
import AuthPage            from './pages/AuthPage';
import SetupPage           from './pages/SetupPage';
import DashboardPage       from './pages/DashboardPage';
import PlanDetailPage      from './pages/PlanDetailPage';
import EditPlanPage        from './pages/EditPlanPage';
import WorkoutPage         from './pages/WorkoutPage';
import ProgressPage        from './pages/ProgressPage';
import SettingsPage        from './pages/SettingsPage';
import SessionPage         from './pages/SessionPage';
import UpdatePasswordPage  from './pages/UpdatePasswordPage';
import ExerciseDetailPage  from './pages/ExerciseDetailPage';
import ActiveWorkoutBar    from './components/ActiveWorkoutBar';
import BottomNav           from './components/BottomNav';
import ErrorBoundary       from './components/ErrorBoundary';

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
    <div style={{
      minHeight: '100dvh', background: 'var(--paper)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
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
  const init = useAuthStore((s) => s.init);
  useEffect(() => { init(); }, [init]);

  return (
    <ErrorBoundary>
    <div className="ft-app">
      <BrowserRouter>
        <Routes>
          <Route path="/auth"            element={<AuthPage />} />
          <Route path="/"                element={<Navigate to="/dashboard" replace />} />
          <Route path="/setup"           element={<RequireAuth><SetupPage /></RequireAuth>} />
          <Route path="/dashboard"       element={<RequireAuth><DashboardPage /></RequireAuth>} />
          <Route path="/plan/:planId"        element={<RequireAuth><PlanDetailPage /></RequireAuth>} />
          <Route path="/plan/:planId/edit"   element={<RequireAuth><EditPlanPage /></RequireAuth>} />
          <Route path="/workout/:planId"     element={<RequireAuth><WorkoutPage /></RequireAuth>} />
          <Route path="/progress"            element={<RequireAuth><ProgressPage /></RequireAuth>} />
          <Route path="/settings"            element={<RequireAuth><SettingsPage /></RequireAuth>} />
          <Route path="/session/:sessionId"    element={<RequireAuth><SessionPage /></RequireAuth>} />
          <Route path="/exercise/:exerciseId"  element={<RequireAuth><ExerciseDetailPage /></RequireAuth>} />
          <Route path="/update-password"       element={<UpdatePasswordPage />} />
          <Route path="*"                element={<Navigate to="/dashboard" replace />} />
        </Routes>
        <ActiveWorkoutBar />
        <BottomNav />
        <AuthEventHandler />
      </BrowserRouter>
    </div>
    </ErrorBoundary>
  );
}
