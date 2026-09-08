import {
  Cpu,
  HardDrive,
  Monitor,
  Server,
  Radio,
  Wrench,
  Shield,
  Zap,
  CircuitBoard,
  Layers,
  Box,
  Laptop,
  Gauge,
  LucideIcon,
} from 'lucide-react';

export interface EquipmentVisualTheme {
  icon: LucideIcon;
  bg: string;
  text: string;
  border: string;
  badgeBg: string;
  badgeText: string;
  label: string;
}

const EQUIPMENT_THEMES: EquipmentVisualTheme[] = [
  {
    icon: Cpu,
    bg: 'bg-[#e6e0f5]',
    text: 'text-[#7b3ff2]',
    border: 'border-[#d6b6f6]',
    badgeBg: 'bg-[#e6e0f5]',
    badgeText: 'text-[#391c57]',
    label: 'Électronique & Calcul',
  },
  {
    icon: Monitor,
    bg: 'bg-[#dcecfa]',
    text: 'text-[#0075de]',
    border: 'border-[#b2d7f7]',
    badgeBg: 'bg-[#dcecfa]',
    badgeText: 'text-[#005bab]',
    label: 'Affichage & Terminaux',
  },
  {
    icon: HardDrive,
    bg: 'bg-[#d9f3e1]',
    text: 'text-[#1aae39]',
    border: 'border-[#a3e5b3]',
    badgeBg: 'bg-[#d9f3e1]',
    badgeText: 'text-[#0f6b23]',
    label: 'Stockage & Données',
  },
  {
    icon: Server,
    bg: 'bg-[#ffe8d4]',
    text: 'text-[#dd5b00]',
    border: 'border-[#fed2b2]',
    badgeBg: 'bg-[#ffe8d4]',
    badgeText: 'text-[#793400]',
    label: 'Infrastructure Réseau',
  },
  {
    icon: Radio,
    bg: 'bg-[#fde0ec]',
    text: 'text-[#ff64c8]',
    border: 'border-[#f5b8d0]',
    badgeBg: 'bg-[#fde0ec]',
    badgeText: 'text-[#a02e6d]',
    label: 'Télécoms & Sans-fil',
  },
  {
    icon: CircuitBoard,
    bg: 'bg-[#fef7d6]',
    text: 'text-[#b38600]',
    border: 'border-[#f5d75e]',
    badgeBg: 'bg-[#fef7d6]',
    badgeText: 'text-[#523410]',
    label: 'Composants Intégrés',
  },
  {
    icon: Wrench,
    bg: 'bg-[#f0eeec]',
    text: 'text-[#5d5b54]',
    border: 'border-[#c8c4be]',
    badgeBg: 'bg-[#f0eeec]',
    badgeText: 'text-[#37352f]',
    label: 'Outillage & Maintenance',
  },
];

export function getEquipmentVisualTheme(
  equipmentName?: string | null,
  index = 0,
): EquipmentVisualTheme {
  if (!equipmentName) {
    return EQUIPMENT_THEMES[index % EQUIPMENT_THEMES.length];
  }

  const name = equipmentName.toLowerCase();

  if (name.includes('serveur') || name.includes('rack') || name.includes('server')) {
    return EQUIPMENT_THEMES[3]; // Server
  }
  if (name.includes('ecran') || name.includes('moniteur') || name.includes('screen') || name.includes('display')) {
    return EQUIPMENT_THEMES[1]; // Monitor
  }
  if (name.includes('disque') || name.includes('disk') || name.includes('ssd') || name.includes('hdd')) {
    return EQUIPMENT_THEMES[2]; // HardDrive
  }
  if (name.includes('radio') || name.includes('wifi') || name.includes('antenne')) {
    return EQUIPMENT_THEMES[4]; // Radio
  }
  if (name.includes('carte') || name.includes('module') || name.includes('chip')) {
    return EQUIPMENT_THEMES[5]; // CircuitBoard
  }
  if (name.includes('outil') || name.includes('kit') || name.includes('test')) {
    return EQUIPMENT_THEMES[6]; // Wrench
  }

  // Consistent hash for stable theme by name
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash << 5) - hash + name.charCodeAt(i);
    hash |= 0;
  }
  const themeIndex = Math.abs(hash + index) % EQUIPMENT_THEMES.length;
  return EQUIPMENT_THEMES[themeIndex];
}
