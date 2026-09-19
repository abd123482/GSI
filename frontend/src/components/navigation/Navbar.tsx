'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useAuth, UserButton } from '@clerk/nextjs';
import {
  Layers,
  Cpu,
  Warehouse,
  ShieldCheck,
  ShieldAlert,
  Menu,
  X,
  Users,
  ClipboardList,
  ChevronDown
} from 'lucide-react';
import { useState } from 'react';
import { usePermissions } from '@/hooks/use-permissions';
import { NotificationBell } from './NotificationBell';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export function Navbar() {
  const pathname = usePathname();
  const { isSignedIn, isLoaded } = useAuth();
  const permissions = usePermissions();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isStocksActive =
    pathname?.startsWith('/stocks') || pathname?.startsWith('/stock');
  const isShelvesActive = pathname?.startsWith('/shelves');
  const isEquipmentActive =
    pathname?.startsWith('/equipment') || pathname?.startsWith('/equipments');
  const isUsersActive = pathname?.startsWith('/users');
  const isInventoryActive = pathname?.startsWith('/inventory');

  return (
    <header className="sticky top-0 z-40 w-full bg-[#2b2622]/95 backdrop-blur-md border-b border-[#3f3a36] transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
        {/* Left: Brand Mark + Module Navigation Links */}
        <div className="flex items-center gap-3 sm:gap-6">
          {/* Logo Brand Mark */}
          <Link
            href="/"
            className="flex items-center gap-2.5 group focus:outline-none"
            title="Accueil SomePharm Workspace"
          >
            <div className="relative w-7 h-7 flex items-center justify-center shrink-0 transition-transform duration-200 group-hover:scale-105">
              <Image
                src="/somepharm-logo.png"
                alt="SomePharm Logo"
                width={28}
                height={28}
                className="w-7 h-7 object-contain drop-shadow-[0_1px_4px_rgba(56,189,248,0.2)]"
                priority
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[13px] font-medium text-[#f7f5f0] tracking-tight">
                SomePharm
              </span>
            </div>
          </Link>

          {/* Vertical Hairline Divider */}
          <div className="hidden sm:block h-4 w-px bg-[#3f3a36]" />

          {/* Desktop Navigation Links */}
          <nav className="hidden sm:flex items-center gap-1">
            {/* Stocks Dropdown Link */}
            <DropdownMenu>
              <DropdownMenuTrigger
                className={`flex items-center gap-2 px-2.5 py-1.5 rounded-[3px] text-xs font-medium transition-colors outline-none focus:ring-1 focus:ring-[#aea69c] ${
                  isStocksActive || isShelvesActive || isEquipmentActive
                    ? 'bg-[#383330] text-[#f7f5f0] border border-[#3f3a36]'
                    : 'text-[#c9c0ad] hover:text-[#f7f5f0] hover:bg-[#383330]/70'
                }`}
              >
                <Warehouse className="w-3.5 h-3.5 text-[#aea69c]" />
                <span>Stocks</span>
                <ChevronDown className="w-3 h-3 text-[#5c544d]" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-48 bg-[#2f2a26] border-[#3f3a36] text-[#c9c0ad]">
                <DropdownMenuItem className="focus:bg-[#383330] focus:text-[#f7f5f0] cursor-pointer">
                  <Link href="/stocks" className="flex items-center gap-2 w-full">
                    <Warehouse className="w-3.5 h-3.5" />
                    <span>Vue d'ensemble</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem className="focus:bg-[#383330] focus:text-[#f7f5f0] cursor-pointer">
                  <Link href="/shelves" className="flex items-center gap-2 w-full">
                    <Layers className="w-3.5 h-3.5" />
                    <span>Emplacements</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem className="focus:bg-[#383330] focus:text-[#f7f5f0] cursor-pointer">
                  <Link href="/equipment" className="flex items-center gap-2 w-full">
                    <Cpu className="w-3.5 h-3.5" />
                    <span>Articles</span>
                  </Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Inventaire Link (Moved to last) */}
            <Link
              href="/inventory"
              className={`flex items-center gap-2 px-2.5 py-1.5 rounded-[3px] text-xs font-medium transition-colors ${
                isInventoryActive
                  ? 'bg-[#383330] text-[#f7f5f0] border border-[#3f3a36]'
                  : 'text-[#c9c0ad] hover:text-[#f7f5f0] hover:bg-[#383330]/70'
              }`}
            >
              <ClipboardList className="w-3.5 h-3.5 text-[#aea69c]" />
              <span>Inventaires</span>
            </Link>
          </nav>
        </div>

        {/* Right: Auth / User Profile / Quick Actions */}
        <div className="flex items-center gap-3">

          {/* Permission Status Pill (Desktop) */}
          {isSignedIn && (
            <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-[3px] bg-[#383330] text-[#c9c0ad] text-[11px] font-mono border border-[#3f3a36]">
              {permissions.isAdmin ||
              permissions.canCreateEquipment ||
              permissions.canCreateShelf ? (
                <>
                  <ShieldCheck className="w-3 h-3 text-[#10b981]" />
                  <span className="text-[#f7f5f0]">Accès admin</span>
                </>
              ) : (
                <>
                  <ShieldAlert className="w-3 h-3 text-[#f59e0b]" />
                  <span>Lecture</span>
                </>
              )}
            </div>
          )}

          {/* Notifications Bell */}
          {isSignedIn && <NotificationBell />}

          {/* User Profile / Auth Buttons */}
          {!isLoaded ? (
            <div className="w-7 h-7 rounded-[3px] bg-[#383330] animate-pulse" />
          ) : isSignedIn ? (
            <div className="p-0.5 rounded-[3px] border border-[#3f3a36] hover:border-[#4d4742] transition-colors flex items-center justify-center bg-[#383330]">
              <UserButton
                appearance={{
                  elements: {
                    userButtonPopoverFooter: 'hidden',
                  },
                }}
              >
                <UserButton.MenuItems>
                  <UserButton.Action label="manageAccount" />
                  <UserButton.Link
                    label="Rôles & Accès"
                    labelIcon={<Users className="w-4 h-4" />}
                    href="/users"
                  />
                  <UserButton.Action label="signOut" />
                </UserButton.MenuItems>
              </UserButton>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link
                href="/sign-in"
                className="px-3 py-1.5 bg-[#f7f5f0] hover:bg-[#dad2c1] text-[#2b2622] text-xs font-medium rounded-[3px] transition-colors shadow-xs"
              >
                Connexion
              </Link>

              <Link
                href="/sign-up"
                className="hidden sm:inline-block px-3 py-1.5 bg-[#383330] hover:bg-[#3f3a36] text-[#f7f5f0] border border-[#3f3a36] text-xs font-medium rounded-[3px] transition-colors"
              >
                Inscription
              </Link>
            </div>
          )}

          {/* Mobile Menu Toggle Button */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="sm:hidden p-1.5 rounded-[3px] text-[#c9c0ad] hover:text-[#f7f5f0] hover:bg-[#383330] transition-colors"
            aria-label="Menu principal"
          >
            {mobileMenuOpen ? (
              <X className="w-4 h-4" />
            ) : (
              <Menu className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>

      {/* Mobile Navigation Drawer */}
      {mobileMenuOpen && (
        <div className="sm:hidden border-t border-[#3f3a36] bg-[#2b2622] px-4 py-3 space-y-1.5">
          <div className="space-y-1">
            <div className="p-2 text-[10px] font-mono text-[#5c544d] uppercase tracking-wider">Stocks & Articles</div>
            
            <Link
              href="/stocks"
              onClick={() => setMobileMenuOpen(false)}
              className={`flex items-center justify-between p-2 rounded-[3px] text-xs font-medium ${
                isStocksActive
                  ? 'bg-[#383330] text-[#f7f5f0] border border-[#3f3a36]'
                  : 'text-[#c9c0ad] hover:bg-[#383330]'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Warehouse className="w-4 h-4 text-[#aea69c]" />
                <span>Vue d'ensemble</span>
              </div>
            </Link>

            <Link
              href="/shelves"
              onClick={() => setMobileMenuOpen(false)}
              className={`flex items-center justify-between p-2 rounded-[3px] text-xs font-medium ${
                isShelvesActive
                  ? 'bg-[#383330] text-[#f7f5f0] border border-[#3f3a36]'
                  : 'text-[#c9c0ad] hover:bg-[#383330]'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Layers className="w-4 h-4 text-[#aea69c]" />
                <span>Gestion des Emplacements</span>
              </div>
            </Link>

            <Link
              href="/equipment"
              onClick={() => setMobileMenuOpen(false)}
              className={`flex items-center justify-between p-2 rounded-[3px] text-xs font-medium ${
                isEquipmentActive
                  ? 'bg-[#383330] text-[#f7f5f0] border border-[#3f3a36]'
                  : 'text-[#c9c0ad] hover:bg-[#383330]'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Cpu className="w-4 h-4 text-[#aea69c]" />
                <span>Articles & Séries</span>
              </div>
            </Link>
          </div>
          
          <div className="h-px bg-[#3f3a36] my-2" />

          <Link
            href="/inventory"
            onClick={() => setMobileMenuOpen(false)}
            className={`flex items-center justify-between p-2 rounded-[3px] text-xs font-medium ${
              isInventoryActive
                ? 'bg-[#383330] text-[#f7f5f0] border border-[#3f3a36]'
                : 'text-[#c9c0ad] hover:bg-[#383330]'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <ClipboardList className="w-4 h-4 text-[#aea69c]" />
              <span>Inventaires</span>
            </div>
          </Link>

          <Link
            href="/users"
            onClick={() => setMobileMenuOpen(false)}
            className={`flex items-center justify-between p-2 rounded-[3px] text-xs font-medium ${
              isUsersActive
                ? 'bg-[#383330] text-[#f7f5f0] border border-[#3f3a36]'
                : 'text-[#c9c0ad] hover:bg-[#383330]'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <Users className="w-4 h-4 text-[#aea69c]" />
              <span>Utilisateurs & Rôles</span>
            </div>
          </Link>
        </div>
      )}
    </header>
  );
}
