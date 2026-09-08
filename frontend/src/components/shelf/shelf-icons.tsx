'use client';

import React from 'react';
import {
  Warehouse,
  Boxes,
  Package,
  Layers,
  Archive,
  FolderKanban,
  Component,
  Database,
  Tag,
  LayoutGrid,
  Bookmark,
  ShieldCheck,
  PackageCheck,
  SlidersHorizontal,
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
    bg: 'bg-[#e6e0f5]',
    border: 'border-[#d6b6f6]',
    text: 'text-[#7b3ff2]',
    label: 'Rayonage Standard',
  },
  {
    icon: Boxes,
    bg: 'bg-[#d9f3e1]',
    border: 'border-[#a3e5b3]',
    text: 'text-[#1aae39]',
    label: 'Stock Principal',
  },
  {
    icon: PackageCheck,
    bg: 'bg-[#ffe8d4]',
    border: 'border-[#fed2b2]',
    text: 'text-[#dd5b00]',
    label: 'Maintenance / Rechange',
  },
  {
    icon: Warehouse,
    bg: 'bg-[#dcecfa]',
    border: 'border-[#b2d7f7]',
    text: 'text-[#0075de]',
    label: 'Zone Centrale',
  },
  {
    icon: Archive,
    bg: 'bg-[#fde0ec]',
    border: 'border-[#f9bcd8]',
    text: 'text-[#ff64c8]',
    label: 'Réserve Sécurisée',
  },
  {
    icon: FolderKanban,
    bg: 'bg-[#fef7d6]',
    border: 'border-[#fce899]',
    text: 'text-[#b38600]',
    label: 'Stockage Rapide',
  },
  {
    icon: Component,
    bg: 'bg-[#e0f2f1]',
    border: 'border-[#b2dfdb]',
    text: 'text-[#00897b]',
    label: 'Pièces Détachées',
  },
  {
    icon: LayoutGrid,
    bg: 'bg-[#ede7f6]',
    border: 'border-[#d1c4e9]',
    text: 'text-[#512da8]',
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
