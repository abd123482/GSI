'use client';

import { usePathname } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';
import { Navbar } from './Navbar';

export function NavbarVisibility() {
  const pathname = usePathname();
  const { isSignedIn, isLoaded } = useAuth();

  // Hide navbar on auth routes or whenever the user is not signed in
  if (
    pathname?.startsWith('/sign-in') ||
    pathname?.startsWith('/sign-up') ||
    !isLoaded ||
    !isSignedIn
  ) {
    return null;
  }

  return <Navbar />;
}
