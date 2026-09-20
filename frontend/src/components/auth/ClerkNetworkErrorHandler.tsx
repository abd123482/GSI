'use client';

import { useEffect } from 'react';

/**
 * Global handler to intercept transient ClerkJS network errors
 * (e.g. background session touch / heartbeat failing due to sleep or brief offline blips).
 * Calling event.preventDefault() stops Next.js dev overlay from throwing a fatal red crash screen.
 */
export function ClerkNetworkErrorHandler() {
  useEffect(() => {
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      const message = reason?.message || String(reason || '');
      const stack = reason?.stack || '';

      const isClerkNetworkIssue =
        message.includes('ClerkJS: Network error') ||
        message.includes('clerk.accounts.dev') ||
        (message.includes('Failed to fetch') && (stack.includes('clerk') || message.includes('clerk')));

      if (isClerkNetworkIssue) {
        // Suppress the unhandled rejection so Next.js dev overlay won't hijack the screen
        event.preventDefault();
        console.warn('[Clerk] Suppressed transient background session touch network error:', message);
      }
    };

    const handleError = (event: ErrorEvent) => {
      const message = event.message || '';
      if (
        message.includes('ClerkJS: Network error') ||
        message.includes('clerk.accounts.dev')
      ) {
        event.preventDefault();
        console.warn('[Clerk] Suppressed global network error:', message);
      }
    };

    window.addEventListener('unhandledrejection', handleUnhandledRejection);
    window.addEventListener('error', handleError);

    return () => {
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
      window.removeEventListener('error', handleError);
    };
  }, []);

  return null;
}
