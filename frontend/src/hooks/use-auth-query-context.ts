'use client';

import { useAuth } from '@clerk/nextjs';
import { useMemo } from 'react';

/**
 * A specialized hook to provide a unified auth state for React Query.
 * This guarantees that queries are only enabled when Clerk has fully loaded
 * AND the user is signed in, avoiding anonymous 401 leaks and cache spillage.
 */
export function useAuthQueryContext() {
  const { isLoaded, isSignedIn, userId } = useAuth();

  return useMemo(() => {
    return {
      isLoaded,
      isSignedIn: Boolean(isSignedIn),
      userId,
      /** True only if Clerk is fully loaded AND the user is logged in. */
      authReady: isLoaded && Boolean(isSignedIn) && Boolean(userId),
    };
  }, [isLoaded, isSignedIn, userId]);
}
