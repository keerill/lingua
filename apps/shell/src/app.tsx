import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from './model/auth/auth-context';
import { Header } from './ui/header';
import { Home } from './ui/home';
import styles from './ui/app.module.scss';

const LearnerApp = lazy(() => import('mfe_learner/LearnerApp'));
const SpeakingApp = lazy(() => import('mfe_speaking/SpeakingApp'));
const ProgressApp = lazy(() => import('mfe_progress/ProgressApp'));
const StudioApp = lazy(() => import('mfe_studio/StudioApp'));

const queryClient = new QueryClient();

function ProtectedLearner() {
  const { authenticated, api } = useAuth();
  if (!authenticated) return <Navigate to="/" replace />;
  return (
    <Suspense fallback={<p className={styles.loading}>Loading learner…</p>}>
      <LearnerApp api={api} />
    </Suspense>
  );
}

function ProtectedSpeaking() {
  const { authenticated, api, accessToken } = useAuth();
  if (!authenticated) return <Navigate to="/" replace />;
  return (
    <Suspense fallback={<p className={styles.loading}>Loading speaking…</p>}>
      <SpeakingApp api={api} accessToken={accessToken ?? ''} />
    </Suspense>
  );
}

function ProtectedProgress() {
  const { authenticated, api } = useAuth();
  if (!authenticated) return <Navigate to="/" replace />;
  return (
    <Suspense fallback={<p className={styles.loading}>Loading progress…</p>}>
      <ProgressApp api={api} />
    </Suspense>
  );
}

function ProtectedStudio() {
  const { authenticated, api, roles } = useAuth();
  if (!authenticated || !roles.includes('admin'))
    return <Navigate to="/" replace />;
  return (
    <Suspense fallback={<p className={styles.loading}>Loading studio…</p>}>
      <StudioApp api={api} />
    </Suspense>
  );
}

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Header />
          <Routes>
            <Route path="/" element={<Home />} />
            {}
            <Route
              path="/auth/callback"
              element={<Navigate to="/app" replace />}
            />
            <Route path="/app/*" element={<ProtectedLearner />} />
            <Route path="/speaking/*" element={<ProtectedSpeaking />} />
            <Route path="/progress/*" element={<ProtectedProgress />} />
            <Route path="/studio/*" element={<ProtectedStudio />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}
