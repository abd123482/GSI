'use client';

import React from 'react';
import {
  Warehouse,
  Boxes,
  Layers,
  Archive,
  FolderKanban,
  Component,
  LayoutGrid,
  PackageCheck,
} from 'lucide-react';

export interface ShelfVisualTheme {
  icon: React.ComponentType<{ className?: string }>;
  bg: string;
  border: string;
  text: string;
  label: string;
}

export const SHELF_PALETTES: ShelfVisualTheme[] = [
  {
    icon: Layers,
    bg: 'bg-[#2b2622]',
    border: 'border-[#3f3a36]',
    text: 'text-[#dad2c1]',
    label: 'Rayonnage Standard',
  },
  {
    icon: Boxes,
    bg: 'bg-[#162b22]',
    border: 'border-[#1e3d30]',
    text: 'text-[#10b981]',
    label: 'Stock Principal',
  },
  {
    icon: PackageCheck,
    bg: 'bg-[#2d2212]',
    border: 'border-[#453316]',
    text: 'text-[#f59e0b]',
    label: 'Maintenance / Rechange',
  },
  {
    icon: Warehouse,
    bg: 'bg-[#17253b]',
    border: 'border-[#203a5e]',
    text: 'text-[#60a5fa]',
    label: 'Zone Centrale',
  },
  {
    icon: Archive,
    bg: 'bg-[#2d1624]',
    border: 'border-[#4a2039]',
    text: 'text-[#f472b6]',
    label: 'Réserve Sécurisée',
  },
  {
    icon: FolderKanban,
    bg: 'bg-[#2d2212]',
    border: 'border-[#453316]',
    text: 'text-[#fbbf24]',
    label: 'Stockage Rapide',
  },
  {
    icon: Component,
    bg: 'bg-[#132726]',
    border: 'border-[#1e3e3c]',
    text: 'text-[#2dd4bf]',
    label: 'Pièces Détachées',
  },
  {
    icon: LayoutGrid,
    bg: 'bg-[#251f33]',
    border: 'border-[#3d3254]',
    text: 'text-[#c084fc]',
    label: 'Zone Modulaire',
  },
];

/**
 * Returns a deterministic beautiful visual theme and icon for a shelf
 * based on its name, id, or global index.
 */
export function getShelfVisualTheme(shelfName?: string | null, index: number = 0): ShelfVisualTheme {
  if (!shelfName) {
    return SHELF_PALETTES[index % SHELF_PALETTES.length];
  }

  // Calculate simple hash from name
  let hash = 0;
  for (let i = 0; i < shelfName.length; i++) {
    hash = (hash << 5) - hash + shelfName.charCodeAt(i);
    hash |= 0;
  }

  const paletteIndex = Math.abs(hash + index) % SHELF_PALETTES.length;
  return SHELF_PALETTES[paletteIndex];
}
