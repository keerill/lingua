import { useQuery } from '@tanstack/react-query';
import type { ProgressDashboard } from '@lingua/contracts';
import { useApi } from '../api';

export function useProgressViewModel() {
  const api = useApi();
  const query = useQuery({
    queryKey: ['progress-dashboard'],
    queryFn: () => api.getDashboard(),
  });

  const dashboard = query.data as ProgressDashboard | undefined;

  return {
    dashboard: dashboard ?? null,
    isLoading: query.isLoading,
    error: query.error ? String(query.error) : null,
    isEmpty: !query.isLoading && (dashboard?.overview.totalReviews ?? 0) === 0,
  };
}
