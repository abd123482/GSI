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
} from 'lucide-react';
import { useState } from 'react';
import { usePermissions } from '@/hooks/use-permissions';

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
              <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded-[2px] bg-[#383330] text-[#dad2c1] border border-[#3f3a36]">
                dev-env
              </span>
            </div>
          </Link>

          {/* Vertical Hairline Divider */}
          <div className="hidden sm:block h-4 w-px bg-[#3f3a36]" />

          {/* Desktop Navigation Links */}
          <nav className="hidden sm:flex items-center gap-1">
            {/* Stocks Link */}
            <Link
              href="/stocks"
              className={`flex items-center gap-2 px-2.5 py-1.5 rounded-[3px] text-xs font-medium transition-colors ${
                isStocksActive
                  ? 'bg-[#383330] text-[#f7f5f0] border border-[#3f3a36]'
                  : 'text-[#c9c0ad] hover:text-[#f7f5f0] hover:bg-[#383330]/70'
              }`}
            >
              <Warehouse className="w-3.5 h-3.5 text-[#aea69c]" />
              <span>Stocks</span>
            </Link>

            {/* Étagères Link */}
            <Link
              href="/shelves"
              className={`flex items-center gap-2 px-2.5 py-1.5 rounded-[3px] text-xs font-medium transition-colors ${
                isShelvesActive
                  ? 'bg-[#383330] text-[#f7f5f0] border border-[#3f3a36]'
                  : 'text-[#c9c0ad] hover:text-[#f7f5f0] hover:bg-[#383330]/70'
              }`}
            >
              <Layers className="w-3.5 h-3.5 text-[#aea69c]" />
              <span>Étagères</span>
            </Link>

            {/* Équipements Link */}
            <Link
              href="/equipment"
              className={`flex items-center gap-2 px-2.5 py-1.5 rounded-[3px] text-xs font-medium transition-colors ${
                isEquipmentActive
                  ? 'bg-[#383330] text-[#f7f5f0] border border-[#3f3a36]'
                  : 'text-[#c9c0ad] hover:text-[#f7f5f0] hover:bg-[#383330]/70'
              }`}
            >
              <Cpu className="w-3.5 h-3.5 text-[#aea69c]" />
              <span>Équipements</span>
            </Link>

            {/* Utilisateurs & Rôles Link */}
            <Link
              href="/users"
              className={`flex items-center gap-2 px-2.5 py-1.5 rounded-[3px] text-xs font-medium transition-colors ${
                isUsersActive
                  ? 'bg-[#383330] text-[#f7f5f0] border border-[#3f3a36]'
                  : 'text-[#c9c0ad] hover:text-[#f7f5f0] hover:bg-[#383330]/70'
              }`}
            >
              <Users className="w-3.5 h-3.5 text-[#aea69c]" />
              <span>Rôles & Accès</span>
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

          {/* User Profile / Auth Buttons */}
          {!isLoaded ? (
            <div className="w-7 h-7 rounded-[3px] bg-[#383330] animate-pulse" />
          ) : isSignedIn ? (
            <div className="p-0.5 rounded-[3px] border border-[#3f3a36] hover:border-[#4d4742] transition-colors flex items-center justify-center bg-[#383330]">
              <UserButton />
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
              <span>Gestion des Stocks</span>
            </div>
            <span className="text-[11px] font-mono text-[#aea69c]">/stocks</span>
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
              <span>Gestion des Étagères</span>
            </div>
            <span className="text-[11px] font-mono text-[#aea69c]">/shelves</span>
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
              <span>Équipements & Séries</span>
            </div>
            <span className="text-[11px] font-mono text-[#aea69c]">/equipment</span>
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
            <span className="text-[11px] font-mono text-[#aea69c]">/users</span>
          </Link>
        </div>
      )}
    </header>
  );
}
