import { Route, Routes } from 'react-router-dom';
import { ApiProvider, type ApiFetch } from './model/api';
import { ProgressDashboardScreen } from './ui/dashboard/progress-dashboard';

export default function ProgressApp({ api }: { api: ApiFetch }) {
  return (
    <ApiProvider api={api}>
      <Routes>
        <Route index element={<ProgressDashboardScreen />} />
      </Routes>
    </ApiProvider>
  );
}
