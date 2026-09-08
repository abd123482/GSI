import { clerkMiddleware } from '@clerk/nextjs/server';

/**
 * Next.js 16 Proxy convention with Clerk.
 * Attaches auth state to requests without fragile regex path blocking,
 * leaving granular security checks to protected layouts, pages, and route handlers.
 */
export default clerkMiddleware();

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
};
