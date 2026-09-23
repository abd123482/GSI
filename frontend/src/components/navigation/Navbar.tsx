'use client';

import {
  useState,
} from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {
  usePathname,
} from 'next/navigation';
import {
  useAuth,
  UserButton,
} from '@clerk/nextjs';
import {
  ArrowRightLeft,
  ChevronDown,
  ClipboardList,
  Cpu,
  Layers,
  Menu,
  ShieldAlert,
  ShieldCheck,
  Users,
  Warehouse,
  X,
} from 'lucide-react';

import {
  usePermissions,
} from '@/hooks/use-permissions';

import {
  NotificationBell,
} from './NotificationBell';

import { GSILogo } from './GSILogo';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export function Navbar() {
  const pathname =
    usePathname();

  const {
    isSignedIn,
    isLoaded,
  } = useAuth();

  const permissions =
    usePermissions();

  const [
    mobileOpen,
    setMobileOpen,
  ] = useState(false);

  const active = {
    stocks:
      pathname?.startsWith(
        '/stocks',
      ) ||
      pathname?.startsWith(
        '/stock',
      ),

    shelves:
      pathname?.startsWith(
        '/shelves',
      ),

    equipment:
      pathname?.startsWith(
        '/equipment',
      ) ||
      pathname?.startsWith(
        '/equipments',
      ),

    movements:
      pathname?.startsWith(
        '/movements',
      ),

    inventory:
      pathname?.startsWith(
        '/inventory',
      ),
  };

  const stockAreaActive =
    active.stocks ||
    active.shelves ||
    active.equipment;

  return (
    <header className="sticky top-0 z-40 w-full border-b border-[#3f3a36] bg-[#2b2622]/95 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-5 sm:gap-8">
          <Link
            href="/"
            className="flex items-center gap-3"
          >

            <GSILogo className="h-9 w-auto text-[#f7f5f0]" />
          </Link>

          <div className="hidden h-4 w-px bg-[#3f3a36] sm:block" />

          <nav className="hidden items-center gap-1 sm:flex">
            <DropdownMenu>
              <DropdownMenuTrigger
                className={`flex items-center gap-2 rounded px-2.5 py-1.5 text-xs font-medium ${stockAreaActive
                  ? 'border border-[#3f3a36] bg-[#383330] text-[#f7f5f0]'
                  : 'text-[#c9c0ad] hover:bg-[#383330]/70 hover:text-[#f7f5f0]'
                  }`}
              >
                <Warehouse className="h-3.5 w-3.5" />
                Stocks
                <ChevronDown className="h-3 w-3" />
              </DropdownMenuTrigger>

              <DropdownMenuContent
                align="start"
                className="w-52 border-[#3f3a36] bg-[#2f2a26] text-[#c9c0ad]"
              >
                <NavItem
                  href="/stocks"
                  icon={
                    <Warehouse className="h-3.5 w-3.5" />
                  }
                  text="Vue d'ensemble"
                />

                <NavItem
                  href="/shelves"
                  icon={
                    <Layers className="h-3.5 w-3.5" />
                  }
                  text="Emplacements"
                />

                <NavItem
                  href="/equipment"
                  icon={
                    <Cpu className="h-3.5 w-3.5" />
                  }
                  text="Articles"
                />
              </DropdownMenuContent>
            </DropdownMenu>

            {permissions.canReadMovement && (
              <Link
                href="/movements"
                className={`flex items-center gap-2 rounded px-2.5 py-1.5 text-xs font-medium ${active.movements
                  ? 'border border-[#3f3a36] bg-[#383330] text-[#f7f5f0]'
                  : 'text-[#c9c0ad] hover:bg-[#383330]/70 hover:text-[#f7f5f0]'
                  }`}
              >
                <ArrowRightLeft className="h-3.5 w-3.5" />
                Mouvements
              </Link>
            )}

            {permissions.canReadInventory && (
              <Link
                href="/inventory"
                className={`flex items-center gap-2 rounded px-2.5 py-1.5 text-xs font-medium ${active.inventory
                  ? 'border border-[#3f3a36] bg-[#383330] text-[#f7f5f0]'
                  : 'text-[#c9c0ad] hover:bg-[#383330]/70 hover:text-[#f7f5f0]'
                  }`}
              >
                <ClipboardList className="h-3.5 w-3.5" />
                Inventaires
              </Link>
            )}
          </nav>
        </div>

        <div className="flex items-center gap-3">
          {isSignedIn && (
            <div className="hidden items-center gap-1.5 rounded border border-[#3f3a36] bg-[#383330] px-2.5 py-1 font-mono text-[11px] text-[#c9c0ad] md:flex">
              {permissions.isAdmin ||
                permissions.canCreateEquipment ||
                permissions.canCreateMovement ||
                permissions.canCreateShelf ? (
                <>
                  <ShieldCheck className="h-3 w-3 text-emerald-400" />
                  <span className="text-[#f7f5f0]">
                    Écriture
                  </span>
                </>
              ) : (
                <>
                  <ShieldAlert className="h-3 w-3 text-amber-400" />
                  <span>
                    Lecture
                  </span>
                </>
              )}
            </div>
          )}

          {isSignedIn && (
            <NotificationBell />
          )}

          {!isLoaded ? (
            <div className="h-7 w-7 animate-pulse rounded bg-[#383330]" />
          ) : isSignedIn ? (
            <div className="rounded border border-[#3f3a36] bg-[#383330] p-0.5">
              <UserButton>
                <UserButton.MenuItems>
                  <UserButton.Action label="manageAccount" />

                  <UserButton.Link
                    label="Rôles & Accès"
                    labelIcon={
                      <Users className="h-4 w-4" />
                    }
                    href="/users"
                  />

                  <UserButton.Action label="signOut" />
                </UserButton.MenuItems>
              </UserButton>
            </div>
          ) : (
            <Link
              href="/sign-in"
              className="rounded bg-[#f7f5f0] px-3 py-1.5 text-xs font-medium text-[#2b2622]"
            >
              Connexion
            </Link>
          )}

          <button
            type="button"
            onClick={() =>
              setMobileOpen(
                (value) =>
                  !value,
              )
            }
            className="rounded p-1.5 text-[#c9c0ad] hover:bg-[#383330] sm:hidden"
          >
            {mobileOpen ? (
              <X className="h-4 w-4" />
            ) : (
              <Menu className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="space-y-1 border-t border-[#3f3a36] bg-[#2b2622] px-4 py-3 sm:hidden">
          <MobileLink
            href="/stocks"
            text="Stocks"
            active={active.stocks}
            close={() =>
              setMobileOpen(
                false,
              )
            }
          />

          <MobileLink
            href="/shelves"
            text="Emplacements"
            active={
              active.shelves
            }
            close={() =>
              setMobileOpen(
                false,
              )
            }
          />

          <MobileLink
            href="/equipment"
            text="Articles"
            active={
              active.equipment
            }
            close={() =>
              setMobileOpen(
                false,
              )
            }
          />

          {permissions.canReadMovement && (
            <MobileLink
              href="/movements"
              text="Mouvements"
              active={
                active.movements
              }
              close={() =>
                setMobileOpen(
                  false,
                )
              }
            />
          )}

          {permissions.canReadInventory && (
            <MobileLink
              href="/inventory"
              text="Inventaires"
              active={
                active.inventory
              }
              close={() =>
                setMobileOpen(
                  false,
                )
              }
            />
          )}
        </div>
      )}
    </header>
  );
}

function NavItem({
  href,
  icon,
  text,
}: {
  href: string;
  icon: React.ReactNode;
  text: string;
}) {
  return (
    <DropdownMenuItem className="cursor-pointer focus:bg-[#383330] focus:text-[#f7f5f0]">
      <Link
        href={href}
        className="flex w-full items-center gap-2"
      >
        {icon}
        {text}
      </Link>
    </DropdownMenuItem>
  );
}

function MobileLink({
  href,
  text,
  active,
  close,
}: {
  href: string;
  text: string;
  active: boolean;
  close: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={close}
      className={`block rounded p-2 text-xs font-medium ${active
        ? 'border border-[#3f3a36] bg-[#383330] text-[#f7f5f0]'
        : 'text-[#c9c0ad] hover:bg-[#383330]'
        }`}
    >
      {text}
    </Link>
  );
}
