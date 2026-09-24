'use client';

import { useQuery } from '@tanstack/react-query';
import { useApi } from './use-api';
import { useAuthQueryContext } from './use-auth-query-context';
import { usePermissions } from './use-permissions';
import { DashboardService } from '@/services/dashboard.service';
import { DashboardStats } from '@/types/dashboard';

export function useDashboard() {
  const api = useApi();
  const { userId, authReady } = useAuthQueryContext();
  const { canReadDashboard, isLoading: isAuthLoading } = usePermissions();

  const query = useQuery<DashboardStats>({
    queryKey: ['dashboard', 'stats', userId],
    queryFn: async () => {
      return DashboardService.getStats(api);
    },
    enabled: authReady && Boolean(userId) && !isAuthLoading && canReadDashboard,
    staleTime: 60 * 1000, // 1 minute
    refetchInterval: 60 * 1000, // auto background refresh every 60s
  });

  return {
    stats: query.data,
    isLoading: isAuthLoading || query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
    isRefetching: query.isRefetching,
  };
}
