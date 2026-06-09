import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from './model/auth/auth-context';
import { Header } from './ui/header';
import { Home } from './ui/home';
import styles from './ui/app.module.scss';

// The learner micro-frontend, loaded as a federated remote.
const LearnerApp = lazy(() => import('mfe_learner/LearnerApp'));

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

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Header />
          <Routes>
            <Route path="/" element={<Home />} />
            {/* The OIDC callback lands here with the access token in the fragment;
                AuthProvider captures it, then we send the user to the app. */}
            <Route path="/auth/callback" element={<Navigate to="/app" replace />} />
            <Route path="/app/*" element={<ProtectedLearner />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}
