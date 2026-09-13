'use client';

import { usePathname } from 'next/navigation';
import { Navbar } from './Navbar';

export function NavbarVisibility() {
  const pathname = usePathname();

  if (
    pathname?.startsWith('/sign-in') ||
    pathname?.startsWith('/sign-up')
  ) {
    return null;
  }

  return <Navbar />;
}
