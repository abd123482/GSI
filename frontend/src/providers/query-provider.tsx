'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';

/**
 * High-performance React Query provider for fast client-side state,
 * background sync, and cache invalidation.
 */
export function QueryProvider({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000, // 1 minute fresh time for fast local responses
            gcTime: 5 * 60 * 1000, // 5 minutes cache retention
            refetchOnWindowFocus: false,
            retry: (failureCount, error: any) => {
              // Never retry on 401 or 403 authorization failures
              if (error?.response?.status === 401 || error?.response?.status === 403) {
                return false;
              }
              return failureCount < 2;
            },
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}
